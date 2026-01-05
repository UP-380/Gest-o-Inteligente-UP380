-- =============================================================
-- === CRIAR/CORRIGIR ESTRUTURA DA TABELA VINCULADOS ===
-- =============================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: up_gestaointeligente
--
-- ⚠️ ATENÇÃO: Execute PRIMEIRO o script verificar_estrutura_vinculados.sql
-- para entender a estrutura atual antes de fazer alterações!
-- =============================================================

-- =============================================================
-- 1. VERIFICAR SE TABELA EXISTE (não criar se já existir)
-- =============================================================

-- A tabela já deve existir, então não criaremos aqui.
-- Se precisar criar do zero, use:
/*
CREATE TABLE IF NOT EXISTS up_gestaointeligente.vinculados (
    id BIGSERIAL PRIMARY KEY,
    tarefa_id INTEGER REFERENCES up_gestaointeligente.cp_tarefa(id) ON DELETE CASCADE,
    tarefa_tipo_id INTEGER REFERENCES up_gestaointeligente.cp_tarefa_tipo(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES up_gestaointeligente.cp_produto(id) ON DELETE CASCADE,
    cliente_id TEXT REFERENCES up_gestaointeligente.cp_cliente(id) ON DELETE CASCADE,
    subtarefa_id INTEGER REFERENCES up_gestaointeligente.cp_subtarefa(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: pelo menos um campo deve estar preenchido
    CONSTRAINT check_at_least_one_field CHECK (
        tarefa_id IS NOT NULL OR
        tarefa_tipo_id IS NOT NULL OR
        produto_id IS NOT NULL OR
        cliente_id IS NOT NULL OR
        subtarefa_id IS NOT NULL
    )
);

COMMENT ON TABLE up_gestaointeligente.vinculados IS 
'Tabela de relacionamentos entre tarefas, produtos, clientes e outros elementos do sistema';
*/

-- =============================================================
-- 2. ADICIONAR COLUNAS SE NÃO EXISTIREM
-- =============================================================

-- Adicionar created_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'up_gestaointeligente' 
        AND table_name = 'vinculados' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE up_gestaointeligente.vinculados 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        COMMENT ON COLUMN up_gestaointeligente.vinculados.created_at IS 
        'Data e hora de criação do registro';
    END IF;
END $$;

-- Adicionar updated_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'up_gestaointeligente' 
        AND table_name = 'vinculados' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE up_gestaointeligente.vinculados 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        COMMENT ON COLUMN up_gestaointeligente.vinculados.updated_at IS 
        'Data e hora da última atualização do registro';
    END IF;
END $$;

-- =============================================================
-- 3. REMOVER ÍNDICE ÚNICO ANTIGO (se existir com nome errado)
-- =============================================================

DROP INDEX IF EXISTS up_gestaointeligente.idx_vinculados_unique;

-- =============================================================
-- 4. CRIAR ÍNDICE ÚNICO CORRETO (incluindo todos os campos)
-- =============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculados_unique 
ON up_gestaointeligente.vinculados (
    COALESCE(tarefa_id::text, 'NULL'),
    COALESCE(tarefa_tipo_id::text, 'NULL'),
    COALESCE(produto_id::text, 'NULL'),
    COALESCE(NULLIF(cliente_id, ''), 'NULL'),
    COALESCE(subtarefa_id::text, 'NULL')
);

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_unique IS 
'Índice único que previne duplicatas considerando TODOS os campos: tarefa_id, tarefa_tipo_id, produto_id, cliente_id e subtarefa_id. NULLs e strings vazias são tratados como valores distintos.';

-- =============================================================
-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- =============================================================

-- Índice para tarefa_id
CREATE INDEX IF NOT EXISTS idx_vinculados_tarefa_id 
ON up_gestaointeligente.vinculados(tarefa_id) 
WHERE tarefa_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_tarefa_id IS 
'Índice para melhorar queries que filtram por tarefa_id';

-- Índice para tarefa_tipo_id
CREATE INDEX IF NOT EXISTS idx_vinculados_tarefa_tipo_id 
ON up_gestaointeligente.vinculados(tarefa_tipo_id) 
WHERE tarefa_tipo_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_tarefa_tipo_id IS 
'Índice para melhorar queries que filtram por tarefa_tipo_id';

-- Índice para produto_id
CREATE INDEX IF NOT EXISTS idx_vinculados_produto_id 
ON up_gestaointeligente.vinculados(produto_id) 
WHERE produto_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_produto_id IS 
'Índice para melhorar queries que filtram por produto_id';

-- Índice para cliente_id
CREATE INDEX IF NOT EXISTS idx_vinculados_cliente_id 
ON up_gestaointeligente.vinculados(cliente_id) 
WHERE cliente_id IS NOT NULL AND cliente_id != '';

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_cliente_id IS 
'Índice para melhorar queries que filtram por cliente_id';

-- Índice para subtarefa_id
CREATE INDEX IF NOT EXISTS idx_vinculados_subtarefa_id 
ON up_gestaointeligente.vinculados(subtarefa_id) 
WHERE subtarefa_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_subtarefa_id IS 
'Índice para melhorar queries que filtram por subtarefa_id';

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_vinculados_produto_cliente 
ON up_gestaointeligente.vinculados(produto_id, cliente_id) 
WHERE produto_id IS NOT NULL AND cliente_id IS NOT NULL AND cliente_id != '';

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_produto_cliente IS 
'Índice composto para queries que filtram por produto e cliente';

CREATE INDEX IF NOT EXISTS idx_vinculados_tarefa_produto 
ON up_gestaointeligente.vinculados(tarefa_id, produto_id) 
WHERE tarefa_id IS NOT NULL AND produto_id IS NOT NULL;

COMMENT ON INDEX up_gestaointeligente.idx_vinculados_tarefa_produto IS 
'Índice composto para queries que filtram por tarefa e produto';

-- =============================================================
-- 6. CRIAR FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- =============================================================

CREATE OR REPLACE FUNCTION up_gestaointeligente.update_vinculados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 7. CRIAR TRIGGER PARA ATUALIZAR updated_at
-- =============================================================

DROP TRIGGER IF EXISTS trigger_update_vinculados_updated_at ON up_gestaointeligente.vinculados;

CREATE TRIGGER trigger_update_vinculados_updated_at
    BEFORE UPDATE ON up_gestaointeligente.vinculados
    FOR EACH ROW
    EXECUTE FUNCTION up_gestaointeligente.update_vinculados_updated_at();

COMMENT ON TRIGGER trigger_update_vinculados_updated_at ON up_gestaointeligente.vinculados IS 
'Trigger que atualiza automaticamente o campo updated_at quando o registro é modificado';

-- =============================================================
-- VERIFICAÇÃO FINAL
-- =============================================================
-- Execute estas queries para verificar se tudo foi criado corretamente:

-- Verificar estrutura da tabela
/*
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
*/

-- Verificar índices criados
/*
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
*/

-- =============================================================

