// Tests for Dashboard component
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';

// Mock fetch globally
global.fetch = jest.fn();

describe('Dashboard Component', () => {
  const mockProps = {
    token: 'test-token',
    onLogout: jest.fn(),
    onBack: jest.fn()
  };

  const mockKiosks = [
    { id: 1, name: 'Kiosk 1', location: 'Lobby' },
    { id: 2, name: 'Kiosk 2', location: 'Cafeteria' }
  ];

  const mockProducts = [
    {
      id: 1,
      name: 'Test Product 1',
      price: 50,
      description: 'Test description',
      image: '🍕',
      active: true,
      quantityInStock: 10
    },
    {
      id: 2,
      name: 'Test Product 2',
      price: 30,
      description: 'Another test',
      image: '🍔',
      active: false,
      quantityInStock: 0
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
    
    // Default mock responses
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/admin/kiosks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, kiosks: mockKiosks })
        });
      }
      if (url.includes('/admin/products')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { products: mockProducts } })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  test('renders dashboard header and controls', async () => {
    render(<Dashboard {...mockProps} />);
    
    expect(screen.getByText('🔐 Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /← kiosek/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🚪 odhlásit se/i })).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /📦 skladové zásoby/i })).toBeInTheDocument();
    });
  });

  test('loads and displays kiosks in selector', async () => {
    render(<Dashboard {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Kiosk 1 (Lobby)')).toBeInTheDocument();
    });
    
    // Check that both kiosks are available as options
    const select = screen.getByLabelText(/kiosk/i);
    expect(select).toBeInTheDocument();
  });

  test('loads and displays products in inventory mode', async () => {
    render(<Dashboard {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    });
    
    // Should show quantity inputs in inventory mode
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  test('switches between inventory and products sections', async () => {
    const user = userEvent.setup();
    render(<Dashboard {...mockProps} />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /📦 skladové zásoby/i })).toBeInTheDocument();
    });
    
    // Switch to products section
    const productsTab = screen.getByRole('button', { name: /🏪 správa produktů/i });
    await user.click(productsTab);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /🏪 správa produktů/i })).toBeInTheDocument();
    });
  });

  test('shows add product form when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<Dashboard {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('➕ Přidat produkt')).toBeInTheDocument();
    });
    
    const addButton = screen.getByRole('button', { name: /➕ přidat produkt/i });
    await user.click(addButton);
    
    expect(screen.getByText('Přidat nový produkt')).toBeInTheDocument();
    expect(screen.getByLabelText(/název produktu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cena/i)).toBeInTheDocument();
  });

  test('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<Dashboard {...mockProps} />);
    
    const backButton = screen.getByRole('button', { name: /← kiosek/i });
    await user.click(backButton);
    
    expect(mockProps.onBack).toHaveBeenCalledTimes(1);
  });

  test('calls onLogout when logout button is clicked and confirmed', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm to return true
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<Dashboard {...mockProps} />);
    
    const logoutButton = screen.getByRole('button', { name: /🚪 odhlásit se/i });
    await user.click(logoutButton);
    
    expect(mockProps.onLogout).toHaveBeenCalledTimes(1);
    
    // Restore the original confirm
    (window.confirm as jest.Mock).mockRestore();
  });

  test('handles API errors gracefully', async () => {
    // Mock failed API response
    (fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500
      })
    );
    
    // Spy on console.error to verify error handling
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<Dashboard {...mockProps} />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    
    consoleSpy.mockRestore();
  });

  test('shows loading state', async () => {
    // Mock slow API response
    (fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { products: [] } })
        }), 100)
      )
    );
    
    render(<Dashboard {...mockProps} />);
    
    expect(screen.getByText('⏳ Načítám produkty...')).toBeInTheDocument();
  });
});