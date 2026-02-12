/**
 * Valida a coluna de nome (nome / name) nas tabelas usadas pelo endpoint /horas.
 * Uso: cd backend_js && bun run scripts/validar-nomes.ts
 *
 * Tabelas: membro, cp_cliente, cp_produto, cp_tarefa_tipo, cp_tarefa
 * Verifica: nome da coluna, tipo do id, IDs dos dados que não retornam nome
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

const DATA_INICIO = '2025-01-01';
const DATA_FIM = '2025-12-31';

type TabelaNome = {
  tabela: string;
  idColumn: string;
  nomeColumn: string;
  ids: Set<string>;
  amostra: Array<{ id: unknown; nome: unknown }>;
};

function extrairNome(row: Record<string, unknown>, nomeCol: string): string {
  const v = row[nomeCol];
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

async function verificarTabela(
  nomeTabela: string,
  colunaId: string,
  possiveisColunasNome: string[]
): Promise<TabelaNome> {
  const { data: rows, error } = await supabase
    .schema(schema)
    .from(nomeTabela)
    .select('*')
    .limit(3);

  const result: TabelaNome = {
    tabela: nomeTabela,
    idColumn: colunaId,
    nomeColumn: '',
    ids: new Set(),
    amostra: [],
  };

  if (error) {
    console.error(nomeTabela, '- erro:', error.message);
    return result;
  }

  if (rows?.length && rows[0]) {
    const colunas = Object.keys(rows[0] as object);
    const nomeCol = possiveisColunasNome.find((c) => colunas.includes(c)) ?? (colunas.includes('nome') ? 'nome' : colunas.find((c) => c.toLowerCase().includes('nome')) ?? '');
    result.nomeColumn = nomeCol || '?';
    result.amostra = (rows as Record<string, unknown>[]).map((r) => ({
      id: r[colunaId],
      nome: r[nomeCol],
    }));
  }
  return result;
}

async function main() {
  console.log('=== Validação de NOMES (schema:', schema, ') ===\n');

  // 1) Estrutura e coluna de nome de cada tabela
  const tabelas = [
    { tabela: 'membro', idCol: 'id', nomeCandidatos: ['nome', 'name'] },
    { tabela: 'cp_cliente', idCol: 'id', nomeCandidatos: ['nome', 'name'] },
    { tabela: 'cp_produto', idCol: 'id', nomeCandidatos: ['nome', 'name'] },
    { tabela: 'cp_tarefa_tipo', idCol: 'id', nomeCandidatos: ['nome', 'name'] },
    { tabela: 'cp_tarefa', idCol: 'id', nomeCandidatos: ['nome', 'name'] },
  ];

  console.log('--- 1) Coluna de nome em cada tabela ---');
  const resultados: TabelaNome[] = [];
  for (const t of tabelas) {
    const info = await verificarTabela(t.tabela, t.idCol, t.nomeCandidatos);
    resultados.push(info);
    console.log(t.tabela, '- coluna nome:', info.nomeColumn || '(não encontrada)', '| amostra:', info.amostra);
  }

  // 2) IDs que aparecem nos dados (registro_tempo + tempo_estimado_regra)
  const { data: registros } = await supabase
    .schema(schema)
    .from('registro_tempo')
    .select('usuario_id, cliente_id, produto_id, tipo_tarefa_id, tarefa_id')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM);

  const { data: estimados } = await supabase
    .schema(schema)
    .from('tempo_estimado_regra')
    .select('responsavel_id, cliente_id, produto_id, tipo_tarefa_id, tarefa_id')
    .gte('data_inicio', DATA_INICIO)
    .lte('data_fim', DATA_FIM);

  const idsPorNivel: Record<string, Set<string>> = {
    colaborador: new Set(),
    cliente: new Set(),
    produto: new Set(),
    tipo_tarefa: new Set(),
    tarefa: new Set(),
  };

  const { data: todosMembros } = await supabase.schema(schema).from('membro').select('id, usuario_id');
  const usuarioParaMembro: Record<number, number> = {};
  const membroIdsSet = new Set<number>();
  (todosMembros ?? []).forEach((m: { id: number; usuario_id: number | null }) => {
    membroIdsSet.add(m.id);
    if (m.usuario_id != null) usuarioParaMembro[m.usuario_id] = m.id;
    usuarioParaMembro[m.id] = m.id;
  });

  (registros ?? []).forEach((r: Record<string, unknown>) => {
    const uid = r.usuario_id as number;
    const mid = usuarioParaMembro[uid] ?? (membroIdsSet.has(uid) ? uid : null);
    if (mid != null) idsPorNivel.colaborador.add(String(mid));
    if (r.cliente_id) idsPorNivel.cliente.add(String(r.cliente_id));
    if (r.produto_id != null) idsPorNivel.produto.add(String(r.produto_id));
    if (r.tipo_tarefa_id != null) idsPorNivel.tipo_tarefa.add(String(r.tipo_tarefa_id));
    if (r.tarefa_id != null) idsPorNivel.tarefa.add(String(r.tarefa_id));
  });

  (estimados ?? []).forEach((e: Record<string, unknown>) => {
    const rid = e.responsavel_id as number;
    const mid = usuarioParaMembro[rid] ?? (membroIdsSet.has(rid) ? rid : null);
    if (mid != null) idsPorNivel.colaborador.add(String(mid));
    if (e.cliente_id) idsPorNivel.cliente.add(String(e.cliente_id));
    if (e.produto_id != null) idsPorNivel.produto.add(String(e.produto_id));
    if (e.tipo_tarefa_id != null) idsPorNivel.tipo_tarefa.add(String(e.tipo_tarefa_id));
    if (e.tarefa_id != null) idsPorNivel.tarefa.add(String(e.tarefa_id));
  });

  console.log('\n--- 2) IDs que aparecem nos dados (período) ---');
  console.log('colaborador:', idsPorNivel.colaborador.size, '| cliente:', idsPorNivel.cliente.size, '| produto:', idsPorNivel.produto.size, '| tipo_tarefa:', idsPorNivel.tipo_tarefa.size, '| tarefa:', idsPorNivel.tarefa.size);

  // 3) Buscar nomes para cada conjunto de IDs e ver quem falta
  const mapaTabelaPorNivel: Record<string, string> = {
    colaborador: 'membro',
    cliente: 'cp_cliente',
    produto: 'cp_produto',
    tipo_tarefa: 'cp_tarefa_tipo',
    tarefa: 'cp_tarefa',
  };

  const nomeColPorTabela: Record<string, string> = {};
  resultados.forEach((r) => {
    nomeColPorTabela[r.tabela] = r.nomeColumn || 'nome';
  });

  console.log('\n--- 3) Resolução de nomes (IDs sem nome encontrado) ---');

  for (const nivel of ['colaborador', 'cliente', 'produto', 'tipo_tarefa', 'tarefa'] as const) {
    const tabela = mapaTabelaPorNivel[nivel];
    const ids = idsPorNivel[nivel];
    const nomeCol = nomeColPorTabela[tabela] || 'nome';
    if (ids.size === 0) {
      console.log(nivel, '- nenhum id nos dados');
      continue;
    }

    const colId = 'id';
    const idsArr = [...ids];
    const idsParaQuery = idsArr.every((id) => /^\d+$/.test(id)) ? idsArr.map(Number) : idsArr;

    const { data: rows } = await supabase
      .schema(schema)
      .from(tabela)
      .select(`${colId}, ${nomeCol}`)
      .in(colId, idsParaQuery);

    const map = new Map<string, string>();
    (rows ?? []).forEach((r: Record<string, unknown>) => {
      const id = String(r[colId]);
      map.set(id, extrairNome(r, nomeCol));
    });
    let nomesEncontrados = 0;
    const nomesFaltando: string[] = [];
    idsArr.forEach((id) => {
      if (map.has(id) && (map.get(id) ?? '').length > 0) nomesEncontrados++;
      else nomesFaltando.push(id);
    });

    console.log(nivel, '(' + tabela + '):', 'com nome:', nomesEncontrados, '| sem nome:', nomesFaltando.length, nomesFaltando.length ? nomesFaltando.slice(0, 8) : '');
  }

  // 4) Resumo: coluna a usar no endpoint
  console.log('\n--- 4) Coluna a usar no endpoint por tabela ---');
  resultados.forEach((r) => {
    const col = r.nomeColumn || 'nome';
    console.log(r.tabela, '->', col === '?' ? 'verificar manualmente' : `select id, ${col}`);
  });

  // 5) Se tarefa tem IDs string nos dados, verificar se cp_tarefa tem coluna para eles (ex: id_clickup)
  const tarefaIdsAmostra = [...idsPorNivel.tarefa].slice(0, 5);
  const todosNumericos = tarefaIdsAmostra.every((id) => /^\d+$/.test(id));
  if (!todosNumericos && idsPorNivel.tarefa.size > 0) {
    console.log('\n--- 5) cp_tarefa: IDs nos dados são string (ex: ClickUp). Colunas da tabela ---');
    const { data: umaTarefa, error: errT } = await supabase
      .schema(schema)
      .from('cp_tarefa')
      .select('*')
      .limit(1);
    if (!errT && umaTarefa?.[0]) {
      console.log('Colunas cp_tarefa:', Object.keys(umaTarefa[0]).join(', '));
      console.log('Exemplo de id na tabela:', (umaTarefa[0] as Record<string, unknown>).id, 'tipo:', typeof (umaTarefa[0] as Record<string, unknown>).id);
      console.log('IDs nos dados (amostra):', tarefaIdsAmostra);
    }
  }

  console.log('\n=== Fim validação nomes ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
