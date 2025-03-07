import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
//import { useFormik } from 'formik';
//import * as Yup from 'yup';
import { useCart } from '../../hooks/useCart';
import { useOffline } from '../../hooks/useOffline';
import { useToast } from '../../hooks/useToast';
import { syncService } from '../../services/syncService';
import { PaymentMethod as PaymentMethodType } from '../../types/payment.types';
import { PaymentStatus as PaymentStatusType } from '../../types/payment.types';
import PaymentStatusComponent from '../../components/payment/PaymentStatus';
import PaymentMethod from '../../components/payment/PaymentMethod';
import PaymentForm from '../../components/payment/PaymentForm';
import Modal from '../../components/common/Modal';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, tax, total, clearCart } = useCart();
  const { isOfflineMode } = useOffline();
  const { showToast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>(PaymentMethodType.CREDIT_CARD);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<{
    isVisible: boolean;
    status: PaymentStatusType;
    paymentId: string;
    orderId: string;
    amount: number;
    isOffline: boolean;
  }>({
    isVisible: false,
    status: PaymentStatusType.PENDING,
    paymentId: '',
    orderId: '',
    amount: 0,
    isOffline: false,
  });

  // Check if cart is empty and redirect to inventory if it is
  useEffect(() => {
    if (items.length === 0) {
      navigate('/inventory');
    }
  }, [items, navigate]);

  // Form validation schema for shipping/billing info
  /*const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    email: Yup.string().email('Invalid email address').required('Email is required'),
    address: Yup.string().required('Address is required'),
    city: Yup.string().required('City is required'),
    state: Yup.string().required('State is required'),
    zip: Yup.string().required('ZIP code is required'),
    sameAsBilling: Yup.boolean(),
  });*/

  // Initialize formik
  /*const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      sameAsBilling: true,
      billingName: '',
      billingAddress: '',
      billingCity: '',
      billingState: '',
      billingZip: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      // In a real application, this would create an order and proceed to payment
      try {
        // Create order
        const result = await cartService.createOrder(items, isOfflineMode, {
          customerName: values.name,
          customerEmail: values.email,
          shippingAddress: {
            street: values.address,
            city: values.city,
            state: values.state,
            zip: values.zip,
            country: 'US', // Default to US for now
          },
          billingAddress: values.sameAsBilling
            ? {
                street: values.address,
                city: values.city,
                state: values.state,
                zip: values.zip,
                country: 'US', // Default to US for now
              }
            : {
                street: values.billingAddress,
                city: values.billingCity,
                state: values.billingState,
                zip: values.billingZip,
                country: 'US', // Default to US for now
              },
        });

        if (result.success) {
          showToast('Order created successfully', 'success');
          // Proceed to payment step
          handleProceedToPayment(result.orderId);
        } else {
          showToast('Failed to create order', 'error');
        }
      } catch (error) {
        console.error('Order creation error:', error);
        showToast('Failed to create order', 'error');
      }
    },
  });*/

  // Handle proceeding to payment after order creation
  /*const handleProceedToPayment = (orderId: string) => {
    // In a real implementation, this would show the payment form
    // or redirect to a payment gateway
    console.log('Proceeding to payment for order:', orderId);
  };*/

  // Handle payment submission
  const handlePaymentSubmit = async (paymentData: any) => {
    setIsProcessingPayment(true);
    
    try {
      // In a real implementation, this would process the payment
      // through a payment service or gateway
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Process payment using offline mode if needed
      const paymentId = isOfflineMode
        ? await syncService.processOfflinePayment(
            'order123', // Placeholder orderId
            total,
            selectedPaymentMethod,
            { paymentData }
          )
        : 'payment789'; // Placeholder paymentId
      
      // Show success status
      setPaymentStatus({
        isVisible: true,
        status: PaymentStatusType.COMPLETED,
        paymentId,
        orderId: 'order123', // Placeholder orderId
        amount: total,
        isOffline: isOfflineMode,
      });
      
      // Clear cart after successful payment
      clearCart();
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Payment processing failed', 'error');
      
      // Show failure status
      setPaymentStatus({
        isVisible: true,
        status: PaymentStatusType.FAILED,
        paymentId: '',
        orderId: 'order123', // Placeholder orderId
        amount: total,
        isOffline: isOfflineMode,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle closing payment status modal
  const handleClosePaymentStatus = () => {
    setPaymentStatus(prev => ({ ...prev, isVisible: false }));
    
    // Redirect to orders page if payment was successful
    if (paymentStatus.status === PaymentStatusType.COMPLETED) {
      navigate('/orders');
    }
  };

  // Handle print receipt
  const handlePrintReceipt = () => {
    // In a real implementation, this would print the receipt
    window.print();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-secondary-900">Checkout</h1>
      
      {/* Order Summary */}
      <div className="mb-8 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-secondary-900">Order Summary</h2>
        <div className="border-b border-secondary-200 pb-4">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between py-2">
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="text-secondary-500"> × {item.quantity}</span>
              </div>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-secondary-600">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-600">Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-secondary-200 pt-2 font-semibold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Payment Method Selection */}
      <div className="mb-8 rounded-lg bg-white p-4 shadow-sm">
        <PaymentMethod
          selectedMethod={selectedPaymentMethod}
          onSelectMethod={setSelectedPaymentMethod}
          disabled={isProcessingPayment}
        />
      </div>
      
      {/* Payment Form */}
      <div className="mb-8 rounded-lg bg-white p-4 shadow-sm">
        <PaymentForm
          paymentMethod={selectedPaymentMethod}
          amount={total}
          onSubmit={handlePaymentSubmit}
          isProcessing={isProcessingPayment}
          isOfflineMode={isOfflineMode}
        />
      </div>
      
      {/* Payment Status Modal */}
      <Modal
        isOpen={paymentStatus.isVisible}
        onClose={handleClosePaymentStatus}
        title="Payment Status"
        size="md"
        closeOnClickOutside={false}
        closeOnEsc={false}
        showCloseButton={false}
      >
        <PaymentStatusComponent
          status={paymentStatus.status}
          paymentId={paymentStatus.paymentId}
          orderId={paymentStatus.orderId}
          amount={paymentStatus.amount}
          isOffline={paymentStatus.isOffline}
          onClose={handleClosePaymentStatus}
          onPrintReceipt={handlePrintReceipt}
        />
      </Modal>
    </div>
  );
};

export default CheckoutPage;