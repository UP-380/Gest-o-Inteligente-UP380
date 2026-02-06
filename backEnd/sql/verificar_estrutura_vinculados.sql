-- =============================================================
-- === SCRIPT PARA VERIFICAR/CRIAR ESTRUTURA DA TABELA VINCULADOS ===
-- =============================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- Este script:
-- 1. Verifica a estrutura atual da tabela vinculados
-- 2. Mostra índices existentes
-- 3. Sugere melhorias se necessário
-- =============================================================

-- =============================================================
-- 1. VERIFICAR ESTRUTURA DA TABELA
-- =============================================================

-- Verificar se a tabela existe e suas colunas
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'up_gestaointeligente'
    AND table_name = 'vinculados'
ORDER BY 
    ordinal_position;

-- =============================================================
-- 2. VERIFICAR ÍNDICES EXISTENTES
-- =============================================================

SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'up_gestaointeligente'
    AND tablename = 'vinculados'
ORDER BY 
    indexname;

-- =============================================================
-- 3. VERIFICAR CONSTRAINT DE UNICIDADE
-- =============================================================

SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint
WHERE 
    conrelid = 'up_gestaointeligente.vinculados'::regclass
    AND contype IN ('u', 'p'); -- 'u' = unique, 'p' = primary key

-- =============================================================
-- 4. CONTAR REGISTROS POR TIPO DE VINCULAÇÃO
-- =============================================================

SELECT 
    COUNT(*) AS total_registros,
    COUNT(tarefa_id) AS com_tarefa,
    COUNT(tarefa_tipo_id) AS com_tarefa_tipo,
    COUNT(produto_id) AS com_produto,
    COUNT(cliente_id) AS com_cliente,
    COUNT(subtarefa_id) AS com_subtarefa,
    COUNT(CASE WHEN tarefa_id IS NOT NULL AND produto_id IS NOT NULL THEN 1 END) AS tarefa_produto,
    COUNT(CASE WHEN produto_id IS NOT NULL AND cliente_id IS NOT NULL THEN 1 END) AS produto_cliente,
    COUNT(CASE WHEN tarefa_id IS NOT NULL AND produto_id IS NOT NULL AND cliente_id IS NOT NULL THEN 1 END) AS tarefa_produto_cliente
FROM 
    up_gestaointeligente.vinculados;

-- =============================================================
-- 5. VERIFICAR POSSÍVEIS DUPLICATAS (antes do índice único)
-- =============================================================

SELECT 
    tarefa_id,
    tarefa_tipo_id,
    produto_id,
    cliente_id,
    subtarefa_id,
    COUNT(*) AS quantidade
FROM 
    up_gestaointeligente.vinculados
GROUP BY 
    tarefa_id,
    tarefa_tipo_id,
    produto_id,
    cliente_id,
    subtarefa_id
HAVING 
    COUNT(*) > 1
ORDER BY 
    quantidade DESC,
    tarefa_id NULLS LAST,
    produto_id NULLS LAST,
    cliente_id NULLS LAST;

-- =============================================================
-- 6. ESTRUTURA ESPERADA DA TABELA
-- =============================================================
-- A tabela vinculados deve ter as seguintes colunas:
-- 
-- id (BIGSERIAL PRIMARY KEY)
-- tarefa_id (INTEGER, nullable) - Referencia cp_tarefa.id
-- tarefa_tipo_id (INTEGER, nullable) - Referencia cp_tarefa_tipo.id  
-- produto_id (INTEGER, nullable) - Referencia cp_produto.id
-- cliente_id (TEXT, nullable) - Referencia cp_cliente.id (UUID)
-- subtarefa_id (INTEGER, nullable) - Referencia cp_subtarefa.id
-- created_at (TIMESTAMP, nullable)
-- updated_at (TIMESTAMP, nullable)
--
-- IMPORTANTE: 
-- - cliente_id é TEXT porque cp_cliente.id é UUID
-- - Todos os campos podem ser NULL, mas pelo menos um deve estar preenchido
-- - Deve existir um índice único que previne duplicatas considerando NULLs
-- =============================================================

