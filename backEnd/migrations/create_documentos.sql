-- =============================================================
-- === CRIAÇÃO DE TABELAS PARA GED (GERENCIAMENTO ELETRÔNICO DE DOCUMENTOS) ===
-- =============================================================
-- Schema: up_gestaointeligente
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

-- =============================================================
-- 1. ENUM PARA TIPOS DE DOCUMENTO
-- =============================================================
CREATE TYPE up_gestaointeligente.tipo_documento_enum AS ENUM (
    'certificado_digital',
    'contrato',
    'proposta',
    'ata_reuniao',
    'outros'
);

-- =============================================================
-- 2. TABELA PRINCIPAL: cp_documento
-- =============================================================
CREATE TABLE IF NOT EXISTS up_gestaointeligente.cp_documento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT NOT NULL REFERENCES up_gestaointeligente.cp_cliente(id) ON DELETE CASCADE,
    tipo_documento up_gestaointeligente.tipo_documento_enum NOT NULL,
    nome_arquivo TEXT NOT NULL,
    nome_exibicao TEXT NOT NULL,
    descricao TEXT,
    tamanho_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    caminho_storage TEXT NOT NULL,
    obrigatorio BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by BIGINT REFERENCES up_gestaointeligente.membro(id) ON DELETE SET NULL
);

-- Comentários na tabela
COMMENT ON TABLE up_gestaointeligente.cp_documento IS 
'Tabela principal de documentos vinculados a clientes';

COMMENT ON COLUMN up_gestaointeligente.cp_documento.cliente_id IS 'ID do cliente proprietário do documento';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.tipo_documento IS 'Tipo/categoria do documento';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.nome_arquivo IS 'Nome original do arquivo';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.nome_exibicao IS 'Nome para exibição (pode ser diferente do nome do arquivo)';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.descricao IS 'Descrição opcional do documento';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.tamanho_bytes IS 'Tamanho do arquivo em bytes';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.mime_type IS 'Tipo MIME do arquivo (ex: application/pdf)';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.caminho_storage IS 'Caminho do arquivo no Supabase Storage';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.obrigatorio IS 'Indica se o documento é obrigatório para o cliente';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.ativo IS 'Indica se o documento está ativo (soft delete)';
COMMENT ON COLUMN up_gestaointeligente.cp_documento.created_by IS 'ID do usuário que criou o documento';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cp_documento_cliente_id ON up_gestaointeligente.cp_documento(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cp_documento_tipo ON up_gestaointeligente.cp_documento(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_cp_documento_ativo ON up_gestaointeligente.cp_documento(ativo);
CREATE INDEX IF NOT EXISTS idx_cp_documento_obrigatorio ON up_gestaointeligente.cp_documento(obrigatorio);
CREATE INDEX IF NOT EXISTS idx_cp_documento_created_at ON up_gestaointeligente.cp_documento(created_at DESC);

-- Índice composto para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_cp_documento_cliente_tipo_ativo 
    ON up_gestaointeligente.cp_documento(cliente_id, tipo_documento, ativo) 
    WHERE ativo = true;

-- Constraint: Garantir que documentos obrigatórios sejam únicos por tipo e cliente
-- (apenas 1 certificado digital, 1 contrato, 1 proposta por cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_documento_obrigatorio_unico 
    ON up_gestaointeligente.cp_documento(cliente_id, tipo_documento) 
    WHERE obrigatorio = true AND ativo = true 
    AND tipo_documento IN ('certificado_digital', 'contrato', 'proposta');

-- =============================================================
-- 3. TRIGGER PARA ATUALIZAR updated_at
-- =============================================================

-- Função para atualizar updated_at (reutilizar se já existir)
CREATE OR REPLACE FUNCTION up_gestaointeligente.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cp_documento
DROP TRIGGER IF EXISTS trigger_update_cp_documento_updated_at ON up_gestaointeligente.cp_documento;
CREATE TRIGGER trigger_update_cp_documento_updated_at
    BEFORE UPDATE ON up_gestaointeligente.cp_documento
    FOR EACH ROW
    EXECUTE FUNCTION up_gestaointeligente.update_updated_at_column();

-- =============================================================
-- 4. FUNÇÃO PARA VALIDAR DOCUMENTOS OBRIGATÓRIOS
-- =============================================================
CREATE OR REPLACE FUNCTION up_gestaointeligente.validar_documentos_obrigatorios(p_cliente_id TEXT)
RETURNS TABLE (
    tipo_documento up_gestaointeligente.tipo_documento_enum,
    possui_documento BOOLEAN,
    documento_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tipo::up_gestaointeligente.tipo_documento_enum,
        EXISTS(
            SELECT 1 
            FROM up_gestaointeligente.cp_documento d
            WHERE d.cliente_id = p_cliente_id
            AND d.tipo_documento = tipo::up_gestaointeligente.tipo_documento_enum
            AND d.obrigatorio = true
            AND d.ativo = true
        ) as possui_documento,
        (
            SELECT d.id
            FROM up_gestaointeligente.cp_documento d
            WHERE d.cliente_id = p_cliente_id
            AND d.tipo_documento = tipo::up_gestaointeligente.tipo_documento_enum
            AND d.obrigatorio = true
            AND d.ativo = true
            LIMIT 1
        ) as documento_id
    FROM unnest(ARRAY['certificado_digital', 'contrato', 'proposta']::text[]) as tipo;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION up_gestaointeligente.validar_documentos_obrigatorios IS 
'Valida se um cliente possui todos os documentos obrigatórios (certificado digital, contrato, proposta)';
