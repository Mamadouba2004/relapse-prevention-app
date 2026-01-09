/**
 * CheckInCard - Next scheduled check-in display
 * Shows countdown to next proactive check-in
 * Core JITAI component for scheduled interventions
 */

import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CheckInCardProps {
  timeUntil: string;           // e.g., "4 hours"
  nextCheckInTime?: string;    // e.g., "6:00 PM"
  onPress?: () => void;
}

export function CheckInCard({ timeUntil, nextCheckInTime, onPress }: CheckInCardProps) {
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
    >
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="clock-outline" 
            size={24} 
            color={theme.colors.accent.primary} 
          />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Next Check-in</Text>
          <Text style={styles.subtitle}>in {timeUntil}</Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        {nextCheckInTime && (
          <Text style={styles.time}>{nextCheckInTime}</Text>
        )}
        <MaterialCommunityIcons 
          name="chevron-right" 
          size={24} 
          color={theme.colors.text.tertiary} 
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(91, 124, 255, 0.3)',
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(91, 124, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  time: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.accent.primary,
  },
});
