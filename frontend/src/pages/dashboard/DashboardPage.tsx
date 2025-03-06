import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { orderApi } from '../../api/orderApi';
import { inventoryApi } from '../../api/inventoryApi';
import { OrderStats } from '../../types/order.types';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isOfflineMode } = useOffline();
  const [isLoading, setIsLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  
  // Today for date filtering
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // First day of month for monthly stats
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];

  useEffect(() => {
    const loadDashboardData = async () => {
      if (isOfflineMode) {
        // In offline mode, use locally cached data
        setIsLoading(false);
        return;
      }

      try {
        // Load order statistics
        const stats = await orderApi.getOrderStats(firstDayStr, todayStr);
        setOrderStats(stats);
        
        // Load low stock alerts
        const lowStockAlerts = await inventoryApi.getLowStockAlerts(undefined, { limit: 1 });
        setLowStockCount(lowStockAlerts.pagination.total);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [isOfflineMode, firstDayStr, todayStr]);

  // Dashboard quick action card component
  const QuickActionCard = ({ title, icon, description, linkTo, color }: {
    title: string;
    icon: React.ReactNode;
    description: string;
    linkTo: string;
    color: string;
  }) => (
    <Link
      to={linkTo}
      className="card flex flex-col items-center p-6 transition-transform hover:scale-105"
    >
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${color}`}>
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-center text-sm text-secondary-600">{description}</p>
    </Link>
  );

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-secondary-900">
        Welcome, {user?.username}
      </h1>

      {isOfflineMode && (
        <div className="mb-6 rounded-lg bg-warning-100 p-4 text-warning-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-warning-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-800">Offline Mode Active</h3>
              <div className="mt-2 text-sm text-warning-700">
                <p>
                  You are currently working in offline mode. Some features may be limited and data will be synchronized when you reconnect.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6">
              <h3 className="mb-1 text-sm font-medium text-secondary-500">Total Orders</h3>
              <p className="text-3xl font-bold text-secondary-900">
                {orderStats?.orderCount?.total || 0}
              </p>
              <div className="mt-2 text-xs text-secondary-500">This month</div>
            </div>

            <div className="card p-6">
              <h3 className="mb-1 text-sm font-medium text-secondary-500">Revenue</h3>
              <p className="text-3xl font-bold text-secondary-900">
                ${orderStats?.revenue?.total.toFixed(2) || '0.00'}
              </p>
              <div className="mt-2 text-xs text-secondary-500">This month</div>
            </div>

            <div className="card p-6">
              <h3 className="mb-1 text-sm font-medium text-secondary-500">Avg. Order Value</h3>
              <p className="text-3xl font-bold text-secondary-900">
                ${orderStats?.revenue?.averageOrderValue.toFixed(2) || '0.00'}
              </p>
              <div className="mt-2 text-xs text-secondary-500">This month</div>
            </div>

            <div className="card p-6">
              <h3 className="mb-1 text-sm font-medium text-secondary-500">Low Stock Alerts</h3>
              <p className="text-3xl font-bold text-secondary-900">{lowStockCount}</p>
              <div className="mt-2 text-xs text-secondary-500">Items need attention</div>
            </div>
          </div>

          {/* Quick Actions */}
          <h2 className="mb-4 text-2xl font-bold text-secondary-900">Quick Actions</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              title="New Sale"
              icon={
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              description="Create a new sales transaction"
              linkTo="/inventory"
              color="bg-primary-600 text-white"
            />

            <QuickActionCard
              title="Inventory"
              icon={
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
              description="Manage products and stock"
              linkTo="/inventory"
              color="bg-success-600 text-white"
            />

            <QuickActionCard
              title="Orders"
              icon={
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
              description="View and manage orders"
              linkTo="/orders"
              color="bg-warning-600 text-white"
            />

            <QuickActionCard
              title="Settings"
              icon={
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              description="Configure your system"
              linkTo="/settings"
              color="bg-secondary-600 text-white"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;