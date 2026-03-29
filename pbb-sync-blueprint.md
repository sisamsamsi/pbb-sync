# PBB Sync — Blueprint Aplikasi Mobile

> Dokumen referensi lengkap untuk AI assistant & developer

**Versi:** 1.0  
**Tanggal:** 27 Maret 2026  
**Status:** 🟢 Active Development — Sprint 2

---

## 1. GAMBARAN UMUM

### 1.1 Latar Belakang

PBB Sync adalah aplikasi mobile **offline, penggunaan pribadi** yang dibuat oleh petugas distribusi SPPT Kalurahan Ringinharjo, Kapanewon Bantul, Kabupaten Bantul, DIY. Aplikasi ini menyelesaikan masalah nyata di lapangan:

| Masalah                                   | Solusi di Aplikasi                        |
| ----------------------------------------- | ----------------------------------------- |
| Data byname WP hanya ada di buku cetak    | Import Excel → SQLite lokal               |
| Peta blok PBB hanya gambar nomor petak    | Overlay polygon interaktif di Google Maps |
| Tidak bisa tahu pemilik petak di lapangan | Tap petak → popup data WP langsung        |
| Tidak ada rekap distribusi harian         | Fitur ringkasan otomatis per sesi         |
| Data peta & byname tidak terhubung        | Auto-link via NOP (Nomor Objek Pajak)     |

### 1.2 Identitas Wilayah

```
Kapanewon   : Bantul
Kalurahan   : Ringinharjo
Kode Wilayah: 3402070002
Blok Target : 013, 014, 015
Padukuhan   : Mandingan
Tahun Pajak : 2026
```

### 1.3 Prinsip Utama

- **100% Offline** — tidak ada server, tidak ada cloud, semua data di device
- **Privat** — hanya digunakan oleh petugas distribusi, tidak ada sharing
- **Ringan** — sprint kecil, tidak over-engineered
- **Vibe coding** — dikembangkan dengan bantuan AI assistant (Antigravity)

---

## 2. TECH STACK

### 2.1 Core

| Layer      | Teknologi           | Versi         | Keterangan                 |
| ---------- | ------------------- | ------------- | -------------------------- |
| Framework  | React Native + Expo | SDK 54 stable | Cross-platform Android/iOS |
| Language   | TypeScript          | ~5.3.3        | Strict mode                |
| Navigation | Expo Router v4      | ~4.0.22       | File-based routing         |
| Database   | expo-sqlite         | ~15.1.4       | SQLite lokal di device     |
| ORM        | Drizzle ORM         | ^0.45.2       | Type-safe queries          |
| ORM Config | drizzle-kit         | ^0.31.10      | Migration tool             |

### 2.2 UI & Styling

| Layer      | Teknologi                    | Versi   | Keterangan                  |
| ---------- | ---------------------------- | ------- | --------------------------- |
| Styling    | NativeWind                   | ^4.2.3  | Tailwind untuk React Native |
| CSS Engine | TailwindCSS                  | ^3.4.19 | Base utility classes        |
| Icons      | @expo/vector-icons           | ~14.0.4 | Ionicons, MaterialIcons     |
| Gesture    | react-native-gesture-handler | ~2.20.2 | Pinch zoom, swipe           |
| Animation  | react-native-reanimated      | ~3.16.1 | Smooth transitions          |

### 2.3 Fitur Khusus

| Fitur        | Teknologi            | Versi    | Keterangan              |
| ------------ | -------------------- | -------- | ----------------------- |
| Peta         | react-native-maps    | 1.18.0   | Google Maps API         |
| Import Excel | xlsx (SheetJS)       | ^0.18.5  | Baca file .xlsx         |
| File Picker  | expo-document-picker | ~13.0.3  | Pilih file dari storage |
| File System  | expo-file-system     | ~18.0.12 | Baca/tulis file lokal   |
| Asset        | expo-asset           | ~11.0.5  | Load file PDF peta      |
| State        | Zustand              | ^5.0.12  | Global state management |

### 2.4 Build & Dev

