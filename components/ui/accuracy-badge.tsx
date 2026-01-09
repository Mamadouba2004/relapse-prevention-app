/**
 * AccuracyBadge - Model accuracy indicator pill
 * Shows brain icon + percentage for JITAI prediction accuracy
 */

import { theme } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AccuracyBadgeProps {
  accuracy: number;  // 0-100
}

export function AccuracyBadge({ accuracy }: AccuracyBadgeProps) {
  // Determine color based on accuracy
  const getColor = () => {
    if (accuracy >= 70) return theme.colors.accent.success;
    if (accuracy >= 50) return theme.colors.risk.moderate;
    return theme.colors.text.tertiary;
  };
  
  const color = getColor();
  
  return (
    <View style={[styles.container, { borderColor: `${color}40` }]}>
      <Text style={styles.brain}>🧠</Text>
      <Text style={[styles.accuracy, { color }]}>{accuracy}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 124, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  brain: {
    fontSize: 14,
  },
  accuracy: {
    fontSize: 14,
    fontWeight: '600',
  },
});
