-- =============================================================
-- Script SQL para adicionar campo foto_perfil na tabela cp_cliente
-- =============================================================
-- Este script adiciona o campo foto_perfil na tabela cp_cliente
-- seguindo o mesmo padrão usado na tabela usuarios
-- =============================================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    -- Verificar se a coluna foto_perfil já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'up_gestaointeligente' 
        AND table_name = 'cp_cliente' 
        AND column_name = 'foto_perfil'
    ) THEN
        -- Adicionar coluna foto_perfil
        ALTER TABLE up_gestaointeligente.cp_cliente
        ADD COLUMN foto_perfil TEXT;
        
        -- Adicionar comentário na coluna para documentação
        COMMENT ON COLUMN up_gestaointeligente.cp_cliente.foto_perfil IS 
        'Foto de perfil do cliente. Pode ser um ID de avatar padrão (ex: "image-1", "color-1") ou um ID customizado (ex: "custom-{clienteId}")';
        
        RAISE NOTICE 'Coluna foto_perfil adicionada com sucesso na tabela cp_cliente';
    ELSE
        RAISE NOTICE 'Coluna foto_perfil já existe na tabela cp_cliente';
    END IF;
END $$;

-- Verificar se a coluna foi criada corretamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'up_gestaointeligente'
    AND table_name = 'cp_cliente'
    AND column_name = 'foto_perfil';

