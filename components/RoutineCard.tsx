import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, SlideOutRight } from 'react-native-reanimated';

interface RoutineCardProps {
  items: string[];
  onComplete: () => void;
}

export function RoutineCard({ items, onComplete }: RoutineCardProps) {
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  const toggleItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleMarkComplete = () => {
    if (checkedIndices.size !== items.length) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsCompleted(true);
    
    // Notify parent after animation
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  if (isCompleted) {
    return null; 
  }

  const allDone = checkedIndices.size === items.length;

  return (
    <Animated.View 
      entering={FadeInDown.duration(600)} 
      exiting={SlideOutRight.duration(500)}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.15)', 'rgba(67, 56, 202, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="moon-waning-crescent" size={24} color="#818CF8" />
          </View>
          <View>
            <Text style={styles.title}>Evening Routine</Text>
            <Text style={styles.subtitle}>Wind down for better sleep</Text>
          </View>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          {items.map((item, index) => {
            const isChecked = checkedIndices.has(index);
            return (
              <Pressable
                key={index}
                onPress={() => toggleItem(index)}
                style={styles.itemRow}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.progressText}>
            Progress: {checkedIndices.size}/{items.length} complete
          </Text>
          
          <Pressable
            onPress={handleMarkComplete}
            disabled={!allDone}
            style={[
              styles.completeButton,
              allDone ? styles.completeButtonActive : styles.completeButtonDisabled
            ]}
          >
            <Text style={[
              styles.buttonText, 
              allDone ? styles.buttonTextActive : styles.buttonTextDisabled
            ]}>
              Mark Complete
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    padding: 24,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  checklist: {
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.5)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  itemText: {
    fontSize: 16,
    color: '#E2E8F0',
  },
  itemTextChecked: {
    color: 'rgba(226, 232, 240, 0.5)',
    textDecorationLine: 'line-through',
  },
  footer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
    textAlign: 'center',
  },
  completeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  completeButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#FFF',
  },
  buttonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
});