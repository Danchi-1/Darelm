import os
import uuid
import oss2
from fastapi import UploadFile
from app.core.config import settings

class OSSManager:
    def __init__(self):
        self.enabled = False
        if all([
            settings.ALIYUN_ACCESS_KEY_ID, 
            settings.ALIYUN_ACCESS_KEY_SECRET, 
            settings.ALIYUN_OSS_ENDPOINT, 
            settings.ALIYUN_OSS_BUCKET_NAME
        ]):
            # Use V4 Signature (required by newer regions)
            self.auth = oss2.AuthV4(settings.ALIYUN_ACCESS_KEY_ID, settings.ALIYUN_ACCESS_KEY_SECRET)
            
            # Extract region and ensure https
            endpoint = settings.ALIYUN_OSS_ENDPOINT
            region = endpoint.replace("oss-", "").replace(".aliyuncs.com", "").replace("-internal", "")
            if not endpoint.startswith("http"):
                endpoint = f"https://{endpoint}"
                
            self.bucket = oss2.Bucket(self.auth, endpoint, settings.ALIYUN_OSS_BUCKET_NAME, region=region)
            self.enabled = True

    async def upload_file(self, file: UploadFile) -> str:
        """
        Uploads a file to Alibaba Cloud OSS and returns the public URL.
        If OSS is not configured, saves locally (fallback for development).
        """
        extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{extension}"
        
        if self.enabled:
            # Upload to OSS
            file_content = await file.read()
            self.bucket.put_object(unique_filename, file_content)
            
            # Return the secure OSS object key (e.g. oss://filename)
            return f"oss://{unique_filename}"
        else:
            # Fallback local upload
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            local_path = os.path.join(upload_dir, unique_filename)
            with open(local_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            return f"local://{local_path}"

    async def upload_bytes(self, data: bytes, extension: str = ".pkl") -> str:
        """
        Uploads raw binary data to OSS and returns the public URL.
        Useful for uploading extracted models from the sandbox.
        """
        unique_filename = f"{uuid.uuid4()}{extension}"
        
        if self.enabled:
            # Upload to OSS
            self.bucket.put_object(unique_filename, data)
            return f"oss://{unique_filename}"
        else:
            # Fallback local upload
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            local_path = os.path.join(upload_dir, unique_filename)
            with open(local_path, "wb") as buffer:
                buffer.write(data)
            return f"local://{local_path}"

    def generate_presigned_url(self, storage_url: str, expires_in_seconds: int = 900) -> str:
        """Generates a short-lived presigned URL for secure frontend download."""
        if storage_url.startswith("oss://") and self.enabled:
            object_key = storage_url.replace("oss://", "")
            return self.bucket.sign_url('GET', object_key, expires_in_seconds).replace('http://', 'https://')
        return storage_url

    def generate_presigned_upload_url(self, object_key: str, content_type: str = None, expires_in_seconds: int = 3600) -> str:
        """Generates a short-lived presigned URL for secure frontend upload."""
        if self.enabled:
            headers = {}
            if content_type:
                headers['Content-Type'] = content_type
            return self.bucket.sign_url('PUT', object_key, expires_in_seconds, headers=headers).replace('http://', 'https://')
        return ""

    def delete_file(self, storage_url: str):
        """Deletes a file from OSS or local storage."""
        if not storage_url:
            return
            
        if storage_url.startswith("oss://") and self.enabled:
            object_key = storage_url.replace("oss://", "")
            try:
                self.bucket.delete_object(object_key)
            except Exception as e:
                print(f"Failed to delete {object_key} from OSS: {e}")
                
        elif storage_url.startswith("local://"):
            local_path = storage_url.replace("local://", "")
            try:
                if os.path.exists(local_path):
                    os.remove(local_path)
            except Exception as e:
                print(f"Failed to delete {local_path} from local storage: {e}")

oss_manager = OSSManager()
