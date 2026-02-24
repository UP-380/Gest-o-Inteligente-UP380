/**
 * Tipos TypeScript para o módulo de Monitoramento Live
 */

/** Sessão ativa de rastreamento de tempo */
export interface ActiveSession {
    id: string;
    usuario_id: number;
    data_inicio: string;
    membro_id: number;
    membro_nome: string;
    foto_perfil?: string | null;
    cliente_id?: string;
    cliente_nome?: string | null;
    produto_id?: string;
    produto_nome?: string | null;
    tarefa_id?: string;
    tarefa_nome?: string | null;
    tempo_estimado_id?: string | null;
    tempo_estimado_formatado?: string | null;
    data_estimada_formatada?: string | null;
    pendentes_count?: number | null;
    tempo_decorrido_ms: number;
}

/** Resposta do endpoint de sessões ativas */
export interface ActiveSessionsResponse {
    success: boolean;
    data: ActiveSession[];
    count: number;
}
