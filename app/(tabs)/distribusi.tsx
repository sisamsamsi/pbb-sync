import { View, Text, StyleSheet } from 'react-native'

export default function DistribusiScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📋</Text>
        <Text style={styles.title}>Mode Distribusi</Text>
        <Text style={styles.sub}>
          Fitur checklist distribusi SPPT akan tersedia di Sprint 8.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Sprint saat ini fokus pada:{'\n'}
            ✅ Sprint 1 — Database{'\n'}
            ✅ Sprint 2 — Import Excel{'\n'}
            ✅ Sprint 3 — List & Search WP{'\n'}
            ✅ Sprint 4 — Tab + PDF Viewer{'\n'}
            🔵 Sprint 5 — Google Maps{'\n'}
            ⬜ Sprint 6 — Tap Petak → Data WP{'\n'}
            ⬜ Sprint 7 — Deteksi Petak Tanpa Pemilik{'\n'}
            ⬜ Sprint 8 — Mode Distribusi{'\n'}
            ⬜ Sprint 9 — Ringkasan Otomatis{'\n'}
            ⬜ Sprint 10 — Polish & Final
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F7',
               alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 24,
               width: '100%', alignItems: 'center',
               shadowColor: '#000', shadowOpacity: 0.06,
               shadowRadius: 8, elevation: 2 },
  icon:      { fontSize: 48, marginBottom: 12 },
  title:     { fontSize: 18, fontWeight: '800', color: '#0F2D38', marginBottom: 6 },
  sub:       { fontSize: 13, color: '#7A9FAF', textAlign: 'center',
               lineHeight: 20, marginBottom: 16 },
  infoBox:   { backgroundColor: '#F0F4F7', borderRadius: 12,
               padding: 16, width: '100%' },
  infoText:  { fontSize: 12, color: '#4A6070', lineHeight: 22 },
})
