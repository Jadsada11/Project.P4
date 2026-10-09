import os
import smtplib
import time
import logging
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from datetime import datetime
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger("email_service")

# Cooldown tracking: maps category/person to timestamp of last sent email
_last_sent_timestamps: Dict[str, float] = {}
_cooldown_lock = threading.Lock()

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))


def _clean_password(raw_password: str) -> str:
    """ลบช่องว่างออกจาก Google App Password"""
    return raw_password.replace(" ", "").strip()


def send_test_email(recipient: Optional[str] = None) -> Dict[str, Any]:
    """
    ส่งอีเมลทดสอบเพื่อตรวจสอบการเชื่อมต่อกับ Gmail SMTP
    """
    target_email = recipient or settings.NOTIFICATION_RECIPIENT_EMAIL or settings.SMTP_USER
    sender = settings.SMTP_USER
    password = _clean_password(settings.SMTP_PASSWORD)

    if not sender or not password:
        return {
            "success": False,
            "message": "SMTP_USER หรือ SMTP_PASSWORD ยังไม่ได้ถูกกำหนดในไฟล์ .env",
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🔔 [Vigil Security] ทดสอบระบบแจ้งเตือนทางอีเมลสำเร็จ (Gmail SMTP)"
    msg["From"] = f"Vigil AI Security <{sender}>"
    msg["To"] = target_email

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">✅ การเชื่อมต่อ Gmail SMTP สำเร็จ!</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Vigil AI Smart Security & IoT Face Recognition</p>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 15px; line-height: 1.6;">
          <p>เรียน ผู้ดูแลระบบความปลอดภัย Vigil,</p>
          <p>อีเมลนี้เป็นการทดสอบการเชื่อมต่อระบบส่งข้อความแจ้งเตือนอัตโนมัติผ่าน <strong>Gmail SMTP</strong></p>
          <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; margin: 18px 0; border-left: 4px solid #10b981;">
            <div><strong>SMTP Server:</strong> {settings.SMTP_SERVER}:{settings.SMTP_PORT}</div>
            <div><strong>Sender Account:</strong> {sender}</div>
            <div><strong>Recipient:</strong> {target_email}</div>
            <div><strong>Timestamp:</strong> {now_str}</div>
            <div><strong>Status:</strong> Active & Connected Ready for Delivery Alerts</div>
          </div>
          <p>เมื่อกล้องตรวจพบ <strong>คนมาส่งพัสดุ (Delivery)</strong> หรือบุคคลแปลกหน้า ระบบจะส่งภาพถ่ายและข้อมูลแจ้งเตือนมายังอีเมลนี้โดยอัตโนมัติ</p>
        </div>
        <div style="background: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Vigil Web-IoT AI Surveillance Node • ESP32-S3 Camera
        </div>
      </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=12)
        else:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=12)
            server.starttls()

        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        logger.info(f"Test email sent successfully to {target_email}")
        return {
            "success": True,
            "message": f"ส่งอีเมลทดสอบไปยัง {target_email} สำเร็จเรียบร้อยแล้ว!",
            "recipient": target_email,
        }
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        return {
            "success": False,
            "message": f"การส่งอีเมลทดสอบล้มเหลว: {str(e)}",
            "error": str(e),
        }


