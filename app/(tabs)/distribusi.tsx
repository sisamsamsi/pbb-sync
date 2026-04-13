import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert
} from 'react-native'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { getMappingStats, getWpTanpaPolygon, cleanupInvalidPolygons } from '@/src/db/queries'
import { Ionicons } from '@expo/vector-icons'

type MappingStats = Awaited<ReturnType<typeof getMappingStats>>
type WpList       = Awaited<ReturnType<typeof getWpTanpaPolygon>>

const BLOK_LIST = [
  { label: 'Semua', value: undefined },
  { label: 'Blok 013', value: '013' },
  { label: 'Blok 014', value: '014' },
  { label: 'Blok 015', value: '015' },
]

export default function DeteksiScreen() {
  const [stats, setStats]         = useState<MappingStats | null>(null)
  const [wpList, setWpList]       = useState<WpList>([])
  const [blokFilter, setBlokFilter] = useState<string | undefined>(undefined)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Reload otomatis setiap kali tab ini dibuka
  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [blokFilter])
  )

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [s, list] = await Promise.all([
        getMappingStats(),
        getWpTanpaPolygon(blokFilter),
      ])
      setStats(s)
      setWpList(list)
    } catch (e) {
      console.error('loadData error:', e)
    }

    setLoading(false)
    setRefreshing(false)
  }

  // Fungsi Pembersihan Polygon Rusak
  const handleCleanup = () => {
    Alert.alert(
      "Bersihkan Polygon Rusak?",
      "Ini akan menghapus data polygon yang cacat (kurang dari 3 titik) hasil ekstraksi otomatis yang gagal. Data yang sudah bagus tetap aman.\n\nLanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Bersihkan", 
          onPress: async () => {
            setLoading(true)
            const count = await cleanupInvalidPolygons()
            await loadData()
            Alert.alert("Selesai", `${count} data polygon rusak telah dibersihkan. WP tersebut kini muncul kembali di daftar ini.`)
          }
        }
      ]
    )
  }

  // Filter list berdasarkan pencarian
  const filteredList = useMemo(() => {
    if (!search.trim()) return wpList
    const keyword = search.trim().toLowerCase()
    return wpList.filter(wp => 
      wp.namaWp.toLowerCase().includes(keyword) ||
      wp.nop.includes(keyword) ||
      wp.nomorPetak.includes(keyword)
    )
  }, [wpList, search])

  // Tap WP → pergi ke tab Peta dalam drawing mode
  const handleTapWp = (nop: string, blok: string) => {
    router.push({
      pathname: '/(tabs)/peta',
      params: { drawForNop: nop, drawForBlok: blok },
    })
  }

  const renderItem = ({ item }: { item: WpList[number] }) => (
    <TouchableOpacity
      style={styles.wpItem}
      onPress={() => handleTapWp(item.nop, item.blok)}
      activeOpacity={0.7}
    >
      <View style={[styles.statusBar, {
        backgroundColor:
          item.statusBayar === 'sawah' ? '#F0A500' : '#E85454',
      }]} />

      <View style={[styles.avatar, {
        backgroundColor:
          item.statusBayar === 'sawah' ? '#FEF3C7' : '#FEE2E2',
      }]}>
        <Text style={[styles.avatarText, {
          color: item.statusBayar === 'sawah' ? '#D97706' : '#DC2626',
        }]}>
          {item.namaWp.charAt(0)}
        </Text>
      </View>

      <View style={styles.wpInfo}>
        <Text style={styles.wpName} numberOfLines={1}>
          {item.namaWp}
        </Text>
        <Text style={styles.wpSub}>
          {item.blok}-{item.nomorPetak}
          {'  ·  '}
          {item.padukuhan ?? '-'}
          {'  ·  '}
          {item.statusBayar === 'sawah' ? '🌾 Sawah' : `Rp ${item.jumlahSppt?.toLocaleString('id-ID')}`}
        </Text>
      </View>

      <View style={styles.drawBtnSmall}>
        <Text style={styles.drawBtnSmallText}>✏️</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F2D38" />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>⚠️ Deteksi Petak Tanpa Polygon</Text>
          <TouchableOpacity onPress={handleCleanup} style={styles.cleanupBtn}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
            <Text style={styles.cleanupBtnText}>Bersihkan Sampah</Text>
          </TouchableOpacity>
        </View>

        {stats && (
          <View style={styles.overallCard}>
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Progress Mapping Keseluruhan</Text>
              <Text style={styles.overallPct}>{stats.pctOverall}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill,
                { width: `${stats.pctOverall}%` }]} />
            </View>
          </View>
        )}
      </View>

      {/* Bar Pencarian */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#7A9FAF" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari Nama / NOP / Nomor Petak..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#B0BEC8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 10 }}>
            <Ionicons name="close-circle" size={18} color="#B0BEC8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {BLOK_LIST.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip,
              blokFilter === f.value && styles.filterChipActive]}
            onPress={() => setBlokFilter(f.value)}
          >
            <Text style={[styles.filterChipText,
              blokFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>
          {filteredList.length} dari {wpList.length}
        </Text>
      </View>

      {wpList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>Semua Petak Sudah Termapping!</Text>
          <Text style={styles.emptySub}>
            {blokFilter
              ? `Blok ${blokFilter} sudah 100% punya polygon.`
              : 'Seluruh WP sudah punya polygon di peta.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={item => item.nop}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={['#0F2D38']}
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Tap WP untuk gambar polygon manual ✏️
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 13, color: '#7A9FAF' },
  header:       { backgroundColor: '#0F2D38', padding: 16, paddingTop: 16 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle:  { fontSize: 14, fontWeight: '800', color: '#fff' },
  cleanupBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, 
                  backgroundColor: '#E85454', paddingHorizontal: 8, paddingVertical: 4, 
                  borderRadius: 6 },
  cleanupBtnText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  overallCard:  { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: 12 },
  overallRow:   { flexDirection: 'row', justifyContent: 'space-between',
                  marginBottom: 6 },
  overallLabel: { fontSize: 11, color: '#A8CFDF', fontWeight: '600' },
  overallPct:   { fontSize: 16, fontWeight: '800', color: '#2EC97E' },
  progressBg:   { height: 8, backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2EC97E', borderRadius: 4 },
  
  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                     margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E8EDF2' },
  searchInput:  { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 13, color: '#0F2D38' },

  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff',
                  borderBottomWidth: 1, borderBottomColor: '#E8EDF2' },
  filterChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  filterChipActive:     { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  filterChipText:       { fontSize: 11, fontWeight: '600', color: '#4A6070' },
  filterChipTextActive: { color: '#fff' },
  countText:    { marginLeft: 'auto', fontSize: 11,
                  color: '#E85454', fontWeight: '700' },
  listHeader:   { fontSize: 11, color: '#7A9FAF', textAlign: 'center',
                  paddingVertical: 8 },
  wpItem:       { flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#fff', marginHorizontal: 12,
                  marginTop: 8, borderRadius: 12, overflow: 'hidden',
                  elevation: 1 },
  statusBar:    { width: 4, alignSelf: 'stretch' },
  avatar:       { width: 36, height: 36, borderRadius: 10, margin: 10,
                  alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '800' },
  wpInfo:       { flex: 1, paddingVertical: 10 },
  wpName:       { fontSize: 12, fontWeight: '700', color: '#0F2D38' },
  wpSub:        { fontSize: 10, color: '#7A9FAF', marginTop: 2 },
  drawBtnSmall: { width: 36, height: 36, borderRadius: 10, margin: 10,
                  backgroundColor: '#F0F4F7',
                  alignItems: 'center', justifyContent: 'center' },
  drawBtnSmallText: { fontSize: 16 },
  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 40, gap: 8 },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { fontSize: 16, fontWeight: '800', color: '#0F2D38' },
  emptySub:     { fontSize: 13, color: '#7A9FAF', textAlign: 'center',
                  lineHeight: 20 },
})
