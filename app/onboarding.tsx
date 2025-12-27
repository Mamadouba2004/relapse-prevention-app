import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as SQLite from 'expo-sqlite';

interface OnboardingData {
  screenTime: string;
  riskHours: string[];
  triggers: string[];
  alonePattern: string;
  dayPattern: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    screenTime: '',
    riskHours: [],
    triggers: [],
    alonePattern: '',
    dayPattern: '',
  });

  const completeOnboarding = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('behavior.db');

      // Create user profile table
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

      // Save profile
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

      // Mark onboarding complete
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      await db.runAsync(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        ['onboarding_complete', 'true']
      );

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const toggleSelection = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(item => item !== value);
    }
    return [...array, value];
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Welcome! 👋</Text>
            <Text style={styles.subtitle}>
              Let's build your personalized risk profile.
              This helps predict YOUR high-risk windows.
            </Text>
            <Text style={styles.question}>
              What's your average daily screen time?
            </Text>

            {['<2 hours', '2-4 hours', '4-6 hours', '6+ hours'].map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  data.screenTime === option && styles.optionSelected
                ]}
                onPress={() => setData({...data, screenTime: option})}
              >
                <Text style={[
                  styles.optionText,
                  data.screenTime === option && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>When do urges hit? ⏰</Text>
            <Text style={styles.subtitle}>Select all that apply</Text>

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
                  styles.optionButton,
                  data.riskHours.includes(option.value) && styles.optionSelected
                ]}
                onPress={() => setData({
                  ...data,
                  riskHours: toggleSelection(data.riskHours, option.value)
                })}
              >
                <Text style={[
                  styles.optionText,
                  data.riskHours.includes(option.value) && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What triggers urges? 🎯</Text>
            <Text style={styles.subtitle}>Select all that apply</Text>

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
                  styles.optionButton,
                  data.triggers.includes(option.value) && styles.optionSelected
                ]}
                onPress={() => setData({
                  ...data,
                  triggers: toggleSelection(data.triggers, option.value)
                })}
              >
                <Text style={[
                  styles.optionText,
                  data.triggers.includes(option.value) && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Alone during urges? 🏠</Text>
            <Text style={styles.subtitle}>Are you usually alone when urges happen?</Text>

            {[
              { label: 'Yes, always', value: 'always' },
              { label: 'Usually', value: 'usually' },
              { label: 'Sometimes', value: 'sometimes' },
              { label: 'Rarely', value: 'rarely' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  data.alonePattern === option.value && styles.optionSelected
                ]}
                onPress={() => setData({...data, alonePattern: option.value})}
              >
                <Text style={[
                  styles.optionText,
                  data.alonePattern === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Day patterns? 📅</Text>
            <Text style={styles.subtitle}>Do urges happen more on certain days?</Text>

            {[
              { label: 'Weekends', value: 'weekends' },
              { label: 'Weekdays', value: 'weekdays' },
              { label: 'No pattern', value: 'nopattern' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  data.dayPattern === option.value && styles.optionSelected
                ]}
                onPress={() => setData({...data, dayPattern: option.value})}
              >
                <Text style={[
                  styles.optionText,
                  data.dayPattern === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return null;
    }
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Step {step} of 5</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 5) * 100}%` }]} />
        </View>
      </View>

      {renderStep()}

      <View style={styles.navigationContainer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled
          ]}
          disabled={!canProceed()}
          onPress={() => {
            if (step === 5) {
              completeOnboarding();
            } else {
              setStep(step + 1);
            }
          }}
        >
          <Text style={styles.nextButtonText}>
            {step === 5 ? 'Complete Setup ✓' : 'Next →'}
          </Text>
        </TouchableOpacity>
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
  stepContainer: {
    marginBottom: 40,
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