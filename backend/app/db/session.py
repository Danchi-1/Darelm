from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

connect_args = {}
db_uri = settings.SQLALCHEMY_DATABASE_URI.lower()

if "postgres" in db_uri:
    # Render, Neon, Supabase, and AWS RDS drop idle connections after 5-10 minutes.
    # Long-running ML experiments and analytics tasks (10-30 mins) can cause idle connections to drop.
    # These TCP keepalive parameters force the OS to send probes every 30 seconds to keep SSL connections alive.
    connect_args = {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
elif "sqlite" in db_uri:
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
