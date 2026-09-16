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
│   │   └── person_classifier.py # จำแนก 3 กลุ่มบุคคลและสร้าง Event Alert
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
| `name` | `VARCHAR` | Not Null | ชื่อ-นามสกุล บุคคล |
| `category` | `VARCHAR` | Indexed, Not Null | หมวดหมู่: `household`, `delivery`, `stranger` |
| `role` | `VARCHAR` | Nullable | บทบาท เช่น Family, Delivery, VIP |
| `department` | `VARCHAR` | Nullable | แผนกหรือบริษัทขนส่ง (เช่น Flash, Kerry, Residence) |
| `notes` | `TEXT` | Nullable | หมายเหตุเพิ่มเติมและข้อมูลความปลอดภัย |
| `photo_url` | `VARCHAR` | Nullable | ลิงก์รูปถ่ายโปรไฟล์หลัก |
| `accuracy` | `FLOAT` | Default: `0.0` | ค่าความแม่นยำของใบหน้า (%) |
| `images_count` | `INTEGER` | Default: `0` | จำนวนรูปภาพในชุด Dataset |
| `is_active` | `BOOLEAN` | Default: `True` | สถานะเปิดใช้งาน |
| `created_at` | `DATETIME` | Default: `UTC Now` | วันเวลาที่ลงทะเบียน |
| `updated_at` | `DATETIME` | Default: `UTC Now` | วันเวลาที่แก้ไขล่าสุด |

### 2.3 ตาราง `detection_history` (ประวัติการตรวจจับ)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment | รหัสประวัติการตรวจจับ |
| `person_id` | `INTEGER` | Foreign Key (`persons.id`), Nullable | เชื่อมโยงกับบุคคลที่ระบุตัวตนได้ |
| `person_name` | `VARCHAR` | Not Null | ชื่อบุคคลที่ตรวจพบ |
| `category` | `VARCHAR` | Indexed, Not Null | `household`, `delivery`, หรือ `stranger` |
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
| `category` | `VARCHAR` | Indexed, Not Null | `household`, `delivery`, หรือ `stranger` |
| `severity` | `VARCHAR` | Not Null | ระดับความรุนแรง: `info`, `warning`, `critical` |
| `location` | `VARCHAR` | Default: `'Main Entrance'` | ตำแหน่งที่เกิดเหตุ |
| `detection_id`| `INTEGER` | Foreign Key (`detection_history.id`), Nullable | เชื่อมโยงกับประวัติการตรวจจับ |
| `thumbnail` | `VARCHAR` | Nullable | ภาพ Snapshot ตัวอย่าง |
| `is_read` | `BOOLEAN` | Indexed, Default: `False` | สถานะเปิดอ่านแล้ว |
| `created_at` | `DATETIME` | Indexed, Default: `UTC Now` | เวลาที่สร้างแจ้งเตือน |

---

## 3. กลไกความปลอดภัยของฐานข้อมูล (Database Integrity & FK Safety)

เมื่อทำการลบข้อมูลในตาราง `detection_history` ระบบ Backend มีกลไก **FK Safety** ในตัว:
- ค้นหาเรคอร์ดในตาราง `alerts` ที่มี `detection_id == history_id`
- ปลด Foreign Key โดยการอัปเดต `alerts.detection_id = None` ก่อนลบเรคอร์ดประวัติ
- ประโยชน์: ป้องกันข้อผิดพลาด `sqlite3.IntegrityError: FOREIGN KEY constraint failed` และคงประวัติการแจ้งเตือนไว้โดยไม่มี Broken Reference

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
  - พยายามดึงเฟรมจาก `http://{ip}/capture` (Timeout 1.5 วินาที)
  - หาก `/capture` ไม่สำเร็จ จะพยายามดึงจาก MJPEG stream `http://{ip}/stream` (Timeout 2.0 วินาที)
  - หากกล้องปิดอยู่ ไม่ตอบสนอง หรือติดขัด ระบบจะไม่ระเบิด HTTP 500 (`import os` safe) แต่จะตอบกลับ `200 OK` พร้อม `{"success": false, "message": "ESP32 Camera unreachable ...", "detections": []}` เพื่อให้ฝั่ง Frontend ทำงานต่อเนื่องได้อย่างราบรื่น
- Response `200 OK`: ผลการตรวจจับ รายชื่อบุคคล ค่าความมั่นใจ และการสร้าง Alert

#### ตรวจจับจากไฟล์ภาพ / Canvas Frame
- `POST /api/v1/detection/detect-image`
- Content-Type: `multipart/form-data`
- Fields: `file` (binary image JPEG/PNG), `camera_id`, `location`
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
    "alerts_count": 7
  }
  ```

#### ดึงประวัติการตรวจจับ (Detection History List)
- `GET /api/v1/detection/history`
- Query Params: `category` (`household`, `delivery`, `stranger`, `ALL`), `limit` (int), `offset` (int)
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
- Query Params: `category` (optional), `read_only` (bool, optional)
- Response `200 OK`: `{"message": "ลบการแจ้งเตือนสำเร็จ 5 รายการ", "deleted_count": 5}`

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
