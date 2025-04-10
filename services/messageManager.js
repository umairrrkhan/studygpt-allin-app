import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function incrementMessageCount(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const currentCount = userData.messageCount || 0;
    const messageLimit = userData.messageLimit || 100;

    if (currentCount >= messageLimit) {
      return {
        success: false,
        limitReached: true,
        remaining: 0
      };
    }

    await updateDoc(userRef, {
      messageCount: increment(1)
    });

    // Update local cache
    await AsyncStorage.setItem('@messageCount', String(currentCount + 1));

    return {
      success: true,
      limitReached: false,
      remaining: messageLimit - (currentCount + 1)
    };
  } catch (error) {
    console.error('Error incrementing message count:', error);
    return { success: false, error };
  }
}

export async function getMessageStats(userId) {
  try {
    // Try local cache first
    const cachedCount = await AsyncStorage.getItem('@messageCount');
    if (cachedCount) {
      return { messageCount: parseInt(cachedCount) };
    }

    // Fallback to Firebase
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const messageCount = userData.messageCount || 0;
    
    // Update cache
    await AsyncStorage.setItem('@messageCount', String(messageCount));
    
    return { messageCount };
  } catch (error) {
    console.error('Error getting message stats:', error);
    return { error };
  }
}
