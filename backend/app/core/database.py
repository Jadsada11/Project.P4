import os
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Ensure sqlite directory exists and path resolves consistently to backend/data/vigil.db
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///./"):
    abs_db_path = os.path.abspath(os.path.join(BACKEND_DIR, db_url.replace("sqlite:///./", "")))
    db_url = f"sqlite:///{abs_db_path.replace(os.sep, '/')}"
    os.makedirs(os.path.dirname(abs_db_path), exist_ok=True)
elif db_url.startswith("sqlite:///") and not os.path.isabs(db_url.replace("sqlite:///", "")):
    abs_db_path = os.path.abspath(os.path.join(BACKEND_DIR, db_url.replace("sqlite:///", "")))
    db_url = f"sqlite:///{abs_db_path.replace(os.sep, '/')}"
    os.makedirs(os.path.dirname(abs_db_path), exist_ok=True)

# For SQLite, check_same_thread=False is required for multi-threaded FastAPI requests
connect_args = (
    {"check_same_thread": False} if db_url.startswith("sqlite") else {}
)

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False,
)



@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints in SQLite."""
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()



def seed_initial_data(db) -> None:
    """Pre-populate initial ready-to-use dataset for 3 categories: household, delivery, stranger."""
    from app.models.person import Person
    from app.models.detection import DetectionHistory
    from app.models.alert import Alert
    from app.core.time_utils import get_thailand_naive_now

    if db.query(Person).count() == 0:
        now = get_thailand_naive_now()

        # 1. คนในบ้าน (Household)
        p1 = Person(
            name="ดร. สมชาย รักสงบ (พ่อ)",
            category="household",
            role="Family",
            department="Residence",
            notes="หัวหน้าครอบครัว มีสิทธิ์ผ่านเข้าออกบ้าน 24 ชั่วโมง",
            photo_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
            accuracy=99.4,
            images_count=35,
        )
        p2 = Person(
            name="นางวิภาวรรณ รักสงบ (แม่)",
            category="household",
            role="Family",
            department="Residence",
            notes="สมาชิกในบ้าน",
            photo_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
            accuracy=98.9,
            images_count=28,
        )
        p3 = Person(
            name="นายธนกร รักสงบ (ลูกชาย)",
            category="household",
            role="Family",
            department="Residence",
            notes="สมาชิกในบ้าน (นักศึกษา IoT)",
            photo_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
            accuracy=99.1,
            images_count=30,
        )

        # 2. คนส่งของ (Delivery)
        p4 = Person(
            name="พนักงาน Flash Express",
            category="delivery",
            role="Delivery",
            department="Flash Express Thailand",
            notes="เจ้าหน้าที่ส่งพัสดุประจำเขต ยืนยันเครื่องแบบและกระเป๋าส่งของ",
            photo_url="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
            accuracy=96.5,
            images_count=18,
        )
        p5 = Person(
            name="ไรเดอร์ Grab Express",
            category="delivery",
            role="Delivery",
            department="Grab Delivery",
            notes="ไรเดอร์ส่งของและอาหาร Grab ส่งสินค้าบริเวณประตูหน้า",
            photo_url="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
            accuracy=95.8,
            images_count=15,
        )
        p6 = Person(
            name="พนักงาน Kerry Express",
            category="delivery",
            role="Delivery",
            department="Kerry Express",
            notes="เจ้าหน้าที่พัสดุสีส้ม Kerry Express",
            photo_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
            accuracy=94.2,
            images_count=14,
        )

        # 3. คนแปลกหน้า (Stranger)
        p7 = Person(
            name="บุคคลแปลกหน้า (Stranger #01)",
            category="stranger",
            role="Stranger",
            department="บุคคลภายนอก",
            notes="ยังไม่มีข้อมูลในระบบ ตรวจพบเมื่อเร็วๆ นี้บริเวณหน้าบ้าน",
            photo_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
            accuracy=88.0,
            images_count=5,
        )

        db.add_all([p1, p2, p3, p4, p5, p6, p7])
        db.commit()

        # Seed initial detection history
        h1 = DetectionHistory(
            person_id=p1.id,
            person_name=p1.name,
            category="household",
            confidence=99.2,
            bounding_box="[140, 60, 480, 520]",
            snapshot_path=p1.photo_url,
            camera_id="cam-1",
            location="หน้าประตูหลัก (Main Entrance)",
            alert_triggered=False,
            timestamp=now - timedelta(minutes=10),
        )
        h2 = DetectionHistory(
            person_id=p4.id,
            person_name=p4.name,
            category="delivery",
            confidence=96.5,
            bounding_box="[180, 90, 510, 540]",
            snapshot_path=p4.photo_url,
            camera_id="cam-1",
            location="หน้าประตูรั้ว (Gate 1)",
            alert_triggered=True,
            timestamp=now - timedelta(minutes=25),
        )
        h3 = DetectionHistory(
            person_id=p7.id,
            person_name=p7.name,
            category="stranger",
            confidence=88.0,
            bounding_box="[210, 100, 460, 500]",
            snapshot_path=p7.photo_url,
            camera_id="cam-1",
            location="ริมรั้วหน้าบ้าน (Perimeter Fence)",
            alert_triggered=True,
            timestamp=now - timedelta(minutes=45),
        )
        h4 = DetectionHistory(
            person_id=p2.id,
            person_name=p2.name,
            category="household",
            confidence=98.7,
            bounding_box="[150, 70, 490, 530]",
            snapshot_path=p2.photo_url,
            camera_id="cam-1",
            location="หน้าประตูหลัก (Main Entrance)",
            alert_triggered=False,
            timestamp=now - timedelta(hours=1, minutes=15),
        )

        db.add_all([h1, h2, h3, h4])
        db.commit()

        # Seed initial alerts
        a1 = Alert(
            title="ตรวจพบคนแปลกหน้าบริเวณหน้าบ้าน!",
            description="ตรวจพบบุคคลแปลกหน้า (Stranger) ไม่พบข้อมูลในระบบ ยืนอยู่บริเวณริมรั้วหน้าบ้าน",
            category="stranger",
            severity="warning",
            location="ริมรั้วหน้าบ้าน (Perimeter Fence)",
            detection_id=h3.id,
            person_id=p7.id,
            thumbnail=p7.photo_url,
            is_read=False,
            created_at=now - timedelta(minutes=45),
        )
        a2 = Alert(
            title="มีพัสดุมาส่ง (Flash Express)",
            description="ตรวจพบเจ้าหน้าที่ขนส่ง Flash Express นำพัสดุมาส่งที่บริเวณหน้าประตูรั้ว",
            category="delivery",
            severity="info",
            location="หน้าประตูรั้ว (Gate 1)",
            detection_id=h2.id,
            person_id=p4.id,
            thumbnail=p4.photo_url,
            is_read=False,
            created_at=now - timedelta(minutes=25),
        )
        a3 = Alert(
            title="สมาชิกในบ้านกลับถึงบ้าน (ดร. สมชาย)",
            description="ยืนยันตัวตนสำเร็จ: สมาชิกในบ้านผ่านเข้าออกประตูหลักอย่างปลอดภัย",
            category="household",
            severity="info",
            location="หน้าประตูหลัก (Main Entrance)",
            detection_id=h1.id,
            person_id=p1.id,
            thumbnail=p1.photo_url,
            is_read=True,
            created_at=now - timedelta(minutes=10),
        )

        db.add_all([a1, a2, a3])
        db.commit()


def run_sqlite_migrations() -> None:
    """Ensure schema migrations and indices exist for SQLite database."""
    if not db_url.startswith("sqlite"):
        return

    with engine.connect() as conn:
        # 1. Check if person_id column exists in alerts table
        result = conn.execute(text("PRAGMA table_info(alerts);"))
        alert_cols = [row[1] for row in result.fetchall()]
        if "person_id" not in alert_cols:
            try:
                conn.execute(
                    text(
                        "ALTER TABLE alerts ADD COLUMN person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL;"
                    )
                )
                conn.commit()
                print("[DB Migration] Added 'person_id' column to 'alerts' table.")
            except Exception as e:
                print(f"[DB Migration Warning] Could not alter alerts table for person_id: {e}")

        # 2. Check if user_id column exists in persons table
        result = conn.execute(text("PRAGMA table_info(persons);"))
        person_cols = [row[1] for row in result.fetchall()]
        if "user_id" not in person_cols:
            try:
                conn.execute(
                    text(
                        "ALTER TABLE persons ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"
                    )
                )
                conn.commit()
                print("[DB Migration] Added 'user_id' column to 'persons' table.")
            except Exception as e:
                print(f"[DB Migration Warning] Could not alter persons table for user_id: {e}")

        # 3. Check if user_id column exists in detection_history table
        result = conn.execute(text("PRAGMA table_info(detection_history);"))
        detection_cols = [row[1] for row in result.fetchall()]
        if "user_id" not in detection_cols:
            try:
                conn.execute(
                    text(
                        "ALTER TABLE detection_history ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"
                    )
                )
                conn.commit()
                print("[DB Migration] Added 'user_id' column to 'detection_history' table.")
            except Exception as e:
                print(f"[DB Migration Warning] Could not alter detection_history table for user_id: {e}")

        # 4. Check if user_id column exists in alerts table
        result = conn.execute(text("PRAGMA table_info(alerts);"))
        alert_cols = [row[1] for row in result.fetchall()]
        if "user_id" not in alert_cols:
            try:
                conn.execute(
                    text(
                        "ALTER TABLE alerts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"
                    )
                )
                conn.commit()
                print("[DB Migration] Added 'user_id' column to 'alerts' table.")
            except Exception as e:
                print(f"[DB Migration Warning] Could not alter alerts table for user_id: {e}")

        # 5. Create indices for foreign keys and queries
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_persons_user_id ON persons (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_detection_history_user_id ON detection_history (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_user_id ON alerts (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_person_id ON alerts (person_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_detection_id ON alerts (detection_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_detection_history_person_id ON detection_history (person_id);"))
            conn.commit()
        except Exception as e:
            print(f"[DB Migration Warning] Could not create indices: {e}")

        # 6. Backfill alerts.person_id from detection_history where possible
        try:
            conn.execute(
                text(
                    """
                    UPDATE alerts
                    SET person_id = (
                        SELECT detection_history.person_id
                        FROM detection_history
                        WHERE detection_history.id = alerts.detection_id
                    )
                    WHERE alerts.detection_id IS NOT NULL AND alerts.person_id IS NULL;
                    """
                )
            )
            conn.commit()
        except Exception as e:
            print(f"[DB Migration Warning] Could not backfill alerts.person_id: {e}")

        # 7. Backfill user_id from first user for existing records
        try:
            conn.execute(
                text(
                    """
                    UPDATE persons
                    SET user_id = (SELECT id FROM users LIMIT 1)
                    WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users);
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE detection_history
                    SET user_id = (SELECT id FROM users LIMIT 1)
                    WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users);
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE alerts
                    SET user_id = (SELECT id FROM users LIMIT 1)
                    WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users);
                    """
                )
            )
            conn.commit()
        except Exception as e:
            print(f"[DB Migration Warning] Could not backfill user_id: {e}")



def init_db() -> None:
    """Initialize database tables, run migrations, and seed ready-to-use initial data."""
    # Import models so Base metadata is populated
    import app.models.user  # noqa: F401
    import app.models.person  # noqa: F401
    import app.models.detection  # noqa: F401
    import app.models.alert  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Run safe SQLite migrations (add missing columns/indices & backfill)
    try:
        run_sqlite_migrations()
    except Exception as e:
        print(f"[DB] Migration notice: {e}")

    # Seed initial data
    db = SessionLocal()
    try:
        seed_initial_data(db)
    except Exception as e:
        print(f"[DB] Warning during seeding: {e}")
        db.rollback()
    finally:
        db.close()

