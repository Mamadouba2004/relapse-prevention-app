/**
 * RiskGauge - Circular risk prediction display (JITAI)
 * Core JITAI component showing current risk percentage with confidence interval
 * Predictive visualization instead of reactive tracking
 * 
 * Usage:
 * <RiskGauge risk={47} confidenceMin={38} confidenceMax={54} lastUpdated="2 min ago" />
 */

import { getRiskColor, theme } from '@/constants/theme';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

interface RiskGaugeProps {
  risk: number;                    // 0-100 risk percentage (JITAI prediction)
  confidenceMin?: number;          // Lower bound of confidence interval
  confidenceMax?: number;          // Upper bound of confidence interval
  lastUpdated?: string;            // e.g., "2 min ago"
  size?: number;
  strokeWidth?: number;
  showConfidence?: boolean;        // Show confidence interval
  animated?: boolean;
}

// Get risk level label based on percentage (JITAI terminology)
const getRiskLevelLabel = (risk: number): { label: string; bgColor: string } => {
  if (risk >= 70) {
    return { 
      label: 'High Risk Level', 
      bgColor: 'rgba(255, 107, 107, 0.15)'
    };
  }
  if (risk >= 30) {
    return { 
      label: 'Moderate Risk Level', 
      bgColor: 'rgba(255, 183, 77, 0.15)'
    };
  }
  return { 
    label: 'Low Risk Level', 
    bgColor: 'rgba(78, 205, 196, 0.15)'
  };
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function RiskGauge({
  risk,
  confidenceMin,
  confidenceMax,
  lastUpdated = 'Just now',
  size = 200,
  strokeWidth = 12,
  showConfidence = true,
  animated = true,
}: RiskGaugeProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  
  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  const riskColor = getRiskColor(risk);
  const riskLevel = getRiskLevelLabel(risk);
  
  // Animate on mount or when risk changes
  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: risk / 100,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(risk / 100);
    }

    // Pulse animation (faster when high risk)
    const pulseDuration = risk >= 70 ? 1000 : 2500;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: pulseDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: pulseDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Glow animation
    const glow = Animated.loop(
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
    );
    glow.start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [risk, animated]);
  
  // Calculate stroke dash offset for progress
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  
  return (
    <View style={styles.outerContainer}>
      {/* Outer glow ring */}
      <Animated.View
        style={[
          styles.glowOuter,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            opacity: glowAnim,
            borderColor: riskColor,
          },
        ]}
      />
      
      {/* Main gauge with pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={[styles.container, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={riskColor} stopOpacity="1" />
                <Stop offset="100%" stopColor={riskColor} stopOpacity="0.6" />
              </LinearGradient>
            </Defs>
            
            <G rotation="-90" origin={`${center}, ${center}`}>
              {/* Background circle */}
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke="rgba(100, 116, 139, 0.2)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              
              {/* Progress circle */}
              <AnimatedCircle
                cx={center}
                cy={center}
                r={radius}
                stroke="url(#riskGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          </Svg>
          
          {/* Center content */}
          <View style={styles.centerContent}>
            <Text style={[styles.percentageText, { color: riskColor }]}>
              {Math.round(risk)}%
            </Text>
            {showConfidence && confidenceMin !== undefined && confidenceMax !== undefined && (
              <Text style={styles.confidenceText}>
                ({confidenceMin}-{confidenceMax}%)
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
      
      {/* Risk level badge */}
      <View style={[styles.riskLevelBadge, { backgroundColor: riskLevel.bgColor }]}>
        <View style={[styles.riskLevelDot, { backgroundColor: riskColor }]} />
        <Text style={[styles.riskLevelText, { color: riskColor }]}>
          {riskLevel.label}
        </Text>
      </View>
      
      {/* Last updated timestamp */}
      <Text style={styles.lastUpdated}>
        Last updated {lastUpdated}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  glowOuter: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.3,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
  },
  confidenceText: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
  riskLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  riskLevelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskLevelText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  lastUpdated: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xs,
  },
});
