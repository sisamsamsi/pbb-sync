# Sprint 3 — List & Search Wajib Pajak

**Project:** PBB Sync  
**Sprint:** 3 dari 10  
**Estimasi:** 1-2 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 2 selesai ✅ (847 data WP sudah di DB)

---

## 🎯 Tujuan Sprint Ini

Membuat layar daftar wajib pajak yang bisa:
- Tampil semua WP dari DB dengan scroll
- Search realtime by nama WP
- Filter by blok (013 / 014 / 015 / Semua)
- Tap item → navigasi ke halaman detail WP
- Tampil badge status (belum / lunas / exempt)

**Hasil akhir sprint ini:** Layar byname fungsional — bisa cari nama WP dan lihat detailnya.

---

## 📁 File yang Dibuat / Diubah Sprint Ini

```
src/
└── db/
    └── queries.ts              ← BUAT BARU (query helpers)

app/(tabs)/
└── byname.tsx                  ← BUAT/UPDATE (layar list WP)

app/wp/
└── [nop].tsx                   ← BUAT BARU (halaman detail WP)
```

---

## 📄 File 1 — `src/db/queries.ts`

```typescript
import { db } from './client'
import { wajibPajak } from './schema'
import { like, eq, and, or } from 'drizzle-orm'

// ── Ambil semua WP dengan filter opsional
export const getWajibPajak = async (params?: {
  search?: string
  blok?: string        // '013' | '014' | '015' | undefined = semua
  status?: string      // 'belum' | 'lunas' | 'exempt' | undefined = semua
  limit?: number
  offset?: number
}) => {
  const { search, blok, status, limit = 50, offset = 0 } = params ?? {}

  const conditions = []

  // Filter blok
  if (blok) {
    conditions.push(eq(wajibPajak.blok, blok))
  }

  // Filter status
  if (status) {
    conditions.push(eq(wajibPajak.statusBayar, status))
  }

  // Search nama WP (case-insensitive via LIKE)
  if (search && search.trim().length > 0) {
    const keyword = `%${search.trim().toUpperCase()}%`
    conditions.push(
      or(
        like(wajibPajak.namaWp, keyword),
        like(wajibPajak.nop, `%${search.trim()}%`),
        like(wajibPajak.nomorPetak, `%${search.trim()}%`)
      )
    )
  }

  const result = await db
    .select()
    .from(wajibPajak)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset)
    .orderBy(wajibPajak.blok, wajibPajak.nomorPetak)

  return result
}

// ── Ambil satu WP by NOP
export const getWajibPajakByNop = async (nop: string) => {
  const result = await db
    .select()
    .from(wajibPajak)
    .where(eq(wajibPajak.nop, nop))
    .limit(1)

  return result[0] ?? null
}

// ── Hitung total WP (untuk pagination info)
export const countWajibPajak = async (params?: {
  search?: string
  blok?: string
  status?: string
}) => {
  const all = await getWajibPajak({ ...params, limit: 9999, offset: 0 })
  return all.length
}
```

---

## 📄 File 2 — `app/(tabs)/byname.tsx`

Ganti seluruh isi file (atau buat baru jika belum ada):

