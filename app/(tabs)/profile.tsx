import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  calculate24HourProfile,
  formatHour,
  getPeakDangerWindow,
  HourlyRiskProfile,
  initRiskProfile
} from '../services/riskProfile';

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState<HourlyRiskProfile[]>([]);
  const [peakWindow, setPeakWindow] = useState<any>(null);
  
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

  // Get color for each bar based on hour (Safety Gradient system)
  const getBarColor = (hour: number): string => {
    // Danger Zone: 22:00 to 04:00 (Red)
    if (hour >= 22 || hour < 4) {
      return '#EF4444';
    }
    // Transition/Caution: 18:00 to 22:00 (Yellow/Amber)
    if (hour >= 18) {
      return '#F59E0B';
    }
    // Safe Harbor: 04:00 to 18:00 (Teal)
    return '#14B8A6';
  };

  // Get current time-based gradient for LineChart (Oura-style)
  const getTimeBasedGradient = (): { line: string; gradient: string } => {
    const currentHour = new Date().getHours();
    
    // Danger Zone: 22:00 to 04:00 (Deep Red)
    if (currentHour >= 22 || currentHour < 4) {
      return { line: '#DC2626', gradient: '#DC2626' };
    }
    // Transition/Caution: 18:00 to 22:00 (Bright Orange)
    if (currentHour >= 18) {
      return { line: '#F59E0B', gradient: '#F59E0B' };
    }
    // Safe Harbor: 04:00 to 18:00 (Vibrant Teal)
    return { line: '#14B8A6', gradient: '#14B8A6' };
  };

  // Get peak risk level to determine dominant gradient color
  const getPeakGradientColor = (): string => {
    if (profileData.length === 0) return '#F59E0B';
    const maxRisk = Math.max(...profileData.map(p => p.baseRisk));
    // Danger zone (70-100%): Deep red
    if (maxRisk >= 70) return '#DC2626';
    // Caution zone (40-70%): Bright orange
    if (maxRisk >= 40) return '#F59E0B';
    // Safe zone (0-40%): Vibrant teal
    return '#14B8A6';
  };

  const timeColors = getTimeBasedGradient();
  const screenWidth = Dimensions.get('window').width;

  // Prepare LineChart data - use 13 points (every 2 hours) for better tap precision
  const chartDataValues = profileData.length > 0
    ? [...profileData.filter((_, i) => i % 2 === 0).map(p => p.baseRisk), profileData[0]?.baseRisk || 20]
    : [35, 30, 25, 20, 22, 25, 30, 35, 40, 45, 42, 38, 35];

  const chartData = {
    labels: ['12A', '', '', '6A', '', '', '12P', '', '', '6P', '', '', '12A'],
    datasets: [{
      data: chartDataValues,
      strokeWidth: 5,
    }]
  };

  // Find peak risk for decorator
  const peakRiskValue = Math.max(...chartDataValues);
  const peakRiskIndex = chartDataValues.indexOf(peakRiskValue);
  const peakHourLabel = chartData.labels[peakRiskIndex] || '12 AM';
  
  // Calculate peak decorator position (chart dimensions)
  const chartWidth = screenWidth - 40;
  const chartHeight = 300;
  const chartPaddingLeft = 45; // Y-axis labels width
  const chartPaddingRight = 40;
  const chartPaddingTop = 16;
  const chartPaddingBottom = 40; // X-axis labels height
  const usableWidth = chartWidth - chartPaddingLeft - chartPaddingRight;
  const usableHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  
  // Peak position calculation
  const peakX = chartPaddingLeft + (peakRiskIndex / (chartDataValues.length - 1)) * usableWidth;
  const peakY = chartPaddingTop + usableHeight * (1 - peakRiskValue / 100);

  // Get gradient color based on data position (for multi-color effect)
  const getGradientColor = (opacity: number = 1): string => {
    // This creates a visual effect where the chart shows the risk pattern
    // The fill will use the current time's color theme
    return timeColors.line;
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 70) return '#EF4444';
    if (risk >= 40) return '#F59E0B';
    return '#3B82F6';
  };

  const getRiskEmoji = (level: string) => {
    if (level === 'HIGH') return '🔴';
    if (level === 'MODERATE') return '🟡';
    return '🟢';
  };

  // Format trigger names for display
  const formatTriggerName = (trigger: string): string => {
    const triggerMap: { [key: string]: string } = {
      'socialmedia': 'Social Media',
      'boredom': 'Boredom',
      'loneliness': 'Loneliness',
      'stress': 'Stress',
      'anxiety': 'Anxiety',
      'latenight': 'Late Night',
      'verylate': 'Very Late Night',
      'morning': 'Morning',
      'afternoon': 'Afternoon',
      'evening': 'Evening',
      'tired': 'Tired',
      'angry': 'Angry',
      'sad': 'Sad',
      'hungry': 'Hungry',
    };
    
    // Return mapped name or capitalize first letter as fallback
    return triggerMap[trigger.toLowerCase()] || 
      trigger.charAt(0).toUpperCase() + trigger.slice(1);
  };

  // Hourly tips - contextual advice based on time of day
  const hourlyTips: { [key: number]: string } = {
    0: "12 AM: Phone in another room. The urge can't outlast your sleep.",
    2: "2 AM: Very late. If awake, this is a high-risk window. Stay grounded.",
    4: "4 AM: If you're awake, try a glass of water and deep breaths. This window passes.",
    6: "6 AM: Early morning. Fresh start energy. Use it wisely.",
    8: "8 AM: Morning momentum matters. Start your day with intention.",
    10: "10 AM: Mid-morning focus time. Keep devices purposeful.",
    12: "12 PM: Midday check-in. How's your energy? Take a short walk.",
    14: "2 PM: Post-lunch dip. Move your body, don't reach for your phone.",
    16: "4 PM: Afternoon slump is real. Stand up, stretch, reset.",
    18: "6 PM: Evening transition. Set boundaries before night falls.",
    20: "8 PM: Evening wind-down begins. Put devices on Do Not Disturb.",
    22: "10 PM: Late night. High-risk window starting. Prepare accountability.",
  };

  // Get tip for selected hour (maps to every 2-hour block)
  const getTipForHour = (index: number): string => {
    const hourMap = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]; // Every 2 hours
    const hour = hourMap[index] ?? 0;
    return hourlyTips[hour] || "Tap a point on the chart to see a tip for that hour.";
  };

  // Handle chart point click - updates tooltip AND challenging time card
  const handleDataPointClick = (data: { index: number; value: number; x: number; y: number }) => {
    setSelectedHourIndex(data.index);
    setTooltipPos({ x: data.x, y: data.y, value: data.value });

    // Map index to actual hour (every 2 hours: 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0)
    const hourMap = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
    const selectedHour = hourMap[data.index] ?? 0;

    setSelectedHourData({
      hour: selectedHour,
      risk: Math.round(data.value),
      label: formatHour(selectedHour),
    });
  };
  
  // Get trigger icons
  const getTriggerIcon = (trigger: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    const iconMap: { [key: string]: keyof typeof MaterialCommunityIcons.glyphMap } = {
      'socialmedia': 'cellphone',
      'boredom': 'emoticon-neutral-outline',
      'loneliness': 'account-off-outline',
      'stress': 'lightning-bolt',
      'anxiety': 'alert-circle-outline',
      'tired': 'sleep',
      'angry': 'emoticon-angry-outline',
      'sad': 'emoticon-sad-outline',
      'hungry': 'food-apple-outline',
    };
    return iconMap[trigger.toLowerCase()] || 'alert-outline';
  };

  return (
    <ScrollView style={styles.container}>
      {/* ===== HEADER ===== */}
      <Text style={styles.title}>📅 Your Pattern Map</Text>
      <Text style={styles.subtitle}>
        Based on your patterns and triggers
      </Text>

      {/* ===== THE FLOW: Hero Chart (No Box - Floating) ===== */}
      <View style={styles.heroChartContainer}>
        <Text style={styles.chartTitle}>24-Hour Risk Flow</Text>
        <Text style={styles.chartSubtitle}>Tap any point to explore that hour</Text>
        
        {profileData.length > 0 ? (
          <View style={styles.lineChartWrapper}>
            {/* Tooltip overlay */}
            {tooltipPos && (
              <View 
                style={[
                  styles.tooltip, 
                  { 
                    left: Math.max(10, Math.min(tooltipPos.x - 30, screenWidth - 120)), 
                    top: tooltipPos.y - 50,
                  }
                ]}
              >
                <Text style={styles.tooltipText}>{Math.round(tooltipPos.value)}%</Text>
                <View style={styles.tooltipArrow} />
              </View>
            )}
            
            <Pressable
              onPress={(event) => {
                const { locationX } = event.nativeEvent;
                const chartWidth = screenWidth + 20; // Wider chart
                const chartPadding = 50; // Account for Y-axis labels
                const usableWidth = chartWidth - chartPadding - 20; // Adjust for right padding
                const tappedX = locationX - chartPadding;

                // Calculate which of the 13 data points (0-12) is closest
                const normalizedX = Math.max(0, Math.min(tappedX / usableWidth, 1));
                const hourIndex = Math.round(normalizedX * 12); // 13 points = indices 0-12

                // Map to actual hours (every 2 hours)
                const hourMap = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
                const selectedHour = hourMap[hourIndex] ?? 0;
                const riskValue = chartDataValues[hourIndex] ?? 0;

                // Haptic feedback
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                setSelectedHourIndex(hourIndex);
                setSelectedHourData({
                  hour: selectedHour === 24 ? 0 : selectedHour,
                  risk: Math.round(riskValue),
                  label: formatHour(selectedHour),
                });
              }}
            >
              <LineChart
                data={chartData}
                width={screenWidth + 20}
                height={420}
                yAxisSuffix="%"
                yAxisInterval={1}
                fromZero={true}
                segments={5}
                bezier
                onDataPointClick={handleDataPointClick}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: '#0F172A',
                  backgroundGradientTo: '#0F172A',
                  decimalPlaces: 0,
                  color: (opacity = 1) => '#EF4444',
                  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                  fillShadowGradient: '#DC2626',
                  fillShadowGradientOpacity: 0.7,
                  fillShadowGradientFrom: '#DC2626',
                  fillShadowGradientTo: '#14B8A6',
                  paddingRight: 0,
                  style: {
                    borderRadius: 0,
                  },
                  propsForDots: {
                    r: '0',
                  },
                  propsForLabels: {
                    fontSize: 11,
                    fontWeight: '500',
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: '',
                    stroke: 'rgba(148, 163, 184, 0.08)',
                    strokeWidth: 1,
                  },
                }}
                style={styles.lineChart}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={true}
                withShadow={true}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your profile...</Text>
          </View>
        )}
        
        {/* Time Zone Legend - Compact */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#14B8A6' }]} />
            <Text style={styles.legendText}>Safe</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Caution</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Danger</Text>
          </View>
        </View>
      </View>

      {/* ===== THE INSIGHT: Dynamic Challenging Time Card ===== */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightEmoji}>🎯</Text>
          <View>
            <Text style={styles.insightTitle}>
              {selectedHourData ? 'Selected Hour' : 'High-Risk Window'}
            </Text>
            <Text style={styles.insightTime}>
              {selectedHourData 
                ? selectedHourData.label
                : peakWindow 
                  ? `${formatHour(peakWindow.startHour)} – ${formatHour(peakWindow.endHour)}`
                  : 'Analyzing...'}
            </Text>
          </View>
        </View>
        
        <View style={styles.insightBody}>
          <View style={styles.insightRisk}>
            <Text style={styles.insightRiskLabel}>Risk Level</Text>
            <Text style={[
              styles.insightRiskValue,
              { color: selectedHourData 
                  ? getRiskColor(selectedHourData.risk) 
                  : peakWindow 
                    ? getRiskColor(peakWindow.avgRisk) 
                    : '#94A3B8' }
            ]}>
              {selectedHourData 
                ? `${selectedHourData.risk}%`
                : peakWindow 
                  ? `${peakWindow.avgRisk}%` 
                  : '--'}
            </Text>
          </View>
          
          {/* Tip for this hour/window */}
          <View style={styles.insightTip}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.insightTipText}>
              {selectedHourData 
                ? getTipForHour(Math.floor(selectedHourData.hour / 4))
                : peakWindow 
                  ? "This is your most vulnerable window. Prepare accountability and distractions ahead of time."
                  : "Tap a point on the chart to get personalized tips."}
            </Text>
          </View>
        </View>
      </View>

      {/* ===== THE REWARD: Weekly Wins Card ===== */}
      <View style={styles.weeklyWinsCard}>
        <View style={styles.weeklyWinsHeader}>
          <Text style={styles.weeklyWinsEmoji}>🏆</Text>
          <Text style={styles.weeklyWinsTitle}>WEEKLY WINS</Text>
        </View>
        
        <Text style={styles.weeklyWinsCount}>{weeklyWins}</Text>
        
        <Text style={styles.weeklyWinsText}>
          {weeklyWins === 0 
            ? "Your first win is waiting. Check in during danger hours to start."
            : weeklyWins === 1
              ? "You've navigated 1 high-risk window this week!"
              : `You've navigated ${weeklyWins} high-risk windows this week!`
          }
        </Text>
        
        <Text style={styles.weeklyWinsSubtext}>
          Check-ins during danger hours (10 PM – 4 AM)
        </Text>
      </View>

      {/* ===== THE CONTEXT: Active Triggers Icons ===== */}
      {peakWindow && peakWindow.triggers.length > 0 && (
        <View style={styles.triggersSection}>
          <Text style={styles.triggersSectionTitle}>Active Triggers</Text>
          <Text style={styles.triggersSectionSubtitle}>
            These tend to show up during your vulnerable hours
          </Text>
          
          <View style={styles.triggersGrid}>
            {peakWindow.triggers.slice(0, 6).map((trigger: string) => (
              <View key={trigger} style={styles.triggerIconCard}>
                <MaterialCommunityIcons 
                  name={getTriggerIcon(trigger)} 
                  size={28} 
                  color="#F59E0B" 
                />
                <Text style={styles.triggerIconLabel}>
                  {formatTriggerName(trigger)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 60,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  
  // ===== HERO CHART STYLES (Floating - No Box) =====
  heroChartContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 0,
    marginBottom: 0,
  },
  chartTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  lineChartWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'visible',
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: -20,
  },
  lineChart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  loadingContainer: {
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  
  // Tooltip styles
  tooltip: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  tooltipText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  
  // Legend styles
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: -15,
    paddingTop: 0,
    marginBottom: 10,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    opacity: 0.7,
  },
  
  // ===== INSIGHT CARD STYLES (Optimized) =====
  insightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  insightEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  insightTitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  insightBody: {
    borderRadius: 10,
    padding: 0,
  },
  insightRisk: {
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  insightRiskLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  insightRiskValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  insightTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  insightTipText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  
  // ===== WEEKLY WINS CARD STYLES =====
  weeklyWinsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  weeklyWinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  weeklyWinsEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  weeklyWinsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#14B8A6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weeklyWinsCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  weeklyWinsText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  weeklyWinsSubtext: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // ===== TRIGGERS SECTION STYLES =====
  triggersSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  triggersSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  triggersSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  triggersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  triggerIconCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  triggerIconLabel: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 8,
    fontWeight: '500',
  },
});