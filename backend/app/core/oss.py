import os
import uuid
import logging
from fastapi import UploadFile
from app.core.config import settings

logger = logging.getLogger("darelm.storage")

try:
    import boto3
    from botocore.config import Config as BotoConfig
except ImportError:
    boto3 = None

try:
    import oss2
except ImportError:
    oss2 = None


class OSSManager:
    """
    Unified Storage Manager supporting:
    1. S3 / Neon Object Storage (Recommended, native S3 compatible)
    2. Alibaba Cloud OSS (Legacy support)
    3. Local filesystem fallback (uploads/)
    """
    def __init__(self):
        self.enabled = False
        self.backend = "local"
        self.bucket_name = None
        
        # 1. Check for S3 / Neon Object Storage
        s3_endpoint = settings.S3_ENDPOINT_URL or settings.AWS_ENDPOINT_URL_S3
        s3_access_key = settings.S3_ACCESS_KEY_ID or settings.AWS_ACCESS_KEY_ID
        s3_secret_key = settings.S3_SECRET_ACCESS_KEY or settings.AWS_SECRET_ACCESS_KEY
        s3_bucket = settings.S3_BUCKET_NAME or "darelm-s3bucket"
        s3_region = settings.S3_REGION or settings.AWS_REGION or "us-east-1"
        
        if s3_endpoint and s3_access_key and s3_secret_key and boto3:
            try:
                self.bucket_name = s3_bucket
                self.s3_client = boto3.client(
                    's3',
                    endpoint_url=s3_endpoint,
                    aws_access_key_id=s3_access_key,
                    aws_secret_access_key=s3_secret_key,
                    region_name=s3_region,
                    config=BotoConfig(s3={'addressing_style': 'path'}, signature_version='s3v4')
                )
                self.backend = "s3"
                self.enabled = True
                logger.info(f"[Storage] Initialized S3/Neon Object Storage for bucket: {self.bucket_name}")
                return
            except Exception as e:
                logger.error(f"[Storage] Failed to initialize S3 client: {e}")

        # 2. Check for Alibaba Cloud OSS (Legacy fallback)
        if oss2 and all([
            settings.ALIYUN_ACCESS_KEY_ID, 
            settings.ALIYUN_ACCESS_KEY_SECRET, 
            settings.ALIYUN_OSS_ENDPOINT, 
            settings.ALIYUN_OSS_BUCKET_NAME
        ]):
            try:
                self.auth = oss2.AuthV4(settings.ALIYUN_ACCESS_KEY_ID, settings.ALIYUN_ACCESS_KEY_SECRET)
                endpoint = settings.ALIYUN_OSS_ENDPOINT
                region = endpoint.replace("oss-", "").replace(".aliyuncs.com", "").replace("-internal", "")
                if not endpoint.startswith("http"):
                    endpoint = f"https://{endpoint}"
                self.bucket = oss2.Bucket(self.auth, endpoint, settings.ALIYUN_OSS_BUCKET_NAME, region=region)
                self.bucket_name = settings.ALIYUN_OSS_BUCKET_NAME
                self.backend = "oss"
                self.enabled = True
                logger.info(f"[Storage] Initialized Alibaba OSS for bucket: {self.bucket_name}")
                return
            except Exception as e:
                logger.error(f"[Storage] Failed to initialize Alibaba OSS: {e}")

        # 3. Fallback to Local Storage
        logger.info("[Storage] Cloud storage not configured. Using local uploads/ fallback.")

    async def upload_file(self, file: UploadFile) -> str:
        """Uploads a file to cloud storage (S3/OSS) or saves locally."""
        extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{extension}"
        
        if self.enabled and self.backend == "s3":
            file_content = await file.read()
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=unique_filename,
                Body=file_content
            )
            return f"s3://{unique_filename}"
        elif self.enabled and self.backend == "oss":
            file_content = await file.read()
            self.bucket.put_object(unique_filename, file_content)
            return f"oss://{unique_filename}"
        else:
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            local_path = os.path.join(upload_dir, unique_filename)
            with open(local_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            return f"local://{local_path}"

    async def upload_bytes(self, data: bytes, extension: str = ".pkl") -> str:
        """Uploads raw binary data to cloud storage or saves locally."""
        unique_filename = f"{uuid.uuid4()}{extension}"
        
        if self.enabled and self.backend == "s3":
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=unique_filename,
                Body=data
            )
            return f"s3://{unique_filename}"
        elif self.enabled and self.backend == "oss":
            self.bucket.put_object(unique_filename, data)
            return f"oss://{unique_filename}"
        else:
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)
            local_path = os.path.join(upload_dir, unique_filename)
            with open(local_path, "wb") as buffer:
                buffer.write(data)
            return f"local://{local_path}"

    def upload_local_file(self, file_path: str, original_filename: str = None) -> str:
        """Uploads a local file to cloud storage and returns URI. Falls back to local://."""
        if self.enabled and os.path.exists(file_path):
            ext = os.path.splitext(original_filename or file_path)[1]
            unique_filename = f"{uuid.uuid4()}{ext}"
            with open(file_path, "rb") as f:
                data = f.read()
            if self.backend == "s3":
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=unique_filename,
                    Body=data
                )
                return f"s3://{unique_filename}"
            elif self.backend == "oss":
                self.bucket.put_object(unique_filename, data)
                return f"oss://{unique_filename}"
        return f"local://{file_path}"

    def generate_presigned_url(self, storage_url: str, expires_in_seconds: int = 900) -> str:
        """Generates a short-lived presigned URL for secure download."""
        if not storage_url:
            return ""
        if storage_url.startswith("s3://") and self.enabled and self.backend == "s3":
            key = storage_url.replace("s3://", "")
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expires_in_seconds
            )
        elif storage_url.startswith("oss://") and self.enabled and self.backend == "oss":
            object_key = storage_url.replace("oss://", "")
            return self.bucket.sign_url('GET', object_key, expires_in_seconds).replace('http://', 'https://')
        return storage_url

    def generate_presigned_upload_url(self, object_key: str, content_type: str = None, expires_in_seconds: int = 3600) -> str:
        """Generates a short-lived presigned URL for direct upload."""
        clean_key = object_key.replace("s3://", "").replace("oss://", "")
        if self.enabled and self.backend == "s3":
            params = {'Bucket': self.bucket_name, 'Key': clean_key}
            if content_type:
                params['ContentType'] = content_type
            return self.s3_client.generate_presigned_url(
                'put_object',
                Params=params,
                ExpiresIn=expires_in_seconds
            )
        elif self.enabled and self.backend == "oss":
            headers = {}
            if content_type:
                headers['Content-Type'] = content_type
            return self.bucket.sign_url('PUT', clean_key, expires_in_seconds, headers=headers).replace('http://', 'https://')
        return ""

    def delete_file(self, storage_url: str):
        """Deletes a file from S3, OSS, or local storage."""
        if not storage_url:
            return
            
        if storage_url.startswith("s3://") and self.enabled and self.backend == "s3":
            key = storage_url.replace("s3://", "")
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            except Exception as e:
                logger.error(f"Failed to delete {key} from S3: {e}")

        elif storage_url.startswith("oss://") and self.enabled and self.backend == "oss":
            object_key = storage_url.replace("oss://", "")
            try:
                self.bucket.delete_object(object_key)
            except Exception as e:
                logger.error(f"Failed to delete {object_key} from OSS: {e}")
                
        elif storage_url.startswith("local://"):
            local_path = storage_url.replace("local://", "")
            try:
                if os.path.exists(local_path):
                    os.remove(local_path)
            except Exception as e:
                logger.error(f"Failed to delete {local_path} from local storage: {e}")

oss_manager = OSSManager()

