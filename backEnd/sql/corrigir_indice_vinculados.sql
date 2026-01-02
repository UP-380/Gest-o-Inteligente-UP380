-- =============================================================
-- === CORRIGIR ÍNDICE ÚNICO DA TABELA VINCULADOS ===
-- =============================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- PROBLEMA: O índice único atual não inclui subtarefa_id,
-- causando erro de duplicata ao vincular subtarefas.
--
-- =============================================================

-- 1. REMOVER o índice antigo (que não inclui subtarefa_id)
DROP INDEX IF EXISTS up_gestaointeligente.idx_vinculados_unique;

-- 2. CRIAR novo índice único que INCLUI subtarefa_id
CREATE UNIQUE INDEX idx_vinculados_unique 
ON up_gestaointeligente.vinculados (
  COALESCE(tarefa_id::text, 'NULL'),
  COALESCE(tarefa_tipo_id::text, 'NULL'),
  COALESCE(produto_id::text, 'NULL'),
  COALESCE(cliente_id, 'NULL'),
  COALESCE(subtarefa_id::text, 'NULL')
);

-- 3. Adicionar comentário explicativo
COMMENT ON INDEX up_gestaointeligente.idx_vinculados_unique IS 
'Índice único que previne duplicatas considerando TODOS os campos: tarefa_id, tarefa_tipo_id, produto_id, cliente_id e subtarefa_id. NULLs são tratados como valores distintos.';

-- 4. Criar índice para melhorar performance de queries por subtarefa
CREATE INDEX IF NOT EXISTS idx_vinculados_subtarefa 
ON up_gestaointeligente.vinculados(subtarefa_id) 
WHERE subtarefa_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_subtarefa IS 
'Índice para melhorar queries que filtram por subtarefa';

-- =============================================================
-- VERIFICAÇÃO
-- =============================================================
-- Execute esta query para verificar se o índice foi criado:
-- 
-- SELECT 
--   indexname, 
--   indexdef 
-- FROM 
--   pg_indexes 
-- WHERE 
--   schemaname = 'up_gestaointeligente' 
--   AND tablename = 'vinculados';
-- =============================================================

