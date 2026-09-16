import React, { useState, useEffect } from "react";
import {
  Users,
  AlertTriangle,
  Camera,
  Eye,
  EyeOff,
  Clock,
  Radio,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
  Package,
  Bell,
  Home,
  Zap,
  Volume2,
  VolumeX,
  Trash2,
<<<<<<< HEAD
=======
  Check,
  CheckCircle2,
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
} from "lucide-react";
import MetricCard from "../../components/common/MetricCard";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { Input, Textarea } from "../../components/common/Input";
import { initialVisitors } from "../../mocks/mockVisitors";
import { detectionApi, personsApi } from "../../services/api";
import {
  useDetection,
  buildStreamUrl,
  parseStreamUrl,
  DEFAULT_IP,
  DEFAULT_PATH,
} from "../../context/DetectionContext";

export default function DetectionPage() {
  const {
    cameraIp,
    streamUrl,
    streamMode,
    streamStatus,
    streamKey,
    setStreamStatus,
    updateCameraSettings,
    reconnectStream,
    isAutoDetect,
    toggleAutoDetect,
    isSoundEnabled,
    toggleSound,
    isDetecting,
    runDetection,
    activeDetections,
    alertNotification,
    dismissAlert,
    stats,
    fetchStats,
  } = useDetection();

  const [visitors, setVisitors] = useState(initialVisitors);
  const [historyCategory, setHistoryCategory] = useState("ALL");
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState("cam-1");
  const [currentTime, setCurrentTime] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  // Identify & Train Modal State
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);
  const [selectedRecordForIdentify, setSelectedRecordForIdentify] = useState(null);
  const [identifyMode, setIdentifyMode] = useState("new"); // "existing" | "new"
  const [registeredPersonsList, setRegisteredPersonsList] = useState([]);
  const [selectedExistingPersonId, setSelectedExistingPersonId] = useState("");
  const [newPersonForm, setNewPersonForm] = useState({
    name: "",
    category: "household",
    role: "Family",
    department: "ครอบครัว",
    notes: "",
  });
  const [isSubmittingIdentify, setIsSubmittingIdentify] = useState(false);
  const [identifySuccessMessage, setIdentifySuccessMessage] = useState("");

  // History Deletion States
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

<<<<<<< HEAD
  // Camera IP & Stream Configuration State
  const [cameraIp, setCameraIp] = useState(() => {
    return localStorage.getItem("esp32_cam_ip") || DEFAULT_IP;
  });
  const [streamUrl, setStreamUrl] = useState(() => {
    return localStorage.getItem("esp32_cam_stream_url") || DEFAULT_STREAM_URL;
  });
  const [streamMode, setStreamMode] = useState(() => {
    return localStorage.getItem("esp32_cam_mode") || "live"; // "live" | "demo"
  });
  const [streamSource, setStreamSource] = useState(() => {
    return localStorage.getItem("esp32_stream_source") || "proxy";
  });
  const [streamStatus, setStreamStatus] = useState("connecting"); // "online" | "offline" | "connecting"
  const [streamKey, setStreamKey] = useState(() => Date.now()); // for reconnecting/cache busting
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Stream Refs for clean teardown and stable recovery
  const streamImgRef = useRef(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const lastErrorTimeRef = useRef(0);

  // Modal temporary form states
=======
  // Camera Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
  const parsed = parseStreamUrl(streamUrl);
  const [tempIp, setTempIp] = useState(cameraIp);
  const [tempPort, setTempPort] = useState(parsed.port);
  const [tempPath, setTempPath] = useState(parsed.path || DEFAULT_PATH);
  const [tempMode, setTempMode] = useState(streamMode);
  const [tempSource, setTempSource] = useState(streamSource);

  // Active Stream URL (Direct or Backend Proxy)
  const activeStreamSrc =
    streamSource === "proxy"
      ? `${detectionApi.getEsp32StreamUrl(cameraIp, parsed.port)}&_t=${streamKey}`
      : `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}_t=${streamKey}`;

  // Real-time Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Detection History
  const fetchHistory = async () => {
    try {
      const h = await detectionApi.getHistory(historyCategory);
      if (h && Array.isArray(h)) {
        const formatted = h.map((item) => ({
          id: `hist-${item.id}`,
          rawId: item.id,
          name: item.person_name,
          role: item.category,
          confidence: item.confidence,
          time: new Date(item.timestamp).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: item.category === "stranger" ? "UNKNOWN" : "KNOWN",
          photoUrl: item.snapshot_path?.startsWith("http")
            ? item.snapshot_path
            : item.snapshot_path
            ? `http://localhost:8000${item.snapshot_path}`
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          location: item.location,
          alert_triggered: item.alert_triggered,
        }));
        setVisitors(formatted);
      }
    } catch (err) {
      console.warn("Backend history unavailable, using initial visitors:", err);
    }
  };

  // Helper to refresh both stats and history
  const fetchStatsAndHistory = async () => {
    await Promise.all([fetchHistory(), fetchStats()]);
  };

  // Sync History on Mount and when alerts/history update
  useEffect(() => {
    fetchStatsAndHistory();
    const interval = setInterval(fetchStatsAndHistory, 8000);

    const handleAlertsUpdated = () => {
      fetchStatsAndHistory();
    };
    window.addEventListener("vigil-alerts-updated", handleAlertsUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("vigil-alerts-updated", handleAlertsUpdated);
    };
  }, [historyCategory]);

<<<<<<< HEAD
  // Clean stream lifecycle management and socket teardown on unmount
  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;
    setStreamStatus("connecting");

    // Micro-delay on mount allows ESP32-CAM to cleanly terminate previous socket
    const mountTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setStreamKey(Date.now());
      }
    }, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(mountTimer);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      // Explicitly tear down image stream:
      // Setting src to empty string triggers Chromium/Firefox/WebKit to send TCP FIN/RST
      // and close the active HTTP connection, freeing the ESP32-CAM socket immediately!
      if (streamImgRef.current) {
        streamImgRef.current.onload = null;
        streamImgRef.current.onerror = null;
        streamImgRef.current.src = "";
        streamImgRef.current.removeAttribute("src");
      }
    };
  }, [streamUrl, streamSource, cameraIp]);
