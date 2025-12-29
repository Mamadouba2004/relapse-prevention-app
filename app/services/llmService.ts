import * as SQLite from 'expo-sqlite';

// Mock LLM service (simulates Claude API responses)
// Replace with real API later by changing USE_REAL_API to true

const USE_REAL_API = false;
const ANTHROPIC_API_KEY = 'your-api-key-here'; // Add real key when ready

interface MessageContext {
  currentRisk: number;
  hour: number;
  recentActivity: string;
  lastUrgeTime?: number;
  bestIntervention?: string;
  avgReduction?: number;
  userTriggers: string[];
  isLateNight: boolean;
}

export const generateContextualNotification = async (): Promise<string> => {
  const context = await gatherContext();
  
  if (USE_REAL_API) {
    return await callClaudeAPI(context);
  } else {
    return generateMockResponse(context);
  }
};

export const generatePostInterventionInsight = async (
  interventionType: string,
  reduction: number,
  whatHelped: string[]
): Promise<string> => {
  const context = await gatherContext();
  
  if (USE_REAL_API) {
    return await callClaudeAPIForInsight(interventionType, reduction, whatHelped, context);
  } else {
    return generateMockInsight(interventionType, reduction, whatHelped);
  }
};

// Gather user context from database
const gatherContext = async (): Promise<MessageContext> => {
  const db = await SQLite.openDatabaseAsync('behavior.db');
  const now = new Date();
  const hour = now.getHours();
  
  // Get user profile
  const profile = await db.getAllAsync<{
    triggers: string;
    risk_hours: string;
  }>('SELECT triggers, risk_hours FROM user_profile ORDER BY created_at DESC LIMIT 1');
  
  const userTriggers = profile.length > 0 
    ? JSON.parse(profile[0].triggers) 
    : [];
  
  const isLateNight = hour >= 22 || hour <= 4;
  
  // Get recent activity
  const recentEvents = await db.getAllAsync<{ event_type: string }>(
    'SELECT event_type FROM events WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 10',
    [Date.now() - (15 * 60 * 1000)] // Last 15 min
  );
  
  const recentActivity = recentEvents.length > 5 
    ? 'high activity' 
    : recentEvents.length > 2 
      ? 'moderate activity' 
      : 'low activity';
  
  // Last urge time
  const lastUrge = await db.getAllAsync<{ timestamp: number }>(
    'SELECT timestamp FROM logs WHERE type = ? ORDER BY timestamp DESC LIMIT 1',
    ['urge']
  );
  
  const lastUrgeTime = lastUrge.length > 0 ? lastUrge[0].timestamp : undefined;
  
  // Best intervention stats
  const bestIntervention = await db.getAllAsync<{
    intervention_type: string;
    avg_reduction: number;
  }>(
    `SELECT intervention_type, AVG(reduction) as avg_reduction 
     FROM urge_sessions 
     WHERE reduction IS NOT NULL 
     GROUP BY intervention_type 
     ORDER BY avg_reduction DESC 
     LIMIT 1`
  );
  
  return {
    currentRisk: 0, // Will be filled from ML model
    hour,
    recentActivity,
    lastUrgeTime,
    bestIntervention: bestIntervention[0]?.intervention_type,
    avgReduction: bestIntervention[0]?.avg_reduction,
    userTriggers,
    isLateNight,
  };
};

