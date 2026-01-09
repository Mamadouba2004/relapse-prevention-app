/**
 * CircleActionButton - Quittr-style circular action buttons
 * With icon/emoji, label, and optional highlight state
 */

import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface CircleActionButtonProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  emoji?: string;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  highlightColor?: string;
  style?: ViewStyle;
}

export function CircleActionButton({
  icon,
  emoji,
  label,
  onPress,
  highlight = false,
  highlightColor = theme.colors.accent.success,
  style,
}: CircleActionButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <View
        style={[
          styles.circle,
          highlight && { borderColor: highlightColor, borderWidth: 2 },
        ]}
      >
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={28}
            color={highlight ? highlightColor : theme.colors.text.secondary}
          />
        ) : null}
      </View>
      <Text style={[styles.label, highlight && { color: highlightColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    minWidth: 70,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
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
