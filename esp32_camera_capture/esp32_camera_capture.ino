#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "esp_timer.h"

// =========================================================================
// Vigil Web-IoT Face Recognition & Person Classification System
// Hardware: DFRobot ESP32-S3 AI Camera (OV3660)
// Endpoints:
//   - GET /        : หน้าจอมอนิเตอร์กล้องเบื้องต้น
//   - GET /stream  : MJPEG Real-time Stream รองรับหลายไคลเอนต์พร้อมกัน
//   - GET /capture : ถ่ายภาพ Single Snapshot JPEG ความเร็วสูงสำหรับ AI / YOLO
//   - GET /status  : รายงานสถานะกล้อง, WiFi RSSI, Heap memory (JSON)
// สถาปัตยกรรม: esp_http_server (FreeRTOS Multi-socket Non-blocking Server)
// =========================================================================

// =========================
// WiFi Credentials & Static IP Configuration
// =========================
const char* ssid = "bas";
const char* password = "12345678";

// กำหนด Static IP แบบคงที่ เพื่อไม่ให้ IP เปลี่ยน (http://192.168.137.65)
IPAddress local_IP(192, 168, 137, 65);     // IP ที่ต้องการล็อกให้ ESP32
IPAddress gateway(192, 168, 137, 1);       // Gateway (IP เครื่องปล่อย Hotspot / Router)
IPAddress subnet(255, 255, 255, 0);        // Subnet Mask
IPAddress primaryDNS(192, 168, 137, 1);    // Primary DNS
IPAddress secondaryDNS(8, 8, 8, 8);        // Secondary DNS (Google DNS)

// =========================
// DFRobot ESP32-S3 AI Camera Pinout (OV3660)
// =========================
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1

#define XCLK_GPIO_NUM      5
#define SIOD_GPIO_NUM      8
#define SIOC_GPIO_NUM      9

#define Y9_GPIO_NUM        4
#define Y8_GPIO_NUM        6
#define Y7_GPIO_NUM        7
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       17
#define Y4_GPIO_NUM       21
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM       16

#define VSYNC_GPIO_NUM     1
#define HREF_GPIO_NUM      2
#define PCLK_GPIO_NUM     15

// Server Handle
httpd_handle_t camera_httpd = NULL;

// Multipart Stream Constants
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace; boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// =========================
// หน้าเว็บมอนิเตอร์บนกล้อง
// =========================
static const char INDEX_HTML[] = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32-S3 AI Camera — Vigil Web-IoT</title>

<style>
body {
  margin: 0;
  background: #0f1115;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  padding: 20px 10px;
}

h1 {
  margin: 10px 0;
  font-size: 24px;
  color: #f5c9a8;
}

p {
  color: #94a3b8;
  font-size: 14px;
  margin-bottom: 20px;
}

.stream-card {
  display: inline-block;
  background: #1e222b;
  padding: 12px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  border: 1px solid #334155;
  max-width: 95%;
}

img {
  width: 100%;
  max-width: 800px;
  height: auto;
  border-radius: 12px;
  display: block;
}

.btn-group {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

a.btn {
  background: #f5c9a8;
  color: #111;
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  font-size: 13px;
}

a.btn:hover {
  background: #e8b48a;
}
</style>

</head>

<body>

<h1>Vigil ESP32-S3 AI Camera Node</h1>
<p>OV3660 Camera Sensor • Connected to YOLOv8 Person Classification Pipeline</p>

<div class="stream-card">
  <img src="/stream" alt="Live Stream">
  <div class="btn-group">
    <a href="/capture" target="_blank" class="btn">Capture Snapshot (/capture)</a>
    <a href="/status" target="_blank" class="btn">Telemetry Status (/status)</a>
  </div>
</div>

</body>
</html>
)rawliteral";

// =========================
// URI Handler: หน้าเว็บหลัก (GET /)
// =========================
static esp_err_t handle_root(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, INDEX_HTML, strlen(INDEX_HTML));
}

// =========================
// URI Handler: CORS OPTIONS Preflight
// =========================
static esp_err_t handle_options(httpd_req_t *req) {
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Private-Network", "true");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_status(req, "204 No Content");
  return httpd_resp_send(req, NULL, 0);
}

// =========================
// URI Handler: MJPEG Video Stream (GET /stream)
// Non-blocking, Multi-socket FreeRTOS stream
// =========================
static esp_err_t handle_stream(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Private-Network", "true");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[Stream] Camera frame grab failed");
      res = ESP_FAIL;
      break;
    }

    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }

    esp_camera_fb_return(fb);
    fb = NULL;

    // หากไคลเอนต์ตัดการเชื่อมต่อ ให้หยุดลูปทันทีเพื่อคืนทรัพยากร
    if (res != ESP_OK) {
      break;
    }

    // หน่วงเวลาเล็กน้อยเพื่อให้เฟรมสมูท (~25-30 FPS) และคืน CPU ให้ระบบ
    vTaskDelay(pdMS_TO_TICKS(30));
  }

  return res;
}

// =========================
// URI Handler: Single Snapshot JPEG (GET /capture)
// สำหรับ FastAPI Backend Proxy & YOLO Inference
// =========================
static esp_err_t handle_capture(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[Capture] Snapshot capture failed");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Private-Network", "true");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");

  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// =========================
// URI Handler: Telemetry Status (GET /status)
// =========================
static esp_err_t handle_status(httpd_req_t *req) {
  String json = "{";
  json += "\"status\":\"online\",";
  json += "\"board\":\"DFRobot ESP32-S3 AI Camera\",";
  json += "\"sensor\":\"OV3660\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"psram\":" + String(psramFound() ? "true" : "false") + ",";
  json += "\"free_psram\":" + String(ESP.getFreePsram());
  json += "}";

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Private-Network", "true");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");

  return httpd_resp_send(req, json.c_str(), json.length());
}

// =========================
// Start Multi-Socket HTTP Server
// =========================
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;
  config.max_open_sockets = 7;            // รองรับการเชื่อมต่อพร้อมกันสูงสุด 7 ไคลเอนต์
  config.lru_purge_enable = true;          // ปิด socket เก่าที่ค้างอัตโนมัติป้องกัน deadlocks

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = handle_root,
    .user_ctx  = NULL
  };

  httpd_uri_t status_uri = {
    .uri       = "/status",
    .method    = HTTP_GET,
    .handler   = handle_status,
    .user_ctx  = NULL
  };
  httpd_uri_t status_options_uri = {
    .uri       = "/status",
    .method    = HTTP_OPTIONS,
    .handler   = handle_options,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = handle_capture,
    .user_ctx  = NULL
  };
  httpd_uri_t capture_options_uri = {
    .uri       = "/capture",
    .method    = HTTP_OPTIONS,
    .handler   = handle_options,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = handle_stream,
    .user_ctx  = NULL
  };
  httpd_uri_t stream_options_uri = {
    .uri       = "/stream",
    .method    = HTTP_OPTIONS,
    .handler   = handle_options,
    .user_ctx  = NULL
  };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &status_uri);
    httpd_register_uri_handler(camera_httpd, &status_options_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &capture_options_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    httpd_register_uri_handler(camera_httpd, &stream_options_uri);
    Serial.println("[HTTP Server] Multi-socket FreeRTOS server started successfully on port 80!");
  } else {
    Serial.println("[HTTP Server ERROR] Failed to start HTTP server!");
  }
}

// =========================
// Camera Setup
// =========================
bool initCamera() {
  camera_config_t config;
  memset(&config, 0, sizeof(camera_config_t));

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;

  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  bool hasPSRAM = psramFound();

  // ตรวจสอบและเลือกตำแหน่งจัดเก็บ Frame Buffer ตามสถานะ PSRAM
  if (hasPSRAM) {
    Serial.println("[Camera] PSRAM detected! Enabling dual frame-buffer in PSRAM for high performance.");
    config.frame_size = FRAMESIZE_VGA;      // 640x480 เหมาะสำหรับ YOLOv8 & Live Stream
    config.jpeg_quality = 12;               // 10-12 คุณภาพคมชัด
    config.fb_count = 2;                    // 2 Buffers เพื่อความลื่นไหลระดับ 25-30 FPS
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("==================================================================");
    Serial.println("[Camera WARNING] PSRAM is NOT ENABLED or NOT DETECTED!");
    Serial.println("To enable full hardware performance & dual buffer:");
    Serial.println("  1. In Arduino IDE, go to: Tools -> PSRAM");
    Serial.println("  2. Select 'OPI PSRAM' (or 'QSPI PSRAM' for Quad SPI boards)");
    Serial.println("Falling back to internal DRAM (Single buffer mode)...");
    Serial.println("==================================================================");

    config.frame_size = FRAMESIZE_VGA;      // ลอง VGA 1 buffer ใน DRAM
    config.jpeg_quality = 14;               // บีบอัดเพิ่มขึ้นเพื่อประหยัด RAM
    config.fb_count = 1;                    // จำกัด 1 Buffer เท่านั้นเพื่อป้องกัน Malloc Failed ใน Internal RAM
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  Serial.println("Initializing camera driver...");
  esp_err_t err = esp_camera_init(&config);

  // Fallback สำรอง: หากการ init ครั้งแรกไม่สำเร็จ (เช่น Heap ใน DRAM ไม่พอสำหรับ VGA)
  if (err != ESP_OK) {
    Serial.printf("[Camera] Primary init failed (0x%X). Attempting safe DRAM fallback (QVGA 320x240)...\n", err);
    esp_camera_deinit();
    delay(100);

    memset(&config, 0, sizeof(camera_config_t));
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 16000000;         // ปรับลด XCLK เพื่อความเสถียรของสัญญาณ
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size = FRAMESIZE_QVGA;     // 320x240 ขนาดเล็ก ใช้ RAM น้อยที่สุด
    config.jpeg_quality = 16;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("[Camera FATAL] Emergency fallback also failed (0x%X)!\n", err);
      return false;
    }
    Serial.println("[Camera] Initialized successfully in safe DRAM fallback mode (QVGA)!");
  } else {
    Serial.println("[Camera] Initialized successfully!");
  }

  // ปรับจูนเซนเซอร์ OV3660
  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }

  return true;
}

// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("Vigil ESP32-S3 AI Camera OV3660 Node");
  Serial.println("Connected to YOLOv8 Classification System");
  Serial.println("==========================================");

  // ตรวจสอบและแสดงสถานะหน่วยความจำของระบบ
  Serial.printf("Internal Free Heap: %d bytes\n", ESP.getFreeHeap());
  if (psramFound()) {
    Serial.printf("PSRAM: OK (Total: %d bytes, Free: %d bytes)\n", ESP.getPsramSize(), ESP.getFreePsram());
  } else {
    Serial.println("PSRAM: NOT FOUND or NOT ENABLED!");
    Serial.println("--> Please check Arduino IDE: Tools -> PSRAM -> 'OPI PSRAM'");
  }

  // Camera Initialization
  if (!initCamera()) {
    Serial.println("==========================================================");
    Serial.println("FATAL: Camera initialization failed!");
    Serial.println("Checklist to resolve:");
    Serial.println("  1. Arduino IDE: Tools -> PSRAM -> Set to 'OPI PSRAM'");
    Serial.println("  2. Arduino IDE: Tools -> Board -> 'ESP32S3 Dev Module'");
    Serial.println("  3. Check camera flat ribbon cable connection to the board.");
    Serial.println("System will retry in 10 seconds...");
    Serial.println("==========================================================");
    delay(10000);
    ESP.restart();
  }

  // WiFi Connection (ล็อก Static IP ให้กล้องเป็น 192.168.137.65 แบบถาวร ไม่เปลี่ยน)
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);

  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("Re-applying Static IP: 192.168.137.65...");
    WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
  } else {
    Serial.println("Static IP configured: 192.168.137.65");
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  int wifiAttempts = 30; // รอ 15 วินาที
  while (WiFi.status() != WL_CONNECTED && wifiAttempts > 0) {
    delay(500);
    Serial.print(".");
    wifiAttempts--;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected successfully!");
    Serial.print("ESP32-CAM IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi not connected yet! Starting Fallback AP with Locked IP: 192.168.137.65...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPConfig(local_IP, gateway, subnet);
    WiFi.softAP("Vigil-ESP32-CAM", "12345678");
    Serial.print("AP Mode Active - IP Address: ");
    Serial.println(WiFi.softAPIP());
  }

  // Start Multi-Socket HTTP Server
  startCameraServer();

  Serial.println("==========================================================");
  Serial.println("PERMANENT CAMERA URLS (LOCKED):");
  Serial.println("Live MJPEG Stream:      http://192.168.137.65/stream");
  Serial.println("Single Snapshot:        http://192.168.137.65/capture");
  Serial.println("Status JSON:            http://192.168.137.65/status");
  Serial.println("Multi-client Support:   YES (FreeRTOS esp_http_server)");
  Serial.println("==========================================================");
}

// =========================
// LOOP
// =========================
void loop() {
  // FreeRTOS esp_http_server runs independently in background tasks!
  // loop() เพียงคอยตรวจสอบสถานะ Wi-Fi และเชื่อมต่อใหม่หากหลุด
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 6000) {
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED && (WiFi.getMode() & WIFI_MODE_STA)) {
      Serial.println("[WiFi] Reconnecting with locked Static IP 192.168.137.65...");
      WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS);
      WiFi.reconnect();
    }
  }
  delay(100);
}