| Tools           | Keterangan                                                |
| --------------- | --------------------------------------------------------- |
| EAS Build       | Cloud build — digunakan karena keterbatasan Expo Go lokal |
| Antigravity IDE | IDE utama (Pro subscription) — Windows                    |
| VS Code         | Alternatif editor                                         |
| PowerShell      | Terminal di Windows (bukan bash)                          |

---

## 3. STRUKTUR FOLDER

```
D:\pbb-sync\
├── app/                          ← Expo Router (file = route)
│   ├── _layout.tsx               ← Root layout, inisialisasi DB
│   ├── +html.tsx                 ← Web entry (auto-generated)
│   ├── +not-found.tsx            ← 404 screen
│   ├── modal.tsx                 ← Modal screen
│   ├── (tabs)/                   ← Tab navigation group
│   │   ├── _layout.tsx           ← Tab bar config
│   │   ├── index.tsx             ← Tab 1: Dashboard
│   │   ├── peta.tsx              ← Tab 2: Peta Interaktif
│   │   ├── byname.tsx            ← Tab 3: Data Byname
│   │   └── distribusi.tsx        ← Tab 4: Mode Distribusi
│   └── wp/
│       └── [nop].tsx             ← Detail WP (dynamic route)
│
├── src/
│   ├── db/
│   │   ├── schema.ts             ← Definisi tabel Drizzle
│   │   ├── client.ts             ← Koneksi DB + initDatabase()
│   │   └── migrations/           ← Auto-generated migrations
│   ├── services/
│   │   ├── import.service.ts     ← Import Excel → SQLite
│   │   ├── geo.service.ts        ← Georeferencing pixel→GPS
│   │   └── laporan.service.ts    ← Generate ringkasan sesi
│   ├── stores/
│   │   └── app.store.ts          ← Zustand global state
│   └── components/
│       ├── PetaOverlay.tsx       ← Polygon overlay di Maps
│       ├── WPCard.tsx            ← Card item wajib pajak
│       ├── StatusBadge.tsx       ← Badge lunas/belum/exempt
│       └── SearchBar.tsx         ← Komponen search
│
├── assets/
│   ├── maps/                     ← Simpan PDF peta blok
│   │   ├── blok-013.pdf
│   │   ├── blok-014.pdf
│   │   └── blok-015.pdf
│   ├── fonts/
│   └── images/
│
├── drizzle.config.ts             ← Konfigurasi Drizzle ORM
├── tailwind.config.js            ← Konfigurasi TailwindCSS
├── app.json                      ← Konfigurasi Expo
├── package.json
└── tsconfig.json
```

---

## 4. DATABASE SCHEMA

### 4.1 Tabel `wajib_pajak`

Tabel utama — sumber dari file Excel BKAD.

```sql
CREATE TABLE wajib_pajak (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- NOP lengkap: 34.02.070.002.013.0001.0
  nop           TEXT NOT NULL UNIQUE,

  -- Dipecah dari NOP untuk query & link peta
  blok          TEXT NOT NULL,        -- '013' | '014' | '015'
  nomor_petak   TEXT NOT NULL,        -- '0001' dst

  -- Data wajib pajak
  nama_wp       TEXT NOT NULL,
  padukuhan     TEXT,                 -- 'MANDINGAN'
  alamat_objek  TEXT,                 -- alamat fisik tanah
  alamat_wp     TEXT,                 -- domisili pemilik

  -- Ukuran (m²)
  luas_bumi     REAL DEFAULT 0,
  luas_bangunan REAL DEFAULT 0,

  -- Pajak
  jumlah_sppt   REAL DEFAULT 0,
  status_bayar  TEXT DEFAULT 'belum', -- belum | lunas | exempt

  tahun_pajak   TEXT DEFAULT '2026',
  catatan       TEXT,
  created_at    TEXT
);
```

> **Catatan `status_bayar`:**
>
> - `belum` → belum bayar, SPPT > 0
> - `lunas` → sudah konfirmasi bayar (update manual)
> - `exempt` → sawah/bebas pajak Pemda Bantul, SPPT = 0

### 4.2 Tabel `petak_polygon`

Koordinat polygon setiap petak di peta.

