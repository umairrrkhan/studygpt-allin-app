import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

export default function UserProfile({ navigation }) {
  const user = auth.currentUser;
  const [aiPersonality, setAiPersonality] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [aiBackground, setAiBackground] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const MAX_PERSONALITY_LENGTH = 1500;
  const MAX_BACKGROUND_LENGTH = 2000;
  const fadeAnim = new Animated.Value(0);
  const CACHE_DURATION = 3600000; // 1 hour in milliseconds

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: Platform.OS === 'web' ? false : true,
    }).start();
  }, []);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadCachedProfile = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('@userProfile');
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Use cache if less than 1 hour old
        if (Date.now() - timestamp < CACHE_DURATION) {
          setAiPersonality(data.aiPersonality || '');
          setAiBackground(data.aiBackground || '');
          setFullName(data.name || '');
          setLastSyncTime(timestamp);
          setIsLoading(false);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading cached profile:', error);
      return false;
    }
  };

  const loadProfile = async () => {
    const hasCachedData = await loadCachedProfile();
    
    if (!hasCachedData) {
      setIsLoading(true);
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        // Update state
        setAiPersonality(data.aiPersonality || '');
        setAiBackground(data.aiBackground || '');
        setFullName(data.name || '');

        // Cache the fresh data
        await AsyncStorage.setItem('@userProfile', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        setLastSyncTime(Date.now());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (!hasCachedData) {
        Alert.alert('Error', 'Failed to load profile data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveChanges = async () => {
    try {
      const updatedData = {
        name: fullName,
        aiPersonality,
        aiBackground,
      };

      // Update local cache immediately
      await AsyncStorage.setItem('@userProfile', JSON.stringify({
        data: updatedData,
        timestamp: Date.now()
      }));
      setLastSyncTime(Date.now());

      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), updatedData);
      
      setIsEditing(false);
      Alert.alert('Success', 'Profile settings saved!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save settings');
      
      // Reload profile on error to ensure consistency
      loadProfile();
    }
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.headerBackground} />
      <View style={styles.profileContent}>
        <View style={styles.profileIconContainer}>
          <Ionicons name="person-circle" size={60} color="#fff" />
          <Text style={styles.profileName}>{fullName || user?.displayName || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {isEditing && (
            <View style={styles.editingBadge}>
              <Text style={styles.editingBadgeText}>Editing Mode</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderPersonalityEditor = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="color-wand-outline" size={24} color="#007AFF" />
        <Text style={styles.cardTitle}>AI Personality</Text>
      </View>
      <View style={styles.backgroundHints}>
        <Text style={styles.hintsTitle}>Suggested Personality Traits:</Text>
        <Text style={styles.hintText}>• Emotional Style: friendly, empathetic, energetic, calm, patient</Text>
        <Text style={styles.hintText}>• Teaching Style: encouraging, step-by-step, uses examples</Text>
        <Text style={styles.hintText}>• Communication: formal/informal, humorous, serious, professional</Text>
        <Text style={styles.hintText}>• Role Model: yann lecun from meta , sceintist , nuclear specialist , guide, expert</Text>
        <Text style={styles.hintText}>• Special Qualities: motivating, inspiring, adaptable, creative , use scientisfic paper</Text>
        <Text style={styles.hintsExample}>Example: "Act like a friendly and patient teacher who explains complex topics with simple examples. Use an encouraging tone, add some humor, and always break down difficult concepts into easy steps. Be empathetic when I struggle and celebrate my successes."</Text>
      </View>
      <TextInput
        style={[
          styles.personalityInput,
          !isEditing && styles.personalityInputDisabled
        ]}
        value={aiPersonality}
        onChangeText={(text) => {
          if (text.length <= MAX_PERSONALITY_LENGTH) {
            setAiPersonality(text);
          }
        }}
        placeholder="Define your AI's personality, teaching style, and emotional characteristics..."
        multiline
        numberOfLines={6}
        editable={isEditing}
      />
      <Text style={styles.characterCount}>
        {aiPersonality.length}/{MAX_PERSONALITY_LENGTH}
      </Text>
    </View>
  );

  const renderBackgroundKnowledgeEditor = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="book-outline" size={24} color="#007AFF" />
        <Text style={styles.cardTitle}>AI Background Knowledge</Text>
      </View>
      <View style={styles.backgroundHints}>
        <Text style={styles.hintsTitle}>Suggested Information:</Text>
        <Text style={styles.hintText}>• Educational background and goals</Text>
        <Text style={styles.hintText}>• Learning style and preferences</Text>
        <Text style={styles.hintText}>• Interests, hobbies, and passions</Text>
        <Text style={styles.hintText}>• Career aspirations and goals</Text>
        <Text style={styles.hintText}>• Subjects you need help with</Text>
        <Text style={styles.hintText}>• Languages you're learning</Text>
        <Text style={styles.hintText}>• Special requirements or needs</Text>
      </View>
      <TextInput
        style={[
          styles.backgroundInput,
          !isEditing && styles.backgroundInputDisabled
        ]}
        value={aiBackground}
        onChangeText={(text) => {
          if (text.length <= MAX_BACKGROUND_LENGTH) {
            setAiBackground(text);
          }
        }}
        placeholder="Tell the AI about yourself, your goals, and what you want to learn..."
        multiline
        numberOfLines={8}
        editable={isEditing}
      />
      <Text style={styles.characterCount}>
        {aiBackground.length}/{MAX_BACKGROUND_LENGTH}
      </Text>
    </View>
  );

  const renderEditableFields = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="person-outline" size={24} color="#007AFF" />
        <Text style={styles.cardTitle}>Profile Information</Text>
      </View>
      <View style={styles.fieldsContainer}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={[styles.fieldInput, !isEditing && styles.fieldInputDisabled]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            editable={isEditing}
          />
        </View>
      </View>
    </View>
  );

  const renderLastSync = () => {
    if (!lastSyncTime) return null;
    
    const timeAgo = moment(lastSyncTime).fromNow();
    return (
      <View style={styles.syncInfo}>
        <Ionicons name="sync" size={12} color="#666" />
        <Text style={styles.syncText}>Last synced {timeAgo}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <>
          {renderProfileHeader()}
          <View style={styles.content}>
            {renderEditableFields()}
            {renderBackgroundKnowledgeEditor()}
            {renderPersonalityEditor()}
            {renderLastSync()}
            <TouchableOpacity 
              style={[styles.editButton, isEditing && styles.saveButton]}
              onPress={() => isEditing ? saveChanges() : setIsEditing(true)}
            >
              <Ionicons 
                name={isEditing ? "checkmark-circle" : "create"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.buttonText}>
                {isEditing ? 'Save Changes' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    height: 180, // Reduced from previous height
    position: 'relative',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: '#007AFF',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  profileContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  profileIconContainer: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  classInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classInfoText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    padding: 15,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    color: '#333',
  },
  fieldsContainer: {
    gap: 15,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 15,
  },
  field: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fieldInputDisabled: {
    backgroundColor: '#f1f3f5',
    color: '#495057',
  },
  personalityInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  personalityInputDisabled: {
    backgroundColor: '#f1f3f5',
    color: '#495057',
  },
  backgroundInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 160,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  backgroundInputDisabled: {
    backgroundColor: '#f1f3f5',
    color: '#495057',
  },
  backgroundHints: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  hintsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  hintsExample: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 10,
    paddingLeft: 8,
    paddingRight: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#007AFF',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  editButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 110,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 20,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  editingBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  editingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
  syncText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});
