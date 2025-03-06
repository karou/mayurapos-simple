import React, { createContext, useContext, useState, useEffect } from 'react';
import { syncService } from '../services/syncService';

interface OfflineContextType {
  isOnline: boolean;
  isOfflineMode: boolean;
  hasPendingSync: boolean;
  lastSyncTime: Date | null;
  pendingSyncCount: number;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  syncWithServer: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Network status state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // User preference for forcing offline mode even when online
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  
  // Sync status
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Monitor network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize sync status on mount
  useEffect(() => {
    const checkPendingSync = async () => {
      const pendingCount = await syncService.getPendingSyncCount();
      setPendingSyncCount(pendingCount);
      setHasPendingSync(pendingCount > 0);
      
      const lastSync = await syncService.getLastSyncTime();
      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
      }
    };

    checkPendingSync();
  }, []);

  // Attempt to sync when coming back online
  useEffect(() => {
    if (isOnline && hasPendingSync && !isOfflineMode) {
      syncWithServer();
    }
  }, [isOnline, hasPendingSync, isOfflineMode]);

  // Subscribe to pending sync changes
  useEffect(() => {
    const unsubscribe = syncService.subscribeToPendingChanges((count) => {
      setPendingSyncCount(count);
      setHasPendingSync(count > 0);
    });

    return unsubscribe;
  }, []);

  const enableOfflineMode = () => {
    setIsOfflineMode(true);
  };

  const disableOfflineMode = () => {
    setIsOfflineMode(false);
    
    // Attempt to sync if we're online and have pending changes
    if (isOnline && hasPendingSync) {
      syncWithServer();
    }
  };

  const syncWithServer = async () => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      await syncService.syncWithServer();
      setLastSyncTime(new Date());
      setPendingSyncCount(0);
      setHasPendingSync(false);
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isOfflineMode: isOfflineMode || !isOnline, // Either user preference or network status
        hasPendingSync,
        lastSyncTime,
        pendingSyncCount,
        enableOfflineMode,
        disableOfflineMode,
        syncWithServer
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};