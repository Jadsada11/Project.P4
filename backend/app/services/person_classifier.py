import os
import json
import time
import uuid
import logging
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image

from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.person import Person
from app.models.detection import DetectionHistory
from app.models.alert import Alert
from app.services.face_embedding_service import match_face_embedding
from app.services.email_service import trigger_email_alert_async

logger = logging.getLogger("person_classifier")

# 5-minute alert cooldown tracker (300 seconds)
_alert_cooldowns: Dict[str, float] = {}
_cooldown_lock = threading.Lock()


def should_trigger_alert(category: str, person_name: str, person_id: Optional[int] = None) -> bool:
    """
    Check if an alert should be created based on ALERT_COOLDOWN_SECONDS (default 300s = 5 minutes).
    Throttles alert creation per person/category so alerts are not spammed every 5s snapshot.
    """
    cooldown = getattr(settings, "ALERT_COOLDOWN_SECONDS", 300)
    now_ts = time.time()

    # For strangers, use category keying to prevent transient IDs/names from bypassing cooldown
    if category == "stranger":
        key = "stranger"
    elif person_id:
        key = f"{category}_{person_id}"
    else:
        key = f"{category}_{person_name.strip().lower()}"

    with _cooldown_lock:
        last_alert_time = _alert_cooldowns.get(key, 0.0)
        if now_ts - last_alert_time >= cooldown:
            _alert_cooldowns[key] = now_ts
            return True
        logger.info(
            f"Alert cooldown active for {key}: {int(cooldown - (now_ts - last_alert_time))}s remaining"
        )
        return False


SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)


def analyze_colors_and_features(crop_np: np.ndarray) -> Dict[str, float]:
    """
    Analyze color dominant components in the cropped person/clothing area.
    Can identify courier uniforms (e.g. Flash Yellow, Kerry Orange, Grab Green).
    """
    if crop_np is None or crop_np.size == 0:
        return {}
    r = np.mean(crop_np[:, :, 0])
    g = np.mean(crop_np[:, :, 1])
    b = np.mean(crop_np[:, :, 2])
    return {"r": float(r), "g": float(g), "b": float(b)}


