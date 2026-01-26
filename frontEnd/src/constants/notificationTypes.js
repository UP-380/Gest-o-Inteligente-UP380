export const NOTIFICATION_TYPES = {
    PLUG_RAPIDO: 'PLUG_RAPIDO',
    APROVACAO_PENDENTE: 'APROVACAO_PENDENTE',
};

export const NOTIFICATION_DESCRIPTIONS = {
    [NOTIFICATION_TYPES.PLUG_RAPIDO]: {
        label: 'Plug Rápido',
        description: 'Notificações de solicitações de plug rápido e atividades em andamento'
    },
    [NOTIFICATION_TYPES.APROVACAO_PENDENTE]: {
        label: 'Aprovações Pendentes',
        description: 'Notificações de atribuições que aguardam aprovação'
    }
};
