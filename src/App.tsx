import { useState } from 'react';
import { useErrorHandler } from 'pi-kiosk-shared';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'kiosk'>('kiosk');
  const { handleError } = useErrorHandler();

  // API client for potential future use
  // const apiClient = createAPIClient();

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Neplatné přihlašovací údaje');
      }

      const data = await response.json();
      setToken(data.token);
      setView('dashboard');
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  };

  const handleLogout = () => {
    setToken(null);
    setView('kiosk');
  };

  const goToKiosk = () => {
    setView('kiosk');
  };

  const goToAdmin = () => {
    setView('login');
  };

  if (view === 'login') {
    return <LoginForm onLogin={handleLogin} onBack={goToKiosk} />;
  }

  if (view === 'dashboard' && token) {
    return <Dashboard token={token} onLogout={handleLogout} onBack={goToKiosk} />;
  }

  // Default kiosk redirect view
  return (
    <div className="admin-redirect">
      <div className="redirect-container">
        <h1>🏪 Kiosk Systém</h1>
        <p>Vítejte v administraci kiosk systému</p>
        
        <div className="redirect-actions">
          <button onClick={goToAdmin} className="admin-btn">
            🔐 Admin přihlášení
          </button>
          
          <a 
            href="/?kioskId=1" 
            className="kiosk-btn"
            target="_self"
          >
            🖥️ Otevřít kiosk
          </a>
        </div>
        
        <div className="info-section">
          <h3>📋 Návod</h3>
          <ul>
            <li>Pro správu použijte Admin přihlášení</li>
            <li>Pro zákazníky otevřete kiosk rozhraní</li>
            <li>Testovací údaje: admin/admin123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
