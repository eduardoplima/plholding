from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = 'sqlite:///./plholding.db'
    S3_ENDPOINT: str = 'http://localhost:9000'
    S3_BUCKET: str = 'plholding-dev'
    S3_ACCESS_KEY: str = 'minioadmin'
    S3_SECRET_KEY: str = 'minioadmin'
    S3_REGION: str = 'us-east-1'
    JWT_SECRET: str = 'dev-secret-change-me'
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ENV: str = 'dev'

settings = Settings()
