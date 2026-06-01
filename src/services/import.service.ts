import { read, utils } from "xlsx";
import { db } from "../db";
import type { WajibPajak } from "../db/schema";

// ── Tipe data satu baris Excel DHKP (sesuai format BKAD)
interface ExcelRow {
  NOP: string;
  Kapanewon: string;
  Kalurahan: string;
  Padukuhan: string;
  "Tahun Pajak": string | number;
  "Wajib Pajak": string;
  "Alamat Objek": string;
  "Alamat Wajib Pajak": string;
  "Luas Bumi": number;
  "Luas Bng": number;
  Jumlah: number;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Mem-parse NOP menjadi kode Blok dan Nomor Petak
 * Contoh NOP: 34.02.070.002.013.0001.0
 */
export const parseNop = (
  nop: string
): { blok: string; nomorPetak: string } | null => {
  const parts = nop.trim().split(".");
  if (parts.length < 6) return null;
  return {
    blok: parts[4],       // '013'
    nomorPetak: parts[5], // '0001'
  };
};

/**
 * Menentukan status pembayaran awal berdasarkan jumlah nominal SPPT
 * Di Bantul, SPPT Rp 0 = tanah sawah/bebas pajak kebijakan Pemda
 */
const getStatusBayar = (jumlah: number): string => {
  if (jumlah === 0) return "sawah";
  return "belum";
};

/**
 * Mengimpor file Excel DHKP secara langsung di browser ke IndexedDB (Dexie)
 */
export const importExcelByname = async (
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    totalRows: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Membaca file Excel sebagai ArrayBuffer menggunakan Promise
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          resolve(e.target.result);
        } else {
          reject(new Error("Gagal membaca file sebagai ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    // 2. Membaca workbook menggunakan SheetJS
    const workbook = read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = utils.sheet_to_json<ExcelRow>(worksheet);

    result.totalRows = rows.length;
    if (rows.length === 0) {
      result.errors.push("File Excel kosong atau format tidak sesuai.");
      return result;
    }

    const itemsToSave: WajibPajak[] = [];
    const now = new Date().toISOString();

    // 3. Memproses baris Excel secara berurutan
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nopRaw = String(row.NOP ?? "").trim();

      if (!nopRaw) {
        result.skipped++;
        continue;
      }

      const parsed = parseNop(nopRaw);
      if (!parsed) {
        result.errors.push(`Baris ${i + 2}: NOP tidak valid (${nopRaw})`);
        result.skipped++;
        continue;
      }

      const jumlah = Number(row.Jumlah ?? 0);

      itemsToSave.push({
        nop: nopRaw,
        blok: parsed.blok,
        nomorPetak: parsed.nomorPetak,
        namaWp: String(row["Wajib Pajak"] ?? "").trim(),
        padukuhan: String(row.Padukuhan ?? "").trim(),
        alamatObjek: String(row["Alamat Objek"] ?? "").trim(),
        alamatWp: String(row["Alamat Wajib Pajak"] ?? "").trim(),
        luasBumi: Number(row["Luas Bumi"] ?? 0),
        luasBangunan: Number(row["Luas Bng"] ?? 0),
        jumlahSppt: jumlah,
        statusBayar: getStatusBayar(jumlah),
        tahunPajak: String(row["Tahun Pajak"] ?? "2026"),
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Menyimpan ke database dalam bentuk chunk (ukuran 100) untuk memperbarui progress secara visual
    const chunkSize = 100;
    for (let offset = 0; offset < itemsToSave.length; offset += chunkSize) {
      const chunk = itemsToSave.slice(offset, offset + chunkSize);
      
      // Menggunakan Dexie bulkPut untuk insert/update sangat cepat dalam satu transaksi
      await db.wajibPajak.bulkPut(chunk);
      
      const currentProgress = Math.min(offset + chunk.length, itemsToSave.length);
      onProgress?.(currentProgress, itemsToSave.length);
      result.imported += chunk.length;
    }

    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Gagal memproses file: ${String(error)}`);
    return result;
  }
};

/**
 * Mengambil statistik data wajib pajak dari database lokal
 */
export const getDbStats = async () => {
  const all = await db.wajibPajak.toArray();
  const total = all.length;
  
  const blok013 = all.filter((w) => w.blok === "013").length;
  const blok014 = all.filter((w) => w.blok === "014").length;
  const blok015 = all.filter((w) => w.blok === "015").length;
  
  const sawah = all.filter((w) => w.statusBayar === "sawah").length;
  const belum = all.filter((w) => w.statusBayar === "belum").length;
  const diterima = all.filter((w) => w.statusBayar === "diterima").length;

  return {
    total,
    blok013,
    blok014,
    blok015,
    sawah,
    belum,
    diterima,
  };
};

/**
 * Menghapus/Reset data wajib pajak dan data polygon
 */
export const resetDatabase = async () => {
  await db.transaction("rw", [db.wajibPajak, db.polygonBidang, db.georefConfig, db.distribusi, db.fotoBukti], async () => {
    await db.wajibPajak.clear();
    await db.polygonBidang.clear();
    await db.georefConfig.clear();
    await db.distribusi.clear();
    await db.fotoBukti.clear();
  });
};

/**
 * Menghapus hanya data Polygon
 */
export const resetPolygons = async () => {
  await db.polygonBidang.clear();
};

/**
 * Mengimpor data polygon hasil penyelamatan v1 (Rescued JSON) dari folder public/data/ secara langsung ke IndexedDB
 */
export const importRescuedPolygons = async (
  blok: string
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    const response = await fetch(`/data/polygons_${blok}.json`);
    if (!response.ok) {
      throw new Error(`Gagal mengunduh file polygons_${blok}.json`);
    }
    
    interface V1Polygon {
      blok: string;
      nomor_petak: string;
      nop: string;
      points: Array<{ lat: number; lng: number }>;
    }
    
    const data: V1Polygon[] = await response.json();
    
    const formatted = data.map((item) => ({
      nop: item.nop,
      blok: item.blok,
      nomorPetak: item.nomor_petak,
      points: JSON.stringify(item.points),
      sumber: "import_json",
      wasClosed: true,
      needsReview: false,
      createdAt: new Date().toISOString(),
    }));
    
    await db.polygonBidang.bulkPut(formatted);
    return { success: true, count: formatted.length };
  } catch (error) {
    return { success: false, count: 0, error: String(error) };
  }
};

/**
 * Mengimpor konfigurasi georeferencing hasil penyelamatan v1 (Rescued JSON) secara langsung ke IndexedDB
 */
export const importRescuedGeoref = async (): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    const response = await fetch("/data/georef_config.json");
    if (!response.ok) {
      throw new Error("Gagal mengunduh file georef_config.json");
    }
    
    const data: Record<string, any> = await response.json();
    
    const formatted = [];
    for (const blokKey of Object.keys(data)) {
      const item = data[blokKey];
      const existing = await db.georefConfig.where("blok").equals(blokKey).first();
      formatted.push({
        ...(existing ? { id: existing.id } : {}),
        blok: blokKey,
        controlPoints: JSON.stringify(item.control_points),
        pdfWidth: item.pdf_width,
        pdfHeight: item.pdf_height,
        isReady: true,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }
    
    await db.transaction("rw", db.georefConfig, async () => {
      await db.georefConfig.bulkPut(formatted);
    });
    
    return { success: true, count: formatted.length };
  } catch (error) {
    return { success: false, count: 0, error: String(error) };
  }
};

