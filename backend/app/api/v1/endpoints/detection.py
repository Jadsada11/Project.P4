import os
import io
import time
from datetime import datetime, timezone, date
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from PIL import Image
import numpy as np

from app.api.deps import get_db
from app.models.detection import DetectionHistory
from app.models.alert import Alert
from app.models.person import Person
from app.schemas.detection import (
    DetectESP32Request,
    DetectionHistoryResponse,
    DetectionSummaryStats,
    DetectResultResponse,
    DetectionItem,
    IdentifyPersonRequest,
    IdentifyPersonResponse,
)
from app.services.yolo_service import bytes_to_image, run_yolo_detection
from app.services.person_classifier import classify_and_record
from app.services.face_embedding_service import add_person_image_embedding

router = APIRouter()


@router.get("/stats", response_model=DetectionSummaryStats, summary="สรุปสถิติประจำวันแยกตามกลุ่มบุคคล")
def get_detection_stats(db: Session = Depends(get_db)):
    """
    คืนค่าสรุปยอดจำนวนการตรวจจับประจำวัน:
    - คนในบ้าน (household)
    - คนส่งของ (delivery)
    - คนแปลกหน้า (stranger)
    - ยอดรวมทั้งหมดและจำนวนการแจ้งเตือน
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = (
        db.query(DetectionHistory)
        .filter(DetectionHistory.timestamp >= today_start)
        .count()
    )
    household_count = (
        db.query(DetectionHistory)
        .filter(
            DetectionHistory.timestamp >= today_start,
            DetectionHistory.category == "household",
        )
        .count()
    )
    delivery_count = (
        db.query(DetectionHistory)
        .filter(
            DetectionHistory.timestamp >= today_start,
            DetectionHistory.category == "delivery",
        )
        .count()
    )
    stranger_count = (
        db.query(DetectionHistory)
        .filter(
            DetectionHistory.timestamp >= today_start,
            DetectionHistory.category == "stranger",
        )
        .count()
    )
    alerts_count = (
        db.query(Alert)
        .filter(Alert.created_at >= today_start)
        .count()
    )

    # Fallback to total all-time if today is zero for demo showcase
    if total_today == 0:
        total_today = db.query(DetectionHistory).count()
        household_count = db.query(DetectionHistory).filter(DetectionHistory.category == "household").count()
        delivery_count = db.query(DetectionHistory).filter(DetectionHistory.category == "delivery").count()
        stranger_count = db.query(DetectionHistory).filter(DetectionHistory.category == "stranger").count()
        alerts_count = db.query(Alert).count()

    return DetectionSummaryStats(
        total_today=total_today,
        household_count=household_count,
        delivery_count=delivery_count,
        stranger_count=stranger_count,
        alerts_count=alerts_count,
    )


@router.get("/history", response_model=List[DetectionHistoryResponse], summary="ดึงประวัติการตรวจจับทั้งหมด")
def get_detection_history(
    category: Optional[str] = Query(None, description="กรองตามประเภท: 'household', 'delivery', 'stranger'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    เรียกดูประวัติการตรวจจับ เรียงลำดับจากล่าสุดไปเก่าสุด
    สามารถกรองเฉพาะ คนในบ้าน, คนส่งของ, หรือ คนแปลกหน้า ได้
    """
    query = db.query(DetectionHistory)
    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(DetectionHistory.category == category.lower())

    records = (
        query.order_by(DetectionHistory.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return records


@router.delete("/history", summary="ลบประวัติการตรวจจับทั้งหมด หรือตามหมวดหมู่")
def clear_detection_history(
    category: Optional[str] = Query(None, description="กรองตามประเภท: 'household', 'delivery', 'stranger'"),
    db: Session = Depends(get_db),
):
    """
    ล้างข้อมูลประวัติการตรวจจับทั้งหมด หรือกรองตามหมวดหมู่
    """
    query = db.query(DetectionHistory)
    if category and category.strip() and category.upper() != "ALL":
        query = query.filter(DetectionHistory.category == category.lower())

    records = query.all()
    deleted_count = len(records)
    for r in records:
        # Nullify foreign key in alerts first to prevent FK constraint failure
        db.query(Alert).filter(Alert.detection_id == r.id).update({"detection_id": None})
        db.delete(r)
    db.commit()
    return {
        "message": f"ลบประวัติการตรวจจับสำเร็จ {deleted_count} รายการ",
        "deleted_count": deleted_count,
    }


@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT, summary="ลบประวัติการตรวจจับ")
def delete_detection_history(history_id: int, db: Session = Depends(get_db)):
    record = db.query(DetectionHistory).filter(DetectionHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Detection record not found")
    
    # Nullify foreign key in alerts
    db.query(Alert).filter(Alert.detection_id == history_id).update({"detection_id": None})
    db.delete(record)
    db.commit()
    return None



@router.put("/history/{history_id}/identify", response_model=IdentifyPersonResponse, summary="ระบุตัวตนและเทรนข้อมูลบุคคลจากประวัติการตรวจจับ")
def identify_history_person(
    history_id: int,
    req: IdentifyPersonRequest,
    db: Session = Depends(get_db),
):
    """
    นำรายการตรวจจับ (Detection Record) โดยเฉพาะคนแปลกหน้า มาระบุตัวตนและบันทึกข้อมูล:
    1. mode='existing': เลือกบุคคลเดิมในฐานข้อมูล -> เพิ่มจำนวนภาพใน dataset และอัปเดตประวัติ
    2. mode='new': ลงทะเบียนเป็นบุคคลใหม่ -> บันทึกโปรไฟล์ลงตาราง persons พร้อมภาพ snapshot
    3. อัปเดตประวัติ DetectionHistory และแจ้งเตือน Alert ที่เกี่ยวข้องในฐานข้อมูล SQLite
    """
    record = db.query(DetectionHistory).filter(DetectionHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Detection record not found")

    person = None
    if req.mode == "existing":
        if not req.person_id:
            raise HTTPException(status_code=400, detail="person_id is required for existing mode")
        person = db.query(Person).filter(Person.id == req.person_id).first()
        if not person:
            raise HTTPException(status_code=404, detail=f"Person id={req.person_id} not found")

        # เพิ่มจำนวนภาพ Dataset ของบุคคลนั้น
        person.images_count = (person.images_count or 0) + 1
        # ถ้าบุคคลเดิมยังไม่มีรูป ให้เอารูป snapshot นี้เป็นรูปโปรไฟล์
        if (not person.photo_url or "unsplash" in person.photo_url) and record.snapshot_path:
            person.photo_url = record.snapshot_path

        # อัปเดตประวัติการตรวจจับ
        record.person_id = person.id
        record.person_name = person.name
        record.category = person.category

        msg = f"เชื่อมโยงภาพเข้าสู่ชุดข้อมูลของ '{person.name}' ({person.category}) เรียบร้อยแล้ว"

    else:
        # mode == "new"
        if not req.name or not req.name.strip():
            raise HTTPException(status_code=400, detail="name is required for new person")

        cat = req.category or "household"
        role_val = req.role or ("Family" if cat == "household" else "Delivery" if cat == "delivery" else "Stranger")
        person = Person(
            name=req.name.strip(),
            category=cat,
            role=role_val,
            department=req.department.strip() if req.department else "",
            notes=req.notes.strip() if req.notes else "",
            photo_url=record.snapshot_path or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            accuracy=98.5,
            images_count=1,
            is_active=True,
        )
        db.add(person)
        db.flush()

        # อัปเดตประวัติการตรวจจับ
        record.person_id = person.id
        record.person_name = person.name
        record.category = person.category

        msg = f"ลงทะเบียนบุคคลใหม่ '{person.name}' ({person.category}) และบันทึกเข้าสู่ฐานข้อมูลสำเร็จ"

    # อัปเดต Alert ที่เชื่อมโยงกับ detection_id นี้ (ถ้ามี)
    linked_alert = db.query(Alert).filter(Alert.detection_id == history_id).first()
    if linked_alert:
        linked_alert.category = person.category
        if person.category == "household":
            linked_alert.title = f"ยืนยันตัวตนแล้ว: {person.name} (คนในบ้าน)"
            linked_alert.severity = "info"
            linked_alert.is_read = True
        elif person.category == "delivery":
            linked_alert.title = f"ยืนยันตัวตนแล้ว: {person.name} (คนส่งของ)"
            linked_alert.severity = "info"
        else:
            linked_alert.title = f"บันทึกบุคคลเฝ้าระวัง: {person.name} (คนแปลกหน้า)"
            linked_alert.severity = "warning"

    db.commit()
    db.refresh(record)
    db.refresh(person)

    # ทำการเทรน Face Embedding เพิ่มเติมด้วยภาพ Snapshot ที่ระบุตัวตน (Incremental Learning)
    if record.snapshot_path:
        try:
            add_person_image_embedding(
                person_id=person.id,
                name=person.name,
                category=person.category,
                role=person.role,
                image_source=record.snapshot_path,
            )
        except Exception as emb_err:
            print(f"[Incremental Face Training Error] {emb_err}")

    return IdentifyPersonResponse(
        success=True,
        message=msg,
        detection_id=record.id,
        person_id=person.id,
        person_name=person.name,
        category=person.category,
        photo_url=person.photo_url or record.snapshot_path,
        images_count=person.images_count,
    )



@router.post("/detect-image", response_model=DetectResultResponse, summary="ส่งภาพให้ YOLO ตรวจจับและจำแนกบุคคล")
async def detect_image(
    file: UploadFile = File(...),
    camera_id: str = Form("cam-1"),
    location: str = Form("หน้าบ้าน (Main Entrance)"),
    force_category: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    รับไฟล์ภาพ JPEG/PNG จากไคลเอนต์หรือเว็บแคม
    รันโมเดล YOLOv8 เพื่อหาตำแหน่งคน (Bounding box)
    แล้วส่งต่อให้ Classifier เพื่อแยก คนในบ้าน / คนส่งของ / คนแปลกหน้า
    พร้อมบันทึกประวัติลงฐานข้อมูล SQLite ทันที
    """
    contents = await file.read()
    image_np = bytes_to_image(contents)
    if image_np is None:
        raise HTTPException(status_code=400, detail="Invalid image format or corrupted file")

    # 1. Run YOLO
    detections = run_yolo_detection(image_np)

    # 2. Classify and save history & alerts
    results = classify_and_record(
        db=db,
        image_np=image_np,
        detections=detections,
        camera_id=camera_id,
        location=location,
        force_category=force_category,
    )

    items = [DetectionItem(**r) for r in results]
    return DetectResultResponse(
        success=True,
        camera_id=camera_id,
        timestamp=datetime.now(timezone.utc),
        detections_count=len(items),
        detections=items,
    )


async def fetch_esp32_frame(clean_ip: str, port_str: str = "", path_str: str = "/capture") -> Optional[bytes]:
    """
    ดึงภาพ 1 เฟรมจาก ESP32-CAM อย่างชาญฉลาด:
    1. ลองดึงจาก /capture ด้วย timeout สั้น (1.5 วินาที)
    2. หาก /capture ไม่ตอบสนอง ให้ดึง 1 เฟรมแรกจาก /stream แทนทันที (2.0 วินาที)
    """
    target_url = f"http://{clean_ip}{port_str}{path_str}"

    # 1. พยายามดึงภาพผ่าน /capture
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.get(target_url)
            if resp.status_code == 200 and len(resp.content) > 500:
                return resp.content
    except Exception as e:
        print(f"[ESP32 Frame] /capture not responding at {target_url}: {e}")

    # 2. Fallback: ดึง 1 เฟรม JPEG จาก /stream ทันที
    stream_url = f"http://{clean_ip}{port_str}/stream"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            async with client.stream("GET", stream_url) as stream_resp:
                if stream_resp.status_code == 200:
                    chunks = b""
                    async for chunk in stream_resp.aiter_bytes():
                        chunks += chunk
                        start = chunks.find(b"\xff\xd8")
                        end = chunks.find(b"\xff\xd9", start + 2) if start != -1 else -1
                        if start != -1 and end != -1:
                            return chunks[start:end + 2]
    except Exception as se:
        print(f"[ESP32 Frame] /stream fallback grab failed at {stream_url}: {se}")

    return None


@router.post("/detect-esp32", response_model=DetectResultResponse, summary="สั่ง Backend ดึงภาพสดจาก ESP32-CAM มารัน YOLO")
async def detect_from_esp32(
    req: DetectESP32Request,
    db: Session = Depends(get_db),
):
    """
    เชื่อมต่อกล้อง ESP32-CAM ผ่าน IP และ Path (เช่น /capture หรือ /stream)
    ดึงภาพ Snapshot ปัจจุบัน แล้ววิเคราะห์ด้วย YOLO + จำแนกบุคคล
    บันทึกประวัติ (History) และส่งแจ้งเตือน (Alert) ลงฐานข้อมูล
    """
    clean_ip = (req.camera_ip.strip().replace("http://", "").replace("https://", "").split("/")[0]) or "192.168.137.65"
    port_str = f":{req.camera_port.strip()}" if req.camera_port and req.camera_port.strip() else ""
    path_str = req.camera_path if req.camera_path and req.camera_path.startswith("/") else f"/{req.camera_path or 'capture'}"

    image_bytes = await fetch_esp32_frame(clean_ip, port_str, path_str)

    if not image_bytes:
        # หากกล้องออฟไลน์หรือไม่ตอบสนอง คืนค่า 0 detections ปลอดภัยไม่ crash
        return DetectResultResponse(
            success=False,
            camera_id=f"ESP32 ({clean_ip})",
            timestamp=datetime.now(timezone.utc),
            detections_count=0,
            detections=[],
        )

    image_np = bytes_to_image(image_bytes)
    if image_np is None:
        raise HTTPException(status_code=500, detail="Failed to parse frame from ESP32-CAM")

    detections = run_yolo_detection(image_np)
    results = classify_and_record(
        db=db,
        image_np=image_np,
        detections=detections,
        camera_id=f"ESP32-CAM ({clean_ip})",
        location=req.location or "หน้าบ้าน (Main Entrance)",
    )

    items = [DetectionItem(**r) for r in results]
    return DetectResultResponse(
        success=True,
        camera_id=f"ESP32 ({clean_ip})",
        timestamp=datetime.now(timezone.utc),
        detections_count=len(items),
        detections=items,
    )


@router.get("/esp32-snapshot", summary="ดึงภาพ Snapshot จาก ESP32-CAM ผ่าน Backend Proxy")
async def get_esp32_snapshot(
    camera_ip: str = Query("192.168.137.65", description="IP Address ของ ESP32-CAM"),
    camera_port: Optional[str] = Query("", description="Port (ถ้ามี)"),
    camera_path: Optional[str] = Query("/capture", description="Path เช่น /capture"),
):
    """
    ดึงภาพ Snapshot จากบอร์ด ESP32-CAM เพื่อนำไปแสดงผลหรือลงทะเบียนบุคคลใหม่
    หลีกเลี่ยงปัญหา CORS และ Private Network Access restrictions บนเบราว์เซอร์
    """
    clean_ip = (camera_ip.strip().replace("http://", "").replace("https://", "").split("/")[0]) or "192.168.137.65"
    port_str = f":{camera_port.strip()}" if camera_port and camera_port.strip() else ""
    path_str = camera_path if camera_path and camera_path.startswith("/") else f"/{camera_path or 'capture'}"

    image_bytes = await fetch_esp32_frame(clean_ip, port_str, path_str)
    if image_bytes:
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
            },
        )

    # Fallback simulated frame if ESP32 is offline
    img = Image.new("RGB", (640, 480), color=(30, 32, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return Response(
        content=buf.getvalue(),
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Camera-Status": "simulated",
        },
    )


@router.get("/esp32-stream", summary="Proxy สตรีมสด MJPEG จาก ESP32-CAM")
async def get_esp32_stream(
    camera_ip: str = Query("192.168.137.65", description="IP Address ของ ESP32-CAM"),
    camera_port: Optional[str] = Query("", description="Port (ถ้ามี)"),
):
    """
    รับสตรีมสด MJPEG จาก ESP32-CAM แล้วส่งต่อให้เบราว์เซอร์
    ป้องกันปัญหา Private Network Access / CORS restrictions บนเบราว์เซอร์ 100%
    """
    clean_ip = (camera_ip.strip().replace("http://", "").replace("https://", "").split("/")[0]) or "192.168.137.65"
    port_str = f":{camera_port.strip()}" if camera_port and camera_port.strip() else ""
    target_url = f"http://{clean_ip}{port_str}/stream"

    async def stream_generator():
        try:
            timeout_cfg = httpx.Timeout(connect=3.0, read=None, write=None, pool=None)
            async with httpx.AsyncClient(timeout=timeout_cfg) as client:
                async with client.stream("GET", target_url) as resp:
                    async for chunk in resp.aiter_raw():
                        yield chunk
        except Exception as e:
            print(f"[Stream Proxy] Stream ended or connection failed for {target_url}: {e}")

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )


