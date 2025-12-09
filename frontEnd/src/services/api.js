/**
 * Serviço centralizado de API
 * Todas as chamadas HTTP do sistema devem ser feitas através deste arquivo
 */

// Configuração da URL base da API
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.ApiConfig) {
    return window.ApiConfig.baseURL;
  }
  // Em desenvolvimento, usa o proxy do Vite que redireciona /api para localhost:4000
  // Em produção, usa /api diretamente
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Cache helper (duração de 5 minutos)
const CACHE_DURATION = 5 * 60 * 1000;
const cache = {
  get(key) {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION) {
        sessionStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  set(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore cache errors
    }
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      // Ignore cache errors
    }
  },
  clear() {
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('api_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Ignore cache errors
    }
  }
};

// Função helper para fazer requisições
const request = async (url, options = {}) => {
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  // Verificar se a resposta é JSON
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Resposta não é JSON! Content-Type:', contentType);
    console.error('❌ Status:', response.status);
    console.error('❌ URL:', url);
    console.error('❌ Primeiros 500 caracteres da resposta:', text.substring(0, 500));
    throw new Error(`Resposta não é JSON. Status: ${response.status}. Content-Type: ${contentType}. Verifique se o servidor backend está rodando na porta 4000 e se o proxy do Vite está configurado.`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// ============================================
// AUTENTICAÇÃO
// ============================================

export const authAPI = {
  /**
   * Verifica se o usuário está autenticado
   */
  async checkAuth() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/check`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Status:', response.status);
        console.error('❌ Content-Type:', contentType);
        console.error('❌ Resposta:', text.substring(0, 200));
        
        // Se não for JSON, retornar resposta padrão
        return {
          authenticated: false,
          error: 'Resposta inválida do servidor'
        };
      }

      // Se a resposta não for ok, tentar ler o JSON de erro
      if (!response.ok) {
        try {
          const errorData = await response.json();
          return {
            authenticated: false,
            error: errorData.error || errorData.message || `HTTP error! status: ${response.status}`
          };
        } catch (e) {
          return {
            authenticated: false,
            error: `HTTP error! status: ${response.status}`
          };
        }
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao verificar autenticação:', error);
      return {
        authenticated: false,
        error: error.message || 'Erro de conexão'
      };
    }
  },

  /**
   * Faz login do usuário
   * @param {string} email 
   * @param {string} senha 
   */
  async login(email, senha) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, senha }),
    });
    return await response.json();
  },

  /**
   * Faz logout do usuário
   */
  async logout() {
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return await response.json();
  },

  /**
   * Atualiza o perfil do usuário
   * @param {Object} dados - { nome_usuario?, senha_login? }
   */
  async updateProfile(dados) {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(dados),
    });
    return await response.json();
  },

  /**
   * Faz upload de uma foto de perfil personalizada
   */
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE_URL}/auth/upload-avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao fazer upload' }));
      throw new Error(error.error || 'Erro ao fazer upload da imagem');
    }

    return await response.json();
  },

  /**
   * Busca o caminho da imagem customizada do usuário
   */
  async getCustomAvatarPath() {
    const response = await fetch(`${API_BASE_URL}/auth/custom-avatar-path`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { success: false, imagePath: null };
    }

    return await response.json();
  }
};

// ============================================
// CLIENTES
// ============================================

export const clientesAPI = {
  /**
   * Busca todos os clientes
   * @param {string|null} status - Filtro opcional por status
   * @param {boolean} useCache - Se deve usar cache (padrão: true)
   */
  async getAll(status = null, useCache = true) {
    const cacheKey = `api_cache_clientes_${status || 'all'}`;
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    let url = `${API_BASE_URL}/clientes`;
    if (status) {
      url += `?status=${encodeURIComponent(status)}`;
    }

    const result = await request(url);
    
    if (result.success && result.data && Array.isArray(result.data)) {
      if (useCache) cache.set(cacheKey, result.data);
      return result;
    }
    
    return result;
  },

  /**
   * Busca clientes paginados para gestão
   * @param {Object} params - { page, limit, search, status, incompletos }
   */
  async getPaginated({ page = 1, limit = 20, search = null, status = null, incompletos = false }) {
    let url = `${API_BASE_URL}/gestao-clientes?page=${page}&limit=${limit}`;
    
    if (search && search.trim() !== '') {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    if (status && !incompletos) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    
    if (incompletos) {
      url += `&incompletos=true`;
    }

    return await request(url);
  },

  /**
   * Busca clientes por colaborador(es)
   * @param {string|string[]} colaboradorId - ID(s) do(s) colaborador(es)
   * @param {string|null} periodoInicio - Data de início (opcional)
   * @param {string|null} periodoFim - Data de fim (opcional)
   */
  async getByColaborador(colaboradorId, periodoInicio = null, periodoFim = null) {
    const colaboradorIds = Array.isArray(colaboradorId) ? colaboradorId : [colaboradorId];
    
    const params = [];
    colaboradorIds.forEach(id => {
      params.push(`colaboradorId=${encodeURIComponent(id)}`);
    });
    
    if (periodoInicio && periodoFim) {
      params.push(`periodoInicio=${encodeURIComponent(periodoInicio)}`);
      params.push(`periodoFim=${encodeURIComponent(periodoFim)}`);
    }
    
    const url = `${API_BASE_URL}/clientes-por-colaborador?${params.join('&')}`;
    return await request(url);
  },

  /**
   * Busca relatórios de clientes paginados
   * @param {Object} params - { page, limit, status, clienteId, colaboradorId, dataInicio, dataFim }
   */
  async getRelatorios({ 
    page = 1, 
    limit = 20, 
    status = null, 
    clienteId = null, 
    colaboradorId = null, 
    dataInicio = null, 
    dataFim = null 
  }) {
    let url = `${API_BASE_URL}/relatorios-clientes?page=${page}&limit=${limit}`;
    
    if (status) url += `&status=${encodeURIComponent(status)}`;
    
    if (clienteId) {
      const clienteIds = Array.isArray(clienteId) ? clienteId : [clienteId];
      clienteIds.forEach(id => {
        url += `&clienteId=${encodeURIComponent(id)}`;
      });
    }
    
    if (colaboradorId) {
      const colaboradorIds = Array.isArray(colaboradorId) ? colaboradorId : [colaboradorId];
      colaboradorIds.forEach(id => {
        url += `&colaboradorId=${encodeURIComponent(id)}`;
      });
    }
    
    if (dataInicio) url += `&dataInicio=${encodeURIComponent(dataInicio)}`;
    if (dataFim) url += `&dataFim=${encodeURIComponent(dataFim)}`;

    return await request(url);
  },

  /**
   * Busca clientes Kamino
   */
  async getKamino() {
    return await request(`${API_BASE_URL}/clientes-kamino`);
  },

  /**
   * Busca contagem de clientes incompletos
   */
  async getIncompletosCount() {
    return await request(`${API_BASE_URL}/clientes-incompletos-count`);
  },

  /**
   * Busca dados de um cliente por nome ClickUp
   * @param {string} clickupName 
   */
  async getByClickupName(clickupName) {
    return await request(`${API_BASE_URL}/cliente-dados/${encodeURIComponent(clickupName)}`);
  },

  /**
   * Atualiza dados de um cliente
   * @param {number|string} id - ID do cliente
   * @param {Object} data - Dados do cliente
   * @param {string|null} clickupName - Nome ClickUp (opcional, se fornecido usa endpoint diferente)
   */
  async update(id, data, clickupName = null) {
    const endpoint = clickupName && clickupName.trim() !== ''
      ? `${API_BASE_URL}/cliente-dados/${encodeURIComponent(clickupName.trim())}`
      : `${API_BASE_URL}/clientes/${id}`;
    
    return await request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Inativa um cliente
   * @param {number|string} id 
   */
  async inativar(id) {
    return await request(`${API_BASE_URL}/clientes/${id}/inativar`, {
      method: 'POST'
    });
  },

  /**
   * Ativa um cliente
   * @param {number|string} id 
   */
  async ativar(id) {
    return await request(`${API_BASE_URL}/clientes/${id}/ativar`, {
      method: 'POST'
    });
  }
};

// ============================================
// COLABORADORES / MEMBROS
// ============================================

export const colaboradoresAPI = {
  /**
   * Busca todos os colaboradores (membros-id-nome)
   * @param {boolean} useCache - Se deve usar cache (padrão: true)
   */
  async getAll(useCache = true) {
    const cacheKey = 'api_cache_colaboradores_all';
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    const result = await request(`${API_BASE_URL}/membros-id-nome`);
    
    if (result.success && result.data && Array.isArray(result.data)) {
      // Garantir que todos os colaboradores tenham status
      const colaboradoresComStatus = result.data.map(colab => ({
        ...colab,
        status: colab.status || 'ativo'
      }));
      
      if (useCache) cache.set(cacheKey, colaboradoresComStatus);
      return { ...result, data: colaboradoresComStatus };
    }
    
    return result;
  },

  /**
   * Busca colaboradores por cliente(s)
   * @param {string|string[]} clienteId - ID(s) do(s) cliente(s)
   * @param {string|null} periodoInicio - Data de início (opcional)
   * @param {string|null} periodoFim - Data de fim (opcional)
   */
  async getByCliente(clienteId, periodoInicio = null, periodoFim = null) {
    const clienteIds = Array.isArray(clienteId) ? clienteId : [clienteId];
    
    const params = [];
    clienteIds.forEach(id => {
      params.push(`clienteId=${encodeURIComponent(id)}`);
    });
    
    if (periodoInicio && periodoFim) {
      params.push(`periodoInicio=${encodeURIComponent(periodoInicio)}`);
      params.push(`periodoFim=${encodeURIComponent(periodoFim)}`);
    }
    
    const url = `${API_BASE_URL}/membros-por-cliente?${params.join('&')}`;
    return await request(url);
  },

  /**
   * Busca colaboradores paginados para gestão
   * @param {Object} params - { page, limit, search, colaboradorId, dtVigencia }
   */
  async getPaginated({ page = 1, limit = 20, search = null, colaboradorId = null, dtVigencia = null }) {
    const params = [`page=${page}`, `limit=${limit}`];
    
    if (search && search.trim() !== '') {
      params.push(`search=${encodeURIComponent(search.trim())}`);
    }
    
    if (colaboradorId) {
      params.push(`colaboradorId=${encodeURIComponent(colaboradorId)}`);
    }
    
    if (dtVigencia) {
      params.push(`dtVigencia=${encodeURIComponent(dtVigencia)}`);
    }

    const url = `${API_BASE_URL}/colaboradores?${params.join('&')}`;
    return await request(url);
  },

  /**
   * Busca um colaborador por ID
   * @param {number|string} id 
   */
  async getById(id) {
    return await request(`${API_BASE_URL}/colaboradores/${id}`);
  },

  /**
   * Cria um novo colaborador
   * @param {Object} data 
   */
  async create(data) {
    return await request(`${API_BASE_URL}/colaboradores`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Atualiza um colaborador
   * @param {number|string} id 
   * @param {Object} data 
   */
  async update(id, data) {
    return await request(`${API_BASE_URL}/colaboradores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Inativa um colaborador
   * @param {number|string} id 
   */
  async inativar(id) {
    return await request(`${API_BASE_URL}/colaboradores/${id}/inativar`, {
      method: 'POST'
    });
  },

  /**
   * Busca relatórios de colaboradores paginados
   * @param {Object} params - { page, limit, clienteId, colaboradorId, dataInicio, dataFim }
   */
  async getRelatorios({ 
    page = 1, 
    limit = 20, 
    clienteId = null, 
    colaboradorId = null, 
    dataInicio = null, 
    dataFim = null 
  }) {
    let url = `${API_BASE_URL}/relatorios-colaboradores?page=${page}&limit=${limit}`;
    
    if (clienteId) {
      const clienteIds = Array.isArray(clienteId) ? clienteId : [clienteId];
      clienteIds.forEach(id => {
        url += `&clienteId=${encodeURIComponent(id)}`;
      });
    }
    
    if (colaboradorId) {
      const colaboradorIds = Array.isArray(colaboradorId) ? colaboradorId : [colaboradorId];
      colaboradorIds.forEach(id => {
        url += `&colaboradorId=${encodeURIComponent(id)}`;
      });
    }
    
    if (dataInicio) url += `&dataInicio=${encodeURIComponent(dataInicio)}`;
    if (dataFim) url += `&dataFim=${encodeURIComponent(dataFim)}`;

    return await request(url);
  }
};

// ============================================
// STATUS
// ============================================

export const statusAPI = {
  /**
   * Busca todos os status
   * @param {number|string|null} clienteId - ID do cliente (opcional)
   * @param {boolean} useCache - Se deve usar cache (padrão: true)
   */
  async getAll(clienteId = null, useCache = true) {
    const cacheKey = `api_cache_status_${clienteId || 'all'}`;
    
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    let url = `${API_BASE_URL}/status`;
    if (clienteId) {
      url += `?clienteId=${clienteId}`;
    }

    const result = await request(url);
    
    if (result.success && result.data && Array.isArray(result.data)) {
      if (useCache) cache.set(cacheKey, result.data);
      return result;
    }
    
    return result;
  }
};

// ============================================
// TAREFAS
// ============================================

export const tarefasAPI = {
  /**
   * Busca tarefas por IDs
   * @param {string|string[]} ids - ID(s) da(s) tarefa(s)
   */
  async getByIds(ids) {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const idsParam = idsArray.join(',');
    return await request(`${API_BASE_URL}/tarefas-por-ids?ids=${encodeURIComponent(idsParam)}`);
  },

  /**
   * Busca tarefas incompletas
   */
  async getIncompletas() {
    return await request(`${API_BASE_URL}/tarefas-incompletas`);
  }
};

// ============================================
// PRODUTOS
// ============================================

export const produtosAPI = {
  /**
   * Busca produtos por IDs
   * @param {string|string[]} ids - ID(s) do(s) produto(s)
   */
  async getByIds(ids) {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const idsParam = idsArray.join(',');
    return await request(`${API_BASE_URL}/produtos-por-ids?ids=${encodeURIComponent(idsParam)}`);
  }
};

// ============================================
// CONTRATOS
// ============================================

export const contratosAPI = {
  /**
   * Busca contratos por nome do cliente (ClickUp)
   * @param {string} clickupName 
   */
  async getByClienteName(clickupName) {
    return await request(`${API_BASE_URL}/contratos-cliente/${encodeURIComponent(clickupName)}`);
  },

  /**
   * Busca contratos por ID do cliente
   * @param {number|string} clienteId 
   */
  async getByClienteId(clienteId) {
    return await request(`${API_BASE_URL}/contratos-cliente-id/${encodeURIComponent(String(clienteId).trim())}`);
  }
};

// ============================================
// CUSTO COLABORADOR VIGÊNCIA
// ============================================

export const custoColaboradorVigenciaAPI = {
  /**
   * Busca custos de colaborador vigência
   * @param {Object} params - { colaboradorId, dtVigencia }
   */
  async getAll({ colaboradorId = null, dtVigencia = null } = {}) {
    const params = [];
    
    if (colaboradorId) {
      params.push(`colaboradorId=${encodeURIComponent(colaboradorId)}`);
    }
    
    if (dtVigencia) {
      params.push(`dtVigencia=${encodeURIComponent(dtVigencia)}`);
    }

    const url = params.length > 0 
      ? `${API_BASE_URL}/custo-colaborador-vigencia?${params.join('&')}`
      : `${API_BASE_URL}/custo-colaborador-vigencia`;
    
    return await request(url);
  },

  /**
   * Cria uma nova vigência
   * @param {Object} data 
   */
  async create(data) {
    return await request(`${API_BASE_URL}/custo-colaborador-vigencia`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Atualiza uma vigência
   * @param {number|string} id 
   * @param {Object} data 
   */
  async update(id, data) {
    return await request(`${API_BASE_URL}/custo-colaborador-vigencia/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Deleta uma vigência
   * @param {number|string} id 
   */
  async delete(id) {
    return await request(`${API_BASE_URL}/custo-colaborador-vigencia/${id}`, {
      method: 'DELETE'
    });
  }
};

// ============================================
// EXPORTAR FUNÇÕES DE CACHE (para limpeza quando necessário)
// ============================================

export const cacheAPI = {
  get: (key) => cache.get(key),
  set: (key, data) => cache.set(key, data),
  remove: (key) => cache.remove(key),
  clear: () => cache.clear()
};

// ============================================
// REGISTRO TEMPO
// ============================================

export const registroTempoAPI = {
  /**
   * Busca registros de tempo sem tarefa_id (tarefas desajustadas)
   */
  async getSemTarefa() {
    return await request(`${API_BASE_URL}/registro-tempo-sem-tarefa`);
  }
};

// Exportar URL base para uso externo se necessário
export { getApiBaseUrl };

