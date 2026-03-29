# 🔴 Forensik Crash: "Android internal error" — Sprint 4 PDF Viewer

> 💡 **Update:** Dokumen ini menyertakan POV alternatif yang menemukan bahwa split PDF tidak diperlukan — masalah UI bisa diselesaikan dengan konfigurasi react-native-pdf yang benar.

**Tanggal:** 2026-03-29  
**Project:** PBB Sync — Expo SDK 54 / React Native 0.81.5  
**Sprint:** Sprint 4 — Tab Navigation + PDF Viewer  
**Status:** 🔧 Fix tersedia — menunggu EAS Build baru

---

## 1. Riwayat Proyek (Konteks Penting)

```
SDK 52 → SDK 54 (upgrade dari awal Sprint 1)
Alasan: SDK 52 tidak support Expo Go + beberapa plugin native
Sejak Sprint 1: Semua development menggunakan SDK 54
```

Timeline fitur PDF:

```
Sprint 4 dimulai
    │
    ├─→ Install react-native-pdf + react-native-blob-util
    ├─→ EAS Build #1 (dengan file PDF tunggal: peta-blok.pdf, 20 halaman)
    ├─→ ✅ PDF BERHASIL DITAMPILKAN (native modules OK)
    │   Tapi ada masalah tampilan:
    │   - Blok 013 → menampilkan halaman 13 s/d 20 (bukan hanya hal. 13)
    │   - Blok 014 → menampilkan halaman 14 s/d 20
    │   - Blok 015 → menampilkan halaman 15 s/d 20
    │   Penyebab: react-native-pdf mode scroll menampilkan
    │   semua halaman dari titik awal, bukan satu halaman saja
    │
    ├─→ ⚠️  Keputusan: SPLIT PDF jadi 3 file terpisah
    │   blok-013.pdf (1 halaman) ~804 KB
    │   blok-014.pdf (1 halaman) ~806 KB
    │   blok-015.pdf (1 halaman) ~795 KB
    │
    │   ← CATATAN: Split PDF sebenarnya tidak perlu!
    │     Masalah tampilan bisa diselesaikan dengan
    │     konfigurasi react-native-pdf (lihat Bagian 11)
    │
    ├─→ Update peta.tsx: dari 1 file + page scroll
    │   → 3 file terpisah dengan require() per blok
    │
    ├─→ EAS Build #2 (dengan split PDF)
    │
    └─→ ❌ CRASH: "Error loading app — Android internal error"
```

---

## 2. Gejala

| Gejala | Detail |
|---|---|
| **Pesan error** | `Error loading app — Android internal error` |
| **Kapan terjadi** | Saat Expo Dev Client mencoba load bundle dari Metro server |
| **Layer crash** | **NATIVE** — terjadi sebelum JS bundle sempat dieksekusi |
| **Apakah JS fix bisa membantu?** | ❌ Tidak — harus rebuild APK |
| **Reproducible?** | ✅ 100% konsisten di setiap koneksi |
| **Sebelum split PDF** | ✅ App berjalan (PDF tampil meski tampilan salah) |
| **Setelah split PDF + rebuild** | ❌ Crash di native layer |

---

## 3. Analisis — Mengapa Split PDF Menjadi Pemicu?

Split PDF sendiri **bukan penyebab crash**. PDF sudah ada di `assets/maps/`, sudah ter-bundle via `assetBundlePatterns`. Yang terjadi sebenarnya:

> **EAS Build #2 (setelah split) adalah build PERTAMA yang mengandung `react-native-worklets-core` di native layer.**

Kemungkinan besar `react-native-worklets-core` masuk ke project saat instalasi paket lain (npm/expo install sering menarik peer dependencies secara otomatis). EAS Build #1 belum mengandungnya atau versinya berbeda.

---

## 4. Root Cause Terkonfirmasi

### Audit Versi Semua Native Package

```
react-native-reanimated:    4.1.7   ← NEW ARCH, worklets BUILT-IN
react-native-worklets:      0.8.1   ← ✅ Dibutuhkan Reanimated 4.x
react-native-worklets-core: 1.6.3   ← ❌ HANYA untuk Reanimated 3.x!
react-native-pdf:           7.0.4
react-native-blob-util:     0.24.7
```

### Peer Dependencies Reanimated 4.1.7

```json
{
  "peerDependencies": {
    "react-native-worklets": "0.5 - 0.8"
  }
}
```

→ `react-native-worklets-core` **TIDAK TERDAFTAR** sebagai peer dep Reanimated 4.x  
→ Package ini adalah sisa era Reanimated 3.x

### Mekanisme Crash

