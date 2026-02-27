-- Alterar colunas de ID para BIGINT para suportar IDs longos (como CPFs ou IDs de colaboradores)
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE up_gestaointeligente.tempo_estimado_regra 
ALTER COLUMN responsavel_id TYPE BIGINT,
ALTER COLUMN produto_id TYPE BIGINT,
ALTER COLUMN tarefa_id TYPE BIGINT,
ALTER COLUMN created_by TYPE BIGINT;

COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.responsavel_id IS 'ID do colaborador responsável (membro.id) - BIGINT para suportar IDs longos';
COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.created_by IS 'membro_id do criador - BIGINT para suportar IDs longos';
