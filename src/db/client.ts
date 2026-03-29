import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema'

// Buka / buat database file lokal
const sqlite = openDatabaseSync('pbb_sync.db')

// Inisialisasi Drizzle dengan schema
export const db = drizzle(sqlite, { schema })

// Buat semua tabel kalau belum ada
export const initDatabase = () => {
  console.log('⏳ Menjalankan initDatabase PBB Sync...');
  try {
    sqlite.execSync(`
      CREATE TABLE IF NOT EXISTS wajib_pajak (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nop TEXT NOT NULL UNIQUE,
        blok TEXT NOT NULL,
        nomor_petak TEXT NOT NULL,
        nama_wp TEXT NOT NULL,
        padukuhan TEXT,
        alamat_objek TEXT,
        alamat_wp TEXT,
        luas_bumi REAL DEFAULT 0,
        luas_bangunan REAL DEFAULT 0,
        jumlah_sppt REAL DEFAULT 0,
        status_bayar TEXT DEFAULT 'belum',
        tahun_pajak TEXT DEFAULT '2026',
        catatan TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS petak_polygon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blok TEXT NOT NULL,
        nomor_petak TEXT NOT NULL,
        nop TEXT,
        points TEXT,
        is_georef INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS georef_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blok TEXT NOT NULL UNIQUE,
        control_points TEXT,
        pdf_width REAL,
        pdf_height REAL,
        is_ready INTEGER DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sesi_distribusi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        blok TEXT,
        catatan TEXT,
        selesai INTEGER DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS log_distribusi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesi_id INTEGER NOT NULL,
        nop TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ditemui',
        waktu TEXT,
        catatan TEXT
      );
    `);

    // Migrasi data lama ke terminologi baru
    sqlite.execSync(`
      UPDATE wajib_pajak SET status_bayar = 'sawah' WHERE status_bayar = 'exempt';
      UPDATE wajib_pajak SET status_bayar = 'diterima' WHERE status_bayar = 'lunas';
    `);

    console.log('✅ Database PBB Sync siap (Tabel & migrasi data berhasil)');
  } catch (error) {
    console.error('❌ Error saat inisialisasi Database PBB Sync:', error);
  }
}

