import * as SQLite from 'expo-sqlite';

// Simple logistic regression model (trained on your data)
// Features: hour, day_of_week, screen_unlocks_last_hour, time_since_last_urge, evening_routine_done

interface PredictionFeatures {
  hour: number;
  dayOfWeek: number;
  screenUnlocksLastHour: number;
  hoursSinceLastUrge: number;
  eveningRoutineDone: boolean;
  isLateNight: boolean;
}

interface PredictionResult {
  probability: number; // 0-1
  confidence: 'low' | 'medium' | 'high';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  reasoning: string[];
}

// Model weights (we'll calculate these from your data)
const MODEL_WEIGHTS = {
  intercept: -2.5,
  hour: 0.08, // Late night increases risk
  dayOfWeek: 0.02,
  screenUnlocksLastHour: 0.15, // High activity = higher risk
  hoursSinceLastUrge: -0.3, // Recent urge = lower immediate risk (refractory period)
  eveningRoutineDone: -0.8, // Routine = protection
  isLateNight: 1.2, // Strong predictor
};

export const predictUrgeRisk = async (): Promise<PredictionResult> => {
  const features = await extractFeatures();
  
  // Logistic regression: probability = 1 / (1 + e^(-z))
  // where z = intercept + sum(weight * feature)
  
  let z = MODEL_WEIGHTS.intercept;
  z += MODEL_WEIGHTS.hour * features.hour;
  z += MODEL_WEIGHTS.dayOfWeek * features.dayOfWeek;
  z += MODEL_WEIGHTS.screenUnlocksLastHour * features.screenUnlocksLastHour;
  z += MODEL_WEIGHTS.hoursSinceLastUrge * features.hoursSinceLastUrge;
  z += MODEL_WEIGHTS.eveningRoutineDone * (features.eveningRoutineDone ? 1 : 0);
  z += MODEL_WEIGHTS.isLateNight * (features.isLateNight ? 1 : 0);
  
  const probability = 1 / (1 + Math.exp(-z));
  
  // Determine confidence based on feature certainty
  const confidence = determineConfidence(features);
  
  // Risk level
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  if (probability < 0.3) riskLevel = 'LOW';
  else if (probability < 0.7) riskLevel = 'MODERATE';
  else riskLevel = 'HIGH';
  
  // Generate reasoning
  const reasoning = generateReasoning(features, probability);
  
  return {
    probability: Math.round(probability * 100) / 100,
    confidence,
    riskLevel,
    reasoning,
  };
};

const extractFeatures = async (): Promise<PredictionFeatures> => {
  const db = await SQLite.openDatabaseAsync('behavior.db');
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  
  // Check if late night (10 PM - 4 AM)
  const isLateNight = hour >= 22 || hour <= 4;
  
  // Count screen unlocks in last hour
  let screenUnlocksLastHour = 0;
  try {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const screenUnlocks = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM events WHERE event_type = ? AND timestamp > ?',
      ['screen_on', oneHourAgo]
    );
    screenUnlocksLastHour = screenUnlocks[0]?.count || 0;
  } catch (error) {
    // Events table might not exist yet
    console.log('Events table not available for ML prediction');
  }
  
  // Time since last urge
  let hoursSinceLastUrge = 24; // Default if no urges
  try {
    const lastUrge = await db.getAllAsync<{ timestamp: number }>(
      'SELECT timestamp FROM logs WHERE type = ? ORDER BY timestamp DESC LIMIT 1',
      ['urge']
    );
    
    if (lastUrge.length > 0) {
      const timeDiff = Date.now() - lastUrge[0].timestamp;
      hoursSinceLastUrge = timeDiff / (1000 * 60 * 60);
    }
  } catch (error) {
    console.log('Logs table not available for ML prediction');
  }
  
  // Check if evening routine was done today
  let eveningRoutineDone = false;
  try {
    const today = now.toISOString().split('T')[0];
    const routineToday = await db.getAllAsync<{ fully_completed: number }>(
      'SELECT fully_completed FROM evening_routine WHERE date = ?',
      [today]
    );
    eveningRoutineDone = routineToday.length > 0 && routineToday[0].fully_completed === 1;
  } catch (error) {
    // Routine table might not exist yet
    console.log('Routine table not available for ML prediction');
  }
  
  return {
    hour,
    dayOfWeek,
    screenUnlocksLastHour,
    hoursSinceLastUrge,
    eveningRoutineDone,
    isLateNight,
  };
};

const determineConfidence = (features: PredictionFeatures): 'low' | 'medium' | 'high' => {
  // More data = higher confidence
  // Recent activity = higher confidence
  
  if (features.hoursSinceLastUrge < 2) return 'high'; // Recent data
  if (features.screenUnlocksLastHour > 10) return 'high'; // High activity
  if (features.hoursSinceLastUrge > 12) return 'low'; // Stale data
  
  return 'medium';
};

const generateReasoning = (features: PredictionFeatures, probability: number): string[] => {
  const reasons: string[] = [];
  
  if (features.isLateNight) {
    reasons.push('Late night hours (your danger zone)');
  }
  
  if (features.screenUnlocksLastHour > 5) {
    reasons.push(`High activity (${features.screenUnlocksLastHour} unlocks in last hour)`);
  }
  
  if (features.hoursSinceLastUrge < 1) {
    reasons.push('Recent urge logged (refractory period)');
  }
  
  if (!features.eveningRoutineDone && features.hour >= 20) {
    reasons.push('Evening routine not completed yet');
  }
  
  if (features.eveningRoutineDone) {
    reasons.push('✓ Evening routine completed (protective)');
  }
  
  if (reasons.length === 0) {
    reasons.push('Normal activity pattern');
  }
  
  return reasons;
};

// Get personalized intervention recommendation
export const recommendIntervention = async (): Promise<{
  recommended: 'breathing' | 'urge_surfing' | 'pattern_interrupt';
  reasoning: string;
}> => {
  const db = await SQLite.openDatabaseAsync('behavior.db');
  
  try {
    // Calculate average reduction per intervention type
    const stats = await db.getAllAsync<{
      intervention_type: string;
      avg_reduction: number;
      count: number;
    }>(
      `SELECT 
        intervention_type,
        AVG(reduction) as avg_reduction,
        COUNT(*) as count
      FROM urge_sessions 
      WHERE reduction IS NOT NULL
      GROUP BY intervention_type
      ORDER BY avg_reduction DESC`
    );
    
    if (stats.length === 0) {
      return {
        recommended: 'breathing',
        reasoning: 'Starting with breathing (most common)',
      };
    }
    
    const best = stats[0];
    
    return {
      recommended: best.intervention_type as 'breathing' | 'urge_surfing' | 'pattern_interrupt',
      reasoning: `${best.intervention_type} works best for you (${Math.round(best.avg_reduction)}-point avg reduction, ${best.count} uses)`,
    };
  } catch (error) {
    return {
      recommended: 'breathing',
      reasoning: 'Starting with breathing (recommended)',
    };
  }
};
