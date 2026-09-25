import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Vigil AI Security Backend"
    API_V1_STR: str = "/api/v1"

    # JWT Authentication
    SECRET_KEY: str = "vigil_security_super_secret_jwt_key_at_least_32_bytes_long_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./data/vigil.db"

    # Fixed ESP32-S3 Camera IP Configuration (Locked)
    DEFAULT_ESP32_IP: str = "192.168.137.65"
    DEFAULT_ESP32_STREAM_URL: str = "http://192.168.137.65/stream"
    DEFAULT_ESP32_CAPTURE_URL: str = "http://192.168.137.65/capture"

    # CORS Configuration
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
    ]

    # SMTP & Email Alerts Configuration (Gmail SMTP)
    SMTP_ENABLED: bool = True
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = "thanakornnillamai@gmail.com"
    SMTP_PASSWORD: str = "khlcoalqwizlhrlg"
    NOTIFICATION_RECIPIENT_EMAIL: str = "thanakornnillamai@gmail.com"
    EMAIL_ALERT_COOLDOWN_SECONDS: int = 60
    EMAIL_ALERT_CATEGORIES: Union[List[str], str] = ["delivery", "stranger"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    @field_validator("EMAIL_ALERT_CATEGORIES", mode="before")
    @classmethod
    def assemble_email_categories(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip().lower() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i).strip().lower() for i in v]
        return ["delivery", "stranger"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
