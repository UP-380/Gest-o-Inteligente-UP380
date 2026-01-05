-- =============================================================
-- Tabela para observações particulares de subtarefas por cliente
-- =============================================================

CREATE TABLE IF NOT EXISTS up_gestaointeligente.cliente_subtarefa_observacao (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  subtarefa_id INTEGER NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint única: um cliente só pode ter uma observação por subtarefa
  CONSTRAINT cliente_subtarefa_observacao_unique UNIQUE (cliente_id, subtarefa_id),
  
  -- Foreign keys (com opção de ON DELETE CASCADE se necessário)
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) 
    REFERENCES up_gestaointeligente.cp_cliente(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_subtarefa FOREIGN KEY (subtarefa_id) 
    REFERENCES up_gestaointeligente.cp_subtarefa(id) 
    ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cliente_subtarefa_observacao_cliente_id 
  ON up_gestaointeligente.cliente_subtarefa_observacao(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_subtarefa_observacao_subtarefa_id 
  ON up_gestaointeligente.cliente_subtarefa_observacao(subtarefa_id);

-- Comentários
COMMENT ON TABLE up_gestaointeligente.cliente_subtarefa_observacao IS 
  'Armazena observações particulares de cada cliente para subtarefas específicas';
COMMENT ON COLUMN up_gestaointeligente.cliente_subtarefa_observacao.cliente_id IS 
  'ID do cliente (cp_cliente.id)';
COMMENT ON COLUMN up_gestaointeligente.cliente_subtarefa_observacao.subtarefa_id IS 
  'ID da subtarefa (cp_subtarefa.id)';
COMMENT ON COLUMN up_gestaointeligente.cliente_subtarefa_observacao.observacao IS 
  'Observação/descrição particular do cliente para esta subtarefa (suporta HTML)';

