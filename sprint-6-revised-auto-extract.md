# Sprint 6 (Revised) — Ekstrak Polygon Otomatis dari PDF

**Project:** PBB Sync  
**Sprint:** 6 dari 10  
**Estimasi:** 1 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 5 selesai ✅  
**Platform:** Laptop (Python) + App (import JSON)

---

## 🎯 Tujuan Sprint Ini

Mengekstrak semua polygon petak dari PDF vector secara otomatis:
1. **Script Python di laptop** → baca PDF → extract semua path/polygon → georeference → export JSON
2. **Import JSON ke app** → semua petak langsung muncul di Google Maps sekaligus

**Hasil akhir sprint ini:** 847 polygon petak langsung tampil di Maps tanpa gambar manual satu per satu.

---

## 🧠 Konsep Teknis

```
PDF Vector (070002.pdf)
    │
    │  PyMuPDF extract paths
    ▼
Koordinat pixel PDF per petak
(misal: [(120,45), (180,45), (180,90), (120,90)])
    │
    │  Affine Transform (4 titik kontrol)
    │  pixel ↔ GPS
    ▼
Koordinat GPS per petak
(misal: [(-7.881,110.331), (-7.881,110.338), ...])
    │
    │  Export JSON
    ▼
polygons_013.json / polygons_014.json / polygons_015.json
    │
    │  Import ke app
    ▼
Tabel petak_polygon di SQLite ✅
```

---

## 📦 Persiapan Laptop

Install Python library yang dibutuhkan:

```bash
pip install pymupdf
```

> `pymupdf` adalah library untuk baca PDF vector. Package-nya bernama `pymupdf` tapi di-import sebagai `fitz`.

Verifikasi install:
```bash
python -c "import fitz; print(fitz.__version__)"
```

---

## 📁 Struktur Kerja di Laptop

```
D:\pbb-tools\               ← buat folder baru di laptop
├── 070002.pdf              ← copy file PDF peta blok
├── extract_polygons.py     ← BUAT BARU (script utama)
├── georef_config.json      ← BUAT MANUAL (titik kontrol GPS)
└── output\
    ├── polygons_013.json   ← hasil export blok 013
    ├── polygons_014.json   ← hasil export blok 014
    └── polygons_015.json   ← hasil export blok 015
```

---

## 📄 Step 1 — Buat `georef_config.json`

File ini berisi **4 titik kontrol** per blok — pasangan koordinat pixel PDF ↔ GPS.

### Cara mendapatkan 4 titik kontrol:

**Untuk koordinat pixel PDF:**
```python
# Jalankan script kecil ini dulu untuk lihat ukuran halaman PDF
import fitz
doc = fitz.open("070002.pdf")
page = doc[12]  # halaman 13 = blok 013 (0-indexed)
print(f"Page size: {page.rect}")
# Output contoh: Rect(0.0, 0.0, 841.89, 595.28)
# Artinya: width=841.89 pt, height=595.28 pt
```

**Untuk koordinat GPS:**
1. Buka Google Maps di browser
2. Zoom ke area Mandingan, Ringinharjo, Bantul
3. Cari 4 titik sudut yang bisa dikenali di PDF dan Maps
   - Bisa berupa: perempatan jalan, pojok area blok, sudut sawah besar
4. Klik kanan di Maps → "What's here?" → catat lat,lng

**Format `georef_config.json`:**

