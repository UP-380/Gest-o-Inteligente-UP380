import { api } from './api';

export const equipamentosAPI = {
    // Listar com paginação e busca
    getEquipamentos: (page = 1, limit = 5, search = '') =>
        api.get(`/equipamentos?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

    // Buscar por ID
    getEquipamentoPorId: (id) => api.get(`/equipamentos/${id}`),

    // Criar
    criarEquipamento: (dados) => api.post('/equipamentos', dados),

    // Atualizar
    atualizarEquipamento: (id, dados) => api.put(`/equipamentos/${id}`, dados),

    // Deletar
    deletarEquipamento: (id) => api.delete(`/equipamentos/${id}`)
};
