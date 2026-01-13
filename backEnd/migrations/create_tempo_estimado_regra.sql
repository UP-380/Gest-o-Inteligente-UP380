-- =============================================================
-- === CRIAÇÃO DA TABELA DE REGRAS DE TEMPO ESTIMADO ===
-- === Otimização: Armazena regras ao invés de registros diários ===
-- =============================================================
-- Schema: up_gestaointeligente
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

-- =============================================================
-- TABELA: tempo_estimado_regra
-- =============================================================
CREATE TABLE IF NOT EXISTS up_gestaointeligente.tempo_estimado_regra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agrupador_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL,
    produto_id INTEGER,
    tarefa_id INTEGER NOT NULL,
    responsavel_id INTEGER NOT NULL,
    tipo_tarefa_id TEXT,
    
    -- Período da regra
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    
    -- Configurações
    tempo_estimado_dia INTEGER NOT NULL, -- em milissegundos
    incluir_finais_semana BOOLEAN DEFAULT true,
    incluir_feriados BOOLEAN DEFAULT true,
    
    -- Metadados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- membro_id do criador
    
    -- Constraints
    CONSTRAINT chk_periodo_valido CHECK (data_fim >= data_inicio),
    CONSTRAINT chk_tempo_positivo CHECK (tempo_estimado_dia > 0)
);

-- Comentários na tabela
COMMENT ON TABLE up_gestaointeligente.tempo_estimado_regra IS 
'Tabela de regras de tempo estimado. Armazena configurações de período e calcula registros diários dinamicamente.';

COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.agrupador_id IS 'ID do agrupamento (mesmo da tabela tempo_estimado antiga)';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.data_inicio IS 'Data inicial do período da regra';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.data_fim IS 'Data final do período da regra';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.tempo_estimado_dia IS 'Tempo estimado por dia útil (em milissegundos)';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.incluir_finais_semana IS 'Se true, inclui sábados e domingos no cálculo';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.incluir_feriados IS 'Se true, inclui feriados no cálculo';

-- =============================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE CONSULTAS
-- =============================================================

-- Índice para buscar por agrupador
CREATE INDEX IF NOT EXISTS idx_regra_agrupador 
ON up_gestaointeligente.tempo_estimado_regra(agrupador_id);

-- Índice para buscar por responsável
CREATE INDEX IF NOT EXISTS idx_regra_responsavel 
ON up_gestaointeligente.tempo_estimado_regra(responsavel_id);

-- Índice para buscar por cliente
CREATE INDEX IF NOT EXISTS idx_regra_cliente 
ON up_gestaointeligente.tempo_estimado_regra(cliente_id);

-- Índice para buscar por período (otimiza filtros de data)
CREATE INDEX IF NOT EXISTS idx_regra_periodo 
ON up_gestaointeligente.tempo_estimado_regra(data_inicio, data_fim);

-- Índice para buscar por tarefa
CREATE INDEX IF NOT EXISTS idx_regra_tarefa 
ON up_gestaointeligente.tempo_estimado_regra(tarefa_id);

-- Índice composto para filtros comuns (cliente + responsável + período)
CREATE INDEX IF NOT EXISTS idx_regra_cliente_responsavel_periodo 
ON up_gestaointeligente.tempo_estimado_regra(cliente_id, responsavel_id, data_inicio, data_fim);

-- Índice composto para busca por produto e tarefa
CREATE INDEX IF NOT EXISTS idx_regra_produto_tarefa 
ON up_gestaointeligente.tempo_estimado_regra(produto_id, tarefa_id) 
WHERE produto_id IS NOT NULL;

-- =============================================================
-- TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- =============================================================
CREATE OR REPLACE FUNCTION up_gestaointeligente.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tempo_estimado_regra_updated_at
    BEFORE UPDATE ON up_gestaointeligente.tempo_estimado_regra
    FOR EACH ROW
    EXECUTE FUNCTION up_gestaointeligente.update_updated_at_column();

