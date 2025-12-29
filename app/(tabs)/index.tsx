import InterventionModal from '@/app/components/InterventionModal';
import LapseSupportModal from '@/app/components/LapseSupportModal';
import { initDataCollection } from '@/app/services/dataCollection';
import { initInterventions, shouldTriggerIntervention } from '@/app/services/interventions';
import { predictUrgeRisk } from '@/app/services/mlPredictor';
import {
  initNotifications,
  scheduleDangerHourNotifications
} from '@/app/services/notifications';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  getCurrentRisk,
  initRiskAnalysis,
  RiskAssessment
} from '../services/riskAnalysis';

export default function HomeScreen() {
  const router = useRouter();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const [showLapseSupport, setShowLapseSupport] = useState(false);
  const [mlPrediction, setMlPrediction] = useState<{
    probability: number;
    confidence: string;
    riskLevel: string;
    reasoning: string[];
  } | null>(null);

  useEffect(() => {
    checkAndInitApp();
  }, []);

  const checkAndInitApp = async () => {
    const database = await SQLite.openDatabaseAsync('behavior.db');
    setDb(database);

    // Check if onboarding completed
    try {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      const result = await database.getAllAsync<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = 'onboarding_complete'"
      );

      if (!result || result.length === 0 || result[0].value !== 'true') {
        // Show onboarding
        setShowOnboarding(true);
        return;
      }
    } catch (error) {
      console.log('First time user, showing onboarding');
      setShowOnboarding(true);
      return;
    }

    // Initialize app normally
    await initApp(database);
  };

  const initApp = async (database: SQLite.SQLiteDatabase) => {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Create urge_sessions table if not exists, with all columns
    try {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS urge_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_timestamp INTEGER NOT NULL,
          intensity_before INTEGER,
          intensity_after INTEGER,
          intervention_type TEXT,
          reduction INTEGER,
          what_helped TEXT,
          created_at INTEGER
        );
      `);
      
      // Try to add what_helped column if it doesn't exist (for existing tables)
      await database.execAsync(`ALTER TABLE urge_sessions ADD COLUMN what_helped TEXT`);
    } catch (error) {
      // Column already exists or table created fresh - that's fine
      console.log('urge_sessions table ready');
    }

    await initDataCollection();
    await initRiskAnalysis();
    await initInterventions();

    // Initialize notifications
    const notifPermission = await initNotifications();
    if (notifPermission) {
      await scheduleDangerHourNotifications();
      console.log('✅ Notifications enabled and scheduled');
    } else {
      console.log('⚠️ Notifications disabled or not available');
    }

    await loadRiskData();

    // Check risk every hour (for auto-intervention)
    const interval = setInterval(async () => {
      console.log('⏰ Hourly check...');
      await loadRiskData();
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  };

  const loadRiskData = async () => {
    try {
      const riskLevel = await getCurrentRisk();
      const prediction = await predictUrgeRisk();
      
      console.log('📊 Current Risk:', riskLevel?.percentage, '% at', new Date().toLocaleTimeString());
      console.log('🤖 ML Prediction:', prediction);
      
      setRisk(riskLevel);
      setMlPrediction(prediction);

      // Auto-trigger intervention if in danger zone
      if (riskLevel && riskLevel.percentage >= 70) {
        const shouldShow = await shouldTriggerIntervention(riskLevel.percentage);
        
        if (shouldShow) {
          console.log('🚨 AUTO-TRIGGERING INTERVENTION');
          setTimeout(() => {
            setShowIntervention(true);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error loading risk data:', error);
    }
  };

  const logEvent = async (type: 'urge' | 'lapse' | 'safe') => {
    if (!db) return;

    const timestamp = Date.now();

    try {
      // Log to logs table
      await db.runAsync(
        'INSERT INTO logs (type, timestamp) VALUES (?, ?)',
        [type, timestamp]
      );

      // Log as event
      const eventType = type === 'urge' ? 'URGE_LOGGED' : 
                        type === 'lapse' ? 'LAPSE_LOGGED' : 
                        'SAFETY_CHECK_IN';
      
      await db.runAsync(
        'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
        [eventType, timestamp, JSON.stringify({ type })]
      );

      // DIFFERENT BEHAVIOR PER TYPE:
      if (type === 'urge') {
        console.log('🌊 User logged urge - triggering intervention!');
        setShowIntervention(true);
      } else if (type === 'lapse') {
        // Don't just show an alert - trigger a full support flow
        await loadRiskData();
        
        // Show lapse support modal
        setShowLapseSupport(true);
      } else {
        // SAFE CHECK-IN = POSITIVE!
        // Don't reload risk (it would go up from activity)
        // Just show encouragement
        alert('Strong move checking in! Building awareness is half the battle. ✨');
      }
      
    } catch (error) {
      console.error('Error logging event:', error);
    }
  };

  const getZoneLabel = (zone: string) => {
    switch(zone) {
      case 'CLEAR_SKIES': return 'LOW RISK';
      case 'STORM_WATCH': return 'MODERATE RISK';
      case 'STORM_WARNING': return 'HIGH RISK';
      default: return 'UNKNOWN';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  // ONBOARDING COMPONENT
  if (showOnboarding) {
    return <OnboardingFlow 
      onComplete={async () => {
        if (!db) return;
        await db.runAsync(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          ['onboarding_complete', 'true']
        );
        setShowOnboarding(false);
        await initApp(db);
      }} 
      db={db}
    />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.riskHeader}>
        <Text style={[styles.percentage, { color: risk?.color || '#3B82F6' }]}>
          {risk?.percentage || 0}%
        </Text>
        <Text style={[styles.zoneLabel, { color: risk?.color || '#3B82F6' }]}>
          {risk ? getZoneLabel(risk.zone) : 'CALCULATING...'}
        </Text>
        <Text style={styles.message}>
          {risk?.message || 'Loading your risk detection...'}
        </Text>
        <Text style={styles.tagline}>Support when it matters most</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>How This Works</Text>
        <Text style={styles.infoCardText}>
          Right now: {risk?.percentage}% (your current state){'\n\n'}
          Typical for this hour: Check your Pattern tab{'\n\n'}
          When you tap "Record Urge", we'll help you through it.{'\n\n'}
          During your danger hours, interventions may appear automatically.
        </Text>
      </View>

      {mlPrediction && (
        <View style={styles.mlCard}>
          <Text style={styles.mlTitle}>🤖 AI Prediction</Text>
          <View style={styles.mlProbability}>
            <Text style={styles.mlProbNumber}>
              {Math.round(mlPrediction.probability * 100)}%
            </Text>
            <Text style={styles.mlProbLabel}>
              Urge probability (next hour)
            </Text>
            <Text style={styles.mlConfidence}>
              {mlPrediction.confidence} confidence
            </Text>
          </View>
          
          <View style={styles.mlReasoning}>
            <Text style={styles.mlReasoningTitle}>Why this score:</Text>
            {mlPrediction.reasoning.map((reason, idx) => (
              <Text key={idx} style={styles.mlReasoningItem}>
                • {reason}
              </Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.urgeButton]}
          onPress={() => logEvent('urge')}
        >
          <Text style={styles.buttonEmoji}>🌊</Text>
          <Text style={styles.buttonTitle}>Record Urge</Text>
          <Text style={styles.buttonSubtitle}>Get help now</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.lapseButton]}
          onPress={() => logEvent('lapse')}
        >
          <Text style={styles.buttonEmoji}>⚡</Text>
          <Text style={styles.buttonTitle}>Record Lapse</Text>
          <Text style={styles.buttonSubtitle}>It happens - keep going</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.safeButton, styles.fullWidthButton]}
        onPress={() => logEvent('safe')}
      >
        <Text style={styles.buttonEmoji}>🛡️</Text>
        <Text style={styles.buttonTitle}>I'm Good</Text>
        <Text style={styles.buttonSubtitle}>Checking in strong</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: '#7C3AED', marginTop: 12 }]}
        onPress={async () => {
          // Generate contextual message using LLM
          const { generateContextualNotification } = await import('../services/llmService');
          const message = await generateContextualNotification();
          
          // Schedule immediate notification with LLM message
          const Notifications = await import('expo-notifications');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Interruption',
              body: message,
              data: { type: 'test' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 3,
            },
          });
          
          alert('Smart notification coming in 3 seconds! Check your lock screen.');
        }}
      >
        <Text style={styles.buttonEmoji}>🤖</Text>
        <Text style={styles.buttonTitle}>Test Smart Notification</Text>
        <Text style={styles.buttonSubtitle}>See LLM-powered alerts</Text>
      </TouchableOpacity>

      <InterventionModal
        visible={showIntervention}
        riskLevel={risk?.percentage || 0}
        onClose={() => setShowIntervention(false)}
      />

      <LapseSupportModal
        visible={showLapseSupport}
        onClose={() => setShowLapseSupport(false)}
      />
    </ScrollView>
  );
}

// ONBOARDING COMPONENT
interface OnboardingFlowProps {
  onComplete: () => void;
  db: SQLite.SQLiteDatabase | null;
}

function OnboardingFlow({ onComplete, db }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    screenTime: '',
    riskHours: [] as string[],
    triggers: [] as string[],
    alonePattern: '',
    dayPattern: '',
    urgeDuration: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const saveProfile = async () => {
    if (!db) return;

    await db.execAsync(`DROP TABLE IF EXISTS user_profile`);

    await db.execAsync(`
      CREATE TABLE user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_time TEXT,
        risk_hours TEXT,
        triggers TEXT,
        alone_pattern TEXT,
        day_pattern TEXT,
        urge_duration TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        created_at INTEGER
      );
    `);

    await db.runAsync(
      `INSERT INTO user_profile (
        screen_time, 
        risk_hours, 
        triggers, 
        alone_pattern, 
        day_pattern, 
        urge_duration,
        emergency_contact_name,
        emergency_contact_phone,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.screenTime,
        JSON.stringify(data.riskHours),
        JSON.stringify(data.triggers),
        data.alonePattern,
        data.dayPattern,
        data.urgeDuration,
        data.emergencyContactName,
        data.emergencyContactPhone,
        Date.now()
      ]
    );

    onComplete();
  };

  const toggleSelection = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(item => item !== value);
    }
    return [...array, value];
  };

  const canProceed = () => {
    switch(step) {
      case 1: return data.screenTime !== '';
      case 2: return data.riskHours.length > 0;
      case 3: return data.triggers.length > 0;
      case 4: return data.alonePattern !== '';
      case 5: return data.urgeDuration !== '';
      case 6: return data.emergencyContactName !== '' && data.emergencyContactPhone !== '';
      case 7: return data.dayPattern !== '';
      default: return false;
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <>
            <Text style={onboardingStyles.title}>Welcome! 👋</Text>
            <Text style={onboardingStyles.subtitle}>
              Let's build your personalized risk profile.
            </Text>
            <Text style={onboardingStyles.question}>
              What's your average daily screen time?
            </Text>

            {['<2 hours', '2-4 hours', '4-6 hours', '6+ hours'].map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  onboardingStyles.optionButton,
                  data.screenTime === option && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({...data, screenTime: option})}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.screenTime === option && onboardingStyles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );

      case 2:
        return (
          <>
            <Text style={onboardingStyles.title}>When do urges hit? ⏰</Text>
            <Text style={onboardingStyles.subtitle}>Select all that apply</Text>

            {[
              { label: 'Morning (6AM-12PM)', value: 'morning' },
              { label: 'Afternoon (12PM-6PM)', value: 'afternoon' },
              { label: 'Evening (6PM-10PM)', value: 'evening' },
              { label: 'Late Night (10PM-2AM)', value: 'latenight' },
              { label: 'Very Late (2AM-6AM)', value: 'verylate' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.riskHours.includes(option.value) && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({
                  ...data,
                  riskHours: toggleSelection(data.riskHours, option.value)
                })}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.riskHours.includes(option.value) && onboardingStyles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );

      case 3:
        return (
          <>
            <Text style={onboardingStyles.title}>What triggers urges? 🎯</Text>
            <Text style={onboardingStyles.subtitle}>Select all that apply</Text>

            {[
              { label: 'Stress/Anxiety', value: 'stress' },
              { label: 'Loneliness/Isolation', value: 'loneliness' },
              { label: 'Boredom', value: 'boredom' },
              { label: 'Fatigue/Tiredness', value: 'fatigue' },
              { label: 'After scrolling social media', value: 'socialmedia' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.triggers.includes(option.value) && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({
                  ...data,
                  triggers: toggleSelection(data.triggers, option.value)
                })}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.triggers.includes(option.value) && onboardingStyles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );

      case 4:
        return (
          <>
            <Text style={onboardingStyles.title}>Alone during urges? 🏠</Text>
            <Text style={onboardingStyles.subtitle}>Usually alone when urges happen?</Text>

            {[
              { label: 'Yes, always', value: 'always' },
              { label: 'Usually', value: 'usually' },
              { label: 'Sometimes', value: 'sometimes' },
              { label: 'Rarely', value: 'rarely' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.alonePattern === option.value && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({...data, alonePattern: option.value})}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.alonePattern === option.value && onboardingStyles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );

      case 5:
        return (
          <>
            <Text style={onboardingStyles.title}>Urge duration? ⏱️</Text>
            <Text style={onboardingStyles.subtitle}>How long do urges typically last?</Text>

            {[
              { label: '<5 minutes', value: '5' },
              { label: '5-10 minutes', value: '10' },
              { label: '10-20 minutes', value: '20' },
              { label: '>20 minutes', value: '30' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.urgeDuration === option.value && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({...data, urgeDuration: option.value})}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.urgeDuration === option.value && onboardingStyles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );

      case 6:
        return (
          <>
            <Text style={onboardingStyles.title}>Emergency Contact 📞</Text>
            <Text style={onboardingStyles.subtitle}>
              Who can you call during tough moments?
            </Text>

            <View style={onboardingStyles.inputContainer}>
              <Text style={onboardingStyles.inputLabel}>Contact Name</Text>
              <TextInput
                style={onboardingStyles.textInput}
                placeholder="Best friend, family member, sponsor..."
                placeholderTextColor="#64748B"
                value={data.emergencyContactName}
                onChangeText={(text) => setData({...data, emergencyContactName: text})}
              />
            </View>

            <View style={onboardingStyles.inputContainer}>
              <Text style={onboardingStyles.inputLabel}>Phone Number</Text>
              <TextInput
                style={onboardingStyles.textInput}
                placeholder="(555) 123-4567"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={data.emergencyContactPhone}
                onChangeText={(text) => setData({...data, emergencyContactPhone: text})}
              />
            </View>

            <TouchableOpacity
              style={onboardingStyles.skipButton}
              onPress={() => {
                setData({
                  ...data, 
                  emergencyContactName: 'Crisis Hotline',
                  emergencyContactPhone: '988'
                });
              }}
            >
              <Text style={onboardingStyles.skipText}>
                Skip - Use 988 Crisis Hotline instead
              </Text>
            </TouchableOpacity>
          </>
        );

      case 7:
        return (
          <>
            <Text style={onboardingStyles.title}>Day patterns? 📅</Text>
            <Text style={onboardingStyles.subtitle}>Urges more on certain days?</Text>

            {[
              { label: 'Weekends', value: 'weekends' },
              { label: 'Weekdays', value: 'weekdays' },
              { label: 'No pattern', value: 'nopattern' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.dayPattern === option.value && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({...data, dayPattern: option.value})}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.dayPattern === option.value && onboardingStyles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        );
    }
  };

  return (
    <ScrollView style={onboardingStyles.container}>
      <View style={onboardingStyles.progressContainer}>
        <Text style={onboardingStyles.progressText}>Step {step} of 7</Text>
        <View style={onboardingStyles.progressBar}>
          <View style={[onboardingStyles.progressFill, { width: `${(step / 7) * 100}%` }]} />
        </View>
      </View>

      {renderStep()}

      <View style={onboardingStyles.navigationContainer}>
        {step > 1 && (
          <TouchableOpacity
            style={onboardingStyles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={onboardingStyles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            onboardingStyles.nextButton,
            !canProceed() && onboardingStyles.nextButtonDisabled
          ]}
          disabled={!canProceed()}
          onPress={() => {
            if (step === 7) {
              saveProfile();
            } else {
              setStep(step + 1);
            }
          }}
        >
          <Text style={onboardingStyles.nextButtonText}>
            {step === 7 ? 'Complete Setup ✓' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const onboardingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  progressContainer: {
    marginTop: 60,
    marginBottom: 30,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
  },
  question: {
    fontSize: 18,
    color: '#E2E8F0',
    marginBottom: 20,
    fontWeight: '600',
  },
  optionButton: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  optionSelected: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  optionText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 60,
  },
  backButton: {
    padding: 16,
  },
  backButtonText: {
    color: '#64748B',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    flex: 1,
    marginLeft: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#1E293B',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F1F5F9',
  },
  skipButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  skipText: {
    color: '#64748B',
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  riskHeader: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  percentage: {
    fontSize: 72,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  zoneLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  infoCardText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  fullWidthButton: {
    marginBottom: 40,
  },
  urgeButton: {
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#78350F',
  },
  lapseButton: {
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  safeButton: {
    backgroundColor: '#14532D',
    borderWidth: 1,
    borderColor: '#166534',
  },
  buttonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  mlCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  mlTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C4B5FD',
    marginBottom: 16,
  },
  mlProbability: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mlProbNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#A78BFA',
    marginBottom: 4,
  },
  mlProbLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  mlConfidence: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  mlReasoning: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
  },
  mlReasoningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  mlReasoningItem: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    lineHeight: 20,
  },
});