# Análise de Migração: node.js → backEnd

## 📋 Resumo Executivo

Este documento identifica quais partes do arquivo `node.js` (versão antiga) ainda são necessárias para o sistema funcionar corretamente após a reestruturação em `backEnd` e `frontEnd`.

---

## ✅ O que JÁ está migrado no backEnd

### 1. **Sistema de Cache** ✅
- **Localização**: `backEnd/src/config/cache.js`
- **Status**: ✅ Implementado
- **Funções**: `getCachedData`, `setCachedData`, `clearCache`

### 2. **Configuração do Banco de Dados (Supabase)** ✅
- **Localização**: `backEnd/src/config/database.js`
- **Status**: ✅ Implementado
- **Nota**: Configuração idêntica ao `node.js`

### ⚠️ **PROBLEMA IDENTIFICADO**: Importação incorreta em `dashboard-clientes.js`
- **Arquivo**: `backEnd/src/servers/dashboard-clientes.js` (linha 13)
- **Problema**: Tenta importar de `../../../api-clientes.js` (raiz do projeto)
- **Realidade**: O arquivo está em `backEnd/src/services/api-clientes.js`
- **Ação necessária**: Corrigir o caminho de importação

### 3. **Middleware de Autenticação** ✅
- **Localização**: `backEnd/src/middleware/auth.js`
- **Status**: ✅ Implementado
- **Funções**: `requireAuth`, `protectHTMLPages`

### 4. **Controller de Autenticação** ✅
- **Localização**: `backEnd/src/controllers/auth.controller.js`
- **Status**: ✅ Implementado
- **Endpoints**: `/api/login`, `/api/logout`, `/api/auth/check`

### 5. **API de Clientes Básica** ✅
- **Localização**: `backEnd/src/services/api-clientes.js`
- **Status**: ✅ Implementado
- **Endpoints básicos**:
  - `/api/clientes` (GET)
  - `/api/status` (GET)
  - `/api/contratos` (GET)
  - `/api/membros-id-nome` (GET)
  - `/api/cp_clientes-id-nome` (GET)
  - `/api/tarefas/:clienteId` (GET)
  - `/api/registro-tempo` (GET)
  - `/api/v_custo_hora_membro` (GET)
  - `/api/faturamento` (GET)

### 6. **Servidor Dashboard Clientes** ✅
- **Localização**: `backEnd/src/servers/dashboard-clientes.js`
- **Status**: ✅ Implementado (porta 4001)
- **Endpoints específicos**:
  - `/api/registro-tempo-periodo` (GET)
  - `/api/membros-por-cliente` (GET)
  - `/api/clientes-por-colaborador` (GET)

---

## ❌ O que FALTA migrar (endpoints usados pelo frontEnd)

### 1. **Endpoint: `/api/clientes-kamino`** ❌
- **Uso**: `CarteiraClientes.jsx` (linha 337)
- **Localização no node.js**: linha 267-306
- **Descrição**: Busca clientes da tabela `cliente_kamino`
- **Ação necessária**: Criar controller/service para este endpoint

### 2. **Endpoint: `/api/clientes-incompletos-count`** ❌
- **Uso**: `CarteiraClientes.jsx` (linha 366)
- **Localização no node.js**: linha 1491-1524
- **Descrição**: Conta clientes com campos incompletos (null ou vazios)
- **Ação necessária**: Criar controller/service para este endpoint

### 3. **Endpoint: `/api/carteira-clientes`** ❌
- **Uso**: `CarteiraClientes.jsx` (linha 400)
- **Localização no node.js**: linha 1819-1883
- **Descrição**: Lista paginada de clientes com filtros (search, status, incompletos)
- **Ação necessária**: Criar controller/service para este endpoint
- **Importante**: Endpoint crítico para a página CarteiraClientes

### 4. **Endpoint: `/api/tarefas-incompletas`** ❌
- **Uso**: `DashboardClientes.jsx` (linha 841)
- **Localização no node.js**: linha 7808-8096
- **Descrição**: Busca tarefas com campos null (dt_inicio, dt_vencimento, cliente_id)
- **Ação necessária**: Criar controller/service para este endpoint
- **Nota**: Lógica complexa com múltiplas queries e mapeamento de clientes

### 5. **Endpoint: `/api/clientes/:id/inativar`** ❌
- **Uso**: `CarteiraClientes.jsx` (linha 618)
- **Localização no node.js**: linha 1527-1612
- **Descrição**: Inativa um cliente (PUT)
- **Ação necessária**: Criar controller/service para este endpoint

