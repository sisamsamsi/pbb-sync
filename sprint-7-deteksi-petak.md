# Sprint 7 — Deteksi Petak Tanpa Polygon (Fitur Pintar 1)

**Project:** PBB Sync  
**Sprint:** 7 dari 10  
**Estimasi:** 1 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 6 selesai ✅ (618 polygon tersimpan di DB)

---

## 🎯 Tujuan Sprint Ini

Membuat fitur validasi otomatis yang mendeteksi semua NOP di DHKP yang belum punya polygon di peta:
- Tampil daftar WP yang belum ter-mapping (per blok)
- Progress bar: berapa yang sudah vs belum punya polygon
- Tap item → langsung masuk drawing mode di tab Peta
- Daftar otomatis berkurang saat polygon berhasil digambar

**Hasil akhir sprint ini:** Kamu tahu persis petak mana yang masih kurang, dan bisa langsung gambar dari layar ini.

---

## ✅ Keunggulan Sprint Ini

```
TIDAK ada native package baru
TIDAK perlu EAS Build ulang
Query SQLite sederhana — hanya LEFT JOIN + WHERE NULL
Langsung hot reload
```

---

## 📁 File yang Dibuat / Diubah Sprint Ini

```
src/db/
└── queries.ts           ← UPDATE (tambah query deteksi)

app/(tabs)/
└── distribusi.tsx       ← UPDATE (ganti placeholder dengan fitur deteksi)

app/
└── gambar-petak.tsx     ← BUAT BARU (drawing mode dari halaman deteksi)
```

---

## 📄 File 1 — Update `src/db/queries.ts`

Tambahkan di bagian bawah file yang sudah ada:

```typescript
// ── Ambil semua WP yang BELUM punya polygon
export const getWpTanpaPolygon = async (blok?: string) => {
  // Ambil semua polygon yang sudah ada (per NOP)
  const polygons = await db.select().from(petakPolygon)
  const mappedNops = new Set(
    polygons
      .filter(p => p.nop !== null)
      .map(p => p.nop as string)
  )

  // Ambil semua WP sesuai filter blok
  const semuaWp = await db
    .select()
    .from(wajibPajak)
    .where(blok ? eq(wajibPajak.blok, blok) : undefined)
    .orderBy(wajibPajak.blok, wajibPajak.nomorPetak)

  // Filter yang belum punya polygon
  return semuaWp.filter(wp => !mappedNops.has(wp.nop))
}

// ── Statistik mapping per blok
export const getMappingStats = async () => {
  const semua    = await db.select().from(wajibPajak)
  const polygons = await db.select().from(petakPolygon)

  const mappedNops = new Set(
    polygons
      .filter(p => p.nop !== null)
      .map(p => p.nop as string)
  )

  const stats = ['013', '014', '015'].map(blok => {
    const wpBlok    = semua.filter(w => w.blok === blok)
    const mapped    = wpBlok.filter(w => mappedNops.has(w.nop))
    const unmapped  = wpBlok.filter(w => !mappedNops.has(w.nop))
    return {
      blok,
      total:    wpBlok.length,
      mapped:   mapped.length,
      unmapped: unmapped.length,
      pct:      wpBlok.length > 0
        ? Math.round((mapped.length / wpBlok.length) * 100)
        : 0,
    }
  })

  const totalWp      = semua.length
  const totalMapped  = semua.filter(w => mappedNops.has(w.nop)).length

  return {
    bloks: stats,
    total: totalWp,
    totalMapped,
    totalUnmapped: totalWp - totalMapped,
    pctOverall: totalWp > 0
      ? Math.round((totalMapped / totalWp) * 100)
      : 0,
  }
}
```

---

## 📄 File 2 — Update `app/(tabs)/distribusi.tsx`

Ganti seluruh isi file (tidak lagi placeholder):

