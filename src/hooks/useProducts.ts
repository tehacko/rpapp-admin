import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { 
  AdminProduct, 
  getEnvironmentConfig,
  useErrorHandler,
  API_ENDPOINTS
} from 'pi-kiosk-shared';

interface UseProductsOptions {
  kioskId?: number;
  activeSection?: 'inventory' | 'products' | 'kiosks';
  token?: string;
}

export function useProducts(options: UseProductsOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const { handleError } = useErrorHandler();
  
  const { kioskId = 1, activeSection = 'products', token } = options;
  const config = getEnvironmentConfig();

  // SWR fetcher with proper error handling
  const fetcher = async (url: string): Promise<AdminProduct[]> => {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data?.products) {
        return data.data.products;
      } else {
        throw new Error('Nepodařilo se načíst produkty');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error(`Chyba při načítání produktů: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  };

  // Determine the correct API endpoint based on active section
  const getApiUrl = () => {
    if (activeSection === 'inventory') {
      return `${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCTS_INVENTORY.replace(':kioskId', kioskId.toString())}`;
    }
    return `${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCTS}`;
  };

  // SWR configuration with intelligent caching and revalidation
  const { 
    data: products, 
    error, 
    mutate, 
    isLoading,
    isValidating 
  } = useSWR(
    token ? getApiUrl() : null, // Only fetch if we have a token
    fetcher,
    {
      // Revalidate every 30 seconds as fallback
      refreshInterval: 30000,
      // Revalidate on window focus
      revalidateOnFocus: true,
      // Revalidate on reconnect
      revalidateOnReconnect: true,
      // Don't revalidate on mount if we have data
      revalidateIfStale: true,
      // Retry configuration
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      // Dedupe requests
      dedupingInterval: 2000,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Error handling
      onError: (error) => {
        handleError(error, 'useProducts.fetcher');
        setIsConnected(false);
      },
      onSuccess: () => {
        setIsConnected(true);
      }
    }
  );

  // Handle admin refresh requests and product updates
  useEffect(() => {
    const handleAdminRefresh = () => {
      console.log('🔄 Admin refresh requested, updating products...');
      mutate(undefined, { revalidate: true });
    };

    const handleProductUpdate = (event: CustomEvent) => {
      console.log('📦 Product update received:', event.detail);
      mutate(undefined, { revalidate: true });
    };

    const handleForceRefresh = () => {
      console.log('🔄 Force refresh requested, updating products...');
      mutate(undefined, { revalidate: true });
    };

    // Listen for refresh requests
    window.addEventListener('admin-refresh-requested', handleAdminRefresh);
    window.addEventListener('product-updated', handleProductUpdate as EventListener);
    window.addEventListener('force-refresh', handleForceRefresh);
    
    return () => {
      window.removeEventListener('admin-refresh-requested', handleAdminRefresh);
      window.removeEventListener('product-updated', handleProductUpdate as EventListener);
      window.removeEventListener('force-refresh', handleForceRefresh);
    };
  }, [mutate]);

  // Manual refresh function
  const refresh = useCallback(() => {
    return mutate();
  }, [mutate]);

  // Force revalidation
  const revalidate = useCallback(() => {
    return mutate(undefined, { revalidate: true });
  }, [mutate]);

  // Optimistic update functions
  const addProduct = useCallback((newProduct: AdminProduct) => {
    mutate((currentProducts) => {
      if (!currentProducts) return [newProduct];
      return [...currentProducts, newProduct];
    }, { revalidate: false });
  }, [mutate]);

  const updateProduct = useCallback((updatedProduct: AdminProduct) => {
    mutate((currentProducts) => {
      if (!currentProducts) return [updatedProduct];
      return currentProducts.map(p => 
        p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
      );
    }, { revalidate: false });
  }, [mutate]);

  const removeProduct = useCallback((productId: number) => {
    mutate((currentProducts) => {
      if (!currentProducts) return [];
      return currentProducts.filter(p => p.id !== productId);
    }, { revalidate: false });
  }, [mutate]);

  const revertProduct = useCallback((product: AdminProduct) => {
    mutate((currentProducts) => {
      if (!currentProducts) return [product];
      return [...currentProducts, product];
    }, { revalidate: false });
  }, [mutate]);

  return {
    products: products || [],
    isLoading,
    isValidating,
    error,
    isConnected,
    setIsConnected,
    refresh,
    revalidate,
    // Optimistic update functions
    addProduct,
    updateProduct,
    removeProduct,
    revertProduct,
    // Computed properties
    hasProducts: (products?.length || 0) > 0,
    isEmpty: !isLoading && !error && (products?.length || 0) === 0,
    hasError: !!error
  };
}
