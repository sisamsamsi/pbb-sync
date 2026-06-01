import Dexie, { type Table } from "dexie";
import type {
  WajibPajak,
  PolygonBidang,
  GeorefConfig,
  SesiDistribusi,
  Distribusi,
  FotoBukti,
} from "./schema";

export class KartabumiDatabase extends Dexie {
  wajibPajak!: Table<WajibPajak>;
  polygonBidang!: Table<PolygonBidang>;
  georefConfig!: Table<GeorefConfig>;
  sesiDistribusi!: Table<SesiDistribusi>;
  distribusi!: Table<Distribusi>;
  fotoBukti!: Table<FotoBukti>;

  constructor() {
    super("KartabumiDatabase");
    
    // Mendefinisikan tabel dan indeks yang dibutuhkan untuk pencarian cepat.
    // Simbol & menunjukkan nilai UNIQUE (tidak boleh duplikat).
    this.version(1).stores({
      wajibPajak: "++id, &nop, blok, statusBayar, namaWp, padukuhan, nomorPetak",
      polygonBidang: "++id, nop, blok, nomorPetak",
      georefConfig: "++id, &blok",
      sesiDistribusi: "++id, tanggal, petugas, blok",
      distribusi: "++id, sesiId, nop, status",
      fotoBukti: "++id, distribusiId",
    });
  }
}

// Ekspor instance tunggal (singleton) dari database
export const db = new KartabumiDatabase();
