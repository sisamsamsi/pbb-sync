# Sprint 1 — Database Schema & Koneksi DB

**Project:** PBB Sync  
**Sprint:** 1 dari 10  
**Estimasi:** 1 hari  
**Status:** 🔵 Ready to Start

---

## 🎯 Tujuan Sprint Ini

Membuat fondasi database lokal aplikasi:
- Schema tabel `wajib_pajak` dan `petak_polygon`
- Konfigurasi Drizzle ORM
- Koneksi database ke expo-sqlite
- Test koneksi berhasil

**Hasil akhir sprint ini:** Database siap digunakan, bisa diakses dari manapun di app.

---

## 📁 File yang Dibuat Sprint Ini

```
src/
├── db/
│   ├── schema.ts       ← Definisi tabel (BUAT BARU)
│   └── client.ts       ← Koneksi DB    (BUAT BARU)
└── (file lain belum disentuh)

drizzle.config.ts       ← Konfigurasi Drizzle (BUAT BARU)
```

---

## 📄 File 1 — `src/db/schema.ts`

```typescript
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

  // belum | lunas | exempt (sawah/bebas pajak)
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
```

---

## 📄 File 2 — `src/db/client.ts`

```typescript
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'
import * as schema from './schema'

// Buka / buat database file lokal
const sqlite = openDatabaseSync('pbb_sync.db')

// Inisialisasi Drizzle dengan schema
export const db = drizzle(sqlite, { schema })

// Buat semua tabel kalau belum ada
export const initDatabase = () => {
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
  `)

  console.log('✅ Database PBB Sync siap')
}
```

---

## 📄 File 3 — `drizzle.config.ts`

Buat di **root project** (sejajar `package.json`):

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config
```

---

## 📄 File 4 — Update `app/_layout.tsx`

Tambahkan `initDatabase()` di root layout supaya DB diinisialisasi saat app pertama dibuka. Buka file `app/_layout.tsx` yang sudah ada, **tambahkan baris berikut**:

```typescript
// Tambah import ini di bagian atas file
import { initDatabase } from '@/src/db/client'
import { useEffect } from 'react'

// Tambah ini di dalam komponen RootLayout, sebelum return:
useEffect(() => {
  initDatabase()
}, [])
```

---

## ▶️ Cara Test Sprint Ini

Setelah semua file dibuat, jalankan app:

```bash
npx expo start
```

Buka di HP via Expo Go. Cek **console/terminal** — harus muncul:
```
✅ Database PBB Sync siap
```

Kalau muncul = Sprint 1 sukses ✅

---

## ⚠️ Troubleshooting

| Error | Solusi |
|---|---|
| `Cannot find module 'drizzle-orm/expo-sqlite'` | Pastikan `drizzle-orm` sudah terinstall: `npm install drizzle-orm` |
| `openDatabaseSync is not a function` | Pastikan `expo-sqlite` versi ~15.x: `npx expo install expo-sqlite` |
| `initDatabase is not defined` | Cek import di `_layout.tsx` sudah benar |
| App crash saat start | Cek console di terminal Expo, share error-nya |

---

## ✅ Checklist Sprint 1 Selesai

- [ ] `src/db/schema.ts` sudah dibuat
- [ ] `src/db/client.ts` sudah dibuat  
- [ ] `drizzle.config.ts` sudah dibuat di root
- [ ] `app/_layout.tsx` sudah diupdate dengan `initDatabase()`
- [ ] App bisa jalan di Expo Go tanpa error
- [ ] Console menampilkan `✅ Database PBB Sync siap`

---

## ➡️ Sprint Berikutnya

**Sprint 2 — Import Excel Byname**  
Setelah database siap, kita buat fitur import file Excel dari BKAD langsung ke SQLite.
