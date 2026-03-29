import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { Asset } from 'expo-asset'
import Pdf from 'react-native-pdf'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// Mapping blok → file PDF (Require harus static string)
const BLOK_FILES: Record<string, any> = {
  '013': require('../../assets/maps/blok-013.pdf'),
  '014': require('../../assets/maps/blok-014.pdf'),
  '015': require('../../assets/maps/blok-015.pdf'),
}

const BLOK_LIST = ['013', '014', '015']

export default function PetaScreen() {
  const [activeBlok, setActiveBlok] = useState('013')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfUri, setPdfUri]         = useState<string | null>(null)

  // Inisialisasi asset PDF - dijalankan setiap ganti blok
  useEffect(() => {
    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)
        
        const asset = Asset.fromModule(BLOK_FILES[activeBlok])
        await asset.downloadAsync()
        
        if (asset.localUri) {
          setPdfUri(asset.localUri)
        } else {
          throw new Error('Gagal mendapatkan local URI untuk PDF Blok ' + activeBlok)
        }
      } catch (err) {
        console.error('Error loading PDF asset:', err)
        setError('Gagal menyiapkan file PDF: ' + String(err))
      } finally {
        setLoading(false)
      }
    }
    loadPdf()
  }, [activeBlok])

  const pdfSource = pdfUri ? {
    uri: pdfUri,
    cache: true,
  } : null

  return (
    <View style={styles.container}>
      {/* Selector Blok */}
      <View style={styles.blokBar}>
        <Text style={styles.blokBarLabel}>Pilih Blok:</Text>
        <View style={styles.blokBtns}>
          {BLOK_LIST.map(blok => (
            <TouchableOpacity
              key={blok}
              style={[
                styles.blokBtn,
                activeBlok === blok && styles.blokBtnActive,
              ]}
              onPress={() => {
                setActiveBlok(blok)
                setLoading(true)
                setError(null)
              }}
            >
              <Text style={[
                styles.blokBtnText,
                activeBlok === blok && styles.blokBtnTextActive,
              ]}>
                Blok {blok}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info halaman */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          📄 Blok {activeBlok} · Peta Digital
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
              Pastikan file PDF sudah tersedia di:{'\n'}
              assets/maps/blok-{activeBlok}.pdf
            </Text>
          </View>
        ) : (
          pdfSource && (
            <Pdf
              key={activeBlok}
              source={pdfSource}
              page={1}
              trustAllCerts={false}
              onLoadComplete={(numberOfPages) => {
                setTotalPages(numberOfPages)
                setLoading(false)
              }}
              onPageChanged={() => {}}
              onError={(err) => {
                if (!pdfUri) return
                setError(String(err))
                setLoading(false)
              }}
              onLoadProgress={() => setLoading(true)}
              style={styles.pdf}
              enablePaging={true}
              horizontal={false}
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

        {/* Loading overlay */}
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0F2D38" />
            <Text style={styles.loadingText}>
              Memuat Peta Blok {activeBlok}...
            </Text>
          </View>
        )}
      </View>

      {/* Footer info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔵 Blok {activeBlok} · Kalurahan Ringinharjo · Tahun 2026
        </Text>
        <Text style={styles.footerSub}>
          Tap petak untuk lihat data WP (tersedia di Sprint 6)
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },

  // Blok selector
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

  // Info bar
  infoBar:      { backgroundColor: '#1A4A5A', paddingHorizontal: 12, paddingVertical: 5 },
  infoText:     { fontSize: 10, color: '#A8CFDF', textAlign: 'center' },

  // PDF
  pdfContainer: { flex: 1, position: 'relative' },
  pdf:          { flex: 1, width: SCREEN_W, backgroundColor: '#E8EDF2' },

  // Loading overlay
  loadingOverlay: { position: 'absolute', inset: 0,
                    backgroundColor: 'rgba(240,244,247,0.9)',
                    alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:    { fontSize: 13, fontWeight: '600', color: '#0F2D38' },

  // Error
  errorBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 32, gap: 8 },
  errorIcon:    { fontSize: 40 },
  errorText:    { fontSize: 16, fontWeight: '700', color: '#0F2D38' },
  errorSub:     { fontSize: 11, color: '#E85454', textAlign: 'center' },
  errorHint:    { fontSize: 11, color: '#7A9FAF', textAlign: 'center',
                  marginTop: 8, lineHeight: 18,
                  backgroundColor: '#F0F4F7', padding: 12, borderRadius: 10 },

  // Footer
  footer:       { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8,
                  borderTopWidth: 1, borderTopColor: '#E8EDF2' },
  footerText:   { fontSize: 11, fontWeight: '600', color: '#0F2D38' },
  footerSub:    { fontSize: 10, color: '#B0BEC8', marginTop: 2 },
})
