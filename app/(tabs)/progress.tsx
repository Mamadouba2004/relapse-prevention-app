import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ContributionGraph } from 'react-native-chart-kit';

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

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const [commitData, setCommitData] = useState<{ date: string; count: number }[]>([]);
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
      await loadCommitHistory(db);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadInterventionBreakdown = async (db: SQLite.SQLiteDatabase) => {
    try {
      const query = 'SELECT intervention_type, COUNT(*) as count, AVG(reduction) as avg_reduction FROM urge_sessions WHERE intervention_type IS NOT NULL AND reduction IS NOT NULL GROUP BY intervention_type ORDER BY avg_reduction DESC';
      const results = await db.getAllAsync<{
        intervention_type: string;
        count: number;
        avg_reduction: number;
      }>(query);

      const interventionData: InterventionStats[] = results.map(r => ({
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

  const loadCommitHistory = async (db: SQLite.SQLiteDatabase) => {
    try {
      // Get all logs (urges, lapses, safe)
      // Group by YYYY-MM-DD
      const query = `
        SELECT 
          strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch', 'localtime')) as date,
          COUNT(*) as count
        FROM logs
        GROUP BY date
      `;
      const results = await db.getAllAsync<{ date: string; count: number }>(query);
      setCommitData(results);
    } catch (e) {
      console.error("Error loading history", e);
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

  const AnimatedCount = ({ value, suffix = '' }: { value: number, suffix?: string }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      let start = 0;
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

    return <Text style={styles.heroNumber}>{displayValue}{suffix}</Text>;
  };

  // Podium Logic
  const podium = [
    interventionStats[1], // 2nd (Left)
    interventionStats[0], // 1st (Middle)
    interventionStats[2]  // 3rd (Right)
  ].filter(Boolean);

  return (
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
        
        {/* HERO METRIC */}
        {stats.totalInterventions > 0 ? (
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <AnimatedCount value={stats.avgReduction} suffix="%" />
            <Text style={[styles.heroTextGlow, { position: 'absolute', top: 32, opacity: 0.3 }]}>
              {stats.avgReduction}%
            </Text>
            <Text style={styles.heroLabel}>Average Urge Reduction</Text>
            <Text style={styles.heroSubtext}>
              Across {stats.totalInterventions} intervention sessions
            </Text>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['rgba(20, 184, 166, 0.15)', 'rgba(13, 148, 136, 0.05)']}
            style={styles.heroCard}
          >
            <Text style={{ fontSize: 64, marginBottom: 10 }}>🌱</Text>
            <Text style={styles.heroLabel}>Your Journey Starts Here</Text>
            <Text style={styles.heroSubtext}>Complete your first check-in to track progress.</Text>
          </LinearGradient>
        )}

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          {/* Urges Card */}
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.15)', 'rgba(185, 28, 28, 0.05)']}
            style={[styles.statCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
          >
            <View style={styles.statHeader}>
              <Text style={styles.statIcon}>📝</Text>
              <Text style={styles.statNumberSmart}>{stats.totalUrges}</Text>
            </View>
            <Text style={styles.statLabel}>Urges Logged</Text>
          </LinearGradient>

          {/* Interventions Card */}
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.15)', 'rgba(217, 119, 6, 0.05)']}
            style={[styles.statCard, { borderColor: 'rgba(251, 191, 36, 0.3)' }]}
          >
            <View style={styles.statHeader}>
              <Text style={styles.statIcon}>🎯</Text>
              <Text style={styles.statNumberSmart}>{stats.totalInterventions}</Text>
            </View>
            <Text style={styles.statLabel}>Interventions</Text>
          </LinearGradient>

          {/* Check-ins Card */}
          <LinearGradient
            colors={['rgba(20, 184, 166, 0.15)', 'rgba(13, 148, 136, 0.05)']}
            style={[styles.statCard, { borderColor: 'rgba(20, 184, 166, 0.3)' }]}
          >
            <View style={styles.statHeader}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statNumberSmart}>{stats.totalSafeCheckins}</Text>
            </View>
            <Text style={styles.statLabel}>Check-ins</Text>
          </LinearGradient>

           {/* Success Rate Card */}
           <LinearGradient
            colors={['rgba(59, 130, 246, 0.25)', 'rgba(37, 99, 235, 0.15)']}
            style={[styles.statCard, { borderColor: 'rgba(59, 130, 246, 0.5)', minWidth: '45%' }]}
          >
            <View style={styles.statHeader}>
              <Text style={styles.statIcon}>🏆</Text>
              <Text style={[styles.statNumberSmart, { color: '#60A5FA' }]}>{stats.successRate}%</Text>
            </View>
            <Text style={styles.statLabel}>Success Rate</Text>
          </LinearGradient>
        </View>

        {/* DAILY CONSISTENCY (CONTRIBUTION GRAPH) */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Daily Activity</Text>
            <View style={{ alignItems: 'center', marginLeft: -16 }}>
               <ContributionGraph
                  values={commitData}
                  endDate={new Date()}
                  numDays={90}
                  width={SCREEN_WIDTH - 30}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#1E293B',
                    backgroundGradientFrom: '#1E293B',
                    backgroundGradientTo: '#1E293B',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                    style: {
                      borderRadius: 16
                    },
                    propsForDots: {
                        r: "2",
                        strokeWidth: "0"
                    }
                  }}
                  tooltipDataAttrs={(value) => ({
                      'aria-label': `${value.date}: ${value.count} entries`
                  })}
                />
            </View>
        </View>

        {/* PODIUM SECTION */}
        {interventionStats.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 What Works Best for You</Text>
            
            {/* Podium Visual */}
            <View style={styles.podiumContainer}>
              {/* 2nd Place */}
              {podium[0] && (
                <View style={[styles.podiumColumn, { height: 120 }]}>
                    <Text style={styles.medal}>🥈</Text>
                    <View style={[styles.podiumBar, { height: 60, backgroundColor: 'rgba(148, 163, 184, 0.3)' }]}>
                        <Text style={styles.podiumRank}>2nd</Text>
                    </View>
                     <Text style={styles.podiumLabel} numberOfLines={2}>
                        {getInterventionName(podium[0].type)}
                    </Text>
                     <Text style={styles.podiumValue}>{podium[0].avgReduction}%</Text>
                </View>
              )}
              
              {/* 1st Place */}
              {podium[1] && (
                 <View style={[styles.podiumColumn, { height: 150 }]}>
                    <Text style={[styles.medal, { fontSize: 48 }]}>🥇</Text>
                    <View style={[styles.podiumBar, { height: 90, backgroundColor: 'rgba(251, 191, 36, 0.3)' }]}>
                        <Text style={[styles.podiumRank, { color: '#FCD34D' }]}>1st</Text>
                    </View>
                     <Text style={[styles.podiumLabel, { color: '#FCD34D', fontWeight: '800' }]} numberOfLines={2}>
                        {getInterventionName(podium[1].type)}
                    </Text>
                     <Text style={[styles.podiumValue, { fontSize: 16 }]}>{podium[1].avgReduction}%</Text>
                </View>
              )}

              {/* 3rd Place */}
              {podium[2] && (
                 <View style={[styles.podiumColumn, { height: 100 }]}>
                    <Text style={styles.medal}>🥉</Text>
                    <View style={[styles.podiumBar, { height: 40, backgroundColor: 'rgba(180, 83, 9, 0.3)' }]}>
                         <Text style={styles.podiumRank}>3rd</Text>
                    </View>
                     <Text style={styles.podiumLabel} numberOfLines={2}>
                        {getInterventionName(podium[2].type)}
                    </Text>
                     <Text style={styles.podiumValue}>{podium[2].avgReduction}%</Text>
                </View>
              )}
            </View>

            {/* List View Details */}
            <View style={{ marginTop: 20 }}>
                <Text style={styles.subsectionTitle}>ALL INTERVENTIONS</Text>
                {interventionStats.map((item, index) => (
                    <View key={item.type} style={styles.listRow}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={styles.listLabel}>{getInterventionName(item.type)}</Text>
                                 <Text style={styles.listValue}>{item.avgReduction}% avg</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <LinearGradient 
                                    colors={index === 0 ? ['#FBBF24', '#D97706'] : ['#3B82F6', '#2563EB']}
                                    start={{x:0, y:0}} end={{x:1, y:0}}
                                    style={[styles.progressBarFill, { width: `${Math.min(item.avgReduction * 10, 100)}%` }]}
                                />
                            </View>
                            <Text style={styles.listSubtext}>{item.count} uses • {index < 3 ? ['🥇','🥈','🥉'][index] : ''}</Text>
                        </View>
                    </View>
                ))}
            </View>
          </View>
        ) : (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 What Works Best</Text>
                <View style={styles.emptyStateMini}>
                    <Text style={{ fontSize: 32 }}>📊</Text>
                    <Text style={styles.emptyTextMini}>Intervention effectiveness data will appear here.</Text>
                </View>
            </View>
        )}

        {/* WHAT HELPS MOST */}
        {topHelpfulFactors.length > 0 && (
          <View style={styles.section}>
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

        {/* WEEKLY TRENDS */}
        {weeklyTrends.length > 0 && (
             <View style={styles.section}>
                <Text style={styles.sectionTitle}>� Your Progress Over Time</Text>
                {weeklyTrends.map((week, index) => (
                    <View key={index} style={styles.weekRow}>
                        <Text style={styles.weekLabel}>{week.weekStart}</Text>
                        <View style={styles.weekBarContainer}>
                            <LinearGradient
                                colors={['#3B82F6', '#14B8A6']}
                                start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                                style={[styles.weekBarFill, { width: `${Math.min(week.avgReduction * 10, 100)}%` }]} 
                            />
                        </View>
                        <Text style={styles.weekValue}>{week.avgReduction}%</Text>
                        {!!week.trend && week.trend !== 0 && (
                             <Text style={[styles.trendArrow, { color: week.trend > 0 ? '#10B981' : '#EF4444' }]}>
                                 {week.trend > 0 ? '↑' : '↓'} {Math.abs(week.trend)}%
                             </Text>
                        )}
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
                        Recovery isn't linear. Every intervention you complete builds resilience. 
                        Every urge you log is data that helps you understand your patterns.
                     </Text>
                 </View>
             </View>
        </LinearGradient>

      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 24,
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
  },
  
  // HERO
  heroCard: {
    padding: 32,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  heroNumber: {
    fontSize: 96,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(59, 130, 246, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    lineHeight: 100,
  },
  heroTextGlow: {
    fontSize: 96,
    fontWeight: '800',
    color: '#3B82F6',
    position: 'absolute',
    top: 32,
  },
  heroLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 8,
    marginBottom: 4,
  },
  heroSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },

  // STATS GRID
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    width: '48%', // Approx half
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statIcon: {
    fontSize: 24, 
  },
  statNumberSmart: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // SECTIONS
  section: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 12,
  },
  
  // PODIUM
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 180,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 20,
  },
  podiumColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '30%',
    marginHorizontal: 4,
  },
  medal: {
    fontSize: 32,
    marginBottom: 8,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podiumRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  podiumLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 2,
  },
  podiumValue: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // LIST ROWS
  listRow: {
      marginBottom: 16,
  },
  listLabel: {
      color: '#E2E8F0',
      fontWeight: '600',
      fontSize: 15,
  },
  listValue: {
      color: '#94A3B8',
      fontSize: 14,
  },
  listSubtext: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 4,
  },
  progressBarBg: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 4,
      overflow: 'hidden',
  },
  progressBarFill: {
      height: '100%',
      borderRadius: 4,
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

  // WEEKLY
  weekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
  },
  weekLabel: {
      width: 80,
      color: '#94A3B8',
      fontSize: 13,
  },
  weekBarContainer: {
      flex: 1,
      height: 12,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 6,
      marginHorizontal: 12,
      overflow: 'hidden',
  },
  weekBarFill: {
      height: '100%',
      borderRadius: 6,
  },
  weekValue: {
      width: 40,
      color: '#E2E8F0',
      fontWeight: '700',
      fontSize: 14,
      textAlign: 'right',
  },
  trendArrow: {
      width: 50,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'right',
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

  // EMPTY STATES
  emptyStateMini: {
      alignItems: 'center',
      padding: 20,
      opacity: 0.7,
  },
  emptyTextMini: {
      color: '#64748B',
      marginTop: 8,
      textAlign: 'center',
  },
});
