from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import json
import asyncio
import time
import os
from e2b_code_interpreter import Sandbox

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset, DataCleaningSession
from app.core.config import settings
from app.core.qwen import qwen_client
import re
from app.agents.prompts_04 import SYSTEM_PROMPT
from app.agents.tools import get_dataset_context

from json_repair import repair_json

def extract_json(text: str) -> str:
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        text = match.group(1).strip()
    else:
        match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
        if match:
            text = match.group(1).strip()
    return repair_json(text, return_objects=False)

router = APIRouter()

class CleanerStartRequest(BaseModel):
    instructions: str
    dataset_id: str

from app.core.rate_limit import limiter

@router.post("/start")
@limiter.limit("5/minute")
async def start_cleaning_session(
    request: Request,
    payload: CleanerStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    active_sessions = db.query(DataCleaningSession).filter(
        DataCleaningSession.user_id == current_user.id,
        DataCleaningSession.status == "executing"
    ).count()
    
    if active_sessions >= 1:
        raise HTTPException(status_code=429, detail="You already have an active Data Cleaning session running. Please wait for it to complete.")
        
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    session = DataCleaningSession(
        user_id=current_user.id,
        dataset_id=dataset.id,
        instructions=payload.instructions,
        status="pending",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {
        "session_id": str(session.id)
    }

class CleanerExecuteRequest(BaseModel):
    session_id: str

@router.post("/execute")
async def execute_cleaning_session(
    request: CleanerExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_model = db.query(DataCleaningSession).filter(
        DataCleaningSession.id == request.session_id, 
        DataCleaningSession.user_id == current_user.id
    ).first()
    
    if not session_model:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session_model.status in ["completed", "failed"]:
        raise HTTPException(status_code=400, detail="Session already finished")
        
    session_model.status = "executing"
    db.commit()
    
    dataset_context = get_dataset_context(str(session_model.dataset_id), db)
    storage_url = dataset_context.get("url_or_connection", "")
    
    ext = ".csv" if "csv" in dataset_context.get("dataset_type", "").lower() else ".xlsx"
    import re
    dataset_name = dataset_context.get("dataset_name", f"dataset{ext}")
    sandbox_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', dataset_name)
    if not sandbox_filename.lower().endswith(ext):
        sandbox_filename += ext
        
    # Backend hard timeout 5 mins
    BACKEND_HARD_TIMEOUT = 300 
    
    async def sse_generator():
        try:
            yield f"data: {json.dumps({'status': 'thought', 'content': 'Booting up secure sandbox...'})}\n\n"
            sandbox = await asyncio.to_thread(Sandbox.create, api_key=settings.E2B_API_KEY, timeout=BACKEND_HARD_TIMEOUT)
            
            yield f"data: {json.dumps({'status': 'thought', 'content': 'Mounting raw dataset...'})}\n\n"
            
            # Mount dataset
            if storage_url and not storage_url.startswith("http"):
                if storage_url.startswith("local://"):
                    file_path = storage_url.replace("local://", "")
                else:
                    file_path = storage_url
                
                abs_path = os.path.abspath(file_path)
                import gzip
                
                def write_dataset():
                    target_path = abs_path
                    is_gz = False
                    if not os.path.exists(abs_path) and os.path.exists(f"{abs_path}.gz"):
                        target_path = f"{abs_path}.gz"
                        is_gz = True
                    elif abs_path.endswith('.gz'):
                        is_gz = True
                        
                    if is_gz and os.path.exists(target_path):
                        with gzip.open(target_path, "rb") as f:
                            sandbox.files.write(f"/home/user/{sandbox_filename}", f.read())
                    else:
                        with open(target_path, "rb") as f:
                            sandbox.files.write(f"/home/user/{sandbox_filename}", f.read())
                await asyncio.to_thread(write_dataset)
            elif storage_url and storage_url.startswith("http"):
                yield f"data: {json.dumps({'status': 'thought', 'content': 'Downloading dataset securely from cloud...'})}\n\n"
                await asyncio.to_thread(sandbox.commands.run, "pip install openpyxl xlrd", timeout=60)
                
                safe_url = json.dumps(storage_url)
                safe_filename = json.dumps(f"/home/user/{sandbox_filename}")
                download_code = f"""
import urllib.request
try:
    urllib.request.urlretrieve({safe_url}, {safe_filename})
except Exception as e:
    raise Exception("Failed to download dataset: " + str(e))
"""
                await asyncio.to_thread(sandbox.run_code, download_code)

            async def execute_react_loop():
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"DATASET PATH: /home/user/{sandbox_filename}\n\nSCHEMA:\n{json.dumps(dataset_context)}\n\nINSTRUCTIONS:\n{session_model.instructions}"}
                ]
                
                tools = [{
                    "type": "function",
                    "function": {
                        "name": "execute_python",
                        "description": "Execute Python to read, clean, and save the dataset.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "string", "description": "Python code"}
                            },
                            "required": ["code"]
                        }
                    }
                }]
                
                max_steps = 10
                for step in range(max_steps):
                    response = await qwen_client.chat_completion(
                        messages=messages,
                        tools=tools,
                        tier="smart"
                    )
                    
                    message = response.choices[0].message
                    messages.append(message.model_dump(exclude_none=True))
                    
                    if getattr(message, "content", None):
                        yield f"data: {json.dumps({'status': 'thought', 'content': message.content})}\n\n"
                    
                    if not getattr(message, "tool_calls", None):
                        yield "completed"
                        return
                        
                    for tool_call in message.tool_calls:
                        if tool_call.function.name == "execute_python":
                            args = json.loads(tool_call.function.arguments)
                            code = args.get("code", "")
                            
                            execution = await asyncio.to_thread(sandbox.run_code, code)
                            output = ""
                            if execution.logs.stdout:
                                output += "\n".join(execution.logs.stdout)
                            if execution.logs.stderr:
                                output += "\nERROR:\n" + "\n".join(execution.logs.stderr)
                            if execution.error:
                                output += f"\nFATAL ERROR: {execution.error.name}: {execution.error.value}"
                                
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "name": "execute_python",
                                "content": output[:2000] 
                            })
                yield "completed"

            try:
                async with asyncio.timeout(BACKEND_HARD_TIMEOUT - 10):
                    async for chunk in execute_react_loop():
                        if chunk == "completed":
                            break
                        yield chunk
            except asyncio.TimeoutError:
                pass
            
            # Extract preview
            yield f"data: {json.dumps({'status': 'thought', 'content': 'Extracting cleaned data preview...'})}\n\n"
            preview_json = []
            try:
                preview_str = await asyncio.to_thread(sandbox.files.read, "/home/user/preview.json")
                preview_json = json.loads(preview_str)
            except Exception as e:
                print(f"[CLEANER] No preview extracted: {str(e)}")

            # Extract cleaned dataset
            yield f"data: {json.dumps({'status': 'thought', 'content': 'Uploading cleaned dataset to storage...'})}\n\n"
            try:
                cleaned_bytes = await asyncio.to_thread(sandbox.files.read, "/home/user/cleaned_dataset.csv", format="bytes")
                
                from app.core.oss import OSSManager
                oss_mgr = OSSManager()
                
                new_dataset_name = f"[Cleaned] {dataset_name.replace(ext, '')}.csv"
                dataset_url = await oss_mgr.upload_bytes(cleaned_bytes, extension=".csv")
                
                # Create new dataset entry
                new_dataset = Dataset(
                    user_id=current_user.id,
                    name=new_dataset_name,
                    dataset_type="CSV",
                    size_bytes=len(cleaned_bytes),
                    storage_url=dataset_url
                )
                db.add(new_dataset)
                db.flush() # Get new dataset ID
                
                session_model.cleaned_dataset_id = new_dataset.id
                
                report = {
                    "preview": preview_json,
                    "summary": "Data cleaning complete.",
                    "new_dataset_id": str(new_dataset.id)
                }
                session_model.report_json = json.dumps(report)
                session_model.status = "completed"
                
                db.commit()
                
                yield f"data: {json.dumps({'status': 'completed', 'report': report})}\n\n"
                
            except Exception as e:
                session_model.status = "failed"
                db.commit()
                yield f"data: {json.dumps({'status': 'error', 'message': f'Failed to extract cleaned dataset: {str(e)}'})}\n\n"

            sandbox.kill() 
            
        except Exception as e:
            session_model.status = "failed"
            db.commit()
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
            
    db.commit()
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.get("/sessions")
def get_cleaning_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(DataCleaningSession).filter(DataCleaningSession.user_id == current_user.id).order_by(DataCleaningSession.created_at.desc()).all()
    return [{"id": str(s.id), "instructions": s.instructions[:50] + "...", "status": s.status, "dataset_id": str(s.dataset_id), "cleaned_dataset_id": str(s.cleaned_dataset_id), "created_at": s.created_at} for s in sessions]

@router.get("/session/{session_id}")
async def get_cleaning_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(DataCleaningSession).filter(
        DataCleaningSession.id == session_id,
        DataCleaningSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {
        "id": str(session.id),
        "instructions": session.instructions,
        "status": session.status,
        "report": json.loads(session.report_json or "{}"),
        "dataset_id": str(session.dataset_id),
        "cleaned_dataset_id": str(session.cleaned_dataset_id)
    }
