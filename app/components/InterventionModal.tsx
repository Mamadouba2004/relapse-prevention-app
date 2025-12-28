import Slider from '@react-native-community/slider';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import {
    Intervention,
    logInterventionCompleted,
    logInterventionShown
} from '../services/interventions';

interface Props {
  visible: boolean;
  riskLevel: number;
  onClose: () => void;
}

export default function InterventionModal({ visible, riskLevel, onClose }: Props) {
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [exerciseActive, setExerciseActive] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [emergencyContact, setEmergencyContact] = useState<{name: string, phone: string} | null>(null);
  const [urgeIntensityBefore, setUrgeIntensityBefore] = useState<number | null>(null);
  const [urgeIntensityAfter, setUrgeIntensityAfter] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showBeforeRating, setShowBeforeRating] = useState(true);
  const [showAfterRating, setShowAfterRating] = useState(false);

  useEffect(() => {
    loadEmergencyContact();
  }, []);

  const loadEmergencyContact = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('behavior.db');
      
      // Check if table exists first
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'"
      );
      
      if (tables.length === 0) {
        console.log('No user_profile table yet');
        return;
      }
      
      const result = await db.getAllAsync<{
        emergency_contact_name: string;
        emergency_contact_phone: string;
      }>('SELECT emergency_contact_name, emergency_contact_phone FROM user_profile ORDER BY created_at DESC LIMIT 1');
      
      if (result.length > 0 && result[0].emergency_contact_name) {
        setEmergencyContact({
          name: result[0].emergency_contact_name,
          phone: result[0].emergency_contact_phone,
        });
      }
    } catch (error) {
      console.log('Error loading emergency contact (safe to ignore):', error);
    }
  };

  useEffect(() => {
    if (visible && !selectedIntervention) {
      logInterventionShown('breathing', riskLevel);
    }
  }, [visible]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedIntervention(null);
      setExerciseActive(false);
      setTapCount(0);
    }
  }, [visible]);

  const startBreathingExercise = () => {
    setExerciseActive(true);
    setStartTime(Date.now());
    
    const breathingCycle = () => {
      Vibration.vibrate([0, 100, 100, 100, 100, 100]);
      
      setTimeout(() => {
        Vibration.vibrate(200);
      }, 4000);
      
      setTimeout(() => {
        Vibration.vibrate([0, 150, 150, 150, 150]);
      }, 11000);
    };

    breathingCycle();
    setTimeout(breathingCycle, 19000);
    setTimeout(breathingCycle, 38000);
    
    setTimeout(() => {
      setExerciseActive(false);
      completeIntervention(true);
    }, 60000);
  };

  const startUrgeSurfing = () => {
    setExerciseActive(true);
    setStartTime(Date.now());
    Vibration.vibrate(500);
  };

  const startPatternInterrupt = () => {
    setExerciseActive(true);
    setStartTime(Date.now());
    setTapCount(0); // Reset counter
    Vibration.vibrate([0, 50, 100, 50, 100, 50]);
  };

  const completeIntervention = async (helped: boolean) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    await logInterventionCompleted(helped, duration);
    
    // Show AFTER rating screen
    setExerciseActive(false);
    setShowAfterRating(true);
  };

  const skipIntervention = () => {
    logInterventionCompleted(false, 0);
    setExerciseActive(false);
    setSelectedIntervention(null);
    setShowBeforeRating(true);
    setUrgeIntensityBefore(null);
    onClose();
  };

  // BEFORE RATING SCREEN
  if (showBeforeRating && visible) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>First, let's check in</Text>
            <Text style={styles.subtitle}>
              How strong is the urge right now?
            </Text>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>
              {urgeIntensityBefore || 5}
            </Text>
            <Text style={styles.sliderLabel}>
              {(!urgeIntensityBefore || urgeIntensityBefore <= 3) && 'Mild urge'}
              {urgeIntensityBefore && urgeIntensityBefore > 3 && urgeIntensityBefore <= 7 && 'Moderate urge'}
              {urgeIntensityBefore && urgeIntensityBefore > 7 && 'Strong urge'}
            </Text>

            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={urgeIntensityBefore || 5}
              onValueChange={setUrgeIntensityBefore}
              minimumTrackTintColor="#EF4444"
              maximumTrackTintColor="#334155"
              thumbTintColor="#F1F5F9"
            />

            <View style={styles.sliderLabels}>
              <Text style={styles.sliderEndLabel}>1 - Mild</Text>
              <Text style={styles.sliderEndLabel}>10 - Intense</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.nextButton, !urgeIntensityBefore && styles.nextButtonDisabled]}
            disabled={!urgeIntensityBefore}
            onPress={async () => {
              // Save session to database
              const db = await SQLite.openDatabaseAsync('behavior.db');
              const result = await db.runAsync(
                'INSERT INTO urge_sessions (start_timestamp, intensity_before, created_at) VALUES (?, ?, ?)',
                [Date.now(), urgeIntensityBefore, Date.now()]
              );
              setSessionId(result.lastInsertRowId);
              
              // Move to intervention selection
              setShowBeforeRating(false);
            }}
          >
            <Text style={styles.nextButtonText}>
              Next →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => {
              setShowBeforeRating(true);
              setUrgeIntensityBefore(null);
              onClose();
            }}
          >
            <Text style={styles.dismissText}>Not right now</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // AFTER RATING SCREEN
  if (showAfterRating && visible) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>How about now?</Text>
            <Text style={styles.subtitle}>
              How strong is the urge after that exercise?
            </Text>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>
              {urgeIntensityAfter || 5}
            </Text>
            <Text style={styles.sliderLabel}>
              {(!urgeIntensityAfter || urgeIntensityAfter <= 3) && 'Mild urge'}
              {urgeIntensityAfter && urgeIntensityAfter > 3 && urgeIntensityAfter <= 7 && 'Moderate urge'}
              {urgeIntensityAfter && urgeIntensityAfter > 7 && 'Strong urge'}
            </Text>

            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={urgeIntensityAfter || urgeIntensityBefore || 5}
              onValueChange={setUrgeIntensityAfter}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#334155"
              thumbTintColor="#F1F5F9"
            />

            <View style={styles.sliderLabels}>
              <Text style={styles.sliderEndLabel}>1 - Mild</Text>
              <Text style={styles.sliderEndLabel}>10 - Intense</Text>
            </View>
          </View>

          {urgeIntensityBefore && urgeIntensityAfter && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>
                {urgeIntensityAfter < urgeIntensityBefore ? '✨ It Worked!' : '💙 You Tried'}
              </Text>
              <Text style={styles.resultText}>
                {urgeIntensityAfter < urgeIntensityBefore 
                  ? `Your urge dropped from ${urgeIntensityBefore} to ${urgeIntensityAfter}\n(${Math.round(((urgeIntensityBefore - urgeIntensityAfter) / urgeIntensityBefore) * 100)}% reduction)`
                  : urgeIntensityAfter === urgeIntensityBefore
                    ? `Your urge stayed at ${urgeIntensityBefore}\nThat's okay - sometimes awareness is enough`
                    : `Your urge is still high\nThat's okay - you showed up for yourself`
                }
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.nextButton, !urgeIntensityAfter && styles.nextButtonDisabled]}
            disabled={!urgeIntensityAfter}
            onPress={async () => {
              // Update session in database
              const db = await SQLite.openDatabaseAsync('behavior.db');
              const reduction = urgeIntensityBefore! - urgeIntensityAfter!;
              
              await db.runAsync(
                'UPDATE urge_sessions SET intensity_after = ?, reduction = ?, intervention_type = ? WHERE id = ?',
                [urgeIntensityAfter, reduction, selectedIntervention?.type || 'unknown', sessionId]
              );
              
              // Reset everything and close
              setShowAfterRating(false);
              setShowBeforeRating(true);
              setUrgeIntensityBefore(null);
              setUrgeIntensityAfter(null);
              setSelectedIntervention(null);
              setSessionId(null);
              setTapCount(0);
              
              onClose();
            }}
          >
            <Text style={styles.nextButtonText}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Breathing Exercise Screen
  if (exerciseActive && selectedIntervention?.type === 'breathing') {
    return (
      <Modal visible={visible} animationType="fade" transparent={false}>
        <View style={styles.exerciseContainer}>
          <Text style={styles.exerciseTitle}>4-7-8 Breathing</Text>
          <Text style={styles.exerciseInstruction}>
            Follow the vibration pattern
          </Text>
          
          <View style={styles.breathingCircle}>
            <Text style={styles.breathingEmoji}>🫁</Text>
          </View>

          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              Inhale: 4 seconds{'\n'}
              Hold: 7 seconds{'\n'}
              Exhale: 8 seconds
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.stopButton}
            onPress={() => completeIntervention(true)}
          >
            <Text style={styles.stopButtonText}>Complete Exercise</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.skipTextButton}
            onPress={() => completeIntervention(false)}
          >
            <Text style={styles.skipText}>This didn't help</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Urge Surfing Screen
  if (exerciseActive && selectedIntervention?.type === 'urge_surfing') {
    return (
      <Modal visible={visible} animationType="fade" transparent={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
          <Text style={styles.exerciseTitle}>🌊 Urge Surfing</Text>
          
          <View style={styles.textBlock}>
            <Text style={styles.guidedText}>
              Notice the urge in your body.{'\n\n'}
              Where do you feel it? Your chest? Hands? Stomach?{'\n\n'}
              Don't fight it. Don't feed it.{'\n\n'}
              Imagine it's a wave.{'\n\n'}
              You're not trying to stop the wave.{'\n\n'}
              You're riding it.{'\n\n'}
              Watch it rise... peak... and fall.{'\n\n'}
              It will pass. They always do.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.completeButton}
            onPress={() => completeIntervention(true)}
          >
            <Text style={styles.completeButtonText}>I Rode the Wave ✓</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.skipTextButton}
            onPress={() => completeIntervention(false)}
          >
            <Text style={styles.skipText}>This didn't help</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    );
  }

  // Pattern Interrupt Screen
  if (exerciseActive && selectedIntervention?.type === 'pattern_interrupt') {
    const targetCount = 50;

    return (
      <Modal visible={visible} animationType="fade" transparent={false}>
        <View style={styles.exerciseContainer}>
          <Text style={styles.exerciseTitle}>⚡ Pattern Break</Text>
          <Text style={styles.exerciseInstruction}>
            Tap the button {targetCount} times
          </Text>
          
          <TouchableOpacity 
            style={styles.tapButton}
            onPress={() => {
              const newCount = tapCount + 1;
              setTapCount(newCount);
              Vibration.vibrate(10);
              
              if (newCount >= targetCount) {
                setTimeout(() => completeIntervention(true), 500);
              }
            }}
          >
            <Text style={styles.tapCount}>{tapCount}</Text>
            <Text style={styles.tapLabel}>TAP ME</Text>
          </TouchableOpacity>

          <Text style={styles.progressText}>
            {Math.max(0, targetCount - tapCount)} more to break the pattern
          </Text>

          <TouchableOpacity 
            style={styles.skipTextButton}
            onPress={() => completeIntervention(false)}
          >
            <Text style={styles.skipText}>Skip this</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Main Intervention Selection Screen
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.warningEmoji}>💪</Text>
          <Text style={styles.title}>This Might Be a Tricky Moment</Text>
          <Text style={styles.riskText}>Current Risk: {riskLevel}%</Text>
          <Text style={styles.subtitle}>
            You've got tools for this. Let's use one together.
          </Text>
        </View>

        <ScrollView style={styles.interventionList}>
          <InterventionCard
            emoji="🫁"
            title="4-7-8 Breathing"
            subtitle="Calm your nervous system (60 sec)"
            color="#3B82F6"
            onPress={() => {
              setSelectedIntervention({
                id: 'breathing',
                type: 'breathing',
                title: '4-7-8 Breathing',
                subtitle: 'Calm your nervous system',
                emoji: '🫁',
                color: '#3B82F6',
                duration: 60,
              });
              startBreathingExercise();
            }}
          />

          <InterventionCard
            emoji="🌊"
            title="Urge Surfing"
            subtitle="Ride the wave until it passes (90 sec)"
            color="#06B6D4"
            onPress={() => {
              setSelectedIntervention({
                id: 'urge_surfing',
                type: 'urge_surfing',
                title: 'Urge Surfing',
                subtitle: 'Ride the wave',
                emoji: '🌊',
                color: '#06B6D4',
                duration: 90,
              });
              startUrgeSurfing();
            }}
          />

          <InterventionCard
            emoji="⚡"
            title="Pattern Break"
            subtitle="Quick distraction task (30 sec)"
            color="#F59E0B"
            onPress={() => {
              setSelectedIntervention({
                id: 'pattern_interrupt',
                type: 'pattern_interrupt',
                title: 'Pattern Break',
                subtitle: 'Quick task',
                emoji: '⚡',
                color: '#F59E0B',
                duration: 30,
              });
              startPatternInterrupt();
            }}
          />

          {emergencyContact && (
            <InterventionCard
              emoji="📞"
              title={`Call ${emergencyContact.name}`}
              subtitle="Reach out for support now"
              color="#10B981"
              onPress={() => {
                Linking.openURL(`tel:${emergencyContact.phone}`);
                logInterventionShown('emergency_contact', riskLevel);
                setTimeout(() => {
                  logInterventionCompleted(true, 0);
                  onClose();
                }, 500);
              }}
            />
          )}
        </ScrollView>

        <TouchableOpacity style={styles.dismissButton} onPress={skipIntervention}>
          <Text style={styles.dismissText}>I'll handle this myself</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

interface CardProps {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

function InterventionCard({ emoji, title, subtitle, color, onPress }: CardProps) {
  return (
    <TouchableOpacity 
      style={[styles.card, { borderColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.cardArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  warningEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 12,
  },
  riskText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  interventionList: {
    flex: 1,
  },
  card: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  cardArrow: {
    fontSize: 24,
    color: '#64748B',
  },
  dismissButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  dismissText: {
    color: '#64748B',
    fontSize: 16,
  },
  exerciseContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
    justifyContent: 'center',
  },
  exerciseTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 16,
  },
  exerciseInstruction: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
  },
  breathingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1E3A8A',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  breathingEmoji: {
    fontSize: 80,
  },
  instructionBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
  },
  instructionText: {
    fontSize: 18,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 32,
  },
  stopButton: {
    backgroundColor: '#3B82F6',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textBlock: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginTop: 40,
    marginBottom: 40,
  },
  guidedText: {
    fontSize: 18,
    color: '#E2E8F0',
    lineHeight: 32,
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#10B981',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipTextButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  skipText: {
    color: '#64748B',
    fontSize: 16,
  },
  tapButton: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F59E0B',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  tapCount: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tapLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  progressText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
  sliderContainer: {
    padding: 40,
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 18,
    color: '#94A3B8',
    marginBottom: 40,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  sliderEndLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 12,
    marginHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 16,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 24,
  },
});