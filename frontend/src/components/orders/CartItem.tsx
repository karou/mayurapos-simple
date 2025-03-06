import React from 'react';
import { CartItem as CartItemType } from '../../types/inventory.types';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove }) => {
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value);
    if (!isNaN(newQuantity) && newQuantity > 0) {
      onUpdateQuantity(item.productId, newQuantity);
    }
  };

  const incrementQuantity = () => {
    onUpdateQuantity(item.productId, item.quantity + 1);
  };

  const decrementQuantity = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    }
  };

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Product image */}
        <div className="h-24 w-full bg-secondary-200 sm:h-auto sm:w-24">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary-100 text-secondary-400">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-secondary-900">{item.name}</h3>
              <p className="text-sm text-secondary-500">SKU: {item.sku}</p>
            </div>
            <div className="mt-2 sm:mt-0 sm:text-right">
              <p className="text-lg font-semibold text-secondary-900">${item.price.toFixed(2)}</p>
              <p className="text-sm text-secondary-500">
                Subtotal: ${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            {/* Quantity controls */}
            <div className="flex items-center">
              <label htmlFor={`quantity-${item.productId}`} className="mr-2 text-sm font-medium text-secondary-700">
                Qty:
              </label>
              <div className="flex h-9 w-32 overflow-hidden rounded-md border border-secondary-300">
                <button
                  type="button"
                  onClick={decrementQuantity}
                  className="flex h-full w-9 items-center justify-center bg-secondary-100 text-secondary-600"
                  disabled={item.quantity <= 1}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  id={`quantity-${item.productId}`}
                  className="h-full w-14 border-0 border-x border-secondary-300 text-center"
                  value={item.quantity}
                  min="1"
                  onChange={handleQuantityChange}
                />
                <button
                  type="button"
                  onClick={incrementQuantity}
                  className="flex h-full w-9 items-center justify-center bg-secondary-100 text-secondary-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(item.productId)}
              className="rounded-md p-2 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-500"
              aria-label="Remove item"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;