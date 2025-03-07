import { storageService } from './storageService';
import { syncService } from './syncService';
import { orderApi } from '../api/orderApi';
import { OrderStatus } from '../types/order.types';
import { CartItem } from '../types/inventory.types';

/**
 * Service for handling shopping cart operations
 */
class CartService {
  /**
   * Create an order from the current cart
   * @param items Cart items
   * @param isOffline Whether to create the order in offline mode
   * @param metadata Additional metadata for the order
   */
  async createOrder(
    items: CartItem[], 
    isOffline = false,
    metadata: Record<string, any> = {}
  ): Promise<{ orderId: string; success: boolean }> {
    try {
      if (isOffline) {
        // Create offline order
        const offlineOrderId = await syncService.processOfflineOrder(items, metadata);
        return { orderId: offlineOrderId, success: true };
      } else {
        // Create online order
        const order = await orderApi.createOrder(items, false, metadata);
        return { orderId: order.orderId, success: true };
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      return { orderId: '', success: false };
    }
  }

  /**
   * Confirm an order (move to CONFIRMED status)
   * @param orderId Order ID
   * @param paymentMethod Payment method
   * @param shippingAddress Shipping address
   * @param billingAddress Billing address
   * @param isOffline Whether to confirm the order in offline mode
   */
  async confirmOrder(
    orderId: string,
    paymentMethod?: string,
    shippingAddress?: any,
    billingAddress?: any,
    isOffline = false
  ): Promise<{ success: boolean }> {
    try {
      if (isOffline) {
        // Store the confirmation locally
        const orderStr = await storageService.getItem(`order_${orderId}`);
        if (orderStr) {
          const order = JSON.parse(orderStr);
          order.status = OrderStatus.CONFIRMED;
          order.confirmedAt = new Date().toISOString();
          order.paymentMethod = paymentMethod;
          order.shippingAddress = shippingAddress;
          order.billingAddress = billingAddress;
          await storageService.setItem(`order_${orderId}`, JSON.stringify(order));
        }
        
        // Add to sync queue
        await syncService.addToQueue('updateOrderStatus', {
          orderId,
          status: OrderStatus.CONFIRMED,
          notes: 'Confirmed offline'
        });
        
        return { success: true };
      } else {
        // Confirm order online
        await orderApi.confirmOrder(orderId, paymentMethod, shippingAddress, billingAddress);
        return { success: true };
      }
    } catch (error) {
      console.error('Failed to confirm order:', error);
      return { success: false };
    }
  }

  /**
   * Cancel an order
   * @param orderId Order ID
   * @param reason Cancellation reason
   * @param isOffline Whether to cancel the order in offline mode
   */
  async cancelOrder(
    orderId: string,
    reason?: string,
    isOffline = false
  ): Promise<{ success: boolean }> {
    try {
      if (isOffline) {
        // Store the cancellation locally
        const orderStr = await storageService.getItem(`order_${orderId}`);
        if (orderStr) {
          const order = JSON.parse(orderStr);
          order.status = OrderStatus.CANCELLED;
          order.cancelledAt = new Date().toISOString();
          order.cancellationReason = reason;
          await storageService.setItem(`order_${orderId}`, JSON.stringify(order));
        }
        
        // Add to sync queue
        await syncService.addToQueue('cancelOrder', {
          orderId,
          reason
        });
        
        return { success: true };
      } else {
        // Cancel order online
        await orderApi.cancelOrder(orderId, reason);
        return { success: true };
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      return { success: false };
    }
  }

  /**
   * Get order from local storage by ID
   * @param orderId Order ID
   */
  async getLocalOrder(orderId: string): Promise<any | null> {
    const orderStr = await storageService.getItem(`order_${orderId}`);
    return orderStr ? JSON.parse(orderStr) : null;
  }

  /**
   * Calculate order totals
   * @param items Cart items
   * @param taxRate Tax rate (default: 0.07 or 7%)
   */
  calculateTotals(items: CartItem[], taxRate = 0.07): { 
    subtotal: number; 
    tax: number; 
    total: number 
  } {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    
    return {
      subtotal,
      tax,
      total
    };
  }
}

export const cartService = new CartService();