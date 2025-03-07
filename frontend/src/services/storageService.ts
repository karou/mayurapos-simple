import Dexie from 'dexie';

/**
 * Storage service that handles both localStorage and IndexedDB
 * - Uses localStorage for small data items (tokens, user info, etc.)
 * - Uses IndexedDB for larger data (product lists, order history, etc.)
 */
class StorageService {
  private db: Dexie;
  private dbName = 'MayuraPOS';
  private dbVersion = 1;

  constructor() {
    // Initialize IndexedDB
    this.db = new Dexie(this.dbName);
    this.db.version(this.dbVersion).stores({
      cache: 'key,value,expires',
      products: 'productId,sku,category',
      orders: 'orderId,status,createdAt',
      offlineQueue: '++id,type,data,status,timestamp'
    });
  }

  /**
   * Set item in storage (uses localStorage or IndexedDB based on size)
   */
  async setItem(key: string, value: any): Promise<void> {
    // Convert value to string if needed
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);

    try {
      // If small enough, use localStorage
      if (strValue.length < 50000) {
        // ~50KB limit for localStorage
        localStorage.setItem(key, strValue);
      } else {
        // For larger data, use IndexedDB
        await this.db.table('cache').put({
          key,
          value: strValue,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }
    } catch (error) {
      console.error('Storage error', error);
      // If localStorage fails (like in private browsing), fallback to IndexedDB
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        await this.db.table('cache').put({
          key,
          value: strValue,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get item from storage (checks localStorage first, then IndexedDB)
   */
  async getItem(key: string): Promise<string | null> {
    // Check localStorage first
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      return localValue;
    }

    // Then check IndexedDB
    try {
      const dbItem = await this.db.table('cache').get(key);
      if (dbItem) {
        // Check if item has expired
        if (dbItem.expires > Date.now()) {
          return dbItem.value;
        } else {
          // If expired, remove it and return null
          await this.db.table('cache').delete(key);
        }
      }
    } catch (error) {
      console.error('Error retrieving from IndexedDB', error);
    }

    return null;
  }

  /**
   * Remove item from storage (from both localStorage and IndexedDB)
   */
  async removeItem(key: string): Promise<void> {
    // Remove from localStorage
    localStorage.removeItem(key);

    // Also remove from IndexedDB
    try {
      await this.db.table('cache').delete(key);
    } catch (error) {
      console.error('Error removing from IndexedDB', error);
    }
  }

  /**
   * Clear all storage data
   */
  async clear(): Promise<void> {
    // Clear localStorage
    localStorage.clear();

    // Clear IndexedDB tables
    try {
      await this.db.table('cache').clear();
      await this.db.table('products').clear();
      await this.db.table('orders').clear();
      // Don't clear offline queue as those might need to be synced
    } catch (error) {
      console.error('Error clearing IndexedDB', error);
    }
  }

  /**
   * Store product data in IndexedDB
   */
  async storeProducts(products: any[]): Promise<void> {
    try {
      // Begin a transaction
      await this.db.transaction('rw', this.db.table('products'), async () => {
        // Clear existing products if we're storing a complete dataset
        if (products.length > 10) {
          await this.db.table('products').clear();
        }
        
        // Add all products
        await this.db.table('products').bulkPut(products);
      });
    } catch (error) {
      console.error('Error storing products', error);
      throw error;
    }
  }

  /**
   * Get products from IndexedDB
   */
  async getProducts(filter?: { category?: string }): Promise<any[]> {
    try {
      if (filter?.category) {
        return await this.db.table('products')
          .where('category')
          .equals(filter.category)
          .toArray();
      }
      return await this.db.table('products').toArray();
    } catch (error) {
      console.error('Error retrieving products', error);
      return [];
    }
  }

  /**
   * Store an order in IndexedDB
   */
  async storeOrder(order: any): Promise<void> {
    try {
      await this.db.table('orders').put(order);
    } catch (error) {
      console.error('Error storing order', error);
      throw error;
    }
  }

  /**
   * Get orders from IndexedDB
   */
  async getOrders(filter?: { status?: string }): Promise<any[]> {
    try {
      if (filter?.status) {
        return await this.db.table('orders')
          .where('status')
          .equals(filter.status)
          .toArray();
      }
      return await this.db.table('orders').toArray();
    } catch (error) {
      console.error('Error retrieving orders', error);
      return [];
    }
  }

  /**
   * Add item to offline queue
   */
  async addToOfflineQueue(type: string, data: any): Promise<number> {
    try {
      const id = await this.db.table('offlineQueue').add({
        type,
        data,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      return id as number;
    } catch (error) {
      console.error('Error adding to offline queue', error);
      throw error;
    }
  }

  /**
   * Get pending offline queue items
   */
  async getOfflineQueue(status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending'): Promise<any[]> {
    try {
      return await this.db.table('offlineQueue')
        .where('status')
        .equals(status)
        .toArray();
    } catch (error) {
      console.error('Error retrieving offline queue', error);
      return [];
    }
  }

  /**
   * Update offline queue item status
   */
  async updateOfflineQueueStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    try {
      await this.db.table('offlineQueue')
        .update(id, { status });
    } catch (error) {
      console.error('Error updating offline queue status', error);
      throw error;
    }
  }

  /**
   * Get count of pending offline queue items
   */
  async getPendingOfflineQueueCount(): Promise<number> {
    try {
      return await this.db.table('offlineQueue')
        .where('status')
        .equals('pending')
        .count();
    } catch (error) {
      console.error('Error counting pending offline queue items', error);
      return 0;
    }
  }
}

export const storageService = new StorageService();