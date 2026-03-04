# Investigação: Dados Diferentes entre TESTE e PRODUÇÃO

## Objetivo
Descobrir por que, com a **mesma** conexão de banco (SUPABASE_URL e KEYS iguais), o ambiente de TESTE exibe dados diferentes (ex.: Clientes) da PRODUÇÃO.

---

## 1. Lógica de tenant/domínio

**Resultado: NENHUMA encontrada.**

- Não existe código que filtre dados usando `window.location.hostname` ou `req.hostname`.
- Nenhuma lógica identifica "Empresa" ou tenant pelo domínio ou IP (ex.: 82.25.70.150:6033).
- O frontend usa `window.ApiConfig?.baseURL` ou fallback `/api`; não há diferenciação por host.

**Conclusão:** O sistema não escolhe banco/schema por domínio ou IP.

---

## 2. Middlewares de auth/database e uso do .env

### 2.1 Backend Node (`backEnd/`)

- **`backEnd/src/config/database.js`**: Usa apenas `process.env.SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) e `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente'`. Não há lógica que ignora o .env por domínio.
- **`backEnd/src/index.js`**: Carrega `require('dotenv').config()` (sem path), ou seja, lê o `.env` do **diretório de trabalho** ao iniciar (geralmente `backEnd/` em dev; no Docker, variáveis vêm do `env_file`).
- **Middleware de auth** (`backEnd/src/middleware/auth.js`): Apenas valida sessão/token e preenche `req.session.usuario`. Não altera SUPABASE_DB_SCHEMA nem chaves de API.

### 2.2 Docker – origem das variáveis em TESTE

No **Docker**, o ambiente de teste usa:

- **`docker-compose.test.yml`** → `env_file: .env.test` (arquivo na **raiz** do projeto).

Ou seja, em TESTE as variáveis vêm do **`.env.test` da raiz**, e **não** do `backEnd/.env`.

- Se você igualou apenas o **`backEnd/.env`** à produção, o container de teste **continua** usando o que está em **`.env.test`**.
- O `.env.test` commitado no repositório ainda contém placeholders:
  - `SUPABASE_URL=https://seu-projeto-teste.supabase.co`
  - `SUPABASE_SERVICE_KEY=sua-service-key-de-teste`

**Causa mais provável da diferença de dados:**  
O ambiente de TESTE (Docker) está usando **outro projeto/chaves** definidos em **`.env.test`**. Para TESTE mostrar os mesmos dados da PRODUÇÃO, é necessário:

1. Garantir que **`.env.test`** (o arquivo usado pelo `docker-compose.test.yml`) tenha as **mesmas** `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` da produção (e o mesmo `SUPABASE_DB_SCHEMA`).
2. **Recriar/reiniciar** os containers após alterar `.env.test` (`docker compose -f docker-compose.test.yml up -d --force-recreate` ou equivalente).

---

## 3. Filtros de query (hardcoded) e schemas fixos

### 3.1 Filtros por status/ambiente

- **Nenhum** filtro do tipo `.eq('status','teste')` ou `.eq('ambiente','dev')` foi encontrado nos controllers (ex.: `clientes.controller.js`).
- A listagem de clientes (`getClientes`) não aplica filtro por ambiente; apenas paginação, busca e filtro opcional de `status` vindo da query string.

### 3.2 Schemas hardcoded (problemas encontrados)

Vários arquivos usam schema fixo em vez de `process.env.SUPABASE_DB_SCHEMA`:

| Arquivo | Problema |
|--------|-----------|
| **`backEnd/src/controllers/departamentos.controller.js`** | Duas queries usam `.schema('up_gestaointeligente_dev')` (linhas 289 e 335). |
| **`backEnd/src/controllers/equipamentos.controller.js`** | Duas queries usam `.schema('up_gestaointeligente_dev')` (linhas 58 e 688). |
| **`backEnd/src/services/custo-membro-vigencia.service.js`** | Cria seu próprio cliente Supabase com `db: { schema: 'up_gestaointeligente' }` fixo (não lê do .env). |
| **`backEnd/src/fix_types.js`** | Fallback `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente_dev'` (script de manutenção; não afeta o servidor web). |

Os trechos em **departamentos** e **equipamentos** com `up_gestaointeligente_dev` fazem com que essas operações apontem para o schema de **dev** mesmo quando o resto do app usa produção. Isso pode causar inconsistência (ex.: dados de departamento/equipamentos em schema diferente do de clientes).  
**Recomendação:** Usar em todos `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente'` e garantir que `.env.test` defina o mesmo schema quando quiser espelhar produção.

---

## 4. Storage/sessão e metadata

- **Sessão:** O backend usa `req.session.usuario` (id, email, nome, foto, permissoes). Não há campo de metadata no usuário logado que defina qual banco ou schema acessar.
- **Metadata** no código aparece em notificações, chamados e storage de arquivos (ex.: `entityId`/`entityType` para avatares), **não** para seleção de banco/schema.

**Conclusão:** Nenhuma lógica de storage/sessão define banco ou schema.

---

## 5. Backend Bun (`backend_js/`)

- **`backend_js/src/lib/supabaseClient.ts`**: Cria o cliente Supabase **sem** opção `db: { schema }`. O schema default do Supabase é `public`.
- Handlers que precisam do schema (ex.: gestão de capacidade, live-monitoring) usam `supabase.schema(process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente')` em cada query.
- Se algum endpoint do Bun não chamar `.schema()` e depender do schema `up_gestaointeligente`, pode haver leitura/escrita no schema errado. Para garantir consistência, o ideal é que o cliente Bun também use `db: { schema }` conforme o .env (ou que toda query use `.schema()` explicitamente).

---

## 6. Cache

- **Backend:** `backEnd/src/config/cache.js` usa NodeCache com chaves como `'clientes'` (sem domínio). O controller de clientes **não** usa `getCachedData`/`setCachedData` na listagem; apenas `clearCache('clientes')` em create/update/delete.
- **Frontend:** `api.js` usa `sessionStorage` com TTL para cache de API; não há chave por domínio.

Ou seja, o cache não é a causa da diferença de dados entre TESTE e PRODUÇÃO (cada processo tem seu próprio cache; a origem dos dados é a conexão Supabase).

---

## Resumo e ações recomendadas

| Causa | Ação |
|-------|------|
| **Variáveis em TESTE vêm de `.env.test` (raiz), não de `backEnd/.env`** | Garantir que **`.env.test`** tenha as mesmas `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `SUPABASE_DB_SCHEMA` da produção quando quiser os mesmos dados. Reiniciar/recriar containers após alterar. |
| **Schemas hardcoded `up_gestaointeligente_dev`** | Trocar em `departamentos.controller.js` e `equipamentos.controller.js` para `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente'`. |
| **`custo-membro-vigencia.service.js`** | Fazer o schema vir de `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente'` em vez de fixo. |
| **`fix_types.js`** | Se for usado em ambiente de teste, ajustar fallback para `'up_gestaointeligente'` ou sempre definir `SUPABASE_DB_SCHEMA` no .env. |
| **Backend Bun** | Considerar definir `db: { schema }` no `supabaseClient.ts` a partir do .env para evitar queries sem schema. |

Com a **mesma** SUPABASE_URL, mesma SERVICE_KEY e mesmo SUPABASE_DB_SCHEMA em **todos** os pontos (incluindo o arquivo realmente carregado no Docker test), TESTE e PRODUÇÃO passarão a ver os mesmos dados, desde que não haja RLS ou outras políticas no Supabase que filtrem por aplicação/origem.
