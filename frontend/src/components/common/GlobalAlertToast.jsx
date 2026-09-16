import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell, AlertTriangle, Package, CheckCircle2, X, ExternalLink, Sparkles } from "lucide-react";
import { useDetection } from "../../context/DetectionContext";

export default function GlobalAlertToast() {
  const location = useLocation();
  const navigate = useNavigate();
  const { alertNotification, dismissAlert } = useDetection();

  // On /detection page, the page renders its own inline banner; only show toast on other pages
  const isOnDetectionPage = location.pathname === "/detection";

  useEffect(() => {
    if (!alertNotification) return;

    // Auto-dismiss after 7 seconds
    const timer = setTimeout(() => {
      dismissAlert();
    }, 7000);

    return () => clearTimeout(timer);
  }, [alertNotification, dismissAlert]);

  if (!alertNotification || isOnDetectionPage) {
    return null;
  }

  const isStranger = alertNotification.isStranger || alertNotification.category === "stranger";
  const isDelivery = alertNotification.category === "delivery";

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div
        className={`p-4 rounded-2xl border shadow-xl backdrop-blur-md flex flex-col gap-3 transition-all ${
          isStranger
            ? "bg-[#fff3e0]/95 border-[#ffb74d] text-[#e65100] shadow-[#ffb74d]/20"
            : isDelivery
            ? "bg-[#e3f2fd]/95 border-[#90caf9] text-[#1565c0] shadow-[#90caf9]/20"
            : "bg-[#e8f5e9]/95 border-[#a5d6a7] text-[#2e7d32] shadow-[#a5d6a7]/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isStranger
                  ? "bg-[#ffe0b2] text-[#e65100]"
                  : isDelivery
                  ? "bg-[#bbdefb] text-[#1565c0]"
                  : "bg-[#c8e6c9] text-[#2e7d32]"
              }`}
            >
              {isStranger ? (
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              ) : isDelivery ? (
                <Package className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                  {isStranger ? "AI Alert" : isDelivery ? "Delivery" : "Household"}
                </span>
                <span className="text-[11px] opacity-75 font-mono">{alertNotification.time}</span>
              </div>
              <h4 className="text-sm font-extrabold mt-1 leading-tight">
                {alertNotification.title}
              </h4>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                {alertNotification.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissAlert}
            className="text-[#6b6b6b] hover:text-[#1a1a1a] p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/5">
          {isStranger ? (
            <button
              type="button"
              onClick={() => {
                dismissAlert();
                navigate("/alerts");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e65100] text-white hover:bg-[#bf360c] cursor-pointer shadow-xs transition-all"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>ดูในหน้าระบบแจ้งเตือน</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                dismissAlert();
                navigate("/detection");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-[#1a1a1a] cursor-pointer border border-black/10 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดกล้องตรวจจับสด</span>
            </button>
          )}

          <button
            type="button"
            onClick={dismissAlert}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-black/5 transition-all cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
