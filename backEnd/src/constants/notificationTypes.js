// Enum de Tipos de Notificação do Sistema
const NOTIFICATION_TYPES = {
    PLUG_RAPIDO: 'PLUG_RAPIDO',
    PLUG_RAPIDO_APROVADO: 'PLUG_RAPIDO_APROVADO',
    APROVACAO_PENDENTE: 'APROVACAO_PENDENTE',
    CHAT_MENSAGEM: 'CHAT_MENSAGEM',
    COMUNICADO_NOVO: 'COMUNICADO_NOVO',
    CHAMADO_NOVO: 'CHAMADO_NOVO',
    CHAMADO_ATUALIZADO: 'CHAMADO_ATUALIZADO',
};

// Descrições amigáveis para exibir na interface de configuração
const NOTIFICATION_DESCRIPTIONS = {
    [NOTIFICATION_TYPES.PLUG_RAPIDO]: {
        label: 'Plug Rápido',
        description: 'Notificações de solicitações de plug rápido e atividades em andamento'
    },
    [NOTIFICATION_TYPES.APROVACAO_PENDENTE]: {
        label: 'Aprovações Pendentes',
        description: 'Notificações de atribuições que aguardam aprovação'
    },
    [NOTIFICATION_TYPES.CHAT_MENSAGEM]: {
        label: 'Mensagens de Chat',
        description: 'Notificações de novas mensagens recebidas no chat'
    },
    [NOTIFICATION_TYPES.COMUNICADO_NOVO]: {
        label: 'Novos Comunicados',
        description: 'Notificações de novos avisos e comunicados gerais'
    },
    [NOTIFICATION_TYPES.CHAMADO_NOVO]: {
        label: 'Novos Chamados',
        description: 'Notificações de novos tickets de suporte (Chamados)'
    },
    [NOTIFICATION_TYPES.CHAMADO_ATUALIZADO]: {
        label: 'Atualizações de Chamados',
        description: 'Notificações de movimentações e respostas em chamados'
    }
};

module.exports = {
    NOTIFICATION_TYPES,
    NOTIFICATION_DESCRIPTIONS
};
