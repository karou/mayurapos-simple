import React, { useState, useEffect } from 'react';
import { Product, ProductSearchParams } from '../../types/inventory.types';
import { useOffline } from '../../contexts/OfflineContext';
import { storageService } from '../../services/storageService';
import { inventoryApi } from '../../api/inventoryApi';
import ProductCard from './ProductCard';

interface ProductListProps {
  initialFilters?: ProductSearchParams;
}

const ProductList: React.FC<ProductListProps> = ({ initialFilters = {} }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<ProductSearchParams>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { isOfflineMode } = useOffline();

  // Define available categories (this would come from an API in a real app)
  const categories = [
    'All Categories',
    'Electronics',
    'Clothing',
    'Food',
    'Beverages',
    'Home',
    'Office'
  ];

  useEffect(() => {
    // Reset page when filters change
    setCurrentPage(1);
    loadProducts(1, filters);
  }, [filters]);

  useEffect(() => {
    loadProducts(currentPage, filters);
  }, [currentPage, isOfflineMode]);

  const loadProducts = async (page: number, searchParams: ProductSearchParams) => {
    setIsLoading(true);

    try {
      if (isOfflineMode) {
        // Load from local storage
        const cachedProducts = await storageService.getProducts({
          category: searchParams.category === 'All Categories' ? undefined : searchParams.category
        });
        
        // Apply filters client-side for offline mode
        let filteredProducts = [...cachedProducts];
        
        if (searchParams.query) {
          const query = searchParams.query.toLowerCase();
          filteredProducts = filteredProducts.filter(
            product => 
              product.name.toLowerCase().includes(query) || 
              product.sku.toLowerCase().includes(query) ||
              product.description?.toLowerCase().includes(query)
          );
        }
        
        if (searchParams.minPrice !== undefined) {
          filteredProducts = filteredProducts.filter(
            product => product.price >= (searchParams.minPrice || 0)
          );
        }
        
        if (searchParams.maxPrice !== undefined) {
          filteredProducts = filteredProducts.filter(
            product => product.price <= (searchParams.maxPrice || Infinity)
          );
        }
        
        if (searchParams.isActive !== undefined) {
          filteredProducts = filteredProducts.filter(
            product => product.isActive === searchParams.isActive
          );
        }
        
        // Handle sorting
        const sortBy = searchParams.sortBy || 'name';
        const sortOrder = searchParams.sortOrder || 'asc';
        
        filteredProducts.sort((a, b) => {
          if (sortBy === 'price') {
            return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
          } else {
            // Default sort by name
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            return sortOrder === 'asc' 
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          }
        });
        
        // Handle pagination
        const limit = searchParams.limit || 12;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        
        setProducts(paginatedProducts);
        setTotalProducts(filteredProducts.length);
        setTotalPages(Math.ceil(filteredProducts.length / limit));
      } else {
        // Load from API
        const response = await inventoryApi.searchProducts({
          ...searchParams,
          page,
          limit: searchParams.limit || 12,
          // Don't send 'All Categories' to the API
          category: searchParams.category === 'All Categories' ? undefined : searchParams.category
        });
        
        setProducts(response.items);
        setTotalProducts(response.pagination.total);
        setTotalPages(response.pagination.pages);
        
        // Cache products for offline use
        await storageService.storeProducts(response.items);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFilters(prev => ({ ...prev, category }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setFilters(prev => ({ ...prev, query }));
  };

  const handleActiveFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === 'all') {
      // Remove isActive filter
      const { isActive, ...restFilters } = filters;
      setFilters(restFilters);
    } else {
      setFilters(prev => ({ ...prev, isActive: value === 'active' }));
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="form-label">
              Search
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search products..."
              className="form-input"
              value={filters.query || ''}
              onChange={handleSearchChange}
            />
          </div>

          {/* Category filter */}
          <div>
            <label htmlFor="category" className="form-label">
              Category
            </label>
            <select
              id="category"
              className="form-input"
              value={filters.category || 'All Categories'}
              onChange={handleCategoryChange}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Active/Inactive filter */}
          <div>
            <label htmlFor="status" className="form-label">
              Status
            </label>
            <select
              id="status"
              className="form-input"
              value={filters.isActive === undefined ? 'all' : filters.isActive ? 'active' : 'inactive'}
              onChange={handleActiveFilterChange}
            >
              <option value="all">All Products</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Sort filter */}
          <div>
            <label htmlFor="sort" className="form-label">
              Sort By
            </label>
            <select
              id="sort"
              className="form-input"
              value={`${filters.sortBy || 'name'}-${filters.sortOrder || 'asc'}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                setFilters(prev => ({ ...prev, sortBy, sortOrder: sortOrder as 'asc' | 'desc' }));
              }}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      )}

      {/* No results */}
      {!isLoading && products.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-sm">
          <svg className="mb-4 h-16 w-16 text-secondary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-medium text-secondary-700">No products found</h2>
          <p className="mt-1 text-secondary-500">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Product grid */}
      {!isLoading && products.length > 0 && (
        <>
          <div className="mb-4 text-sm text-secondary-600">
            Showing {products.length} of {totalProducts} products
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map(product => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="flex items-center">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded-l-md border border-secondary-300 bg-white px-3 py-2 text-sm font-medium text-secondary-500 hover:bg-secondary-50 disabled:opacity-50"
                >
                  Previous
                </button>
                
                <div className="flex">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pagination based on current page
                    let pageNum = currentPage;
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    if (pageNum > 0 && pageNum <= totalPages) {
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`border-t border-b border-r border-secondary-300 px-4 py-2 text-sm font-medium ${
                            currentPage === pageNum
                              ? 'bg-primary-50 text-primary-600'
                              : 'bg-white text-secondary-500 hover:bg-secondary-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded-r-md border border-l-0 border-secondary-300 bg-white px-3 py-2 text-sm font-medium text-secondary-500 hover:bg-secondary-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductList;