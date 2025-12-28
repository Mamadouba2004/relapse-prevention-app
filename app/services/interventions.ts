import * as SQLite from 'expo-sqlite';

export type InterventionType = 'breathing' | 'urge_surfing' | 'pattern_interrupt' | 'emergency_contact';

export interface Intervention {
  id: string;
  type: InterventionType;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  duration: number; // seconds
}

let db: SQLite.SQLiteDatabase | null = null;

export const initInterventions = async () => {
  db = await SQLite.openDatabaseAsync('behavior.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      risk_level INTEGER,
      completed BOOLEAN,
      helped BOOLEAN,
      duration INTEGER
    );
  `);
};

// Log when intervention is shown
export const logInterventionShown = async (type: InterventionType, riskLevel: number) => {
  if (!db) return;

  await db.runAsync(
    'INSERT INTO interventions (type, timestamp, risk_level, completed, helped) VALUES (?, ?, ?, ?, ?)',
    [type, Date.now(), riskLevel, false, null]
  );
};

// Log when intervention is completed
export const logInterventionCompleted = async (helped: boolean, duration: number) => {
  if (!db) return;

  // Update the most recent intervention
  await db.runAsync(
    `UPDATE interventions 
     SET completed = ?, helped = ?, duration = ? 
     WHERE id = (SELECT id FROM interventions ORDER BY timestamp DESC LIMIT 1)`,
    [true, helped, duration]
  );
};

// Get available interventions
export const getAvailableInterventions = (): Intervention[] => {
  return [
    {
      id: 'breathing',
      type: 'breathing',
      title: '4-7-8 Breathing',
      subtitle: 'Calm your nervous system',
      emoji: '🫁',
      color: '#3B82F6',
      duration: 60,
    },
    {
      id: 'urge_surfing',
      type: 'urge_surfing',
      title: 'Urge Surfing',
      subtitle: 'Ride the wave until it passes',
      emoji: '🌊',
      color: '#06B6D4',
      duration: 90,
    },
    {
      id: 'pattern_interrupt',
      type: 'pattern_interrupt',
      title: 'Pattern Break',
      subtitle: 'Quick distraction task',
      emoji: '⚡',
      color: '#F59E0B',
      duration: 30,
    },
    {
      id: 'emergency',
      type: 'emergency_contact',
      title: 'Call Support',
      subtitle: 'Reach out to someone',
      emoji: '📞',
      color: '#10B981',
      duration: 0,
    },
  ];
};

// Check if intervention should trigger
export const shouldTriggerIntervention = async (currentRisk: number): Promise<boolean> => {
  if (currentRisk < 70) return false;

  if (!db) return true;

  // Don't spam - check if we showed one in last 30 minutes
  const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
  
  const recent = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM interventions WHERE timestamp > ?',
    [thirtyMinsAgo]
  );

  return (recent[0]?.count || 0) === 0;
};