def _send_alert_worker(
    category: str,
    person_name: str,
    location: str,
    confidence: float,
    snapshot_rel_path: str,
    detection_time: str,
):
    """
    ฟังก์ชันเบื้องหลังสำหรับเชื่อมต่อ SMTP และส่งอีเมลแจ้งเตือน
    """
    if not settings.SMTP_ENABLED:
        logger.debug("SMTP is disabled in settings. Skipping email alert.")
        return

    sender = settings.SMTP_USER
    password = _clean_password(settings.SMTP_PASSWORD)
    recipient = settings.NOTIFICATION_RECIPIENT_EMAIL or sender

    if not sender or not password:
        logger.warning("SMTP credentials not configured. Skipping email.")
        return

    is_delivery = (category == "delivery")
    is_stranger = (category == "stranger")

    if is_delivery:
        subject = f"📦 [Vigil Alert] มีคนมาส่งของ: {person_name} ({location})"
        badge_color = "#f59e0b"
        header_title = "📦 มีคนมาส่งพัสดุ / ไรเดอร์มาถึงหน้าบ้าน"
        badge_text = "DELIVERY (คนส่งพัสดุ)"
    elif is_stranger:
        subject = f"⚠️ [Vigil Alert] ตรวจพบบุคคลแปลกหน้า: {person_name} ({location})"
        badge_color = "#ef4444"
        header_title = "⚠️ ตรวจพบบุคคลแปลกหน้าบริเวณทางเข้า"
        badge_text = "STRANGER (คนแปลกหน้า)"
    elif category == "neighbor":
        subject = f"🩵 [Vigil Alert] ตรวจพบเพื่อนบ้าน: {person_name} ({location})"
        badge_color = "#00838f"
        header_title = "🩵 ตรวจพบเพื่อนบ้านเข้าสู่บริเวณ"
        badge_text = "NEIGHBOR (เพื่อนบ้าน)"
    elif category == "friend":
        subject = f"💜 [Vigil Alert] ตรวจพบเพื่อน: {person_name} ({location})"
        badge_color = "#7b1fa2"
        header_title = "💜 ตรวจพบเพื่อนสนิท/ผู้มาเยือน"
        badge_text = "FRIEND (เพื่อน/แขก)"
    elif category == "other":
        subject = f"⚪ [Vigil Alert] ตรวจพบบุคคลที่บันทึกไว้: {person_name} ({location})"
        badge_color = "#616161"
        header_title = "⚪ ตรวจพบบุคคลทั่วไปที่ลงทะเบียนไว้"
        badge_text = "OTHER (บุคคลอื่นๆ)"
    else:
        subject = f"🟢 [Vigil Alert] ตรวจพบสมาชิกในบ้าน: {person_name} ({location})"
        badge_color = "#10b981"
        header_title = "🟢 ตรวจพบสมาชิกในบ้านเข้าสู่บริเวณ"
        badge_text = "HOUSEHOLD (สมาชิกในบ้าน)"

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = f"Vigil AI Security <{sender}>"
    msg["To"] = recipient

    msg_alternative = MIMEMultipart("alternative")
    msg.attach(msg_alternative)

    # Resolve local snapshot file path
    has_image = False
    snapshot_local_path = None
    if snapshot_rel_path:
        clean_rel = snapshot_rel_path.lstrip("/").replace("data/snapshots/", "").replace("data/datasets/", "")
        candidate_paths = [
            os.path.join(BACKEND_DIR, "data", "snapshots", clean_rel),
            os.path.join(BACKEND_DIR, "data", "snapshots", os.path.basename(snapshot_rel_path)),
        ]
        for cp in candidate_paths:
            if os.path.isfile(cp):
                snapshot_local_path = cp
                has_image = True
                break

    img_html = ""
    if has_image:
        img_html = """
        <div style="margin: 18px 0; text-align: center;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">📷 ภาพถ่ายสแนปช็อตขณะตรวจพบ:</div>
          <img src="cid:snapshot_image" alt="Snapshot" style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.08);" />
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 6px 16px rgba(0,0,0,0.08);">
        
        <!-- Header Banner -->
        <div style="background: {badge_color}; color: #ffffff; padding: 22px 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 21px; font-weight: 700;">{header_title}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.95; font-size: 14px;">ระบบกล้องวงจรปิดอัจฉริยะ Vigil AI Smart Security</p>
        </div>

        <!-- Body Details -->
        <div style="padding: 24px; color: #1e293b;">
          <div style="display: inline-block; background: {badge_color}18; color: {badge_color}; border: 1px solid {badge_color}; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 16px;">
            {badge_text}
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 15px; margin-bottom: 16px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b; width: 140px;"><strong>บุคคล / รายละเอียด:</strong></td>
              <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">{person_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>ตำแหน่งกล้อง:</strong></td>
              <td style="padding: 10px 0; color: #0f172a;">{location}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;"><strong>ความแม่นยำ AI:</strong></td>
              <td style="padding: 10px 0; color: #0f172a;"><strong>{confidence:.1f}%</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b;"><strong>วันเวลาที่ตรวจพบ:</strong></td>
              <td style="padding: 10px 0; color: #0f172a;">{detection_time}</td>
            </tr>
          </table>

          {img_html}

          <!-- Quick Actions Button -->
          <div style="margin-top: 24px; text-align: center;">
            <a href="http://localhost:5173/detection" style="background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
              🎥 เปิดดูหน้ากล้องสด (Live Camera)
            </a>
            <a href="http://localhost:5173/alerts" style="background: #f1f5f9; color: #334155; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; margin-left: 8px; border: 1px solid #cbd5e1;">
              ประวัติการแจ้งเตือน
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 14px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          ข้อความแจ้งเตือนอัตโนมัติจาก Vigil Web-IoT AI Node • บัญชีผู้รับ: {recipient}
        </div>
      </div>
    </body>
    </html>
    """

    msg_alternative.attach(MIMEText(html_content, "html", "utf-8"))

    # Attach Snapshot image as inline CID
    if has_image and snapshot_local_path:
        try:
            with open(snapshot_local_path, "rb") as f:
                img_data = f.read()
            mime_img = MIMEImage(img_data)
            mime_img.add_header("Content-ID", "<snapshot_image>")
            mime_img.add_header("Content-Disposition", "inline", filename=os.path.basename(snapshot_local_path))
            msg.attach(mime_img)
        except Exception as e:
            logger.error(f"Could not attach snapshot image to email: {e}")

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=12)
        else:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=12)
            server.starttls()

        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        logger.info(f"[Email Alert] Sent successfully to {recipient} for {category}: {person_name}")
    except Exception as e:
        logger.error(f"[Email Alert ERROR] Failed to send email alert: {e}")


