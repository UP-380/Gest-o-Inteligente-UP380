-- Adicionar campo horas_variaveis na tabela config_custo_membro
-- Este campo indica se as horas são variáveis (boolean)

ALTER TABLE up_gestaointeligente.config_custo_membro
ADD COLUMN horas_variaveis BOOLEAN NULL DEFAULT false;

-- Adicionar comentário na coluna
COMMENT ON COLUMN up_gestaointeligente.config_custo_membro.horas_variaveis IS 'Indica se as horas são variáveis (true) ou fixas (false)';

