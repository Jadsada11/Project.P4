# Vigil — Web IoT Face Recognition & Person Classification System

> ระบบรักษาความปลอดภัยและจดจำใบหน้าอัจฉริยะ เชื่อมต่อระบบ IoT (ESP32-S3 AI Camera) และ AI Model (YOLOv8 + MobileNetV3) พร้อมจำแนกบุคคล 3 กลุ่ม: **คนในบ้าน** • **คนส่งของ** • **คนแปลกหน้า**

---

## สารบัญเอกสาร (Documentation Hub)

- 🤖 **[AGENTS.md](AGENTS.md)**: **Entry Point หลักสำหรับ AI Coding Assistants** (System map, rules, invariants, and symbols)
- 🏛️ **[docs/architecture.md](docs/architecture.md)**: สถาปัตยกรรมระบบรวม, การจำแนกบุคคล 3 กลุ่ม, Data Flow & Tech Stack
- ⚙️ **[docs/backend-api.md](docs/backend-api.md)**: สเปก REST API ทั้งหมด, โครงสร้างฐานข้อมูล SQLite 4 ตาราง, และความปลอดภัย
- 🧠 **[docs/ai-vision.md](docs/ai-vision.md)**: Two-Stage Hybrid AI Pipeline (YOLOv8 + MobileNetV3 576-dim L2 Metric Learning)
- 💻 **[docs/frontend.md](docs/frontend.md)**: สถาปัตยกรรม React 19, สเปกทั้ง 7 หน้าจอ, ระบบตรวจจับต่อเนื่อง และระบบเสียง
- 📡 **[docs/hardware-iot.md](docs/hardware-iot.md)**: คู่มือฮาร์ดแวร์ ESP32-S3 (OV3660), โค้ด Arduino และการแก้ปัญหา Stream Lock

> ⚠️ **ข้อตกลงการบำรุงรักษาเอกสาร:** หากมีการแก้ไข ปรับปรุง หรือเพิ่มฟีเจอร์ในไฟล์โค้ดใด ๆ ของโปรเจกต์ จะต้องเขียนและอัปเดตรายละเอียดลงในเอกสารโฟลเดอร์ `docs/` ตามหมวดหมู่ที่เกี่ยวข้องเสมอ (ตามกฎที่กำหนดไว้ใน [AGENTS.md](AGENTS.md))

---

## โครงสร้างระบบ (System Structure)

```text
web-iot/
├── AGENTS.md                 # AI Assistants Entry Point
├── README.md                 # Human-facing overview & quickstart
├── docs/                     # Full technical documentation suite
├── backend/                  # FastAPI + YOLOv8 + SQLite (vigil.db)
├── frontend/                 # React 19 + Tailwind CSS v4 Dashboard
└── esp32_camera_capture/     # Arduino C++ firmware for ESP32-S3 OV3660
```

---

## วิธีเปิดใช้งานระบบ (Quick Start)

### 1. เปิดเซิร์ฟเวอร์ Backend (FastAPI + YOLO + SQLite)
```bash
cd backend
python run.py
```
- Base URL: `http://localhost:8000`
- Interactive API Docs (Swagger UI): `http://localhost:8000/docs`

### 2. เปิดใช้งาน Frontend Dashboard (React 19)
```bash
cd frontend
cmd.exe /c "npm run dev"
```
- เปิดหน้าเว็บที่: `http://localhost:5173`

### 3. เปิดใช้งานกล้อง ESP32-S3 AI Camera
- เปิดไฟล์ `esp32_camera_capture/esp32_camera_capture.ino` ใน Arduino IDE
- ตั้งค่าบอร์ด: `ESP32S3 Dev Module`, PSRAM: `OPI PSRAM`
- ใส่ชื่อและรหัสผ่าน Wi-Fi แล้วกด Upload
- สตรีมภาพสดจะทำงานที่: `http://<ESP32_IP>/stream`

---

## การจำแนกบุคคล 3 กลุ่ม (3 Classification Categories)
1. 🟢 **คนในบ้าน (`household`):** สมาชิกในบ้านที่ผ่านการเทรนใบหน้าแล้ว (ความมั่นใจ $\ge 0.58$)
2. 🟡 **คนส่งของ (`delivery`):** เจ้าหน้าที่ขนส่งพัสดุ ไรเดอร์ หรือผู้ส่งของประจำ
3. 🔴 **คนแปลกหน้า (`stranger`):** บุคคลที่ไม่ตรงกับฐานข้อมูลใบหน้าและไม่มีเครื่องแบบขนส่ง **สร้างการแจ้งเตือนความปลอดภัยทันที**