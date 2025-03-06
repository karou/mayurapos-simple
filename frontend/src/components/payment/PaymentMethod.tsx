import React from 'react';
import { PaymentMethod as PaymentMethodType } from '../../types/payment.types';

interface PaymentMethodProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  disabled?: boolean;
}

const PaymentMethod: React.FC<PaymentMethodProps> = ({
  selectedMethod,
  onSelectMethod,
  disabled = false
}) => {
  // Define available payment methods
  const paymentMethods = [
    {
      id: PaymentMethodType.CASH,
      label: 'Cash',
      description: 'Pay with cash at checkout',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      )
    },
    {
      id: PaymentMethodType.CREDIT_CARD,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, Amex, or Discover',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      )
    },
    {
      id: PaymentMethodType.DEBIT_CARD,
      label: 'Debit Card',
      description: 'Pay directly from your bank account',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
      )
    },
    {
      id: PaymentMethodType.MOBILE_PAYMENT,
      label: 'Mobile Payment',
      description: 'Pay with Apple Pay, Google Pay, or other mobile wallet',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-secondary-900">Payment Method</h3>
      
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <div key={method.id} className="relative">
            <input
              type="radio"
              id={`payment-${method.id}`}
              name="payment-method"
              className="peer sr-only"
              checked={selectedMethod === method.id}
              onChange={() => onSelectMethod(method.id)}
              disabled={disabled}
            />
            <label
              htmlFor={`payment-${method.id}`}
              className={`
                flex cursor-pointer items-center rounded-lg border p-4 transition-colors
                ${
                  selectedMethod === method.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-200 bg-white hover:bg-secondary-50'
                }
                ${disabled ? 'cursor-not-allowed opacity-60' : ''}
              `}
            >
              <div className="mr-4 flex-shrink-0">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full
                    ${
                      selectedMethod === method.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-secondary-100 text-secondary-500'
                    }
                  `}
                >
                  {method.icon}
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-medium text-secondary-900">{method.label}</h4>
                <p className="text-sm text-secondary-500">{method.description}</p>
              </div>
              <div className="ml-3 flex h-5 items-center">
                <div
                  className={`
                    flex h-5 w-5 items-center justify-center rounded-full border
                    ${
                      selectedMethod === method.id
                        ? 'border-primary-500'
                        : 'border-secondary-300'
                    }
                  `}
                >
                  {selectedMethod === method.id && (
                    <div className="h-3 w-3 rounded-full bg-primary-600"></div>
                  )}
                </div>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethod;