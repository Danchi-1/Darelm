from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset
from app.schemas.dataset import DatasetResponse, DatasetCreateDb
from app.core.oss import oss_manager

router = APIRouter()

@router.get("/", response_model=List[DatasetResponse])
def get_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all datasets for the current user.
    """
    datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).all()
    return datasets

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a CSV or Excel file to Cloud OSS.
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400, 
            detail="Only CSV and Excel files are supported"
        )
        
    dataset_type = "CSV" if file.filename.endswith('.csv') else "Excel"
    
    try:
        # Read file size
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        # Upload to OSS
        storage_url = await oss_manager.upload_file(file)
        
        # Save metadata to DB
        dataset = Dataset(
            user_id=current_user.id,
            name=file.filename,
            dataset_type=dataset_type,
            size_bytes=file_size,
            storage_url=storage_url
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@router.post("/connect", response_model=DatasetResponse)
def connect_database(
    payload: DatasetCreateDb,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Connect to a remote PostgreSQL database. We only store the connection string.
    """
    # 1. Test the connection first without saving it
    try:
        engine = create_engine(payload.connection_string, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Could not connect to the database. Please verify your credentials. Error: {str(e)}"
        )
        
    # 2. Connection successful, save it to our DB
    dataset = Dataset(
        user_id=current_user.id,
        name=payload.name,
        dataset_type="PostgreSQL",
        connection_string=payload.connection_string
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset

@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a dataset reference.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    # TODO: Also delete from OSS if it's a file
    
    db.delete(dataset)
    db.commit()
    return None