```typescript
import {
  View, Text, StyleSheet, FlatList,
  TextInput, TouchableOpacity, ActivityIndicator
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { router } from 'expo-router'
import { getWajibPajak } from '@/src/db/queries'

// ── Tipe data WP dari DB
type WP = Awaited<ReturnType<typeof getWajibPajak>>[number]

// ── Filter blok
const BLOK_FILTERS = [
  { label: 'Semua', value: undefined },
  { label: 'Blok 013', value: '013' },
  { label: 'Blok 014', value: '014' },
  { label: 'Blok 015', value: '015' },
]

// ── Filter status
const STATUS_FILTERS = [
  { label: 'Semua', value: undefined },
  { label: 'Belum', value: 'belum' },
  { label: 'Lunas', value: 'lunas' },
  { label: 'Sawah', value: 'exempt' },
]

export default function BynameScreen() {
  const [data, setData]           = useState<WP[]>([])
  const [search, setSearch]       = useState('')
  const [blokFilter, setBlokFilter]     = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)

  const PAGE_SIZE = 30

  // Load data
  const loadData = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)

    const currentPage = reset ? 0 : page
    const result = await getWajibPajak({
      search,
      blok: blokFilter,
      status: statusFilter,
      limit: PAGE_SIZE,
      offset: currentPage * PAGE_SIZE,
    })

    if (reset) {
      setData(result)
      setPage(1)
    } else {
      setData(prev => [...prev, ...result])
      setPage(prev => prev + 1)
    }

    setHasMore(result.length === PAGE_SIZE)
    setLoading(false)
  }, [search, blokFilter, statusFilter, page, loading])

  // Reset & reload saat filter berubah
  useEffect(() => {
    setPage(0)
    setHasMore(true)
    loadData(true)
  }, [search, blokFilter, statusFilter])

  const handleLoadMore = () => {
    if (hasMore && !loading) loadData(false)
  }

  const handleTapWP = (nop: string) => {
    router.push(`/wp/${encodeURIComponent(nop)}`)
  }

  // ── Render satu item WP
  const renderItem = ({ item }: { item: WP }) => (
    <TouchableOpacity
      style={styles.wpItem}
      onPress={() => handleTapWP(item.nop)}
      activeOpacity={0.7}
    >
      {/* Garis status kiri */}
      <View style={[styles.statusBar, {
        backgroundColor:
          item.statusBayar === 'lunas'  ? '#2EC97E' :
          item.statusBayar === 'exempt' ? '#F0A500' : '#E85454'
      }]} />

      {/* Avatar inisial */}
      <View style={[styles.avatar, {
        backgroundColor:
          item.statusBayar === 'lunas'  ? '#DCFCE7' :
          item.statusBayar === 'exempt' ? '#FEF3C7' : '#FEE2E2'
      }]}>
        <Text style={[styles.avatarText, {
          color:
            item.statusBayar === 'lunas'  ? '#16A34A' :
            item.statusBayar === 'exempt' ? '#D97706' : '#DC2626'
        }]}>
          {item.namaWp.charAt(0)}
        </Text>
      </View>

      {/* Info WP */}
      <View style={styles.wpInfo}>
        <Text style={styles.wpName} numberOfLines={1}>
          {item.namaWp}
        </Text>
        <Text style={styles.wpNop}>
          {item.blok}-{item.nomorPetak} · {item.padukuhan ?? '-'}
        </Text>
      </View>

      {/* SPPT + Status */}
      <View style={styles.wpRight}>
        <Text style={styles.wpSppt}>
          {item.jumlahSppt === 0
            ? 'Bebas'
            : `Rp ${item.jumlahSppt.toLocaleString('id-ID')}`}
        </Text>
        <Text style={[styles.wpStatus, {
          color:
            item.statusBayar === 'lunas'  ? '#16A34A' :
            item.statusBayar === 'exempt' ? '#D97706' : '#DC2626'
        }]}>
          {item.statusBayar === 'lunas'  ? '✓ Lunas' :
           item.statusBayar === 'exempt' ? '🌾 Sawah' : '✗ Belum'}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Data Wajib Pajak</Text>

        {/* Search box */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / nomor petak / NOP..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Blok */}
      <View style={styles.filterRow}>
        {BLOK_FILTERS.map(f => (
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
      </View>

      {/* Filter Status */}
      <View style={[styles.filterRow, { paddingTop: 0 }]}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip,
              statusFilter === f.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText,
              statusFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>{data.length} WP</Text>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={item => item.nop}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading ? <ActivityIndicator color="#0F2D38" style={{ padding: 16 }} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Tidak ada data ditemukan</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },

  // Header
  header:       { backgroundColor: '#0F2D38', padding: 16, paddingTop: 52 },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 12 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchIcon:   { fontSize: 14 },
  searchInput:  { flex: 1, color: '#fff', fontSize: 13, padding: 0 },

  // Filter
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff',
                  borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  filterChip:   { paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 8, backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  filterChipActive: { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  filterChipText:   { fontSize: 11, fontWeight: '600', color: '#4A6070' },
  filterChipTextActive: { color: '#fff' },
  countText:    { marginLeft: 'auto', fontSize: 11, color: '#B0BEC8', fontWeight: '500' },

  // List
  listContent:  { paddingBottom: 24 },
  wpItem:       { flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8,
                  borderRadius: 12, overflow: 'hidden',
                  shadowColor: '#000', shadowOpacity: 0.04,
                  shadowRadius: 4, elevation: 1 },
  statusBar:    { width: 4, alignSelf: 'stretch' },
  avatar:       { width: 36, height: 36, borderRadius: 10, margin: 10,
                  alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '800' },
  wpInfo:       { flex: 1, paddingVertical: 10 },
  wpName:       { fontSize: 12, fontWeight: '700', color: '#0F2D38' },
  wpNop:        { fontSize: 10, color: '#7A9FAF', marginTop: 2 },
  wpRight:      { paddingRight: 12, alignItems: 'flex-end' },
  wpSppt:       { fontSize: 11, fontWeight: '700', color: '#0F2D38' },
  wpStatus:     { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Empty
  emptyBox:     { padding: 40, alignItems: 'center' },
  emptyText:    { fontSize: 13, color: '#B0BEC8' },
})
```

