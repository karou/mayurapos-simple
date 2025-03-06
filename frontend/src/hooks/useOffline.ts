import { useContext } from 'react';
import { OfflineContext } from '../contexts/OfflineContext';

/**
 * Custom hook to access the OfflineContext
 * @returns Offline context value
 */
export const useOffline = () => {
  const context = useContext(OfflineContext);
  
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  
  return context;
};