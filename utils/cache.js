import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_LIMIT = 50; // Number of messages to cache per chat

export const cacheKeys = {
  CHATS: 'cached_chats',
  MESSAGES: 'cached_messages_',
  USER_PREFS: 'user_preferences',
  LAST_SYNC: 'last_sync_',
  SUBSCRIPTION_INFO: 'subscription_info',
};

export const saveToCache = async (key, data) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Cache save error:', error);
  }
};

export const getFromCache = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_EXPIRY;

    return isExpired ? null : data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
};

export const clearCache = async () => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

export const cacheMessages = async (chatId, messages) => {
  try {
    const key = `${cacheKeys.MESSAGES}${chatId}`;
    // Only cache the most recent messages
    const recentMessages = messages.slice(-MESSAGE_LIMIT);
    await saveToCache(key, recentMessages);
  } catch (error) {
    console.error('Message cache error:', error);
  }
};
