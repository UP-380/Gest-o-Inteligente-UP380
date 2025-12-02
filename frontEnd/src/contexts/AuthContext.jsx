import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se o usuário está autenticado
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await authAPI.checkAuth();
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        // Salvar dados do usuário no localStorage se disponível
        if (data.usuario) {
          localStorage.setItem('usuario', JSON.stringify(data.usuario));
        }
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('usuario');
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      setIsAuthenticated(false);
      localStorage.removeItem('usuario');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, senha) => {
    try {
      const data = await authAPI.login(email, senha);

      if (data.success) {
        setIsAuthenticated(true);
        // Salvar dados do usuário no localStorage (opcional)
        if (data.usuario) {
          localStorage.setItem('usuario', JSON.stringify(data.usuario));
        }
        return { success: true };
      } else {
        // Tratar tanto 'error' quanto 'message' para compatibilidade
        return { success: false, error: data.error || data.message || 'Email ou senha incorretos.' };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Erro de conexão. Tente novamente.' };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, fazer logout local
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

