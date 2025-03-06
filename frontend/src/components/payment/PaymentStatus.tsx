import React from 'react';
import { Link } from 'react-router-dom';
import { PaymentStatus as PaymentStatusType } from '../../types/payment.types';

interface PaymentStatusProps {
  status: PaymentStatusType;
  paymentId: string;
  orderId: string;
  amount: number;
  isOffline: boolean;
  onClose?: () => void;
  onPrintReceipt?: () => void;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({
  status,
  paymentId,
  orderId,
  amount,
  isOffline,
  onClose,
  onPrintReceipt
}) => {
  const isSuccessful = status === PaymentStatusType.COMPLETED;

  return (
    <div className="text-center">
      <div className="mb-6 space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary-100">
          {isSuccessful ? (
            <svg className="h-12 w-12 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg className="h-12 w-12 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>

        <h2 className="text-2xl font-bold text-secondary-900">
          {isSuccessful ? 'Payment Successful' : 'Payment Failed'}
        </h2>

        <p className="text-secondary-600">
          {isSuccessful
            ? `Your payment of $${amount.toFixed(2)} has been processed successfully${
                isOffline ? ' (offline)' : ''
              }.`
            : 'There was a problem processing your payment. Please try again.'}
        </p>
      </div>

      <div className="rounded-md bg-secondary-50 p-4">
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="font-medium text-secondary-600">Payment ID:</dt>
            <dd className="text-secondary-900">{paymentId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-secondary-600">Order ID:</dt>
            <dd className="text-secondary-900">{orderId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-secondary-600">Amount:</dt>
            <dd className="font-semibold text-secondary-900">${amount.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-secondary-600">Status:</dt>
            <dd
              className={`font-semibold ${
                isSuccessful ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              {status}
              {isOffline && isSuccessful && ' (Offline)'}
            </dd>
          </div>
        </dl>
      </div>

      {isOffline && isSuccessful && (
        <div className="mt-6 rounded-md bg-warning-50 p-4 text-left">
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
              <h3 className="text-sm font-medium text-warning-800">Offline Transaction</h3>
              <div className="mt-2 text-sm text-warning-700">
                <p>
                  This payment was processed in offline mode. It will be synchronized with the server
                  when your device reconnects to the internet.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {isSuccessful && onPrintReceipt && (
          <button
            type="button"
            onClick={onPrintReceipt}
            className="btn-secondary w-full py-2 text-base"
          >
            <svg className="mr-2 -ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Receipt
          </button>
        )}

        {isSuccessful ? (
          <Link to={`/orders/${orderId}`} className="btn-primary block w-full py-2 text-center text-base">
            View Order
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="btn-primary w-full py-2 text-base"
          >
            Try Again
          </button>
        )}

        {isSuccessful && (
          <Link to="/dashboard" className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700">
            Return to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
};

export default PaymentStatus;