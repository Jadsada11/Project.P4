import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { detectionApi, alertsApi } from "../services/api";

const DetectionContext = createContext(null);

export const DEFAULT_IP = "192.168.137.65";
export const DEFAULT_PATH = "/stream";
export const DEFAULT_STREAM_URL = `http://${DEFAULT_IP}${DEFAULT_PATH}`;

export const buildStreamUrl = (ip, port, path) => {
  const cleanIp = (ip || "").trim();
  if (cleanIp.startsWith("http://") || cleanIp.startsWith("https://")) {
    return cleanIp;
  }
  const cleanPort = port && port.trim() ? `:${port.trim()}` : "";
  const cleanPath = path && path.trim()
    ? path.trim().startsWith("/")
      ? path.trim()
      : `/${path.trim()}`
    : DEFAULT_PATH;
  return `http://${cleanIp || DEFAULT_IP}${cleanPort}${cleanPath}`;
};

export const getStreamEndpoint = (ip, port, path, source = "direct") => {
  if (source === "proxy") {
    return detectionApi.getEsp32StreamUrl(ip, port);
  }
  return buildStreamUrl(ip, port, path);
};

export const parseStreamUrl = (url) => {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `http://${url}`);
    // If this is a proxy stream URL, extract the camera_ip and camera_port from query parameters!
    if (parsed.pathname.includes("/esp32-stream") || parsed.pathname.includes("/esp32-snapshot")) {
      const qIp = parsed.searchParams.get("camera_ip");
      const qPort = parsed.searchParams.get("camera_port");
      return {
        ip: qIp || DEFAULT_IP,
        port: qPort && qPort !== "8000" && qPort !== "80" ? qPort : "",
        path: DEFAULT_PATH,
        isProxy: true,
      };
    }
    // Direct stream URL
    const port = parsed.port && parsed.port !== "8000" && parsed.port !== "80" ? parsed.port : "";
    return {
      ip: parsed.hostname || DEFAULT_IP,
      port,
      path: parsed.pathname || DEFAULT_PATH,
      isProxy: false,
    };
  } catch {
    return { ip: DEFAULT_IP, port: "", path: DEFAULT_PATH, isProxy: false };
  }
};

