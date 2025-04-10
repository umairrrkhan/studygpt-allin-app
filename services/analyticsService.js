import { auth, db } from '../firebase';
import { collection, addDoc, doc, setDoc, increment, updateDoc, query, where, getDocs, orderBy, collectionGroup, serverTimestamp, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { cacheService } from './cacheService';

const SUBJECT_KEYWORDS = {
  mathematics: [
    'math', 'algebra', 'geometry', 'calculus', 'equation', 'trigonometry',
    'statistics', 'arithmetic', 'logarithm', 'matrix', 'polynomial',
    'fraction', 'decimal', 'probability', 'function', 'graph'
  ],
  physics: [
    'physics', 'force', 'energy', 'motion', 'quantum', 'mechanics',
    'gravity', 'electricity', 'magnetism', 'optics', 'thermodynamics',
    'velocity', 'acceleration', 'momentum', 'wave', 'particle'
  ],
  chemistry: [
    'chemistry', 'molecule', 'reaction', 'compound', 'element', 'acid',
    'base', 'atom', 'periodic table', 'organic', 'inorganic', 'solution',
    'bond', 'electron', 'proton', 'neutron', 'catalyst'
  ],
  biology: [
    'biology', 'cell', 'organism', 'dna', 'evolution', 'ecology',
    'genetics', 'protein', 'enzyme', 'chromosome', 'species',
    'photosynthesis', 'respiration', 'ecosystem', 'anatomy'
  ],
  computer_science: [
    'programming', 'code', 'algorithm', 'software', 'database', 'computer',
    'javascript', 'python', 'java', 'html', 'css', 'react', 'api',
    'framework', 'backend', 'frontend', 'web development', 'app development',
    'data structure', 'debugging'
  ],
  ai_ml: [
    'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
    'ai', 'ml', 'nlp', 'computer vision', 'tensorflow', 'pytorch',
    'data science', 'big data', 'clustering', 'classification'
  ],
  engineering: [
    'engineering', 'mechanical', 'electrical', 'civil', 'robotics',
    'circuit', 'design', 'construction', 'manufacturing', 'automation',
    'control system', 'cad', 'material science'
  ]
};

const ANALYTICS_CACHE_KEY = '@analytics_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const detectSubjects = (text) => {
  const detectedSubjects = new Map(); // Use Map to store subject counts
  const lowercaseText = text.toLowerCase();
  const words = lowercaseText.split(/\s+/); // Split text into words

  Object.entries(SUBJECT_KEYWORDS).forEach(([subject, keywords]) => {
    let subjectCount = 0;
    
    keywords.forEach(keyword => {
      // Check for exact word matches or phrases
      if (keyword.includes(' ')) {
        // For multi-word keywords (phrases)
        if (lowercaseText.includes(keyword)) {
          subjectCount += 2; // Give more weight to phrase matches
        }
      } else {
        // For single word keywords
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowercaseText.match(keywordRegex);
        if (matches) {
          subjectCount += matches.length;
        }
      }
    });

    if (subjectCount > 0) {
      detectedSubjects.set(subject, subjectCount);
    }
  });

  // Convert Map to array of objects with normalized scores
  const maxCount = Math.max(...detectedSubjects.values());
  return Array.from(detectedSubjects.entries()).map(([subject, count]) => ({
    subject,
    count: Math.round((count / maxCount) * 100) // Normalize to 0-100 scale
  }));
};

export const initializeAnalytics = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const analyticRef = doc(db, 'users', user.uid, 'analytics', 'summary');
    await setDoc(analyticRef, {
      createdAt: serverTimestamp(),
      totalInteractions: 0
    }, { merge: true });

  } catch (error) {
    console.error('Error initializing analytics:', error);
  }
};

export const trackInteraction = async (userMessage, aiResponse) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Store interaction in user's subcollection
    const interactionRef = doc(collection(db, 'users', user.uid, 'interactions'));
    await setDoc(interactionRef, {
      userMessage,
      aiResponse,
      timestamp: serverTimestamp(),
      userId: user.uid
    });

    // Update analytics summary
    const analyticRef = doc(db, 'users', user.uid, 'analytics', 'summary');
    await setDoc(analyticRef, {
      lastInteraction: serverTimestamp(),
      totalInteractions: increment(1)
    }, { merge: true });

  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
};

