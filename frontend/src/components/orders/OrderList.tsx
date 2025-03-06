import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { OrderSummary, OrderStatus, PaymentStatus } from '../../types/order.types';

interface OrderListProps {
  orders: OrderSummary[];
  isLoading: boolean;
  emptyMessage?: string;
}

const OrderList: React.FC<OrderListProps> = ({ 
  orders, 
  isLoading, 
  emptyMessage = 'No orders found' 
}) => {
  // Get status badge color
  const getStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.CONFIRMED:
        return 'bg-primary-100 text-primary-800';
      case OrderStatus.PROCESSING:
        return 'bg-warning-100 text-warning-800';
      case OrderStatus.FULFILLED:
      case OrderStatus.DELIVERED:
        return 'bg-success-100 text-success-800';
      case OrderStatus.CANCELLED:
      case OrderStatus.REFUNDED:
        return 'bg-danger-100 text-danger-800';
      default:
        return 'bg-secondary-100 text-secondary-800';
    }
  };

  // Get payment status badge color
  const getPaymentStatusBadgeClass = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'bg-success-100 text-success-800';
      case PaymentStatus.PARTIALLY_PAID:
        return 'bg-warning-100 text-warning-800';
      case PaymentStatus.REFUNDED:
        return 'bg-danger-100 text-danger-800';
      default:
        return 'bg-secondary-100 text-secondary-800';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="card animate-pulse p-4">
            <div className="h-6 w-48 rounded bg-secondary-200"></div>
            <div className="mt-4 flex justify-between">
              <div className="h-4 w-24 rounded bg-secondary-200"></div>
              <div className="h-4 w-24 rounded bg-secondary-200"></div>
            </div>
            <div className="mt-4 flex justify-between">
              <div className="h-4 w-12 rounded bg-secondary-200"></div>
              <div className="h-4 w-20 rounded bg-secondary-200"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-100">
          <svg className="h-10 w-10 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-secondary-900">{emptyMessage}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link
          key={order.orderId}
          to={`/orders/${order.orderId}`}
          className="card block overflow-hidden transition-shadow hover:shadow-md"
        >
          <div className="p-4 sm:p-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <h3 className="text-lg font-medium text-secondary-900">Order #{order.orderId}</h3>
              <div className="mt-2 inline-flex sm:mt-0">
                <span className={`mr-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                  {order.status}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusBadgeClass(order.paymentStatus)}`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-secondary-500">Date</dt>
                <dd className="mt-1 text-secondary-900">{formatDate(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-secondary-500">Total</dt>
                <dd className="mt-1 font-semibold text-secondary-900">${order.total.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-secondary-500">Items</dt>
                <dd className="mt-1 text-secondary-900">{order.itemCount}</dd>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default OrderList;