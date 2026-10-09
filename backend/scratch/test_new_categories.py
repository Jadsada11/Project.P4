import io
import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from PIL import Image, ImageDraw

from app.core.database import SessionLocal
from app.models.person import Person
from app.models.detection import DetectionHistory
from app.models.alert import Alert
from app.services.face_embedding_service import save_person_embeddings, match_face_embedding
from app.services.person_classifier import classify_and_record


def create_synthetic_face(seed=77):
    np.random.seed(seed)
    img = Image.new("RGB", (200, 200), color=(230, 210, 190))
    draw = ImageDraw.Draw(img)
    draw.ellipse([30, 20, 170, 180], fill=(210, 170, 140), outline=(90, 60, 40), width=3)
    draw.ellipse([60, 70, 80, 90], fill=(40, 30, 20))
    draw.ellipse([120, 70, 140, 90], fill=(40, 30, 20))
    draw.polygon([(100, 90), (90, 120), (110, 120)], fill=(190, 140, 110))
    draw.arc([70, 130, 130, 155], 0, 180, fill=(140, 40, 40), width=3)
    return img


def run_category_tests():
    db = SessionLocal()
    try:
        # 1. Register a Friend
        friend_face = create_synthetic_face(seed=201)
        friend_person = Person(
            name="เพื่อนสนิท สมศักดิ์",
            category="friend",
            role="Friend",
            department="เพื่อนมหาลัย",
            notes="เพื่อนสนิทอนุญาตเข้าออก",
            photo_url="",
            accuracy=98.5,
            images_count=1,
            is_active=True,
        )
        db.add(friend_person)
        db.commit()
        db.refresh(friend_person)

        save_person_embeddings(
            person_id=friend_person.id,
            name=friend_person.name,
            category=friend_person.category,
            role=friend_person.role,
            image_sources=[friend_face],
        )
        print(f"[OK] Registered and trained Friend: #{friend_person.id} {friend_person.name}")

        # 2. Test classify_and_record with Friend's face
        test_frame = np.array(friend_face)
        dummy_det = [{
            "box": [10, 10, 190, 190],
            "confidence": 95.0,
            "class_name": "face",
            "is_real_face": True,
        }]

        results = classify_and_record(
            db=db,
            image_np=test_frame,
            detections=dummy_det,
            location="หน้าประตูรั้ว",
        )
        res = results[0]
        print(f"[OK] Classification: person='{res['person_name']}', category='{res['category']}', role='{res['role']}'")
        assert res["category"] == "friend", f"Expected friend, got {res['category']}"
        assert res["alert_created"] is True, "Alert should be created"

        # Check DB Alert
        alert = db.query(Alert).filter(Alert.category == "friend").order_by(Alert.id.desc()).first()
        assert alert is not None
        print(f"[OK] Alert created in DB: '{alert.title}' (category: {alert.category})")

        # 3. Test Neighbor forced or simulated
        neighbor_results = classify_and_record(
            db=db,
            image_np=test_frame,
            detections=dummy_det,
            force_category="neighbor",
            force_name="ป้าสมศรี (ข้างบ้าน)",
            location="หน้าบ้าน",
        )
        n_res = neighbor_results[0]
        print(f"[OK] Neighbor test: person='{n_res['person_name']}', category='{n_res['category']}'")
        assert n_res["category"] == "neighbor"
        neighbor_alert = db.query(Alert).filter(Alert.category == "neighbor").order_by(Alert.id.desc()).first()
        assert neighbor_alert is not None
        print(f"[OK] Neighbor Alert created: '{neighbor_alert.title}'")

        # Clean up test person
        db.delete(friend_person)
        db.commit()
        print("[SUCCESS] All new category tests passed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    run_category_tests()
