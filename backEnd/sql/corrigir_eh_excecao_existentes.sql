-- =============================================================
-- Script para CORRIGIR dados existentes de eh_excecao
-- =============================================================
-- Este script corrige registros onde eh_excecao está incorreto:
-- - Se Cliente → Produto → Tarefa e a tarefa JÁ está vinculada ao produto → eh_excecao = false (Padrão)
-- - Se Cliente → Produto → Tarefa e a tarefa NÃO está vinculada ao produto → eh_excecao = true (Exceção)
-- =============================================================

-- 1. Atualizar vínculos Cliente → Produto → Tarefa que estão marcados como exceção (true)
--    mas a tarefa JÁ está vinculada ao produto (deveria ser padrão = false)
UPDATE up_gestaointeligente.vinculados v1
SET eh_excecao = false
WHERE v1.cliente_id IS NOT NULL
  AND v1.produto_id IS NOT NULL
  AND v1.tarefa_id IS NOT NULL
  AND v1.eh_excecao = true
  AND EXISTS (
    -- Verificar se existe vínculo Produto → Tarefa (sem cliente)
    SELECT 1
    FROM up_gestaointeligente.vinculados v2
    WHERE v2.produto_id = v1.produto_id
      AND v2.tarefa_id = v1.tarefa_id
      AND v2.cliente_id IS NULL
  );

-- 2. Atualizar vínculos Cliente → Produto → Tarefa que estão marcados como padrão (false)
--    mas a tarefa NÃO está vinculada ao produto (deveria ser exceção = true)
UPDATE up_gestaointeligente.vinculados v1
SET eh_excecao = true
WHERE v1.cliente_id IS NOT NULL
  AND v1.produto_id IS NOT NULL
  AND v1.tarefa_id IS NOT NULL
  AND v1.eh_excecao = false
  AND NOT EXISTS (
    -- Verificar se NÃO existe vínculo Produto → Tarefa (sem cliente)
    SELECT 1
    FROM up_gestaointeligente.vinculados v2
    WHERE v2.produto_id = v1.produto_id
      AND v2.tarefa_id = v1.tarefa_id
      AND v2.cliente_id IS NULL
  );

-- 3. Atualizar vínculos Cliente → Produto → Tarefa que estão NULL
--    mas deveriam ter um valor baseado na existência de vínculo Produto → Tarefa
UPDATE up_gestaointeligente.vinculados v1
SET eh_excecao = CASE
  WHEN EXISTS (
    SELECT 1
    FROM up_gestaointeligente.vinculados v2
    WHERE v2.produto_id = v1.produto_id
      AND v2.tarefa_id = v1.tarefa_id
      AND v2.cliente_id IS NULL
  ) THEN false  -- Padrão: tarefa já está no produto
  ELSE true    -- Exceção: tarefa não está no produto
END
WHERE v1.cliente_id IS NOT NULL
  AND v1.produto_id IS NOT NULL
  AND v1.tarefa_id IS NOT NULL
  AND v1.eh_excecao IS NULL;

-- 4. Verificar resultados
SELECT 
  'Antes da correção' as status,
  COUNT(*) FILTER (WHERE eh_excecao = true) as excecoes,
  COUNT(*) FILTER (WHERE eh_excecao = false) as padroes,
  COUNT(*) FILTER (WHERE eh_excecao IS NULL) as nulos
FROM up_gestaointeligente.vinculados
WHERE cliente_id IS NOT NULL
  AND produto_id IS NOT NULL
  AND tarefa_id IS NOT NULL;

-- 5. Mostrar exemplos de correções
SELECT 
  v1.id,
  v1.cliente_id,
  v1.produto_id,
  v1.tarefa_id,
  v1.eh_excecao,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM up_gestaointeligente.vinculados v2
      WHERE v2.produto_id = v1.produto_id
        AND v2.tarefa_id = v1.tarefa_id
        AND v2.cliente_id IS NULL
    ) THEN 'Padrão (tarefa no produto)'
    ELSE 'Exceção (tarefa não no produto)'
  END as status_esperado
FROM up_gestaointeligente.vinculados v1
WHERE v1.cliente_id IS NOT NULL
  AND v1.produto_id IS NOT NULL
  AND v1.tarefa_id IS NOT NULL
LIMIT 20;






