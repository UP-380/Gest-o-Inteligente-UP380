# =============================================================
# === DOCKERFILE - UP GESTÃO INTELIGENTE ===
# =============================================================

# Estágio 1: Build e dependências
FROM node:20-alpine AS base

# Instalar dependências do sistema necessárias
RUN apk add --no-cache dumb-init

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY backEnd/package*.json ./

# Instalar dependências de produção
RUN npm install --omit=dev && npm cache clean --force

# =============================================================
# Estágio 2: Desenvolvimento (opcional)
# =============================================================
FROM base AS development

# Instalar todas as dependências (incluindo dev)
RUN npm ci && npm cache clean --force

# Copiar código fonte
COPY backEnd/ ./

# Expor porta
EXPOSE 4000

# Comando para desenvolvimento
CMD ["npm", "run", "dev"]

# =============================================================
# Estágio 3: Produção
# =============================================================
FROM base AS production

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar código fonte do backend
COPY backEnd/ ./

# Criar diretório de logs e dar permissão
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 4000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Usar dumb-init para gerenciar processos corretamente
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "src/index.js"]
