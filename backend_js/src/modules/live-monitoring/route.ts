import { createRoute } from '@hono/zod-openapi';
import { activeSessionsResponseSchema } from './schemas.js';

export const liveMonitoringRoute = createRoute({
    method: 'get',
    path: '/live/active-sessions',
    summary: 'Busca sessões de tempo ativas (Monitoramento Live)',
    security: [{ BearerAuth: [] }],
    tags: ['Monitoramento Live'],
    responses: {
        200: {
            description: 'Lista de sessões ativas retornada com sucesso',
            content: {
                'application/json': {
                    schema: activeSessionsResponseSchema,
                },
            },
        },
        401: {
            description: 'Não autorizado',
        },
        500: {
            description: 'Erro interno do servidor',
        },
    },
});
