# Vigil — System Architecture Documentation
ระบบตรวจจับและจดจำใบหน้าอัจฉริยะ (AI Smart Security & IoT Face Recognition System)

---

## 1. ภาพรวมระบบ (System Overview)

**Vigil** เป็นระบบรักษาความปลอดภัยอัจฉริยะที่เชื่อมต่ออุปกรณ์ **IoT (ESP32-S3 AI Camera)** เข้ากับสถาปัตยกรรม **Deep Learning AI (YOLOv8 + MobileNetV3 Metric Learning)** และเว็บแดชบอร์ด **React 19** แบบเรียลไทม์

ระบบได้รับการออกแบบให้จำแนกบุคคลที่เดินผ่านกล้องออกเป็น **3 กลุ่มบุคคล** พร้อมระบบแจ้งเตือนอัตโนมัติ การบันทึกประวัติเหตุการณ์ และการเทรนจดจำใบหน้าได้ทันทีจากหน้าเว็บ

```mermaid
flowchart TD
    subgraph IoT_Node ["1. IoT Node (Hardware)"]
        CAM["ESP32-S3 AI Camera (OV3660)\nDirect Stream / Capture API"]
    end

    subgraph Backend_Server ["2. FastAPI Backend Server"]
        YOLO["Stage 1: OpenCV YuNet Human Face Detection\n+ Landmark Geometric Anatomy Verification"]
        SPOOF["Anti-Animal & Anti-Photo Spoofing\n(Moiré FFT, Skin Chrominance, Animal Filter)"]
        EMBED["Stage 2: MobileNetV3 Feature Extractor\n(576-dim L2 Vector)"]
        MATCH{"Cosine Matching Engine\nThreshold >= 0.58"}
        CLASS["Person Classifier (3 Categories)"]
        ALERT["Alert Dispatcher & Event Hub"]
        EMAIL["Gmail SMTP Dispatcher\n(Non-blocking & Cooldown)"]
        DB[(SQLite: vigil.db\nUsers, Persons, History, Alerts)]
        VEC[(face_embeddings.json)]
    end

    subgraph External_Notify ["4. External Notifications"]
        MAILBOX["User Email Inbox\n(thanakornnillamai@gmail.com)\nInline Snapshot & Alert Info"]
    end

    subgraph Frontend_App ["3. Web Dashboard (React 19 + Tailwind v4)"]
        DASH["Live Monitoring & Camera Feed (/detection)"]
        HIST["Detection History & Audit Logs (/history)"]
        TRAIN["AI Model & Identity Registry (/training)"]
        ADD["Register & Dataset Upload (/add-person)"]
        ALERTP["Security Alerts (/alerts)"]
    end

    CAM -->|MJPEG / Snapshot JPEG| YOLO
    YOLO --> SPOOF --> EMBED
    EMBED --> MATCH

    VEC -.->|Embeddings| MATCH
    MATCH --> CLASS
    CLASS --> ALERT --> DB
    ALERT --> EMAIL --> MAILBOX
    CLASS --> DB
    DB <-->|REST API & Real-time Events| Frontend_App
```

---

## 2. การจำแนกบุคคล (The Classification Categories)

ระบบจัดการความปลอดภัยโดยแบ่งประเภทบุคคลออกเป็น 6 กลุ่ม เพื่อตอบสนองต่อระดับความสัมพันธ์และความเสี่ยงที่ต่างกัน:

