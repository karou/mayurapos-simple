// src/contexts/CartContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { cartService } from '../services/cartService';
import { Product, CartItem } from '../types/inventory.types';
import { safeJsonParse } from '../utils/type-safety';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
  isLoading: boolean;
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const TAX_RATE = 0.07; // 7% tax rate - would come from config in a real app

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate derived values
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  // Load cart from storage on mount
  useEffect(() => {
    const loadCart = async (): Promise<void> => {
      try {
        const savedCart = await storageService.getItem('cart');
        if (savedCart) {
          const parsedCart = safeJsonParse<CartItem[]>(savedCart, []);
          setItems(parsedCart);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCart(); // Mark with void to handle the floating promise
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    const saveCart = async (): Promise<void> => {
      try {
        await storageService.setItem('cart', JSON.stringify(items));
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    };

    if (!isLoading) {
      void saveCart(); // Mark with void to handle the floating promise
    }
  }, [items, isLoading]);

  const addItem = (product: Product, quantity: number): void => {
    setItems(prevItems => {
      // Check if product already exists in cart
      const existingItemIndex = prevItems.findIndex(item => item.productId === product.productId);

      if (existingItemIndex >= 0) {
        // Update existing item quantity
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        return newItems;
      } else {
        // Add new item
        return [...prevItems, {
          productId: product.productId,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity,
          image: product.images && product.images.length > 0 ? product.images[0] : null
        }];
      }
    });
  };

  const updateQuantity = (productId: string, quantity: number): void => {
    setItems(prevItems => {
      return prevItems.map(item => 
        item.productId === productId 
          ? { ...item, quantity: Math.max(1, quantity) } // Ensure quantity is at least 1
          : item
      );
    });
  };

  const removeItem = (productId: string): void => {
    setItems(prevItems => prevItems.filter(item => item.productId !== productId));
  };

  const clearCart = (): void => {
    setItems([]);
  };

  const isInCart = (productId: string): boolean => {
    return items.some(item => item.productId === productId);
  };

  const getItemQuantity = (productId: string): number => {
    const item = items.find(item => item.productId === productId);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        tax,
        total,
        isLoading,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        isInCart,
        getItemQuantity
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};