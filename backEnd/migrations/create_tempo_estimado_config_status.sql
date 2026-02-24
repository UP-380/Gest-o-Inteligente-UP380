-- ==========================================================
-- 1. SCHEMA DE PRODUÇÃO (up_gestaointeligente)
-- ==========================================================

-- Criar tabela de configuração de status
CREATE TABLE IF NOT EXISTS up_gestaointeligente.tempo_estimado_config_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(50) UNIQUE NOT NULL, -- Identificador (ex: 'NAO_INICIADA')
    nome VARCHAR(100) NOT NULL,        -- Nome exibido (ex: 'Não Iniciada')
    cor_texto VARCHAR(20),             -- Cor do ícone/texto (ex: '#6b7280')
    cor_fundo VARCHAR(20),             -- Cor de fundo (ex: '#f3f4f6')
    cor_borda VARCHAR(20),             -- Cor da borda (ex: '#d1d5db')
    icone VARCHAR(100) NOT NULL,       -- Classe FontAwesome (ex: 'fa-circle')
    ordem INTEGER DEFAULT 0,           -- Ordem de exibição no menu
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Inserir os status padrão (Ignora se já existirem)
INSERT INTO up_gestaointeligente.tempo_estimado_config_status (chave, nome, cor_texto, cor_fundo, cor_borda, icone, ordem)
VALUES 
('NAO_INICIADA', 'Não Iniciada', '#6b7280', '#f3f4f6', '#d1d5db', 'fa-circle', 10),
('EM_ANDAMENTO', 'Em Andamento', '#2563eb', '#eff6ff', '#93c5fd', 'fa-spinner', 20),
('PAUSADA', 'Pausada', '#d97706', '#fffbeb', '#fcd34d', 'fa-pause-circle', 30),
('CONCLUIDA', 'Concluída', '#059669', '#ecfdf5', '#a7f3d0', 'fa-check-circle', 40),
('AGUARDANDO_APROVACAO', 'Aguardando', '#7c3aed', '#f5f3ff', '#c4b5fd', 'fa-hourglass-half', 50)
ON CONFLICT (chave) DO NOTHING;

-- ==========================================================
-- 2. SCHEMA DE DESENVOLVIMENTO (up_gestaointeligente_dev)
-- ==========================================================

-- Criar tabela de configuração de status (DEV)
CREATE TABLE IF NOT EXISTS up_gestaointeligente_dev.tempo_estimado_config_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cor_texto VARCHAR(20),
    cor_fundo VARCHAR(20),
    cor_borda VARCHAR(20),
    icone VARCHAR(100) NOT NULL,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Inserir os status padrão (DEV)
INSERT INTO up_gestaointeligente_dev.tempo_estimado_config_status (chave, nome, cor_texto, cor_fundo, cor_borda, icone, ordem)
VALUES 
('NAO_INICIADA', 'Não Iniciada', '#6b7280', '#f3f4f6', '#d1d5db', 'fa-circle', 10),
('EM_ANDAMENTO', 'Em Andamento', '#2563eb', '#eff6ff', '#93c5fd', 'fa-spinner', 20),
('PAUSADA', 'Pausada', '#d97706', '#fffbeb', '#fcd34d', 'fa-pause-circle', 30),
('CONCLUIDA', 'Concluída', '#059669', '#ecfdf5', '#a7f3d0', 'fa-check-circle', 40),
('AGUARDANDO_APROVACAO', 'Aguardando', '#7c3aed', '#f5f3ff', '#c4b5fd', 'fa-hourglass-half', 50)
ON CONFLICT (chave) DO NOTHING;
