import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { inventoryApi } from '../../api/inventoryApi';
import { Product, ProductWithInventory, ProductSearchParams } from '../../types/inventory.types';

interface InventoryState {
  products: Product[];
  currentProduct: ProductWithInventory | null;
  isLoading: boolean;
  error: string | null;
  totalProducts: number;
  totalPages: number;
  currentPage: number;
}

const initialState: InventoryState = {
  products: [],
  currentProduct: null,
  isLoading: false,
  error: null,
  totalProducts: 0,
  totalPages: 1,
  currentPage: 1,
};

// Async thunks
export const fetchProducts = createAsyncThunk(
  'inventory/fetchProducts',
  async (params: ProductSearchParams = {}, { rejectWithValue }) => {
    try {
      return await inventoryApi.searchProducts(params);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch products');
    }
  }
);

export const fetchProductById = createAsyncThunk(
  'inventory/fetchProductById',
  async (productId: string, { rejectWithValue }) => {
    try {
      return await inventoryApi.getProduct(productId);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch product');
    }
  }
);

// Slice
const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch products cases
      .addCase(fetchProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.products = action.payload.items;
        state.totalProducts = action.payload.pagination.total;
        state.totalPages = action.payload.pagination.pages;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch product by ID cases
      .addCase(fetchProductById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProduct = action.payload;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentPage, clearError } = inventorySlice.actions;

export default inventorySlice.reducer;