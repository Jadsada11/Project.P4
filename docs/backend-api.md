# Vigil — Backend API & Database Documentation
สถาปัตยกรรม Backend, โครงสร้างฐานข้อมูล SQLite และข้อมูลจำเพาะ REST API ทั้งหมด

---

## 1. ภาพรวมสถาปัตยกรรม Backend (Architecture Overview)

ระบบ Backend พัฒนาด้วย **FastAPI** และออกแบบตามหลัก **Modular Layered Architecture** เพื่อแยกหน้าที่ของแต่ละชั้นอย่างชัดเจน:

```text
backend/
├── app/
│   ├── main.py                  # จุดเริ่มต้น FastAPI app, Middleware CORS, Lifespan Init DB, รวม Router
│   ├── core/                    # การตั้งค่าระบบ, ความปลอดภัย และการเชื่อมต่อฐานข้อมูล
│   │   ├── config.py            # Pydantic Settings โหลดค่าจาก .env
│   │   ├── security.py          # Hashing (Bcrypt) และเข้ารหัส/ถอดรหัส JWT (PyJWT)
│   │   └── database.py          # กำหนด SQLite Engine, SessionLocal และ init_db() (Auto-seeding)
│   ├── models/                  # SQLAlchemy ORM Models (4 ตารางหลัก)
│   │   ├── user.py              # ตาราง users (ระบบ Auth)
│   │   ├── person.py            # ตาราง persons (ข้อมูลบุคคลและหมวดหมู่)
│   │   ├── detection_history.py # ตาราง detection_history (ประวัติการตรวจจับ)
│   │   └── alert.py             # ตาราง alerts (รายการแจ้งเตือนความปลอดภัย)
│   ├── schemas/                 # Pydantic Schemas สำหรับ Request/Response Validation
│   │   ├── user.py              # UserCreate, UserLogin, UserResponse
│   │   ├── token.py             # Token, TokenPayload
│   │   ├── person.py            # PersonCreate, PersonUpdate, PersonResponse
│   │   ├── detection.py         # DetectionRequest, DetectionResponse
│   │   └── alert.py             # AlertResponse, AlertUpdate
│   ├── services/                # Business Logic & AI Engines
│   │   ├── yolo_service.py      # Ultralytics YOLOv8 Inference
│   │   ├── face_embedding_service.py # MobileNetV3 576-dim L2 Metric Extractor
│   │   ├── person_classifier.py # จำแนก 3 กลุ่มบุคคลและสร้าง Event Alert
│   │   └── email_service.py     # ระบบส่งอีเมลแจ้งเตือนผ่าน Gmail SMTP (Non-blocking Threading)
│   └── api/                     # เส้นทาง API (Endpoints & Dependency Injection)
│       ├── deps.py              # Dependencies: get_db, get_current_user, get_current_active_user
│       └── v1/
│           ├── api.py           # รวม Router ทั้งหมดของ API v1
│           └── endpoints/
│               ├── auth.py      # /auth (signup, login, me)
│               ├── detection.py # /detection (detect-esp32, detect-image, history, stats, identify)
│               ├── alerts.py    # /alerts (list, unread-count, read, delete, clear)
│               └── persons.py   # /persons (CRUD, train, retrain, model-status)
├── data/                        # โฟลเดอร์เก็บฐานข้อมูลและไฟล์มีเดีย
│   ├── vigil.db                 # SQLite Database
│   ├── face_embeddings.json     # ฐานข้อมูลเวกเตอร์ 576 มิติที่เทรนไว้
│   ├── training_status.json     # สถิติและ Log การเทรน AI แบบเรียลไทม์
│   ├── datasets/                # รูปภาพใบหน้าแยกตาม person_<id>/
│   └── snapshots/               # รูปภาพ Snapshot จากเหตุการณ์ตรวจจับ
├── requirements.txt             # Python Dependencies
├── run.py                       # สคริปต์เปิดเซิร์ฟเวอร์รวดเร็ว
└── .env                         # ค่าคอนฟิกูเรชันของระบบ
```

---

## 2. โครงสร้างฐานข้อมูล SQLite (Database Schema)

ฐานข้อมูลจัดเก็บอยู่ที่ `backend/data/vigil.db` พร้อมระบบ **Auto-seeding** สร้างตารางและข้อมูลตัวอย่างอัตโนมัติเมื่อรันระบบครั้งแรก

