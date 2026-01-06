-- =============================================================
-- Script para verificar subtarefas vinculadas ao cliente
-- =============================================================
-- Este script verifica como as subtarefas estão sendo armazenadas
-- e retornadas pela API para identificar problemas na marcação

-- 1. Verificar estrutura da tabela vinculados
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'up_gestaointeligente'
  AND table_name = 'vinculados'
  AND column_name IN ('id', 'cliente_id', 'produto_id', 'tarefa_id', 'subtarefa_id', 'tipo_relacionamento')
ORDER BY ordinal_position;

-- 2. Verificar todos os vinculados com subtarefa para um cliente específico
-- Substitua '25775b0a-e907-414e-985a-673d43f31de9' pelo cliente_id que você está testando
SELECT 
    v.id,
    v.cliente_id,
    v.produto_id,
    v.tarefa_id,
    v.subtarefa_id,
    v.tipo_relacionamento,
    t.nome AS tarefa_nome,
    st.nome AS subtarefa_nome,
    p.nome AS produto_nome
FROM up_gestaointeligente.vinculados v
LEFT JOIN up_gestaointeligente.cp_tarefa t ON t.id = v.tarefa_id
LEFT JOIN up_gestaointeligente.cp_subtarefa st ON st.id = v.subtarefa_id
LEFT JOIN up_gestaointeligente.cp_produto p ON p.id = v.produto_id
WHERE v.cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND v.subtarefa_id IS NOT NULL
ORDER BY v.produto_id, v.tarefa_id, v.subtarefa_id;

-- 3. Verificar tipos de dados dos IDs (pode haver problema de tipo)
SELECT 
    'cliente_id' AS campo,
    cliente_id AS valor,
    pg_typeof(cliente_id) AS tipo_dado
FROM up_gestaointeligente.vinculados
WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND subtarefa_id IS NOT NULL
LIMIT 1

UNION ALL

SELECT 
    'produto_id' AS campo,
    produto_id::text AS valor,
    pg_typeof(produto_id) AS tipo_dado
FROM up_gestaointeligente.vinculados
WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND subtarefa_id IS NOT NULL
LIMIT 1

UNION ALL

SELECT 
    'tarefa_id' AS campo,
    tarefa_id::text AS valor,
    pg_typeof(tarefa_id) AS tipo_dado
FROM up_gestaointeligente.vinculados
WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND subtarefa_id IS NOT NULL
LIMIT 1

UNION ALL

SELECT 
    'subtarefa_id' AS campo,
    subtarefa_id::text AS valor,
    pg_typeof(subtarefa_id) AS tipo_dado
FROM up_gestaointeligente.vinculados
WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND subtarefa_id IS NOT NULL
LIMIT 1;

-- 4. Verificar subtarefas por tarefa e produto (agrupado)
SELECT 
    v.produto_id,
    p.nome AS produto_nome,
    v.tarefa_id,
    t.nome AS tarefa_nome,
    COUNT(DISTINCT v.subtarefa_id) AS total_subtarefas,
    ARRAY_AGG(DISTINCT v.subtarefa_id ORDER BY v.subtarefa_id) AS subtarefa_ids,
    ARRAY_AGG(DISTINCT st.nome ORDER BY st.nome) AS subtarefa_nomes
FROM up_gestaointeligente.vinculados v
LEFT JOIN up_gestaointeligente.cp_produto p ON p.id = v.produto_id
LEFT JOIN up_gestaointeligente.cp_tarefa t ON t.id = v.tarefa_id
LEFT JOIN up_gestaointeligente.cp_subtarefa st ON st.id = v.subtarefa_id
WHERE v.cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND v.subtarefa_id IS NOT NULL
  AND v.produto_id IS NOT NULL
  AND v.tarefa_id IS NOT NULL
GROUP BY v.produto_id, p.nome, v.tarefa_id, t.nome
ORDER BY v.produto_id, v.tarefa_id;

-- 5. Verificar se há duplicatas ou inconsistências
SELECT 
    cliente_id,
    produto_id,
    tarefa_id,
    subtarefa_id,
    COUNT(*) AS quantidade,
    ARRAY_AGG(id ORDER BY id) AS vinculado_ids
FROM up_gestaointeligente.vinculados
WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND subtarefa_id IS NOT NULL
GROUP BY cliente_id, produto_id, tarefa_id, subtarefa_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- 6. Verificar o que a API deveria retornar (simular a query da API)
-- Buscar subtarefas vinculadas ao cliente para uma tarefa específica
-- Substitua os valores conforme necessário
WITH tarefa_produto AS (
    SELECT DISTINCT
        v.tarefa_id,
        v.produto_id
    FROM up_gestaointeligente.vinculados v
    WHERE v.cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
      AND v.tarefa_id IS NOT NULL
      AND v.produto_id IS NOT NULL
    LIMIT 1
)
SELECT 
    tp.tarefa_id,
    tp.produto_id,
    t.nome AS tarefa_nome,
    p.nome AS produto_nome,
    ARRAY_AGG(DISTINCT v.subtarefa_id ORDER BY v.subtarefa_id) FILTER (WHERE v.subtarefa_id IS NOT NULL) AS subtarefas_vinculadas_cliente,
    COUNT(DISTINCT v.subtarefa_id) FILTER (WHERE v.subtarefa_id IS NOT NULL) AS total_subtarefas_vinculadas
FROM tarefa_produto tp
LEFT JOIN up_gestaointeligente.vinculados v ON 
    v.cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
    AND v.produto_id = tp.produto_id
    AND v.tarefa_id = tp.tarefa_id
    AND v.subtarefa_id IS NOT NULL
LEFT JOIN up_gestaointeligente.cp_tarefa t ON t.id = tp.tarefa_id
LEFT JOIN up_gestaointeligente.cp_produto p ON p.id = tp.produto_id
GROUP BY tp.tarefa_id, tp.produto_id, t.nome, p.nome;

-- 7. Comparar: subtarefas vinculadas à tarefa (herança) vs subtarefas vinculadas ao cliente
SELECT 
    'Herança (Tarefa → Subtarefa)' AS tipo,
    v.tarefa_id,
    COUNT(DISTINCT v.subtarefa_id) AS total_subtarefas,
    ARRAY_AGG(DISTINCT v.subtarefa_id ORDER BY v.subtarefa_id) AS subtarefa_ids
FROM up_gestaointeligente.vinculados v
WHERE v.tarefa_id IN (
    SELECT DISTINCT tarefa_id 
    FROM up_gestaointeligente.vinculados 
    WHERE cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
      AND tarefa_id IS NOT NULL
    LIMIT 1
)
  AND v.subtarefa_id IS NOT NULL
  AND v.produto_id IS NULL
  AND v.cliente_id IS NULL
GROUP BY v.tarefa_id

UNION ALL

SELECT 
    'Cliente específico' AS tipo,
    v.tarefa_id,
    COUNT(DISTINCT v.subtarefa_id) AS total_subtarefas,
    ARRAY_AGG(DISTINCT v.subtarefa_id ORDER BY v.subtarefa_id) AS subtarefa_ids
FROM up_gestaointeligente.vinculados v
WHERE v.cliente_id = '25775b0a-e907-414e-985a-673d43f31de9'
  AND v.tarefa_id IS NOT NULL
  AND v.subtarefa_id IS NOT NULL
GROUP BY v.tarefa_id;

