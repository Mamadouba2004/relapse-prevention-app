import React, { useEffect, useState } from 'react';
import {
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
  const [tapCount, setTapCount] = useState(0); // MOVED OUTSIDE IF STATEMENT

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
    setExerciseActive(false);
    setSelectedIntervention(null);
    setTapCount(0);
    onClose();
  };

  const skipIntervention = () => {
    logInterventionCompleted(false, 0);
    setExerciseActive(false);
    setSelectedIntervention(null);
    onClose();
  };

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
          <Text style={styles.warningEmoji}>⚠️</Text>
          <Text style={styles.title}>High Risk Window Detected</Text>
          <Text style={styles.riskText}>Current Risk: {riskLevel}%</Text>
          <Text style={styles.subtitle}>
            The next 60 minutes are critical. Let's get through this together.
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
});