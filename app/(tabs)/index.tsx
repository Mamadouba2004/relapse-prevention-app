import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { initDataCollection } from '../services/dataCollection';
import {
  calculateRiskLevel,
  getRiskTrend,
  initRiskAnalysis,
  RiskAssessment
} from '../services/riskAnalysis';

export default function HomeScreen() {
  const router = useRouter();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [trendData, setTrendData] = useState<Array<{ time: number; risk: number }>>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

    await initDataCollection();
    await initRiskAnalysis();
    await loadRiskData();

    const interval = setInterval(loadRiskData, 60000);
    return () => clearInterval(interval);
  };

  const loadRiskData = async () => {
    try {
      const riskLevel = await calculateRiskLevel();
      const trend = await getRiskTrend();
      
      setRisk(riskLevel);
      setTrendData(trend);
    } catch (error) {
      console.error('Error loading risk data:', error);
    }
  };

  const logEvent = async (type: 'urge' | 'lapse' | 'safe') => {
    if (!db) return;

    const timestamp = Date.now();

    try {
      await db.runAsync(
        'INSERT INTO logs (type, timestamp) VALUES (?, ?)',
        [type, timestamp]
      );

      const eventType = type === 'urge' ? 'URGE_LOGGED' : 
                        type === 'lapse' ? 'LAPSE_LOGGED' : 
                        'SAFETY_CHECK_IN';
      
      await db.runAsync(
        'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
        [eventType, timestamp, JSON.stringify({ type })]
      );

      await db.runAsync(
        'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
        ['screen_on', timestamp, JSON.stringify({ hour: new Date().getHours() })]
      );

      setTrendData([]);
      setRisk(null);
      
      setTimeout(async () => {
        await loadRiskData();
      }, 100);
      
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

  // Prepare chart data
  const chartData = {
    labels: trendData.slice(-6).map(d => formatTime(d.time)),
    datasets: [{
      data: trendData.slice(-6).map(d => d.risk).length > 0 
        ? trendData.slice(-6).map(d => d.risk)
        : [0]
    }]
  };

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
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>RISK WINDOW DETECTOR</Text>
        <Text style={styles.chartSubtitle}>Live Trend</Text>
        
        {trendData.length > 0 ? (
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 60}
            height={200}
            chartConfig={{
              backgroundColor: '#1E293B',
              backgroundGradientFrom: '#1E293B',
              backgroundGradientTo: '#1E293B',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(251, 146, 60, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#F59E0B'
              }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        ) : (
          <Text style={styles.noData}>Collecting data...</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.urgeButton]}
          onPress={() => logEvent('urge')}
        >
          <Text style={styles.buttonEmoji}>🌊</Text>
          <Text style={styles.buttonTitle}>Record Urge</Text>
          <Text style={styles.buttonSubtitle}>I feel a wave coming</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.lapseButton]}
          onPress={() => logEvent('lapse')}
        >
          <Text style={styles.buttonEmoji}>⚡</Text>
          <Text style={styles.buttonTitle}>Record Lapse</Text>
          <Text style={styles.buttonSubtitle}>I slipped up</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.safeButton, styles.fullWidthButton]}
        onPress={() => logEvent('safe')}
      >
        <Text style={styles.buttonEmoji}>🛡️</Text>
        <Text style={styles.buttonTitle}>I'm Good</Text>
        <Text style={styles.buttonSubtitle}>STABILIZE FORECAST</Text>
      </TouchableOpacity>

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>Debug Info:</Text>
        <Text style={styles.debugText}>Risk: {risk?.percentage}%</Text>
        <Text style={styles.debugText}>Trend Points: {trendData.length}</Text>
        <Text style={styles.debugText}>Last Update: {new Date().toLocaleTimeString()}</Text>
      </View>
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
  });

  const saveProfile = async () => {
    if (!db) return;

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_time TEXT,
        risk_hours TEXT,
        triggers TEXT,
        alone_pattern TEXT,
        day_pattern TEXT,
        created_at INTEGER
      );
    `);

    await db.runAsync(
      `INSERT INTO user_profile (screen_time, risk_hours, triggers, alone_pattern, day_pattern, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.screenTime,
        JSON.stringify(data.riskHours),
        JSON.stringify(data.triggers),
        data.alonePattern,
        data.dayPattern,
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
      case 5: return data.dayPattern !== '';
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
        <Text style={onboardingStyles.progressText}>Step {step} of 5</Text>
        <View style={onboardingStyles.progressBar}>
          <View style={[onboardingStyles.progressFill, { width: `${(step / 5) * 100}%` }]} />
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
            if (step === 5) {
              saveProfile();
            } else {
              setStep(step + 1);
            }
          }}
        >
          <Text style={onboardingStyles.nextButtonText}>
            {step === 5 ? 'Complete Setup ✓' : 'Next →'}
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
  chartContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 10,
  },
  noData: {
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 60,
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
  debugBox: {
    backgroundColor: '#1E293B',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
  },
});