---

## 📄 File 3 — `app/wp/[nop].tsx`

Buat file baru untuk halaman detail WP:

```typescript
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { getWajibPajakByNop } from '@/src/db/queries'

type WP = Awaited<ReturnType<typeof getWajibPajakByNop>>

export default function DetailWPScreen() {
  const { nop } = useLocalSearchParams<{ nop: string }>()
  const [wp, setWp] = useState<WP>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (nop) {
      loadWP(decodeURIComponent(nop))
    }
  }, [nop])

  const loadWP = async (nopStr: string) => {
    setLoading(true)
    const data = await getWajibPajakByNop(nopStr)
    setWp(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    )
  }

  if (!wp) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Data tidak ditemukan</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#0F2D38', marginTop: 12 }}>← Kembali</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isExempt = wp.statusBayar === 'exempt'
  const isLunas  = wp.statusBayar === 'lunas'

  const statusColor  = isLunas ? '#2EC97E' : isExempt ? '#F0A500' : '#E85454'
  const statusLabel  = isLunas ? '✓ Lunas' : isExempt ? '🌾 Sawah/Bebas Pajak' : '⏳ Belum Bayar'

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.namaWp}>{wp.namaWp}</Text>
        <Text style={styles.nopText}>{wp.nop}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor,
          backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* SPPT Card */}
        <View style={styles.spptCard}>
          <View>
            <Text style={styles.spptLabel}>Jumlah SPPT Terutang</Text>
            <Text style={styles.spptValue}>
              {isExempt ? 'Bebas Pajak' :
                `Rp ${wp.jumlahSppt?.toLocaleString('id-ID') ?? '0'}`}
            </Text>
            <Text style={styles.spptYear}>Tahun Pajak {wp.tahunPajak}</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🧾</Text>
        </View>

        {/* Data Objek */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DATA OBJEK PAJAK</Text>
          <InfoRow label="Blok" value={wp.blok} />
          <InfoRow label="Nomor Petak" value={wp.nomorPetak} />
          <InfoRow label="Luas Bumi" value={`${wp.luasBumi?.toLocaleString('id-ID') ?? 0} m²`} />
          <InfoRow label="Luas Bangunan" value={`${wp.luasBangunan?.toLocaleString('id-ID') ?? 0} m²`} />
          <InfoRow label="Padukuhan" value={wp.padukuhan ?? '-'} />
        </View>

        {/* Alamat */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ALAMAT</Text>
          <InfoRow label="Objek Pajak" value={wp.alamatObjek ?? '-'} />
          <InfoRow label="Wajib Pajak" value={wp.alamatWp ?? '-'} />
        </View>

        {/* Tombol Aksi */}
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => Alert.alert('Info', 'Fitur peta tersedia di Sprint 5')}
        >
          <Text style={styles.btnOutlineText}>🗺️  Lihat Posisi di Peta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ── Komponen baris info
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F0F4F7' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#B0BEC8', fontSize: 14 },

  // Header
  header:      { backgroundColor: '#0F2D38', padding: 20, paddingTop: 52 },
  backBtn:     { marginBottom: 12 },
  backText:    { color: '#7AAFC0', fontSize: 13 },
  namaWp:      { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26 },
  nopText:     { fontSize: 11, color: '#7AAFC0', marginTop: 4,
                 fontFamily: 'monospace', letterSpacing: 0.5 },
  statusBadge: { alignSelf: 'flex-start', marginTop: 10,
                 paddingHorizontal: 12, paddingVertical: 5,
                 borderRadius: 10, borderWidth: 1 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  // Body
  body:        { padding: 16 },

  // SPPT Card
  spptCard:    { backgroundColor: '#0F2D38', borderRadius: 16, padding: 16,
                 flexDirection: 'row', justifyContent: 'space-between',
                 alignItems: 'center', marginBottom: 12 },
  spptLabel:   { fontSize: 11, color: '#7AAFC0', marginBottom: 4 },
  spptValue:   { fontSize: 22, fontWeight: '800', color: '#fff' },
  spptYear:    { fontSize: 10, color: '#7AAFC0', marginTop: 2 },

  // Card
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 14,
                 marginBottom: 12, shadowColor: '#000',
                 shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTitle:   { fontSize: 9, fontWeight: '700', color: '#7A9FAF',
                 letterSpacing: 1, marginBottom: 10 },

  // Info Row
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between',
                 paddingVertical: 5,
                 borderBottomWidth: 1, borderBottomColor: '#F0F4F7' },
  infoLabel:   { fontSize: 12, color: '#7A9FAF' },
  infoValue:   { fontSize: 12, fontWeight: '600', color: '#0F2D38',
                 flex: 1, textAlign: 'right', marginLeft: 8 },

  // Button
  btnOutline:  { borderWidth: 1.5, borderColor: '#0F2D38', borderRadius: 14,
                 padding: 14, alignItems: 'center', marginBottom: 24 },
  btnOutlineText: { color: '#0F2D38', fontWeight: '700', fontSize: 14 },
})
```

