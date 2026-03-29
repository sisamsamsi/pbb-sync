# Sprint 4 — Tab Navigation + PDF Viewer

**Project:** PBB Sync  
**Sprint:** 4 dari 10  
**Estimasi:** 1-2 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 3 selesai ✅

---

## 🎯 Tujuan Sprint Ini

Dua hal utama:
1. **Rapikan tab bar** — ganti nama & ikon, tambah tab Peta dan Distribusi
2. **PDF Viewer** — bisa buka dan zoom file PDF peta blok di dalam app

**Hasil akhir sprint ini:** 4 tab lengkap dengan ikon, dan tab Peta bisa menampilkan file PDF peta blok PBB dengan fitur zoom & pan.

---

## 📦 Package Baru yang Perlu Diinstall

Jalankan di terminal sebelum mulai coding:

```bash
npx expo install react-native-pdf react-native-blob-util
```

> ⚠️ Kedua package ini **native** — setelah install wajib trigger **EAS Build ulang** sebelum bisa ditest di HP.

Setelah install, cek `package.json` — pastikan muncul:
```json
"react-native-pdf": "...",
"react-native-blob-util": "..."
```

Lalu trigger EAS build:
```bash
eas build --profile development --platform android
```

Tunggu build selesai dan install APK baru ke HP sebelum lanjut test.

---

## 📁 File yang Dibuat / Diubah Sprint Ini

```
app/(tabs)/
├── _layout.tsx        ← UPDATE (4 tab + ikon + warna)
├── index.tsx          ← Tidak diubah
├── byname.tsx         ← Tidak diubah
├── peta.tsx           ← BUAT/UPDATE (PDF viewer)
└── distribusi.tsx     ← BUAT BARU (placeholder)

assets/maps/
├── blok-013.pdf       ← COPY FILE PDF dari laptop ke sini
├── blok-014.pdf       ← COPY FILE PDF
└── blok-015.pdf       ← COPY FILE PDF
```

---

## 📋 Persiapan: Copy File PDF ke Project

Sebelum mulai coding, copy file PDF peta blok ke folder `assets/maps/`:

```powershell
# Sesuaikan path sumber file PDF kamu
Copy-Item "C:\path\to\070002.pdf" "D:\pbb-sync\assets\maps\peta-blok.pdf"
```

> 💡 File PDF kamu (`070002.pdf`) berisi 20 halaman. Kita load per halaman sesuai nomor blok. Tidak perlu pisah file dulu — cukup 1 file PDF, nanti kita pilih halaman yang sesuai.

**Mapping halaman PDF → Nomor Blok:**

| Halaman PDF | Nomor Blok |
|---|---|
| 13 | Blok 013 |
| 14 | Blok 014 |
| 15 | Blok 015 |

---

## 📄 File 1 — Update `app/(tabs)/_layout.tsx`

Ganti seluruh isi file:

```typescript
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'

// Warna brand
const C1 = '#0F2D38'
const C5 = '#5C8EB2'
const GRAY = '#B0BEC8'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C1,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8EDF2',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: C1,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
        },
      }}
    >
      {/* Tab 1: Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🏠" focused={focused} color={color} />
          ),
          headerTitle: 'PBB Sync',
        }}
      />

      {/* Tab 2: Peta */}
      <Tabs.Screen
        name="peta"
        options={{
          title: 'Peta Blok',
          tabBarLabel: 'Peta',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🗺️" focused={focused} color={color} />
          ),
          headerTitle: 'Peta Blok PBB',
        }}
      />

      {/* Tab 3: Byname */}
      <Tabs.Screen
        name="byname"
        options={{
          title: 'Data WP',
          tabBarLabel: 'Byname',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="👥" focused={focused} color={color} />
          ),
          headerTitle: 'Data Wajib Pajak',
        }}
      />

      {/* Tab 4: Distribusi */}
      <Tabs.Screen
        name="distribusi"
        options={{
          title: 'Distribusi',
          tabBarLabel: 'Distribusi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="📋" focused={focused} color={color} />
          ),
          headerTitle: 'Mode Distribusi',
        }}
      />
    </Tabs>
  )
}

// Komponen ikon tab sederhana pakai emoji
function TabIcon({
  emoji,
  focused,
  color,
}: {
  emoji: string
  focused: boolean
  color: string
}) {
  const { View, Text } = require('react-native')
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: focused ? C1 : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: focused ? 16 : 18 }}>{emoji}</Text>
    </View>
  )
}
```

---

## 📄 File 2 — `app/(tabs)/peta.tsx`

Buat file baru (atau ganti isi jika sudah ada):

