import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnClickOutside?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnClickOutside = true,
  closeOnEsc = true,
  showCloseButton = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close modal
  const handleClickOutside = (e: MouseEvent) => {
    if (closeOnClickOutside && overlayRef.current === e.target) {
      onClose();
    }
  };

  // Handle escape key to close modal
  const handleEscKey = (e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      onClose();
    }
  };

  // Add event listeners when modal is open
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto'; // Restore scrolling
    };
  }, [isOpen, closeOnClickOutside, closeOnEsc]);

  // Determine modal size classes
  let sizeClasses = '';
  switch (size) {
    case 'sm':
      sizeClasses = 'max-w-sm';
      break;
    case 'md':
      sizeClasses = 'max-w-md';
      break;
    case 'lg':
      sizeClasses = 'max-w-lg';
      break;
    case 'xl':
      sizeClasses = 'max-w-xl';
      break;
    case 'full':
      sizeClasses = 'max-w-full mx-4 sm:mx-8';
      break;
    default:
      sizeClasses = 'max-w-md';
  }

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  // Create portal to render modal outside of its container in the DOM
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-secondary-900 bg-opacity-50 backdrop-blur-sm"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={`relative mx-auto my-8 w-full rounded-lg bg-white shadow-xl ${sizeClasses}`}
        ref={modalRef}
      >
        {/* Modal header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-secondary-200 px-6 py-4">
            {title && (
              <h3 className="text-lg font-medium text-secondary-900" id="modal-title">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="rounded-md p-2 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={onClose}
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Modal body */}
        <div className="px-6 py-4">{children}</div>

        {/* Modal footer */}
        {footer && (
          <div className="border-t border-secondary-200 bg-secondary-50 px-6 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;