-- REMOVE a restrição de chave primária composta que impede duplicatas
-- Isso permitirá que o sistema crie registros de contas bancárias idênticos (clonagem perfeita)
-- Certifique-se de estar conectado ao banco de dados correto e no esquema "up_gestaointeligente" (ou public, dependendo da sua configuração)

-- 1. Tentar remover a constraint pelo nome conhecido (pode variar se foi criada automaticamente)
ALTER TABLE IF EXISTS cliente_conta_bancaria DROP CONSTRAINT IF EXISTS cliente_conta_bancaria_pkey;
ALTER TABLE IF EXISTS up_gestaointeligente.cliente_conta_bancaria DROP CONSTRAINT IF EXISTS cliente_conta_bancaria_pkey;

-- 2. Garantir que o ID seja a chave primária única (isso já deve ser verdade, mas reforça)
-- Se o ID já for PK, este comando pode falhar ou não fazer nada, o que é esperado.
ALTER TABLE IF EXISTS cliente_conta_bancaria ADD PRIMARY KEY (id);
ALTER TABLE IF EXISTS up_gestaointeligente.cliente_conta_bancaria ADD PRIMARY KEY (id);

-- 3. (Opcional) Se houver outra constraint unique composta, remova-a também.
-- Verifique indices únicos:
-- DROP INDEX IF EXISTS idx_cliente_conta_bancaria_unique; 
