/**
 * Analisa por que o custo_hora não aparece para a Daniela (membro id 61003494).
 * Conecta no Supabase e inspeciona custo_membro_vigencia e membro.
 *
 * Uso: cd backend_js && bun run scripts/analisar-custo-membro-61003494.ts
 *
 * Requer: .env com SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_ANON_KEY) no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const SCHEMA = 'up_gestaointeligente';
const MEMBRO_ID = 61003494;

async function main() {
  console.log('=== Análise custo/hora – membro_id', MEMBRO_ID, '===\n');

  // 1) Dados do membro
  const { data: membro, error: errMembro } = await supabase
    .schema(SCHEMA)
    .from('membro')
    .select('*')
    .eq('id', MEMBRO_ID)
    .single();

  if (errMembro) {
    console.error('Erro ao buscar membro:', errMembro.message);
  } else if (membro) {
    console.log('--- 1) Membro ---');
    console.log('id:', membro.id, '| nome:', (membro as Record<string, unknown>).nome);
    console.log('Colunas da tabela membro:', Object.keys(membro).join(', '));
    console.log('');
  } else {
    console.log('Membro não encontrado com id', MEMBRO_ID);
  }

  // 2) Todas as vigências desse membro (sem filtro de data)
  const { data: vigenciasTodas, error: errVigTodas } = await supabase
    .schema(SCHEMA)
    .from('custo_membro_vigencia')
    .select('*')
    .eq('membro_id', MEMBRO_ID)
    .order('dt_vigencia', { ascending: false });

  if (errVigTodas) {
    console.error('Erro ao buscar vigências:', errVigTodas.message);
  } else {
    console.log('--- 2) Todas as vigências (custo_membro_vigencia) para membro_id', MEMBRO_ID, '---');
    console.log('Total de linhas:', (vigenciasTodas ?? []).length);
    if (vigenciasTodas?.length) {
      console.log('Colunas retornadas:', Object.keys(vigenciasTodas[0]).join(', '));
      (vigenciasTodas as Record<string, unknown>[]).forEach((v, i) => {
        console.log('\nLinha', i + 1, ':', {
          membro_id: v.membro_id,
          dt_vigencia: v.dt_vigencia,
          custohora: v.custohora,
          custo_hora: v.custo_hora,
          horascontratadasdia: v.horascontratadasdia,
          // Qualquer outra coluna que possa ser custo
          ...Object.fromEntries(
            Object.entries(v).filter(([k]) => 
              k.toLowerCase().includes('custo') || k.toLowerCase().includes('hora')
            )
          ),
        });
      });
    } else {
      console.log('Nenhuma vigência encontrada. Cadastre em custo_membro_vigencia com membro_id =', MEMBRO_ID);
    }
  }

  // 3) Simular exatamente a query do endpoint (dt_vigencia <= data_fim, order desc)
  const DATA_FIM = '2026-02-28';
  const { data: vigenciasFiltradas, error: errVigFiltro } = await supabase
    .schema(SCHEMA)
    .from('custo_membro_vigencia')
    .select('*')
    .eq('membro_id', MEMBRO_ID)
    .lte('dt_vigencia', DATA_FIM)
    .order('dt_vigencia', { ascending: false });

  console.log('\n--- 3) Query do endpoint (dt_vigencia <=', DATA_FIM, ') ---');
  if (errVigFiltro) {
    console.error('Erro:', errVigFiltro.message);
  } else {
    console.log('Linhas retornadas:', (vigenciasFiltradas ?? []).length);
    const primeira = (vigenciasFiltradas ?? [])[0] as Record<string, unknown> | undefined;
    if (primeira) {
      console.log('Primeira vigência (a que o endpoint usa):', JSON.stringify(primeira, null, 2));
      const custoRaw = primeira.custohora ?? primeira.custo_hora;
      console.log('\nValor usado para custo_hora (custohora ?? custo_hora):', custoRaw, '| tipo:', typeof custoRaw);
      const num = custoRaw != null && custoRaw !== '' ? Number(String(custoRaw).replace(',', '.')) : 0;
      console.log('Numérico (após replace , por .):', num);
    }
  }

  // 4) Tipos das colunas de custo (amostra de qualquer vigência)
  const { data: amostra } = await supabase
    .schema(SCHEMA)
    .from('custo_membro_vigencia')
    .select('*')
    .limit(1);
  const row = (amostra ?? [])[0] as Record<string, unknown> | undefined;
  if (row) {
    console.log('\n--- 4) Nomes exatos das colunas em custo_membro_vigencia (amostra) ---');
    Object.keys(row).sort().forEach((k) => {
      const v = row[k];
      console.log('  ', k, '=>', v, '(', typeof v, ')');
    });
  }

  console.log('\n=== Fim da análise ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
