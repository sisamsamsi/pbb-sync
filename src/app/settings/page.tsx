"use client";

import { useEffect, useState } from "react";
import PageWrapper from "@/src/components/layout/PageWrapper";
import {
  importExcelByname,
  getDbStats,
  resetDatabase,
  resetPolygons,
  importRescuedPolygons,
  importRescuedGeoref,
} from "@/src/services/import.service";
import { Upload, Database, AlertTriangle, FileSpreadsheet, Trash2, CheckCircle, RefreshCw, Undo2 } from "lucide-react";

interface DBStats {
  total: number;
  blok013: number;
  blok014: number;
  blok015: number;
  sawah: number;
  belum: number;
  diterima: number;
}

export default function SettingsPage() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");
  const [stats, setStats] = useState<DBStats>({
    total: 0,
    blok013: 0,
    blok014: 0,
    blok015: 0,
    sawah: 0,
    belum: 0,
    diterima: 0,
  });

  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{
    show: boolean;
    success: boolean;
    total: number;
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Load stats dari IndexedDB saat halaman dibuka
  const loadStats = async () => {
    setLoading(true);
    try {
      const dbStats = await getDbStats();
      setStats(dbStats);
    } catch (e) {
      console.error("Gagal memuat statistik database:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Handler Upload Excel DHKP
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      const res = await importExcelByname(file, (current, total) => {
        setProgress({ current, total });
      });

      setImportResult({
        show: true,
        success: res.success,
        total: res.totalRows,
        imported: res.imported,
        skipped: res.skipped,
        errors: res.errors,
      });

      await loadStats();
    } catch (error) {
      alert("Error saat mengimpor data: " + String(error));
    } finally {
      setIsImporting(false);
      // Reset input value agar user bisa upload file yang sama
      e.target.value = "";
    }
  };

  // Handler Reset Database Penuh
  const handleResetTotal = async () => {
    if (
      confirm(
        "⚠️ PERINGATAN KERAS!\n\nTindakan ini akan MENGHAPUS SELURUH DATA Wajib Pajak, Polygon Peta, Georeferencing, dan Riwayat Distribusi di HP ini secara permanen.\n\nApakah Anda yakin ingin melanjutkan?"
      )
    ) {
      setLoading(true);
      await resetDatabase();
      await loadStats();
      alert("Database lokal berhasil dikosongkan.");
      setLoading(false);
    }
  };

  // Handler Reset Hanya Peta Polygon
  const handleResetPeta = async () => {
    if (
      confirm(
        "Apakah Anda yakin ingin menghapus HANYA DATA POLYGON PETA?\n\nData Wajib Pajak DHKP dan riwayat distribusi Anda akan tetap aman."
      )
    ) {
      setLoading(true);
      await resetPolygons();
      await loadStats();
      alert("Data koordinat polygon peta berhasil dihapus.");
      setLoading(false);
    }
  };

  // Handler Pemulihan Data Polygon Penyelamatan V1
  const handleRestoreV1 = async () => {
    setIsRestoring(true);
    setRestoreProgress("Mengunduh koordinat Blok 013...");
    try {
      // 1. Pulihkan georef config
      const georefRes = await importRescuedGeoref();
      if (!georefRes.success) {
        throw new Error(georefRes.error || "Gagal memulihkan konfigurasi georeferencing");
      }

      // 2. Pulihkan polygon 013
      setRestoreProgress("Mengimpor peta Blok 013...");
      const p13 = await importRescuedPolygons("013");

      // 3. Pulihkan polygon 014
      setRestoreProgress("Mengimpor peta Blok 014...");
      const p14 = await importRescuedPolygons("014");

      // 4. Pulihkan polygon 015
      setRestoreProgress("Mengimpor peta Blok 015...");
      const p15 = await importRescuedPolygons("015");

      alert(
        `✅ PEMULIHAN BERHASIL!\n\nSeluruh data pemetaan hasil penyelamatan v1 berhasil diimpor:\n- Konfigurasi Georef Blok terpasang.\n- Blok 013: ${p13.count} bidang\n- Blok 014: ${p14.count} bidang\n- Blok 015: ${p15.count} bidang\n\nSemua polygon peta langsung siap diakses!`
      );
      await loadStats();
    } catch (err) {
      alert("Gagal memulihkan data v1: " + String(err));
    } finally {
      setIsRestoring(false);
      setRestoreProgress("");
    }
  };

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-6 animate-slide-up">
        {/* Title Section */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-brand-dark flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-gold" /> Pengaturan Sistem
          </h2>
          <p className="text-xs text-brand-teal font-medium mt-1">
            Impor data DHKP, kelola database, dan sinkronisasi sistem.
          </p>
        </div>

        {/* 1. Database Status Stats */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-brand-dark flex items-center gap-1.5">
              📊 Status Database Lokal
            </h3>
            <button
              onClick={loadStats}
              disabled={loading}
              className="p-1.5 rounded-lg bg-brand-light hover:bg-brand-teal/20 text-brand-dark transition-colors duration-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-brand-light rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">
                Total Wajib Pajak
              </span>
              <p className="text-xl font-black text-brand-dark mt-1">
                {stats.total.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="bg-brand-light rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">
                Sudah Distribusi
              </span>
              <p className="text-xl font-black text-status-diterima mt-1">
                {stats.diterima.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Breakdown Per Blok */}
          <div className="space-y-2 border-t border-brand-light pt-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">
              Distribusi Data Per Blok
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-brand-light rounded-lg p-2 text-center">
                <span className="text-[9px] font-bold text-brand-teal uppercase">Blok 013</span>
                <p className="text-xs font-bold text-brand-dark mt-0.5">{stats.blok013}</p>
              </div>
              <div className="border border-brand-light rounded-lg p-2 text-center">
                <span className="text-[9px] font-bold text-brand-teal uppercase">Blok 014</span>
                <p className="text-xs font-bold text-brand-dark mt-0.5">{stats.blok014}</p>
              </div>
              <div className="border border-brand-light rounded-lg p-2 text-center">
                <span className="text-[9px] font-bold text-brand-teal uppercase">Blok 015</span>
                <p className="text-xs font-bold text-brand-dark mt-0.5">{stats.blok015}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Import Excel DHKP Section */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark mb-1.5 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Impor Data DHKP (Excel)
          </h3>
          <p className="text-xs text-brand-teal/80 leading-relaxed mb-4">
            Unggah file Excel DHKP (.xlsx) dari BKAD Kabupaten Bantul. Kolom wajib: <b>NOP</b>, <b>Wajib Pajak</b>, <b>Jumlah</b>, <b>Padukuhan</b>.
          </p>

          {!isImporting ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-brand-teal/30 hover:border-emerald-500/50 bg-brand-light/30 hover:bg-emerald-500/5 rounded-xl py-6 px-4 cursor-pointer transition-all duration-300 group">
              <Upload className="w-8 h-8 text-brand-teal group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-300" />
              <span className="text-xs font-bold text-brand-dark mt-2.5">Pilih File Excel DHKP</span>
              <span className="text-[9px] text-brand-teal mt-1">Format .xlsx atau .xls</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          ) : (
            <div className="bg-brand-light rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-brand-dark flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Mengimpor Data...
                </span>
                <span className="text-brand-teal font-extrabold">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-brand-dark/10 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-brand-teal font-medium text-center">
                Jangan tutup halaman ini selama proses impor sedang berjalan.
              </p>
            </div>
          )}

          {/* Import Result Alert */}
          {importResult?.show && (
            <div className={`mt-4 rounded-xl p-4 border text-xs flex flex-col gap-2 ${
              importResult.success
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-800"
                : "bg-status-belum/5 border-status-belum/20 text-status-belum"
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Impor Selesai dengan Sukses!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 text-center font-bold text-brand-dark border-y border-brand-dark/5 my-1">
                <div>
                  <span className="text-[9px] text-brand-teal uppercase block">Total</span>
                  {importResult.total}
                </div>
                <div>
                  <span className="text-[9px] text-emerald-500 uppercase block">Diimpor</span>
                  {importResult.imported}
                </div>
                <div>
                  <span className="text-[9px] text-brand-gold uppercase block">Dilewati</span>
                  {importResult.skipped}
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 max-h-24 overflow-y-auto bg-white/50 p-2 rounded-lg border border-black/5 font-mono text-[9px]">
                  <span className="font-bold text-brand-dark">Log Masalah ({importResult.errors.length}):</span>
                  {importResult.errors.map((err, idx) => (
                    <span key={idx} className="text-status-belum">{err}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. Recovery Data Penyelamatan V1 (Peta Polygon) */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark mb-1.5 flex items-center gap-1.5">
            <Undo2 className="w-4 h-4 text-brand-gold" /> Pemulihan Peta V1
          </h3>
          <p className="text-xs text-brand-teal/80 leading-relaxed mb-4">
            Pulihkan 2.000+ data koordinat polygon bidang tanah (Blok 013, 014, 015) hasil penyelamatan v1 secara instan.
          </p>

          {!isRestoring ? (
            <button
              onClick={handleRestoreV1}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-extrabold text-xs shadow-md transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" /> Pulihkan Bidang Peta V1 Instan
            </button>
          ) : (
            <div className="bg-brand-light rounded-xl p-4 flex flex-col gap-2.5 text-center">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-ping mx-auto" />
              <span className="text-xs font-bold text-brand-dark">{restoreProgress}</span>
              <p className="text-[9px] text-brand-teal">
                Sedang menyinkronkan data pemetaan v1 ke IndexedDB...
              </p>
            </div>
          )}
        </section>

        {/* 4. Database Maintenance Card */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-brand-gold" /> Pemeliharaan & Reset
          </h3>
          <p className="text-xs text-brand-teal/80 leading-relaxed mb-4">
            Tindakan berbahaya untuk menghapus atau mengatur ulang penyimpanan lokal HP.
          </p>

          <div className="space-y-3">
            {/* Reset Hanya Polygon */}
            <button
              onClick={handleResetPeta}
              disabled={loading || isRestoring}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 hover:bg-brand-gold/10 text-brand-gold font-bold text-xs transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Hapus Hanya Polygon Peta
              </span>
              <span className="text-[9px] font-semibold bg-brand-gold/15 px-2 py-0.5 rounded-md">
                Aman
              </span>
            </button>

            {/* Reset Total */}
            <button
              onClick={handleResetTotal}
              disabled={loading || isRestoring}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-status-belum/20 bg-status-belum/5 hover:bg-status-belum/10 text-status-belum font-bold text-xs transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Bersihkan Seluruh Database
              </span>
              <span className="text-[9px] font-semibold bg-status-belum/15 px-2 py-0.5 rounded-md">
                Bahaya!
              </span>
            </button>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
