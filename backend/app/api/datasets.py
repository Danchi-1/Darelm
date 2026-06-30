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

from fastapi import BackgroundTasks
import os
import gzip

def compress_dataset_background(storage_url: str):
    """Background task to compress local datasets and replace original."""
    if storage_url.startswith("local://"):
        local_path = storage_url.replace("local://", "")
        abs_path = os.path.abspath(local_path)
        
        if os.path.exists(abs_path):
            tmp_gz = f"{abs_path}.gz.tmp"
            final_gz = f"{abs_path}.gz"
            
            try:
                # Compress to temp file
                with open(abs_path, 'rb') as f_in:
                    with gzip.open(tmp_gz, 'wb') as f_out:
                        f_out.writelines(f_in)
                
                # Atomic rename
                os.rename(tmp_gz, final_gz)
                
                # Delete original
                os.remove(abs_path)
            except Exception as e:
                print(f"Background compression failed: {e}")
                if os.path.exists(tmp_gz):
                    os.remove(tmp_gz)

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    background_tasks: BackgroundTasks,
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
        
        # Enforce size limit (e.g., 50MB max)
        MAX_FILE_SIZE = 50 * 1024 * 1024
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
            
        # File signature validation using python-magic
        import magic
        mime_type = magic.from_buffer(file.file.read(2048), mime=True)
        file.file.seek(0)
        
        allowed_mimes = [
            'text/plain', 'text/csv', 'application/csv', 
            'application/vnd.ms-excel', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        
        if mime_type not in allowed_mimes:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file content detected ({mime_type}). File must be a valid CSV or Excel document."
            )
        
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
        
        # Kick off background compression if it's a local file
        background_tasks.add_task(compress_dataset_background, storage_url)
        
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
    import urllib.parse
    import socket
    import ipaddress
    
    # SSRF Protection: Parse connection string and resolve hostname
    try:
        parsed_url = urllib.parse.urlparse(payload.connection_string)
        if not parsed_url.hostname:
            raise ValueError("Invalid connection string format")
            
        ip = socket.gethostbyname(parsed_url.hostname)
        ip_obj = ipaddress.ip_address(ip)
        
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            raise HTTPException(status_code=400, detail="Connections to private or local IP addresses are not permitted.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Invalid connection string or unresolvable hostname: {str(e)}")

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

@router.get("/{dataset_id}/schema")
def get_dataset_schema(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the schema of a dataset.
    """
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    from app.agents.tools import get_dataset_context
    context = get_dataset_context(dataset_id, db)
    
    if "error" in context or "error_loading_schema" in context:
        return {"columns": []}
        
    schema_dict = context.get("schema", {})
    if not schema_dict:
        return {"columns": []}
        
    columns = [{"name": col, "type": dtype} for col, dtype in schema_dict.items()]
    return {"columns": columns}

from pydantic import BaseModel

class ImportUrlRequest(BaseModel):
    url: str

@router.post("/import-url", response_model=DatasetResponse)
async def import_url_dataset(
    request: ImportUrlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import uuid
    import httpx
    from urllib.parse import urlparse
    import os
    
    url = request.url
    parsed = urlparse(url)
    
    # Simple extraction of filename
    filename = os.path.basename(parsed.path)
    if not filename:
        filename = "imported_dataset.csv"
        
    dataset_type = "Excel" if filename.lower().endswith('.xlsx') else "CSV"
    
    unique_filename = f"{uuid.uuid4()}-{filename}"
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Check if Kaggle
    if "kaggle.com" in url:
        from app.core.encryption import decrypt_data
        
        username = current_user.encrypted_kaggle_username
        key = current_user.encrypted_kaggle_key
        
        if not username or not key:
            raise HTTPException(status_code=400, detail="Kaggle credentials not configured in settings")
            
        decrypted_username = decrypt_data(username)
        decrypted_key = decrypt_data(key)
        
        os.environ["KAGGLE_USERNAME"] = decrypted_username
        os.environ["KAGGLE_KEY"] = decrypted_key
        
        # Format: https://www.kaggle.com/datasets/zsinghrahulk/global-air-pollution-dataset
        parts = parsed.path.strip('/').split('/')
        if len(parts) >= 3 and parts[0] == "datasets":
            dataset_ref = f"{parts[1]}/{parts[2]}"
        else:
            raise HTTPException(status_code=400, detail="Invalid Kaggle dataset URL format")
            
        try:
            import kaggle
            kaggle.api.authenticate()
            # This downloads to the current working directory, into a folder named after the dataset
            kaggle.api.dataset_download_files(dataset_ref, path=upload_dir, unzip=True)
            
            # Find the downloaded file (assuming it's a CSV or Excel)
            # Kaggle unzips into the upload_dir directly
            # To reliably find it, we check the directory contents sorted by creation time
            # For a production app, we would use the kaggle API to list files first
            downloaded_files = kaggle.api.dataset_list_files(dataset_ref).files
            if not downloaded_files:
                raise HTTPException(status_code=404, detail="No files found in Kaggle dataset")
                
            downloaded_file_name = str(downloaded_files[0].name)
            original_path = os.path.join(upload_dir, downloaded_file_name)
            os.rename(original_path, file_path)
            filename = downloaded_file_name
            dataset_type = "Excel" if filename.lower().endswith('.xlsx') else "CSV"
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Kaggle download failed: {str(e)}")
    else:
        # Standard Public URL download
        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    with open(file_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download from URL: {str(e)}")
            
    # Save to DB
    size_bytes = os.path.getsize(file_path)
    new_dataset = Dataset(
        user_id=current_user.id,
        name=filename,
        dataset_type=dataset_type,
        size_bytes=size_bytes,
        storage_url=f"local://{file_path}"
    )
    
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    
    background_tasks.add_task(compress_dataset_background, new_dataset.storage_url)
    
    return new_dataset
