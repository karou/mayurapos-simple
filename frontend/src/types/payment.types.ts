export enum PaymentMethod {
    CASH = 'CASH',
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    MOBILE_PAYMENT = 'MOBILE_PAYMENT',
    GIFT_CARD = 'GIFT_CARD',
    STORE_CREDIT = 'STORE_CREDIT'
  }
  
  export enum PaymentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
  }
  
  export interface Payment {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    refundedAmount?: number;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    refundedAt?: string;
    isOffline: boolean;
    gatewayTransactionId?: string;
    offlineReference?: string;
    customerEmail?: string;
    notes?: string;
  }
  
  export interface PaymentRequest {
    orderId: string;
    amount: number;
    currency?: string;
    method: PaymentMethod;
    metadata?: Record<string, any>;
    customerEmail?: string;
    isOffline?: boolean;
  }
  
  export interface CreditCardInfo {
    cardNumber: string;
    cardholderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
  }
  
  export interface PaymentResponse {
    paymentId: string;
    status: PaymentStatus;
    message?: string;
    transactionId?: string;
    isOffline?: boolean;
    offlineReference?: string;
  }
  
  export interface RefundRequest {
    amount: number;
    reason?: string;
  }
  
  export interface RefundResponse {
    paymentId: string;
    refundedAmount: number;
    status: PaymentStatus;
    message: string;
  }
  
  export interface OfflineQueueStatus {
    queueStatus: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    };
    isProcessing: boolean;
  }