/**
 * EmojiButton - Animated selection button with emoji
 * Uses react-native-reanimated for smooth scale/glow animation
 * 
 * Usage:
 * <EmojiButton 
 *   emoji="😤" 
 *   label="Frustrated" 
 *   selected={mood === 'frustrated'} 
 *   onPress={() => setMood('frustrated')} 
 * />
 */

import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

interface EmojiButtonProps {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function EmojiButton({ emoji, label, selected, onPress }: EmojiButtonProps) {
  const scale = useSharedValue(1);
  const borderOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.05 : 1, {
      damping: 15,
      stiffness: 150,
    });
    borderOpacity.value = withSpring(selected ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: 2,
    borderColor: `rgba(91, 124, 255, ${borderOpacity.value})`,
    shadowOpacity: borderOpacity.value * 0.3,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.container,
          selected && styles.selected,
          animatedStyle,
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    borderRadius: 40, // Circle
    backgroundColor: theme.colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  selected: {
    backgroundColor: theme.colors.background.elevated,
  },
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: theme.typography.fontSize.caption,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: theme.spacing.xxs,
  },
  labelSelected: {
    color: theme.colors.accent.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
