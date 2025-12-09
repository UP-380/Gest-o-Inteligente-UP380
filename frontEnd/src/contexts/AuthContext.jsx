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
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    // Verificar se o usuário está autenticado
    checkAuth();
  }, []);

  // Função para obter dados do usuário do localStorage
  const getUsuarioFromStorage = () => {
    try {
      const usuarioStorage = localStorage.getItem('usuario');
      if (usuarioStorage) {
        return JSON.parse(usuarioStorage);
      }
    } catch (error) {
      console.error('Erro ao ler dados do usuário do localStorage:', error);
    }
    return null;
  };

  // Atualizar estado do usuário quando localStorage mudar
  useEffect(() => {
    const usuarioStorage = getUsuarioFromStorage();
    setUsuario(usuarioStorage);
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const data = await authAPI.checkAuth();
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        // Salvar dados do usuário no localStorage se disponível
        if (data.usuario) {
          // Garantir que foto_perfil_path esteja disponível se for avatar customizado
          const usuarioCompleto = { ...data.usuario };
          if (data.usuario.foto_perfil_path) {
            usuarioCompleto.foto_perfil_path = data.usuario.foto_perfil_path;
          }
          localStorage.setItem('usuario', JSON.stringify(usuarioCompleto));
          setUsuario(usuarioCompleto);
        } else {
          // Se não veio do servidor, tentar do localStorage
          const usuarioStorage = getUsuarioFromStorage();
          setUsuario(usuarioStorage);
        }
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem('usuario');
        setUsuario(null);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      setIsAuthenticated(false);
      localStorage.removeItem('usuario');
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, senha) => {
    try {
      const data = await authAPI.login(email, senha);

      if (data.success) {
        setIsAuthenticated(true);
        // Salvar dados do usuário no localStorage
        if (data.usuario) {
          localStorage.setItem('usuario', JSON.stringify(data.usuario));
          setUsuario(data.usuario);
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
      localStorage.removeItem('usuario');
      setUsuario(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, fazer logout local
      setIsAuthenticated(false);
      localStorage.removeItem('usuario');
      setUsuario(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, checkAuth, usuario }}>
      {children}
    </AuthContext.Provider>
  );
};

