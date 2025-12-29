import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
    Alert,
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

export default function RoutineScreen() {
  const [routineEnabled, setRoutineEnabled] = useState(false);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([
    { id: 'phone_bedroom', label: 'Phone charging outside bedroom', emoji: '📱', completed: false },
    { id: 'bedtime_set', label: 'Set bedtime alarm', emoji: '⏰', completed: false },
    { id: 'social_media_closed', label: 'Close all social media apps', emoji: '📵', completed: false },
    { id: 'read_book', label: 'Read for 15 minutes', emoji: '📖', completed: false },
    { id: 'check_in', label: 'Evening check-in complete', emoji: '✓', completed: false },
  ]);
  const [completionStreak, setCompletionStreak] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);

  useEffect(() => {
    loadRoutineStatus();
  }, []);

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
        setRoutineItems(prev => 
          prev.map(item => ({
            ...item,
            completed: completedItems.includes(item.id)
          }))
        );
        setTodayCompleted(todayResult[0].fully_completed === 1);
      }

      // Calculate streak
      await calculateStreak(db);

    } catch (error) {
      console.error('Error loading routine:', error);
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

    setRoutineItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completeRoutine = async () => {
    const allCompleted = routineItems.every(item => item.completed);

    if (!allCompleted) {
      Alert.alert(
        'Incomplete Routine',
        'Some items aren\'t checked yet. Complete them or skip for today?',
        [
          { text: 'Keep Working', style: 'cancel' },
          { text: 'Skip & Complete', onPress: () => saveRoutine(false) }
        ]
      );
      return;
    }

    await saveRoutine(true);
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

  const completedCount = routineItems.filter(i => i.completed).length;
  const progressPercent = Math.round((completedCount / routineItems.length) * 100);

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
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Checklist */}
      <View style={styles.checklistSection}>
        <Text style={styles.sectionTitle}>Tonight's Routine</Text>
        
        {routineItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.checklistItem,
              item.completed && styles.checklistItemCompleted
            ]}
            onPress={() => toggleItem(item.id)}
            disabled={todayCompleted}
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
              {item.completed && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action Buttons */}
      {!todayCompleted ? (
        <TouchableOpacity
          style={[
            styles.completeButton,
            completedCount === 0 && styles.completeButtonDisabled
          ]}
          onPress={completeRoutine}
          disabled={completedCount === 0}
        >
          <Text style={styles.completeButtonText}>
            ✓ Complete Evening Routine
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.completedCard}>
          <Text style={styles.completedEmoji}>✨</Text>
          <Text style={styles.completedTitle}>Routine Complete!</Text>
          <Text style={styles.completedText}>
            You've protected yourself tonight. Get some rest.
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetForNewDay}
          >
            <Text style={styles.resetButtonText}>Reset for Testing</Text>
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
  completeButton: {
    backgroundColor: '#3B82F6',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  completeButtonDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedCard: {
    backgroundColor: '#14532D',
    borderWidth: 2,
    borderColor: '#166534',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  completedEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  completedText: {
    fontSize: 16,
    color: '#BBF7D0',
    textAlign: 'center',
    marginBottom: 16,
  },
  resetButton: {
    marginTop: 12,
    padding: 12,
  },
  resetButtonText: {
    color: '#64748B',
    fontSize: 14,
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
