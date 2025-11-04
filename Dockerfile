# Multi-stage build para otimização
FROM node:18-alpine AS builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Estágio de produção
FROM node:18-alpine AS production

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S upgi -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar dependências do estágio builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar código da aplicação
COPY --chown=upgi:nodejs . .

# Remover arquivos desnecessários para produção
RUN rm -rf .git .trae app __pycache__ *.py requirements.txt

# Criar diretório para logs
RUN mkdir -p /app/logs && chown upgi:nodejs /app/logs

# Expor porta
EXPOSE 4000

# Mudar para usuário não-root
USER upgi

# Definir variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando para iniciar a aplicação
CMD ["node", "server.js"]