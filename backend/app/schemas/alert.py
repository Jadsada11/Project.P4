from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field("", max_length=1000)
    category: str = Field("stranger", description="'household' (คนในบ้าน), 'neighbor' (เพื่อนบ้าน), 'friend' (เพื่อน), 'delivery' (คนส่งของ), 'other' (อื่นๆ), 'stranger' (คนแปลกหน้า)")
    severity: str = Field("warning", description="'info', 'warning', 'critical'")
    location: str = Field("หน้าประตูบ้าน (Main Entrance)", max_length=100)
    detection_id: Optional[int] = None
    person_id: Optional[int] = None
    user_id: Optional[int] = None
    thumbnail: str = ""
    is_read: bool = False



class AlertCreate(AlertBase):
    pass


class AlertUpdateRead(BaseModel):
    is_read: bool = True


class AlertResponse(AlertBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
