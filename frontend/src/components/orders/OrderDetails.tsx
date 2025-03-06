import React from 'react';
import { format } from 'date-fns';
import { Order, OrderStatus, PaymentStatus } from '../../types/order.types';

interface OrderDetailsProps {
  order: Order;
  onCancel?: () => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onCancel }) => {
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

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

  // Check if order can be cancelled
  const canCancel = (status: OrderStatus) => {
    return (
      [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(status) && 
      onCancel !== undefined
    );
  };

  return (
    <div className="space-y-6">
      {/* Order header */}
      <div className="card overflow-hidden">
        <div className="border-b border-secondary-200 bg-secondary-50 p-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-medium text-secondary-900">
              Order #{order.orderId}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
              <span className={`badge ${getPaymentStatusBadgeClass(order.paymentStatus)}`}>
                {order.paymentStatus}
              </span>
              {order.isOfflineOrder && (
                <span className="badge bg-warning-100 text-warning-800">
                  Offline Order
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h4 className="text-sm font-medium uppercase text-secondary-500">Order Date</h4>
              <p className="mt-1 text-secondary-900">{formatDate(order.createdAt)}</p>
            </div>
            {order.status === OrderStatus.CONFIRMED && order.confirmedAt && (
              <div>
                <h4 className="text-sm font-medium uppercase text-secondary-500">Confirmed Date</h4>
                <p className="mt-1 text-secondary-900">{formatDate(order.confirmedAt)}</p>
              </div>
            )}
            {order.status === OrderStatus.FULFILLED && order.fulfilledAt && (
              <div>
                <h4 className="text-sm font-medium uppercase text-secondary-500">Fulfilled Date</h4>
                <p className="mt-1 text-secondary-900">{formatDate(order.fulfilledAt)}</p>
              </div>
            )}
            {order.status === OrderStatus.DELIVERED && order.deliveredAt && (
              <div>
                <h4 className="text-sm font-medium uppercase text-secondary-500">Delivered Date</h4>
                <p className="mt-1 text-secondary-900">{formatDate(order.deliveredAt)}</p>
              </div>
            )}
            {order.status === OrderStatus.CANCELLED && order.cancelledAt && (
              <div>
                <h4 className="text-sm font-medium uppercase text-secondary-500">Cancelled Date</h4>
                <p className="mt-1 text-secondary-900">{formatDate(order.cancelledAt)}</p>
              </div>
            )}
            {order.paymentMethod && (
              <div>
                <h4 className="text-sm font-medium uppercase text-secondary-500">Payment Method</h4>
                <p className="mt-1 text-secondary-900">{order.paymentMethod}</p>
              </div>
            )}
          </div>

          {canCancel(order.status) && (
            <div className="mt-6 border-t border-secondary-200 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="btn-danger"
              >
                Cancel Order
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Order items */}
      <div className="card overflow-hidden">
        <div className="border-b border-secondary-200 bg-secondary-50 p-4 sm:px-6">
          <h3 className="text-lg font-medium text-secondary-900">Order Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500"
                >
                  SKU
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500"
                >
                  Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-200 bg-white">
              {order.items.map((item, index) => (
                <tr key={`${item.productId}-${index}`}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-secondary-900">
                    {item.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-500">
                    {item.sku}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-secondary-900">
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-secondary-900">
                    {item.quantity}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-secondary-900">
                    ${item.totalPrice.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order summary */}
      <div className="card overflow-hidden">
        <div className="border-b border-secondary-200 bg-secondary-50 p-4 sm:px-6">
          <h3 className="text-lg font-medium text-secondary-900">Order Summary</h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col space-y-3">
            <div className="flex justify-between">
              <span className="text-secondary-500">Subtotal</span>
              <span className="font-medium text-secondary-900">
                ${order.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-500">Tax</span>
              <span className="font-medium text-secondary-900">${order.tax.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-secondary-500">Discount</span>
                <span className="font-medium text-secondary-900">
                  -${order.discount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-t border-secondary-200 pt-3">
              <div className="flex justify-between font-semibold">
                <span className="text-secondary-900">Total</span>
                <span className="text-secondary-900">${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping and billing addresses if available */}
      {(order.shippingAddress || order.billingAddress) && (
        <div className="grid gap-6 md:grid-cols-2">
          {order.shippingAddress && (
            <div className="card overflow-hidden">
              <div className="border-b border-secondary-200 bg-secondary-50 p-4 sm:px-6">
                <h3 className="text-lg font-medium text-secondary-900">Shipping Address</h3>
              </div>
              <div className="p-4 sm:p-6">
                <address className="not-italic">
                  <p>{order.shippingAddress.street}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                    {order.shippingAddress.zip}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </address>
              </div>
            </div>
          )}
          {order.billingAddress && (
            <div className="card overflow-hidden">
              <div className="border-b border-secondary-200 bg-secondary-50 p-4 sm:px-6">
                <h3 className="text-lg font-medium text-secondary-900">Billing Address</h3>
              </div>
              <div className="p-4 sm:p-6">
                <address className="not-italic">
                  <p>{order.billingAddress.street}</p>
                  <p>
                    {order.billingAddress.city}, {order.billingAddress.state}{' '}
                    {order.billingAddress.zip}
                  </p>
                  <p>{order.billingAddress.country}</p>
                </address>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;