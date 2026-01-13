/**
 * CircleActionButton - Quittr-style circular action buttons
 * With icon/emoji, label, and optional highlight state
 */

import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface CircleActionButtonProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  emoji?: string;
  label: string;
  onPress: () => Promise<void> | void;
  highlight?: boolean;
  highlightColor?: string;
  style?: ViewStyle;
  // Added props
  size?: number;
  type?: string;
  compact?: boolean;
}

export function CircleActionButton({
  icon,
  emoji,
  label,
  onPress,
  highlight = false,
  highlightColor = theme.colors.accent.success,
  style,
  size = 60,
  type, // unused but allowed
  compact = false,
}: CircleActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
        compact && { minWidth: size },
      ]}
    >
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          highlight && {
            backgroundColor: highlightColor,
            borderColor: highlightColor,
            shadowColor: highlightColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 5,
          },
        ]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={Math.round(size * 0.4)}
            color={highlight ? '#FFF' : theme.colors.text.primary}
          />
        )}
        {emoji && (
          <Text style={[styles.emoji, { fontSize: Math.round(size * 0.45) }]}>
            {emoji}
          </Text>
        )}
      </View>
      {!compact && <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 70,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  circle: {
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xxs,
    textAlign: 'center',
  },
});
