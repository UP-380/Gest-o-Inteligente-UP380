-- =============================================================
-- === CRIAÇÃO DA TABELA DE CONFIGURAÇÕES DE PERMISSÕES ===
-- =============================================================

-- Criar tabela para armazenar configurações de permissões por nível
CREATE TABLE IF NOT EXISTS up_gestaointeligente.permissoes_config (
    id SERIAL PRIMARY KEY,
    nivel VARCHAR(50) NOT NULL UNIQUE,
    paginas TEXT, -- JSON array de páginas permitidas, ou NULL para todas
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice para busca rápida por nível
CREATE INDEX IF NOT EXISTS idx_permissoes_config_nivel 
ON up_gestaointeligente.permissoes_config(nivel);

-- Inserir configurações padrão
INSERT INTO up_gestaointeligente.permissoes_config (nivel, paginas)
VALUES 
    ('gestor', NULL), -- NULL = todas as páginas
    ('colaborador', '["/painel-colaborador", "/base-conhecimento/conteudos-clientes", "/base-conhecimento/cliente"]')
ON CONFLICT (nivel) DO NOTHING;

-- Comentários
COMMENT ON TABLE up_gestaointeligente.permissoes_config IS 'Configurações de permissões por nível de acesso';
COMMENT ON COLUMN up_gestaointeligente.permissoes_config.nivel IS 'Nível de permissão: gestor ou colaborador';
COMMENT ON COLUMN up_gestaointeligente.permissoes_config.paginas IS 'JSON array com rotas permitidas. NULL = todas as páginas';




