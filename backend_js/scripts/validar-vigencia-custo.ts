/**
 * Valida dados de vigência e custo no Supabase para o endpoint /horas.
 * Uso: cd backend_js && bun run scripts/validar-vigencia-custo.ts
 *
 * Verifica:
 * - Colunas das tabelas membro, custo_membro_vigencia, registro_tempo, tempo_estimado_regra
 * - Se responsavel_id (tempo_estimado_regra) = membro.id ou usuario_id
 * - Se vigências existem para os membros que aparecem nos dados
 * - Nomes reais das colunas de custo (custohora vs custo_hora)
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

// Período de teste (ajuste se quiser)
const DATA_INICIO = '2025-01-01';
const DATA_FIM = '2025-12-31';

async function main() {
  console.log('=== Validação Vigência / Custo (schema:', schema, ') ===\n');

  // 1) Colunas e amostra de cada tabela
  console.log('--- 1) Estrutura e amostra ---');
  const { data: membros, error: eMembro } = await supabase
    .schema(schema)
    .from('membro')
    .select('*')
    .limit(5);
  if (eMembro) {
    console.error('membro:', eMembro.message);
  } else if (membros?.length) {
    console.log('membro - colunas:', Object.keys(membros[0]).join(', '));
    console.log('membro - amostra (id, usuario_id, nome):', membros.map((m: Record<string, unknown>) => ({ id: m.id, usuario_id: m.usuario_id, nome: (m.nome as string)?.slice(0, 20) })));
  } else {
    console.log('membro: tabela vazia ou sem registros');
  }

  const { data: vigenciaAmostra, error: eVig } = await supabase
    .schema(schema)
    .from('custo_membro_vigencia')
    .select('*')
    .limit(5);
  if (eVig) {
    console.error('custo_membro_vigencia:', eVig.message);
  } else if (vigenciaAmostra?.length) {
    console.log('custo_membro_vigencia - colunas:', Object.keys(vigenciaAmostra[0]).join(', '));
    console.log('custo_membro_vigencia - amostra:', vigenciaAmostra.map((v: Record<string, unknown>) => ({
      membro_id: v.membro_id,
      dt_vigencia: v.dt_vigencia,
      custohora: v.custohora,
      custo_hora: v.custo_hora,
      horascontratadasdia: v.horascontratadasdia,
    })));
  } else {
    console.log('custo_membro_vigencia: sem registros');
  }

  const { data: regAmostra, error: eReg } = await supabase
    .schema(schema)
    .from('registro_tempo')
    .select('usuario_id, data_inicio, data_fim')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM)
    .limit(5);
  if (eReg) console.error('registro_tempo:', eReg.message);
  else if (regAmostra?.length) {
    console.log('registro_tempo - usuario_id (amostra):', regAmostra.map((r: Record<string, unknown>) => r.usuario_id));
  }

  const { data: estAmostra, error: eEst } = await supabase
    .schema(schema)
    .from('tempo_estimado_regra')
    .select('responsavel_id, data_inicio, data_fim')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM)
    .limit(5);
  if (eEst) console.error('tempo_estimado_regra:', eEst.message);
  else if (estAmostra?.length) {
    console.log('tempo_estimado_regra - responsavel_id (amostra):', estAmostra.map((e: Record<string, unknown>) => e.responsavel_id));
  }

  // 2) Todos os membro_id presentes em custo_membro_vigencia
  const { data: todasVigencias } = await supabase
    .schema(schema)
    .from('custo_membro_vigencia')
    .select('membro_id, dt_vigencia');
  const membroIdsComVigencia = new Set((todasVigencias ?? []).map((v: { membro_id: number }) => String(v.membro_id)));
  console.log('\n--- 2) Membros com vigência cadastrada ---');
  console.log('Total de membro_id distintos em custo_membro_vigencia:', membroIdsComVigencia.size);
  console.log('Exemplos:', [...membroIdsComVigencia].slice(0, 15));

  // 3) Todos os usuario_id em registro_tempo no período
  const { data: registros } = await supabase
    .schema(schema)
    .from('registro_tempo')
    .select('usuario_id')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM);
  const usuarioIdsReg = new Set((registros ?? []).map((r: { usuario_id: number }) => r.usuario_id));
  console.log('\n--- 3) usuario_id em registro_tempo (período) ---');
  console.log('Distintos:', usuarioIdsReg.size, 'Exemplos:', [...usuarioIdsReg].slice(0, 10));

  // 4) Todos os responsavel_id em tempo_estimado_regra no período
  const { data: estimados } = await supabase
    .schema(schema)
    .from('tempo_estimado_regra')
    .select('responsavel_id')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM);
  const responsavelIds = new Set((estimados ?? []).map((e: { responsavel_id: number }) => e.responsavel_id));
  console.log('\n--- 4) responsavel_id em tempo_estimado_regra (período) ---');
  console.log('Distintos:', responsavelIds.size, 'Exemplos:', [...responsavelIds].slice(0, 10));

  // 5) Mapeamento usuario_id -> membro.id
  const { data: todosMembros } = await supabase.schema(schema).from('membro').select('id, usuario_id');
  const usuarioParaMembro: Record<number, number> = {};
  (todosMembros ?? []).forEach((m: { id: number; usuario_id: number }) => {
    usuarioParaMembro[m.usuario_id] = m.id;
  });
  const membroIds = new Set((todosMembros ?? []).map((m: { id: number }) => m.id));
  console.log('\n--- 5) Mapeamento usuario_id -> membro.id ---');
  console.log('Membros totais (membro.id):', membroIds.size);
  console.log('Exemplo: usuario_id 123 -> membro.id', usuarioParaMembro[123]);

  // 6) Conflito: path usa membro.id (registro) ou responsavel_id (estimado). Vigência é por membro_id.
  // No endpoint: usuarioParaMembro[usuario_id]=membro.id e usuarioParaMembro[membro.id]=membro.id (fallback).
  console.log('\n--- 6) Quem precisa de vigência para o custo ---');
  const membroIdsNosPaths = new Set<string>();
  usuarioIdsReg.forEach((uid) => {
    const mid = usuarioParaMembro[uid] ?? (membroIds.has(uid) ? uid : null);
    if (mid != null) membroIdsNosPaths.add(String(mid));
  });
  responsavelIds.forEach((rid) => {
    membroIdsNosPaths.add(String(rid));
  });
  console.log('IDs de "colaborador" que aparecem nos paths (membro.id ou responsavel_id):', [...membroIdsNosPaths].slice(0, 20));

  const semVigencia = [...membroIdsNosPaths].filter((id) => !membroIdsComVigencia.has(id));
  console.log('IDs nos paths SEM vigência em custo_membro_vigencia:', semVigencia.length, semVigencia.slice(0, 15));

  // 7) responsavel_id é membro.id ou usuario_id?
  const responsavelComoMembro = [...responsavelIds].filter((rid) => membroIds.has(rid));
  const responsavelComoUsuario = [...responsavelIds].filter((rid) => usuarioParaMembro[rid] != null && !membroIds.has(rid));
  console.log('\n--- 7) responsavel_id: é membro.id ou usuario_id? ---');
  console.log('responsavel_id que existe como membro.id:', responsavelComoMembro.length);
  console.log('responsavel_id que existe como usuario_id (mas não como membro.id):', responsavelComoUsuario.length);
  if (responsavelComoUsuario.length > 0) {
    console.log('>>> Se há responsavel_id = usuario_id, o endpoint deve converter para membro.id no path e na busca de vigência.');
  }

  // 8) Nome da coluna de custo em custo_membro_vigencia (pode vir string "14,15" - formato BR)
  const primeiraVig = (vigenciaAmostra ?? [])[0] as Record<string, unknown> | undefined;
  const temCustohora = primeiraVig && 'custohora' in primeiraVig;
  const temCusto_hora = primeiraVig && 'custo_hora' in primeiraVig;
  console.log('\n--- 8) Coluna de custo/hora em custo_membro_vigencia ---');
  console.log('Tem "custohora":', temCustohora, 'Tem "custo_hora":', temCusto_hora);
  if (primeiraVig) {
    const raw = primeiraVig.custohora ?? primeiraVig.custo_hora;
    console.log('Valor amostra (raw):', raw, 'tipo:', typeof raw);
    const parseCusto = (v: unknown): number => {
      if (v == null) return 0;
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      const s = String(v).trim().replace(',', '.');
      const n = parseFloat(s);
      return Number.isNaN(n) ? 0 : n;
    };
    console.log('Valor parseado (parseCusto):', parseCusto(raw));
  }

  // 9) Simular escolha de vigência para um membro que está sem vigência
  if (semVigencia.length > 0) {
    const exemploId = semVigencia[0];
    const { data: vigenciasMembro } = await supabase
      .schema(schema)
      .from('custo_membro_vigencia')
      .select('*')
      .eq('membro_id', exemploId);
    console.log('\n--- 9) Vigências para um membro que “não tem” (membro_id=' + exemploId + ') ---');
    if (vigenciasMembro?.length) {
      console.log('Encontradas', vigenciasMembro.length, 'linhas. Possível causa: membro_id no path diferente do custo_membro_vigencia (ex: path com usuario_id).');
      console.log('Amostra:', vigenciasMembro.slice(0, 3));
    } else {
      console.log('Realmente não há nenhuma linha em custo_membro_vigencia para esse id. Cadastre vigência para esse membro.');
    }
  }

  console.log('\n=== Fim da validação ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
