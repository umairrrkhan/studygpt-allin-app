import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import moment from 'moment';
import { MOODS, WEATHER } from '../../models/JournalEntry';

export default function JournalDetail({ route, navigation }) {
  const [entry, setEntry] = useState(null);
  const { entryId } = route.params;

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const entryRef = doc(db, 'users', user.uid, 'journals', entryId);
      const entrySnap = await getDoc(entryRef);

      if (entrySnap.exists()) {
        setEntry({
          id: entrySnap.id,
          ...entrySnap.data(),
          createdAt: entrySnap.data().createdAt?.toDate()
        });
      }
    } catch (error) {
      console.error('Error loading entry:', error);
      Alert.alert('Error', 'Failed to load journal entry');
    }
  };

  const handleEdit = () => {
    navigation.navigate('JournalEdit', { entryId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              await deleteDoc(doc(db, 'users', user.uid, 'journals', entryId));
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    if (!entry) return;

    try {
      const shareText = 
        `📝 ${entry.title}\n\n` +
        `${MOODS[entry.mood]?.emoji || ''} ${WEATHER[entry.weather]?.emoji || ''}\n\n` +
        `${entry.content}\n\n` +
        `📅 ${moment(entry.createdAt).format('MMMM D, YYYY')}\n` +
        `${entry.tags?.map(tag => `#${tag}`).join(' ') || ''}`;

      await Share.share({
        message: shareText
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.date}>
            {moment(entry.createdAt).format('MMMM D, YYYY')}
          </Text>
        </View>

        <View style={styles.metaInfo}>
          <Text style={styles.mood}>
            {MOODS[entry.mood]?.emoji} {MOODS[entry.mood]?.label}
          </Text>
          <Text style={styles.weather}>
            {WEATHER[entry.weather]?.emoji} {WEATHER[entry.weather]?.label}
          </Text>
        </View>

        <Text style={styles.contentText}>{entry.content}</Text>

        {entry.tags?.length > 0 && (
          <View style={styles.tagsContainer}>
            {entry.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
          <Ionicons name="pencil" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  metaInfo: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  mood: {
    fontSize: 16,
    color: '#333',
  },
  weather: {
    fontSize: 16,
    color: '#333',
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    padding: 12,
  }
});