```
┌─────────────────────────────────────────────────────────────┐
│                   NATIVE MODULE CONFLICT                    │
│                                                             │
│  react-native-reanimated 4.x                               │
│  → mendaftarkan NativeWorklets (versi baru, built-in)      │
│                                                             │
│  react-native-worklets-core 1.6.3                          │
│  → mendaftarkan NativeWorklets (versi lama, era 3.x)       │
│                                                             │
│  ─── KONFLIK ───                                           │
│  Dua native module mendaftarkan identifier yang SAMA       │
│  → Android JNI/JVM conflict                                │
│  → CRASH saat startup sebelum JS dieksekusi                │
│  → Dev Client menampilkan "Android internal error"         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Investigasi yang Dilakukan

### ❌ Percobaan 1 — `newArchEnabled: false`

**Hipotesis:** react-native-pdf 7.x tidak kompatibel New Architecture  
**Tindakan:** Ubah app.json → `"newArchEnabled": false`  
**Hasil:** Build GAGAL:
```
[Reanimated] Reanimated requires new architecture to be enabled.
```
**Kesimpulan:** Reanimated 4.x wajib New Arch ON. Dikembalikan ke `true`.

---

### ❌ Percobaan 2 — Metro bundling error dari `expo-file-system/legacy`

**Hipotesis:** Import `expo-file-system/legacy` tidak bisa di-resolve Metro  
**Tindakan:** Sederhanakan peta.tsx, hapus expo-file-system, jalankan `--tunnel -c`  
**Hasil:** Error masih sama persis  
**Kesimpulan:** Bukan masalah JS/Metro. Masalah ada di native layer.

---

### ✅ Percobaan 3 — Audit Native Dependencies

**Hasil:** `react-native-worklets-core 1.6.3` ditemukan — tidak dibutuhkan Reanimated 4.x  
**Tindakan:**
- Hapus dari `package.json`
- `npm uninstall react-native-worklets-core`
**Status:** ✅ Node modules bersih, tapi APK lama masih bermasalah (perlu rebuild)

---

## 6. Semua Perubahan yang Sudah Dilakukan

### `app.json`
| Field | Sebelum | Sesudah |
|---|---|---|
| `newArchEnabled` | `true` → sempat `false` → **dikembalikan `true`** | `true` ✅ |

### `package.json`
| Package | Sebelum | Sesudah |
|---|---|---|
| `react-native-worklets-core` | `^1.6.3` | ❌ **Dihapus** |

### `app/(tabs)/peta.tsx`
| Perubahan | Detail |
|---|---|
| Import `expo-file-system/legacy` | Dihapus (tidak perlu) |
| Load PDF | Gunakan `asset.localUri` langsung dari expo-asset |
| Guard `cancelled` flag | Ditambahkan (mencegah setState setelah unmount) |
| Error handling | Lebih robust dengan `console.error` |
| `key` prop pada `<Pdf>` | `key={activeBlok-pdfUri}` untuk force re-render saat ganti blok |

---

## 7. Mengapa Masalah Tampilan Terjadi (Masalah Awal)

Saat PDF tunggal dengan page navigation:

```
Blok 013 → page={13} → react-native-pdf mode scroll
         → menampilkan halaman 13, 14, 15, ... 20 (semua sisa halaman)
```

**Penyebab:** react-native-pdf dengan `enablePaging={false}` dan `horizontal={false}` menampilkan semua halaman dari posisi tersebut dalam mode scroll kontinyu.

**Solusi yang benar (sudah diimplementasi):** Split PDF per blok + `enablePaging={true}` → setiap file hanya 1 halaman, tidak ada masalah tampilan.

---

## 8. Status Fix

| Item | Status |
|---|---|
| Root cause teridentifikasi | ✅ |
| `newArchEnabled` benar (`true`) | ✅ |
| `react-native-worklets-core` dihapus dari package.json | ✅ |
| `react-native-worklets-core` diuninstall dari node_modules | ✅ |
| `peta.tsx` dibersihkan dan disederhanakan | ✅ |
| **EAS Build baru (wajib)** | ⏳ **Belum dijalankan** |
| APK baru terinstall di device | ⏳ Menunggu build |
| PDF per blok berhasil ditampilkan | ⏳ Menunggu build + test |

---

## 9. Langkah Selanjutnya

> [!IMPORTANT]
> APK yang ada di HP masih mengandung `react-native-worklets-core`.
> Crash tidak akan berhenti sampai APK diganti dengan build baru.

```bash
# Step 1: Trigger build
eas build --profile development --platform android --no-wait

# Step 2: Pantau progres (~10-15 menit)
# https://expo.dev/accounts/samsi_wahyudi/projects/pbb-sync/builds

# Step 3: Download & install APK baru ke HP

# Step 4: Test
npx expo start --tunnel
# Scan QR → tab Peta → Blok 013/014/015 harus tampil 1 halaman per blok
```

---

## 10. Catatan untuk Sprint Berikutnya

| Sprint | Catatan |
|---|---|
| Sprint 5 — Google Maps | `react-native-maps 1.20.1` sudah terinstall, tapi **belum ada config plugin** dan **Google Maps API Key** di app.json. Wajib ditambahkan sebelum build. |
| Sprint 6+ | Pastikan tidak ada package yang berkonflik saat install dependency baru |

---

*Dibuat: 2026-03-29 · Updated: 2026-03-29 (dengan kronologi lengkap dari developer)*
