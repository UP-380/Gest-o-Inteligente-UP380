-- Migration to update schema for Plug Rapido Audit and Locking

-- 1. Add Original Intent columns to atribuicoes_pendentes for Audit (Ticket 1)
ALTER TABLE up_gestaointeligente.atribuicoes_pendentes 
ADD COLUMN IF NOT EXISTS cliente_id_original text,
ADD COLUMN IF NOT EXISTS produto_id_original text, -- or bigint depending on schema (using text to be safe/general)
ADD COLUMN IF NOT EXISTS tarefa_id_original integer; -- or text

-- 2. Add 'bloqueado' column to registro_tempo for Immutability (Ticket 2)
ALTER TABLE up_gestaointeligente.registro_tempo
ADD COLUMN IF NOT EXISTS bloqueado boolean DEFAULT false;

-- 3. Documentation of "Missing FKs" (Ticket 4)
-- This is a comment block describing the relationships.
/*
  DOCUMENTAÇÃO DE RELACIONAMENTOS (PLUG RÁPIDO):
  
  As tabelas 'atribuicoes_pendentes' e 'registro_tempo_pendente' foram desenhadas
  intencionalmente sem Foreign Keys (FK) rígidas para permitir flexibilidade
  durante a fase de prototipagem e desacoplamento inicial.
  
  Relações Lógicas:
  - atribuicoes_pendentes.usuario_id -> usuarios.id
  - atribuicoes_pendentes.cliente_id -> cp_cliente.id
  - atribuicoes_pendentes.produto_id -> cp_produto.id (ou estrutura similar)
  - atribuicoes_pendentes.tarefa_id -> tarefa.id
  
  Futuramente, recomenda-se criar FKs reais para garantir integridade referencial
  após a estabilização do módulo.
*/
