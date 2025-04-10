import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { doc, getDoc, onSnapshot, deleteDoc, writeBatch, getDocs, collection } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import moment from 'moment';
import { getMessageLimit } from '../services/accessControl';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Settings({ navigation }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Set up real-time listener for user data
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      const userData = doc.data();
      if (userData) {
        setMessageCount(userData.messageCount || 0);
        
        const messageLimit = userData.messageLimit || MESSAGE_LIMIT;
        setSubscriptionInfo(prev => ({
          ...prev,
          messageLimit,
          messagesLeft: messageLimit - (userData.messageCount || 0),
          type: userData.hasFreePlan ? 'free' : 'paid'
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData.hasFreePlan) {
        const messageLimit = userData.messageLimit || await getMessageLimit();
        const messagesLeft = messageLimit - (userData.messageCount || 0);
        setSubscriptionInfo({
          type: 'free',
          messagesLeft,
          messageLimit,
          message: 'Free Access Member'
        });
      } else {
        const subscriptionDoc = await getDoc(doc(db, 'subscriptions', user.uid));
        const subscriptionData = subscriptionDoc.data();
        
        if (subscriptionData) {
          const endDate = subscriptionData.endDate.toDate();
          const daysLeft = moment(endDate).diff(moment(), 'days');
          
          setSubscriptionInfo({
            type: 'paid',
            endDate: endDate,
            daysLeft: daysLeft,
            status: subscriptionData.status
          });
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setIsLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      navigation.navigate('Subscription', { isRenewal: true });
    } catch (error) {
      console.error('Error renewing subscription:', error);
      Alert.alert('Error', 'Failed to initiate renewal');
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all stored data
      await AsyncStorage.clear();
      await auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              // Delete user document first
              await deleteDoc(doc(db, 'users', user.uid));

              // Delete user chats one by one to avoid batch limits
              const chatsSnapshot = await getDocs(collection(db, 'userChats', user.uid, 'chats'));
              for (const chatDoc of chatsSnapshot.docs) {
                await deleteDoc(chatDoc.ref);
              }

              // Delete archived chats
              const archivedSnapshot = await getDocs(collection(db, 'userChats', user.uid, 'archived'));
              for (const archivedDoc of archivedSnapshot.docs) {
                await deleteDoc(archivedDoc.ref);
              }

              // Delete the user chats collection
              await deleteDoc(doc(db, 'userChats', user.uid));

              // Finally delete the authentication user
              await deleteUser(user).catch(async (error) => {
                if (error.code === 'auth/requires-recent-login') {
                  await auth.signOut();
                  Alert.alert(
                    'Re-authentication Required',
                    'Please sign in again to delete your account.',
                    [{ text: 'OK' }]
                  );
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                  return;
                }
                throw error;
              });

              // If successful, sign out and navigate to login
              await auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });

            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again.'
              );
            }
          }
        }
      ]
    );
  };

  const renderSubscriptionInfo = () => {
    if (isLoading) {
      return <Text style={styles.loadingText}>Loading access info...</Text>;
    }

    if (!subscriptionInfo) return null;

    // Calculate progress percentage
    const messageLimit = subscriptionInfo.messageLimit || 100;
    const messagesUsed = messageLimit - (subscriptionInfo.messagesLeft || 0);
    const progressPercentage = Math.min((messagesUsed / messageLimit) * 100, 100);

    return (
      <View style={styles.subscriptionCard}>
        <Ionicons name="infinite" size={24} color="#007AFF" />
        <Text style={styles.subscriptionTitle}>Free Access Member</Text>
        
        <View style={styles.messageCountContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${progressPercentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.messageCountText}>
            {subscriptionInfo.messagesLeft} messages remaining
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      {renderSubscriptionInfo()}

      <TouchableOpacity 
        style={styles.option} 
        onPress={() => navigation.navigate('Archive')}
      >
        <Ionicons name="archive-outline" size={24} color="#333" />
        <Text style={styles.optionText}>Archived Chats</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#333" />
        <Text style={styles.optionText}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={24} color="#ff4444" />
        <Text style={[styles.optionText, { color: '#ff4444' }]}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    marginLeft: 8,
    fontSize: 18,
    color: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    marginLeft: 12,
    fontSize: 18,
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subscriptionSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  subscriptionDate: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  daysLeft: {
    fontSize: 15,
    color: '#4cd964',
    marginTop: 5,
    fontWeight: '600',
  },
  warningText: {
    color: '#ff9500',
  },
  renewButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  renewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  messageCountContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '90%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4cd964',
    borderRadius: 4,
  },
  progressBarWarning: {
    backgroundColor: '#ff9500',
  },
  messageCountText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 10,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  warningText: {
    marginLeft: 8,
    color: '#ff9500',
    fontSize: 14,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});
