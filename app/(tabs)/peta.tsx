import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator
} from 'react-native'
import MapView, { Polygon, Polyline, Marker, Overlay, PROVIDER_GOOGLE } from 'react-native-maps'
import { useState, useRef, useEffect, useCallback } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { getWajibPajak, getPolygonsByBlok } from '@/src/db/queries'
import { parsePoints } from '@/src/services/geo.service'
import { getUnmappedDhkp, saveManualPolygon } from '@/src/services/import.service'
import { Modal, TextInput, FlatList, Alert } from 'react-native'

const { width: W } = Dimensions.get('window')

// ── Pusat koordinat Mandingan, Ringinharjo, Bantul
const DEFAULT_REGION = {
  latitude:      -7.8868,
  longitude:     110.3321,
  latitudeDelta:  0.008,
  longitudeDelta: 0.008,
}

// ── Warna polygon per status
const POLYGON_COLORS = {
  belum:    { fill: 'rgba(232,84,84,0.35)',    stroke: '#E85454' },
  diterima: { fill: 'rgba(46,201,126,0.35)',   stroke: '#2EC97E' },
  sawah:    { fill: 'rgba(240,165,0,0.25)',    stroke: '#F0A500' },
  selected: { fill: 'rgba(240,165,0,0.55)',    stroke: '#F0A500' },
  unknown:  { fill: 'rgba(90,140,178,0.25)',   stroke: '#5C8EB2' },
}

const BLOK_LIST = ['013', '014', '015']

// ── Data Bounds yang dihitung dari generate_map_overlays.py
// [NorthEast [lat, lng], SouthWest [lat, lng]]
const OVERLAYS_CONFIG: Record<string, { bounds: [[number, number], [number, number]], image: any }> = {
  "013": {
    bounds: [[-7.8841797, 110.3248386], [-7.8885669, 110.3201467]],
    image: require('../../assets/overlays/overlay_013.png'),
  },
  "014": {
    bounds: [[-7.8864703, 110.3250106], [-7.8913926, 110.3198083]],
    image: require('../../assets/overlays/overlay_014.png'),
  },
  "015": {
    bounds: [[-7.8841006, 110.3268804], [-7.8919670, 110.3235372]],
    image: require('../../assets/overlays/overlay_015.png'),
  }
}

// ── Tipe data polygon gabungan dengan data WP
interface PetakData {
  id: number
  blok: string
  nomorPetak: string
  nop: string | null
  points: Array<{ lat: number; lng: number }>
  namaWp: string | null
  statusBayar: string | null
  jumlahSppt: number | null
  padukuhan: string | null
}

