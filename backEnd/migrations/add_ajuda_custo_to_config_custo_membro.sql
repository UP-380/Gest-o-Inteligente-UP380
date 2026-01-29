-- Adicionar campo ajuda_custo na tabela config_custo_membro
-- Este campo armazena o valor da ajuda de custo por dia (em reais)

ALTER TABLE up_gestaointeligente.config_custo_membro
ADD COLUMN ajuda_custo NUMERIC(10, 2) NULL;

-- Adicionar comentário na coluna
COMMENT ON COLUMN up_gestaointeligente.config_custo_membro.ajuda_custo IS 'Valor da ajuda de custo por dia (em reais)';

