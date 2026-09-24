from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_db, get_current_user
from app.db.models import User, Dataset
from app.schemas.dataset import DatasetResponse, DatasetCreateDb, PresignedUrlRequest, ConfirmUploadRequest
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
import threading
import uuid as _uuid

# In-memory job store for async Kaggle imports.
# Keys are job_id strings; values are dicts with keys:
#   status: 'pending' | 'completed' | 'failed'
#   dataset: DatasetResponse-serialisable dict or None
#   error: str or None
_import_jobs: dict = {}

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
        
    # Check for duplicate dataset
    existing_dataset = db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.name == file.filename
    ).first()
    if existing_dataset:
        raise HTTPException(status_code=400, detail="A dataset with this name already exists.")

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

@router.post("/presigned-url")
def generate_presigned_url(
    payload: PresignedUrlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check for duplicate dataset before allowing upload
    existing_dataset = db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.name == payload.filename
    ).first()
    if existing_dataset:
        raise HTTPException(status_code=400, detail="A dataset with this name already exists.")

    MAX_FILE_SIZE = 2000 * 1024 * 1024 # 2GB
    if payload.file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 2GB.")
        
    allowed_mimes = [
        'text/plain', 'text/csv', 'application/csv', 
        'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if payload.content_type and payload.content_type not in allowed_mimes:
        # Some browsers send empty mime types for csv, so we only block if it's strictly a bad mime
        if not payload.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Invalid file type.")

    if not oss_manager.enabled:
        return {"upload_url": None, "object_key": None, "fallback_local": True}
        
    import os
    import uuid
    extension = os.path.splitext(payload.filename)[1]
    unique_filename = f"{uuid.uuid4()}{extension}"
    
    upload_url = oss_manager.generate_presigned_upload_url(unique_filename, content_type=payload.content_type)
    prefix = "s3://" if oss_manager.backend == "s3" else "oss://"
    return {"upload_url": upload_url, "object_key": f"{prefix}{unique_filename}", "fallback_local": False}

@router.post("/confirm-upload", response_model=DatasetResponse)
def confirm_upload(
    payload: ConfirmUploadRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset_type = "excel" if payload.filename.lower().endswith((".xls", ".xlsx")) else "csv"
    
    dataset = Dataset(
        user_id=current_user.id,
        name=payload.filename,
        dataset_type=dataset_type,
        size_bytes=payload.file_size,
        storage_url=payload.object_key
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    background_tasks.add_task(compress_dataset_background, payload.object_key)
    
    return dataset


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
    if dataset.storage_url:
        oss_manager.delete_file(dataset.storage_url)
        # Also attempt to delete the .gz version if it was compressed
        oss_manager.delete_file(f"{dataset.storage_url}.gz")
    
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

@router.post("/sample", response_model=DatasetResponse)
async def load_sample_dataset(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = ImportUrlRequest(url="https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv")
    return await import_url_dataset(request=req, background_tasks=background_tasks, db=db, current_user=current_user)


def _run_kaggle_import(
    job_id: str,
    url: str,
    encrypted_kaggle_username: str,
    encrypted_kaggle_key: str,
    user_id,
    db_session_factory,
):
    """Blocking Kaggle download executed in a background thread."""
    import uuid
    import shutil
    from urllib.parse import urlparse
    from app.core.encryption import decrypt_data

    _import_jobs[job_id] = {"status": "pending", "dataset": None, "error": None, "user_id": str(user_id)}

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    job_dir = os.path.join(upload_dir, f"kaggle_tmp_{job_id}")

    try:
        parsed = urlparse(url)
        parts = parsed.path.strip('/').split('/')
        if len(parts) < 3 or parts[0] != "datasets":
            raise ValueError("Invalid Kaggle dataset URL format. Expected: https://www.kaggle.com/datasets/owner/name")

        dataset_ref = f"{parts[1]}/{parts[2]}"

        decrypted_username = decrypt_data(encrypted_kaggle_username)
        decrypted_key = decrypt_data(encrypted_kaggle_key)

        os.environ["KAGGLE_USERNAME"] = decrypted_username
        os.environ["KAGGLE_KEY"] = decrypted_key

        os.makedirs(job_dir, exist_ok=True)

        import kaggle
        kaggle.api.authenticate()
        kaggle.api.dataset_download_files(dataset_ref, path=job_dir, unzip=True)

        # Inspect downloaded files and select the primary data file (.csv, .xlsx, .xls)
        downloaded_files = kaggle.api.dataset_list_files(dataset_ref).files
        if not downloaded_files:
            raise ValueError("No files found in the Kaggle dataset.")

        # Find the first valid CSV/Excel file rather than blindly grabbing index 0 (which might be a README)
        target_name = None
        for f in downloaded_files:
            fname = str(getattr(f, "name", f))
            if fname.lower().endswith(('.csv', '.xlsx', '.xls')):
                target_name = fname
                break

        if target_name:
            original_path = os.path.join(job_dir, target_name)
            downloaded_file_name = target_name
        else:
            downloaded_file_name = str(downloaded_files[0].name)
            original_path = os.path.join(job_dir, downloaded_file_name)

        # If not found directly at root of job_dir, scan recursively
        if not os.path.exists(original_path) or not downloaded_file_name.lower().endswith(('.csv', '.xlsx', '.xls')):
            found = False
            for root, dirs, files in os.walk(job_dir):
                for file in files:
                    if file.lower().endswith(('.csv', '.xlsx', '.xls')):
                        original_path = os.path.join(root, file)
                        downloaded_file_name = file
                        found = True
                        break
                if found:
                    break
            if not found:
                raise ValueError("No CSV or Excel files found in this Kaggle dataset. It appears to contain images or non-tabular data. Darelm currently supports tabular datasets (.csv, .xlsx, .xls).")

        clean_filename = os.path.basename(downloaded_file_name)
        unique_filename = f"{uuid.uuid4()}-{clean_filename}"
        file_path = os.path.join(upload_dir, unique_filename)

        # Move the data file into the permanent uploads folder
        shutil.copy2(original_path, file_path)
        shutil.rmtree(job_dir, ignore_errors=True)

        dataset_type = "Excel" if clean_filename.lower().endswith(('.xlsx', '.xls')) else "CSV"
        size_bytes = os.path.getsize(file_path)

        if oss_manager.enabled:
            storage_url = oss_manager.upload_local_file(file_path, original_filename=clean_filename)
            if (storage_url.startswith("oss://") or storage_url.startswith("s3://")) and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
        else:
            storage_url = f"local://{file_path}"

        db = db_session_factory()
        try:
            new_dataset = Dataset(
                user_id=user_id,
                name=clean_filename,
                dataset_type=dataset_type,
                size_bytes=size_bytes,
                storage_url=storage_url,
            )
            db.add(new_dataset)
            db.commit()
            db.refresh(new_dataset)
            _import_jobs[job_id] = {
                "status": "completed",
                "dataset": {
                    "id": str(new_dataset.id),
                    "name": new_dataset.name,
                    "dataset_type": new_dataset.dataset_type,
                    "size_bytes": new_dataset.size_bytes,
                    "storage_url": new_dataset.storage_url,
                    "created_at": new_dataset.created_at.isoformat() if new_dataset.created_at else None,
                },
                "error": None,
                "user_id": str(user_id),
            }
        finally:
            db.close()

    except Exception as e:
        shutil.rmtree(job_dir, ignore_errors=True)
        _import_jobs[job_id] = {"status": "failed", "dataset": None, "error": str(e), "user_id": str(user_id)}


@router.post("/import-url")
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

    url = request.url.strip()

    # Automatically transform GitHub blob links into raw content links
    if "github.com" in url and "/blob/" in url:
        url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")

    parsed = urlparse(url)

    # --- Kaggle: offload to a background thread and return a job_id immediately ---
    if "kaggle.com" in url:
        from app.core.encryption import decrypt_data

        if not current_user.encrypted_kaggle_username or not current_user.encrypted_kaggle_key:
            raise HTTPException(status_code=400, detail="Kaggle credentials not configured in settings. Please add your Kaggle username and API key under Settings.")

        # Validate URL shape before kicking off the thread
        parts = parsed.path.strip('/').split('/')
        if len(parts) < 3 or parts[0] != "datasets":
            raise HTTPException(status_code=400, detail="Invalid Kaggle dataset URL format. Expected: https://www.kaggle.com/datasets/owner/name")

        job_id = str(_uuid.uuid4())

        from app.db.session import SessionLocal
        t = threading.Thread(
            target=_run_kaggle_import,
            args=(
                job_id,
                url,
                current_user.encrypted_kaggle_username,
                current_user.encrypted_kaggle_key,
                current_user.id,
                SessionLocal,
            ),
            daemon=True,
        )
        t.start()

        return {"job_id": job_id, "status": "pending"}

    # --- Standard public URL download (synchronous, fast) ---
    filename = os.path.basename(parsed.path)
    if filename and filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.tar', '.gz', '.mp4', '.pdf', '.svg')):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format ({filename}). Darelm currently supports tabular datasets (CSV and Excel)."
        )
    if not filename or not filename.lower().endswith(('.csv', '.xlsx', '.xls')):
        filename = "imported_dataset.csv"

    dataset_type = "Excel" if filename.lower().endswith(('.xlsx', '.xls')) else "CSV"
    unique_filename = f"{uuid.uuid4()}-{filename}"
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                with open(file_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to download from URL: {str(e)}")

    # Verify the downloaded file is not an HTML webpage (e.g. preview page or error page)
    try:
        with open(file_path, "rb") as f:
            head = f.read(512).strip().lower()
            if head.startswith(b"<!doctype html") or head.startswith(b"<html") or b"<head" in head:
                os.remove(file_path)
                raise HTTPException(
                    status_code=400, 
                    detail="The provided URL returned a webpage (HTML) instead of raw CSV or Excel data. Please ensure you are using the direct raw download URL."
                )
    except HTTPException:
        raise
    except Exception:
        pass

    size_bytes = os.path.getsize(file_path)

    if oss_manager.enabled:
        storage_url = oss_manager.upload_local_file(file_path, original_filename=filename)
        if (storage_url.startswith("oss://") or storage_url.startswith("s3://")) and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
    else:
        storage_url = f"local://{file_path}"
        background_tasks.add_task(compress_dataset_background, storage_url)

    new_dataset = Dataset(
        user_id=current_user.id,
        name=filename,
        dataset_type=dataset_type,
        size_bytes=size_bytes,
        storage_url=storage_url,
    )
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    return DatasetResponse.model_validate(new_dataset)


@router.get("/import-status/{job_id}")
def get_import_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll the status of an async Kaggle import job."""
    job = _import_jobs.get(job_id)
    if job is None or (job.get("user_id") and job.get("user_id") != str(current_user.id)):
        raise HTTPException(status_code=404, detail="Import job not found")
    return job
