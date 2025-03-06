import React from 'react';
import { useNavigate } from 'react-router-dom';
import Cart from '../../components/orders/Cart';
import { useCart } from '../../hooks/useCart';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items } = useCart();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-secondary-900">Shopping Cart</h1>
      <Cart onCheckout={handleCheckout} showCheckoutButton={items.length > 0} />
    </div>
  );
};

export default CartPage;