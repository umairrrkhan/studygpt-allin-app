import { collection, query, getDocs, limit, startAfter, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { cacheService } from './cacheService';

const BATCH_SIZE = 10;

export const batchService = {
  async loadBatch({
    userId,
    collectionPath,
    lastVisible = null,
    cacheKey = null,
    orderByField = 'createdAt',
    orderDirection = 'desc'
  }) {
    // Try cache first
    if (!lastVisible && cacheKey) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) return cachedData;
    }

    // Build query
    const ref = collection(db, 'users', userId, collectionPath);
    let q = query(
      ref,
      orderBy(orderByField, orderDirection),
      limit(BATCH_SIZE)
    );

    // Add pagination if lastVisible exists
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    // Get data
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Cache first batch
    if (!lastVisible && cacheKey) {
      await cacheService.set(cacheKey, items);
    }

    return {
      items,
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === BATCH_SIZE
    };
  }
};
