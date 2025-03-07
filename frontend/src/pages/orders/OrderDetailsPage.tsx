import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { orderApi } from '../../api/orderApi';
import { Order } from '../../types/order.types';
import OrderDetails from '../../components/orders/OrderDetails';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';

const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;

      setIsLoading(true);
      try {
        const data = await orderApi.getOrder(orderId);
        setOrder(data);
      } catch (error) {
        console.error('Failed to load order:', error);
        showToast('Failed to load order details', 'error');
        navigate('/orders');
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrder();
  }, [orderId, navigate, showToast]);

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!order) return;
    
    setIsCancelling(true);
    try {
      await orderApi.cancelOrder(order.orderId, cancelReason);
      showToast('Order cancelled successfully', 'success');
      // Refresh order data
      const updatedOrder = await orderApi.getOrder(order.orderId);
      setOrder(updatedOrder);
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to cancel order:', error);
      showToast('Failed to cancel order', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return <Spinner label="Loading order details..." />;
  }

  if (!order) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-medium text-secondary-900">Order not found</h2>
        <p className="mt-2 text-secondary-600">
          The order you're looking for doesn't exist or has been removed.
        </p>
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 btn-primary"
        >
          View All Orders
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/orders')}
        className="mb-4 flex items-center text-primary-600 hover:text-primary-700"
      >
        <svg className="mr-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Orders
      </button>

      <h1 className="mb-6 text-2xl font-bold text-secondary-900">
        Order #{order.orderId}
      </h1>

      <OrderDetails order={order} onCancel={handleCancel} />

      {/* Cancel Order Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-secondary-700">
            Are you sure you want to cancel this order? This action cannot be undone.
          </p>
          
          <div>
            <label htmlFor="cancelReason" className="form-label">
              Reason for Cancellation (Optional)
            </label>
            <textarea
              id="cancelReason"
              className="form-input"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Please provide a reason for cancellation"
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCancelModal(false)}
              disabled={isCancelling}
            >
              No, Keep Order
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <div className="flex items-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Cancelling...</span>
                </div>
              ) : (
                'Yes, Cancel Order'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetailsPage;