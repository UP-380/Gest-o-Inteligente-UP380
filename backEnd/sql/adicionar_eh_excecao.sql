-- =============================================================
-- Script para adicionar coluna eh_excecao na tabela vinculados
-- =============================================================
-- Esta coluna indica se um vínculo é uma "exceção" (específico para um cliente)
-- ou "padrão" (herdado do produto para todos os clientes)
-- =============================================================

-- 1. Adicionar coluna eh_excecao (BOOLEAN, pode ser NULL)
ALTER TABLE up_gestaointeligente.vinculados
ADD COLUMN IF NOT EXISTS eh_excecao BOOLEAN DEFAULT NULL;

-- 2. Adicionar comentário na coluna
COMMENT ON COLUMN up_gestaointeligente.vinculados.eh_excecao IS 
'Indica se o vínculo é uma exceção (true) ou padrão (false). 
- true: Vínculo específico para um cliente (Cliente → Produto → Tarefa)
- false: Vínculo padrão do produto (Produto → Tarefa, sem cliente)
- NULL: Não se aplica (outros tipos de vínculos)';

-- 3. Popular dados existentes baseado na lógica atual:
--    - eh_excecao = true: quando tem cliente_id E produto_id E tarefa_id (Cliente → Produto → Tarefa)
--    - eh_excecao = false: quando tem produto_id E tarefa_id mas NÃO tem cliente_id (Produto → Tarefa)
--    - eh_excecao = NULL: outros casos (não se aplica)

UPDATE up_gestaointeligente.vinculados
SET eh_excecao = CASE
  -- Exceção: Cliente → Produto → Tarefa (com ou sem subtarefa)
  WHEN cliente_id IS NOT NULL 
       AND produto_id IS NOT NULL 
       AND tarefa_id IS NOT NULL 
  THEN true
  
  -- Padrão: Produto → Tarefa (sem cliente)
  WHEN cliente_id IS NULL 
       AND produto_id IS NOT NULL 
       AND tarefa_id IS NOT NULL 
  THEN false
  
  -- Não se aplica: outros tipos de vínculos
  ELSE NULL
END
WHERE eh_excecao IS NULL;

-- 4. Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_vinculados_eh_excecao 
ON up_gestaointeligente.vinculados(eh_excecao)
WHERE eh_excecao IS NOT NULL;

-- 5. Verificar resultados
SELECT 
  eh_excecao,
  COUNT(*) as total,
  tipo_relacionamento
FROM up_gestaointeligente.vinculados
WHERE eh_excecao IS NOT NULL
GROUP BY eh_excecao, tipo_relacionamento
ORDER BY eh_excecao, tipo_relacionamento;

