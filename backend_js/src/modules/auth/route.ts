/**
 * Definição da rota OpenAPI para obter o token único da API
 */
import { createRoute } from '@hono/zod-openapi';
import {
  generateTokenResponseSchema,
  authErrorSchema,
} from './schemas.js';

export const generateTokenRoute = createRoute({
  method: 'get',
  path: '/auth/token',
  summary: 'Obter Token Único da API',
  description: `Retorna o token único configurado no backend.

### 🔐 Como Funciona

Este endpoint retorna o **token único** da API que pode ser usado em todas as requisições protegidas.

### 📝 Configuração

O token pode ser configurado de duas formas:

1. **Via variável de ambiente** \`API_TOKEN\` no arquivo \`.env\`
2. **Gerado automaticamente** na primeira execução (válido por 10 anos)

### 🛠️ Gerar Token

Para gerar um novo token único, execute:

\`\`\`bash
bun run token:generate
\`\`\`

Isso gerará um token que você pode adicionar ao \`.env\`:

\`\`\`
API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

### 📋 Uso

Após obter o token, use-o no header \`Authorization\`:

\`\`\`
Authorization: Bearer <token-aqui>
\`\`\`

### ⚠️ Segurança

- Este é um token único compartilhado
- Guarde-o de forma segura
- Use HTTPS em produção
- Não compartilhe o token publicamente`,
  tags: ['Autenticação'],
  responses: {
    200: {
      description: 'Token único retornado com sucesso',
      content: {
        'application/json': {
          schema: generateTokenResponseSchema,
          example: {
            success: true,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cG1hcC1hcGkiLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzA3NjgwMDAwLCJleHAiOjE3MTAzNTgwMDB9.exemplo',
            message: 'Token único da API. Use este token em todas as requisições protegidas.',
            usage: 'Authorization: Bearer <token>',
          },
        },
      },
    },
    500: {
      description: 'Erro interno do servidor',
      content: {
        'application/json': {
          schema: authErrorSchema,
          example: {
            success: false,
            error: 'Erro ao obter token',
          },
        },
      },
    },
  },
});