```typescript
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
  RefreshControl
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { getMappingStats, getWpTanpaPolygon } from '@/src/db/queries'

type MappingStats = Awaited<ReturnType<typeof getMappingStats>>
type WpList       = Awaited<ReturnType<typeof getWpTanpaPolygon>>

const BLOK_LIST = [
  { label: 'Semua', value: undefined },
  { label: 'Blok 013', value: '013' },
  { label: 'Blok 014', value: '014' },
  { label: 'Blok 015', value: '015' },
]

export default function DeteksiScreen() {
  const [stats, setStats]         = useState<MappingStats | null>(null)
  const [wpList, setWpList]       = useState<WpList>([])
  const [blokFilter, setBlokFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Reload otomatis setiap kali tab ini dibuka
  // (penting: supaya berkurang setelah drawing manual)
  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [blokFilter])
  )

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [s, list] = await Promise.all([
        getMappingStats(),
        getWpTanpaPolygon(blokFilter),
      ])
      setStats(s)
      setWpList(list)
    } catch (e) {
      console.error('loadData error:', e)
    }

    setLoading(false)
    setRefreshing(false)
  }

  // Tap WP → pergi ke tab Peta dalam drawing mode
  const handleTapWp = (nop: string, blok: string) => {
    // Navigate ke tab peta dengan parameter NOP
    // Drawing mode akan otomatis aktif
    router.push({
      pathname: '/(tabs)/peta',
      params: { drawForNop: nop, drawForBlok: blok },
    })
  }

  const renderItem = ({ item }: { item: WpList[number] }) => (
    <TouchableOpacity
      style={styles.wpItem}
      onPress={() => handleTapWp(item.nop, item.blok)}
      activeOpacity={0.7}
    >
      {/* Indikator status kiri */}
      <View style={[styles.statusBar, {
        backgroundColor:
          item.statusBayar === 'sawah' ? '#F0A500' : '#E85454',
      }]} />

      {/* Avatar */}
      <View style={[styles.avatar, {
        backgroundColor:
          item.statusBayar === 'sawah' ? '#FEF3C7' : '#FEE2E2',
      }]}>
        <Text style={[styles.avatarText, {
          color: item.statusBayar === 'sawah' ? '#D97706' : '#DC2626',
        }]}>
          {item.namaWp.charAt(0)}
        </Text>
      </View>

      {/* Info WP */}
      <View style={styles.wpInfo}>
        <Text style={styles.wpName} numberOfLines={1}>
          {item.namaWp}
        </Text>
        <Text style={styles.wpSub}>
          {item.blok}-{item.nomorPetak}
          {'  ·  '}
          {item.padukuhan ?? '-'}
          {'  ·  '}
          {item.statusBayar === 'sawah' ? '🌾 Sawah' : `Rp ${item.jumlahSppt?.toLocaleString('id-ID')}`}
        </Text>
      </View>

      {/* Tombol gambar */}
      <View style={styles.drawBtnSmall}>
        <Text style={styles.drawBtnSmallText}>✏️</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F2D38" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* ── Header statistik */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚠️ Deteksi Petak Tanpa Polygon</Text>
        {stats && (
          <>
            {/* Overall progress */}
            <View style={styles.overallCard}>
              <View style={styles.overallRow}>
                <Text style={styles.overallLabel}>Progress Mapping Keseluruhan</Text>
                <Text style={styles.overallPct}>{stats.pctOverall}%</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill,
                  { width: `${stats.pctOverall}%` }]} />
              </View>
              <View style={styles.overallNums}>
                <Text style={styles.overallNumGreen}>
                  ✅ {stats.totalMapped} termapping
                </Text>
                <Text style={styles.overallNumRed}>
                  ⚠️ {stats.totalUnmapped} belum
                </Text>
              </View>
            </View>

            {/* Per blok */}
            <View style={styles.blokStatsRow}>
              {stats.bloks.map(b => (
                <View key={b.blok} style={styles.blokStatCard}>
                  <Text style={styles.blokStatNum}>{b.blok}</Text>
                  <View style={styles.blokMiniBar}>
                    <View style={[styles.blokMiniFill,
                      { width: `${b.pct}%` }]} />
                  </View>
                  <Text style={styles.blokStatSub}>
                    {b.mapped}/{b.total}
                  </Text>
                  <Text style={[styles.blokStatPct, {
                    color: b.pct === 100 ? '#2EC97E' :
                           b.pct >= 70  ? '#F0A500' : '#E85454',
                  }]}>
                    {b.pct}%
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* ── Filter blok */}
      <View style={styles.filterRow}>
        {BLOK_LIST.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip,
              blokFilter === f.value && styles.filterChipActive]}
            onPress={() => setBlokFilter(f.value)}
          >
            <Text style={[styles.filterChipText,
              blokFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>
          {wpList.length} belum
        </Text>
      </View>

      {/* ── List WP tanpa polygon */}
      {wpList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>Semua Petak Sudah Termapping!</Text>
          <Text style={styles.emptySub}>
            {blokFilter
              ? `Blok ${blokFilter} sudah 100% punya polygon.`
              : 'Seluruh 847 WP sudah punya polygon di peta.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={wpList}
          keyExtractor={item => item.nop}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={['#0F2D38']}
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Tap WP untuk gambar polygon manual ✏️
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 13, color: '#7A9FAF' },

  // Header
  header:       { backgroundColor: '#0F2D38', padding: 16, paddingTop: 16 },
  headerTitle:  { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 12 },

  // Overall progress card
  overallCard:  { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: 12, marginBottom: 10 },
  overallRow:   { flexDirection: 'row', justifyContent: 'space-between',
                  marginBottom: 6 },
  overallLabel: { fontSize: 11, color: '#A8CFDF', fontWeight: '600' },
  overallPct:   { fontSize: 16, fontWeight: '800', color: '#2EC97E' },
  progressBg:   { height: 8, backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: '#2EC97E', borderRadius: 4 },
  overallNums:  { flexDirection: 'row', justifyContent: 'space-between' },
  overallNumGreen: { fontSize: 11, color: '#2EC97E', fontWeight: '600' },
  overallNumRed:   { fontSize: 11, color: '#E85454', fontWeight: '600' },

  // Per blok stats
  blokStatsRow: { flexDirection: 'row', gap: 8 },
  blokStatCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: 8, alignItems: 'center', gap: 4 },
  blokStatNum:  { fontSize: 11, fontWeight: '700', color: '#fff' },
  blokMiniBar:  { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 2, overflow: 'hidden' },
  blokMiniFill: { height: '100%', backgroundColor: '#2EC97E', borderRadius: 2 },
  blokStatSub:  { fontSize: 9, color: '#7AAFC0' },
  blokStatPct:  { fontSize: 13, fontWeight: '800' },

  // Filter
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff',
                  borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  filterChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  filterChipActive:     { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  filterChipText:       { fontSize: 11, fontWeight: '600', color: '#4A6070' },
  filterChipTextActive: { color: '#fff' },
  countText:    { marginLeft: 'auto', fontSize: 11,
                  color: '#E85454', fontWeight: '700' },

  // List header
  listHeader:   { fontSize: 11, color: '#7A9FAF', textAlign: 'center',
                  paddingVertical: 8 },

  // WP item
  wpItem:       { flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#fff', marginHorizontal: 12,
                  marginTop: 8, borderRadius: 12, overflow: 'hidden',
                  shadowColor: '#000', shadowOpacity: 0.04,
                  shadowRadius: 4, elevation: 1 },
  statusBar:    { width: 4, alignSelf: 'stretch' },
  avatar:       { width: 36, height: 36, borderRadius: 10, margin: 10,
                  alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '800' },
  wpInfo:       { flex: 1, paddingVertical: 10 },
  wpName:       { fontSize: 12, fontWeight: '700', color: '#0F2D38' },
  wpSub:        { fontSize: 10, color: '#7A9FAF', marginTop: 2 },
  drawBtnSmall: { width: 36, height: 36, borderRadius: 10, margin: 10,
                  backgroundColor: '#F0F4F7',
                  alignItems: 'center', justifyContent: 'center' },
  drawBtnSmallText: { fontSize: 16 },

  // Empty state
  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 40, gap: 8 },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { fontSize: 16, fontWeight: '800', color: '#0F2D38' },
  emptySub:     { fontSize: 13, color: '#7A9FAF', textAlign: 'center',
                  lineHeight: 20 },
})
```

