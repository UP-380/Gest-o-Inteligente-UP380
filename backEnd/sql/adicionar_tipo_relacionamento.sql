-- =============================================================
-- === ADICIONAR COLUNA tipo_relacionamento ===
-- =============================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- OBJETIVO: Adicionar coluna tipo_relacionamento para facilitar
-- queries e organização dos dados
--
-- =============================================================

-- 1. ADICIONAR coluna tipo_relacionamento
ALTER TABLE up_gestaointeligente.vinculados
ADD COLUMN IF NOT EXISTS tipo_relacionamento VARCHAR(50);

-- 2. ADICIONAR comentário explicativo
COMMENT ON COLUMN up_gestaointeligente.vinculados.tipo_relacionamento IS 
'Tipo de relacionamento: tipo_tarefa_tarefa, tarefa_subtarefa, produto_tarefa, produto_tipo_tarefa, cliente_produto, cliente_produto_tarefa, cliente_produto_tarefa_subtarefa';

-- 3. CRIAR índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_vinculados_tipo_relacionamento 
ON up_gestaointeligente.vinculados(tipo_relacionamento) 
WHERE tipo_relacionamento IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_tipo_relacionamento IS 
'Índice para melhorar queries que filtram por tipo de relacionamento';

-- =============================================================
-- POPULAR DADOS EXISTENTES
-- =============================================================
-- Execute este UPDATE para popular os registros existentes
-- (será feito via script Node.js também)

-- Seção 1: Tipo de Tarefa → Tarefa
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'tipo_tarefa_tarefa'
WHERE tarefa_tipo_id IS NOT NULL 
  AND tarefa_id IS NOT NULL 
  AND produto_id IS NULL 
  AND cliente_id IS NULL 
  AND subtarefa_id IS NULL;

-- Seção 2: Tarefa → Subtarefa
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'tarefa_subtarefa'
WHERE tarefa_id IS NOT NULL 
  AND subtarefa_id IS NOT NULL 
  AND produto_id IS NULL 
  AND cliente_id IS NULL;

-- Seção 3: Produto → Tarefa (sem cliente)
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'produto_tarefa'
WHERE produto_id IS NOT NULL 
  AND tarefa_id IS NOT NULL 
  AND cliente_id IS NULL 
  AND subtarefa_id IS NULL;

-- Seção 3: Produto → Tarefa com Subtarefa (sem cliente)
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'produto_tarefa_subtarefa'
WHERE produto_id IS NOT NULL 
  AND tarefa_id IS NOT NULL 
  AND subtarefa_id IS NOT NULL 
  AND cliente_id IS NULL;

-- Produto → Tipo de Tarefa (sem tarefa específica)
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'produto_tipo_tarefa'
WHERE produto_id IS NOT NULL 
  AND tarefa_tipo_id IS NOT NULL 
  AND tarefa_id IS NULL 
  AND cliente_id IS NULL;

-- Seção 4: Cliente → Produto (sem tarefa)
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'cliente_produto'
WHERE cliente_id IS NOT NULL 
  AND produto_id IS NOT NULL 
  AND tarefa_id IS NULL 
  AND subtarefa_id IS NULL;

-- Seção 4: Cliente → Produto → Tarefa
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'cliente_produto_tarefa'
WHERE cliente_id IS NOT NULL 
  AND produto_id IS NOT NULL 
  AND tarefa_id IS NOT NULL 
  AND subtarefa_id IS NULL;

-- Seção 4: Cliente → Produto → Tarefa → Subtarefa
UPDATE up_gestaointeligente.vinculados
SET tipo_relacionamento = 'cliente_produto_tarefa_subtarefa'
WHERE cliente_id IS NOT NULL 
  AND produto_id IS NOT NULL 
  AND tarefa_id IS NOT NULL 
  AND subtarefa_id IS NOT NULL;

-- =============================================================
-- VERIFICAÇÃO
-- =============================================================
-- Execute esta query para verificar a distribuição dos tipos:
-- 
-- SELECT 
--   tipo_relacionamento,
--   COUNT(*) as total
-- FROM up_gestaointeligente.vinculados
-- GROUP BY tipo_relacionamento
-- ORDER BY total DESC;
-- =============================================================

