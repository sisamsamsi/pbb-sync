# 🤖 Prompt Antigravity — Deteksi & Perbaikan Path Bocor PDF PBB Sync

---

## KONTEKS PROJECT

Saya sedang mengembangkan aplikasi mobile **PBB Sync** menggunakan React Native + Expo SDK 54 untuk distribusi SPPT PBB-P2 di Kalurahan Ringinharjo, Kapanewon Bantul, Kabupaten Bantul, DIY.

Salah satu komponen penting aplikasi ini adalah **overlay polygon petak tanah** di atas Google Maps. Data polygon diambil dari file PDF peta blok PBB yang diterbitkan oleh BKPPAD Bantul.

---

## KONDISI SAAT INI

File PDF: `070002.pdf` (20 halaman, format vector — bukan scan)

Saya sudah membuat script Python menggunakan **PyMuPDF (fitz)** untuk mengekstrak koordinat polygon dari PDF tersebut. Script berhasil mengekstrak:

- Blok 013: **242 polygon** dari ~324 WP
- Blok 014: **249 polygon** dari ~328 WP
- Blok 015: **127 polygon** dari ~195 WP
- **Total: 618 dari 847** wajib pajak (~73%)

Sisanya **~229 polygon tidak bisa diekstrak** karena path di PDF **tidak menyambung sempurna (bocor / unclosed path)**. Script saat ini hanya mengambil closed path, sehingga path yang hampir closed (gap kecil) ikut terbuang.

---

## ROOT CAUSE TEKNIS

PDF vector menyimpan setiap garis batas petak sebagai **path object**. Agar bisa dijadikan polygon, path harus **closed** (titik akhir menyambung ke titik awal).

Masalah yang ditemukan:
```
Path normal (closed):
  M 120 45 L 180 45 L 180 90 L 120 90 Z   ← 'Z' = close path

Path bocor (unclosed):
  M 120 45 L 180 45 L 180 90 L 120 91.3   ← tidak ada 'Z'
  Gap antara titik akhir (120, 91.3) dan titik awal (120, 45)
  bisa sangat kecil (< 1pt) atau agak besar (5-20pt)
```

Kemungkinan penyebab:
1. Gap kecil < 2pt → hampir closed, perlu toleransi snap
2. Gap sedang 2-20pt → perlu close otomatis
3. Path terpotong atau multi-segment → perlu join path dulu

---

## SCRIPT PYTHON SAAT INI

Lokasi script: `D:\pbb-tools\extract_polygons.py`
Lokasi config georef: `D:\pbb-tools\georef_config.json`
Lokasi output: `D:\pbb-tools\output\polygons_013.json` dst.

```python
# Bagian krusial yang saat ini strict (hanya closed path):
for drawing in drawings:
    items = drawing.get("items", [])
    pts = []
    for item in items:
        kind = item[0]
        if kind == "l":
            pts.append((item[1].x, item[1].y))
            pts.append((item[2].x, item[2].y))
        elif kind == "c":
            pts.append((item[1].x, item[1].y))
            pts.append((item[4].x, item[4].y))

    # Saat ini: langsung hitung area, tidak ada pengecekan closed/unclosed
    # Polygon bocor ikut dibuang karena area tidak valid atau tidak match
```

---

## TUGAS YANG DIMINTA

Saya butuh bantuan untuk **3 hal secara berurutan**:

---

### TUGAS 1 — Script Diagnosis (Prioritas Pertama)

Buat script Python terpisah bernama `diagnose_paths.py` yang:

1. Baca file `070002.pdf` dengan PyMuPDF
2. Proses halaman 12, 13, 14 (0-indexed = Blok 013, 014, 015)
3. Untuk setiap drawing/path di halaman tersebut:
   - Deteksi apakah path **closed** atau **unclosed**
   - Kalau unclosed: hitung **jarak gap** antara titik pertama dan titik terakhir
   - Kategorikan: `tiny_gap` (< 2pt), `small_gap` (2-10pt), `medium_gap` (10-50pt), `large_gap` (> 50pt)
4. Coba match nomor petak (teks di dalam area path) ke path tersebut
5. Output ke file `diagnosis_report.json`:

```json
{
  "blok_013": {
    "page_index": 12,
    "total_drawings": 312,
    "closed_paths": 242,
    "unclosed_paths": 89,
    "by_gap_category": {
      "tiny_gap": 45,
      "small_gap": 30,
      "medium_gap": 10,
      "large_gap": 4
    },
    "unclosed_details": [
      {
        "nomor_petak": "0025",
        "gap_distance": 1.23,
        "category": "tiny_gap",
        "first_point": [120.5, 45.2],
        "last_point": [120.5, 46.4],
        "point_count": 6
      }
    ]
  }
}
```

