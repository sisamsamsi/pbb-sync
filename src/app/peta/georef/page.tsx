"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const GeorefPageContent = dynamic(
  () => import("@/src/components/peta/GeorefPageContent"),
  {
    ssr: false,
  }
);

export default function GeorefPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-brand-light">
        <span className="w-3.5 h-3.5 rounded bg-brand-gold animate-ping mx-auto" />
        <span className="text-xs text-brand-teal font-extrabold uppercase mt-2">Memuat Modul Georeferencing...</span>
      </div>
    }>
      <GeorefPageContent />
    </Suspense>
  );
}
