# Sprint 2 — Import Excel Byname ke SQLite

**Project:** PBB Sync  
**Sprint:** 2 dari 10  
**Estimasi:** 1-2 hari  
**Status:** 🔵 Ready to Start  
**Prerequisite:** Sprint 1 selesai ✅

---

## 🎯 Tujuan Sprint Ini

Membuat fitur import file Excel dari BKAD langsung masuk ke database lokal:
- Service parsing Excel → ekstrak kolom yang dibutuhkan
- Auto-parse NOP → blok + nomor petak otomatis
- Handle data sawah (jumlah_sppt = 0) → status `exempt`
- Layar import sederhana dengan feedback progress

**Hasil akhir sprint ini:** Bisa pilih file Excel dari HP → data masuk ke SQLite → tampil jumlah record terimport.

---

## 📁 File yang Dibuat / Diubah Sprint Ini

```
src/
├── services/
│   └── import.service.ts    ← BUAT BARU
└── (file lain belum disentuh)

app/(tabs)/
└── index.tsx                ← UPDATE (tambah tombol import sementara)
```

---

## 📄 File 1 — `src/services/import.service.ts`

```typescript
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { read, utils } from 'xlsx'
import { db } from '../db/client'
import { wajibPajak } from '../db/schema'

// ── Tipe data satu baris Excel
interface ExcelRow {
  NOP: string
  Kapanewon: string
  Kalurahan: string
  Padukuhan: string
  'Tahun Pajak': string | number
  'Wajib Pajak': string
  'Alamat Objek': string
  'Alamat Wajib Pajak': string
  'Luas Bumi': number
  'Luas Bng': number
  Jumlah: number
}

// ── Hasil import
export interface ImportResult {
  success: boolean
  totalRows: number
  imported: number
  skipped: number
  errors: string[]
}

// ── Parse NOP → blok dan nomor petak
// Contoh NOP: 34.02.070.002.013.0001.0
// Posisi:      0   1   2   3   4    5  6
const parseNop = (nop: string): { blok: string; nomorPetak: string } | null => {
  const parts = nop.trim().split('.')
  if (parts.length < 6) return null
  return {
    blok: parts[4],       // '013'
    nomorPetak: parts[5], // '0001'
  }
}

// ── Tentukan status bayar
// Sawah/bebas pajak di Bantul → jumlah = 0 → 'exempt'
const getStatusBayar = (jumlah: number): string => {
  if (jumlah === 0) return 'exempt'
  return 'belum'
}

// ── Main: pilih file dan import
export const importExcelByname = async (
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  }

  try {
    // 1. Buka file picker
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        '*/*',
      ],
      copyToCacheDirectory: true,
    })

    if (picked.canceled || !picked.assets?.[0]) {
      result.errors.push('Tidak ada file yang dipilih')
      return result
    }

    const fileUri = picked.assets[0].uri

    // 2. Baca file sebagai base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // 3. Parse Excel
    const workbook = read(base64, { type: 'base64' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: ExcelRow[] = utils.sheet_to_json(worksheet)

    result.totalRows = rows.length

    // 4. Insert ke database satu per satu
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      onProgress?.(i + 1, rows.length)

      try {
        const nopRaw = String(row.NOP ?? '').trim()
        if (!nopRaw) {
          result.skipped++
          continue
        }

        const parsed = parseNop(nopRaw)
        if (!parsed) {
          result.errors.push(`NOP tidak valid: ${nopRaw}`)
          result.skipped++
          continue
        }

        const jumlah = Number(row.Jumlah ?? 0)

        // Insert atau skip kalau NOP sudah ada
        await db
          .insert(wajibPajak)
          .values({
            nop: nopRaw,
            blok: parsed.blok,
            nomorPetak: parsed.nomorPetak,
            namaWp: String(row['Wajib Pajak'] ?? '').trim(),
            padukuhan: String(row.Padukuhan ?? '').trim(),
            alamatObjek: String(row['Alamat Objek'] ?? '').trim(),
            alamatWp: String(row['Alamat Wajib Pajak'] ?? '').trim(),
            luasBumi: Number(row['Luas Bumi'] ?? 0),
            luasBangunan: Number(row['Luas Bng'] ?? 0),
            jumlahSppt: jumlah,
            statusBayar: getStatusBayar(jumlah),
            tahunPajak: String(row['Tahun Pajak'] ?? '2026'),
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing() // Skip kalau NOP sudah ada

        result.imported++
      } catch (rowError) {
        result.errors.push(`Baris ${i + 2}: ${String(rowError)}`)
        result.skipped++
      }
    }

    result.success = true
    return result

  } catch (error) {
    result.errors.push(`Error: ${String(error)}`)
    return result
  }
}

// ── Ambil statistik data yang sudah ada di DB
export const getDbStats = async () => {
  const semua = await db.select().from(wajibPajak)
  const blok013 = semua.filter(w => w.blok === '013')
  const blok014 = semua.filter(w => w.blok === '014')
  const blok015 = semua.filter(w => w.blok === '015')
  const exempt  = semua.filter(w => w.statusBayar === 'exempt')

  return {
    total: semua.length,
    blok013: blok013.length,
    blok014: blok014.length,
    blok015: blok015.length,
    exempt: exempt.length,
    belumBayar: semua.filter(w => w.statusBayar === 'belum').length,
  }
}

// ── Reset semua data (untuk re-import)
export const resetDatabase = async () => {
  await db.delete(wajibPajak)
}
```

---

## 📄 File 2 — Update `app/(tabs)/index.tsx`

Ganti seluruh isi file dengan kode berikut:

