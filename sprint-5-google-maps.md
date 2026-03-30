# Sprint 5 — Google Maps Integration

**Project:** PBB Sync  
**Sprint:** 5 dari 10  
**Estimasi:** 1-2 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 4 selesai ✅

---

## 🎯 Tujuan Sprint Ini

- Tampilkan Google Maps Satellite View di tab Peta
- Overlay polygon sederhana per petak (warna sesuai status)
- Tap polygon → popup nama WP + NOP + status
- Data polygon diambil dari DB (tabel `petak_polygon`)

**Hasil akhir sprint ini:** Tab Peta menampilkan Google Maps satellite dengan polygon petak yang bisa di-tap.

---

## ✅ Keunggulan Sprint Ini

```
TIDAK ada native package baru
react-native-maps sudah terinstall sejak Sprint 0
TIDAK perlu EAS Build ulang
Langsung hot reload
```

---

## ⚙️ Persiapan: Google Maps API Key

### Step 1 — Buat API Key

1. Buka https://console.cloud.google.com
2. Buat project baru atau pilih yang ada
3. Aktifkan **Maps SDK for Android**
4. Buat **API Key** baru
5. (Opsional tapi dianjurkan) Batasi key: Applications → Android apps → tambah package name `com.pbbsync`

### Step 2 — Tambah ke `app.json`

Buka `app.json`, tambahkan di dalam `"android"`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "ISI_API_KEY_KAMU_DISINI"
        }
      },
      "package": "com.pbbsync"
    }
  }
}
```

> ⚠️ API Key gratis untuk penggunaan personal dengan traffic rendah. Tidak perlu billing selama di bawah kuota free tier Google Maps.

---

## 📁 File yang Dibuat / Diubah Sprint Ini

```
src/
├── db/
│   └── queries.ts          ← UPDATE (tambah query polygon)
└── services/
    └── geo.service.ts      ← BUAT BARU (kalkulasi georef)

app/(tabs)/
└── peta.tsx                ← UPDATE (ganti PDF → Maps + polygon)
```

---

## 📄 File 1 — Update `src/db/queries.ts`

Tambahkan fungsi-fungsi ini **di bagian bawah** file yang sudah ada:

```typescript
import { petakPolygon, georefConfig } from './schema'

// ── Ambil semua polygon per blok
export const getPolygonsByBlok = async (blok: string) => {
  const result = await db
    .select()
    .from(petakPolygon)
    .where(eq(petakPolygon.blok, blok))

  return result
}

// ── Ambil satu polygon by NOP
export const getPolygonByNop = async (nop: string) => {
  const result = await db
    .select()
    .from(petakPolygon)
    .where(eq(petakPolygon.nop, nop))
    .limit(1)

  return result[0] ?? null
}

// ── Simpan polygon baru
export const upsertPolygon = async (data: {
  blok: string
  nomorPetak: string
  nop: string
  points: string   // JSON array lat/lng
}) => {
  await db
    .insert(petakPolygon)
    .values({
      blok: data.blok,
      nomorPetak: data.nomorPetak,
      nop: data.nop,
      points: data.points,
      isGeoref: true,
    })
    .onConflictDoUpdate({
      target: [petakPolygon.blok, petakPolygon.nomorPetak],
      set: {
        nop: data.nop,
        points: data.points,
        isGeoref: true,
      },
    })
}

// ── Ambil konfigurasi georef per blok
export const getGeorefConfig = async (blok: string) => {
  const result = await db
    .select()
    .from(georefConfig)
    .where(eq(georefConfig.blok, blok))
    .limit(1)

  return result[0] ?? null
}

// ── Simpan konfigurasi georef
export const saveGeorefConfig = async (data: {
  blok: string
  controlPoints: string
  pdfWidth: number
  pdfHeight: number
}) => {
  await db
    .insert(georefConfig)
    .values({
      blok: data.blok,
      controlPoints: data.controlPoints,
      pdfWidth: data.pdfWidth,
      pdfHeight: data.pdfHeight,
      isReady: true,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: georefConfig.blok,
      set: {
        controlPoints: data.controlPoints,
        isReady: true,
      },
    })
}
```

---

## 📄 File 2 — Buat `src/services/geo.service.ts`

```typescript
// ── Tipe koordinat
export interface LatLng {
  lat: number
  lng: number
}