=======
  const handleDeleteHistoryRecord = async () => {
    if (!recordToDelete) return;
    setIsDeletingRecord(true);
    try {
      const targetId =
        recordToDelete.rawId ||
        (typeof recordToDelete.id === "string"
          ? recordToDelete.id.replace("hist-", "")
          : recordToDelete.id);
      setVisitors((prev) => prev.filter((v) => v.id !== recordToDelete.id));
      await detectionApi.deleteHistory(targetId);
      setIsDeleteRecordModalOpen(false);
      setRecordToDelete(null);
      await fetchHistory();
      await fetchStats();
      window.dispatchEvent(new CustomEvent("vigil-alerts-updated"));
    } catch (err) {
      console.error("Failed to delete detection record:", err);
      alert("เกิดข้อผิดพลาดในการลบประวัติ: " + (err.response?.data?.detail || err.message));
      await fetchHistory();
      await fetchStats();
    } finally {
      setIsDeletingRecord(false);
    }
  };

  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      setVisitors([]);
      await detectionApi.clearHistory(historyCategory !== "ALL" ? historyCategory : undefined);
      setIsClearHistoryModalOpen(false);
      await fetchHistory();
      await fetchStats();
      window.dispatchEvent(new CustomEvent("vigil-alerts-updated"));
    } catch (err) {
      console.error("Failed to clear detection history:", err);
      alert("เกิดข้อผิดพลาดในการล้างประวัติ: " + (err.response?.data?.detail || err.message));
      await fetchHistory();
      await fetchStats();
    } finally {
      setIsClearingHistory(false);
    }
  };
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2

  // Sync modal form when opening
  const handleOpenSettings = () => {
    const currentParsed = parseStreamUrl(streamUrl);
    setTempIp(cameraIp);
    setTempPort(currentParsed.port);
    setTempPath(currentParsed.path || DEFAULT_PATH);
    setTempMode(streamMode);
    setTempSource(streamSource);
    setIsSettingsOpen(true);
  };

  const handleStreamLoad = () => {
    if (!isMountedRef.current) return;
    consecutiveErrorsRef.current = 0;
    retryCountRef.current = 0;
    setStreamStatus("online");
  };

  const handleStreamError = () => {
    if (!isMountedRef.current) return;
    const now = Date.now();

    // Debounce transient frame packet hiccups in MJPEG streams
    if (now - lastErrorTimeRef.current < 2500) {
      consecutiveErrorsRef.current += 1;
    } else {
      consecutiveErrorsRef.current = 1;
    }
    lastErrorTimeRef.current = now;

    // Only initiate reconnect if multiple consecutive errors confirm the stream actually severed
    if (consecutiveErrorsRef.current >= 4) {
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        consecutiveErrorsRef.current = 0;
        console.warn(`[ESP32 Stream] Recovering dropped stream (attempt ${retryCountRef.current}/3)...`);

        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setStreamKey(Date.now());
          }
        }, 1200);
      } else {
        setStreamStatus("offline");
      }
    }
  };

  // Reconnect / refresh stream
  const handleReconnect = () => {
<<<<<<< HEAD
    retryCountRef.current = 0;
    consecutiveErrorsRef.current = 0;
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setStreamStatus("connecting");
    setStreamKey(Date.now());
  };

  const handleToggleStreamSource = (newSource) => {
    const src = newSource || (streamSource === "direct" ? "proxy" : "direct");
    setStreamSource(src);
    localStorage.setItem("esp32_stream_source", src);
    retryCountRef.current = 0;
    consecutiveErrorsRef.current = 0;
    setStreamStatus("connecting");
    setStreamKey(Date.now());
=======
    reconnectStream();
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
  };

  // Save Settings - Permanently locked to 192.168.137.65 /stream
  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
<<<<<<< HEAD
    const newUrl = buildStreamUrl(tempIp, tempPort, tempPath);
    const cleanIp =
      tempIp.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0] ||
      DEFAULT_IP;

    setCameraIp(cleanIp);
    setStreamUrl(newUrl);
    setStreamMode(tempMode);
    setStreamSource(tempSource);
    setStreamStatus(tempMode === "live" ? "connecting" : "online");
    setStreamKey(Date.now());

    localStorage.setItem("esp32_cam_ip", cleanIp);
    localStorage.setItem("esp32_cam_stream_url", newUrl);
    localStorage.setItem("esp32_cam_mode", tempMode);
    localStorage.setItem("esp32_stream_source", tempSource);

=======
    updateCameraSettings(DEFAULT_IP, DEFAULT_STREAM_URL, tempMode);
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
    setIsSettingsOpen(false);
  };

  // Apply quick presets - Always enforces 192.168.137.65 /stream
  const applyPreset = () => {
    setTempIp(DEFAULT_IP);
    setTempPort("");
    setTempPath(DEFAULT_PATH);
  };

  // Snapshot Button
  const handleTakeSnapshot = () => {
    setIsCapturing(true);
    if (streamMode === "live" && streamStatus === "online") {
      try {
        const captureUrl = `http://${cameraIp}/capture?t=${Date.now()}`;
        const link = document.createElement("a");
        link.href = captureUrl;
        link.download = `esp32_capture_${Date.now()}.jpg`;
        link.target = "_blank";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.warn("Could not auto-download snapshot:", err);
      }
    }

    setTimeout(() => {
      setIsCapturing(false);
      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 3000);
    }, 500);
  };

  // Manual Trigger Detection Button
  const handleRunYoloDetection = async () => {
<<<<<<< HEAD
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;
    setIsDetecting(true);

    try {
      let res = null;

      // 1. Try grabbing the live video frame directly from visible image in browser (zero extra network hit on ESP32)
      const streamImg = streamImgRef.current || document.getElementById("esp32-stream-img");
      if (
        streamMode === "live" &&
        streamStatus === "online" &&
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
          const blob = await new Promise((resolve, reject) => {
            try {
              canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Empty blob"))), "image/jpeg", 0.88);
            } catch (err) {
              reject(err);
            }
          });
          if (blob && blob.size > 1000) {
            const formData = new FormData();
            formData.append("file", blob, "live_stream_frame.jpg");
            formData.append("camera_id", `ESP32 (${cameraIp})`);
            formData.append("location", "หน้าบ้าน (Main Entrance)");
            res = await detectionApi.detectImage(formData);
          }
        } catch (canvasErr) {
          // If canvas frame grab was skipped or tainted, gently continue without hitting ESP32
          console.debug("Live stream canvas grab skipped:", canvasErr?.message);
        }
      }

      // 2. Fallback to direct backend ESP32 proxy detect ONLY IF not currently live streaming
      // (because hitting /capture on ESP32 while /stream is active severs the live stream!)
      if (!res && streamMode !== "live") {
        res = await detectionApi.detectESP32({
          camera_ip: cameraIp,
          camera_port: tempPort || "",
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

        if (hasStranger) {
          setAlertNotification({
            type: "warning",
            title: `⚠️ ตรวจพบคนแปลกหน้า: ${primary.person_name}`,
            message: `ระบบตรวจจับใบหน้า (${primary.confidence}%) ไม่ตรงกับฐานข้อมูล และได้ส่งแจ้งเตือนความปลอดภัยแล้ว`,
            isStranger: true,
            time: new Date().toLocaleTimeString("th-TH"),
          });
        } else if (hasDelivery) {
          setAlertNotification({
            type: "info",
            title: `📦 ตรวจพบคนส่งของ: ${primary.person_name}`,
            message: `ตรวจพบพนักงานขนส่ง/ไรเดอร์ (${primary.confidence}%) มาถึงบริเวณหน้าบ้าน`,
            isStranger: false,
            time: new Date().toLocaleTimeString("th-TH"),
          });
        } else {
          setAlertNotification({
            type: "success",
            title: `🟢 ยืนยันตัวตน: ${primary.person_name}`,
            message: `ตรวจพบและจดจำใบหน้าของสมาชิกในบ้าน (${primary.confidence}%) อย่างปลอดภัย`,
            isStranger: false,
            time: new Date().toLocaleTimeString("th-TH"),
          });
        }

        window.dispatchEvent(new Event("vigil-alerts-updated"));
        setTimeout(() => setAlertNotification(null), 6000);
      }

      await fetchStatsAndHistory();
    } catch (err) {
      console.error("YOLO Detect error:", err);
    } finally {
      isDetectingRef.current = false;
      setIsDetecting(false);
    }
  };

  // Continuous Auto AI Detect Loop (Non-blocking and never cancels)
  useEffect(() => {
    if (!isAutoDetect) return;

    const timer = setInterval(async () => {
      if (!isDetectingRef.current) {
        await handleRunYoloDetection();
      }
    }, autoDetectInterval);

    return () => clearInterval(timer);
  }, [isAutoDetect, autoDetectInterval, cameraIp, tempPort, streamMode]);

=======
    await runDetection();
    await fetchHistory();
  };

