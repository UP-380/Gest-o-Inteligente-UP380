import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const { isAuthenticated, loading, usuario } = useAuth();
  const { canAccessRoute } = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Só verificar permissões se o usuário e a função estiverem disponíveis
  if (usuario && canAccessRoute) {
    try {
      // Se há uma permissão específica requerida, verificar
      if (requiredPermission) {
        if (!canAccessRoute(requiredPermission)) {
          // Redirecionar para painel-colaborador se for colaborador
          return <Navigate to="/painel-colaborador" replace />;
        }
      } else {
        // Verificar pela rota atual
        const currentRoute = location.pathname;
        if (!canAccessRoute(currentRoute)) {
          // Se for colaborador tentando acessar /painel, redirecionar para painel-colaborador
          if (currentRoute === '/painel') {
            return <Navigate to="/painel-colaborador" replace />;
          }
          // Redirecionar para painel-colaborador
          return <Navigate to="/painel-colaborador" replace />;
        }
      }
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      // Em caso de erro, permitir acesso para não quebrar a aplicação
    }
  }

  return children;
};

export default ProtectedRoute;