```json
{
  "013": {
    "page": 12,
    "pdf_width": 841.89,
    "pdf_height": 595.28,
    "control_points": [
      {
        "comment": "Sudut kiri atas blok 013",
        "px": 72.0,
        "py": 48.0,
        "lat": -7.9121,
        "lng": 110.3298
      },
      {
        "comment": "Sudut kanan atas blok 013",
        "px": 769.0,
        "py": 48.0,
        "lat": -7.9121,
        "lng": 110.3412
      },
      {
        "comment": "Sudut kanan bawah blok 013",
        "px": 769.0,
        "py": 547.0,
        "lat": -7.9235,
        "lng": 110.3412
      },
      {
        "comment": "Sudut kiri bawah blok 013",
        "px": 72.0,
        "py": 547.0,
        "lat": -7.9235,
        "lng": 110.3298
      }
    ]
  },
  "014": {
    "page": 13,
    "pdf_width": 841.89,
    "pdf_height": 595.28,
    "control_points": [
      { "comment": "Sudut kiri atas blok 014",  "px": 72.0,  "py": 48.0,  "lat": -7.9180, "lng": 110.3301 },
      { "comment": "Sudut kanan atas blok 014", "px": 769.0, "py": 48.0,  "lat": -7.9180, "lng": 110.3415 },
      { "comment": "Sudut kanan bawah blok 014","px": 769.0, "py": 547.0, "lat": -7.9294, "lng": 110.3415 },
      { "comment": "Sudut kiri bawah blok 014", "px": 72.0,  "py": 547.0, "lat": -7.9294, "lng": 110.3301 }
    ]
  },
  "015": {
    "page": 14,
    "pdf_width": 841.89,
    "pdf_height": 595.28,
    "control_points": [
      { "comment": "Sudut kiri atas blok 015",  "px": 72.0,  "py": 48.0,  "lat": -7.9239, "lng": 110.3304 },
      { "comment": "Sudut kanan atas blok 015", "px": 769.0, "py": 48.0,  "lat": -7.9239, "lng": 110.3418 },
      { "comment": "Sudut kanan bawah blok 015","px": 769.0, "py": 547.0, "lat": -7.9353, "lng": 110.3418 },
      { "comment": "Sudut kiri bawah blok 015", "px": 72.0,  "py": 547.0, "lat": -7.9353, "lng": 110.3304 }
    ]
  }
}
```

> ⚠️ **Koordinat di atas adalah estimasi kasar.** Kamu WAJIB menggantinya dengan koordinat GPS yang kamu ambil sendiri dari Google Maps. Akurasi polygon sangat bergantung pada ketelitian 4 titik kontrol ini.

---

## 📄 Step 2 — Buat `extract_polygons.py`

