import { collection, query, where, getDocs, orderBy, Timestamp, collectionGroup, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AnalyticsCache } from './cacheService';

const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

export const getAnalyticsData = async (days) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    // Try to get cached data first
    const cacheKey = `${userId}_${days}`;
    const cachedData = await AnalyticsCache.get(cacheKey);
    if (cachedData) return cachedData;

    // If no cache, load data in parallel
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [messages, archivedMessages] = await Promise.all([
      getMessagesInBatches(userId, startDate, endDate).catch(err => {
        console.error('Error fetching regular messages:', err);
        return [];
      }),
      getArchivedMessagesInBatches(userId, startDate, endDate).catch(err => {
        console.error('Error fetching archived messages:', err);
        return [];
      })
    ]);

    const allMessages = [...messages, ...archivedMessages];

    const analyticsData = {
      dailyActivity: processHeatmapData(allMessages, days),
      timeDistribution: processTimeDistribution(allMessages),
      subjectDistribution: processSubjectDistribution(allMessages),
      totalInteractions: allMessages.length
    };

    // Cache the results
    await AnalyticsCache.set(cacheKey, analyticsData);

    return analyticsData;
  } catch (error) {
    console.error('Analytics error:', error);
    throw new Error('Failed to load analytics data: ' + error.message);
  }
};

const getMessagesInBatches = async (userId, startDate, endDate, batchSize = 500) => {
  const messages = [];
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const chatQuery = query(
    collection(db, 'users', userId, 'chats'),
    limit(batchSize)
  );

  const chatSnapshot = await getDocs(chatQuery);
  const chatPromises = chatSnapshot.docs.map(async (chatDoc) => {
    const messagesQuery = query(
      collection(db, 'users', userId, 'chats', chatDoc.id, 'messages'),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc'),
      limit(batchSize)
    );

    const messageSnapshot = await getDocs(messagesQuery);
    return messageSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  });

  const messageArrays = await Promise.all(chatPromises);
  return messageArrays.flat();
};

const getArchivedMessagesInBatches = async (userId, startDate, endDate, batchSize = 500) => {
  const messages = [];
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  // First get all archived chats
  const archivedChatsQuery = query(
    collection(db, 'users', userId, 'archived'),
    limit(batchSize)
  );

  const archivedChatsSnapshot = await getDocs(archivedChatsQuery);
  const chatPromises = archivedChatsSnapshot.docs.map(async (chatDoc) => {
    const messagesQuery = query(
      collection(db, 'users', userId, 'archived', chatDoc.id, 'messages'),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc'),
      limit(batchSize)
    );

    const messageSnapshot = await getDocs(messagesQuery);
    return messageSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  });

  const messageArrays = await Promise.all(chatPromises);
  return messageArrays.flat();
};

const createEmptyHeatmapData = (days) => {
  const weeks = Math.ceil(days / 7);
  return Array(weeks).fill().map(() => 
    Array(7).fill().map(() => ({ count: 0 }))
  );
};

const processHeatmapData = (messages, days) => {
  const weeks = Math.ceil(days / 7);
  const heatmapData = [];
  const today = new Date();

  // Initialize the data structure for weeks
  for (let w = 0; w < weeks; w++) {
    const week = Array(7).fill().map(() => ({ count: 0 }));
    heatmapData.push(week);
  }

  // Fill in the message counts
  messages.forEach(message => {
    const messageDate = message.timestamp.toDate();
    const dayDiff = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
    if (dayDiff < days) {
      const weekIndex = Math.floor(dayDiff / 7);
      const dayIndex = messageDate.getDay();
      if (heatmapData[weekIndex]) {
        heatmapData[weekIndex][dayIndex].count++;
      }
    }
  });

  return heatmapData;
};

const processTimeDistribution = (messages) => {
  const distribution = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0
  };

  messages.forEach(message => {
    const hour = message.timestamp.toDate().getHours();
    if (hour >= 5 && hour < 12) distribution.morning++;
    else if (hour >= 12 && hour < 17) distribution.afternoon++;
    else if (hour >= 17 && hour < 22) distribution.evening++;
    else distribution.night++;
  });

  return distribution;
};

const processSubjectDistribution = (messages) => {
  const distribution = {};
  
  messages.forEach(message => {
    const subject = message.subject || 'general';
    distribution[subject] = (distribution[subject] || 0) + 1;
  });

  return distribution;
};