### 2.1 ตาราง `users` (เจ้าหน้าที่และผู้ดูแลระบบ)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment | รหัสประจำตัวผู้ใช้งาน |
| `email` | `VARCHAR` | Unique, Indexed, Not Null | อีเมลสำหรับเข้าสู่ระบบ |
| `full_name` | `VARCHAR` | Not Null | ชื่อ-นามสกุล หรือยศ/ตำแหน่ง |
| `hashed_password` | `VARCHAR` | Not Null | รหัสผ่านที่แฮชด้วย Bcrypt |
| `role` | `VARCHAR` | Not Null, Default: `'Operator'` | บทบาทผู้ใช้งาน (`Operator`, `Admin`) |
| `is_active` | `BOOLEAN` | Not Null, Default: `True` | สถานะเปิด/ปิดการใช้งานบัญชี |
| `created_at` | `DATETIME` | Not Null, Default: `UTC Now` | วันเวลาที่สร้างบัญชี |
| `updated_at` | `DATETIME` | Not Null, Default: `UTC Now` | วันเวลาที่แก้ไขล่าสุด |

### 2.2 ตาราง `persons` (ฐานข้อมูลบุคคลที่ลงทะเบียน)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment | รหัสบุคคล |
| `user_id` | `INTEGER` | Foreign Key (`users.id` ON DELETE SET NULL), Indexed, Nullable | รหัสผู้ใช้เจ้าหน้าที่ที่สร้างข้อมูล (`fk_person_user`) |
| `name` | `VARCHAR` | Not Null | ชื่อ-นามสกุล บุคคล |
| `category` | `VARCHAR` | Indexed, Not Null | หมวดหมู่: `household`, `neighbor`, `friend`, `delivery`, `other`, `stranger` |
| `role` | `VARCHAR` | Nullable | บทบาท เช่น Family, Neighbor, Friend, Delivery, Guest, Stranger |
| `department` | `VARCHAR` | Nullable | แผนกหรือความสัมพันธ์ (เช่น ครอบครัว, เพื่อนบ้าน, เพื่อน, ขนส่ง) |
| `notes` | `TEXT` | Nullable | หมายเหตุเพิ่มเติมและข้อมูลความปลอดภัย |
| `photo_url` | `VARCHAR` | Nullable | ลิงก์รูปถ่ายโปรไฟล์หลัก |
| `face_embedding` | `TEXT` | Nullable | JSON-encoded 576-dim feature vector |
| `accuracy` | `FLOAT` | Default: `98.5` | ค่าความแม่นยำของใบหน้า (%) |
| `images_count` | `INTEGER` | Default: `1` | จำนวนรูปภาพในชุด Dataset |
| `is_active` | `BOOLEAN` | Default: `True` | สถานะเปิดใช้งาน |
| `created_at` | `DATETIME` | Default: `UTC Now` | วันเวลาที่ลงทะเบียน |
| `updated_at` | `DATETIME` | Default: `UTC Now` | วันเวลาที่แก้ไขล่าสุด |

### 2.3 ตาราง `detection_history` (ประวัติการตรวจจับ)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment | รหัสประวัติการตรวจจับ |
| `person_id` | `INTEGER` | Foreign Key (`persons.id` ON DELETE SET NULL), Indexed, Nullable | เชื่อมโยงกับบุคคลที่ระบุตัวตนได้ (`fk_detection_person`) |
| `user_id` | `INTEGER` | Foreign Key (`users.id` ON DELETE SET NULL), Indexed, Nullable | รหัสผู้ใช้งานระบบ (`fk_detection_user`) |
| `person_name` | `VARCHAR` | Not Null | ชื่อบุคคลที่ตรวจพบ |
| `category` | `VARCHAR` | Indexed, Not Null | `household`, `neighbor`, `friend`, `delivery`, `other`, หรือ `stranger` |
| `confidence` | `FLOAT` | Not Null | ค่าความมั่นใจในการจำแนก (%) |
| `bounding_box` | `TEXT` | Nullable | พิกัดกรอบ JSON `[x1, y1, x2, y2]` |
| `snapshot_path`| `VARCHAR` | Nullable | พาธไฟล์ภาพ Snapshot ที่บันทึกไว้ |
| `camera_id` | `VARCHAR` | Default: `'ESP32-CAM'` | รหัสกล้องที่ตรวจจับ |
| `location` | `VARCHAR` | Default: `'Main Entrance'` | ตำแหน่งเกิดเหตุ |
| `alert_triggered`| `BOOLEAN`| Default: `False` | มีการสร้างการแจ้งเตือนจากเหตุการณ์นี้หรือไม่ |
| `timestamp` | `DATETIME` | Indexed, Default: `UTC Now` | เวลาที่ตรวจพบ |

