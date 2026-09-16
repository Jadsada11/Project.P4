import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  MapPin,
  Clock,
  Sparkles,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import { Input, Textarea } from "../../components/common/Input";
import { initialAlerts } from "../../mocks/mockAlerts";
import { alertsApi, personsApi, detectionApi } from "../../services/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [filterMode, setFilterMode] = useState("ALL"); // 'ALL' or 'UNREAD'
  const [isLoading, setIsLoading] = useState(false);

  // Deletion Modal States
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAlert, setIsDeletingAlert] = useState(false);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearOption, setClearOption] = useState("all"); // "all" | "read"
  const [isClearingAlerts, setIsClearingAlerts] = useState(false);

  // Load real alerts from backend SQLite database
  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await alertsApi.getAlerts(
        selectedCategory !== "ALL" ? selectedCategory : undefined,
        filterMode === "UNREAD"
      );
      if (data && Array.isArray(data)) {
        const formatted = data.map((a) => ({
          id: a.id,
          detectionId: a.detection_id,
          title: a.title,
          description: a.description,
          severity: a.severity || "warning",
          category: a.category || "stranger",
          location: a.location || "หน้าบ้าน",
          isRead: a.is_read,
          thumbnail: a.thumbnail?.startsWith("http")
            ? a.thumbnail
            : a.thumbnail
            ? `http://localhost:8000${a.thumbnail}`
            : "",
          timestamp: new Date(a.created_at).toLocaleDateString("th-TH"),
          timeRaw: new Date(a.created_at).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setAlerts(formatted);
      }
    } catch (err) {
      console.warn("Could not fetch alerts from backend, using default:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [selectedCategory, filterMode]);

  // Identify & Train Modal State
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);
  const [selectedAlertForIdentify, setSelectedAlertForIdentify] = useState(null);
  const [identifyMode, setIdentifyMode] = useState("new");
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

  const handleOpenIdentifyModal = async (alertItem) => {
    setSelectedAlertForIdentify(alertItem);
    setIdentifyMode(alertItem.category === "stranger" ? "new" : "existing");
    setNewPersonForm({
      name: "",
      category: alertItem.category === "delivery" ? "delivery" : "household",
      role: alertItem.category === "delivery" ? "Delivery" : "Family",
      department: alertItem.category === "delivery" ? "ขนส่งพัสดุ" : "ครอบครัว",
      notes: `ระบุตัวตนจากการแจ้งเตือน '${alertItem.title}' วันที่ ${alertItem.timestamp} (${alertItem.timeRaw})`,
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

  const handleSaveIdentify = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAlertForIdentify) return;

    setIsSubmittingIdentify(true);
    try {
      if (selectedAlertForIdentify.detectionId) {
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
        const res = await detectionApi.identifyPerson(selectedAlertForIdentify.detectionId, payload);
        setIdentifySuccessMessage(res.message || "บันทึกและส่งเทรนโมเดลเรียบร้อยแล้ว!");
      } else {
        // Direct creation fallback
        if (identifyMode === "new") {
          await personsApi.createPerson({
            name: newPersonForm.name.trim(),
            category: newPersonForm.category,
            role: newPersonForm.role,
            department: newPersonForm.department,
            notes: newPersonForm.notes,
            photo_url: selectedAlertForIdentify.thumbnail,
            images_count: 1,
            accuracy: 98.5,
            is_active: true,
          });
          setIdentifySuccessMessage(`ลงทะเบียน '${newPersonForm.name.trim()}' สำเร็จ!`);
        } else {
          setIdentifySuccessMessage("เชื่อมโยงเข้าสู่ชุดข้อมูลบุคคลเดิมสำเร็จ!");
        }
      }

      window.dispatchEvent(new Event("vigil-alerts-updated"));
      await loadAlerts();

      setTimeout(() => {
        setIsIdentifyModalOpen(false);
        setIdentifySuccessMessage("");
      }, 1400);
    } catch (err) {
      console.error("Identify from alert error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmittingIdentify(false);
    }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const filteredAlerts = alerts.filter((alert) => {
    if (filterMode === "UNREAD" && alert.isRead) return false;
    if (selectedCategory !== "ALL" && alert.category !== selectedCategory)
      return false;
    return true;
  });

  const toggleReadStatus = async (id) => {
    const target = alerts.find((a) => a.id === id);
    if (!target) return;
    const newStatus = !target.isRead;

    // Optimistic UI update
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: newStatus } : a))
    );

    try {
      await alertsApi.markRead(id, newStatus);
    } catch (err) {
      console.warn("Failed to update read status on server:", err);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic UI update
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));

    try {
      await alertsApi.markAllRead();
      window.dispatchEvent(new Event("vigil-alerts-updated"));
    } catch (err) {
      console.warn("Failed to mark all as read on server:", err);
    }
  };

  const handleConfirmDeleteAlert = async () => {
    if (!alertToDelete) return;
    setIsDeletingAlert(true);
    try {
      // Optimistic update
      setAlerts((prev) => prev.filter((a) => a.id !== alertToDelete.id));
      await alertsApi.deleteAlert(alertToDelete.id);
      window.dispatchEvent(new Event("vigil-alerts-updated"));
      setIsDeleteModalOpen(false);
      setAlertToDelete(null);
    } catch (err) {
      console.error("Failed to delete alert:", err);
      alert("เกิดข้อผิดพลาดในการลบการแจ้งเตือน: " + (err.response?.data?.detail || err.message));
      await loadAlerts();
    } finally {
      setIsDeletingAlert(false);
    }
  };

  const handleConfirmClearAlerts = async () => {
    setIsClearingAlerts(true);
    try {
      const isReadOnly = clearOption === "read";
      if (isReadOnly) {
        setAlerts((prev) => prev.filter((a) => !a.isRead));
      } else {
        setAlerts([]);
      }

      await alertsApi.clearAlerts({
        category: selectedCategory !== "ALL" ? selectedCategory : undefined,
        readOnly: isReadOnly,
      });

      window.dispatchEvent(new Event("vigil-alerts-updated"));
      setIsClearModalOpen(false);
      await loadAlerts();
    } catch (err) {
      console.error("Failed to clear alerts:", err);
      alert("เกิดข้อผิดพลาดในการล้างการแจ้งเตือน: " + (err.response?.data?.detail || err.message));
      await loadAlerts();
    } finally {
      setIsClearingAlerts(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
              Security Alerts & Events
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#c62828] text-white animate-pulse">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#6b6b6b]">
            ประวัติการแจ้งเตือนจำแนกบุคคล: คนแปลกหน้า • คนส่งของ • สมาชิกในบ้าน
          </p>
        </div>

        {/* Filter Controls & Mark Read Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-white border border-[#e8e0d5] text-xs font-semibold">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                filterMode === "ALL"
                  ? "bg-[#f5c9a8] text-[#1a1a1a] shadow-xs font-bold"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              ทั้งหมด ({alerts.length})
            </button>
            <button
              onClick={() => setFilterMode("UNREAD")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                filterMode === "UNREAD"
                  ? "bg-[#f5c9a8] text-[#1a1a1a] shadow-xs font-bold"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              ยังไม่อ่าน ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              icon={CheckCheck}
            >
              <span className="hidden sm:inline">อ่านทั้งหมด</span>
            </Button>
          )}

          {alerts.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsClearModalOpen(true)}
              icon={Trash2}
              className="text-[#c62828] hover:bg-[#ffebee] hover:border-[#ef9a9a]"
            >
              <span className="hidden sm:inline">ล้างการแจ้งเตือน</span>
            </Button>
          )}
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: "ALL", label: "ทุกหมวดหมู่ (All Events)" },
          { id: "stranger", label: "⚠️ คนแปลกหน้า (Stranger)" },
          { id: "delivery", label: "📦 คนส่งของ (Delivery)" },
          { id: "household", label: "🟢 คนในบ้าน (Household)" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all whitespace-nowrap border ${
              selectedCategory === cat.id
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-xs"
                : "bg-white text-[#6b6b6b] border-[#e8e0d5] hover:bg-[#f7f1e9]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="flex flex-col gap-3">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => toggleReadStatus(alert.id)}
            className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none ${
              !alert.isRead
                ? "bg-white border-[#e8b48a] shadow-sm hover:shadow-md"
                : "bg-white/60 border-[#e8e0d5] opacity-80 hover:opacity-100 hover:bg-white"
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Snapshot / Avatar */}
              {alert.thumbnail ? (
                <img
                  src={alert.thumbnail}
                  alt={alert.title}
                  className="w-14 h-14 rounded-2xl object-cover border border-[#e8e0d5] shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] flex items-center justify-center text-[#6b6b6b] shrink-0">
                  <Bell className="w-6 h-6 text-[#e8b48a]" />
                </div>
              )}

              {/* Text Info */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={alert.category}>{alert.category}</Badge>
                  <h3 className="text-sm font-bold text-[#1a1a1a]">
                    {alert.title}
                  </h3>
                  {!alert.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#c62828] animate-pulse" />
                  )}
                </div>

                <p className="text-xs text-[#6b6b6b] leading-relaxed">
                  {alert.description}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[#6b6b6b]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#26a69a]" />
                    {alert.location}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#6b6b6b]" />
                    {alert.timestamp} ({alert.timeRaw})
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action / Status */}
            <div className="self-end sm:self-center flex sm:flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    alert.isRead
                      ? "bg-[#f7f1e9] text-[#6b6b6b] border-[#e8e0d5]"
                      : "bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7]"
                  }`}
                >
                  {alert.isRead ? "รับทราบแล้ว (Read)" : "รอตรวจสอบ (New)"}
                </span>

                {alert.category === "stranger" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenIdentifyModal(alert);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#fff3e0] hover:bg-[#ffe0b2] text-[#e65100] border border-[#ffb74d] cursor-pointer shadow-xs transition-all animate-pulse"
                    title="ระบุตัวตนและบันทึกภาพนี้เข้าสู่ระบบโมเดล AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ระบุตัวตน / เทรน</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlertToDelete(alert);
                    setIsDeleteModalOpen(true);
                  }}
                  className="p-1.5 rounded-xl text-[#9e9e9e] hover:text-[#c62828] hover:bg-[#ffebee] border border-transparent hover:border-[#ef9a9a] transition-all cursor-pointer"
                  title="ลบการแจ้งเตือนนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[11px] text-[#6b6b6b] font-medium hidden sm:inline">
                {alert.isRead ? "คลิกเพื่อมาร์กยังไม่อ่าน" : "คลิกเพื่อมาร์กว่าอ่านแล้ว"}
              </span>
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-[#e8e0d5]">
            <CheckCircle className="w-10 h-10 text-[#2e7d32] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#1a1a1a]">
              ไม่มีรายการแจ้งเตือนในหมวดหมู่นี้
            </p>
            <span className="text-xs text-[#6b6b6b]">
              ระบบรักษาความปลอดภัยและการเฝ้าระวังทำงานเป็นปกติ
            </span>
          </div>
        )}
      </div>

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
          {identifySuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2e7d32]" />
              <span>{identifySuccessMessage}</span>
            </div>
          )}

          {selectedAlertForIdentify && (
            <div className="p-3.5 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] flex items-center gap-3.5">
              {selectedAlertForIdentify.thumbnail ? (
                <img
                  src={selectedAlertForIdentify.thumbnail}
                  alt="Captured Face"
                  className="w-20 h-20 rounded-2xl object-cover border border-[#e8e0d5] shadow-xs shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white border border-[#e8e0d5] flex items-center justify-center shrink-0 text-[#6b6b6b]">
                  <Bell className="w-6 h-6 text-[#e8b48a]" />
                </div>
              )}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1a1a1a]">เหตุการณ์:</span>
                  <Badge variant={selectedAlertForIdentify.category}>
                    {selectedAlertForIdentify.category}
                  </Badge>
                </div>
                <span className="text-xs font-semibold text-[#1a1a1a]">
                  {selectedAlertForIdentify.title}
                </span>
                <div className="text-[11px] text-[#6b6b6b]">
                  <span>เวลา: {selectedAlertForIdentify.timestamp} ({selectedAlertForIdentify.timeRaw})</span>
                </div>
                <div className="text-[11px] text-[#6b6b6b]">
                  <span>สถานที่: {selectedAlertForIdentify.location}</span>
                </div>
              </div>
            </div>
          )}

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

          <form onSubmit={handleSaveIdentify} className="flex flex-col gap-4">
            {identifyMode === "new" ? (
              <>
                <Input
                  label="ชื่อ-นามสกุล บุคคล *"
                  placeholder="เช่น คุณสมชาย รักสงบ, พนักงาน Flash, ช่างแอร์..."
                  value={newPersonForm.name}
                  onChange={(e) =>
                    setNewPersonForm({ ...newPersonForm, name: e.target.value })
                  }
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                    กลุ่มหมวดหมู่ (Category) *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "household", label: "คนในบ้าน" },
                      { id: "delivery", label: "คนส่งของ" },
                      { id: "stranger", label: "คนแปลกหน้า" },
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
                    placeholder="เช่น Family, พ่อ, ไรเดอร์"
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
                  💡 <strong>ระบบ AI:</strong> ภาพถ่ายนี้จะถูกนำไปเพิ่มในชุดข้อมูล (Training Dataset) ของบุคคลที่เลือกทันที เพื่อเพิ่มความแม่นยำในการจดจำ
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
      {/* DELETE SINGLE ALERT CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeletingAlert) {
            setIsDeleteModalOpen(false);
            setAlertToDelete(null);
          }
        }}
        title="ยืนยันการลบการแจ้งเตือน"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#ffebee] border border-[#ef9a9a]">
            <AlertTriangle className="w-6 h-6 text-[#c62828] shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#b71c1c]">ต้องการลบรายการนี้ใช่หรือไม่?</span>
              <span className="text-[#6b6b6b] mt-0.5">
                การลบจะไม่สามารถกู้คืนได้ และจะนำออกจากประวัติการแจ้งเตือน
              </span>
            </div>
          </div>

          {alertToDelete && (
            <div className="p-3 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] text-xs flex flex-col gap-1">
              <span className="font-bold text-[#1a1a1a]">{alertToDelete.title}</span>
              <span className="text-[#6b6b6b]">{alertToDelete.description}</span>
              <span className="text-[11px] text-[#8e8e8e] mt-1">
                เวลา: {alertToDelete.timestamp} ({alertToDelete.timeRaw}) • สถานที่: {alertToDelete.location}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setAlertToDelete(null);
              }}
              disabled={isDeletingAlert}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmDeleteAlert}
              disabled={isDeletingAlert}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isDeletingAlert ? "กำลังลบ..." : "ยืนยันการลบ"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CLEAR ALERTS MODAL */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => {
          if (!isClearingAlerts) setIsClearModalOpen(false);
        }}
        title="ล้างรายการแจ้งเตือน (Clear Alerts)"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[#6b6b6b]">
            กรุณาเลือกเงื่อนไขในการล้างการแจ้งเตือนในระบบ:
          </p>

          <div className="flex flex-col gap-2 text-xs">
            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                clearOption === "read"
                  ? "bg-[#f5c9a8]/20 border-[#e8b48a]"
                  : "bg-[#f7f1e9]/60 border-[#e8e0d5] hover:bg-[#f7f1e9]"
              }`}
            >
              <input
                type="radio"
                name="clearOption"
                value="read"
                checked={clearOption === "read"}
                onChange={() => setClearOption("read")}
                className="mt-0.5 accent-[#1a1a1a]"
              />
              <div className="flex flex-col">
                <span className="font-bold text-[#1a1a1a]">ลบเฉพาะรายการที่อ่านแล้ว</span>
                <span className="text-[11px] text-[#6b6b6b]">
                  เก็บบันทึกรายการที่ยังไม่อ่านไว้เพื่อความปลอดภัย
                </span>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                clearOption === "all"
                  ? "bg-[#ffebee] border-[#ef9a9a]"
                  : "bg-[#f7f1e9]/60 border-[#e8e0d5] hover:bg-[#f7f1e9]"
              }`}
            >
              <input
                type="radio"
                name="clearOption"
                value="all"
                checked={clearOption === "all"}
                onChange={() => setClearOption("all")}
                className="mt-0.5 accent-[#c62828]"
              />
              <div className="flex flex-col">
                <span className="font-bold text-[#c62828]">ลบทั้งหมดในหมวดหมู่นี้ ({alerts.length} รายการ)</span>
                <span className="text-[11px] text-[#6b6b6b]">
                  ล้างรายการแจ้งเตือนทั้งหมดอย่างถาวร
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsClearModalOpen(false)}
              disabled={isClearingAlerts}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmClearAlerts}
              disabled={isClearingAlerts}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isClearingAlerts ? "กำลังล้างข้อมูล..." : "ยืนยันการล้างข้อมูล"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
