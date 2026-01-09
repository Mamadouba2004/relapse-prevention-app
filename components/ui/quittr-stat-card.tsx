/**
 * QuittrStatCard - Stats display like Quittr app
 * Clean, minimal stat display with value and label
 */

import { theme } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface QuittrStatCardProps {
  value: string | number;
  label: string;
  style?: ViewStyle;
}

export function QuittrStatCard({ value, label, style }: QuittrStatCardProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.text.tertiary,
    marginBottom: theme.spacing.xxxs,
    textTransform: 'capitalize',
  },
  value: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
});
