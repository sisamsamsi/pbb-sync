"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import type { WajibPajak } from "@/src/db/schema";
import PageWrapper from "@/src/components/layout/PageWrapper";
import Link from "next/link";
import { AlertTriangle, MapPin, Search, Edit2, CheckCircle, RefreshCw, Trash2 } from "lucide-react";

const BLOK_FILTERS = [
  { label: "Semua", value: "" },
  { label: "Blok 013", value: "013" },
  { label: "Blok 014", value: "014" },
  { label: "Blok 015", value: "015" },
];

export default function ValidasiPage() {
  const [search, setSearch] = useState("");
  const [blokFilter, setBlokFilter] = useState("");

  // 1. Query reaktif data wajib pajak & polygon dari IndexedDB (Dexie)
  const allWp = useLiveQuery(() => db.wajibPajak.toArray());
  const allPolygons = useLiveQuery(() => db.polygonBidang.toArray());

  // 2. Hitung statistik kualitas pemetaan
  const stats = useMemo(() => {
    if (!allWp || !allPolygons) return { total: 0, mapped: 0, pct: 0 };
    
    const total = allWp.length;
    
    // NOP yang sudah terpetakan di tabel polygon
    const mappedNops = new Set(allPolygons.filter((p) => parsePointsCount(p.points) >= 3).map((p) => p.nop));
    const mappedCount = allWp.filter((w) => mappedNops.has(w.nop)).length;
    const pct = total > 0 ? Math.round((mappedCount / total) * 100) : 0;

    return {
      total,
      mapped: mappedCount,
      pct,
    };
  }, [allWp, allPolygons]);

  // Helper untuk menghitung jumlah titik polygon
  const parsePointsCount = (pointsJson: string): number => {
    try {
      const arr = JSON.parse(pointsJson);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  };

  // 3. Filter Wajib Pajak yang BELUM memiliki polygon (Data Kualitas Bermasalah)
  const unmappedWpList = useMemo(() => {
    if (!allWp || !allPolygons) return [];

    const mappedNops = new Set(allPolygons.filter((p) => parsePointsCount(p.points) >= 3).map((p) => p.nop));

    return allWp.filter((wp) => {
      // Belum terpetakan
      const isUnmapped = !mappedNops.has(wp.nop);
      
      // Filter Blok
      const matchBlok = !blokFilter || wp.blok === blokFilter;

      // Filter Pencarian
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        wp.namaWp.toLowerCase().includes(q) ||
        wp.nop.includes(q) ||
        wp.nomorPetak.includes(q);

      return isUnmapped && matchBlok && matchSearch;
    });
  }, [allWp, allPolygons, search, blokFilter]);

  // 4. Bersihkan polygon rusak (Cacat: kurang dari 3 titik)
  const handleCleanupCorrupt = async () => {
    if (!allPolygons) return;

    const corruptPolygons = allPolygons.filter((p) => parsePointsCount(p.points) < 3);
    
    if (corruptPolygons.length === 0) {
      alert("🎉 Keren! Tidak ditemukan polygon rusak (cacat) di database Anda.");
      return;
    }

    const confirmCleanup = confirm(
      `Ditemukan ${corruptPolygons.length} data polygon rusak (kurang dari 3 titik koordinat) hasil ekstraksi PDF otomatis yang gagal.\n\nApakah Anda ingin membersihkannya?`
    );

    if (confirmCleanup) {
      const idsToDelete = corruptPolygons.map((p) => p.id).filter((id): id is number => id !== undefined);
      await db.polygonBidang.bulkDelete(idsToDelete);
      alert(`✅ Berhasil membersihkan ${idsToDelete.length} data polygon rusak.`);
    }
  };

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-4 animate-slide-up h-full pb-10">
        {/* Title Section */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-brand-dark flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-belum animate-pulse" /> Kualitas Pemetaan
          </h2>
          <p className="text-xs text-brand-teal font-medium mt-1">
            Deteksi wajib pajak DHKP yang belum terpetakan polygon-nya di Google Maps.
          </p>
        </div>

        {/* Overall Progress QC Card */}
        <section className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-teal">
                Akurasi Pemetaan Desa
              </span>
              <h3 className="text-sm font-black text-brand-dark mt-0.5">
                {stats.mapped} dari {stats.total} Bidang Terpetakan
              </h3>
            </div>
            <span className="text-xl font-black text-status-diterima">
              {stats.pct}%
            </span>
          </div>

          <div className="w-full bg-brand-light h-2 rounded-full overflow-hidden">
            <div
              className="bg-status-diterima h-full rounded-full transition-all duration-1000"
              style={{ width: `${stats.pct}%` }}
            />
          </div>

          <button
            onClick={handleCleanupCorrupt}
            className="w-full py-2 rounded-xl border border-status-belum/20 hover:bg-status-belum/5 text-status-belum font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" /> Bersihkan Sampah Polygon Cacat
          </button>
        </section>

        {/* Filter & Search Bar */}
        <div className="bg-brand-dark -mx-4 px-4 pb-4 pt-1 flex flex-col gap-3 shadow-md md:rounded-b-2xl">
          <div className="flex items-center justify-between text-white text-xs font-bold">
            <span>Daftar Bidang Belum Terpetakan</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-md font-mono text-[10px] text-brand-teal">
              {unmappedWpList.length} WP
            </span>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white">
            <Search className="w-4 h-4 text-brand-teal shrink-0" />
            <input
              type="text"
              placeholder="Cari Nama / NOP / No Petak..."
              className="bg-transparent border-none text-xs text-white placeholder-brand-teal outline-none w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Chips Blok */}
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal">
            Filter Per Blok
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-brand-dark/5">
            {BLOK_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setBlokFilter(f.value)}
                className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg border transition-all duration-200 shrink-0 ${
                  blokFilter === f.value
                    ? "bg-brand-dark border-brand-dark text-white shadow-sm"
                    : "bg-white border-brand-dark/5 text-brand-dark hover:bg-brand-light"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List Target Belum Terpetakan */}
        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[calc(100vh-320px)] pb-10">
          {unmappedWpList.length > 0 ? (
            unmappedWpList.map((wp) => (
              <Link
                key={wp.nop}
                href={`/peta?drawForNop=${wp.nop}&drawForBlok=${wp.blok}`}
                className="bg-white rounded-xl p-3 border border-brand-dark/5 flex items-center justify-between hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-status-belum/10 text-status-belum flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                    {wp.namaWp.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-brand-dark truncate pr-2">
                      {wp.namaWp}
                    </h4>
                    <span className="text-[9px] text-brand-teal font-mono block mt-0.5">
                      Petak {wp.nomorPetak} • NOP: {wp.nop}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black text-brand-dark leading-none">
                      {wp.jumlahSppt === 0 ? "Bebas" : `Rp ${wp.jumlahSppt.toLocaleString("id-ID")}`}
                    </p>
                    <span className="text-[8px] font-bold text-status-belum bg-status-belum/10 px-1.5 py-0.5 rounded-full inline-block mt-1 uppercase">
                      NO MAP 🗺️
                    </span>
                  </div>
                  <div className="p-1 rounded-lg bg-brand-light text-brand-gold hover:bg-brand-gold/10">
                    <Edit2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <span className="text-3xl">🎉</span>
              <div>
                <h4 className="text-xs font-bold text-brand-dark">Semua Petak Terpetakan!</h4>
                <p className="text-[9px] text-brand-teal mt-0.5 max-w-[240px]">
                  Tidak ada wajib pajak yang belum memiliki polygon di peta satelit pada blok terpilih.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
