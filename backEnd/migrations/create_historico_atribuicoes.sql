-- Tabela para armazenar histórico de atribuições
CREATE TABLE IF NOT EXISTS up_gestaointeligente.historico_atribuicoes (
  id BIGSERIAL PRIMARY KEY,
  agrupador_id VARCHAR(255) NOT NULL, -- UUID do agrupador
  cliente_id TEXT NOT NULL,
  responsavel_id BIGINT NOT NULL,
  usuario_criador_id BIGINT NOT NULL, -- Usuário que fez a atribuição
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  produto_ids BIGINT[] NOT NULL, -- Array de IDs dos produtos
  tarefas JSONB NOT NULL, -- Array de objetos {tarefa_id, tempo_estimado_dia}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) 
    REFERENCES up_gestaointeligente.cp_cliente(id) ON DELETE CASCADE,
  CONSTRAINT fk_responsavel FOREIGN KEY (responsavel_id) 
    REFERENCES up_gestaointeligente.membro(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_criador FOREIGN KEY (usuario_criador_id) 
    REFERENCES up_gestaointeligente.membro(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_historico_atribuicoes_cliente ON up_gestaointeligente.historico_atribuicoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historico_atribuicoes_responsavel ON up_gestaointeligente.historico_atribuicoes(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_historico_atribuicoes_usuario_criador ON up_gestaointeligente.historico_atribuicoes(usuario_criador_id);
CREATE INDEX IF NOT EXISTS idx_historico_atribuicoes_agrupador ON up_gestaointeligente.historico_atribuicoes(agrupador_id);
CREATE INDEX IF NOT EXISTS idx_historico_atribuicoes_created_at ON up_gestaointeligente.historico_atribuicoes(created_at DESC);

-- Comentários nas colunas
COMMENT ON TABLE up_gestaointeligente.historico_atribuicoes IS 'Histórico de todas as atribuições de tarefas realizadas no sistema';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.agrupador_id IS 'ID do agrupador de tempo estimado criado';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.cliente_id IS 'ID do cliente da atribuição';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.responsavel_id IS 'ID do colaborador responsável pela atribuição';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.usuario_criador_id IS 'ID do usuário que criou a atribuição';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.produto_ids IS 'Array com IDs dos produtos incluídos na atribuição';
COMMENT ON COLUMN up_gestaointeligente.historico_atribuicoes.tarefas IS 'JSON com array de tarefas: [{"tarefa_id": 1, "tempo_estimado_dia": 3600000}]';

