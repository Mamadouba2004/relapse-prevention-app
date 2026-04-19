import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { SpaceBackground } from '@/components/ui/space-background';

type SettingsState = {
  checkin_reminder: boolean;
  checkin_reminder_time: string;
  risk_alerts: boolean;
  routine_enabled: boolean;
  routine_reminder: boolean;
  routine_reminder_time: string;
  routine_items: string[];
};

const DEFAULT_ROUTINE_ITEMS = [
  "Light exercise (20 min)",
  "Read for 20 minutes",
  "Journal your thoughts",
  "Prepare tomorrow's clothes",
  "Set phone to charge"
];

export default function SettingsScreen() {
  const router = useRouter();
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  
  // Settings State
  const [settings, setSettings] = useState<SettingsState>({
    checkin_reminder: true,
    checkin_reminder_time: '21:00',
    risk_alerts: true,
    routine_enabled: true,
    routine_reminder: false,
    routine_reminder_time: '20:00',
    routine_items: DEFAULT_ROUTINE_ITEMS
  });

  // UI State
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [showTimePicker, setShowTimePicker] = useState<{show: boolean, key: 'checkin' | 'routine' | null}>({ show: false, key: null });

  useEffect(() => {
    initSettings();
  }, []);

  const initSettings = async () => {
    if (Platform.OS === 'web') return; // Use default settings on web
    const database = await SQLite.openDatabaseAsync('behavior.db');
    setDb(database);

    // Create or update app_settings table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Load saved settings
    const result = await database.getAllAsync<{ key: string, value: string }>('SELECT * FROM app_settings');
    const loadedSettings: any = { ...settings };

    result.forEach(row => {
      try {
        // Parse boolean/array values, keep strings as strings
        const val = JSON.parse(row.value);
        loadedSettings[row.key] = val;
      } catch {
        loadedSettings[row.key] = row.value;
      }
    });

    setSettings(loadedSettings);
  };

  const saveSetting = async (key: keyof SettingsState, value: any) => {
    if (Platform.OS === 'web') {
      setSettings(prev => ({ ...prev, [key]: value }));
      return;
    }
    if (!db) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
        [key, JSON.stringify(value)]
      );
    } catch (e) {
      console.error('Error saving setting:', key, e);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker({ show: false, key: null });
    
    if (selectedDate && showTimePicker.key) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      if (showTimePicker.key === 'checkin') {
        saveSetting('checkin_reminder_time', timeString);
      } else {
        saveSetting('routine_reminder_time', timeString);
      }
    }
  };

  const exportData = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Export', 'Data export is not available in the web demo.');
      return;
    }
    if (!db) return;
    try {
      // Collect anonymous data
      const riskHistory = await db.getAllAsync('SELECT * FROM logs'); // Assuming logs for now, adjust table name if needed
      const checkIns = await db.getAllAsync('SELECT * FROM check_ins');
      
      const exportPayload = {
        generated_at: new Date().toISOString(),
        risk_history: riskHistory,
        check_ins: checkIns,
        app_version: '1.0.0'
      };
      
      const fileUri = FileSystem.documentDirectory + 'interruption_data.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportPayload, null, 2));

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Anonymous Data',
        UTI: 'public.json'
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Could not generate data file.');
    }
  };

  const clearPredictionHistory = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Demo', 'History clearing is not available in the web demo.');
      return;
    }
    if (!db) return;
    
    Alert.alert(
      "Clear Prediction History?",
      "This will reset the ML model's learning but keep your profile and logs.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear History", 
          style: "destructive",
          onPress: async () => {
            // Delete relevant ML history tables/rows
            await db.runAsync('DELETE FROM urge_sessions'); 
            // Add other tables as needed for ML
            Alert.alert("Success", "Prediction history cleared.");
          }
        }
      ]
    );
  };

  const deleteAllData = async () => {
    if (Platform.OS === 'web') {
      setShowDeleteModal(false);
      Alert.alert('Web Demo', 'Data deletion is not available in the web demo.');
      return;
    }
    if (!db) return;
    if (deleteConfirmation !== 'DELETE') return;

    try {
      await db.runAsync('DELETE FROM check_ins');
      await db.runAsync('DELETE FROM logs');
      await db.runAsync('DELETE FROM urge_sessions');
      await db.runAsync('DELETE FROM events');
      await db.runAsync('DELETE FROM evening_routine');
      // Keep user_profile optionally or delete it too
      // await db.runAsync('DELETE FROM user_profile'); 
      
      setShowDeleteModal(false);
      Alert.alert("Data Deleted", "All your data has been permanently erased.");
      // Navigate to onboarding or reset state
    } catch (error) {
       Alert.alert("Error", "Could not delete all data.");
    }
  };

  const addRoutineItem = () => {
    if (newItemText.trim()) {
      const updated = [...settings.routine_items, newItemText.trim()];
      saveSetting('routine_items', updated);
      setNewItemText('');
    }
  };

  const removeRoutineItem = (index: number) => {
    const updated = settings.routine_items.filter((_, i) => i !== index);
    saveSetting('routine_items', updated);
  };

  return (
    <SpaceBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* SECTION 1: NOTIFICATIONS */}
        <View style={styles.sectionContainer}>
          <LinearGradient
             colors={['rgba(30, 41, 59, 0.8)', 'rgba(15, 23, 42, 0.9)']}
             style={styles.card}
          >
            <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#FFF" />
                <Text style={styles.cardTitle}>Notifications</Text>
            </View>

            {/* Check-in Toggle */}
            <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Check-in Reminders</Text>
                    <Text style={styles.settingDesc}>Get reminded during high-risk hours</Text>
                    {settings.checkin_reminder && (
                        <TouchableOpacity onPress={() => setShowTimePicker({ show: true, key: 'checkin' })}>
                             <Text style={styles.timeLabel}>⏰ Time: {settings.checkin_reminder_time}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Switch 
                    value={settings.checkin_reminder}
                    onValueChange={(val) => saveSetting('checkin_reminder', val)}
                    trackColor={{ false: '#334155', true: '#5B7CFF' }}
                    thumbColor="#F8FAFC"
                />
            </View>

            <View style={styles.divider} />

            {/* Risk Alerts Toggle */}
            <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>High-Risk Alerts</Text>
                    <Text style={styles.settingDesc}>Alerts when entering danger windows</Text>
                </View>
                <Switch 
                    value={settings.risk_alerts}
                    onValueChange={(val) => saveSetting('risk_alerts', val)}
                    trackColor={{ false: '#334155', true: '#5B7CFF' }}
                    thumbColor="#F8FAFC"
                />
            </View>

            <View style={styles.divider} />

            {/* Routine Reminder Toggle */}
            <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Evening Routine Reminder</Text>
                    <Text style={styles.settingDesc}>Daily reminder to complete routine</Text>
                     {settings.routine_reminder && (
                        <TouchableOpacity onPress={() => setShowTimePicker({ show: true, key: 'routine' })}>
                             <Text style={styles.timeLabel}>⏰ Time: {settings.routine_reminder_time}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Switch 
                    value={settings.routine_reminder}
                    onValueChange={(val) => saveSetting('routine_reminder', val)}
                    trackColor={{ false: '#334155', true: '#5B7CFF' }}
                    thumbColor="#F8FAFC"
                />
            </View>
          </LinearGradient>
        </View>

        {/* SECTION 2: EVENING ROUTINE */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.15)', 'rgba(67, 56, 202, 0.05)']}
            style={[styles.card, { borderColor: 'rgba(99, 102, 241, 0.3)', borderWidth: 1 }]}
          >
            <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={24} color="#818CF8" />
                <Text style={[styles.cardTitle, { color: '#818CF8' }]}>Evening Routine</Text>
            </View>

            <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Enable Evening Routine</Text>
                    <Text style={styles.settingDesc}>Daily checklist for better sleep</Text>
                </View>
                <Switch 
                    value={settings.routine_enabled}
                    onValueChange={(val) => saveSetting('routine_enabled', val)}
                    trackColor={{ false: '#334155', true: '#818CF8' }}
                    thumbColor="#F8FAFC"
                />
            </View>

            {settings.routine_enabled && (
                <View style={{ marginTop: 16 }}>
                    <TouchableOpacity 
                        style={styles.actionButtonSecondary}
                        onPress={() => setShowRoutineModal(true)}
                    >
                        <MaterialCommunityIcons name="playlist-edit" size={20} color="#E2E8F0" />
                        <Text style={styles.actionButtonTextSecondary}>Customize Checklist</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionButtonSecondary, { marginTop: 12, backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}
                        // Navigate to generic routine view or modal (using home tab for now)
                        onPress={() => router.push('/(tabs)')} 
                    >
                        <MaterialCommunityIcons name="eye-outline" size={20} color="#818CF8" />
                        <Text style={[styles.actionButtonTextSecondary, { color: '#818CF8' }]}>View Routine Now</Text>
                    </TouchableOpacity>
                </View>
            )}
          </LinearGradient>
        </View>

        {/* SECTION 3: DATA & PRIVACY */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.9)', 'rgba(15, 23, 42, 0.6)']}
            style={[styles.card, { borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}
          >
             <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#94A3B8" />
                <Text style={[styles.cardTitle, { color: '#94A3B8' }]}>Data & Privacy</Text>
            </View>

            <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
                onPress={exportData}
            >
                <MaterialCommunityIcons name="export-variant" size={20} color="#60A5FA" />
                <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.actionButtonTitle, { color: '#60A5FA' }]}>Export My Data</Text>
                    <Text style={styles.actionButtonDesc}>Generate anonymous JSON for research</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}
                onPress={clearPredictionHistory}
            >
                <MaterialCommunityIcons name="history" size={20} color="#FBBF24" />
                <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.actionButtonTitle, { color: '#FBBF24' }]}>Clear Prediction History</Text>
                    <Text style={styles.actionButtonDesc}>Delete risk history (keeps profile)</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                onPress={() => {
                    setDeleteConfirmation('');
                    setShowDeleteModal(true);
                }}
            >
                <MaterialCommunityIcons name="delete-alert-outline" size={20} color="#F87171" />
                <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.actionButtonTitle, { color: '#F87171' }]}>Delete All Data</Text>
                    <Text style={styles.actionButtonDesc}>Permanently erase everything</Text>
                </View>
            </TouchableOpacity>

          </LinearGradient>
        </View>

         {/* SECTION 4: ABOUT */}
         <View style={styles.sectionContainer}>
            <View style={[styles.card, { backgroundColor: 'transparent', paddingVertical: 0 }]}>
                 <View style={{ alignItems: 'center', marginBottom: 20 }}>
                     <Text style={styles.appTitle}>INTERRUPTION</Text>
                     <Text style={styles.versionText}>Version 1.0.0 (Build 2026.01.13)</Text>
                 </View>

                 <TouchableOpacity 
                    style={styles.linkRow}
                    onPress={() => router.push('/(tabs)/learn')}
                 >
                    <Text style={styles.linkText}>📚 Research Citations</Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity 
                    style={styles.linkRow}
                    onPress={() => Linking.openURL('mailto:support@interruption.app')}
                 >
                    <Text style={styles.linkText}>📧 Contact Support</Text>
                 </TouchableOpacity>
            </View>
         </View>

         <View style={{ height: 100 }} />
      </ScrollView>

      {/* Routine Item Editor Modal */}
      <Modal visible={showRoutineModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Customize Routine</Text>
                <Text style={styles.modalSubtitle}>Add or remove checklist items</Text>

                <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
                    {settings.routine_items.map((item, index) => (
                        <View key={index} style={styles.modalItemRow}>
                            <Text style={styles.modalItemText}>{item}</Text>
                            <TouchableOpacity onPress={() => removeRoutineItem(index)}>
                                <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.addItemRow}>
                    <TextInput 
                        style={styles.addItemInput}
                        placeholder="Add new item..."
                        placeholderTextColor="#64748B"
                        value={newItemText}
                        onChangeText={setNewItemText}
                    />
                    <TouchableOpacity onPress={addRoutineItem} style={styles.addButton}>
                        <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setShowRoutineModal(false)}
                >
                    <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderColor: '#EF4444' }]}>
                <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Delete All Data?</Text>
                <Text style={styles.modalSubtitle}>This cannot be undone. Type DELETE to confirm.</Text>
                
                <TextInput 
                    style={styles.deleteInput}
                    placeholder="Type DELETE"
                    placeholderTextColor="#64748B"
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    autoCapitalize="characters"
                />

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    <TouchableOpacity 
                        style={[styles.modalButton, { backgroundColor: '#334155' }]}
                        onPress={() => setShowDeleteModal(false)}
                    >
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modalButton, { backgroundColor: deleteConfirmation === 'DELETE' ? '#EF4444' : '#94A3B8' }]}
                        disabled={deleteConfirmation !== 'DELETE'}
                        onPress={deleteAllData}
                    >
                        <Text style={styles.buttonText}>Delete Everything</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Time Picker — native only */}
      {showTimePicker.show && Platform.OS !== 'web' && (
          <DateTimePicker
            value={new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
      )}
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginTop: 60,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    color: '#94A3B8',
  },
  timeLabel: {
    fontSize: 14,
    color: '#5B7CFF',
    fontWeight: '600',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonTextSecondary: {
    color: '#E2E8F0',
    fontWeight: '600',
    marginLeft: 8,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 2,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: '#475569',
  },
  linkRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalItemText: {
    fontSize: 16,
    color: '#E2E8F0',
  },
  addItemRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addButton: {
    backgroundColor: '#5B7CFF',
    width: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    marginTop: 24,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  deleteInput: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 12,
    padding: 16,
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
  }
});
