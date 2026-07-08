from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class DatasetBase(BaseModel):
    name: str
    dataset_type: str
    size_bytes: Optional[int] = None

class DatasetCreateDb(BaseModel):
    name: str
    connection_string: str

class DatasetResponse(DatasetBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PresignedUrlRequest(BaseModel):
    filename: str
    file_size: int
    content_type: str

class ConfirmUploadRequest(BaseModel):
    object_key: str
    filename: str
    file_size: int
