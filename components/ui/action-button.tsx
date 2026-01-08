/**
 * ActionButton - Quick action circle button
 * 64x64px circle with icon and label below
 * 
 * Usage:
 * <ActionButton icon="🧘" label="Breathe" onPress={handleBreathe} />
 */

import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface ActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function ActionButton({ icon, label, onPress, color, style }: ActionButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable 
      onPress={handlePress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.circle, color && { backgroundColor: color }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32, // Circle
    backgroundColor: theme.colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  icon: {
    fontSize: 28,
  },
  label: {
    fontSize: theme.typography.fontSize.caption,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xxs,
  },
});
