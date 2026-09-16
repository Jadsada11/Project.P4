import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  User,
  Camera,
  MapPin,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  X,
  Users,
  Package,
  Home,
  ShieldAlert,
} from "lucide-react";
import MetricCard from "../../components/common/MetricCard";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import { Input, Textarea } from "../../components/common/Input";
import { detectionApi, personsApi } from "../../services/api";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Real-time Stats from Database
  const [stats, setStats] = useState({
    total_today: 0,
    household_count: 0,
    delivery_count: 0,
    stranger_count: 0,
    alerts_count: 0,
  });

  // Modal States
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Snapshot Preview Modal State
  const [previewRecord, setPreviewRecord] = useState(null);

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

  // Fetch History & Stats from SQLite Backend
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyData, statsData] = await Promise.allSettled([
        detectionApi.getHistory(selectedCategory !== "ALL" ? selectedCategory : undefined),
        detectionApi.getStats(),
      ]);

      if (historyData.status === "fulfilled" && Array.isArray(historyData.value)) {
        const formatted = historyData.value.map((item) => ({
          id: item.id,
          name: item.person_name,
          category: item.category,
          confidence: item.confidence,
          boundingBox: item.bounding_box,
          snapshotPath: item.snapshot_path?.startsWith("http")
            ? item.snapshot_path
            : item.snapshot_path
            ? `http://localhost:8000${item.snapshot_path}`
            : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          cameraId: item.camera_id || "cam-1",
          location: item.location || "หน้าบ้าน (Main Entrance)",
          alertTriggered: item.alert_triggered,
          dateStr: new Date(item.timestamp).toLocaleDateString("th-TH"),
          timeStr: new Date(item.timestamp).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          rawTimestamp: item.timestamp,
        }));
        setHistory(formatted);
      }

      if (statsData.status === "fulfilled" && statsData.value) {
        setStats(statsData.value);
      }
    } catch (err) {
      console.warn("Could not load detection history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelectedIds(new Set());
  }, [selectedCategory]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchLoc = item.location?.toLowerCase().includes(q);
        const matchCam = item.cameraId?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchCam && !matchCat) return false;
      }
      return true;
    });
  }, [history, selectedCategory, searchQuery]);

  // Multi-select actions
  const isAllSelected =
    filteredHistory.length > 0 &&
    filteredHistory.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredHistory.map((item) => item.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Single Delete Handler
  const handleConfirmDeleteSingle = async () => {
    if (!recordToDelete) return;
    setIsDeletingSingle(true);
    try {
      setHistory((prev) => prev.filter((r) => r.id !== recordToDelete.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(recordToDelete.id);
        return next;
      });

      await detectionApi.deleteHistory(recordToDelete.id);
      setIsDeleteModalOpen(false);
      setRecordToDelete(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete record:", err);
      alert("เกิดข้อผิดพลาดในการลบรายการ: " + (err.response?.data?.detail || err.message));
      await loadData();
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Bulk Delete Handler
  const handleConfirmDeleteBulk = async () => {
    if (selectedIds.size === 0) return;
    setIsDeletingBulk(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      setHistory((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());

      await Promise.all(idsToDelete.map((id) => detectionApi.deleteHistory(id)));
      setIsBulkDeleteModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to delete selected records:", err);
      alert("เกิดข้อผิดพลาดในการลบรายการที่เลือก: " + (err.response?.data?.detail || err.message));
      await loadData();
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Clear All History Handler
  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    try {
      setHistory([]);
      setSelectedIds(new Set());

      await detectionApi.clearHistory(
        selectedCategory !== "ALL" ? selectedCategory : undefined
      );

      setIsClearAllModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to clear history:", err);
      alert("เกิดข้อผิดพลาดในการล้างประวัติ: " + (err.response?.data?.detail || err.message));
      await loadData();
    } finally {
      setIsClearingAll(false);
    }
  };

  // Identify Modal Handlers
  const handleOpenIdentifyModal = async (record) => {
    setSelectedRecordForIdentify(record);
    setIdentifyMode(record.category === "stranger" ? "new" : "existing");
    setNewPersonForm({
      name: "",
      category: record.category === "delivery" ? "delivery" : "household",
      role: record.category === "delivery" ? "Delivery" : "Family",
      department: record.category === "delivery" ? "ขนส่งพัสดุ" : "ครอบครัว",
      notes: `ระบุตัวตนจากประวัติการตรวจจับ '${record.name}' วันที่ ${record.dateStr} (${record.timeStr})`,
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
    if (!selectedRecordForIdentify) return;

    setIsSubmittingIdentify(true);
    try {
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

      const res = await detectionApi.identifyPerson(selectedRecordForIdentify.id, payload);
      setIdentifySuccessMessage(res.message || "บันทึกและส่งเทรนโมเดลเรียบร้อยแล้ว!");
      window.dispatchEvent(new Event("vigil-alerts-updated"));
      await loadData();

      setTimeout(() => {
        setIsIdentifyModalOpen(false);
        setIdentifySuccessMessage("");
      }, 1400);
    } catch (err) {
      console.error("Identify record error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmittingIdentify(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 py-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f5c9a8] flex items-center justify-center text-[#1a1a1a] shadow-xs">
              <Clock className="w-5 h-5 text-[#1a1a1a]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
                Detection History & Logs
              </h1>
              <p className="text-xs sm:text-sm text-[#6b6b6b]">
                ประวัติการตรวจจับและบันทึกภาพบุคคลจากกล้องวงจรปิด IoT ESP32-CAM ลงฐานข้อมูล SQLite
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            icon={RefreshCw}
            disabled={isLoading}
          >
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>

          {selectedIds.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              icon={Trash2}
              className="bg-[#ffebee] hover:bg-[#ffcdd2] text-[#c62828] border-[#ef9a9a]"
            >
              <span>ลบที่เลือก ({selectedIds.size})</span>
            </Button>
          )}

          {history.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsClearAllModalOpen(true)}
              icon={Trash2}
              className="text-[#c62828] hover:bg-[#ffebee] hover:border-[#ef9a9a]"
            >
              <span className="hidden sm:inline">ล้างประวัติทั้งหมด</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="บันทึกวันนี้ (Today)"
          value={stats.total_today}
          subtitle="การตรวจจับทั้งหมด"
          icon={Users}
          color="peach"
        />
        <MetricCard
          title="คนในบ้าน (Household)"
          value={stats.household_count}
          subtitle="สมาชิกในครอบครัว"
          icon={Home}
          color="green"
        />
        <MetricCard
          title="คนส่งของ (Delivery)"
          value={stats.delivery_count}
          subtitle="พนักงานขนส่งพัสดุ"
          icon={Package}
          color="cyan"
        />
        <MetricCard
          title="คนแปลกหน้า (Stranger)"
          value={stats.stranger_count}
          subtitle="แจ้งเตือนความปลอดภัย"
          icon={ShieldAlert}
          color="red"
        />
      </div>

      {/* Filter and Search Bar Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#e8e0d5] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          {[
            { id: "ALL", label: `ทั้งหมด (${history.length})` },
            { id: "household", label: "🟢 คนในบ้าน" },
            { id: "delivery", label: "📦 คนส่งของ" },
            { id: "stranger", label: "⚠️ คนแปลกหน้า" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all whitespace-nowrap border ${
                selectedCategory === cat.id
                  ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-xs"
                  : "bg-[#f7f1e9]/70 text-[#6b6b6b] border-[#e8e0d5] hover:bg-[#f7f1e9] hover:text-[#1a1a1a]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8e8e8e] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, ตำแหน่งกล้อง, สถานที่..."
            className="w-full bg-[#f7f1e9]/60 hover:bg-[#f7f1e9] focus:bg-white border border-[#e8e0d5] focus:border-[#e8b48a] rounded-xl pl-10 pr-9 py-2 text-xs text-[#1a1a1a] font-medium outline-none transition-all placeholder:text-[#9e9e9e]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e8e] hover:text-[#1a1a1a]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Select All Bar */}
      {filteredHistory.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-[#6b6b6b]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 cursor-pointer font-semibold hover:text-[#1a1a1a] transition-all"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-[#1a1a1a]" />
              ) : (
                <Square className="w-4 h-4 text-[#8e8e8e]" />
              )}
              <span>
                {isAllSelected
                  ? "ยกเลิกการเลือกทั้งหมด"
                  : `เลือกทั้งหมด (${filteredHistory.length} รายการ)`}
              </span>
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs font-bold text-[#c62828] bg-[#ffebee] px-2 py-0.5 rounded-md">
                เลือกแล้ว {selectedIds.size} รายการ
              </span>
            )}
          </div>
          <span className="text-[11px]">แสดง {filteredHistory.length} รายการ</span>
        </div>
      )}

      {/* History Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredHistory.map((item) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between gap-3 relative ${
                isSelected
                  ? "bg-[#fff8f0] border-[#e8b48a] shadow-sm"
                  : "bg-white border-[#e8e0d5] hover:border-[#d4c9bc] hover:shadow-xs"
              }`}
            >
              {/* Card Top: Checkbox, Thumbnail, Basic Info */}
              <div className="flex items-start gap-3">
                {/* Select Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelectOne(item.id)}
                  className="mt-1 cursor-pointer shrink-0 text-[#8e8e8e] hover:text-[#1a1a1a]"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#e65100]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#c0b8ac]" />
                  )}
                </button>

                {/* Snapshot Image Preview */}
                <div
                  onClick={() => setPreviewRecord(item)}
                  className="relative group cursor-pointer shrink-0"
                  title="คลิกเพื่อดูภาพขยาย"
                >
                  <img
                    src={item.snapshotPath}
                    alt={item.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-[#e8e0d5] group-hover:scale-105 transition-all shadow-2xs"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Info Text */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-[#1a1a1a] truncate" title={item.name}>
                      {item.name}
                    </span>
                    <Badge variant={item.category}>{item.category}</Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#6b6b6b]">
                    <span className="font-mono font-semibold text-[#1a1a1a]">
                      {item.confidence}%
                    </span>
                    <span>•</span>
                    <span className="truncate">{item.location}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#8e8e8e] pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#8e8e8e]" />
                      {item.dateStr} {item.timeStr}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Bottom: Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#f0e8dc] text-xs">
                <span className="text-[11px] text-[#8e8e8e] font-mono">
                  ID: #{item.id}
                </span>

                <div className="flex items-center gap-1.5">
                  {item.category === "stranger" && (
                    <button
                      type="button"
                      onClick={() => handleOpenIdentifyModal(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#fff3e0] hover:bg-[#ffe0b2] text-[#e65100] border border-[#ffb74d] cursor-pointer shadow-2xs transition-all"
                      title="ระบุตัวตนและบันทึกภาพนี้เข้าสู่ระบบโมเดล AI"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>ระบุตัวตน</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewRecord(item)}
                    className="p-1.5 rounded-xl text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f7f1e9] border border-transparent hover:border-[#e8e0d5] transition-all cursor-pointer"
                    title="ดูภาพและรายละเอียด"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRecordToDelete(item);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-1.5 rounded-xl text-[#9e9e9e] hover:text-[#c62828] hover:bg-[#ffebee] border border-transparent hover:border-[#ef9a9a] transition-all cursor-pointer"
                    title="ลบรายการนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredHistory.length === 0 && !isLoading && (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-[#e8e0d5] flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-[#f7f1e9] flex items-center justify-center text-[#8e8e8e] mb-1">
            <Clock className="w-7 h-7 text-[#e8b48a]" />
          </div>
          <h3 className="text-base font-bold text-[#1a1a1a]">
            ไม่พบข้อมูลประวัติการตรวจจับ
          </h3>
          <p className="text-xs text-[#6b6b6b] max-w-sm">
            {searchQuery
              ? `ไม่พบผลการค้นหาสำหรับ '${searchQuery}' ในหมวดหมู่ที่เลือก`
              : "ยังไม่มีประวัติการตรวจจับในหมวดหมู่นี้ ข้อมูลจะถูกบันทึกอัตโนมัติเมื่อกล้องตรวจพบบุคคล"}
          </p>
          {searchQuery && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-2"
            >
              ล้างคำค้นหา
            </Button>
          )}
        </div>
      )}

      {/* SNAPSHOT PREVIEW MODAL */}
      <Modal
        isOpen={!!previewRecord}
        onClose={() => setPreviewRecord(null)}
        title="รายละเอียดประวัติการตรวจจับ (Detection Detail)"
        maxWidth="max-w-lg"
      >
        {previewRecord && (
          <div className="flex flex-col gap-4">
            <div className="relative rounded-2xl overflow-hidden border border-[#e8e0d5] bg-black">
              <img
                src={previewRecord.snapshotPath}
                alt={previewRecord.name}
                className="w-full max-h-[380px] object-contain mx-auto"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#f7f1e9] p-4 rounded-2xl border border-[#e8e0d5]">
              <div>
                <span className="text-[#8e8e8e] block">ชื่อบุคคล / Identity:</span>
                <span className="font-bold text-[#1a1a1a] text-sm">{previewRecord.name}</span>
              </div>
              <div>
                <span className="text-[#8e8e8e] block">ประเภท / Category:</span>
                <Badge variant={previewRecord.category}>{previewRecord.category}</Badge>
              </div>
              <div>
                <span className="text-[#8e8e8e] block">ความแม่นยำ AI (Confidence):</span>
                <span className="font-mono font-bold text-[#1a1a1a]">{previewRecord.confidence}%</span>
              </div>
              <div>
                <span className="text-[#8e8e8e] block">วัน-เวลาบันทึก:</span>
                <span className="font-semibold text-[#1a1a1a]">
                  {previewRecord.dateStr} {previewRecord.timeStr}
                </span>
              </div>
              <div>
                <span className="text-[#8e8e8e] block">ตำแหน่งกล้อง / Location:</span>
                <span className="font-medium text-[#1a1a1a]">{previewRecord.location}</span>
              </div>
              <div>
                <span className="text-[#8e8e8e] block">รหัสกล้อง:</span>
                <span className="font-mono font-medium text-[#1a1a1a]">{previewRecord.cameraId}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
              {previewRecord.category === "stranger" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const rec = previewRecord;
                    setPreviewRecord(null);
                    handleOpenIdentifyModal(rec);
                  }}
                  icon={Sparkles}
                  className="bg-[#e65100] hover:bg-[#bf360c] text-white border-none"
                >
                  ระบุตัวตนและเทรน
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewRecord(null)}
              >
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* SINGLE DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeletingSingle) {
            setIsDeleteModalOpen(false);
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
              <span className="font-bold text-[#b71c1c]">ต้องการลบรายการนี้ใช่หรือไม่?</span>
              <span className="text-[#6b6b6b] mt-0.5">
                รายการประวัติการตรวจจับจะถูกลบออกจากฐานข้อมูล SQLite อย่างถาวร
              </span>
            </div>
          </div>

          {recordToDelete && (
            <div className="p-3 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] text-xs flex items-center gap-3">
              <img
                src={recordToDelete.snapshotPath}
                alt={recordToDelete.name}
                className="w-12 h-12 rounded-xl object-cover border border-[#e8e0d5] shrink-0"
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[#1a1a1a]">{recordToDelete.name}</span>
                <span className="text-[11px] text-[#6b6b6b]">
                  {recordToDelete.category} • ความแม่นยำ {recordToDelete.confidence}%
                </span>
                <span className="text-[10px] text-[#8e8e8e]">
                  {recordToDelete.dateStr} {recordToDelete.timeStr} • {recordToDelete.location}
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
                setIsDeleteModalOpen(false);
                setRecordToDelete(null);
              }}
              disabled={isDeletingSingle}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmDeleteSingle}
              disabled={isDeletingSingle}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isDeletingSingle ? "กำลังลบ..." : "ยืนยันการลบ"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (!isDeletingBulk) setIsBulkDeleteModalOpen(false);
        }}
        title="ยืนยันการลบหลายรายการ (Bulk Delete)"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#ffebee] border border-[#ef9a9a]">
            <AlertTriangle className="w-6 h-6 text-[#c62828] shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#b71c1c]">
                ต้องการลบ {selectedIds.size} รายการที่เลือกใช่หรือไม่?
              </span>
              <span className="text-[#6b6b6b] mt-0.5">
                การลบรายการเหล่านี้จะไม่สามารถกู้คืนได้ และจะนำออกจากฐานข้อมูล SQLite
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(false)}
              disabled={isDeletingBulk}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmDeleteBulk}
              disabled={isDeletingBulk}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isDeletingBulk ? "กำลังลบ..." : `ยืนยันการลบ ${selectedIds.size} รายการ`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CLEAR ALL HISTORY MODAL */}
      <Modal
        isOpen={isClearAllModalOpen}
        onClose={() => {
          if (!isClearingAll) setIsClearAllModalOpen(false);
        }}
        title="ล้างประวัติการตรวจจับทั้งหมด (Clear All History)"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-[#ffebee] border border-[#ef9a9a]">
            <AlertTriangle className="w-6 h-6 text-[#c62828] shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-[#b71c1c]">ต้องการล้างประวัติทั้งหมดใช่หรือไม่?</span>
              <span className="text-[#6b6b6b] mt-0.5">
                {selectedCategory === "ALL"
                  ? `ระบบจะลบประวัติการตรวจจับทั้งหมด (${history.length} รายการ) ออกจากฐานข้อมูล SQLite`
                  : `ระบบจะลบประวัติเฉพาะหมวดหมู่ '${selectedCategory}' (${history.length} รายการ)`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e0d5]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsClearAllModalOpen(false)}
              disabled={isClearingAll}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmClearAll}
              disabled={isClearingAll}
              icon={Trash2}
              className="bg-[#c62828] hover:bg-[#b71c1c] text-white border-none shadow-xs"
            >
              {isClearingAll ? "กำลังล้างข้อมูล..." : "ยืนยันการล้างประวัติ"}
            </Button>
          </div>
        </div>
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
          {identifySuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#2e7d32] text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2e7d32]" />
              <span>{identifySuccessMessage}</span>
            </div>
          )}

          {selectedRecordForIdentify && (
            <div className="p-3.5 rounded-2xl bg-[#f7f1e9] border border-[#e8e0d5] flex items-center gap-3.5">
              <img
                src={selectedRecordForIdentify.snapshotPath}
                alt="Captured Face"
                className="w-18 h-18 rounded-2xl object-cover border border-[#e8e0d5] shadow-xs shrink-0"
              />
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1a1a1a]">หมวดหมู่เดิม:</span>
                  <Badge variant={selectedRecordForIdentify.category}>
                    {selectedRecordForIdentify.category}
                  </Badge>
                </div>
                <span className="text-xs font-semibold text-[#1a1a1a]">
                  {selectedRecordForIdentify.name}
                </span>
                <div className="text-[11px] text-[#6b6b6b]">
                  <span>เวลา: {selectedRecordForIdentify.dateStr} ({selectedRecordForIdentify.timeStr})</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#f7f1e9] border border-[#e8e0d5] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIdentifyMode("new")}
              className={`py-2 rounded-lg cursor-pointer transition-all ${
                identifyMode === "new"
                  ? "bg-white text-[#1a1a1a] shadow-xs font-bold"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              ลงทะเบียนเป็นคนใหม่ (New Person)
            </button>
            <button
              type="button"
              onClick={() => setIdentifyMode("existing")}
              className={`py-2 rounded-lg cursor-pointer transition-all ${
                identifyMode === "existing"
                  ? "bg-white text-[#1a1a1a] shadow-xs font-bold"
                  : "text-[#6b6b6b] hover:text-[#1a1a1a]"
              }`}
            >
              ผูกกับคนเดิมในระบบ (Existing)
            </button>
          </div>

          <form onSubmit={handleSaveIdentify} className="flex flex-col gap-4">
            {identifyMode === "new" ? (
              <>
                <Input
                  label="ชื่อ-นามสกุล บุคคล *"
                  placeholder="เช่น นายพงศกร ใจดี (คนสวน)"
                  value={newPersonForm.name}
                  onChange={(e) =>
                    setNewPersonForm({ ...newPersonForm, name: e.target.value })
                  }
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                      ประเภทบุคคล *
                    </label>
                    <select
                      value={newPersonForm.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setNewPersonForm({
                          ...newPersonForm,
                          category: cat,
                          role: cat === "delivery" ? "Delivery" : cat === "stranger" ? "Guest" : "Family",
                          department: cat === "delivery" ? "ขนส่งพัสดุ" : "ครอบครัว",
                        });
                      }}
                      className="w-full bg-white border border-[#e8e0d5] text-[#1a1a1a] text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none focus:border-[#e8b48a] cursor-pointer"
                    >
                      <option value="household">คนในบ้าน (Household)</option>
                      <option value="delivery">คนส่งของ (Delivery)</option>
                      <option value="stranger">คนแปลกหน้า / แขก (Stranger)</option>
                    </select>
                  </div>

                  <Input
                    label="ตำแหน่ง / บทบาท"
                    value={newPersonForm.role}
                    onChange={(e) =>
                      setNewPersonForm({ ...newPersonForm, role: e.target.value })
                    }
                  />
                </div>

                <Textarea
                  label="หมายเหตุเพิ่มเติม"
                  placeholder="รายละเอียดสำหรับการจดจำ"
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
                      {p.name} ({p.category === "household" ? "คนในบ้าน" : p.category === "delivery" ? "คนส่งของ" : "คนแปลกหน้า"}) — {p.images_count} รูป
                    </option>
                  ))}
                </select>
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
    </div>
  );
}
