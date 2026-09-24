from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Darelm Backend"
    API_V1_STR: str = "/api"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    
    # SECURITY WARNING: keep the secret key used in production secret!
    SECRET_KEY: str = "super-secret-key-for-hackathon-only-change-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # CORS Origins
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Database
    # Using Postgres as requested. The Neon connection string should be provided here.
    SQLALCHEMY_DATABASE_URI: str = "postgresql://postgres:password@localhost/darelm"
    
    # Google Auth
    GOOGLE_CLIENT_ID: Optional[str] = None

    # SMTP Email Settings
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    
    # Aliyun OSS (Legacy)
    ALIYUN_ACCESS_KEY_ID: Optional[str] = None
    ALIYUN_ACCESS_KEY_SECRET: Optional[str] = None
    ALIYUN_OSS_ENDPOINT: Optional[str] = None
    ALIYUN_OSS_BUCKET_NAME: Optional[str] = None

    # S3 / Neon Object Storage
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = "darelm-s3bucket"
    S3_REGION: Optional[str] = "us-east-1"
    
    # AWS / Neon S3 aliases
    AWS_ENDPOINT_URL_S3: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: Optional[str] = None
    
    # AI Models
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FALLBACK_MODELS: list[str] = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
    ]
    QWEN_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "qwen/qwen3.8-27b:free"
    OPENROUTER_FALLBACK_MODELS: list[str] = [
        "qwen/qwen3.8-27b:free",
        "google/gemma-4-31b-it:free",
        "nvidia/nemotron-3-super-120b-a12b:free",
    ]
    E2B_API_KEY: Optional[str] = None
    
    # Encryption
    FERNET_KEY: Optional[str] = None
    
    # Keep-Alive Heartbeat (Prevent Render 15-minute sleep)
    ENABLE_KEEP_ALIVE: bool = True
    RENDER_EXTERNAL_URL: Optional[str] = "https://darelm.onrender.com"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
