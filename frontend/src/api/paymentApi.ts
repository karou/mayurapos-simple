import { apiClient } from './apiClient';
import { 
  Payment, 
  PaymentMethod, 
  PaymentRequest, 
  PaymentResponse, 
  RefundRequest, 
  RefundResponse,
  OfflineQueueStatus
} from '../types/payment.types';

class PaymentApi {
  /**
   * Process a payment
   */
  async processPayment(
    orderId: string,
    amount: number,
    method: PaymentMethod,
    isOffline: boolean = false,
    metadata: Record<string, any> = {},
    customerEmail?: string
  ): Promise<PaymentResponse> {
    const paymentRequest: PaymentRequest = {
      orderId,
      amount,
      method,
      isOffline,
      metadata,
      customerEmail
    };

    const response = await apiClient.post<PaymentResponse>('/api/payment/payments', paymentRequest);
    return response.data;
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment> {
    const response = await apiClient.get<Payment>(`/api/payment/payments/${paymentId}`);
    return response.data;
  }

  /**
   * Get payments for an order
   */
  async getPaymentsByOrder(orderId: string): Promise<{ payments: Payment[] }> {
    const response = await apiClient.get<{ payments: Payment[] }>(`/api/payment/payments/order/${orderId}`);
    return response.data;
  }

  /**
   * Process a refund
   */
  async processRefund(paymentId: string, amount: number, reason?: string): Promise<RefundResponse> {
    const refundRequest: RefundRequest = {
      amount,
      reason
    };

    const response = await apiClient.post<RefundResponse>(`/api/payment/payments/${paymentId}/refund`, refundRequest);
    return response.data;
  }

  /**
   * Submit an offline payment for processing
   */
  async submitOfflinePayment(paymentId: string): Promise<{ paymentId: string; message: string }> {
    const response = await apiClient.post<{ paymentId: string; message: string }>('/api/payment/offline/submit', {
      paymentId
    });
    return response.data;
  }

  /**
   * Get offline queue status
   */
  async getOfflineQueueStatus(): Promise<OfflineQueueStatus> {
    const response = await apiClient.get<OfflineQueueStatus>('/api/payment/offline/status');
    return response.data;
  }
}

export const paymentApi = new PaymentApi();