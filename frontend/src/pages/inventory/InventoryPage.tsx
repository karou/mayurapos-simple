import React, { useState, useEffect, useCallback } from 'react';
import { useOffline } from '../../contexts/OfflineContext';
import { useToast } from '../../contexts/ToastContext';
import { inventoryApi } from '../../api/inventoryApi';
import { storageService } from '../../services/storageService';
import { Product, ProductSearchParams } from '../../types/inventory.types';
import ProductCard from '../../components/inventory/ProductCard';

const InventoryPage: React.FC = () => {
  const { isOfflineMode } = useOffline();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Products per page
  const limit = 12;

  // Function to safely check and access product properties
  const safeString = (value: unknown): string => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return '';
  };

  // Function to load products from API or storage with improved error handling
  const loadProducts = useCallback(async (page: number, searchParams: ProductSearchParams) => {
    setIsLoading(true);

    try {
      if (isOfflineMode) {
        // Load products from local storage with error handling
        let cachedProducts;
        try {
          cachedProducts = await storageService.getProducts(
            searchParams.category ? { category: searchParams.category } : undefined
          );
        } catch (storageError) {
          console.error('Error loading products from storage:', storageError);
          cachedProducts = [];
        }
        
        // Ensure cachedProducts is an array before spreading
        const safeProducts = Array.isArray(cachedProducts) ? cachedProducts : [];
        
        // Apply client-side filtering and sorting with type safety
        let filteredProducts = [...safeProducts];
        
        // Apply search filter with safety checks
        if (searchParams.query) {
          const query = searchParams.query.toLowerCase();
          filteredProducts = filteredProducts.filter(product => {
            // Skip items that are null or not objects
            if (!product || typeof product !== 'object') return false;
            
            const name = safeString(product.name);
            const sku = safeString(product.sku);
            const description = safeString(product.description);
            
            return name.includes(query) || 
                   sku.includes(query) || 
                   description.includes(query);
          });
        }
        
        // Apply sorting with type safety
        filteredProducts.sort((a, b) => {
          let comparison = 0;
          
          if (searchParams.sortBy === 'name') {
            const nameA = safeString(a.name);
            const nameB = safeString(b.name);
            comparison = nameA.localeCompare(nameB);
          } else if (searchParams.sortBy === 'price') {
            const priceA = typeof a.price === 'number' ? a.price : 0;
            const priceB = typeof b.price === 'number' ? b.price : 0;
            comparison = priceA - priceB;
          }
          
          return searchParams.sortOrder === 'asc' ? comparison : -comparison;
        });
        
        // Apply pagination
        const startIndex = (page - 1) * limit;
        const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);
        
        setProducts(paginatedProducts);
        setTotalProducts(filteredProducts.length);
      } else {
        // Load from API with error handling
        try {
          // Use the provided searchParams, but ensure page is correctly set
          const params: ProductSearchParams = {
            ...searchParams,
            page, // Use the page parameter passed to the function
            limit: searchParams.limit || limit
          };
          
          // Load products from API
          const response = await inventoryApi.searchProducts(params);
          
          // Safely access response properties
          const items = Array.isArray(response?.items) ? response.items : [];
          const pagination = response?.pagination || { total: 0, pages: 1 };
          
          setProducts(items);
          setTotalProducts(pagination.total || 0);
          
          // Cache products in local storage for offline use
          if (items.length > 0) {
            try {
              await storageService.storeProducts(items);
            } catch (cacheError) {
              console.error('Failed to cache products:', cacheError);
            }
          }
          
          // Collect categories from products if not loaded yet
          if (categories.length === 0) {
            try {
              const uniqueCategories = Array.from(
                new Set(items.filter(Boolean).map(product => 
                  typeof product.category === 'string' ? product.category : ''
                ))
              ).filter(Boolean);
              
              setCategories(uniqueCategories);
            } catch (categoryError) {
              console.error('Failed to extract categories:', categoryError);
            }
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          showToast('Failed to load products', 'error');
          // Set safe defaults on API error
          setProducts([]);
          setTotalProducts(0);
        }
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      showToast('Failed to load products', 'error');
      // Set safe defaults on any error
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    searchQuery,
    selectedCategory,
    sortBy,
    sortOrder,
    isOfflineMode,
    showToast,
    categories.length,
    limit,
  ]);

  // Load products when dependencies change
  useEffect(() => {
    void loadProducts(currentPage, {
      query: searchQuery,
      category: selectedCategory,
      sortBy,
      sortOrder,
      limit
    });
  }, [loadProducts, currentPage, searchQuery, selectedCategory, sortBy, sortOrder, limit]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  // Handle category filter change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1); // Reset to first page on category change
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'name_asc') {
      setSortBy('name');
      setSortOrder('asc');
    } else if (value === 'name_desc') {
      setSortBy('name');
      setSortOrder('desc');
    } else if (value === 'price_asc') {
      setSortBy('price');
      setSortOrder('asc');
    } else if (value === 'price_desc') {
      setSortBy('price');
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalProducts / limit);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Products</h1>
        {isOfflineMode && (
          <span className="badge-warning badge">Offline Mode</span>
        )}
      </div>

      {/* Filters and search */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Search */}
          <div>
            <label htmlFor="search" className="form-label">
              Search Products
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-secondary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                className="form-input pl-10"
                placeholder="Search by name, SKU or description"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          {/* Category filter */}
          <div>
            <label htmlFor="category" className="form-label">
              Category
            </label>
            <select
              id="category"
              className="form-input mt-1"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label htmlFor="sort" className="form-label">
              Sort By
            </label>
            <select
              id="sort"
              className="form-input mt-1"
              value={`${sortBy}_${sortOrder}`}
              onChange={handleSortChange}
            >
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-sm">
          <svg
            className="mb-4 h-16 w-16 text-secondary-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="text-lg font-medium text-secondary-900">No products found</h3>
          <p className="mt-2 text-secondary-600">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-secondary-500">
            Showing {(currentPage - 1) * limit + 1}-
            {Math.min(currentPage * limit, totalProducts)} of {totalProducts} products
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard 
                key={typeof product.productId === 'string' ? product.productId : `product-${Math.random()}`} 
                product={product} 
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            className="btn-secondary"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="text-sm text-secondary-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-secondary"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;