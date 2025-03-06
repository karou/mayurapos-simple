import { apiClient } from './apiClient';
import { 
  Product, 
  ProductWithInventory, 
  ProductInventory, 
  ProductSearchParams,
  PaginatedResponse
} from '../types/inventory.types';

class InventoryApi {
  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<ProductWithInventory> {
    const response = await apiClient.get<ProductWithInventory>(`/api/inventory/products/${productId}`);
    return response.data;
  }

  /**
   * Search products with various filters
   */
  async searchProducts(params: ProductSearchParams = {}): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<PaginatedResponse<Product>>('/api/inventory/products', { 
      params 
    });
    return response.data;
  }

  /**
   * Get inventory for a specific product
   */
  async getProductInventory(productId: string): Promise<ProductInventory[]> {
    const response = await apiClient.get<{ inventoryByStore: ProductInventory[] }>(`/api/inventory/inventory/product/${productId}`);
    return response.data.inventoryByStore;
  }

  /**
   * Get inventory for a specific store
   */
  async getStoreInventory(
    storeId: string, 
    params: { 
      lowStock?: boolean; 
      outOfStock?: boolean; 
      page?: number; 
      limit?: number 
    } = {}
  ): Promise<PaginatedResponse<ProductInventory>> {
    const response = await apiClient.get<PaginatedResponse<ProductInventory>>(`/api/inventory/inventory/store/${storeId}`, {
      params
    });
    return response.data;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(
    storeId?: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<ProductInventory>> {
    const queryParams = storeId ? { ...params, storeId } : params;
    const response = await apiClient.get<PaginatedResponse<ProductInventory>>('/api/inventory/alerts/low-stock', {
      params: queryParams
    });
    return response.data;
  }

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(orderId: string, items: { productId: string; quantity: number }[], storeId: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/api/inventory/inventory/reserve', {
        orderId,
        items,
        storeId
      });
      return response.data.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Release reserved inventory
   */
  async releaseInventory(orderId: string, storeId: string): Promise<boolean> {
    try {
      const response = await apiClient.post('/api/inventory/inventory/release', {
        orderId,
        storeId,
        reason: 'Order cancelled or timed out'
      });
      return response.data.success;
    } catch (error) {
      return false;
    }
  }
}

export const inventoryApi = new InventoryApi();