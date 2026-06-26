from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset
from app.core.qwen import qwen_client

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None

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
            
    return StreamingResponse(
        qwen_client.stream_chat(
            prompt=request.message, 
            system_prompt=system_prompt,
            dataset_context=dataset_context
        ),
        media_type="text/event-stream"
    )
