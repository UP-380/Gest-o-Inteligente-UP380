-- =============================================================
-- === MELHORIAS NA TABELA VINCULADOS ===
-- =============================================================
-- Execute estas queries no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- ⚠️ IMPORTANTE: ANTES de executar este arquivo, execute primeiro:
--    sql/remover_duplicatas_vinculados.sql
--    para remover duplicatas existentes, caso contrário o índice único falhará!

-- =============================================================
-- === CRIAR ÍNDICES (Execute APÓS remover duplicatas) ===
-- =============================================================

-- 1. Criar índice único parcial para evitar duplicatas (considerando NULLs)
-- Este índice garante que combinações idênticas não sejam duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculados_unique 
ON up_gestaointeligente.vinculados (
  COALESCE(cp_atividade::text, 'NULL'),
  COALESCE(cp_atividade_tipo::text, 'NULL'),
  COALESCE(cp_produto::text, 'NULL'),
  COALESCE(cp_cliente, 'NULL')
);

-- 2. Criar índices para melhorar performance de queries por campo
CREATE INDEX IF NOT EXISTS idx_vinculados_atividade 
ON up_gestaointeligente.vinculados(cp_atividade) 
WHERE cp_atividade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vinculados_atividade_tipo 
ON up_gestaointeligente.vinculados(cp_atividade_tipo) 
WHERE cp_atividade_tipo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vinculados_produto 
ON up_gestaointeligente.vinculados(cp_produto) 
WHERE cp_produto IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vinculados_cliente 
ON up_gestaointeligente.vinculados(cp_cliente) 
WHERE cp_cliente IS NOT NULL AND cp_cliente != '';

-- 3. Criar índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_vinculados_produto_cliente 
ON up_gestaointeligente.vinculados(cp_produto, cp_cliente) 
WHERE cp_produto IS NOT NULL AND cp_cliente IS NOT NULL AND cp_cliente != '';

CREATE INDEX IF NOT EXISTS idx_vinculados_atividade_produto 
ON up_gestaointeligente.vinculados(cp_atividade, cp_produto) 
WHERE cp_atividade IS NOT NULL AND cp_produto IS NOT NULL;

-- 4. Comentários para documentação
COMMENT ON INDEX up_gestaointeligente.idx_vinculados_unique IS 
'Índice único que previne duplicatas considerando NULLs como valores distintos';

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_atividade IS 
'Índice para melhorar queries que filtram por atividade';

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_produto IS 
'Índice para melhorar queries que filtram por produto';

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_cliente IS 
'Índice para melhorar queries que filtram por cliente';
