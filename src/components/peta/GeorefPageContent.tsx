"use client";

import { useEffect, useRef, useState } from "react";
import PageWrapper from "@/src/components/layout/PageWrapper";
import { extractVectorsFromPdf } from "@/src/services/pdf-extract.service";
import { calcTransformMatrix, pixelToLatLng, type ControlPoint } from "@/src/utils/geo.utils";
import { db } from "@/src/db";
import * as pdfjsLib from "pdfjs-dist";
import Link from "next/link";
import { Map, CheckCircle, RefreshCw, AlertTriangle, Upload, Target, Check, Trash2, ArrowLeft } from "lucide-react";

export default function GeorefPageContent() {
  const [activeBlok, setActiveBlok] = useState("013");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // PDF Renderer State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageWidth, setPdfPageWidth] = useState(800);
  const [pdfPageHeight, setPdfPageHeight] = useState(600);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Georeferencing Control Points
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(0); // Indeks titik yang sedang diset
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  // Google Maps Loader
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const googleMapInstance = useRef<any>(null);
  const mapMarkers = useRef<any[]>([]);
  const activeRenderTaskRef = useRef<any>(null);
  const handleMapClickRef = useRef<any>(null);

  // 1. Inisialisasi Google Maps API secara dinamis di Client
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google) {
        setMapsLoaded(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          setMapsLoaded(true);
        });
        return;
      }

      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapsLoaded(true);
      };
      script.onerror = () => {
        console.error("Gagal memuat Google Maps API. Menjalankan mode demo.");
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // 2. Setup Google Map Instance (Secara reaktif setelah script termuat DAN container DOM siap)
  const initMap = () => {
    if (!mapRef.current || !window.google || googleMapInstance.current) return;

    const defaultCenter = { lat: -7.8868, lng: 110.3321 }; // Mandingan, Bantul
    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 17,
      mapTypeId: "satellite",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
    });

    googleMapInstance.current = map;

    // Listener klik pada Map untuk mengambil koordinat GPS
    map.addListener("click", (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (handleMapClickRef.current) {
        handleMapClickRef.current(lat, lng);
      }
    });
  };

  useEffect(() => {
    if (mapsLoaded && mapRef.current) {
      initMap();
    }
  }, [mapsLoaded, mapRef.current]);

  // 3. Render PDF ke Canvas HTML5 saat Blok atau File berubah
  useEffect(() => {
    renderPdf();
  }, [activeBlok, selectedFile]);

  const renderPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setPdfLoading(true);
    setControlPoints([]);
    setActivePointIndex(0);

    try {
      let pdfData: ArrayBuffer;
      
      if (selectedFile) {
        pdfData = await selectedFile.arrayBuffer();
      } else {
        // Menggunakan file yang diselamatkan di public/maps/
        const response = await fetch(`/maps/blok-${activeBlok}.pdf`);
        if (!response.ok) throw new Error("Gagal mengambil file PDF default");
        pdfData = await response.arrayBuffer();
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);

      const page = await pdf.getPage(1);
      
      // Hitung dimensi ideal untuk tampilan layar split
      const viewport = page.getViewport({ scale: 1.0 });
      setPdfPageWidth(viewport.width);
      setPdfPageHeight(viewport.height);

      const context = canvas.getContext("2d");
      if (context) {
        // Batalkan rendering sebelumnya yang sedang berjalan jika ada
        if (activeRenderTaskRef.current) {
          try {
            activeRenderTaskRef.current.cancel();
          } catch (err) {
            console.warn("Membatalkan render task sebelumnya:", err);
          }
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render halaman PDF di canvas
        const renderTask = page.render({ canvasContext: context, viewport, canvas });
        activeRenderTaskRef.current = renderTask;
        
        try {
          await renderTask.promise;
        } finally {
          activeRenderTaskRef.current = null;
        }
      }
    } catch (e: any) {
      if (e?.name === "RenderingCancelledException" || String(e).includes("Rendering cancelled")) {
        console.log("PDF render cancelled successfully (expected behavior on switch).");
      } else {
        console.error("Error rendering PDF:", e);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // 4. Handle klik pada Canvas PDF (Mengambil koordinat pixel PDF)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activePointIndex === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = Math.round(e.clientX - rect.left);
    const py = Math.round(e.clientY - rect.top);

    setControlPoints((prev) => {
      const updated = [...prev];
      const existing = updated[activePointIndex];

      if (existing) {
        updated[activePointIndex] = { ...existing, px, py };
      } else {
        updated[activePointIndex] = { px, py, lat: 0, lng: 0 };
      }
      return updated;
    });
  };

  // 5. Handle klik pada Google Maps (Mengambil koordinat GPS)
  const handleMapClick = (lat: number, lng: number) => {
    if (activePointIndex === null) return;

    setControlPoints((prev) => {
      const updated = [...prev];
      const existing = updated[activePointIndex];

      if (existing) {
        updated[activePointIndex] = { ...existing, lat, lng };
      } else {
        updated[activePointIndex] = { px: 0, py: 0, lat, lng };
      }
      return updated;
    });

    // Posisikan pin penanda visual di Google Maps
    updateMapMarker(activePointIndex, lat, lng);

    // Otomatis pindah ke titik berikutnya
    if (activePointIndex < 3) {
      setActivePointIndex(activePointIndex + 1);
    } else {
      setActivePointIndex(null);
    }
  };

  // Simpan handler klik peta dalam ref untuk menghindari stale closure pada event listener Google Maps
  useEffect(() => {
    handleMapClickRef.current = handleMapClick;
  }, [handleMapClick]);

  // Menaruh marker visual di peta Google Maps
  const updateMapMarker = (idx: number, lat: number, lng: number) => {
    if (!googleMapInstance.current || !window.google) return;

    // Hapus marker lama pada indeks ini jika ada
    if (mapMarkers.current[idx]) {
      mapMarkers.current[idx].setMap(null);
    }

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: googleMapInstance.current,
      label: {
        text: String(idx + 1),
        color: "white",
        fontWeight: "bold",
      },
      title: `Titik Kontrol ${idx + 1}`,
      animation: window.google.maps.Animation.DROP,
    });

    mapMarkers.current[idx] = marker;
  };

  // 6. Melakukan Ekstraksi Vektor PDF + Georeferencing
  const handleProcessGeoref = async () => {
    // Validasi titik kontrol (Butuh minimal 3 titik)
    const validPoints = controlPoints.filter((p) => p.px > 0 && p.lat !== 0);
    if (validPoints.length < 3) {
      alert("⚠️ Minimal butuh 3 titik kontrol yang valid (Pixel & GPS) untuk menghitung transformasi!");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Menghitung Matriks Affine...");

    try {
      // 1. Hitung Affine Transform Matrix
      const matrix = calcTransformMatrix(validPoints);
      if (!matrix) {
        throw new Error("Matriks Affine gagal dihitung. Pastikan 3 titik kontrol Anda tidak berada pada garis lurus.");
      }

      // Cari apakah sudah ada konfigurasi lama untuk blok ini untuk mempertahankan primary key 'id'
      const existingConfig = await db.georefConfig.where("blok").equals(activeBlok).first();

      // Simpan konfigurasi georeferencing ke IndexedDB
      await db.georefConfig.put({
        ...(existingConfig ? { id: existingConfig.id } : {}),
        blok: activeBlok,
        controlPoints: JSON.stringify(validPoints),
        pdfWidth: pdfPageWidth,
        pdfHeight: pdfPageHeight,
        isReady: true,
        createdAt: existingConfig?.createdAt || new Date().toISOString(),
      });

      // 2. Ekstrak seluruh koordinat vektor path dari PDF.js
      setStatusMessage("Mengekstrak vektor bidang tanah dari PDF...");
      const sourcePdf = selectedFile || `/maps/blok-${activeBlok}.pdf`;
      const pdfPolygons = await extractVectorsFromPdf(sourcePdf, 1, (prog) => {
        if (prog < 100) {
          setStatusMessage(`Mengekstrak vektor PDF (${prog}%)...`);
        }
      });

      setStatusMessage(`Mengonversi ${pdfPolygons.length} bidang ke koordinat GPS...`);

      // 3. Konversi seluruh titik polygon PDF -> GPS (Lat, Lng) menggunakan Matriks Affine
      const convertedPolygons: any[] = [];
      const now = new Date().toISOString();

      pdfPolygons.forEach((poly, polyIdx) => {
        const gpsPoints: Array<{ lat: number; lng: number }> = [];

        poly.points.forEach((pt) => {
          // Konversi Y-axis dari format PDF (titik asal kiri-bawah) ke layar (kiri-atas)
          const convertedGps = pixelToLatLng(pt.x, pdfPageHeight - pt.y, matrix);
          if (convertedGps) {
            gpsPoints.push(convertedGps);
          }
        });

        if (gpsPoints.length >= 3) {
          const nomorPetak = `auto_${polyIdx + 1}`;
          const nop = `34.02.070.002.${activeBlok}.${nomorPetak.padStart(4, "0")}.0`;

          convertedPolygons.push({
            nop,
            blok: activeBlok,
            nomorPetak,
            points: JSON.stringify(gpsPoints),
            sumber: "auto",
            wasClosed: poly.wasClosed,
            needsReview: false,
            createdAt: now,
          });
        }
      });

      // 4. Masukkan ke IndexedDB via bulkPut
      setStatusMessage("Menyimpan ke basis data HP...");
      await db.polygonBidang.bulkPut(convertedPolygons);

      alert(
        `✅ GEOREFERENCING BERHASIL!\n\nMatriks berhasil dihitung dan diterapkan.\n- Total bidang tanah terekstraksi: ${convertedPolygons.length} bidang.\n- Disimpan secara lokal di IndexedDB HP.`
      );
    } catch (e) {
      alert("Gagal melakukan georeferencing: " + String(e));
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  const handleClearPoints = () => {
    setControlPoints([]);
    setActivePointIndex(0);
    mapMarkers.current.forEach((m) => {
      if (m) m.setMap(null);
    });
    mapMarkers.current = [];
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-up h-full pb-10">
      {/* 1. Sub Header & Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/peta"
          className="flex items-center gap-1 text-xs font-bold text-brand-dark bg-white hover:bg-brand-light px-3 py-1.5 rounded-xl border border-brand-dark/5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">
          Georeferencing Tool
        </span>
      </div>

      {/* 2. PDF & Block Selector */}
      <section className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm space-y-3">
        <div className="flex gap-4 items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-teal">
              Blok Aktif
            </span>
            <select
              value={activeBlok}
              onChange={(e) => {
                setActiveBlok(e.target.value);
                setSelectedFile(null);
              }}
              className="font-bold text-xs bg-brand-light border-none rounded-lg px-2.5 py-1.5 outline-none text-brand-dark mt-1"
            >
              <option value="013">Blok 013 (Mandingan)</option>
              <option value="014">Blok 014 (Mandingan)</option>
              <option value="015">Blok 015 (Mandingan)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-light hover:bg-brand-teal/20 text-brand-dark text-xs font-bold cursor-pointer transition-colors duration-200">
            <Upload className="w-4 h-4 text-brand-gold" /> Unggah PDF Custom
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />
          </label>
        </div>

        {selectedFile && (
          <p className="text-[10px] text-brand-gold font-bold">
            📂 Menggunakan berkas custom: <u>{selectedFile.name}</u>
          </p>
        )}
      </section>

      {/* 3. Peta split screen info */}
      <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-3 text-[10px] leading-relaxed text-brand-gold font-medium">
        💡 <b>Cara Kalibrasi Peta:</b> Klik titik mencolok pada peta kiri (PDF), lalu klik titik yang SAMA pada peta kanan (Satelit). Lakukan minimal untuk 3 Titik.
      </div>

      {/* 4. Split Screen Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[420px] md:h-[500px]">
        {/* Panel Kiri: PDF Viewer Canvas */}
        <div className="bg-white rounded-2xl border border-brand-dark/5 shadow-sm overflow-auto flex flex-col relative h-full">
          <div className="bg-brand-dark text-white text-[10px] font-bold px-3 py-2 flex justify-between items-center shrink-0">
            <span>🗺️ 1. Bidang PDF (Pixel)</span>
            {pdfLoading && <span className="animate-pulse text-brand-gold">Memuat PDF...</span>}
          </div>
          
          <div className="flex-1 bg-brand-light/50 overflow-auto flex justify-center items-start p-2 min-h-0">
            <div className="relative">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="bg-white border border-brand-dark/10 shadow-md cursor-crosshair rounded-lg"
              />

              {/* Render Titik Kontrol PDF Secara Visual */}
              {controlPoints.map((pt, idx) => (
                pt.px > 0 && (
                  <div
                    key={idx}
                    className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-status-belum border-2 border-white text-[10px] font-black text-white flex items-center justify-center shadow-lg animate-bounce"
                    style={{ left: pt.px, top: pt.py }}
                  >
                    {idx + 1}
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* Panel Kanan: Google Maps Satellite View */}
        <div className="bg-white rounded-2xl border border-brand-dark/5 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-brand-dark text-white text-[10px] font-bold px-3 py-2 flex justify-between items-center shrink-0">
            <span>🛰️ 2. Peta Satelit Google (GPS)</span>
            {!mapsLoaded && <span className="animate-pulse text-brand-gold">Memuat Peta...</span>}
          </div>
          <div ref={mapRef} className="flex-1 bg-[#F0F4F7] min-h-0" />
        </div>
      </div>

      {/* 5. Control Points Table & Calibration Panel */}
      <section className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-brand-light pb-2">
          <h3 className="text-xs font-black text-brand-dark uppercase tracking-wider">
            🎯 Titik Kontrol Kalibrasi
          </h3>
          <button
            onClick={handleClearPoints}
            className="flex items-center gap-1 text-[9px] font-bold text-status-belum hover:bg-status-belum/5 border border-status-belum/20 px-2 py-1 rounded-lg transition-colors duration-200"
          >
            <Trash2 className="w-3 h-3" /> Bersihkan Titik
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((idx) => {
            const pt = controlPoints[idx];
            const isSet = pt && pt.px > 0 && pt.lat !== 0;
            const isActive = activePointIndex === idx;

            return (
              <button
                key={idx}
                onClick={() => setActivePointIndex(idx)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 ${
                  isActive
                    ? "bg-brand-gold/10 border-brand-gold/50 text-brand-gold scale-105 shadow-inner"
                    : isSet
                    ? "bg-emerald-50 border-emerald-500/20 text-status-diterima"
                    : "bg-brand-light border-brand-dark/5 text-brand-teal"
                }`}
              >
                <span className="text-[9px] font-extrabold uppercase">Titik {idx + 1}</span>
                <div className="mt-1">
                  {isSet ? (
                    <Check className="w-4 h-4 mx-auto" />
                  ) : (
                    <Target className="w-4 h-4 mx-auto animate-pulse" />
                  )}
                </div>
                <span className="text-[8px] font-medium mt-1">
                  {isSet ? "Siap" : isActive ? "Klik Peta" : "Belum"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Trigger Button */}
        {!isProcessing ? (
          <button
            onClick={handleProcessGeoref}
            className="w-full py-3 rounded-xl bg-brand-dark hover:bg-brand-dark/95 text-white font-extrabold text-xs shadow-md tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Hitung & Ekstrak Polygon Otomatis
          </button>
        ) : (
          <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-xl p-4 flex flex-col gap-2.5 text-center">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-gold animate-ping mx-auto" />
            <span className="text-xs font-bold text-brand-dark">{statusMessage}</span>
            <p className="text-[9px] text-brand-teal leading-relaxed max-w-[280px] mx-auto">
              Proses ekstraksi in-browser menggunakan PDF.js & Affine Transform sedang berjalan. Jangan tutup halaman ini.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
