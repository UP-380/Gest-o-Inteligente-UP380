/**
 * Utilitário para verificação de permissões por NÍVEIS
 * 
 * A coluna 'permissoes' na tabela usuarios deve conter:
 * - null ou 'administrador': acesso total a todas as páginas
 * - 'gestor': acesso a todas as páginas do sistema
 * - 'colaborador': acesso apenas a painel-colaborador e base-conhecimento/conteudos-clientes
 */

/**
 * Níveis de permissão disponíveis
 */
export const PERMISSION_LEVELS = {
  ADMINISTRADOR: 'administrador',
  GESTOR: 'gestor',
  COLABORADOR: 'colaborador',
};

/**
 * Cache de configurações de permissões
 */
let permissoesConfigCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Busca configurações de permissões do servidor
 */
async function fetchPermissoesConfig() {
  try {
    const response = await fetch('/api/permissoes-config', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const config = {};
        result.data.forEach(item => {
          config[item.nivel] = item.paginas;
        });
        return config;
      }
    }
  } catch (error) {
    console.error('Erro ao buscar configurações de permissões:', error);
  }
  
  // Retornar configurações padrão em caso de erro
  return {
    [PERMISSION_LEVELS.GESTOR]: null,
    [PERMISSION_LEVELS.COLABORADOR]: [
      '/painel-colaborador',
      '/base-conhecimento/conteudos-clientes',
      '/base-conhecimento/cliente',
    ],
  };
}

/**
 * Obtém configurações de permissões (com cache)
 */
async function getPermissoesConfig() {
  const now = Date.now();
  
  // Se o cache é válido, retornar do cache
  if (permissoesConfigCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return permissoesConfigCache;
  }

  // Buscar do servidor
  permissoesConfigCache = await fetchPermissoesConfig();
  cacheTimestamp = now;
  
  return permissoesConfigCache;
}

/**
 * Limpa o cache de configurações (útil após atualizar)
 */
export function clearPermissoesConfigCache() {
  permissoesConfigCache = null;
  cacheTimestamp = null;
}

/**
 * Páginas permitidas para cada nível (será sobrescrito pelas configurações do banco)
 */
let LEVEL_PAGES = {
  [PERMISSION_LEVELS.ADMINISTRADOR]: null, // null = todas as páginas (sempre)
  [PERMISSION_LEVELS.GESTOR]: null, // null = todas as páginas (padrão)
  [PERMISSION_LEVELS.COLABORADOR]: [
    '/painel-colaborador',
    '/base-conhecimento/conteudos-clientes',
    '/base-conhecimento/cliente',
  ],
};

/**
 * Inicializa as configurações de permissões
 */
export async function initPermissoesConfig() {
  try {
    const config = await getPermissoesConfig();
    LEVEL_PAGES = {
      [PERMISSION_LEVELS.ADMINISTRADOR]: null, // Sempre todas
      [PERMISSION_LEVELS.GESTOR]: config[PERMISSION_LEVELS.GESTOR] ?? null,
      [PERMISSION_LEVELS.COLABORADOR]: config[PERMISSION_LEVELS.COLABORADOR] ?? [
        '/painel-colaborador',
        '/base-conhecimento/conteudos-clientes',
        '/base-conhecimento/cliente',
      ],
    };
  } catch (error) {
    console.error('Erro ao inicializar configurações de permissões:', error);
    // Manter valores padrão
  }
}

/**
 * Normaliza o nível de permissão do usuário
 * @param {string|null} permissoes - Permissões do usuário
 * @returns {string|null} Nível de permissão normalizado
 */
export const normalizePermissionLevel = (permissoes) => {
  try {
    if (!permissoes || permissoes === 'null' || permissoes === '') {
      return PERMISSION_LEVELS.ADMINISTRADOR; // null = administrador
    }

    // Se for string, normalizar
    if (typeof permissoes === 'string') {
      const normalized = permissoes.toLowerCase().trim();
      
      // Se for JSON, tentar parsear
      if (normalized.startsWith('[') || normalized.startsWith('{')) {
        try {
          const parsed = JSON.parse(permissoes);
          // Se for array vazio ou null, é administrador
          if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
            return PERMISSION_LEVELS.ADMINISTRADOR;
          }
          // Se for array com valores, tratar como colaborador (compatibilidade)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return PERMISSION_LEVELS.COLABORADOR;
          }
        } catch (e) {
          // Se não for JSON válido, continuar com a string
        }
      }
      
      // Verificar se é um dos níveis válidos
      if (normalized === PERMISSION_LEVELS.ADMINISTRADOR || 
          normalized === PERMISSION_LEVELS.GESTOR || 
          normalized === PERMISSION_LEVELS.COLABORADOR) {
        return normalized;
      }
      
      // Se não reconhecer, assumir colaborador (mais restritivo)
      return PERMISSION_LEVELS.COLABORADOR;
    }

    return PERMISSION_LEVELS.ADMINISTRADOR;
  } catch (error) {
    console.error('Erro ao normalizar nível de permissão:', error);
    // Em caso de erro, retornar administrador (mais permissivo) para não bloquear
    return PERMISSION_LEVELS.ADMINISTRADOR;
  }
};