export const calculateEngagementScore = (interactions) => {
  if (!interactions.length) return 0;

  const totalInteractions = interactions.length;
  const uniqueSubjects = new Set(interactions.flatMap(i => i.subjects)).size;
  const recentActivity = interactions
    .filter(i => i.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .length;

  return Math.min(
    100,
    (totalInteractions * 0.4) + (uniqueSubjects * 15) + (recentActivity * 5)
  );
};

export const getHistoricalAnalytics = async (timeRange = 30) => {
  try {
    // Try cached data first
    const cachedData = await getCachedAnalytics();
    if (cachedData) {
      return cachedData;
    }

    // If no cache, fetch from Firebase
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    // Fetch chats
    const chatsQuery = query(
      collection(db, 'userChats', userId, 'chats')
    );
    const chatsSnapshot = await getDocs(chatsQuery);
    const chatIds = chatsSnapshot.docs.map(doc => doc.id);

    // Fetch messages from all chats
    const allMessages = await Promise.all(chatIds.map(async (chatId) => {
      const messagesQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('timestamp', '>=', startDate),
        orderBy('timestamp', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      return messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        chatId,
        id: doc.id
      }));
    }));

    // Process and cache the data
    const analytics = processMessagesForAnalytics(allMessages.flat());
    await cacheAnalytics(analytics);
    return analytics;

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return await getCachedAnalytics(true) || {
      subjectDistribution: {},
      timeDistribution: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      totalInteractions: 0
    };
  }
};

const getCachedAnalytics = async (ignoreExpiry = false) => {
  try {
    const cached = await AsyncStorage.getItem(ANALYTICS_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

    if (isExpired && !ignoreExpiry) return null;
    return data;
  } catch (error) {
    console.error('Error reading cached analytics:', error);
    return null;
  }
};

const cacheAnalytics = async (data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching analytics:', error);
  }
};

const processMessagesForAnalytics = (messages) => {
  const analytics = {
    subjectDistribution: {},
    dailyInteractions: {},
    topics: {},
    chatSessions: [],
    totalInteractions: 0,
    averageResponseLength: 0,
    commonQueries: {},
    timeDistribution: {
      morning: 0,   // 6-12
      afternoon: 0, // 12-17
      evening: 0,   // 17-22
      night: 0      // 22-6
    }
  };

  let totalResponseLength = 0;
  let responseCount = 0;

  // Track subjects across all messages
  const subjectCounts = new Map();

  messages.forEach(message => {
    const timestamp = message.timestamp.toDate();
    const dateKey = timestamp.toISOString().split('T')[0];
    const hour = timestamp.getHours();

    // Count daily interactions
    analytics.dailyInteractions[dateKey] = (analytics.dailyInteractions[dateKey] || 0) + 1;

    // Detect subjects from message content
    if (message.text) {
      const detectedSubjects = detectSubjects(message.text);
      detectedSubjects.forEach(({ subject, count }) => {
        subjectCounts.set(
          subject, 
          (subjectCounts.get(subject) || 0) + count
        );
      });

      // Track response lengths for AI messages
      if (message.sender === 'ai') {
        totalResponseLength += message.text.length;
        responseCount++;
      }

      // Track time distribution
      if (hour >= 6 && hour < 12) analytics.timeDistribution.morning++;
      else if (hour >= 12 && hour < 17) analytics.timeDistribution.afternoon++;
      else if (hour >= 17 && hour < 22) analytics.timeDistribution.evening++;
      else analytics.timeDistribution.night++;

      // Track common queries (for user messages)
      if (message.sender === 'user') {
        const words = message.text.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 3) { // Ignore short words
            analytics.commonQueries[word] = (analytics.commonQueries[word] || 0) + 1;
          }
        });
      }
    }
  });

  // Calculate averages and totals
  analytics.totalInteractions = messages.length;
  analytics.averageResponseLength = responseCount > 0 ? Math.round(totalResponseLength / responseCount) : 0;

  // Sort and limit common queries
  analytics.commonQueries = Object.entries(analytics.commonQueries)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

  // Normalize subject counts to percentages
  const totalSubjectPoints = Array.from(subjectCounts.values())
    .reduce((sum, count) => sum + count, 0);

  analytics.subjectDistribution = Object.fromEntries(
    Array.from(subjectCounts.entries())
      .map(([subject, count]) => [
        subject,
        Math.round((count / totalSubjectPoints) * 100)
      ])
      .sort((a, b) => b[1] - a[1]) // Sort by percentage in descending order
  );

  return analytics;
};

