import * as SQLite from 'expo-sqlite';
import { calculate24HourProfile, getPeakDangerWindow } from './riskProfile';

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

// Get risk score for current hour based on screen_on events over last 7 days
export const getRiskForCurrentHour = async (): Promise<number> => {
  if (!db) {
    await initRiskAnalysis();
  }
  if (!db) return 20; // Baseline if DB unavailable

  const currentHour = new Date().getHours();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  try {
    // Query screen_on events for this specific hour over the last week
    const result = await db.getAllAsync<{ avg_count: number }>(`
      SELECT AVG(daily_count) as avg_count FROM (
        SELECT 
          DATE(timestamp / 1000, 'unixepoch', 'localtime') as day,
          COUNT(*) as daily_count
        FROM events
        WHERE event_type = 'screen_on'
          AND timestamp >= ?
          AND CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) = ?
        GROUP BY day
      )
    `, [sevenDaysAgo, currentHour]);

    const avgUnlocks = result[0]?.avg_count || 0;

    // Map unlock count to 0-100 risk score:
    // 0 unlocks = 20% baseline
    // 1-2 unlocks = 30%
    // 3-5 unlocks = 50%
    // 6-9 unlocks = 70%
    // 10+ unlocks = 90% storm
    let riskScore: number;
    
    if (avgUnlocks === 0) {
      riskScore = 20; // Baseline - no data for this hour
    } else if (avgUnlocks <= 2) {
      riskScore = 20 + (avgUnlocks * 5); // 20-30%
    } else if (avgUnlocks <= 5) {
      riskScore = 30 + ((avgUnlocks - 2) * 6.67); // 30-50%
    } else if (avgUnlocks <= 9) {
      riskScore = 50 + ((avgUnlocks - 5) * 5); // 50-70%
    } else {
      // 10+ unlocks - storm territory
      riskScore = 70 + Math.min((avgUnlocks - 9) * 4, 20); // 70-90%, cap at 90
    }

    // Round to integer and clamp between 0-100
    return Math.min(100, Math.max(0, Math.round(riskScore)));
    
  } catch (error) {
    console.error('Error getting risk for current hour:', error);
    return 20; // Baseline on error
  }
};

// Helper function to calculate risk for a specific hour based on screen_on data
const getRiskForHour = async (hour: number): Promise<number> => {
  if (!db) return 20;

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  try {
    const result = await db.getAllAsync<{ avg_count: number }>(`
      SELECT AVG(daily_count) as avg_count FROM (
        SELECT 
          DATE(timestamp / 1000, 'unixepoch', 'localtime') as day,
          COUNT(*) as daily_count
        FROM events
        WHERE event_type = 'screen_on'
          AND timestamp >= ?
          AND CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) = ?
        GROUP BY day
      )
    `, [sevenDaysAgo, hour]);

    const avgUnlocks = result[0]?.avg_count || 0;

    // Same mapping as getRiskForCurrentHour
    let riskScore: number;
    if (avgUnlocks === 0) {
      riskScore = 20;
    } else if (avgUnlocks <= 2) {
      riskScore = 20 + (avgUnlocks * 5);
    } else if (avgUnlocks <= 5) {
      riskScore = 30 + ((avgUnlocks - 2) * 6.67);
    } else if (avgUnlocks <= 9) {
      riskScore = 50 + ((avgUnlocks - 5) * 5);
    } else {
      riskScore = 70 + Math.min((avgUnlocks - 9) * 4, 20);
    }

    return Math.min(100, Math.max(0, Math.round(riskScore)));
  } catch {
    return 20;
  }
};

