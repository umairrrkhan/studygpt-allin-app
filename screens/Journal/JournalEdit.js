import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { MOODS, WEATHER } from '../../models/JournalEntry';

export default function JournalEdit({ route, navigation }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('NEUTRAL');
  const [weather, setWeather] = useState('SUNNY');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const { entryId } = route.params || {};

  useEffect(() => {
    if (entryId) {
      loadEntry();
    }
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const user = auth.currentUser;
      const entryRef = doc(db, 'users', user.uid, 'journals', entryId);
      const entrySnap = await getDoc(entryRef);

      if (entrySnap.exists()) {
        const data = entrySnap.data();
        setTitle(data.title);
        setContent(data.content);
        setMood(data.mood);
        setWeather(data.weather);
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error loading entry:', error);
      Alert.alert('Error', 'Failed to load entry');
    }
  };

  const handleSave = async () => {
    try {
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a title');
        return;
      }

      const user = auth.currentUser;
      if (!user) return;

      const entryData = {
        title: title.trim(),
        content: content.trim(),
        mood,
        weather,
        tags,
        updatedAt: serverTimestamp(),
        createdAt: entryId ? undefined : serverTimestamp()
      };

      const journalRef = collection(db, 'users', user.uid, 'journals');
      const docRef = entryId ? 
        doc(journalRef, entryId) : 
        doc(journalRef);

      await setDoc(docRef, entryData, { merge: true });
      navigation.goBack();

    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save entry');
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (tags.length >= 10) {
      Alert.alert('Limit Reached', 'Maximum 10 tags allowed');
      return;
    }
    if (tagInput.length > 20) {
      Alert.alert('Too Long', 'Tag must be 20 characters or less');
      return;
    }
    setTags([...tags, tagInput.trim()]);
    setTagInput('');
  };

  const handleRemoveTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.safeContainer}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Entry Title"
          maxLength={50}
        />

        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(MOODS).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.moodButton,
                  mood === key && styles.selectedMood
                ]}
                onPress={() => setMood(key)}
              >
                <Text style={styles.moodEmoji}>{value.emoji}</Text>
                <Text style={styles.moodLabel}>{value.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.weatherSection}>
          <Text style={styles.sectionTitle}>Weather</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(WEATHER).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.weatherButton,
                  weather === key && styles.selectedWeather
                ]}
                onPress={() => setWeather(key)}
              >
                <Text style={styles.weatherEmoji}>{value.emoji}</Text>
                <Text style={styles.weatherLabel}>{value.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TextInput
          style={styles.contentInput}
          value={content}
          onChangeText={setContent}
          placeholder="Write your thoughts..."
          multiline
          textAlignVertical="top"
        />

        <View style={styles.tagsSection}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagInput}>
            <TextInput
              style={styles.tagTextInput}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tags..."
              onSubmitEditing={handleAddTag}
            />
            <TouchableOpacity onPress={handleAddTag}>
              <Ionicons name="add-circle" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.tagList}>
            {tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(index)}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Ionicons name="save-outline" size={24} color="#fff" />
          <Text style={styles.saveButtonText}>Save Journal Entry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 300, // Increased from 200 to 300 for more space
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 80, // Increased from 50 to 80
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 24, // Increased elevation for Android
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  moodSection: {
    marginBottom: 20,
  },
  weatherSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  moodButton: {
    padding: 12,
    marginRight: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedMood: {
    backgroundColor: '#e3f2fd',
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
  },
  weatherButton: {
    padding: 12,
    marginRight: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedWeather: {
    backgroundColor: '#e3f2fd',
  },
  weatherEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  weatherLabel: {
    fontSize: 12,
  },
  contentInput: {
    height: 200,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  tagsSection: {
    marginBottom: 20,
  },
  tagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  tagTextInput: {
    flex: 1,
    marginRight: 10,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    height: 55, // Increased from 60 to 65
    marginBottom: 30, // Added margin at bottom
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18, // Increased font size
    fontWeight: '600',
    marginLeft: 12,
  },
});
