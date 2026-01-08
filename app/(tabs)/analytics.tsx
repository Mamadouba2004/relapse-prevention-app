import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

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
}

export default function ProgressScreen() {
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
      const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);
      const query = 'SELECT CAST((start_timestamp - ?) / (7 * 24 * 60 * 60 * 1000) AS INTEGER) as week, AVG(reduction) as avg_reduction, COUNT(*) as count FROM urge_sessions WHERE start_timestamp > ? AND reduction IS NOT NULL GROUP BY week ORDER BY week ASC';
      
      const results = await db.getAllAsync<{
        week: number;
        avg_reduction: number;
        count: number;
      }>(query, [fourWeeksAgo, fourWeeksAgo]);

      const weeklyData: WeeklyStats[] = results.map((r, idx) => ({
        weekStart: 'Week ' + (idx + 1),
        avgReduction: Math.round(r.avg_reduction || 0),
        sessions: r.count,
      }));

      setWeeklyTrends(weeklyData);
    } catch (error) {
      console.error('Error loading weekly trends:', error);
    }
  };

  const getInterventionEmoji = (type: string) => {
    switch(type) {
      case 'breathing': return '🫁';
      case 'urge_surfing': return '🌊';
      case 'pattern_interrupt': return '⚡';
      case 'emergency_contact': return '📞';
      default: return '💙';
    }
  };

  const getInterventionName = (type: string) => {
    switch(type) {
      case 'breathing': return 'Breathing';
      case 'urge_surfing': return 'Urge Surfing';
      case 'pattern_interrupt': return 'Pattern Break';
      case 'emergency_contact': return 'Emergency Contact';
      default: return type;
    }
  };

  const getFactorEmoji = (factor: string) => {
    const emojiMap: { [key: string]: string } = {
      'breathing': '🫁',
      'focus': '🎯',
      'care': '💙',
      'distract': '⚡',
      'time': '⏱️',
      'awareness': '✨',
    };
    return emojiMap[factor] || '✓';
  };

  const getFactorLabel = (factor: string) => {
    const labelMap: { [key: string]: string } = {
      'breathing': 'Breathing rhythm',
      'focus': 'Having something to focus on',
      'care': 'Knowing someone cares',
      'distract': 'Taking my mind off it',
      'time': 'Just giving it time',
      'awareness': 'Becoming more aware',
    };
    return labelMap[factor] || factor;
  };

  const reductionWidth = (pct: number): { width: `${number}%` } => {
    return { width: `${pct}%` as `${number}%` };
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      <Text style={styles.title}>📊 Your Progress</Text>
      <Text style={styles.subtitle}>Pull down to refresh</Text>

      {stats.avgReduction > 0 && (
        <View style={styles.heroCard}>
          <Text style={styles.heroNumber}>{stats.avgReduction}%</Text>
          <Text style={styles.heroLabel}>Average Urge Reduction</Text>
          <Text style={styles.heroSubtext}>
            Across {stats.totalInterventions} intervention sessions
          </Text>
        </View>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalUrges}</Text>
          <Text style={styles.statLabel}>Urges Logged</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalInterventions}</Text>
          <Text style={styles.statLabel}>Interventions</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalSafeCheckins}</Text>
          <Text style={styles.statLabel}>Check-ins</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#1E3A8A' }]}>
          <Text style={styles.statNumber}>{stats.successRate}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
      </View>

      {interventionStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 What Works Best for You</Text>
          
          {interventionStats.map((intervention, index) => (
            <View key={intervention.type} style={styles.interventionRow}>
              <Text style={styles.interventionEmoji}>
                {getInterventionEmoji(intervention.type)}
              </Text>
              <View style={styles.interventionInfo}>
                <Text style={styles.interventionName}>
                  {getInterventionName(intervention.type)}
                </Text>
                <Text style={styles.interventionStats}>
                  {intervention.avgReduction}% avg reduction • {intervention.count} uses
                </Text>
              </View>
              {index === 0 && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>BEST</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {topHelpfulFactors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ What Helps You Most</Text>
          
          {topHelpfulFactors.map((factor, index) => (
            <View key={factor.factor} style={styles.factorRow}>
              <Text style={styles.factorRank}>{index + 1}</Text>
              <Text style={styles.factorEmoji}>{getFactorEmoji(factor.factor)}</Text>
              <Text style={styles.factorLabel}>{getFactorLabel(factor.factor)}</Text>
              <Text style={styles.factorCount}>×{factor.count}</Text>
            </View>
          ))}
        </View>
      )}

      {weeklyTrends.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Your Progress Over Time</Text>
          
          {weeklyTrends.map((week, index) => {
            const prevWeek = weeklyTrends[index - 1];
            const trend = prevWeek ? week.avgReduction - prevWeek.avgReduction : 0;
            
            return (
              <View key={week.weekStart} style={styles.weekRow}>
                <Text style={styles.weekLabel}>{week.weekStart}</Text>
                <View style={styles.weekBar}>
                  <View style={[styles.weekBarFill, reductionWidth(week.avgReduction)]} />
                </View>
                <Text style={styles.weekValue}>{week.avgReduction}%</Text>
                {trend !== 0 && (
                  <Text style={[styles.weekTrend, trend < 0 && { color: '#EF4444' }]}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {stats.totalInterventions === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptyText}>
            Complete your first urge → intervention → reflection cycle to see your progress here.
          </Text>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Progress Over Perfection</Text>
        <Text style={styles.infoText}>
          Recovery isn't linear. Every intervention you complete builds resilience.
          Every urge you log is data that helps you understand your patterns.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
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
    color: '#64748B',
    marginBottom: 24,
  },
  heroCard: {
    backgroundColor: '#1E3A8A',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 14,
    color: '#93C5FD',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  interventionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  interventionEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  interventionInfo: {
    flex: 1,
  },
  interventionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  interventionStats: {
    fontSize: 14,
    color: '#94A3B8',
  },
  bestBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  factorRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    width: 32,
  },
  factorEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  factorLabel: {
    flex: 1,
    fontSize: 15,
    color: '#E2E8F0',
  },
  factorCount: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekLabel: {
    fontSize: 14,
    color: '#94A3B8',
    width: 70,
  },
  weekBar: {
    flex: 1,
    height: 24,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  weekBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  weekValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    width: 50,
  },
  weekTrend: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  infoBox: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
  },
});