### 2.4 ตาราง `alerts` (รายการแจ้งเตือนความปลอดภัย)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment | รหัสการแจ้งเตือน |
| `title` | `VARCHAR` | Not Null | หัวข้อการแจ้งเตือน |
| `description` | `TEXT` | Not Null | รายละเอียดเหตุการณ์ |
| `category` | `VARCHAR` | Indexed, Not Null | `household`, `neighbor`, `friend`, `delivery`, `other`, หรือ `stranger` |
| `severity` | `VARCHAR` | Not Null | ระดับความรุนแรง: `info`, `warning`, `critical` |
| `location` | `VARCHAR` | Default: `'Main Entrance'` | ตำแหน่งที่เกิดเหตุ |
| `detection_id`| `INTEGER` | Foreign Key (`detection_history.id` ON DELETE SET NULL), Indexed, Nullable | เชื่อมโยงกับประวัติการตรวจจับ (`fk_alert_detection`) |
| `person_id` | `INTEGER` | Foreign Key (`persons.id` ON DELETE SET NULL), Indexed, Nullable | เชื่อมโยงโดยตรงกับบุคคลที่ลงทะเบียนหรือระบุตัวตนได้ |
| `user_id` | `INTEGER` | Foreign Key (`users.id` ON DELETE SET NULL), Indexed, Nullable | รหัสผู้ใช้งานระบบ (`fk_alert_user`) |
| `thumbnail` | `VARCHAR` | Nullable | ภาพ Snapshot ตัวอย่าง |
| `is_read` | `BOOLEAN` | Indexed, Default: `False` | สถานะเปิดอ่านแล้ว |
| `created_at` | `DATETIME` | Indexed, Default: `UTC Now` | เวลาที่สร้างแจ้งเตือน |

---

## 3. ความสัมพันธ์และการรักษาระเบียบข้อมูล (Database Relationships & Foreign Key Safety)

ระบบฐานข้อมูลออกแบบให้เชื่อมโยงความสัมพันธ์ตรงตามแผนภาพสถาปัตยกรรม (Entity-Relationship Diagram):

