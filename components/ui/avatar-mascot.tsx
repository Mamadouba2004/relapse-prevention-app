/**
 * AvatarMascot - Central avatar with growth level indicator
 * Inspired by Quittr's "Sprout" mascot system
 * Shows user's progress level based on streak
 */

import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface AvatarMascotProps {
  streakDays: number;
  size?: number;
}

// Growth levels based on streak days
const getGrowthLevel = (days: number): { name: string; emoji: string; color: string } => {
  if (days >= 90) return { name: 'Phoenix', emoji: '🔥', color: '#FFD700' };
  if (days >= 60) return { name: 'Warrior', emoji: '⚔️', color: '#9D8CFF' };
  if (days >= 30) return { name: 'Guardian', emoji: '🛡️', color: '#5B7CFF' };
  if (days >= 14) return { name: 'Climber', emoji: '🧗', color: '#4ECDC4' };
  if (days >= 7) return { name: 'Seedling', emoji: '🌱', color: '#34C759' };
  if (days >= 1) return { name: 'Sprout', emoji: '🌿', color: '#8BC34A' };
  return { name: 'New Beginning', emoji: '✨', color: '#AEAEB2' };
};

export function AvatarMascot({ streakDays, size = 140 }: AvatarMascotProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  
  const growth = getGrowthLevel(streakDays);

  useEffect(() => {
    // Gentle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glowOuter,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            opacity: glowAnim,
            borderColor: growth.color,
          },
        ]}
      />
      
      {/* Main avatar circle */}
      <Animated.View
        style={[
          styles.avatarOuter,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            transform: [{ scale: pulseAnim }],
            borderColor: growth.color,
          },
        ]}
      >
        <LinearGradient
          colors={['#1a1f2e', '#0d1117']}
          style={[
            styles.avatarInner,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Text style={styles.emoji}>{growth.emoji}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Growth level label */}
      <Text style={[styles.levelName, { color: growth.color }]}>{growth.name}</Text>
      <Text style={styles.streakText}>{streakDays} days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  glowOuter: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.3,
  },
  avatarOuter: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatarInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 56,
  },
  levelName: {
    fontSize: theme.typography.fontSize.h3,
    fontWeight: theme.typography.fontWeight.bold,
    marginTop: theme.spacing.sm,
  },
  streakText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xxxs,
  },
});
