from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_serializer
from app.core.time_utils import serialize_thailand_datetime


class DetectionItem(BaseModel):
    person_name: str = "คนแปลกหน้า (Stranger)"
    category: str = Field("stranger", description="'household' (คนในบ้าน), 'neighbor' (เพื่อนบ้าน), 'friend' (เพื่อน), 'delivery' (คนส่งของ), 'other' (อื่นๆ), 'stranger' (คนแปลกหน้า)")
    confidence: float = 0.0
    bounding_box: List[int] = Field(default_factory=list, description="[x1, y1, x2, y2]")
    alert_created: bool = False
    alert_message: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None


class DetectResultResponse(BaseModel):
    success: bool = True
    camera_id: str = "cam-1"
    timestamp: datetime
    detections_count: int = 0
    detections: List[DetectionItem] = Field(default_factory=list)
    snapshot_url: Optional[str] = None

    @field_serializer("timestamp")
    def serialize_timestamp(self, dt: datetime, _info):
        return serialize_thailand_datetime(dt)


class DetectESP32Request(BaseModel):
    camera_ip: str = "192.168.137.65"
    camera_port: Optional[str] = ""
    camera_path: Optional[str] = "/capture"
    location: Optional[str] = "หน้าบ้าน (Main Entrance)"


class DetectionHistoryResponse(BaseModel):
    id: int
    person_id: Optional[int] = None
    user_id: Optional[int] = None
    person_name: str
    category: str
    confidence: float
    bounding_box: str
    snapshot_path: str
    camera_id: str
    location: str
    alert_triggered: bool
    timestamp: datetime

    @field_serializer("timestamp")
    def serialize_timestamp(self, dt: datetime, _info):
        return serialize_thailand_datetime(dt)

    class Config:
        from_attributes = True


class DetectionSummaryStats(BaseModel):
    total_today: int = 0
    household_count: int = 0
    delivery_count: int = 0
    stranger_count: int = 0
    neighbor_count: int = 0
    friend_count: int = 0
    other_count: int = 0
    alerts_count: int = 0


class IdentifyPersonRequest(BaseModel):
    mode: str = Field("existing", description="'existing' เพื่อเชื่อมกับบุคคลที่มีอยู่, 'new' เพื่อลงทะเบียนใหม่")
    person_id: Optional[int] = Field(None, description="ID บุคคลที่มีอยู่ในฐานข้อมูล (กรณี mode=existing)")
    # ข้อมูลสำหรับสร้างบุคคลใหม่ (กรณี mode=new)
    name: Optional[str] = Field(None, description="ชื่อ-นามสกุล")
    category: Optional[str] = Field("household", description="'household', 'neighbor', 'friend', 'delivery', 'other', หรือ 'stranger'")
    role: Optional[str] = Field("Family", description="บทบาทหรือความสัมพันธ์ เช่น Family, VIP, Grab")
    department: Optional[str] = Field("", description="สังกัด/แผนก")
    notes: Optional[str] = Field("", description="หมายเหตุเพิ่มเติม")


class IdentifyPersonResponse(BaseModel):
    success: bool = True
    message: str
    detection_id: int
    person_id: int
    person_name: str
    category: str
    photo_url: str
    images_count: int

