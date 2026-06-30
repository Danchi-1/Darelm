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
            self.auth = oss2.Auth(settings.ALIYUN_ACCESS_KEY_ID, settings.ALIYUN_ACCESS_KEY_SECRET)
            self.bucket = oss2.Bucket(self.auth, settings.ALIYUN_OSS_ENDPOINT, settings.ALIYUN_OSS_BUCKET_NAME)
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

    def generate_presigned_url(self, storage_url: str, expires_in_seconds: int = 900) -> str:
        """Generates a short-lived presigned URL for secure frontend download."""
        if storage_url.startswith("oss://") and self.enabled:
            object_key = storage_url.replace("oss://", "")
            return self.bucket.sign_url('GET', object_key, expires_in_seconds)
        return storage_url

oss_manager = OSSManager()
