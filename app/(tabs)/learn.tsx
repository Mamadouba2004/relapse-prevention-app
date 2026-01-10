import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '@/constants/theme';

export default function LearnScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Learn', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learn</Text>
        <Text style={styles.headerSubtitle}>Understanding your recovery tools</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <LearnCard 
          icon="brain"
          title="How Predictions Work"
          description="Our JITAI model analyzes patterns in your check-ins and screen time to predict high-risk windows before they happen."
        />
        
        <LearnCard 
          icon="cellphone-information"
          title="Digital Phenotyping"
          description="Your phone's usage patterns (typing speed, screen activity) can indicate stress levels without you typing a word."
        />
        
        <LearnCard 
          icon="shield-check"
          title="Privacy Guarantees"
          description="All analysis happens directly on your device. Your personal data never leaves this phone."
        />
        
        <LearnCard 
          icon="flask"
          title="JITAI Research"
          description="Just-in-Time Adaptive Interventions are clinically proven to reduce relapse rates by providing support exactly when needed."
        />
      </ScrollView>
    </View>
  );
}

function LearnCard({ icon, title, description }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; description: string }) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a', // Deep space background
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Space for bottom nav
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(91, 124, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
});
