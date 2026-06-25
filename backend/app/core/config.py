from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Darelm Backend"
    API_V1_STR: str = "/api"
    
    # SECURITY WARNING: keep the secret key used in production secret!
    SECRET_KEY: str = "super-secret-key-for-hackathon-only-change-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
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
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
