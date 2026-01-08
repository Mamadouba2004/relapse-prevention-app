/**
 * RiskGauge - Circular progress indicator for risk percentage
 * Replaces static percentage displays with animated gauges
 * 
 * Usage:
 * <RiskGauge riskPercent={75} size={200} showLabel />
 */

import { getRiskColor, getRiskLevel, theme } from '@/constants/theme';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface RiskGaugeProps {
  riskPercent: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  animated?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function RiskGauge({
  riskPercent,
  size = theme.components.riskGauge.diameter,
  strokeWidth = theme.components.riskGauge.strokeWidth,
  showLabel = true,
  animated = true,
}: RiskGaugeProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Animate on mount or when risk changes
  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: riskPercent,
        duration: theme.animation.duration.verySlow,
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(riskPercent);
    }
  }, [riskPercent, animated]);
  
  // Calculate stroke dash offset for progress
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });
  
  const riskColor = getRiskColor(riskPercent);
  const riskLevel = getRiskLevel(riskPercent);
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Background circle */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={theme.colors.background.elevated}
            strokeWidth={strokeWidth}
            fill="none"
          />
          
          {/* Progress circle */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={riskColor}
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
        <Text style={styles.percentageText}>
          {Math.round(riskPercent)}%
        </Text>
        {showLabel && (
          <Text style={[styles.labelText, { color: riskColor }]}>
            {riskLevel} RISK
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: theme.typography.fontSize.hero,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.fontSize.hero * 1.1,
  },
  labelText: {
    fontSize: theme.typography.fontSize.caption,
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: theme.typography.letterSpacing.wider,
    marginTop: theme.spacing.xxxs,
  },
});
