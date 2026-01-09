/**
 * StarField - Animated space background with twinkling stars
 * Inspired by Quittr app's cosmic theme
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  duration: number;
}

export function StarField() {
  const stars = useRef<Star[]>(
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2 + 1,
      opacity: new Animated.Value(Math.random()),
      duration: Math.random() * 3000 + 2000,
    }))
  ).current;

  useEffect(() => {
    stars.forEach((star) => {
      const twinkle = () => {
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.8 + 0.2,
            duration: star.duration,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.4,
            duration: star.duration,
            useNativeDriver: true,
          }),
        ]).start(() => twinkle());
      };
      twinkle();
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((star) => (
        <Animated.View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
  },
});
