"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import PageWrapper from "@/src/components/layout/PageWrapper";
import Link from "next/link";
import { LayoutDashboard, Users, Map, Truck, ShieldAlert, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  // Query data secara realtime/reaktif menggunakan Dexie useLiveQuery!
  const wpCount = useLiveQuery(() => db.wajibPajak.count());
  const polygonCount = useLiveQuery(() => db.polygonBidang.count());
  const distribusiSelesai = useLiveQuery(() => db.wajibPajak.where("statusBayar").equals("diterima").count());
  const sawahCount = useLiveQuery(() => db.wajibPajak.where("statusBayar").equals("sawah").count());
  const belumDistribusi = useLiveQuery(() => db.wajibPajak.where("statusBayar").equals("belum").count());

  // Hitung persentase progress
  const totalWp = wpCount ?? 0;
  const totalPolygon = polygonCount ?? 0;
  const selesai = distribusiSelesai ?? 0;
  const sawah = sawahCount ?? 0;
  const belum = belumDistribusi ?? 0;

  // Distribusi progress: (selesai + sawah) / total
  const pctDistribusi = totalWp > 0 ? Math.round(((selesaimasuk() / totalWp) * 100)) : 0;
  // Mapping progress: polygon / total
  const pctMapping = totalWp > 0 ? Math.round((Math.min(totalPolygon, totalWp) / totalWp) * 100) : 0;

  function selesaimasuk() {
    return selesai + sawah;
  }

  return (
    <PageWrapper title="KARTABUMI">
      <div className="flex flex-col gap-6 animate-slide-up">
        {/* Welcome Section */}
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-brand-dark">
            Sugeng Rawuh, Petugas 👋
          </h2>
          <p className="text-xs text-brand-teal font-medium mt-1">
            Kalurahan Ringinharjo • Pemantauan Realtime SPPT PBB-P2 2026.
          </p>
        </div>

        {/* 1. Progress Overview Cards (Glow & Micro-animations) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Progress Distribusi Card */}
          <div className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold text-brand-teal uppercase tracking-wider">
                Progress SPPT
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-status-diterima">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-brand-dark leading-none">
                {pctDistribusi}%
              </p>
              <div className="w-full bg-brand-dark/10 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-status-diterima h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pctDistribusi}%` }}
                />
              </div>
            </div>
          </div>

          {/* Progress Pemetaan (Mapping) Card */}
          <div className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold text-brand-teal uppercase tracking-wider">
                Progress Peta
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-status-sawah">
                <Map className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-black text-brand-dark leading-none">
                {pctMapping}%
              </p>
              <div className="w-full bg-brand-dark/10 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-status-sawah h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pctMapping}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Detail Data Status */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark mb-4 flex items-center gap-1.5">
            📊 Statistik Distribusi SPPT
          </h3>

          <div className="space-y-3">
            {/* Belum Diserahkan */}
            <div className="flex justify-between items-center p-3 rounded-xl border border-brand-dark/5 bg-brand-light/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-status-belum flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-dark">Belum Diserahkan</h4>
                  <span className="text-[9px] font-semibold text-brand-teal uppercase tracking-wide">
                    SPPT Aktif
                  </span>
                </div>
              </div>
              <p className="text-sm font-extrabold text-brand-dark">
                {belum.toLocaleString("id-ID")} WP
              </p>
            </div>

            {/* Sudah Diterima */}
            <div className="flex justify-between items-center p-3 rounded-xl border border-brand-dark/5 bg-brand-light/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-status-diterima flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-dark">Sudah Diserahkan</h4>
                  <span className="text-[9px] font-semibold text-brand-teal uppercase tracking-wide">
                    Tanda Terima Fisik
                  </span>
                </div>
              </div>
              <p className="text-sm font-extrabold text-brand-dark">
                {selesai.toLocaleString("id-ID")} WP
              </p>
            </div>

            {/* Sawah / Bebas Pajak */}
            <div className="flex justify-between items-center p-3 rounded-xl border border-brand-dark/5 bg-brand-light/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-status-sawah flex items-center justify-center">
                  <span className="text-sm">🌾</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-dark">Sawah / Bebas Pajak</h4>
                  <span className="text-[9px] font-semibold text-brand-teal uppercase tracking-wide">
                    Kebijakan Pemda Bantul
                  </span>
                </div>
              </div>
              <p className="text-sm font-extrabold text-brand-dark">
                {sawah.toLocaleString("id-ID")} WP
              </p>
            </div>
          </div>
        </section>

        {/* 3. Empty DB Warning */}
        {totalWp === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center">
            <AlertTriangle className="w-8 h-8 text-brand-gold animate-bounce" />
            <div>
              <h4 className="text-xs font-extrabold text-brand-gold uppercase tracking-wider">
                Database Masih Kosong!
              </h4>
              <p className="text-[10px] text-brand-teal/90 leading-normal mt-1 max-w-[280px] mx-auto">
                Silakan lakukan impor berkas Excel DHKP (BKAD) di menu Pengaturan untuk mulai menggunakan aplikasi KARTABUMI.
              </p>
            </div>
            <Link
              href="/settings"
              className="bg-brand-gold hover:bg-brand-gold/90 text-white font-extrabold text-[10px] uppercase px-4 py-2 rounded-xl tracking-wider shadow-md transition-all duration-200"
            >
              Ke Pengaturan
            </Link>
          </div>
        )}

        {/* 4. Quick Actions Menu */}
        <section className="bg-white rounded-2xl p-5 border border-brand-dark/5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-dark mb-4 flex items-center gap-1.5">
            ⚡ Akses Cepat Fitur
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/wajib-pajak"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-light border border-brand-dark/5 transition-colors duration-200"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-dark/5 text-brand-dark flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-brand-dark">Data DHKP</span>
            </Link>

            <Link
              href="/peta"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-light border border-brand-dark/5 transition-colors duration-200"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-dark/5 text-brand-dark flex items-center justify-center shrink-0">
                <Map className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-brand-dark">Peta Blok</span>
            </Link>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
