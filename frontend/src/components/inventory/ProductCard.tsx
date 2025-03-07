// src/components/inventory/ProductCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { Product } from '../../types/inventory.types';
import { isArray, safeGet } from '../../utils/type-safety';

interface ProductCardProps {
  product: Product;
  showAddToCart?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, showAddToCart = true }) => {
  const { addItem, isInCart, getItemQuantity } = useCart();

  const handleAddToCart = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
  };

  // Format price with correct currency
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Get stock status
  const getStockStatus = (): { text: string; color: string } => {
    // Safely access inventory data
    const inventory = safeGet(product, 'inventory');
    const firstInventory = isArray(inventory) && inventory.length > 0 ? inventory[0] : null;
    
    if (!firstInventory) {
      return { text: 'Unknown', color: 'bg-secondary-100 text-secondary-800' };
    }

    const quantity = safeGet(firstInventory, 'availableQuantity') ?? 0;
    const reorderPoint = safeGet(firstInventory, 'reorderPoint') ?? 0;

    if (quantity <= 0) {
      return { text: 'Out of Stock', color: 'bg-danger-100 text-danger-800' };
    } else if (quantity <= reorderPoint) {
      return { text: 'Low Stock', color: 'bg-warning-100 text-warning-800' };
    } else {
      return { text: 'In Stock', color: 'bg-success-100 text-success-800' };
    }
  };

  const stockStatus = getStockStatus();
  const inCart = isInCart(product.productId);
  const cartQuantity = inCart ? getItemQuantity(product.productId) : 0;
  const productImage = isArray(product.images) && product.images.length > 0 ? product.images[0] : null;

  return (
    <Link to={`/inventory/${product.productId}`} className="block">
      <div className="card h-full transform transition-all duration-200 hover:shadow-lg">
        <div className="relative">
          {/* Default image or product image */}
          <div className="relative h-48 bg-secondary-200">
            {productImage ? (
              <img
                src={productImage}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary-100 text-secondary-400">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            {/* Badge for stock status */}
            <div className="absolute right-2 top-2">
              <span className={`badge ${stockStatus.color}`}>{stockStatus.text}</span>
            </div>
            {/* Badge for cart quantity */}
            {inCart && (
              <div className="absolute left-2 top-2">
                <span className="badge bg-primary-100 text-primary-800">
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  {cartQuantity}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="mb-1 text-xs text-secondary-500">{product.sku}</div>
          <h3 className="mb-2 text-lg font-medium text-secondary-900 line-clamp-2">{product.name}</h3>
          <div className="mb-3 text-sm text-secondary-600 line-clamp-2">{product.description}</div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-secondary-900">{formatPrice(product.price)}</span>
            {showAddToCart && (
              <button
                onClick={handleAddToCart}
                className="btn-primary btn-sm flex items-center"
                disabled={stockStatus.text === 'Out of Stock'}
              >
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;