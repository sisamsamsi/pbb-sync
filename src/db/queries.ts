import { db } from './client'
import { wajibPajak, petakPolygon, georefConfig } from './schema'
import { like, eq, and, or } from 'drizzle-orm'

/**
 * Ambil semua WP dengan filter opsional:
 * - search: nama, NOP, atau nomor petak
 * - blok: '013', '014', '015'
 * - status: 'belum', 'diterima', 'sawah'
 */
export const getWajibPajak = async (params?: {
  search?: string
  blok?: string
  status?: string
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

  // Search nama WP (case-insensitive via LIKE) atau NOP/Petak
  if (search && search.trim().length > 0) {
    const keyword = `%${search.trim().toUpperCase()}%`
    const searchVal = `%${search.trim()}%`
    conditions.push(
      or(
        like(wajibPajak.namaWp, keyword),
        like(wajibPajak.nop, searchVal),
        like(wajibPajak.nomorPetak, searchVal)
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

/**
 * Ambil satu WP berdasarkan NOP lengkap
 */
export const getWajibPajakByNop = async (nop: string) => {
  const result = await db
    .select()
    .from(wajibPajak)
    .where(eq(wajibPajak.nop, nop))
    .limit(1)

  return result[0] ?? null
}

/**
 * Hitung total WP sesuai filter (untuk info ringkasan)
 */
export const countWajibPajak = async (params?: {
  search?: string
  blok?: string
  status?: string
}) => {
  // Simple implementation for now (using select all then length)
  // Proper count() using drizzle-orm can be added if performance is an issue
  const all = await getWajibPajak({ ...params, limit: 10000, offset: 0 })
  return all.length
}

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