```sql
CREATE TABLE petak_polygon (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  blok          TEXT NOT NULL,        -- '013'
  nomor_petak   TEXT NOT NULL,        -- '0001'
  nop           TEXT,                 -- FK ke wajib_pajak.nop

  -- Array koordinat GPS dalam JSON string
  -- Format: '[{"lat":-7.882,"lng":110.331},{"lat":...},...]'
  points        TEXT,

  is_georef     INTEGER DEFAULT 0    -- 0=belum, 1=sudah
);
```

### 4.3 Tabel `georef_config`

Konfigurasi georeferencing per blok (4 titik kontrol).

```sql
CREATE TABLE georef_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  blok            TEXT NOT NULL UNIQUE,  -- '013'

  -- 4 pasangan titik: koordinat pixel PDF <-> koordinat GPS
  -- Format: '[{"px":120,"py":340,"lat":-7.88,"lng":110.33},...]'
  control_points  TEXT,

  -- Dimensi PDF asli (px) untuk kalkulasi transform matrix
  pdf_width       REAL,
  pdf_height      REAL,

  is_ready        INTEGER DEFAULT 0,
  created_at      TEXT
);
```

### 4.4 Tabel `sesi_distribusi`

Header sesi distribusi per hari.

```sql
CREATE TABLE sesi_distribusi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal     TEXT NOT NULL,    -- '2026-03-27'
  blok        TEXT,             -- NULL = semua blok
  catatan     TEXT,
  selesai     INTEGER DEFAULT 0,
  created_at  TEXT
);
```

### 4.5 Tabel `log_distribusi`

Detail per WP dalam satu sesi distribusi.

```sql
CREATE TABLE log_distribusi (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sesi_id   INTEGER NOT NULL,   -- FK ke sesi_distribusi.id
  nop       TEXT NOT NULL,      -- FK ke wajib_pajak.nop
  status    TEXT DEFAULT 'ditemui', -- ditemui | tidak_ada | lain
  waktu     TEXT,               -- '09:15'
  catatan   TEXT
);
```

---

## 5. FORMAT DATA

### 5.1 Format NOP

```
34  . 02  . 070 . 002    . 013  . 0001  . 0
│     │     │     │        │      │       └── Kode objek (0=tanah+bangunan)
│     │     │     │        │      └────────── Nomor petak (4 digit)
│     │     │     │        └───────────────── Nomor blok (3 digit)  ← KUNCI LINK PETA
│     │     │     └────────────────────────── Kode Kalurahan
│     │     └──────────────────────────────── Kode Kecamatan
│     └────────────────────────────────────── Kode Kabupaten (Bantul=02)
└──────────────────────────────────────────── Kode Provinsi (DIY=34)
```

**Parse NOP:**

```typescript
const parts = nop.split(".");
const blok = parts[4]; // '013'
const nomorPetak = parts[5]; // '0001'
```

### 5.2 Format File Excel BKAD

Kolom yang ada di file `DHKP_Pajak_PBB_2026.xlsx`:

| Kolom Excel          | Kolom DB                     | Catatan                             |
| -------------------- | ---------------------------- | ----------------------------------- |
| `NOP`                | `nop`, `blok`, `nomor_petak` | Di-parse otomatis                   |
| `Kapanewon`          | —                            | Tidak disimpan (selalu BANTUL)      |
| `Kalurahan`          | —                            | Tidak disimpan (selalu RINGINHARJO) |
| `Padukuhan`          | `padukuhan`                  |                                     |
| `Tahun Pajak`        | `tahun_pajak`                |                                     |
| `Wajib Pajak`        | `nama_wp`                    |                                     |
| `Alamat Objek`       | `alamat_objek`               | Lokasi fisik tanah                  |
| `Alamat Wajib Pajak` | `alamat_wp`                  | Domisili pemilik                    |
| `Luas Bumi`          | `luas_bumi`                  | m²                                  |
| `Luas Bng`           | `luas_bangunan`              | m²                                  |
| `Jumlah`             | `jumlah_sppt`                | 0 = sawah/bebas pajak               |

