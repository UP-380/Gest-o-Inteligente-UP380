import { useAuth } from '../contexts/AuthContext';
import { hasPermissionSync, hasPagePermission, isAdmin, isGestor, isColaborador, normalizePermissionLevel, initPermissoesConfig } from '../utils/permissions';
import { useEffect, useState } from 'react';

/**
 * Hook para verificar permissões do usuário
 */
export const usePermissions = () => {
  const { usuario } = useAuth();
  const permissoes = usuario?.permissoes || null;
  const [configLoaded, setConfigLoaded] = useState(false);
  
  // Carregar configurações na inicialização
  useEffect(() => {
    initPermissoesConfig().then(() => {
      setConfigLoaded(true);
    });
  }, []);

  // Proteção contra erro se usuario ainda não estiver disponível
  let level = 'administrador'; // padrão
  try {
    level = normalizePermissionLevel(permissoes);
  } catch (error) {
    console.error('Erro ao normalizar nível de permissão:', error);
    level = 'administrador'; // fallback para administrador
  }

  /**
   * Verifica se o usuário tem permissão para acessar uma rota
   * @param {string} route - Rota a verificar
   * @returns {boolean} true se tem permissão
   */
  const canAccessRoute = (route) => {
    try {
      return hasPermissionSync(permissoes, route);
    } catch (error) {
      console.error('Erro ao verificar permissão de rota:', error);
      return true; // fallback: permitir acesso em caso de erro
    }
  };

  /**
   * Verifica se o usuário tem permissão para acessar uma página
   * @param {string} pageId - ID da página
   * @returns {boolean} true se tem permissão
   */
  const canAccessPage = (pageId) => {
    try {
      return hasPagePermission(permissoes, pageId);
    } catch (error) {
      console.error('Erro ao verificar permissão de página:', error);
      return true; // fallback: permitir acesso em caso de erro
    }
  };

  return {
    permissoes,
    level,
    canAccessRoute,
    canAccessPage,
    isAdmin: isAdmin(permissoes),
    isGestor: isGestor(permissoes),
    isColaborador: isColaborador(permissoes),
  };
};