```text
                           ┌─────────────────────────┐
                           │          users          │
                           └────────────┬────────────┘
         ┌──────────────────────────────┼──────────────────────────────┐
         │ 1:N (fk_person_user)         │ 1:N (fk_detection_user)      │ 1:N (fk_alert_user)
         ▼                              ▼                              ▼
  ┌──────────────┐         1:N          ┌─────────────────────┐        │
  │   persons    │─────────────────────▶│  detection_history  │        │
  └──────┬───────┘ (fk_detection_person)└──────────┬──────────┘        │
         │                                          │                  │
         │ 1:N                                      │ 1:N              │
         ▼                                          ▼                  ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                                   alerts                                   │
  │                         (fk_alert_detection)                               │
  └────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 การเชื่อมโยงความสัมพันธ์ในระดับ ORM (SQLAlchemy 2.0)
1. **`User` ↔ `Person` (1-to-Many):**
   - `User.persons`: รายการบุคคลที่สร้าง/กำกับดูแลโดยผู้ใช้งานนี้
   - `Person.user`: ผู้ใช้งานระบบเจ้าของข้อมูล (`ForeignKey("users.id", name="fk_person_user")`)
2. **`User` ↔ `DetectionHistory` (1-to-Many):**
   - `User.detections`: รายการประวัติการตรวจจับในระบบที่ผูกกับบัญชีผู้ใช้
   - `DetectionHistory.user`: ผู้ใช้งานระบบ (`ForeignKey("users.id", name="fk_detection_user")`)
3. **`User` ↔ `Alert` (1-to-Many):**
   - `User.alerts`: รายการแจ้งเตือนความปลอดภัยในระบบของผู้ใช้งาน
   - `Alert.user`: ผู้ใช้งานระบบ (`ForeignKey("users.id", name="fk_alert_user")`)
4. **`Person` ↔ `DetectionHistory` (1-to-Many):**
   - `Person.detections`: ประวัติการตรวจจับทั้งหมดของบุคคลนั้น
   - `DetectionHistory.person`: บุคคลที่ตรงกับผลการตรวจจับ (`ForeignKey("persons.id", name="fk_detection_person")`)
5. **`DetectionHistory` ↔ `Alert` (1-to-Many):**
   - `DetectionHistory.alerts`: รายการแจ้งเตือนที่เกิดจากเฟรมตรวจจับนั้น
   - `Alert.detection`: เหตุการณ์ตรวจจับต้นทาง (`ForeignKey("detection_history.id", name="fk_alert_detection")`)
6. **`Person` ↔ `Alert` (1-to-Many):**
   - `Person.alerts`: รายการแจ้งเตือนทั้งหมดของบุคคลนั้นโดยตรง
   - `Alert.person`: บุคคลเจ้าของการแจ้งเตือน (`ForeignKey("persons.id")`)

### 3.2 การบังคับใช้ Foreign Keys ใน SQLite (`PRAGMA foreign_keys = ON`)
- SQLite เริ่มต้นโดยปิดการตรวจสอบ Foreign Keys ไว้ ระบบจึงเชื่อมต่อผ่าน SQLAlchemy Event Listener:
  ```python
  @event.listens_for(Engine, "connect")
  def set_sqlite_pragma(dbapi_connection, connection_record):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA foreign_keys=ON")
      cursor.close()
  ```
- ทำให้คำสั่ง `ON DELETE SET NULL` ทำงานจริงใน SQLite ป้องกันการเกิด Orphan Foreign Key

### 3.3 กลไกความปลอดภัยเมื่อลบข้อมูล (Deletion FK Safety)
- **เมื่อลบประวัติการตรวจจับ (`DetectionHistory`):** ปลด `alerts.detection_id = None` ก่อน เพื่อคงข้อมูลประวัติแจ้งเตือนไว้โดยไม่มี Broken Reference
- **เมื่อลบบุคคล (`Person`):** ปลด `detection_history.person_id = None` และ `alerts.person_id = None` ก่อน เพื่อคงประวัติการตรวจจับและภาพ Snapshot ไว้ในระบบ



---

## 4. ข้อมูลจำเพาะ API Endpoints ทั้งหมด (RESTful API Specification)

Base URL: `http://localhost:8000/api/v1`  
Interactive Swagger UI: `http://localhost:8000/docs`

### 4.1 ระบบยืนยันตัวตน (Authentication)

#### Health Check
- `GET /health`
- Response `200 OK`: `{"status": "healthy"}`

#### สมัครสมาชิกเจ้าหน้าที่ (Signup)
- `POST /api/v1/auth/signup`
- Request Body:
  ```json
  {
    "email": "officer@vigil.io",
    "full_name": "Officer Somchai",
    "password": "SecurePassword123!",
    "role": "Operator"
  }
  ```
- Response `201 Created`: ข้อมูลผู้ใช้ที่สร้างขึ้น (ไม่รวมรหัสผ่าน)

