"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db";
import type { WajibPajak, PolygonBidang } from "@/src/db/schema";
import PageWrapper from "@/src/components/layout/PageWrapper";
import { parsePoints } from "@/src/utils/geo.utils";
import Link from "next/link";
import { Map, Layers, RefreshCw, Plus, Check, Undo2, X, AlertTriangle } from "lucide-react";

// Pusat koordinat Mandingan, Bantul
const DEFAULT_CENTER = { lat: -7.8868, lng: 110.3321 };

const BLOK_LIST = ["013", "014", "015"];

// Warna polygon berdasarkan status bayar
const POLYGON_COLORS = {
  belum: { fill: "rgba(232,84,84,0.35)", stroke: "#E85454" },
  diterima: { fill: "rgba(46,201,126,0.35)", stroke: "#2EC97E" },
  sawah: { fill: "rgba(240,165,0,0.25)", stroke: "#F0A500" },
  selected: { fill: "rgba(240,165,0,0.55)", stroke: "#F0A500" },
  unknown: { fill: "rgba(90,140,178,0.25)", stroke: "#5C8EB2" },
};

function PetaPageContent() {
  const searchParams = useSearchParams();
  const drawForNop = searchParams.get("drawForNop");
  const drawForBlok = searchParams.get("drawForBlok");

  const [activeBlok, setActiveBlok] = useState("013");
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");
  const [selectedPolygon, setSelectedPolygon] = useState<any | null>(null);

  // Drawing manual state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetNop, setTargetNop] = useState<WajibPajak | null>(null); // NOP sasaran pintar dari deteksi

  // Google Maps Loader
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const renderedPolygonsRef = useRef<any[]>([]);
  const drawingMarkersRef = useRef<any[]>([]);
  const drawingPolylineRef = useRef<any>(null);
  const drawingPolygonRef = useRef<any>(null);

  // 1. Query reaktif data dari IndexedDB (Dexie)
  const wajibPajakList = useLiveQuery(() => db.wajibPajak.where("blok").equals(activeBlok).toArray(), [activeBlok]);
  const polygonList = useLiveQuery(() => db.polygonBidang.where("blok").equals(activeBlok).toArray(), [activeBlok]);

  // Gabungkan data polygon + wajib pajak via NOP
  const mappedPetakData = useMemo(() => {
    if (!polygonList || !wajibPajakList) return [];

    return polygonList
      .map((poly) => {
        const wp = wajibPajakList.find((w) => w.nop === poly.nop);
        const pts = parsePoints(poly.points);

        return {
          id: poly.id,
          nop: poly.nop,
          blok: poly.blok,
          nomorPetak: poly.nomorPetak,
          points: pts,
          namaWp: wp?.namaWp || "Tidak ada data WP (DHKP)",
          statusBayar: wp?.statusBayar || "belum",
          jumlahSppt: wp?.jumlahSppt ?? 0,
          padukuhan: wp?.padukuhan || "Mandingan",
        };
      })
      .filter((p) => p.points.length >= 3);
  }, [polygonList, wajibPajakList]);

  // Ambil daftar WP DHKP yang belum termapping polygon untuk picker manual drawing
  const unmappedWpList = useMemo(() => {
    if (!wajibPajakList || !polygonList) return [];
    const mappedNops = new Set(polygonList.map((p) => p.nop));
    return wajibPajakList.filter((wp) => !mappedNops.has(wp.nop));
  }, [wajibPajakList, polygonList]);

  const filteredUnmappedWp = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return unmappedWpList;
    return unmappedWpList.filter(
      (w) => w.namaWp.toLowerCase().includes(q) || w.nomorPetak.includes(q) || w.nop.includes(q)
    );
  }, [unmappedWpList, searchQuery]);

  // 2. Load Google Maps API secara dinamis di Client
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
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // 3. Inisialisasi Map (Secara reaktif setelah script termuat DAN container DOM siap)
  const initMap = () => {
    if (!mapContainerRef.current || !window.google || googleMapInstance.current) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 17,
      mapTypeId: mapType,
      disableDefaultUI: false,
      zoomControl: true,
    });

    googleMapInstance.current = map;
    setMapReady(true);

    // Klik listener pada peta untuk mode drawing manual
    map.addListener("click", (e: any) => {
      // Jika mode drawing aktif, rekam titik baru
      if (isDrawing) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        handleMapClickDrawing(lat, lng);
      } else {
        // Klik di area kosong akan menutup pop-up
        setSelectedPolygon(null);
      }
    });
  };

  useEffect(() => {
    if (mapsLoaded && mapContainerRef.current) {
      initMap();
    }
  }, [mapsLoaded, mapContainerRef.current]);

  // Switch map type
  useEffect(() => {
    if (googleMapInstance.current) {
      googleMapInstance.current.setMapTypeId(mapType);
    }
  }, [mapType, mapReady]);

  // 4. Render Polygons di Google Maps saat data berubah (Optimized Chunked Rendering)
  useEffect(() => {
    if (!mapsLoaded || !mapReady || !googleMapInstance.current || !window.google) return;

    // Hapus polygon lama yang sedang dirender di layar
    renderedPolygonsRef.current.forEach((p) => p.setMap(null));
    renderedPolygonsRef.current = [];

    let isCancelled = false;
    let currentIndex = 0;
    const chunkSize = 50;

    const renderNextChunk = () => {
      if (isCancelled || !googleMapInstance.current) return;

      const nextBatch = mappedPetakData.slice(currentIndex, currentIndex + chunkSize);
      if (nextBatch.length === 0) return;

      nextBatch.forEach((petak) => {
        const color = POLYGON_COLORS[petak.statusBayar as keyof typeof POLYGON_COLORS] || POLYGON_COLORS.unknown;
        
        const polyInstance = new window.google.maps.Polygon({
          paths: petak.points,
          strokeColor: color.stroke,
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
          fillColor: color.fill,
          fillOpacity: 0.35,
          map: googleMapInstance.current,
          clickable: true,
        });

        // Click listener pada polygon untuk menampilkan detail modal pop-up
        polyInstance.addListener("click", () => {
          setSelectedPolygon(petak);
          
          // Posisikan peta ke centroid polygon agar fokus
          const latSum = petak.points.reduce((s, p) => s + p.lat, 0);
          const lngSum = petak.points.reduce((s, p) => s + p.lng, 0);
          googleMapInstance.current.panTo({
            lat: latSum / petak.points.length,
            lng: lngSum / petak.points.length,
          });
        });

        renderedPolygonsRef.current.push(polyInstance);
      });

      currentIndex += chunkSize;
      if (currentIndex < mappedPetakData.length) {
        requestAnimationFrame(renderNextChunk);
      }
    };

    renderNextChunk();

    // Posisikan peta ke centroid blok jika ada data polygon baru
    if (mappedPetakData.length > 0) {
      const firstPoly = mappedPetakData[0].points;
      googleMapInstance.current.panTo(firstPoly[0]);
    }

    return () => {
      isCancelled = true;
    };
  }, [mappedPetakData, mapsLoaded, mapReady]);

  // 5. Efek untuk membaca parameter NOP sasaran dari Validasi
  useEffect(() => {
    if (drawForNop && drawForBlok) {
      setActiveBlok(drawForBlok);
      setTimeout(() => {
        setIsDrawing(true);
        setDrawingPoints([]);
        setSelectedPolygon(null);

        db.wajibPajak.where("nop").equals(drawForNop).first().then((wp) => {
          if (wp) {
            setTargetNop(wp);
          }
        });
      }, 800);
    }
  }, [drawForNop, drawForBlok]);

  // 6. Drawing Manual Logic
  const handleMapClickDrawing = (lat: number, lng: number) => {
    if (!googleMapInstance.current || !window.google) return;

    const newPoint = { lat, lng };
    setDrawingPoints((prev) => {
      const updated = [...prev, newPoint];
      updateDrawingVisuals(updated);
      return updated;
    });

    // Letakkan marker penanda kecil pada titik yang baru diklik
    const marker = new window.google.maps.Marker({
      position: newPoint,
      map: googleMapInstance.current,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 4,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: "#0F2D38",
        strokeWeight: 2,
      },
    });

    drawingMarkersRef.current.push(marker);
  };

  // Menggambar garis/bidang visual di peta secara instan saat user menggambar manual
  const updateDrawingVisuals = (points: Array<{ lat: number; lng: number }>) => {
    if (!googleMapInstance.current || !window.google) return;

    // Bersihkan gambar visual sebelumnya
    if (drawingPolylineRef.current) drawingPolylineRef.current.setMap(null);
    if (drawingPolygonRef.current) drawingPolygonRef.current.setMap(null);

    // Garis putus-putus pembatas
    drawingPolylineRef.current = new window.google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: "#ffffff",
      strokeOpacity: 0.9,
      strokeWeight: 3,
      map: googleMapInstance.current,
    });

    // Bidang transparan
    if (points.length >= 3) {
      drawingPolygonRef.current = new window.google.maps.Polygon({
        paths: points,
        strokeColor: "transparent",
        fillColor: "rgba(255, 255, 255, 0.35)",
        map: googleMapInstance.current,
      });
    }
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawingPoints([]);
    setSelectedPolygon(null);
    setTargetNop(null);
  };

  const handleUndoDrawing = () => {
    if (drawingPoints.length === 0) return;

    // Hapus marker terakhir
    const lastMarker = drawingMarkersRef.current.pop();
    if (lastMarker) lastMarker.setMap(null);

    setDrawingPoints((prev) => {
      const updated = prev.slice(0, -1);
      updateDrawingVisuals(updated);
      return updated;
    });
  };

  const handleFinishDrawing = async () => {
    if (drawingPoints.length < 3) {
      alert("⚠️ Minimal butuh 3 titik untuk membuat bidang tanah!");
      return;
    }
    
    if (targetNop) {
      // PINTAR: Jika diarahkan dari Validasi dengan target NOP tertentu, langsung simpan!
      await handleSaveManualPolygon(targetNop);
      setTargetNop(null);
      // Bersihkan search parameters dari URL agar tidak berulang
      window.history.replaceState(null, "", "/peta");
    } else {
      setShowPicker(true);
    }
  };

  const handleSaveManualPolygon = async (wp: WajibPajak) => {
    try {
      const formattedPoints = drawingPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
      
      await db.polygonBidang.put({
        nop: wp.nop,
        blok: activeBlok,
        nomorPetak: wp.nomorPetak,
        points: JSON.stringify(formattedPoints),
        sumber: "manual",
        wasClosed: true,
        needsReview: false,
        createdAt: new Date().toISOString(),
      });

      alert(`✅ Berhasil! Bidang tanah manual berhasil dihubungkan ke ${wp.namaWp}.`);
      
      // Bersihkan state menggambar
      handleCancelDrawing();
      setShowPicker(false);
    } catch (e) {
      alert("Gagal menyimpan bidang manual: " + String(e));
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    setTargetNop(null);
    
    // Hapus visual marker dan polyline
    drawingMarkersRef.current.forEach((m) => m.setMap(null));
    drawingMarkersRef.current = [];
    if (drawingPolylineRef.current) drawingPolylineRef.current.setMap(null);
    if (drawingPolygonRef.current) drawingPolygonRef.current.setMap(null);
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-up h-full pb-10">
      {/* 1. Selector Blok & Tipe Peta */}
      <div className="bg-brand-dark -mx-4 px-4 pb-4 pt-1 flex flex-col gap-3 shadow-md md:rounded-b-2xl">
        <div className="flex items-center justify-between">
          {/* Blok Selector Row */}
          <div className="flex gap-1">
            {BLOK_LIST.map((blok) => (
              <button
                key={blok}
                onClick={() => {
                  setActiveBlok(blok);
                  setSelectedPolygon(null);
                  handleCancelDrawing();
                }}
                className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                  activeBlok === blok
                    ? "bg-white border-white text-brand-dark shadow-sm"
                    : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                }`}
              >
                Blok {blok}
              </button>
            ))}
          </div>

          {/* Map Type Toggle */}
          <button
            onClick={() => setMapType((t) => (t === "satellite" ? "roadmap" : "satellite"))}
            className="p-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title="Ganti Tipe Peta"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-center text-[10px] font-semibold text-brand-teal mt-0.5">
          <span>{mappedPetakData.length} Petak Terpetakan</span>
          <Link
            href="/peta/georef"
            className="text-brand-gold hover:underline font-extrabold flex items-center gap-1 shrink-0 bg-brand-gold/10 px-2 py-1 rounded-md"
          >
            ⚙️ Georeferencing Peta PDF
          </Link>
        </div>
      </div>

      {/* Target NOP Banner Pintar */}
      {targetNop && (
        <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-3 text-[10px] leading-relaxed text-brand-gold font-bold flex justify-between items-center animate-pulse">
          <span>🎯 Menggambar bidang tanah untuk WP: {targetNop.namaWp} (Petak {targetNop.nomorPetak})</span>
          <button onClick={handleCancelDrawing} className="text-brand-gold">✕</button>
        </div>
      )}

      {/* 2. Google Maps Container */}
      <div className="relative flex-1 rounded-2xl border border-brand-dark/5 shadow-sm overflow-hidden h-[360px] md:h-[450px]">
        <div ref={mapContainerRef} className="w-full h-full bg-brand-light" />

        {/* Legend Overlay */}
        <div className="absolute top-3 left-3 bg-brand-dark/90 backdrop-blur-md border border-white/10 text-[9px] font-extrabold text-white p-2.5 rounded-xl flex flex-col gap-1.5 shadow-lg select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-status-belum inline-block" />
            <span>Belum Diterima</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-status-diterima inline-block" />
            <span>Sudah Diterima</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-status-sawah inline-block" />
            <span>Sawah / Bebas</span>
          </div>
        </div>

        {/* Drawing Manual FAB */}
        {!isDrawing && (
          <button
            onClick={handleStartDrawing}
            className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-brand-dark hover:bg-brand-dark/95 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border border-white/10"
            title="Gambar Bidang Manual"
          >
            <Plus className="w-6 h-6 text-brand-gold" />
          </button>
        )}

        {/* Map Loading indicator */}
        {!mapsLoaded && (
          <div className="absolute inset-0 bg-brand-light flex items-center justify-center flex-col gap-2">
            <span className="w-2.5 h-2.5 rounded bg-brand-gold animate-ping" />
            <span className="text-xs text-brand-teal font-bold">Memuat Peta Satelit...</span>
          </div>
        )}
      </div>

      {/* 3. Drawing Controls UI */}
      {isDrawing && (
        <section className="bg-brand-dark text-white rounded-2xl p-4 border border-brand-dark/5 shadow-lg space-y-3 relative overflow-hidden">
          <div className="flex flex-col text-center">
            <span className="text-[10px] font-extrabold text-brand-gold uppercase tracking-wider">
              {targetNop ? "Menggambar Bidang Sasaran Pintar" : "Mode Gambar Bidang Manual"}
            </span>
            <p className="text-[9px] text-brand-teal mt-0.5 leading-normal">
              Klik beberapa titik pada peta satelit untuk membentuk bidang polygon tanah ({drawingPoints.length} titik).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleCancelDrawing}
              className="py-2.5 rounded-xl border border-status-belum/20 bg-status-belum/10 hover:bg-status-belum/20 text-status-belum text-[10px] font-extrabold uppercase tracking-wider transition-colors duration-200"
            >
              Batal
            </button>
            <button
              onClick={handleUndoDrawing}
              disabled={drawingPoints.length === 0}
              className="py-2.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 text-white text-[10px] font-extrabold uppercase tracking-wider transition-colors duration-200 disabled:opacity-50"
            >
              Undo
            </button>
            <button
              onClick={handleFinishDrawing}
              disabled={drawingPoints.length < 3}
              className="py-2.5 rounded-xl bg-status-diterima hover:bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Selesai
            </button>
          </div>
        </section>
      )}

      {/* 4. Tap Polygon Popup Modal Detail */}
      {selectedPolygon && (
        <section className="bg-white rounded-2xl p-4 border border-brand-dark/5 shadow-lg relative overflow-hidden animate-slide-up">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[8px] font-extrabold text-brand-teal uppercase tracking-wider block font-mono">
                NOP: {selectedPolygon.nop}
              </span>
              <h4 className="text-xs font-black text-brand-dark uppercase truncate pr-3">
                {selectedPolygon.namaWp}
              </h4>
            </div>
            <button
              onClick={() => setSelectedPolygon(null)}
              className="p-1 rounded-lg bg-brand-light hover:bg-brand-teal/20 text-brand-dark transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] py-2 border-y border-brand-light">
            <div className="border-r border-brand-light">
              <span className="text-[8px] text-brand-teal block uppercase font-bold">Blok-Petak</span>
              <p className="font-extrabold text-brand-dark mt-0.5">{selectedPolygon.blok}-{selectedPolygon.nomorPetak}</p>
            </div>
            <div className="border-r border-brand-light">
              <span className="text-[8px] text-brand-teal block uppercase font-bold">SPPT PBB</span>
              <p className="font-extrabold text-brand-dark mt-0.5">
                {selectedPolygon.jumlahSppt === 0 ? "Bebas" : `Rp ${selectedPolygon.jumlahSppt.toLocaleString("id-ID")}`}
              </p>
            </div>
            <div>
              <span className="text-[8px] text-brand-teal block uppercase font-bold">Padukuhan</span>
              <p className="font-extrabold text-brand-dark mt-0.5 truncate">{selectedPolygon.padukuhan}</p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-brand-teal">Status:</span>
              <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                selectedPolygon.statusBayar === "diterima" ? "bg-emerald-500/10 text-status-diterima" :
                selectedPolygon.statusBayar === "sawah" ? "bg-amber-500/10 text-status-sawah" :
                "bg-red-500/10 text-status-belum"
              }`}>
                {selectedPolygon.statusBayar === "diterima" ? "Sudah Diterima" :
                 selectedPolygon.statusBayar === "sawah" ? "Sawah / Bebas" : "Belum Diterima"}
              </span>
            </div>

            <Link
              href="/wajib-pajak"
              className="text-[10px] font-extrabold text-brand-gold hover:underline"
            >
              Lihat Detail WP 👥
            </Link>
          </div>
        </section>
      )}

      {/* 5. Picker Modal DHKP untuk Drawing Manual */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-sm flex justify-center items-end animate-fade-in p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto flex flex-col animate-slide-up shadow-2xl relative">
            {/* Header Picker */}
            <div className="bg-brand-dark text-white p-4 flex justify-between items-center sticky top-0 z-10">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-teal">
                  Menghubungkan Bidang Manual
                </span>
                <h3 className="text-sm font-black text-white uppercase mt-0.5">
                  Pilih Wajib Pajak (DHKP)
                </h3>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Picker */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <p className="text-[10px] text-brand-teal leading-relaxed">
                Pilih data Wajib Pajak di <b>Blok {activeBlok}</b> yang belum memiliki polygon di peta untuk dikaitkan dengan polygon manual yang baru Anda buat.
              </p>

              {/* Search Input */}
              <div className="flex items-center gap-2 bg-brand-light border border-brand-dark/5 rounded-xl px-3 py-2 text-brand-dark">
                <input
                  type="text"
                  placeholder="Cari Nama / No Petak / NOP..."
                  className="bg-transparent border-none text-xs text-brand-dark placeholder-brand-teal outline-none w-full font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-brand-teal">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* List Wp */}
              <div className="space-y-2 mt-2 max-h-[40vh] overflow-y-auto pb-4">
                {filteredUnmappedWp.length > 0 ? (
                  filteredUnmappedWp.map((wp) => (
                    <div
                      key={wp.nop}
                      onClick={() => handleSaveManualPolygon(wp)}
                      className="bg-brand-light/30 border border-brand-dark/5 hover:border-brand-gold/30 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors duration-200"
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-bold text-brand-dark truncate">{wp.namaWp}</h4>
                        <span className="text-[9px] text-brand-teal font-mono block mt-0.5">
                          Petak {wp.nomorPetak} • NOP: {wp.nop}
                        </span>
                      </div>
                      <Plus className="w-4 h-4 text-brand-gold shrink-0" />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-brand-teal opacity-50" />
                    <div>
                      <h4 className="text-xs font-bold text-brand-dark">Tidak Ada WP Tanpa Peta</h4>
                      <p className="text-[9px] text-brand-teal mt-0.5">
                        Semua wajib pajak pada pencarian ini sudah termapping dengan rapi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Picker */}
            <div className="bg-brand-light p-4 border-t border-brand-dark/5 sticky bottom-0 z-10 flex gap-2">
              <button
                onClick={() => setShowPicker(false)}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-brand-dark/5 border border-brand-dark/10 font-bold text-center text-brand-dark text-xs"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PetaPage() {
  return (
    <PageWrapper title="KARTABUMI" showStatus={false}>
      <Suspense fallback={
        <div className="flex h-full flex-col items-center justify-center py-40 gap-2">
          <span className="w-3.5 h-3.5 rounded bg-brand-gold animate-ping mx-auto" />
          <span className="text-xs text-brand-teal font-extrabold uppercase mt-2">Memuat Peta Satelit...</span>
        </div>
      }>
        <PetaPageContent />
      </Suspense>
    </PageWrapper>
  );
}
