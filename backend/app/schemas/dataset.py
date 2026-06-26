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
    connection_string: Optional[str] = None
    storage_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
