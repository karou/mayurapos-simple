// src/api/orderApi.ts - fixed inferrable types
import { apiClient } from './apiClient';
import { 
  Order, 
  OrderItem, 
  OrderStatus, 
  OrderSearchParams, 
  OrderSummary,
  OrderStats
} from '../types/order.types';
import { CartItem } from '../types/inventory.types';

// Properly typed interface definitions
interface StatusUpdateResponse {
  orderId: string;
  status: OrderStatus;
}

interface OrdersResponse {
  orders: OrderSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class OrderApi {
  /**
   * Create a new order
   */
  async createOrder(
    items: CartItem[],
    isOfflineOrder = false,  // Removed explicit boolean type
    metadata: Record<string, unknown> = {}
  ): Promise<Order> {
    const orderItems: OrderItem[] = items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      discount: 0,
      totalPrice: item.price * item.quantity
    }));

    const response = await apiClient.post<Order>('/api/orders/orders', {
      items: orderItems,
      isOfflineOrder,
      metadata
    });
    
    return response.data;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    const response = await apiClient.get<Order>(`/api/orders/orders/${orderId}`);
    return response.data;
  }

  /**
   * Get orders for a customer
   */
  async getCustomerOrders(
    customerId: string,
    status?: OrderStatus,
    page = 1,  // Removed explicit number type
    limit = 10  // Removed explicit number type
  ): Promise<PaginatedResponse<OrderSummary>> {
    const response = await apiClient.get<PaginatedResponse<OrderSummary>>(
      `/api/orders/orders/customer/${customerId}`, 
      {
        params: { status, page, limit }
      }
    );
    return response.data;
  }

  /**
   * Search orders with various filters
   */
  async searchOrders(params: OrderSearchParams = {}): Promise<OrdersResponse> {
    const response = await apiClient.get<OrdersResponse>('/api/orders/orders', {
      params
    });
    return response.data;
  }

  /**
   * Update order items
   */
  async updateOrder(
    orderId: string,
    items: OrderItem[],
    shippingAddress?: Record<string, unknown>,
    billingAddress?: Record<string, unknown>,
    notes?: string
  ): Promise<Order> {
    const response = await apiClient.put<Order>(`/api/orders/orders/${orderId}`, {
      items,
      shippingAddress,
      billingAddress,
      notes
    });
    return response.data;
  }

  /**
   * Add item to order
   */
  async addOrderItem(
    orderId: string,
    productId: string,
    sku: string,
    name: string,
    quantity: number,
    unitPrice: number,
    discount = 0  // Removed explicit number type
  ): Promise<Order> {
    const response = await apiClient.post<Order>(`/api/orders/orders/${orderId}/items`, {
      productId,
      sku,
      name,
      quantity,
      unitPrice,
      discount
    });
    return response.data;
  }

  /**
   * Update order item quantity
   */
  async updateOrderItem(
    orderId: string,
    itemId: string,
    quantity: number,
    discount?: number
  ): Promise<Order> {
    const response = await apiClient.put<Order>(`/api/orders/orders/${orderId}/items/${itemId}`, {
      quantity,
      discount
    });
    return response.data;
  }

  /**
   * Remove item from order
   */
  async removeOrderItem(orderId: string, itemId: string): Promise<Order> {
    const response = await apiClient.delete<Order>(`/api/orders/orders/${orderId}/items/${itemId}`);
    return response.data;
  }

  /**
   * Confirm order (move to CONFIRMED status)
   */
  async confirmOrder(
    orderId: string,
    paymentMethod?: string,
    shippingAddress?: Record<string, unknown>,
    billingAddress?: Record<string, unknown>
  ): Promise<Order> {
    const response = await apiClient.post<Order>(`/api/orders/orders/${orderId}/confirm`, {
      paymentMethod,
      shippingAddress,
      billingAddress
    });
    return response.data;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<StatusUpdateResponse> {
    const response = await apiClient.post<StatusUpdateResponse>(`/api/orders/orders/${orderId}/cancel`, {
      reason
    });
    return response.data;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    notes?: string
  ): Promise<StatusUpdateResponse> {
    const response = await apiClient.put<StatusUpdateResponse>(`/api/orders/orders/${orderId}/status`, {
      status,
      notes
    });
    return response.data;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(
    startDate?: string,
    endDate?: string,
    storeId?: string
  ): Promise<OrderStats> {
    const response = await apiClient.get<OrderStats>('/api/orders/orders/stats/summary', {
      params: { startDate, endDate, storeId }
    });
    return response.data;
  }
}

export const orderApi = new OrderApi();