| กลุ่มบุคคล | ป้ายกำกับ (Category) | สีประจำกลุ่ม (UI) | เกณฑ์การจำแนก | พฤติกรรมระบบและการแจ้งเตือน |
| :--- | :--- | :--- | :--- | :--- |
| **คนในบ้าน** | `household` | 🟢 เขียว (`#2e7d32`) | จับคู่กับสมาชิกในบ้านที่ลงทะเบียนไว้สำเร็จ (Cosine Similarity $\ge 0.70$) | • แสดงชื่อสมาชิกจริง<br>• ป้ายสถานะ: ปลอดภัย (`VERIFIED OK`)<br>• ไม่บันทึก Snapshot เพิ่มซ้ำ (ใช้รูปโปรไฟล์เดิม)<br>• แจ้งเตือนระดับ `info` ยินดีต้อนรับกลับบ้าน |
| **เพื่อนบ้าน** | `neighbor` | 🩵 ฟ้าคราม/ไซแอน (`#00838f`) | จับคู่กับบุคคลหมวดเพื่อนบ้านที่ลงทะเบียนไว้ ($\ge 0.70$) | • แสดงชื่อเพื่อนบ้านและบทบาท<br>• ป้ายสถานะ: ปลอดภัย (`VERIFIED OK`)<br>• ไม่บันทึก Snapshot เพิ่มซ้ำ<br>• แจ้งเตือนระดับ `info` พบเพื่อนบ้าน |
| **เพื่อน / แขก** | `friend` | 💜 ม่วง (`#7b1fa2`) | จับคู่กับบุคคลหมวดเพื่อนสนิท/ผู้มาเยือนที่ลงทะเบียนไว้ ($\ge 0.70$) | • แสดงชื่อเพื่อนและบทบาทที่บันทึกไว้<br>• ป้ายสถานะ: ปลอดภัย (`VERIFIED OK`)<br>• ไม่บันทึก Snapshot เพิ่มซ้ำ<br>• แจ้งเตือนระดับ `info` และส่ง Chime ต้อนรับ |
| **คนส่งของ** | `delivery` | 🟡 ส้ม/อำพัน (`#e65100`) | จับคู่กับเจ้าหน้าที่ขนส่ง/ไรเดอร์ที่ลงทะเบียนไว้ ($\ge 0.70$) | • แสดงชื่อขนส่งหรือชื่อไรเดอร์<br>• ป้ายสถานะ: พัสดุมาส่ง (`DELIVERY EVENT`)<br>• ไม่บันทึก Snapshot เพิ่มซ้ำ<br>• แจ้งเตือนระดับ `info/notice` |
| **อื่นๆ** | `other` | ⚪ เทาสเลท (`#475569`) | บุคคลทั่วไปที่ลงทะเบียนไว้ในระบบ ($\ge 0.70$) | • แสดงชื่อและบทบาทที่บันทึกไว้<br>• ป้ายสถานะ: ปลอดภัย (`VERIFIED OK`)<br>• ไม่บันทึก Snapshot เพิ่มซ้ำ<br>• บันทึก History และแจ้งเตือนระดับ `info` |
| **คนแปลกหน้า** | `stranger` | 🔴 แดง (`#c62828`) | ไม่ตรงกับฐานข้อมูลใบหน้าที่เทรนไว้ หรือยังไม่เคยเทรนในระบบ ($< 0.70$) | • ระบุเป็นบุคคลแปลกหน้า (Stranger)<br>• **บันทึกภาพ Snapshot ลง /data/snapshots/** เพื่อใช้ตรวจสอบและ Identify & Train<br>• ป้ายสถานะ: เฝ้าระวัง (`ALERT RECORDED`)<br>• **สร้าง Security Alert และส่งอีเมลแจ้งเตือน (Gmail SMTP) เฉพาะกรณีคนแปลกหน้าเท่านั้น** |

---

## 3. ผังข้อมูลและลำดับการทำงาน (Data Flow & Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน / Operator
    participant FE as React Frontend (DetectionContext)
    participant BE as FastAPI Backend
    participant AI as YOLO + MobileNetV3
    participant DB as SQLite (vigil.db)
    participant CAM as ESP32-S3 Camera

    alt ผู้ใช้อยู่ในหน้า /detection
        FE->>CAM: ขอสตรีมภาพสดผ่านแท็กหลัก (Direct Stream)
        Note over FE,CAM: มอนิเตอร์วิดีโอเรียลไทม์ 25-30 FPS
        FE->>FE: Canvas Capture จาก #esp32-stream-img
        FE->>BE: POST /api/v1/detection/detect-image (JPEG Blob)
    else ผู้ใช้อยู่หน้าอื่น (/history, /alerts, /training, /add-person)
        Note over FE: DetectionContext ทำงานเบื้องหลังต่อเนื่อง 24/7
        FE->>FE: Canvas Capture จาก #vigil-persistent-stream-img (Persistent Hidden Stream)
        alt Canvas Capture สำเร็จ
            FE->>BE: POST /api/v1/detection/detect-image (JPEG Blob)
        else Fallback เมื่อ Canvas ไม่พร้อม
            FE->>BE: POST /api/v1/detection/detect-esp32 (Proxy Grab)
            BE->>CAM: GET /capture หรือ /stream (ผ่าน LAN)
            CAM-->>BE: Frame Data
        end
    end
    
    BE->>AI: ตรวจจับวัตถุคน + สกัด Face Embedding 576-dim
    AI-->>BE: พิกัด Bounding Box + ค่า Similarity + กลุ่มบุคคล
    BE->>DB: บันทึก detection_history + สร้าง alert (กรณีตรวจพบ)
    BE-->>FE: ส่งผลลัพธ์กลับ (Bounding Box, Confidence, Category)
    
    par การตอบสนองทันทีบนหน้าเว็บ (Dual-Trigger Alerting)
        FE->>FE: Trigger 1 (Direct Detection): เล่นเสียง Chime ทันที + แสดง GlobalAlertToast
        FE->>DB: Trigger 2 (Background Sync): ทุก 4s เช็ค Unread Alerts จาก SQLite
        FE->>FE: ยิง Event 'vigil-alerts-updated' เพื่ออัปเดตตัวเลขแจ้งเตือนบน Navbar
    end

    opt เมื่อต้องการเทรนบุคคลใหม่
        User->>FE: อัปโหลดภาพ 3-5 ภาพที่หน้า /add-person
        FE->>BE: POST /api/v1/persons (Images + Meta)
        BE->>AI: สกัดเวกเตอร์เฉลี่ย L2 Centroid
        BE->>DB: บันทึกข้อมูลบุคคล
        BE-->>FE: อัปเดต Model Status และรายชื่อทันที
    end
```

---

## 4. ภาพรวมเทคโนโลยี (Technology Stack)

| ส่วนประกอบ | เทคโนโลยี | เวอร์ชัน / รายละเอียด |
| :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.2.8` |
| **Frontend Routing** | React Router | `^8.3.1` (Data Router + Protected/Guest Guards) |
| **CSS Framework** | Tailwind CSS | `^4.3.3` (Peach & Cream Theme Palette) |
| **Icons** | Lucide React | Modern Minimal IoT Icons |
| **Backend Framework** | FastAPI (Python) | High-performance Async Web Framework |
| **ORM & Database** | SQLAlchemy 2.0 + SQLite | Local database `vigil.db` พร้อม Auto-seeding |
| **Authentication** | PyJWT + Bcrypt | Stateless JWT Bearer Token |
| **Object Detection** | Ultralytics YOLOv8 | `yolov8n` สำหรับระบุ Bounding Box ของร่างกายบุคคล |
| **Feature Extraction** | MobileNetV3-Small | L2-normalized 576-dimensional metric embeddings |
| **Timezone Policy** | Thailand ICT (UTC+7) | `Asia/Bangkok` ซิงโครไนซ์ทั้งกล้องสด, ฐานข้อมูล, แจ้งเตือน และอีเมล |
| **IoT Hardware** | DFRobot ESP32-S3 | เซ็นเซอร์ OV3660, รองรับ MJPEG Stream และ Snapshot |

---

## 5. สารบัญเอกสารที่เกี่ยวข้อง (Related Documentation)

- 📘 [Backend API & Database Schema](backend-api.md): ข้อมูลจำเพาะ API, ตารางฐานข้อมูล และความปลอดภัย
- 🧠 [AI & Vision Pipeline](ai-vision.md): การทำงานของโมเดล YOLO, Metric Learning และเทคนิคการเทรนใบหน้า
- 💻 [Frontend Architecture](frontend.md): โครงสร้างหน้าเว็บ, ระบบตรวจจับต่อเนื่อง และดีไซน์ซิสเต็ม
- 📡 [Hardware & IoT](hardware-iot.md): คู่มือบอร์ด ESP32-S3, โค้ด Arduino และการเชื่อมต่อเครือข่าย
