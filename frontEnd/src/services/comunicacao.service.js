import { api } from './api';

export const comunicacaoAPI = {
    // Chat
    listarConversasRecentes: () => api.get('/comunicacao/conversas-recentes'),
    listarMensagensChat: (userId) => api.get(`/comunicacao/chat?com_usuario=${userId}`),

    // Generic Send (type: 'CHAT', 'COMUNICADO', 'CHAMADO')
    enviarMensagem: (data) => api.post('/comunicacao/mensagem', data),

    // Comunicados
    listarComunicados: () => api.get('/comunicacao/comunicados'),
    buscarComunicadoDestaque: () => api.get('/comunicacao/comunicados/destaque'),

    // Chamados
    listarChamados: () => api.get('/comunicacao/chamados'),
    listarRespostasChamado: (parentId) => api.get(`/comunicacao/chamados/${parentId}/respostas`),
    atualizarStatusChamado: (id, status) => api.put(`/comunicacao/chamados/${id}/status`, { status }),

    // Mark as read
    marcarMensagemLida: (mensagemId) => api.post(`/comunicacao/mensagem/${mensagemId}/ler`),

    // New methods
    uploadMedia: (formData) => api.post('/upload/chamado', formData),
    atualizarMensagem: (id, payload) => api.put(`/comunicacao/mensagem/${id}`, payload),
};
