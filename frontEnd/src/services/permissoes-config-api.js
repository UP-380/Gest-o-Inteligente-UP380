/**
 * API para configurações de permissões
 */

const API_BASE_URL = '/api';

export const permissoesConfigAPI = {
  /**
   * Busca configurações de permissões
   * @param {string|null} nivel - Nível específico (opcional)
   */
  async getConfig(nivel = null) {
    try {
      let url = `${API_BASE_URL}/permissoes-config`;
      if (nivel) {
        url += `?nivel=${encodeURIComponent(nivel)}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        return { success: false, error: 'Não autenticado' };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Erro ao buscar configurações' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message || 'Erro de conexão' };
    }
  },

  /**
   * Atualiza configurações de permissões de um nível
   * @param {string} nivel - Nível (gestor ou colaborador)
   * @param {array|null} paginas - Array de páginas permitidas ou null para todas
   */
  async updateConfig(nivel, paginas) {
    try {
      const response = await fetch(`${API_BASE_URL}/permissoes-config/${nivel}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ paginas }),
      });

      if (response.status === 401) {
        return { success: false, error: 'Não autenticado' };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Erro ao atualizar configurações' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message || 'Erro de conexão' };
    }
  }
};




