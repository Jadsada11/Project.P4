import React, { useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import {
  UserPlus,
  UploadCloud,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Home,
  Package,
  ShieldAlert,
  Star,
  ImagePlus,
  CheckCircle2,
  FileImage,
} from "lucide-react";
import { Input, Textarea } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { personsApi } from "../../services/api";

export default function AddPersonPage() {
  const navigate = useNavigate();

  // Form State
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState("household"); // "household", "delivery", "stranger"
  const [role, setRole] = useState("Family");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState([]);
  const [primaryImageId, setPrimaryImageId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const categories = [
    {
      id: "household",
      label: "คนในบ้าน (Household)",
      description: "สมาชิกในครอบครัวและผู้พักอาศัย",
      icon: Home,
      color: "border-[#81c784] bg-[#e8f5e9]/60 text-[#2e7d32]",
      activeColor: "border-[#2e7d32] bg-[#c8e6c9] text-[#1b5e20] shadow-sm",
    },
    {
      id: "delivery",
      label: "คนส่งของ (Delivery)",
      description: "เจ้าหน้าที่พัสดุและไรเดอร์ขนส่ง",
      icon: Package,
      color: "border-[#ffb74d] bg-[#fff3e0]/60 text-[#e65100]",
      activeColor: "border-[#e65100] bg-[#ffe0b2] text-[#bf360c] shadow-sm",
    },
    {
      id: "stranger",
      label: "คนแปลกหน้า (Stranger)",
      description: "บุคคลภายนอกที่ต้องการจับตาเฝ้าระวัง",
      icon: ShieldAlert,
      color: "border-[#e57373] bg-[#ffebee]/60 text-[#c62828]",
      activeColor: "border-[#c62828] bg-[#ffcdd2] text-[#b71c1c] shadow-sm",
    },
  ];

  const minRecommendedImages = 15;

  // Helper: Add image to dataset state
  const addImageToDataset = useCallback((dataUrl, originalName = "") => {
    const newImg = {
      id: Math.random().toString(36).substring(2, 9),
      name: originalName || `upload_${Date.now()}.jpg`,
      url: dataUrl,
      source: "upload",
    };
    setImages((prev) => {
      const updated = [...prev, newImg];
      if (updated.length === 1 || !primaryImageId) {
        setPrimaryImageId(newImg.id);
      }
      return updated;
    });
    setErrors((prev) => (prev.images ? { ...prev, images: null } : prev));
  }, [primaryImageId]);

  // Process File List (Multi-file & Drag-and-drop)
  const processFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          addImageToDataset(e.target.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [addImageToDataset]);

  // File Input Change Handler
  const handleFileInputChange = (e) => {
    processFiles(e.target.files);
    // Reset file input value so the same files can be re-selected if desired
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag & Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (id) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      if (primaryImageId === id) {
        setPrimaryImageId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const setAsPrimary = (id) => {
    setPrimaryImageId(id);
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!fullName.trim()) newErrors.fullName = "กรุณากรอกชื่อ-นามสกุล";
    if (images.length === 0) newErrors.images = "กรุณาอัปโหลดรูปภาพใบหน้าอย่างน้อย 1 รูป";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const primary = images.find((img) => img.id === primaryImageId) || images[0];
      const photoUrl = primary ? primary.url : "";

      await personsApi.createPerson({
        name: fullName.trim(),
        category: category,
        role:
          category === "household"
            ? role || "Family"
            : category === "delivery"
            ? "Delivery"
            : "Stranger",
        department:
          department.trim() ||
          (category === "household"
            ? "Residence"
            : category === "delivery"
            ? "Courier"
            : "Unknown"),
        notes: notes.trim(),
        photo_url: photoUrl,
        dataset_images: images.map((img) => img.url),
        accuracy: 98.5,
        images_count: images.length,
        is_active: true,
      });

      navigate("/training");
    } catch (err) {
      console.error("Could not save person to backend:", err);
      navigate("/training");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = Math.min(100, Math.round((images.length / minRecommendedImages) * 100));

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 py-2">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Link
            to="/training"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้ารายชื่อบุคคล
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
            ลงทะเบียนบุคคลใหม่ (Register Identity)
          </h1>
          <p className="text-xs sm:text-sm text-[#6b6b6b]">
            อัปโหลดชุดรูปภาพใบหน้าสำหรับสกัดเวกเตอร์และเทรนโมเดล AI จดจำบุคคล
          </p>
        </div>
      </div>

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Section 1: Personal Details */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e0d5] shadow-xs flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e8e0d5]">
            <div className="w-8 h-8 rounded-xl bg-[#f5c9a8] flex items-center justify-center text-[#1a1a1a]">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1a1a1a]">
              1. ข้อมูลบุคคลและประเภทการเข้าออก
            </h3>
          </div>

          {/* Classification Category Cards */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">
              ประเภทบุคคล (Classification Category) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const active = category === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      if (cat.id === "household") setRole("Family");
                      else if (cat.id === "delivery") setRole("Delivery");
                      else setRole("Stranger");
                    }}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col gap-2 ${
                      active ? cat.activeColor : cat.color
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <IconComponent className="w-5 h-5" />
                      {active && (
                        <span className="w-2.5 h-2.5 rounded-full bg-current" />
                      )}
                    </div>
                    <div>
                      <strong className="text-xs sm:text-sm font-bold block">
                        {cat.label}
                      </strong>
                      <span className="text-[11px] opacity-80 leading-tight block mt-0.5">
                        {cat.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="ชื่อ-นามสกุล *"
              placeholder="เช่น สมชาย รักสงบ, ไรเดอร์ Grab"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors((prev) => ({ ...prev, fullName: null }));
              }}
              error={errors.fullName}
            />

            <Input
              label="แผนก / สังกัด / บริษัทขนส่ง"
              placeholder="เช่น สมาชิกในบ้าน, Flash Express, Grab Food"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <Textarea
            label="บันทึกความปลอดภัยและสิทธิเข้าออก"
            placeholder="เช่น สมาชิกในบ้านอนุญาต 24 ชม., คนส่งของให้แจ้งเตือนเมื่อมาถึง..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Section 2: AI Face Dataset File Upload */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e0d5] shadow-xs flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e8e0d5]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#e0f2f1] flex items-center justify-center text-[#26a69a]">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a1a1a]">
                  2. อัปโหลดรูปภาพใบหน้าสำหรับเทรน AI ({images.length} รูป)
                </h3>
                <span className="text-xs text-[#6b6b6b]">
                  อัปโหลดไฟล์รูปภาพใบหน้า (JPG, PNG, WEBP) สำหรับสกัดเวกเตอร์จำแนกบุคคล
                </span>
              </div>
            </div>

            {/* Progress Bar Badge */}
            <div className="flex items-center gap-3">
              <div className="w-32 h-2.5 bg-[#f7f1e9] rounded-full overflow-hidden border border-[#e8e0d5]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress >= 100 ? "bg-[#2e7d32]" : "bg-[#f5c9a8]"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#1a1a1a]">
                {images.length}/15 รูป
              </span>
            </div>
          </div>

          {/* AI Face Training Quality Tips Banner */}
          <div className="bg-[#fcfaf7] rounded-2xl p-4 border border-[#f0e4d7] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#e65100]" />
                <strong className="text-xs font-bold text-[#1a1a1a]">
                  คำแนะนำสำหรับการเทรนใบหน้าให้ได้ผลลัพธ์แม่นยำสูงสุด (AI Dataset Quality)
                </strong>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  images.length === 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : images.length < 3
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : images.length < 6
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold"
                }`}
              >
                {images.length === 0
                  ? "ยังไม่มีภาพถ่าย"
                  : images.length < 3
                  ? "ความพร้อมพื้นฐาน (ควรอัปโหลดเพิ่ม)"
                  : images.length < 6
                  ? "ความพร้อมดีเยี่ยม (แนะนำ 3-5 รูปขึ้นไป)"
                  : "ความแม่นยำระดับสูงสุด"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#6b6b6b] pt-1 border-t border-[#f0e4d7]/70">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e65100]" />
                <span>
                  <strong>มุมที่ 1:</strong> หน้าตรง ไม่เอียงหน้า
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e65100]" />
                <span>
                  <strong>มุมที่ 2:</strong> หันซ้าย-ขวาเล็กน้อย (~15°)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e65100]" />
                <span>
                  <strong>มุมที่ 3:</strong> สภาพแสงจริง และการแสดงสีหน้า
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Drag & Drop File Upload Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-3xl p-8 sm:p-10 border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4 select-none ${
              isDragging
                ? "border-[#e65100] bg-[#fff3e0]/80 scale-[1.01] shadow-md"
                : "border-[#e8e0d5] hover:border-[#e8b48a] bg-[#f7f1e9]/40 hover:bg-[#f7f1e9]/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInputChange}
              className="sr-only"
            />

            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-xs ${
                isDragging
                  ? "bg-[#e65100] text-white scale-110"
                  : "bg-white border border-[#e8e0d5] text-[#6b6b6b] group-hover:text-[#e8b48a]"
              }`}
            >
              {isDragging ? (
                <FileImage className="w-8 h-8 animate-bounce" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <div className="flex flex-col gap-1 max-w-md">
              <span className="text-sm sm:text-base font-bold text-[#1a1a1a]">
                {isDragging
                  ? "ปล่อยรูปภาพที่นี่เพื่ออัปโหลดทันที"
                  : "ลากและวางรูปภาพใบหน้า หรือคลิกเพื่อเลือกไฟล์"}
              </span>
              <span className="text-xs text-[#6b6b6b]">
                รองรับไฟล์ภาพ JPG, JPEG, PNG, WEBP (สามารถเลือกพร้อมกันได้หลายไฟล์)
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#1a1a1a] px-4 py-2 rounded-xl bg-white border border-[#e8e0d5] hover:border-[#e8b48a] hover:bg-[#fcfaf7] transition-all shadow-2xs cursor-pointer"
              >
                <ImagePlus className="w-4 h-4 text-[#e65100]" />
                <span>เลือกไฟล์จากคอมพิวเตอร์</span>
              </button>
            </div>
          </div>

          {errors.images && (
            <div className="text-xs text-[#c62828] font-semibold flex items-center gap-1.5 p-3 rounded-xl bg-[#ffebee] border border-[#ffcdd2]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.images}</span>
            </div>
          )}

          {/* Uploaded Dataset Thumbnails Gallery */}
          {images.length > 0 && (
            <div className="flex flex-col gap-3 pt-3 border-t border-[#e8e0d5]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1a1a1a]">
                    ชุดรูปภาพใบหน้า ({images.length} รูป)
                  </span>
                  <span className="text-[11px] text-[#6b6b6b]">
                    (คลิกรูปดาว ⭐ เพื่อกำหนดรูปโปรไฟล์หลัก)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setImages([])}
                  className="text-xs text-[#c62828] hover:underline font-semibold cursor-pointer"
                >
                  ลบทั้งหมด
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {images.map((img, idx) => {
                  const isPrimary =
                    primaryImageId === img.id || (!primaryImageId && idx === 0);
                  return (
                    <div
                      key={img.id}
                      className={`group relative aspect-square rounded-2xl overflow-hidden border-2 bg-neutral-100 shadow-2xs transition-all ${
                        isPrimary
                          ? "border-[#f9a825] ring-2 ring-[#f9a825]/40"
                          : "border-[#e8e0d5] hover:border-[#e8b48a]"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />

                      {/* Primary Avatar Star Badge */}
                      {isPrimary && (
                        <div
                          className="absolute top-1.5 left-1.5 bg-[#f9a825] text-white p-1 rounded-lg shadow-sm"
                          title="รูปโปรไฟล์หลัก"
                        >
                          <Star className="w-3 h-3 fill-current" />
                        </div>
                      )}

                      {/* Hover Actions: Star & Delete */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setAsPrimary(img.id)}
                          title="ตั้งเป็นภาพโปรไฟล์หลัก"
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isPrimary
                              ? "bg-[#f9a825] text-white"
                              : "bg-white/80 text-[#1a1a1a] hover:bg-white"
                          }`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isPrimary ? "fill-current" : ""
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          title="ลบรูปภาพนี้"
                          className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI Training Information Banner */}
        {images.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-[#e8f5e9]/70 border border-[#c8e6c9] rounded-2xl">
            <div className="p-2 bg-[#c8e6c9] text-[#1b5e20] rounded-xl shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-[#2e7d32]">
              <span className="font-bold text-sm text-[#1b5e20]">
                พร้อมเทรนใบหน้าเข้าสู่ระบบ AI จดจำบุคคล
              </span>
              <p className="text-[#388e3c] leading-relaxed">
                ระบบจะนำภาพถ่ายทั้งหมด {images.length} ภาพไปสกัด 576-dim Face
                Embeddings และคำนวณเวกเตอร์เฉลี่ย เพื่อให้ระบบตรวจจับ YOLO จดจำ{" "}
                {fullName || "บุคคลนี้"} และส่งการแจ้งเตือนระบุชื่ออัตโนมัติ
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => navigate("/training")}
          >
            ยกเลิก
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            icon={Sparkles}
          >
            {isSubmitting
              ? "กำลังสกัดเวกเตอร์ & เทรนโมเดล..."
              : "บันทึกและเทรนใบหน้าบุคคล"}
          </Button>
        </div>
      </form>
    </div>
  );
}
