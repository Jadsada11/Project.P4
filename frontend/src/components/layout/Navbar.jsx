import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Shield, Camera, Clock, Database, Bell, UserPlus, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDetection } from "../../context/DetectionContext";
import { alertsApi } from "../../services/api";

export default function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const detection = useDetection();
  const isAutoDetect = detection?.isAutoDetect;
  const isDetecting = detection?.isDetecting;
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const count = await alertsApi.getUnreadCount();
      setUnreadAlertsCount(count);
    } catch {
      // fallback silent
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 8000);
    const handleAlertsUpdated = () => fetchUnreadCount();
    window.addEventListener("vigil-alerts-updated", handleAlertsUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("vigil-alerts-updated", handleAlertsUpdated);
    };
  }, []);

  const navLinks = [
    { name: "Live Detection", path: "/detection", icon: Camera },
    { name: "Training & DB", path: "/training", icon: Database },
    { name: "History", path: "/history", icon: Clock },
    {
      name: "Alerts",
      path: "/alerts",
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : null,
    },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-4 z-40 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="bg-white/85 backdrop-blur-md border border-[#e8e0d5] shadow-sm rounded-2xl px-4 py-2.5 flex items-center justify-between gap-4 transition-all">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#f5c9a8] flex items-center justify-center text-[#1a1a1a] shadow-xs group-hover:bg-[#e8b48a] transition-all">
            <Shield className="w-5 h-5 text-[#1a1a1a]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-[#1a1a1a] text-lg leading-tight">
                VIGIL
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#e8f5e9] text-[#2e7d32] px-1.5 py-0.5 rounded-full border border-[#a5d6a7]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-ping" />
                AI IOT
              </span>
            </div>
            <span className="text-[10px] text-[#6b6b6b] font-medium hidden sm:inline">
              Face Recognition Security
            </span>
          </div>
        </Link>

        {/* Capsule Navigation (.nav-pills) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#f7f1e9]/80 p-1.5 rounded-xl border border-[#e8e0d5]/60">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  active
                    ? "bg-white text-[#1a1a1a] shadow-xs"
                    : "text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-white/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#e8b48a]" : ""}`} />
                <span>{item.name}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#c62828] text-white font-bold leading-none animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live AI Camera 24/7 Status Indicator */}
          <Link
            to="/detection"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
              isAutoDetect
                ? "bg-[#e8f5e9] text-[#2e7d32] border-[#a5d6a7] hover:bg-[#c8e6c9]"
                : "bg-[#f7f1e9] text-[#6b6b6b] border-[#e8e0d5] hover:text-[#1a1a1a]"
            }`}
            title={
              isAutoDetect
                ? "ระบบกล้องและ AI กำลังตรวจจับอัตโนมัติ 24/7 (คลิกเพื่อดูกล้องสด)"
                : "ระบบตรวจจับกล้องหยุดชั่วคราว (คลิกเพื่อเปิดใช้งาน)"
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAutoDetect
                  ? isDetecting
                    ? "bg-[#e65100] animate-ping"
                    : "bg-[#2e7d32] animate-pulse"
                  : "bg-neutral-400"
              }`}
            />
            <span className="hidden lg:inline">
              {isDetecting ? "AI DETECTING" : isAutoDetect ? "CAM 24/7 ACTIVE" : "CAM PAUSED"}
            </span>
            <span className="lg:hidden">{isAutoDetect ? "CAM ON" : "CAM OFF"}</span>
          </Link>

          <Link
            to="/add-person"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#f5c9a8] hover:bg-[#e8b48a] text-[#1a1a1a] transition-all shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Person</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 bg-[#f7f1e9] border border-[#e8e0d5] px-3 py-1 rounded-xl text-xs">
                <div className="w-6 h-6 rounded-full bg-[#e8b48a] text-[#1a1a1a] flex items-center justify-center font-bold text-[10px]">
                  {user?.full_name?.charAt(0) || "U"}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="font-bold text-[#1a1a1a] truncate max-w-[100px]">
                    {user?.full_name?.split(" ")[0]}
                  </span>
                  <span className="text-[9px] text-[#6b6b6b] capitalize font-medium">
                    {user?.role || "Operator"}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-[#ffebee] text-[#c62828] border border-[#e8e0d5] hover:border-[#ef9a9a] transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-[#f7f1e9] text-[#1a1a1a] border border-[#e8e0d5] transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-[#6b6b6b]" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navbar */}
      <div className="md:hidden flex items-center justify-around mt-2 bg-white/90 backdrop-blur-md border border-[#e8e0d5] rounded-xl p-1.5 shadow-xs">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                active ? "bg-[#f5c9a8] text-[#1a1a1a]" : "text-[#6b6b6b]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
              {item.badge && (
                <span className="w-2 h-2 rounded-full bg-[#c62828]" />
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
