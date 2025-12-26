import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  // Initialize database when component loads
  useEffect(() => {
    initDatabase();
  }, []);

  const initDatabase = async () => {
    const database = await SQLite.openDatabaseAsync('behavior.db');
    setDb(database);

    // Create table if it doesn't exist
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    loadLogs(database);
  };

  const loadLogs = async (database: SQLite.SQLiteDatabase) => {
    const result = await database.getAllAsync('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10');
    setLogs(result);
  };

  const logEvent = async (type: 'urge' | 'lapse') => {
    if (!db) return;

    const timestamp = Date.now();
    
    await db.runAsync(
      'INSERT INTO logs (type, timestamp) VALUES (?, ?)',
      [type, timestamp]
    );

    loadLogs(db);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling?</Text>

      <TouchableOpacity 
        style={[styles.button, styles.urgeButton]}
        onPress={() => logEvent('urge')}
      >
        <Text style={styles.buttonText}>😰 Feeling an Urge</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.lapseButton]}
        onPress={() => logEvent('lapse')}
      >
        <Text style={styles.buttonText}>😔 Had a Lapse</Text>
      </TouchableOpacity>

      <Text style={styles.historyTitle}>Recent Logs:</Text>
      
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <Text style={styles.logType}>
              {item.type === 'urge' ? '😰 Urge' : '😔 Lapse'}
            </Text>
            <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No logs yet. Tap a button above!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 60,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    padding: 20,
    borderRadius: 12,
    marginVertical: 10,
    alignItems: 'center',
  },
  urgeButton: {
    backgroundColor: '#f57c00',
  },
  lapseButton: {
    backgroundColor: '#d32f2f',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 40,
    marginBottom: 15,
  },
  logItem: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logType: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  logTime: {
    fontSize: 14,
    color: '#999999',
  },
  emptyText: {
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});