/**
 * Verifica se o usuário tem permissão para acessar uma rota
 * @param {string|null} permissoes - Permissões do usuário (nível)
 * @param {string} route - Rota a verificar
 * @returns {boolean} true se tem permissão, false caso contrário
 */
export const hasPermission = async (permissoes, route) => {
  try {
    if (!route) {
      return true; // Se não há rota, permitir
    }

    const level = normalizePermissionLevel(permissoes);
    
    // Se for administrador, sempre permitir
    if (level === PERMISSION_LEVELS.ADMINISTRADOR) {
      return true;
    }

    // Buscar configurações atualizadas (com cache)
    const config = await getPermissoesConfig();
    const allowedPages = config[level] ?? LEVEL_PAGES[level];

    // Se allowedPages é null, usuário tem acesso total
    if (allowedPages === null) {
      return true;
    }

    // Normalizar a rota
    const normalizedRoute = route.split('?')[0]; // Remover query params
    const normalizedRouteNoTrailing = normalizedRoute.replace(/\/$/, ''); // Remover trailing slash

    // Verificar se a rota está nas páginas permitidas
    if (Array.isArray(allowedPages)) {
      for (const allowedPage of allowedPages) {
        if (normalizedRoute === allowedPage || 
            normalizedRouteNoTrailing === allowedPage ||
            normalizedRoute.startsWith(allowedPage) ||
            normalizedRouteNoTrailing.startsWith(allowedPage)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    // Em caso de erro, permitir acesso para não quebrar a aplicação
    return true;
  }
};

/**
 * Versão síncrona (usa cache) - para uso em componentes React
 */
export const hasPermissionSync = (permissoes, route) => {
  try {
    if (!route) {
      return true;
    }

    const level = normalizePermissionLevel(permissoes);
    
    // Se for administrador, sempre permitir
    if (level === PERMISSION_LEVELS.ADMINISTRADOR) {
      return true;
    }

    // Usar cache ou padrão
    const allowedPages = permissoesConfigCache?.[level] ?? LEVEL_PAGES[level];

    if (allowedPages === null) {
      return true;
    }

    const normalizedRoute = route.split('?')[0];
    const normalizedRouteNoTrailing = normalizedRoute.replace(/\/$/, '');

    if (Array.isArray(allowedPages)) {
      for (const allowedPage of allowedPages) {
        if (normalizedRoute === allowedPage || 
            normalizedRouteNoTrailing === allowedPage ||
            normalizedRoute.startsWith(allowedPage) ||
            normalizedRouteNoTrailing.startsWith(allowedPage)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    return true;
  }
};

/**
 * Verifica se o usuário tem permissão para acessar uma página específica
 * @param {string|null} permissoes - Permissões do usuário (nível)
 * @param {string} pageId - ID da página
 * @returns {boolean} true se tem permissão, false caso contrário
 */
export const hasPagePermission = (permissoes, pageId) => {
  const level = normalizePermissionLevel(permissoes);
  const allowedPages = LEVEL_PAGES[level];

  // Se allowedPages é null, usuário tem acesso total
  if (allowedPages === null) {
    return true;
  }

  // Verificar se o pageId está nas páginas permitidas
  return allowedPages.some(page => pageId === page || pageId.startsWith(page));
};

/**
 * Verifica se o usuário é administrador
 * @param {string|null} permissoes - Permissões do usuário
 * @returns {boolean} true se é administrador
 */
export const isAdmin = (permissoes) => {
  return normalizePermissionLevel(permissoes) === PERMISSION_LEVELS.ADMINISTRADOR;
};

/**
 * Verifica se o usuário é gestor
 * @param {string|null} permissoes - Permissões do usuário
 * @returns {boolean} true se é gestor
 */
export const isGestor = (permissoes) => {
  return normalizePermissionLevel(permissoes) === PERMISSION_LEVELS.GESTOR;
};

/**
 * Verifica se o usuário é colaborador
 * @param {string|null} permissoes - Permissões do usuário
 * @returns {boolean} true se é colaborador
 */
export const isColaborador = (permissoes) => {
  return normalizePermissionLevel(permissoes) === PERMISSION_LEVELS.COLABORADOR;
};
