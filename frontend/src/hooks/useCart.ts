import { useContext } from 'react';
import { CartContext } from '../contexts/CartContext';

/**
 * Custom hook to access the CartContext
 * @returns Cart context value
 */
export const useCart = () => {
  const context = useContext(CartContext);
  
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
};