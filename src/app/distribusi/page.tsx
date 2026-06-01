"use client";

import { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import type { WajibPajak, SesiDistribusi, Distribusi } from "@/src/db/schema";
import PageWrapper from "@/src/components/layout/PageWrapper";
import { Clock, CheckCircle, AlertTriangle, Play, Square, Camera, Search, User, FileText, Check, Trash2, Calendar, Truck, X, RefreshCw } from "lucide-react";

export default function DistribusiPage() {
  const [activeSesiId, setActiveSesiId] = useState<number | null>(null);

  // Form Sesi Baru State
  const [petugas, setPetugas] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [sesiBlok, setSesiBlok] = useState("");
  const [sesiCatatan, setSesiCatatan] = useState("");

  // Delivery Logging State
  const [selectedWp, setSelectedWp] = useState<WajibPajak | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState("diterima"); // 'diterima' | 'tidak_ada' | 'lain'
  const [deliveryCatatan, setDeliveryCatatan] = useState("");
  const [deliveryPhoto, setDeliveryPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [loggingProgress, setLoggingProgress] = useState(false);

  // Search Wp in Session
  const [searchWp, setSearchWp] = useState("");

  // 1. Cek Sesi Aktif di LocalStorage & Database
  useEffect(() => {
    const savedSesiId = localStorage.getItem("active_sesi_id");
    if (savedSesiId) {
      setActiveSesiId(Number(savedSesiId));
    }
  }, []);

  // 2. Query reaktif dari IndexedDB
  const activeSesi = useLiveQuery(
    async () => (activeSesiId ? db.sesiDistribusi.get(activeSesiId) : undefined),
    [activeSesiId]
  );


  // Ambil data wajib pajak untuk sesi aktif (Filter berdasarkan blok sesi)
  const wpList = useLiveQuery(async () => {
    if (!activeSesi) return [] as WajibPajak[];
    if (activeSesi.blok) {
      return db.wajibPajak.where("blok").equals(activeSesi.blok).toArray();
    }
    return db.wajibPajak.toArray();
  }, [activeSesi]);

  // Ambil riwayat distribusi untuk sesi aktif
  const logList = useLiveQuery(async () => {
    if (!activeSesiId) return [] as Distribusi[];
    return db.distribusi.where("sesiId").equals(activeSesiId).toArray();
  }, [activeSesiId]);

  // 3. Filtering Wajib Pajak yang belum diserahkan
  const unsubmittedWp = useMemo(() => {
    if (!wpList || !logList) return [];
    
    // NOP yang sudah didistribusikan di sesi ini
    const submittedNops = new Set(logList.map((log) => log.nop));

    return wpList.filter((wp) => {
      // Hanya tampilkan yang belum diserahkan dan bukan sawah (sawah otomatis selesai)
      const isSubmitted = submittedNops.has(wp.nop);
      const isBelum = wp.statusBayar === "belum";
      
      const q = searchWp.toLowerCase().trim();
      const matchSearch =
        !q ||
        wp.namaWp.toLowerCase().includes(q) ||
        wp.nop.includes(q) ||
        wp.nomorPetak.includes(q);

      return !isSubmitted && isBelum && matchSearch;
    });
  }, [wpList, logList, searchWp]);

  // 4. Progress Statistik Sesi Aktif
  const stats = useMemo(() => {
    if (!wpList || !logList) return { total: 0, completed: 0, pct: 0 };
    
    // Filter sawah (sawah dianggap selesai/bebas tanpa distribusi fisik)
    const sawahCount = wpList.filter((wp) => wp.statusBayar === "sawah").length;
    const totalTarget = wpList.length - sawahCount;
    
    const completedCount = logList.filter((log) => log.status === "diterima").length;
    const pct = totalTarget > 0 ? Math.round((completedCount / totalTarget) * 100) : 0;

    return {
      total: totalTarget,
      completed: completedCount,
      pct,
    };
  }, [wpList, logList]);

  // 5. Handler Mulai Sesi Baru
  const handleStartSesi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petugas.trim()) {
      alert("Nama petugas harus diisi!");
      return;
    }

    try {
      const newSesiId = await db.sesiDistribusi.add({
        tanggal,
        petugas: petugas.trim(),
        blok: sesiBlok || null,
        catatan: sesiCatatan.trim(),
        selesai: false,
        createdAt: new Date().toISOString(),
      });

      localStorage.setItem("active_sesi_id", String(newSesiId));
      setActiveSesiId(newSesiId);
      
      // Reset form
      setPetugas("");
      setSesiCatatan("");
    } catch (err) {
      alert("Gagal membuat sesi: " + String(err));
    }
  };

  // 6. Kompresi Foto in-browser menggunakan HTML5 Canvas (<200KB)
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800; // resolusi maksimal sisi terpanjang
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Gagal mengompresi gambar"));
          },
          "image/jpeg",
          0.6 // Kualitas kompresi 60%
        );
      };
      img.onerror = (e) => reject(e);
    });
  };

  // 7. Handler Simpan Penyerahan SPPT
  const handleSaveDelivery = async () => {
    if (!selectedWp || !activeSesiId) return;

    setLoggingProgress(true);

    try {
      // 1. Simpan Log Distribusi
      const timeNow = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const distId = await db.distribusi.add({
        sesiId: activeSesiId,
        nop: selectedWp.nop,
        status: deliveryStatus,
        waktu: timeNow,
        catatan: deliveryCatatan.trim(),
        createdAt: new Date().toISOString(),
      });

      // 2. Jika ada foto, kompresi dan simpan di fotoBukti
      if (deliveryPhoto) {
        const compressedBlob = await compressImage(deliveryPhoto);
        await db.fotoBukti.add({
          distribusiId: distId,
          fotoBlob: compressedBlob,
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Jika status = 'diterima', update statusBayar wajib_pajak di DHKP
      if (deliveryStatus === "diterima") {
        await db.wajibPajak.where("nop").equals(selectedWp.nop).modify({
          statusBayar: "diterima",
          catatan: deliveryCatatan.trim(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Reset state dialog
      setSelectedWp(null);
      setDeliveryCatatan("");
      setDeliveryPhoto(null);
      setPhotoPreview("");
    } catch (err) {
      alert("Gagal menyimpan data distribusi: " + String(err));
    } finally {
      setLoggingProgress(false);
    }
  };

  // Handler Tutup Sesi Distribusi
  const handleCloseSesi = async () => {
    if (!activeSesiId || !activeSesi) return;

    const confirmClose = confirm(
      `Apakah Anda yakin ingin MENUTUP SESI DISTRIBUSI ini?\n\nPetugas: ${activeSesi.petugas}\nJumlah terkirim: ${stats.completed} dari ${stats.total} WP.`
    );

    if (confirmClose) {
      await db.sesiDistribusi.update(activeSesiId, {
        selesai: true,
      });
      localStorage.removeItem("active_sesi_id");
      setActiveSesiId(null);
      alert("Sesi distribusi berhasil ditutup secara resmi!");
    }
  };

  // Preview Gambar upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDeliveryPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-5 animate-slide-up h-full">
        {/* Title Section */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-brand-dark flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-gold" /> Pelacakan Distribusi
          </h2>
          <p className="text-xs text-brand-teal font-medium mt-1">
            Penyerahan bukti fisik SPPT PBB-P2 2026 langsung di lapangan.
          </p>
        </div>

        {/* ── CASE 1: JIKA BELUM ADA SESI AKTIF (FORM BUAT SESI BARU) ── */}
        {!activeSesiId ? (
          <form onSubmit={handleStartSesi} className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-brand-dark mb-1.5 flex items-center gap-1.5">
              <Play className="w-4 h-4 text-brand-gold" /> Buka Sesi Distribusi Baru
            </h3>
            
            {/* Input Petugas */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">Nama Petugas / Pamong</label>
              <input
                type="text"
                placeholder="Masukkan nama Anda..."
                className="mt-1 bg-brand-light/70 rounded-xl px-3.5 py-2.5 outline-none font-bold text-xs text-brand-dark border border-brand-dark/5 focus:border-brand-gold/30 w-full"
                value={petugas}
                onChange={(e) => setPetugas(e.target.value)}
                required
              />
            </div>

            {/* Input Tanggal & Blok Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">Tanggal Kerja</label>
                <input
                  type="date"
                  className="mt-1 bg-brand-light/70 rounded-xl px-3.5 py-2.5 outline-none font-bold text-xs text-brand-dark border border-brand-dark/5 w-full"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">Blok Wilayah</label>
                <select
                  className="mt-1 bg-brand-light/70 rounded-xl px-3.5 py-2.5 outline-none font-bold text-xs text-brand-dark border border-brand-dark/5 w-full"
                  value={sesiBlok}
                  onChange={(e) => setSesiBlok(e.target.value)}
                >
                  <option value="">Semua Blok</option>
                  <option value="013">Blok 013 (Mandingan)</option>
                  <option value="014">Blok 014 (Mandingan)</option>
                  <option value="015">Blok 015 (Mandingan)</option>
                </select>
              </div>
            </div>

            {/* Input Catatan */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">Catatan Rencana Sesi</label>
              <textarea
                rows={2}
                placeholder="Tulis target wilayah padukuhan, contoh: Mandingan RT 02..."
                className="mt-1 bg-brand-light/70 rounded-xl px-3.5 py-2.5 outline-none font-medium text-xs text-brand-dark border border-brand-dark/5 focus:border-brand-gold/30 w-full"
                value={sesiCatatan}
                onChange={(e) => setSesiCatatan(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-extrabold text-xs shadow-md tracking-wider uppercase transition-colors duration-200"
            >
              Mulai Sesi Lapangan 🚀
            </button>
          </form>
        ) : (
          /* ── CASE 2: JIKA ADA SESI AKTIF (LOGGING LAPANGAN) ── */
          <div className="space-y-4">
            {/* Dashboard Sesi Aktif */}
            {activeSesi && (
              <section className="bg-brand-dark text-white rounded-2xl p-4 border border-brand-dark/5 shadow-lg space-y-4 relative overflow-hidden">
                {/* Header Sesi */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-gold">
                      Sesi Aktif Lapangan (ID: {activeSesi.id})
                    </span>
                    <h3 className="text-sm font-black uppercase text-white mt-0.5">
                      Pamong: {activeSesi.petugas}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseSesi}
                    className="flex items-center gap-1 text-[9px] font-bold text-white bg-status-belum px-2.5 py-1.5 rounded-xl hover:bg-red-600 transition-colors duration-200 shadow-md"
                  >
                    <Square className="w-3 h-3" /> Tutup Sesi
                  </button>
                </div>

                {/* Sesi Stats Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/10 text-center text-[10px]">
                  <div>
                    <span className="text-[8px] text-brand-teal block uppercase font-bold">Blok Target</span>
                    <p className="font-extrabold text-white mt-0.5">{activeSesi.blok || "Semua Blok"}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-teal block uppercase font-bold">Tanggal</span>
                    <p className="font-extrabold text-white mt-0.5">{activeSesi.tanggal}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-teal block uppercase font-bold">Progres</span>
                    <p className="font-extrabold text-status-diterima mt-0.5">{stats.completed} / {stats.total}</p>
                  </div>
                </div>

                {/* Progress Bar Sesi */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[9px] font-extrabold text-brand-teal uppercase">
                    <span>Progres Penyerahan Fisik</span>
                    <span className="text-white">{stats.pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-status-diterima h-full rounded-full transition-all duration-1000"
                      style={{ width: `${stats.pct}%` }}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* List Target SPPT Belum Diserahkan */}
            <div className="space-y-2">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal">
                Daftar Target Penyerahan SPPT PBB
              </span>

              {/* Search Target Bar */}
              <div className="flex items-center gap-2 bg-white border border-brand-dark/5 rounded-xl px-3 py-2.5 text-brand-dark shadow-sm">
                <Search className="w-4 h-4 text-brand-teal shrink-0" />
                <input
                  type="text"
                  placeholder="Cari Nama WP / NOP / No Petak..."
                  className="bg-transparent border-none text-xs text-brand-dark placeholder-brand-teal outline-none w-full font-medium"
                  value={searchWp}
                  onChange={(e) => setSearchWp(e.target.value)}
                />
                {searchWp && (
                  <button onClick={() => setSearchWp("")} className="text-brand-teal">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* List Target Scroll */}
              <div className="overflow-y-auto space-y-2 max-h-[calc(100vh-320px)] pb-10">
                {unsubmittedWp.length > 0 ? (
                  unsubmittedWp.map((wp) => (
                    <div
                      key={wp.nop}
                      onClick={() => setSelectedWp(wp)}
                      className="bg-white rounded-xl p-3 border border-brand-dark/5 flex items-center justify-between cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-status-belum flex items-center justify-center shrink-0 font-bold text-xs uppercase">
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

                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-brand-dark">
                          {wp.jumlahSppt === 0 ? "Bebas" : `Rp ${wp.jumlahSppt.toLocaleString("id-ID")}`}
                        </p>
                        <span className="text-[8px] font-bold text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded-full inline-block mt-1">
                          SIAP SERAH
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h4 className="text-xs font-bold text-brand-dark">Semua Target SPPT Terkirim!</h4>
                      <p className="text-[9px] text-brand-teal mt-0.5 max-w-[240px]">
                        Seluruh target wajib pajak dalam sesi/blok ini telah sukses terdistribusikan ke warga.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 8. LOGGING penyerahan MODAL Bottom-Sheet ── */}
        {selectedWp && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-sm flex justify-center items-end animate-fade-in p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up shadow-2xl relative">
              {/* Header Modal */}
              <div className="bg-brand-dark text-white p-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal font-mono">
                    Form Bukti Serah Fisik SPPT
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
                {/* Info NOP & Nilai Pajak */}
                <div className="bg-brand-light rounded-xl p-3 border border-brand-dark/5 flex justify-between items-center">
                  <div>
                    <span className="text-[8px] font-bold text-brand-teal uppercase">Nomor SPPT</span>
                    <p className="text-xs font-bold text-brand-dark">{selectedWp.blok}-{selectedWp.nomorPetak}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-brand-teal uppercase">Nilai Pajak</span>
                    <p className="text-xs font-black text-brand-dark">
                      {selectedWp.jumlahSppt === 0 ? "Bebas" : `Rp ${selectedWp.jumlahSppt.toLocaleString("id-ID")}`}
                    </p>
                  </div>
                </div>

                {/* Status Pengiriman */}
                <div>
                  <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider block mb-1.5">
                    1. Hasil Kunjungan Lapangan
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDeliveryStatus("diterima")}
                      className={`py-2.5 rounded-xl font-bold border text-[10px] uppercase text-center transition-all duration-200 ${
                        deliveryStatus === "diterima"
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-md scale-105"
                          : "bg-brand-light border-brand-dark/5 text-brand-dark hover:bg-emerald-50"
                      }`}
                    >
                      Diterima
                    </button>
                    <button
                      onClick={() => setDeliveryStatus("tidak_ada")}
                      className={`py-2.5 rounded-xl font-bold border text-[10px] uppercase text-center transition-all duration-200 ${
                        deliveryStatus === "tidak_ada"
                          ? "bg-status-belum border-status-belum text-white shadow-md scale-105"
                          : "bg-brand-light border-brand-dark/5 text-brand-dark hover:bg-red-50"
                      }`}
                    >
                      Tidak Ada
                    </button>
                    <button
                      onClick={() => setDeliveryStatus("lain")}
                      className={`py-2.5 rounded-xl font-bold border text-[10px] uppercase text-center transition-all duration-200 ${
                        deliveryStatus === "lain"
                          ? "bg-brand-gold border-brand-gold text-white shadow-md scale-105"
                          : "bg-brand-light border-brand-dark/5 text-brand-dark hover:bg-amber-50"
                      }`}
                    >
                      Lain-lain
                    </button>
                  </div>
                </div>

                {/* Bukti Foto Kamera */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider block">
                    2. Ambil Foto Bukti Fisik (Opsional)
                  </span>

                  {!photoPreview ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-brand-teal/30 hover:border-brand-gold/50 bg-brand-light hover:bg-brand-gold/5 rounded-xl py-5 cursor-pointer transition-all duration-200 group">
                      <Camera className="w-7 h-7 text-brand-teal group-hover:text-brand-gold group-hover:scale-110 transition-all duration-200" />
                      <span className="text-[10px] font-bold text-brand-dark mt-1.5">Buka Kamera / Unggah</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment" // otomatis mentrigger kamera belakang pada browser HP
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-xl border border-brand-dark/5 overflow-hidden h-36">
                      <img src={photoPreview} className="w-full h-full object-cover" alt="Bukti Foto" />
                      <button
                        onClick={() => {
                          setDeliveryPhoto(null);
                          setPhotoPreview("");
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-brand-dark/80 text-white shadow-md hover:bg-brand-dark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Catatan Distribusi */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">
                    3. Catatan Kunjungan Petugas
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Masukkan keterangan detail (misal: SPPT dititipkan ke ibu kandung, rumah terkunci)..."
                    className="mt-1 bg-brand-light border border-brand-dark/5 rounded-xl px-3 py-2 outline-none font-medium text-xs text-brand-dark focus:border-brand-gold/30 w-full"
                    value={deliveryCatatan}
                    onChange={(e) => setDeliveryCatatan(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer Modal Action */}
              <div className="bg-brand-light p-4 flex gap-3 border-t border-brand-dark/5 sticky bottom-0 z-10">
                <button
                  onClick={() => setSelectedWp(null)}
                  disabled={loggingProgress}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-brand-dark/5 border border-brand-dark/10 font-bold text-center text-brand-dark text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveDelivery}
                  disabled={loggingProgress}
                  className="flex-1 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-bold text-center text-xs shadow-md transition-colors duration-200 flex items-center justify-center gap-1.5"
                >
                  {loggingProgress ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengompres...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-brand-gold" /> Simpan Penyerahan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
