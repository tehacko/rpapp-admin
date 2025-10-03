import { useState, useEffect, useCallback } from 'react';
import { getEnvironmentConfig, AdminProduct, API_ENDPOINTS } from 'pi-kiosk-shared';
import { useProducts } from '../hooks/useProducts';

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Types imported from shared package


interface ProductFormData {
  name: string;
  price: number;
  description: string;
  image: File | null;
  kioskInventories: Array<{kioskId: number, quantityInStock: number}>;
}

// Sort types
type SortField = 'name' | 'price' | 'quantity' | 'visibility' | 'active';
type SortDirection = 'asc' | 'desc';

interface SortCriterion {
  field: SortField;
  direction: SortDirection;
  priority: number;
}

interface MultiSortConfig {
  criteria: SortCriterion[];
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentSort: MultiSortConfig;
  onSort: (field: SortField) => void;
  onResize?: (field: SortField, width: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface InventoryRowProps {
  product: AdminProduct;
  kioskId: number;
  onUpdate: (productId: number, kioskId: number, quantity: number) => void;
  onRefresh: () => void;
  config: any;
}

// Sortable Header Component - Excel-like sorting interface with resizing
function SortableHeader({ field, label, currentSort, onSort, className = '', onResize, style }: SortableHeaderProps) {
  const criterion = currentSort.criteria.find(c => c.field === field);
  const isActive = !!criterion;
  const direction = criterion?.direction;
  const priority = criterion?.priority;
  
  const handleClick = () => {
    onSort(field);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onResize) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const headerCell = e.currentTarget.parentElement;
    
    if (!headerCell) {
      return;
    }
    
    const startWidth = headerCell.offsetWidth;
    const table = headerCell.closest('table');
    
    if (!table) {
      return;
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      // Excel-like behavior: direct pixel movement, no scaling
      const newWidth = Math.max(80, Math.min(500, startWidth + deltaX));
      onResize(field, newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getSortIcon = () => {
    if (!isActive) {
      return (
        <div className="sort-icons">
          <span className="sort-icon">↕</span>
        </div>
      );
    }
    
    return (
      <div className="sort-icons">
        <span className={`sort-icon ${direction === 'asc' ? 'active' : ''}`}>↑</span>
        <span className={`sort-icon ${direction === 'desc' ? 'active' : ''}`}>↓</span>
        {priority !== undefined && (
          <span className="sort-priority">{priority + 1}</span>
        )}
      </div>
    );
  };

  return (
    <th 
      className={`sortable-header resizable ${className} ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      style={style}
    >
      <div className="header-content">
        <span className="header-label">{label}</span>
        {getSortIcon()}
      </div>
      {onResize && (
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
}

// Inventory Row Component for inline editing - uses data from main fetchProducts
function InventoryRow({ product, kioskId, onUpdate, onRefresh, config }: InventoryRowProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [originalQuantity, setOriginalQuantity] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastKnownQuantity, setLastKnownQuantity] = useState<number>(0);

  // Use the quantityInStock from the product data, but preserve last known quantity when hidden
  useEffect(() => {
    const currentQuantity = product.quantityInStock ?? 0; // Default to 0 if no inventory record
    setQuantity(currentQuantity);
    setOriginalQuantity(currentQuantity);
    
    // Update last known quantity when we have a real value
    if (product.quantityInStock !== undefined) {
      setLastKnownQuantity(product.quantityInStock);
    }
  }, [product.quantityInStock, lastKnownQuantity]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(product.id, kioskId, quantity);
      
      // Auto-hide product when quantity becomes 0 (only from kiosk, not from admin)
      if (quantity === 0) {
        try {
          const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCT_KIOSK_VISIBILITY.replace(':productId', product.id.toString()).replace(':kioskId', kioskId.toString())}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: false })
          });
          
          if (response.ok) {
            // Also refresh the customer product list
            window.dispatchEvent(new CustomEvent('admin-refresh-requested'));
          }
        } catch (error) {
          // Silently handle error - product will remain visible
        }
      }
      
      setIsEditing(false);
      // Trigger a refresh of the products list
      onRefresh();
    } catch (error) {
      // Handle error silently - user can retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original value
    setQuantity(originalQuantity);
  };

  const handleToggleVisibility = async () => {
    // Toggle the product's visibility for this specific kiosk
    const currentlyVisible = product.active ?? false;
    const newVisibility = !currentlyVisible;
    
    setIsLoading(true);
    try {
      // Update the product's visibility for this specific kiosk
      const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCT_KIOSK_VISIBILITY.replace(':productId', product.id.toString()).replace(':kioskId', kioskId.toString())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          visible: newVisibility
        })
      });

      if (response.ok) {
        // Trigger a refresh of the products list
        onRefresh();
        // Also refresh the customer product list
        window.dispatchEvent(new CustomEvent('admin-refresh-requested'));
      } else {
        // Handle error silently - user can retry
      }
    } catch (error) {
      // Handle error silently - user can retry
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <tr className={`inventory-row ${isEditing ? 'editing' : ''}`}>
      <td className="product-info">
        <div className="product-name">{product.name}</div>
      </td>
      <td className="product-price">{product.price} Kč</td>
      <td className="quantity-cell">
        {isEditing ? (
          <div className="quantity-edit">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="quantity-input"
              min="0"
              disabled={isLoading}
            />
            <div className="quantity-actions">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="save-btn"
                title="Uložit"
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="cancel-btn"
                title="Zrušit"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="quantity-display">
            <span className={`quantity-value ${quantity === 0 ? 'out-of-stock' : ''}`}>
              {quantity}
            </span>
            {quantity === 0 && (
              <span className="stock-warning">Není v kiosku</span>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="edit-btn"
              title="Upravit množství"
            >
              ✏️
            </button>
          </div>
        )}
      </td>
      <td className="visibility-cell">
        <div className="visibility-toggle">
          <button
            onClick={handleToggleVisibility}
            disabled={isLoading || quantity === 0}
            className={`visibility-btn ${
              quantity === 0
                ? 'disabled'
                : product.active
                ? 'visible' 
                : 'hidden'
            }`}
            title={
              quantity === 0
                ? 'Nelze zobrazit produkt s nulovým množstvím'
                : product.active
                ? 'Skrýt produkt z tohoto kiosku' 
                : 'Zobrazit produkt v tomto kiosku'
            }
          >
            {isLoading ? '⏳' : quantity === 0 ? '🙈 Skryto' : product.active ? '👁️ Zobrazeno' : '🙈 Skryto'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Admin Dashboard Component - Simplified for Product Management
export function Dashboard({ token, onLogout }: DashboardProps) {
  const [kiosks, setKiosks] = useState<Array<{id: number, name: string, location: string, description?: string, isActive: boolean}>>([]);
  const [kioskId, setKioskId] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<'inventory' | 'products' | 'kiosks'>('inventory');
  const [notification, setNotification] = useState<NotificationState>({ show: false, message: '', type: 'info' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; product: AdminProduct | null }>({ show: false, product: null });
  
  // Kiosk management state
  const [showKioskForm, setShowKioskForm] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<{id: number, name: string, location: string, description: string, isActive: boolean} | null>(null);
  const [kioskForm, setKioskForm] = useState({
    name: '',
    location: '',
    description: '',
    isActive: true
  });
  
  // Use the products hook with SWR caching
  const {
    products,
    isLoading: loadingProducts,
    revalidate,
    addProduct,
    updateProduct,
    removeProduct,
    revertProduct
  } = useProducts({ kioskId, activeSection, token });
  
  // Debug kiosk changes
  useEffect(() => {
    // Kiosk changed - no debug logging in production
  }, [kioskId]);
  // Loading state is now managed by the useProducts hook
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: '',
    price: 0,
    description: '',
    image: null,
    kioskInventories: [] // Not used in form anymore
  });
  
  // Multi-sort state - per kiosk
  const [sortConfigs, setSortConfigs] = useState<Record<string, MultiSortConfig>>({});
  
  // Column width state - per kiosk, using pixel values for more precise control
  const [columnWidths, setColumnWidths] = useState<Record<string, Record<SortField, number>>>({});
  
  const config = getEnvironmentConfig();

  // Notification functions
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 5000);
  };

  const hideNotification = () => {
    setNotification({ show: false, message: '', type: 'info' });
  };


  // Get current kiosk's sort config
  const getCurrentSortConfig = (): MultiSortConfig => {
    const config = sortConfigs[kioskId] || { criteria: [] };
    return config;
  };

  // Get current kiosk's column widths
  const getCurrentColumnWidths = (): Record<SortField, number> => {
    return columnWidths[kioskId] || {
      name: 300,
      price: 120,
      quantity: 200,
      visibility: 150
    };
  };

  // Helper function to normalize priorities (ensure they are consecutive starting from 0)
  const normalizePriorities = (criteria: SortCriterion[]): SortCriterion[] => {
    return criteria
      .sort((a, b) => a.priority - b.priority)
      .map((criterion, index) => ({
        ...criterion,
        priority: index
      }));
  };

  // Multi-sort functions
  const handleSort = (field: SortField) => {
    setSortConfigs(prevConfigs => {
      const currentConfig = prevConfigs[kioskId] || { criteria: [] };
      const existingCriterion = currentConfig.criteria.find(c => c.field === field);
      
      if (existingCriterion) {
        // If field exists, toggle direction
        const updatedCriteria = currentConfig.criteria.map(c => 
          c.field === field 
            ? { ...c, direction: (c.direction === 'asc' ? 'desc' : 'asc') as SortDirection }
            : c
        );
        return {
          ...prevConfigs,
          [kioskId]: { criteria: normalizePriorities(updatedCriteria) }
        };
      } else {
        // If field doesn't exist, add it as highest priority
        const newCriterion: SortCriterion = {
          field,
          direction: 'asc',
          priority: currentConfig.criteria.length // Next available priority
        };
        return {
          ...prevConfigs,
          [kioskId]: { criteria: normalizePriorities([...currentConfig.criteria, newCriterion]) }
        };
      }
    });
  };

  // Helper function to get visibility priority for sorting
  const getVisibilityPriority = useCallback((product: AdminProduct): number => {
    const quantity = product.quantityInStock ?? 0;
    const isActive = product.active ?? false;
    
    // Priority logic: quantity > 0 takes precedence over active status
    if (quantity === 0) {
      return 2; // Zero quantity - lowest priority (regardless of active status)
    } else if (isActive) {
      return 0; // Zobrazeno with quantity - highest priority
    } else {
      return 1; // Skryto with quantity - medium priority
    }
  }, []);

  // Sort products based on current sort configuration
  const sortProducts = useCallback((productsToSort: AdminProduct[]): AdminProduct[] => {
    const currentSortConfig = getCurrentSortConfig();
    
    return [...productsToSort].sort((a, b) => {
      // Default sort: Zobrazeno > Skryto with quantity > Skryto with zero quantity
      if (currentSortConfig.criteria.length === 0) {
        const aPriority = getVisibilityPriority(a);
        const bPriority = getVisibilityPriority(b);
        const priorityComparison = aPriority - bPriority; // Higher priority first
        
        if (priorityComparison !== 0) {
          return priorityComparison;
        }
        
        // If both have same priority, sort by name
        return a.name.localeCompare(b.name, 'cs');
      }

      for (const criterion of currentSortConfig.criteria) {
        let comparison = 0;
        
        switch (criterion.field) {
          case 'name':
            comparison = a.name.localeCompare(b.name, 'cs');
            break;
          case 'price':
            comparison = a.price - b.price;
            break;
          case 'quantity':
            const aQuantity = a.quantityInStock || 0;
            const bQuantity = b.quantityInStock || 0;
            comparison = aQuantity - bQuantity;
            break;
          case 'visibility':
            // Sort by visibility priority: Zobrazeno > Skryto with quantity > Skryto with zero quantity
            const aVisibilityPriority = getVisibilityPriority(a);
            const bVisibilityPriority = getVisibilityPriority(b);
            comparison = aVisibilityPriority - bVisibilityPriority; // Higher priority first
            
            // Debug logging for espresso
            if (a.name.toLowerCase().includes('espresso') || b.name.toLowerCase().includes('espresso')) {
              console.log(`Visibility sort: ${a.name} (${aVisibilityPriority}) vs ${b.name} (${bVisibilityPriority}) = ${comparison}`);
            }
            break;
          case 'active':
            // Sort by visibility priority: Zobrazeno > Skryto with quantity > Skryto with zero quantity
            const aActivePriority = getVisibilityPriority(a);
            const bActivePriority = getVisibilityPriority(b);
            comparison = aActivePriority - bActivePriority; // Higher priority first
            break;
          default:
            comparison = 0;
        }
        
        if (comparison !== 0) {
          return criterion.direction === 'asc' ? comparison : -comparison;
        }
      }
      
      return 0;
    });
  }, [getVisibilityPriority, kioskId, sortConfigs]);

  const resetSort = () => {
    setSortConfigs(prevConfigs => ({
      ...prevConfigs,
      [kioskId]: { criteria: [] }
    }));
  };

  const removeSortCriterion = (field: SortField) => {
    setSortConfigs(prevConfigs => {
      const currentConfig = prevConfigs[kioskId] || { criteria: [] };
      const filteredCriteria = currentConfig.criteria.filter(c => c.field !== field);
      return {
        ...prevConfigs,
        [kioskId]: { criteria: normalizePriorities(filteredCriteria) }
      };
    });
  };

  const getSortFieldLabel = (field: SortField): string => {
    switch (field) {
      case 'name': return 'Název';
      case 'price': return 'Cena';
      case 'quantity': return 'Množství';
      case 'visibility': return 'Viditelnost';
      default: return field;
    }
  };

  const handleColumnResize = (field: SortField, newWidth: number) => {
    setColumnWidths(prev => {
      const currentWidths = prev[kioskId] || {
        name: 300,
        price: 120,
        quantity: 200,
        visibility: 150
      };
      
      const updated = { ...currentWidths };
      const currentWidth = updated[field];
      const deltaWidth = newWidth - currentWidth;
      
      // Only adjust the current column and the next column (Excel-like behavior)
      updated[field] = Math.max(80, Math.min(500, newWidth));
      
      // Find the next column and adjust it by the opposite amount
      const columnOrder: SortField[] = ['name', 'price', 'quantity', 'visibility'];
      const currentIndex = columnOrder.indexOf(field);
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < columnOrder.length) {
        const nextField = columnOrder[nextIndex];
        const nextNewWidth = Math.max(80, Math.min(500, updated[nextField] - deltaWidth));
        updated[nextField] = nextNewWidth;
      }
      
      return {
        ...prev,
        [kioskId]: updated
      };
    });
  };


  // Force refresh products and invalidate any caches
  const forceRefreshProducts = async () => {
    try {
      await revalidate();
    } catch (error) {
      // Handle error silently
    }
  };

  const validateProductForm = (): boolean => {
    if (!productForm.name.trim()) {
      return false;
    }
    
    if (productForm.price <= 0) {
      return false;
    }
    
    return true;
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProductForm()) {
      return;
    }
    
    try {
      const isEditing = !!editingProduct;
      const url = isEditing 
        ? `${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCTS}/${editingProduct!.id}`
        : `${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCTS}`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const productData = {
        name: productForm.name.trim(),
        price: productForm.price,
        description: productForm.description.trim(),
        image: editingProduct ? editingProduct.image : '📦', // Use existing image for edits, default for new
        imageUrl: editingProduct ? editingProduct.imageUrl : undefined // Preserve existing imageUrl
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        const responseData = await response.json();
        const newProduct = responseData.data?.product;
        
        if (editingProduct && newProduct) {
          // Update existing product in UI immediately
          updateProduct(newProduct);
        } else if (newProduct) {
          // Add new product to UI immediately
          addProduct(newProduct);
        }
        
        setEditingProduct(null);
        setShowAddForm(false);
        showNotification(editingProduct ? 'Produkt byl úspěšně upraven!' : 'Produkt byl úspěšně přidán!', 'success');
        
        // Refresh the list to ensure consistency with backend
        await revalidate();
      } else {
        const errorData = await response.json();
        showNotification(`Chyba při ukládání produktu: ${errorData.message || 'Neznámá chyba'}`, 'error');
      }
    } catch (error) {
      showNotification('Chyba při ukládání produktu: Síťová chyba', 'error');
    } finally {
      // Loading state managed by useProducts hook
    }
  };

  const handleEditProduct = async (product: AdminProduct) => {
    setEditingProduct(product);
    
    setProductForm({
      name: product.name,
      price: product.price,
      description: product.description || '',
      image: null,
      kioskInventories: []
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setProductForm({ 
      name: '', 
      price: 0, 
      description: '', 
      image: null, 
      kioskInventories: [] 
    });
    setShowAddForm(false);
  };

  const handleQuickStockUpdate = async (productId: number, kioskId: number, newQuantity: number) => {
    try {
      const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCT_INVENTORY_UPDATE.replace(':productId', productId.toString()).replace(':kioskId', kioskId.toString())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityInStock: newQuantity })
      });

      if (response.ok) {
        // Update product quantity in UI immediately
        const updatedProduct = products.find(p => p.id === productId);
        if (updatedProduct) {
          updateProduct({ ...updatedProduct, quantityInStock: newQuantity });
        }
        
        showNotification('Množství na skladě bylo úspěšně aktualizováno', 'success');
        
        // Refresh the list to ensure consistency with backend
        await revalidate();
      } else {
        const errorData = await response.json();
        showNotification(`Chyba při aktualizaci množství: ${errorData.message || 'Neznámá chyba'}`, 'error');
      }
    } catch (error) {
      showNotification('Chyba při aktualizaci množství: Síťová chyba', 'error');
    }
  };

  const handleDeleteProduct = (product: AdminProduct) => {
    setDeleteConfirm({ show: true, product });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm.product) return;

    const productToDelete = deleteConfirm.product;
    
    // Immediately update UI for instant feedback
    removeProduct(productToDelete.id);

    try {
      const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_PRODUCTS}/${productToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Success - UI already updated, just show notification
        showNotification(`Produkt "${productToDelete.name}" byl úspěšně smazán`, 'success');
        
        // Refresh the list to ensure consistency with backend
        await revalidate();
      } else {
        // Error - revert UI changes
        revertProduct(productToDelete);
        
        const errorData = await response.json();
        showNotification(`Chyba při mazání produktu: ${errorData.message || 'Neznámá chyba'}`, 'error');
      }
    } catch (error) {
      // Network error - revert UI changes
      revertProduct(productToDelete);
      showNotification('Chyba při mazání produktu: Síťová chyba', 'error');
    } finally {
      setDeleteConfirm({ show: false, product: null });
    }
  };

  const cancelDeleteProduct = () => {
    setDeleteConfirm({ show: false, product: null });
  };

  useEffect(() => {
    fetchKiosks();
  }, [token]);

  // Reinitialize form when kioskId changes
  useEffect(() => {
    if (kiosks.length > 0) {
      setProductForm(prev => ({
        ...prev,
        kioskInventories: []
      }));
    }
  }, [kioskId, kiosks]);

  // Products are now managed by the useProducts hook

  // Products are now managed by the useProducts hook with SWR caching
  // Sorting is handled by the hook's data management

  // Kiosk management functions
  const fetchKiosks = async () => {
    try {
      const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_KIOSKS}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setKiosks(data.kiosks || []);
        if (data.kiosks && data.kiosks.length > 0 && !kiosks.length) {
          setKioskId(data.kiosks[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching kiosks:', error);
    }
  };

  const handleKioskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingKiosk 
        ? `${config.apiUrl}${API_ENDPOINTS.ADMIN_KIOSKS}/${editingKiosk.id}`
        : `${config.apiUrl}${API_ENDPOINTS.ADMIN_KIOSKS}`;
      
      const method = editingKiosk ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(kioskForm)
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(data.message || 'Kiosk saved successfully', 'success');
        setShowKioskForm(false);
        setEditingKiosk(null);
        setKioskForm({ name: '', location: '', description: '', isActive: true });
        await fetchKiosks();
      } else {
        const errorData = await response.json();
        showNotification(errorData.message || 'Error saving kiosk', 'error');
      }
    } catch (error) {
      showNotification('Error saving kiosk: Network error', 'error');
    }
  };

  const handleEditKiosk = (kiosk: any) => {
    setEditingKiosk(kiosk);
    setKioskForm({
      name: kiosk.name,
      location: kiosk.location,
      description: kiosk.description || '',
      isActive: kiosk.isActive
    });
    setShowKioskForm(true);
  };

  const handleDeleteKiosk = async (kioskId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}${API_ENDPOINTS.ADMIN_KIOSK_DETAILS.replace(':id', kioskId.toString())}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(data.message || 'Kiosk deactivated successfully', 'success');
        await fetchKiosks();
      } else {
        const errorData = await response.json();
        showNotification(errorData.message || 'Error deactivating kiosk', 'error');
      }
    } catch (error) {
      showNotification('Error deactivating kiosk: Network error', 'error');
    }
  };

  const cancelKioskForm = () => {
    setShowKioskForm(false);
    setEditingKiosk(null);
    setKioskForm({ name: '', location: '', description: '', isActive: true });
  };

  return (
    <div className="admin-dashboard">
      {/* Notification */}
      {notification.show && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={hideNotification} className="notification-close">×</button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.product && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <div className="modal-header">
              <h3>Potvrdit smazání</h3>
            </div>
            <div className="modal-content">
              <p>Opravdu chcete smazat produkt <strong>"{deleteConfirm.product.name}"</strong>?</p>
              <p className="warning-text">Tato akce je nevratná.</p>
            </div>
            <div className="modal-actions">
              <button onClick={confirmDeleteProduct} className="confirm-btn">
                Ano, smazat
              </button>
              <button onClick={cancelDeleteProduct} className="cancel-btn">
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-header">
        <div className="header-left">
          <h2>🏪 Admin Dashboard</h2>
          <div className="admin-navigation">
            <button 
              className={`nav-item ${activeSection === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveSection('inventory')}
            >
              📦 Správa zásob
            </button>
            <button 
              className={`nav-item ${activeSection === 'products' ? 'active' : ''}`}
              onClick={() => setActiveSection('products')}
            >
              🛍️ Správa produktů
            </button>
            <button 
              className={`nav-item ${activeSection === 'kiosks' ? 'active' : ''}`}
              onClick={() => setActiveSection('kiosks')}
            >
              🖥️ Správa kiosků
            </button>
          </div>
        </div>
        <div className="header-right">
          {activeSection === 'inventory' && (
            <div className="kiosk-selector">
              <label htmlFor="kiosk-select">Kiosk:</label>
              <select 
                id="kiosk-select"
                value={kioskId}
                onChange={(e) => setKioskId(Number(e.target.value))}
                className="kiosk-select"
              >
                {kiosks.map(kiosk => (
                  <option key={kiosk.id} value={kiosk.id}>
                    {kiosk.name} ({kiosk.location})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="admin-actions">
            {activeSection === 'products' && (
            <button 
              onClick={() => setShowAddForm(true)} 
              className="add-product-btn"
            >
              ➕ Přidat produkt
            </button>
            )}
            <button 
              onClick={forceRefreshProducts} 
              className="refresh-btn"
              disabled={loadingProducts}
              title="Obnovit seznam produktů"
            >
              {loadingProducts ? '⏳' : '🔄'} Obnovit
            </button>
            <button onClick={onLogout} className="logout-btn">
              🚪 Odhlásit
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {loadingProducts && <div className="loading">Načítám produkty...</div>}
        
        <div className="products-management">
          {/* Show different content based on active section */}
          {activeSection === 'inventory' && (
            <div className="inventory-management">
              <h3>📦 Správa zásob - {kiosks.find(k => k.id === kioskId)?.name || 'Neznámý kiosk'}</h3>
              <div className="inventory-table-container">
                <div className="table-controls">
                  <div className="sort-info">
                    {getCurrentSortConfig().criteria.length > 0 ? (
                      <div className="multi-sort-display">
                        <span className="sort-label">Řazeno podle:</span>
                        <div className="sort-criteria">
              {getCurrentSortConfig().criteria
                .sort((a, b) => a.priority - b.priority)
                .map((criterion) => (
                  <div key={criterion.field} className="sort-criterion">
                    <span className="criterion-priority">{criterion.priority + 1}.</span>
                    <span className="criterion-field">{getSortFieldLabel(criterion.field)}</span>
                    <span className="criterion-direction">
                      {criterion.direction === 'asc' ? '↑' : '↓'}
                    </span>
                    <button 
                      onClick={() => removeSortCriterion(criterion.field)}
                      className="remove-criterion-btn"
                      title="Odebrat z řazení"
                    >
                      ×
                    </button>
                  </div>
                ))}
                        </div>
                        <button onClick={resetSort} className="reset-sort-btn" title="Zrušit všechna řazení">
                          🗑️ Vymazat vše
                        </button>
                      </div>
                    ) : (
                      <span className="no-sort">Žádné řazení</span>
                    )}
                  </div>
                </div>
                <table className="inventory-table">
                  <thead>
                    <tr>
              <SortableHeader 
                field="name" 
                label="Produkt" 
                currentSort={getCurrentSortConfig()} 
                onSort={handleSort}
                onResize={handleColumnResize}
                className="product-column"
                style={{ width: `${getCurrentColumnWidths().name}px` }}
              />
              <SortableHeader 
                field="price" 
                label="Cena" 
                currentSort={getCurrentSortConfig()} 
                onSort={handleSort}
                onResize={handleColumnResize}
                className="price-column"
                style={{ width: `${getCurrentColumnWidths().price}px` }}
              />
              <SortableHeader 
                field="quantity" 
                label="Množství na skladě" 
                currentSort={getCurrentSortConfig()} 
                onSort={handleSort}
                onResize={handleColumnResize}
                className="quantity-column"
                style={{ width: `${getCurrentColumnWidths().quantity}px` }}
              />
              <SortableHeader 
                field="visibility" 
                label="Viditelnost" 
                currentSort={getCurrentSortConfig()} 
                onSort={handleSort}
                onResize={handleColumnResize}
                className="visibility-column"
                style={{ width: `${getCurrentColumnWidths().visibility}px` }}
              />
                    </tr>
                  </thead>
                  <tbody>
                    {sortProducts(products).map((product, index) => (
                      <InventoryRow 
                        key={`${product.id}-${kioskId}-${index}`} 
                        product={product} 
                        kioskId={kioskId}
                        onUpdate={handleQuickStockUpdate}
                        onRefresh={forceRefreshProducts}
                        config={config}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'products' && (
            <div className="product-management">
              <h3>🛍️ Správa produktů</h3>
              <div className="admin-products-grid">
                {sortProducts(products).map((product, index) => (
                  <div key={`${product.id}-${index}`} className="admin-product-card">
                    <div className="product-image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} />
                      ) : (
                        <span>{product.image || '📦'}</span>
                      )}
                    </div>
                    <div className="product-info">
                      <h4>{product.name}</h4>
                      <p>{product.description}</p>
                      <div className="product-price">{product.price} Kč</div>
                      <div className={`product-status ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Aktivní' : 'Neaktivní'}
                      </div>
                    </div>
                    <div className="product-actions">
                      <button 
                        onClick={() => handleEditProduct(product)} 
                        className="edit-btn"
                      >
                        ✏️ Upravit
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product)} 
                        className="delete-btn"
                      >
                        🗑️ Smazat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Form Modal - Only show in product management section */}
          {activeSection === 'products' && showAddForm && (
            <div className="modal-overlay">
              <div className="product-form-modal">
                <div className="modal-header">
                  <h3>{editingProduct ? 'Upravit produkt' : 'Přidat nový produkt'}</h3>
                  <button onClick={handleCancelEdit} className="modal-close-btn">
                    ×
                  </button>
                </div>
                <form onSubmit={handleProductSubmit} className="product-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="product-name">Název produktu *</label>
                      <input
                        id="product-name"
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="product-price">Cena (Kč) *</label>
                      <input
                        id="product-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="product-description">Popis</label>
                    <textarea
                      id="product-description"
                      value={productForm.description}
                      onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div className="info-note">
                    <strong>Poznámka:</strong> Nové produkty začínají jako neaktivní. Po přidání produktu přejděte do sekce "Správa zásob" pro nastavení množství na skladě a aktivaci produktu.
                  </div>
                  
                  <div className="form-actions">
                    <button type="submit" disabled={loadingProducts} className="submit-btn">
                      {loadingProducts ? 'Ukládám...' : (editingProduct ? 'Uložit změny' : 'Přidat produkt')}
                    </button>
                    <button type="button" onClick={handleCancelEdit} className="cancel-btn">
                      Zrušit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeSection === 'kiosks' && (
            <div className="kiosk-management">
              <h3>🖥️ Správa kiosků</h3>
              <div className="kiosk-controls">
                <button 
                  onClick={() => setShowKioskForm(true)}
                  className="add-kiosk-btn"
                >
                  ➕ Přidat kiosk
                </button>
              </div>
              
              <div className="kiosks-grid">
                {kiosks.map((kiosk) => (
                  <div key={kiosk.id} className={`kiosk-card ${!kiosk.isActive ? 'inactive' : ''}`}>
                    <div className="kiosk-header">
                      <h4>{kiosk.name}</h4>
                      <div className={`kiosk-status ${kiosk.isActive ? 'active' : 'inactive'}`}>
                        {kiosk.isActive ? 'Aktivní' : 'Neaktivní'}
                      </div>
                    </div>
                    <div className="kiosk-info">
                      <p><strong>📍 Lokace:</strong> {kiosk.location}</p>
                      {kiosk.description && (
                        <p><strong>📝 Popis:</strong> {kiosk.description}</p>
                      )}
                      <p><strong>🔗 URL:</strong> <code>?kioskId={kiosk.id}</code></p>
                    </div>
                    <div className="kiosk-actions">
                      <button 
                        onClick={() => handleEditKiosk(kiosk)}
                        className="edit-btn"
                      >
                        ✏️ Upravit
                      </button>
                      <button 
                        onClick={() => handleDeleteKiosk(kiosk.id)}
                        className="delete-btn"
                        disabled={!kiosk.isActive}
                      >
                        🗑️ Deaktivovat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kiosk Form Modal */}
          {activeSection === 'kiosks' && showKioskForm && (
            <div className="modal-overlay">
              <div className="kiosk-form-modal">
                <div className="modal-header">
                  <h3>{editingKiosk ? 'Upravit kiosk' : 'Přidat nový kiosk'}</h3>
                  <button onClick={cancelKioskForm} className="modal-close">×</button>
                </div>
                <form onSubmit={handleKioskSubmit} className="kiosk-form">
                  <div className="form-group">
                    <label htmlFor="kiosk-name">Název kiosku *</label>
                    <input
                      type="text"
                      id="kiosk-name"
                      value={kioskForm.name}
                      onChange={(e) => setKioskForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      placeholder="Např. Hlavní kiosk, Letiště Terminal 1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="kiosk-location">Lokace *</label>
                    <input
                      type="text"
                      id="kiosk-location"
                      value={kioskForm.location}
                      onChange={(e) => setKioskForm(prev => ({ ...prev, location: e.target.value }))}
                      required
                      placeholder="Např. Praha, Letiště Václava Havla, Terminal 1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="kiosk-description">Popis</label>
                    <textarea
                      id="kiosk-description"
                      value={kioskForm.description}
                      onChange={(e) => setKioskForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Volitelný popis kiosku"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={kioskForm.isActive}
                        onChange={(e) => setKioskForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <span>Kiosk je aktivní</span>
                    </label>
                  </div>
                  
                  <div className="form-actions">
                    <button type="submit" className="submit-btn">
                      {editingKiosk ? 'Uložit změny' : 'Přidat kiosk'}
                    </button>
                    <button type="button" onClick={cancelKioskForm} className="cancel-btn">
                      Zrušit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}