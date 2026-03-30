import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator
} from 'react-native'
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps'
import { useState, useRef, useEffect, useCallback } from 'react'
import { getWajibPajak, getPolygonsByBlok } from '@/src/db/queries'
import { parsePoints } from '@/src/services/geo.service'

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
      >
        {/* Render polygon per petak */}
        {petakList.map(petak => {
          const isSelected = selectedPetak?.id === petak.id
          const color = getColor(petak, isSelected)

          return (
            <Polygon
              key={`${petak.blok}-${petak.nomorPetak}`}
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
})

