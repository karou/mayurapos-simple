import React, { useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';

/**
 * Toast notification component
 */
const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  // Handle keyboard events for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        removeToast(toasts[toasts.length - 1].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, removeToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 m-4 flex flex-col items-end space-y-2">
      {toasts.map((toast) => {
        // Determine the appropriate styling based on toast type
        let bgColor = 'bg-secondary-800';
        let iconColor = 'text-secondary-400';
        let icon = (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );

        if (toast.type === 'success') {
          bgColor = 'bg-success-600';
          iconColor = 'text-success-300';
          icon = (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          );
        } else if (toast.type === 'error') {
          bgColor = 'bg-danger-600';
          iconColor = 'text-danger-300';
          icon = (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          );
        } else if (toast.type === 'warning') {
          bgColor = 'bg-warning-600';
          iconColor = 'text-warning-300';
          icon = (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          );
        }

        return (
          <div
            key={toast.id}
            className={`flex w-full max-w-sm items-center rounded-lg p-4 shadow-lg ${bgColor} text-white transition-opacity duration-300`}
            role="alert"
          >
            <div className={`mr-3 flex-shrink-0 ${iconColor}`}>{icon}</div>
            <div className="flex-grow">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button
              type="button"
              className="ml-4 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white hover:bg-white hover:bg-opacity-10 focus:outline-none"
              onClick={() => removeToast(toast.id)}
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toast;