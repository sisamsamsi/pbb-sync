import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { Asset } from 'expo-asset'
import Pdf from 'react-native-pdf'

const { width: SCREEN_W } = Dimensions.get('window')

// Mapping blok → halaman di PDF asli (1 file, 20 halaman)
const BLOK_PAGES: Record<string, number> = {
  '013': 13,
  '014': 14,
  '015': 15,
}

const BLOK_LIST = ['013', '014', '015']

export default function PetaScreen() {
  const [activeBlok, setActiveBlok] = useState('013')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfUri, setPdfUri]         = useState<string | null>(null)
  const pdfRef = useRef<any>(null)

  // Load PDF asli (1 kali saja saat mount)
  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)

        const asset = Asset.fromModule(require('../../assets/maps/peta-blok.pdf'))
        await asset.downloadAsync()

        if (!asset.localUri) {
          throw new Error('Asset URI kosong')
        }

        setPdfUri(asset.localUri)
      } catch (err: any) {
        console.error('[PetaScreen] load error:', err)
        setError(String(err?.message ?? err))
        setLoading(false)
      }
    }

    loadPdf()
  }, []) // hanya 1x mount — tidak reload setiap ganti blok

  // Saat ganti blok → navigasi ke halaman yang sesuai via ref
  // Tidak perlu remount PDF component → lebih smooth, tidak ada loading ulang
  useEffect(() => {
    if (pdfRef.current && !loading && !error) {
      pdfRef.current.setPage(BLOK_PAGES[activeBlok])
    }
  }, [activeBlok])

  const currentPage = BLOK_PAGES[activeBlok]

  return (
    <View style={styles.container}>
      {/* Selector Blok */}
      <View style={styles.blokBar}>
        <Text style={styles.blokBarLabel}>Pilih Blok:</Text>
        <View style={styles.blokBtns}>
          {BLOK_LIST.map(blok => (
            <TouchableOpacity
              key={blok}
              style={[styles.blokBtn, activeBlok === blok && styles.blokBtnActive]}
              onPress={() => setActiveBlok(blok)}
            >
              <Text style={[styles.blokBtnText, activeBlok === blok && styles.blokBtnTextActive]}>
                Blok {blok}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          📄 Blok {activeBlok} · Halaman {currentPage} dari {totalPages || '...'}
          {'  '}·{'  '}
          Pinch untuk zoom · Drag untuk geser
        </Text>
      </View>

      {/* PDF Viewer */}
      <View style={styles.pdfContainer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>Gagal memuat PDF</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Text style={styles.errorHint}>
              Pastikan file ada di:{'\n'}
              assets/maps/peta-blok.pdf
            </Text>
          </View>
        ) : (
          pdfUri && (
            <Pdf
              ref={pdfRef}
              source={{ uri: pdfUri, cache: true }}
              page={currentPage}
              trustAllCerts={false}

              // Paginasi horizontal → satu halaman per swipe
              enablePaging={true}
              horizontal={true}

              // Lock halaman — cegah user scroll ke blok lain
              onPageChanged={(page) => {
                if (page !== BLOK_PAGES[activeBlok]) {
                  pdfRef.current?.setPage(BLOK_PAGES[activeBlok])
                }
              }}

              onLoadComplete={(numberOfPages) => {
                setTotalPages(numberOfPages)
                setLoading(false)
              }}
              onError={(err) => {
                console.error('[Pdf] onError:', err)
                setError(String(err))
                setLoading(false)
              }}

              style={styles.pdf}
              fitPolicy={0}
              minScale={1.0}
              maxScale={5.0}
              scale={1.0}
              spacing={0}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />
          )
        )}

        {/* Loading overlay — hanya saat load awal */}
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0F2D38" />
            <Text style={styles.loadingText}>Memuat Peta Blok {activeBlok}...</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔵 Blok {activeBlok} · Kalurahan Ringinharjo · Tahun 2026
        </Text>
        <Text style={styles.footerSub}>
          Tap petak → data WP tersedia di Sprint 6
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },

  blokBar:      { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff',
                  borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  blokBarLabel: { fontSize: 12, fontWeight: '600', color: '#4A6070', marginRight: 10 },
  blokBtns:     { flexDirection: 'row', gap: 8 },
  blokBtn:      { paddingHorizontal: 14, paddingVertical: 6,
                  borderRadius: 10, backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  blokBtnActive:     { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  blokBtnText:       { fontSize: 12, fontWeight: '600', color: '#4A6070' },
  blokBtnTextActive: { color: '#fff' },

  infoBar:      { backgroundColor: '#1A4A5A', paddingHorizontal: 12, paddingVertical: 5 },
  infoText:     { fontSize: 10, color: '#A8CFDF', textAlign: 'center' },

  pdfContainer: { flex: 1, position: 'relative' },
  pdf:          { flex: 1, width: SCREEN_W, backgroundColor: '#E8EDF2' },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(240,244,247,0.92)',
                    alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:    { fontSize: 13, fontWeight: '600', color: '#0F2D38' },

  errorBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 32, gap: 8 },
  errorIcon:    { fontSize: 40 },
  errorText:    { fontSize: 16, fontWeight: '700', color: '#0F2D38' },
  errorSub:     { fontSize: 11, color: '#E85454', textAlign: 'center' },
  errorHint:    { fontSize: 11, color: '#7A9FAF', textAlign: 'center',
                  marginTop: 8, lineHeight: 18,
                  backgroundColor: '#F0F4F7', padding: 12, borderRadius: 10 },

  footer:       { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8,
                  borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  footerText:   { fontSize: 11, fontWeight: '600', color: '#0F2D38' },
  footerSub:    { fontSize: 10, color: '#B0BEC8', marginTop: 2 },
})
