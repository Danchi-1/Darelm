from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import json

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset, ChatSession, ChatMessage
from app.core.llm import llm_client

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/handoff/{autopilot_session_id}")
def handoff_from_autopilot(
    autopilot_session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.db.models import AutopilotSession
    
    # Get autopilot session
    ap_session = db.query(AutopilotSession).filter(
        AutopilotSession.id == autopilot_session_id, 
        AutopilotSession.user_id == current_user.id
    ).first()
    
    if not ap_session:
        raise HTTPException(status_code=404, detail="Autopilot session not found")
        
    if not ap_session.report_json:
        raise HTTPException(status_code=400, detail="Autopilot session has not completed a report yet")
        
    # Create new Chat Session
    new_chat_session = ChatSession(
        user_id=current_user.id,
        dataset_id=ap_session.dataset_id,
        title=f"Follow-up: {ap_session.goal[:40]}..."
    )
    db.add(new_chat_session)
    db.flush()
    
    # Format the report nicely
    report_data = json.loads(ap_session.report_json)
    
    content = f"**Autopilot Report Handoff**\n\nI have reviewed the report for your goal: *{ap_session.goal}*.\n\n"
    content += f"**Executive Summary:**\n{report_data.get('executive_summary', '')}\n\n"
    
    if "sections" in report_data:
        for section in report_data["sections"]:
            content += f"**{section.get('title', '')}**\n{section.get('content', '')}\n\n"
            
    content += "What would you like to analyze further?"
    
    # Inject report as first agent message
    initial_message = ChatMessage(
        session_id=new_chat_session.id,
        role="agent",
        content=content
    )
    db.add(initial_message)
    db.commit()
    
    return {"session_id": str(new_chat_session.id)}

@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    system_prompt = """You are Darelm's Conversational Analyst — a precise, no-nonsense data intelligence agent powered by Darelm AI. Your job is to answer questions about the user's data accurately, efficiently, and honestly.

You operate in a strict Thought → Action → Observation → Thought loop. Never guess when you can compute.

CORE RULES:
1. NEVER fabricate data, statistics, or results. If you do not know, say so.
2. ALWAYS use the execute_python tool to inspect data and answer questions.
3. Keep responses concise. Lead with the answer, follow with supporting evidence.
4. If a tool call fails, diagnose the error in your next Thought, fix the code, and retry.
5. NEVER expose raw connection strings, credentials, or file paths.

AGENT BOUNDARIES (CRITICAL):
You are Agent 01 (Conversational Analyst) meant for immediate QA and data exploration.
If the user asks you to:
- Generate a comprehensive, multi-step report or perform a deeply complex autonomous analysis → Direct them to Agent 02 (Autopilot Analyst).
- Train machine learning models, forecast future data, or run predictive algorithms → Direct them to Agent 03 (ML Experimenter).
OUTPUT FORMAT:
If you need to think out loud, narrate your tool executions, or plan your steps, you MUST wrap your entire internal reasoning process inside `<thought>` and `</thought>` tags. 
After your `<thought>` block, provide the final, polished, direct answer to the user's question as if you are a professional analyst presenting a final finding."""
    
    dataset_context = None
    if request.dataset_id:
        from app.agents.tools import get_dataset_context
        dataset_context = get_dataset_context(request.dataset_id, db)
        if dataset_context.get("error"):
            async def error_stream():
                yield f"data: {json.dumps({'error': dataset_context['error']})}\n\n"
            return StreamingResponse(error_stream(), media_type="text/event-stream")
            
    # Handle Session Logic
    import uuid
    dataset_uuid = None
    if request.dataset_id:
        try:
            dataset_uuid = uuid.UUID(str(request.dataset_id))
        except (ValueError, TypeError):
            dataset_uuid = None

    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id, ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Hot-swap dataset if the user changed it mid-session
        if dataset_uuid and session.dataset_id != dataset_uuid:
            session.dataset_id = dataset_uuid
            db.commit()
    else:
        # Generate a short title from the first message
        title_prompt = f"Generate a concise 3 to 4 word title for this data analysis query: '{request.message}'. Do not use quotes, periods, or the word 'title'."
        try:
            title_res = await llm_client.chat_completion(
                messages=[{"role": "user", "content": title_prompt}],
                tier="fast"
            )
            title = title_res.choices[0].message.content.strip().strip('"').strip("'")
            if len(title) > 50:
                title = title[:50]
        except Exception:
            title = request.message[:50] + "..." if len(request.message) > 50 else request.message
        session = ChatSession(user_id=current_user.id, dataset_id=dataset_uuid, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        
    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    # Retrieve history for context
    history_records = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at).all()
    history = []
    for msg in history_records:
        if msg.role == "user":
            history.append({"role": "user", "content": msg.content})
        elif msg.role == "agent":
            tool_calls_data = None
            if msg.tool_calls:
                try:
                    tool_calls_data = json.loads(msg.tool_calls)
                except:
                    pass
            
            if tool_calls_data:
                formatted_tc = []
                for tc in tool_calls_data:
                    formatted_tc.append({
                        "id": tc.get("id"),
                        "type": "function",
                        "function": {
                            "name": tc.get("function", {}).get("name", ""),
                            "arguments": tc.get("function", {}).get("arguments", "")
                        }
                    })
                
                history.append({
                    "role": "assistant",
                    "content": msg.content or None,
                    "tool_calls": formatted_tc
                })
                
                for tc in tool_calls_data:
                    history.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": tc.get("function", {}).get("name", ""),
                        "content": str(tc.get("result", ""))
                    })
            else:
                history.append({"role": "assistant", "content": msg.content})

    # Load current sandbox_id for this session (may be None for new sessions)
    current_sandbox_id = session.sandbox_id

    def on_complete(content, thought, tool_calls):
        from app.db.session import SessionLocal
        fresh_db = SessionLocal()
        try:
            agent_msg = ChatMessage(
                session_id=session.id,
                role="agent",
                content=content or "",
                thought=thought,
                tool_calls=json.dumps(tool_calls) if tool_calls else None
            )
            fresh_db.add(agent_msg)
            fresh_db.commit()
        finally:
            fresh_db.close()

    def on_sandbox_created(new_sandbox_id: str):
        """Persist the new sandbox_id to the ChatSession so future messages reuse it."""
        from app.db.session import SessionLocal
        fresh_db = SessionLocal()
        try:
            fresh_db.query(ChatSession).filter(ChatSession.id == session.id).update(
                {"sandbox_id": new_sandbox_id}
            )
            fresh_db.commit()
        finally:
            fresh_db.close()

    async def chat_stream():
        try:
            yield f"data: {json.dumps({'session_id': str(session.id)})}\n\n"

            async for chunk in llm_client.stream_chat(
                prompt=request.message,
                system_prompt=system_prompt,
                dataset_context=dataset_context,
                history=history,
                on_complete=on_complete,
                sandbox_id=current_sandbox_id,
                on_sandbox_created=on_sandbox_created,
            ):
                yield chunk
        except Exception as e:
            print(f"[Agent 01 Stream] Error: {e}", flush=True)
            yield f"data: {json.dumps({'error': f'Agent error: {str(e)}'})}\n\n"

    db.commit() # Release DB connection back to the pool to prevent timeout during long SSE stream
    return StreamingResponse(
        chat_stream(),
        media_type="text/event-stream"
    )

@router.get("/sessions")
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    return [{"id": s.id, "title": s.title, "dataset_id": s.dataset_id, "created_at": s.created_at} for s in sessions]

@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    messages = []
    for msg in session.messages:
        messages.append({
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "thought": msg.thought,
            "tool_calls": json.loads(msg.tool_calls) if msg.tool_calls else None,
            "created_at": msg.created_at
        })
        
    return {
        "id": session.id,
        "title": session.title,
        "dataset_id": session.dataset_id,
        "created_at": session.created_at,
        "messages": messages
    }

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session.sandbox_id:
        try:
            from e2b_code_interpreter import Sandbox
            import threading
            _sid = session.sandbox_id
            threading.Thread(target=lambda: Sandbox.connect(_sid).kill(), daemon=True).start()
        except Exception:
            pass

    db.delete(session)
    db.commit()
    return None

class SessionRenameRequest(BaseModel):
    title: str

@router.patch("/sessions/{session_id}")
def rename_session(
    session_id: str,
    request: SessionRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.title = request.title
    db.commit()
    return {"message": "Success"}