export default function PetaScreen() {
  const mapRef = useRef<MapView>(null)

  const [activeBlok, setActiveBlok]     = useState('013')
  const [petakList, setPetakList]       = useState<PetakData[]>([])
  const [selectedPetak, setSelectedPetak] = useState<PetakData | null>(null)
  const [loading, setLoading]           = useState(false)
  const [mapType, setMapType]           = useState<'satellite' | 'standard'>('satellite')
  const [showPopup, setShowPopup]       = useState(false)
  
  // ── State PDF Overlay
  const [showPdfOverlay, setShowPdfOverlay] = useState(false)
  const [pdfOpacity, setPdfOpacity]         = useState(0.4) // Default 40%
  
  // ── State Gambar Manual Pintar
  const [targetNop, setTargetNop]       = useState<string | null>(null)
  const params = useLocalSearchParams<{
    drawForNop?: string
    drawForBlok?: string
  }>()

  // ── Effect: Handle parameter dari halaman Validasi
  useEffect(() => {
    if (params.drawForBlok && params.drawForNop) {
      // Set blok aktif
      setActiveBlok(params.drawForBlok)
      // Tunda sedikit supaya peta selesai render/pindah blok
      setTimeout(() => {
        setIsDrawing(true)
        setDrawingPoints([])
        // Simpan NOP target supaya saat klik "Selesai" langsung tersimpan ke WP ini
        setTargetNop(params.drawForNop ?? null)
        setShowPopup(false)
      }, 800)
    }
  }, [params.drawForNop, params.drawForBlok])
  
  // ── State Gambar Manual
  const [isDrawing, setIsDrawing]       = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{latitude: number, longitude: number}[]>([])
  const [showPicker, setShowPicker]     = useState(false)
  const [unmappedWp, setUnmappedWp]     = useState<any[]>([])
  const [searchQuery, setSearchQuery]   = useState('')

  // Load polygon + data WP saat blok berubah
  useEffect(() => {
    loadPetakData(activeBlok)
  }, [activeBlok])

  const loadPetakData = useCallback(async (blok: string) => {
    setLoading(true)
    setSelectedPetak(null)
    setShowPopup(false)

    try {
      // Ambil polygon dari DB
      const polygons = await getPolygonsByBlok(blok)

      // Ambil data WP blok ini (limit besar)
      const wpList = await getWajibPajak({ blok, limit: 999 })

      // Gabungkan polygon + data WP via NOP
      const results = polygons
        .filter(p => p.points != null)
        .map(p => {
          const wp = wpList.find(w => w.nop === p.nop)
          const points = parsePoints(p.points!)

          return {
            id:         p.id,
            blok:       p.blok,
            nomorPetak: p.nomorPetak,
            nop:        p.nop ?? null,
            points:     points,
            namaWp:     wp?.namaWp ?? null,
            statusBayar: wp?.statusBayar ?? null,
            jumlahSppt: wp?.jumlahSppt ?? null,
            padukuhan:  wp?.padukuhan ?? null,
          } as PetakData
        })
        .filter(p => p.points.length >= 3)
      
      setPetakList(results)
    } catch (e) {
      console.error('loadPetakData error:', e)
    }

    setLoading(false)
  }, [])

  // Tap polygon
  const handleTapPolygon = (petak: PetakData) => {
    setSelectedPetak(petak)
    setShowPopup(true)
  }

  // Warna polygon
  const getColor = (petak: PetakData, isSelected: boolean) => {
    if (isSelected) return POLYGON_COLORS.selected
    const status = petak.statusBayar ?? 'unknown'
    return POLYGON_COLORS[status as keyof typeof POLYGON_COLORS]
      ?? POLYGON_COLORS.unknown
  }

  // ── Handler Gambar Manual
  const handleMapPress = (e: any) => {
    if (!isDrawing) return
    const { latitude, longitude } = e.nativeEvent.coordinate
    setDrawingPoints(prev => [...prev, { latitude, longitude }])
  }

  const handleUndo = () => {
    setDrawingPoints(prev => prev.slice(0, -1))
  }

  const handleStartDrawing = () => {
    setIsDrawing(true)
    setDrawingPoints([])
    setShowPopup(false)
  }

  const handleFinishDrawing = async () => {
    if (drawingPoints.length < 3) {
      Alert.alert('⚠️ Peringatan', 'Minimal butuh 3 titik untuk membuat bidang.')
      return
    }

    // PINTAR: Jika ada target NOP dari layar Validasi, langsung simpan
    if (targetNop) {
      setLoading(true)
      const allWps = await getWajibPajak({ blok: activeBlok, limit: 1000 })
      const wp = allWps.find(w => w.nop === targetNop)
      if (wp) {
        await handleSaveToWp(wp)
        setTargetNop(null)
        // Reset params agar tidak masuk mode draw lagi saat tab dibuka ulang
        router.setParams({ drawForNop: undefined, drawForBlok: undefined })
        setLoading(false)
        return
      }
      setLoading(false)
    }

    setLoading(true)
    const list = await getUnmappedDhkp(activeBlok)
    setUnmappedWp(list)
    setLoading(false)
    setShowPicker(true)
  }

  const handleSaveToWp = async (wp: any) => {
    const points = drawingPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))
    const res = await saveManualPolygon({
      nop: wp.nop,
      blok: activeBlok,
      num: wp.nomorPetak,
      points
    })

    if (res.success) {
      setShowPicker(false)
      setIsDrawing(false)
      setDrawingPoints([])
      await loadPetakData(activeBlok)
      Alert.alert('✅ Berhasil', `Petak manual berhasil dihubungkan ke ${wp.namaWp}`)
    } else {
      Alert.alert('❌ Gagal', res.error ?? 'Gagal menyimpan petak.')
    }
  }

  const filteredWp = unmappedWp.filter(w => 
    w.namaWp.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.nomorPetak.includes(searchQuery)
  )

  return (
    <View style={styles.container}>
      {/* ── Selector Blok */}
      <View style={styles.topBar}>
        <View style={styles.blokRow}>
          {BLOK_LIST.map(blok => (
            <TouchableOpacity
              key={blok}
              style={[styles.blokBtn, activeBlok === blok && styles.blokBtnActive]}
              onPress={() => setActiveBlok(blok)}
            >
              <Text style={[
                styles.blokBtnText,
                activeBlok === blok && styles.blokBtnTextActive,
              ]}>
                Blok {blok}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Toggle map type */}
          <TouchableOpacity
            style={styles.mapTypeBtn}
            onPress={() =>
              setMapType(t => t === 'satellite' ? 'standard' : 'satellite')
            }
          >
            <Text style={styles.mapTypeBtnText}>
              {mapType === 'satellite' ? '🛰️' : '🗺️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info polygon count */}
        <Text style={styles.infoText}>
          {loading
            ? 'Memuat peta...'
            : petakList.length > 0
              ? `${petakList.length} petak termapping · Tap petak untuk detail`
              : 'Belum ada polygon. Lakukan georeferencing terlebih dahulu.'}
        </Text>
      </View>

      {/* ── Google Maps */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        loadingEnabled={true}
        loadingIndicatorColor="#0F2D38"
        loadingBackgroundColor="#F0F4F7"
        onLongPress={handleMapPress}
      >
        {/* ── PDF Overlay (Tracing Paper) ── */}
        {showPdfOverlay && OVERLAYS_CONFIG[activeBlok] && (
          <Overlay
            image={OVERLAYS_CONFIG[activeBlok].image}
            bounds={OVERLAYS_CONFIG[activeBlok].bounds}
            opacity={pdfOpacity}
          />
        )}
        {/* Render titik gambar manual */}
        {isDrawing && drawingPoints.map((p, i) => (
          <Marker 
            key={i} 
            coordinate={p} 
            anchor={{x: 0.5, y: 0.5}}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, borderColor: '#0F2D38' }} />
          </Marker>
        ))}

        {/* Poliline saat sedang menggambar */}
        {isDrawing && drawingPoints.length > 1 && (
          <Polyline 
            coordinates={drawingPoints}
            strokeColor="#fff"
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
        {isDrawing && drawingPoints.length > 2 && (
          <Polygon 
            coordinates={drawingPoints}
            fillColor="rgba(255,255,255,0.3)"
            strokeColor="transparent"
          />
        )}
        {/* Render polygon per petak */}
        {petakList.map(petak => {
          const isSelected = selectedPetak?.id === petak.id
          const color = getColor(petak, isSelected)

          return (
            <Polygon
              key={petak.id}
              coordinates={petak.points.map(p => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              fillColor={color.fill}
              strokeColor={color.stroke}
              strokeWidth={isSelected ? 3 : 1.5}
              tappable={true}
              onPress={() => handleTapPolygon(petak)}
            />
          )
        })}
      </MapView>

      {/* ── Legend */}
      <View style={styles.legend}>
        <LegendItem color="#E85454" label="Belum" />
        <LegendItem color="#2EC97E" label="Diterima" />
        <LegendItem color="#F0A500" label="Sawah" />
      </View>

      {/* ── PDF Overlay Controls */}
      <View style={styles.pdfOverlayControls}>
        <TouchableOpacity 
          style={[styles.pdfToggle, showPdfOverlay && styles.pdfToggleActive]}
          onPress={() => setShowPdfOverlay(!showPdfOverlay)}
        >
          <Text style={[styles.pdfToggleText, showPdfOverlay && styles.pdfToggleTextActive]}>
            Overlay PDF
          </Text>
        </TouchableOpacity>

        {showPdfOverlay && (
          <View style={styles.opacityControls}>
            {[0.2, 0.4, 0.6, 0.8].map(op => (
              <TouchableOpacity
                key={op}
                style={[styles.opacityBtn, pdfOpacity === op && styles.opacityBtnActive]}
                onPress={() => setPdfOpacity(op)}
              >
                <Text style={[styles.opacityBtnText, pdfOpacity === op && styles.opacityBtnTextActive]}>
                  {op * 100}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* ── Popup detail petak (Sederhana untuk Sprint 5) */}
      {showPopup && selectedPetak && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.popupNop}>
                {selectedPetak.blok}-{selectedPetak.nomorPetak}
                {selectedPetak.nop ? ` · ${selectedPetak.nop}` : ''}
              </Text>
              <Text style={styles.popupName} numberOfLines={1}>
                {selectedPetak.namaWp ?? 'Tidak ada data WP'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowPopup(false)} style={styles.popupClose}>
              <Text style={{ color: '#7A9FAF', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.popupRow}>
            <PopupItem label="SPPT" value={
              selectedPetak.jumlahSppt === 0 ? 'Bebas Pajak' : 
              `Rp ${selectedPetak.jumlahSppt?.toLocaleString('id-ID') ?? '-'}`
            } />
            <PopupItem label="Padukuhan" value={selectedPetak.padukuhan ?? '-'} />
          </View>

          <View style={[
            styles.statusBadge,
            { backgroundColor: 
              selectedPetak.statusBayar === 'diterima' ? '#DCFCE7' :
              selectedPetak.statusBayar === 'sawah' ? '#FEF3C7' :
              selectedPetak.statusBayar === 'belum' ? '#FEE2E2' : '#F0F4F7' 
            }
          ]}>
             <Text style={[
               styles.statusText,
               { color: 
                  selectedPetak.statusBayar === 'diterima' ? '#16A34A' :
                  selectedPetak.statusBayar === 'sawah' ? '#D97706' :
                  selectedPetak.statusBayar === 'belum' ? '#DC2626' : '#4A6070' 
               }
             ]}>
               {selectedPetak.statusBayar === 'diterima' ? '✓ Sudah Diterima' :
                selectedPetak.statusBayar === 'sawah' ? '🌾 Sawah / Bebas' :
                selectedPetak.statusBayar === 'belum' ? '⏳ Belum Diterima' : 'Tidak ada data'}
             </Text>
          </View>
        </View>
      )}

      {/* ── Kontrol Gambar Manual */}
      {!isDrawing ? (
        <TouchableOpacity 
          style={styles.fabDraw} 
          onPress={handleStartDrawing}
        >
          <Text style={{ fontSize: 24 }}>✏️</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.drawingControls}>
           <Text style={styles.drawingInfo}>
             Mode Gambar: Long-press untuk tambah titik ({drawingPoints.length})
           </Text>
           <View style={styles.drawingActions}>
             <TouchableOpacity style={[styles.drawBtn, { backgroundColor: '#E85454' }]} onPress={() => setIsDrawing(false)}>
               <Text style={styles.drawBtnText}>Batal</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.drawBtn, { backgroundColor: '#7A9FAF' }]} onPress={handleUndo}>
               <Text style={styles.drawBtnText}>Undo</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.drawBtn, { backgroundColor: '#2EC97E' }]} onPress={handleFinishDrawing}>
               <Text style={styles.drawBtnText}>Selesai</Text>
             </TouchableOpacity>
           </View>
        </View>
      )}

      {/* ── Modal Picker DHKP */}
      <Modal visible={showPicker} animationType="slide" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pilih Wajib Pajak (DHKP)</Text>
            <Text style={styles.modalSub}>
              Pilih nama untuk dihubungkan dengan petak yang baru digambar di Blok {activeBlok}.
            </Text>
            
            <TextInput 
              style={styles.searchInput}
              placeholder="Cari Nama atau No Petak..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <FlatList 
              data={filteredWp}
              keyExtractor={(item) => item.nop}
              renderItem={({ item }) => (
                <TouchableOpacity 
                   style={styles.wpItem} 
                   onPress={() => handleSaveToWp(item)}
                >
                  <Text style={styles.wpName}>{item.namaWp}</Text>
                  <Text style={styles.wpNop}>{item.nomorPetak} · {item.nop}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Tidak ada data WP yang belum terpemetaan.</Text>
              }
            />

            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.closeBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

function PopupItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.popupItem}>
      <Text style={styles.popupItemLabel}>{label}</Text>
      <Text style={styles.popupItemValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F2D38' },
  topBar: { backgroundColor: '#0F2D38', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  blokRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  blokBtn: { 
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' 
  },
  blokBtnActive: { backgroundColor: '#fff' },
  blokBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  blokBtnTextActive: { color: '#0F2D38' },
  mapTypeBtn: { 
    marginLeft: 'auto', width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center' 
  },
  mapTypeBtnText: { fontSize: 18 },
  infoText: { fontSize: 10, color: '#7AAFC0' },
  map: { flex: 1 },
  legend: { 
    position: 'absolute', top: 90, left: 12,
    backgroundColor: 'rgba(15,45,56,0.85)',
    borderRadius: 10, padding: 8, gap: 4 
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 9, color: '#fff', fontWeight: '500' },
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,45,56,0.5)',
    alignItems: 'center', justifyContent: 'center' 
  },
  popup: {
    position: 'absolute', bottom: 20, left: 12, right: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
    borderLeftWidth: 4, borderLeftColor: '#F0A500'
  },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  popupNop: { fontSize: 9, color: '#7A9FAF', fontWeight: '600', letterSpacing: 0.5 },
  popupName: { fontSize: 15, fontWeight: '800', color: '#0F2D38', marginTop: 2 },
  popupClose: { padding: 4 },
  popupRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  popupItem: { flex: 1, backgroundColor: '#F7F9FB', borderRadius: 8, padding: 8 },
  popupItemLabel: { fontSize: 8, color: '#7A9FAF', fontWeight: '600', textTransform: 'uppercase' },
  popupItemValue: { fontSize: 11, fontWeight: '700', color: '#0F2D38' },
  statusBadge: { borderRadius: 8, padding: 8, alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Syles Gambar Manual
  fabDraw: {
    position: 'absolute', bottom: 30, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10
  },
  drawingControls: {
    position: 'absolute', top: 120, left: 12, right: 12,
    backgroundColor: 'rgba(15,45,56,0.95)', borderRadius: 16, padding: 12,
    alignItems: 'center'
  },
  drawingInfo: { color: '#fff', fontSize: 10, marginBottom: 10, fontWeight: '600' },
  drawingActions: { flexDirection: 'row', gap: 8 },
  drawBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  drawBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, height: '80%'
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F2D38' },
  modalSub: { fontSize: 12, color: '#7A9FAF', marginTop: 4, marginBottom: 16 },
  searchInput: {
    backgroundColor: '#F0F4F7', borderRadius: 12, padding: 12,
    fontSize: 14, marginBottom: 16
  },
  wpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F4F7' },
  wpName: { fontSize: 14, fontWeight: '700', color: '#0F2D38' },
  wpNop: { fontSize: 11, color: '#7A9FAF', marginTop: 2 },
  closeBtn: { marginTop: 16, padding: 16, alignItems: 'center', backgroundColor: '#F0F4F7', borderRadius: 12 },
  closeBtnText: { fontWeight: '700', color: '#0F2D38' },
  emptyText: { 
    textAlign: 'center', color: '#7A9FAF', fontSize: 13, 
    marginTop: 40, paddingHorizontal: 40, lineHeight: 20 
  },

  // ── Syles PDF Overlay
  pdfOverlayControls: {
    position: 'absolute',
    top: 150,
    right: 12,
    alignItems: 'flex-end',
  },
  pdfToggle: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    elevation: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10
  },
  pdfToggleActive: {
    backgroundColor: '#0F2D38',
    borderColor: '#0F2D38',
  },
  pdfToggleText: {
    fontWeight: '800',
    color: '#0F2D38',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  pdfToggleTextActive: {
    color: '#fff',
  },
  opacityControls: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  opacityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    alignItems: 'center'
  },
  opacityBtnActive: {
    backgroundColor: '#0F2D38',
  },
  opacityBtnText: {
    fontSize: 10,
    color: '#0F2D38',
    fontWeight: '800',
  },
  opacityBtnTextActive: {
    color: '#fff',
  },
})

