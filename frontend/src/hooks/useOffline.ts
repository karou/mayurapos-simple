// src/hooks/useOffline.ts
import { useContext } from 'react';
import { OfflineContext } from '../contexts/OfflineContext';

// Define the type of the context
export interface OfflineContextType {
  isOnline: boolean;
  isOfflineMode: boolean;
  hasPendingSync: boolean;
  lastSyncTime: Date | null;
  pendingSyncCount: number;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  syncWithServer: () => Promise<void>;
}

/**
 * Custom hook to access the OfflineContext
 * @returns Offline context value
 */
export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  
  return context;
};