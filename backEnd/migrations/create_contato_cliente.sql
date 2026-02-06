-- =============================================================
-- === CRIAÇÃO DE TABELAS PARA CONTATO CLIENTE ===
-- =============================================================
-- Schema: up_gestaointeligente
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

-- =============================================================
-- 1. TABELA PRINCIPAL: cp_contato
-- =============================================================
CREATE TABLE IF NOT EXISTS up_gestaointeligente.cp_contato (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    cargo TEXT,
    departamento TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    permite_envio_documentos BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários na tabela
COMMENT ON TABLE up_gestaointeligente.cp_contato IS 
'Tabela principal de contatos (pessoas que trabalham nas empresas clientes)';

COMMENT ON COLUMN up_gestaointeligente.cp_contato.nome IS 'Nome completo do contato';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.email IS 'E-mail do contato';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.telefone IS 'Telefone do contato';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.cargo IS 'Cargo/função do contato na empresa';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.departamento IS 'Departamento do contato';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.observacoes IS 'Observações gerais sobre o contato';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.ativo IS 'Indica se o contato está ativo';
COMMENT ON COLUMN up_gestaointeligente.cp_contato.permite_envio_documentos IS 'Indica se este contato pode receber documentos do sistema';

-- Índices
CREATE INDEX IF NOT EXISTS idx_cp_contato_email ON up_gestaointeligente.cp_contato(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_contato_ativo ON up_gestaointeligente.cp_contato(ativo);
CREATE INDEX IF NOT EXISTS idx_cp_contato_nome ON up_gestaointeligente.cp_contato(nome);

-- =============================================================
-- 2. TABELA DE VINCULAÇÃO: cliente_contato
-- =============================================================
CREATE TABLE IF NOT EXISTS up_gestaointeligente.cliente_contato (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT NOT NULL REFERENCES up_gestaointeligente.cp_cliente(id) ON DELETE CASCADE,
    contato_id UUID NOT NULL REFERENCES up_gestaointeligente.cp_contato(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: evitar duplicatas
    CONSTRAINT unique_cliente_contato UNIQUE (cliente_id, contato_id)
);

-- Comentários na tabela
COMMENT ON TABLE up_gestaointeligente.cliente_contato IS 
'Tabela de vinculação muitos-para-muitos entre clientes e contatos';

COMMENT ON COLUMN up_gestaointeligente.cliente_contato.cliente_id IS 'ID do cliente (UUID como TEXT)';
COMMENT ON COLUMN up_gestaointeligente.cliente_contato.contato_id IS 'ID do contato (UUID)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_cliente_contato_cliente_id ON up_gestaointeligente.cliente_contato(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_contato_contato_id ON up_gestaointeligente.cliente_contato(contato_id);

-- =============================================================
-- 3. TRIGGER PARA ATUALIZAR updated_at
-- =============================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION up_gestaointeligente.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para cp_contato
DROP TRIGGER IF EXISTS update_cp_contato_updated_at ON up_gestaointeligente.cp_contato;
CREATE TRIGGER update_cp_contato_updated_at
    BEFORE UPDATE ON up_gestaointeligente.cp_contato
    FOR EACH ROW
    EXECUTE FUNCTION up_gestaointeligente.update_updated_at_column();

-- Triggers para cliente_contato
DROP TRIGGER IF EXISTS update_cliente_contato_updated_at ON up_gestaointeligente.cliente_contato;
CREATE TRIGGER update_cliente_contato_updated_at
    BEFORE UPDATE ON up_gestaointeligente.cliente_contato
    FOR EACH ROW
    EXECUTE FUNCTION up_gestaointeligente.update_updated_at_column();

-- =============================================================
-- 4. VIEW PARA FACILITAR CONSULTAS
-- =============================================================
CREATE OR REPLACE VIEW up_gestaointeligente.v_contato_cliente AS
SELECT 
    cc.id as vinculacao_id,
    cc.cliente_id,
    cc.contato_id,
    cc.created_at as vinculacao_created_at,
    c.id as contato_id_full,
    c.nome as contato_nome,
    c.email as contato_email,
    c.telefone as contato_telefone,
    c.cargo as contato_cargo,
    c.departamento as contato_departamento,
    c.observacoes as contato_observacoes,
    c.ativo as contato_ativo,
    c.permite_envio_documentos as contato_permite_envio_documentos,
    cli.id as cliente_id_full,
    cli.nome as cliente_nome,
    cli.razao_social as cliente_razao_social
FROM up_gestaointeligente.cliente_contato cc
INNER JOIN up_gestaointeligente.cp_contato c ON cc.contato_id = c.id
INNER JOIN up_gestaointeligente.cp_cliente cli ON cc.cliente_id = cli.id;

COMMENT ON VIEW up_gestaointeligente.v_contato_cliente IS 
'View que une dados de contatos com seus clientes vinculados';

-- =============================================================
-- FIM DO SCRIPT
-- =============================================================




