/**
 * PanicButton - Prominent emergency/urge button
 * Inspired by Quittr's red "Panic Button"
 */

import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface PanicButtonProps {
  onPress: () => void;
  label?: string;
}

export function PanicButton({ onPress, label = 'Panic Button' }: PanicButtonProps) {
  const handlePress = () => {
    // Heavy haptic for urgent action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={['#DC2626', '#991B1B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={24}
          color="#FFFFFF"
          style={styles.icon}
        />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.sm,
    marginVertical: theme.spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    // Subtle glow effect
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  icon: {
    marginRight: theme.spacing.xxs,
  },
  label: {
    fontSize: theme.typography.fontSize.h4,
    fontWeight: theme.typography.fontWeight.bold,
    color: '#FFFFFF',
  },
});
