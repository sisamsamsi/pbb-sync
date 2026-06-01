export interface WajibPajak {
  id?: number;               // Auto increment
  nop: string;               // UNIQUE — "34.02.070.002.013.0001.0"
  blok: string;              // "013" | "014" | "015"
  nomorPetak: string;        // "0001"

  // Data dari DHKP Excel BKAD
  namaWp: string;
  padukuhan: string;         // "MANDINGAN"
  alamatObjek: string;      // Alamat fisik bidang tanah
  alamatWp: string;         // Domisili pemilik
  luasBumi: number;         // m² (luas_tanah di v1)
  luasBangunan: number;     // m²
  jumlahSppt: number;       // Nilai SPPT (0 = sawah/bebas)

  // Status distribusi: 'belum' | 'diterima' | 'sawah'
  statusBayar: string;      // (status_distribusi di v2 blueprint, disamakan statusBayar v1 agar aman)

  tahunPajak: string;       // "2026"
  catatan?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolygonBidang {
  id?: number;              // Auto increment
  nop: string;              // FK ke WajibPajak.nop (bisa null jika belum terhubung)
  blok: string;             // "013"
  nomorPetak: string;       // "0001"

  // Koordinat GPS (lat/lng) disimpan dalam bentuk JSON string atau Array LatLng
  // Format: '[{"lat":-7.912,"lng":110.331},...]'
  points: string;           // (polygon_json di blueprint, disamakan points v1 agar kompatibel)

  // Metadata ekstraksi
  sumber: string;           // 'auto' | 'manual' | 'import_json'
  wasClosed: boolean;       // Apakah path PDF sudah closed saat ekstraksi
  needsReview: boolean;     // Tandai jika koordinat perlu diperiksa kembali
  createdAt: string;
}

export interface GeorefConfig {
  id?: number;              // Auto increment
  blok: string;             // UNIQUE — "013"

  // 4 titik kontrol: PDF point units ↔ GPS
  // Format: '[{"px":120,"py":45,"lat":-7.912,"lng":110.331},...]'
  controlPoints: string;    // (control_points di blueprint)

  // Dimensi halaman PDF (dalam PDF pt units)
  pdfWidth: number;         // (pdf_page_width di blueprint)
  pdfHeight: number;        // (pdf_page_height di blueprint)

  isReady: boolean;
  createdAt: string;
}

export interface SesiDistribusi {
  id?: number;              // Auto increment
  tanggal: string;          // "2026-03-27"
  petugas: string;          // Nama petugas
  blok: string | null;      // null = semua blok
  catatan?: string;
  selesai: boolean;         // Apakah sesi sudah ditutup? (is_closed di blueprint, disamakan selesai v1)
  createdAt: string;
}

export interface Distribusi {
  id?: number;              // Auto increment
  sesiId: number;           // FK ke SesiDistribusi (sesi_id di blueprint)
  nop: string;              // FK ke WajibPajak.nop
  status: string;           // 'diterima' | 'tidak_ada' | 'lain'
  waktu: string;            // "09:15" — Jam distribusi
  catatan?: string;
  fotoBuktiId?: string | null; // FK ke foto_bukti (opsional)
  createdAt: string;
}

export interface FotoBukti {
  id?: number;              // Auto increment
  distribusiId: number;     // FK ke Distribusi
  fotoBlob: Blob;           // Foto dikompresi sebelum disimpan (maks 200KB)
  createdAt: string;
}
