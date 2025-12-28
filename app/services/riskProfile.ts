import * as SQLite from 'expo-sqlite';

export interface HourlyRiskProfile {
  hour: number;
  baseRisk: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  label: string;
}

let db: SQLite.SQLiteDatabase | null = null;

export const initRiskProfile = async () => {
  db = await SQLite.openDatabaseAsync('behavior.db');
};

// Get user's onboarding profile
const getUserProfile = async () => {
  if (!db) return null;

  try {
    // First try with all columns (new schema)
    const result = await db.getAllAsync<{
      screen_time: string;
      risk_hours: string;
      triggers: string;
      alone_pattern: string;
      day_pattern: string;
      urge_duration?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
    }>('SELECT screen_time, risk_hours, triggers, alone_pattern, day_pattern, urge_duration, emergency_contact_name, emergency_contact_phone FROM user_profile ORDER BY created_at DESC LIMIT 1');

    if (result.length === 0) return null;

    return {
      screenTime: result[0].screen_time,
      riskHours: JSON.parse(result[0].risk_hours) as string[],
      triggers: JSON.parse(result[0].triggers) as string[],
      alonePattern: result[0].alone_pattern,
      dayPattern: result[0].day_pattern,
      urgeDuration: parseInt(result[0].urge_duration || '20'),
    };
  } catch (error) {
    // Fallback: try without new columns (old schema)
    try {
      const result = await db.getAllAsync<{
        screen_time: string;
        risk_hours: string;
        triggers: string;
        alone_pattern: string;
        day_pattern: string;
      }>('SELECT screen_time, risk_hours, triggers, alone_pattern, day_pattern FROM user_profile ORDER BY created_at DESC LIMIT 1');

      if (result.length === 0) return null;

      return {
        screenTime: result[0].screen_time,
        riskHours: JSON.parse(result[0].risk_hours) as string[],
        triggers: JSON.parse(result[0].triggers) as string[],
        alonePattern: result[0].alone_pattern,
        dayPattern: result[0].day_pattern,
        urgeDuration: 20, // Default for old profiles
      };
    } catch (fallbackError) {
      console.error('Error getting user profile:', fallbackError);
      return null;
    }
  }
};

// Calculate 24-hour risk profile based on user's answers
export const calculate24HourProfile = async (): Promise<HourlyRiskProfile[]> => {
  const profile = await getUserProfile();
  
  if (!profile) {
    // Return default low-risk profile if no data
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      baseRisk: 20,
      riskLevel: 'LOW' as const,
      label: formatHour(hour),
    }));
  }

  // Initialize all hours with base risk
  const hourlyRisk: HourlyRiskProfile[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    baseRisk: 15, // Everyone starts at 15% baseline
    riskLevel: 'LOW' as const,
    label: formatHour(hour),
  }));

  // Add risk based on self-reported high-risk times
  profile.riskHours.forEach(timeWindow => {
    let hours: number[] = [];
    
    switch(timeWindow) {
      case 'morning':
        hours = [6, 7, 8, 9, 10, 11]; // 6AM-12PM
        break;
      case 'afternoon':
        hours = [12, 13, 14, 15, 16, 17]; // 12PM-6PM
        break;
      case 'evening':
        hours = [18, 19, 20, 21]; // 6PM-10PM
        break;
      case 'latenight':
        hours = [22, 23, 0, 1]; // 10PM-2AM
        break;
      case 'verylate':
        hours = [2, 3, 4, 5]; // 2AM-6AM
        break;
    }

    hours.forEach(hour => {
      hourlyRisk[hour].baseRisk += 35; // Major risk increase
    });
  });

  // Add risk for high screen time users (they're more exposed)
  if (profile.screenTime === '6+ hours') {
    hourlyRisk.forEach(h => h.baseRisk += 10);
  } else if (profile.screenTime === '4-6 hours') {
    hourlyRisk.forEach(h => h.baseRisk += 5);
  }

  // Add risk for loneliness trigger (worse at night)
  if (profile.triggers.includes('loneliness')) {
    [20, 21, 22, 23, 0, 1, 2].forEach(hour => {
      hourlyRisk[hour].baseRisk += 15;
    });
  }

  // Add risk for fatigue trigger (worse late night)
  if (profile.triggers.includes('fatigue')) {
    [22, 23, 0, 1, 2, 3].forEach(hour => {
      hourlyRisk[hour].baseRisk += 15;
    });
  }

  // Add risk for boredom trigger (worse during free time)
  if (profile.triggers.includes('boredom')) {
    [12, 13, 14, 15, 20, 21, 22].forEach(hour => {
      hourlyRisk[hour].baseRisk += 10;
    });
  }

  // Add risk for social media trigger (peaks evening/night)
  if (profile.triggers.includes('socialmedia')) {
    [19, 20, 21, 22, 23, 0].forEach(hour => {
      hourlyRisk[hour].baseRisk += 12;
    });
  }

  // Add risk for being alone pattern
  if (profile.alonePattern === 'always' || profile.alonePattern === 'usually') {
    hourlyRisk.forEach(h => h.baseRisk += 8);
  }

  // Cap at 95% max, floor at 5% min
  hourlyRisk.forEach(h => {
    h.baseRisk = Math.min(95, Math.max(5, h.baseRisk));
    
    // Assign risk level
    if (h.baseRisk >= 70) {
      h.riskLevel = 'HIGH';
    } else if (h.baseRisk >= 40) {
      h.riskLevel = 'MODERATE';
    } else {
      h.riskLevel = 'LOW';
    }
  });

  return hourlyRisk;
};

// Find peak danger hours
export const getPeakDangerWindow = async (): Promise<{
  startHour: number;
  endHour: number;
  avgRisk: number;
  triggers: string[];
}> => {
  const profile = await calculate24HourProfile();
  const userProfile = await getUserProfile();
  
  // Find highest consecutive window (3+ hours)
  let maxAvg = 0;
  let maxStart = 0;
  let maxEnd = 0;

  for (let start = 0; start < 24; start++) {
    for (let length = 3; length <= 6; length++) {
      const end = (start + length) % 24;
      const hours = [];
      
      for (let i = 0; i < length; i++) {
        hours.push(profile[(start + i) % 24].baseRisk);
      }
      
      const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
      
      if (avg > maxAvg) {
        maxAvg = avg;
        maxStart = start;
        maxEnd = end;
      }
    }
  }

  return {
    startHour: maxStart,
    endHour: maxEnd,
    avgRisk: Math.round(maxAvg),
    triggers: userProfile?.triggers || [],
  };
};

// Format hour for display
const formatHour = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

export { formatHour };
