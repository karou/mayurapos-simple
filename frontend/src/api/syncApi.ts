import { apiClient } from './apiClient';
import { storageService } from '../services/storageService';

class SyncApi {
  /**
   * Synchronize offline transactions with the server
   */
  async syncOfflineTransactions(transactions: any[]): Promise<{ success: boolean; details: string }> {
    const response = await apiClient.post<{ success: boolean; details: string }>('/api/sync/transactions', { 
      transactions 
    });
    return response.data;
  }

  /**
   * Get the latest inventory data for offline use
   */
  async getInventorySync(storeId: string, lastSyncTimestamp?: string): Promise<any> {
    const params: any = { storeId };
    
    if (lastSyncTimestamp) {
      params.since = lastSyncTimestamp;
    }
    
    const response = await apiClient.get('/api/sync/inventory', { params });
    return response.data;
  }

  /**
   * Get the user's order history for offline access
   */
  async getOrdersSync(lastSyncTimestamp?: string): Promise<any> {
    const params: any = {};
    
    if (lastSyncTimestamp) {
      params.since = lastSyncTimestamp;
    }
    
    const response = await apiClient.get('/api/sync/orders', { params });
    return response.data;
  }

  /**
   * Submit offline orders that were created during offline mode
   */
  async submitOfflineOrders(orders: any[]): Promise<{ 
    success: boolean; 
    processedOrders: string[];
    failedOrders: { id: string; reason: string }[];
  }> {
    const response = await apiClient.post('/api/sync/orders/submit', { orders });
    return response.data;
  }

  /**
   * Submit offline payments that were created during offline mode
   */
  async submitOfflinePayments(payments: any[]): Promise<{
    success: boolean;
    processedPayments: string[];
    failedPayments: { id: string; reason: string }[];
  }> {
    const response = await apiClient.post('/api/sync/payments/submit', { payments });
    return response.data;
  }

  /**
   * Get sync status from the server
   */
  async getSyncStatus(): Promise<{
    lastSync: string | null;
    pendingChanges: number;
    syncInProgress: boolean;
  }> {
    try {
      const response = await apiClient.get('/api/sync/status');
      return response.data;
    } catch (error) {
      // Return default status if server is unavailable
      return {
        lastSync: await storageService.getItem('lastSyncTime'),
        pendingChanges: 0,
        syncInProgress: false
      };
    }
  }

  /**
   * Initiate a full sync with the server
   */
  async initiateFullSync(): Promise<{
    success: boolean;
    syncId: string;
    message: string;
  }> {
    const response = await apiClient.post('/api/sync/full');
    return response.data;
  }

  /**
   * Check the status of a full sync operation
   */
  async checkSyncProgress(syncId: string): Promise<{
    syncId: string;
    status: 'inProgress' | 'completed' | 'failed';
    progress: number;
    message: string;
  }> {
    const response = await apiClient.get(`/api/sync/full/${syncId}/status`);
    return response.data;
  }
}

export const syncApi = new SyncApi();