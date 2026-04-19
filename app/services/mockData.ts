import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

export const WEB_MOCK_RISK_SCORE = 67;
export const WEB_MOCK_CONFIDENCE_MIN = 57;
export const WEB_MOCK_CONFIDENCE_MAX = 77;
export const WEB_MOCK_MODEL_ACCURACY = 72;
export const WEB_MOCK_HIGH_RISK_WINDOWS = 14;
export const WEB_MOCK_NAVIGATED_WINDOWS = 11;

export const WEB_MOCK_ML_PREDICTION = {
  probability: 0.67,
  confidence: 'high' as const,
  riskLevel: 'MODERATE' as const,
  factors: [
    { label: 'Late night hours', impact: 45, severity: 'high' as const },
    { label: 'Digital restlessness (12 unlocks/hr)', impact: 35, severity: 'high' as const },
    { label: 'Moderate stress', impact: 16, severity: 'medium' as const },
    { label: 'Evening routine skipped', impact: 15, severity: 'medium' as const },
    { label: 'Stable circadian rhythm', impact: 15, severity: 'protective' as const },
  ],
};

const fmt = (h: number) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

export const WEB_MOCK_PROFILE_DATA = Array.from({ length: 24 }, (_, hour) => {
  let baseRisk: number;
  if (hour >= 22 || hour <= 3) baseRisk = 78;
  else if (hour >= 18) baseRisk = 58;
  else if (hour >= 12) baseRisk = 35;
  else if (hour >= 8) baseRisk = 28;
  else baseRisk = 20;
  return {
    hour,
    baseRisk,
    riskLevel: (baseRisk >= 70 ? 'HIGH' : baseRisk >= 40 ? 'MODERATE' : 'LOW') as
      'HIGH' | 'MODERATE' | 'LOW',
    label: fmt(hour),
  };
});

export const WEB_MOCK_PEAK_WINDOW = {
  startHour: 22,
  endHour: 3,
  avgRisk: 78,
  triggers: ['stress', 'loneliness', 'fatigue', 'socialmedia'],
};

export const WEB_MOCK_SAFE_HARBOR = {
  safeHour: 8,
  hoursUntil: 4,
  minutesUntil: 30,
  label: '8 AM',
};

export const WEB_MOCK_WEEKLY_WINS = 9;

export const WEB_MOCK_STATS = {
  totalUrges: 17,
  totalLapses: 3,
  totalSafeCheckins: 42,
  totalInterventions: 17,
  avgReduction: 23,
  successRate: 82,
};

export const WEB_MOCK_INTERVENTION_STATS = [
  { type: 'breathing', count: 8, avgReduction: 24, totalSessions: 8 },
  { type: 'urge_surfing', count: 5, avgReduction: 18, totalSessions: 5 },
  { type: 'pattern_interrupt', count: 3, avgReduction: 12, totalSessions: 3 },
  { type: 'emergency_contact', count: 1, avgReduction: 30, totalSessions: 1 },
];

export const WEB_MOCK_WEEKLY_TRENDS = [
  { weekStart: '3 weeks ago', avgReduction: 18, sessions: 4, trend: 0 },
  { weekStart: '2 weeks ago', avgReduction: 22, sessions: 6, trend: 4 },
  { weekStart: 'Last week', avgReduction: 26, sessions: 7, trend: 4 },
  { weekStart: 'This week', avgReduction: 24, sessions: 5, trend: -2 },
];

export const WEB_MOCK_TOP_FACTORS = [
  { factor: 'breathing', count: 8 },
  { factor: 'focus', count: 6 },
  { factor: 'care', count: 4 },
  { factor: 'distract', count: 3 },
  { factor: 'time', count: 2 },
];

export const WEB_MOCK_TREND_DATA = {
  change: 8,
  direction: 'up' as const,
  label: '1h ago',
};
