-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- Lista as colunas de cada tabela no schema up_gestaointeligente.

SELECT
  table_name AS tabela,
  column_name AS coluna,
  data_type AS tipo,
  is_nullable AS nullable
FROM information_schema.columns
WHERE table_schema = 'up_gestaointeligente'
  AND table_name IN (
    'membro',
    'registro_tempo',
    'custo_membro_vigencia',
    'tempo_estimado_regra',
    'cp_cliente',
    'cp_produto',
    'cp_tarefa_tipo',
    'cp_tarefa',
    'cp_tipo_contrato_membro'
  )
ORDER BY table_name, ordinal_position;
