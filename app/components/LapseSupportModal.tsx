import * as SQLite from 'expo-sqlite';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function LapseSupportModal({ visible, onClose }: Props) {
  const [wantsSupport, setWantsSupport] = useState<boolean | null>(null);
  const [supportScheduled, setSupportScheduled] = useState(false);

  const scheduleExtraSupport = async () => {
    const db = await SQLite.openDatabaseAsync('behavior.db');
    
    // Create lapse_recovery table if doesn't exist
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lapse_recovery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lapse_timestamp INTEGER NOT NULL,
        extra_support_enabled BOOLEAN,
        check_in_frequency_hours INTEGER,
        created_at INTEGER
      );
    `);

    // Schedule extra support for next 48 hours
    await db.runAsync(
      'INSERT INTO lapse_recovery (lapse_timestamp, extra_support_enabled, check_in_frequency_hours, created_at) VALUES (?, ?, ?, ?)',
      [Date.now(), true, 2, Date.now()]
    );

    setSupportScheduled(true);
  };

  if (wantsSupport === null) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.header}>
            <Text style={styles.emoji}>💙</Text>
            <Text style={styles.title}>You're Not Broken</Text>
            <Text style={styles.subtitle}>
              Recovery isn't linear. Lapses are part of the process, not failure.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What You Need to Know</Text>
            <Text style={styles.infoText}>
              The next 24-48 hours might feel harder. This is normal and temporary.
              {'\n\n'}
              Your brain is more vulnerable right now, but that doesn't mean you can't get through it.
              {'\n\n'}
              You've already shown strength by logging this.
            </Text>
          </View>

          <View style={styles.questionBox}>
            <Text style={styles.questionText}>
              Would you like extra support for the next 48 hours?
            </Text>
            <Text style={styles.questionSubtext}>
              We'll check in with you every 2 hours during your usual vulnerable times.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              scheduleExtraSupport();
              setWantsSupport(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Yes, I'd like support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setWantsSupport(false)}
          >
            <Text style={styles.secondaryButtonText}>I'll reach out if I need help</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    );
  }

  if (wantsSupport && !supportScheduled) {
    return (
      <Modal visible={visible} animationType="fade" transparent={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.loadingText}>Setting up support...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (supportScheduled) {
    return (
      <Modal visible={visible} animationType="fade" transparent={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.emoji}>✓</Text>
            <Text style={styles.title}>Support Activated</Text>
            <Text style={styles.subtitle}>
              We'll check in every 2 hours during your vulnerable times for the next 48 hours.
            </Text>
          </View>

          <View style={styles.reminderBox}>
            <Text style={styles.reminderTitle}>Quick Reminders:</Text>
            <Text style={styles.reminderText}>
              • You can turn off check-ins anytime{'\n'}
              • Your progress isn't erased{'\n'}
              • One lapse doesn't define you{'\n'}
              • Tomorrow is a fresh start
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setWantsSupport(null);
              setSupportScheduled(false);
              onClose();
            }}
          >
            <Text style={styles.primaryButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.emoji}>💪</Text>
          <Text style={styles.title}>You've Got This</Text>
          <Text style={styles.subtitle}>
            You know yourself. If you need support, we're here.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Remember:{'\n\n'}
            • You can always tap "Record Urge" for immediate help{'\n'}
            • Your emergency contact is one tap away{'\n'}
            • Tomorrow is a new day
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setWantsSupport(null);
            onClose();
          }}
        >
          <Text style={styles.primaryButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
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
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 24,
  },
  questionBox: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  questionSubtext: {
    fontSize: 14,
    color: '#93C5FD',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  reminderBox: {
    backgroundColor: '#14532D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#166534',
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  reminderText: {
    fontSize: 15,
    color: '#BBF7D0',
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
