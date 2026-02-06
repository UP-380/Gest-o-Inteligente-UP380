-- Migration: Remover restrição UNIQUE de cliente_id + adquirente_id em cliente_adquirente
-- Permite cadastrar múltiplos acessos ao mesmo adquirente para o mesmo cliente
-- (ex.: estabelecimentos ou credenciais diferentes)
-- Schema: up_gestaointeligente

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'up_gestaointeligente'
      AND t.relname = 'cliente_adquirente'
      AND c.contype = 'u'
  ) LOOP
    EXECUTE format('ALTER TABLE up_gestaointeligente.cliente_adquirente DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Constraint % removida da tabela cliente_adquirente.', r.conname;
  END LOOP;
END $$;
