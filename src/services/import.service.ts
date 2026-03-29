import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
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