```typescript
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform
} from 'react-native'
import { useState, useRef } from 'react'
import { Asset } from 'expo-asset'
import Pdf from 'react-native-pdf'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// Mapping blok → halaman di file PDF
const BLOK_PAGES: Record<string, number> = {
  '013': 13,
  '014': 14,
  '015': 15,
}

const BLOK_LIST = ['013', '014', '015']

export default function PetaScreen() {
  const [activeBlok, setActiveBlok] = useState('013')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)

  // Path PDF — dari assets/maps/
  // Expo Asset: require path harus static string
  const pdfSource = {
    uri: Asset.fromModule(require('../../assets/maps/peta-blok.pdf')).uri,
    cache: true,
    page: BLOK_PAGES[activeBlok],
  }

  return (
    <View style={styles.container}>
      {/* Selector Blok */}
      <View style={styles.blokBar}>
        <Text style={styles.blokBarLabel}>Pilih Blok:</Text>
        <View style={styles.blokBtns}>
          {BLOK_LIST.map(blok => (
            <TouchableOpacity
              key={blok}
              style={[
                styles.blokBtn,
                activeBlok === blok && styles.blokBtnActive,
              ]}
              onPress={() => {
                setActiveBlok(blok)
                setLoading(true)
                setError(null)
              }}
            >
              <Text style={[
                styles.blokBtnText,
                activeBlok === blok && styles.blokBtnTextActive,
              ]}>
                Blok {blok}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info halaman */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          📄 Halaman {BLOK_PAGES[activeBlok]} dari {totalPages || '...'} 
          {'  '}·{'  '}
          Pinch untuk zoom · Drag untuk geser
        </Text>
      </View>

      {/* PDF Viewer */}
      <View style={styles.pdfContainer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>Gagal memuat PDF</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Text style={styles.errorHint}>
              Pastikan file PDF sudah di-copy ke:{'\n'}
              assets/maps/peta-blok.pdf
            </Text>
          </View>
        ) : (
          <Pdf
            source={pdfSource}
            page={BLOK_PAGES[activeBlok]}
            onLoadComplete={(numberOfPages) => {
              setTotalPages(numberOfPages)
              setLoading(false)
            }}
            onPageChanged={() => {}}
            onError={(err) => {
              setError(String(err))
              setLoading(false)
            }}
            onLoadProgress={() => setLoading(true)}
            style={styles.pdf}
            enablePaging={false}
            horizontal={false}
            fitPolicy={0}        // 0 = fit width
            minScale={1.0}
            maxScale={5.0}
            scale={1.2}
            spacing={0}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Loading overlay */}
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0F2D38" />
            <Text style={styles.loadingText}>
              Memuat Peta Blok {activeBlok}...
            </Text>
          </View>
        )}
      </View>

      {/* Footer info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔵 Blok {activeBlok} · Kalurahan Ringinharjo · Tahun 2026
        </Text>
        <Text style={styles.footerSub}>
          Tap petak untuk lihat data WP (tersedia di Sprint 6)
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },

  // Blok selector
  blokBar:      { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff',
                  borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  blokBarLabel: { fontSize: 12, fontWeight: '600', color: '#4A6070', marginRight: 10 },
  blokBtns:     { flexDirection: 'row', gap: 8 },
  blokBtn:      { paddingHorizontal: 14, paddingVertical: 6,
                  borderRadius: 10, backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  blokBtnActive:     { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  blokBtnText:       { fontSize: 12, fontWeight: '600', color: '#4A6070' },
  blokBtnTextActive: { color: '#fff' },

  // Info bar
  infoBar:      { backgroundColor: '#1A4A5A', paddingHorizontal: 12, paddingVertical: 5 },
  infoText:     { fontSize: 10, color: '#A8CFDF', textAlign: 'center' },

  // PDF
  pdfContainer: { flex: 1, position: 'relative' },
  pdf:          { flex: 1, width: SCREEN_W, backgroundColor: '#E8EDF2' },

  // Loading overlay
  loadingOverlay: { position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(240,244,247,0.9)',
                    alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:    { fontSize: 13, fontWeight: '600', color: '#0F2D38' },

  // Error
  errorBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 32, gap: 8 },
  errorIcon:    { fontSize: 40 },
  errorText:    { fontSize: 16, fontWeight: '700', color: '#0F2D38' },
  errorSub:     { fontSize: 11, color: '#E85454', textAlign: 'center' },
  errorHint:    { fontSize: 11, color: '#7A9FAF', textAlign: 'center',
                  marginTop: 8, lineHeight: 18,
                  backgroundColor: '#F0F4F7', padding: 12, borderRadius: 10 },

  // Footer
  footer:       { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8,
                  borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  footerText:   { fontSize: 11, fontWeight: '600', color: '#0F2D38' },
  footerSub:    { fontSize: 10, color: '#B0BEC8', marginTop: 2 },
})
```

---

## 📄 File 3 — `app/(tabs)/distribusi.tsx`

Buat file baru — placeholder dulu, akan dilengkapi di Sprint 8:

