import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/**
 * Custom hook to access the ToastContext
 * @returns Toast context value
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};