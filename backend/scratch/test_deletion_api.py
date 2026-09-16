import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.alert import Alert
from app.models.detection import DetectionHistory

client = TestClient(app)

def test_deletion():
    db = SessionLocal()
    try:
        # Create dummy detection history
        h1 = DetectionHistory(
            person_name="Test Deletion Person 1",
            category="household",
            confidence=95.0,
            location="Front Gate",
            snapshot_path="",
            camera_id="cam-1",
        )
        h2 = DetectionHistory(
            person_name="Test Deletion Person 2",
            category="stranger",
            confidence=85.0,
            location="Side Gate",
            snapshot_path="",
            camera_id="cam-1",
        )
        db.add(h1)
        db.add(h2)
        db.commit()
        db.refresh(h1)
        db.refresh(h2)

        # Create dummy alerts linked to detection history
        a1 = Alert(
            title="Test Alert 1",
            description="Alert description 1",
            category="household",
            detection_id=h1.id,
            is_read=False,
        )
        a2 = Alert(
            title="Test Alert 2",
            description="Alert description 2",
            category="stranger",
            detection_id=h2.id,
            is_read=True,
        )
        a3 = Alert(
            title="Test Alert 3",
            description="Alert description 3",
            category="delivery",
            detection_id=None,
            is_read=False,
        )
        db.add(a1)
        db.add(a2)
        db.add(a3)
        db.commit()
        db.refresh(a1)
        db.refresh(a2)
        db.refresh(a3)

        print(f"Created test records: History IDs=[{h1.id}, {h2.id}], Alert IDs=[{a1.id}, {a2.id}, {a3.id}]")

        # 1. Test DELETE /api/v1/alerts/{alert_id}
        res = client.delete(f"/api/v1/alerts/{a1.id}")
        assert res.status_code == 204, f"Expected 204, got {res.status_code}: {res.text}"
        print(f"PASS: DELETE /api/v1/alerts/{a1.id} returned 204")

        # 2. Test DELETE /api/v1/alerts (read_only=true)
        res = client.delete("/api/v1/alerts?read_only=true")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        print(f"PASS: DELETE /api/v1/alerts?read_only=true: {data}")

        # 3. Test DELETE /api/v1/alerts (all remaining)
        res = client.delete("/api/v1/alerts")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        print(f"PASS: DELETE /api/v1/alerts: {data}")

        # 4. Test DELETE /api/v1/detection/history/{history_id}
        res = client.delete(f"/api/v1/detection/history/{h1.id}")
        assert res.status_code == 204, f"Expected 204, got {res.status_code}: {res.text}"
        print(f"PASS: DELETE /api/v1/detection/history/{h1.id} returned 204")

        # 5. Test DELETE /api/v1/detection/history (clear all)
        res = client.delete("/api/v1/detection/history")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        print(f"PASS: DELETE /api/v1/detection/history: {data}")

        print("\nALL BACKEND DELETION TESTS PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    test_deletion()
