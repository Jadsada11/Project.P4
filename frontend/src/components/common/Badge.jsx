import React from "react";

export default function Badge({ children, variant = "default", className = "", size = "md" }) {
  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const variantClasses = {
    default: "bg-[#f7f1e9] text-[#6b6b6b] border border-[#e8e0d5]",
    known: "bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] font-semibold",
    unknown: "bg-[#ffebee] text-[#c62828] border border-[#ffcdd2] font-semibold",
    threat: "bg-[#c62828] text-white border border-[#b71c1c] font-semibold animate-pulse",

    // Core Categories
    household: "bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] font-bold",
    neighbor: "bg-[#e0f7fa] text-[#00838f] border border-[#80deea] font-bold",
    friend: "bg-[#f3e5f5] text-[#7b1fa2] border border-[#ce93d8] font-bold",
    delivery: "bg-[#fff3e0] text-[#e65100] border border-[#ffe0b2] font-bold",
    other: "bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] font-bold",
    stranger: "bg-[#ffebee] text-[#c62828] border border-[#ffcdd2] font-bold",

    // Roles
    employee: "bg-[#e0f2f1] text-[#26a69a] border border-[#80cbc4] font-medium",
    family: "bg-[#e8f5e9] text-[#2e7d32] border border-[#a5d6a7] font-medium",
    vip: "bg-[#ede7f6] text-[#673ab7] border border-[#d1c4e9] font-semibold",
    visitor: "bg-[#e3f2fd] text-[#1976d2] border border-[#bbdefb] font-medium",
    blacklist: "bg-[#ffebee] text-[#c62828] border border-[#ffcdd2] font-bold",

    // Alerts
    critical: "bg-[#ffebee] text-[#c62828] border border-[#ffcdd2] font-bold",
    warning: "bg-[#fff3e0] text-[#e65100] border border-[#ffe0b2] font-semibold",
    high: "bg-[#fff3e0] text-[#e65100] border border-[#ffe0b2] font-semibold",
    normal: "bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9] font-medium",
    info: "bg-[#e3f2fd] text-[#1976d2] border border-[#bbdefb] font-medium",
  };

  const key = String(variant).toLowerCase();
  const activeClass = variantClasses[key] || variantClasses.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide uppercase ${sizeClasses[size] || sizeClasses.md} ${activeClass} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
      {children}
    </span>
  );
}
