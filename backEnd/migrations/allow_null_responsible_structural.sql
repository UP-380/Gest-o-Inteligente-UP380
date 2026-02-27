-- Migration to allow NULL responsavel_id and consolidate schema for Structural Estimation
-- Target Schema: up_gestaointeligente_dev (or up_gestaointeligente)

-- 1. Table: tempo_estimado_regra
ALTER TABLE up_gestaointeligente_dev.tempo_estimado_regra 
ALTER COLUMN responsavel_id DROP NOT NULL;

-- 2. Table: historico_atribuicoes
ALTER TABLE up_gestaointeligente_dev.historico_atribuicoes 
ALTER COLUMN responsavel_id DROP NOT NULL;

-- 3. Add column to track if it's a structural estimation (optional, but helps)
-- We can just rely on responsavel_id IS NULL

-- 4. Update comments
COMMENT ON COLUMN up_gestaointeligente_dev.tempo_estimado_regra.responsavel_id IS 'ID do responsável (opcional). Se NULL, é uma estimativa estrutural do cliente.';
COMMENT ON COLUMN up_gestaointeligente_dev.historico_atribuicoes.responsavel_id IS 'ID do responsável (opcional).';
