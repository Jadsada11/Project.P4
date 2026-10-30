from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.time_utils import get_thailand_naive_now


class DetectionHistory(Base):
    __tablename__ = "detection_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    person_id = Column(
        Integer,
        ForeignKey("persons.id", name="fk_detection_person", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", name="fk_detection_user", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    person_name = Column(String, nullable=False, default="Unknown Person")
    # category: 'household', 'neighbor', 'friend', 'delivery', 'other', 'stranger'
    category = Column(String, index=True, nullable=False, default="stranger")
    confidence = Column(Float, nullable=False, default=0.0)
    bounding_box = Column(Text, default="[]", nullable=False)  # JSON [x1, y1, x2, y2]
    snapshot_path = Column(String, default="", nullable=False)
    camera_id = Column(String, default="cam-1", nullable=False)
    location = Column(String, default="หน้าบ้าน (Main Entrance)", nullable=False)
    alert_triggered = Column(Boolean, default=False, nullable=False)
    timestamp = Column(
        DateTime, default=get_thailand_naive_now, index=True, nullable=False
    )

    # Relationships
    person = relationship("Person", back_populates="detections")
    user = relationship("User", back_populates="detections")
    alerts = relationship("Alert", back_populates="detection", passive_deletes=True)

    def __repr__(self) -> str:
        return f"<DetectionHistory(id={self.id}, name='{self.person_name}', category='{self.category}', user_id={self.user_id})>"