const ANALYTICS_CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export const analyticsService = {
  async getChatsAnalytics(timeRange = 30) {
    const user = auth.currentUser;
    if (!user) return null;

    // Try cache first
    const cacheKey = `${ANALYTICS_CACHE_KEY}${user.uid}_${timeRange}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return cachedData;

    try {
      // Get chat data for the time range
      const startDate = moment().subtract(timeRange, 'days').toDate();
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const chatsQuery = query(
        chatsRef,
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc')
      );

      const chatsSnapshot = await getDocs(chatsQuery);
      const chats = chatsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Process analytics data
      const analytics = {
        messageCount: 0,
        dailyActivity: this.processDailyActivity(chats),
        timeDistribution: this.processTimeDistribution(chats),
        subjectDistribution: await this.processSubjects(chats, user.uid),
        interactionTrends: this.processInteractionTrends(chats),
        totalInteractions: chats.length
      };

      // Cache the results
      await cacheService.set(cacheKey, analytics, ANALYTICS_CACHE_DURATION);

      return analytics;
    } catch (error) {
      console.error('Analytics processing error:', error);
      return null;
    }
  },

  processDailyActivity(chats) {
    const activity = Array(7).fill().map(() => Array(24).fill(0));
    
    chats.forEach(chat => {
      if (chat.createdAt?.toDate) {
        const date = chat.createdAt.toDate();
        const day = date.getDay();
        const hour = date.getHours();
        activity[day][hour]++;
      }
    });

    return activity;
  },

  processTimeDistribution(chats) {
    const distribution = {
      morning: 0,   // 6-12
      afternoon: 0, // 12-17
      evening: 0,   // 17-22
      night: 0      // 22-6
    };

    chats.forEach(chat => {
      if (chat.createdAt?.toDate) {
        const hour = chat.createdAt.toDate().getHours();
        if (hour >= 6 && hour < 12) distribution.morning++;
        else if (hour >= 12 && hour < 17) distribution.afternoon++;
        else if (hour >= 17 && hour < 22) distribution.evening++;
        else distribution.night++;
      }
    });

    return distribution;
  },

  async processSubjects(chats, userId) {
    const subjects = {};
    const processedChats = new Set();

    for (const chat of chats) {
      if (processedChats.has(chat.id)) continue;

      // Get first message of each chat for topic analysis
      const messagesRef = collection(db, 'users', userId, 'chats', chat.id, 'messages');
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'), limit(1));
      const messageSnap = await getDocs(messagesQuery);

      if (!messageSnap.empty) {
        const firstMessage = messageSnap.docs[0].data().text;
        const topic = this.extractMainTopic(firstMessage);
        subjects[topic] = (subjects[topic] || 0) + 1;
      }

      processedChats.add(chat.id);
    }

    return subjects;
  },

  extractMainTopic(text) {
    // Simple topic extraction - can be enhanced with NLP
    const commonTopics = [
      'javascript', 'python', 'react', 'android', 'ios',
      'web', 'mobile', 'database', 'api', 'testing',
      'design', 'backend', 'frontend', 'devops', 'security'
    ];

    const words = text.toLowerCase().split(/\W+/);
    for (const topic of commonTopics) {
      if (words.includes(topic)) return topic;
    }
    return 'other';
  },

  processInteractionTrends(chats) {
    const trends = {};
    const now = moment();

    // Group by days
    chats.forEach(chat => {
      if (chat.createdAt?.toDate) {
        const date = moment(chat.createdAt.toDate()).format('YYYY-MM-DD');
        trends[date] = (trends[date] || 0) + 1;
      }
    });

    return trends;
  }
};
