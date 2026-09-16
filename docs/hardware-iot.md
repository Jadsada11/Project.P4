# Vigil — Hardware & IoT Documentation
คู่มือบอร์ด ESP32-S3 AI Camera (OV3660), การตั้งค่า Arduino IDE และสถาปัตยกรรมการสตรีม

---

## 1. ภาพรวมฮาร์ดแวร์ (Hardware Specification)

ระบบ Vigil รองรับการเชื่อมต่อกับโหนดกล้อง IoT สำหรับเฝ้าระวังความปลอดภัยภายนอกหรือบริเวณทางเข้า:

- **บอร์ดประมวลผล:** DFRobot ESP32-S3 (Dual-core Xtensa LX7 up to 240MHz)
- **หน่วยความจำ:** 8MB / 16MB Flash, 8MB OPI PSRAM (ความเร็วสูงสำหรับการประมวลผลภาพ)
- **เซ็นเซอร์กล้อง:** OV3660 ความละเอียดสูงสุด 3 ล้านพิกเซล (รองรับการตั้งค่าความละเอียด QVGA, VGA, SVGA, HD)
- **การเชื่อมต่อ:** Wi-Fi 2.4GHz 802.11 b/g/n

---

## 2. โค้ดโปรแกรม Arduino (`esp32_camera_capture.ino`)

ไฟล์ซอร์สโค้ดอยู่ที่: `esp32_camera_capture/esp32_camera_capture.ino`

### เอนด์พอยต์ที่บอร์ดให้บริการ:
1. **`GET /stream` (MJPEG Video Stream):**
   - ส่งสตรีมภาพเคลื่อนไหวแบบต่อเนื่องที่ 25-30 FPS สำหรับเปิดดูภาพสดบนหน้าเว็บ
   - มี Content-Type: `multipart/x-mixed-replace; boundary=frame`
2. **`GET /capture` (Single Snapshot):**
   - ส่งภาพนิ่ง 1 เฟรม (JPEG) ความเร็วสูง
   - แนบ Header `Access-Control-Allow-Origin: *` เพื่อให้ Frontend และ Backend ดึงไปวิเคราะห์ได้โดยตรง
3. **`GET /status` (Telemetry JSON):**
   - คืนค่าสถานะฮาร์ดแวร์: IP Address, ความแรงสัญญาณ Wi-Fi (RSSI), Free Heap Memory, และขนาด PSRAM

---

## 3. ขั้นตอนการตั้งค่าและการแฟลชโปรแกรมลงบอร์ด

1. เปิด **Arduino IDE**
2. ติดตั้งบอร์ด: **ESP32 by Espressif Systems** (เวอร์ชัน 2.0.x หรือ 3.x)
3. ไปที่เมนู **Tools** และกำหนดค่าบอร์ดดังนี้:
   - **Board:** `ESP32S3 Dev Module`
   - **PSRAM:** `OPI PSRAM` *(จำเป็นอย่างยิ่งสำหรับการเก็บเฟรมบัฟเฟอร์ภาพ)*
   - **Flash Mode:** `QIO 80MHz`
   - **Upload Speed:** `921600`
   - **USB CDC On Boot:** `Enabled`
