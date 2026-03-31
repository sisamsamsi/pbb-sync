import {
  View, Text, StyleSheet, FlatList,
  TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { router } from 'expo-router'
import { getWajibPajak } from '@/src/db/queries'
import { Ionicons } from '@expo/vector-icons'

// ── Tipe data WP dari DB
type WP = Awaited<ReturnType<typeof getWajibPajak>>[number]

// ── Konstanta Filter
const BLOK_FILTERS = [
  { label: 'Semua', value: undefined },
  { label: 'Blok 013', value: '013' },
  { label: 'Blok 014', value: '014' },
  { label: 'Blok 015', value: '015' },
]

const STATUS_FILTERS = [
  { label: 'Semua', value: undefined },
  { label: 'Belum', value: 'belum' },
  { label: 'Diterima', value: 'diterima' },
  { label: 'Sawah', value: 'sawah' },
]

export default function BynameScreen() {
  const [data, setData]           = useState<WP[]>([])
  const [search, setSearch]       = useState('')
  const [blokFilter, setBlokFilter]     = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)

  const PAGE_SIZE = 30

  // Load data dari DB
  const loadData = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)

    try {
      const currentPage = reset ? 0 : page
      const result = await getWajibPajak({
        search,
        blok: blokFilter,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      })

      if (reset) {
        setData(result)
        setPage(1)
      } else {
        setData(prev => [...prev, ...result])
        setPage(prev => prev + 1)
      }

      setHasMore(result.length === PAGE_SIZE)
    } catch (error) {
      console.error('Error loading WP data:', error)
    } finally {
      setLoading(false)
    }
  }, [search, blokFilter, statusFilter, page, loading])

  // Reset & reload saat filter/search berubah
  useEffect(() => {
    setPage(0)
    setHasMore(true)
    loadData(true)
  }, [search, blokFilter, statusFilter])

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadData(false)
    }
  }

  const handleTapWP = (nop: string) => {
    router.push({
      pathname: '/wp/[nop]',
      params: { nop }
    } as any)
  }

  // ── Render Header List Item (Colored bar based on status)
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'diterima':  return '#2EC97E'
      case 'sawah': return '#F0A500' // Sawah (Amber/Gold)
      default:       return '#E85454' // Belum (Red)
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'diterima':  return '✓ Diterima'
      case 'sawah': return '🌾 Sawah'
      default:       return '✗ Belum'
    }
  }

  // ── Render satu item WP
  const renderItem = ({ item }: { item: WP }) => (
    <TouchableOpacity
      style={styles.wpItem}
      onPress={() => handleTapWP(item.nop)}
      activeOpacity={0.7}
    >
      {/* Garis status kiri */}
      <View style={[styles.statusBar, { backgroundColor: getStatusColor(item.statusBayar) }]} />

      {/* Avatar inisial */}
      <View style={[styles.avatar, {
        backgroundColor:
          item.statusBayar === 'diterima'  ? '#DCFCE7' :
          item.statusBayar === 'sawah' ? '#FEF3C7' : '#FEE2E2'
      }]}>
        <Text style={[styles.avatarText, { color: getStatusColor(item.statusBayar) }]}>
          {item.namaWp.charAt(0)}
        </Text>
      </View>

      {/* Info WP */}
      <View style={styles.wpInfo}>
        <Text style={styles.wpName} numberOfLines={1}>
          {item.namaWp}
        </Text>
        <Text style={styles.wpNop}>
          {item.blok}-{item.nomorPetak} • {item.padukuhan || 'Mandingan'}
        </Text>
      </View>

      {/* Harga SPPT + Status Text */}
      <View style={styles.wpRight}>
        <Text style={styles.wpSppt}>
          {item.jumlahSppt === 0 ? 'Bebas' : `Rp ${item.jumlahSppt?.toLocaleString('id-ID')}`}
        </Text>
        <Text style={[styles.wpStatusLabel, { color: getStatusColor(item.statusBayar) }]}>
          {getStatusLabel(item.statusBayar)}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Data DHKP (Wajib Pajak)</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / nomor petak / NOP..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Row 1: Blok */}
      <View style={styles.filterRow}>
        {BLOK_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip, blokFilter === f.value && styles.filterChipActive]}
            onPress={() => setBlokFilter(f.value)}
          >
            <Text style={[styles.filterChipText, blokFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter Row 2: Status */}
      <View style={[styles.filterRow, { borderBottomWidth: 1, borderBottomColor: '#E8EDF2', paddingBottom: 10 }]}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Counter items info */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
             <Text style={styles.countText}>{data.length} WP</Text>
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={data}
        keyExtractor={item => item.nop}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? <ActivityIndicator color="#0F2D38" style={{ padding: 20 }} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="person-outline" size={48} color="#B0BEC8" />
              <Text style={styles.emptyText}>Tidak ada data wajib pajak</Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F7' },

  // Header
  header:       { backgroundColor: '#0F2D38', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 52 },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 12 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                  borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:  { flex: 1, color: '#fff', fontSize: 14, padding: 0 },

  // Filter
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8,
                  backgroundColor: '#fff' },
  filterChip:   { paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 10, backgroundColor: '#F0F4F7',
                  borderWidth: 1, borderColor: '#E8EDF2' },
  filterChipActive: { backgroundColor: '#0F2D38', borderColor: '#0F2D38' },
  filterChipText:   { fontSize: 12, fontWeight: '700', color: '#4A6070' },
  filterChipTextActive: { color: '#fff' },
  countText:    { fontSize: 11, color: '#B0BEC8', fontWeight: '600' },

  // List
  listContent:  { paddingBottom: 40 },
  wpItem:       { flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
                  borderRadius: 14, overflow: 'hidden',
                  // Shadow for iOS/Android
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  statusBar:    { width: 5, alignSelf: 'stretch' },
  avatar:       { width: 40, height: 40, borderRadius: 12, margin: 12,
                  alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 16, fontWeight: '900' },
  wpInfo:       { flex: 1, paddingVertical: 12 },
  wpName:       { fontSize: 13, fontWeight: '700', color: '#0F2D38', marginBottom: 2 },
  wpNop:        { fontSize: 11, color: '#7A9FAF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  wpRight:      { paddingRight: 16, alignItems: 'flex-end' },
  wpSppt:       { fontSize: 12, fontWeight: '800', color: '#0F2D38' },
  closeBtnText: { fontWeight: '700', color: '#0F2D38' },
  wpStatusLabel:{ fontSize: 10, fontWeight: '700', marginTop: 4 },

  // Empty State
  emptyBox:     { padding: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText:    { 
    textAlign: 'center', color: '#7A9FAF', fontSize: 13, 
    marginTop: 40, paddingHorizontal: 40, lineHeight: 20 
  }
})
