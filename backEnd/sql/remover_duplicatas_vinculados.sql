-- =============================================================
-- === REMOVER DUPLICATAS DA TABELA VINCULADOS ===
-- =============================================================
-- Execute estas queries no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- ⚠️ IMPORTANTE: Faça backup antes de executar!
-- ⚠️ Execute PASSO A PASSO e verifique os resultados

-- =============================================================
-- PASSO 1: Verificar duplicatas existentes
-- =============================================================
SELECT 
  COALESCE(cp_atividade::text, 'NULL') as cp_atividade,
  COALESCE(cp_atividade_tipo::text, 'NULL') as cp_atividade_tipo,
  COALESCE(cp_produto::text, 'NULL') as cp_produto,
  COALESCE(cp_cliente, 'NULL') as cp_cliente,
  COUNT(*) as quantidade,
  ARRAY_AGG(id ORDER BY id) as ids_duplicados
FROM up_gestaointeligente.vinculados
GROUP BY 
  COALESCE(cp_atividade::text, 'NULL'),
  COALESCE(cp_atividade_tipo::text, 'NULL'),
  COALESCE(cp_produto::text, 'NULL'),
  COALESCE(cp_cliente, 'NULL')
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- =============================================================
-- PASSO 2: Ver quantos registros serão removidos
-- =============================================================
SELECT COUNT(*) as total_registros_para_remover
FROM up_gestaointeligente.vinculados v1
WHERE EXISTS (
  SELECT 1
  FROM up_gestaointeligente.vinculados v2
  WHERE 
    COALESCE(v1.cp_atividade::text, 'NULL') = COALESCE(v2.cp_atividade::text, 'NULL')
    AND COALESCE(v1.cp_atividade_tipo::text, 'NULL') = COALESCE(v2.cp_atividade_tipo::text, 'NULL')
    AND COALESCE(v1.cp_produto::text, 'NULL') = COALESCE(v2.cp_produto::text, 'NULL')
    AND COALESCE(v1.cp_cliente, 'NULL') = COALESCE(v2.cp_cliente, 'NULL')
    AND v2.id < v1.id
);

-- =============================================================
-- PASSO 3: Ver detalhes dos registros que serão removidos
-- =============================================================
SELECT 
  v1.id as id_para_remover,
  v1.cp_atividade,
  v1.cp_atividade_tipo,
  v1.cp_produto,
  v1.cp_cliente,
  v2.id as id_que_sera_mantido
FROM up_gestaointeligente.vinculados v1
INNER JOIN up_gestaointeligente.vinculados v2 ON (
  COALESCE(v1.cp_atividade::text, 'NULL') = COALESCE(v2.cp_atividade::text, 'NULL')
  AND COALESCE(v1.cp_atividade_tipo::text, 'NULL') = COALESCE(v2.cp_atividade_tipo::text, 'NULL')
  AND COALESCE(v1.cp_produto::text, 'NULL') = COALESCE(v2.cp_produto::text, 'NULL')
  AND COALESCE(v1.cp_cliente, 'NULL') = COALESCE(v2.cp_cliente, 'NULL')
  AND v2.id < v1.id
)
ORDER BY v1.id;

-- =============================================================
-- PASSO 4: REMOVER DUPLICATAS (Execute apenas após verificar!)
-- =============================================================
-- ⚠️ CUIDADO: Esta query remove registros permanentemente!
-- ⚠️ Mantém apenas o registro com o MENOR ID de cada combinação
-- ⚠️ Recomendado: Execute dentro de uma transação

-- Opção 1: Usando CTE (mais legível)
WITH duplicatas AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        COALESCE(cp_atividade::text, 'NULL'),
        COALESCE(cp_atividade_tipo::text, 'NULL'),
        COALESCE(cp_produto::text, 'NULL'),
        COALESCE(cp_cliente, 'NULL')
      ORDER BY id
    ) as row_num
  FROM up_gestaointeligente.vinculados
)
DELETE FROM up_gestaointeligente.vinculados
WHERE id IN (
  SELECT id FROM duplicatas WHERE row_num > 1
);

-- Verificar resultado após remoção
SELECT COUNT(*) as duplicatas_restantes
FROM (
  SELECT 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL'),
    COUNT(*) as quantidade
  FROM up_gestaointeligente.vinculados
  GROUP BY 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL')
  HAVING COUNT(*) > 1
) duplicatas;

-- Se duplicatas_restantes = 0, você pode prosseguir para criar o índice único
-- Se duplicatas_restantes > 0, execute novamente a query de remoção acima

-- =============================================================
-- ALTERNATIVA: Usando transação (mais seguro)
-- =============================================================
/*
BEGIN;

WITH duplicatas AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        COALESCE(cp_atividade::text, 'NULL'),
        COALESCE(cp_atividade_tipo::text, 'NULL'),
        COALESCE(cp_produto::text, 'NULL'),
        COALESCE(cp_cliente, 'NULL')
      ORDER BY id
    ) as row_num
  FROM up_gestaointeligente.vinculados
)
DELETE FROM up_gestaointeligente.vinculados
WHERE id IN (
  SELECT id FROM duplicatas WHERE row_num > 1
);

-- Verificar se ainda há duplicatas
SELECT COUNT(*) as duplicatas_restantes
FROM (
  SELECT 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL'),
    COUNT(*) as quantidade
  FROM up_gestaointeligente.vinculados
  GROUP BY 
    COALESCE(cp_atividade::text, 'NULL'),
    COALESCE(cp_atividade_tipo::text, 'NULL'),
    COALESCE(cp_produto::text, 'NULL'),
    COALESCE(cp_cliente, 'NULL')
  HAVING COUNT(*) > 1
) duplicatas;

-- Se duplicatas_restantes = 0, execute COMMIT, senão execute ROLLBACK
COMMIT;
-- ROLLBACK;
*/

