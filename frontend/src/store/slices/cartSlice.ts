import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem, Product } from '../../types/inventory.types';

interface CartState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

const initialState: CartState = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  tax: 0,
  total: 0,
};

// Tax rate
const TAX_RATE = 0.07; // 7%

// Helper to recalculate cart totals
const recalculateTotals = (state: CartState) => {
  state.itemCount = state.items.reduce((total, item) => total + item.quantity, 0);
  state.subtotal = state.items.reduce((total, item) => total + item.price * item.quantity, 0);
  state.tax = state.subtotal * TAX_RATE;
  state.total = state.subtotal + state.tax;
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<{ product: Product; quantity: number }>) => {
      const { product, quantity } = action.payload;
      
      // Check if product already exists in cart
      const existingItemIndex = state.items.findIndex(item => item.productId === product.productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        state.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        state.items.push({
          productId: product.productId,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity,
          image: product.images && product.images.length > 0 ? product.images[0] : null,
        });
      }
      
      // Recalculate totals
      recalculateTotals(state);
    },
    
    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const { productId, quantity } = action.payload;
      
      // Find the item
      const itemIndex = state.items.findIndex(item => item.productId === productId);
      
      if (itemIndex >= 0) {
        // Update quantity (ensuring it's at least 1)
        state.items[itemIndex].quantity = Math.max(1, quantity);
        
        // Recalculate totals
        recalculateTotals(state);
      }
    },
    
    removeItem: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      
      // Remove the item
      state.items = state.items.filter(item => item.productId !== productId);
      
      // Recalculate totals
      recalculateTotals(state);
    },
    
    clearCart: (state) => {
      // Reset to initial state
      state.items = [];
      state.itemCount = 0;
      state.subtotal = 0;
      state.tax = 0;
      state.total = 0;
    },
    
    setCart: (state, action: PayloadAction<CartItem[]>) => {
      // Set cart items from storage
      state.items = action.payload;
      
      // Recalculate totals
      recalculateTotals(state);
    },
  },
});

export const { addItem, updateQuantity, removeItem, clearCart, setCart } = cartSlice.actions;

export default cartSlice.reducer;