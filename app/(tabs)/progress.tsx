import { SpaceBackground } from '@/components/ui/space-background';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

interface InterventionStats {
  type: string;
  count: number;
  avgReduction: number;
  totalSessions: number;
}


interface WeeklyStats {
  weekStart: string;
  avgReduction: number;
  sessions: number;
  trend?: number;
}

export default function ProgressScreen() {
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  
  const [stats, setStats] = useState({
    totalUrges: 0,
    totalLapses: 0,
    totalSafeCheckins: 0,
    totalInterventions: 0,
    avgReduction: 0,
    successRate: 0,
  });

  const [interventionStats, setInterventionStats] = useState<InterventionStats[]>([]);
  const [topHelpfulFactors, setTopHelpfulFactors] = useState<Array<{factor: string, count: number}>>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllStats();
    
    // Start animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(countAnim, {
        toValue: 100, // Normalized 0-100 for interpolation
        duration: 1500,
        useNativeDriver: false, // Text updates require JS thread potentially
      })
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllStats();
    setRefreshing(false);
  };

  const loadAllStats = async () => {
    const db = await SQLite.openDatabaseAsync('behavior.db');

    try {
      const urges = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM logs WHERE type = ?',
        ['urge']
      );

      const lapses = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM logs WHERE type = ?',
        ['lapse']
      );

      const safe = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM logs WHERE type = ?',
        ['safe']
      );

      const interventions = await db.getAllAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM urge_sessions WHERE intensity_after IS NOT NULL'
      );

      const avgReductionResult = await db.getAllAsync<{ avg: number }>(
        'SELECT AVG(reduction) as avg FROM urge_sessions WHERE reduction IS NOT NULL'
      );

      const totalUrges = urges[0]?.count || 0;
      const totalLapses = lapses[0]?.count || 0;
      const successRate = totalUrges > 0
        ? Math.round(((totalUrges - totalLapses) / totalUrges) * 100)
        : 0;

      setStats({
        totalUrges: totalUrges,
        totalLapses: totalLapses,
        totalSafeCheckins: safe[0]?.count || 0,
        totalInterventions: interventions[0]?.count || 0,
        avgReduction: Math.round(avgReductionResult[0]?.avg || 0),
        successRate: successRate,
      });

      await loadInterventionBreakdown(db);
      await loadTopHelpfulFactors(db);
      await loadWeeklyTrends(db);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadInterventionBreakdown = async (db: SQLite.SQLiteDatabase) => {
    try {
      const query = `
        SELECT 
          intervention_type, 
          COUNT(*) as count, 
          AVG(reduction) as avg_reduction 
        FROM urge_sessions 
        WHERE intervention_type IS NOT NULL 
          AND intervention_type != '' 
          AND LOWER(intervention_type) != 'unknown'
          AND reduction IS NOT NULL 
        GROUP BY intervention_type 
        HAVING COUNT(*) > 0
        ORDER BY avg_reduction DESC
      `;
      const results = await db.getAllAsync<{
        intervention_type: string;
        count: number;
        avg_reduction: number;
      }>(query);

      const interventionData: InterventionStats[] = results
        .filter(r => r.intervention_type && r.intervention_type.toLowerCase() !== 'unknown')
        .map(r => ({
          type: r.intervention_type,
          count: r.count,
          avgReduction: Math.round(r.avg_reduction || 0),
          totalSessions: r.count,
        }));

      setInterventionStats(interventionData);
    } catch (error) {
      console.error('Error loading intervention breakdown:', error);
    }
  };

  const loadTopHelpfulFactors = async (db: SQLite.SQLiteDatabase) => {
    try {
      const results = await db.getAllAsync<{ what_helped: string }>(
        'SELECT what_helped FROM urge_sessions WHERE what_helped IS NOT NULL'
      );

      const factorCounts: { [key: string]: number } = {};

      results.forEach(r => {
        try {
          const factors = JSON.parse(r.what_helped) as string[];
          factors.forEach(factor => {
            factorCounts[factor] = (factorCounts[factor] || 0) + 1;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const topFactors = Object.entries(factorCounts)
        .map(([factor, count]) => ({ factor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTopHelpfulFactors(topFactors);
    } catch (error) {
      console.error('Error loading helpful factors:', error);
    }
  };

  const loadWeeklyTrends = async (db: SQLite.SQLiteDatabase) => {
    try {
      // 4 weeks lookback
      const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);
      const query = 'SELECT CAST((start_timestamp/1000)/(7*24*60*60) AS INTEGER) as week_num, MIN(start_timestamp) as week_start_ts, AVG(reduction) as avg_reduction, COUNT(*) as count FROM urge_sessions WHERE start_timestamp > ? AND reduction IS NOT NULL GROUP BY week_num ORDER BY week_start_ts ASC';
      
      const results = await db.getAllAsync<{
        week_start_ts: number;
        avg_reduction: number;
        count: number;
      }>(query, [fourWeeksAgo]);

      const weeklyData: WeeklyStats[] = results.map((r, idx, arr) => {
        const date = new Date(r.week_start_ts);
        const prev = arr[idx-1];
        const trend = prev ? Math.round(r.avg_reduction - prev.avg_reduction) : 0;
        
        // Format: "Jan 6-12"
        const endDate = new Date(r.week_start_ts + (6 * 24 * 60 * 60 * 1000));
        const dateLabel = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}-${endDate.getDate()}`;

        return {
          weekStart: dateLabel,
          avgReduction: Math.round(r.avg_reduction || 0),
          sessions: r.count,
          trend
        };
      });

      setWeeklyTrends(weeklyData);
    } catch (error) {
      console.error('Error loading weekly trends:', error);
    }
  };


  const getInterventionName = (type: string) => {
    switch(type) {
      case 'breathing': return 'Breathing';
      case 'urge_surfing': return 'Urge Surfing';
      case 'pattern_interrupt': return 'Pattern Break';
      case 'emergency_contact': return 'Emergency Contact';
      case 'delay_distract': return 'Delay & Distract';
      case 'visualize_success': return 'Visualize Success';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const getFactorLabel = (factor: string) => {
    const labelMap: { [key: string]: string } = {
      'breathing': 'Breathing rhythm',
      'focus': 'Having focus',
      'care': 'Knowing someone cares',
      'distract': 'Taking my mind off it',
      'time': 'Just giving it time',
      'awareness': 'Becoming more aware',
      'change_environment': 'Changing environment',
      'call_friend': 'Talking to a friend',
    };
    return labelMap[factor] || factor.replace(/_/g, ' ');
  };

  const AnimatedCount = ({ value, suffix = '', style }: { value: number, suffix?: string, style?: any }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      const duration = 1500;
      const startTime = Date.now();
      
      const animate = () => {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOutQuint = 1 - Math.pow(1 - progress, 5);
        
        setDisplayValue(Math.floor(value * easeOutQuint));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [value]);

    return <Text style={[styles.heroStatValue, style]}>{displayValue}{suffix}</Text>;
  };

  // Podium Logic Construction
  const podiumData = [
    interventionStats[1] || null, // Silver (Left)
    interventionStats[0] || null, // Gold (Center)
    interventionStats[2] || null  // Bronze (Right)
  ];

  const getPodiumColor = (index: number): [string, string] => {
    if (index === 0) return ['#94A3B8', '#475569']; // Silver
    if (index === 1) return ['#FACC15', '#A16207']; // Gold
    return ['#B45309', '#78350F']; // Bronze
  };

  const getPodiumEmoji = (index: number) => {
    if (index === 0) return '🥈';
    if (index === 1) return '🥇';
    return '🥉';
  };

  const getGlassStyle = (reduction: number) => {
    const absReduction = Math.abs(reduction);
    if (absReduction >= 60) return {
      colors: ['rgba(250, 204, 21, 0.15)', 'rgba(161, 98, 7, 0.08)'] as [string, string],
      borderColor: 'rgba(250, 204, 21, 0.4)',
      iconColor: '#FACC15'
    };
    if (absReduction >= 40) return {
      colors: ['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.08)'] as [string, string],
      borderColor: 'rgba(16, 185, 129, 0.4)',
      iconColor: '#10B981'
    };
    if (absReduction >= 20) return {
      colors: ['rgba(59, 130, 246, 0.15)', 'rgba(37, 99, 235, 0.08)'] as [string, string],
      borderColor: 'rgba(59, 130, 246, 0.4)',
      iconColor: '#60A5FA'
    };
    return {
      colors: ['rgba(148, 163, 184, 0.15)', 'rgba(71, 85, 105, 0.08)'] as [string, string],
      borderColor: 'rgba(148, 163, 184, 0.4)',
      iconColor: '#94A3B8'
    };
  };

  const getBarGradient = (reduction: number): [string, string] => {
    const absReduction = Math.abs(reduction);
    if (absReduction >= 60) return ['#FACC15', '#A16207']; // Gold
    if (absReduction >= 40) return ['#10B981', '#059669']; // Green
    if (absReduction >= 20) return ['#3B82F6', '#2563EB']; // Blue
    return ['#64748B', '#475569']; // Slate
  };

  const getPodiumHeight = (index: number) => {
    if (index === 1) return 140; // Gold is tallest
    if (index === 0) return 110; // Silver
    return 90; // Bronze
  };

  const getInterventionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch(type) {
      case 'breathing': return 'leaf';
      case 'urge_surfing': return 'water';
      case 'pattern_interrupt': return 'flash';
      case 'emergency_contact': return 'call';
      case 'delay_distract': return 'time';
      case 'visualize_success': return 'eye';
      default: return 'bandage';
    }
  };

  return (
    <SpaceBackground>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
      <View style={styles.header}>
        <Text style={styles.title}>� Your Progress</Text>
        <Text style={styles.subtitle}>Insights from your journey</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        
          {/* Stats Grid */}
          <View style={styles.statsContainer}>
            {/* Row 1: Success Rate - Full Width */}
            <LinearGradient
              colors={[
                'rgba(59, 130, 246, 0.15)',  
                'rgba(37, 99, 235, 0.08)'    
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroStatCard, {
                borderColor: 'rgba(59, 130, 246, 0.4)',
                borderWidth: 2,
              }]}
            >
              <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                    <Ionicons name="trophy" size={24} color="#60A5FA" />
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                     <Ionicons name="trending-up" size={14} color="#60A5FA" />
                     <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>All Time</Text>
                  </View>
              </View>
              
              <View>
                <AnimatedCount 
                  value={stats.successRate} 
                  suffix="%" 
                  style={styles.heroStatValue}
                />
                <Text style={styles.heroStatLabel}>Success Rate</Text>
              </View>
            </LinearGradient>

            {/* Row 2: Interventions + Check-ins */}
            <View style={styles.statsRow}>
              <LinearGradient
                colors={[
                  'rgba(217, 119, 6, 0.15)',   
                  'rgba(180, 83, 9, 0.08)'     
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.halfStatCard, {
                  borderColor: 'rgba(217, 119, 6, 0.4)',
                  borderWidth: 2,
                }]}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.2)', marginBottom: 16 }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{stats.totalInterventions}</Text>
                <Text style={styles.statLabel}>Interventions</Text>
              </LinearGradient>

              <LinearGradient
                colors={[
                  'rgba(20, 184, 166, 0.15)',  
                  'rgba(13, 148, 136, 0.08)'    
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.halfStatCard, {
                  borderColor: 'rgba(20, 184, 166, 0.4)',
                  borderWidth: 2,
                }]}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(20, 184, 166, 0.2)', marginBottom: 16 }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#14B8A6" />
                </View>
                <Text style={styles.statValue}>{stats.totalSafeCheckins}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </LinearGradient>
            </View>

            {/* Row 3: Urges Logged - Full Width */}
            <LinearGradient
              colors={[
                'rgba(239, 68, 68, 0.15)',   
                'rgba(185, 28, 28, 0.08)'     
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroStatCard, {
                borderColor: 'rgba(239, 68, 68, 0.4)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                borderWidth: 2,
              }]}
            >
               <View>
                 <Text style={styles.statLabel}>Urges Logged</Text>
                 <Text style={styles.heroStatValue}>{stats.totalUrges}</Text>
               </View>
               <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)', width: 64, height: 64, borderRadius: 32 }]}>
                 <Ionicons name="alert-circle" size={32} color="#EF4444" />
               </View>
            </LinearGradient>
          </View>

          {/* TOP INTERVENTIONS PODIUM */}
          {interventionStats.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                 <Text style={{ fontSize: 24, marginRight: 8 }}>🏆</Text>
                 <View>
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Top Strategies</Text>
                    <Text style={[styles.sectionSubtitle, { marginBottom: 0 }]}>Most effective by % reduction</Text>
                 </View>
              </View>

              <View style={styles.podiumContainer}>
                {podiumData.map((item, index) => {
                  if (!item) return <View key={index} style={{ width: '30%' }} />;
                  
                  return (
                    <View key={index} style={styles.podiumColumnWrapper}>
                      {/* LABEL ABOVE */}
                      <Text style={styles.podiumLabel} numberOfLines={1}>
                        {getInterventionName(item.type)}
                      </Text>
                      <Text style={styles.podiumValue}>{Math.abs(item.avgReduction)}%</Text>

                      {/* BAR */}
                      <LinearGradient
                        colors={getPodiumColor(index)}
                        style={[styles.podiumBar, { height: getPodiumHeight(index), justifyContent: 'flex-end', paddingBottom: 8 }]}
                      >
                         <Text style={{ fontSize: 28 }}>{getPodiumEmoji(index)}</Text>
                         <Text style={styles.podiumRank}>{index === 1 ? '1st' : index === 0 ? '2nd' : '3rd'}</Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ALL INTERVENTIONS LIST */}
          <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                 <Text style={{ fontSize: 24, marginRight: 8 }}>📊</Text>
                 <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Strategy Breakdown</Text>
            </View>
            
            {interventionStats.map((stat, i) => {
              const style = getGlassStyle(stat.avgReduction);
              const absRed = Math.abs(stat.avgReduction);
              
              return (
              <LinearGradient 
                key={i} 
                colors={style.colors} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.listItem, { borderColor: style.borderColor, borderWidth: 2, flexDirection: 'row', alignItems: 'center' }]}
              >
                  {/* Icon Box */}
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 16, 
                    backgroundColor: style.borderColor.replace('0.4', '0.1'),
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 16
                  }}>
                    <Ionicons name={getInterventionIcon(stat.type)} size={24} color={style.iconColor} />
                  </View>

                  <View style={styles.listContent}>
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>{getInterventionName(stat.type)}</Text>
                      <Text style={[styles.listScore, { color: style.iconColor }]}>
                        {absRed}%
                      </Text>
                    </View>
                    
                    {/* Progress Bar Background */}
                    <View style={styles.progressBarBg}>
                      <LinearGradient
                        colors={[style.iconColor, style.iconColor]} 
                        start={{ x: 0, y: 0 }} 
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBarFill, { width: `${Math.min(absRed, 100)}%` }]} 
                      />
                    </View>
                    
                    <Text style={styles.listSubtext}>{stat.count} sessions completed</Text>
                  </View>
              </LinearGradient>
            )})}
          </View>

          {/* WEEKLY TRENDS */}
          {weeklyTrends.length > 0 && (
             <View style={styles.sectionContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                   <Text style={{ fontSize: 24, marginRight: 8 }}>📅</Text>
                   <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Weekly Trends</Text>
                </View>
                
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  {weeklyTrends.map((week, idx) => (
                    <LinearGradient
                      key={idx}
                      colors={['rgba(59, 130, 246, 0.1)', 'rgba(30, 64, 175, 0.2)']}
                      style={styles.trendCard}
                    >
                      <Text style={styles.trendDate}>{week.weekStart}</Text>
                      <Text style={styles.trendValue}>{Math.abs(week.avgReduction)}%</Text>
                      <Text style={styles.trendSub}>Avg Reduction</Text>
                      {week.trend !== 0 && (
                        <View style={[styles.trendBadge, { backgroundColor: (week.trend || 0) > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                          <MaterialCommunityIcons 
                            name={(week.trend || 0) > 0 ? "trending-up" : "trending-down"} 
                            size={16} 
                            color={(week.trend || 0) > 0 ? "#4ADE80" : "#F87171"} 
                          />
                          <Text style={{ color: (week.trend || 0) > 0 ? "#4ADE80" : "#F87171", fontSize: 12, marginLeft: 4 }}>
                            {Math.abs(week.trend || 0)}%
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  ))}
                 </ScrollView>
             </View>
          )}

        {/* WHAT HELPS MOST */}
        {topHelpfulFactors.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>✨ What Helps You Most</Text>
            {topHelpfulFactors.map((item, index) => (
               <View key={item.factor} style={styles.factorRow}>
                   <View style={styles.rankBadge}>
                       <Text style={styles.rankText}>{index + 1}</Text>
                   </View>
                   <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.factorLabel}>{getFactorLabel(item.factor)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                             <View style={[styles.progressBarBg, { flex: 1, height: 6, marginRight: 12 }]}>
                                <LinearGradient 
                                    colors={['#14B8A6', '#0F766E']}
                                    style={[styles.progressBarFill, { width: `${Math.min(item.count * 10, 100)}%` }]}
                                />
                             </View>
                             <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>×{item.count}</Text>
                        </View>
                   </View>
               </View>
            ))}
          </View>
        )}

        {/* MINDSET MESSAGE */}
        <LinearGradient
            colors={['rgba(139, 92, 246, 0.15)', 'rgba(109, 40, 217, 0.05)']}
            style={styles.mindsetCard}
        >
             <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                 <View style={styles.bulbIconContainer}>
                     <MaterialCommunityIcons name="lightbulb-on-outline" size={28} color="#A78BFA" />
                 </View>
                 <View style={{ flex: 1 }}>
                     <Text style={styles.mindsetTitle}>Progress Over Perfection</Text>
                     <Text style={styles.mindsetText}>
                        Recovery isn&apos;t linear. Every intervention you complete builds resilience. 
                        Every urge you log is data that helps you understand your patterns.
                     </Text>
                 </View>
             </View>
        </LinearGradient>

      </Animated.View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  // Cards
  statsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    minHeight: 140,
    position: 'relative',
  },
  halfStatCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    minHeight: 140,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Deprecated usage kept for now, but not used
  iconCircle: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
  },
  statIcon: {
      fontSize: 32,
      marginBottom: 8,
  },
  heroStatValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500', 
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  listItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  listContent: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  listScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  listSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  // Podium Styles
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 200,
    marginBottom: 20,
  },
  podiumColumnWrapper: {
    alignItems: 'center',
    width: '30%',
    marginHorizontal: 4,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  podiumLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
    textAlign: 'center',
  },
  podiumValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  podiumRank: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 24,
    fontWeight: '900',
  },
  // Weekly Trend
  trendCard: {
    width: 120,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  trendDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  trendSub: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
  },
  // FACTORS
  factorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
  },
  rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#334155',
      alignItems: 'center',
      justifyContent: 'center',
  },
  rankText: {
      color: '#F8FAFC',
      fontWeight: '700',
      fontSize: 14,
  },
  factorLabel: {
      color: '#E2E8F0',
      fontSize: 15,
      fontWeight: '500',
  },
    // MINDSET
  mindsetCard: {
      padding: 24,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'rgba(139, 92, 246, 0.3)',
      marginBottom: 40,
  },
  bulbIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
  },
  mindsetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#E2E8F0',
      marginBottom: 6,
  },
  mindsetText: {
      color: '#94A3B8',
      lineHeight: 22,
      fontSize: 14,
  },
});
