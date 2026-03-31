import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView
} from 'react-native'
import { useState, useEffect } from 'react'
import { 
  importExcelByname, getDbStats, resetDatabase,
  importPolygonJson, getPolygonStats, resetPolygons
} from '@/src/services/import.service'

export default function DashboardScreen() {
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [stats, setStats]       = useState<Awaited<ReturnType<typeof getDbStats>> | null>(null)
  const [polyStats, setPolyStats] = useState<Awaited<ReturnType<typeof getPolygonStats>> | null>(null)

  // Load statistik saat layar dibuka
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const s = await getDbStats()
      setStats(s)
      const ps = await getPolygonStats()
      setPolyStats(ps)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handleImport = async () => {
    setLoading(true)
    setProgress({ current: 0, total: 0 })

    const result = await importExcelByname((current, total) => {
      setProgress({ current, total })
    })

    setLoading(false)

    if (result.success) {
      await loadStats()
      Alert.alert(
        '✅ Import Selesai',
        `Berhasil: ${result.imported} data\nDilewati: ${result.skipped} data\nTotal: ${result.totalRows} baris`,
        [{ text: 'OK' }]
      )
    } else {
      Alert.alert(
        '❌ Import Gagal',
        result.errors[0] ?? 'Terjadi kesalahan',
        [{ text: 'OK' }]
      )
    }
  }

  const handleImportPolygon = async () => {
    setLoading(true)
    setProgress({ current: 0, total: 0 })

    const result = await importPolygonJson((current, total) => {
      setProgress({ current, total })
    })

    setLoading(false)

    if (result.imported > 0 || result.skipped > 0) {
      await loadStats()
      Alert.alert(
        '✅ Import Polygon Selesai',
        `Berhasil: ${result.imported} polygon\nDilewati: ${result.skipped} data`,
        [{ text: 'OK' }]
      )
    } else if (result.errors.length > 0) {
      Alert.alert('❌ Import Gagal', result.errors[0])
    }
  }

  const handleReset = () => {
    Alert.alert(
      '⚠️ Reset Data',
      'Semua data wajib pajak akan dihapus. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase()
            await loadStats()
          },
        },
      ]
    )
  }

  const handleResetPolygons = () => {
    Alert.alert(
      '⚠️ Reset Data Peta',
      'Hanya data polygon (peta) yang akan dihapus. Data Wajib Pajak aman. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
             await resetPolygons()
             await loadStats()
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PBB Sync</Text>
        <Text style={styles.headerSub}>Kalurahan Ringinharjo · 2026</Text>
      </View>

      {/* Statistik DB */}
      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>📊 Data Terkini</Text>
        {stats && stats.total > 0 ? (
          <View style={styles.statsGrid}>
            <StatItem label="Total WP" value={stats.total} color="#0F2D38" />
            <StatItem label="Blok 013"  value={stats.blok013} color="#2E6E82" />
            <StatItem label="Blok 014"  value={stats.blok014} color="#2E6E82" />
            <StatItem label="Blok 015"  value={stats.blok015} color="#2E6E82" />
            <StatItem label="Sawah/Bebas" value={stats.sawah} color="#F0A500" />
            <StatItem label="Belum Bayar" value={stats.belumBayar} color="#E85454" />
          </View>
        ) : (
          <Text style={styles.emptyText}>Belum ada data. Import Excel terlebih dahulu.</Text>
        )}
      </View>

      {/* Statistik Polygon */}
      {polyStats && polyStats.total > 0 && (
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>🗺️ Polygon Termapping</Text>
          <View style={styles.statsGrid}>
            <StatItem label="Total" value={polyStats.total} color="#0F2D38" />
            <StatItem label="Blok 013" value={polyStats.blok013} color="#2E6E82" />
            <StatItem label="Blok 014" value={polyStats.blok014} color="#2E6E82" />
            <StatItem label="Blok 015" value={polyStats.blok015} color="#2E6E82" />
          </View>
        </View>
      )}

      {/* Progress bar saat import */}
      {loading && (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {progress.total > 0 
              ? `Mengimport... ${progress.current} / ${progress.total}`
              : 'Menyiapkan data...'}
          </Text>
          {progress.total > 0 && (
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress.current / progress.total) * 100}%` },
                ]}
              />
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={handleImport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>📥  Import DHKP (Excel)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: '#2E6E82' }, loading && styles.btnDisabled]}
        onPress={handleImportPolygon}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>🗺️  Import Polygon JSON</Text>
        )}
      </TouchableOpacity>

      {/* Tombol Reset (hanya tampil kalau ada data) */}
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 }}>
        {polyStats && polyStats.total > 0 && (
          <TouchableOpacity 
            style={[styles.btnDanger, { flex: 1, backgroundColor: '#7A9FAF', marginHorizontal: 0, marginBottom: 0 }]} 
            onPress={handleResetPolygons}
          >
            <Text style={styles.btnText}>🗑 Reset Peta Saja</Text>
          </TouchableOpacity>
        )}

        {stats && stats.total > 0 && (
          <TouchableOpacity 
            style={[styles.btnDanger, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]} 
            onPress={handleReset}
          >
            <Text style={styles.btnText}>🗑  Reset Semua</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

// ── Komponen stat item kecil
function StatItem({ label, value, color }: {
  label: string; value: number; color: string
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNum, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ── Styles
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },
  header:       { backgroundColor: '#0F2D38', padding: 24, paddingTop: 56 },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 13, color: '#7AAFC0', marginTop: 4 },

  statsCard:    { backgroundColor: '#fff', margin: 16, borderRadius: 16,
                  padding: 16, shadowColor: '#000', shadowOpacity: 0.06,
                  shadowRadius: 8, elevation: 2 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: '#0F2D38', marginBottom: 12 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem:     { backgroundColor: '#F0F4F7', borderRadius: 10,
                  padding: 10, minWidth: '30%', flex: 1, alignItems: 'center' },
  statNum:      { fontSize: 22, fontWeight: '800' },
  statLabel:    { fontSize: 10, color: '#7A9FAF', marginTop: 2 },
  emptyText:    { fontSize: 12, color: '#B0BEC8', textAlign: 'center', padding: 12 },

  progressCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
                  borderRadius: 12, padding: 14 },
  progressText: { fontSize: 12, color: '#4A6070', marginBottom: 8 },
  progressBg:   { height: 6, backgroundColor: '#E8EDF2', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2EC97E', borderRadius: 3 },

  btnPrimary:   { backgroundColor: '#0F2D38', margin: 16, marginTop: 8,
                  borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDanger:    { backgroundColor: '#E85454', marginHorizontal: 16, marginTop: 0,
                  marginBottom: 16, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
})
