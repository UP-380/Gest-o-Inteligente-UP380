import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { authMiddleware, requireAuth } from './middleware/auth';
import { erroHandler } from './middleware/erro';
import { gestaoCapacidadeRoute, cardsHandler } from './modules/gestao-capacidade/index.js';
import { healthRoute, healthHandler } from './modules/health/index.js';
import { generateTokenRoute, generateTokenHandler } from './modules/auth/index.js';
import { openAPIConfig } from './openapi/config.js';
import { getSwaggerUIHTML } from './openapi/swagger-html.js';

const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const issues = result.error.flatten();
      return c.json(
        {
          success: false,
          error: 'Validação falhou',
          details: issues.fieldErrors,
          formErrors: issues.formErrors,
        },
        400 as const
      );
    }
  },
});

app.onError(erroHandler);

// Middleware de autenticação (extrai token se existir, mas não bloqueia)
app.use('*', authMiddleware);

// Rotas públicas (não requerem autenticação)
app.openapi(healthRoute, healthHandler);
app.openapi(generateTokenRoute, generateTokenHandler);

// Rota GET /gestao-capacidade retorna 405 (método não permitido)
app.get('/gestao-capacidade', (c) =>
  c.json({ error: 'Use POST com body JSON (data_inicio, data_fim, ...)' }, 405 as const)
);

// Rotas protegidas (requerem autenticação JWT)
app.openapi(gestaoCapacidadeRoute, async (c) => {
  // Verificar autenticação
  const userId = c.get('userId');
  if (!userId) {
    return c.json(
      {
        success: false,
        error: 'Não autorizado',
        message: 'Token JWT inválido ou ausente. Use: Authorization: Bearer <token>',
      },
      401 as const
    );
  }
  return cardsHandler(c);
});

// Documentação OpenAPI em JSON
app.doc('/doc', openAPIConfig);

// Servir assets estáticos (logo, etc.)
app.get('/assets/*', async (c) => {
  const path = c.req.path.replace('/assets/', '');
  try {
    // Tentar múltiplos caminhos possíveis
    const paths = [
      `public/assets/${path}`,
      `src/public/assets/${path}`,
      `assets/${path}`,
    ];
    
    for (const filePath of paths) {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        // Detectar tipo MIME baseado na extensão
        const ext = path.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'svg': 'image/svg+xml',
          'gif': 'image/gif',
          'webp': 'image/webp',
        };
        const contentType = mimeTypes[ext || ''] || 'application/octet-stream';
        
        return new Response(file, {
          headers: {
            'Content-Type': contentType,
          },
        });
      }
    }
    
    return c.json({ error: 'Arquivo não encontrado' }, 404);
  } catch (error) {
    console.error('Erro ao servir asset:', error);
    return c.json({ error: 'Erro ao carregar arquivo' }, 500);
  }
});

// Interface Swagger UI com configurações customizadas e CSS personalizado
app.get('/docs', (c) => {
  return c.html(getSwaggerUIHTML('/doc', '/assets/logo.png'));
});

export default app;
