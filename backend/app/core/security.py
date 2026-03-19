from cryptography.fernet import Fernet
from app.config import settings


def _fernet() -> Fernet:
    return Fernet(settings.encryption_key.encode())


def encrypt_token(token: str) -> str:
    """Encrypt a Square access token before storing in the database."""
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a Square access token at sync time. Never store the result."""
    return _fernet().decrypt(ciphertext.encode()).decode()
