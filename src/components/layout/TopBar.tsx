"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Wifi, WifiOff } from "lucide-react";

interface TopBarProps {
  title?: string;
  showStatus?: boolean;
}

export default function TopBar({ title = "KARTABUMI", showStatus = true }: TopBarProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial status
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-brand-dark px-4 flex items-center justify-between border-b border-white/5 md:max-w-md md:mx-auto md:rounded-b-2xl md:shadow-md">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-gold to-status-diterima flex items-center justify-center shadow-md">
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-black tracking-widest text-white leading-none">
            {title}
          </h1>
          <span className="text-[8px] font-medium text-brand-teal uppercase tracking-wider mt-0.5">
            Ringinharjo • Bantul
          </span>
        </div>
      </div>

      {/* Online/Offline Status Indicator */}
      {showStatus && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-500 shadow-sm ${
            isOnline
              ? "bg-status-diterima/10 text-status-diterima border border-status-diterima/20"
              : "bg-status-belum/10 text-status-belum border border-status-belum/20"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? "bg-status-diterima" : "bg-status-belum"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                isOnline ? "bg-status-diterima" : "bg-status-belum"
              }`}
            />
          </span>
          {isOnline ? (
            <span className="flex items-center gap-1">
              Online <Wifi size={10} className="opacity-80" />
            </span>
          ) : (
            <span className="flex items-center gap-1">
              Offline <WifiOff size={10} className="opacity-80" />
            </span>
          )}
        </div>
      )}
    </header>
  );
}
