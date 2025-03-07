import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import { orderApi } from '../../api/orderApi';
import { OrderStatus, OrderSummary } from '../../types/order.types';
import OrderList from '../../components/orders/OrderList';

const OrdersPage: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadOrders = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would get the customerId from the auth context
        
        const params: any = {
          page: currentPage,
          limit: 10,
        };
        
        if (selectedStatus) {
          params.status = selectedStatus;
        }
        
        const response = await orderApi.searchOrders(params);
        
        setOrders(response.orders);
        setTotalPages(response.pagination.pages);
      } catch (error) {
        console.error('Failed to load orders:', error);
        showToast('Failed to load orders', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrders();
  }, [currentPage, selectedStatus, showToast]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1); // Reset to first page when changing filters
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-secondary-900">Orders</h1>
      
      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label htmlFor="status-filter" className="form-label">
              Filter by Status
            </label>
            <select
              id="status-filter"
              className="form-input"
              value={selectedStatus}
              onChange={handleStatusChange}
            >
              <option value="">All Orders</option>
              <option value={OrderStatus.PENDING}>Pending</option>
              <option value={OrderStatus.CONFIRMED}>Confirmed</option>
              <option value={OrderStatus.PROCESSING}>Processing</option>
              <option value={OrderStatus.FULFILLED}>Fulfilled</option>
              <option value={OrderStatus.DELIVERED}>Delivered</option>
              <option value={OrderStatus.CANCELLED}>Cancelled</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Order List */}
      <OrderList 
        orders={orders} 
        isLoading={isLoading} 
        emptyMessage={
          selectedStatus 
            ? `No ${selectedStatus.toLowerCase()} orders found` 
            : "You don't have any orders yet"
        }
      />
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            className="btn-secondary"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            Previous
          </button>
          <span className="text-sm text-secondary-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-secondary"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;