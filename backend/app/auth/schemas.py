from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    business_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters and contain at least one number")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must be at least 8 characters and contain at least one number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal['owner', 'worker'] = 'owner'


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str = "owner"
    business_name: Optional[str] = None
    name: Optional[str] = None
    role_name: Optional[str] = None
