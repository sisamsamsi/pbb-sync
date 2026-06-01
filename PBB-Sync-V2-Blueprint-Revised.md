# KARTABUMI — Blueprint Arsitektur (Web/PWA)
> Dokumen referensi lengkap untuk AI assistant & developer  
> Versi: 2.0-revised | Tanggal: 2026

---

## 1. Visi Produk

KARTABUMI adalah aplikasi distribusi SPPT PBB-P2 berbasis **Web/PWA** yang dirancang untuk petugas distribusi di tingkat kalurahan dan padukuhan.

### Fokus Utama
- Offline-first — berjalan penuh tanpa internet
- Mobile-friendly — diakses via browser HP
- Import data Excel BKAD (DHKP)
- Visualisasi peta PDF BKAD dengan overlay polygon bidang tanah
- Overlay polygon di atas **Google Maps Satellite View**
- Tracking dan monitoring distribusi SPPT
- Backup dan restore data lokal
- Dapat dikembangkan menjadi multi-petugas (V2.3+)

### Mengapa Pindah dari React Native ke Web/PWA?

| Masalah di V1 (React Native) | Solusi di V2 (Web/PWA) |
|---|---|
| PDF native crash, konflik module | PDF.js stabil, pure JavaScript |
| Polygon ekstraksi via Python laptop | PDF.js bisa baca vector path di browser |
| EAS Build tiap ada native package | Deploy sekali, update otomatis |
| Georeferencing hardcode di script | In-browser georeferencing tool |
| Tidak bisa baca vector PDF di HP | PDF.js `getOperatorList()` bisa akses path |

---

## 2. Prinsip Arsitektur

### Koordinat Sistem Polygon

> **PENTING:** V2 tetap menggunakan koordinat **GPS (lat/lng)** karena overlay di **Google Maps**, bukan pixel PDF.

Alur konversi koordinat:

```
PDF.js baca file PDF
    ↓
getOperatorList() → extract semua vector path
(moveTo, lineTo, closePath dalam PDF pt units)
    ↓
In-browser Georeferencing Tool
User klik 4 titik referensi di PDF viewer
→ input koordinat GPS dari Google Maps
→ app hitung affine transform matrix
    ↓
Konversi otomatis: semua PDF (x,y) → GPS (lat,lng)
    ↓
Google Maps JS API Polygon overlay
```

### Cara Mendapatkan Koordinat GPS untuk Georeferencing

Proses yang dilakukan petugas (sekali per blok):
1. Buka tab PDF Viewer di app → pilih blok
2. Klik 4 titik yang mudah dikenali di PDF (perempatan jalan, sudut area)
3. Buka Google Maps di tab baru → cari titik yang sama → klik kanan → "What's here"
4. Copy lat,lng → paste ke form di app
5. Klik "Hitung Transform" → semua polygon blok ter-konversi otomatis

### Dua Layer Peta

```
Layer 1: Google Maps Satellite (base map, GPS)
Layer 2: Polygon overlay via Maps JS API
         (koordinat GPS hasil georeferencing)

PDF Viewer terpisah sebagai referensi visual
→ untuk lihat nomor petak & bentuk bidang
→ bukan untuk overlay langsung
```

### Offline Strategy

```
Service Worker (Cache API):
├── Asset Next.js (JS, CSS, HTML)
├── File PDF peta blok (per wilayah)
└── Google Maps tiles (cached setelah pertama load)

IndexedDB (Dexie.js):
├── Data wajib pajak (DHKP)
├── Data polygon bidang (koordinat GPS)
├── Data distribusi & sesi
├── Konfigurasi georeferencing per blok
└── Log backup

TIDAK di IndexedDB:
└── Foto bukti → File System Access API
    atau Blob URL (dikompres dulu)
```

---

## 3. Arsitektur Sistem

```
┌──────────────────────────────────────┐
│  Browser Android / Chrome / Edge     │
│                                      │
│  ┌─────────────────────────────┐     │
│  │  Next.js PWA App            │     │
│  │  ┌─────────┐ ┌──────────┐  │     │
│  │  │ PDF.js  │ │ GMaps JS │  │     │
│  │  │ Viewer  │ │ API      │  │     │
│  │  └────┬────┘ └────┬─────┘  │     │
│  │       │           │         │     │
│  │  ┌────▼───────────▼──────┐  │     │
│  │  │    Zustand State      │  │     │
│  │  └──────────┬────────────┘  │     │
│  │             │               │     │
│  │  ┌──────────▼────────────┐  │     │
│  │  │   Dexie.js (IndexedDB)│  │     │
│  │  └───────────────────────┘  │     │
│  └─────────────────────────────┘     │
│                                      │
│  Service Worker (Offline Cache)      │
└──────────────────────────────────────┘
```

