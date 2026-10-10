from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PersonBase(BaseModel):
    user_id: Optional[int] = Field(None, description="ID เจ้าหน้าที่/ผู้ใช้งานที่สร้างข้อมูล (FK users.id)")
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field("household", description="'household' (คนในบ้าน), 'neighbor' (เพื่อนบ้าน), 'friend' (เพื่อน), 'delivery' (คนส่งของ), 'other' (อื่นๆ), 'stranger' (คนแปลกหน้า)")
    role: str = Field("Family", max_length=50)
    department: str = Field("", max_length=100)
    notes: str = Field("", max_length=500)
    photo_url: str = Field("")
    accuracy: float = Field(98.5, ge=0.0, le=100.0)
    images_count: int = Field(1, ge=0)
    is_active: bool = True



class PersonCreate(PersonBase):
    dataset_images: Optional[List[str]] = Field(
        default=[],
        description="ชุดภาพถ่าย Base64 data URL หรือ image path สำหรับสกัด Face Embedding เทรน AI",
    )


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    accuracy: Optional[float] = None
    images_count: Optional[int] = None
    is_active: Optional[bool] = None


class PersonResponse(PersonBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
