import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import moment from 'moment';

export default function Archive({ navigation }) {
  const [archivedChats, setArchivedChats] = useState([]);

  useEffect(() => {
    fetchArchivedChats();
  }, []);

  const fetchArchivedChats = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'userChats', user.uid, 'archived'),
      orderBy('archivedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const chats = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setArchivedChats(chats);
  };

  const handleChatPress = (chatId) => {
    console.log('Opening archived chat:', chatId); // Debug log
    navigation.navigate('Home', { 
      chatId,
      isArchived: true // Optional flag to handle archived chats differently
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => handleChatPress(item.id)}
    >
      <Ionicons name="chatbubble-outline" size={24} color="#666" />
      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle}>{item.title}</Text>
        <Text style={styles.chatDate}>
          {moment(item.archivedAt.toDate()).format('MMM D, YYYY')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Archived Chats</Text>
      <FlatList
        data={archivedChats}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>No archived chats</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatInfo: {
    marginLeft: 15,
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  chatDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
});
