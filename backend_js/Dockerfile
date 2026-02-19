# =============================================================
# === DOCKERFILE - BUN BACKEND (GESTÃO CAPACIDADE) ===
# =============================================================

FROM oven/bun:latest

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json bun.lock* ./

# Instalar dependências
RUN bun install

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["bun", "run", "src/server.ts"]