---

## ▶️ Cara Test Sprint Ini

1. Jalankan: `npx expo start`
2. Tap **Tab Byname** (tab ke-2, masih bernama "Tab Two")
3. Daftar 847 WP harus tampil dengan scroll
4. Ketik nama di search box → list filter realtime
5. Tap filter **Blok 013** → hanya tampil 324 WP
6. Tap filter **Sawah** → tampil 267 WP dengan label 🌾
7. Tap salah satu WP → halaman detail terbuka
8. Halaman detail tampil: nama, NOP, SPPT, alamat, luas

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| `like is not exported from drizzle-orm` | Pastikan import: `import { like, eq, and, or } from 'drizzle-orm'` |
| List kosong setelah filter | Cek nama kolom di query, pastikan `blok` bukan `blok_id` |
| Detail screen tidak terbuka | Pastikan folder `app/wp/` sudah ada dan file `[nop].tsx` di dalamnya |
| `router.push` error | Pastikan `expo-router` sudah terpasang dan `_layout.tsx` menggunakan Stack |
| Search tidak responsif | Tambah `debounce` di `useEffect` jika perlu (opsional untuk 847 data) |

---

## ✅ Checklist Sprint 3 Selesai

- [ ] `src/db/queries.ts` sudah dibuat
- [ ] `app/(tabs)/byname.tsx` sudah diupdate
- [ ] `app/wp/[nop].tsx` sudah dibuat
- [ ] List 847 WP tampil dengan scroll
- [ ] Search by nama berjalan realtime
- [ ] Filter blok & status berjalan
- [ ] Tap WP → halaman detail terbuka
- [ ] Detail menampilkan: nama, NOP, SPPT, luas, alamat

---

## ➡️ Sprint Berikutnya

**Sprint 4 — Tab Navigation + PDF Viewer**  
Rapikan tab bar (ganti nama Tab One/Two), tambahkan tab Peta dan Distribusi, lalu buat PDF viewer untuk membaca peta blok PBB.
