import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { calculateModelAccuracy } from '@/app/services/mlPredictor';
import { AccuracyBadge } from '@/components/ui/accuracy-badge';
import { SpaceBackground } from '@/components/ui/space-background';

export default function LearnScreen() {
  const [accuracy, setAccuracy] = useState<number>(58);

  useFocusEffect(
    useCallback(() => {
      calculateModelAccuracy().then(setAccuracy);
    }, [])
  );

  return (
    <SpaceBackground>
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Learn', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learn</Text>
        <Text style={styles.headerSubtitle}>Understanding your recovery tools</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section 1: How Predictions Work */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <MaterialCommunityIcons name="brain" size={24} color="#3B82F6" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Your Personal Risk Model</Text>
                <Text style={styles.cardSubtitle}>How Predictions Work</Text>
              </View>
              <AccuracyBadge accuracy={accuracy} />
            </View>
            
            <Text style={styles.cardBody}>
              Our JITAI model analyzes 5 key signals to protect you:
            </Text>
            
            <View style={styles.bulletList}>
              <BulletPoint icon="clock-outline" text="Time of day & week patterns" />
              <BulletPoint icon="emoticon-neutral-outline" text="Stress & loneliness levels" />
              <BulletPoint icon="cellphone-sound" text="Screen usage intensity" />
              <BulletPoint icon="bed-outline" text="Sleep regularity" />
              <BulletPoint icon="lightning-bolt-outline" text="Recent urge history" />
            </View>
          </LinearGradient>
        </View>

        {/* Section 2: Digital Phenotyping */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(168, 85, 247, 0.15)', 'rgba(168, 85, 247, 0.05)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                <MaterialCommunityIcons name="fingerprint" size={24} color="#A855F7" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Understanding Your Patterns</Text>
                <Text style={styles.cardSubtitle}>Digital Phenotyping</Text>
              </View>
            </View>
            
            <Text style={styles.cardBody}>
              Your phone usage leaves a "digital footprint" that can predict state of mind changes before you even realize them.
            </Text>

            <View style={styles.exampleBox}>
              <Text style={styles.exampleTitle}>Example Pattern:</Text>
              <View style={styles.exampleRow}>
                <MaterialCommunityIcons name="phone-off" size={20} color="#94A3B8" />
                <Text style={styles.exampleText}>Very late bedtime (3 AM)</Text>
              </View>
              <MaterialCommunityIcons name="arrow-down" size={20} color="#94A3B8" style={{marginLeft: 10}} />
              <View style={styles.exampleRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#F87171" />
                <Text style={[styles.exampleText, { color: '#F87171' }]}>High risk next day</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Section 3: Privacy Guarantees */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <MaterialCommunityIcons name="shield-lock" size={24} color="#10B981" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Your Data & Privacy</Text>
                <Text style={styles.cardSubtitle}>Privacy Guarantees</Text>
              </View>
            </View>
            
            <Text style={styles.cardBody}>
              This app is designed with a "Local-First" architecture. Your mental health data is sacred.
            </Text>
            
            <View style={styles.gridList}>
              <GridItem icon="database-lock" title="On-Device Only" desc="ML runs entirely on your phone." />
              <GridItem icon="cloud-off-outline" title="No Cloud Uploads" desc="We cannot see your data even if we wanted to." />
              <GridItem icon="delete-outline" title="Delete Anytime" desc="Wipe all history instantly in Settings." />
              <GridItem icon="export-variant" title="Optional Export" desc="Share anonymous data for research (opt-in only)." />
            </View>
          </LinearGradient>
        </View>

        {/* Section 4: The Science Behind JITAI */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                <MaterialCommunityIcons name="flask" size={24} color="#F59E0B" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Research-Backed Approach</Text>
                <Text style={styles.cardSubtitle}>The Science of JITAI</Text>
              </View>
            </View>
            
            <Text style={styles.cardBody}>
              <Text style={{fontWeight: 'bold', color: '#E2E8F0'}}>Just-In-Time Adaptive Interventions (JITAI)</Text> are clinically proven to reduce relapse rates by providing support exactly when needed, not just at weekly appointments.
            </Text>

            <View style={styles.comparisonTable}>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonHeader}>Standard Therapy</Text>
                <Text style={styles.comparisonHeader}>JITAI (This App)</Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonCell}>Reactive (after crisis)</Text>
                <Text style={[styles.comparisonCell, { color: '#F59E0B' }]}>Predictive (before crisis)</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonCell}>Weekly check-ins</Text>
                <Text style={[styles.comparisonCell, { color: '#F59E0B' }]}>24/7 monitoring</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonCell}>Manual tracking</Text>
                <Text style={[styles.comparisonCell, { color: '#F59E0B' }]}>Automatic patterns</Text>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonCell}>Generic advice</Text>
                <Text style={[styles.comparisonCell, { color: '#F59E0B' }]}>Personalized interventions</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </SpaceBackground>
  );
}

function BulletPoint({ icon, text }: { icon: any, text: string }) {
  return (
    <View style={styles.bulletRow}>
      <MaterialCommunityIcons name={icon} size={18} color="#94A3B8" style={{ marginRight: 10 }} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const GridItem = ({ icon, title, desc }: { icon: keyof typeof MaterialCommunityIcons.glyphMap, title: string, desc: string }) => (
  <View style={styles.gridItem}>
    <MaterialCommunityIcons name={icon} size={24} color="#10B981" style={{ marginBottom: 8 }} />
    <Text style={styles.gridTitle}>{title}</Text>
    <Text style={styles.gridDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#0a0e1a', // Deep space background
  },
  header: {
    paddingTop: 70,
    paddingHorizontal: 24,
    paddingBottom: 24,
    // backgroundColor: '#0a0e1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.5)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionContainer: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardGradient: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardBody: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletList: {
    marginTop: 4,
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletText: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  exampleBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
  },
  exampleTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  exampleText: {
    marginLeft: 8,
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  gridItem: {
    width: '48%', // roughly half
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  gridDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  comparisonTable: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  comparisonHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  comparisonCell: {
    fontSize: 13,
    color: '#E2E8F0',
    flex: 1,
  },
});
