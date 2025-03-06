import React from 'react';
import { useOffline } from '../../contexts/OfflineContext';

/**
 * OfflineIndicator component that displays a banner when the app is in offline mode
 */
const OfflineIndicator: React.FC = () => {
  const { isOfflineMode, isOnline, hasPendingSync, pendingSyncCount, syncWithServer } = useOffline();

  // Don't show anything if online and not in forced offline mode
  if (isOnline && !isOfflineMode) {
    return null;
  }

  const handleSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOnline && hasPendingSync) {
      try {
        await syncWithServer();
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-warning-600 px-4 py-2 text-sm text-white shadow-md">
      <div className="flex items-center">
        <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>
          {isOnline
            ? 'Working in offline mode (forced)'
            : 'You are offline. The app will work with limited functionality.'}
        </span>
      </div>
      {hasPendingSync && isOnline && (
        <button
          onClick={handleSync}
          className="ml-4 rounded bg-white px-2 py-1 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-50"
        >
          Sync now ({pendingSyncCount})
        </button>
      )}
    </div>
  );
};

export default OfflineIndicator;