---

## 4. Technology Stack

### Frontend Framework
| Layer | Teknologi | Versi | Alasan |
|---|---|---|---|
| Framework | Next.js | 14+ (App Router) | Full-stack, SSG/SSR, PWA ready |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Sudah familiar dari V1 |
| UI Components | shadcn/ui | Latest | Accessible, customizable |

### State & Data
| Layer | Teknologi | Alasan |
|---|---|---|
| State Management | Zustand | Familiar dari V1, ringan |
| Local Database | Dexie.js (IndexedDB) | API mirip SQL, offline penuh |
| ORM-like | Dexie hooks | React integration |

### Peta & Polygon
| Layer | Teknologi | Alasan |
|---|---|---|
| Base Map | Google Maps JS API | Satellite view, polygon support |
| PDF Viewer | pdfjs-dist | Render PDF + akses vector path |
| PDF Overlay Canvas | Konva.js / React-Konva | Drawing tool di atas PDF viewer |
| Georeferencing | Custom (affine transform) | Port dari geo.service.ts V1 |

### File & Reporting
| Layer | Teknologi | Alasan |
|---|---|---|
| Import Excel | xlsx (SheetJS) | Sama dengan V1, proven |
| Export PDF | pdf-lib | Generate laporan distribusi |
| Export Excel | exceljs | Rekap sesi distribusi |
| Offline | next-pwa | Service Worker otomatis |

### Catatan Kompatibilitas
```
Node.js          : ≥ 18
Browser target   : Chrome 90+, Edge 90+
                   (diutamakan Chrome Android)
Minimum Android  : 8.0 (API 26)
IndexedDB quota  : ~60% free disk space
PDF file size    : Disimpan di Cache API, bukan IndexedDB
```

---

## 5. Struktur Database (Dexie.js / IndexedDB)

### Tabel `wajib_pajak`

```typescript
interface WajibPajak {
  id?: number               // auto increment
  nop: string               // UNIQUE — "34.02.070.002.013.0001.0"
  blok: string              // "013" | "014" | "015"
  nomor_petak: string       // "0001"

  // Data dari DHKP Excel BKAD
  nama_wp: string
  padukuhan: string         // "MANDINGAN"
  alamat_objek: string      // alamat fisik bidang tanah
  alamat_wp: string         // domisili pemilik
  luas_tanah: number        // m²
  luas_bangunan: number     // m²
  jumlah_sppt: number       // nilai SPPT (0 = sawah/bebas)

  // Status distribusi
  status_distribusi: string // 'belum' | 'diterima' | 'sawah'

  tahun_pajak: string       // "2026"
  created_at: string
  updated_at: string
}

// Index: nop, blok, status_distribusi, nama_wp
```

**Catatan status_distribusi:**
```
belum    → SPPT belum diserahkan ke WP (default)
diterima → SPPT sudah diserahkan ke WP (update manual)
sawah    → bebas pajak kebijakan Pemda Bantul (jumlah_sppt = 0)
```

---

### Tabel `polygon_bidang`

```typescript
interface PolygonBidang {
  id?: number
  nop: string               // FK ke wajib_pajak.nop
  blok: string              // "013"
  nomor_petak: string       // "0001"

  // Koordinat GPS (lat/lng) — bukan pixel PDF
  // Format: '[{"lat":-7.912,"lng":110.331},...]'
  polygon_json: string

  // Metadata ekstraksi
  sumber: string            // 'auto' | 'manual' | 'import_json'
  was_closed: boolean       // apakah path PDF sudah closed saat ekstraksi
  needs_review: boolean     // tandai kalau koordinat perlu dicek

  created_at: string
}

// Index: nop, blok, nomor_petak
```

---

### Tabel `georef_config`

```typescript
interface GeorefConfig {
  id?: number
  blok: string              // UNIQUE — "013"

  // 4 titik kontrol: PDF point units ↔ GPS
  // Format: '[{"px":120,"py":45,"lat":-7.912,"lng":110.331},...]'
  control_points: string

  // Dimensi halaman PDF (dalam PDF pt units)
  pdf_page_width: number
  pdf_page_height: number

  // Nomor halaman di file PDF (0-indexed)
  pdf_page_index: number    // blok 013 = 12, 014 = 13, 015 = 14

  is_ready: boolean
  created_at: string
}

// Index: blok
```

