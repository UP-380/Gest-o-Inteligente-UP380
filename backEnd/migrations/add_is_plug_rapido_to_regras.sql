-- Adiciona coluna para identificar tarefas vindas do Plug Rápido
ALTER TABLE up_gestaointeligente.tempo_estimado_regra 
ADD COLUMN IF NOT EXISTS is_plug_rapido BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN up_gestaointeligente.tempo_estimado_regra.is_plug_rapido IS 'Indica se a regra foi criada via aprovação de Plug Rápido';
