import io
import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
import base64
import numpy as np
from PIL import Image, ImageDraw

from app.core.database import SessionLocal
from app.models.person import Person
from app.models.detection import DetectionHistory
from app.models.alert import Alert
from app.services.face_embedding_service import (
    extract_face_embedding,
    save_person_embeddings,
    match_face_embedding,
    load_embeddings_db,
)
from app.services.person_classifier import classify_and_record


def create_synthetic_face_image(seed=42, text="FaceA"):
    """สร้างภาพจำลองรูปหน้าบุคคลสำหรับทดสอบ"""
    np.random.seed(seed)
    # Base background
    img = Image.new("RGB", (200, 200), color=(240, 220, 200))
    draw = ImageDraw.Draw(img)

    # Draw head
    draw.ellipse([30, 20, 170, 180], fill=(220, 180, 150), outline=(100, 70, 50), width=3)
    # Eyes
    draw.ellipse([60, 70, 80, 90], fill=(50, 40, 30))
    draw.ellipse([120, 70, 140, 90], fill=(50, 40, 30))
    # Nose
    draw.polygon([(100, 90), (90, 120), (110, 120)], fill=(200, 150, 120))
    # Mouth
    draw.arc([70, 130, 130, 155], 0, 180, fill=(150, 50, 50), width=3)

    # Some distinct color variations based on seed
    if seed % 2 == 0:
        draw.rectangle([60, 40, 140, 60], fill=(30, 20, 10)) # Hair
    else:
        draw.rectangle([50, 35, 150, 55], fill=(120, 80, 40)) # Hair

    return img


def img_to_data_uri(pil_img):
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=90)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def run_tests():
    print("=== TEST 1: Feature Extractor & Dimension ===")
    face_a1 = create_synthetic_face_image(seed=100)
    emb_a1 = extract_face_embedding(face_a1)
    assert emb_a1 is not None, "Failed to extract embedding"
    assert emb_a1.shape == (576,), f"Expected 576-dim vector, got {emb_a1.shape}"
    norm = np.linalg.norm(emb_a1)
    assert abs(norm - 1.0) < 1e-4, f"Vector should be L2 normalized, got {norm}"
    print(f"[OK] Embedding extracted: 576 dims, L2 norm={norm:.4f}")

    print("\n=== TEST 2: Self & Cross Cosine Similarity ===")
    face_a2 = create_synthetic_face_image(seed=100) # Same face
    face_b = create_synthetic_face_image(seed=999)  # Different face
    emb_a2 = extract_face_embedding(face_a2)
    emb_b = extract_face_embedding(face_b)

    sim_same = float(np.dot(emb_a1, emb_a2))
    sim_diff = float(np.dot(emb_a1, emb_b))
    print(f"Similarity (Same face A1 vs A2): {sim_same:.4f}")
    print(f"Similarity (Different face A vs B): {sim_diff:.4f}")
    assert sim_same > 0.99, "Identical images must have near 1.0 similarity"
    print("[OK] Cosine similarity operates correctly.")

    print("\n=== TEST 3: Register Person & Train Embeddings ===")
    db = SessionLocal()
    try:
        # Create test person in DB
        test_person_name = "นายทดสอบ สมาร์ทโฮม"
        existing = db.query(Person).filter(Person.name == test_person_name).first()
        if existing:
            db.delete(existing)
            db.commit()

        test_person = Person(
            name=test_person_name,
            category="household",
            role="Father",
            department="Home",
            notes="Test User for Face AI",
            photo_url="",
            accuracy=98.5,
            images_count=2,
            is_active=True,
        )
        db.add(test_person)
        db.commit()
        db.refresh(test_person)

        # Train face with 2 images
        uri1 = img_to_data_uri(face_a1)
        uri2 = img_to_data_uri(face_a2)
        success = save_person_embeddings(
            person_id=test_person.id,
            name=test_person.name,
            category=test_person.category,
            role=test_person.role,
            image_sources=[uri1, uri2],
        )
        assert success, "save_person_embeddings failed"

        db_embed = load_embeddings_db()
        assert str(test_person.id) in db_embed["persons"], "Person embedding not found in json"
        print(f"[OK] Person {test_person.id} ({test_person.name}) trained with sample_count={db_embed['persons'][str(test_person.id)]['sample_count']}")

        print("\n=== TEST 4: Live Face Matching ===")
        match_info, match_score = match_face_embedding(face_a1, threshold=0.60)
        assert match_info is not None, f"Expected match, got None (score={match_score})"
        assert match_info["name"] == test_person_name, f"Expected {test_person_name}, got {match_info['name']}"
        print(f"[OK] Matched face correctly: {match_info['name']} (Score: {match_score:.4f})")

        # Test unmatched stranger face
        stranger_img = Image.new("RGB", (200, 200), (10, 10, 80)) # Dark blue box
        stranger_match, stranger_score = match_face_embedding(stranger_img, threshold=0.75)
        print(f"Stranger test match: {stranger_match} (Score: {stranger_score:.4f})")

        print("\n=== TEST 5: classify_and_record with Real-time Alert Dispatch ===")
        # Create an image containing person A
        canvas = np.zeros((480, 640, 3), dtype=np.uint8)
        canvas[50:250, 100:300] = np.array(face_a1)

        detections = [
            {"box": [100, 50, 300, 250], "confidence": 95.0, "class_name": "person"}
        ]

        results = classify_and_record(
            db=db,
            image_np=canvas,
            detections=detections,
            camera_id="cam-front-test",
            location="หน้าบ้าน (Entrance Gate)",
        )

        assert len(results) == 1, f"Expected 1 result, got {len(results)}"
        res = results[0]
        print(f"Classify Result: person_name='{res['person_name']}', category='{res['category']}', alert_created={res['alert_created']}")
        assert res["person_name"] == test_person_name, f"Expected {test_person_name}, got {res['person_name']}"
        assert res["category"] == "household", f"Expected household, got {res['category']}"
        assert res["alert_created"] is True, "Alert should have been created"

        # Check Alert in SQLite DB
        latest_alert = db.query(Alert).filter(Alert.title.contains(test_person_name)).order_by(Alert.id.desc()).first()
        assert latest_alert is not None, "Alert was not saved to SQLite"
        print(f"[OK] Alert created in DB: ID={latest_alert.id}, Title='{latest_alert.title}', is_read={latest_alert.is_read}")

        # Clean up test person
        db.delete(test_person)
        db.commit()
        print("\n[SUCCESS] All 5 Face Training & Detection Tests Passed Flawlessly!")

    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