---

## 📄 File 3 — Update `app/(tabs)/peta.tsx`

Tambahkan handler untuk menerima parameter `drawForNop` dari tab Deteksi. Tambahkan di bagian atas komponen:

```typescript
// Tambah import
import { useLocalSearchParams } from 'expo-router'

// Tambah di dalam komponen PetaScreen, setelah state declarations:
const params = useLocalSearchParams<{
  drawForNop?: string
  drawForBlok?: string
}>()

// Tambah useEffect untuk handle parameter dari halaman deteksi
useEffect(() => {
  if (params.drawForBlok && params.drawForNop) {
    // Set blok aktif
    setActiveBlok(params.drawForBlok)
    // Tunda sedikit supaya peta selesai load dulu
    setTimeout(() => {
      setIsDrawing(true)
      setDrawPoints([])
      // Simpan NOP target supaya modal langsung pilih WP ini
      setTargetNop(params.drawForNop ?? null)
    }, 500)
  }
}, [params.drawForNop, params.drawForBlok])
```

Tambahkan state baru:
```typescript
const [targetNop, setTargetNop] = useState<string | null>(null)
```

Update fungsi `finishDrawing` — kalau ada `targetNop`, langsung simpan tanpa buka modal pilih WP:

```typescript
const finishDrawing = async () => {
  if (drawPoints.length < 3) {
    Alert.alert('Kurang Titik', 'Minimal 3 titik untuk membentuk polygon.')
    return
  }

  // Kalau ada target NOP (dari halaman deteksi), skip modal
  if (targetNop) {
    const wp = wpList.find(w => w.nop === targetNop)
    if (wp) {
      await handleSavePolygon(wp)
      setTargetNop(null)
      return
    }
  }

  // Normal flow: buka modal pilih WP
  const wps = await getWajibPajak({ blok: activeBlok, limit: 999 })
  setWpList(wps)
  setWpSearch('')
  setShowNopModal(true)
}
```

