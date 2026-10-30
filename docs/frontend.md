# Vigil — Frontend Architecture Documentation
สถาปัตยกรรม React 19, สเปกหน้าจอทั้ง 7 หน้า, ระบบตรวจจับต่อเนื่อง และระบบเสียงแจ้งเตือน

---

## 1. ภาพรวมเทคโนโลยี (Tech Stack)

| ส่วนประกอบ | เทคโนโลยี | เวอร์ชัน / รายละเอียด |
| :--- | :--- | :--- |
| **UI Framework** | React | `^19.2.8` |
| **Build Tool** | Vite | `^8.2.2` + React Compiler |
| **Routing** | React Router | `^8.3.1` (Data Router + Protected & Guest Route Guards) |
| **CSS Framework** | Tailwind CSS | `^4.3.3` (ใช้ `@tailwindcss/vite` และ `@theme` ใน CSS) |
| **Icons** | Lucide React | Modern Minimal Dashboard Icons |
| **Audio** | Web Audio API | ระบบสังเคราะห์เสียงแจ้งเตือนอัตโนมัติ ไม่พึ่งพาไฟล์เสียงภายนอก |

---

## 2. โครงสร้างโฟลเดอร์ (`frontend/src/`)

```text
frontend/
├── public/                     # Static assets (Favicon, etc.)
├── src/
│   ├── assets/                 # รูปภาพ โลโก้ และภาพประกอบ
│   ├── components/             # Reusable UI Components
│   │   ├── common/             # UI พื้นฐาน (Button, Badge, Input, MetricCard, Modal, GlobalAlertToast, RouteErrorBoundary)
│   │   ├── guards/             # Route Guards (ProtectedRoute, GuestRoute)
│   │   └── layout/             # MainLayout, AuthLayout, Navbar, Footer
│   ├── context/                # AuthContext, DetectionContext (ระบบกล้อง & AI ตรวจจับ 24/7 ข้ามหน้า)
│   ├── pages/                  # หน้าเพจหลักทั้ง 7 หน้า
│   │   ├── landing/            # [1] LandingPage.jsx (หน้าแรก)
│   │   ├── detection/          # [2] DetectionPage.jsx (ตรวจจับสด + กรอบ Bounding Box)
│   │   ├── training/           # [3] TrainingPage.jsx (คลังบุคคล + คอนโซลสถานะเทรน)
│   │   ├── history/            # [4] HistoryPage.jsx (ประวัติการตรวจจับฉบับเต็ม + Bulk Delete)
│   │   ├── add-person/         # [5] AddPersonPage.jsx (ลงทะเบียนบุคคลและอัปโหลดชุดภาพ Dataset)
│   │   ├── alerts/             # [6] AlertsPage.jsx (รายการแจ้งเตือน + ลบเดี่ยว/ล้างทั้งหมด)
│   │   └── auth/               # [7] LoginPage.jsx, SignupPage.jsx
│   ├── services/
│   │   └── api.js              # Axios Instance พร้อม Interceptors และ API Client Methods
│   ├── routes/
│   │   └── routes.tsx          # การตั้งค่า Data Router
│   ├── index.css               # Design Tokens โทนสี Peach & Cream
│   └── main.jsx                # จุดเริ่มต้นของ React Application
```

---

## 3. รายละเอียดและสเปกของแต่ละหน้าเพจ (Pages Specification)

### 3.1 หน้าแรก Landing Page (`/`)
- หน้าต้อนรับ แนะนำภาพรวมระบบ Vigil AI Smart Security
- เมนูนำทาง Capsule Navbar (`.nav-pills`) ด้านบน
- ปุ่ม `GET STARTED` ลิงก์ตรงเข้าสู่หน้าตรวจจับสด `/detection`

### 3.2 หน้าตรวจจับสด & มอนิเตอร์กล้อง (`/detection`)
- **Metric Cards (4 ช่อง):** จำนวนคนในบ้าน, คนส่งของ, คนแปลกหน้า, และยอดตรวจจับรวม
- **Live Camera Feed:** รองรับภาพสดจาก ESP32-CAM หรือกล้องเว็บแคม
- **Canvas Bounding Box Overlay:** วาดกรอบแยกสี 3 กลุ่มบุคคล (เขียว, ส้ม, แดง) พร้อมค่า % Confidence
- **Recent Visitors List (แถบด้านขวา):** แสดงประวัติล่าสุด พร้อมปุ่มลบรายการเดี่ยวและปุ่มล้างประวัติ
- **Camera Controls:** สลับกล้อง, สลับระบบตรวจจับอัตโนมัติ (Start/Stop), สลับเสียงแจ้งเตือน

