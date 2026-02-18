/**
 * Definição da rota OpenAPI para o endpoint de Health Check
 */
import { createRoute, z } from '@hono/zod-openapi';

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Health Check',
  description: 'Verifica o status do servidor e retorna timestamp atual',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Servidor está funcionando',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
});
