from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import json

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset, ChatSession, ChatMessage
from app.core.qwen import qwen_client

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    system_prompt = """You are Darelm's Conversational Analyst — a precise, no-nonsense data intelligence agent powered by Qwen. Your job is to answer questions about the user's data accurately, efficiently, and honestly.

You operate in a strict Thought → Action → Observation → Thought loop. Never guess when you can compute.

CORE RULES:
1. NEVER fabricate data, statistics, or results. If you do not know, say so.
2. ALWAYS use the execute_python tool to inspect data and answer questions.
3. Keep responses concise. Lead with the answer, follow with supporting evidence.
4. If a tool call fails, diagnose the error in your next Thought, fix the code, and retry.
5. NEVER expose raw connection strings, credentials, or file paths.

OUTPUT FORMAT:
Provide your reasoning process if needed, but end with a clear Answer."""
    
    dataset_context = None
    if request.dataset_id:
        from app.agents.tools import get_dataset_context
        dataset_context = get_dataset_context(request.dataset_id, db)
        if dataset_context.get("error"):
            raise HTTPException(status_code=404, detail="Dataset not found")
            
    # Handle Session Logic
    if request.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == request.session_id, ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        # Generate a short title from the first message
        title = request.message[:50] + "..." if len(request.message) > 50 else request.message
        session = ChatSession(user_id=current_user.id, dataset_id=request.dataset_id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        
    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    # Retrieve history for context
    history_records = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at).all()
    history = [{"role": msg.role, "content": msg.content} for msg in history_records]

    def on_complete(content, thought, tool_calls):
        # Save agent message
        agent_msg = ChatMessage(
            session_id=session.id, 
            role="agent", 
            content=content or "", 
            thought=thought, 
            tool_calls=json.dumps(tool_calls) if tool_calls else None
        )
        db.add(agent_msg)
        db.commit()

    return StreamingResponse(
        qwen_client.stream_chat(
            prompt=request.message, 
            system_prompt=system_prompt,
            dataset_context=dataset_context,
            history=history,
            on_complete=on_complete
        ),
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
        
    db.delete(session)
    db.commit()
    return None
