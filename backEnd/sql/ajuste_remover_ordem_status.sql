-- ==========================================================
-- SCRIPT DE AJUSTE: Remover Colunas Desnecessárias
-- Remove 'ordem' e 'ativo' (removidos da UI)
-- ==========================================================

-- 1. Banco de Produção
ALTER TABLE up_gestaointeligente.tempo_estimado_config_status 
DROP COLUMN IF EXISTS ordem,
DROP COLUMN IF EXISTS ativo;

-- 2. Banco de Desenvolvimento
ALTER TABLE up_gestaointeligente_dev.tempo_estimado_config_status 
DROP COLUMN IF EXISTS ordem,
DROP COLUMN IF EXISTS ativo;
