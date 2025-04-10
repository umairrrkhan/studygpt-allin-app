import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveManifestoItem(item) {
  const user = auth.currentUser;
  if (!user) return { error: 'Not authenticated' };

  try {
    // Save to Firebase
    const itemRef = doc(collection(db, 'users', user.uid, 'manifesto'));
    const itemWithId = { ...item, id: itemRef.id };
    await setDoc(itemRef, itemWithId);

    // Update local cache
    const cachedItems = await getManifestoItemsFromCache();
    cachedItems.push(itemWithId);
    await updateManifestoCache(cachedItems);

    return { success: true, item: itemWithId };
  } catch (error) {
    console.error('Error saving manifesto item:', error);
    return { error };
  }
}

export async function getManifestoItems() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // Try cache first
    const cachedItems = await getManifestoItemsFromCache();
    if (cachedItems) {
      return cachedItems;
    }

    // Fetch from Firebase
    const manifestoQuery = query(
      collection(db, 'users', user.uid, 'manifesto'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(manifestoQuery);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Update cache
    await updateManifestoCache(items);

    return items;
  } catch (error) {
    console.error('Error getting manifesto items:', error);
    return [];
  }
}

export async function deleteManifestoItem(itemId) {
  const user = auth.currentUser;
  if (!user) return { error: 'Not authenticated' };

  try {
    // Delete from Firebase
    const itemRef = doc(db, 'users', user.uid, 'manifesto', itemId);
    await deleteDoc(itemRef);

    // Update local cache
    const cachedItems = await getManifestoItemsFromCache() || [];
    const updatedItems = cachedItems.filter(item => item.id !== itemId);
    await updateManifestoCache(updatedItems);

    return { success: true };
  } catch (error) {
    console.error('Error deleting manifesto item:', error);
    return { error: 'Failed to delete item' };
  }
}

async function getManifestoItemsFromCache() {
  try {
    const cached = await AsyncStorage.getItem('@manifesto');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
}

async function updateManifestoCache(items) {
  try {
    await AsyncStorage.setItem('@manifesto', JSON.stringify(items));
  } catch (error) {
    console.error('Error updating manifesto cache:', error);
  }
}
