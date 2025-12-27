import * as SQLite from 'expo-sqlite';
import { AppState, AppStateStatus } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;
let lastAppState: AppStateStatus = 'active';

export const initDataCollection = async () => {
  // Open database
  db = await SQLite.openDatabaseAsync('behavior.db');

  // Create events table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  // Start tracking app state changes
  AppState.addEventListener('change', handleAppStateChange);

  // Log initial app open
  await db.runAsync(
    'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
    ['screen_on', Date.now(), JSON.stringify({ hour: new Date().getHours() })]
  );
};

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (!db) return;

  const timestamp = Date.now();
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();

  // Detect screen on (app coming to foreground)
  if (nextAppState === 'active' && lastAppState !== 'active') {
    await db.runAsync(
      'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
      ['screen_on', timestamp, JSON.stringify({ hour, dayOfWeek })]
    );
  }

  // Detect screen off (app going to background)
  if (nextAppState !== 'active' && lastAppState === 'active') {
    await db.runAsync(
      'INSERT INTO events (event_type, timestamp, metadata) VALUES (?, ?, ?)',
      ['screen_off', timestamp, JSON.stringify({ hour, dayOfWeek })]
    );
  }

  lastAppState = nextAppState;
};

// Get screen unlock count for last N hours
export const getScreenUnlocksLastHours = async (hours: number): Promise<number> => {
  if (!db) return 0;

  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  
const result = await db.getAllAsync<{ count: number }>(
  'SELECT COUNT(*) as count FROM events WHERE event_type = ? AND timestamp > ?',
  ['screen_on', cutoffTime]
);

return result[0]?.count || 0;
};

// Get all events for analysis
export const getAllEvents = async () => {
  if (!db) return [];
  return await db.getAllAsync('SELECT * FROM events ORDER BY timestamp DESC LIMIT 50');
};