### 5.3 Format Koordinat Polygon

```json
[
  { "lat": -7.882134, "lng": 110.331245 },
  { "lat": -7.882089, "lng": 110.331456 },
  { "lat": -7.882312, "lng": 110.331512 },
  { "lat": -7.882356, "lng": 110.331301 }
]
```

### 5.4 Format Control Points Georeferencing

```json
[
  { "px": 120, "py": 45, "lat": -7.8801, "lng": 110.3298 },
  { "px": 892, "py": 45, "lat": -7.8801, "lng": 110.3387 },
  { "px": 892, "py": 756, "lat": -7.8889, "lng": 110.3387 },
  { "px": 120, "py": 756, "lat": -7.8889, "lng": 110.3298 }
]
```

---

## 6. FITUR APLIKASI

### 6.1 Fitur Utama

#### 🗺️ Peta Interaktif + Google Maps Overlay

- Load PDF peta blok sebagai referensi nomor petak
- Polygon setiap petak di-overlay di atas Google Maps Satellite View
- Warna polygon berdasarkan status: hijau=lunas, merah=belum, kuning=exempt
- Tap polygon → popup: nama WP, NOP, luas, SPPT, status
- Pinch zoom & pan

#### 🔍 Search & Filter Wajib Pajak

- Search by nama WP (realtime)
- Search by nomor petak / NOP
- Filter by blok (013 / 014 / 015)
- Filter by status (belum / lunas / exempt)
- Tap item → navigasi ke detail WP

#### 📋 Detail Wajib Pajak

- Info lengkap: NOP, nama, alamat objek, alamat WP
- Luas bumi & bangunan
- Jumlah SPPT & status bayar
- Mini-map: lokasi petak di Google Maps
- Tombol: lihat di peta, catat distribusi

#### 📋 Mode Distribusi

- Buat sesi distribusi per hari + per blok
- Checklist WP: ditemui / tidak ada / lain
- Progress bar real-time per sesi
- Filter: semua / belum dikunjungi / tidak ada

#### 📥 Import Data

- Pilih file Excel (.xlsx) dari storage HP
- Parsing otomatis semua kolom
- Auto-detect sawah bebas pajak (Jumlah = 0 → exempt)
- Conflict handling: NOP duplikat → skip
- Progress bar saat import

### 6.2 Fitur Pintar

#### ⚠️ Fitur Pintar 1 — Deteksi Petak Tanpa Pemilik

Validasi otomatis cross-check antara peta dan byname:

```
Kasus A: Petak di peta ADA, data byname TIDAK ADA
→ Flag: "Petak 013-0025 tidak ada di data byname"

Kasus B: NOP di byname ADA, petak di peta TIDAK ADA
→ Flag: "NOP 013-0087 tidak ada di polygon peta"

Output: Laporan validasi yang bisa diekspor
```

**Kapan dipakai:** Tepat setelah menerima softfile dari BKAD, sebelum distribusi dimulai.

#### 📊 Fitur Pintar 2 — Ringkasan Otomatis per Sesi

Auto-generate rekap setiap akhir sesi distribusi:

```
Sesi: Blok 013 · 27 Maret 2026

✅ Ditemui       : 45 WP
❌ Tidak ada     : 8 WP
📝 Total SPPT    : Rp 2.847.200
📍 Progress blok : 53 / 99 petak (54%)

Daftar tidak ada di tempat:
- NURHIDAYATI (013-0004.0) · RT 004
- NAWAWI (013-0005.0) · RT 004
- ...
```

---

## 7. ARSITEKTUR TEKNIS PETA

### 7.1 Konsep Georeferencing

PDF Peta Blok PBB dari BKAD bersifat **vector** (bukan scan), dihasilkan langsung dari sistem digital. Ini memungkinkan:

1. **Georeferencing sekali per blok** — cukup 4 titik sudut
2. **Affine transformation** — konversi koordinat pixel → GPS
3. **Semua polygon otomatis presisi** setelah georef dilakukan