---

### Tabel `sesi_distribusi`

```typescript
interface SesiDistribusi {
  id?: number
  tanggal: string           // "2026-03-27"
  petugas: string           // nama petugas
  blok: string | null       // null = semua blok
  target: number            // jumlah WP yang ditarget
  selesai: number           // jumlah yang sudah distribusi
  is_closed: boolean        // sesi sudah ditutup?
  catatan: string
  created_at: string
}
```

---

### Tabel `distribusi`

```typescript
interface Distribusi {
  id?: number
  sesi_id: number           // FK ke sesi_distribusi
  nop: string               // FK ke wajib_pajak
  status: string            // 'diterima' | 'tidak_ada' | 'lain'
  waktu: string             // "09:15" — jam distribusi
  catatan: string
  foto_bukti_id: string | null // FK ke foto_bukti (opsional)
  created_at: string
}

// Index: sesi_id, nop
```

---

### Tabel `foto_bukti`

```typescript
interface FotoBukti {
  id?: number
  distribusi_id: number
  foto_blob: Blob           // dikompres sebelum simpan (max 200KB)
  created_at: string
}
```

---

### Tabel `peta_pdf`

```typescript
interface PetaPdf {
  id?: number
  nama_file: string         // "070002.pdf"
  tahun_pajak: string       // "2026"
  jumlah_halaman: number    // 20
  // File PDF sendiri disimpan di Cache API (Service Worker)
  // bukan di sini — hanya metadata
  created_at: string
}
```

---

### Tabel `backup_log`

```typescript
interface BackupLog {
  id?: number
  tanggal_backup: string
  ukuran_file: number       // bytes
  jumlah_wp: number
  jumlah_polygon: number
  jumlah_distribusi: number
  keterangan: string
}
```

---

## 6. Struktur Folder

