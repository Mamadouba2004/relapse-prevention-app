import * as Haptics from 'expo-haptics';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
interface RoutineItem {
  id: string;
  label: string;
  emoji: string;
  completed: boolean;
}

const ChecklistItem = ({ item, onPress, disabled }: { item: RoutineItem, onPress: () => void, disabled: boolean }) => {
  const fadeAnim = React.useRef(new Animated.Value(item.completed ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: item.completed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [item.completed]);

  return (
    <TouchableOpacity
      style={[
        styles.checklistItem,
        item.completed && styles.checklistItemCompleted
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.itemEmoji}>{item.emoji}</Text>
      <Text style={[
        styles.itemLabel,
        item.completed && styles.itemLabelCompleted
      ]}>
        {item.label}
      </Text>
      <View style={[
        styles.checkbox,
        item.completed && styles.checkboxChecked
      ]}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
};

export default function RoutineScreen() {
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [completionStreak, setCompletionStreak] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [usesPhoneAsAlarm, setUsesPhoneAsAlarm] = useState(false);
  
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRoutineStatus();
  }, []);

  // Auto-complete routine when all items are checked
  useEffect(() => {
    const allCompleted = routineItems.every(item => item.completed);

    if (allCompleted && !todayCompleted && routineItems.length > 0) {
      // Auto-complete routine
      saveRoutine(true);

      // Haptic feedback for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [routineItems, todayCompleted]);

  const completedCount = routineItems.filter(i => i.completed).length;
  const progressPercent = routineItems.length > 0 ? Math.round((completedCount / routineItems.length) * 100) : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  // Helper functions to get routine items based on user preference
  const getStandardRoutine = (): RoutineItem[] => [
    { id: 'phone_bedroom', label: 'Phone charging outside bedroom', emoji: '📱', completed: false },
    { id: 'bedtime_set', label: 'Set bedtime alarm', emoji: '⏰', completed: false },
    { id: 'social_media_closed', label: 'Close all social media apps', emoji: '📵', completed: false },
    { id: 'read_book', label: 'Read for 5-10 minutes', emoji: '📖', completed: false },
  ];

  const getPhoneAsAlarmRoutine = (): RoutineItem[] => [
    { id: 'dnd_enabled', label: 'Enable Do Not Disturb until alarm', emoji: '🔕', completed: false },
    { id: 'phone_across_room', label: 'Place phone face-down across room', emoji: '📱', completed: false },
    { id: 'close_apps', label: 'Close all apps except Clock', emoji: '📵', completed: false },
    { id: 'read_book', label: 'Read for 5-10 minutes', emoji: '📖', completed: false },
  ];

  const loadRoutineStatus = async () => {
    const db = await SQLite.openDatabaseAsync('behavior.db');

    try {
      // Create routine table if doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS evening_routine (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          items_completed TEXT,
          fully_completed BOOLEAN,
          created_at INTEGER
        );
      `);

      // Migration: Ensure uses_phone_as_alarm column exists in user_profile
      try {
        await db.execAsync('ALTER TABLE user_profile ADD COLUMN uses_phone_as_alarm INTEGER DEFAULT 0');
      } catch (e) {
        // Column likely already exists or table doesn't exist, ignore
      }

      // Load user preference for phone as alarm
      let needsPhone = false;
      try {
        const profileResult = await db.getAllAsync<{ uses_phone_as_alarm: number }>(
          'SELECT uses_phone_as_alarm FROM user_profile LIMIT 1'
        );
        needsPhone = profileResult[0]?.uses_phone_as_alarm === 1;
      } catch (error) {
        console.log('Could not read user profile preference, using default');
      }

      setUsesPhoneAsAlarm(needsPhone);

      // Set routine items based on preference
      const items = needsPhone ? getPhoneAsAlarmRoutine() : getStandardRoutine();

      // Check if routine was completed today
      const today = new Date().toISOString().split('T')[0];

      const todayResult = await db.getAllAsync<{
        items_completed: string;
        fully_completed: number;
      }>(
        'SELECT items_completed, fully_completed FROM evening_routine WHERE date = ?',
        [today]
      );

      if (todayResult.length > 0) {
        const completedItems = JSON.parse(todayResult[0].items_completed) as string[];
        setRoutineItems(
          items.map(item => ({
            ...item,
            completed: completedItems.includes(item.id)
          }))
        );
        setTodayCompleted(todayResult[0].fully_completed === 1);
      } else {
        setRoutineItems(items);
      }

      // Calculate streak
      await calculateStreak(db);

    } catch (error) {
      console.error('Error loading routine:', error);
      // Fallback to standard routine if there's an error
      setRoutineItems(getStandardRoutine());
    }
  };

  const calculateStreak = async (db: SQLite.SQLiteDatabase) => {
    try {
      const results = await db.getAllAsync<{
        date: string;
        fully_completed: number;
      }>(
        'SELECT date, fully_completed FROM evening_routine ORDER BY date DESC LIMIT 30'
      );

      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < results.length; i++) {
        const routineDate = new Date(results[i].date);
        const daysDiff = Math.floor((today.getTime() - routineDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === i && results[i].fully_completed === 1) {
          streak++;
        } else {
          break;
        }
      }

      setCompletionStreak(streak);
    } catch (error) {
      console.error('Error calculating streak:', error);
    }
  };

  const toggleItem = async (itemId: string) => {
    if (todayCompleted) {
      Alert.alert('Already Completed', 'You\'ve already completed your routine for today! Great job! ✨');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setRoutineItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const saveRoutine = async (fullyCompleted: boolean) => {
    const db = await SQLite.openDatabaseAsync('behavior.db');
    const today = new Date().toISOString().split('T')[0];
    const completedIds = routineItems.filter(i => i.completed).map(i => i.id);

    try {
      // Delete existing entry for today if exists
      await db.runAsync('DELETE FROM evening_routine WHERE date = ?', [today]);

      // Insert today's completion
      await db.runAsync(
        'INSERT INTO evening_routine (date, items_completed, fully_completed, created_at) VALUES (?, ?, ?, ?)',
        [today, JSON.stringify(completedIds), fullyCompleted ? 1 : 0, Date.now()]
      );

      setTodayCompleted(true);
      await calculateStreak(db);

      Alert.alert(
        '✨ Routine Complete!',
        fullyCompleted 
          ? 'Great job! Your evening routine is protecting you from high-risk moments.' 
          : 'Good enough! You showed up tonight. That\'s what matters.',
        [{ text: 'Nice!', style: 'default' }]
      );

    } catch (error) {
      console.error('Error saving routine:', error);
      Alert.alert('Error', 'Could not save routine. Please try again.');
    }
  };

  const resetForNewDay = async () => {
    Alert.alert(
      'Reset Routine?',
      'This will uncheck all items for a fresh start. Your streak is safe!',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: () => {
            setRoutineItems(prev => prev.map(item => ({ ...item, completed: false })));
            setTodayCompleted(false);
          }
        }
      ]
    );
  };

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🌙 Evening Routine</Text>
      <Text style={styles.subtitle}>Prevention over intervention</Text>

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <Text style={styles.streakNumber}>{completionStreak}</Text>
        <Text style={styles.streakLabel}>Day Streak</Text>
        <Text style={styles.streakSubtext}>
          {completionStreak === 0 && 'Complete tonight to start your streak!'}
          {completionStreak === 1 && 'Great start! Keep it going tomorrow.'}
          {completionStreak > 1 && `You're building a powerful habit! 🔥`}
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            {completedCount} of {routineItems.length} completed
          </Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: widthInterpolated }]} />
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.checklistSection}>
        <Text style={styles.sectionTitle}>Tonight's Routine</Text>
        
        {routineItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onPress={() => toggleItem(item.id)}
            disabled={todayCompleted}
          />
        ))}
      </View>

      {/* Completion Status */}
      {todayCompleted && (
        <View style={styles.completedCard}>
          <View style={styles.completedHeader}>
            <Text style={styles.completedEmoji}>✨</Text>
            <View style={styles.completedTextContainer}>
              <Text style={styles.completedTitle}>Complete</Text>
              <Text style={styles.completedSubtext}>Well done tonight</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetForNewDay}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Why This Matters</Text>
        <Text style={styles.infoText}>
          Lapses don't happen randomly. They follow patterns.{'\n\n'}
          
          Taking your phone to bed, staying up late, scrolling social media—these are "Seemingly Irrelevant Decisions" (SIDs) that make you vulnerable.{'\n\n'}
          
          This routine interrupts those patterns before they lead to urges.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 60,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  streakCard: {
    backgroundColor: '#1E3A8A',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  streakSubtext: {
    fontSize: 14,
    color: '#93C5FD',
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 16,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 12,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  checklistSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  checklistItem: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistItemCompleted: {
    backgroundColor: '#14532D',
    borderColor: '#166534',
  },
  itemEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
    color: '#E2E8F0',
  },
  itemLabelCompleted: {
    color: '#BBF7D0',
    textDecorationLine: 'line-through',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  completedEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  completedTextContainer: {
    flex: 1,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 2,
  },
  completedSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 6,
  },
  resetButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
});