```python
import fitz
import json
import os
import math

# ── Load konfigurasi georef
with open("georef_config.json", "r") as f:
    GEOREF = json.load(f)

# ── Kalkulasi affine transform matrix dari 4 titik kontrol
def calc_matrix(control_points):
    p = control_points
    # Gunakan 3 titik pertama untuk affine transform
    p0, p1, p2 = p[0], p[1], p[2]

    dx1 = p1["px"] - p0["px"]
    dy1 = p1["py"] - p0["py"]
    dx2 = p2["px"] - p0["px"]
    dy2 = p2["py"] - p0["py"]

    dLat1 = p1["lat"] - p0["lat"]
    dLng1 = p1["lng"] - p0["lng"]
    dLat2 = p2["lat"] - p0["lat"]
    dLng2 = p2["lng"] - p0["lng"]

    det = dx1 * dy2 - dx2 * dy1
    if abs(det) < 1e-10:
        print("ERROR: titik kontrol terlalu dekat / collinear")
        return None

    a = (dLat1 * dy2 - dLat2 * dy1) / det
    b = (dx1 * dLat2 - dx2 * dLat1) / det
    c = p0["lat"] - a * p0["px"] - b * p0["py"]

    d = (dLng1 * dy2 - dLng2 * dy1) / det
    e = (dx1 * dLng2 - dx2 * dLng1) / det
    f = p0["lng"] - d * p0["px"] - e * p0["py"]

    return {"a": a, "b": b, "c": c, "d": d, "e": e, "f": f}

# ── Konversi pixel → GPS
def pixel_to_gps(px, py, matrix):
    lat = matrix["a"] * px + matrix["b"] * py + matrix["c"]
    lng = matrix["d"] * px + matrix["e"] * py + matrix["f"]
    return {"lat": round(lat, 7), "lng": round(lng, 7)}

# ── Hitung centroid polygon
def centroid(points):
    lat = sum(p["lat"] for p in points) / len(points)
    lng = sum(p["lng"] for p in points) / len(points)
    return lat, lng

# ── Cek apakah titik ada di dalam polygon (Ray Casting)
def point_in_polygon(px, py, polygon_pts):
    inside = False
    n = len(polygon_pts)
    j = n - 1
    for i in range(n):
        xi, yi = polygon_pts[i]
        xj, yj = polygon_pts[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

# ── Proses satu blok
def process_blok(blok_num, doc, config):
    page_idx  = config["page"]      # 0-indexed
    ctrl_pts  = config["control_points"]
    matrix    = calc_matrix(ctrl_pts)

    if not matrix:
        print(f"  ✗ Gagal kalkulasi matrix untuk blok {blok_num}")
        return []

    page = doc[page_idx]
    print(f"\n=== Blok {blok_num} — Halaman {page_idx + 1} ===")
    print(f"  Page rect: {page.rect}")

    # ── Extract semua path/drawing dari halaman
    drawings = page.get_drawings()
    print(f"  Total drawings: {len(drawings)}")

    # ── Extract text dengan posisi (untuk nomor petak)
    text_blocks = page.get_text("dict")["blocks"]
    texts = []
    for block in text_blocks:
        if block.get("type") == 0:  # type 0 = text
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span["text"].strip()
                    if txt and txt.isdigit():  # hanya nomor
                        bbox = span["bbox"]
                        cx = (bbox[0] + bbox[2]) / 2
                        cy = (bbox[1] + bbox[3]) / 2
                        texts.append({
                            "nomor": txt.zfill(4),  # padding jadi 4 digit
                            "cx": cx,
                            "cy": cy,
                        })

    print(f"  Total nomor petak ditemukan: {len(texts)}")

    # ── Filter drawing yang merupakan polygon petak
    # Polygon petak biasanya: closed path, area cukup besar, fill putih/transparan
    polygons = []
    for drawing in drawings:
        items = drawing.get("items", [])
        if not items:
            continue

        # Kumpulkan semua titik dari path
        pts = []
        for item in items:
            kind = item[0]
            if kind == "l":   # line: item = ("l", p1, p2)
                pts.append((item[1].x, item[1].y))
                pts.append((item[2].x, item[2].y))
            elif kind == "c": # curve: item = ("c", p1, p2, p3, p4)
                pts.append((item[1].x, item[1].y))
                pts.append((item[4].x, item[4].y))
            elif kind == "re": # rect: item = ("re", rect, ...)
                r = item[1]
                pts = [(r.x0, r.y0), (r.x1, r.y0),
                       (r.x1, r.y1), (r.x0, r.y1)]

        if len(pts) < 3:
            continue

        # Hitung area (shoelace formula)
        n = len(pts)
        area = 0
        for i in range(n):
            j = (i + 1) % n
            area += pts[i][0] * pts[j][1]
            area -= pts[j][0] * pts[i][1]
        area = abs(area) / 2

        # Skip polygon terlalu kecil (noise) atau terlalu besar (border halaman)
        page_area = page.rect.width * page.rect.height
        if area < 100 or area > page_area * 0.3:
            continue

        # Hitung centroid pixel polygon
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)

        polygons.append({
            "pts_px": pts,
            "cx": cx,
            "cy": cy,
            "area": area,
        })

    print(f"  Polygon valid: {len(polygons)}")

    # ── Match setiap nomor teks ke polygon yang mengandungnya
    results = []
    unmatched_text = []

    for text_item in texts:
        tx, ty = text_item["cx"], text_item["cy"]
        matched = None

        for poly in polygons:
            if point_in_polygon(tx, ty, poly["pts_px"]):
                matched = poly
                break

        if matched:
            # Konversi semua titik pixel → GPS
            gps_points = [
                pixel_to_gps(px, py, matrix)
                for px, py in matched["pts_px"]
            ]

            # Deduplicate titik yang sama persis
            seen = set()
            unique_pts = []
            for pt in gps_points:
                key = (pt["lat"], pt["lng"])
                if key not in seen:
                    seen.add(key)
                    unique_pts.append(pt)

            if len(unique_pts) >= 3:
                results.append({
                    "blok":        blok_num,
                    "nomor_petak": text_item["nomor"],
                    "nop":         f"34.02.070.002.{blok_num}.{text_item['nomor']}.0",
                    "points":      unique_pts,
                    "point_count": len(unique_pts),
                })
        else:
            unmatched_text.append(text_item["nomor"])

    print(f"  Berhasil di-match: {len(results)}")
    if unmatched_text:
        print(f"  Tidak ter-match: {unmatched_text[:10]}{'...' if len(unmatched_text) > 10 else ''}")

    return results

# ── MAIN
def main():
    os.makedirs("output", exist_ok=True)

    doc = fitz.open("070002.pdf")
    print(f"PDF: {doc.page_count} halaman")

    total_all = 0

    for blok_num in ["013", "014", "015"]:
        if blok_num not in GEOREF:
            print(f"Skip blok {blok_num} — tidak ada di georef_config.json")
            continue

        config  = GEOREF[blok_num]
        results = process_blok(blok_num, doc, config)

        if results:
            out_file = f"output/polygons_{blok_num}.json"
            with open(out_file, "w") as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"  ✅ Tersimpan: {out_file} ({len(results)} polygon)")
            total_all += len(results)
        else:
            print(f"  ⚠️  Tidak ada polygon untuk blok {blok_num}")

    doc.close()
    print(f"\n{'='*40}")
    print(f"TOTAL POLYGON BERHASIL: {total_all}")
    print(f"Output ada di folder: output/")

if __name__ == "__main__":
    main()
```

