from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    square_access_token: str = ""
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
