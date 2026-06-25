from datetime import datetime, timedelta
from typing import Optional, Any
from passlib.context import CryptContext
from jose import jwt
from app.core.config import settings
from google.oauth2 import id_token
from google.auth.transport import requests

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_google_token(token: str) -> dict[str, Any]:
    """
    Verifies the Google ID token and returns the user info payload.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), settings.GOOGLE_CLIENT_ID
        )
        return idinfo
    except ValueError as e:
        # Invalid token
        raise ValueError(f"Invalid Google token: {str(e)}")
