import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOffline } from '../../hooks/useOffline';
import { useToast } from '../../hooks/useToast';
import { storageService } from '../../services/storageService';
import { syncService } from '../../services/syncService';
import Modal from '../../components/common/Modal';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOfflineMode, enableOfflineMode, disableOfflineMode, syncWithServer, pendingSyncCount } = useOffline();
  const { showToast } = useToast();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncWithServer();
      showToast('Synchronization completed successfully', 'success');
    } catch (error) {
      console.error('Sync error:', error);
      showToast('Failed to synchronize with server', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await storageService.clear();
      showToast('Local data cleared successfully', 'success');
      setShowClearDataModal(false);
    } catch (error) {
      console.error('Clear data error:', error);
      showToast('Failed to clear local data', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Failed to logout', 'error');
    }
  };

  const toggleOfflineMode = () => {
    if (isOfflineMode) {
      disableOfflineMode();
      showToast('Online mode enabled', 'success');
    } else {
      enableOfflineMode();
      showToast('Offline mode enabled', 'info');
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-secondary-900">Settings</h1>
      
      {/* User Profile Section */}
      <div className="mb-8 rounded-lg bg-white shadow-sm">
        <div className="border-b border-secondary-200 px-6 py-4">
          <h2 className="text-lg font-medium text-secondary-900">User Profile</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center">
            <div className="h-16 w-16 flex-shrink-0 rounded-full bg-primary-100 text-primary-700">
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold uppercase">
                {user?.username.charAt(0)}
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-medium text-secondary-900">{user?.username}</h3>
              <p className="text-secondary-500">{user?.email}</p>
              <div className="mt-2 flex gap-2">
                {user?.roles.map(role => (
                  <span key={role} className="badge-primary badge">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowLogoutModal(true)}
            className="mt-6 btn-danger"
          >
            Logout
          </button>
        </div>
      </div>
      
      {/* Offline Mode Section */}
      <div className="mb-8 rounded-lg bg-white shadow-sm">
        <div className="border-b border-secondary-200 px-6 py-4">
          <h2 className="text-lg font-medium text-secondary-900">Offline Mode</h2>
        </div>
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-md font-medium text-secondary-900">Enable Offline Mode</h3>
              <p className="text-sm text-secondary-500">
                When enabled, the app will work without an internet connection.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isOfflineMode}
                onChange={toggleOfflineMode}
              />
              <div className="peer h-6 w-11 rounded-full bg-secondary-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300"></div>
            </label>
          </div>
          
          <button
            onClick={handleSync}
            className="btn-primary mr-3"
            disabled={isSyncing || pendingSyncCount === 0}
          >
            {isSyncing ? (
              <div className="flex items-center">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Synchronizing...</span>
              </div>
            ) : (
              <>
                Sync Now
                {pendingSyncCount > 0 && ` (${pendingSyncCount})`}
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowClearDataModal(true)}
            className="btn-secondary"
          >
            Clear Local Data
          </button>
        </div>
      </div>
      
      {/* App Preferences Section */}
      <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-secondary-200 px-6 py-4">
          <h2 className="text-lg font-medium text-secondary-900">App Preferences</h2>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="theme" className="form-label">
              Theme
            </label>
            <select id="theme" className="form-input">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label htmlFor="currency" className="form-label">
              Currency
            </label>
            <select id="currency" className="form-input">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="language" className="form-label">
              Language
            </label>
            <select id="language" className="form-input">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Clear Data Confirmation Modal */}
      <Modal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        title="Clear Local Data"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-secondary-700">
            Are you sure you want to clear all locally stored data? This action cannot be undone and will remove all
            cached products, orders, and settings.
          </p>
          
          <div className="rounded-md bg-warning-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-warning-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-warning-800">Warning</h3>
                <div className="mt-2 text-sm text-warning-700">
                  <p>
                    Any pending offline transactions or changes will be lost if they haven't been synchronized.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowClearDataModal(false)}
              disabled={isClearing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleClearData}
              disabled={isClearing}
            >
              {isClearing ? (
                <div className="flex items-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Clearing...</span>
                </div>
              ) : (
                'Clear Data'
              )}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout Confirmation"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-secondary-700">
            Are you sure you want to log out? If you have pending offline changes, please synchronize them first.
          </p>
          
          {pendingSyncCount > 0 && (
            <div className="rounded-md bg-warning-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-warning-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-warning-800">Warning</h3>
                  <div className="mt-2 text-sm text-warning-700">
                    <p>
                      You have {pendingSyncCount} pending changes that haven't been synchronized yet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;