```
kartabumi-v2/
├── public/
│   ├── manifest.json         ← PWA manifest
│   ├── sw.js                 ← Service Worker (auto-generated next-pwa)
│   └── icons/
│
├── src/
│   ├── app/                  ← Next.js App Router
│   │   ├── layout.tsx        ← Root layout + PWA meta
│   │   ├── page.tsx          ← Redirect ke /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── wajib-pajak/
│   │   │   ├── page.tsx      ← List & search WP
│   │   │   └── [nop]/
│   │   │       └── page.tsx  ← Detail WP
│   │   ├── peta/
│   │   │   ├── page.tsx      ← Google Maps + polygon
│   │   │   └── georef/
│   │   │       └── page.tsx  ← Georeferencing tool
│   │   ├── distribusi/
│   │   │   ├── page.tsx      ← Mode distribusi
│   │   │   └── [sesi_id]/
│   │   │       └── page.tsx  ← Detail sesi
│   │   ├── laporan/
│   │   │   └── page.tsx      ← Ringkasan & export
│   │   ├── validasi/
│   │   │   └── page.tsx      ← Deteksi petak tanpa polygon
│   │   ├── import/
│   │   │   └── page.tsx      ← Import Excel + JSON polygon
│   │   └── settings/
│   │       └── page.tsx      ← Backup, restore, reset
│   │
│   ├── components/
│   │   ├── ui/               ← shadcn/ui components
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── PageWrapper.tsx
│   │   ├── maps/
│   │   │   ├── GoogleMapView.tsx
│   │   │   ├── PolygonLayer.tsx
│   │   │   └── GeorefTool.tsx    ← in-browser georef tool
│   │   ├── pdf/
│   │   │   ├── PdfViewer.tsx
│   │   │   └── PdfExtractor.tsx  ← extract vector dari PDF.js
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── WpCard.tsx
│   │       └── ProgressBar.tsx
│   │
│   ├── db/
│   │   ├── index.ts          ← Dexie instance
│   │   ├── schema.ts         ← Semua tabel + interface
│   │   └── migrations.ts     ← Versioning Dexie
│   │
│   ├── services/
│   │   ├── import.service.ts     ← Import Excel DHKP
│   │   ├── polygon.service.ts    ← Import/export JSON polygon
│   │   ├── geo.service.ts        ← Affine transform (port dari V1)
│   │   ├── pdf-extract.service.ts← PDF.js vector extraction
│   │   ├── distribusi.service.ts ← Logic distribusi
│   │   └── laporan.service.ts    ← Generate ringkasan & export
│   │
│   ├── stores/
│   │   ├── app.store.ts          ← Global UI state
│   │   ├── map.store.ts          ← Maps state (active blok, selected polygon)
│   │   └── distribusi.store.ts   ← Sesi aktif
│   │
│   ├── hooks/
│   │   ├── useWajibPajak.ts
│   │   ├── usePolygon.ts
│   │   ├── useGeoref.ts
│   │   └── useDistribusi.ts
│   │
│   ├── utils/
│   │   ├── nop.utils.ts          ← Parse NOP → blok, nomor_petak
│   │   ├── geo.utils.ts          ← Kalkulasi affine transform
│   │   └── format.utils.ts       ← Format angka, tanggal, rupiah
│   │
│   └── types/
│       ├── wp.types.ts
│       ├── polygon.types.ts
│       └── distribusi.types.ts
│
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 7. Modul Aplikasi

### Dashboard
- Total WP per blok (013, 014, 015)
- Progress distribusi: diterima / belum / sawah
- Progress mapping polygon: sudah / belum polygon
- Shortcut ke modul lain

### Data Wajib Pajak
- List semua WP dengan virtual scroll
- Search: nama WP, NOP, nomor petak
- Filter: blok, status distribusi
- Detail WP: info lengkap + mini map lokasi

### Peta Interaktif
- Google Maps Satellite View (default)
- Toggle Standard/Satellite
- Polygon overlay per petak (warna status)
- Tap polygon → popup: nama WP, NOP, SPPT, status
- Selector blok (013 / 014 / 015)
- Legend warna status

### PDF Viewer (Referensi)
- Render PDF peta blok
- Zoom & pan
- Selector blok → pindah halaman PDF
- Hanya untuk referensi visual nomor petak
- Tombol akses ke Georef Tool

### Georeferencing Tool (In-Browser)
- Buka PDF + Google Maps berdampingan (split view)
- User klik 4 titik di PDF → catat koordinat PDF
- User input GPS dari Google Maps untuk tiap titik
- App hitung affine transform matrix
- Preview: polygon test muncul di Maps untuk validasi
- Simpan config → apply ke semua polygon blok

### PDF Vector Extraction (Fitur Utama V2)
- Upload PDF → PDF.js getOperatorList()
- Parse moveTo / lineTo / closePath
- Auto-detect polygon per petak
- Match nomor teks ke polygon
- Toleransi gap untuk path bocor
- Output JSON koordinat PDF
- Georef → konversi ke GPS
- Import ke database

### Mode Distribusi
- Buat sesi baru: nama petugas, blok, tanggal
- List WP yang belum diterima (sorted by nomor petak)
- Tap WP → tandai: Diterima / Tidak Ada / Lain
- Catatan & foto bukti (opsional)
- Progress bar realtime sesi

### Validasi Peta (Fitur Pintar 1)
- Progress mapping per blok (%)
- List WP yang belum punya polygon
- Filter per blok
- Tap WP → buka Maps → drawing mode otomatis aktif
- Pull-to-refresh setelah gambar polygon baru

### Laporan & Ringkasan (Fitur Pintar 2)
- Ringkasan otomatis per sesi distribusi:
  - Jumlah WP ditemui
  - Jumlah tidak ada
  - Total nilai SPPT terdistribusi
  - Progress per blok
- Export PDF laporan
- Export Excel rekap

### Backup & Restore
- Export: JSON / ZIP berisi semua data
- Import: restore dari file backup
- Reset parsial: hapus polygon saja (tanpa hapus data WP)
- Reset total: hapus semua data

---

## 8. Arsitektur Overlay Polygon di Google Maps

### Alur Lengkap

```
TAHAP 1 — Ekstraksi (sekali per file PDF)
PDF.js getOperatorList()
    ↓
Parse path commands (m, l, c, z)
    ↓
Deteksi polygon per petak (match dengan teks nomor)
    ↓
Output: koordinat PDF (x, y dalam pt units)

TAHAP 2 — Georeferencing (sekali per blok)
User pilih 4 titik referensi di PDF viewer
    ↓
Input GPS (lat, lng) dari Google Maps untuk tiap titik
    ↓
Hitung affine transform matrix (3x3)
    ↓
Simpan ke georef_config

TAHAP 3 — Rendering (realtime)
Load polygon dari IndexedDB (koordinat GPS)
    ↓
Google Maps JS API
    ↓
new google.maps.Polygon({
  paths: koordinat GPS,
  fillColor: warna_status,
  strokeColor: warna_border,
  clickable: true
})
    ↓