4. ปรับแก้ชื่อ Wi-Fi และรหัสผ่านในโค้ด `esp32_camera_capture.ino`:
   ```cpp
   const char* ssid = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
5. เสียบสาย USB เข้ากับพอร์ตของบอร์ด ESP32-S3 และกดปุ่ม **Upload**
6. เปิด **Serial Monitor** ที่ความเร็ว `115200 bps` เพื่อดู IP Address ที่ได้รับจากเร้าเตอร์ เช่น:
   ```text
   Camera Ready! Use 'http://192.168.137.65' to connect
   Stream: http://192.168.137.65/stream
   Capture: http://192.168.137.65/capture
   ```

---

## 4. สถาปัตยกรรมการเชื่อมต่อเครือข่ายและการล็อก IP แบบถาวร (Networking Architecture & Fixed IP)

ระบบกำหนดและล็อก Static IP ให้กล้อง ESP32-S3 เป็น `192.168.137.65` และ Stream URL เป็น `http://192.168.137.65/stream` แบบถาวร เพื่อให้ระบบตรวจจับทำงานต่อเนื่องโดยไม่มีปัญหา IP เปลี่ยน:
- **Firmware Level (`esp32_camera_capture.ino`):** ล็อก Static IP `192.168.137.65` ทั้งในโหมด Station (เชื่อมต่อ Wi-Fi Hotspot) และโหมด SoftAP Fallback หาก Wi-Fi หลุด พร้อมระบบ Reconnect อัตโนมัติใน loop ที่คง IP เดิมไว้เสมอ
- **Frontend Level (`DetectionContext.jsx` & `DetectionPage.jsx`):** ล็อกการอ่านค่าและการจัดเก็บ LocalStorage ไว้ที่ `192.168.137.65` และ `http://192.168.137.65/stream` ป้องกันการเปลี่ยน IP
- **Backend Level (`config.py` & `detection.py`):** ตั้งค่า `DEFAULT_ESP32_IP = "192.168.137.65"` พร้อม Fallback ปลอดภัยในทุก Endpoint

เพื่อความยืดหยุ่นในการใช้งาน ระบบรองรับการเชื่อมต่อ 2 รูปแบบ:

```mermaid
flowchart TD
    subgraph Browser ["Web Browser (Client)"]
        UI["React Dashboard"]
    end

    subgraph Hardware ["IoT Node"]
        ESP["ESP32-S3 AI Camera\n(IP: 192.168.137.65)"]
    end

    subgraph Server ["Backend Host"]
        PROXY["Backend Proxy Route\n/api/v1/detection/esp32-stream"]
        GRAB["Stream-Grab Fallback\nfetch_esp32_frame()"]
    end

    UI -->|1. โหมด Direct Stream (ความเร็วสูงสุด Low Latency)| ESP
    UI -.->|2. โหมด Backend Proxy (กรณี Private Network / CORS)| PROXY
    PROXY --> ESP
    GRAB -->|3. ดึงเฟรมส่งให้ AI| ESP
```

### การป้องกันปัญหา Private Network Access / CORS
บนเบราว์เซอร์ Chrome และ Edge รุ่นใหม่ อาจมีการบล็อกการยิงคำขอจากโดเมนภายนอกเข้าสู่ Local IP (Private Network Access):
- สามารถสลับมาใช้ Endpoint ของ Backend: `/api/v1/detection/esp32-stream?camera_ip=192.168.137.65`
- Backend จะทำหน้าที่เป็น Proxy ถ่ายทอดสตรีมแบบ Zero-copy ไปยังหน้าเว็บโดยตรง

---

## 5. การแก้ปัญหา ESP32 Single-Thread Lock ด้วย Stream-Grab Fallback

### ปัญหาที่พบในบอร์ดไมโครคอนโทรลเลอร์:
เว็บเซิร์ฟเวอร์บน ESP32 มักทำงานแบบแกนเดียว (Single-threaded) เมื่อหน้าเว็บเปิดดูวิดีโอ `/stream` ค้างอยู่ การส่งคำขอถ่ายภาพ `/capture` ไปพร้อมกันมักจะติดปัญหา Connection Timeout หรือทำให้สตรีมหยุดชะงัก

### วิธีการแก้ไขในระดับ Backend (`fetch_esp32_frame`):
ในไฟล์ `backend/app/api/v1/endpoints/detection.py`:
1. พยายามเรียก `/capture` ด้วย Timeout สั้น (2.5 วินาที)
2. หากไม่สำเร็จหรือเกิด Timeout ระบบจะสลับไปเชื่อมต่อกับ `/stream` โดยอัตโนมัติ
3. อ่านไบต์ของสตรีมและตัดเฉพาะเฟรมภาพ JPEG แรกสุด (`0xFF 0xD8` ถึง `0xFF 0xD9`) นำไปส่งให้โมเดล YOLO วิเคราะห์ทันที
4. ผลลัพธ์: ระบบ AI สามารถดึงภาพไปตรวจจับได้ตลอดเวลา 100% โดยบอร์ดไม่ค้างและสตรีมไม่หลุด

