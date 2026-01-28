-- Remover campo insspatronal da tabela custo_membro_vigencia
-- Este campo não será mais utilizado

ALTER TABLE up_gestaointeligente.custo_membro_vigencia
DROP COLUMN IF EXISTS insspatronal;

