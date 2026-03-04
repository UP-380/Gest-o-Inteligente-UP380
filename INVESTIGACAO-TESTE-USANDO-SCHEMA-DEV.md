# Por que o ambiente de TESTE ainda usa o schema de dev?

Você já editou o .env na VPS do teste e deixou igual ao do upmap (produção), mas o sistema de teste continua parecendo usar o schema de dev. Abaixo o que checar.

---

## 1. Qual arquivo de env o TESTE realmente usa?

No **Docker**, o ambiente de teste usa **só** o arquivo que o `docker-compose.test.yml` declara:

```yaml
env_file:
  - .env.test
```

Ou seja:
- O container **não** lê `backEnd/.env` nem `.env.production`.
- Ele lê **`.env.test`** na **raiz do projeto** (mesma pasta do `docker-compose.test.yml`).

**O que fazer na VPS:**

1. Abrir a pasta onde está o `docker-compose.test.yml` (raiz do projeto do teste).
2. Editar o arquivo **`.env.test`** dessa pasta (e não outro .env).
3. Garantir que tenha exatamente o que você quer para “igual ao upmap”:
   - `SUPABASE_URL=` (mesma do upmap)
   - `SUPABASE_SERVICE_KEY=` (mesma do upmap)
   - `SUPABASE_DB_SCHEMA=up_gestaointeligente` (schema oficial)

Se você tiver editado outro arquivo (por exemplo `backEnd/.env` ou `.env`), o container de teste **não** usa esse arquivo. Só conta o que está em **`.env.test`** na raiz.

---

## 2. Container precisa ser recriado para carregar o .env de novo

As variáveis do `env_file` são lidas **na hora que o container sobe**. Se você alterou o `.env.test` depois que o container já estava rodando, o processo antigo continua com as variáveis antigas.

**Na VPS, na pasta do projeto de teste:**

```bash
docker compose -f docker-compose.test.yml up -d --force-recreate
```

(ou o comando que você usa aí, por exemplo `docker-compose` em vez de `docker compose`)

Assim os containers (upgi-app-test e bun-service) sobem de novo e carregam o `.env.test` atualizado.

---

## 3. Confirmar qual schema o backend está usando (endpoint de diagnóstico)

Foi adicionado um endpoint que mostra o que o **processo Node** está vendo de variáveis de ambiente:

- **URL:** `GET /api/debug-env`
- **Exemplo no teste:**  
  `https://test-upmap.up380.com.br/api/debug-env`  
  (ou `http://82.25.70.150:6033/api/debug-env` se acessar por IP/porta)

Resposta esperada quando estiver correto (igual ao upmap):

```json
{
  "schema": "up_gestaointeligente",
  "supabaseUrlMasked": "https://xxxxx.supabase.co...supabase.co",
  "nodeEnv": "production",
  "timestamp": "..."
}
```

Se aparecer `schema: "up_gestaointeligente_dev"` ou `(não definido, fallback: up_gestaointeligente)` com você achando que deveria ser outro, então o processo **não** está recebendo o `SUPABASE_DB_SCHEMA` que está no `.env.test` (arquivo errado ou container não recriado).

**Como testar:**

- Navegador: abrir a URL do teste + `/api/debug-env`.
- Ou na VPS:  
  `curl -s https://test-upmap.up380.com.br/api/debug-env`  
  (ou a URL que você usa para o app de teste).

Assim você confirma na prática qual schema o backend de teste está usando.

---

## 4. Código antigo (antes das alterações) com schema dev fixo

Enquanto as alterações que fizemos **não** forem deployadas, o código que está rodando no servidor de teste ainda tem **schema de dev fixo** em alguns pontos:

- **`departamentos.controller.js`**  
  Duas queries usam `.schema('up_gestaointeligente_dev')` (atualizar/remover membro do departamento).
- **`equipamentos.controller.js`**  
  Duas queries usam `.schema('up_gestaointeligente_dev')` (busca de membros/nomes).

Ou seja:
- **Clientes, login, etc.** → usam o schema do `database.js` → vindo do `.env` (que no Docker é o `.env.test`). Se o `.env.test` estiver certo e o container recriado, isso já pode estar no schema oficial.
- **Departamentos e equipamentos** (nessas duas funções) → **sempre** vão no schema `up_gestaointeligente_dev` enquanto o código antigo estiver no ar, **mesmo que o .env tenha schema oficial**.

Por isso:
1. Ajustar o **`.env.test`** na raiz e **recriar os containers** resolve a parte que lê do env (clientes, auth, etc.).
2. **Subir as alterações** que trocam esse schema fixo por `process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente'` faz com que **tudo** (incluindo departamentos e equipamentos) use o schema definido no .env da VPS (oficial no teste).

---

## Checklist rápido

| Passo | O que fazer |
|-------|-------------|
| 1 | Na VPS, na pasta do projeto de **teste**, editar o arquivo **`.env.test`** (raiz), não outro .env. |
| 2 | Colocar em `.env.test`: mesma `SUPABASE_URL`, mesma `SUPABASE_SERVICE_KEY` e `SUPABASE_DB_SCHEMA=up_gestaointeligente`. |
| 3 | Recriar os containers: `docker compose -f docker-compose.test.yml up -d --force-recreate`. |
| 4 | Chamar `https://<seu-dominio-test>/api/debug-env` e conferir se `schema` é `up_gestaointeligente`. |
| 5 | Depois, fazer deploy das alterações (departamentos/equipamentos usando schema do env) para que nenhuma parte do código force mais o schema de dev. |

Se após o passo 4 o `schema` no `/api/debug-env` já for `up_gestaointeligente` e mesmo assim alguma tela ainda parecer “de dev”, aí é uma dessas rotas que ainda estão com schema fixo no código antigo; o deploy do passo 5 resolve.