---

## 📄 Update Tab Label di `app/(tabs)/_layout.tsx`

Ganti tab Distribusi supaya labelnya mencerminkan fitur baru:

```typescript
// Ganti bagian Tab 4 Distribusi
<Tabs.Screen
  name="distribusi"
  options={{
    title: 'Validasi Peta',
    tabBarLabel: 'Validasi',
    tabBarIcon: ({ color, focused }) => (
      <TabIcon emoji="⚠️" focused={focused} color={color} />
    ),
    headerTitle: 'Deteksi Petak Tanpa Polygon',
  }}
/>
```

---

## ▶️ Cara Test Sprint Ini

1. Jalankan `npx expo start`
2. Buka tab **Validasi** (sebelumnya Distribusi)
3. Tampil progress bar keseluruhan: **618/847 = 73%**
4. Per blok: 013, 014, 015 masing-masing dengan persentase
5. Daftar ~229 WP yang belum punya polygon
6. Tap salah satu WP → pindah ke tab Peta, drawing mode aktif otomatis
7. Gambar polygon → tap Selesai → langsung tersimpan ke NOP yang dituju
8. Kembali ke tab Validasi → **pull to refresh** → angka berkurang 1 ✅

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| `useFocusEffect is not exported` | Import dari `expo-router`: `import { useFocusEffect } from 'expo-router'` |
| List tidak berkurang setelah drawing | `useFocusEffect` harus reload saat tab aktif — pastikan sudah diimplementasi |
| `drawForNop` tidak terbaca di peta | Pastikan `useLocalSearchParams` diimport dari `expo-router` |
| Tab label masih "Distribusi" | Update `_layout.tsx` bagian Tab 4 |
| Progress 0% padahal ada polygon | Cek `petakPolygon` di schema — pastikan kolom `nop` terisi saat import JSON |

---

## ✅ Checklist Sprint 7 Selesai

- [ ] `src/db/queries.ts` diupdate — query `getWpTanpaPolygon` & `getMappingStats`
- [ ] `app/(tabs)/distribusi.tsx` diganti total — fitur deteksi aktif
- [ ] `app/(tabs)/peta.tsx` diupdate — terima parameter `drawForNop`
- [ ] `app/(tabs)/_layout.tsx` diupdate — label tab jadi "Validasi"
- [ ] Tab Validasi menampilkan progress bar keseluruhan
- [ ] Per blok 013/014/015 tampil progress masing-masing
- [ ] Daftar ~229 WP tanpa polygon tampil
- [ ] Tap WP → tab Peta terbuka + drawing mode aktif otomatis
- [ ] Setelah gambar → kembali ke Validasi → angka berkurang
- [ ] Filter per blok berfungsi
- [ ] Pull to refresh berfungsi

---

## ➡️ Sprint Berikutnya

**Sprint 8 — Mode Distribusi & Ringkasan Otomatis**  
Dua fitur terakhir sebelum polish final:
- Checklist distribusi SPPT harian per blok
- Auto-generate ringkasan sesi: berapa ditemui, total SPPT, siapa tidak ada
