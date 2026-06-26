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
            
            # Construct the URL (assuming standard bucket domain format)
            # e.g., https://bucket-name.oss-cn-hangzhou.aliyuncs.com/filename
            endpoint_domain = settings.ALIYUN_OSS_ENDPOINT.replace("http://", "").replace("https://", "")
            url = f"https://{settings.ALIYUN_OSS_BUCKET_NAME}.{endpoint_domain}/{unique_filename}"
            return url
        else:
            # Fallback local upload
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            local_path = os.path.join(upload_dir, unique_filename)
            with open(local_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            return f"local://{local_path}"

oss_manager = OSSManager()
