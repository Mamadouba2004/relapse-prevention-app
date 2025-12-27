import * as SQLite from 'expo-sqlite';

export interface HourlyPattern {
  hour: number;
  count: number;
}

export interface RiskAssessment {
  level: 'LOW' | 'MODERATE' | 'HIGH';
  percentage: number; // 0-100
  zone: 'CLEAR_SKIES' | 'STORM_WATCH' | 'STORM_WARNING';
  color: string;
  emoji: string;
  message: string;
  peakHours: number[];
}

let db: SQLite.SQLiteDatabase | null = null;

export const initRiskAnalysis = async () => {
  db = await SQLite.openDatabaseAsync('behavior.db');
};

// Get unlock pattern by hour of day (last 7 days)
export const getHourlyPattern = async (): Promise<HourlyPattern[]> => {
  if (!db) return [];

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  const events = await db.getAllAsync<{ timestamp: number }>(
    'SELECT timestamp FROM events WHERE event_type = ? AND timestamp > ?',
    ['screen_on', sevenDaysAgo]
  );

  // Count by hour
  const hourCounts: { [key: number]: number } = {};
  for (let i = 0; i < 24; i++) {
    hourCounts[i] = 0;
  }

  events.forEach((event) => {
    const hour = new Date(event.timestamp).getHours();
    hourCounts[hour]++;
  });

  return Object.keys(hourCounts).map((hour) => ({
    hour: parseInt(hour),
    count: hourCounts[parseInt(hour)],
  }));
};

// Calculate risk level based on patterns
export const calculateRiskLevel = async (): Promise<RiskAssessment> => {
  const hourlyPattern = await getHourlyPattern();
  
// Get recent activity (last 3 hours)
const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);

// Count screen unlocks
const screenCount = await db?.getAllAsync<{ count: number }>(
  'SELECT COUNT(*) as count FROM events WHERE event_type = ? AND timestamp > ?',
  ['screen_on', threeHoursAgo]
);

// Count urges and lapses (these are high-risk indicators)
const urgeCount = await db?.getAllAsync<{ count: number }>(
  'SELECT COUNT(*) as count FROM events WHERE event_type IN (?, ?) AND timestamp > ?',
  ['URGE_LOGGED', 'LAPSE_LOGGED', threeHoursAgo]
);

const recentUnlocks = (screenCount?.[0]?.count || 0) + 
                      (urgeCount?.[0]?.count || 0) * 3; // Weight urges/lapses 3x

  // Find peak hours (late night = 10 PM to 4 AM)
  const lateNightHours = [22, 23, 0, 1, 2, 3, 4];
  const lateNightActivity = hourlyPattern
    .filter(p => lateNightHours.includes(p.hour))
    .reduce((sum, p) => sum + p.count, 0);

  const totalActivity = hourlyPattern.reduce((sum, p) => sum + p.count, 0);
  const lateNightPercentage = totalActivity > 0 
    ? (lateNightActivity / totalActivity) * 100 
    : 0;

  // Find top 3 peak hours
  const peakHours = hourlyPattern
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(p => p.hour);

  // Calculate percentage (0-100)
let percentage = 0;
let zone: 'CLEAR_SKIES' | 'STORM_WATCH' | 'STORM_WARNING' = 'CLEAR_SKIES';
let level: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
let color = '#3B82F6';
let emoji = '🟢';
let message = 'Clear skies ahead';

// Risk logic
const currentHour = new Date().getHours();
const isLateNight = lateNightHours.includes(currentHour);

if (recentUnlocks > 10 && isLateNight) {
  percentage = Math.min(75 + (recentUnlocks - 10) * 2, 95);
  zone = 'STORM_WARNING';
  level = 'HIGH';
  color = '#EF4444';
  emoji = '⚠️';
  message = 'Storm warning - High risk window active';
} else if (recentUnlocks > 6 || lateNightPercentage > 40) {
  percentage = 40 + Math.min(recentUnlocks * 3, 30);
  zone = 'STORM_WATCH';
  level = 'MODERATE';
  color = '#F59E0B';
  emoji = '🟡';
  message = 'Storm watch - Elevated activity detected';
} else {
  percentage = Math.max(1, recentUnlocks * 2);
  zone = 'CLEAR_SKIES';
  level = 'LOW';
  color = '#3B82F6';
  emoji = '✨';
  message = 'Clear skies - Healthy pattern';
}

return {
  level,
  percentage,
  zone,
  color,
  emoji,
  message,
  peakHours,
};
};

// Get risk trend for last 3 hours (for chart)
export const getRiskTrend = async (): Promise<Array<{ time: number; risk: number }>> => {
  if (!db) return [];

  const now = Date.now();
  const threeHoursAgo = now - (3 * 60 * 60 * 1000);

  // Get events in 10-minute buckets
  const events = await db.getAllAsync<{ timestamp: number }>(
    'SELECT timestamp FROM events WHERE event_type = ? AND timestamp > ?',
    ['screen_on', threeHoursAgo]
  );

  // Create 10-minute buckets
  const buckets: { [key: number]: number } = {};
  const bucketSize = 10 * 60 * 1000; // 10 minutes

  for (let i = threeHoursAgo; i <= now; i += bucketSize) {
    buckets[i] = 0;
  }

  // Count events per bucket
  events.forEach(event => {
    const bucketTime = Math.floor(event.timestamp / bucketSize) * bucketSize;
    if (buckets[bucketTime] !== undefined) {
      buckets[bucketTime]++;
    }
  });

  // Convert to chart data with risk scores
  return Object.entries(buckets).map(([time, count]) => {
    const timeNum = parseInt(time);
    const hour = new Date(timeNum).getHours();
    const isLateNight = [22, 23, 0, 1, 2, 3, 4].includes(hour);
    
    // Risk calculation: more unlocks + late night = higher risk
    let risk = count * 10;
    if (isLateNight) risk += 20;
    risk = Math.min(risk, 100);
    
    return { time: timeNum, risk };
  });
};
// Format hour for display (e.g., 13 -> "1 PM")
export const formatHour = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};