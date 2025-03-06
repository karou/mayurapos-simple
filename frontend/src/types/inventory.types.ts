export interface Product {
    productId: string;
    sku: string;
    name: string;
    description: string;
    category: string;
    price: number;
    costPrice: number;
    taxRate: number;
    barcode?: string;
    images?: string[];
    attributes?: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface ProductInventory {
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
    lastRestockedAt?: string;
    locationInStore?: string;
  }
  
  export interface ProductWithInventory extends Product {
    inventory: ProductInventory[];
  }
  
  export interface CartItem {
    productId: string;
    sku: string;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
  }
  
  export interface ProductSearchParams {
    query?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
  
  export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }