import { useState } from 'react';
import { validateSchema, validationSchemas, getErrorMessage } from 'pi-kiosk-shared';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onBack: () => void;
}

export function LoginForm({ onLogin, onBack }: LoginFormProps) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateSchema(formData, validationSchemas.login);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      await onLogin(formData.username, formData.password);
    } catch (error) {
      setErrors({ general: getErrorMessage(error as Error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-screen">
      <div className="admin-login-container">
        <h2>🔐 Admin Přihlášení</h2>
        <p className="admin-subtitle">Přihlaste se pro správu kiosku</p>
        
        {errors.general && (
          <div className="error-alert" role="alert">
            {errors.general}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          <div className="form-group">
            <label htmlFor="username">Uživatelské jméno</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Zadejte uživatelské jméno"
              className={`admin-input ${errors.username ? 'error' : ''}`}
              disabled={isLoading}
              autoComplete="username"
              required
            />
            {errors.username && (
              <span className="error-message" role="alert">
                {errors.username}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Heslo</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Zadejte heslo"
              className={`admin-input ${errors.password ? 'error' : ''}`}
              disabled={isLoading}
              autoComplete="current-password"
              required
            />
            {errors.password && (
              <span className="error-message" role="alert">
                {errors.password}
              </span>
            )}
          </div>
          
          <button 
            type="submit" 
            className="admin-login-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Přihlašuji...
              </>
            ) : (
              '🔑 Přihlásit se'
            )}
          </button>
        </form>
        
        <div className="admin-credentials">
          <p><strong>Testovací údaje:</strong></p>
          <p>Uživatelské jméno: <code>admin</code></p>
          <p>Heslo: <code>admin123</code></p>
        </div>
        
        <button 
          onClick={onBack} 
          className="back-btn"
          disabled={isLoading}
        >
          ← Zpět na kiosek
        </button>
      </div>
    </div>
  );
}
