/**
 * StatCard - Dashboard metric card
 * Shows a value with a label below
 * 
 * Usage:
 * <StatCard value="47%" label="Risk Score" color={theme.colors.risk.moderate} />
 */

import { theme } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;
  style?: ViewStyle;
}

export function StatCard({ value, label, color, style }: StatCardProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.value, color && { color }]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 80,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  value: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xxxs,
  },
  label: {
    fontSize: theme.typography.fontSize.caption,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
  },
});
