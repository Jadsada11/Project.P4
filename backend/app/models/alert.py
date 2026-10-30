from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.time_utils import get_thailand_naive_now


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="", nullable=False)
    # category: 'household', 'neighbor', 'friend', 'delivery', 'other', 'stranger'
    category = Column(String, index=True, nullable=False, default="stranger")
    # severity: 'info', 'warning', 'critical'
    severity = Column(String, nullable=False, default="warning")
    location = Column(String, default="หน้าประตูบ้าน (Main Entrance)", nullable=False)
    detection_id = Column(
        Integer,
        ForeignKey("detection_history.id", name="fk_alert_detection", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    person_id = Column(
        Integer,
        ForeignKey("persons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", name="fk_alert_user", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    thumbnail = Column(String, default="", nullable=False)
    is_read = Column(Boolean, default=False, index=True, nullable=False)
    created_at = Column(
        DateTime, default=get_thailand_naive_now, index=True, nullable=False
    )

    # Relationships
    detection = relationship("DetectionHistory", back_populates="alerts")
    person = relationship("Person", back_populates="alerts")
    user = relationship("User", back_populates="alerts")

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, title='{self.title}', category='{self.category}', user_id={self.user_id}, is_read={self.is_read})>"


