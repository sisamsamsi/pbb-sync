"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import PageWrapper from "@/src/components/layout/PageWrapper";
import { FileText, Download, Printer, Users, Calendar, Award, CheckCircle } from "lucide-react";
import type { Distribusi } from "@/src/db/schema";

export default function LaporanPage() {
  const [selectedSesiId, setSelectedSesiId] = useState<string>("");

  // 1. Query reaktif seluruh sesi distribusi yang sudah SELESAI
  const completedSessions = useLiveQuery(() =>
    db.sesiDistribusi.where("selesai").equals(1).toArray()
  );

  // Ambil detail log distribusi untuk sesi yang dipilih
  const logList = useLiveQuery(
    async () =>
      selectedSesiId
        ? db.distribusi.where("sesiId").equals(Number(selectedSesiId)).toArray()
        : ([] as Distribusi[]),
    [selectedSesiId]
  );

  // Ambil detail data Wajib Pajak untuk detail laporan
  const wajibPajakList = useLiveQuery(() => db.wajibPajak.toArray());

  // 2. Kalkulasi rekap sesi terpilih
  const rekapData = useMemo(() => {
    if (!logList || !wajibPajakList || !selectedSesiId) return null;

    const currentSesi = completedSessions?.find((s) => s.id === Number(selectedSesiId));
    if (!currentSesi) return null;

    let totalSpptDiterimaVal = 0;
    let totalDiterima = 0;
    let totalTidakAda = 0;
    let totalLain = 0;

    const detailList = logList.map((log, idx) => {
      const wp = wajibPajakList.find((w) => w.nop === log.nop);
      const spptValue = wp?.jumlahSppt ?? 0;

      if (log.status === "diterima") {
        totalDiterima++;
        totalSpptDiterimaVal += spptValue;
      } else if (log.status === "tidak_ada") {
        totalTidakAda++;
      } else {
        totalLain++;
      }

      return {
        no: idx + 1,
        nop: log.nop,
        namaWp: wp?.namaWp || "Tidak ada data WP",
        blok: wp?.blok || "-",
        petak: wp?.nomorPetak || "-",
        status: log.status === "diterima" ? "Diterima" : log.status === "tidak_ada" ? "Tidak Ada" : "Lainnya",
        waktu: log.waktu || "-",
        spptVal: spptValue,
        catatan: log.catatan || "-",
      };
    });

    return {
      id: currentSesi.id,
      petugas: currentSesi.petugas,
      tanggal: currentSesi.tanggal,
      blok: currentSesi.blok || "Semua Blok",
      catatan: currentSesi.catatan || "-",
      totalDiterima,
      totalTidakAda,
      totalLain,
      totalSpptDiterimaVal,
      details: detailList,
    };
  }, [logList, wajibPajakList, selectedSesiId, completedSessions]);

  // 3. Export ke Excel-friendly CSV
  const handleExportCSV = () => {
    if (!rekapData) return;

    // Definisikan baris judul
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `LAPORAN REKAP DISTRIBUSI SPPT PBB - KARTABUMI\n`;
    csvContent += `Pamong/Petugas;${rekapData.petugas}\n`;
    csvContent += `Tanggal Pelaporan;${rekapData.tanggal}\n`;
    csvContent += `Blok Wilayah;${rekapData.blok}\n`;
    csvContent += `Total SPPT Diterima Warga;${rekapData.totalDiterima}\n`;
    csvContent += `Total SPPT Warga Tidak di Rumah;${rekapData.totalTidakAda}\n`;
    csvContent += `Total Nominal SPPT Diserahkan;Rp ${rekapData.totalSpptDiterimaVal.toLocaleString("id-ID")}\n\n`;

    // Kolom tabel
    csvContent += "No;NOP;Wajib Pajak;Blok;Petak;Status;Waktu;Nominal Pajak;Catatan\n";

    // Isi baris tabel
    rekapData.details.forEach((row) => {
      csvContent += `${row.no};${row.nop};${row.namaWp};${row.blok};${row.petak};${row.status};${row.waktu};Rp ${row.spptVal.toLocaleString("id-ID")};${row.catatan}\n`;
    });

    // Pemicu download file CSV di browser
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Distribusi_Sesi_${rekapData.id}_${rekapData.tanggal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Print Laporan via Browser Print Layout (Prints to high-fidelity PDF)
  const handlePrintPdf = () => {
    if (!rekapData) return;
    window.print();
  };

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-5 animate-slide-up h-full pb-10">
        {/* Title Section */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-brand-dark flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-gold" /> Ringkasan Laporan
          </h2>
          <p className="text-xs text-brand-teal font-medium mt-1">
            Unduh rekapitulasi data sesi distribusi untuk keperluan BKAD.
          </p>
        </div>

        {/* Sesi Selector */}
        <section className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm space-y-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-brand-teal uppercase tracking-wider">
              Pilih Sesi Distribusi Lapangan
            </label>
            <select
              value={selectedSesiId}
              onChange={(e) => setSelectedSesiId(e.target.value)}
              className="mt-1 font-bold text-xs bg-brand-light border-none rounded-xl px-3 py-2.5 outline-none text-brand-dark"
            >
              <option value="">-- Pilih Sesi Kerja Yang Selesai --</option>
              {completedSessions?.map((sesi) => (
                <option key={sesi.id} value={sesi.id}>
                  Sesi #{sesi.id} - Pamong {sesi.petugas} ({sesi.tanggal})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Rekapitulasi Data Board */}
        {rekapData ? (
          <div className="space-y-4">
            {/* Visual Stats Overview */}
            <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm space-y-4 printable-section">
              <h3 className="text-sm font-bold text-brand-dark border-b border-brand-light pb-2 flex items-center gap-1.5 uppercase tracking-wider">
                📄 Rekap Sesi Kerja #{rekapData.id}
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-brand-teal">
                  <span>Nama Pamong/Petugas:</span>
                  <span className="font-extrabold text-brand-dark">{rekapData.petugas}</span>
                </div>
                <div className="flex justify-between items-center text-brand-teal">
                  <span>Tanggal Kerja:</span>
                  <span className="font-extrabold text-brand-dark">{rekapData.tanggal}</span>
                </div>
                <div className="flex justify-between items-center text-brand-teal">
                  <span>Blok Kerja:</span>
                  <span className="font-extrabold text-brand-dark">Blok {rekapData.blok}</span>
                </div>
                <div className="flex justify-between items-center text-brand-teal">
                  <span>Total Nilai Pajak Diserahkan:</span>
                  <span className="font-black text-status-diterima">
                    Rp {rekapData.totalSpptDiterimaVal.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Status penyerahan breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] py-1">
                <div className="bg-emerald-50 border border-emerald-500/10 rounded-xl p-2 text-status-diterima">
                  <span className="text-[8px] uppercase block font-bold text-brand-teal">Diterima</span>
                  <p className="text-base font-black mt-0.5">{rekapData.totalDiterima}</p>
                </div>
                <div className="bg-red-50 border border-red-500/10 rounded-xl p-2 text-status-belum">
                  <span className="text-[8px] uppercase block font-bold text-brand-teal">Tidak Ada</span>
                  <p className="text-base font-black mt-0.5">{rekapData.totalTidakAda}</p>
                </div>
                <div className="bg-amber-50 border border-amber-500/10 rounded-xl p-2 text-status-sawah">
                  <span className="text-[8px] uppercase block font-bold text-brand-teal">Lainnya</span>
                  <p className="text-base font-black mt-0.5">{rekapData.totalLain}</p>
                </div>
              </div>
            </section>

            {/* Action Buttons Panel */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportCSV}
                className="py-3 rounded-xl border border-brand-dark/10 bg-white hover:bg-brand-light text-brand-dark font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <Download className="w-4 h-4 text-emerald-500" /> Unduh file Excel
              </button>
              <button
                onClick={handlePrintPdf}
                className="py-3 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <Printer className="w-4 h-4 text-brand-gold" /> Cetak Laporan PDF
              </button>
            </div>

            {/* Printable Area styled specifically for clean Print preview (PDF) */}
            <style jsx global>{`
              @media print {
                body {
                  background: white !important;
                  color: black !important;
                }
                nav, header, button, select, label {
                  display: none !important;
                }
                main {
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .printable-section {
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                }
              }
            `}</style>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">📊</span>
            <div>
              <h4 className="text-xs font-bold text-brand-dark">Pilih Sesi Terlebih Dahulu</h4>
              <p className="text-[10px] text-brand-teal/80 mt-1 max-w-[240px]">
                Rekapitulasi otomatis akan muncul begitu Anda memilih sesi lapangan yang telah diselesaikan.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
