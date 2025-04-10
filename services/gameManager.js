import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_CACHE_KEY = '@userHighScore';

export async function saveGameScore(userId, newScore) {
  try {
    // Check cached high score first
    const cachedScore = await AsyncStorage.getItem(HIGH_SCORE_CACHE_KEY);
    const currentHighScore = cachedScore ? parseInt(cachedScore) : 0;

    // Only update if new score is higher
    if (newScore > currentHighScore) {
      // Update local cache immediately
      await AsyncStorage.setItem(HIGH_SCORE_CACHE_KEY, String(newScore));

      // Update Firebase user document
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        highScore: newScore,
        lastPlayed: new Date()
      });

      return { success: true, newHighScore: true };
    }

    return { success: true, newHighScore: false };
  } catch (error) {
    console.error('Error saving game score:', error);
    // Still try to update local cache even if Firebase fails
    if (newScore > (await AsyncStorage.getItem(HIGH_SCORE_CACHE_KEY) || 0)) {
      await AsyncStorage.setItem(HIGH_SCORE_CACHE_KEY, String(newScore));
    }
    return { error };
  }
}

export async function getHighScore(userId) {
  try {
    // Try local cache first
    const cachedScore = await AsyncStorage.getItem(HIGH_SCORE_CACHE_KEY);
    
    // Get from Firebase only if no cache
    if (!cachedScore) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const firebaseScore = userDoc.data().highScore || 0;
        // Update cache
        await AsyncStorage.setItem(HIGH_SCORE_CACHE_KEY, String(firebaseScore));
        return firebaseScore;
      }
      return 0;
    }

    return parseInt(cachedScore);
  } catch (error) {
    console.error('Error getting high score:', error);
    // Return cached score if available, otherwise 0
    const cachedScore = await AsyncStorage.getItem(HIGH_SCORE_CACHE_KEY);
    return cachedScore ? parseInt(cachedScore) : 0;
  }
}

// Add function to sync scores (call this on app startup)
export async function syncHighScores(userId) {
  try {
    const [localScore, userDoc] = await Promise.all([
      AsyncStorage.getItem(HIGH_SCORE_CACHE_KEY),
      getDoc(doc(db, 'users', userId))
    ]);

    const firebaseScore = userDoc.exists() ? (userDoc.data().highScore || 0) : 0;
    const parsedLocalScore = localScore ? parseInt(localScore) : 0;

    // Use highest score between local and Firebase
    const highestScore = Math.max(parsedLocalScore, firebaseScore);

    // Update both if needed
    if (highestScore > firebaseScore) {
      await updateDoc(doc(db, 'users', userId), { highScore: highestScore });
    }
    if (highestScore > parsedLocalScore) {
      await AsyncStorage.setItem(HIGH_SCORE_CACHE_KEY, String(highestScore));
    }

    return highestScore;
  } catch (error) {
    console.error('Error syncing scores:', error);
    return localScore ? parseInt(localScore) : 0;
  }
}
