import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

export const cacheService = {
  async set(key, data, customExpiry = CACHE_EXPIRY) {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        expiry: customExpiry
      };
      await AsyncStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async get(key) {
    try {
      const item = await AsyncStorage.getItem(key);
      if (!item) return null;

      const { data, timestamp, expiry } = JSON.parse(item);
      const isExpired = Date.now() - timestamp > expiry;

      if (isExpired) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Cache remove error:', error);
    }
  }
};