### 3.3 หน้าฐานข้อมูลบุคคล & สถานะการเทรน AI (`/training`)
- **Real-time Model Metrics:** สถิติโมเดล MobileNetV3 (Epochs, Accuracy, Inference Time)
- **AI Training Console:** แสดง Terminal Log สีสันสดใสจำลองการประมวลผล
- **People Registry Grid:** แสดงการ์ดบุคคลที่ลงทะเบียนไว้ พร้อมค่าความสม่ำเสมอของใบหน้า
- **Action Buttons:** ปุ่ม `+ Add Person` นำทางไปหน้า `/add-person` และปุ่ม `Re-train AI`

### 3.4 หน้าประวัติการตรวจจับฉบับสมบูรณ์ (`/history`)
- **Overview Metric Cards:** ยอดบันทึกรวม, คนในบ้าน, คนส่งของ, คนแปลกหน้า
- **Filter Pills & Search Bar:** กรองตามหมวดหมู่ หรือพิมพ์ค้นหาชื่อ/สถานที่/รหัสกล้อง
- **Bulk Delete:** ติ๊กเลือก Checkbox หลายรายการพร้อมกัน และกดปุ่มลบชุดในคลิกเดียว
- **Snapshot Preview Modal:** เปิดดูภาพถ่ายใบหน้าขนาดใหญ่พร้อมรายละเอียดเหตุการณ์
- **Identify & Train:** ระบุตัวตนคนแปลกหน้าและส่งภาพเข้าสู่คลังเวกเตอร์ AI ทันที

### 3.5 หน้าลงทะเบียนบุคคลใหม่ (`/add-person`)
- **Identity Details Form:** ชื่อ-นามสกุล, การเลือกหมวดหมู่ 6 กลุ่มข้างๆ กัน (`household`, `neighbor`, `friend`, `delivery`, `other`, `stranger`), แผนก/สังกัด, บันทึกความปลอดภัย
- **Direct File Upload:** อัปโหลดชุดรูปภาพใบหน้าผ่าน Drag & Drop หรือเลือกไฟล์จากคอมพิวเตอร์ (รองรับไฟล์ JPG, PNG, WEBP หลายไฟล์พร้อมกัน)
- **Primary Avatar Selection:** เลือกระบุภาพโปรไฟล์หลัก (Star ⭐) สำหรับแสดงผลในระบบ
- **Dataset Quality Guide:** แถบเกณฑ์ประเมินคุณภาพชุดข้อมูล AI และคำแนะนำมุมมองใบหน้า (หน้าตรง, มุมเอียง, แสงสว่าง) เพื่อความแม่นยำสูงสุด

### 3.6 หน้าระบบแจ้งเตือนความปลอดภัย (`/alerts`)
- **Filters:** สลับดูตามหมวดหมู่ (`All`, `Stranger`, `Delivery`, `Household`, `Neighbor`, `Friend`, `Other`) และ `Unread Only`
- **Action Buttons:** ปุ่ม `Mark All as Read` และปุ่ม `Clear Alerts` (ลบเฉพาะที่อ่านแล้ว หรือลบทั้งหมด)
- **Alert Cards:** แสดงการ์ดแบ่งตามระดับความรุนแรงและประเภทบุคคล พร้อมปุ่มลบเดี่ยว (`Trash2`)
- **Real-time Sync:** เมื่อคลิกอ่านหรือลบ ตัวเลขสีแดงบน Navbar จะลดลงทันที

### 3.7 หน้าเข้าสู่ระบบ (`/login`) & สมัครสมาชิก (`/signup`)
- ดีไซน์ Modern Glass Card กึ่งกลางหน้าจอ โทนสีอบอุ่นเข้ากับธีม Vigil
- Form Validation เต็มรูปแบบ พร้อมการจัดเก็บ Token ใน `localStorage` และ Auth State

---

## 4. ระบบการตรวจจับอัตโนมัติและการแจ้งเตือน (Real-Time Architecture)

