// Tests for LoginForm component
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm Component', () => {
  const mockOnLogin = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    mockOnLogin.mockClear();
    mockOnBack.mockClear();
  });

  test('renders login form elements', () => {
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    expect(screen.getByText('🔐 Admin Přihlášení')).toBeInTheDocument();
    expect(screen.getByText('Přihlaste se pro správu kiosku')).toBeInTheDocument();
    expect(screen.getByLabelText(/uživatelské jméno/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/heslo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🔑 přihlásit se/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /← zpět na kiosek/i })).toBeInTheDocument();
  });

  test('handles form input changes', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const usernameInput = screen.getByLabelText(/uživatelské jméno/i);
    const passwordInput = screen.getByLabelText(/heslo/i);
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    
    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('testpass');
  });

  test('calls onLogin with correct credentials on form submission', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const usernameInput = screen.getByLabelText(/uživatelské jméno/i);
    const passwordInput = screen.getByLabelText(/heslo/i);
    const submitButton = screen.getByRole('button', { name: /🔑 přihlásit se/i });
    
    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.click(submitButton);
    
    expect(mockOnLogin).toHaveBeenCalledWith('admin', 'admin123');
  });

  test('calls onLogin when Enter is pressed in password field', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const usernameInput = screen.getByLabelText(/uživatelské jméno/i);
    const passwordInput = screen.getByLabelText(/heslo/i);
    
    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.keyboard('{Enter}');
    
    expect(mockOnLogin).toHaveBeenCalledWith('admin', 'admin123');
  });

  test('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const backButton = screen.getByRole('button', { name: /← zpět na kiosek/i });
    await user.click(backButton);
    
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  test('shows loading state during login attempt', async () => {
    const user = userEvent.setup();
    
    // Mock onLogin to return a promise that we can control
    let resolveLogin: () => void;
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    mockOnLogin.mockReturnValue(loginPromise);
    
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const usernameInput = screen.getByLabelText(/uživatelské jméno/i);
    const passwordInput = screen.getByLabelText(/heslo/i);
    const submitButton = screen.getByRole('button', { name: /🔑 přihlásit se/i });
    
    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.click(submitButton);
    
    // Should show loading state
    expect(screen.getByText(/přihlašuji/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    
    // Resolve the login
    resolveLogin!();
    await waitFor(() => {
      expect(screen.queryByText(/přihlašuji/i)).not.toBeInTheDocument();
    });
  });

  test('shows error message on login failure', async () => {
    const user = userEvent.setup();
    
    // Mock onLogin to throw an error
    mockOnLogin.mockRejectedValue(new Error('Neplatné přihlašovací údaje'));
    
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const usernameInput = screen.getByLabelText(/uživatelské jméno/i);
    const passwordInput = screen.getByLabelText(/heslo/i);
    const submitButton = screen.getByRole('button', { name: /🔑 přihlásit se/i });
    
    await user.type(usernameInput, 'wrong');
    await user.type(passwordInput, 'credentials');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Neplatné přihlašovací údaje')).toBeInTheDocument();
    });
  });

  test('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const submitButton = screen.getByRole('button', { name: /🔑 přihlásit se/i });
    await user.click(submitButton);
    
    // Should show validation errors (both username and password)
    await waitFor(() => {
      const errorMessages = screen.getAllByText('Toto pole je povinné');
      expect(errorMessages).toHaveLength(2); // One for username, one for password
    });
    
    // Should not call onLogin with empty fields
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('prevents submission with empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    const submitButton = screen.getByRole('button', { name: /🔑 přihlásit se/i });
    await user.click(submitButton);
    
    // Should not call onLogin with empty fields (validation should prevent it)
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('displays test credentials', () => {
    render(<LoginForm onLogin={mockOnLogin} onBack={mockOnBack} />);
    
    expect(screen.getByText('Testovací údaje:')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('admin123')).toBeInTheDocument();
  });
});
