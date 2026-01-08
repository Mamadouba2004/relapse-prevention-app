/**
 * GradientButton - Primary CTA button with gradient background
 * Replaces standard buttons with JITAI-styled gradient versions
 * 
 * Usage:
 * <GradientButton variant="primary" onPress={handlePress}>
 *   Log Urge
 * </GradientButton>
 */

import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface GradientButtonProps {
  children: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function GradientButton({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  fullWidth = false,
}: GradientButtonProps) {
  
  const handlePress = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };
  
  // Select gradient based on variant
  const gradientColors = theme.gradients[variant];
  
  // Select height based on size
  const height = size === 'small' 
    ? theme.components.button.heightSmall 
    : size === 'large' 
    ? theme.components.button.heightLarge 
    : theme.components.button.height;
  
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        fullWidth && styles.fullWidth,
        style,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            { height },
            disabled && styles.disabled,
            pressed && !disabled && styles.pressedGradient,
          ]}
        >
          <Text style={[
            styles.text,
            size === 'small' && styles.textSmall,
            size === 'large' && styles.textLarge,
            disabled && styles.textDisabled,
          ]}>
            {children}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: theme.components.button.radius,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    paddingHorizontal: theme.components.button.paddingHorizontal,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.components.button.radius,
  },
  text: {
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  textSmall: {
    fontSize: theme.typography.fontSize.body,
  },
  textLarge: {
    fontSize: theme.typography.fontSize.h4,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  pressedGradient: {
    opacity: theme.opacity.normal,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  textDisabled: {
    opacity: theme.opacity.muted,
  },
});