// Mock LLM response (simulates intelligent contextual messages)
const generateMockResponse = (context: MessageContext): string => {
  const templates = [];
  
  // Time-based context
  if (context.isLateNight) {
    templates.push(
      `Hey, I notice it's ${context.hour > 12 ? context.hour - 12 : context.hour}${context.hour >= 12 ? ' PM' : ' AM'}—right in your typical high-risk window.`
    );
  }
  
  // Activity-based context
  if (context.recentActivity === 'high activity') {
    templates.push(
      `You've been pretty active in the last 15 minutes.`
    );
  }
  
  // Intervention recommendation
  if (context.bestIntervention && context.avgReduction) {
    const interventionName = 
      context.bestIntervention === 'breathing' ? 'breathing exercises' :
      context.bestIntervention === 'urge_surfing' ? 'urge surfing' :
      'pattern interrupts';
    
    templates.push(
      `${interventionName} has worked really well for you (averaging ${Math.round(context.avgReduction)}-point reductions). Want to try it?`
    );
  }
  
  // Trigger-based context
  if (context.userTriggers.includes('loneliness') && context.isLateNight) {
    templates.push(
      `Late nights can feel isolating. Remember, you can always call your emergency contact if you need connection.`
    );
  }
  
  if (context.userTriggers.includes('boredom') && context.recentActivity === 'high activity') {
    templates.push(
      `Looks like you're restless—scrolling to fill time maybe? That's a pattern we've seen before.`
    );
  }
  
  // Default fallback
  if (templates.length === 0) {
    templates.push(
      `Just checking in. This is sometimes a tricky moment for you. You don't have to do anything, but I'm here if you need support.`
    );
  }
  
  // Combine 2-3 relevant templates
  const selected = templates.slice(0, Math.min(2, templates.length));
  return selected.join(' ');
};

// Mock insight generation
const generateMockInsight = (
  interventionType: string,
  reduction: number,
  whatHelped: string[]
): string => {
  const interventionName = 
    interventionType === 'breathing' ? 'Breathing' :
    interventionType === 'urge_surfing' ? 'Urge surfing' :
    'Pattern interrupts';
  
  if (reduction >= 5) {
    const topHelper = whatHelped[0];
    const helperMap: { [key: string]: string } = {
      'breathing': 'the breathing rhythm',
      'focus': 'having something to focus on',
      'care': 'knowing someone cares',
      'distract': 'the distraction',
      'time': 'giving it time',
      'awareness': 'becoming more aware',
    };
    
    const helperText = topHelper ? helperMap[topHelper] || 'that specific technique' : 'the exercise';
    
    return `${interventionName} is clearly working well for you—especially ${helperText}. You dropped from a strong urge to manageable in just 60 seconds. That's building real resilience.`;
  } else if (reduction >= 2) {
    return `${interventionName} helped take the edge off. Sometimes a small reduction is all you need to get through the moment. You're doing great.`;
  } else if (reduction <= 0) {
    return `${interventionName} didn't quite work this time—that's totally normal. Different moments need different tools. Want to try something else, or just ride it out?`;
  } else {
    return `Every time you use these tools, you're training your brain to respond differently. Keep going.`;
  }
};

// Real Claude API call (for when you add your key)
const callClaudeAPI = async (context: MessageContext): Promise<string> => {
  try {
    const prompt = `You are a compassionate behavioral health coach. Generate a brief, contextual check-in message (2-3 sentences max) based on this user context:

Time: ${context.hour}:00 (${context.isLateNight ? 'late night - their danger hours' : 'daytime'})
Recent activity: ${context.recentActivity}
User triggers: ${context.userTriggers.join(', ')}
Best intervention: ${context.bestIntervention} (avg ${context.avgReduction}-point reduction)

Tone: Supportive, non-judgmental, specific to their pattern. No generic advice.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: prompt,
        }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    return generateMockResponse(context); // Fallback to mock
  }
};

const callClaudeAPIForInsight = async (
  interventionType: string,
  reduction: number,
  whatHelped: string[],
  context: MessageContext
): Promise<string> => {
  try {
    const prompt = `Generate a brief, encouraging insight (1-2 sentences) about this intervention outcome:

Intervention: ${interventionType}
Urge reduction: ${reduction} points
What helped: ${whatHelped.join(', ')}

Tone: Warm, specific, focused on their progress. Not generic praise.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: prompt,
        }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    return generateMockInsight(interventionType, reduction, whatHelped);
  }
};
