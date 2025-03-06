export enum OrderStatus {
    CART = 'CART',
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    PROCESSING = 'PROCESSING',
    FULFILLED = 'FULFILLED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
    REFUNDED = 'REFUNDED'
  }
  
  export enum PaymentStatus {
    UNPAID = 'UNPAID',
    PARTIALLY_PAID = 'PARTIALLY_PAID',
    PAID = 'PAID',
    REFUNDED = 'REFUNDED'
  }
  
  export interface OrderItem {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    totalPrice: number;
    notes?: string;
    metadata?: Record<string, any>;
  }
  
  export interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
  
  export interface Order {
    orderId: string;
    customerId?: string;
    status: OrderStatus;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentStatus: PaymentStatus;
    paymentMethod?: string;
    shippingAddress?: Address;
    billingAddress?: Address;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    confirmedAt?: string;
    fulfilledAt?: string;
    deliveredAt?: string;
    cancelledAt?: string;
    employeeId?: string;
    storeId?: string;
    deliveryId?: string;
    isOfflineOrder: boolean;
  }
  
  export interface OrderSearchParams {
    status?: OrderStatus;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    minTotal?: number;
    maxTotal?: number;
    paymentStatus?: PaymentStatus;
    isOfflineOrder?: boolean;
    storeId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
  
  export interface OrderSummary {
    orderId: string;
    status: OrderStatus;
    total: number;
    itemCount: number;
    createdAt: string;
    paymentStatus: PaymentStatus;
  }
  
  export interface OrderStats {
    orderCount: {
      total: number;
      byStatus: Record<OrderStatus, { count: number; total: number }>;
    };
    revenue: {
      total: number;
      orderCount: number;
      averageOrderValue: number;
    };
    dailySales: {
      date: string;
      sales: number;
      orders: number;
    }[];
    topProducts: {
      productId: string;
      name: string;
      sku: string;
      totalQuantity: number;
      totalRevenue: number;
      orderCount: number;
    }[];
  }