import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@roadmaps';
const CACHE_TIMESTAMP_KEY = '@roadmaps_timestamp';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Add this function for getting cache data
async function getRoadmapsFromCache() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

export async function saveRoadmap(roadmapData) {
  const user = auth.currentUser;
  if (!user) return { error: 'Not authenticated' };

  try {
    // Create roadmap under user's document
    const roadmapRef = doc(collection(db, 'users', user.uid, 'roadmaps'));
    const roadmapWithId = {
      ...roadmapData,
      id: roadmapRef.id,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visualMap: generateVisualMap(roadmapData.steps) // New visual map structure
    };

    await setDoc(roadmapRef, roadmapWithId);

    // Update cache
    const cachedRoadmaps = await getRoadmapsFromCache() || [];
    const updatedRoadmaps = [...cachedRoadmaps, roadmapWithId];
    await updateCache(updatedRoadmaps);

    return { success: true, roadmap: roadmapWithId };
  } catch (error) {
    console.error('Error saving roadmap:', error);
    return { error };
  }
}

// New visual map generator
function generateVisualMap(steps) {
  return {
    type: 'mindmap',
    nodes: steps.map((step, index) => ({
      id: `node-${index}`,
      text: step,
      level: Math.floor(index / 3), // Create hierarchy levels
      position: {
        x: index % 2 === 0 ? -200 : 200, // Alternate left/right
        y: index * 100 // Vertical spacing
      },
      connections: index > 0 ? [`node-${index-1}`] : [] // Connect to previous node
    })),
    layout: {
      direction: 'vertical',
      spacing: 60,
      padding: 20
    }
  };
}

export async function deleteRoadmap(roadmapId) {
  const user = auth.currentUser;
  if (!user) return { error: 'Not authenticated' };

  try {
    // Updated delete path
    await deleteDoc(doc(db, 'users', user.uid, 'roadmaps', roadmapId));
    
    // Update cache
    const cachedRoadmaps = await getRoadmapsFromCache() || [];
    const updatedRoadmaps = cachedRoadmaps.filter(r => r.id !== roadmapId);
    await updateCache(updatedRoadmaps);

    return { success: true };
  } catch (error) {
    console.error('Error deleting roadmap:', error);
    return { error: 'Failed to delete roadmap' };
  }
}

export async function getRoadmaps(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const { roadmaps, timestamp } = await getCacheWithTimestamp();
      const isCacheValid = timestamp && (Date.now() - timestamp < CACHE_DURATION);
      
      if (roadmaps && isCacheValid) {
        return roadmaps;
      }
    }

    // Fetch from Firebase
    const roadmapsQuery = query(
      collection(db, 'users', user.uid, 'roadmaps'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(roadmapsQuery);
    const roadmaps = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Update cache with timestamp
    await updateCache(roadmaps);

    return roadmaps;
  } catch (error) {
    console.error('Error getting roadmaps:', error);
    // Return cached data as fallback
    const { roadmaps } = await getCacheWithTimestamp();
    return roadmaps || [];
  }
}

async function getCacheWithTimestamp() {
  try {
    const [roadmapsJson, timestampStr] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEY),
      AsyncStorage.getItem(CACHE_TIMESTAMP_KEY)
    ]);

    return {
      roadmaps: roadmapsJson ? JSON.parse(roadmapsJson) : null,
      timestamp: timestampStr ? parseInt(timestampStr) : null
    };
  } catch (error) {
    return { roadmaps: null, timestamp: null };
  }
}

async function updateCache(roadmaps) {
  try {
    await Promise.all([
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(roadmaps)),
      AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
    ]);
  } catch (error) {
    console.error('Error updating cache:', error);
  }
}
