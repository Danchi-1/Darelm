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
