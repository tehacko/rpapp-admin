import { useState, useEffect } from 'react';
import { getEnvironmentConfig } from 'pi-kiosk-shared';

interface DashboardProps {
  token: string;
  onLogout: () => void;
  onBack: () => void;
}

// Types from legacy admin
interface AdminProduct {
  id: number;
  name: string;
  price: number;
  description: string;
  image: string;
  imageUrl?: string;
  active: boolean;
  quantityInStock?: number;
  kioskInventories?: Array<{
    kioskId: number;
    quantityInStock: number;
  }>;
}

interface ProductFormData {
  name: string;
  price: number;
  description: string;
  image: File | null;
  active: boolean;
  kioskInventories: Array<{
    kioskId: number;
    kioskName: string;
    quantityInStock: number;
  }>;
}

type SortField = 'name' | 'price' | 'quantity' | 'visibility';
type SortDirection = 'asc' | 'desc';

interface SortCriterion {
  field: SortField;
  direction: SortDirection;
  priority: number;
}

interface MultiSortConfig {
  criteria: SortCriterion[];
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export function Dashboard({ token, onLogout, onBack }: DashboardProps) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [kiosks, setKiosks] = useState<Array<{id: number, name: string, location: string}>>([]);
  const [kioskId, setKioskId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [activeSection, setActiveSection] = useState<'inventory' | 'products'>('inventory');
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: '',
    price: 0,
    description: '',
    image: null,
    active: false,
    kioskInventories: []
  });
  
  // Multi-sort state
  const [sortConfig, setSortConfig] = useState<MultiSortConfig>({ criteria: [] });
  const config = getEnvironmentConfig();

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
    setSortConfig(prevConfig => {
      const existingCriterion = prevConfig.criteria.find(c => c.field === field);
      
      if (existingCriterion) {
        // If field exists, toggle direction
        const updatedCriteria = prevConfig.criteria.map(c => 
          c.field === field 
            ? { ...c, direction: (c.direction === 'asc' ? 'desc' : 'asc') as SortDirection }
            : c
        );
        return { criteria: normalizePriorities(updatedCriteria) };
      } else {
        // If field doesn't exist, add it as highest priority
        const newCriterion: SortCriterion = {
          field,
          direction: 'asc',
          priority: prevConfig.criteria.length // Next available priority
        };
        return { criteria: normalizePriorities([...prevConfig.criteria, newCriterion]) };
      }
    });
  };

  const sortProducts = (products: AdminProduct[]): AdminProduct[] => {
    if (sortConfig.criteria.length === 0) return products;

    return [...products].sort((a, b) => {
      // Sort by criteria in priority order (lower priority number = higher priority)
      const sortedCriteria = [...sortConfig.criteria].sort((a, b) => a.priority - b.priority);
      
      for (const criterion of sortedCriteria) {
        let comparison = 0;

        switch (criterion.field) {
          case 'name':
            comparison = a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' });
            break;
          case 'price':
            comparison = a.price - b.price;
            break;
          case 'quantity':
            // Get quantity for current kiosk
            const aQuantity = a.quantityInStock || 0;
            const bQuantity = b.quantityInStock || 0;
            comparison = aQuantity - bQuantity;
            break;
          case 'visibility':
            // Active products first (true comes before false)
            comparison = (b.active ? 1 : 0) - (a.active ? 1 : 0);
            break;
          default:
            continue;
        }

        // If comparison is not 0, we have a definitive sort order
        if (comparison !== 0) {
          return criterion.direction === 'desc' ? -comparison : comparison;
        }
        // If comparison is 0, continue to next criterion
      }

      return 0; // All criteria are equal
    });
  };

  const resetSort = () => {
    setSortConfig({ criteria: [] });
  };

  const removeSortCriterion = (field: SortField) => {
    setSortConfig(prevConfig => {
      const filteredCriteria = prevConfig.criteria.filter(c => c.field !== field);
      return { criteria: normalizePriorities(filteredCriteria) };
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

  const fetchKiosks = async (): Promise<void> => {
    try {
      const response = await fetch(`${config.apiUrl}/admin/kiosks`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.kiosks) {
        setKiosks(data.kiosks);
      } else {
        throw new Error(data.message || 'Failed to fetch kiosks');
      }
    } catch (error) {
      console.error('Error fetching kiosks:', error);
    }
  };

  const fetchProducts = async (): Promise<void> => {
    setLoading(true);
    try {
      // Use different API based on active section
      const url = activeSection === 'inventory' 
        ? `${config.apiUrl}/admin/products/inventory/${kioskId}`
        : `${config.apiUrl}/admin/products`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse<{ products: AdminProduct[] }> = await response.json();
      
      if (data.success && data.data?.products) {
        // Apply default sorting based on active section
        const defaultSortedProducts = data.data.products.sort((a, b) => {
          if (activeSection === 'products') {
            // For product management: Active products first, then alphabetical
            if (a.active !== b.active) {
              return b.active ? 1 : -1; // Active products first
            }
            // Within same active status, alphabetical by name
            return a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' });
          } else {
            // For inventory management: Complex visibility-based sorting
            // First: Active AND in-stock products (visible to customers)
            const aVisible = a.active && (a.quantityInStock || 0) > 0;
            const bVisible = b.active && (b.quantityInStock || 0) > 0;
            
            if (aVisible !== bVisible) {
              return bVisible ? 1 : -1; // Visible products first
            }
            
            // Second: Within visible products, higher quantity first
            if (aVisible && bVisible) {
              if ((a.quantityInStock || 0) !== (b.quantityInStock || 0)) {
                return (b.quantityInStock || 0) - (a.quantityInStock || 0); // Higher quantity first
              }
            }
            
            // Third: Alphabetical by name
            return a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' });
          }
        });
        
        // Apply user sorting if configured
        const finalProducts = sortProducts(defaultSortedProducts);
        setProducts(finalProducts);
      } else {
        throw new Error(data.message || 'Failed to fetch products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      // You might want to show an error message to the user here
    } finally {
      setLoading(false);
    }
  };

  const validateProductForm = (): boolean => {
    if (!productForm.name.trim()) {
      alert('Název produktu je povinný');
      return false;
    }
    
    if (productForm.name.length < 2) {
      alert('Název produktu musí mít alespoň 2 znaky');
      return false;
    }
    
    if (productForm.price <= 0) {
      alert('Cena musí být větší než 0');
      return false;
    }
    
    return true;
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProductForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const productData = {
        name: productForm.name.trim(),
        price: productForm.price,
        description: productForm.description.trim(),
        image: editingProduct ? editingProduct.image : '📦', // Use existing image for edits, default for new
        imageUrl: editingProduct ? editingProduct.imageUrl : undefined, // Preserve existing imageUrl
        active: editingProduct ? editingProduct.active : false // New products start inactive, existing products keep their status
      };

      const url = editingProduct 
        ? `${config.apiUrl}/admin/products/${editingProduct.id}`
        : `${config.apiUrl}/admin/products`;
      
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        setProductForm({ 
          name: '', 
          price: 0, 
          description: '', 
          image: null, 
          active: false,
          kioskInventories: []
        });
        setEditingProduct(null);
        setShowAddForm(false);
        await fetchProducts(); // Refresh the list
        alert(editingProduct ? 'Produkt byl úspěšně upraven!' : 'Produkt byl úspěšně přidán!');
      } else {
        const errorData = await response.json();
        alert(`Chyba: ${errorData.message || 'Neznámá chyba'}`);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Chyba při ukládání produktu');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (product: AdminProduct) => {
    setEditingProduct(product);
    
    setProductForm({
      name: product.name,
      price: product.price,
      description: product.description,
      image: null,
      active: product.active,
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
      active: false,
      kioskInventories: []
    });
    setShowAddForm(false);
  };

  const handleQuickStockUpdate = async (productId: number, kioskId: number, newQuantity: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/admin/products/${productId}/inventory/${kioskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityInStock: newQuantity })
      });

      if (response.ok) {
        // Force immediate refresh of inventory management
        await fetchProducts();
        alert('Množství na skladě bylo úspěšně aktualizováno!');
      } else {
        const errorData = await response.json();
        alert(`Chyba: ${errorData.message || 'Neznámá chyba'}`);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Chyba při aktualizaci množství na skladě');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Opravdu chcete smazat tento produkt?')) {
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/admin/products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchProducts(); // Refresh the list
        alert('Produkt byl úspěšně smazán!');
      } else {
        const errorData = await response.json();
        alert(`Chyba: ${errorData.message || 'Neznámá chyba'}`);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Chyba při mazání produktu');
    }
  };

  useEffect(() => {
    fetchKiosks();
    fetchProducts();
  }, [token, activeSection, kioskId]);

  const handleLogout = () => {
    if (confirm('Opravdu se chcete odhlásit?')) {
      onLogout();
    }
  };

  return (
    <div className="admin-dashboard-screen">
      <div className="admin-header">
        <h1>🔐 Admin Dashboard</h1>
        <div className="admin-actions">
          <button onClick={onBack} className="back-btn">
            ← Kiosek
          </button>
          <button onClick={handleLogout} className="logout-btn">
            🚪 Odhlásit se
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-sidebar">
          <div className="kiosk-selector">
            <label htmlFor="kiosk-select">🖥️ Kiosk:</label>
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

          <div className="admin-tabs">
            <button 
              className={`tab ${activeSection === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveSection('inventory')}
            >
              📦 Skladové zásoby
            </button>
            <button 
              className={`tab ${activeSection === 'products' ? 'active' : ''}`}
              onClick={() => setActiveSection('products')}
            >
              🏪 Správa produktů
            </button>
          </div>

          {/* Multi-sort controls */}
          {sortConfig.criteria.length > 0 && (
            <div className="sort-controls">
              <h4>🔧 Aktivní řazení:</h4>
              {sortConfig.criteria
                .sort((a, b) => a.priority - b.priority)
                .map((criterion, index) => (
                  <div key={criterion.field} className="sort-criterion">
                    <span className="sort-priority">{index + 1}.</span>
                    <span className="sort-field">{getSortFieldLabel(criterion.field)}</span>
                    <span className="sort-direction">
                      {criterion.direction === 'asc' ? '↑' : '↓'}
                    </span>
                    <button 
                      onClick={() => removeSortCriterion(criterion.field)}
                      className="remove-sort"
                      title="Odstranit kritérium"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              <button onClick={resetSort} className="reset-sort">
                🔄 Resetovat řazení
              </button>
            </div>
          )}
        </div>

        <div className="admin-main">
          <div className="section-header">
            <h2>
              {activeSection === 'inventory' ? '📦 Skladové zásoby' : '🏪 Správa produktů'}
            </h2>
            <div className="section-actions">
              <button 
                onClick={() => setShowAddForm(true)} 
                className="add-product-btn"
                disabled={loading}
              >
                ➕ Přidat produkt
              </button>
              <button onClick={fetchProducts} className="refresh-btn" disabled={loading}>
                {loading ? '⏳' : '🔄'} Obnovit
              </button>
            </div>
          </div>

          {/* Add/Edit Product Form */}
          {showAddForm && (
            <div className="product-form-overlay">
              <form onSubmit={handleProductSubmit} className="product-form">
                <h3>{editingProduct ? 'Upravit produkt' : 'Přidat nový produkt'}</h3>
                
                <div className="form-group">
                  <label htmlFor="product-name">Název produktu:</label>
                  <input
                    type="text"
                    id="product-name"
                    value={productForm.name}
                    onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Název produktu"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-price">Cena (Kč):</label>
                  <input
                    type="number"
                    id="product-price"
                    value={productForm.price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-description">Popis:</label>
                  <textarea
                    id="product-description"
                    value={productForm.description}
                    onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Popis produktu"
                    rows={3}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? 'Ukládám...' : (editingProduct ? 'Uložit změny' : 'Přidat produkt')}
                  </button>
                  <button type="button" onClick={handleCancelEdit} className="cancel-btn">
                    Zrušit
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products Table */}
          <div className="products-table-container">
            <table className="products-table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('name')} 
                    className="sortable"
                    title="Klikněte pro řazení podle názvu"
                  >
                    Produkt
                    {sortConfig.criteria.find(c => c.field === 'name') && (
                      <span className="sort-indicator">
                        {sortConfig.criteria.find(c => c.field === 'name')?.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th 
                    onClick={() => handleSort('price')} 
                    className="sortable"
                    title="Klikněte pro řazení podle ceny"
                  >
                    Cena
                    {sortConfig.criteria.find(c => c.field === 'price') && (
                      <span className="sort-indicator">
                        {sortConfig.criteria.find(c => c.field === 'price')?.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  {activeSection === 'inventory' && (
                    <th 
                      onClick={() => handleSort('quantity')} 
                      className="sortable"
                      title="Klikněte pro řazení podle množství"
                    >
                      Na skladě
                      {sortConfig.criteria.find(c => c.field === 'quantity') && (
                        <span className="sort-indicator">
                          {sortConfig.criteria.find(c => c.field === 'quantity')?.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                  )}
                  <th 
                    onClick={() => handleSort('visibility')} 
                    className="sortable"
                    title="Klikněte pro řazení podle viditelnosti"
                  >
                    Status
                    {sortConfig.criteria.find(c => c.field === 'visibility') && (
                      <span className="sort-indicator">
                        {sortConfig.criteria.find(c => c.field === 'visibility')?.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} className={product.active ? 'active' : 'inactive'}>
                    <td>
                      <div className="product-info">
                        <span className="product-icon">{product.image}</span>
                        <div>
                          <div className="product-name">{product.name}</div>
                          {product.description && (
                            <div className="product-description">{product.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="price">{product.price} Kč</td>
                    {activeSection === 'inventory' && (
                      <td className="quantity">
                        <input
                          type="number"
                          value={product.quantityInStock || 0}
                          onChange={(e) => handleQuickStockUpdate(product.id, kioskId, Number(e.target.value))}
                          min="0"
                          className="quantity-input"
                        />
                      </td>
                    )}
                    <td className="status">
                      <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? '✅ Aktivní' : '❌ Neaktivní'}
                      </span>
                      {activeSection === 'inventory' && (
                        <div className="visibility-info">
                          {product.active && (product.quantityInStock || 0) > 0 ? (
                            <span className="visible">👁️ Viditelný zákazníkům</span>
                          ) : (
                            <span className="hidden">🚫 Skrytý pro zákazníky</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="actions">
                      <button 
                        onClick={() => handleEditProduct(product)} 
                        className="edit-btn"
                        title="Upravit produkt"
                      >
                        ✏️ Upravit
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)} 
                        className="delete-btn"
                        title="Smazat produkt"
                      >
                        🗑️ Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {products.length === 0 && !loading && (
              <div className="empty-state">
                <p>📦 Žádné produkty nenalezeny</p>
                <button onClick={() => setShowAddForm(true)} className="add-first-product">
                  ➕ Přidat první produkt
                </button>
              </div>
            )}

            {loading && (
              <div className="loading-state">
                <p>⏳ Načítám produkty...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
