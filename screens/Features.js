import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Features({ navigation }) {
  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent} // Add this line
    >
      <Text style={styles.title}>Features</Text>
      
      <View style={styles.featuresGrid}>
        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Analytics')}
        >
          <Ionicons name="analytics-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Learning Analytics</Text>
          <Text style={styles.featureDescription}>Track your learning progress</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Projects')}
        >
          <Ionicons name="folder-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Projects</Text>
          <Text style={styles.featureDescription}>Manage your projects</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('BurnoutRelief')}
        >
          <Ionicons name="game-controller-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Burnout Relief</Text>
          <Text style={styles.featureDescription}>Take a break and relax</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Manifesto')}
        >
          <Ionicons name="book-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>My Manifesto</Text>
          <Text style={styles.featureDescription}>View your learning manifesto</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Whiteboard')}
        >
          <Ionicons name="pencil-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Whiteboard</Text>
          <Text style={styles.featureDescription}>Draw and take notes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Notes')}
        >
          <Ionicons name="document-text-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Notes</Text>
          <Text style={styles.featureDescription}>Create sticky notes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Roadmap')}
        >
          <Ionicons name="git-network-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Roadmap</Text>
          <Text style={styles.featureDescription}>Organize chats by project</Text>
        </TouchableOpacity>

        {/* Add Journal card */}
        <TouchableOpacity 
          style={styles.featureCard} 
          onPress={() => navigation.navigate('Journal')}
        >
          <Ionicons name="journal-outline" size={32} color="#007AFF" />
          <Text style={styles.featureTitle}>Daily Journal</Text>
          <Text style={styles.featureDescription}>
            Track your thoughts and progress
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {    // Add this new style
    paddingBottom: 100, // Adds space at the bottom of the scroll content
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    padding: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 0,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});
