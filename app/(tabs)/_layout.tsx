import React from 'react';
import { Link, Tabs } from 'expo-router';
import { Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// TabBarIcon component using Ionicons
function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const activeColor = '#0F2D38'; // Darkest brand color from blueprint

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: '#A0B2C0',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E8EDF2',
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: '#0F2D38',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 16,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="byname"
        options={{
          title: 'Byname',
          tabBarIcon: ({ color }) => <TabBarIcon name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null, // Sembunyikan tab standar "two"
        }}
      />
    </Tabs>
  );
}
