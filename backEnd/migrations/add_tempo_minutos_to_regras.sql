-- Migration to add tempo_minutos to tempo_estimado_regra
-- Date: 2026-02-26

ALTER TABLE up_gestaointeligente.tempo_estimado_regra 
ADD COLUMN IF NOT EXISTS tempo_minutos INTEGER;

-- Populate tempo_minutos from tempo_estimado_dia (ms to minutes)
UPDATE up_gestaointeligente.tempo_estimado_regra 
SET tempo_minutos = FLOOR(tempo_estimado_dia / 60000)
WHERE tempo_minutos IS NULL;

-- Make it NOT NULL after population if desired, but for safely just leave it or use a default
-- ALTER TABLE up_gestaointeligente.tempo_estimado_regra ALTER COLUMN tempo_minutos SET NOT NULL;