```
Pixel PDF (x, y)  →  Affine Transform Matrix  →  GPS (lat, lng)
     ↑                        ↑                        ↓
Koordinat petak         4 titik kontrol          Overlay di Maps
di gambar PDF         pixel ↔ GPS pair          dengan presisi
```

### 7.2 Alur Georeferencing (Sprint 4-5)

```
1. Buka PDF blok di app (react-native-pdf)
2. User tap 4 titik sudut di PDF
3. User input koordinat GPS untuk masing-masing titik
   (ambil dari Google Maps → tap lokasi → copy lat,lng)
4. App hitung affine transform matrix
5. Apply ke semua polygon petak dalam blok
6. Polygon muncul presisi di Google Maps
7. Simpan config ke tabel georef_config
```

**Estimasi waktu georef:** ~15 menit per blok × 3 blok = ~45 menit total (sekali setup, permanent)

### 7.3 Layer Stack Peta

```
Layer 3 (atas)  : Popup data WP (saat polygon di-tap)
Layer 2 (tengah): Polygon overlay (react-native-maps Polygon)
Layer 1 (bawah) : Google Maps Satellite View (react-native-maps)
```

---

## 8. PALET WARNA & DESAIN

### 8.1 Warna Brand

```
--c1-darkest  : #0F2D38   ← Header, primary button, teks utama
--c2-dark     : #1A4A5A   ← Card background dark
--c3-mid      : #2E6E82   ← Secondary elements
--c4-light    : #4A90A8   ← Aksen sekunder
--c5-lightest : #5C8EB2   ← Highlight, link

--accent-gold : #F0A500   ← Selected polygon, warning
--accent-green: #2EC97E   ← Lunas, success, progress
--danger-red  : #E85454   ← Belum bayar, error, delete

--bg-page     : #F0F4F7   ← Background layar
--bg-card     : #FFFFFF   ← Card background
--bg-subtle   : #F7F9FB   ← Subtle background
--border      : #E8EDF2   ← Border, divider
--text-main   : #1A2B35   ← Teks utama
--text-sub    : #4A6070   ← Teks sekunder
--text-muted  : #B0BEC8   ← Teks placeholder
```

### 8.2 Status Polygon Peta

```
Lunas   → border: #2EC97E, fill: rgba(46,201,126,0.3)  ← hijau
Belum   → border: #E85454, fill: rgba(232,84,84,0.3)   ← merah
Exempt  → border: #F0A500, fill: rgba(240,165,0,0.2)   ← kuning (sawah)
Selected→ border: #F0A500, fill: rgba(240,165,0,0.4), borderWidth: 3
```

### 8.3 Tipografi

```
Font utama  : Plus Jakarta Sans (700, 800 untuk heading)
Font body   : DM Sans (400, 500 untuk teks biasa)
Font mono   : Courier (untuk NOP, kode)
```

---

## 9. SPRINT PLAN

### Ringkasan Sprint

| Sprint | Nama                        | Output                   | Status      |
| ------ | --------------------------- | ------------------------ | ----------- |
| 0      | Setup Project               | Project jalan di EAS     | ✅ Selesai  |
| 1      | Database Schema             | DB siap, tabel terbuat   | ✅ Selesai  |
| 2      | Import Excel                | Data Excel masuk DB      | 🔵 Active   |
| 3      | List & Search WP            | Layar byname + search    | ⬜ Upcoming |
| 4      | PDF Viewer + Georef         | Tampil PDF + tool georef | ⬜ Upcoming |
| 5      | Google Maps + Polygon       | Overlay polygon di Maps  | ⬜ Upcoming |
| 6      | Tap Petak → Detail          | Popup + navigasi detail  | ⬜ Upcoming |
| 7      | Deteksi Petak Tanpa Pemilik | Fitur validasi data      | ⬜ Upcoming |
| 8      | Mode Distribusi             | Checklist distribusi     | ⬜ Upcoming |
| 9      | Ringkasan Sesi              | Auto-generate rekap      | ⬜ Upcoming |
| 10     | Polish + Dashboard          | UI final + dashboard     | ⬜ Upcoming |

### Aturan Sprint