### 6. **Endpoint: `/api/clientes/:id/ativar`** ❌
- **Uso**: `CarteiraClientes.jsx` (linha 664)
- **Localização no node.js**: linha 1613-1698
- **Descrição**: Ativa um cliente (PUT)
- **Ação necessária**: Criar controller/service para este endpoint

### 7. **Endpoint: `/api/membros-por-cliente`** ⚠️
- **Uso**: `DashboardClientes.jsx` (linha 258)
- **Status**: ✅ Já existe em `dashboard-clientes.js` (porta 4001)
- **Problema**: FrontEnd chama na porta 4000, mas endpoint está na porta 4001
- **Ação necessária**: Mover endpoint para o servidor principal (porta 4000) ou ajustar frontEnd

### 8. **Endpoint: `/api/clientes-por-colaborador`** ⚠️
- **Status**: ✅ Já existe em `dashboard-clientes.js` (porta 4001)
- **Problema**: Pode estar sendo chamado na porta 4000
- **Ação necessária**: Verificar uso e garantir que está acessível

---

## 🔍 Endpoints adicionais no node.js (verificar se são necessários)

### Endpoints relacionados a ClickUp:
- `/api/clientes-clickup` (linha 309)
- `/api/cliente-dados/:nomeClienteClickup` (linha 359)
- `/api/cliente-clickup/:nome` (linha 2242)
- `/api/contratos-cliente/:nomeClienteClickup` (linha 2300)
- `/api/contratos-cliente-id/:idCliente` (linha 2457)
- `/api/contratos/:nomeClienteClickup` (linha 2478)
- `/api/segmentos-cliente/:nomeClienteClickup` (linha 2553)
- `/api/subsegmentos-cliente/:nomeClienteClickup` (linha 2628)
- `/api/periodos-cliente/:nomeClienteClickup` (linha 2703)
- `/api/data-inicio-cliente/:nomeClienteClickup` (linha 2778)
- `/api/data-encerramento-cliente/:nomeClienteClickup` (linha 2880)
- `/api/proxima-renovacao-cliente/:nomeClienteClickup` (linha 2960)
- `/api/razao-social-cliente/:nomeClienteClickup/:idContrato` (linha 3040)
- `/api/nome-fantasia-cliente/:nomeClienteClickup/:idContrato` (linha 3099)
- `/api/dados-cliente-contrato/:nomeClienteClickup` (linha 3158)
- `/api/nome-amigavel-cliente/:nomeClienteClickup/:idContrato` (linha 3222)
- `/api/cpf-cnpj-cliente/:nomeClienteClickup/:idContrato` (linha 3281)
- `/api/update-cliente-cp` (linha 1888) - PUT

### Endpoints relacionados a Tarefas:
- `/api/tarefas-status` (linha 3340)
- `/api/tarefas-count/:clienteId` (linha 3412)
- `/api/tarefas-count-periodo-e/:clienteId` (linha 3661)
- `/api/tarefas-detalhes/:clienteId` (linha 5620)
- `/api/tarefas-por-cliente/:clienteId` (linha 6156)
- `/api/tarefas-por-responsavel/:responsavelId` (linha 6417)
- `/api/tarefas-por-colaborador/:clienteId/:usuarioId` (linha 6845)
- `/api/tarefas-by-ids` (linha 1110, 8386)
- `/api/timetrack-tarefas-por-ids` (linha 1147)
- `/api/timetrack-tarefa-nomes` (linha 1183)
- `/api/timetrack-tarefas-detalhes/:clienteId` (linha 1211)
- `/api/timetrack-tarefas-count/:clienteId` (linha 1054)
- `/api/timetrack-clientes-ids` (linha 981)
- `/api/tarefa-registros-tempo/:tarefaId` (linha 6608)
- `/api/tarefas-count-global` (linha 6641)
- `/api/tarefas-periodo-e-por-cliente/:clienteId` (linha 8279)
- `/api/tarefas-periodo-e` (linha 8360)

### Endpoints relacionados a Clientes:
- `/api/clientes` (linha 435) - Versão otimizada com cache (comentada)
- `/api/clientes/:id` (linha 1291) - PUT para atualizar cliente
- `/api/clientes/:id` (linha 1398) - DELETE para deletar cliente
- `/api/clientes-inativos-count` (linha 1461)
- `/api/clientes-ativos` (linha 1787)
- `/api/clientes-filtro` (linha 3369)
- `/api/clientes-por-colaboradores` (linha 7095)

