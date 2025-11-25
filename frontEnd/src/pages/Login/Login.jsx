import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShake(false);

    if (!email.trim() || !senha) {
      showToast('error', 'Por favor, preencha todos os campos.');
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }

    setLoading(true);

    try {
      const result = await login(email.trim(), senha);
      
      if (result.success) {
        showToast('success', 'Login realizado com sucesso! Redirecionando...');
        setTimeout(() => {
          navigate('/painel');
        }, 1500);
      } else {
        showToast('error', result.error || 'Email ou senha incorretos.');
        setShake(true);
        setTimeout(() => setShake(false), 300);
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro no login:', error);
      showToast('error', 'Erro de conexão. Tente novamente.');
      setShake(true);
      setTimeout(() => setShake(false), 300);
      setLoading(false);
    }
  };

  const showToast = (type, message) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast--error' : 'toast--success'}`;
    
    const icon = document.createElement('i');
    icon.className = `toast-icon fas ${type === 'error' ? 'fa-times-circle' : 'fa-check-circle'}`;
    
    const msg = document.createElement('div');
    msg.className = 'toast-text';
    msg.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(msg);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    const duration = type === 'error' ? 2800 : 1500;
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, duration);
  };

  const handleEmailKeyPress = (e) => {
    if (e.key === 'Enter') {
      document.getElementById('senha')?.focus();
    }
  };

  const handlePasswordKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      <div id="toastContainer" className="toast-container" aria-live="polite" aria-atomic="true"></div>
      <div className="login-container">
        <div className={`login-box ${shake ? 'shake' : ''}`}>
          <div className="login-header">
            <img 
              src="/assets/images/LOGO SISTEMA LOGIN.png" 
              alt="UP Gestão Inteligente"
              onError={(e) => {
                // Fallback se a imagem não carregar
                e.target.src = '/assets/images/LOGO DO SISTEMA .png';
                e.target.onerror = null; // Prevenir loop infinito
              }}
            />
            <p>Acesse sua conta UP Gestão Inteligente</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleEmailKeyPress}
                className={error ? 'error' : ''}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="senha">Senha:</label>
              <div className="password-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="senha"
                  name="senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyPress={handlePasswordKeyPress}
                  className={error ? 'error' : ''}
                  required
                  disabled={loading}
                />
                <i
                  className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                  onClick={togglePasswordVisibility}
                ></i>
              </div>
            </div>
            
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;