```typescript
import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView
} from 'react-native'
import { useState, useEffect } from 'react'
import { importExcelByname, getDbStats, resetDatabase } from '@/src/services/import.service'

export default function DashboardScreen() {
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [stats, setStats]       = useState<Awaited<ReturnType<typeof getDbStats>> | null>(null)

  // Load statistik saat layar dibuka
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const s = await getDbStats()
    setStats(s)
  }

  const handleImport = async () => {
    setLoading(true)
    setProgress({ current: 0, total: 0 })

    const result = await importExcelByname((current, total) => {
      setProgress({ current, total })
    })

    setLoading(false)

    if (result.success) {
      await loadStats()
      Alert.alert(
        '✅ Import Selesai',
        `Berhasil: ${result.imported} data\nDilewati: ${result.skipped} data\nTotal: ${result.totalRows} baris`,
        [{ text: 'OK' }]
      )
    } else {
      Alert.alert(
        '❌ Import Gagal',
        result.errors[0] ?? 'Terjadi kesalahan',
        [{ text: 'OK' }]
      )
    }
  }

  const handleReset = () => {
    Alert.alert(
      '⚠️ Reset Data',
      'Semua data wajib pajak akan dihapus. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase()
            await loadStats()
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PBB Sync</Text>
        <Text style={styles.headerSub}>Kalurahan Ringinharjo · 2026</Text>
      </View>

      {/* Statistik DB */}
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>📊 Data Terkini</Text>
        {stats ? (
          <View style={styles.statsGrid}>
            <StatItem label="Total WP" value={stats.total} color="#0F2D38" />
            <StatItem label="Blok 013"  value={stats.blok013} color="#2E6E82" />
            <StatItem label="Blok 014"  value={stats.blok014} color="#2E6E82" />
            <StatItem label="Blok 015"  value={stats.blok015} color="#2E6E82" />
            <StatItem label="Sawah/Bebas" value={stats.exempt} color="#F0A500" />
            <StatItem label="Belum Bayar" value={stats.belumBayar} color="#E85454" />
          </View>
        ) : (
          <Text style={styles.emptyText}>Belum ada data. Import Excel terlebih dahulu.</Text>
        )}
      </View>

      {/* Progress bar saat import */}
      {loading && progress.total > 0 && (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            Mengimport... {progress.current} / {progress.total}
          </Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${(progress.current / progress.total) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Tombol Import */}
      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={handleImport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>📥  Import Excel Byname</Text>
        )}
      </TouchableOpacity>

      {/* Tombol Reset (hanya tampil kalau ada data) */}
      {stats && stats.total > 0 && (
        <TouchableOpacity style={styles.btnDanger} onPress={handleReset}>
          <Text style={styles.btnText}>🗑  Reset Semua Data</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

// ── Komponen stat item kecil
function StatItem({ label, value, color }: {
  label: string; value: number; color: string
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNum, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ── Styles
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },
  header:       { backgroundColor: '#0F2D38', padding: 24, paddingTop: 56 },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 13, color: '#7AAFC0', marginTop: 4 },

  statsCard:    { backgroundColor: '#fff', margin: 16, borderRadius: 16,
                  padding: 16, shadowColor: '#000', shadowOpacity: 0.06,
                  shadowRadius: 8, elevation: 2 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: '#0F2D38', marginBottom: 12 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem:     { backgroundColor: '#F0F4F7', borderRadius: 10,
                  padding: 10, minWidth: '30%', alignItems: 'center' },
  statNum:      { fontSize: 22, fontWeight: '800' },
  statLabel:    { fontSize: 10, color: '#7A9FAF', marginTop: 2 },
  emptyText:    { fontSize: 12, color: '#B0BEC8', textAlign: 'center', padding: 12 },

  progressCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
                  borderRadius: 12, padding: 14 },
  progressText: { fontSize: 12, color: '#4A6070', marginBottom: 8 },
  progressBg:   { height: 6, backgroundColor: '#E8EDF2', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2EC97E', borderRadius: 3 },

  btnPrimary:   { backgroundColor: '#0F2D38', margin: 16, marginTop: 8,
                  borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDanger:    { backgroundColor: '#E85454', marginHorizontal: 16, marginTop: 0,
                  marginBottom: 16, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
})
```

---

## ▶️ Cara Test Sprint Ini

1. Jalankan app: `npx expo start`
2. Buka di HP → layar Dashboard tampil dengan statistik kosong
3. Tap **"Import Excel Byname"**
4. Pilih file Excel sample dari BKAD (`Sample_Draf_DHKP_Pajak_PBB_2026.xlsx`)
5. Tunggu progress bar selesai
6. Alert muncul: **"✅ Import Selesai — Berhasil: 99 data"**
7. Statistik update otomatis → tampil jumlah per blok

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| `xlsx is not defined` | Jalankan `npm install xlsx` |
| `Cannot read NOP` | Pastikan kolom Excel bernama persis `NOP` (kapital) |
| File picker tidak muncul | Pastikan `expo-document-picker` sudah terinstall |
| `0 data imported` | Cek nama sheet Excel — harus `Sheet1` atau sheet pertama |
| Build error di EAS | Cek apakah `expo-document-picker` sudah ada di `package.json` |

---

## ✅ Checklist Sprint 2 Selesai

- [ ] `src/services/import.service.ts` sudah dibuat
- [ ] `app/(tabs)/index.tsx` sudah diupdate
- [ ] App jalan tanpa error
- [ ] Tombol import muncul di layar
- [ ] File Excel bisa dipilih dari HP
- [ ] Data masuk ke DB — statistik tampil setelah import
- [ ] Tombol reset berfungsi

---

## ➡️ Sprint Berikutnya

**Sprint 3 — List & Search Wajib Pajak**  
Setelah data masuk ke DB, kita buat layar daftar WP lengkap dengan search, filter per blok, dan navigasi ke detail.
