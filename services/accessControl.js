import { db } from '../firebase';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';

export async function getSystemConfig() {
  try {
    const configDoc = await getDoc(doc(db, 'system', 'config'));
    if (configDoc.exists()) {
      return configDoc.data();
    }
    return { messageLimit: 10 }; // Default limit if not set
  } catch (error) {
    console.error('Error getting system config:', error);
    return { messageLimit: 10 }; // Fallback default
  }
}

export async function checkFreeAccess(email) {
  try {
    const freeAccessSnapshot = await getDocs(collection(db, 'freeAccess'));
    const freeEmails = freeAccessSnapshot.docs.map(doc => doc.data().email.toLowerCase());
    return freeEmails.includes(email.toLowerCase());
  } catch (error) {
    console.error('Error checking free access:', error);
    return false;
  }
}

export async function getMessageLimit() {
  try {
    const config = await getSystemConfig();
    return config.messageLimit || 10;
  } catch (error) {
    console.error('Error getting message limit:', error);
    return 10; // Default fallback
  }
}
