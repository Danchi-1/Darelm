import os
from cryptography.fernet import Fernet
from app.core.config import settings

def get_fernet():
    # settings.FERNET_KEY should be a valid Fernet key (base64 32-byte string)
    if not settings.FERNET_KEY:
        raise ValueError("FERNET_KEY is not configured in the environment.")
    return Fernet(settings.FERNET_KEY.encode('utf-8'))

def encrypt_data(data: str) -> str:
    """Encrypts string data symmetrically using Fernet."""
    if not data:
        return None
    fernet = get_fernet()
    encrypted_bytes = fernet.encrypt(data.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    """Decrypts string data symmetrically using Fernet."""
    if not encrypted_data:
        return None
    fernet = get_fernet()
    decrypted_bytes = fernet.decrypt(encrypted_data.encode('utf-8'))
    return decrypted_bytes.decode('utf-8')