---

## 6. การแก้ปัญหาและตั้งค่าหน่วยความจำกล้อง (Camera PSRAM & Memory Troubleshooting)

### ปัญหา: `cam_dma_config(509): frame buffer malloc failed` / Error `0xffffffff`
```text
E (1348) cam_hal: cam_dma_config(509): frame buffer malloc failed
E (1349) cam_hal: cam_config(599): cam_dma_config failed
E (1349) camera: Camera config failed with error 0xffffffff
```

#### สาเหตุหลัก:
1. **ไม่ได้เปิดใช้งาน PSRAM ใน Arduino IDE**: ค่าเริ่มต้นของบอร์ด `ESP32S3 Dev Module` ใน Arduino IDE คือ `PSRAM: Disabled` เมื่อโค้ดร้องขอหน่วยความจำในโหมด `CAMERA_FB_IN_PSRAM` ตัวไดรเวอร์ `esp32-camera` จะพยายามจองหน่วยความจำภายนอก (MALLOC_CAP_SPIRAM) แต่ไม่พบบัส PSRAM จึงคืนค่า `NULL` และเกิดข้อผิดพลาดทันที
2. **เลือกโหมด PSRAM ไม่ตรงกับฮาร์ดแวร์**: บอร์ด ESP32-S3 AI Camera ส่วนใหญ่ (เช่น DFRobot หรือ N16R8) ใช้ **OPI PSRAM** (Octal SPI) ขนาด 8MB หากตั้งค่าเป็น `QSPI PSRAM` หรือ `Disabled` ชิปจะไม่สามารถเข้าถึงหน่วยความจำได้
3. **การจอง Frame Buffer คู่ (Dual Buffer) ใน Internal RAM**: หากไม่มี PSRAM ภายใน Internal DRAM จะมีพื้นที่ต่อเนื่องไม่เพียงพอสำหรับเก็บภาพ 2 เฟรมพร้อมกันที่ความละเอียดสูง

#### วิธีการแก้ไข:
1. **การตั้งค่าใน Arduino IDE**:
   - ไปที่เมนู **Tools** > **PSRAM**
   - เปลี่ยนจาก `Disabled` ให้เป็น **`OPI PSRAM`** (หรือเลือก `QSPI PSRAM` หากใช้บอร์ดรุ่น 2MB Quad SPI)
   - ตรวจสอบว่า **Board** เลือกเป็น `ESP32S3 Dev Module`
2. **ระบบ Dynamic Fallback ในเฟิร์มแวร์ (`esp32_camera_capture.ino`)**:
   - เฟิร์มแวร์ได้รับการปรับปรุงให้ตรวจสอบ `psramFound()` แบบอัตโนมัติ
   - **กรณีมี PSRAM**: ใช้งาน `CAMERA_FB_IN_PSRAM`, Dual Buffer (`fb_count = 2`), ความละเอียด `FRAMESIZE_VGA` (640x480) และ `jpeg_quality = 12` เพื่อความลื่นไหลสูงสุด
   - **กรณีไม่มี PSRAM / ยังไม่ได้เปิดใน IDE**: สลับมาใช้ `CAMERA_FB_IN_DRAM`, Single Buffer (`fb_count = 1`), บีบอัดภาพเพิ่มขึ้นเพื่อความปลอดภัยของหน่วยความจำ
   - **ระบบสำรองฉุกเฉิน (Emergency Fallback)**: หากไดรเวอร์ล้มเหลว จะลดความละเอียดลงเป็น `FRAMESIZE_QVGA` (320x240) ใน DRAM อัตโนมัติ ป้องกันไม่ให้บอร์ดเกิด Infinite Reboot Loop

