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
    throw new Error(`Resposta não é JSON. Status: ${response.status}. Content-Type: ${contentType}. Verifique se o servidor backend está rodando.`);
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
    try {
      const response = await fetch(`${API_BASE_URL}/auth/custom-avatar-path`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Se for erro 503 ou 404, retornar imediatamente sem tentar parsear
      if (response.status === 503 || response.status === 404) {
        return { success: false, imagePath: null };
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, imagePath: null };
      }

      if (!response.ok) {
        return { success: false, imagePath: null };
      }

      return await response.json();
    } catch (error) {
      // Em caso de erro, retornar sem sucesso (não lançar exceção para evitar loops)
      return { success: false, imagePath: null };
    }
  }
};

// ============================================
// CLIENTES
// ============================================

export const clientesAPI = {
  /**
   * Faz upload de uma foto de perfil personalizada para cliente
   * @param {File} file - Arquivo de imagem
   * @param {string} clienteId - ID do cliente
   */
  async uploadClienteFoto(file, clienteId) {
    const formData = new FormData();
    formData.append('foto', file);

    const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/upload-foto`, {
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
   * Busca o caminho da imagem customizada do cliente
   * @param {string} clienteId - ID do cliente
   */
  async getClienteCustomAvatarPath(clienteId) {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}/custom-avatar-path`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Se for erro 503 ou 404, retornar imediatamente sem tentar parsear
      if (response.status === 503 || response.status === 404) {
        return { success: false, imagePath: null };
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, imagePath: null };
      }

      if (!response.ok) {
        return { success: false, imagePath: null };
      }

      return await response.json();
    } catch (error) {
      // Em caso de erro, retornar sem sucesso (não lançar exceção para evitar loops)
      return { success: false, imagePath: null };
    }
  },
  /**
   * Busca um cliente por ID
   * @param {string|number} id - ID do cliente
   */
  async getClientePorId(id) {
    return await request(`${API_BASE_URL}/clientes/${id}`);
  },

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
   * Busca clientes paginados para cadastro
   * @param {Object} params - { page, limit, search, status, incompletos }
   */
  async getPaginated({ page = 1, limit = 20, search = null, status = null, incompletos = false }) {
    let url = `${API_BASE_URL}/clientes?page=${page}&limit=${limit}`;

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
   * Atualiza dados de um cliente
   * @param {number|string} id - ID do cliente
   * @param {Object} data - Dados do cliente
   */
  async update(id, data) {
    return await request(`${API_BASE_URL}/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Inativa um cliente
   * @param {number|string} id 
   */
  async inativar(id) {
    return await request(`${API_BASE_URL}/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'inativo' })
    });
  },

  /**
   * Ativa um cliente
   * @param {number|string} id 
   */
  async ativar(id) {
    return await request(`${API_BASE_URL}/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ativo' })
    });
  }
};

// ============================================
// COLABORADORES / MEMBROS
// ============================================

export const colaboradoresAPI = {
  /**
   * Busca todos os colaboradores (membros-id-nome) - apenas com usuários vinculados
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
   * Busca TODOS os colaboradores (incluindo os sem usuário vinculado) - para relatórios
   * @param {boolean} useCache - Se deve usar cache (padrão: true)
   */
  async getAllIncludingWithoutUser(useCache = true) {
    const cacheKey = 'api_cache_colaboradores_all_todos';

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached) return { success: true, data: cached };
    }

    const result = await request(`${API_BASE_URL}/membros-id-nome-todos`);

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
    return await request(`${API_BASE_URL}/colaboradores/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'inativo' })
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
  /**
   * Busca produtos por IDs
   * @param {string|string[]} ids - ID(s) do(s) produto(s)
   */
  async getByIds(ids) {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const idsParam = idsArray.join(',');
    return await request(`${API_BASE_URL}/produtos-por-ids?ids=${encodeURIComponent(idsParam)}`);
  },

  /**
   * Busca um produto por ID
   * @param {string} id - ID do produto
   */
  async getById(id) {
    return await request(`${API_BASE_URL}/produtos/${id}`);
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
// HISTÓRICO DE ATRIBUIÇÕES
// ============================================

export const historicoAtribuicoesAPI = {
  /**
   * Busca histórico de atribuições com filtros e paginação
   * @param {Object} params - { page, limit, responsavel_id, usuario_criador_id, data_inicio, data_fim }
   */
  async getAll({ page = 1, limit = 20, cliente_id = null, responsavel_id = null, usuario_criador_id = null, data_inicio = null, data_fim = null } = {}) {
    const params = [`page=${page}`, `limit=${limit}`];

    if (cliente_id) params.push(`cliente_id=${encodeURIComponent(cliente_id)}`);
    if (responsavel_id) params.push(`responsavel_id=${encodeURIComponent(responsavel_id)}`);
    if (usuario_criador_id) params.push(`usuario_criador_id=${encodeURIComponent(usuario_criador_id)}`);
    if (data_inicio) params.push(`data_inicio=${encodeURIComponent(data_inicio)}`);
    if (data_fim) params.push(`data_fim=${encodeURIComponent(data_fim)}`);

    return await request(`${API_BASE_URL}/historico-atribuicoes?${params.join('&')}`);
  },

  /**
   * Busca regras órfãs (sem histórico)
   */
  async getOrfas() {
    return await request(`${API_BASE_URL}/historico-atribuicoes/orfas`);
  },

  /**
   * Sincroniza regras órfãs criando históricos
   */
  async sincronizarOrfas() {
    return await request(`${API_BASE_URL}/historico-atribuicoes/sincronizar-orfaos`, {
      method: 'POST'
    });
  },

  /**
   * Deleta um conjunto de regras órfãs por agrupador_id
   * @param {string} agrupadorId
   */
  async deleteOrfa(agrupadorId) {
    return await request(`${API_BASE_URL}/historico-atribuicoes/orfas/${agrupadorId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Deleta um histórico de atribuição
   * @param {string} id
   */
  async delete(id) {
    return await request(`${API_BASE_URL}/historico-atribuicoes/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * Busca detalhes diários de um histórico
   * @param {string} id
   */
  async getDetalhesDiarios(id) {
    return await request(`${API_BASE_URL}/historico-atribuicoes/${id}/detalhes-diarios`);
  },

  /**
   * Atualiza uma tarefa diária (tempo estimado)
   * @param {string} id - ID do registro de tempo estimado
   * @param {Object} data - { tempo_estimado_dia }
   */
  async updateDetalheDiario(id, data) {
    return await request(`${API_BASE_URL}/tempo-estimado/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Deleta uma tarefa diária
   * @param {string} id - ID do registro de tempo estimado
   */
  async deleteDetalheDiario(id) {
    return await request(`${API_BASE_URL}/tempo-estimado/${id}`, {
      method: 'DELETE'
    });
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

// ============================================
// SUBTAREFA (cp_subtarefa)
// ============================================

export const subtarefaAPI = {
  /**
   * Lista todas as subtarefas
   * @param {Object} params - { page, limit, search, tarefa_id }
   */
  async getAll({ page = 1, limit = 50, search = '', tarefa_id = null } = {}) {
    let url = `${API_BASE_URL}/subtarefa?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (tarefa_id) url += `&tarefa_id=${encodeURIComponent(tarefa_id)}`;
    return await request(url);
  },

  /**
   * Busca subtarefa por ID
   * @param {number|string} id - ID da subtarefa
   */
  async getById(id) {
    return await request(`${API_BASE_URL}/subtarefa/${id}`);
  },

  /**
   * Cria uma nova subtarefa
   * @param {Object} data - { nome, descricao, tarefa_id }
   */
  async create(data) {
    return await request(`${API_BASE_URL}/subtarefa`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Atualiza uma subtarefa
   * @param {number|string} id - ID da subtarefa
   * @param {Object} data - { nome, descricao, tarefa_id }
   */
  async update(id, data) {
    return await request(`${API_BASE_URL}/subtarefa/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Deleta uma subtarefa
   * @param {number|string} id - ID da subtarefa
   */
  async delete(id) {
    return await request(`${API_BASE_URL}/subtarefa/${id}`, {
      method: 'DELETE'
    });
  }
};

// ============================================
// USUÁRIOS
// ============================================

export const usuariosAPI = {
  /**
   * Busca todos os usuários
   */
  async getAll() {
    return await request(`${API_BASE_URL}/usuarios?limit=1000`);
  }
};

// ============================================
// DOCUMENTOS (GED)
// ============================================

export const documentosAPI = {
  /**
   * Lista todos os documentos de um cliente
   * @param {string} clienteId - ID do cliente
   */
  async getDocumentosCliente(clienteId) {
    return await request(`${API_BASE_URL}/clientes/${clienteId}/documentos`);
  },

  /**
   * Busca um documento específico por ID
   * @param {string} documentoId - ID do documento
   */
  async getDocumentoPorId(documentoId) {
    return await request(`${API_BASE_URL}/documentos/${documentoId}`);
  },

  /**
   * Faz upload de um documento para um cliente
   * @param {string} clienteId - ID do cliente
   * @param {FormData} formData - FormData com arquivo e metadados
   */
  async uploadDocumento(clienteId, formData) {
    return await request(`${API_BASE_URL}/clientes/${clienteId}/documentos`, {
      method: 'POST',
      headers: {}, // Não definir Content-Type, o browser define automaticamente com boundary para FormData
      body: formData
    });
  },

  /**
   * Atualiza metadados de um documento
   * @param {string} documentoId - ID do documento
   * @param {Object} dados - { nome_exibicao?, descricao? }
   */
  async updateDocumento(documentoId, dados) {
    return await request(`${API_BASE_URL}/documentos/${documentoId}`, {
      method: 'PUT',
      body: JSON.stringify(dados)
    });
  },

  /**
   * Deleta um documento
   * @param {string} documentoId - ID do documento
   */
  async deleteDocumento(documentoId) {
    return await request(`${API_BASE_URL}/documentos/${documentoId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Obtém URL de download de um documento
   * @param {string} documentoId - ID do documento
   */
  async downloadDocumento(documentoId) {
    const response = await fetch(`${API_BASE_URL}/documentos/${documentoId}/download`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Se a resposta é um redirect, seguir o redirect
    if (response.redirected) {
      return response.url;
    }

    // Caso contrário, retornar a URL da resposta
    const data = await response.json();
    return data.url || response.url;
  },

  /**
   * Obtém URL de preview de um documento
   * @param {string} documentoId - ID do documento
   */
  async getDocumentPreview(documentoId) {
    return await request(`${API_BASE_URL}/documentos/${documentoId}/preview`);
  },

  /**
   * Valida documentos obrigatórios de um cliente
   * @param {string} clienteId - ID do cliente
   */
  async validarDocumentosObrigatorios(clienteId) {
    return await request(`${API_BASE_URL}/clientes/${clienteId}/documentos/validacao`);
  }
};

// Exportar api genérica
export const api = {
  get: (endpoint) => request(`${API_BASE_URL}${endpoint}`),
  post: (endpoint, body) => request(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(`${API_BASE_URL}${endpoint}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(`${API_BASE_URL}${endpoint}`, { method: 'DELETE' }),
  request // para casos avançados
};

// Exportar URL base para uso externo se necessário
export { getApiBaseUrl };

