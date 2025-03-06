import { storageService } from './storageService';
import { orderApi } from '../api/orderApi';
import { paymentApi } from '../api/paymentApi';
import { inventoryApi } from '../api/inventoryApi';

type SyncCallback = (pendingCount: number) => void;

/**
 * Service for handling offline data synchronization
 */
class SyncService {
  private listeners: SyncCallback[] = [];
  private isSyncing = false;

  /**
   * Add an offline request to the queue
   * @param type The type of request (e.g., 'createOrder', 'processPayment')
   * @param data The request data
   * @returns ID of the queued item
   */
  async addToQueue(type: string, data: any): Promise<number> {
    const id = await storageService.addToOfflineQueue(type, data);
    this.notifyListeners();
    return id;
  }

  /**
   * Get the count of pending sync items
   */
  async getPendingSyncCount(): Promise<number> {
    return await storageService.getPendingOfflineQueueCount();
  }

  /**
   * Get the last sync time
   */
  async getLastSyncTime(): Promise<string | null> {
    return await storageService.getItem('lastSyncTime');
  }

  /**
   * Subscribe to changes in pending sync count
   * @param callback Function to call when the pending count changes
   * @returns Function to unsubscribe
   */
  subscribeToPendingChanges(callback: SyncCallback): () => void {
    this.listeners.push(callback);
    
    // Initial notification
    this.getPendingSyncCount().then(count => callback(count));
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of a change in pending sync count
   */
  private async notifyListeners(): Promise<void> {
    const count = await this.getPendingSyncCount();
    this.listeners.forEach(listener => listener(count));
  }

  /**
   * Synchronize all pending offline operations with the server
   */
  async syncWithServer(): Promise<void> {
    if (this.isSyncing) {
      return; // Already syncing
    }

    this.isSyncing = true;

    try {
      // Get pending items
      const pendingItems = await storageService.getOfflineQueue('pending');
      
      if (pendingItems.length === 0) {
        // No items to sync
        await storageService.setItem('lastSyncTime', new Date().toISOString());
        return;
      }

      // Process each pending item
      for (const item of pendingItems) {
        try {
          // Mark as processing
          await storageService.updateOfflineQueueStatus(item.id, 'processing');
          
          // Process based on type
          await this.processItem(item.type, item.data);
          
          // Mark as completed
          await storageService.updateOfflineQueueStatus(item.id, 'completed');
        } catch (error) {
          console.error(`Failed to process offline queue item ${item.id}:`, error);
          
          // Mark as failed
          await storageService.updateOfflineQueueStatus(item.id, 'failed');
        }
      }

      // Update last sync time
      await storageService.setItem('lastSyncTime', new Date().toISOString());
      
      // Notify listeners
      this.notifyListeners();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a specific offline queue item
   */
  private async processItem(type: string, data: any): Promise<void> {
    switch (type) {
      case 'createOrder':
        await this.syncCreateOrder(data);
        break;
      case 'processPayment':
        await this.syncProcessPayment(data);
        break;
      case 'updateOrderStatus':
        await this.syncUpdateOrderStatus(data);
        break;
      case 'cancelOrder':
        await this.syncCancelOrder(data);
        break;
      default:
        throw new Error(`Unknown offline queue item type: ${type}`);
    }
  }

  /**
   * Sync a created order
   */
  private async syncCreateOrder(data: any): Promise<void> {
    // Submit the order to the server
    const { items, metadata, offlineOrderId } = data;
    
    // Create the order online
    const order = await orderApi.createOrder(items, false, {
      ...metadata,
      offlineOrderId
    });
    
    // Update the locally stored order with the server's order ID
    const localOrder = await storageService.getItem(`order_${offlineOrderId}`);
    if (localOrder) {
      const parsedOrder = JSON.parse(localOrder);
      parsedOrder.serverId = order.orderId;
      parsedOrder.synced = true;
      await storageService.setItem(`order_${offlineOrderId}`, JSON.stringify(parsedOrder));
    }
  }

  /**
   * Sync a payment
   */
  private async syncProcessPayment(data: any): Promise<void> {
    const { orderId, amount, method, metadata, offlinePaymentId } = data;
    
    // Process the payment online
    const payment = await paymentApi.processPayment(
      orderId,
      amount,
      method,
      false,
      {
        ...metadata,
        offlinePaymentId
      }
    );
    
    // Update the locally stored payment with the server's payment ID
    const localPayment = await storageService.getItem(`payment_${offlinePaymentId}`);
    if (localPayment) {
      const parsedPayment = JSON.parse(localPayment);
      parsedPayment.serverId = payment.paymentId;
      parsedPayment.synced = true;
      await storageService.setItem(`payment_${offlinePaymentId}`, JSON.stringify(parsedPayment));
    }
  }

  /**
   * Sync an order status update
   */
  private async syncUpdateOrderStatus(data: any): Promise<void> {
    const { orderId, status, notes } = data;
    
    // Update the order status online
    await orderApi.updateOrderStatus(orderId, status, notes);
  }

  /**
   * Sync a cancelled order
   */
  private async syncCancelOrder(data: any): Promise<void> {
    const { orderId, reason } = data;
    
    // Cancel the order online
    await orderApi.cancelOrder(orderId, reason);
  }

  /**
   * Process an order offline
   */
  async processOfflineOrder(items: any[], metadata: any = {}): Promise<string> {
    // Generate a local order ID
    const offlineOrderId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the order locally
    const order = {
      orderId: offlineOrderId,
      items,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      isOfflineOrder: true,
      synced: false,
      ...metadata
    };
    
    await storageService.setItem(`order_${offlineOrderId}`, JSON.stringify(order));
    
    // Add to sync queue
    await this.addToQueue('createOrder', {
      items,
      metadata,
      offlineOrderId
    });
    
    return offlineOrderId;
  }

  /**
   * Process a payment offline
   */
  async processOfflinePayment(
    orderId: string,
    amount: number,
    method: string,
    metadata: any = {}
  ): Promise<string> {
    // Generate a local payment ID
    const offlinePaymentId = `offline_payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the payment locally
    const payment = {
      paymentId: offlinePaymentId,
      orderId,
      amount,
      method,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      isOffline: true,
      synced: false,
      ...metadata
    };
    
    await storageService.setItem(`payment_${offlinePaymentId}`, JSON.stringify(payment));
    
    // Add to sync queue
    await this.addToQueue('processPayment', {
      orderId,
      amount,
      method,
      metadata,
      offlinePaymentId
    });
    
    return offlinePaymentId;
  }
}

export const syncService = new SyncService();