import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Now',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
  name="profile"
  options={{
    title: 'Pattern',
    tabBarIcon: ({ color, focused }) => (
      <IconSymbol name={focused ? 'person.fill' : 'person'} color={color} size={28} />
    ),
  }}
/>
      <Tabs.Screen
        name="routine"
        options={{
          title: 'Routine',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol name={focused ? 'moon.stars.fill' : 'moon.stars'} color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
    name="analytics"
    options={{
      title: 'Progress',
      tabBarIcon: ({ color }) => (
        <IconSymbol size={28} name="chart.bar.fill" color={color} />
      ),
    }}
  />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol name={focused ? 'gear' : 'gear'} color={color} size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // This hides it from tabs
        }}
      />
    </Tabs>
  );
}