#### เข้าสู่ระบบ (Login)
- `POST /api/v1/auth/login`
- Request Body: `{"email": "officer@vigil.io", "password": "SecurePassword123!"}`
- Response `200 OK`:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": { "id": 1, "email": "officer@vigil.io", "full_name": "Officer Somchai", "role": "Operator" }
  }
  ```

#### ดึงโปรไฟล์ผู้ใช้ปัจจุบัน (Current User Profile)
- `GET /api/v1/auth/me`
- Header: `Authorization: Bearer <token>`
- Response `200 OK`: ข้อมูลผู้ใช้ปัจจุบัน

---

### 4.2 ระบบตรวจจับและประวัติ (Detection & History)

#### ตรวจจับภาพสดจาก ESP32-CAM (Backend Frame Grab & Proxy)
- `POST /api/v1/detection/detect-esp32`
- Request Body:
  ```json
  {
    "camera_ip": "192.168.137.65",
    "camera_port": "",
    "camera_path": "/capture",
    "location": "Main Entrance"
  }
  ```
- **พฤติกรรมและความทนทาน (Resilience):**
  - กรองและตัดพอร์ต `8000` หรือ `80` ออกอัตโนมัติ (`port_str = ""`) ป้องกันการส่งพอร์ตของ FastAPI กลับไปหา ESP32
  - พยายามดึงเฟรมจาก `http://{ip}/capture` (Timeout 1.5 วินาที พร้อม `Connection: close`)
  - หาก `/capture` ไม่สำเร็จ จะพยายามดึงเฟรมแรกจาก MJPEG stream `http://{ip}/stream` (Timeout 2.5 วินาที)
  - หากกล้องปิดอยู่ ไม่ตอบสนอง หรือติดขัด ระบบจะไม่ระเบิด HTTP 500 แต่จะตอบกลับ `200 OK` พร้อม `{"success": false, "detections_count": 0, "detections": []}` เพื่อให้ฝั่ง Frontend ทำงานต่อเนื่องได้อย่างราบรื่น
- Response `200 OK`: ผลการตรวจจับ รายชื่อบุคคล ค่าความมั่นใจ และการสร้าง Alert

#### ถ่ายทอดสตรีมสด MJPEG ผ่านเซิร์ฟเวอร์ (Backend Stream Proxy)
- `GET /api/v1/detection/esp32-stream`
- Query Params: `camera_ip` (string, default: `192.168.137.65`), `camera_port` (string, optional - ป้องกัน port 8000 อัตโนมัติ)
- Headers: แนบ `Access-Control-Allow-Origin: *` และ `Access-Control-Allow-Private-Network: true`
- Media Type: `multipart/x-mixed-replace; boundary=123456789000000000000987654321`
- **RFC 2046 Compliance**: ส่ง `b"--123456789000000000000987654321\r\n"` ก่อนเฟรมแรก เพื่อให้ตัวถอดรหัสภาพของเบราว์เซอร์ซิงก์เฟรมได้ทันทีโดยไม่ดรอปเฟรมแรก
- ประโยชน์: แก้ปัญหา Chrome / Edge บล็อก Private Network Access และ CORS จาก Frontend ไปยังบอร์ด ESP32 ได้ 100%

#### ดึงภาพ Snapshot ผ่าน Backend Proxy
- `GET /api/v1/detection/esp32-snapshot`
- Query Params: `camera_ip`, `camera_port` (กรองพอร์ต 8000 อัตโนมัติ), `camera_path`
- Response `200 OK`: Binary image JPEG พร้อม Fallback อัตโนมัติหากกล้องไม่ตอบสนอง

#### ตรวจจับจากไฟล์ภาพ / Canvas Frame / Webcam
- `POST /api/v1/detection/detect-image`
- Content-Type: `multipart/form-data`
- Fields: `file` (binary image JPEG/PNG จาก ESP32 Canvas หรือ Webcam Video Element), `camera_id`, `location`
- Response `200 OK`: ผลการตรวจจับบุคคลและพิกัดกรอบ Bounding Box

#### สรุปสถิติประจำวัน (Daily Stats)
- `GET /api/v1/detection/stats`
- Response `200 OK`:
  ```json
  {
    "total_today": 15,
    "household_count": 8,
    "delivery_count": 4,
    "stranger_count": 3,
    "neighbor_count": 2,
    "friend_count": 1,
    "other_count": 0,
    "alerts_count": 7
  }
  ```

#### ดึงประวัติการตรวจจับ (Detection History List)
- `GET /api/v1/detection/history`
- Query Params: `category` (`household`, `neighbor`, `friend`, `delivery`, `other`, `stranger`, `ALL`), `limit` (int), `offset` (int)
- Response `200 OK`: รายการประวัติเรียงจากล่าสุด

#### ลบประวัติการตรวจจับเฉพาะรายการ (Single Delete with FK Safety)
- `DELETE /api/v1/detection/history/{history_id}`
- Response `204 No Content` (เมื่อลบสำเร็จ)

#### ล้างประวัติการตรวจจับทั้งหมด (Clear History)
- `DELETE /api/v1/detection/history`
- Query Params: `category` (optional)
- Response `200 OK`: `{"message": "ลบประวัติการตรวจจับสำเร็จ 12 รายการ", "deleted_count": 12}`

