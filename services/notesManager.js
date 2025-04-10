import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes

export async function saveNote(userId, note) {
  try {
    // Save to Firebase
    const noteRef = doc(collection(db, 'users', userId, 'notes'));
    await setDoc(noteRef, {
      ...note,
      id: noteRef.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update local cache
    const cachedNotes = await getNotesCached(userId);
    cachedNotes.push({ ...note, id: noteRef.id });
    await updateNotesCache(userId, cachedNotes);

    return { success: true, noteId: noteRef.id };
  } catch (error) {
    console.error('Error saving note:', error);
    return { error };
  }
}

export async function getNotes(userId) {
  try {
    // Try cache first
    const cachedNotes = await getNotesCached(userId);
    if (cachedNotes) {
      return cachedNotes;
    }

    // Fallback to Firebase
    const notesQuery = query(
      collection(db, 'users', userId, 'notes'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(notesQuery);
    const notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Update cache
    await updateNotesCache(userId, notes);

    return notes;
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
}

async function getNotesCached(userId) {
  try {
    const cacheData = await AsyncStorage.getItem(`@notes_${userId}`);
    if (!cacheData) return null;

    const { notes, timestamp } = JSON.parse(cacheData);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      return null;
    }

    return notes;
  } catch (error) {
    return null;
  }
}

async function updateNotesCache(userId, notes) {
  try {
    await AsyncStorage.setItem(`@notes_${userId}`, JSON.stringify({
      notes,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error updating notes cache:', error);
  }
}

export async function deleteNote(userId, noteId) {
  try {
    // Delete from Firebase
    await deleteDoc(doc(db, 'users', userId, 'notes', noteId));

    // Update local cache
    const cachedNotes = await getNotesCached(userId);
    if (cachedNotes) {
      const updatedNotes = cachedNotes.filter(note => note.id !== noteId);
      await updateNotesCache(userId, updatedNotes);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { error };
  }
}
