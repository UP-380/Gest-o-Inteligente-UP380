#!/bin/bash

# Script de Validação Pré-Deploy
# UP Gestão Inteligente
# Execute este script ANTES de fazer o deploy para garantir que tudo está pronto

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Validando sistema antes do deploy..."

ERRORS=0

# 1. Verificar arquivo .env.production
echo -e "\n${YELLOW}1. Verificando .env.production...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Arquivo .env.production não encontrado!${NC}"
    echo -e "${YELLOW}   Criando arquivo .env.production...${NC}"
    cat > .env.production << EOF
NODE_ENV=production
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SESSION_SECRET=
EOF
    echo -e "${RED}❌ Configure as variáveis obrigatórias no arquivo .env.production${NC}"
    ERRORS=$((ERRORS + 1))
else
    source .env.production 2>/dev/null || true
    
    # Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
    SUPABASE_SERVICE_KEY_VALUE="${SUPABASE_SERVICE_KEY:-${SUPABASE_SERVICE_ROLE_KEY}}"
    
    if [ -z "$SUPABASE_URL" ]; then
        echo -e "${RED}❌ SUPABASE_URL não está definida${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ SUPABASE_URL definida${NC}"
    fi
    
    if [ -z "$SUPABASE_SERVICE_KEY_VALUE" ]; then
        echo -e "${RED}❌ SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não está definida${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ SUPABASE_SERVICE_KEY definida${NC}"
    fi
    
    if [ -z "$SESSION_SECRET" ]; then
        echo -e "${YELLOW}⚠️  SESSION_SECRET não definida (será gerada automaticamente)${NC}"
        # Gerar automaticamente
        if command -v openssl &> /dev/null; then
            TEMP_SECRET=$(openssl rand -hex 32)
        else
            TEMP_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n' | head -c 64)
        fi
        echo "SESSION_SECRET=$TEMP_SECRET" >> .env.production
        echo -e "${GREEN}✅ SESSION_SECRET gerada automaticamente${NC}"
    else
        echo -e "${GREEN}✅ SESSION_SECRET definida${NC}"
    fi
fi

# 2. Verificar build do frontend
echo -e "\n${YELLOW}2. Verificando build do frontend...${NC}"
if [ ! -d "frontEnd/dist" ]; then
    echo -e "${YELLOW}⚠️  Pasta frontEnd/dist não encontrada${NC}"
    echo -e "${YELLOW}   Execute: cd frontEnd && npm run build${NC}"
    ERRORS=$((ERRORS + 1))
elif [ ! -f "frontEnd/dist/index.html" ]; then
    echo -e "${RED}❌ frontEnd/dist/index.html não encontrado${NC}"
    echo -e "${YELLOW}   Execute: cd frontEnd && npm run build${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Build do frontend encontrado${NC}"
fi

# 3. Verificar Docker
echo -e "\n${YELLOW}3. Verificando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker instalado${NC}"
    
    # Verificar se docker compose funciona
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose (v2) disponível${NC}"
    elif docker-compose version &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose (v1) disponível${NC}"
    else
        echo -e "${RED}❌ Docker Compose não está disponível${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# 4. Verificar rede easypanel (se necessário)
echo -e "\n${YELLOW}4. Verificando rede Docker...${NC}"
if docker network inspect easypanel &> /dev/null; then
    echo -e "${GREEN}✅ Rede easypanel existe${NC}"
else
    echo -e "${YELLOW}⚠️  Rede easypanel não encontrada (pode ser criada automaticamente)${NC}"
fi

# Resumo
echo -e "\n${YELLOW}═══════════════════════════════════════${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Sistema pronto para deploy!${NC}"
    echo -e "\n${GREEN}Você pode executar seu gabarito de deploy:${NC}"
    echo "  cd /var/www/up380-GestaoInteligente"
    echo "  git pull origin main"
    echo "  docker compose -f docker-compose.prod.yml down --volumes --remove-orphans"
    echo "  docker compose -f docker-compose.prod.yml build --no-cache"
    echo "  docker compose -f docker-compose.prod.yml up -d"
    exit 0
else
    echo -e "${RED}❌ Encontrados $ERRORS erro(s). Corrija antes de fazer deploy.${NC}"
    exit 1
fi






