from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.db.models import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user

from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.api.deps import get_db

class SettingsUpdate(BaseModel):
    kaggle_username: Optional[str] = None
    kaggle_key: Optional[str] = None

@router.get("/settings")
def get_user_settings(current_user: User = Depends(get_current_user)):
    # Return whether the keys are configured, NOT the actual keys for security
    return {
        "has_kaggle_configured": bool(current_user.encrypted_kaggle_username and current_user.encrypted_kaggle_key)
    }

@router.put("/settings")
def update_user_settings(
    settings: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.core.encryption import encrypt_data
    
    if settings.kaggle_username is not None and settings.kaggle_key is not None:
        if settings.kaggle_username.strip() == "" or settings.kaggle_key.strip() == "":
            current_user.encrypted_kaggle_username = None
            current_user.encrypted_kaggle_key = None
        else:
            current_user.encrypted_kaggle_username = encrypt_data(settings.kaggle_username)
            current_user.encrypted_kaggle_key = encrypt_data(settings.kaggle_key)
            
        db.commit()
        
    return {"status": "success"}