### 4.1 การแก้ปัญหาการหยุดตรวจจับด้วย `isDetectingRef` Guard
ในการตรวจจับแบบเรียลไทม์ หากใช้ state `isDetecting` อยู่ใน Dependency Array ของ `useEffect` จะทำให้ timer ถูก `clearInterval` ทุกครั้งที่มีการอัปเดตสถานะ

**วิธีแก้ไข:**
ใช้ `isDetectingRef = useRef(false)` เพื่อทำหน้าที่เป็น In-flight Guard โดยไม่ทำให้ Component Re-mount หรือทำลาย Interval ทิ้ง ทำให้ตัวตั้งเวลา (Timer Interval 5 วินาที per snapshot) ทำงานต่อเนื่องสม่ำเสมอ 24/7

- **Snapshot ทุก 5 วินาที:** ระบบจับภาพและรัน AI โมเดลทุก 5 วินาที เพื่ออัปเดต Bounding Box สดบนจอ และบันทึก `detection_history` พร้อมรูปภาพ Snapshot ลงระบบ
- **แจ้งเตือนทุก 3 นาที (Alert Cooldown):** เสียงแจ้งเตือน (Audio Chime), การแจ้งเตือนบนหน้าจอ (Global Alert Toast) และ Desktop Push Notification จะทำงานเฉพาะเมื่อมี Alert ใหม่ที่ผ่านเงื่อนไข Cooldown 3 นาที (180 วินาที) จาก Backend เพื่อไม่ให้เกิดเสียงรบกวนต่อเนื่องทุก 5 วินาที


### 4.2 Zero-Latency HTML5 Canvas Frame Capture
ระบบดึงเฟรมภาพปัจจุบันจากแท็ก `<img>` (ESP32 Stream) หรือ `<video>` (Webcam) โดยตรงผ่าน Canvas API และแปลงเป็น Blob ส่งไปยัง `/api/v1/detection/detect-image` ทำให้ได้ภาพเดียวกับที่เห็นบนจอ 100% โดยไม่แย่งแบนด์วิดท์สตรีมของ ESP32

### 4.3 ระบบเสียงแจ้งเตือนสังเคราะห์ (Web Audio API Synthesizer)
ติดตั้งระบบเสียง Chime ผ่าน Web Audio API โดยไม่ต้องพึ่งพาไฟล์เสียงภายนอก:
- **คนแปลกหน้า (Stranger Alert):** เสียงไซเรนเตือนภัย 2 โทนความถี่สูง (880Hz → 659Hz)
- **คนส่งของ (Delivery Courier):** เสียงกระดิ่งคอร์ดแจ้งเตือน 2 จังหวะ
- **เพื่อน (Friend):** เสียงกระดิ่งคอร์ด 3 โทนสดใส (587Hz → 740Hz → 880Hz)
- **เพื่อนบ้าน (Neighbor):** เสียงกระดิ่งคู่ฮาร์โมนิก (523Hz → 659Hz)
- **สมาชิกในบ้าน (Household Member):** เสียงกระดิ่งต้อนรับ (523Hz → 659Hz)

### 4.4 การซิงก์ตัวเลขแจ้งเตือนแบบเรียลไทม์ (`vigil-alerts-updated`)
เมื่อเกิดเหตุการณ์ตรวจจับใหม่ หรือมีการกดอ่าน/ลบแจ้งเตือน ระบบจะยิง Custom DOM Event:
```javascript
window.dispatchEvent(new CustomEvent('vigil-alerts-updated'));
```
Navbar จะดักฟัง Event นี้เพื่ออัปเดตตัวเลขแจ้งเตือนที่ยังไม่ได้อ่านบนไอคอนกระดิ่งทันที

### 4.5 การตรวจจับกล้องเบื้องหลังตลอดเวลา 24/7 ข้ามทุกหน้า (`DetectionContext` & `MainLayout`)
เดิมทีระบบจะรันการตรวจจับเฉพาะขณะที่ผู้ใช้อยู่ในหน้า `/detection` เท่านั้น เมื่อเปลี่ยนไปยังหน้าอื่น (`/training`, `/history`, `/alerts`, `/add-person`) Component จะถูก Unmount ทำให้การตรวจจับหยุดลง