export function DetectionProvider({ children }) {
  // Clean up any stale/corrupted localStorage from previous port 8000 bug
  try {
    const savedUrl = localStorage.getItem("esp32_cam_stream_url");
    if (savedUrl && (savedUrl.includes(":8000/stream") || savedUrl.includes("camera_port=8000"))) {
      localStorage.removeItem("esp32_cam_stream_url");
    }
  } catch {
    // ignore
  }

  // Camera Type: "esp32" | "webcam"
  const [activeCameraType, setActiveCameraType] = useState(() => {
    return localStorage.getItem("vigil_active_camera_type") || "esp32";
  });
  const [isWebcamActive, setIsWebcamActive] = useState(false);

  // Stream Source: "proxy" (FastAPI backend proxy - Recommended for PNA/CORS bypass) | "direct" (ESP32 direct)
  const [streamSource, setStreamSource] = useState(() => {
    const saved = localStorage.getItem("esp32_cam_stream_source");
    return saved === "direct" || saved === "proxy" ? saved : "proxy";
  });
  const [cameraIp, setCameraIp] = useState(() => {
    return localStorage.getItem("esp32_cam_ip") || DEFAULT_IP;
  });
  const [streamUrl, setStreamUrl] = useState(() => {
    const saved = localStorage.getItem("esp32_cam_stream_url");
    const source = localStorage.getItem("esp32_cam_stream_source") || "proxy";
    const ip = localStorage.getItem("esp32_cam_ip") || DEFAULT_IP;
    return saved || getStreamEndpoint(ip, "", DEFAULT_PATH, source);
  });
  const [streamMode, setStreamMode] = useState(() => {
    return localStorage.getItem("esp32_cam_mode") || "live"; // "live" | "demo"
  });
  const [streamStatus, setStreamStatus] = useState("connecting"); // "online" | "offline" | "connecting"
  const [streamKey, setStreamKey] = useState(() => Date.now());

  // Auto-detection & Audio Settings
  const [isAutoDetect, setIsAutoDetect] = useState(() => {
    const saved = localStorage.getItem("esp32_cam_auto_detect");
    return saved !== null ? saved === "true" : true;
  });
  const [autoDetectInterval, setAutoDetectInterval] = useState(3000);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("esp32_cam_sound_enabled");
    return saved !== null ? saved === "true" : true;
  });

  // Detection Processing Status
  const [isDetecting, setIsDetecting] = useState(false);
  const isDetectingRef = useRef(false);

  // Active YOLO Bounding Box Detections & Global Alert Notification
  const [activeDetections, setActiveDetections] = useState([]);
  const [alertNotification, setAlertNotification] = useState(null);

  // Tracking last alert ID seen from database to detect new background events
  const lastAlertIdRef = useRef(null);

  // Tracking current route to avoid duplicate stream connection on /detection
  const [isAtDetectionPage, setIsAtDetectionPage] = useState(() => {
    return typeof window !== "undefined" && window.location.pathname.includes("/detection");
  });

  useEffect(() => {
    const checkPath = () => {
      const onDetection = typeof window !== "undefined" && window.location.pathname.includes("/detection");
      setIsAtDetectionPage(onDetection);
    };
    checkPath();
    window.addEventListener("popstate", checkPath);
    const timer = setInterval(checkPath, 600);
    return () => {
      window.removeEventListener("popstate", checkPath);
      clearInterval(timer);
    };
  }, []);

  // Real-time Database Stats
  const [stats, setStats] = useState({
    total_today: 0,
    household_count: 0,
    delivery_count: 0,
    stranger_count: 0,
    alerts_count: 0,
  });

  // Request browser desktop notification permissions once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Dispatch Native Desktop Notification if permitted
  const sendDesktopNotification = useCallback((title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      } catch (err) {
        console.debug("Desktop notification error:", err);
      }
    }
  }, []);

  // Fetch Database Stats
  const fetchStats = useCallback(async () => {
    try {
      const s = await detectionApi.getStats();
      if (s) setStats(s);
    } catch (err) {
      console.warn("Backend stats unavailable:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Web Audio API Real-time Alert Chime Synthesizer with Autoplay Policy Resume
  const playAlertChime = useCallback((category) => {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (category === "stranger") {
        // Warning 2-tone alarm for stranger
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (category === "delivery") {
        // Double doorbell chime for courier
        osc.type = "sine";
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Gentle pleasant chime for household
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (err) {
      console.debug("Audio playback waiting for user interaction:", err);
    }
  }, [isSoundEnabled]);

  // Main Detection Runner (Works foreground on /detection AND background on all pages via persistent stream)
  const runDetection = useCallback(async () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;
    setIsDetecting(true);

    try {
      let res = null;

      // 1. If Local Webcam is active, grab frame from <video id="vigil-webcam-video">
      const webcamVideo = document.getElementById("vigil-webcam-video");
      if (activeCameraType === "webcam" && webcamVideo && webcamVideo.readyState >= 2) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = webcamVideo.videoWidth || 640;
          canvas.height = webcamVideo.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(webcamVideo, 0, 0);
          const blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.88)
          );
          if (blob && blob.size > 1000) {
            const formData = new FormData();
            formData.append("file", blob, "webcam_live_frame.jpg");
            formData.append("camera_id", "Webcam (Local PC)");
            formData.append("location", "หน้าบ้าน (Main Entrance)");
            res = await detectionApi.detectImage(formData);
          }
        } catch (webcamErr) {
          console.debug("Webcam canvas grab error:", webcamErr);
        }
      }

      // 2. If ESP32 camera is active, grab frame from visible stream image OR persistent background stream
      if (!res && activeCameraType === "esp32") {
        const streamImg =
          document.getElementById("esp32-stream-img") ||
          document.getElementById("vigil-persistent-stream-img");

        if (
          streamMode === "live" &&
          streamImg &&
          streamImg.complete &&
          streamImg.naturalWidth > 0
        ) {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = streamImg.naturalWidth || 640;
            canvas.height = streamImg.naturalHeight || 480;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(streamImg, 0, 0);
            const blob = await new Promise((resolve) =>
              canvas.toBlob(resolve, "image/jpeg", 0.88)
            );
            if (blob && blob.size > 1000) {
              const formData = new FormData();
              formData.append("file", blob, "live_stream_frame.jpg");
              formData.append("camera_id", `ESP32 (${cameraIp})`);
              formData.append("location", "หน้าบ้าน (Main Entrance)");
              res = await detectionApi.detectImage(formData);
            }
          } catch (canvasErr) {
            console.debug("Live stream canvas grab skipped (fallback to API):", canvasErr);
          }
        }
      }

      // 3. Fallback: Backend ESP32 Proxy Grab (safe and robust, filter out invalid ports)
      if (!res && activeCameraType === "esp32") {
        const parsed = parseStreamUrl(streamUrl);
        const cleanPort = parsed.port && parsed.port !== "8000" && parsed.port !== "80" ? parsed.port : "";
        res = await detectionApi.detectESP32({
          camera_ip: cameraIp,
          camera_port: cleanPort,
          camera_path: "/capture",
          location: "หน้าบ้าน (Main Entrance)",
        });
      }

      if (res && res.detections && res.detections.length > 0) {
        setActiveDetections(res.detections);
        const hasStranger = res.detections.some((d) => d.category === "stranger");
        const hasDelivery = res.detections.some((d) => d.category === "delivery");
        const primary = res.detections[0];

        const alertCategory = hasStranger ? "stranger" : hasDelivery ? "delivery" : "household";
        playAlertChime(alertCategory);

        const newAlert = {
          id: `alert-${Date.now()}`,
          category: alertCategory,
          type: hasStranger ? "warning" : hasDelivery ? "info" : "success",
          title: hasStranger
            ? `⚠️ ตรวจพบคนแปลกหน้า: ${primary.person_name}`
            : hasDelivery
            ? `📦 ตรวจพบคนส่งของ: ${primary.person_name}`
            : `🟢 ยืนยันตัวตน: ${primary.person_name}`,
          message: hasStranger
            ? `ระบบตรวจจับใบหน้า (${primary.confidence}%) ไม่ตรงกับฐานข้อมูล และได้ส่งแจ้งเตือนความปลอดภัยแล้ว`
            : hasDelivery
            ? `ตรวจพบพนักงานขนส่ง/ไรเดอร์ (${primary.confidence}%) มาถึงบริเวณหน้าบ้าน`
            : `ตรวจพบและจดจำใบหน้าของสมาชิกในบ้าน (${primary.confidence}%) อย่างปลอดภัย`,
          personName: primary.person_name,
          confidence: primary.confidence,
          isStranger: hasStranger,
          time: new Date().toLocaleTimeString("th-TH"),
          timestamp: Date.now(),
        };

        setAlertNotification(newAlert);
        sendDesktopNotification(newAlert.title, newAlert.message);

        // Real-time Badge Sync across entire app
        window.dispatchEvent(new CustomEvent("vigil-alerts-updated"));
      } else if (res && res.detections && res.detections.length === 0) {
        setActiveDetections([]);
      }

      await fetchStats();
    } catch (err) {
      console.warn("Background AI Detect check:", err?.message || err);
    } finally {
      isDetectingRef.current = false;
      setIsDetecting(false);
    }
  }, [cameraIp, streamUrl, streamMode, playAlertChime, fetchStats, sendDesktopNotification]);

  // Dual Trigger: Active Database Unread Alert Watcher
  const syncUnreadAlerts = useCallback(async () => {
    try {
      const unreadList = await alertsApi.getAlerts({ unread_only: true, limit: 1 });
      if (unreadList && unreadList.length > 0) {
        const latest = unreadList[0];
        if (lastAlertIdRef.current !== null && latest.id !== lastAlertIdRef.current) {
          lastAlertIdRef.current = latest.id;
          const alertCat = latest.category || "stranger";
          playAlertChime(alertCat);

          const dbAlert = {
            id: `db-${latest.id}`,
            category: alertCat,
            type: alertCat === "stranger" ? "warning" : alertCat === "delivery" ? "info" : "success",
            title: latest.title || (alertCat === "stranger" ? "⚠️ ตรวจพบคนแปลกหน้า" : "📦 ตรวจพบคนส่งของ"),
            message: latest.message || "ตรวจพบบุคคลบริเวณหน้าบ้าน และบันทึกเข้าระบบความปลอดภัยแล้ว",
            isStranger: alertCat === "stranger",
            time: new Date(latest.created_at).toLocaleTimeString("th-TH"),
            timestamp: Date.now(),
          };

          setAlertNotification(dbAlert);
          sendDesktopNotification(dbAlert.title, dbAlert.message);
          window.dispatchEvent(new CustomEvent("vigil-alerts-updated"));
        } else if (lastAlertIdRef.current === null) {
          lastAlertIdRef.current = latest.id;
        }
      }
    } catch (err) {
      console.debug("Unread alert sync error:", err);
    }
  }, [playAlertChime, sendDesktopNotification]);

  // Alert Sync Poller across all pages
  useEffect(() => {
    syncUnreadAlerts();
    const interval = setInterval(syncUnreadAlerts, 4000);
    return () => clearInterval(interval);
  }, [syncUnreadAlerts]);

  // Persistent Auto-detection Loop (Lives 24/7 across route changes inside MainLayout)
  useEffect(() => {
    if (!isAutoDetect) return;

    const timer = setInterval(() => {
      if (!isDetectingRef.current) {
        runDetection();
      }
    }, autoDetectInterval);

    return () => clearInterval(timer);
  }, [isAutoDetect, autoDetectInterval, runDetection]);

  // Switch to Backend Proxy Stream helper
  const switchToProxyStream = useCallback(() => {
    console.info("[Stream] Switching to Backend Proxy stream (/api/v1/detection/esp32-stream)");
    setStreamSource("proxy");
    const proxyUrl = detectionApi.getEsp32StreamUrl(cameraIp);
    setStreamUrl(proxyUrl);
    setStreamStatus("connecting");
    setStreamKey(Date.now());
    localStorage.setItem("esp32_cam_stream_source", "proxy");
    localStorage.setItem("esp32_cam_stream_url", proxyUrl);
  }, [cameraIp]);

  // Switch to Direct ESP32 Stream helper
  const switchToDirectStream = useCallback(() => {
    console.info("[Stream] Switching to Direct ESP32 stream");
    setStreamSource("direct");
    const directUrl = buildStreamUrl(cameraIp);
    setStreamUrl(directUrl);
    setStreamStatus("connecting");
    setStreamKey(Date.now());
    localStorage.setItem("esp32_cam_stream_source", "direct");
    localStorage.setItem("esp32_cam_stream_url", directUrl);
  }, [cameraIp]);

  // Camera Settings Update Helper - Supports dynamic IP and proxy/direct source
  const updateCameraSettings = useCallback((newIp, newUrl, newMode, newSource) => {
    const cleanIp = (newIp || "").trim() || DEFAULT_IP;
    const finalSource = newSource || (newUrl && newUrl.includes("/esp32-stream") ? "proxy" : "direct");
    const finalUrl = newUrl || getStreamEndpoint(cleanIp, "", DEFAULT_PATH, finalSource);
    const finalMode = newMode || "live";

    setCameraIp(cleanIp);
    setStreamSource(finalSource);
    setStreamUrl(finalUrl);
    setStreamMode(finalMode);
    setStreamStatus(finalMode === "live" ? "connecting" : "online");
    setStreamKey(Date.now());

    localStorage.setItem("esp32_cam_ip", cleanIp);
    localStorage.setItem("esp32_cam_stream_source", finalSource);
    localStorage.setItem("esp32_cam_stream_url", finalUrl);
    localStorage.setItem("esp32_cam_mode", finalMode);
  }, []);

  // Toggle Auto-Detect
  const toggleAutoDetect = useCallback(() => {
    setIsAutoDetect((prev) => {
      const next = !prev;
      localStorage.setItem("esp32_cam_auto_detect", String(next));
      return next;
    });
  }, []);

  // Toggle Sound Alerts
  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("esp32_cam_sound_enabled", String(next));
      return next;
    });
  }, []);

  // Reconnect / Refresh Stream
  const reconnectStream = useCallback(() => {
    setStreamStatus("connecting");
    setStreamKey(Date.now());
  }, []);

  // Dismiss Alert Notification
  const dismissAlert = useCallback(() => {
    setAlertNotification(null);
  }, []);

  const value = {
    cameraIp,
    streamUrl,
    streamMode,
    streamSource,
    streamStatus,
    streamKey,
    setStreamStatus,
    updateCameraSettings,
    switchToProxyStream,
    switchToDirectStream,
    reconnectStream,
    activeCameraType,
    setActiveCameraType: (type) => {
      setActiveCameraType(type);
      localStorage.setItem("vigil_active_camera_type", type);
    },
    isWebcamActive,
    setIsWebcamActive,
    isAutoDetect,
    toggleAutoDetect,
    autoDetectInterval,
    setAutoDetectInterval,
    isSoundEnabled,
    toggleSound,
    isDetecting,
    runDetection,
    activeDetections,
    setActiveDetections,
    alertNotification,
    setAlertNotification,
    dismissAlert,
    playAlertChime,
    stats,
    fetchStats,
  };

  return (
    <DetectionContext.Provider value={value}>
      {/* Persistent offscreen stream ONLY when outside /detection and on ESP32 to prevent duplicate connection lockup */}
      {activeCameraType === "esp32" && streamMode === "live" && !isAtDetectionPage && (
        <img
          id="vigil-persistent-stream-img"
          key={`persist-${streamUrl}-${streamKey}`}
          src={`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}_t=${streamKey}`}
          alt="ESP32 Background Persistent Stream"
          crossOrigin="anonymous"
          className="fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] opacity-0 pointer-events-none"
          onLoad={() => setStreamStatus("online")}
          onError={() => {
            // Auto-fallback to proxy if direct stream fails
            if (streamSource === "direct") {
              console.warn("Background stream failed via direct IP, auto-switching to proxy...");
              switchToProxyStream();
            } else {
              setStreamStatus("offline");
            }
          }}
        />
      )}
      {children}
    </DetectionContext.Provider>
  );
}

export function useDetection() {
  const context = useContext(DetectionContext);
  if (!context) {
    throw new Error("useDetection must be used within a DetectionProvider");
  }
  return context;
}
