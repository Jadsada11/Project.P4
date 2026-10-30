from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.time_utils import get_thailand_naive_now


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Operator", nullable=False)  # Operator, Engineer, Admin
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime, default=get_thailand_naive_now, nullable=False
    )
    updated_at = Column(
        DateTime,
        default=get_thailand_naive_now,
        onupdate=get_thailand_naive_now,
        nullable=False,
    )

    # Relationships
    persons = relationship("Person", back_populates="user", passive_deletes=True)
    detections = relationship("DetectionHistory", back_populates="user", passive_deletes=True)
    alerts = relationship("Alert", back_populates="user", passive_deletes=True)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"