**สถาปัตยกรรมใหม่ (Persistent Background AI Detection & Dual-Trigger Alerts):**
1. **ย้าย Loop การตรวจจับสู่ Context ระดับ Layout:** นำวงจรตรวจจับและข้อมูลกล้องทั้งหมดไปไว้ใน `DetectionContext` (`DetectionProvider`) ซึ่งห่อหุ้ม `MainLayout` ทำให้ State และ Interval ไม่ถูกทำลายเมื่อสลับหน้า
2. **Persistent Hidden Stream Element (`vigil-persistent-stream-img`) พร้อมระบบ Route-Aware:**
   - เมื่อผู้ใช้อยู่ที่หน้า `/detection` สตรีมหลัก `#esp32-stream-img` จะทำงานเพียงตัวเดียว และ Context จะ **ไม่** mount `#vigil-persistent-stream-img` เพื่อป้องกันการเปิด Socket สตรีมซ้ำซ้อน 2 ตัวพร้อมกันไปยัง ESP32
   - เมื่อสลับไปหน้าอื่น (`/training`, `/history`, `/alerts`, `/add-person`) แท็กซ่อน `#vigil-persistent-stream-img` จะ mount ขึ้นมาอัตโนมัติ เพื่อดึงเฟรมผ่าน HTML5 Canvas และส่งประมวลผล AI ต่อเนื่อง
   - หากเกิดข้อผิดพลาดในการดึงเฟรม Canvas ระบบจะสลับอัตโนมัติ (Fallback) ไปเรียก `POST /api/v1/detection/detect-esp32` ผ่าน FastAPI Backend
3. **ระบบ Dual Stream Mode (Direct ESP32 vs Backend Proxy):**
   - รองรับทั้งการเชื่อมต่อตรง (`Direct`) และผ่านเซิร์ฟเวอร์ (`Backend Proxy`)
   - มีระบบ **Auto-Fallback**: หากการเชื่อมต่อตรงไปยัง ESP32 ถูกบล็อกโดยข้อกำหนด Private Network Access หรือ CORS บนเบราว์เซอร์ หน้าเว็บจะสลับไปดึงผ่าน Backend Proxy (`/api/v1/detection/esp32-stream`) อัตโนมัติทันที
   - ปลดล็อก Modal ตั้งค่า IP กล้อง ให้สามารถแก้ไข IP, Port, Path และสลับโหมด Direct / Proxy ได้อย่างอิสระ
4. **ระบบแจ้งเตือน 2 ช่องทาง (Dual-Trigger Alerting Mechanism):**
   - **Direct Detection Trigger:** เมื่อ Loop การตรวจจับพบคนแปลกหน้า (`stranger`) หรือคนส่งของ (`delivery`) จะสั่งเล่นเสียงไซเรน/กระดิ่งทันทีและตั้งค่า `alertNotification`
   - **Database Sync Trigger (`syncUnreadAlerts`):** ทุกๆ 4 วินาที Context จะตรวจสอบ SQLite (`GET /api/v1/alerts?unread_only=true&limit=1`) เพื่อให้มั่นใจว่าหากมี Alert ใหม่เกิดขึ้น (ไม่ว่าจะตรวจจับจากหน้านี้ Backend หรืออุปกรณ์อื่น) จะส่งเสียงแจ้งเตือนและแสดง Toast ทันที 100%
5. **การแสดงผลและการแจ้งเตือนครอบคลุมทุกหน้า:**
   - **เสียงเตือน (Chime):** สังเคราะห์ผ่าน Web Audio API ดังขึ้นทันทีแม้เปิดหน้าอื่นอยู่ พร้อมระบบ `AudioContext.resume()` รองรับ Autoplay Policy ของเบราว์เซอร์
   - **การแจ้งเตือนลอย (GlobalAlertToast):** เมื่อตรวจพบขณะอยู่หน้าอื่น จะมีแบนเนอร์ลอยขึ้นมาที่มุมขวาบนพร้อมปุ่มลิงก์ด่วนไปยัง `/alerts` หรือ `/detection`
   - **HTML5 Web Desktop Notifications:** เด้งการแจ้งเตือนระดับ OS เมื่อเปิดการยินยอม
   - **สถานะกล้องสดบน Navbar:** แสดง Badge `CAM 24/7 ACTIVE` พร้อมจุดสีเขียวกระพริบยืนยันว่ากล้องทำงานตลอดเวลา