### Endpoints relacionados a Contratos:
- `/api/contratos-count/:clienteId` (linha 3795)

### Endpoints relacionados a Tempo/Horas:
- `/api/tempo-estimado/:clienteId` (linha 3874)
- `/api/tempo-realizado/:clienteId` (linha 3960)
- `/api/horas-realizadas-por-periodo` (linha 4100)
- `/api/debug-horas-realizadas/:clienteId` (linha 4171)
- `/api/horas-realizadas-cliente/:clienteId` (linha 6536)
- `/api/tempo-realizado-total-global` (linha 6739)

### Endpoints relacionados a Colaboradores:
- `/api/colaboradores-count-simples/:clienteId` (linha 4422)
- `/api/colaboradores-nomes/:clienteId` (linha 4487)
- `/api/colaboradores` (linha 7057)
- `/api/debug-colaborador/:usuarioId` (linha 4315)
- `/api/debug-colaborador-horas/:usuarioId` (linha 7233)

### Endpoints relacionados a Custos:
- `/api/custo-total/:clienteId` (linha 4747)
- `/api/custo-contratado/:clienteId` (linha 4949)
- `/api/custo-estimado/:clienteId` (linha 5070)
- `/api/custos-totais/:clienteId` (linha 5233)
- `/api/custo-hora-membro/:membroId` (linha 8099)

### Endpoints relacionados a Produtos:
- `/api/produtos-cliente/:clienteId` (linha 5492)

### Endpoints relacionados a Membros:
- `/api/membros-nomes` (linha 6118)

### Endpoints relacionados a Dashboard:
- `/api/dashboard-clientes` (linha 7448)

### Endpoints relacionados a Registro de Tempo:
- `/api/registro-tempo` (linha 8158) - POST para criar registro
- `/api/timetrack-rastreio-por-tarefa/:tarefaId` (linha 6029)
- `/api/tarefa-usuarios-tempo/:tarefaId` (linha 6965)

### Endpoints relacionados a Atividades:
- `/api/atividades-periodo-count` (linha 3734)

### Endpoints de Debug:
- `/api/debug-tarefas` (linha 6372)

---

## 📝 Observações Importantes

### 1. **Problema de Portas**
- O servidor principal está na porta **4000** (`backEnd/src/index.js`)
- O servidor dashboard-clientes está na porta **4001** (`backEnd/src/servers/dashboard-clientes.js`)
- Alguns endpoints podem estar sendo chamados na porta errada pelo frontEnd

### 2. **Dependência de `api-clientes.js`**
- O arquivo `backEnd/src/services/api-clientes.js` já contém muitas funções necessárias
- O `dashboard-clientes.js` importa de `../../../api-clientes.js` (raiz do projeto)
- **Verificar**: Se existe um arquivo `api-clientes.js` na raiz ou se deve usar o de `backEnd/src/services/`

### 3. **Sistema de Cache**
- O cache está implementado, mas alguns endpoints do `node.js` usam cache e podem não estar usando no backEnd
- Verificar se os novos endpoints devem usar cache

### 4. **Autenticação**
- Todos os endpoints devem usar `requireAuth` middleware
- Verificar se os novos endpoints estão protegidos

---

## 🎯 Plano de Ação Recomendado

### Prioridade ALTA (endpoints usados pelo frontEnd):
1. ✅ Migrar `/api/clientes-kamino`
2. ✅ Migrar `/api/clientes-incompletos-count`
3. ✅ Migrar `/api/carteira-clientes`
4. ✅ Migrar `/api/tarefas-incompletas`
5. ✅ Migrar `/api/clientes/:id/inativar`
6. ✅ Migrar `/api/clientes/:id/ativar`
7. ⚠️ Verificar e corrigir porta de `/api/membros-por-cliente`

### Prioridade MÉDIA (verificar uso):
- Verificar quais endpoints de ClickUp são realmente usados
- Verificar quais endpoints de tarefas são usados
- Verificar endpoints de custos/horas

### Prioridade BAIXA:
- Endpoints de debug
- Endpoints não documentados no frontEnd

---

## 📌 Próximos Passos

1. Criar controllers/services para os endpoints de prioridade ALTA
2. Testar cada endpoint migrado
3. Verificar se o frontEnd está funcionando corretamente
4. Remover dependências do `node.js` antigo
5. Documentar endpoints finais

