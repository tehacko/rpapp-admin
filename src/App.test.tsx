// Tests for main App component
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the child components
jest.mock('./components/LoginForm', () => ({
  LoginForm: ({ onLogin, onBack }: any) => (
    <div data-testid="login-form">
      <button onClick={async () => {
        try {
          await onLogin('admin', 'admin123');
        } catch (error) {
          // Simulate error handling in the component
        }
      }}>Login</button>
      <button onClick={onBack}>Back</button>
    </div>
  )
}));

jest.mock('./components/Dashboard', () => ({
  Dashboard: ({ token, onLogout, onBack }: any) => (
    <div data-testid="dashboard">
      <span>Token: {token}</span>
      <button onClick={onLogout}>Logout</button>
      <button onClick={onBack}>Back</button>
    </div>
  )
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('App Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('renders kiosk redirect view by default', () => {
    render(<App />);
    
    expect(screen.getByText('🏪 Kiosk Systém')).toBeInTheDocument();
    expect(screen.getByText('Vítejte v administraci kiosk systému')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin přihlášení/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /otevřít kiosk/i })).toBeInTheDocument();
  });

  test('navigates to login form when admin button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  test('handles successful login', async () => {
    const user = userEvent.setup();
    
    // Mock successful login response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token-123' })
    });
    
    render(<App />);
    
    // Navigate to login
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    // Perform login
    const loginButton = screen.getByText('Login');
    await user.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByText('Token: test-token-123')).toBeInTheDocument();
    });
    
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
  });

  test('handles login failure', async () => {
    const user = userEvent.setup();
    
    // Mock failed login response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    });
    
    render(<App />);
    
    // Navigate to login
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    // Perform login
    const loginButton = screen.getByText('Login');
    await user.click(loginButton);
    
    // Should stay on login form (not navigate to dashboard)
    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });
    
    // Should not show dashboard
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  test('handles logout from dashboard', async () => {
    const user = userEvent.setup();
    
    // Mock successful login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token-123' })
    });
    
    render(<App />);
    
    // Navigate to login and login
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    const loginButton = screen.getByText('Login');
    await user.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
    
    // Logout
    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);
    
    // Should return to kiosk view
    expect(screen.getByText('🏪 Kiosk Systém')).toBeInTheDocument();
  });

  test('navigates back to kiosk from login', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to login
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    
    // Navigate back
    const backButton = screen.getByText('Back');
    await user.click(backButton);
    
    expect(screen.getByText('🏪 Kiosk Systém')).toBeInTheDocument();
  });

  test('navigates back to kiosk from dashboard', async () => {
    const user = userEvent.setup();
    
    // Mock successful login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token-123' })
    });
    
    render(<App />);
    
    // Navigate to login and login
    const adminButton = screen.getByRole('button', { name: /admin přihlášení/i });
    await user.click(adminButton);
    
    const loginButton = screen.getByText('Login');
    await user.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
    
    // Navigate back
    const backButton = screen.getByText('Back');
    await user.click(backButton);
    
    expect(screen.getByText('🏪 Kiosk Systém')).toBeInTheDocument();
  });

  test('kiosk link has correct href', () => {
    render(<App />);
    
    const kioskLink = screen.getByRole('link', { name: /otevřít kiosk/i });
    expect(kioskLink).toHaveAttribute('href', '/?kioskId=1');
    expect(kioskLink).toHaveAttribute('target', '_self');
  });

  test('displays navigation instructions', () => {
    render(<App />);
    
    expect(screen.getByText('📋 Návod')).toBeInTheDocument();
    expect(screen.getByText('Pro správu použijte Admin přihlášení')).toBeInTheDocument();
    expect(screen.getByText('Pro zákazníky otevřete kiosk rozhraní')).toBeInTheDocument();
    expect(screen.getByText('Testovací údaje: admin/admin123')).toBeInTheDocument();
  });
});
