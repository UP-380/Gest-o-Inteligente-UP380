-- =============================================================
-- Tabela: tempo_estimado_status
-- Criado para os schemas: up_gestaointeligente e up_gestaointeligente_dev
-- =============================================================

-- =============================================================
-- 1. SCHEMA: up_gestaointeligente
-- =============================================================

CREATE TABLE IF NOT EXISTS up_gestaointeligente.tempo_estimado_status (
    id BIGSERIAL PRIMARY KEY,
    regra_id UUID NOT NULL,
    data DATE NOT NULL,
    responsavel_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NAO_INICIADA' CHECK (status IN ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'PAUSADA')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tempo_estimado_status_unique 
ON up_gestaointeligente.tempo_estimado_status (regra_id, data, responsavel_id);

CREATE INDEX IF NOT EXISTS idx_tempo_estimado_status_regra_id 
ON up_gestaointeligente.tempo_estimado_status (regra_id);

CREATE INDEX IF NOT EXISTS idx_tempo_estimado_status_resp_data 
ON up_gestaointeligente.tempo_estimado_status (responsavel_id, data);

ALTER TABLE up_gestaointeligente.tempo_estimado_status ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem para evitar erro 42710
DROP POLICY IF EXISTS "Service role full access on tempo_estimado_status" ON up_gestaointeligente.tempo_estimado_status;
DROP POLICY IF EXISTS "Authenticated users can manage tempo_estimado_status" ON up_gestaointeligente.tempo_estimado_status;

CREATE POLICY "Service role full access on tempo_estimado_status"
ON up_gestaointeligente.tempo_estimado_status FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tempo_estimado_status"
ON up_gestaointeligente.tempo_estimado_status FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================
-- 2. SCHEMA: up_gestaointeligente_dev
-- =============================================================

CREATE TABLE IF NOT EXISTS up_gestaointeligente_dev.tempo_estimado_status (
    id BIGSERIAL PRIMARY KEY,
    regra_id UUID NOT NULL,
    data DATE NOT NULL,
    responsavel_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NAO_INICIADA' CHECK (status IN ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'PAUSADA')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tempo_estimado_status_unique_dev
ON up_gestaointeligente_dev.tempo_estimado_status (regra_id, data, responsavel_id);

CREATE INDEX IF NOT EXISTS idx_tempo_estimado_status_regra_id_dev
ON up_gestaointeligente_dev.tempo_estimado_status (regra_id);

CREATE INDEX IF NOT EXISTS idx_tempo_estimado_status_resp_data_dev
ON up_gestaointeligente_dev.tempo_estimado_status (responsavel_id, data);

ALTER TABLE up_gestaointeligente_dev.tempo_estimado_status ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem para evitar erro 42710
DROP POLICY IF EXISTS "Service role full access on tempo_estimado_status" ON up_gestaointeligente_dev.tempo_estimado_status;
DROP POLICY IF EXISTS "Authenticated users can manage tempo_estimado_status" ON up_gestaointeligente_dev.tempo_estimado_status;

CREATE POLICY "Service role full access on tempo_estimado_status"
ON up_gestaointeligente_dev.tempo_estimado_status FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tempo_estimado_status"
ON up_gestaointeligente_dev.tempo_estimado_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
