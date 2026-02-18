/**
 * Script para verificar colunas das tabelas no Supabase.
 * Uso: cd backend_js && bun run scripts/verificar-colunas-supabase.ts
 * Carrega .env automaticamente (Bun carrega .env ao rodar).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_ANON_KEY) no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const schema = 'up_gestaointeligente';

async function verificarTabela(nomeTabela: string) {
  console.log(`\n--- Tabela: ${schema}.${nomeTabela} ---`);
  const { data, error } = await supabase
    .schema(schema)
    .from(nomeTabela)
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro:', error.message);
    console.error('Código:', error.code);
    return;
  }
  if (data && data[0]) {
    const colunas = Object.keys(data[0]);
    console.log('Colunas encontradas:', colunas.join(', '));
  } else {
    console.log('Tabela vazia ou sem registros. Tentando apenas listar colunas via 1 row vazio...');
    const { error: err2 } = await supabase.schema(schema).from(nomeTabela).select('*').limit(0);
    if (err2) console.error('Erro ao acessar tabela:', err2.message);
  }
}

async function main() {
  console.log('Verificando colunas no Supabase (schema:', schema, ')...');
  await verificarTabela('membro');
  await verificarTabela('registro_tempo');
  await verificarTabela('custo_membro_vigencia');
  await verificarTabela('cp_cliente');
  await verificarTabela('cp_produto');
  await verificarTabela('cp_tarefa_tipo');
  await verificarTabela('cp_tarefa');
  await verificarTabela('tempo_estimado_regra');
  console.log('\nConcluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
