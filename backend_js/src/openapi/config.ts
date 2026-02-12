/**
 * Configuração base do OpenAPI para a API UPMAP
 */
export const openAPIConfig = {
  openapi: '3.0.0',
  info: {
    title: 'API UPMAP',
    version: '1.0.0',
    description: `# API UPMAP - Gestão Inteligente

Sistema de gestão de colaboradores, tarefas e horas trabalhadas.

## Recursos Principais

- **Análise de Capacidade**: Análise hierárquica de horas estimadas vs realizadas
- **Gestão de Recursos**: Controle de colaboradores e suas capacidades
- **Relatórios Detalhados**: Agregações por múltiplos níveis hierárquicos

## 🔐 Autenticação

Esta API usa **JWT (JSON Web Tokens)** para autenticação.

### Como usar:

1. **Gere um token** via endpoint \`POST /auth/token\`
2. **Use o token** no header \`Authorization: Bearer <token>\`
3. **Token expira** conforme configurado (padrão: 30 dias)

### Exemplo:

\`\`\`bash
# 1. Gerar token
curl -X POST http://localhost:3000/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"identifier": "minha-aplicacao"}'

# 2. Usar token nas requisições
curl -X POST http://localhost:3000/gestao-capacidade \\
  -H "Authorization: Bearer <seu-token-aqui>" \\
  -H "Content-Type: application/json" \\
  -d '{...}'
\`\`\`

### Segurança:

- ✅ Tokens são assinados com algoritmo HS256
- ✅ Tokens têm data de expiração
- ✅ Use HTTPS em produção
- ✅ Guarde tokens de forma segura`,
    contact: {
      name: 'Suporte UPMAP',
    },
  },
  tags: [
    {
      name: 'Autenticação',
      description: 'Geração e gerenciamento de tokens JWT',
    },
    {
      name: 'Gestão de Capacidade',
      description: 'Análise de capacidade e gestão de recursos',
    },
    {
      name: 'Health',
      description: 'Verificação de saúde do servidor',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT gerado via endpoint /auth/token. Use: Authorization: Bearer <token>',
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  servers: [
    {
      url: 'http://localhost:3000',
      description: '🟢 Servidor de Desenvolvimento',
    },
    {
      url: 'https://upmap.up380.com.br',
      description: '🔵 Servidor de Produção',
    },
    {
      url: 'https://staging.api.upmap.com.br',
      description: '🟡 Servidor de Staging',
    },
  ],
};
