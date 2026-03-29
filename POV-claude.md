## Ah, Jelas Sekarang! Kronologi Sebenarnya 💡

Jadi masalahnya ada **dua lapis** yang berbeda:

```
Masalah 1 (UI): PDF tampil dari halaman 13 sampai akhir (scroll bebas)
                → bukan crash, hanya tampilan tidak sesuai harapan

Tindakan      : Split PDF per blok → proses ini yang memicu
                masalah native conflict

Masalah 2 (Crash): react-native-worklets-core conflict
                   → APK crash total
```

---

## Root Cause Masalah 1 — Salah Konfigurasi PDF Viewer

`react-native-pdf` secara default memang **scroll bebas semua halaman**. Prop `page` hanya menentukan halaman awal, bukan membatasi tampilan. Ini yang menyebabkan blok 013 tampil halaman 13 sampai 20.

Solusinya bukan split PDF — cukup tambah dua prop ini:

```typescript
// SEBELUMNYA — scroll bebas semua halaman
<Pdf
  source={pdfSource}
  page={BLOK_PAGES[activeBlok]}
  ...
/>

// SOLUSI — tampil satu halaman saja
<Pdf
  source={pdfSource}
  page={BLOK_PAGES[activeBlok]}
  enablePaging={true}          // ← paginasi per halaman (swipe)
  horizontal={true}            // ← swipe kiri-kanan antar halaman
  showsHorizontalScrollIndicator={false}
  // Kunci utama: lock ke 1 halaman saja
  onPageChanged={(page, total) => {
    // Kalau user swipe ke halaman lain, paksa balik
    if (page !== BLOK_PAGES[activeBlok]) {
      pdfRef.current?.setPage(BLOK_PAGES[activeBlok])
    }
  }}
  ref={pdfRef}
  ...
/>
```

Atau cara lebih simpel — **tidak pakai scroll sama sekali**, hanya zoom di tempat:

```typescript
<Pdf
  source={pdfSource}
  page={BLOK_PAGES[activeBlok]}
  enablePaging={false}
  horizontal={false}
  // Batasi scroll vertikal supaya tidak bisa ke halaman lain
  style={{ height: SCREEN_H * 0.75 }}  // ← tinggi terbatas = tidak bisa scroll ke hal berikutnya
  minScale={1.0}
  maxScale={5.0}
  fitPolicy={0}
  ...
/>
```

---

## Rekomendasi: Gunakan PDF Asli Tanpa Split

Tidak perlu split file PDF. Lebih baik:

```
File PDF asli (20 halaman) tetap 1 file
         ↓
Load dengan page={13/14/15} sesuai blok
         ↓
Kunci tampilan hanya 1 halaman via tinggi container
         ↓
User zoom & pan di dalam halaman itu saja
```

---

## Update Blueprint SDK 54

Perlu saya catat perubahan ini:---

## Action Plan Sekarang

```
Step 1 → Tunggu EAS Build selesai (fix worklets-core)
         Install APK baru

Step 2 → Test PDF viewer dengan file ASLI (tidak di-split)
         Gunakan peta-blok.pdf yang 20 halaman

Step 3 → Kalau masih scroll bebas, fix konfigurasi PDF:
         - Tambah batasan tinggi container
         - Atau pakai enablePaging + lock page

Step 4 → Kalau sudah tampil 1 halaman per blok = Sprint 4 selesai ✅
```

Jangan split PDF lagi ya — itu justru menambah kompleksitas yang tidak perlu. 1 file, pilih halaman via prop, selesai. 🎯
