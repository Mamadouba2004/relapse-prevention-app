import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5B7CFF', // JITAI Blue
        tabBarInactiveTintColor: '#64748B',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          height: 64,
          backgroundColor: '#0F172A',
          borderRadius: 32,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 5,
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        },
        tabBarItemStyle: {
          height: 56,
          paddingVertical: 8,
        },
        tabBarBackground: () => (
          // Optional: Add blur effect here if needed
          null
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 24 : 22}
              name="house.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Risk',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol name={focused ? 'chart.bar.fill' : 'chart.bar'} color={color} size={focused ? 24 : 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol name={focused ? 'book.fill' : 'book'} color={color} size={focused ? 24 : 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Privacy',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="lock.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol name={focused ? 'gear' : 'gear'} color={color} size={focused ? 24 : 22} />
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