export interface PixelPoint {
  px: number
  py: number
}

export interface ControlPoint extends LatLng, PixelPoint {}

// ── Kalkulasi affine transform matrix dari 4 titik kontrol
// Input : 4 pasangan koordinat pixel PDF <-> GPS lat/lng
// Output: matrix yang bisa konversi pixel PDF manapun → GPS
export const calcTransformMatrix = (controlPoints: ControlPoint[]) => {
  if (controlPoints.length < 3) return null

  // Pakai 3 titik pertama untuk affine transform (2D)
  const [p0, p1, p2] = controlPoints

  // Sistem persamaan linear untuk affine transform
  // lat = a*px + b*py + c
  // lng = d*px + e*py + f

  const dx1 = p1.px - p0.px
  const dy1 = p1.py - p0.py
  const dx2 = p2.px - p0.px
  const dy2 = p2.py - p0.py

  const dLat1 = p1.lat - p0.lat
  const dLng1 = p1.lng - p0.lng
  const dLat2 = p2.lat - p0.lat
  const dLng2 = p2.lng - p0.lng

  const det = dx1 * dy2 - dx2 * dy1
  if (Math.abs(det) < 1e-10) return null

  const a = (dLat1 * dy2 - dLat2 * dy1) / det
  const b = (dx1 * dLat2 - dx2 * dLat1) / det
  const c = p0.lat - a * p0.px - b * p0.py

  const d = (dLng1 * dy2 - dLng2 * dy1) / det
  const e = (dx1 * dLng2 - dx2 * dLng1) / det
  const f = p0.lng - d * p0.px - e * p0.py

  return { a, b, c, d, e, f }
}

// ── Konversi satu pixel PDF → koordinat GPS
export const pixelToLatLng = (
  px: number,
  py: number,
  matrix: ReturnType<typeof calcTransformMatrix>
): LatLng | null => {
  if (!matrix) return null
  return {
    lat: matrix.a * px + matrix.b * py + matrix.c,
    lng: matrix.d * px + matrix.e * py + matrix.f,
  }
}

// ── Parse JSON string points → array LatLng
export const parsePoints = (pointsJson: string): LatLng[] => {
  try {
    return JSON.parse(pointsJson)
  } catch {
    return []
  }
}

// ── Hitung titik tengah polygon (untuk label)
export const getCentroid = (points: LatLng[]): LatLng => {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length
  return { lat, lng }
}

// ── Cek apakah titik GPS ada di dalam polygon
// Algoritma Ray Casting
export const isPointInPolygon = (
  point: LatLng,
  polygon: LatLng[]
): boolean => {
  let inside = false
  const { lat: x, lng: y } = point

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat
    const yi = polygon[i].lng
    const xj = polygon[j].lat
    const yj = polygon[j].lng

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}
```

---

## 📄 File 3 — Update `app/(tabs)/peta.tsx`

Ganti seluruh isi file:

```typescript
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert, Modal, ScrollView
} from 'react-native'
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps'
import { useState, useRef, useEffect, useCallback } from 'react'
import { getWajibPajak, getPolygonsByBlok } from '@/src/db/queries'
import { parsePoints } from '@/src/services/geo.service'

const { width: W, height: H } = Dimensions.get('window')

// ── Pusat koordinat Mandingan, Ringinharjo, Bantul
const DEFAULT_REGION = {
  latitude:      -7.8868,
  longitude:     110.3321,
  latitudeDelta:  0.008,
  longitudeDelta: 0.008,
}

// ── Warna polygon per status
const POLYGON_COLORS = {
  belum:    { fill: 'rgba(232,84,84,0.35)',    stroke: '#E85454' },
  diterima: { fill: 'rgba(46,201,126,0.35)',   stroke: '#2EC97E' },
  sawah:    { fill: 'rgba(240,165,0,0.25)',    stroke: '#F0A500' },
  selected: { fill: 'rgba(240,165,0,0.55)',    stroke: '#F0A500' },
  unknown:  { fill: 'rgba(90,140,178,0.25)',   stroke: '#5C8EB2' },
}

