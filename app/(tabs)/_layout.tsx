import { Tabs } from 'expo-router'
import { Platform } from 'react-native'

// Warna brand
const C1 = '#0F2D38'
const GRAY = '#B0BEC8'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C1,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8EDF2',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: C1,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
        },
      }}
    >
      {/* Tab 1: Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🏠" focused={focused} color={color} />
          ),
          headerTitle: 'PBB Sync',
        }}
      />

      {/* Tab 2: Peta */}
      <Tabs.Screen
        name="peta"
        options={{
          title: 'Peta Blok',
          tabBarLabel: 'Peta',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🗺️" focused={focused} color={color} />
          ),
          headerTitle: 'Peta Blok PBB',
        }}
      />

      {/* Tab 3: Byname */}
      <Tabs.Screen
        name="byname"
        options={{
          title: 'Data WP',
          tabBarLabel: 'DHKP',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="👥" focused={focused} color={color} />
          ),
          headerTitle: 'Data Wajib Pajak',
        }}
      />

      <Tabs.Screen
        name="distribusi"
        options={{
          title: 'Validasi Peta',
          tabBarLabel: 'Validasi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="⚠️" focused={focused} color={color} />
          ),
          headerTitle: 'Deteksi Petak Tanpa Polygon',
        }}
      />
    </Tabs>
  )
}

// Komponen ikon tab sederhana pakai emoji
function TabIcon({
  emoji,
  focused,
  color,
}: {
  emoji: string
  focused: boolean
  color: string
}) {
  const { View, Text } = require('react-native')
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: focused ? C1 : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: focused ? 16 : 18 }}>{emoji}</Text>
    </View>
  )
}
