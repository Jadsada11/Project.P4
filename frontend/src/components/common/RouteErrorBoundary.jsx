import React, { useState } from "react";
import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { RefreshCw, Home, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import Button from "./Button";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  let title = "เกิดข้อผิดพลาดในการโหลดหน้าเว็บ";
  let description = "ระบบพบปัญหาที่ไม่คาดคิด กรุณาลองโหลดใหม่อีกครั้งหรือกลับสู่หน้าหลัก";
  let statusText = "";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "ไม่พบหน้าที่ต้องการ (404 Not Found)";
      description = "หน้าที่คุณกำลังค้นหาไม่มีอยู่ในระบบ หรืออาจถูกย้ายไปยังตำแหน่งอื่นแล้ว";
    } else {
      title = `ข้อผิดพลาดของระบบ (${error.status})`;
      description = error.statusText || description;
    }
    statusText = `${error.status} ${error.statusText || ""}`;
  } else if (error instanceof Error) {
    statusText = error.message;
  }

  const errorMessage = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
  const errorStack = error?.stack;

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#e8e0d5] shadow-xl p-6 md:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-[#fee2e2] text-[#ef4444] border border-[#fca5a5]/50 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {title}
        </h1>

        <p className="text-sm text-[#6b6b6b] leading-relaxed mb-6">
          {description}
        </p>

        {statusText && (
          <div className="mb-6 px-3.5 py-2.5 bg-[#f5f2eb] rounded-xl text-xs font-mono text-[#4a4a4a] break-all border border-[#e2ddd3]">
            {statusText}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            โหลดใหม่อีกครั้ง
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate("/detection")}
            className="flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            กลับหน้าหลัก
          </Button>
        </div>

        {error && (
          <div className="border-t border-[#f0ece4] pt-4 text-left">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs text-[#8c827a] hover:text-[#1a1a1a] transition-colors py-1 cursor-pointer"
            >
              <span>รายละเอียดทางเทคนิค (Developer Info)</span>
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showDetails && (
              <div className="mt-3 p-3 bg-[#1e1e2e] text-[#cdd6f4] rounded-xl text-xs font-mono overflow-x-auto max-h-52 select-all">
                <p className="text-[#f38ba8] font-bold mb-1">{errorMessage}</p>
                {errorStack && (
                  <pre className="text-[10px] text-[#a6adc8] whitespace-pre-wrap leading-tight">
                    {errorStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
