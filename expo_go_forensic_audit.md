# 🔍 Audit Forensik: Kesalahan Expo Go & Bottleneck Upgrade SDK 54

## 1. Latar Belakang Insiden
Sistem PBB Sync yang berjalan secara lokal telah dialihkan strukturnya dari lingkungan Expo SDK 52 ke **SDK 54** karena adanya *bottleneck* fitur (SDK 52 tidak memiliki dukungan memadai untuk pembacaan QR Code langsung ke dalam tampilan aplikasi native Android). Proses mutasi (upgrade) paket NPM telah sukses dieksekusi, namun *developer* mengalami kegagalan *runtime* total saat kode dijalankan.

---

## 2. Analisa Forensik *Crash* 1 (React Native / TurboModule)
> `ERROR [Error: Exception in HostFunction: TurboModule method "installTurboModule" called with 1 arguments...]`

**Akar Penyebab (*Root Cause*): Mismatch Arsitektur Memori Native vs JavaScript**
- **Arsitektur Expo Go:** Aplikasi *Expo Go* berjalan sebagai sebuah mesin virtual ("Sandbox") tertutup yang di-bundel dengan versi kode Native (C++ dan Java) yang spesifik. Aplikasi Expo Go di HP Anda saat ini dirancang untuk **SDK 52**.
- **Pergeseran Logika JS:** `package.json` Anda telah men-download `react-native-reanimated` **versi 4** (paket wajib SDK 54).
- **Tragedi *Crash*:** File JS dari laptop Anda menginstruksikan aplikasi Expo Go (V3) di HP untuk menjalankan instalasi fungsi animasi (`installTurboModule()`). Modul JS versi 4 memanggil fungsi tersebut dengan **1 argumen/parameter**. Namun, bahasa C++ pada aplikasi Expo Go versi 52 Anda sangat kaku dan menolak keras instruksi tersebut karena metode aslinya di C++ tidak menerima argumen sama sekali **(0 argumen)**. 
- **Status Akhir:** Jembatan (Bridge/JSI) antara JS dan C++ di Android rusak seketika secara *fatal*. Aplikasi tidak bisa lanjut membaca baris kode berikutnya.

---

## 3. Analisa Forensik Cascading Warning 
> `WARN Route "./_layout.tsx" is missing the required default export.`

**Akar Penyebab: Efek Domino (*Cascading Failure*) dan *Metro Cache***
- Peringatan ini murni merupakan **"False Positive"** (Bukan kesalahan penulisan kode sumber Anda).
- Kode `app/_layout.tsx` memuat perintah *import* `react-native-reanimated`. Karena modul *reanimated* hancur saat mesin JS dijalankan (error pertama di atas), Metro Bundler menghentikan prematur injeksi file `_layout.tsx`. Hal ini menyebabkan objek fungsi ekspor (*export default RootLayout*) tidak pernah didaftarkan (register) ke sistem *Expo Router*.
- **Bottleneck Cache:** Metro Bundler di laptop Anda mengingat (cache) kehancuran status ini di memori temporer, dan enggan mengevaluasi ulang filenya meskipun kode Anda sebetulnya valid. Perintah *clear cache* (`npx expo start -c`) terbukti efektif me-reset memori Metro, namun tetap tidak mengobati luka *TurboModule* aslinya.

---

## 4. Analisa Forensik *Bottleneck* Kompilasi (Android SDK)
> `Failed to resolve the Android SDK path. Default install location not found... Error: 'adb' is not recognized...`

**Akar Penyebab: Kondisi Lingkungan Windows Tidak Optimal untuk Eksekusi Lokal**
- Sebagai obat utama dari Error 1, strategi yang diambil adalah memaksa pembuatan aplikasi Native Dev Client secara *"custom"* (langsung mengkompilasi Android `SDK 54` yang murni) menggunakan `npx expo run:android`.
- **Eksekusi Gagal Total:** Skrip `cross-spawn` dari Expo mencoba mencari dua pilar dasar kompilasi Android lokal: **`ANDROID_HOME`** (tempat di mana alat kompilasi *Java* berada) dan **`adb` / Android Debug Bridge** (jembatan komunikasi USB untuk menginstal APK ke dalam *emulator*).
- *Developer tools* tersebut nyatanya tidak terinstal atau tidak terdeteksi oleh sistem PATH Windows. Kompilasi perangkat lunak batal dilakukan, memaksa proses terhenti di tahap "Finished prebuild". Terdapat *Bottleneck* infrastruktur lokal di laptop Anda.

---

## 💡 Rekomendasi Arsitektural Menuju Fase Bebas *Bottleneck*

Berdasarkan investigasi forensik di atas, memaksakan instalasi Android Studio secara statis (konfigurasi manual) di komputer lokal *developer* akan menghasilkan risiko hilangnya waktu berjam-jam (*Sunk Cost Fallacy*).

1. **Jalankan Deklarasi Cloud Build (EAS)**
   Untuk mendapatkan jembatan native aplikasi (APK) untuk React Native v0.81 dan Expo SDK 54, sangat diwajibkan memigrasikan proses pembuatan (kompilasi Android) tersebut **seutuhnya bergeser ke CLOUD SERVER milik Expo** (*Expo Application Services*).
2. **Terminal Action:** 
   ```bash
   eas build --profile development --platform android
   ```
3. **Penyelesaian Lingkaran Logika:** Cloud API EAS dapat secara brilian meng-output file instalator murni (`.apk`) dari project `d:\pbb-sync`. Ketika ini diinstal di Android, HP Anda akan memiliki C++ *engine* yang absolut cocok tanpa *mismatch error installTurboModule*. Data sinkronisasi fungsi Database PBB dapat segera didistribusikan setelah *client* ini diinstal.