6. **การซิงก์ข้อมูลบนหน้า Live Detection (`DetectionPage`):** หน้านี้จะเรียกใช้ `useDetection()` เพื่อรับ State และ Detections ล่าสุด และใช้ฟังก์ชัน `fetchStatsAndHistory()` ในการรีเฟรชการ์ดประวัติผู้มาเยือนและสถิติให้ตรงกับฐานข้อมูลโดยไม่ต้องสร้าง Timer ตรวจจับซ้ำซ้อน
7. **ระบบจัดการข้อผิดพลาดระดับเส้นทาง (Route Error Boundary):** ติดตั้ง `RouteErrorBoundary` (`RouteErrorBoundary.jsx`) เป็น `errorElement` ใน `createBrowserRouter` (`routes.tsx`) ทั้งสำหรับกลุ่ม `ProtectedRoute` และ `GuestRoute` เพื่อดักจับ Unexpected Runtime Errors, ปัญหา Network หรือ 404 โดยแสดงผลด้วยสไตล์ Peach & Cream พร้อมปุ่มรีโหลดหน้าเว็บ, ปุ่มกลับหน้าหลัก และส่วนแสดงข้อผิดพลาดสำหรับ Developer อย่างปลอดภัย ไม่ทำให้หน้าจอขาวหรือแสดง Raw Error Stack สุ่มเสี่ยง

---

## 5. ระบบสีและ Design Tokens (Tailwind CSS v4)

กำหนดค่าตัวแปรใน `src/index.css`:
```css
@import "tailwindcss";

@theme {
  /* Brand Colors (Peach & Cream Modern Aesthetic) */
  --color-vigil-peach: #f5c9a8;
  --color-vigil-peach-dark: #e8b48a;
  --color-vigil-bg: #f7f1e9;
  --color-vigil-card: #ffffff;
  --color-vigil-text: #1a1a1a;
  --color-vigil-muted: #6b6b6b;
  --color-vigil-border: #e8e0d5;

  /* Status Colors */
  --color-vigil-green: #2e7d32;
  --color-vigil-green-bg: #e8f5e9;
  --color-vigil-red: #c62828;
  --color-vigil-red-bg: #ffebee;
  --color-vigil-yellow: #f9a825;
  --color-vigil-yellow-bg: #fff8e1;
}
```

---

## 6. คำสั่งรันและบิลด์โปรเจกต์ (Execution & Build)

บนระบบปฏิบัติการ Windows ที่มีข้อจำกัดด้าน PowerShell Execution Policy ให้เรียกผ่าน `cmd /c`:

```bash
# เปิด Dev Server
cd frontend
cmd.exe /c "npm run dev"

# ตรวจสอบการคอมไพล์สำหรับ Production
cmd.exe /c "npm run build"
```

---

## 7. การแสดงผลเวลาตามเวลาประเทศไทย (Thailand Timezone Displays — UTC+7 / Asia/Bangkok)

ทุกหน้าและทุกคอมโพเนนต์แสดงผลวันและเวลาตามเวลาประเทศไทยอย่างแม่นยำ:
1. **นาฬิกา Real-time HUD บนกล้องสด (`DetectionPage.jsx`)**:
   - อัปเดตทุก 1 วินาที โดยระบุ `timeZone: "Asia/Bangkok"` และแสดงป้ายกำกับ `ICT (ไทย)` บนหน้าจอกล้องสตรีมสด
2. **ตารางประวัติผู้มาเยือน (`HistoryPage.jsx` และ `DetectionPage.jsx`)**:
   - จัดรูปแบบเวลา `item.timestamp` ด้วย `toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit" })`
   - จัดรูปแบบวันที่ด้วย `toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })`
3. **ฟีดการแจ้งเตือน (`AlertsPage.jsx`, `DetectionContext.jsx`, `GlobalAlertToast.jsx`)**:
   - บันทึกและแสดงเวลาแจ้งเตือนตาม `Asia/Bangkok` เพื่อให้เวลาใน Toast, หน้าต่าง Alerts และการแจ้งเตือน Desktop Notification ตรงกับเวลานาฬิกาไทย 100%
4. **หน้าจอเทรนโมเดล AI (`TrainingPage.jsx`)**:
   - สถิติ `last_trained` และบันทึก Log ในคอนโซลจำลองแสดงเวลาไทยด้วย `timeZone: "Asia/Bangkok"`