---

## 📄 Step 3 — Jalankan Script

```bash
cd D:\pbb-tools
python extract_polygons.py
```

Output yang diharapkan:
```
PDF: 20 halaman

=== Blok 013 — Halaman 13 ===
  Page rect: Rect(0.0, 0.0, 841.89, 595.28)
  Total drawings: 312
  Total nomor petak ditemukan: 280
  Polygon valid: 270
  Berhasil di-match: 265
  Tidak ter-match: ['0000', '0000']...
  ✅ Tersimpan: output/polygons_013.json (265 polygon)

=== Blok 014 — Halaman 14 ===
  ...
  ✅ Tersimpan: output/polygons_014.json (...)

=== Blok 015 — Halaman 15 ===
  ...
  ✅ Tersimpan: output/polygons_015.json (...)

========================================
TOTAL POLYGON BERHASIL: ~750+
```

---

## 📄 Step 4 — Tambah Import JSON ke App

### Tambah di `src/services/import.service.ts`

```typescript
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { db } from '../db/client'
import { petakPolygon } from '../db/schema'

// ── Tipe data JSON hasil ekstraksi laptop
interface PolygonRecord {
  blok: string
  nomor_petak: string
  nop: string
  points: Array<{ lat: number; lng: number }>
  point_count: number
}

// ── Import JSON polygon dari file picker
export const importPolygonJson = async (
  onProgress?: (current: number, total: number) => void
): Promise<{ imported: number; skipped: number; errors: string[] }> => {
  const result = { imported: 0, skipped: 0, errors: [] as string[] }

  try {
    // Pilih file JSON
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    })

    if (picked.canceled || !picked.assets?.[0]) return result

    const content = await FileSystem.readAsStringAsync(picked.assets[0].uri)
    const records: PolygonRecord[] = JSON.parse(content)

    result.imported = 0

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      onProgress?.(i + 1, records.length)

      try {
        await db
          .insert(petakPolygon)
          .values({
            blok:        rec.blok,
            nomorPetak:  rec.nomor_petak,
            nop:         rec.nop,
            points:      JSON.stringify(rec.points),
            isGeoref:    true,
          })
          .onConflictDoNothing()

        result.imported++
      } catch (e) {
        result.errors.push(`${rec.nop}: ${String(e)}`)
        result.skipped++
      }
    }

    return result
  } catch (e) {
    result.errors.push(String(e))
    return result
  }
}

// ── Hitung statistik polygon
export const getPolygonStats = async () => {
  const all = await db.select().from(petakPolygon)
  return {
    total:   all.length,
    blok013: all.filter(p => p.blok === '013').length,
    blok014: all.filter(p => p.blok === '014').length,
    blok015: all.filter(p => p.blok === '015').length,
  }
}
```

### Tambah tombol import di `app/(tabs)/index.tsx`

Tambahkan di bawah tombol **Import Excel Byname** yang sudah ada:

```typescript
// Tambah import di atas
import { importPolygonJson, getPolygonStats } from '@/src/services/import.service'

// Tambah state
const [polyStats, setPolyStats] = useState<{total:number,blok013:number,blok014:number,blok015:number}|null>(null)

// Tambah di loadStats()
const ps = await getPolygonStats()
setPolyStats(ps)

// Tambah handler
const handleImportPolygon = async () => {
  setLoading(true)
  const result = await importPolygonJson((cur, tot) =>
    setProgress({ current: cur, total: tot })
  )
  setLoading(false)
  await loadStats()
  Alert.alert(
    '✅ Import Polygon Selesai',
    `Berhasil: ${result.imported} polygon\nDilewati: ${result.skipped}`,
  )
}

// Tambah card statistik polygon (setelah stats card yang ada)
{polyStats && polyStats.total > 0 && (
  <View style={styles.statsCard}>
    <Text style={styles.cardTitle}>🗺️ Polygon Termapping</Text>
    <View style={styles.statsGrid}>
      <StatItem label="Total" value={polyStats.total} color="#0F2D38" />
      <StatItem label="Blok 013" value={polyStats.blok013} color="#2E6E82" />
      <StatItem label="Blok 014" value={polyStats.blok014} color="#2E6E82" />
      <StatItem label="Blok 015" value={polyStats.blok015} color="#2E6E82" />
    </View>
  </View>
)}

// Tambah tombol import polygon
<TouchableOpacity
  style={[styles.btnPrimary, { backgroundColor: '#2E6E82' }, loading && styles.btnDisabled]}
  onPress={handleImportPolygon}
  disabled={loading}
>
  <Text style={styles.btnText}>🗺️  Import Polygon JSON</Text>
</TouchableOpacity>
```