```typescript
import { View, Text, StyleSheet } from 'react-native'

export default function DistribusiScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📋</Text>
        <Text style={styles.title}>Mode Distribusi</Text>
        <Text style={styles.sub}>
          Fitur checklist distribusi SPPT akan tersedia di Sprint 8.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Sprint saat ini fokus pada:{'\n'}
            ✅ Sprint 1 — Database{'\n'}
            ✅ Sprint 2 — Import Excel{'\n'}
            ✅ Sprint 3 — List & Search WP{'\n'}
            ✅ Sprint 4 — Tab + PDF Viewer{'\n'}
            🔵 Sprint 5 — Google Maps{'\n'}
            ⬜ Sprint 6 — Tap Petak → Data WP{'\n'}
            ⬜ Sprint 7 — Deteksi Petak Tanpa Pemilik{'\n'}
            ⬜ Sprint 8 — Mode Distribusi{'\n'}
            ⬜ Sprint 9 — Ringkasan Otomatis{'\n'}
            ⬜ Sprint 10 — Polish & Final
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7',
               alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 24,
               width: '100%', alignItems: 'center',
               shadowColor: '#000', shadowOpacity: 0.06,
               shadowRadius: 8, elevation: 2 },
  icon:      { fontSize: 48, marginBottom: 12 },
  title:     { fontSize: 18, fontWeight: '800', color: '#0F2D38', marginBottom: 6 },
  sub:       { fontSize: 13, color: '#7A9FAF', textAlign: 'center',
               lineHeight: 20, marginBottom: 16 },
  infoBox:   { backgroundColor: '#F0F4F7', borderRadius: 12,
               padding: 16, width: '100%' },
  infoText:  { fontSize: 12, color: '#4A6070', lineHeight: 22 },
})
```

---

## 📄 Update `app.json` — Tambah Asset PDF

Buka `app.json`, tambahkan `assetBundlePatterns` supaya file PDF ikut terbundle saat build EAS:

```json
{
  "expo": {
    "assetBundlePatterns": [
      "**/*",
      "assets/maps/*"
    ]
  }
}
```

---

## ▶️ Urutan Pengerjaan Sprint Ini

```
Step 1 → Install package:
         npx expo install react-native-pdf react-native-blob-util

Step 2 → Copy file PDF ke assets/maps/peta-blok.pdf

Step 3 → Update app.json (tambah assetBundlePatterns)

Step 4 → Buat/update semua file kode

Step 5 → Trigger EAS Build (wajib karena ada native package baru)
         eas build --profile development --platform android

Step 6 → Install APK hasil build ke HP

Step 7 → Test: buka tab Peta, pilih blok, PDF harus tampil
```

---

## ▶️ Cara Test Sprint Ini

1. Buka tab **Peta** → PDF peta blok tampil
2. Pinch zoom → peta bisa dizoom sampai 5x
3. Drag/pan → bisa geser ke semua arah
4. Tap **Blok 013 / 014 / 015** → PDF berpindah ke halaman yang sesuai
5. Buka tab **Distribusi** → tampil placeholder sprint roadmap
6. Tab bar: 4 tab dengan ikon emoji + label yang benar

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| `Unable to resolve module react-native-pdf` | Jalankan EAS Build ulang setelah install |
| PDF tidak muncul, error asset | Pastikan `peta-blok.pdf` ada di `assets/maps/` dan `app.json` sudah diupdate |
| `Cannot read property 'uri' of undefined` | Cek path `require()` di `pdfSource` — harus exact path |
| Tab distribusi tidak muncul | Pastikan `distribusi.tsx` ada di `app/(tabs)/` |
| Tab bar hanya tampil 2 tab | Pastikan `_layout.tsx` sudah punya 4 `Tabs.Screen` |
| Build EAS gagal | Share error log EAS — biasanya dependency conflict |

---

## ✅ Checklist Sprint 4 Selesai

- [ ] `react-native-pdf` & `react-native-blob-util` terinstall
- [ ] File PDF sudah di-copy ke `assets/maps/peta-blok.pdf`
- [ ] `app.json` sudah diupdate `assetBundlePatterns`
- [ ] `app/(tabs)/_layout.tsx` sudah update — 4 tab dengan ikon
- [ ] `app/(tabs)/peta.tsx` sudah dibuat — PDF viewer berjalan
- [ ] `app/(tabs)/distribusi.tsx` sudah dibuat — placeholder
- [ ] EAS Build berhasil dan APK terinstall di HP
- [ ] PDF peta tampil dan bisa di-zoom / pan
- [ ] Selector Blok 013/014/015 bisa ganti halaman PDF
- [ ] Tab bar 4 tab dengan ikon dan label yang benar

---

## ➡️ Sprint Berikutnya

**Sprint 5 — Google Maps Integration**  
Setup Google Maps API key, tampilkan peta satelit, dan buat layer dasar untuk polygon overlay.
