-- Adicionar campo tipo_contrato na tabela config_custo_membro
-- Este campo referencia cp_tipo_contrato_membro.id

ALTER TABLE up_gestaointeligente.config_custo_membro
ADD COLUMN tipo_contrato INTEGER NULL;

-- Adicionar comentário na coluna
COMMENT ON COLUMN up_gestaointeligente.config_custo_membro.tipo_contrato IS 'Referência ao tipo de contrato (cp_tipo_contrato_membro.id)';

-- Opcional: Adicionar foreign key constraint (se necessário)
-- ALTER TABLE up_gestaointeligente.config_custo_membro
-- ADD CONSTRAINT fk_config_custo_membro_tipo_contrato 
-- FOREIGN KEY (tipo_contrato) 
-- REFERENCES up_gestaointeligente.cp_tipo_contrato_membro(id);

