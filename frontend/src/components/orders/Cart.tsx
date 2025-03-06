import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import CartItem from './CartItem';

interface CartProps {
  onCheckout?: () => void;
  showCheckoutButton?: boolean;
}

const Cart: React.FC<CartProps> = ({ onCheckout, showCheckoutButton = true }) => {
  const { items, updateQuantity, removeItem, clearCart, subtotal, tax, total, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-100">
          <svg className="h-10 w-10 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-secondary-900">Your cart is empty</h3>
        <p className="mb-4 text-secondary-600">Looks like you haven't added any products to your cart yet.</p>
        <Link to="/inventory" className="btn-primary">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Cart items */}
      <div className="lg:col-span-2">
        <h2 className="mb-4 text-lg font-medium text-secondary-900">Shopping Cart ({itemCount} items)</h2>
        <div>
          {items.map((item) => (
            <CartItem
              key={item.productId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={clearCart}
            className="rounded-md text-sm font-medium text-secondary-600 hover:text-secondary-900"
          >
            Clear Cart
          </button>
          <Link to="/inventory" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Continue Shopping
          </Link>
        </div>
      </div>

      {/* Order summary */}
      <div>
        <div className="card overflow-hidden">
          <div className="border-b border-secondary-200 bg-secondary-50 p-4">
            <h2 className="text-lg font-medium text-secondary-900">Order Summary</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between">
                <p className="text-secondary-600">Subtotal</p>
                <p className="font-medium text-secondary-900">${subtotal.toFixed(2)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-secondary-600">Tax</p>
                <p className="font-medium text-secondary-900">${tax.toFixed(2)}</p>
              </div>
              {/* Could add discount, shipping, etc. here */}
              <div className="border-t border-secondary-200 pt-4">
                <div className="flex justify-between">
                  <p className="text-lg font-medium text-secondary-900">Total</p>
                  <p className="text-lg font-bold text-secondary-900">${total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {showCheckoutButton && (
              <div className="mt-6">
                {onCheckout ? (
                  <button
                    type="button"
                    onClick={onCheckout}
                    className="btn-primary w-full py-2 text-base"
                  >
                    Proceed to Checkout
                  </button>
                ) : (
                  <Link to="/checkout" className="btn-primary block w-full py-2 text-center text-base">
                    Proceed to Checkout
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;