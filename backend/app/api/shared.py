from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import AutopilotSession
import json

router = APIRouter()

@router.get("/dashboard/{session_id}")
def get_shared_dashboard(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to fetch a read-only dashboard.
    Does NOT require authentication.
    """
    session = db.query(AutopilotSession).filter(AutopilotSession.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    if not session.report_json:
        raise HTTPException(status_code=400, detail="Report not ready yet")
        
    try:
        report = json.loads(session.report_json)
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid report data")
        
    # Return only the necessary data for a dashboard to avoid leaking extra info
    return {
        "id": str(session.id),
        "title": report.get("title", "Analysis Dashboard"),
        "executive_summary": report.get("executive_summary", ""),
        "sections": report.get("sections", []),
        "conclusions": report.get("conclusions", []),
        "recommendations": report.get("recommendations", [])
    }
