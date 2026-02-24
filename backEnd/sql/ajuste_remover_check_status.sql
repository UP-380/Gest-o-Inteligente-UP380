-- ==========================================================
-- SCRIPT DE AJUSTE: Remover Check Constraint de Status
-- Isso permite o uso de status personalizados criados dinamicamente
-- ==========================================================

-- 1. Banco de Produção
ALTER TABLE up_gestaointeligente.tempo_estimado_status 
DROP CONSTRAINT IF EXISTS tempo_estimado_status_status_check;

-- 2. Banco de Desenvolvimento (Se existir)
ALTER TABLE up_gestaointeligente_dev.tempo_estimado_status 
DROP CONSTRAINT IF EXISTS tempo_estimado_status_status_check;
