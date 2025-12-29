import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function SettingsScreen() {
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);

    try {
      const db = await SQLite.openDatabaseAsync('behavior.db');

      // Get urge sessions data
      const sessions = await db.getAllAsync(
        'SELECT * FROM urge_sessions ORDER BY start_timestamp DESC'
      );

      // Get user profile
      const profile = await db.getAllAsync(
        'SELECT * FROM user_profile ORDER BY created_at DESC LIMIT 1'
      );

      // Get routine completions
      const routines = await db.getAllAsync(
        'SELECT * FROM evening_routine ORDER BY date DESC'
      );

      // Convert to CSV
      const csvContent = generateCSV(sessions, profile[0], routines);

      // Save to file using new File API
      const exportFile = new File(Paths.document, 'interruption_data.csv');
      await exportFile.write(csvContent);

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportFile.uri);
      } else {
        Alert.alert('Success', 'Data exported to: ' + exportFile.uri);
      }

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Could not export data: ' + error);
    } finally {
      setExporting(false);
    }
  };

  const generateCSV = (sessions: any[], profile: any, routines: any[]) => {
    let csv = 'INTERRUPTION DATA EXPORT\n\n';

    // User Profile
    csv += 'USER PROFILE\n';
    csv += 'Screen Time,Risk Hours,Triggers,Alone Pattern,Day Pattern,Urge Duration\n';
    if (profile) {
      csv += `${profile.screen_time},${profile.risk_hours},${profile.triggers},${profile.alone_pattern},${profile.day_pattern},${profile.urge_duration}\n`;
    }
    csv += '\n';

    // Urge Sessions
    csv += 'URGE SESSIONS\n';
    csv += 'Timestamp,Intensity Before,Intensity After,Reduction,Intervention Type,What Helped\n';
    sessions.forEach(s => {
      const date = new Date(s.start_timestamp).toISOString();
      csv += `${date},${s.intensity_before},${s.intensity_after},${s.reduction},${s.intervention_type},"${s.what_helped || ''}"\n`;
    });
    csv += '\n';

    // Evening Routines
    csv += 'EVENING ROUTINES\n';
    csv += 'Date,Items Completed,Fully Completed\n';
    routines.forEach(r => {
      csv += `${r.date},"${r.items_completed}",${r.fully_completed}\n`;
    });

    return csv;
  };

  const deleteAllData = async () => {
    Alert.alert(
      '⚠️ Delete All Data?',
      'This will permanently delete ALL your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            const db = await SQLite.openDatabaseAsync('behavior.db');
            
            await db.execAsync(`
              DROP TABLE IF EXISTS urge_sessions;
              DROP TABLE IF EXISTS user_profile;
              DROP TABLE IF EXISTS evening_routine;
              DROP TABLE IF EXISTS lapse_recovery;
              DROP TABLE IF EXISTS events;
              DROP TABLE IF EXISTS logs;
              DROP TABLE IF EXISTS interventions;
              DROP TABLE IF EXISTS app_settings;
            `);

            Alert.alert('✓ Deleted', 'All data has been permanently deleted.');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Privacy & Data</Text>

      {/* Privacy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Your Privacy</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ✓ All data stored locally on your device{'\n'}
            ✓ No cloud sync, no tracking{'\n'}
            ✓ You own your data{'\n'}
            ✓ Export or delete anytime
          </Text>
        </View>
      </View>

      {/* Data Export */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Data Export</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={exportData}
          disabled={exporting}
        >
          <Text style={styles.actionButtonEmoji}>📥</Text>
          <View style={styles.actionButtonContent}>
            <Text style={styles.actionButtonTitle}>
              {exporting ? 'Exporting...' : 'Export My Data (CSV)'}
            </Text>
            <Text style={styles.actionButtonSubtitle}>
              Download all your urge sessions, interventions, and routines
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Why export?</Text>
          <Text style={styles.infoText}>
            • Analyze your patterns in Excel{'\n'}
            • Share with therapist or researcher{'\n'}
            • Backup before app deletion{'\n'}
            • Train your own ML models
          </Text>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Danger Zone</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={deleteAllData}
        >
          <Text style={styles.actionButtonEmoji}>🗑️</Text>
          <View style={styles.actionButtonContent}>
            <Text style={[styles.actionButtonTitle, styles.dangerText]}>
              Delete All Data
            </Text>
            <Text style={styles.actionButtonSubtitle}>
              Permanently remove all data from this device
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Interruption v1.0</Text>
          <Text style={styles.infoText}>
            A research-backed JITAI system for behavioral health.{'\n\n'}
            Built with compassion and science.{'\n\n'}
            © 2025 Adou
          </Text>
        </View>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButton: {
    borderColor: '#7F1D1D',
    backgroundColor: '#450A0A',
  },
  actionButtonEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  dangerText: {
    color: '#EF4444',
  },
  actionButtonSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
});
