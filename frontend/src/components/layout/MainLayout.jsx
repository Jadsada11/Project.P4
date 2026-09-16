import React from "react";
import { Outlet } from "react-router";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { DetectionProvider } from "../../context/DetectionContext";
import GlobalAlertToast from "../common/GlobalAlertToast";

export default function MainLayout() {
  return (
    <DetectionProvider>
      <div className="min-h-screen flex flex-col bg-[#f7f1e9] text-[#1a1a1a] relative">
        <GlobalAlertToast />
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </DetectionProvider>
  );
}
