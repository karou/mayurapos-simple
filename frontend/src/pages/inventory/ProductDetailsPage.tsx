import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOffline } from '../../contexts/OfflineContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { inventoryApi } from '../../api/inventoryApi';
import { storageService } from '../../services/storageService';
import { ProductWithInventory } from '../../types/inventory.types';
import StockIndicator from '../../components/inventory/StockIndicator';

const ProductDetailsPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { isOfflineMode } = useOffline();
  const { addItem, isInCart, getItemQuantity, updateQuantity } = useCart();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<ProductWithInventory | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) return;

      setIsLoading(true);
      try {
        if (isOfflineMode) {
          
          // Try to load from local storage with full type safety
          try {
            // First get raw data from storage
            const rawData = await storageService.getProducts();
            
            // Verify we have an array to work with
            if (!Array.isArray(rawData)) {
              throw new Error("Storage did not return an array");
            }
            
            // Use a safer approach - we'll manually loop and check types
            // without directly accessing properties on potentially unsafe objects
            let matchingItem: Record<string, unknown> | null = null;
            
            for (let i = 0; i < rawData.length; i++) {
              const item = rawData[i];
              
              // Very carefully check type and existence of properties
              if (item === null || typeof item !== 'object') continue;
              
              // Skip to safe access patterns without intermediate assignment
              if (!('productId' in item)) continue;
              
              // Safe access after property existence check
              const potentialId = (item as Record<string, unknown>).productId;
              if (typeof potentialId !== 'string') continue;
              
              // Now check if it matches our target productId
              if (potentialId === productId) {
                matchingItem = item as Record<string, unknown>;
                break;
              }
            }
            
            // If no matching item found, throw error to handle in catch block
            if (!matchingItem) {
              throw new Error("Product not found in offline storage");
            }
            
            // Now we'll manually construct a type-safe product object
            // Create safe getter functions for different property types
            const safeString = (obj: unknown, prop: string): string => {
              if (obj && typeof obj === 'object' && prop in obj) {
                const value = (obj as Record<string, unknown>)[prop];
                return typeof value === 'string' ? value : '';
              }
              return '';
            };
            
            const safeNumber = (obj: unknown, prop: string): number => {
              if (obj && typeof obj === 'object' && prop in obj) {
                const value = (obj as Record<string, unknown>)[prop];
                return typeof value === 'number' ? value : 0;
              }
              return 0;
            };
            
            const safeBoolean = (obj: unknown, prop: string): boolean => {
              if (obj && typeof obj === 'object' && prop in obj) {
                const value = (obj as Record<string, unknown>)[prop];
                return typeof value === 'boolean' ? value : false;
              }
              return false;
            };
            
            // Type safe array checking
            const safeArray = (obj: unknown, prop: string): unknown[] => {
              if (obj && typeof obj === 'object' && prop in obj) {
                const value = (obj as Record<string, unknown>)[prop];
                return Array.isArray(value) ? value : [];
              }
              return [];
            };
            
            // Type safe object checking
            const safeObject = (obj: unknown, prop: string): Record<string, unknown> => {
              if (obj && typeof obj === 'object' && prop in obj) {
                const value = (obj as Record<string, unknown>)[prop];
                return value && typeof value === 'object' && !Array.isArray(value) 
                  ? value as Record<string, unknown> 
                  : {};
              }
              return {};
            };
            
            // Build a properly typed inventory array
            const inventory: Array<{
              inventoryId: string;
              productId: string;
              storeId: string;
              quantity: number;
              reservedQuantity: number;
              availableQuantity: number;
              backorderEnabled: boolean;
              backorderLimit: number;
              reorderPoint: number;
              reorderQuantity: number;
              lastRestockedAt: string;
              locationInStore: string;
            }> = [];
            
            // Safely process inventory array
            const rawInventory = safeArray(matchingItem, 'inventory');
            for (const inv of rawInventory) {
              if (inv && typeof inv === 'object') {
                inventory.push({
                  inventoryId: safeString(inv, 'inventoryId'),
                  productId: safeString(inv, 'productId'),
                  storeId: safeString(inv, 'storeId'),
                  quantity: safeNumber(inv, 'quantity'),
                  reservedQuantity: safeNumber(inv, 'reservedQuantity'),
                  availableQuantity: safeNumber(inv, 'availableQuantity'),
                  backorderEnabled: safeBoolean(inv, 'backorderEnabled'),
                  backorderLimit: safeNumber(inv, 'backorderLimit'),
                  reorderPoint: safeNumber(inv, 'reorderPoint'),
                  reorderQuantity: safeNumber(inv, 'reorderQuantity'),
                  lastRestockedAt: safeString(inv, 'lastRestockedAt'),
                  locationInStore: safeString(inv, 'locationInStore')
                });
              }
            }
            
            // Now build a complete product with proper typing
            const safeProduct: ProductWithInventory = {
              productId: safeString(matchingItem, 'productId'),
              name: safeString(matchingItem, 'name'),
              sku: safeString(matchingItem, 'sku'),
              description: safeString(matchingItem, 'description'),
              category: safeString(matchingItem, 'category'),
              price: safeNumber(matchingItem, 'price'),
              costPrice: safeNumber(matchingItem, 'costPrice'),
              taxRate: safeNumber(matchingItem, 'taxRate'),
              isActive: safeBoolean(matchingItem, 'isActive'),
              createdAt: safeString(matchingItem, 'createdAt'),
              updatedAt: safeString(matchingItem, 'updatedAt'),
              barcode: safeString(matchingItem, 'barcode'),
              images: safeArray(matchingItem, 'images').map(img => 
                typeof img === 'string' ? img : ''
              ).filter(Boolean),
              attributes: safeObject(matchingItem, 'attributes'),
              inventory
            };
            
            // Set the product to state - safeProduct is already typed as ProductWithInventory
            setProduct(safeProduct);
          } catch (error) {
            console.error('Failed to load product from storage:', error);
            showToast('Product not found in offline storage', 'error');
            navigate('/inventory');
          }
        } else {
          try {
            // Load from API
            const response = await inventoryApi.getProduct(productId);
            
            // Create our own type-safe copies of the returned data
            
            // Process inventory data
            const inventory = (Array.isArray(response.inventory) ? response.inventory : [])
              .map(inv => ({
                inventoryId: typeof inv.inventoryId === 'string' ? inv.inventoryId : '',
                productId: typeof inv.productId === 'string' ? inv.productId : '',
                storeId: typeof inv.storeId === 'string' ? inv.storeId : '',
                quantity: typeof inv.quantity === 'number' ? inv.quantity : 0,
                reservedQuantity: typeof inv.reservedQuantity === 'number' ? inv.reservedQuantity : 0,
                availableQuantity: typeof inv.availableQuantity === 'number' ? inv.availableQuantity : 0,
                backorderEnabled: typeof inv.backorderEnabled === 'boolean' ? inv.backorderEnabled : false,
                backorderLimit: typeof inv.backorderLimit === 'number' ? inv.backorderLimit : 0,
                reorderPoint: typeof inv.reorderPoint === 'number' ? inv.reorderPoint : 0, 
                reorderQuantity: typeof inv.reorderQuantity === 'number' ? inv.reorderQuantity : 0,
                lastRestockedAt: typeof inv.lastRestockedAt === 'string' ? inv.lastRestockedAt : '',
                locationInStore: typeof inv.locationInStore === 'string' ? inv.locationInStore : ''
              }));
            
            // Process images array
            const images = Array.isArray(response.images) 
              ? response.images.filter(img => typeof img === 'string') 
              : [];
            
            // Process attributes object
            const attributes: Record<string, unknown> = {};
            if (response.attributes && typeof response.attributes === 'object') {
              Object.entries(response.attributes).forEach(([key, value]) => {
                attributes[key] = value;
              });
            }
            
            // Create a properly typed product object
            const typedProduct: ProductWithInventory = {
              productId: typeof response.productId === 'string' ? response.productId : '',
              name: typeof response.name === 'string' ? response.name : '',
              sku: typeof response.sku === 'string' ? response.sku : '',
              description: typeof response.description === 'string' ? response.description : '',
              category: typeof response.category === 'string' ? response.category : '',
              price: typeof response.price === 'number' ? response.price : 0,
              costPrice: typeof response.costPrice === 'number' ? response.costPrice : 0,
              taxRate: typeof response.taxRate === 'number' ? response.taxRate : 0,
              isActive: typeof response.isActive === 'boolean' ? response.isActive : false,
              createdAt: typeof response.createdAt === 'string' ? response.createdAt : '',
              updatedAt: typeof response.updatedAt === 'string' ? response.updatedAt : '',
              barcode: typeof response.barcode === 'string' ? response.barcode : '',
              images,
              attributes,
              inventory
            };
            
            // Explicitly type the final product
            const finalProduct: ProductWithInventory = typedProduct;
            
            // Save the typed product to state with explicit type assertion
            setProduct(finalProduct);
            
            // Store in local storage for offline use
            await storageService.storeProducts([finalProduct]);
          } catch (error) {
            console.error('Failed to load product:', error);
            showToast('Failed to load product details', 'error');
            navigate('/inventory');
          }
        }
      } catch (error) {
        console.error('Failed to load product:', error);
        showToast('Failed to load product details', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProduct();
  }, [productId, isOfflineMode, navigate, showToast]);

  // Initialize quantity from cart if already in cart
  useEffect(() => {
    if (product && isInCart(product.productId)) {
      setQuantity(getItemQuantity(product.productId));
    } else {
      setQuantity(1);
    }
  }, [product, isInCart, getItemQuantity]);

  const handleAddToCart = () => {
    if (!product) return;

    if (isInCart(product.productId)) {
      // Update quantity if already in cart
      updateQuantity(product.productId, quantity);
      showToast('Cart updated', 'success');
    } else {
      // Add to cart if not in cart
      addItem(product, quantity);
      showToast('Added to cart', 'success');
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  const handleIncreaseQuantity = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecreaseQuantity = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  // Format price with correct currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Check if product is out of stock
  const isOutOfStock = () => {
    if (!product || !product.inventory || product.inventory.length === 0) {
      return true;
    }
    return product.inventory[0].availableQuantity <= 0;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-medium text-secondary-900">Product not found</h2>
        <p className="mt-2 text-secondary-600">
          The product you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <button
          onClick={() => navigate('/inventory')}
          className="mt-4 btn-primary"
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center text-primary-600 hover:text-primary-700"
      >
        <svg className="mr-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Products
      </button>

      <div className="rounded-lg bg-white shadow-sm">
        <div className="grid gap-8 p-6 md:grid-cols-2">
          {/* Product Image */}
          <div className="flex items-center justify-center bg-secondary-100 p-4">
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="max-h-80 max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                }}
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center bg-secondary-100 text-secondary-400">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* Product Details */}
          <div>
            <div className="mb-2 text-sm text-secondary-500">SKU: {product.sku}</div>
            <h1 className="mb-4 text-3xl font-bold text-secondary-900">{product.name}</h1>
            
            <div className="mb-6 flex items-baseline">
              <span className="text-3xl font-bold text-secondary-900">{formatPrice(product.price)}</span>
              {product.costPrice && (
                <span className="ml-4 text-sm text-secondary-500">
                  Cost: {formatPrice(product.costPrice)}
                </span>
              )}
            </div>

            {/* Stock status */}
            <div className="mb-6">
              {product.inventory && product.inventory.length > 0 ? (
                <StockIndicator
                  quantity={product.inventory[0].quantity}
                  reservedQuantity={product.inventory[0].reservedQuantity}
                  reorderPoint={product.inventory[0].reorderPoint}
                  size="lg"
                />
              ) : (
                <div className="text-warning-600">Stock status unavailable</div>
              )}
            </div>

            {/* Product description */}
            <div className="mb-6">
              <h3 className="mb-2 text-lg font-medium text-secondary-900">Description</h3>
              <p className="text-secondary-600">{product.description}</p>
            </div>

            {/* Category */}
            <div className="mb-6">
              <span className="badge-primary badge">{product.category}</span>
            </div>

            {/* Add to cart section */}
            <div className="mt-8 border-t pt-6">
              <div className="mb-4 flex items-center">
                <label htmlFor="quantity" className="mr-4 text-sm font-medium text-secondary-700">
                  Quantity:
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-l-md border border-secondary-300 bg-secondary-50 hover:bg-secondary-100"
                    onClick={handleDecreaseQuantity}
                  >
                    <svg className="h-4 w-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    className="h-10 w-16 border-y border-secondary-300 bg-white text-center text-secondary-900"
                    value={quantity}
                    onChange={handleQuantityChange}
                    min="1"
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-r-md border border-secondary-300 bg-secondary-50 hover:bg-secondary-100"
                    onClick={handleIncreaseQuantity}
                  >
                    <svg className="h-4 w-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="btn-primary w-full py-3 text-base"
                disabled={isOutOfStock()}
              >
                {isInCart(product.productId) ? 'Update Cart' : 'Add to Cart'}
              </button>
              
              {isOutOfStock() && (
                <p className="mt-2 text-center text-sm text-danger-600">
                  This product is currently out of stock
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Additional product details */}
        <div className="border-t p-6">
          <h3 className="mb-4 text-lg font-medium text-secondary-900">Additional Information</h3>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Tax information */}
            <div className="rounded-lg bg-secondary-50 p-4">
              <div className="text-sm font-medium text-secondary-500">Tax Rate</div>
              <div className="text-secondary-900">{(product.taxRate * 100).toFixed(1)}%</div>
            </div>
            
            {/* Barcode */}
            {product.barcode && (
              <div className="rounded-lg bg-secondary-50 p-4">
                <div className="text-sm font-medium text-secondary-500">Barcode</div>
                <div className="text-secondary-900">{product.barcode}</div>
              </div>
            )}
            
            {/* Created at */}
            <div className="rounded-lg bg-secondary-50 p-4">
              <div className="text-sm font-medium text-secondary-500">Added On</div>
              <div className="text-secondary-900">
                {new Date(product.createdAt).toLocaleDateString()}
              </div>
            </div>
            
            {/* Updated at */}
            <div className="rounded-lg bg-secondary-50 p-4">
              <div className="text-sm font-medium text-secondary-500">Last Updated</div>
              <div className="text-secondary-900">
                {new Date(product.updatedAt).toLocaleDateString()}
              </div>
            </div>
            
            {/* Active status */}
            <div className="rounded-lg bg-secondary-50 p-4">
              <div className="text-sm font-medium text-secondary-500">Status</div>
              <div className="flex items-center">
                <span className={`mr-2 block h-2 w-2 rounded-full ${product.isActive ? 'bg-success-500' : 'bg-danger-500'}`}></span>
                <span className="text-secondary-900">{product.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
          
          {/* Product attributes (if any) */}
          {product.attributes && Object.keys(product.attributes).length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-md font-medium text-secondary-900">Attributes</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-secondary-50 p-4">
                    <div className="text-sm font-medium text-secondary-500">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </div>
                    <div className="text-secondary-900">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;