// Get time until risk drops below 40% (Safe Harbor)
// Scans the next 12 hours of risk data
export const getSafeHarborTime = async (): Promise<{
  timeRemaining: string;
  safeHour: number;
  safeHourLabel: string;
} | null> => {
  if (!db) {
    await initRiskAnalysis();
  }
  if (!db) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  // Scan the next 12 hours
  for (let offset = 1; offset <= 12; offset++) {
    const checkHour = (currentHour + offset) % 24;
    const riskForHour = await getRiskForHour(checkHour);

    if (riskForHour < 40) {
      // Found safe harbor! Calculate time remaining
      let hoursUntil = offset;
      let minutesUntil = 60 - currentMinutes;

      if (minutesUntil === 60) {
        minutesUntil = 0;
      } else {
        hoursUntil -= 1;
      }

      // Format the safe hour label
      let safeHourLabel: string;
      if (checkHour === 0) {
        safeHourLabel = '12 AM';
      } else if (checkHour < 12) {
        safeHourLabel = `${checkHour} AM`;
      } else if (checkHour === 12) {
        safeHourLabel = '12 PM';
      } else {
        safeHourLabel = `${checkHour - 12} PM`;
      }

      return {
        timeRemaining: `${hoursUntil}h ${minutesUntil}m`,
        safeHour: checkHour,
        safeHourLabel,
      };
    }
  }

  // No safe harbor found in next 12 hours
  return null;
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
  let percentage = 15; // Base risk
  let zone: 'CLEAR_SKIES' | 'STORM_WATCH' | 'STORM_WARNING' = 'CLEAR_SKIES';
  let level: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
  let color = '#3B82F6';
  let emoji = '🟢';
  let message = 'Clear skies ahead';

  // Risk logic
  const currentHour = new Date().getHours();
  const isLateNight = lateNightHours.includes(currentHour);

  // Get actual recent unlocks (not weighted)
  const actualScreenCount = screenCount?.[0]?.count || 0;
  const actualUrgeCount = urgeCount?.[0]?.count || 0;

  // Simple, aggressive calculation
  percentage += actualScreenCount * 3; // Each screen unlock adds 3%
  percentage += actualUrgeCount * 15;  // Each urge/lapse adds 15%!

  if (isLateNight) {
    percentage += 20; // Late night bonus
  }

  if (lateNightPercentage > 50) {
    percentage += 15; // Heavy late-night user
  }

  // Cap between 5 and 95
  percentage = Math.min(95, Math.max(5, percentage));

  // Assign zones based on percentage
  if (percentage >= 70) {
    zone = 'STORM_WARNING';
    level = 'HIGH';
    color = '#EF4444';
    emoji = '⚠️';
    message = 'Storm warning - High risk window active';
  } else if (percentage >= 40) {
    zone = 'STORM_WATCH';
    level = 'MODERATE';
    color = '#F59E0B';
    emoji = '🟡';
    message = 'Storm watch - Elevated activity detected';
  } else {
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

// Get baseline risk for current hour from user's profile
export const getBaselineRisk = async (): Promise<number> => {
  const profile = await calculate24HourProfile();
  const currentHour = new Date().getHours();
  
  return profile[currentHour]?.baseRisk || 20;
};

// Check if currently in an active urge window
export const getActiveUrgeSpike = async (): Promise<number> => {
  if (!db) return 0;

  // Get user's urge duration (with fallback if column doesn't exist)
  let urgeDurationMinutes = 20; // Default 20 minutes
  
  try {
    const profileResult = await db.getAllAsync<{ urge_duration: string }>(
      'SELECT urge_duration FROM user_profile ORDER BY created_at DESC LIMIT 1'
    );
    if (profileResult[0]?.urge_duration) {
      urgeDurationMinutes = parseInt(profileResult[0].urge_duration);
    }
  } catch (error) {
    // Column might not exist in old database - use default
    console.log('urge_duration column not found, using default 20 minutes');
  }
  
  const urgeDurationMs = urgeDurationMinutes * 60 * 1000;

  // Check for urges logged within the window
  const windowStart = Date.now() - urgeDurationMs;
  
  const recentUrges = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM events WHERE event_type IN (?, ?) AND timestamp > ?',
    ['URGE_LOGGED', 'LAPSE_LOGGED', windowStart]
  );

  const urgeCount = recentUrges[0]?.count || 0;
  
  // Each urge in window adds 15%, up to 30% max spike
  return Math.min(urgeCount * 15, 30);
};

// SIMPLIFIED: Just get baseline from profile + check for recent urges
export const getCurrentRisk = async (): Promise<RiskAssessment> => {
  const baseline = await getBaselineRisk(); // From profile based on current hour
  
  // Check if user logged an urge in last 5 minutes (fresh urge spike)
  let urgeSpikeActive = false;
  if (db) {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentUrges = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM events WHERE event_type = ? AND timestamp > ?',
      ['URGE_LOGGED', fiveMinutesAgo]
    );
    urgeSpikeActive = (recentUrges[0]?.count || 0) > 0;
  }

  const percentage = urgeSpikeActive ? Math.min(95, baseline + 15) : baseline;
  const peakWindow = await getPeakDangerWindow();

  // Convert to peak hours array
  const peakHours: number[] = [];
  for (let h = peakWindow.startHour; h !== peakWindow.endHour; h = (h + 1) % 24) {
    peakHours.push(h);
  }
  peakHours.push(peakWindow.endHour);

  let zone: 'CLEAR_SKIES' | 'STORM_WATCH' | 'STORM_WARNING' = 'CLEAR_SKIES';
  let level: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
  let color = '#3B82F6';
  let emoji = '✨';
  let message = 'You\'re doing well';

  if (percentage >= 70) {
    zone = 'STORM_WARNING';
    level = 'HIGH';
    color = '#EF4444';
    emoji = '⚠️';
    message = urgeSpikeActive 
      ? 'Urge detected - Stay strong!' 
      : 'Danger hour - Stay alert';
  } else if (percentage >= 40) {
    zone = 'STORM_WATCH';
    level = 'MODERATE';
    color = '#F59E0B';
    emoji = '🟡';
    message = 'Moderate risk period';
  } else {
    zone = 'CLEAR_SKIES';
    level = 'LOW';
    color = '#3B82F6';
    emoji = '✨';
    message = 'Low risk - keep it up!';
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