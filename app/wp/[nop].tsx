import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Platform,
  ActivityIndicator
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useState, useEffect } from 'react'
import { getWajibPajakByNop } from '@/src/db/queries'
import { Ionicons } from '@expo/vector-icons'

type WP = Awaited<ReturnType<typeof getWajibPajakByNop>>

export default function DetailWPScreen() {
  const { nop } = useLocalSearchParams<{ nop: string }>()
  const [wp, setWp] = useState<WP | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (nop) {
      loadWP(decodeURIComponent(nop))
    }
  }, [nop])

  const loadWP = async (nopStr: string) => {
    setLoading(true)
    try {
      const data = await getWajibPajakByNop(nopStr)
      setWp(data)
    } catch (error) {
      console.error('Error loading WP detail:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F2D38" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    )
  }

  if (!wp) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={48} color="#E85454" />
        <Text style={styles.errorText}>Data tidak ditemukan</Text>
        <TouchableOpacity style={styles.btnBackSmall} onPress={() => router.back()}>
          <Text style={styles.btnBackSmallText}>← Kembali</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isSawah = wp.statusBayar === 'sawah'
  const isDiterima  = wp.statusBayar === 'diterima'

  const statusColor  = isDiterima ? '#2EC97E' : isSawah ? '#F0A500' : '#E85454'
  const statusLabel  = isDiterima ? '✓ Diterima' : isSawah ? '🌾 SAWAH / BEBAS PAJAK' : '⏳ BELUM BAYAR'

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.namaWp}>{wp.namaWp}</Text>
          <Text style={styles.nopText}>{wp.nop}</Text>
          
          <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* SPPT Card */}
        <View style={styles.spptCard}>
          <View style={styles.spptInfo}>
            <Text style={styles.spptLabel}>JUMLAH SPPT TERUTANG</Text>
            <Text style={styles.spptValue}>
              {isSawah ? 'Rp 0 (Bebas)' :
                `Rp ${wp.jumlahSppt?.toLocaleString('id-ID') ?? '0'}`}
            </Text>
            <Text style={styles.spptYear}>Tahun Pajak {wp.tahunPajak || '2026'}</Text>
          </View>
          <View style={styles.spptIconBox}>
             <Ionicons name="receipt-outline" size={32} color="rgba(255,255,255,0.7)" />
          </View>
        </View>

        {/* Data Objek */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Ionicons name="business-outline" size={16} color="#7A9FAF" />
             <Text style={styles.cardTitle}>DATA OBJEK PAJAK</Text>
          </View>
          
          <InfoRow label="Blok" value={wp.blok} />
          <InfoRow label="Nomor Petak" value={wp.nomorPetak} />
          <InfoRow label="Luas Bumi" value={`${wp.luasBumi?.toLocaleString('id-ID') ?? 0} m²`} />
          <InfoRow label="Luas Bangunan" value={`${wp.luasBangunan?.toLocaleString('id-ID') ?? 0} m²`} />
          <InfoRow label="Padukuhan" value={wp.padukuhan ?? 'Mandingan'} />
        </View>

        {/* Alamat */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Ionicons name="location-outline" size={16} color="#7A9FAF" />
             <Text style={styles.cardTitle}>ALAMAT LENGKAP</Text>
          </View>
          <InfoRow label="Objek Pajak" value={wp.alamatObjek ?? '-'} multiline />
          <InfoRow label="Wajib Pajak" value={wp.alamatWp ?? '-'} multiline />
        </View>

        {/* Tombol Aksi */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => Alert.alert('Info Peta', 'Fitur visualisasi peta akan tersedia pada Sprint 5.')}
        >
          <Ionicons name="map-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnPrimaryText}>Lihat Posisi di Peta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => Alert.alert('Info Distribusi', 'Fitur pencatatan distribusi akan tersedia pada Sprint 8.')}
        >
          <Ionicons name="checkbox-outline" size={20} color="#0F2D38" style={{ marginRight: 8 }} />
          <Text style={styles.btnSecondaryText}>Tandai Distribusi</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ── Komponen baris info
function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={[styles.infoRow, multiline && { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 8 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && { textAlign: 'left', marginLeft: 0, marginTop: 4, lineHeight: 18 }]}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F0F4F7' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F7' },
  loadingText: { color: '#7A9FAF', fontSize: 14, marginTop: 12, fontWeight: '600' },
  errorText:   { fontSize: 16, color: '#E85454', fontWeight: '700', marginTop: 12 },
  btnBackSmall:{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#0F2D38', borderRadius: 10 },
  btnBackSmallText: { color: '#FFF', fontWeight: '700' },

  // Header
  header:      { backgroundColor: '#0F2D38', paddingHorizontal: 20, paddingBottom: 30, paddingTop: 52 },
  backBtn:     { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: 10 },
  headerContent: { },
  namaWp:      { fontSize: 24, fontWeight: '800', color: '#fff', lineHeight: 30 },
  nopText:     { fontSize: 12, color: '#7AAFC0', marginTop: 6,
                 fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
  statusBadge: { alignSelf: 'flex-start', marginTop: 16,
                 paddingHorizontal: 14, paddingVertical: 6,
                 borderRadius: 12, borderWidth: 1.5 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Body
  body:        { padding: 16, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F0F4F7' },

  // SPPT Card
  spptCard:    { backgroundColor: '#1A4A5A', borderRadius: 20, padding: 20,
                 flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 16,
                  shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  spptInfo:    { flex: 1 },
  spptLabel:   { fontSize: 10, color: '#7AAFC0', fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  spptValue:   { fontSize: 24, fontWeight: '900', color: '#fff' },
  spptYear:    { fontSize: 11, color: '#7AAFC0', marginTop: 4, fontWeight: '600' },
  spptIconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', 
                 alignItems: 'center', justifyContent: 'center' },

  // Card
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 18,
                 marginBottom: 16, shadowColor: '#000',
                 shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle:   { fontSize: 10, fontWeight: '800', color: '#7A9FAF', letterSpacing: 1 },

  // Info Row
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 paddingVertical: 10,
                 borderBottomWidth: 1, borderBottomColor: '#F7F9FB' },
  infoLabel:   { fontSize: 12, color: '#7A9FAF', fontWeight: '500' },
  infoValue:   { fontSize: 12, fontWeight: '700', color: '#0F2D38',
                 flex: 1, textAlign: 'right', marginLeft: 12 },

  // Buttons
  btnPrimary:  { backgroundColor: '#0F2D38', borderRadius: 16,
                 padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
                 marginBottom: 12, shadowColor: '#0F2D38', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  
  btnSecondary: { backgroundColor: 'transparent', borderRadius: 16, borderWidth: 2, borderColor: '#0F2D38',
                  padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
                  marginBottom: 30 },
  btnSecondaryText: { color: '#0F2D38', fontWeight: '800', fontSize: 15 },
})
