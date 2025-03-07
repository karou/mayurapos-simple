// src/components/layout/AppBar.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useOffline } from '../../contexts/OfflineContext';
import { useToast } from '../../contexts/ToastContext';
import { handleAsyncEvent } from '../../utils/type-safety';

const AppBar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { isOfflineMode, isOnline, enableOfflineMode, disableOfflineMode, syncWithServer, hasPendingSync, pendingSyncCount } = useOffline();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login');
      showToast('You have been logged out successfully', 'success');
    } catch (error) {
      showToast('Failed to log out', 'error');
    }
  };

  const toggleOfflineMode = (): void => {
    if (isOfflineMode) {
      disableOfflineMode();
      showToast('Online mode enabled', 'success');
    } else {
      enableOfflineMode();
      showToast('Offline mode enabled', 'info');
    }
  };

  const handleSync = async (): Promise<void> => {
    if (!isOnline) {
      showToast('Cannot sync while offline', 'error');
      return;
    }

    try {
      await syncWithServer();
      showToast('Synchronized successfully', 'success');
    } catch (error) {
      showToast('Synchronization failed', 'error');
    }
  };

  return (
    <header className="bg-primary-700 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center">
              <svg className="h-8 w-8 text-primary-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="ml-2 text-xl font-medium">MayuraPOS</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:block">
            <ul className="flex space-x-4">
              <li>
                <Link to="/dashboard" className="rounded-md px-3 py-2 hover:bg-primary-600">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/inventory" className="rounded-md px-3 py-2 hover:bg-primary-600">
                  Inventory
                </Link>
              </li>
              <li>
                <Link to="/orders" className="rounded-md px-3 py-2 hover:bg-primary-600">
                  Orders
                </Link>
              </li>
            </ul>
          </nav>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Cart button */}
            <Link
              to="/cart"
              className="relative rounded-md p-2 hover:bg-primary-600"
              aria-label="View cart"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger-500 text-xs font-bold">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Offline/Sync button */}
            <button
              onClick={toggleOfflineMode}
              className="relative rounded-md p-2 hover:bg-primary-600"
              aria-label={isOfflineMode ? 'Enable online mode' : 'Enable offline mode'}
            >
              {isOfflineMode ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              )}
            </button>

            {/* Sync button */}
            {hasPendingSync && isOnline && (
              <button
                onClick={handleAsyncEvent(handleSync)}
                className="relative rounded-md p-2 hover:bg-primary-600"
                aria-label="Sync pending changes"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning-500 text-xs font-bold">
                  {pendingSyncCount}
                </span>
              </button>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center rounded-md hover:bg-primary-600"
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <span className="sr-only">Open user menu</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-sm font-medium uppercase">
                  {user?.username.charAt(0)}
                </div>
                <span className="ml-2 hidden md:block">{user?.username}</span>
                <svg className="ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu"
                >
                  <div className="border-b px-4 py-2 text-sm text-secondary-700">{user?.email}</div>
                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleAsyncEvent(handleLogout)}
                    className="block w-full px-4 py-2 text-left text-sm text-secondary-700 hover:bg-secondary-100"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppBar;