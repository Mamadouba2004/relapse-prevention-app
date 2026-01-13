
import { Canvas, Circle, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View, ViewProps } from 'react-native';
import { Easing, SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Generate random stars
const STAR_COUNT = 80;
const generateStars = () => {
  return new Array(STAR_COUNT).fill(0).map(() => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.5 + 0.3, // Base opacity
    phase: Math.random() * Math.PI * 2, // Random starting phase
  }));
};

interface SpaceBackgroundProps extends ViewProps {
  children?: React.ReactNode;
}

export const SpaceBackground: React.FC<SpaceBackgroundProps> = ({ children, style, ...props }) => {
  const stars = useMemo(() => generateStars(), []);
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  
  return (
    <View style={[styles.container, style]} {...props}>
      <View style={StyleSheet.absoluteFill}>
        <Canvas style={{ flex: 1 }}>
          {/* Deep Space Gradient Background */}
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(width/2, 0)}
              end={vec(width/2, height)}
              colors={['#020617', '#0f172a', '#1e1b4b']} 
              positions={[0, 0.4, 1]}
            />
          </Rect>

          {/* Stars */}
          <Group>
             {stars.map((star, i) => (
               <Star key={i} star={star} clock={clock} />
             ))}
          </Group>
        </Canvas>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const Star = ({ star, clock }: { star: any, clock: SharedValue<number> }) => {
  const opacity = useDerivedValue(() => {
    return star.opacity + Math.sin(clock.value + star.phase) * 0.3;
  });

  return (
    <Circle cx={star.x} cy={star.y} r={star.r} opacity={opacity} color="white" />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Fallback
  },
  content: {
    flex: 1,
  }
});