#### ระบุตัวตนคนแปลกหน้าและเทรนโมเดล (Identify & Train)
- `PUT /api/v1/detection/history/{history_id}/identify`
- Request Body:
  ```json
  {
    "person_id": 1,
    "name": "นายสมชาย (เพิ่มเติม)",
    "category": "household"
  }
  ```
- Response `200 OK`: อัปเดตประวัติและนำภาพ Snapshot เข้าสู่คลังเวกเตอร์ทันที

---

### 4.3 ระบบแจ้งเตือนความปลอดภัย (Security Alerts)

#### ดึงรายการแจ้งเตือน (Alerts List)
- `GET /api/v1/alerts`
- Query Params: `category` (optional), `unread_only` (bool, default `false`)
- Response `200 OK`: รายการการแจ้งเตือนทั้งหมด

#### ดึงจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน (Unread Count)
- `GET /api/v1/alerts/unread-count`
- Response `200 OK`: `{"unread_count": 3}`

#### สลับสถานะอ่านแล้วของรายการเดี่ยว
- `PUT /api/v1/alerts/{alert_id}/read`
- Response `200 OK`: เรคอร์ดแจ้งเตือนที่อัปเดตแล้ว

#### ทำเครื่องหมายอ่านแล้วทั้งหมด
- `PUT /api/v1/alerts/read-all`
- Response `200 OK`: `{"message": "Marked all alerts as read"}`

#### ลบการแจ้งเตือนเฉพาะรายการ (Single Delete)
- `DELETE /api/v1/alerts/{alert_id}`
- Response `204 No Content`

#### ล้างการแจ้งเตือนทั้งหมดหรือตามเงื่อนไข (Clear Alerts)
- `DELETE /api/v1/alerts`
- Query Params: `category` (optional), `read_only` (bool, optional), `unread_only` (bool, optional)
- Response `200 OK`: `{"message": "ลบการแจ้งเตือนสำเร็จ 5 รายการ", "deleted_count": 5, "count": 5}`

#### ทดสอบส่งอีเมลแจ้งเตือนผ่าน Gmail SMTP (Test Email)
- `POST /api/v1/alerts/test-email`
- Query Params: `recipient` (optional - หากไม่ระบุจะใช้ `NOTIFICATION_RECIPIENT_EMAIL` จาก `.env`)
- Response `200 OK`:
  ```json
  {
    "success": true,
    "message": "ส่งอีเมลทดสอบไปยัง thanakornnillamai@gmail.com สำเร็จเรียบร้อยแล้ว!",
    "recipient": "thanakornnillamai@gmail.com"
  }
  ```

#### ระบบแจ้งเตือนทางอีเมลอัตโนมัติ (Automated Email Alerts) & การหน่วงเวลาแจ้งเตือน (3-Minute Cooldown)
- **ทริกเกอร์:** ทำงานอัตโนมัติเฉพาะเมื่อ `person_classifier.py` ตรวจพบคนแปลกหน้า (`stranger`) เท่านั้น (ไม่ส่งอีเมลสำหรับคนในบ้าน, คนส่งของ, เพื่อนบ้าน, หรือคนรู้จัก)
- **สถาปัตยกรรม:** ส่งผ่าน Non-blocking Background Thread (`email_service.py`) เพื่อไม่ให้หน่วงลูป YOLO Inference
- **การแนบรูปภาพ:** แนบภาพถ่ายสแนปช็อตแบบ Inline Attachment (CID Image) เพื่อให้เปิดดูภาพใบหน้าคนแปลกหน้าได้ทันทีจากแอปอีเมลบนมือถือ
- **Anti-Spam Alert Cooldown (3 นาที / 180 วินาที):**
  - **บันทึก Snapshot ทุก 5 วินาที:** ระบบยังคงตรวจจับเฟรมและบันทึกประวัติการตรวจจับ (`detection_history`) พร้อมรูปภาพสแนปช็อต `.jpg` ในโฟลเดอร์ `/data/snapshots/` ทุก 5 วินาทีอย่างครบถ้วน
  - **จำกัดรอบการสร้าง Alert และส่งอีเมล:** จะบันทึกเรคคอร์ดลงตาราง `alerts` และส่งอีเมลแจ้งเตือนซ้ำสำหรับบุคคลแปลกหน้า **ทุกๆ 3 นาที (180 วินาที)** เท่านั้น เพื่อป้องกันการรบกวน (Spam) ขณะบุคคลยืนอยู่หน้ากล้องอย่างต่อเนื่อง


