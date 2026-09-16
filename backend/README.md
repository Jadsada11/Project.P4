# Vigil Backend — FastAPI & AI Inference Server

ระบบหลังบ้านสำหรับ Vigil Smart Security พัฒนาด้วย **FastAPI**, **SQLAlchemy 2.0 (SQLite)**, **Ultralytics YOLOv8**, และ **MobileNetV3 576-dim L2 Metric Learning**

---

## เอกสารเชิงลึก (Full Documentation)

- 📘 **[Backend API & Database Schema](../docs/backend-api.md)**: สเปก REST API ทุกเส้นทาง, โครงสร้าง 4 ตารางฐานข้อมูล, และความปลอดภัย
- 🧠 **[AI & Vision Pipeline](../docs/ai-vision.md)**: รายละเอียดโมเดล YOLO, Metric Learning และระบบเทรนใบหน้า
- 🏛️ **[System Architecture](../docs/architecture.md)**: สถาปัตยกรรมระบบรวมและการจำแนก 3 กลุ่มบุคคล
- 🤖 **[AGENTS.md](../AGENTS.md)**: กฎและคำแนะนำสำหรับ AI Coding Assistants

> 💡 **หมายเหตุสำคัญ:** หากมีการแก้ไขโค้ด, โมเดลฐานข้อมูล หรือเส้นทาง API ใด ๆ ใน `backend/` จะต้องอัปเดตเอกสารใน [../docs/backend-api.md](../docs/backend-api.md) ให้สอดคล้องกันเสมอ

---

## ข้อกำหนดเบื้องต้นและการติดตั้ง (Setup & Run)

### 1. ติดตั้ง Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. ตั้งค่าตัวแปรสภาพแวดล้อม (`.env`)
คัดลอกไฟล์แม่แบบ `.env.example` เป็น `.env`:
```bash
copy .env.example .env
```

### 3. เริ่มต้นรันเซิร์ฟเวอร์
```bash
python run.py
```
หรือใช้ uvicorn:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Swagger UI (Interactive API Docs):** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/health`

---

## โครงสร้างไดเรกทอรี `backend/`

```text
backend/
├── app/
│   ├── main.py                  # FastAPI Application & Lifespan
│   ├── core/                    # config.py, database.py, security.py
│   ├── models/                  # user.py, person.py, detection_history.py, alert.py
│   ├── schemas/                 # Pydantic Schemas
│   ├── services/                # yolo_service.py, face_embedding_service.py, person_classifier.py
│   └── api/v1/endpoints/        # auth.py, detection.py, alerts.py, persons.py
├── data/                        # vigil.db, face_embeddings.json, training_status.json
├── scratch/                     # สคริปต์สำหรับทดสอบระบบ
├── requirements.txt             # รายการ Dependencies
├── run.py                       # สคริปต์รันเซิร์ฟเวอร์
└── .env                         # ไฟล์ Configuration จริง
```