---

## ▶️ Urutan Pengerjaan Sprint Ini

```
BAGIAN A — Di Laptop (Python)
  Step 1 → pip install pymupdf
  Step 2 → Buat folder D:\pbb-tools\
  Step 3 → Copy 070002.pdf ke folder tersebut
  Step 4 → Jalankan script cek ukuran halaman:
           python -c "import fitz; doc=fitz.open('070002.pdf'); print(doc[12].rect)"
  Step 5 → Buat georef_config.json dengan koordinat GPS kamu sendiri
  Step 6 → Buat extract_polygons.py
  Step 7 → python extract_polygons.py
  Step 8 → Cek output/polygons_013.json — buka, lihat strukturnya

BAGIAN B — Di App (Expo)
  Step 9  → Tambah importPolygonJson ke import.service.ts
  Step 10 → Tambah tombol import di index.tsx
  Step 11 → npx expo start (tidak perlu EAS Build)
  Step 12 → Transfer file JSON ke HP (via WhatsApp/email/USB)
  Step 13 → Tap "Import Polygon JSON" di app → pilih file
  Step 14 → Buka tab Peta → ratusan polygon langsung muncul!
```

---

## ⚠️ Troubleshooting

| Masalah | Solusi |
|---|---|
| `ModuleNotFoundError: fitz` | Jalankan `pip install pymupdf` |
| `Total polygon berhasil: 0` | Cek `georef_config.json` — page index harus 0-based (hal 13 = index 12) |
| Polygon meleset jauh dari lokasi | Koordinat GPS di `georef_config.json` perlu dikoreksi — ambil ulang dari Maps |
| Banyak "tidak ter-match" | Normal untuk nomor `0` (jalan/fasum) — bukan error |
| JSON tidak bisa dibuka di app | Pastikan format file adalah `.json`, bukan `.txt` |
| Polygon muncul tapi posisi geser | Perbaiki akurasi 4 titik kontrol di `georef_config.json` |

---

## 💡 Tips Akurasi Georeferencing

Kunci akurasi adalah **pemilihan 4 titik kontrol yang tepat**. Tips:
- Gunakan titik yang **mudah dikenali di kedua sumber** (PDF dan Google Maps)
- Contoh titik bagus: pojok persimpangan jalan utama, sudut bangunan besar, ujung sungai/selokan
- Hindari titik yang di tengah sawah atau area yang bisa berubah
- Setelah import, **zoom ke peta** dan bandingkan polygon dengan foto satelit — kalau meleset, koreksi koordinat GPS dan import ulang

---

## ✅ Checklist Sprint 6 Selesai

**Bagian Laptop:**
- [ ] `pymupdf` terinstall
- [ ] `georef_config.json` dibuat dengan koordinat GPS yang valid
- [ ] `extract_polygons.py` berhasil dijalankan
- [ ] File `output/polygons_013.json` terbuat dengan ≥ 100 polygon
- [ ] File `output/polygons_014.json` terbuat
- [ ] File `output/polygons_015.json` terbuat

**Bagian App:**
- [ ] `importPolygonJson` ditambahkan ke `import.service.ts`
- [ ] Tombol import polygon muncul di Dashboard
- [ ] File JSON berhasil diimport ke app
- [ ] Tab Peta — polygon muncul ratusan sekaligus
- [ ] Polygon overlay presisi di atas foto satelit

---

## ➡️ Sprint Berikutnya

**Sprint 7 — Fitur Deteksi Petak Tanpa Pemilik (Fitur Pintar 1)**  
Setelah polygon dan data WP keduanya sudah ada di DB, kita buat validasi otomatis untuk mendeteksi ketidaksesuaian antara keduanya.