def classify_and_record(
    db: Session,
    image_np: np.ndarray,
    detections: List[Dict[str, Any]],
    camera_id: str = "cam-1",
    location: str = "หน้าบ้าน (Main Entrance)",
    force_category: Optional[str] = None,
    force_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Classifies each detected person into one of three categories:
    - 'household' (คนในบ้าน)
    - 'delivery' (คนส่งของ)
    - 'stranger' (คนแปลกหน้า)

    Saves detection history and triggers alerts if appropriate.
    """
    results = []
    registered_persons = db.query(Person).filter(Person.is_active == True).all()

    # Create mapping by category
    household_members = [p for p in registered_persons if p.category == "household"]
    delivery_members = [p for p in registered_persons if p.category == "delivery"]

    h, w = image_np.shape[:2]
    now = datetime.now(timezone.utc)

    # Save full snapshot image
    snapshot_filename = f"snap_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
    snapshot_full_path = os.path.join(SNAPSHOT_DIR, snapshot_filename)
    try:
        Image.fromarray(image_np).save(snapshot_full_path, format="JPEG", quality=85)
        snapshot_url = f"/data/snapshots/{snapshot_filename}"
    except Exception as e:
        logger.error(f"Failed to save snapshot: {e}")
        snapshot_url = ""

    for idx, det in enumerate(detections):
        box = det["box"]  # [x1, y1, x2, y2]
        confidence = det.get("confidence", 85.0)

        # Ensure box is within bounds
        x1 = max(0, min(w - 1, box[0]))
        y1 = max(0, min(h - 1, box[1]))
        x2 = max(x1 + 1, min(w, box[2]))
        y2 = max(y1 + 1, min(h, box[3]))
        crop = image_np[y1:y2, x1:x2]

        matched_person: Optional[Person] = None
        category = "stranger"
        person_name = "บุคคลแปลกหน้า (Stranger)"
        role = "Stranger"

        # If manually forced for testing / explicit mode
        if force_category:
            category = force_category
            matched_pool = [p for p in registered_persons if p.category == force_category]
            if matched_pool:
                matched_person = matched_pool[0]
                person_name = force_name or matched_person.name
                role = matched_person.role
            else:
                cat_labels = {
                    "household": "สมาชิกในบ้าน (Household)",
                    "neighbor": "เพื่อนบ้าน (Neighbor)",
                    "friend": "เพื่อน (Friend)",
                    "delivery": "คนส่งของ (Delivery)",
                    "other": "บุคคลที่บันทึกไว้ (Other)",
                    "stranger": "บุคคลแปลกหน้า (Stranger)",
                }
                person_name = force_name or cat_labels.get(force_category, f"บุคคลหมวดหมู่ {force_category}")
                role = force_category.capitalize()
        else:
            # 1. เปรียบเทียบ Deep Learning Face Embedding กับฐานข้อมูลบุคคลที่เทรนไว้
            is_face_crop = det.get("is_real_face", True) or det.get("class_name") == "face"
            face_match, match_score = match_face_embedding(crop, threshold=0.55, is_full_person_crop=(not is_face_crop))
            if face_match:
                matched_pid = face_match.get("person_id")
                if matched_pid:
                    matched_person = next((p for p in registered_persons if p.id == matched_pid), None)
                category = face_match.get("category", "household")
                person_name = face_match.get("name", "บุคคลที่ลงทะเบียน")
                default_role = "Family" if category == "household" else "Neighbor" if category == "neighbor" else "Friend" if category == "friend" else "Delivery" if category == "delivery" else "Other"
                role = face_match.get("role") or (matched_person.role if matched_person else default_role)
                confidence = round(max(confidence, match_score * 100), 1)
            else:
                # 2. ตรวจสอบ Heuristic เครื่องแบบขนส่งพัสดุ โดยดูบริเวณเสื้อผ้าใต้ใบหน้า
                chest_y1 = min(h - 1, y2)
                chest_y2 = min(h, y2 + int((y2 - y1) * 1.5))
                clothing_crop = image_np[chest_y1:chest_y2, max(0, x1 - int((x2 - x1) * 0.2)):min(w, x2 + int((x2 - x1) * 0.2))]
                color_feats = analyze_colors_and_features(clothing_crop if clothing_crop.size > 0 else crop)
                r = color_feats.get("r", 128)
                g = color_feats.get("g", 128)
                b = color_feats.get("b", 128)

                is_flash_yellow = (r > 160 and g > 150 and b < 100)
                is_kerry_orange = (r > 180 and g > 80 and b < 80)
                is_grab_green = (g > 140 and r < 110 and b < 110)

                if (is_flash_yellow or is_kerry_orange or is_grab_green) and delivery_members:
                    category = "delivery"
                    if is_flash_yellow:
                        matched_person = next((p for p in delivery_members if "Flash" in p.name or "Flash" in p.department), delivery_members[0])
                    elif is_kerry_orange:
                        matched_person = next((p for p in delivery_members if "Kerry" in p.name or "Kerry" in p.department), delivery_members[0])
                    else:
                        matched_person = next((p for p in delivery_members if "Grab" in p.name or "Grab" in p.department), delivery_members[0])
                    person_name = matched_person.name
                    role = matched_person.role
                else:
                    # บุคคลที่ยังไม่มีในฐานข้อมูล (Stranger)
                    category = "stranger"
                    person_name = f"บุคคลแปลกหน้า #{idx + 1}"
                    role = "Stranger"

        # Determine Alert triggering rules
        alert_created = False
        alert_msg = None

        # 1. บันทึก History ลง SQLite
        detection_record = DetectionHistory(
            person_id=matched_person.id if matched_person else None,
            person_name=person_name,
            category=category,
            confidence=confidence,
            bounding_box=json.dumps([x1, y1, x2, y2]),
            snapshot_path=snapshot_url or (matched_person.photo_url if matched_person else ""),
            camera_id=camera_id,
            location=location,
            alert_triggered=False,
            timestamp=now,
        )
        db.add(detection_record)
        db.flush()

        # 2. ตรวจสอบการสร้างการแจ้งเตือน (Alerts) พร้อมระบบ Cooldown 5 นาที (300 วินาที)
        can_alert = should_trigger_alert(category, person_name, matched_person.id if matched_person else None)

        if can_alert:
            if category == "stranger":
                alert_created = True
                alert_msg = f"ตรวจพบคนแปลกหน้า! บริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบคนแปลกหน้าบริเวณ {location}!",
                    description=f"ระบบตรวจพบบุคคลแปลกหน้า (ความมั่นใจ {confidence}%) ไม่ตรงกับฐานข้อมูลใบหน้าที่เทรนไว้ บริเวณ {location}",
                    category="stranger",
                    severity="warning",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True

            elif category == "delivery":
                alert_created = True
                alert_msg = f"มีพัสดุมาส่ง: {person_name} บริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบคนส่งของ: {person_name}",
                    description=f"AI ตรวจพบเจ้าหน้าที่ขนส่งพัสดุ/ไรเดอร์ ({person_name}) มาถึงบริเวณ {location} (ความมั่นใจ {confidence}%)",
                    category="delivery",
                    severity="info",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True

            elif category == "household":
                alert_created = True
                alert_msg = f"ตรวจพบสมาชิกในบ้าน: {person_name} ถึงบริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบสมาชิกในบ้าน: {person_name}",
                    description=f"AI ตรวจพบและจดจำใบหน้าของ {person_name} ({role}) เข้าสู่บริเวณ {location} อย่างปลอดภัย (ความแม่นยำ {confidence}%)",
                    category="household",
                    severity="info",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True

            elif category == "neighbor":
                alert_created = True
                alert_msg = f"ตรวจพบเพื่อนบ้าน: {person_name} บริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบเพื่อนบ้าน: {person_name}",
                    description=f"AI ตรวจพบและจดจำใบหน้าเพื่อนบ้าน ({person_name}) เข้าสู่บริเวณ {location} (ความแม่นยำ {confidence}%)",
                    category="neighbor",
                    severity="info",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True

            elif category == "friend":
                alert_created = True
                alert_msg = f"ตรวจพบเพื่อน/คนรู้จัก: {person_name} ถึงบริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบเพื่อน: {person_name}",
                    description=f"AI ตรวจพบและจดจำใบหน้าเพื่อนสนิท/ผู้มาเยือน ({person_name}) บริเวณ {location} (ความแม่นยำ {confidence}%)",
                    category="friend",
                    severity="info",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True

            elif category == "other":
                alert_created = True
                alert_msg = f"ตรวจพบบุคคลทั่วไป: {person_name} บริเวณ {location}"
                alert = Alert(
                    title=f"ตรวจพบบุคคล (อื่นๆ): {person_name}",
                    description=f"AI ตรวจพบและจดจำใบหน้า {person_name} ({role}) บริเวณ {location} (ความแม่นยำ {confidence}%)",
                    category="other",
                    severity="info",
                    location=location,
                    detection_id=detection_record.id,
                    person_id=matched_person.id if matched_person else None,
                    thumbnail=snapshot_url or (matched_person.photo_url if matched_person else ""),
                    is_read=False,
                    created_at=now,
                )
                db.add(alert)
                detection_record.alert_triggered = True


            # 3. ส่งการแจ้งเตือนทางอีเมลอัตโนมัติ (Gmail SMTP) แบบ Non-blocking
            trigger_email_alert_async(
                category=category,
                person_name=person_name,
                location=location,
                confidence=confidence,
                snapshot_rel_path=snapshot_url or (matched_person.photo_url if matched_person else ""),
            )
        else:
            alert_created = False
            alert_msg = f"{person_name} (ตรวจพบต่อเนื่อง - บันทึกภาพ Snapshot แต่หน่วงแจ้งเตือนตามรอบ 5 นาที)"

        results.append({
            "person_name": person_name,
            "category": category,
            "confidence": confidence,
            "bounding_box": [x1, y1, x2, y2],
            "alert_created": alert_created,
            "alert_message": alert_msg,
            "role": role,
            "location": location,
        })

    db.commit()
    return results
