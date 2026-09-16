# Vigil Frontend — React 19 & Tailwind CSS v4 Dashboard

เว็บแดชบอร์ดสำหรับระบบตรวจจับและจดจำใบหน้าอัจฉริยะ Vigil พัฒนาด้วย **React 19**, **React Router v8**, **Tailwind CSS v4** (ธีม Peach & Cream) และ **Vite**

---

## เอกสารเชิงลึก (Full Documentation)

- 💻 **[Frontend Architecture Documentation](../docs/frontend.md)**: สเปกหน้าจอทั้ง 7 หน้า, โครงสร้าง Component, ระบบเสียงสังเคราะห์ และ Design Tokens
- 🏛️ **[System Architecture](../docs/architecture.md)**: สถาปัตยกรรมระบบรวม, การจำแนก 3 กลุ่มบุคคล และ Data Flow
- 🤖 **[AGENTS.md](../AGENTS.md)**: ข้อควรระวังและแนวทางพัฒนาสำหรับ AI Coding Assistants

> 💡 **หมายเหตุสำคัญ:** หากมีการแก้ไข Component, หน้าเพจ, เส้นทาง Routing หรือการปรับแต่ง CSS ใด ๆ ใน `frontend/` จะต้องอัปเดตเอกสารใน [../docs/frontend.md](../docs/frontend.md) ให้สอดคล้องกันเสมอ

---

## การเริ่มต้นใช้งาน (Quick Start)

### 1. ติดตั้ง Dependencies
```bash
cd frontend
cmd.exe /c "npm install"
```

### 2. เปิดใช้งาน Development Server
```bash
cmd.exe /c "npm run dev"
```
หน้าเว็บจะเปิดที่: `http://localhost:5173`

### 3. ตรวจสอบการคอมไพล์สำหรับ Production (Build)
```bash
cmd.exe /c "npm run build"
```

---

## โครงสร้างหน้าเพจหลัก (Pages)

1. **Live Detection (`/detection`):** มอนิเตอร์กล้องสด วาดกรอบ Bounding Box 3 กลุ่มบุคคล และระบบเสียงแจ้งเตือน
2. **AI Training (`/training`):** ตรวจสอบสถานะโมเดล YOLO/MobileNetV3 และฐานข้อมูลบุคคลที่ลงทะเบียน
3. **Detection History (`/history`):** ประวัติการตรวจจับฉบับสมบูรณ์ ค้นหา กรองหมวดหมู่ และลบชุด (Bulk Delete)
4. **Add Person (`/add-person`):** ลงทะเบียนบุคคลใหม่พร้อมจับภาพแบบ Burst 3 ช็อต
5. **Security Alerts (`/alerts`):** หน้ารายการแจ้งเตือนความปลอดภัย พร้อมฟังก์ชันลบเดี่ยวและล้างกล่องข้อความ
6. **Authentication (`/login`, `/signup`):** ระบบเข้าสู่ระบบและสมัครสมาชิกเจ้าหน้าที่
7. **Landing Page (`/`):** หน้าต้อนรับและแนะนำภาพรวมระบบ
