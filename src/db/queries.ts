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
// ── Ambil semua WP yang BELUM punya polygon yang valid (min 3 titik)
export const getWpTanpaPolygon = async (blok?: string) => {
  const polygons = await db.select().from(petakPolygon)
  const mappedNops = new Set(
    polygons
      .filter(p => {
        if (!p.nop || !p.points) return false
        try {
          const pts = JSON.parse(p.points)
          return Array.isArray(pts) && pts.length >= 3
        } catch (e) {
          return false
        }
      })
      .map(p => (p.nop as string).trim())
  )

  const query = db.select().from(wajibPajak)
  if (blok) {
    query.where(eq(wajibPajak.blok, blok))
  }
  
  const semuaWpArr = await query.orderBy(wajibPajak.blok, wajibPajak.nomorPetak)
  return semuaWpArr.filter(wp => !mappedNops.has(wp.nop.trim()))
}

// ── Statistik mapping per blok (yang valid min 3 titik)
export const getMappingStats = async () => {
  const semua    = await db.select().from(wajibPajak)
  const polygons = await db.select().from(petakPolygon)

  const mappedNops = new Set(
    polygons
      .filter(p => {
        if (!p.nop || !p.points) return false
        try {
          const pts = JSON.parse(p.points)
          return Array.isArray(pts) && pts.length >= 3
        } catch (e) {
          return false
        }
      })
      .map(p => (p.nop as string).trim())
  )

  const stats = ['013', '014', '015'].map(blok => {
    const wpBlok    = semua.filter(w => w.blok === blok)
    const mapped    = wpBlok.filter(w => mappedNops.has(w.nop.trim()))
    return {
      blok,
      total:    wpBlok.length,
      mapped:   mapped.length,
      unmapped: wpBlok.length - mapped.length,
      pct:      wpBlok.length > 0
        ? Math.round((mapped.length / wpBlok.length) * 100)
        : 0,
    }
  })

  const totalWp      = semua.length
  const totalMapped  = semua.filter(w => mappedNops.has(w.nop.trim())).length

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

/**
 * PEMBERSIHAN: Hapus semua polygon yang tidak valid (titik < 3)
 * agar WP muncul kembali di daftar Validasi untuk digambar manual.
 */
export const cleanupInvalidPolygons = async () => {
  const all = await db.select().from(petakPolygon)
  const invalidIds: number[] = []

  for (const p of all) {
    let isValid = false
    if (p.points) {
      try {
        const pts = JSON.parse(p.points)
        if (Array.isArray(pts) && pts.length >= 3) {
          isValid = true
        }
      } catch (e) {}
    }

    if (!isValid) {
      invalidIds.push(p.id)
    }
  }

  if (invalidIds.length > 0) {
    // Delete one by one if using older sqlite, 
    // but in expo-sqlite we can use multiple delete
    for (const id of invalidIds) {
      await db.delete(petakPolygon).where(eq(petakPolygon.id, id))
    }
  }

  return invalidIds.length
}
