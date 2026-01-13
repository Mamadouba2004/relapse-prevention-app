import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SpaceBackground } from '@/components/ui/space-background';
import {
  calculate24HourProfile,
  formatHour,
  getPeakDangerWindow,
  HourlyRiskProfile,
  initRiskProfile
} from '../services/riskProfile';

const screenWidth = Dimensions.get('window').width;

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState<HourlyRiskProfile[]>([]);
  const [peakWindow, setPeakWindow] = useState<any>(null);
  const [lowestRiskWindow, setLowestRiskWindow] = useState<{start: number, end: number, avgRisk: number} | null>(null); // Added state
  
  // Interactive scrubber state
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; value: number } | null>(null);
  
  // Weekly Wins state
  const [weeklyWins, setWeeklyWins] = useState<number>(0);
  
  // Dynamic selected hour data
  const [selectedHourData, setSelectedHourData] = useState<{
    hour: number;
    risk: number;
    label: string;
  } | null>(null);

  useEffect(() => {
    loadProfile();
    loadWeeklyWins();
  }, []);

  const loadProfile = async () => {
    await initRiskProfile();
    const profile = await calculate24HourProfile();
    const peak = await getPeakDangerWindow();
    
    // Find safest window logic
    if (profile.length > 0) {
      let bestWindow = { start: 0, end: 0, avgRisk: 100 };
      // Scan for the 4-hour window with lowest average risk
      for (let i = 0; i < 24; i++) {
         let sum = 0;
         for (let j = 0; j < 4; j++) {
           sum += profile[(i + j) % 24].baseRisk;
         }
         const avg = sum / 4;
         if (avg < bestWindow.avgRisk) {
           bestWindow = { start: i, end: (i + 4) % 24, avgRisk: avg };
         }
      }
      setLowestRiskWindow(bestWindow);
    }

    setProfileData(profile);
    setPeakWindow(peak);
  };
  
  // Load count of "I'm Safe" taps during high-risk (Red Zone) hours this week
  const loadWeeklyWins = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('behavior.db');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      // Query for SAFETY_CHECK_IN events during Red Zone hours (10 PM - 4 AM)
      // Red zone hours are: 22, 23, 0, 1, 2, 3
      const result = await db.getAllAsync<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE event_type = 'SAFETY_CHECK_IN'
          AND timestamp >= ?
          AND (
            CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) >= 22
            OR CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) < 4
          )
      `, [sevenDaysAgo]);
      
      setWeeklyWins(result[0]?.count || 0);
    } catch (error) {
      console.log('Error loading weekly wins:', error);
      setWeeklyWins(0);
    }
  };

  const chartData = {
    labels: ['12am', '4', '8', '12pm', '4', '8', '12am'],
    datasets: [
      {
        data: profileData.length > 0 
          ? profileData.filter((_, i) => i % 2 === 0).map(d => d.baseRisk) // Sample every 2nd hour
          : [20, 15, 10, 25, 40, 65, 80],
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red line
        strokeWidth: 3,
      }
    ]
  };

  const chartConfig = {
    backgroundGradientFrom: "#1e1e1e",
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: "#1e1e1e",
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(165, 243, 252, ${opacity})`,
    strokeWidth: 3,
    barPercentage: 0.5,
    useShadowColorFromDataset: true,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#EF4444"
    },
    propsForLabels: {
        fontSize: 14,
        fontWeight: "600",
        fill: "#9CA3AF"
    },
    propsForVerticalLabels: {
        fontSize: 14,
        fontWeight: "600",
        fill: "#9CA3AF"
    },
    propsForHorizontalLabels: {
        fontSize: 16,
        fontWeight: "500",
        fill: "#6B7280"
    },
    fillShadowGradientFrom: "#EF4444",
    fillShadowGradientTo: "#14B8A6",
    fillShadowGradientOpacity: 0.5,
  };

  const getTriggerIcon = (trigger: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
      'stress': 'head-flash-outline',
      'boredom': 'gamepad-variant',
      'loneliness': 'account-outline',
      'tired': 'sleep',
      'angry': 'emoticon-angry-outline',
      'sad': 'emoticon-sad-outline',
      'hungry': 'food-apple-outline',
      'socialmedia': 'cellphone-remove',
    };
    return iconMap[trigger.toLowerCase()] || 'alert-circle-outline';
  };

  const getTriggerLabel = (trigger: string): string => {
    const labelMap: Record<string, string> = {
      'socialmedia': 'Social Media',
      'videogames': 'Video Games',
    };
    return labelMap[trigger.toLowerCase()] || (trigger.charAt(0).toUpperCase() + trigger.slice(1));
  };


  const handleDataPointClick = ({ index, value, x, y }: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // index is 0-12 (sampling every 2 hours)
    const hour = index * 2;
    setSelectedHourIndex(index);
    setSelectedHourData({
        hour: hour,
        risk: value,
        label: formatHour(hour)
    });
  };
  


  return (
    <SpaceBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* ===== HEADER ===== */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Text style={styles.title}>Your Pattern Map</Text>
            <Text style={styles.subtitle}>
            Based on your patterns and triggers
            </Text>
        </Animated.View>

        {/* ===== 1. 24-HOUR RISK FLOW ===== */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.sectionWrapper}>
            <LinearGradient
                colors={['#1a2332', '#0f1419']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardGradient, { padding: 16 }]}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>24-Hour Risk Flow</Text>
                    {selectedHourData && (
                        <View style={styles.liveRiskBadge}>
                            <Text style={styles.liveRiskText}>{selectedHourData.risk}% Risk at {selectedHourData.label}</Text>
                        </View>
                    )}
                </View>

                <View style={{ alignItems: 'center' }}>
                    <LineChart
                        data={chartData}
                        width={screenWidth - (20 * 2) - (16 * 2) - 10} // screenPad - cardPad - safety
                        height={264}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                        onDataPointClick={handleDataPointClick}
                        withInnerLines={true}
                        withOuterLines={false}
                        withVerticalLines={false}
                    />
                </View>
            </LinearGradient>
        </Animated.View>

        {/* ===== 2. HIGH-RISK WINDOW ===== */}
        {peakWindow && (
            <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.sectionWrapper}>
                <LinearGradient
                    colors={['rgba(239, 68, 68, 0.15)', 'rgba(185, 28, 28, 0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cardGradient, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                >
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardIcon}>🎯</Text>
                        <Text style={[styles.cardTitle, { color: '#EF4444' }]}>HIGH-RISK WINDOW</Text>
                    </View>

                    <Text style={styles.windowTime}>
                        {formatHour(peakWindow.startHour)} – {formatHour(peakWindow.endHour)}
                    </Text>
                    
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>RISK LEVEL</Text>
                        <Text style={[styles.statValue, { color: '#EF4444', textShadowColor: 'rgba(239, 68, 68, 0.5)', textShadowRadius: 10 }]}>
                            {peakWindow.avgRisk}%
                        </Text>
                    </View>

                    <View style={styles.insightBox}>
                        <Text style={styles.insightText}>
                            💡 This is your most vulnerable window. Prepare accountability ahead of time.
                        </Text>
                    </View>
                </LinearGradient>
            </Animated.View>
        )}

        {/* ===== 3. WEEKLY WINS ===== */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.sectionWrapper}>
            <LinearGradient
                colors={['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardGradient, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>🏆</Text>
                    <Text style={[styles.cardTitle, { color: '#10B981' }]}>WEEKLY WINS</Text>
                </View>

                <View style={styles.centerContent}>
                    <Text style={[styles.giantNumber, { color: '#fbbf24' }]}>{weeklyWins}</Text>
                </View>
                
                <Text style={styles.cardBodyText}>
                    You&apos;ve navigated {weeklyWins} high-risk windows this week!
                </Text>

                <Text style={styles.cardSubText}>
                    Check-ins during danger hours (10 PM – 4 AM)
                </Text>
            </LinearGradient>
        </Animated.View>

        {/* ===== 4. ACTIVE TRIGGERS ===== */}
        {peakWindow && peakWindow.triggers.length > 0 && (
            <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.sectionWrapper}>
                <Text style={styles.sectionTitle}>Active Triggers</Text>
                <Text style={styles.sectionSubtitle}>These show up during vulnerable hours</Text>
                
                <View style={styles.gridContainer}>
                    {peakWindow.triggers.map((trigger: string, index: number) => (
                        <View key={index} style={styles.gridItemWrapper}>
                             <LinearGradient
                                colors={['rgba(251, 191, 36, 0.15)', 'rgba(217, 119, 6, 0.05)']}
                                style={styles.gridItemGradient}
                             >
                                <MaterialCommunityIcons 
                                    name={getTriggerIcon(trigger)} 
                                    size={52} 
                                    color="#F59E0B" 
                                />
                                <Text style={styles.gridItemLabel}>
                                    {getTriggerLabel(trigger)}
                                </Text>
                             </LinearGradient>
                        </View>
                    ))}
                </View>
            </Animated.View>
        )}

        {/* ===== 5. SAFEST WINDOW (NEW) ===== */}
        {lowestRiskWindow && (
            <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.sectionWrapper}>
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.15)', 'rgba(29, 78, 216, 0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cardGradient, { borderColor: 'rgba(59, 130, 246, 0.3)' }]}
                >
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardIcon}>✨</Text>
                        <Text style={[styles.cardTitle, { color: '#3B82F6' }]}>YOUR SAFEST WINDOW</Text>
                    </View>

                    <Text style={[styles.windowTime, { color: '#22D3EE' }]}>
                        {formatHour(lowestRiskWindow.start)} – {formatHour(lowestRiskWindow.end)}
                    </Text>
                    
                    <Text style={styles.cardBodyText}>
                        Average Risk: Only {Math.round(lowestRiskWindow.avgRisk)}%
                    </Text>

                    <Text style={[styles.cardSubText, { marginTop: 12 }]}>
                        Consider scheduling important tasks or social events during this time when your resilience is highest.
                    </Text>
                </LinearGradient>
            </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      
      <LinearGradient
        colors={['transparent', 'rgba(15, 23, 42, 0.95)']}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background handled by SpaceBackground
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
  },
  sectionWrapper: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  
  // Card Generic Styles
  cardGradient: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardBodyText: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 24,
    marginBottom: 8,
  },
  cardSubText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  
  // Chart Specific
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  liveRiskBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveRiskText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },

  // High Risk Window Specific
  windowTime: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
    letterSpacing: -1,
  },
  statRow: {
    marginBottom: 20,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 64,
  },
  insightBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 12,
  },
  insightText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Weekly Wins Specific
  centerContent: {
    alignItems: 'center',
    marginVertical: 16,
  },
  giantNumber: {
    fontSize: 72,
    fontWeight: '800',
    textShadowColor: 'rgba(251, 191, 36, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },

  // Triggers Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6, 
  },
  gridItemWrapper: {
    flexBasis: '33.33%', // Try to fit 3 if screen is wide enough or text is short
    flexGrow: 1,         // Allow growth to fill space
    minWidth: 110,       // Prevent crushing text (forces wrap for long words)
    padding: 6,
  },
  gridItemGradient: {
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    aspectRatio: 1, // Make them square-ish like the window design might imply? Or flexible height.
    minHeight: 120,
    width: '100%',
  },
  gridItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    marginTop: 12,
    textAlign: 'center',
  },

  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  }
});