/**
 * JITAIStatCard - Stats display for JITAI metrics
 * Shows High-Risk Windows Navigated, Model Accuracy, etc.
 * Proactive tracking instead of failure counting
 */

import { theme } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface JITAIStatCardProps {
  value: string | number;
  label: string;
  highlight?: boolean;  // For emphasis on key metrics
}

export function JITAIStatCard({ value, label, highlight = false }: JITAIStatCardProps) {
  return (
    <View style={styles.container}>
      <Text style={[
        styles.value,
        highlight && styles.valueHighlight
      ]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    minWidth: 80,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  valueHighlight: {
    color: theme.colors.accent.success,
  },
  label: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
