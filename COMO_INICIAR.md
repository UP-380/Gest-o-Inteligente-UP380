# 🚀 Como Iniciar a Aplicação - UP Gestão Inteligente

Este guia mostra como iniciar a aplicação em diferentes modos.

## 📋 Pré-requisitos

- **Node.js** (versão 14 ou superior)
- **npm** ou **yarn**
- **Docker** e **Docker Compose** (para modo produção)

---

## 🔧 Modo 1: Desenvolvimento (Sem Docker)

### Passo 1: Instalar dependências do Backend

```bash
cd backEnd
npm install
```

### Passo 2: Configurar variáveis de ambiente

Crie um arquivo `.env` na pasta `backEnd` com as configurações necessárias (Supabase, etc.)

### Passo 3: Iniciar o Backend

```bash
cd backEnd
npm start
```

O backend estará rodando em: **http://localhost:4000**

### Passo 4: Instalar dependências do Frontend

Em um novo terminal:

```bash
cd frontEnd
npm install
```

### Passo 5: Iniciar o Frontend (modo desenvolvimento)

```bash
cd frontEnd
npm run dev
```

O frontend estará rodando em: **http://localhost:5173** (porta padrão do Vite)

---

## 🐳 Modo 2: Produção com Docker (Recomendado)

### Passo 1: Verificar se o Docker está rodando

Execute o script de verificação:

```bash
verificar-docker.bat
```

Ou manualmente:

```bash
docker --version
docker ps
```

### Passo 2: Fazer build do Frontend

Antes de iniciar com Docker, é necessário fazer o build do frontend:

```bash
atualizar-frontend.bat
```

Ou manualmente:

```bash
cd frontEnd
npm install
npm run build
cd ..
```

### Passo 3: Configurar variáveis de ambiente

Crie um arquivo `.env.production` na raiz do projeto com as configurações necessárias.

### Passo 4: Iniciar com Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Passo 5: Verificar se os containers estão rodando

```bash
docker ps
```

Você deve ver dois containers:
- `upgi-prod` (backend na porta 4000)
- `upgi-nginx` (nginx na porta 3000)

### Acessar a aplicação

A aplicação estará disponível em: **http://localhost:3000**

---

## 📝 Comandos Úteis

### Parar os containers Docker

```bash
docker-compose -f docker-compose.prod.yml down
```

### Ver logs dos containers

```bash
# Logs do backend
docker logs upgi-prod

# Logs do nginx
docker logs upgi-nginx

# Logs de ambos
docker-compose -f docker-compose.prod.yml logs -f
```

### Reiniciar os containers

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Reconstruir os containers (após mudanças no código)

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Atualizar apenas o frontend (após fazer build)

```bash
atualizar-frontend.bat
```

Ou reiniciar apenas o nginx:

```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## 🔍 Verificar se está funcionando

### Backend

- Health check: http://localhost:4000/health
- Deve retornar: `{"status":"ok","timestamp":"..."}`

### Frontend (via Nginx)

- Aplicação: http://localhost:3000
- Health check do backend: http://localhost:3000/health

---

## ⚠️ Troubleshooting

### Porta 3000 ou 4000 já está em uso

1. Verifique qual processo está usando a porta:
   ```bash
   netstat -ano | findstr ":3000"
   netstat -ano | findstr ":4000"
   ```

2. Pare o processo ou altere as portas no `docker-compose.prod.yml`

### Erro ao conectar ao backend

- Verifique se o backend está rodando
- Verifique se o arquivo `.env.production` está configurado corretamente
- Verifique os logs: `docker logs upgi-prod`

### Frontend não carrega

- Verifique se o build foi feito: `frontEnd/dist/index.html` deve existir
- Verifique os logs do nginx: `docker logs upgi-nginx`
- Reinicie o nginx: `docker-compose -f docker-compose.prod.yml restart nginx`

---

## 📚 Estrutura de Portas

- **3000**: Nginx (proxy reverso) - Acesso principal da aplicação
- **4000**: Backend Node.js - API e serviços
- **5173**: Frontend Vite (apenas em modo desenvolvimento)

---

## 🎯 Resumo Rápido

**Desenvolvimento:**
```bash
# Terminal 1 - Backend
cd backEnd && npm install && npm start

# Terminal 2 - Frontend
cd frontEnd && npm install && npm run dev
```

**Produção (Docker):**
```bash
# 1. Build do frontend
cd frontEnd && npm install && npm run build && cd ..

# 2. Iniciar Docker
docker-compose -f docker-compose.prod.yml up -d

# 3. Acessar
# http://localhost:3000
```

