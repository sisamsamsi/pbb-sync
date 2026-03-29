import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ── Tabel utama wajib pajak
export const wajibPajak = sqliteTable('wajib_pajak', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // NOP lengkap contoh: 34.02.070.002.013.0001.0
  nop: text('nop').notNull().unique(),

  // Dipecah untuk kemudahan query & link ke peta
  blok: text('blok').notNull(),              // '013'
  nomorPetak: text('nomor_petak').notNull(), // '0001'

  // Data wajib pajak
  namaWp: text('nama_wp').notNull(),
  padukuhan: text('padukuhan'),
  alamatObjek: text('alamat_objek'),
  alamatWp: text('alamat_wp'),

  // Ukuran tanah & bangunan
  luasBumi: real('luas_bumi').default(0),
  luasBangunan: real('luas_bangunan').default(0),

  // Pajak
  jumlahSppt: real('jumlah_sppt').default(0),

  // belum | lunas | sawah (sawah/bebas pajak)
  statusBayar: text('status_bayar').default('belum'),

  tahunPajak: text('tahun_pajak').default('2026'),
  catatan: text('catatan'),
  createdAt: text('created_at'),
})

// ── Tabel polygon petak peta
export const petakPolygon = sqliteTable('petak_polygon', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  blok: text('blok').notNull(),              // '013'
  nomorPetak: text('nomor_petak').notNull(), // '0001'
  nop: text('nop'),                          // FK ke wajib_pajak

  // Koordinat polygon GPS dalam JSON string
  // Format: '[{"lat":-7.882,"lng":110.331},{"lat":...},...]'
  points: text('points'),

  // Status georeferencing blok ini sudah dilakukan atau belum
  isGeoref: integer('is_georef', { mode: 'boolean' }).default(false),
})

// ── Tabel konfigurasi georeferencing per blok
export const georefConfig = sqliteTable('georef_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  blok: text('blok').notNull().unique(),     // '013'

  // 4 titik kontrol: pixel PDF <-> GPS
  // Format JSON: '[{"px":120,"py":340,"lat":-7.88,"lng":110.33},...]'
  controlPoints: text('control_points'),

  // Dimensi PDF asli (untuk kalkulasi transform)
  pdfWidth: real('pdf_width'),
  pdfHeight: real('pdf_height'),

  isReady: integer('is_ready', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
})

// ── Tabel sesi distribusi
export const sesiDistribusi = sqliteTable('sesi_distribusi', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tanggal: text('tanggal').notNull(),        // '2026-03-27'
  blok: text('blok'),                        // null = semua blok
  catatan: text('catatan'),
  selesai: integer('selesai', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
})

// ── Tabel log distribusi per WP per sesi
export const logDistribusi = sqliteTable('log_distribusi', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sesiId: integer('sesi_id').notNull(),      // FK ke sesi_distribusi
  nop: text('nop').notNull(),                // FK ke wajib_pajak

  // ditemui | tidak_ada | lain
  status: text('status').notNull().default('ditemui'),
  waktu: text('waktu'),                      // '09:15'
  catatan: text('catatan'),
})
