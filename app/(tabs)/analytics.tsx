import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import {
    calculateRiskLevel,
    formatHour,
    getHourlyPattern,
    HourlyPattern,
    initRiskAnalysis,
    RiskAssessment
} from '../services/riskAnalysis';

export default function AnalyticsScreen() {
  const [hourlyData, setHourlyData] = useState<HourlyPattern[]>([]);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    await initRiskAnalysis();
    const pattern = await getHourlyPattern();
    const riskLevel = await calculateRiskLevel();
    
    setHourlyData(pattern);
    setRisk(riskLevel);
  };

  // Prepare chart data (show every 4 hours)
// Prepare chart data - show all 24 hours but label every 4
const chartData = {
  labels: hourlyData.map((p, index) => {
    // Only show label every 4 hours
    if (index % 4 === 0) {
      return formatHour(p.hour);
    }
    return '';
  }),
  datasets: [{
    data: hourlyData.map(p => Math.max(p.count, 0)) // Use actual counts
  }]
};
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Your Patterns</Text>

      {risk && (
        <View style={[styles.riskCard, { backgroundColor: risk.color + '20' }]}>
          <Text style={styles.riskEmoji}>{risk.emoji}</Text>
          <Text style={[styles.riskLevel, { color: risk.color }]}>
            {risk.level} RISK
          </Text>
          <Text style={styles.riskMessage}>{risk.message}</Text>
          {risk.peakHours.length > 0 && (
            <Text style={styles.peakHours}>
              Peak hours: {risk.peakHours.map(h => formatHour(h)).join(', ')}
            </Text>
          )}
        </View>
      )}

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Screen Unlocks by Hour (Last 7 Days)</Text>
        {hourlyData.length > 0 ? (
  <BarChart
    data={chartData}
    width={Dimensions.get('window').width - 60}
    height={220}
    yAxisLabel=""
    yAxisSuffix=""
    fromZero={true}
    chartConfig={{
      backgroundColor: '#1a1a1a',
      backgroundGradientFrom: '#2a2a2a',
      backgroundGradientTo: '#2a2a2a',
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(100, 149, 237, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: '#444444',
        strokeWidth: 1,
      },
      barPercentage: 0.7,
      fillShadowGradient: 'rgba(100, 149, 237, 1)',
      fillShadowGradientOpacity: 1,
    }}
    style={styles.chart}
    showValuesOnTopOfBars={true}
  />
) : (
  <Text style={styles.noData}>Not enough data yet. Keep using the app!</Text>
)}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 How This Works</Text>
        <Text style={styles.infoText}>
          Your app tracks when you unlock your phone. Late-night patterns 
          (10 PM - 4 AM) are flagged as higher risk based on research showing 
          this is when urges are strongest.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 60,
    marginBottom: 20,
  },
  riskCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  riskEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  riskLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  riskMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  peakHours: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  chart: {
  marginVertical: 8,
  borderRadius: 16,
  marginLeft: 0,
},
  noData: {
    color: '#666666',
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 22,
  },
});