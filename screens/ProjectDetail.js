import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import moment from 'moment';

export default function ProjectDetail({ route, navigation }) {
  const [projectChats, setProjectChats] = useState([]);
  const { projectId } = route.params;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Use onSnapshot for real-time updates, just like Archive
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, where('projectId', '==', projectId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjectChats(chats);
    }, (error) => {
      console.error('Project chats listener error:', error);
      Alert.alert('Error', 'Failed to load project chats');
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleChatPress = (chat) => {
    navigation.navigate('Home', { chatId: chat.id });
  };

  const renderChat = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
    >
      <View style={styles.chatIcon}>
        <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle}>{item.title || 'Untitled Chat'}</Text>
        <Text style={styles.timestamp}>
          {moment(item.createdAt?.toDate()).format('MMM D, YYYY')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {projectChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No chats in this project</Text>
        </View>
      ) : (
        <FlatList
          data={projectChats}
          renderItem={renderChat}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 10,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  }
});
