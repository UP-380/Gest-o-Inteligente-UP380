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
    deletarEquipamento: (id) => api.delete(`/equipamentos/${id}`),

    // --- Gestão de Equipamentos ---

    // Dashboard Stats
    getDashboardStats: () => api.get('/equipamentos/dashboard/stats'),

    // Atribuir (Empréstimo)
    atribuirEquipamento: (dados) => api.post('/equipamentos/atribuir', dados),

    // Devolver (Check-in)
    devolverEquipamento: (dados) => api.post('/equipamentos/devolver', dados),

    // Registrar Ocorrência
    registrarOcorrencia: (dados) => api.post('/equipamentos/ocorrencia', dados),

    // Histórico (Atribuições e Ocorrências)
    getHistorico: (id) => api.get(`/equipamentos/${id}/historico`),

    // --- Operadores ---

    // Listar operadores com contagem
    getOperadores: () => api.get('/colaboradores/equipamentos'),

    // Perfil do operador
    getPerfilOperador: (id) => api.get(`/colaboradores/${id}/equipamentos`)
};
