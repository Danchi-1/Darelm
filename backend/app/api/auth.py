from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Response
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.api.deps import get_db
from app.db.models import User
from app.schemas.user import UserCreate, UserResponse, Token, GoogleAuth
from app.core.security import get_password_hash, verify_password, create_access_token, verify_google_token
from app.core.config import settings
import uuid
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

router = APIRouter()

# Setup fastapi-mail configuration
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM or settings.MAIL_USERNAME,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        if user.is_verified:
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system.",
            )
        else:
            # User exists but is unverified. 
            # Overwrite their password and resend the verification email.
            user.hashed_password = get_password_hash(user_in.password)
            db.commit()
            db.refresh(user)
    else:
        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            is_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Send verification email via fastapi-mail
    verification_token = create_access_token(data={"sub": user.email})
    verification_link = f"http://localhost:8000{settings.API_V1_STR}/auth/verify-email?token={verification_token}"
    
    message = MessageSchema(
        subject="Darelm - Verify your account",
        recipients=[user.email],
        body=f"Welcome to Darelm! Please verify your account by clicking the following link: {verification_link}",
        subtype=MessageType.plain
    )
    
    fm = FastMail(conf)
    background_tasks.add_task(fm.send_message, message)
    
    return user

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=400, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_verified:
        return {"msg": "Email already verified"}
        
    user.is_verified = True
    db.commit()
    return {"msg": "Email verified successfully"}

@router.post("/login", response_model=Token)
def login(response: Response, db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Email not verified")
        
    access_token = create_access_token(data={"sub": user.email})
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True, secure=False, samesite="lax")
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=Token)
def google_auth(auth_in: GoogleAuth, response: Response, db: Session = Depends(get_db)):
    try:
        user_info = verify_google_token(auth_in.credential)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    email = user_info.get("email")
    google_id = user_info.get("sub")
    
    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Invalid Google token payload")
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create new user
        user = User(
            email=email,
            google_id=google_id,
            is_verified=True  # Google emails are already verified
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.google_id:
        # Link existing account to Google
        user.google_id = google_id
        db.commit()
        
    access_token = create_access_token(data={"sub": user.email})
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True, secure=False, samesite="lax")
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token", httponly=True, secure=False, samesite="lax")
    return {"msg": "Successfully logged out"}