addListener('click') → popup detail WP
```

### Format Data Polygon

```typescript
// Disimpan di IndexedDB
interface PolygonPoint {
  lat: number   // koordinat GPS
  lng: number   // koordinat GPS
}

// polygon_json field
const contoh = [
  { lat: -7.9121, lng: 110.3298 },
  { lat: -7.9121, lng: 110.3312 },
  { lat: -7.9135, lng: 110.3312 },
  { lat: -7.9135, lng: 110.3298 },
]
```

### Warna Polygon per Status

```
belum    → fill: rgba(232,84,84,0.35)    stroke: #E85454  (merah)
diterima → fill: rgba(46,201,126,0.35)  stroke: #2EC97E  (hijau)
sawah    → fill: rgba(240,165,0,0.25)   stroke: #F0A500  (kuning)
selected → fill: rgba(240,165,0,0.55)   stroke: #F0A500  (kuning tebal)
unmapped → fill: rgba(90,140,178,0.20)  stroke: #5C8EB2  (biru, belum ada polygon)
```

### Drawing Tool Manual (Fallback)

Untuk petak yang tidak bisa diekstrak otomatis:
```
User tap "Gambar Petak" di Maps
    ↓
Click listener aktif di Google Maps
    ↓
Setiap klik → tambah titik (LatLng)
    ↓
Min 3 titik → preview polygon muncul
    ↓
Selesai → pilih NOP dari modal
    ↓
Simpan ke IndexedDB
```

---

## 9. Workflow Utama

### Import Data DHKP (Excel)

```
Upload file Excel (.xlsx) dari BKAD
    ↓
SheetJS parse semua baris
    ↓
Validasi kolom: NOP, Wajib Pajak, dst
    ↓
Parse NOP → extract blok + nomor_petak
    ↓
Status: jumlah_sppt = 0 → 'sawah', else 'belum'
    ↓
Upsert ke IndexedDB (NOP = unique key)
    ↓
Tampil ringkasan: imported / skipped
```

### Import Polygon JSON (dari Python Script / V1)

```
Upload file polygons_013.json
    ↓
Parse & validasi struktur
    ↓
Cek apakah koordinat sudah GPS atau masih perlu georef
    ↓
Insert ke polygon_bidang
    ↓
Link ke wajib_pajak via NOP
```

### Distribusi SPPT

```
Buat sesi baru → isi petugas + blok + tanggal
    ↓
List WP belum diterima di blok tersebut
    ↓
Di lapangan: tap WP → pilih status
  Diterima   → update status_distribusi = 'diterima'
  Tidak Ada  → catat di log_distribusi
  Lain       → isi catatan manual
    ↓
Sesi selesai → tutup sesi
    ↓
Ringkasan otomatis terbuat
```

---

## 10. PWA & Offline Configuration

### next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\.pdf$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pdf-cache',
        expiration: { maxEntries: 10 }
      }
    },
    {
      urlPattern: /^https:\/\/maps\.googleapis\.com/,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'gmaps-cache' }
    }
  ]
})
```

### manifest.json

```json
{
  "name": "KARTABUMI",
  "short_name": "KARTABUMI",
  "description": "Aplikasi distribusi SPPT PBB Kalurahan Ringinharjo",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0F2D38",
  "theme_color": "#0F2D38",
  "orientation": "portrait",
  "icons": [...]
}
```

### Google Maps API Key

```javascript
// Tambah di next.config.js atau .env.local
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIzaSyAvN0cGqoxDaAYV-ksnTKPlkBcYtnH9IaM

// Restrict key:
// Application restrictions: HTTP referrers
// API restrictions: Maps JavaScript API only
```

---

## 11. Migrasi dari V1 (React Native)

### Yang Bisa Digunakan Ulang (~70%)

| Asset V1 | Dipakai di V2 |
|---|---|
| `geo.service.ts` (affine transform) | ✅ Port langsung |
| `import.service.ts` (Excel parsing) | ✅ SheetJS sama |
| Schema database (struktur tabel) | ✅ Adapt ke Dexie |
| File JSON polygon (koordinat GPS) | ✅ Import langsung |
| Zustand stores | ✅ Adapt |
| Desain UI (warna, layout) | ✅ Tailwind sama |
| Logic validasi NOP | ✅ Port langsung |
| Logic status distribusi | ✅ Port langsung |

### Yang Ditulis Ulang (~30%)