const BLOK_LIST = ['013', '014', '015']

// ── Tipe data polygon gabungan dengan data WP
interface PetakData {
  id: number
  blok: string
  nomorPetak: string
  nop: string | null
  points: Array<{ lat: number; lng: number }>
  namaWp?: string
  statusBayar?: string
  jumlahSppt?: number
  padukuhan?: string
}

export default function PetaScreen() {
  const mapRef = useRef<MapView>(null)

  const [activeBlok, setActiveBlok]     = useState('013')
  const [petakList, setPetakList]       = useState<PetakData[]>([])
  const [selectedPetak, setSelectedPetak] = useState<PetakData | null>(null)
  const [loading, setLoading]           = useState(false)
  const [mapType, setMapType]           = useState<'satellite' | 'standard'>('satellite')
  const [showPopup, setShowPopup]       = useState(false)

  // Load polygon + data WP saat blok berubah
  useEffect(() => {
    loadPetakData(activeBlok)
  }, [activeBlok])

  const loadPetakData = useCallback(async (blok: string) => {
    setLoading(true)
    setSelectedPetak(null)
    setShowPopup(false)

    try {
      // Ambil polygon dari DB
      const polygons = await getPolygonsByBlok(blok)

      // Ambil data WP blok ini (limit besar)
      const wpList = await getWajibPajak({ blok, limit: 999 })

      // Gabungkan polygon + data WP via NOP
      const merged: PetakData[] = polygons
        .filter(p => p.points)
        .map(p => {
          const wp = wpList.find(w => w.nop === p.nop)
          const points = parsePoints(p.points!)

          return {
            id: p.id,
            blok: p.blok,
            nomorPetak: p.nomorPetak,
            nop: p.nop,
            points,
            namaWp:     wp?.namaWp,
            statusBayar: wp?.statusBayar,
            jumlahSppt: wp?.jumlahSppt,
            padukuhan:  wp?.padukuhan,
          }
        })
        .filter(p => p.points.length >= 3) // minimal 3 titik baru jadi polygon

      setPetakList(merged)
    } catch (e) {
      console.error('loadPetakData error:', e)
    }

    setLoading(false)
  }, [])

  // Tap polygon
  const handleTapPolygon = (petak: PetakData) => {
    setSelectedPetak(petak)
    setShowPopup(true)
  }

  // Warna polygon
  const getColor = (petak: PetakData, isSelected: boolean) => {
    if (isSelected) return POLYGON_COLORS.selected
    const status = petak.statusBayar ?? 'unknown'
    return POLYGON_COLORS[status as keyof typeof POLYGON_COLORS]
      ?? POLYGON_COLORS.unknown
  }

  return (
    <View style={styles.container}>
      {/* ── Selector Blok */}
      <View style={styles.topBar}>
        <View style={styles.blokRow}>
          {BLOK_LIST.map(blok => (
            <TouchableOpacity
              key={blok}
              style={[styles.blokBtn, activeBlok === blok && styles.blokBtnActive]}
              onPress={() => setActiveBlok(blok)}
            >
              <Text style={[
                styles.blokBtnText,
                activeBlok === blok && styles.blokBtnTextActive,
              ]}>
                Blok {blok}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Toggle map type */}
          <TouchableOpacity
            style={styles.mapTypeBtn}
            onPress={() =>
              setMapType(t => t === 'satellite' ? 'standard' : 'satellite')
            }
          >
            <Text style={styles.mapTypeBtnText}>
              {mapType === 'satellite' ? '🛰️' : '🗺️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info polygon count */}
        <Text style={styles.infoText}>
          {loading
            ? 'Memuat peta...'
            : petakList.length > 0
              ? `${petakList.length} petak termapping · Tap petak untuk detail`
              : 'Belum ada polygon. Lakukan georeferencing terlebih dahulu.'}
        </Text>
      </View>

      {/* ── Google Maps */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        loadingEnabled={true}
        loadingIndicatorColor="#0F2D38"
        loadingBackgroundColor="#F0F4F7"
      >
        {/* Render polygon per petak */}
        {petakList.map(petak => {
          const isSelected = selectedPetak?.id === petak.id
          const color = getColor(petak, isSelected)

          return (
            <Polygon
              key={`${petak.blok}-${petak.nomorPetak}`}
              coordinates={petak.points.map(p => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              fillColor={color.fill}
              strokeColor={color.stroke}
              strokeWidth={isSelected ? 3 : 1.5}
              tappable={true}
              onPress={() => handleTapPolygon(petak)}
            />
          )
        })}
      </MapView>

      {/* ── Legend */}
      <View style={styles.legend}>
        <LegendItem color="#E85454" label="Belum" />
        <LegendItem color="#2EC97E" label="Diterima" />
        <LegendItem color="#F0A500" label="Sawah" />
      </View>

      {/* ── Popup detail petak */}
      {showPopup && selectedPetak && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <View>
              <Text style={styles.popupNop}>
                {selectedPetak.blok}-{selectedPetak.nomorPetak}
                {selectedPetak.nop ? ` · ${selectedPetak.nop}` : ''}
              </Text>
              <Text style={styles.popupName}>
                {selectedPetak.namaWp ?? 'Tidak ada data WP'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowPopup(false)}
              style={styles.popupClose}
            >
              <Text style={{ color: '#7A9FAF', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.popupRow}>
            <PopupItem
              label="Luas"
              value={`${selectedPetak.points.length} titik`}
            />
            <PopupItem
              label="SPPT"
              value={
                selectedPetak.jumlahSppt === 0
                  ? 'Bebas Pajak'
                  : `Rp ${selectedPetak.jumlahSppt?.toLocaleString('id-ID') ?? '-'}`
              }
            />
            <PopupItem
              label="Padukuhan"
              value={selectedPetak.padukuhan ?? '-'}
            />
          </View>

          <View style={[
            styles.popupStatusBadge,
            {
              backgroundColor:
                selectedPetak.statusBayar === 'diterima' ? '#DCFCE7' :
                selectedPetak.statusBayar === 'sawah'    ? '#FEF3C7' :
                selectedPetak.statusBayar === 'belum'    ? '#FEE2E2' : '#F0F4F7',
            },
          ]}>
            <Text style={[
              styles.popupStatusText,
              {
                color:
                  selectedPetak.statusBayar === 'diterima' ? '#16A34A' :
                  selectedPetak.statusBayar === 'sawah'    ? '#D97706' :
                  selectedPetak.statusBayar === 'belum'    ? '#DC2626' : '#4A6070',
              },
            ]}>
              {selectedPetak.statusBayar === 'diterima' ? '✓ Sudah Diterima' :
               selectedPetak.statusBayar === 'sawah'    ? '🌾 Sawah / Bebas Pajak' :
               selectedPetak.statusBayar === 'belum'    ? '⏳ Belum Diterima' :
               '— Tidak ada data'}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Komponen kecil
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

function PopupItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.popupItem}>
      <Text style={styles.popupItemLabel}>{label}</Text>
      <Text style={styles.popupItemValue}>{value}</Text>
    </View>
  )
}

// ── Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D38' },

  // Top bar
  topBar:       { backgroundColor: '#0F2D38', paddingHorizontal: 12,
                  paddingVertical: 8, gap: 6 },
  blokRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  blokBtn:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  blokBtnActive:     { backgroundColor: '#fff' },
  blokBtnText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  blokBtnTextActive: { color: '#0F2D38' },
  mapTypeBtn:   { marginLeft: 'auto', width: 36, height: 36, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center', justifyContent: 'center' },
  mapTypeBtnText: { fontSize: 18 },
  infoText:     { fontSize: 10, color: '#7AAFC0' },

  // Map
  map:          { flex: 1 },

  // Legend
  legend:       { position: 'absolute', top: 90, left: 12,
                  backgroundColor: 'rgba(15,45,56,0.85)',
                  borderRadius: 10, padding: 8, gap: 4 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 3 },
  legendText:   { fontSize: 9, color: '#fff', fontWeight: '500' },

  // Popup
  popup:        { position: 'absolute', bottom: 20, left: 12, right: 12,
                  backgroundColor: '#fff', borderRadius: 16, padding: 14,
                  shadowColor: '#000', shadowOpacity: 0.2,
                  shadowRadius: 12, elevation: 8,
                  borderLeftWidth: 4, borderLeftColor: '#F0A500' },
  popupHeader:  { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 8 },
  popupNop:     { fontSize: 9, color: '#7A9FAF', fontWeight: '600',
                  letterSpacing: 0.5 },
  popupName:    { fontSize: 15, fontWeight: '800', color: '#0F2D38', marginTop: 2 },
  popupClose:   { padding: 4 },
  popupRow:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  popupItem:    { flex: 1, backgroundColor: '#F7F9FB',
                  borderRadius: 8, padding: 8 },
  popupItemLabel: { fontSize: 8, color: '#7A9FAF', fontWeight: '600',
                    textTransform: 'uppercase', marginBottom: 2 },
  popupItemValue: { fontSize: 11, fontWeight: '700', color: '#0F2D38' },
  popupStatusBadge: { borderRadius: 8, padding: 8, alignItems: 'center' },
  popupStatusText:  { fontSize: 12, fontWeight: '700' },
})
```

---

## ▶️ Urutan Pengerjaan Sprint Ini

```
Step 1 → Buat Google Maps API Key (console.cloud.google.com)

Step 2 → Tambah API Key ke app.json

Step 3 → Tambah query di src/db/queries.ts

Step 4 → Buat src/services/geo.service.ts

Step 5 → Update app/(tabs)/peta.tsx

Step 6 → Jalankan npx expo start (TIDAK perlu EAS Build baru!)

Step 7 → Test maps tampil, polygon muncul kalau sudah ada data
```

---

## ▶️ Cara Test Sprint Ini

1. Jalankan `npx expo start` → hot reload
2. Buka tab **Peta**
3. Google Maps Satellite View harus tampil
4. Selector **Blok 013 / 014 / 015** berfungsi
5. Toggle 🛰️/🗺️ ganti tipe peta
6. Kalau polygon belum ada (wajar di Sprint ini) → info text muncul:
   *"Belum ada polygon. Lakukan georeferencing terlebih dahulu."*
7. Georeferencing dan polygon akan dikerjakan di Sprint 6

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| Peta putih / blank | API Key belum ditambahkan ke `app.json` atau salah format |
| `PROVIDER_GOOGLE is not defined` | Import lengkap: `import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps'` |
| `Google Maps API key not found` | Pastikan key di `app.json` → `android.config.googleMaps.apiKey` |
| Polygon tidak muncul | Normal — DB `petak_polygon` masih kosong, polygon diisi di Sprint 6 |
| Maps tampil tapi tidak satellite | Cek `mapType="satellite"` dan `PROVIDER_GOOGLE` sudah di-set |
| Crash saat buka tab Peta | Cek console log — share error message |

---

## ✅ Checklist Sprint 5 Selesai

- [ ] Google Maps API Key sudah dibuat & ditambahkan ke `app.json`
- [ ] `src/db/queries.ts` sudah diupdate dengan query polygon
- [ ] `src/services/geo.service.ts` sudah dibuat
- [ ] `app/(tabs)/peta.tsx` sudah diupdate
- [ ] Maps tampil tanpa EAS Build baru
- [ ] Satellite view berfungsi
- [ ] Selector blok berfungsi
- [ ] Toggle satellite/standard berfungsi
- [ ] Info text muncul saat polygon kosong
- [ ] Popup muncul saat polygon di-tap (jika ada data)

---

## 📌 Catatan Penting untuk Sprint Berikutnya

Setelah Sprint 5 selesai, polygon di peta masih kosong karena tabel `petak_polygon` belum ada datanya. Di **Sprint 6** kita akan membuat **tool georeferencing** — yaitu fitur untuk menggambar polygon petak di atas peta dengan cara tap titik-titik sudut langsung di Google Maps.

---

## ➡️ Sprint Berikutnya

**Sprint 6 — Georeferencing & Drawing Tool**  
Buat tool untuk gambar polygon petak langsung di Google Maps via tap. Simpan koordinat ke DB. Setelah ini, peta akan benar-benar hidup dengan warna status per petak.