>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
  // Open Identify & Train Modal for a visitor record
  const handleOpenIdentifyModal = async (record) => {
    setSelectedRecordForIdentify(record);
    const isStranger = record.role === "stranger" || record.name?.includes("แปลกหน้า") || record.name?.includes("Stranger");
    setIdentifyMode(isStranger ? "new" : "existing");
    setNewPersonForm({
      name: isStranger ? "" : record.name || "",
      category: record.role === "delivery" ? "delivery" : "household",
      role: record.role === "delivery" ? "Delivery" : "Family",
      department: record.role === "delivery" ? "ขนส่งพัสดุ" : "ครอบครัว",
      notes: `ระบุตัวตนจากภาพถ่ายกล้องสด บันทึกเมื่อ ${record.time || new Date().toLocaleTimeString("th-TH")}`,
    });
    setIdentifySuccessMessage("");
    setIsIdentifyModalOpen(true);

    try {
      const pList = await personsApi.getPersons();
      if (pList && Array.isArray(pList)) {
        setRegisteredPersonsList(pList);
        if (pList.length > 0) {
          setSelectedExistingPersonId(pList[0].id);
        }
      }
    } catch (e) {
      console.warn("Could not fetch persons list:", e);
    }
  };

  // Submit Identify & Train Request
  const handleSaveIdentify = async (e) => {
    if (e) e.preventDefault();
    if (!selectedRecordForIdentify) return;

    setIsSubmittingIdentify(true);
    try {
      const rawId = selectedRecordForIdentify.id.toString().replace("hist-", "");
      let payload = {};

      if (identifyMode === "existing") {
        if (!selectedExistingPersonId) {
          alert("กรุณาเลือกบุคคลที่ต้องการเชื่อมโยง");
          setIsSubmittingIdentify(false);
          return;
        }
        payload = {
          mode: "existing",
          person_id: parseInt(selectedExistingPersonId, 10),
        };
      } else {
        if (!newPersonForm.name.trim()) {
          alert("กรุณากรอกชื่อ-นามสกุล");
          setIsSubmittingIdentify(false);
          return;
        }
        payload = {
          mode: "new",
          name: newPersonForm.name.trim(),
          category: newPersonForm.category,
          role: newPersonForm.role,
          department: newPersonForm.department,
          notes: newPersonForm.notes,
        };
      }

      const res = await detectionApi.identifyPerson(rawId, payload);
      setIdentifySuccessMessage(res.message || "บันทึกและส่งเทรนโมเดลเรียบร้อยแล้ว!");
      window.dispatchEvent(new Event("vigil-alerts-updated"));

      // Update visitor item in state immediately
      setVisitors((prev) =>
        prev.map((v) =>
          v.id === selectedRecordForIdentify.id
            ? {
                ...v,
                name: res.person_name,
                role: res.category,
                status: res.category === "stranger" ? "UNKNOWN" : "KNOWN",
              }
            : v
        )
      );

      await fetchHistory();
      await fetchStats();

      setTimeout(() => {
        setIsIdentifyModalOpen(false);
        setIdentifySuccessMessage("");
      }, 1400);
    } catch (err) {
      console.error("Failed to identify person:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmittingIdentify(false);
    }
  };

  // Delete individual detection history record
  const handleDeleteHistory = async (e, visitor) => {
    e.stopPropagation();
    if (!window.confirm(`คุณต้องการลบประวัติการตรวจจับของ '${visitor.name}' นี้หรือไม่?`)) return;

    const rawId = visitor.id.toString().replace("hist-", "");
    // Optimistic UI update
    setVisitors((prev) => prev.filter((v) => v.id !== visitor.id));

    try {
      await detectionApi.deleteHistory(rawId);
      const s = await detectionApi.getStats();
      if (s) setStats(s);
    } catch (err) {
      console.warn("Failed to delete history on server:", err);
      fetchStatsAndHistory();
    }
  };

  // Clear all detection history records (or for current filtered category)
  const handleClearHistory = async () => {
    const isFiltered = historyCategory !== "ALL";
    const count = visitors.length;
    if (count === 0) return;

    const confirmMsg = isFiltered
      ? `คุณต้องการล้างประวัติในหมวดหมู่นี้ทั้งหมด (${count} รายการ) หรือไม่?`
      : `คุณต้องการล้างประวัติการตรวจจับทั้งหมด (${count} รายการ) หรือไม่?`;

    if (!window.confirm(confirmMsg)) return;

    // Optimistic UI update
    setVisitors([]);

    try {
      await detectionApi.clearHistory(isFiltered ? historyCategory : "");
      const s = await detectionApi.getStats();
      if (s) setStats(s);
    } catch (err) {
      console.warn("Failed to clear history on server:", err);
      fetchStatsAndHistory();
    }
  };

  const cameras = [
    {
      id: "cam-1",
      name: `CAM 01 — Main Entrance (ESP32-CAM: ${cameraIp})`,
      status: streamStatus === "online" ? "ONLINE" : streamMode === "demo" ? "DEMO" : "OFFLINE",
      fps: 30,
    },
    { id: "cam-2", name: "CAM 02 — Office Turnstile (IP Cam)", status: "ONLINE", fps: 28 },
    { id: "cam-3", name: "CAM 03 — Perimeter Fence (ESP32)", status: "ONLINE", fps: 25 },
  ];

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
              Live Detection & Monitoring
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#26a69a]/15 text-[#00796b] border border-[#80cbc4]">
              YOLOv8 Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6b6b6b]">
            ระบบจำแนกบุคคล 3 กลุ่ม: คนในบ้าน • คนส่งของ • คนแปลกหน้า พร้อมบันทึกประวัติลงฐานข้อมูล
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#e8e0d5] text-xs font-semibold shadow-2xs">
            <Radio className="w-4 h-4 text-[#2e7d32] animate-pulse" />
            <span className="text-[#1a1a1a]">SQLite Database: CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Alert Banner Notification */}
      {alertNotification && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300 ${
            alertNotification.type === "warning"
              ? "bg-[#fff3e0] border-[#ffb74d] text-[#e65100]"
              : alertNotification.type === "info"
              ? "bg-[#e3f2fd] border-[#90caf9] text-[#1565c0]"
              : "bg-[#e8f5e9] border-[#a5d6a7] text-[#2e7d32]"
          }`}
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 shrink-0" />
            <div>
              <strong className="text-xs sm:text-sm font-bold block">
                {alertNotification.title}
              </strong>
              <span className="text-xs opacity-90">{alertNotification.message}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alertNotification.isStranger && (
              <button
                type="button"
                onClick={() => {
                  const strangerVisitor = visitors.find((v) => v.role === "stranger") || visitors[0];
                  if (strangerVisitor) handleOpenIdentifyModal(strangerVisitor);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e65100] text-white hover:bg-[#bf360c] cursor-pointer shadow-xs transition-all animate-pulse"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ระบุตัวตนคนนี้ทันที</span>
              </button>
            )}
            <button
              onClick={dismissAlert}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white text-[#1a1a1a] cursor-pointer transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* 4 Core Classification Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="คนในบ้าน (Household)"
          value={stats.household_count}
          subtitle="สมาชิกในครอบครัวที่ลงทะเบียน"
          icon={Home}
          trend="ผ่านการตรวจสอบปลอดภัย"
          color="green"
        />
        <MetricCard
          title="คนส่งของ (Delivery)"
          value={stats.delivery_count}
          subtitle="พัสดุและไรเดอร์ขนส่ง"
          icon={Package}
          trend="แจ้งเตือนรับพัสดุอัตโนมัติ"
          color="peach"
        />
        <MetricCard
          title="คนแปลกหน้า (Stranger)"
          value={stats.stranger_count}
          subtitle="ไม่พบในฐานข้อมูล / เฝ้าระวัง"
          icon={AlertTriangle}
          trend="Security Alerts Triggered"
          color="red"
        />
        <MetricCard
          title="ตรวจจับทั้งหมดวันนี้"
          value={stats.total_today}
          subtitle={`ประวัติทั้งหมดบันทึกลง SQLite`}
          icon={Users}
          trend={`แจ้งเตือนแล้ว ${stats.alerts_count} รายการ`}
          color="cyan"
        />
      </div>

      {/* Main Monitoring Section: Camera Feed + Recent Visitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Live Stream (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#e8e0d5] shadow-xs flex flex-col gap-4">
            {/* Camera Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e8e0d5]">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="bg-[#f7f1e9] border border-[#e8e0d5] text-xs font-bold text-[#1a1a1a] rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:border-[#e8b48a]"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Connection Status Badge */}
                {streamMode === "demo" ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#fff3e0] text-[#e65100] px-2.5 py-1 rounded-md border border-[#ffe0b2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e65100]" />
                    DEMO MODE
                  </span>
                ) : streamStatus === "online" ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#e8f5e9] text-[#2e7d32] px-2.5 py-1 rounded-md border border-[#a5d6a7]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-ping" />
                    ONLINE
                  </span>
                ) : streamStatus === "connecting" ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#e3f2fd] text-[#1565c0] px-2.5 py-1 rounded-md border border-[#bbdefb]">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    CONNECTING...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[#ffebee] text-[#c62828] px-2.5 py-1 rounded-md border border-[#ffcdd2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c62828]" />
                    OFFLINE
                  </span>
                )}

                {/* Stream Mode Toggle Badge (Direct IP vs Backend Proxy) */}
                {streamMode === "live" && (
                  <button
                    type="button"
                    onClick={() => handleToggleStreamSource()}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                      streamSource === "proxy"
                        ? "bg-[#e0f2f1] text-[#00796b] border-[#80cbc4] hover:bg-[#b2dfdb]"
                        : "bg-[#f7f1e9] text-[#6b6b6b] border-[#e8e0d5] hover:text-[#1a1a1a]"
                    }`}
                    title={
                      streamSource === "proxy"
                        ? "กำลังสตรีมผ่าน Backend Proxy (คลิกเพื่อสลับเป็น Direct IP)"
                        : "กำลังสตรีมแบบ Direct IP (คลิกเพื่อสลับเป็น Backend Proxy)"
                    }
                  >
                    <span>{streamSource === "proxy" ? "Proxy Mode" : "Direct IP"}</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Auto AI Detect Live Toggle */}
                <button
                  type="button"
                  onClick={toggleAutoDetect}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                    isAutoDetect
                      ? "bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7] hover:bg-[#c8e6c9]"
                      : "bg-white text-[#6b6b6b] border-[#e8e0d5] hover:text-[#1a1a1a]"
                  }`}
                  title={isAutoDetect ? "คลิกเพื่อปิดการตรวจจับอัตโนมัติ" : "คลิกเพื่อเปิดการตรวจจับอัตโนมัติขณะ Live Stream"}
                >
                  <span className={`w-2 h-2 rounded-full ${isAutoDetect ? "bg-[#2e7d32] animate-ping" : "bg-neutral-400"}`} />
                  <Zap className="w-3.5 h-3.5" />
                  <span>Auto AI: {isAutoDetect ? "ON (สด)" : "OFF"}</span>
                </button>

                {/* Sound Alert Toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                    isSoundEnabled
                      ? "bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7] hover:bg-[#c8e6c9]"
                      : "bg-white text-neutral-400 border-[#e8e0d5] hover:text-[#1a1a1a]"
                  }`}
                  title={isSoundEnabled ? "เสียงแจ้งเตือนเปิดอยู่ (คลิกเพื่อปิด)" : "เสียงแจ้งเตือนปิดอยู่ (คลิกเพื่อเปิดเสียง)"}
                >
                  {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#2e7d32]" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>เสียงแจ้งเตือน: {isSoundEnabled ? "เปิด" : "ปิด"}</span>
                </button>

                {/* YOLO Detect Now Button */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunYoloDetection}
                  disabled={isDetecting}
                  icon={Sparkles}
                  className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white border-none shadow-sm"
                >
                  <span className="font-bold">
                    {isDetecting ? "กำลังประมวลผล YOLO..." : "ตรวจจับด้วย YOLO AI"}
                  </span>
                </Button>

                {/* IP Settings Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenSettings}
                  icon={SlidersHorizontal}
                >
                  <span className="hidden sm:inline">ตั้งค่า IP</span>
                </Button>

                {/* Reconnect / Reload Stream Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReconnect}
                  title="รีเฟรชการเชื่อมต่อสตรีม"
                  icon={RefreshCw}
                >
                  <span className="hidden md:inline">รีเฟรช</span>
                </Button>

                {/* Bounding Box Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBoxes(!showBoxes)}
                  icon={showBoxes ? Eye : EyeOff}
                >
                  <span className="hidden sm:inline">Bounding Boxes</span>
                </Button>

                {/* Snapshot Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTakeSnapshot}
                  disabled={isCapturing}
                  icon={Camera}
                >
                  <span className="hidden sm:inline">
                    {isCapturing ? "บันทึกภาพ..." : "Snapshot"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Live Video Display Container */}
            <div className="relative rounded-2xl overflow-hidden bg-[#141414] aspect-16/10 flex items-center justify-center select-none group">
              {/* Camera Video Stream Frame */}
              {streamMode === "live" ? (
                <img
                  id="esp32-stream-img"
                  ref={streamImgRef}
                  crossOrigin={streamSource === "proxy" ? "anonymous" : undefined}
                  src={activeStreamSrc}
                  alt="ESP32-CAM Live MJPEG Stream"
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    streamStatus === "offline" ? "opacity-15" : "opacity-100"
                  }`}
                  onLoad={handleStreamLoad}
                  onError={handleStreamError}
                />
              ) : (
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=80"
                  alt="Demo Camera Feed"
                  className="w-full h-full object-cover opacity-90 transition-all duration-300"
                />
              )}

              {/* Connecting Mini Overlay */}
              {streamMode === "live" && streamStatus === "connecting" && (
                <div className="absolute top-4 right-4 bg-black/75 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs flex items-center gap-2 z-10 animate-in fade-in">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f5c9a8]" />
                  <span>กำลังเชื่อมต่อกล้อง... {retryCountRef.current > 0 ? `(ลองครั้งที่ ${retryCountRef.current}/3)` : ""}</span>
                </div>
              )}

              {/* OFFLINE / CONNECTION ERROR OVERLAY */}
              {streamMode === "live" && streamStatus === "offline" && (
                <div className="absolute inset-0 bg-[#0c0e12]/92 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
                  <div className="w-14 h-14 rounded-2xl bg-[#c62828]/15 border border-[#c62828]/30 flex items-center justify-center mb-3">
                    <Radio className="w-7 h-7 text-[#ef5350]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
                    ไม่สามารถเชื่อมต่อกล้อง ESP32-CAM ได้
                  </h3>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-[#f5c9a8] bg-black/60 px-3.5 py-1.5 rounded-lg border border-white/10 mb-3 max-w-full overflow-hidden text-ellipsis">
                    <span>{streamSource === "proxy" ? `[Proxy Mode] ${cameraIp}` : streamUrl}</span>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/60 hover:text-white"
                      title="เปิดในแท็บใหม่"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-white/70 max-w-md mb-5 leading-relaxed">
                    กรุณาตรวจสอบว่า ESP32 เปิดทำงานและเชื่อมต่อ Wi-Fi วงเดียวกัน (IP: {cameraIp})
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={handleReconnect}
                    >
                      ลองเชื่อมต่อใหม่ (Retry)
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Radio}
                      className="bg-[#26a69a] hover:bg-[#00897b] text-white border-none"
                      onClick={() => handleToggleStreamSource()}
                    >
                      {streamSource === "direct" ? "ลองสตรีมผ่าน Backend Proxy" : "ลองสตรีมตรง (Direct IP)"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={SlidersHorizontal}
                      onClick={handleOpenSettings}
                    >
                      เปลี่ยน IP กล้อง
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-white border-white/30 hover:bg-white/10"
                      onClick={() => {
                        setStreamMode("demo");
                        localStorage.setItem("esp32_cam_mode", "demo");
                      }}
                    >
                      ใช้โหมดจำลอง (Demo Mode)
                    </Button>
                  </div>
                </div>
              )}

              {/* DEMO MODE NOTICE PILL */}
              {streamMode === "demo" && (
                <div className="absolute top-4 inset-x-0 mx-auto w-max bg-[#1a1a1a]/85 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[11px] font-medium flex items-center gap-2 z-10 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-[#f5c9a8]" />
                  <span>กำลังแสดงภาพตัวอย่าง (Demo Feed)</span>
                  <button
                    onClick={() => {
                      setStreamMode("live");
                      setStreamStatus("connecting");
                      localStorage.setItem("esp32_cam_mode", "live");
                    }}
                    className="ml-1 text-[#f5c9a8] underline hover:text-white cursor-pointer font-bold"
                  >
                    สลับไปสตรีมสด ESP32
                  </button>
                </div>
              )}

              {/* HUD Overlay - Top Left */}
              <div className="absolute top-4 left-4 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white flex items-center gap-3 text-xs font-mono z-10">
                <div className="flex items-center gap-1.5 text-[#c62828] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#c62828] animate-pulse" />
                  <span>AI REC</span>
                </div>
                <div className="flex items-center gap-1 text-white/80">
                  <Clock className="w-3.5 h-3.5 text-[#f5c9a8]" />
                  <span>{currentTime || "10:42:18"}</span>
                </div>
                <span className="text-[#26a69a] font-semibold">
                  {streamMode === "live" ? "VGA (640x480)" : "30 FPS"}
                </span>
                <span className="text-white/60 hidden sm:inline">
                  {streamMode === "live" ? cameraIp : "SIMULATED"}
                </span>
              </div>

              {/* HUD Overlay - Top Right Status */}
              <div className="absolute top-4 right-4 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-[11px] font-mono z-10 flex items-center gap-2">
                <span>MODEL:</span>
                <span className="text-[#f5c9a8] font-bold">YOLOv8 + 3-Class AI</span>
              </div>

              {/* LIVE STREAM AUTO DETECT ACTIVE PILL */}
              {isAutoDetect && (
                <div className="absolute top-4 inset-x-0 mx-auto w-max bg-black/80 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#4ade80]/40 text-white text-[11px] font-bold flex items-center gap-2 z-10 shadow-lg animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                  <span>AI LIVE STREAM DETECTION ACTIVE</span>
                  {isDetecting && <RefreshCw className="w-3 h-3 animate-spin text-[#f5c9a8]" />}
                </div>
              )}

              {/* DYNAMIC YOLO BOUNDING BOXES FOR PERSON CLASSIFICATION */}
              {showBoxes &&
                activeDetections.map((det, index) => {
                  const isHousehold = det.category === "household";
                  const isDelivery = det.category === "delivery";
                  const isStranger = det.category === "stranger";

                  const borderColor = isHousehold
                    ? "border-[#4ade80]"
                    : isDelivery
                    ? "border-[#fbbf24]"
                    : "border-[#f87171]";

                  const shadowColor = isHousehold
                    ? "shadow-[0_0_20px_rgba(74,222,128,0.7)]"
                    : isDelivery
                    ? "shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                    : "shadow-[0_0_20px_rgba(248,113,113,0.8)]";

                  const tagBg = isHousehold
                    ? "bg-[#2e7d32] text-white"
                    : isDelivery
                    ? "bg-[#f57f17] text-white"
                    : "bg-[#c62828] text-white";

                  const categoryLabel = isHousehold
                    ? "คนในบ้าน (Household)"
                    : isDelivery
                    ? "คนส่งของ (Delivery)"
                    : "คนแปลกหน้า (Stranger)";

                  let boxStyle = { top: "16%", left: "26%", width: "48%", height: "60%" };
                  if (det.bounding_box && Array.isArray(det.bounding_box) && det.bounding_box.length === 4) {
                    const [x1, y1, x2, y2] = det.bounding_box;
                    const l = Math.max(2, Math.min(85, (x1 / 640) * 100));
                    const t = Math.max(2, Math.min(85, (y1 / 480) * 100));
                    const w = Math.max(12, Math.min(94, ((x2 - x1) / 640) * 100));
                    const h = Math.max(15, Math.min(94, ((y2 - y1) / 480) * 100));
                    boxStyle = { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` };
                  }

                  return (
                    <div
                      key={index}
                      style={boxStyle}
                      className={`absolute border-2 ${borderColor} ${shadowColor} rounded-xl flex flex-col justify-between p-2.5 pointer-events-none transition-all duration-300 animate-in fade-in z-10`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm border border-white/20">
                          {det.person_name}
                        </span>
                        <span className={`${tagBg} text-[10px] font-bold px-2 py-0.5 rounded shadow-xs`}>
                          {categoryLabel} • {det.confidence}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-white bg-black/75 px-2 py-1 rounded backdrop-blur-xs">
                        <span>Zone: {det.location || "หน้าบ้าน"}</span>
                        <span className={isStranger ? "text-[#f87171] font-bold" : "text-[#4ade80] font-bold"}>
                          {isStranger ? "ALERT RECORDED" : "VERIFIED OK"}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Snapshot Toast notification within view */}
              {snapshotSuccess && (
                <div className="absolute bottom-4 inset-x-6 bg-[#2e7d32] text-white py-2 px-4 rounded-xl text-center text-xs font-bold shadow-lg animate-in fade-in duration-200 z-30">
                  บันทึกภาพ Snapshot สำเร็จเรียบร้อย!
                </div>
              )}
            </div>

            {/* Camera Bottom Telemetry Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#6b6b6b] pt-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span>
                  Source:{" "}
                  <strong className="text-[#1a1a1a] font-mono">
                    {streamMode === "live" ? streamUrl : "Demo Mock Stream"}
                  </strong>
                </span>
                {streamMode === "live" && (
                  <div className="flex items-center gap-2">
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#e65100] hover:underline font-semibold"
                    >
                      <span>Open Stream</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span>•</span>
                    <a
                      href={`http://${cameraIp}/capture`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#2e7d32] hover:underline font-semibold"
                    >
                      <span>Snapshot (/capture)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <span>•</span>
                <span>OV3660 AI Camera</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenSettings}
                  className="text-xs font-semibold text-[#1a1a1a] hover:text-[#e65100] underline cursor-pointer"
                >
                  ตั้งค่า IP
                </button>
                <span className="font-mono text-[#26a69a]">YOLO Latency: ~32ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Visitors & Classification Feed (1 Col) */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-3xl p-5 border border-[#e8e0d5] shadow-xs flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between border-b border-[#e8e0d5] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1a1a1a]">
                  Recent Detection History
                </h2>
                <p className="text-xs text-[#6b6b6b]">ประวัติจำแนกบุคคลจากฐานข้อมูล SQLite</p>
              </div>
              <div className="flex items-center gap-2">
                {visitors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearHistoryModalOpen(true)}
                    className="p-1.5 rounded-xl text-[#9e9e9e] hover:text-[#c62828] hover:bg-[#ffebee] border border-transparent hover:border-[#ef9a9a] transition-all cursor-pointer"
                    title="ล้างประวัติทั้งหมด"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <span className="text-xs font-bold bg-[#f7f1e9] text-[#1a1a1a] px-2.5 py-1 rounded-lg border border-[#e8e0d5]">
                  {visitors.length} Logs
                </span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "ALL", label: "ทั้งหมด" },
                { id: "household", label: "คนในบ้าน" },
                { id: "delivery", label: "คนส่งของ" },
                { id: "stranger", label: "คนแปลกหน้า" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setHistoryCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    historyCategory === cat.id
                      ? "bg-[#f5c9a8] text-[#1a1a1a] shadow-xs"
                      : "bg-[#f7f1e9] text-[#6b6b6b] hover:text-[#1a1a1a]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Visitor List */}
            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[460px] pr-1">
              {visitors.map((visitor) => (
                <div
                  key={visitor.id}
                  className="p-3 rounded-2xl bg-[#f7f1e9]/60 hover:bg-[#f7f1e9] border border-[#e8e0d5] transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={visitor.photoUrl}
                      alt={visitor.name}
                      className="w-11 h-11 rounded-xl object-cover border border-[#e8e0d5] shadow-2xs shrink-0"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#1a1a1a] line-clamp-1">
                        {visitor.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6b6b6b]">
                        <span>{visitor.time}</span>
                        <span>•</span>
                        <span className="line-clamp-1">{visitor.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={visitor.role}>{visitor.role}</Badge>
                      <span className="text-[10px] font-mono text-[#6b6b6b]">
                        {visitor.confidence}%
                      </span>
                    </div>
<<<<<<< HEAD
                    <div className="flex items-center gap-1">
=======
                    <div className="flex items-center gap-1.5">
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
                      <button
                        type="button"
                        onClick={() => handleOpenIdentifyModal(visitor)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-2xs border ${
                          visitor.role === "stranger"
                            ? "bg-[#fff3e0] hover:bg-[#ffe0b2] text-[#e65100] border-[#ffb74d] animate-pulse"
                            : "bg-white hover:bg-[#f5c9a8]/30 text-[#1a1a1a] border-[#e8e0d5]"
                        }`}
                        title="ระบุตัวตนและบันทึกภาพนี้เข้าสู่ระบบโมเดล AI"
                      >
                        <Sparkles className="w-3 h-3 text-[#e65100]" />
                        <span>{visitor.role === "stranger" ? "ระบุตัวตน & เทรน" : "เทรนข้อมูลเพิ่ม"}</span>
                      </button>

                      <button
                        type="button"
<<<<<<< HEAD
                        onClick={(e) => handleDeleteHistory(e, visitor)}
                        className="p-1 rounded-lg text-neutral-400 hover:text-[#c62828] hover:bg-[#ffebee] border border-transparent hover:border-[#ffcdd2] transition-all cursor-pointer"
                        title="ลบประวัติตรวจจับนี้"
=======
                        onClick={() => {
                          setRecordToDelete(visitor);
                          setIsDeleteRecordModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl text-[#9e9e9e] hover:text-[#c62828] hover:bg-[#ffebee] border border-transparent hover:border-[#ef9a9a] transition-all cursor-pointer"
                        title="ลบรายการนี้"
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {visitors.length === 0 && (
                <div className="text-center py-10 text-xs text-[#6b6b6b]">
                  ไม่มีข้อมูลประวัติในหมวดหมู่นี้
                </div>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-[#e8e0d5] text-center flex items-center justify-between text-xs text-[#6b6b6b]">
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchStatsAndHistory}
                  className="text-[#e65100] font-bold hover:underline cursor-pointer"
                >
                  รีเฟรชประวัติ
                </button>
                {visitors.length > 0 && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleClearHistory}
                      className="text-[#c62828] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      title="ล้างประวัติการตรวจจับทั้งหมด"
                    >
                      <Trash2 className="w-3 h-3 text-[#c62828]" />
                      <span>ล้างประวัติ</span>
                    </button>
                  </>
                )}
              </div>
              <span className="text-[11px]">Auto-synced SQLite</span>
            </div>
          </div>
        </div>
      </div>

      {/* IP & CAMERA STREAM CONFIGURATION MODAL */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="ตั้งค่าการเชื่อมต่อกล้อง ESP32-CAM"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
          {/* Fixed Camera Stream Banner */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">
              ค่าสตรีมกล้องที่ล็อกคงที่ (Permanent Fixed Stream)
            </span>
            <div className="p-3.5 rounded-2xl border border-[#e8b48a] bg-[#f5c9a8]/20 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2e7d32] animate-pulse" />
                  <span className="text-xs font-bold text-[#1a1a1a]">DFRobot ESP32-S3 AI Camera (OV3660)</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#e65100]">
                  http://192.168.137.65/stream
                </span>
                <span className="text-[11px] text-[#6b6b6b]">
                  กำหนด Static IP 192.168.137.65 แบบถาวร ไม่เปลี่ยนแม้รีสตาร์ตกล้อง
                </span>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-[#2e7d32] text-white flex items-center gap-1 shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>LOCKED</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Input
              label="IP Address กล้อง ESP32 (ล็อกคงที่)"
              value="192.168.137.65"
              disabled
              placeholder="192.168.137.65"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Port"
                value="80 (Default)"
                disabled
                placeholder="80"
              />
              <Input
                label="Path ของสตรีม (ล็อกคงที่)"
                value="/stream"
                disabled
                placeholder="/stream"
              />
            </div>

            {/* Stream Connection Mode Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                ช่องทางการรับสตรีม (Stream Method)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTempSource("direct")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tempSource === "direct"
                      ? "border-[#e8b48a] bg-[#f5c9a8]/20 font-bold text-[#1a1a1a]"
                      : "border-[#e8e0d5] bg-[#f7f1e9]/60 hover:bg-[#f7f1e9] text-[#4a4a4a]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold">Direct IP (ต่อตรง)</span>
                    {tempSource === "direct" && (
                      <Check className="w-3.5 h-3.5 text-[#2e7d32]" />
                    )}
                  </div>
                  <span className="text-[10px] text-[#6b6b6b]">
                    รับภาพตรงจาก ESP32 เร็วที่สุด
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTempSource("proxy")}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    tempSource === "proxy"
                      ? "border-[#e8b48a] bg-[#f5c9a8]/20 font-bold text-[#1a1a1a]"
                      : "border-[#e8e0d5] bg-[#f7f1e9]/60 hover:bg-[#f7f1e9] text-[#4a4a4a]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold">Backend Proxy (แนะนำ)</span>
                    {tempSource === "proxy" && (
                      <Check className="w-3.5 h-3.5 text-[#2e7d32]" />
                    )}
                  </div>
                  <span className="text-[10px] text-[#6b6b6b]">
                    เสถียรสูงสุด ไม่หลุดเมื่อเปลี่ยนหน้า
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSettingsOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button variant="primary" size="sm" type="submit">
              บันทึกการตั้งค่า
            </Button>
          </div>
        </form>
      </Modal>

      {/* IDENTIFY & TRAIN PERSON MODAL */}
      <Modal
        isOpen={isIdentifyModalOpen}
        onClose={() => {
          if (!isSubmittingIdentify) {
            setIsIdentifyModalOpen(false);
            setIdentifySuccessMessage("");
          }
        }}
        title="ระบุตัวตนและเทรนข้อมูลบุคคล (Identify & Train Person)"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          {/* Success Notification Banner */}
          {identifySuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2e7d32]" />
              <span>{identifySuccessMessage}</span>
            </div>
          )}

          {/* Snapshot Preview & Detection Metadata */}
          {selectedRecordForIdentify && (
            <div className="p-3.5 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] flex items-center gap-3.5">
              <img
                src={selectedRecordForIdentify.photoUrl}
                alt="Captured Face"
                className="w-20 h-20 rounded-2xl object-cover border border-[#e8e0d5] shadow-xs shrink-0"
              />
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1a1a1a]">ภาพจากกล้อง:</span>
                  <Badge variant={selectedRecordForIdentify.role}>
                    {selectedRecordForIdentify.role}
                  </Badge>
                </div>
                <div className="text-[11px] text-[#6b6b6b]">
                  <span>ตรวจพบเมื่อ: {selectedRecordForIdentify.time}</span>
                </div>
                <div className="text-[11px] text-[#6b6b6b]">
                  <span>ตำแหน่ง: {selectedRecordForIdentify.location}</span>
                </div>
                <span className="text-[11px] font-mono text-[#2e7d32] font-semibold">
                  AI Confidence: {selectedRecordForIdentify.confidence}%
                </span>
              </div>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-[#f7f1e9] border border-[#e8e0d5] text-xs font-bold">
            <button
              type="button"
              onClick={() => setIdentifyMode("new")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer transition-all text-center ${
                identifyMode === "new"
                  ? "bg-[#e65100] text-white shadow-xs"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              ลงทะเบียนบุคคลใหม่
            </button>
            <button
              type="button"
              onClick={() => setIdentifyMode("existing")}
              className={`flex-1 py-1.5 rounded-lg cursor-pointer transition-all text-center ${
                identifyMode === "existing"
                  ? "bg-[#1a1a1a] text-white shadow-xs"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              เชื่อมโยงกับบุคคลเดิม ({registeredPersonsList.length})
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveIdentify} className="flex flex-col gap-4">
            {identifyMode === "new" ? (
              <>
                <Input
                  label="ชื่อ-นามสกุล บุคคล *"
                  placeholder="เช่น คุณสมชาย รักสงบ, พนักงานส่งของ Flash, ช่างแอร์..."
                  value={newPersonForm.name}
                  onChange={(e) =>
                    setNewPersonForm({ ...newPersonForm, name: e.target.value })
                  }
                  required
                />

                {/* Category Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                    กลุ่มหมวดหมู่ (Category) *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "household", label: "คนในบ้าน", color: "border-[#81c784] text-[#2e7d32]" },
                      { id: "delivery", label: "คนส่งของ", color: "border-[#ffb74d] text-[#e65100]" },
                      { id: "stranger", label: "คนแปลกหน้า", color: "border-[#e57373] text-[#c62828]" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setNewPersonForm({
                            ...newPersonForm,
                            category: cat.id,
                            role: cat.id === "household" ? "Family" : cat.id === "delivery" ? "Delivery" : "Stranger",
                          })
                        }
                        className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                          newPersonForm.category === cat.id
                            ? "bg-[#f5c9a8] border-[#e8b48a] text-[#1a1a1a] shadow-xs"
                            : "bg-white border-[#e8e0d5] text-[#6b6b6b] hover:bg-[#f7f1e9]"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="บทบาท / ความสัมพันธ์"
                    placeholder="เช่น Family, พ่อ, แม่, ไรเดอร์"
                    value={newPersonForm.role}
                    onChange={(e) =>
                      setNewPersonForm({ ...newPersonForm, role: e.target.value })
                    }
                  />
                  <Input
                    label="สังกัด / แผนก"
                    placeholder="เช่น ครอบครัว, Kerry, Flash"
                    value={newPersonForm.department}
                    onChange={(e) =>
                      setNewPersonForm({ ...newPersonForm, department: e.target.value })
                    }
                  />
                </div>

                <Textarea
                  label="หมายเหตุเพิ่มเติม"
                  placeholder="บันทึกสิทธิ์หรือข้อมูลเพิ่มเติม..."
                  value={newPersonForm.notes}
                  onChange={(e) =>
                    setNewPersonForm({ ...newPersonForm, notes: e.target.value })
                  }
                  rows={2}
                />
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                  เลือกบุคคลในฐานข้อมูลที่ต้องการผูกรูปนี้เข้า Dataset *
                </label>
                <select
                  value={selectedExistingPersonId}
                  onChange={(e) => setSelectedExistingPersonId(e.target.value)}
                  className="w-full bg-white border border-[#e8e0d5] text-[#1a1a1a] text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none focus:border-[#e8b48a] cursor-pointer"
                >
                  {registeredPersonsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category === "household" ? "คนในบ้าน" : p.category === "delivery" ? "คนส่งของ" : "คนแปลกหน้า"}) — {p.images_count} รูปใน Dataset
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-[#6b6b6b] leading-relaxed bg-[#f7f1e9] p-3 rounded-xl border border-[#e8e0d5]">
                  💡 <strong>ระบบ AI:</strong> ภาพถ่ายใบหน้าสดนี้จะถูกบันทึกและเพิ่มเข้าสู่ชุดข้อมูล (Training Dataset) ของบุคคลที่เลือกทันที ช่วยให้โมเดล YOLOv8 จดจำและจำแนกได้แม่นยำยิ่งขึ้น
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsIdentifyModalOpen(false)}
                disabled={isSubmittingIdentify}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmittingIdentify}
                icon={Sparkles}
                className="bg-[#e65100] hover:bg-[#bf360c] text-white border-none shadow-xs"
              >
                {isSubmittingIdentify ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูลและส่งเทรน AI"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
      {/* DELETE SINGLE RECORD MODAL */}
      <Modal
        isOpen={isDeleteRecordModalOpen}
        onClose={() => {
          if (!isDeletingRecord) {
            setIsDeleteRecordModalOpen(false);
            setRecordToDelete(null);
          }
        }}
        title="ยืนยันการลบประวัติการตรวจจับ"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#ffebee] border border-[#ef9a9a]">
            <AlertTriangle className="w-6 h-6 text-[#c62828] shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#b71c1c]">ต้องการลบรายการประวัตินี้ใช่หรือไม่?</span>
              <span className="text-[#6b6b6b] mt-0.5">
                รายการจะถูกลบออกจากฐานข้อมูล SQLite อย่างถาวร
              </span>
            </div>
          </div>

          {recordToDelete && (
            <div className="p-3 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] text-xs flex items-center gap-3">
              <img
                src={recordToDelete.photoUrl}
                alt={recordToDelete.name}
                className="w-12 h-12 rounded-xl object-cover border border-[#e8e0d5] shrink-0"
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[#1a1a1a]">{recordToDelete.name}</span>
                <span className="text-[11px] text-[#6b6b6b]">
                  {recordToDelete.role} • ความแม่นยำ {recordToDelete.confidence}%
                </span>
                <span className="text-[10px] text-[#8e8e8e]">
                  {recordToDelete.time} • {recordToDelete.location}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsDeleteRecordModalOpen(false);
                setRecordToDelete(null);
              }}
              disabled={isDeletingRecord}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDeleteHistoryRecord}
              disabled={isDeletingRecord}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isDeletingRecord ? "กำลังลบ..." : "ยืนยันการลบ"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CLEAR ALL HISTORY MODAL */}
      <Modal
        isOpen={isClearHistoryModalOpen}
        onClose={() => {
          if (!isClearingHistory) setIsClearHistoryModalOpen(false);
        }}
        title="ล้างประวัติการตรวจจับ (Clear Detection History)"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#ffebee] border border-[#ef9a9a]">
            <AlertTriangle className="w-6 h-6 text-[#c62828] shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#b71c1c]">ต้องการล้างประวัติทั้งหมดใช่หรือไม่?</span>
              <span className="text-[#6b6b6b] mt-0.5">
                {historyCategory === "ALL"
                  ? `ระบบจะลบประวัติการตรวจจับทั้งหมด (${visitors.length} รายการ) ออกจากฐานข้อมูล SQLite`
                  : `ระบบจะลบประวัติเฉพาะหมวดหมู่ '${historyCategory}' (${visitors.length} รายการ)`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsClearHistoryModalOpen(false)}
              disabled={isClearingHistory}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleClearHistory}
              disabled={isClearingHistory}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isClearingHistory ? "กำลังล้างข้อมูล..." : "ยืนยันการล้างประวัติ"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
