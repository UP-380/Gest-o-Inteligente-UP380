/**
 * Valida dados da tabela custo_membro_vigencia e o fluxo que gera custo no endpoint /horas.
 * Uso: cd backend_js && bun run scripts/validar-custo-membro-vigencia.ts
 *
 * Importante: vigência NÃO tem data fim. Só tem dt_vigencia (data de início, "a partir de").
 * O que tem início e fim é o PERÍODO DO FILTRO da consulta (data_inicio/data_fim que o usuário envia).
 * Usamos o fim do período do filtro para decidir qual vigência está em efeito (dt_vigencia <= fim do filtro, a mais recente).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const schema = 'up_gestaointeligente';

// Fim do período do FILTRO (não é data da vigência; vigência só tem dt_vigencia = início)
const FILTRO_DATA_FIM = '2025-12-31';

function parseCustoHora(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

async function main() {
  console.log('=== Validação custo_membro_vigencia (custo do colaborador) ===\n');

  // 1) Colunas e TODAS as linhas (ou amostra grande) de custo_membro_vigencia
  const { data: vigencias, error: errVig } = await supabase
    .schema(schema)
    .from('custo_membro_vigencia')
    .select('*')
    .order('membro_id', { ascending: true })
    .order('dt_vigencia', { ascending: false });

  if (errVig) {
    console.error('Erro ao carregar custo_membro_vigencia:', errVig.message);
    process.exit(1);
  }

  const linhas = (vigencias ?? []) as Record<string, unknown>[];
  console.log('--- 1) Colunas da tabela ---');
  if (linhas.length > 0) {
    console.log(Object.keys(linhas[0]).join(', '));
  } else {
    console.log('Tabela vazia. Nenhum registro em custo_membro_vigencia.');
    process.exit(0);
  }

  // 2) Nome da coluna de custo (custo_hora vs custohora) e tipo/valor
  const primeira = linhas[0];
  const temCustoHora = 'custo_hora' in primeira;
  const temCustohora = 'custohora' in primeira;
  console.log('\n--- 2) Coluna de custo ---');
  console.log('Tem "custo_hora":', temCustoHora);
  console.log('Tem "custohora":', temCustohora);
  const rawCusto = primeira.custo_hora ?? primeira.custohora;
  console.log('Valor raw (primeira linha):', rawCusto, '| tipo:', typeof rawCusto);
  console.log('Valor parseado (parseCustoHora):', parseCustoHora(rawCusto));

  // 3) Simular escolherVigencia: vigência só tem dt_vigencia (início). Escolhemos a que está em efeito no fim do filtro.
  const porMembro: Record<string, Array<{ dt: string; row: Record<string, unknown> }>> = {};
  linhas.forEach((row) => {
    const mid = String(row.membro_id);
    if (!porMembro[mid]) porMembro[mid] = [];
    const dt = (row.dt_vigencia as string) ?? '';
    porMembro[mid].push({ dt, row });
  });

  console.log('\n--- 3) Vigência escolhida por membro (fim do período do filtro =', FILTRO_DATA_FIM, ') ---');
  console.log('    (vigência não tem data fim; usamos "dt_vigencia <= fim do filtro" e pegamos a mais recente)');
  const resultado: Record<string, { custo_hora: number; dt_vigencia: string; raw: unknown }> = {};
  Object.entries(porMembro).forEach(([mid, arr]) => {
    const vigentes = arr.filter((x) => x.dt <= FILTRO_DATA_FIM).sort((a, b) => (b.dt > a.dt ? 1 : -1));
    const escolhida = vigentes[0] ?? arr.sort((a, b) => (b.dt > a.dt ? 1 : -1))[0];
    if (escolhida) {
      const r = escolhida.row;
      const raw = r.custohora ?? r.custo_hora;
      resultado[mid] = {
        custo_hora: parseCustoHora(raw),
        dt_vigencia: escolhida.dt,
        raw,
      };
    }
  });

  Object.entries(resultado).forEach(([membroId, v]) => {
    console.log(`  membro_id=${membroId} | dt_vigencia=${v.dt_vigencia} | raw=${v.raw} | custo_hora(parseado)=${v.custo_hora}`);
  });

  // 4) Alertar se algum custo parseado é 0
  const comCustoZero = Object.entries(resultado).filter(([, v]) => v.custo_hora === 0);
  if (comCustoZero.length > 0) {
    console.log('\n--- 4) ATENÇÃO: membros com custo_hora = 0 após parse ---');
    comCustoZero.forEach(([mid, v]) => console.log(`  membro_id=${mid} | raw="${v.raw}" (tipo: ${typeof v.raw})`));
    console.log('  Possíveis causas: coluna custo_hora vazia, formato não numérico, ou nome da coluna diferente no DB.');
  }

  // 5) Listar todas as linhas com custo raw para inspeção
  console.log('\n--- 5) Todas as linhas (membro_id, dt_vigencia, custo raw) ---');
  linhas.forEach((row, i) => {
    const raw = row.custo_hora ?? row.custohora;
    const parsed = parseCustoHora(raw);
    console.log(`  [${i + 1}] membro_id=${row.membro_id} dt_vigencia=${row.dt_vigencia} raw=${JSON.stringify(raw)} parsed=${parsed}`);
  });

  // 6) Membros que aparecem em registro_tempo no período
  // Período do filtro para buscar registros (isso é início/fim da CONSULTA, não da vigência)
  const filtroInicio = '2025-01-01';
  const { data: registros } = await supabase
    .schema(schema)
    .from('registro_tempo')
    .select('usuario_id')
    .lte('data_fim', FILTRO_DATA_FIM)
    .gte('data_inicio', filtroInicio);
  const usuarioIds = new Set((registros ?? []).map((r: { usuario_id: number }) => r.usuario_id));
  const { data: membros } = await supabase.schema(schema).from('membro').select('id, usuario_id');
  const usuarioParaMembro: Record<number, number> = {};
  (membros ?? []).forEach((m: { id: number; usuario_id: number | null }) => {
    if (m.usuario_id != null) usuarioParaMembro[m.usuario_id] = m.id;
    usuarioParaMembro[m.id] = m.id;
  });
  const membroIdsNosDados = new Set<number>();
  usuarioIds.forEach((uid) => {
    const mid = usuarioParaMembro[uid];
    if (mid != null) membroIdsNosDados.add(mid);
  });

  console.log('\n--- 6) Conferência: membros nos registros x vigência ---');
  membroIdsNosDados.forEach((mid) => {
    const vig = resultado[String(mid)];
    const custo = vig?.custo_hora ?? null;
    console.log(`  membro_id=${mid} | vigência encontrada: ${vig ? 'sim' : 'não'} | custo_hora=${custo ?? 'N/A'}`);
  });

  // Resumo: por que custo pode vir 0
  console.log('\n--- 7) Resumo: por que o custo pode estar 0 no endpoint ---');
  console.log('  1. Colaborador sem linha em custo_membro_vigencia -> custo 0 (cadastre vigência para o membro).');
  console.log('  2. Coluna custo_hora no DB vazia ou "0" -> parse retorna 0.');
  console.log('  3. Endpoint usa o fim do período do filtro (data_fim) para escolher vigência; dt_vigencia <= data_fim (vigência não tem data fim).');
  const semVigencia = [...membroIdsNosDados].filter((mid) => !resultado[String(mid)]);
  if (semVigencia.length > 0) {
    console.log('  Membros que aparecem nos dados mas NÃO têm vigência no resultado:', semVigencia.join(', '));
    console.log('  -> Cadastre ao menos uma linha em custo_membro_vigencia para esses membro_id.');
  }

  console.log('\n=== Fim da validação ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
