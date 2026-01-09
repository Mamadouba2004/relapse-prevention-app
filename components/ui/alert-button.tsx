/**
 * AlertButton - High-risk window navigation button
 * Only shown when risk > 70% (JITAI auto-trigger)
 * System initiates help predictively
 */

import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

interface AlertButtonProps {
  onPress: () => void;
  label?: string;
}

export function AlertButton({ 
  onPress, 
  label = '⚠️ Navigate High-Risk Window' 
}: AlertButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    // Attention-grabbing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onPress();
  };

  return (
    <View style={styles.wrapper}>
      {/* Animated glow behind */}
      <Animated.View 
        style={[
          styles.glowEffect,
          { opacity: glowAnim }
        ]} 
      />
      
      <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.container,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={['#DC2626', '#B91C1C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="shield-alert"
                size={24}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.label}>{label}</Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color="rgba(255,255,255,0.8)"
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: theme.spacing.sm,
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    bottom: -4,
    backgroundColor: '#DC2626',
    borderRadius: theme.borderRadius.lg,
    opacity: 0.3,
  },
  container: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  pressed: {
    opacity: 0.9,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
