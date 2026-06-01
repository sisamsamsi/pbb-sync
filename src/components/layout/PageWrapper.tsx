"use client";

import BottomNav from "./BottomNav";
import TopBar from "./TopBar";

interface PageWrapperProps {
  children: React.ReactNode;
  title?: string;
  showStatus?: boolean;
}

export default function PageWrapper({
  children,
  title = "KARTABUMI",
  showStatus = true,
}: PageWrapperProps) {
  return (
    <div className="flex flex-col min-h-full w-full bg-[#F0F4F7] md:max-w-md md:mx-auto md:shadow-2xl md:relative md:overflow-x-hidden">
      {/* Header Statis */}
      <TopBar title={title} showStatus={showStatus} />

      {/* Konten Utama dengan Margin Atas & Bawah, serta Animasi Transisi */}
      <main className="flex-1 w-full px-4 pt-18 pb-20 animate-slide-up">
        {children}
      </main>

      {/* Navigasi Bawah Statis */}
      <BottomNav />
    </div>
  );
}
