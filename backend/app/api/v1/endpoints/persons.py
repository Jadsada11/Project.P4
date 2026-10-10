import base64
import os
import time
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.person import Person
from app.models.detection import DetectionHistory
from app.models.alert import Alert
from app.schemas.person import PersonCreate, PersonResponse, PersonUpdate
from app.services.face_embedding_service import (
    save_person_embeddings,
    delete_person_embedding,
    get_all_embeddings_summary,
    get_training_status,
    retrain_all_registered_persons,
)

router = APIRouter()

DATA_BASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))),
    "data",
)
SNAPSHOTS_DIR = os.path.join(DATA_BASE_DIR, "snapshots")
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)


def process_photo_url(url: Optional[str]) -> str:
    """
    แปลง Base64 Data URL ให้เป็นไฟล์ภาพบนดิสก์และส่งคืน Static URL Path
    หรือส่งคืน URL เดิมหากเป็น HTTP/HTTPS หรือ URL ปกติ
    """
    if not url or not url.strip():
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"

    if url.startswith("data:image"):
        try:
            header, encoded = url.split(",", 1)
            ext = "jpg"
            if "png" in header:
                ext = "png"
            elif "webp" in header:
                ext = "webp"

            img_bytes = base64.b64decode(encoded)
            filename = f"person_{int(time.time())}_{uuid.uuid4().hex[:6]}.{ext}"
            file_path = os.path.join(SNAPSHOTS_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(img_bytes)
            return f"/data/snapshots/{filename}"
        except Exception as e:
            print(f"[Save Photo Error] Failed to decode base64 photo: {e}")
            return url

    return url



@router.get("", response_model=List[PersonResponse], summary="ดึงรายชื่อบุคคลที่ลงทะเบียนไว้ทั้งหมด")
def get_persons(
    category: Optional[str] = Query(None, description="กรองตามประเภท: 'household', 'neighbor', 'friend', 'delivery', 'other', 'stranger'"),
    search: Optional[str] = Query(None, description="ค้นหาตามชื่อหรือสังกัด"),
    db: Session = Depends(get_db),
):
    """
    เรียกดูรายชื่อบุคคลในฐานข้อมูล (คนในบ้าน, คนส่งของ, คนแปลกหน้า)
    """
    query = db.query(Person).filter(Person.is_active == True)

    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(Person.category == category.lower())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Person.name.ilike(term)) | (Person.department.ilike(term))
        )

    return query.order_by(Person.id.asc()).all()


@router.get("/embeddings/summary", summary="ดูภาพรวมชุดข้อมูล Face Embeddings ที่เทรนไว้")
def get_embeddings_summary_endpoint():
    """ดึงรายชื่อและจำนวนรูปภาพของบุคคลที่ถูกเทรน Face Embedding ในระบบ AI"""
    return get_all_embeddings_summary()


@router.get("/model-status", summary="ดึงสถานะโมเดลและ Log การเทรน AI")
def get_model_status_endpoint(db: Session = Depends(get_db)):
    """ดึงสถานะการทำงานของโมเดล AI Face Recognition, สถิติ Accuracy และ Log ล่าสุด"""
    return get_training_status(db=db)


@router.post("/train", summary="สั่งเทรนโมเดล AI และ Re-index Face Embeddings ใหม่ทั้งหมด")
@router.post("/retrain", summary="สั่งเทรนโมเดล AI และ Re-index Face Embeddings ใหม่ทั้งหมด (Alias)")
def retrain_model_endpoint(db: Session = Depends(get_db)):
    """
    ทำการ Re-train ข้อมูลใบหน้าบุคคลทั้งหมดในระบบแบบ Real-time:
    - ดึงภาพจาก data/datasets/person_<id>/
    - ทำการ Augmentation & Centroid Normalization
    - คำนวณ Accuracy Score และบันทึกผลลง Vector Database
    """
    try:
        result = retrain_all_registered_persons(db=db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Training failed: {str(e)}")


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED, summary="ลงทะเบียนบุคคลใหม่")
def create_person(
    person_in: PersonCreate,
    db: Session = Depends(get_db),
):
    """
    ลงทะเบียนบุคคลใหม่เข้าสู่ฐานข้อมูลโมเดล
    สามารถกำหนดกลุ่มเป็น 'household' (คนในบ้าน), 'delivery' (คนส่งของ), หรือ 'stranger' (คนแปลกหน้า)
    พร้อมทั้งสกัดและเทรน Face Embeddings บันทึกลงใน AI Model อัตโนมัติ
    """
    processed_photo = process_photo_url(person_in.photo_url)
    person = Person(
        name=person_in.name,
        category=person_in.category,
        role=person_in.role,
        department=person_in.department,
        notes=person_in.notes,
        photo_url=processed_photo,
        accuracy=person_in.accuracy,
        images_count=person_in.images_count,
        is_active=person_in.is_active,
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    # รวบรวมภาพทั้งหมดสำหรับสกัด Deep Learning Face Embedding (AI Training)
    images_to_train = []
    if person_in.dataset_images and len(person_in.dataset_images) > 0:
        images_to_train.extend(person_in.dataset_images)
    if processed_photo and processed_photo not in images_to_train:
        images_to_train.append(processed_photo)

    if images_to_train:
        try:
            save_person_embeddings(
                person_id=person.id,
                name=person.name,
                category=person.category,
                role=person.role,
                image_sources=images_to_train,
            )
        except Exception as e:
            print(f"[Face Training Error] Failed to train embeddings for person {person.id}: {e}")

    return person


@router.get("/{person_id}", response_model=PersonResponse, summary="ดึงข้อมูลบุคคลตาม ID")
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.put("/{person_id}", response_model=PersonResponse, summary="แก้ไขข้อมูลบุคคล")
def update_person(
    person_id: int,
    person_in: PersonUpdate,
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    update_data = person_in.model_dump(exclude_unset=True)
    if "photo_url" in update_data and update_data["photo_url"]:
        update_data["photo_url"] = process_photo_url(update_data["photo_url"])

    for field, val in update_data.items():
        setattr(person, field, val)

    db.commit()
    db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT, summary="ลบบุคคลออกจากฐานข้อมูล")
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # ปลด Foreign Key ในตาราง detection_history และ alerts อย่างปลอดภัยเพื่อป้องกัน FK constraint error และคงประวัติการตรวจจับไว้
    db.query(DetectionHistory).filter(DetectionHistory.person_id == person_id).update(
        {"person_id": None}, synchronize_session=False
    )
    db.query(Alert).filter(Alert.person_id == person_id).update(
        {"person_id": None}, synchronize_session=False
    )

    db.delete(person)
    db.commit()
    # Remove from face embeddings model as well
    delete_person_embedding(person_id)
    return None

