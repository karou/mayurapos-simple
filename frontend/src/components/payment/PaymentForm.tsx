import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { PaymentMethod as PaymentMethodType, CreditCardInfo } from '../../types/payment.types';

interface PaymentFormProps {
  paymentMethod: PaymentMethodType;
  amount: number;
  onSubmit: (paymentData: any) => void;
  isProcessing: boolean;
  isOfflineMode: boolean;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  paymentMethod,
  amount,
  onSubmit,
  isProcessing,
  isOfflineMode
}) => {
  const [cashAmount, setCashAmount] = useState<string>(amount.toFixed(2));
  const [change, setChange] = useState<number>(0);

  // Calculate change for cash payment
  useEffect(() => {
    if (paymentMethod === PaymentMethodType.CASH) {
      const cashValue = parseFloat(cashAmount) || 0;
      setChange(Math.max(0, cashValue - amount));
    }
  }, [cashAmount, amount, paymentMethod]);

  // Credit card validation schema
  const creditCardSchema = Yup.object({
    cardholderName: Yup.string().required('Cardholder name is required'),
    cardNumber: Yup.string()
      .required('Card number is required')
      .matches(/^\d{13,19}$/, 'Card number must be between 13 and 19 digits'),
    expiryMonth: Yup.string()
      .required('Expiry month is required')
      .matches(/^(0[1-9]|1[0-2])$/, 'Invalid expiry month'),
    expiryYear: Yup.string()
      .required('Expiry year is required')
      .matches(/^\d{2}$/, 'Enter last 2 digits of year'),
    cvv: Yup.string()
      .required('CVV is required')
      .matches(/^\d{3,4}$/, 'CVV must be 3 or 4 digits')
  });

  // Credit card form
  const creditCardForm = useFormik<CreditCardInfo>({
    initialValues: {
      cardholderName: '',
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: ''
    },
    validationSchema: creditCardSchema,
    onSubmit: (values) => {
      onSubmit({
        method: paymentMethod,
        cardDetails: values
      });
    }
  });

  // Handle cash payment submission
  const handleCashPayment = () => {
    onSubmit({
      method: PaymentMethodType.CASH,
      cashAmount: parseFloat(cashAmount),
      change
    });
  };

  // Handle mobile payment submission
  const handleMobilePayment = () => {
    onSubmit({
      method: PaymentMethodType.MOBILE_PAYMENT
    });
  };

  // Render form based on payment method
  const renderPaymentForm = () => {
    switch (paymentMethod) {
      case PaymentMethodType.CREDIT_CARD:
      case PaymentMethodType.DEBIT_CARD:
        return (
          <form onSubmit={creditCardForm.handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="cardholderName" className="form-label">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  id="cardholderName"
                  className={`form-input ${
                    creditCardForm.touched.cardholderName && creditCardForm.errors.cardholderName
                      ? 'border-danger-300'
                      : ''
                  }`}
                  placeholder="John Doe"
                  {...creditCardForm.getFieldProps('cardholderName')}
                  disabled={isProcessing}
                />
                {creditCardForm.touched.cardholderName && creditCardForm.errors.cardholderName && (
                  <p className="form-error">{creditCardForm.errors.cardholderName}</p>
                )}
              </div>

              <div>
                <label htmlFor="cardNumber" className="form-label">
                  Card Number
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  className={`form-input ${
                    creditCardForm.touched.cardNumber && creditCardForm.errors.cardNumber
                      ? 'border-danger-300'
                      : ''
                  }`}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  {...creditCardForm.getFieldProps('cardNumber')}
                  disabled={isProcessing}
                />
                {creditCardForm.touched.cardNumber && creditCardForm.errors.cardNumber && (
                  <p className="form-error">{creditCardForm.errors.cardNumber}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expiryDate" className="form-label">
                    Expiry Date
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="expiryMonth"
                      className={`form-input w-14 ${
                        creditCardForm.touched.expiryMonth && creditCardForm.errors.expiryMonth
                          ? 'border-danger-300'
                          : ''
                      }`}
                      placeholder="MM"
                      maxLength={2}
                      {...creditCardForm.getFieldProps('expiryMonth')}
                      disabled={isProcessing}
                    />
                    <span className="flex items-center text-secondary-500">/</span>
                    <input
                      type="text"
                      id="expiryYear"
                      className={`form-input w-14 ${
                        creditCardForm.touched.expiryYear && creditCardForm.errors.expiryYear
                          ? 'border-danger-300'
                          : ''
                      }`}
                      placeholder="YY"
                      maxLength={2}
                      {...creditCardForm.getFieldProps('expiryYear')}
                      disabled={isProcessing}
                    />
                  </div>
                  {((creditCardForm.touched.expiryMonth && creditCardForm.errors.expiryMonth) ||
                    (creditCardForm.touched.expiryYear && creditCardForm.errors.expiryYear)) && (
                    <p className="form-error">
                      {creditCardForm.errors.expiryMonth || creditCardForm.errors.expiryYear}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="cvv" className="form-label">
                    CVV
                  </label>
                  <input
                    type="text"
                    id="cvv"
                    className={`form-input ${
                      creditCardForm.touched.cvv && creditCardForm.errors.cvv
                        ? 'border-danger-300'
                        : ''
                    }`}
                    placeholder="123"
                    maxLength={4}
                    {...creditCardForm.getFieldProps('cvv')}
                    disabled={isProcessing}
                  />
                  {creditCardForm.touched.cvv && creditCardForm.errors.cvv && (
                    <p className="form-error">{creditCardForm.errors.cvv}</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="btn-primary w-full py-2 text-base"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    `Pay ${isOfflineMode ? 'Offline ' : ''}$${amount.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          </form>
        );

      case PaymentMethodType.CASH:
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="cashAmount" className="form-label">
                Cash Amount
              </label>
              <input
                type="text"
                id="cashAmount"
                className="form-input"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="rounded-md bg-secondary-50 p-4">
              <div className="flex justify-between">
                <span className="font-medium text-secondary-700">Total Due:</span>
                <span className="font-semibold text-secondary-900">${amount.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="font-medium text-secondary-700">Change:</span>
                <span className="font-semibold text-secondary-900">${change.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                className="btn-primary w-full py-2 text-base"
                onClick={handleCashPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Complete ${isOfflineMode ? 'Offline ' : ''}Cash Payment`
                )}
              </button>
            </div>
          </div>
        );

      case PaymentMethodType.MOBILE_PAYMENT:
        return (
          <div className="space-y-4">
            <div className="rounded-md bg-secondary-50 p-4 text-center">
              <p className="text-secondary-700">
                Tap the Pay button to initiate mobile payment. Present the device to the customer to
                complete the payment.
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                className="btn-primary w-full py-2 text-base"
                onClick={handleMobilePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Initiate ${isOfflineMode ? 'Offline ' : ''}Mobile Payment`
                )}
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="rounded-md bg-secondary-50 p-4 text-center">
            <p className="text-secondary-700">Please select a payment method to continue.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-secondary-900">Payment Details</h3>
      
      {isOfflineMode && (
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
              <h3 className="text-sm font-medium text-warning-800">Offline Mode Payment</h3>
              <div className="mt-2 text-sm text-warning-700">
                <p>
                  You are processing an offline payment. This transaction will be synced when 
                  your device reconnects to the internet.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md bg-primary-50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-primary-800">Total Amount:</span>
          <span className="text-xl font-bold text-primary-900">${amount.toFixed(2)}</span>
        </div>
      </div>

      {renderPaymentForm()}
    </div>
  );
};

export default PaymentForm;