1. **1 sprint = 1 fitur bisa jalan** — tidak ada sprint yang setengah jadi
2. **Sprint pendek** — maksimal 2-3 file baru per sprint
3. **Test dulu** sebelum lanjut sprint berikutnya
4. **Kalau error** — debug dulu, jangan lanjut
5. **Format dokumen** — setiap sprint dalam file `.md` terpisah

---

## 10. LAYAR APLIKASI

### 10.1 Tab Navigation

```
Bottom Tab Bar:
┌──────────┬──────────┬──────────┬──────────┐
│  🏠       │  🗺️       │  👥       │  📋       │
│ Dashboard │  Peta    │ Byname   │Distribusi│
└──────────┴──────────┴──────────┴──────────┘
```

### 10.2 Stack Screens (di luar tab)

```
/wp/[nop]        → Detail lengkap satu wajib pajak
/modal           → Modal umum (konfirmasi, info)
```

### 10.3 Dashboard (Tab 1 — `app/(tabs)/index.tsx`)

```
┌─────────────────────────────┐
│  PBB Sync          Tahun 2026│  ← Header gelap #0F2D38
├─────────────────────────────┤
│  📊 Statistik               │
│  ┌───────┬───────┬───────┐  │
│  │ Total │Blok013│Blok014│  │
│  │  757  │  250  │  280  │  │
│  ├───────┼───────┼───────┤  │
│  │Blok015│Sawah  │Belum  │  │
│  │  227  │  180  │  577  │  │
│  └───────┴───────┴───────┘  │
│  Progress: ████░░░░ 41%     │
├─────────────────────────────┤
│  [📥 Import Excel Byname]   │  ← Primary button
│  [🗑 Reset Data]            │  ← Danger button (muncul jika ada data)
└─────────────────────────────┘
```

### 10.4 Peta Interaktif (Tab 2 — `app/(tabs)/peta.tsx`)

```
┌─────────────────────────────┐
│  🗺️ Peta  [Blok 013▾][🛰️]  │  ← Header + selector
├─────────────────────────────┤
│                             │
│   [Google Maps Satellite]   │  ← react-native-maps
│   + Polygon overlay         │  ← Drizzle query → polygon
│   + Warna status            │
│                             │
│  [Popup saat tap petak]     │
│  NOP: 013-0014.0            │
│  PRADANA SEPTALIANA         │
│  1.271 m² · Rp 67.512       │
│  [⏳ Belum Bayar]           │
├─────────────────────────────┤
│  🔍 Cari nama / nomor petak │
│  [Semua][Belum][Lunas][Sawah│
└─────────────────────────────┘
```

### 10.5 Data Byname (Tab 3 — `app/(tabs)/byname.tsx`)

```
┌─────────────────────────────┐
│  👥 Data Wajib Pajak        │  ← Header gelap
│  [🔍 Cari nama WP...]       │
├─────────────────────────────┤
│  [Semua(757)][Blok013][014] │  ← Filter tabs
├─────────────────────────────┤
│  ▌ ATEMO REJO               │  ← Garis kiri hijau = lunas
│    013-0001.0 · RT 004      │
│                  Rp 46.400  │
│─────────────────────────────│
│  ▌ NURHIDAYATI              │  ← Garis kiri merah = belum
│    013-0004.0 · RT 004      │
│                  Rp 53.773  │
│─────────────────────────────│
│  ▌ NAWAWI (sawah)           │  ← Garis kiri kuning = exempt
│    013-0005.0 · RT 004      │
│                      Rp 0   │
└─────────────────────────────┘
```

### 10.6 Detail WP (`app/wp/[nop].tsx`)

```
┌─────────────────────────────┐
│  ← Kembali                  │  ← Header gelap
│  PRADANA SEPTALIANA         │
│  NOP: 34.02.070.002.013.0014│
│  [⏳ Belum Bayar 2026]      │
├─────────────────────────────┤
│  [Mini Map - Google Maps]   │  ← Lokasi petak
│  [📍 Lihat di Peta]         │
├─────────────────────────────┤
│  💰 Rp 67.512               │  ← SPPT amount card
│     Tahun Pajak 2026        │
├─────────────────────────────┤
│  Data Objek Pajak           │
│  Blok/Petak : 013 / 0014    │
│  Luas Bumi  : 1.271 m²      │
│  Luas Bgn   : 0 m²          │
│  Padukuhan  : Mandingan     │
│  RT/RW      : 005 / 000     │
├─────────────────────────────┤
│  [📍 Tandai Sudah Ditemui]  │
│  [✓ Catat Pembayaran]       │
│  [🗺️ Lihat di Peta]         │
└─────────────────────────────┘
```

### 10.7 Mode Distribusi (Tab 4 — `app/(tabs)/distribusi.tsx`)

```
┌─────────────────────────────┐
│  📋 Mode Distribusi         │  ← Header gelap
│  Blok 014 · 27 Mar 2026     │
├─────────────────────────────┤
│  Progress: ██████░░ 62%     │
│  ✅174  ❌88  ⚠️18           │
├─────────────────────────────┤
│  [✓] ATEMO REJO    09:15 ✓ │
│  [!] NURHIDAYATI  Tidak ada │
│  [ ] PRADANA SEP.  Belum    │
│  [ ] MARMANTO      Belum    │
└─────────────────────────────┘
```

---

## 11. ALUR KERJA SISTEM

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  File Excel  │    │  PDF Peta   │    │ Google Maps │
│  dari BKAD  │    │  Blok PBB   │    │  Satellite  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  │
┌─────────────┐    ┌─────────────┐           │
│Import Excel │    │Georef Setup │           │
│→ Parse NOP  │    │4 titik/blok │           │
│→ SQLite DB  │    │→ Transform  │           │
└──────┬──────┘    └──────┬──────┘           │
       │                  │                  │
       ▼                  ▼                  │
┌─────────────────────────────┐              │
│         SQLite Local DB      │              │
│  wajib_pajak | petak_polygon │              │
│  georef_config | sesi_dist   │              │
└──────────────┬──────────────┘              │
               │                             │
               ▼                             ▼
┌─────────────────────────────────────────────┐
│              Aplikasi PBB Sync               │
│  Dashboard | Peta | Byname | Distribusi      │
└─────────────────────────────────────────────┘
```

---

## 12. CATATAN PENTING UNTUK AI ASSISTANT

### Yang HARUS selalu diingat:

1. **PowerShell, bukan bash** — user memakai Windows. Semua command harus PowerShell-compatible. Tidak ada `grep`, `cat` tidak untuk binary, gunakan `Get-Content` atau langsung buka di IDE.

2. **EAS Build, bukan Expo Go** — sejak Sprint 1, build menggunakan EAS Cloud karena versi Expo Go tidak kompatibel. Setiap ada native package baru, perlu trigger EAS build baru.

3. **SDK 54 stable** — versi `expo: "~54.0.15"`. Jangan rekomendasikan package yang tidak kompatibel dengan SDK 54.

4. **Sprint pendek** — maksimal 2-3 file baru per sprint. Jangan generate code panjang dalam satu sprint karena akan kena limit Antigravity 7 hari.

5. **Format dokumen sprint** — setiap sprint dalam file `.md` terpisah dengan checklist yang jelas.

6. **Vibe coding** — user menggunakan metodologi vibe coding dengan AI assistant. Jelaskan setiap keputusan teknis dengan singkat dan jelas.

7. **Data Excel BKAD** — format kolom sudah diketahui, jangan ubah nama kolom di parser. NOP menggunakan titik (`.`) sebagai separator, bukan strip.

8. **Sawah bebas pajak** — `jumlah_sppt = 0` bukan error, itu kebijakan Pemda Bantul. Status = `exempt`, tampilkan dengan warna kuning/amber.

9. **Blok 013, 014, 015** — hanya 3 blok ini yang relevan untuk wilayah distribusi user. Filter selalu ke 3 blok ini.

10. **Koordinat polygon** — simpan dalam format JSON string di kolom `points`. Koordinat dalam lat/lng (GPS), bukan pixel.

---

_Blueprint ini adalah dokumen hidup — update setiap ada perubahan desain atau keputusan teknis._