def trigger_email_alert_async(
    category: str,
    person_name: str,
    location: str,
    confidence: float,
    snapshot_rel_path: str = "",
):
    """
    ตรวจสอบเงื่อนไข Cooldown และสั่งส่งอีเมลใน Background Thread แบบ Non-blocking
    """
    if not settings.SMTP_ENABLED:
        return

    # ตรวจสอบว่าหมวดหมู่นี้ต้องส่งอีเมลหรือไม่
    alert_categories = settings.EMAIL_ALERT_CATEGORIES
    if isinstance(alert_categories, str):
        alert_categories = [c.strip().lower() for c in alert_categories.split(",")]
    if category.lower() not in [c.lower() for c in alert_categories]:
        return

    # Cooldown Check (ป้องกันสแปมอีเมลซ้ำๆ ส่งสูงสุดทุก 5 นาที / 300 วิ)
    now = time.time()
    cooldown_key = "stranger" if category.lower() == "stranger" else f"{category.lower()}_{person_name}"
    with _cooldown_lock:
        last_sent = _last_sent_timestamps.get(cooldown_key, 0)
        # ตรวจสอบ Cooldown รวมระดับหมวดหมู่ด้วยเพื่อความปลอดภัย
        cat_last_sent = _last_sent_timestamps.get(category.lower(), 0)
        cooldown_sec = settings.EMAIL_ALERT_COOLDOWN_SECONDS

        if (now - last_sent < cooldown_sec) or (now - cat_last_sent < min(cooldown_sec, 60)):
            logger.debug(f"[Email Alert Cooldown] Skipped email for {cooldown_key} (Sent {int(now - last_sent)}s ago)")
            return

        _last_sent_timestamps[cooldown_key] = now
        _last_sent_timestamps[category.lower()] = now

    detection_time_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    # รันใน Thread แยก เพื่อไม่ให้กระทบประสิทธิภาพของลูปตรวจจับ YOLO
    thread = threading.Thread(
        target=_send_alert_worker,
        args=(category, person_name, location, confidence, snapshot_rel_path, detection_time_str),
        daemon=True,
    )
    thread.start()
