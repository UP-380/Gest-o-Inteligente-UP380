#!/bin/bash

# Script de Deploy para Produção
# UP Gestão Inteligente

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy para produção..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Build do FrontEnd
echo -e "${YELLOW}📦 Passo 1: Build do FrontEnd...${NC}"
cd frontEnd
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências do frontEnd..."
    npm install
fi
echo "Executando build..."
npm run build
cd ..

# Verificar se o build foi criado
if [ ! -d "frontEnd/dist" ]; then
    echo -e "${RED}❌ Erro: Build do frontEnd não foi criado!${NC}"
    exit 1
fi

if [ ! -f "frontEnd/dist/index.html" ]; then
    echo -e "${RED}❌ Erro: index.html não encontrado no build!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build do frontEnd concluído!${NC}"

# 2. Verificar certificados SSL
echo -e "${YELLOW}🔒 Passo 2: Verificando certificados SSL...${NC}"
if [ ! -d "ssl" ]; then
    echo -e "${YELLOW}⚠️  Pasta ssl/ não encontrada. Criando estrutura...${NC}"
    mkdir -p ssl
    echo -e "${YELLOW}⚠️  ATENÇÃO: Você precisa adicionar os certificados SSL em ssl/cert.pem e ssl/key.pem${NC}"
fi

if [ ! -f "ssl/cert.pem" ] || [ ! -f "ssl/key.pem" ]; then
    echo -e "${YELLOW}⚠️  Certificados SSL não encontrados.${NC}"
    echo -e "${YELLOW}   Para desenvolvimento, você pode usar certificados auto-assinados.${NC}"
    echo -e "${YELLOW}   Para produção, use certificados válidos (Let's Encrypt, etc).${NC}"
    read -p "Continuar mesmo sem certificados? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# 3. Verificar variáveis de ambiente
echo -e "${YELLOW}⚙️  Passo 3: Verificando variáveis de ambiente...${NC}"
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
    echo -e "${RED}❌ ERRO: Configure as variáveis obrigatórias no arquivo .env.production:${NC}"
    echo -e "${RED}   - SUPABASE_URL${NC}"
    echo -e "${RED}   - SUPABASE_SERVICE_KEY${NC}"
    echo -e "${RED}   - SESSION_SECRET (gere uma chave forte aleatória)${NC}"
    exit 1
fi

# Verificar se as variáveis obrigatórias estão definidas
source .env.production 2>/dev/null || true

# Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SERVICE_KEY_VALUE="${SUPABASE_SERVICE_KEY:-${SUPABASE_SERVICE_ROLE_KEY}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY_VALUE" ]; then
    echo -e "${RED}❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) devem estar definidas no .env.production!${NC}"
    exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
    echo -e "${YELLOW}⚠️  AVISO: SESSION_SECRET não definida. Gerando uma chave temporária...${NC}"
    TEMP_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')
    echo "SESSION_SECRET=$TEMP_SECRET" >> .env.production
    echo -e "${YELLOW}   Uma chave temporária foi adicionada. Recomenda-se gerar uma chave forte manualmente.${NC}"
fi

echo -e "${GREEN}✅ Variáveis de ambiente verificadas!${NC}"

# 4. Build e subir containers
echo -e "${YELLOW}🐳 Passo 4: Build e subida dos containers Docker...${NC}"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 5. Aguardar serviços iniciarem
echo -e "${YELLOW}⏳ Passo 5: Aguardando serviços iniciarem...${NC}"
sleep 10

# 6. Verificar saúde dos serviços
echo -e "${YELLOW}🏥 Passo 6: Verificando saúde dos serviços...${NC}"

# Verificar backEnd
if docker exec upgi-prod node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" 2>/dev/null; then
    echo -e "${GREEN}✅ BackEnd está saudável${NC}"
else
    echo -e "${RED}❌ BackEnd não está respondendo corretamente${NC}"
    echo "Logs do backEnd:"
    docker logs upgi-prod --tail 50
    exit 1
fi

# Verificar nginx
if docker exec upgi-nginx nginx -t 2>/dev/null; then
    echo -e "${GREEN}✅ Nginx está configurado corretamente${NC}"
else
    echo -e "${RED}❌ Nginx tem erros de configuração${NC}"
    docker logs upgi-nginx --tail 50
    exit 1
fi

echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo "📊 Status dos containers:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "📝 Para ver os logs:"
echo "   docker logs upgi-prod    # BackEnd"
echo "   docker logs upgi-nginx   # Nginx"
echo ""
echo "🌐 A aplicação deve estar disponível em:"
echo "   HTTP:  http://seu-dominio.com (redireciona para HTTPS)"
echo "   HTTPS: https://seu-dominio.com"