| Komponen | Alasan |
|---|---|
| UI layer | React Native → React web |
| Database layer | expo-sqlite → Dexie/IndexedDB |
| PDF viewer | react-native-pdf → PDF.js |
| Maps | react-native-maps → Google Maps JS API |
| Storage | FileSystem → Cache API + IndexedDB |
| Navigation | Expo Router → Next.js App Router |

### Catatan Penting Migrasi Data Polygon

```
V1 menyimpan koordinat GPS (lat/lng) ✅
→ Bisa langsung diimport ke V2 tanpa konversi

V1 menggunakan file JSON: polygons_013.json
→ Format kompatibel, tinggal upload di V2
```

---

## 12. Roadmap

### V2.0 — Core Features (Sprint 1-5)
- Setup Next.js + PWA + Dexie
- Import Excel DHKP
- Dashboard statistik
- Data Wajib Pajak (list + search + detail)
- Mode Distribusi dasar
- Backup & Restore

### V2.1 — Peta & Polygon (Sprint 6-8)
- Google Maps integration
- Import JSON polygon dari V1
- Overlay polygon dengan warna status
- Tap polygon → popup detail WP
- PDF Viewer (referensi)

### V2.2 — Ekstraksi & Georeferencing (Sprint 9-11)
- In-browser PDF vector extraction (PDF.js)
- In-browser georeferencing tool (tanpa Python)
- Drawing tool manual (fallback)
- Validasi peta (Fitur Pintar 1)
- Ringkasan otomatis sesi (Fitur Pintar 2)

### V2.3 — Laporan & Export (Sprint 12-13)
- Export PDF laporan distribusi
- Export Excel rekap sesi
- Statistik per blok
- Filter & sorting advanced

### V2.4 — Multi Petugas (Future)
- Sinkronisasi cloud opsional
- Backend API (Laravel / Supabase)
- Auth petugas
- Sinkronisasi antar device

---

## 13. Catatan untuk AI Assistant

### Yang HARUS selalu diingat:

1. **Browser, bukan HP native** — Tidak ada EAS Build, tidak ada native module. Semua pure JavaScript/TypeScript yang jalan di Chrome Android.

2. **Koordinat polygon = GPS (lat/lng)** — Bukan pixel PDF. Konversi dilakukan via affine transform (geo.service.ts).

3. **Google Maps tetap dipakai** — Google Maps JS API, bukan react-native-maps. API berbeda, tapi konsep sama.

4. **PDF.js untuk dua hal berbeda:**
   - Render PDF untuk ditampilkan (viewer)
   - `getOperatorList()` untuk ekstrak vector path (extraction)

5. **IndexedDB quota** — PDF disimpan di Cache API (Service Worker), bukan IndexedDB. IndexedDB hanya untuk data terstruktur.

6. **Status WP hanya 3 nilai:**
   - `belum` → belum distribusi
   - `diterima` → sudah distribusi
   - `sawah` → bebas pajak Pemda Bantul (jumlah_sppt = 0)

7. **Blok yang relevan:** 013, 014, 015 (Kalurahan Ringinharjo, Kapanewon Bantul, Kode 3402070002)

8. **PWA requirement:** Harus bisa diinstall via "Add to Home Screen" di Chrome Android dan berjalan offline.

9. **Mobile-first:** Semua layout dirancang untuk layar HP terlebih dahulu, bukan desktop.

10. **Georeferencing per blok:** Sekali setup per blok, permanent. Tidak perlu diulang kecuali ada perubahan peta.

---

## 14. Target Akhir

```
Petugas buka app di HP (PWA)
    ↓
Lihat dashboard: progress distribusi hari ini
    ↓
Buka tab Peta → Google Maps satellite
    ↓
Polygon petak muncul berwarna:
  Merah = belum, Hijau = sudah, Kuning = sawah
    ↓
Tap petak → popup: nama WP, NOP, SPPT
    ↓
Navigasi ke rumah WP → serahkan SPPT
    ↓
Tap "Tandai Diterima" di app
    ↓
Polygon berubah hijau di peta
    ↓
Akhir hari → tutup sesi
    ↓
Ringkasan otomatis: berapa selesai, total SPPT
    ↓
Export PDF laporan (opsional)
```

KARTABUMI menjadi sistem distribusi SPPT berbasis peta yang ringan, offline-first, mobile-friendly, dan siap berkembang menjadi sistem multi-petugas.

---

*Blueprint ini adalah dokumen hidup. Update setiap ada keputusan arsitektur baru.*  
*Versi: 2.0-revised | Project: KARTABUMI | Kalurahan Ringinharjo, Bantul*