---

### TUGAS 2 — Update Script Ekstraksi dengan Toleransi Gap

Update `extract_polygons.py` dengan menambahkan logika:

1. **Auto-close tiny gap** (< 2pt): langsung sambungkan titik terakhir ke titik pertama
2. **Auto-close small gap** (2-10pt): sambungkan dengan interpolasi linear
3. **Medium gap** (10-50pt): coba close tapi tandai sebagai `needs_review: true` di output JSON
4. **Large gap** (> 50pt): skip seperti sebelumnya (kemungkinan bukan petak)

Output JSON per polygon harus ditambah field:
```json
{
  "blok": "013",
  "nomor_petak": "0025",
  "nop": "34.02.070.002.013.0025.0",
  "points": [...],
  "point_count": 6,
  "was_closed": false,
  "gap_distance": 1.23,
  "gap_category": "tiny_gap",
  "needs_review": false
}
```

---

### TUGAS 3 — Script Perbaikan PDF (Opsional, Jika Tugas 2 Belum Cukup)

Kalau setelah Tugas 2 masih ada banyak yang tidak ter-ekstrak, buat script `fix_pdf_paths.py` yang:

1. Baca `070002.pdf`
2. Untuk setiap halaman yang diproses (12, 13, 14):
   - Temukan semua unclosed path dengan gap < 50pt
   - Tambahkan perintah `closepath` ke path tersebut
   - **Jangan ubah koordinat apapun** — hanya tutup path
3. Export sebagai `070002_fixed.pdf`
4. Script ini hanya menggunakan PyMuPDF — tidak perlu library lain

> ⚠️ Catatan penting: Jangan gunakan Inkscape atau tools eksternal lain. Semua proses harus bisa dijalankan via Python di command line Windows (PowerShell).

---

## ENVIRONMENT

- OS: Windows, PowerShell
- Python sudah terinstall, PyMuPDF sudah terinstall (`pip install pymupdf`)
- File PDF ada di: `D:\pbb-tools\070002.pdf`
- Semua output simpan di: `D:\pbb-tools\output\`
- Jangan gunakan bash syntax — gunakan path Windows

---

## FORMAT OUTPUT YANG DIHARAPKAN

1. **Jalankan Tugas 1 dulu** → lihat `diagnosis_report.json`
2. Share ringkasan: berapa yang tiny_gap, small_gap, dst.
3. Baru lanjut Tugas 2 berdasarkan data aktual dari diagnosis
4. Evaluasi hasil: apakah polygon bertambah signifikan?
5. Kalau perlu, lanjut Tugas 3

---

## REFERENSI KODE

### Format output JSON yang sudah ada (polygons_013.json):
```json
[
  {
    "blok": "013",
    "nomor_petak": "0001",
    "nop": "34.02.070.002.013.0001.0",
    "points": [
      {"lat": -7.9121, "lng": 110.3298},
      {"lat": -7.9121, "lng": 110.3312},
      {"lat": -7.9135, "lng": 110.3312},
      {"lat": -7.9135, "lng": 110.3298}
    ],
    "point_count": 4
  }
]
```

### Format georef_config.json (untuk referensi transform):
```json
{
  "013": {
    "page": 12,
    "control_points": [
      {"px": 72.0, "py": 48.0, "lat": -7.9121, "lng": 110.3298},
      {"px": 769.0, "py": 48.0, "lat": -7.9121, "lng": 110.3412},
      {"px": 769.0, "py": 547.0, "lat": -7.9235, "lng": 110.3412},
      {"px": 72.0, "py": 547.0, "lat": -7.9235, "lng": 110.3298}
    ]
  }
}
```

---

## CATATAN TAMBAHAN

- Nomor petak `0` (nol) adalah jalan/fasum — skip, tidak perlu polygon
- Polygon yang valid minimal 3 titik unik
- Area polygon minimum: 100 sq pt (untuk filter noise)
- Area polygon maksimum: 30% dari luas halaman (untuk filter border/frame halaman)
- Koordinat output harus dalam format lat/lng GPS (bukan pixel)
- Semua pemrosesan harus berjalan di laptop — bukan di HP/app

---

*Prompt ini dibuat untuk sesi kerja fokus pada perbaikan ekstraksi polygon PDF PBB Sync.*
*Setelah tugas selesai, output JSON diimport ke aplikasi via tombol "Import Polygon JSON" di Dashboard.*
