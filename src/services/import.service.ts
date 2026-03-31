import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { File } from 'expo-file-system'
import { read, utils } from 'xlsx'
import { db } from '../db/client'
import { wajibPajak, petakPolygon } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'

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
// Sawah/bebas pajak di Bantul → jumlah = 0 → 'sawah'
const getStatusBayar = (jumlah: number): string => {
  if (jumlah === 0) return 'sawah'
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
    const base64 = await new File(fileUri).base64()

    // 3. Parse Excel
    const workbook = read(base64, { type: 'base64' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = utils.sheet_to_json<ExcelRow>(worksheet)

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
  const sawah  = semua.filter(w => w.statusBayar === 'sawah')

  return {
    total: semua.length,
    blok013: blok013.length,
    blok014: blok014.length,
    blok015: blok015.length,
    sawah: sawah.length,
    belumBayar: semua.filter(w => w.statusBayar === 'belum').length,
  }
}

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

    const content = await new File(picked.assets[0].uri).text()
    const records: PolygonRecord[] = JSON.parse(content)

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

// ── Reset semua data (WP + Peta)
export const resetDatabase = async () => {
  await db.delete(wajibPajak)
  await db.delete(petakPolygon)
}

// ── Reset hanya data Peta/Polygon
export const resetPolygons = async () => {
  await db.delete(petakPolygon)
}

// ── Ambil list WP yang belum punya polygon (Data DHKP)
export const getUnmappedDhkp = async (blok: string) => {
  const allWp = await db.select({
    nop: wajibPajak.nop,
    namaWp: wajibPajak.namaWp,
    nomorPetak: wajibPajak.nomorPetak,
  })
  .from(wajibPajak)
  .where(eq(wajibPajak.blok, blok))

  const existingPolygons = await db.select({ nop: petakPolygon.nop })
    .from(petakPolygon)
    .where(eq(petakPolygon.blok, blok))

  const mappedNops = new Set(existingPolygons.map(p => p.nop))

  return allWp.filter(wp => !mappedNops.has(wp.nop))
}

export const saveManualPolygon = async (params: {
  nop: string,
  blok: string,
  num: string,
  points: { lat: number, lng: number }[]
}) => {
  try {
    await db.insert(petakPolygon).values({
      blok: params.blok,
      nomorPetak: params.num,
      nop: params.nop,
      points: JSON.stringify(params.points),
    })
    return { success: true }
  } catch (err) {
    console.error('Error saving manual polygon:', err)
    return { success: false, error: String(err) }
  }
}
