import InterventionModal from '@/app/components/InterventionModal';
import LapseSupportModal from '@/app/components/LapseSupportModal';
import { initDataCollection } from '@/app/services/dataCollection';
import { initInterventions, shouldTriggerIntervention } from '@/app/services/interventions';
import { predictUrgeRisk } from '@/app/services/mlPredictor';
import {
  initNotifications,
  scheduleDangerHourNotifications
} from '@/app/services/notifications';
import {
  getNextSafeHarbor,
  getRiskForCurrentHour as getProfileRisk,
  initRiskProfile
} from '@/app/services/riskProfile';
// JITAI Components
import { AccuracyBadge } from '@/components/ui/accuracy-badge';
import { AlertButton } from '@/components/ui/alert-button';
import { CheckInCard } from '@/components/ui/checkin-card';
import { CircleActionButton } from '@/components/ui/circle-action-button';
import { JITAIStatCard } from '@/components/ui/jitai-stat-card';
import { RiskGauge } from '@/components/ui/risk-gauge';
import { StarField } from '@/components/ui/star-field';
import { theme } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  getCurrentRisk,
  getSafeHarborTime,
  getRiskForCurrentHour as getScreenRisk,
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
  
  // Live risk score from database (updated on tab focus)
  const [liveRiskScore, setLiveRiskScore] = useState<number>(20);
  const [safeHarbor, setSafeHarbor] = useState<{
    safeHour: number;
    hoursUntil: number;
    minutesUntil: number;
    label: string;
  } | null>(null);
  
  // Database-based safe harbor (from screen_on events)
  const [dbSafeHarbor, setDbSafeHarbor] = useState<{
    timeRemaining: string;
    safeHour: number;
    safeHourLabel: string;
  } | null>(null);

  // JITAI-specific state
  const [confidenceMin, setConfidenceMin] = useState<number>(15);
  const [confidenceMax, setConfidenceMax] = useState<number>(28);
  const [highRiskWindows, setHighRiskWindows] = useState<number>(0);
  const [navigatedWindows, setNavigatedWindows] = useState<number>(0);
  const [modelAccuracy, setModelAccuracy] = useState<number>(58);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [nextCheckInTime, setNextCheckInTime] = useState<string>('4 hours');
  const [nextCheckInLabel, setNextCheckInLabel] = useState<string>('6:00 PM');

  useEffect(() => {
    checkAndInitApp();
  }, []);
  
  // Refresh risk data when tab is focused
  useFocusEffect(
    useCallback(() => {
      const refreshRiskData = async () => {
        await initRiskProfile();
        await initRiskAnalysis();
        
        // Get risk from both sources and combine them
        const profileRisk = await getProfileRisk(); // Based on urge patterns
        const screenRisk = await getScreenRisk();   // Based on screen_on events
        
        // Combine: weighted average (60% screen activity, 40% urge history)
        const combinedRisk = Math.round((screenRisk * 0.6) + (profileRisk * 0.4));
        setLiveRiskScore(combinedRisk);
        
        // Get next safe harbor time from profile
        const nextSafe = await getNextSafeHarbor();
        setSafeHarbor(nextSafe);
        
        // Get safe harbor from database (screen_on based)
        const dbSafe = await getSafeHarborTime();
        setDbSafeHarbor(dbSafe);
        
        // Calculate JITAI metrics
        await calculateJITAIMetrics();
        
        console.log('📊 Tab focused - Screen risk:', screenRisk, '%, Profile risk:', profileRisk, '%, Combined:', combinedRisk, '%');
        console.log('🏠 Safe harbor (profile):', nextSafe?.label || 'none');
        console.log('🏠 Safe harbor (DB):', dbSafe?.timeRemaining || 'none', 'until', dbSafe?.safeHourLabel || 'N/A');
      };
      
      refreshRiskData();
    }, [db])
  );

  // Calculate JITAI metrics from database
  const calculateJITAIMetrics = async () => {
    if (!db) return;
    
    try {
      // Count high-risk windows (interventions triggered)
      const interventionCount = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(DISTINCT strftime("%Y-%m-%d %H", datetime(timestamp/1000, "unixepoch"))) as count FROM logs WHERE type = ?',
        ['urge']
      );
      const totalWindows = interventionCount[0]?.count || 0;
      setHighRiskWindows(totalWindows);
      
      // Count navigated windows (safe check-ins after urges)
      const safeCount = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM logs WHERE type = ?',
        ['safe']
      );
      const navigated = Math.min(safeCount[0]?.count || 0, totalWindows);
      setNavigatedWindows(navigated);
      
      // Calculate confidence interval based on current risk
      const riskVariance = Math.max(5, Math.floor(liveRiskScore * 0.15));
      setConfidenceMin(Math.max(0, liveRiskScore - riskVariance));
      setConfidenceMax(Math.min(100, liveRiskScore + riskVariance));
      
      // Calculate model accuracy based on prediction success
      // (For now, use ML prediction confidence or default)
      if (mlPrediction) {
        const accuracyMap: { [key: string]: number } = {
          'high': 72,
          'medium': 58,
          'low': 45
        };
        setModelAccuracy(accuracyMap[mlPrediction.confidence] || 58);
      }
      
      // Calculate next check-in time
      const now = new Date();
      const nextCheckIn = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
      const hoursUntil = Math.floor((nextCheckIn.getTime() - now.getTime()) / (1000 * 60 * 60));
      setNextCheckInTime(`${hoursUntil} hours`);
      setNextCheckInLabel(nextCheckIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
      
      // Update last updated timestamp
      setLastUpdated('Just now');
      
    } catch (error) {
      console.log('Error calculating JITAI metrics:', error);
    }
  };

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

  // Get gradient colors based on risk level (Weather metaphor)
  // Now uses liveRiskScore from database!
  const getRiskGradient = (): readonly [string, string, ...string[]] => {
    const percentage = liveRiskScore;
    if (percentage > 60) return ['#8b0000', '#191919'] as const; // STORM WARNING - deep red
    if (percentage > 30) return ['#B8860B', '#191919'] as const; // CAUTION - dark goldenrod
    return ['#1e5128', '#191919'] as const; // CLEAR - deep green
  };

  // Get weather icon based on risk level
  const getWeatherIcon = (): keyof typeof MaterialCommunityIcons.glyphMap => {
    const percentage = liveRiskScore;
    if (percentage > 60) return 'weather-lightning';
    if (percentage > 30) return 'weather-rainy';
    return 'weather-partly-cloudy';
  };

  // Get risk status text (Weather metaphor)
  const getRiskStatus = (): string => {
    const percentage = liveRiskScore;
    if (percentage > 60) return 'STORM WARNING';
    if (percentage > 30) return 'CAUTION';
    return 'CLEAR';
  };

  // Hope Timer - Now synced with Pattern Map!
  // Uses safeHarbor from riskProfile service to find next low-risk hour
  const getHopeTimer = (): string | null => {
    // Only show timer if risk is elevated (> 40%)
    if (liveRiskScore <= 40 || !safeHarbor) {
      return null;
    }

    // Use the calculated safe harbor from Pattern Map data
    return `${safeHarbor.hoursUntil}h${safeHarbor.minutesUntil}m`;
  };
  
  // Get the safe harbor destination label
  const getSafeHarborLabel = (): string | null => {
    if (!safeHarbor || liveRiskScore <= 40) return null;
    return safeHarbor.label;
  };

  // Get explanation for transparency tap
  // Get explanation for transparency tap - now uses live database score
  const getRiskExplanation = (): string => {
    const percentage = liveRiskScore;
    const hour = new Date().getHours();
    
    let timeContext = '';
    if (hour >= 22 || hour < 4) {
      timeContext = 'late-night hours';
    } else if (hour >= 18) {
      timeContext = 'evening hours';
    } else {
      timeContext = 'current time patterns';
    }
    
    // More detailed explanation including data source
    const dataNote = percentage > 30 
      ? 'Based on your urge patterns over the last 7 days.'
      : 'You\'re in a typically low-risk period.';
    
    return `Why ${percentage}%?\n\n${timeContext.charAt(0).toUpperCase() + timeContext.slice(1)} combined with your personal triggers.\n\n${dataNote}`;
  };

  // Handle transparency tap on Risk Weather card
  const handleRiskCardTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      '🔍 Risk Analysis',
      getRiskExplanation(),
      [{ text: 'Got it', style: 'default' }]
    );
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

  // Now using live database risk score!
  const isHighRisk = liveRiskScore > 60;
  const hopeTimer = getHopeTimer();
  const safeHarborLabel = getSafeHarborLabel();

  // Animated pulse for weather icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const pulseDuration = isHighRisk ? 1500 : 3000; // Faster pulse when high risk
    
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: pulseDuration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: pulseDuration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    pulse.start();
    
    return () => pulse.stop();
  }, [isHighRisk]);

  return (
    <View style={styles.container}>
      {/* Animated star background */}
      <StarField />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* JITAI Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>INTERRUPTION</Text>
          <TouchableOpacity onPress={handleRiskCardTap}>
            <AccuracyBadge accuracy={modelAccuracy} />
          </TouchableOpacity>
        </View>

        {/* Main Risk Gauge (replaces Avatar) */}
        <RiskGauge 
          risk={liveRiskScore}
          confidenceMin={confidenceMin}
          confidenceMax={confidenceMax}
          lastUpdated={lastUpdated}
          size={200}
        />

        {/* JITAI Stats Row */}
        <View style={styles.jitaiStatsRow}>
          <JITAIStatCard value={highRiskWindows} label="High-Risk Windows" />
          <View style={styles.statsDivider} />
          <JITAIStatCard value={navigatedWindows} label="Navigated" highlight />
          <View style={styles.statsDivider} />
          <JITAIStatCard value={`${modelAccuracy}%`} label="Model Accuracy" />
        </View>

        {/* Circle Action Buttons - JITAI Style */}
        <View style={styles.circleActionsRow}>
          <CircleActionButton
            icon="clock-outline"
            label="Check-in"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              logEvent('safe');
            }}
          />
          <CircleActionButton
            icon="waves"
            label="Breathe"
            onPress={() => setShowIntervention(true)}
          />
          <CircleActionButton
            icon="chart-line"
            label="Insights"
            onPress={() => router.push('/(tabs)/analytics')}
          />
          <CircleActionButton
            icon="chat-outline"
            label="Chat"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </View>

        {/* Alert Button - Only shows when risk > 70% (JITAI auto-trigger) */}
        {liveRiskScore > 70 && (
          <AlertButton 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setShowIntervention(true);
            }}
            label="⚠️ Navigate High-Risk Window"
          />
        )}

        {/* Next Check-in Card (replaces secondary buttons) */}
        <CheckInCard 
          timeUntil={nextCheckInTime}
          nextCheckInTime={nextCheckInLabel}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              '📅 Check-in Schedule',
              'Check-ins help the system learn your patterns and improve predictions.\n\nYou can adjust check-in frequency in Settings.',
              [{ text: 'Got it', style: 'default' }]
            );
          }}
        />

        {/* Hold On Card - Shows when risk is elevated (30-70%) */}
        {liveRiskScore > 30 && liveRiskScore <= 70 && safeHarbor && (
          <View style={styles.holdOnCard}>
            <Text style={styles.holdOnCardTitle}>⏱️ Hold On</Text>
            <Text style={styles.holdOnCardText}>
              Lower risk expected by <Text style={styles.holdOnCardHighlight}>{safeHarbor.label}</Text>
            </Text>
            <Text style={styles.holdOnCardTimer}>
              {safeHarbor.hoursUntil}h {safeHarbor.minutesUntil}m remaining
            </Text>
          </View>
        )}

        {/* Footer Link */}
        <TouchableOpacity 
          style={styles.footerLink}
          onPress={() => logEvent('lapse')}
        >
          <Text style={styles.footerText}>
            Need to log a past event? <Text style={styles.footerLinkText}>Tap here.</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <InterventionModal
        visible={showIntervention}
        riskLevel={risk?.percentage || 0}
        onClose={() => setShowIntervention(false)}
      />

      <LapseSupportModal
        visible={showLapseSupport}
        onClose={() => setShowLapseSupport(false)}
      />
    </View>
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
    usesPhoneAsAlarm: '',
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
        uses_phone_as_alarm INTEGER DEFAULT 0,
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
        uses_phone_as_alarm,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.screenTime,
        JSON.stringify(data.riskHours),
        JSON.stringify(data.triggers),
        data.alonePattern,
        data.dayPattern,
        data.urgeDuration,
        data.emergencyContactName,
        data.emergencyContactPhone,
        data.usesPhoneAsAlarm === 'yes' ? 1 : 0,
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
      case 8: return data.usesPhoneAsAlarm !== '';
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

      case 8:
        return (
          <>
            <Text style={onboardingStyles.title}>Phone as alarm? ⏰</Text>
            <Text style={onboardingStyles.subtitle}>
              Do you use your phone as your alarm clock?
            </Text>

            {[
              { label: 'Yes, I need my phone nearby', value: 'yes' },
              { label: 'No, I use a separate alarm', value: 'no' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  onboardingStyles.optionButton,
                  data.usesPhoneAsAlarm === option.value && onboardingStyles.optionSelected
                ]}
                onPress={() => setData({...data, usesPhoneAsAlarm: option.value})}
              >
                <Text style={[
                  onboardingStyles.optionText,
                  data.usesPhoneAsAlarm === option.value && onboardingStyles.optionTextSelected
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
        <Text style={onboardingStyles.progressText}>Step {step} of 8</Text>
        <View style={onboardingStyles.progressBar}>
          <View style={[onboardingStyles.progressFill, { width: `${(step / 8) * 100}%` }]} />
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
            if (step === 8) {
              saveProfile();
            } else {
              setStep(step + 1);
            }
          }}
        >
          <Text style={onboardingStyles.nextButtonText}>
            {step === 8 ? 'Complete Setup ✓' : 'Next →'}
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a', // Deep space background
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.sm,
    paddingTop: 50,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: 2,
  },

  // JITAI Stats Row
  jitaiStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
  },

  // Circle Actions Row
  circleActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },

  // Secondary Actions
  secondaryActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xxs,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  secondaryButtonText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },

  // Hold On Card (JITAI terminology)
  holdOnCard: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    alignItems: 'center',
  },
  holdOnCardTitle: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accent.success,
    marginBottom: theme.spacing.xxxs,
  },
  holdOnCardText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  holdOnCardHighlight: {
    color: theme.colors.accent.success,
    fontWeight: theme.typography.fontWeight.bold,
  },
  holdOnCardTimer: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xxxs,
  },

  // Legacy Hope Card (keeping for compatibility)
  hopeCard: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    alignItems: 'center',
  },
  hopeCardTitle: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.accent.success,
    marginBottom: theme.spacing.xxxs,
  },
  hopeCardText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.text.secondary,
  },
  hopeCardHighlight: {
    color: theme.colors.accent.success,
    fontWeight: theme.typography.fontWeight.bold,
  },
  hopeCardTimer: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing.xxxs,
  },
  
  // Legacy Risk Weather Header (keeping for reference)
  riskWeatherContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  riskWeatherGradient: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  riskWeatherLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 16,
  },
  weatherIcon: {
    marginBottom: 8,
  },
  riskScore: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  riskStatus: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  riskStatusHighlight: {
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(255, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },

  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
  },
  riskPeakTimer: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  hopeTimerContainer: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  hopeTimer: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  hopeTimerCountdown: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 0,
  },

  // Intervention Card
  interventionCard: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.components.card.padding,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.risk.high,
    ...theme.shadows.md,
  },
  interventionCardTitle: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xxs,
  },
  interventionText: {
    fontSize: theme.typography.fontSize.bodyLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
    lineHeight: 22,
  },
  breathingButton: {
    backgroundColor: '#4A3A4A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  breathingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Hero Buttons
  heroButtonRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  heroButton: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 28,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    ...theme.shadows.lg,
  },
  urgeHeroButton: {
    backgroundColor: theme.colors.risk.high, // #FF6B6B
  },
  safeHeroButton: {
    backgroundColor: theme.colors.accent.success, // #4ECDC4
  },
  heroButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  heroButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Footer
  footerLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footerLinkText: {
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },

  // Keep old styles for compatibility (onboarding, etc.)
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