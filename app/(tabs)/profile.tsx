import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { 
  initRiskProfile, 
  calculate24HourProfile, 
  getPeakDangerWindow,
  formatHour,
  HourlyRiskProfile 
} from '../services/riskProfile';

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState<HourlyRiskProfile[]>([]);
  const [peakWindow, setPeakWindow] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    await initRiskProfile();
    const profile = await calculate24HourProfile();
    const peak = await getPeakDangerWindow();
    
    setProfileData(profile);
    setPeakWindow(peak);
  };

  // Prepare chart data (show every 2 hours)
  const chartData = {
    labels: profileData
      .filter((_, index) => index % 2 === 0)
      .map(p => formatHour(p.hour).replace(' ', '\n')),
    datasets: [{
      data: profileData
        .filter((_, index) => index % 2 === 0)
        .map(p => p.baseRisk)
    }]
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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📅 Your Risk Profile</Text>
      <Text style={styles.subtitle}>
        Based on your patterns and triggers
      </Text>

      {/* Peak Danger Window Card */}
      {peakWindow && (
        <View style={styles.peakCard}>
          <Text style={styles.peakTitle}>⚠️ Your Peak Danger Window</Text>
          <Text style={styles.peakTime}>
            {formatHour(peakWindow.startHour)} - {formatHour(peakWindow.endHour)}
          </Text>
          <Text style={styles.peakRisk}>
            Average Risk: {peakWindow.avgRisk}%
          </Text>
          {peakWindow.triggers.length > 0 && (
            <View style={styles.triggersContainer}>
              <Text style={styles.triggersLabel}>Your Active Triggers:</Text>
              {peakWindow.triggers.map((trigger: string) => (
                <Text key={trigger} style={styles.triggerTag}>
                  • {trigger}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 24-Hour Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>24-Hour Risk Map</Text>
        
        {profileData.length > 0 ? (
          <BarChart
            data={chartData}
            width={Dimensions.get('window').width - 60}
            height={220}
            yAxisLabel=""
            yAxisSuffix="%"
            fromZero={true}
            chartConfig={{
              backgroundColor: '#1E293B',
              backgroundGradientFrom: '#1E293B',
              backgroundGradientTo: '#1E293B',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(251, 146, 60, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              barPercentage: 0.7,
            }}
            style={styles.chart}
            showValuesOnTopOfBars={false}
          />
        ) : (
          <Text style={styles.noData}>Loading your profile...</Text>
        )}
      </View>

      {/* Hour-by-Hour Breakdown */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>Hour-by-Hour Breakdown</Text>
        
        {profileData.map((hour) => (
          <View key={hour.hour} style={styles.hourRow}>
            <Text style={styles.hourLabel}>{hour.label}</Text>
            
            <View style={styles.riskBarContainer}>
              <View 
                style={[
                  styles.riskBar, 
                  { 
                    width: `${hour.baseRisk}%`,
                    backgroundColor: getRiskColor(hour.baseRisk)
                  }
                ]} 
              />
            </View>
            
            <Text style={styles.hourRisk}>
              {getRiskEmoji(hour.riskLevel)} {hour.baseRisk}%
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 How to Use This</Text>
        <Text style={styles.infoText}>
          Your profile shows when YOU are most vulnerable based on your answers.
          Red zones are your danger hours - plan ahead, set reminders, or have
          accountability ready during these times.
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
    color: '#94A3B8',
    marginBottom: 24,
  },
  peakCard: {
    backgroundColor: '#7F1D1D',
    borderWidth: 2,
    borderColor: '#991B1B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  peakTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FEF2F2',
    marginBottom: 12,
  },
  peakTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  peakRisk: {
    fontSize: 16,
    color: '#FCA5A5',
    marginBottom: 16,
  },
  triggersContainer: {
    marginTop: 8,
  },
  triggersLabel: {
    fontSize: 12,
    color: '#FCA5A5',
    marginBottom: 8,
    fontWeight: '600',
  },
  triggerTag: {
    fontSize: 13,
    color: '#FEF2F2',
    marginBottom: 4,
  },
  chartContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noData: {
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 60,
  },
  breakdownContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hourLabel: {
    width: 60,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  riskBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  riskBar: {
    height: '100%',
    borderRadius: 10,
  },
  hourRisk: {
    width: 70,
    fontSize: 12,
    color: '#F1F5F9',
    textAlign: 'right',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
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