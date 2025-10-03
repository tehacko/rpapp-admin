import { useState } from 'react';
import { useErrorHandler, getEnvironmentConfig, API_ENDPOINTS } from 'pi-kiosk-shared';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token from localStorage on app start
    return localStorage.getItem('admin_token');
  });
  const [view, setView] = useState<'login' | 'dashboard'>(() => {
    // If we have a token, go directly to dashboard
    return localStorage.getItem('admin_token') ? 'dashboard' : 'login';
  });
  const { handleError } = useErrorHandler();

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch(`${getEnvironmentConfig().apiUrl}${API_ENDPOINTS.ADMIN_LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Neplatné přihlašovací údaje');
      }

      const data = await response.json();
      const newToken = data.data.token;
      
      // Store token in localStorage for persistence
      localStorage.setItem('admin_token', newToken);
      setToken(newToken);
      setView('dashboard');
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  };

  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('admin_token');
    setToken(null);
    setView('login');
  };

  if (view === 'login') {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (view === 'dashboard' && token) {
    return <Dashboard token={token} onLogout={handleLogout} />;
  }

  // Default to login view
  return <LoginForm onLogin={handleLogin} />;
}

export default App;
