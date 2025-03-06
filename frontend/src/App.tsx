import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { ToastProvider } from './contexts/ToastContext';
import PrivateRoute from './components/common/PrivateRoute';
import PublicRoute from './components/common/PublicRoute';
import MainLayout from './components/layout/MainLayout';
import OfflineIndicator from './components/common/OfflineIndicator';
import Toast from './components/common/Toast';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import InventoryPage from './pages/inventory/InventoryPage';
import ProductDetailsPage from './pages/inventory/ProductDetailsPage';
import CartPage from './pages/orders/CartPage';
import CheckoutPage from './pages/orders/CheckoutPage';
import OrdersPage from './pages/orders/OrdersPage';
import OrderDetailsPage from './pages/orders/OrderDetailsPage';
import SettingsPage from './pages/settings/SettingsPage';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  // Simulate app initialization (loading configs, checking auth status, etc.)
  useEffect(() => {
    const initApp = async () => {
      // Give some time for resources to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsReady(true);
    };

    initApp();
  }, []);

  if (!isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-primary-50">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <p className="mt-4 text-lg font-medium text-primary-800">Loading MayuraPOS...</p>
        </div>
      </div>
    );
  }

  return (
    <OfflineProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <OfflineIndicator />
            <Toast />
            <Routes>
              {/* Public routes */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Protected routes */}
              <Route element={<PrivateRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/inventory/:productId" element={<ProductDetailsPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Redirect to dashboard if already logged in, otherwise to login */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </OfflineProvider>
  );
};

export default App;