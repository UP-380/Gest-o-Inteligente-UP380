import { z } from '@hono/zod-openapi';

export const activeSessionSchema = z.object({
    id: z.string(),
    usuario_id: z.number(),
    data_inicio: z.string(),
    membro_id: z.number(),
    membro_nome: z.string(),
    foto_perfil: z.string().nullable().optional(),
    cliente_id: z.string().optional(),
    cliente_nome: z.string().nullable().optional(),
    produto_id: z.string().optional(),
    produto_nome: z.string().nullable().optional(),
    tarefa_id: z.string().optional(),
    tarefa_nome: z.string().nullable().optional(),
    tempo_estimado_id: z.string().nullable().optional(),
    tempo_estimado_formatado: z.string().nullable().optional(),
    data_estimada_formatada: z.string().nullable().optional(),
    pendentes_count: z.number().nullable().optional(),
    tempo_decorrido_ms: z.number(),
});

export const activeSessionsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(activeSessionSchema),
    count: z.number(),
});