---

### 4.4 ฐานข้อมูลบุคคลและการเทรน AI (Persons & Face Training)

#### ดึงรายชื่อบุคคลทั้งหมด
- `GET /api/v1/persons`
- Query Params: `category`, `search`, `limit`, `offset`
- Response `200 OK`: รายการบุคคลและค่า Accuracy

#### ลงทะเบียนบุคคลใหม่พร้อมเทรนใบหน้าอัตโนมัติ
- `POST /api/v1/persons`
- Request Body:
  ```json
  {
    "name": "วิศวกร ธนพล",
    "category": "household",
    "role": "Family",
    "department": "Residence",
    "notes": "สิทธิ์เข้าถึงชั้น 1-2",
    "dataset_images": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."]
  }
  ```
- Response `201 Created`: บุคคลที่บันทึกสำเร็จพร้อมจำนวนตัวอย่างภาพและเวกเตอร์ที่สกัดได้

#### แก้ไขข้อมูลบุคคล
- `PUT /api/v1/persons/{person_id}`
- Request Body: ฟิลด์ที่ต้องการแก้ไข
- Response `200 OK`: บุคคลที่ได้รับการแก้ไข

#### ลบบุคคลออกจากระบบ (Full Purge)
- `DELETE /api/v1/persons/{person_id}`
- พฤติกรรม: ลบข้อมูลใน SQLite, ลบโฟลเดอร์ภาพใน `backend/data/datasets/person_<id>/`, และลบเวกเตอร์ใน `face_embeddings.json`
- Response `200 OK`: `{"message": "Person deleted successfully"}`

#### ตรวจสอบสถานะโมเดลและ Log การเทรน
- `GET /api/v1/persons/model-status`
- Response `200 OK`:
  ```json
  {
    "status": "ready",
    "model_name": "MobileNetV3 + Cosine Metric Learning",
    "last_trained": "2026-09-07T14:17:18.123456+00:00",
    "total_persons": 10,
    "total_samples": 15,
    "average_accuracy": 99.4,
    "inference_speed_ms": 13.8,
    "logs": [
      "[TRAINED] Person 1 trained successfully",
      "[CENTROID] Normalized 10 vectors into L2 space"
    ]
  }
  ```

#### สั่ง Re-train และ Re-index เวกเตอร์ทุกคนในระบบแบบ Real-time
- `POST /api/v1/persons/train` หรือ `POST /api/v1/persons/retrain`
- Response `200 OK`: ผลการเทรนใหม่ ค่าความแม่นยำเฉลี่ย และเวลาที่ใช้ (Elapsed ms)

---

## 5. การติดตั้งและการรัน Backend (Setup & Execution)

### 5.1 ข้อกำหนดและ Environment (`.env`)
ไฟล์ `.env` ที่จำเป็น:
```env
PROJECT_NAME="Vigil AI Security Backend"
API_V1_STR="/api/v1"
SECRET_KEY="vigil_security_super_secret_jwt_key_at_least_32_bytes_long_2026"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL="sqlite:///./data/vigil.db"
BACKEND_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
```

### 5.2 คำสั่งเปิดเซิร์ฟเวอร์
```bash
cd backend
python run.py
```
หรือใช้ uvicorn โดยตรง:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. ตัวอย่างคำสั่งทดสอบผ่าน cURL (cURL Testing)

```bash
# 1. Health Check
curl http://localhost:8000/health

# 2. ดูสถิติการตรวจจับประจำวัน
curl http://localhost:8000/api/v1/detection/stats

# 3. ลบการแจ้งเตือนเฉพาะที่อ่านแล้ว
curl -X DELETE "http://localhost:8000/api/v1/alerts?read_only=true"

# 4. ลบประวัติการตรวจจับ ID 5
curl -X DELETE "http://localhost:8000/api/v1/detection/history/5"

# 5. สั่ง Re-train เวกเตอร์โมเดล AI
curl -X POST "http://localhost:8000/api/v1/persons/train"
```
