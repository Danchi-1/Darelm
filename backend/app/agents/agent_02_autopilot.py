from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import json
import asyncio
from e2b_code_interpreter import Sandbox

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset, AutopilotSession, AutopilotStep
from app.core.config import settings
from app.core.qwen import qwen_client
import re
from app.agents.prompts_02 import PLANNER_PROMPT, EXECUTOR_PROMPT, SYNTHESIZER_PROMPT
from app.agents.tools import get_dataset_context
import os

from json_repair import repair_json

def extract_json(text: str) -> str:
    """Extracts raw JSON using regex and json_repair."""
    # Find JSON object or array anywhere in the text
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        text = match.group(1).strip()
    else:
        # No fence — try to find raw JSON directly
        match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
        if match:
            text = match.group(1).strip()
            
    # Repair any malformed json and return the string so json.loads works
    return repair_json(text, return_objects=False)

router = APIRouter()

class AutopilotStartRequest(BaseModel):
    goal: str
    dataset_id: str

@router.post("/start")
async def start_autopilot(
    request: AutopilotStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    dataset_context = get_dataset_context(str(dataset.id), db)
    
    # 1. Run Planner LLM
    context_str = f"""USER GOAL:
{request.goal}

DATASET SCHEMA:
{json.dumps(dataset_context, indent=2)}"""
    
    plan_response = await qwen_client.generate_json(
        prompt=context_str,
        system_prompt=PLANNER_PROMPT
    )
    
    try:
        plan_json = json.loads(extract_json(plan_response))
    except:
        raise HTTPException(status_code=500, detail="Planner returned invalid JSON: " + plan_response)
        
    # 2. Save Session
    session = AutopilotSession(
        user_id=current_user.id,
        dataset_id=dataset.id,
        goal=request.goal,
        plan_json=json.dumps(plan_json),
        status="awaiting_confirmation"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "session_id": str(session.id),
        "plan": plan_json
    }

class AutopilotConfirmRequest(BaseModel):
    session_id: str
    user_feedback: Optional[str] = None

@router.post("/confirm")
async def confirm_autopilot(
    request: AutopilotConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # We must fetch the session inside the endpoint, but yield a StreamingResponse
    # that handles the long-running process.
    
    session_id_str = request.session_id
    user_feedback_str = request.user_feedback
    
    async def executor_stream():
        from app.db.session import SessionLocal
        sandbox = None
        
        # 1. Fetch initial session data in a scoped transaction
        with SessionLocal() as db:
            ap_session = db.query(AutopilotSession).filter(AutopilotSession.id == session_id_str, AutopilotSession.user_id == current_user.id).first()
            if not ap_session:
                yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                return
                
            ap_session.status = "executing"
            goal = ap_session.goal
            plan_json = ap_session.plan_json
            dataset_id = ap_session.dataset_id
            db.commit()
            
            plan = json.loads(plan_json)
            steps = plan.get("steps", [])
            dataset_context = get_dataset_context(str(dataset_id), db)
            
        try:
            print("[EXECUTOR] Starting executor_stream...")
            # Start E2B Sandbox with long timeout (30 mins = 1800s)
            print("[EXECUTOR] Creating E2B sandbox (in threadpool)...")
            sandbox = await asyncio.to_thread(Sandbox.create, timeout=1800, api_key=settings.E2B_API_KEY)
            print(f"[EXECUTOR] Sandbox created: {sandbox.sandbox_id}")
            
            with SessionLocal() as db:
                db.query(AutopilotSession).filter(AutopilotSession.id == session_id_str).update({"sandbox_id": sandbox.sandbox_id})
                db.commit()
            
            # Pre-load the dataset into the sandbox
            dataset_path = dataset_context.get("url_or_connection", "")
            sandbox_filename = "dataset.csv"
            if dataset_context.get("dataset_type", "").lower() == "excel":
                sandbox_filename = "dataset.xlsx"
                
            if dataset_path and not dataset_path.startswith("http"):
                print(f"[EXECUTOR] Uploading dataset {dataset_path} to sandbox...")
                if dataset_path.startswith("local://"):
                    dataset_path = dataset_path.replace("local://", "")
                abs_path = os.path.abspath(dataset_path)
                with open(abs_path, 'rb') as f:
                    file_bytes = f.read()
                    await asyncio.to_thread(sandbox.files.write, sandbox_filename, file_bytes)
                print("[EXECUTOR] Dataset uploaded.")
                    
            # Run initial import script to make df available globally
            init_code = f"""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

try:
    if '{sandbox_filename}'.endswith('.csv'):
        df = pd.read_csv('{sandbox_filename}')
    else:
        df = pd.read_excel('{sandbox_filename}')
except Exception as e:
    print('Failed to load dataset:', e)
"""
            print("[EXECUTOR] Running init code...")
            await asyncio.to_thread(sandbox.run_code, init_code)
            print("[EXECUTOR] Init code complete.")
            
            all_findings = {}
            
            # Phase 2: Executor Loop
            print(f"[EXECUTOR] Starting Phase 2 loops for {len(steps)} steps...")
            for step in steps:
                step_id = step.get("id")
                step_title = step.get("title", "")
                yield f"data: {json.dumps({'status': 'executing_step', 'step': step_id, 'message': f'Starting: {step_title}'})}\n\n"
                
                # Execute step ReAct loop
                feedback_context = f"\nUSER FEEDBACK ON PLAN: {user_feedback_str}" if user_feedback_str else ""
                step_prompt = f"""GOAL: {goal}{feedback_context}
PLAN: {json.dumps(plan.get("steps", []))}
CURRENT STEP: {json.dumps(step)}
PREVIOUS FINDINGS: {json.dumps(all_findings)}
DATASET SCHEMA: {json.dumps(dataset_context.get("schema", {}))}"""

                # Loop until LLM returns a final step JSON
                history = [{"role": "user", "content": step_prompt}]
                
                step_completed_json = None
                latest_chart_base64 = None
                
                for attempt in range(15): # Max 15 iterations per step
                    # Wait slightly so we don't spam
                    await asyncio.sleep(0.5)
                    
                    print(f"[EXECUTOR] Step {step_id} - Iteration {attempt}: Calling LLM...")
                    try:
                        response = await qwen_client.chat_completion(
                            messages=[{"role": "system", "content": EXECUTOR_PROMPT}] + history,
                            tools=[{"type": "function", "function": {
                                "name": "execute_python",
                                "description": "Execute Python code in a secure environment.",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "code": {"type": "string", "description": "The python code to execute"}
                                    },
                                    "required": ["code"]
                                }
                            }}]
                        )
                        print(f"[EXECUTOR] Step {step_id} - Iteration {attempt}: Received LLM response")
                    except Exception as llm_e:
                        print(f"[EXECUTOR] Step {step_id} - Iteration {attempt}: LLM Exception! {str(llm_e)}")
                        raise llm_e
                    
                    msg = response.choices[0].message
                    if msg.tool_calls:
                        tc = msg.tool_calls[0]
                        history.append({
                            "role": "assistant",
                            "content": msg.content or "",
                            "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}]
                        })
                        
                        yield f"data: {json.dumps({'status': 'executing_step', 'step': step_id, 'message': 'Running analysis code...'})}\n\n"
                        
                        try:
                            args = json.loads(tc.function.arguments)
                            code = args.get("code", "")
                            
                            # Execute in the persistent sandbox via threadpool
                            execution = await asyncio.to_thread(sandbox.run_code, code)
                            
                            result_str = ""
                            if execution.error:
                                result_str = f"ERROR: {execution.error.name} - {execution.error.value}\\n{execution.error.traceback_raw}"
                            else:
                                result_logs = []
                                for log in execution.logs.stdout:
                                    result_logs.append(log)
                                
                                # Capture chart if exists
                                if execution.results:
                                    for res in execution.results:
                                        if res.png:
                                            latest_chart_base64 = f"data:image/png;base64,{res.png}"
                                            result_logs.append("[CHART GENERATED SUCCESSFULLY]")
                                            
                                result_str = "\\n".join(result_logs)
                                if not result_str:
                                    result_str = "Code executed successfully, but produced no stdout."
                                    
                        except Exception as e:
                            result_str = f"Tool execution failed: {str(e)}"
                            
                        history.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": tc.function.name,
                            "content": result_str
                        })
                        
                    else:
                        # LLM returned standard text -> should be the step completion JSON
                        try:
                            clean_json_str = extract_json(msg.content)
                            step_completed_json = json.loads(clean_json_str)
                            
                            # If it's just a string like "Thought...", json.loads works but returns str
                            if not isinstance(step_completed_json, dict):
                                raise ValueError("Parsed JSON is not an object")
                                
                            # Attach chart if LLM signaled it and we captured one
                            if step_completed_json.get("has_chart") and latest_chart_base64:
                                step_completed_json["chart_base64"] = latest_chart_base64
                            
                            break # Successfully parsed JSON, break out of ReAct loop
                            
                        except Exception as e:
                            # Not valid JSON! The LLM hallucinated text instead of calling tools.
                            history.append({
                                "role": "assistant",
                                "content": msg.content
                            })
                            history.append({
                                "role": "user",
                                "content": "Error: You returned plain text instead of calling the execute_python tool or returning a valid JSON object. If you need to compute something, use the tool. If you are done, return ONLY a valid JSON object starting with {."
                            })
                            # Do not break, let the loop retry
                        
                # Save step to DB
                with SessionLocal() as db:
                    db_step = AutopilotStep(
                        session_id=session_id_str,
                        step_index=step_id,
                        title=step.get("title", ""),
                        description=step.get("description", ""),
                        status="completed",
                        findings_json=json.dumps(step_completed_json) if step_completed_json else "{}"
                    )
                    db.add(db_step)
                    db.commit()
                
                # Update all findings context
                if step_completed_json:
                    all_findings[f"step_{step_id}"] = step_completed_json.get("findings", {})
                    
                yield f"data: {json.dumps({'status': 'step_complete', 'step': step_completed_json})}\n\n"
                
            # Phase 3: Synthesizer
            yield f"data: {json.dumps({'status': 'synthesizing', 'message': 'Generating final report...'})}\n\n"
            
            # Fetch all completed steps for synthesis
            with SessionLocal() as db:
                all_steps = db.query(AutopilotStep).filter(AutopilotStep.session_id == session_id_str).order_by(AutopilotStep.step_index).all()
                findings_for_report = []
                for s in all_steps:
                    try:
                        f_json = json.loads(s.findings_json)
                        findings_for_report.append(f_json)
                    except:
                        pass
                    
            synth_prompt = f"""GOAL: {goal}
PLAN: {json.dumps(plan)}
COMPLETED FINDINGS:
{json.dumps(findings_for_report, indent=2)}"""

            report_response = await qwen_client.generate_json(
                prompt=synth_prompt,
                system_prompt=SYNTHESIZER_PROMPT
            )
            
            try:
                report_json = json.loads(extract_json(report_response))
                
                # Re-attach charts to report sections by matching step_ids
                for section in report_json.get("sections", []):
                    if section.get("has_chart"):
                        s_id = section.get("step_id")
                        for f in findings_for_report:
                            if f.get("step_id") == s_id and f.get("chart_base64"):
                                section["chart_base64"] = f.get("chart_base64")
                                break
                                
            except:
                report_json = {"error": "Failed to parse synthesizer JSON", "raw": report_response}
                
            with SessionLocal() as db:
                db.query(AutopilotSession).filter(AutopilotSession.id == session_id_str).update({
                    "report_json": json.dumps(report_json),
                    "status": "completed"
                })
                db.commit()
            
            yield f"data: {json.dumps({'status': 'completed', 'report': report_json})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
            try:
                from app.db.session import SessionLocal
                with SessionLocal() as db:
                    db.query(AutopilotSession).filter(AutopilotSession.id == session_id_str).update({"status": "failed"})
                    db.commit()
            except:
                pass
                
        finally:
            if sandbox:
                await asyncio.to_thread(sandbox.kill)
            try:
                from app.db.session import SessionLocal
                with SessionLocal() as db:
                    db.query(AutopilotSession).filter(AutopilotSession.id == session_id_str).update({"sandbox_id": None})
                    db.commit()
            except:
                pass

    return StreamingResponse(
        executor_stream(),
        media_type="text/event-stream"
    )

@router.get("/sessions")
def get_autopilot_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(AutopilotSession).filter(AutopilotSession.user_id == current_user.id).order_by(AutopilotSession.created_at.desc()).all()
    return [{"id": str(s.id), "title": s.goal[:50] + "..." if len(s.goal) > 50 else s.goal, "dataset_id": str(s.dataset_id), "created_at": s.created_at} for s in sessions]

@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(AutopilotSession).filter(AutopilotSession.id == session_id, AutopilotSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    steps = db.query(AutopilotStep).filter(AutopilotStep.session_id == session.id).order_by(AutopilotStep.step_index).all()
    
    return {
        "id": session.id,
        "goal": session.goal,
        "dataset_id": session.dataset_id,
        "status": session.status,
        "plan": json.loads(session.plan_json) if session.plan_json else None,
        "report": json.loads(session.report_json) if session.report_json else None,
        "steps": [
            {
                "id": s.id,
                "step_index": s.step_index,
                "title": s.title,
                "status": s.status,
                "findings": json.loads(s.findings_json) if s.findings_json else None
            } for s in steps
        ]
    }
