import uuid
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True) # Nullable because of Google Auth
    is_verified = Column(Boolean, default=False)
    google_id = Column(String, unique=True, index=True, nullable=True)

    datasets = relationship("Dataset", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    autopilot_sessions = relationship("AutopilotSession", back_populates="user", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    dataset_type = Column(String, nullable=False) # 'CSV', 'Excel', 'PostgreSQL'
    size_bytes = Column(Integer, nullable=True) 
    connection_string = Column(String, nullable=True) # For remote DBs
    storage_url = Column(String, nullable=True) # For S3/Cloud storage URLs
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="datasets")
    chat_sessions = relationship("ChatSession", back_populates="dataset", cascade="all, delete-orphan")
    autopilot_sessions = relationship("AutopilotSession", back_populates="dataset", cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False, default="New Conversation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chat_sessions")
    dataset = relationship("Dataset", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'agent'
    content = Column(String, nullable=False)
    thought = Column(String, nullable=True)
    tool_calls = Column(String, nullable=True) # Stored as JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")

class AutopilotSession(Base):
    __tablename__ = "autopilot_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True)
    goal = Column(String, nullable=False)
    sandbox_id = Column(String, nullable=True)
    plan_json = Column(String, nullable=True) # JSON string
    report_json = Column(String, nullable=True) # JSON string
    status = Column(String, nullable=False, default="planning") # planning, awaiting_confirmation, executing, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="autopilot_sessions")
    dataset = relationship("Dataset", back_populates="autopilot_sessions")
    steps = relationship("AutopilotStep", back_populates="session", cascade="all, delete-orphan", order_by="AutopilotStep.step_index")

class AutopilotStep(Base):
    __tablename__ = "autopilot_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("autopilot_sessions.id", ondelete="CASCADE"), nullable=False)
    step_index = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending") # pending, executing, completed, failed
    findings_json = Column(String, nullable=True) # JSON string
    error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    session = relationship("AutopilotSession", back_populates="steps")
