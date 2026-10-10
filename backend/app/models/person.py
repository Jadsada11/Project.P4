from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", name="fk_person_user", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = Column(String, index=True, nullable=False)
    # category: 'household', 'neighbor', 'friend', 'delivery', 'other', 'stranger'
    category = Column(String, index=True, nullable=False, default="household")
    role = Column(String, default="Family", nullable=False)
    department = Column(String, default="", nullable=False)
    notes = Column(Text, default="", nullable=False)
    photo_url = Column(String, default="", nullable=False)
    face_embedding = Column(Text, default="", nullable=False)  # JSON-encoded vector or reference
    accuracy = Column(Float, default=98.5, nullable=False)
    images_count = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="persons")
    detections = relationship(
        "DetectionHistory",
        back_populates="person",
        passive_deletes=True,
    )
    alerts = relationship(
        "Alert",
        back_populates="person",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Person(id={self.id}, name='{self.name}', category='{self.category}', user_id={self.user_id})>"


