"use client";

import { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import type { WajibPajak } from "@/src/db/schema";
import PageWrapper from "@/src/components/layout/PageWrapper";
import Link from "next/link";
import { Search, User, MapPin, BadgePercent, ChevronRight, X, Calendar, Edit2, Save } from "lucide-react";

const BLOK_FILTERS = [
  { label: "Semua", value: "" },
  { label: "Blok 013", value: "013" },
  { label: "Blok 014", value: "014" },
  { label: "Blok 015", value: "015" },
];

const STATUS_FILTERS = [
  { label: "Semua", value: "" },
  { label: "Belum", value: "belum" },
  { label: "Diterima", value: "diterima" },
  { label: "Sawah", value: "sawah" },
];

export default function WajibPajakPage() {
  const [search, setSearch] = useState("");
  const [blokFilter, setBlokFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(30);

  // Modal Detail State
  const [selectedWp, setSelectedWp] = useState<WajibPajak | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Query reaktif semua Wajib Pajak dari Dexie
  const allWp = useLiveQuery(() => db.wajibPajak.toArray());

  // Filtering data di memori (Super cepat untuk 1.000 - 5.000 records, <2ms!)
  const filteredData = useMemo(() => {
    if (!allWp) return [];

    return allWp.filter((wp) => {
      // 1. Filter Pencarian (Nama, NOP, atau Nomor Petak)
      const keyword = search.trim().toLowerCase();
      const matchSearch =
        !keyword ||
        wp.namaWp.toLowerCase().includes(keyword) ||
        wp.nop.includes(keyword) ||
        wp.nomorPetak.includes(keyword);

      // 2. Filter Blok
      const matchBlok = !blokFilter || wp.blok === blokFilter;

      // 3. Filter Status Bayar
      const matchStatus = !statusFilter || wp.statusBayar === statusFilter;

      return matchSearch && matchBlok && matchStatus;
    });
  }, [allWp, search, blokFilter, statusFilter]);

  // Paginated data untuk virtual-like scroll
  const paginatedData = useMemo(() => {
    return filteredData.slice(0, pageSize);
  }, [filteredData, pageSize]);

  const hasMore = filteredData.length > pageSize;

  const handleLoadMore = () => {
    setPageSize((prev) => prev + 30);
  };

  // Reset pagination saat filter/search berubah
  useEffect(() => {
    setPageSize(30);
  }, [search, blokFilter, statusFilter]);

  // Status Styling Utilities
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "diterima":
        return {
          bg: "bg-emerald-500/10",
          text: "text-status-diterima",
          border: "border-status-diterima/20",
          dot: "bg-status-diterima",
          label: "Sudah Diterima",
        };
      case "sawah":
        return {
          bg: "bg-amber-500/10",
          text: "text-status-sawah",
          border: "border-status-sawah/20",
          dot: "bg-status-sawah",
          label: "Sawah / Bebas",
        };
      default:
        return {
          bg: "bg-red-500/10",
          text: "text-status-belum",
          border: "border-status-belum/20",
          dot: "bg-status-belum",
          label: "Belum Diterima",
        };
    }
  };

  // Open Detail
  const handleOpenDetail = (wp: WajibPajak) => {
    setSelectedWp(wp);
    setEditNotes(wp.catatan || "");
    setEditStatus(wp.statusBayar);
    setIsEditing(false);
  };

  // Save Detail Edit (Catatan & Status)
  const handleSaveEdit = async () => {
    if (!selectedWp || !selectedWp.id) return;

    try {
      await db.wajibPajak.update(selectedWp.id, {
        statusBayar: editStatus,
        catatan: editNotes,
        updatedAt: new Date().toISOString(),
      });

      // Update selected status agar modal ikut terupdate
      setSelectedWp((prev) =>
        prev
          ? {
              ...prev,
              statusBayar: editStatus,
              catatan: editNotes,
            }
          : null
      );
      setIsEditing(false);
    } catch (e) {
      alert("Gagal memperbarui data: " + String(e));
    }
  };

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-4 animate-slide-up h-full">
        {/* 1. Header & Search Bar */}
        <div className="bg-brand-dark -mx-4 px-4 pb-4 pt-1 flex flex-col gap-3 shadow-md md:rounded-b-2xl">
          <div className="flex items-center justify-between text-white">
            <h2 className="text-base font-extrabold flex items-center gap-1.5">
              👥 Data Wajib Pajak (DHKP)
            </h2>
            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-md tracking-wider uppercase text-brand-teal">
              {filteredData.length} WP
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white">
            <Search className="w-4 h-4 text-brand-teal shrink-0" />
            <input
              type="text"
              placeholder="Cari Nama / NOP / Nomor Petak..."
              className="bg-transparent border-none text-xs text-white placeholder-brand-teal/70 outline-none w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-brand-teal/80 hover:text-white transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Filter Row - Blok */}
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal">
            Filter Blok Wilayah
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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

        {/* 3. Filter Row - Status */}
        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal">
            Filter Status Distribusi
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-brand-dark/5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg border transition-all duration-200 shrink-0 ${
                  statusFilter === f.value
                    ? "bg-brand-dark border-brand-dark text-white shadow-sm"
                    : "bg-white border-brand-dark/5 text-brand-dark hover:bg-brand-light"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Main List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[calc(100vh-270px)] pb-10">
          {paginatedData.length > 0 ? (
            <>
              {paginatedData.map((wp) => {
                const status = getStatusStyle(wp.statusBayar);
                return (
                  <div
                    key={wp.nop}
                    onClick={() => handleOpenDetail(wp)}
                    className="bg-white rounded-xl p-3 border border-brand-dark/5 flex items-center justify-between cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-sm uppercase ${status.bg} ${status.text}`}>
                        {wp.namaWp.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-brand-dark truncate pr-2">
                          {wp.namaWp}
                        </h4>
                        <span className="text-[9px] text-brand-teal font-mono tracking-tighter block mt-0.5">
                          {wp.blok}-{wp.nomorPetak} • {wp.padukuhan || "Mandingan"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-black text-brand-dark leading-none">
                          {wp.jumlahSppt === 0 ? "Bebas" : `Rp ${wp.jumlahSppt.toLocaleString("id-ID")}`}
                        </p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1 uppercase ${status.bg} ${status.text}`}>
                          {wp.statusBayar === "diterima" ? "✓ Diterima" : wp.statusBayar === "sawah" ? "🌾 Sawah" : "⏳ Belum"}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-brand-teal" />
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-2.5 rounded-xl border border-brand-dark/10 bg-white hover:bg-brand-light text-brand-dark font-extrabold text-[10px] uppercase tracking-wider transition-colors duration-200 mt-2"
                >
                  Muat Lebih Banyak...
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <span className="text-4xl">👥</span>
              <div>
                <h4 className="text-xs font-bold text-brand-dark">Tidak Ada Data Wajib Pajak</h4>
                <p className="text-[10px] text-brand-teal/80 mt-1 max-w-[240px]">
                  Coba sesuaikan pencarian atau filter Anda, atau impor data DHKP di menu Pengaturan.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. Details Modal Sheet (Premium Overlay) */}
        {selectedWp && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-sm flex justify-center items-end animate-fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up shadow-2xl relative">
              {/* Header Modal */}
              <div className="bg-brand-dark text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="min-w-0">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal font-mono">
                    Detail NOP: {selectedWp.nop}
                  </span>
                  <h3 className="text-sm font-black truncate text-white uppercase mt-0.5">
                    {selectedWp.namaWp}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedWp(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-5 space-y-4 text-xs">
                {/* Status & SPPT Overview */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-brand-light rounded-xl p-3 border border-brand-dark/5">
                    <span className="text-[8px] font-bold text-brand-teal uppercase tracking-wider block mb-1">
                      Jumlah SPPT PBB
                    </span>
                    <p className="text-sm font-black text-brand-dark">
                      {selectedWp.jumlahSppt === 0 ? "Bebas Pajak" : `Rp ${selectedWp.jumlahSppt.toLocaleString("id-ID")}`}
                    </p>
                  </div>
                  <div className="bg-brand-light rounded-xl p-3 border border-brand-dark/5">
                    <span className="text-[8px] font-bold text-brand-teal uppercase tracking-wider block mb-1">
                      Lokasi Blok
                    </span>
                    <p className="text-sm font-black text-brand-dark">
                      Blok {selectedWp.blok} - Petak {selectedWp.nomorPetak}
                    </p>
                  </div>
                </div>

                {/* Detail Informasi Objek */}
                <div className="space-y-2 border-t border-brand-dark/5 pt-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal mb-2">
                    Informasi Objek Pajak
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] border-b border-brand-light pb-2">
                    <div>
                      <span className="text-brand-teal font-medium">Luas Bumi:</span>
                      <p className="font-bold text-brand-dark mt-0.5">{selectedWp.luasBumi} m²</p>
                    </div>
                    <div>
                      <span className="text-brand-teal font-medium">Luas Bangunan:</span>
                      <p className="font-bold text-brand-dark mt-0.5">{selectedWp.luasBangunan} m²</p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-start mt-2">
                    <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <div>
                      <span className="text-brand-teal font-medium">Alamat Objek Bumi:</span>
                      <p className="font-bold text-brand-dark leading-relaxed mt-0.5">
                        {selectedWp.alamatObjek || "-"} (Padukuhan {selectedWp.padukuhan || "Mandingan"})
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-start mt-2">
                    <User className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                    <div>
                      <span className="text-brand-teal font-medium">Alamat Wajib Pajak:</span>
                      <p className="font-bold text-brand-dark leading-relaxed mt-0.5">
                        {selectedWp.alamatWp || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Bayar & Catatan (Edit Mode) */}
                <div className="space-y-2 border-t border-brand-dark/5 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">
                      Status Distribusi & Catatan
                    </h4>
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-[10px] font-bold text-brand-gold bg-brand-gold/10 hover:bg-brand-gold/20 px-2 py-1 rounded-md transition-colors duration-200"
                      >
                        <Edit2 className="w-3 h-3" /> Edit Status
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1 text-[10px] font-bold text-white bg-status-diterima px-2.5 py-1 rounded-md transition-colors duration-200"
                      >
                        <Save className="w-3 h-3" /> Simpan
                      </button>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-brand-teal font-medium">Status Saat Ini:</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${getStatusStyle(selectedWp.statusBayar).bg} ${getStatusStyle(selectedWp.statusBayar).text}`}>
                          {getStatusStyle(selectedWp.statusBayar).label}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-teal font-medium block">Catatan Petugas:</span>
                        <p className="p-3 bg-brand-light/50 border border-brand-dark/5 rounded-xl font-medium leading-relaxed italic text-brand-dark/80 mt-1">
                          {selectedWp.catatan || "Tidak ada catatan untuk wajib pajak ini."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <span className="text-brand-teal font-medium block mb-1">Ubah Status Distribusi:</span>
                        <div className="grid grid-cols-3 gap-2">
                          {STATUS_FILTERS.slice(1).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setEditStatus(opt.value)}
                              className={`py-2 rounded-xl font-bold border text-[10px] uppercase text-center transition-all duration-200 ${
                                editStatus === opt.value
                                  ? "bg-brand-dark border-brand-dark text-white shadow-sm"
                                  : "bg-brand-light border-brand-dark/5 text-brand-dark hover:bg-brand-teal/10"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-brand-teal font-medium block mb-1">Catatan Tambahan:</span>
                        <textarea
                          rows={2}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Masukkan informasi tambahan, misal: Rumah kosong, dititipkan tetangga, dll..."
                          className="w-full p-2.5 bg-brand-light border border-brand-dark/5 rounded-xl outline-none text-brand-dark placeholder-brand-teal/70 focus:border-brand-gold/30 font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Modal Action */}
              <div className="bg-brand-light p-4 flex gap-3 border-t border-brand-dark/5 sticky bottom-0 z-10">
                <button
                  onClick={() => setSelectedWp(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-brand-dark/5 border border-brand-dark/10 font-bold text-center text-brand-dark"
                >
                  Tutup
                </button>
                <Link
                  href={`/peta?drawForNop=${selectedWp.nop}&drawForBlok=${selectedWp.blok}`}
                  className="flex-1 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-bold text-center shadow-md transition-colors duration-200"
                >
                  Lihat di Peta
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
