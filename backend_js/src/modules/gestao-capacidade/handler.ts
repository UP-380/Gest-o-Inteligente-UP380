/**
 * Handler e funções utilitárias para o endpoint de Gestão de Capacidade
 */
import type { Context } from 'hono';
import { supabase } from '../../lib/supabaseClient.js';
import { getFeriados, calcularHorasDisponiveis } from '../../lib/utils.js';
import { gestaoCapacidadeBodySchema } from './schemas.js';
import type {
  GestaoCapacidadeBody,
  Membro,
  RegistroTempo,
  EstimadoRegra,
  Vigencia,
  NomeMap,
} from './types.js';

const SCHEMA = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';

// Cache global para cálculo de dias úteis (reduz processamento em loops recursivos)
const diasInterseccaoCache = new Map<string, number>();

// ============================================================================
// Funções Utilitárias
// ============================================================================

/** Retorna o custo/hora numérico da vigência (aceita custohora ou custo_hora; aceita vírgula como decimal). */
function custoHoraNum(vigencia?: Vigencia | null): number {
  if (!vigencia) return 0;
  const v = vigencia.custohora ?? vigencia.custo_hora;
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Converte um registro de tempo para milissegundos (compatível com o controller legado). */
function registroTempoParaMs(r: RegistroTempo): number {
  let tempo = Number(r.tempo_realizado) || 0;
  if (!tempo && r.data_inicio) {
    const d1 = new Date(r.data_inicio).getTime();
    const d2 = r.data_fim ? new Date(r.data_fim).getTime() : Date.now();
    tempo = Math.max(0, d2 - d1);
  }
  if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000); // horas -> ms
  return tempo;
}

/** Quantos dias da regra caem no período do request (opcional: excluir finais de semana e feriados). */
/** Quantos dias da regra caem no período do request (opcional: excluir finais de semana e feriados). OTIMIZADO COM CACHE. */
function diasNaInterseccao(
  regraInicio: string,
  regraFim: string,
  periodoInicio: string,
  periodoFim: string,
  ignorarFinaisSemana: boolean,
  feriados: string[]
): number {
  const cacheKey = `${regraInicio}|${regraFim}|${periodoInicio}|${periodoFim}|${ignorarFinaisSemana}`;
  if (diasInterseccaoCache.has(cacheKey)) return diasInterseccaoCache.get(cacheKey)!;

  const startMs = Math.max(new Date(regraInicio).getTime(), new Date(periodoInicio).getTime());
  const endMs = Math.min(new Date(regraFim).getTime(), new Date(periodoFim).getTime());

  if (startMs > endMs) return 0;

  const start = new Date(startMs);
  const end = new Date(endMs);

  // Normalizar para meia-noite para evitar problemas de fuso/hora
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const feriadosSet = new Set(feriados);
  let dias = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Domingo, 6 = Sábado
    if (ignorarFinaisSemana && (dayOfWeek === 0 || dayOfWeek === 6)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Formatação YYYY-MM-DD manual para evitar toISOString lento
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const day = current.getDate();
    const diaStr = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;

    if (!feriadosSet.has(diaStr)) {
      dias++;
    }

    current.setDate(current.getDate() + 1);
  }

  diasInterseccaoCache.set(cacheKey, dias);
  return dias;
}

/** Converte tempo_estimado_dia para ms por dia (0 < x < 1000 = horas, senão já é ms). */
function tempoEstimadoDiaParaMs(tempo_estimado_dia: number): number {
  const t = Number(tempo_estimado_dia) || 0;
  if (t > 0 && t < 1000) return Math.round(t * 3600000);
  return t;
}

/** Converte ms em "hh:mm:ss". */
function msParaHms(ms: number): string {
  if (ms == null || !Number.isFinite(ms)) return '00:00:00';
  const absMs = Math.abs(ms);
  const totalSegundos = Math.round(absMs / 1000);
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = totalSegundos % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const sinal = ms < 0 ? '-' : '';
  return `${sinal}${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Converte ms em horas decimais (ex.: 9000000 -> 2.5). */
function msParaHorasDecimal(ms: number): number {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 0;
  return Math.round((ms / (3600 * 1000)) * 100) / 100;
}

/** Calcula custo_estimado e custo_realizado a partir de registros e estimados (custo/hora da vigência do colaborador). */
function calcularCusto(
  registros: RegistroTempo[],
  estimados: EstimadoRegra[],
  usuarioParaMembro: Map<number, number>,
  vigenciaPorMembro: Map<number, Vigencia>,
  data_inicio: string,
  data_fim: string,
  ignorar_finais_semana: boolean,
  feriados: string[]
): { custo_estimado: number; custo_realizado: number } {
  let custo_realizado = 0;
  for (const r of registros) {
    const membroId = usuarioParaMembro.get(r.usuario_id) ?? r.usuario_id;
    const vigencia = vigenciaPorMembro.get(typeof membroId === 'number' ? membroId : parseInt(String(membroId), 10));
    const ch = custoHoraNum(vigencia);
    custo_realizado += (registroTempoParaMs(r) / (1000 * 3600)) * ch;
  }
  let custo_estimado = 0;
  for (const e of estimados) {
    const vigencia = vigenciaPorMembro.get(e.responsavel_id);
    const ch = custoHoraNum(vigencia);
    const regraFim = e.data_fim ?? data_fim;
    const regraInicio = e.data_inicio ?? data_inicio;
    const qtdDias = diasNaInterseccao(regraInicio, regraFim, data_inicio, data_fim, ignorar_finais_semana, feriados);
    const tempoMs = tempoEstimadoDiaParaMs(e.tempo_estimado_dia);
    custo_estimado += (qtdDias * tempoMs / (1000 * 3600)) * ch;
  }
  return {
    custo_estimado: Math.round(custo_estimado * 100) / 100,
    custo_realizado: Math.round(custo_realizado * 100) / 100,
  };
}

function extrairMensagemErro(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Erro interno';
  }
}

/**
 * Otimização: Funções redundantemente recursivas foram removidas.
 */

type Nivel = 'colaborador' | 'cliente' | 'produto' | 'tipo_tarefa' | 'tarefa';

/** Retorna o ID do nível para um registro ou estimado. */
function getIdParaNivel(
  r: RegistroTempo | EstimadoRegra,
  nivel: Nivel,
  usuarioParaMembro: Map<number, number>
): string | number | null {
  if ('usuario_id' in r) {
    if (nivel === 'colaborador') return usuarioParaMembro.get((r as RegistroTempo).usuario_id) ?? (r as RegistroTempo).usuario_id;
    if (nivel === 'cliente') return (r as RegistroTempo).cliente_id ?? null;
    if (nivel === 'produto') return (r as RegistroTempo).produto_id ?? null;
    if (nivel === 'tipo_tarefa') return (r as RegistroTempo).tipo_tarefa_id ?? null;
    if (nivel === 'tarefa') return (r as RegistroTempo).tarefa_id ?? null;
  } else {
    const e = r as EstimadoRegra;
    if (nivel === 'colaborador') return e.responsavel_id;
    if (nivel === 'cliente') return e.cliente_id ?? null;
    if (nivel === 'produto') return e.produto_id ?? null;
    if (nivel === 'tipo_tarefa') return e.tipo_tarefa_id ?? null;
    if (nivel === 'tarefa') return e.tarefa_id ?? null;
  }
  return null;
}

// Otimização: montagem recursiva duplicada removida.

/**
 * Monta a árvore de detalhes. A ordem dos níveis é 100% dinâmica.
 */
function montarHierarquia({
  registros,
  estimados,
  ordem_niveis,
  usuarioParaMembro,
  nomeColaborador,
  nomeCliente,
  nomeProduto,
  nomeTipoTarefa,
  nomeTarefa,
  data_inicio,
  data_fim,
  ignorar_finais_semana,
  feriados
}: {
  registros: RegistroTempo[];
  estimados: EstimadoRegra[];
  ordem_niveis: Array<'colaborador' | 'cliente' | 'produto' | 'tipo_tarefa' | 'tarefa'>;
  usuarioParaMembro: Map<number, number>;
  nomeColaborador: NomeMap;
  nomeCliente: NomeMap;
  nomeProduto: NomeMap;
  nomeTipoTarefa: NomeMap;
  nomeTarefa: NomeMap;
  data_inicio: string;
  data_fim: string;
  ignorar_finais_semana: boolean;
  feriados: string[];
}) {
  const hierarquia: Record<string, any> = {};

  const mapNivel = (nivel: string, r?: RegistroTempo | EstimadoRegra) => {
    switch (nivel) {
      case 'colaborador': {
        if (r && 'usuario_id' in r) {
          const uid = (r as RegistroTempo).usuario_id;
          return usuarioParaMembro.get(uid) ?? uid;
        }
        return (r as EstimadoRegra)?.responsavel_id ?? null;
      }
      case 'cliente': return r?.cliente_id;
      case 'produto': return r?.produto_id;
      case 'tipo_tarefa': return r?.tipo_tarefa_id;
      case 'tarefa': return r?.tarefa_id;
      default: return null;
    }
  };

  const getNome = (nivel: string, id: string | number) => {
    const key = String(id);
    switch (nivel) {
      case 'colaborador': return nomeColaborador[key] || `Colaborador #${key}`;
      case 'cliente': return nomeCliente[key] || `Cliente #${key}`;
      case 'produto': return nomeProduto[key] || `Produto #${key}`;
      case 'tipo_tarefa': return nomeTipoTarefa[key] || `Tipo #${key}`;
      case 'tarefa': return nomeTarefa[key] || `Tarefa #${key}`;
      default: return key;
    }
  };

  const agregar = (
    obj: Record<string, any>,
    niveis: string[],
    registro?: RegistroTempo,
    estimado?: EstimadoRegra
  ) => {
    if (!niveis.length) return;
    const chaveRaw = mapNivel(niveis[0], registro) || mapNivel(niveis[0], estimado);
    if (chaveRaw == null || chaveRaw === '') return;
    const chave = String(chaveRaw);

    if (!obj[chave]) obj[chave] = {
      nome: getNome(niveis[0], chave),
      total_estimado_ms: 0,
      total_realizado_ms: 0,
      detalhes: {}
    };

    if (estimado) {
      const regraInicio = estimado.data_inicio ?? data_inicio;
      const regraFim = estimado.data_fim ?? data_fim;
      const qtdDias = diasNaInterseccao(regraInicio, regraFim, data_inicio, data_fim, ignorar_finais_semana, feriados);
      const tempoMs = tempoEstimadoDiaParaMs(estimado.tempo_estimado_dia);
      obj[chave].total_estimado_ms += qtdDias * tempoMs;
    }
    obj[chave].total_realizado_ms += registro ? registroTempoParaMs(registro) : 0;

    agregar(obj[chave].detalhes, niveis.slice(1), registro, estimado);
  };

  registros.forEach(r => agregar(hierarquia, ordem_niveis, r, undefined));
  estimados.forEach(e => agregar(hierarquia, ordem_niveis, undefined, e));

  return hierarquia;
}

/**
 * Particiona registros/estimados por ID do nível atual.
 * Retorna Map<id, array>.
 */
function particionarPorNivel(
  lista: (RegistroTempo | EstimadoRegra)[],
  nivel: Nivel,
  usuarioParaMembro: Map<number, number>
): Map<string, any[]> {
  const mapa = new Map<string, any[]>();
  for (const item of lista) {
    const id = getIdParaNivel(item, nivel, usuarioParaMembro);
    if (id != null) {
      const key = String(id);
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)?.push(item);
    }
  }
  return mapa;
}

function adicionarFormatosNaHierarquia(obj: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  Object.values(obj).forEach((node) => {
    if (node && typeof node === 'object') {
      if ('total_estimado_ms' in node) {
        node.total_estimado_hms = msParaHms(node.total_estimado_ms);
        node.total_estimado_h = msParaHorasDecimal(node.total_estimado_ms);
        node.total_realizado_hms = msParaHms(node.total_realizado_ms);
        node.total_realizado_h = msParaHorasDecimal(node.total_realizado_ms);
      }
      if (node.detalhes && typeof node.detalhes === 'object') {
        adicionarFormatosNaHierarquia(node.detalhes);
      }
    }
  });
}

/** Conta totalizadores (tarefas, produtos, clientes, colaboradores) nos dados. Sempre retorna os quatro, em qualquer nível. */
function contarTotalizadores(
  registros: RegistroTempo[],
  estimados: EstimadoRegra[],
  usuarioParaMembro: Map<number, number>
): { total_tarefas: number; total_produtos: number; total_clientes: number; total_colaboradores: number } {
  const tarefas = new Set<string>();
  const produtos = new Set<string>();
  const clientes = new Set<string>();
  const colaboradores = new Set<number>();
  const add = (r: RegistroTempo | EstimadoRegra) => {
    const idTarefa = getIdParaNivel(r, 'tarefa', usuarioParaMembro);
    if (idTarefa != null && idTarefa !== '') tarefas.add(String(idTarefa));
    const idProduto = getIdParaNivel(r, 'produto', usuarioParaMembro);
    if (idProduto != null && idProduto !== '') produtos.add(String(idProduto));
    const idCliente = getIdParaNivel(r, 'cliente', usuarioParaMembro);
    if (idCliente != null && idCliente !== '') clientes.add(String(idCliente));
    const idColab = getIdParaNivel(r, 'colaborador', usuarioParaMembro);
    if (idColab != null) colaboradores.add(typeof idColab === 'number' ? idColab : parseInt(String(idColab), 10));
  };
  registros.forEach(add);
  estimados.forEach(add);
  return {
    total_tarefas: tarefas.size,
    total_produtos: produtos.size,
    total_clientes: clientes.size,
    total_colaboradores: colaboradores.size,
  };
}

/**
 * Adiciona total_tarefas, total_produtos, total_clientes, total_colaboradores em cada nó de "data".
 * OTIMIZADO: Usa particionamento para O(N) por nível.
 */
function adicionarTotalizadoresNaHierarquia(
  obj: Record<string, any>,
  ordem_niveis: Nivel[],
  nivelIndex: number,
  registros: RegistroTempo[],
  estimados: EstimadoRegra[],
  usuarioParaMembro: Map<number, number>
): void {
  if (!obj || typeof obj !== 'object' || nivelIndex >= ordem_niveis.length) return;
  const nivel = ordem_niveis[nivelIndex];
  const ehPrimeiroNivel = nivelIndex === 0;

  // Particionar dados UMA VEZ para este nível
  const registrosMap = particionarPorNivel(registros, nivel, usuarioParaMembro);
  const estimadosMap = particionarPorNivel(estimados, nivel, usuarioParaMembro);

  for (const chave of Object.keys(obj)) {
    const node = obj[chave];
    if (!node || typeof node !== 'object') continue;

    const registrosNode = (registrosMap.get(String(chave)) || []) as RegistroTempo[];
    const estimadosNode = (estimadosMap.get(String(chave)) || []) as EstimadoRegra[];

    if (ehPrimeiroNivel) {
      const totais = contarTotalizadores(registrosNode, estimadosNode, usuarioParaMembro);
      node.total_tarefas = totais.total_tarefas;
      node.total_produtos = totais.total_produtos;
      node.total_clientes = totais.total_clientes;
      node.total_colaboradores = totais.total_colaboradores;
    }

    if (node.detalhes && typeof node.detalhes === 'object') {
      adicionarTotalizadoresNaHierarquia(
        node.detalhes,
        ordem_niveis,
        nivelIndex + 1,
        registrosNode,
        estimadosNode,
        usuarioParaMembro
      );
    }
  }
}

/**
 * Adiciona custo_estimado e custo_realizado em cada nó de "data".
 * OTIMIZADO: Usa particionamento.
 */
function adicionarCustoNaHierarquia(
  obj: Record<string, any>,
  ordem_niveis: Nivel[],
  nivelIndex: number,
  registros: RegistroTempo[],
  estimados: EstimadoRegra[],
  usuarioParaMembro: Map<number, number>,
  vigenciaPorMembro: Map<number, Vigencia>,
  data_inicio: string,
  data_fim: string,
  ignorar_finais_semana: boolean,
  feriados: string[],
  nomeTipoContrato: NomeMap
): void {
  if (!obj || typeof obj !== 'object' || nivelIndex >= ordem_niveis.length) return;
  const nivel = ordem_niveis[nivelIndex];

  // Particionar dados UMA VEZ para este nível
  const registrosMap = particionarPorNivel(registros, nivel, usuarioParaMembro);
  const estimadosMap = particionarPorNivel(estimados, nivel, usuarioParaMembro);

  for (const chave of Object.keys(obj)) {
    const node = obj[chave];
    if (!node || typeof node !== 'object') continue;

    const registrosNode = (registrosMap.get(String(chave)) || []) as RegistroTempo[];
    const estimadosNode = (estimadosMap.get(String(chave)) || []) as EstimadoRegra[];

    const { custo_estimado, custo_realizado } = calcularCusto(
      registrosNode,
      estimadosNode,
      usuarioParaMembro,
      vigenciaPorMembro,
      data_inicio,
      data_fim,
      ignorar_finais_semana,
      feriados
    );

    node.custo_estimado = custo_estimado;
    node.custo_realizado = custo_realizado;

    if (nivel === 'colaborador') {
      const membroId = typeof chave === 'string' && /^\d+$/.test(chave) ? parseInt(chave, 10) : Number(chave);
      const vigencia = vigenciaPorMembro.get(membroId);
      node.custo_hora = custoHoraNum(vigencia);
      node.horas_contratadas_dia = vigencia?.horascontratadasdia != null ? Number(vigencia.horascontratadasdia) : 0;

      // Adicionar tipo de contrato se disponível
      if (vigencia?.tipocontratoid) {
        node.tipo_contrato_id = vigencia.tipocontratoid;
        node.tipo_contrato_nome = nomeTipoContrato[String(vigencia.tipocontratoid)] || null;
      }

      // Calcular horas contratadas no período
      const horasDisponiveis = calcularHorasDisponiveis({
        data_inicio,
        data_fim,
        vigencia,
        ignorar_finais_semana,
        feriados,
        ignorar_folgas: false
      });

      node.horas_contratadas_ms = horasDisponiveis;
      node.horas_contratadas_hms = msParaHms(horasDisponiveis);
      node.horas_contratadas_h = msParaHorasDecimal(horasDisponiveis);

      // Calcular custos para Contratadas e Saldo
      const custoContratado = (horasDisponiveis / (1000 * 60 * 60)) * (node.custo_hora || 0);
      node.custo_contratado = custoContratado;

      const diferencaMs = horasDisponiveis - node.total_realizado_ms;
      node.diferenca_ms = diferencaMs;
      node.diferenca_hms = msParaHms(diferencaMs);
      node.diferenca_h = msParaHorasDecimal(diferencaMs);

      const custoDiferenca = custoContratado - (node.custo_realizado || 0);
      node.custo_diferenca = custoDiferenca;
    }

    if (node.detalhes && typeof node.detalhes === 'object') {
      adicionarCustoNaHierarquia(
        node.detalhes,
        ordem_niveis,
        nivelIndex + 1,
        registrosNode, // Passar subset para os filhos
        estimadosNode,
        usuarioParaMembro,
        vigenciaPorMembro,
        data_inicio,
        data_fim,
        ignorar_finais_semana,
        feriados,
        nomeTipoContrato
      );
    }
  }
}

/** Ordem desejada: resumo/totalizadores primeiro, "detalhes" sempre por último. */
const ORDEM_KEYS_NODE_DATA = [
  'nome',
  'total_estimado_ms',
  'total_estimado_hms',
  'total_estimado_h',
  'total_realizado_ms',
  'total_realizado_hms',
  'total_realizado_h',
  'custo_estimado',
  'custo_realizado',
  'custo_hora',
  'horas_contratadas_ms',
  'horas_contratadas_hms',
  'horas_contratadas_h',
  'diferenca_ms',
  'diferenca_hms',
  'diferenca_h',
  'total_tarefas',
  'total_produtos',
  'total_clientes',
  'total_colaboradores',
  'detalhes'
] as const;

/**
 * Reordena cada nó de "data" para que resumo e totalizadores venham antes de "detalhes".
 */
function reordenarResumoAntesDeDetalhes(obj: Record<string, any>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const chave of Object.keys(obj)) {
    const node = obj[chave];
    if (!node || typeof node !== 'object') continue;
    if (node.detalhes && typeof node.detalhes === 'object') {
      reordenarResumoAntesDeDetalhes(node.detalhes);
    }
    const novoNode: Record<string, any> = {};
    for (const k of ORDEM_KEYS_NODE_DATA) {
      if (k in node) novoNode[k] = node[k];
    }
    for (const k of Object.keys(node)) {
      if (!ORDEM_KEYS_NODE_DATA.includes(k as typeof ORDEM_KEYS_NODE_DATA[number])) novoNode[k] = node[k];
    }
    obj[chave] = novoNode;
  }
}

// ============================================================================
// Handler Principal
// ============================================================================

export async function cardsHandler(c: Context) {
  console.time('TotalRequest');
  const start = Date.now();
  try {
    const bodyAsAny = await c.req.json() as any;
    const hasOrdemNiveis = bodyAsAny && bodyAsAny.ordem_niveis !== undefined;
    const body = bodyAsAny as GestaoCapacidadeBody;

    const parseResult = gestaoCapacidadeBodySchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.flatten();
      return c.json(
        {
          success: false,
          error: 'Validação falhou',
          details: issues.fieldErrors,
          formErrors: issues.formErrors,
        },
        400 as const
      );
    }
    const validatedBody = parseResult.data;

    const {
      colaborador_id,
      data_inicio,
      data_fim,
      ordem_niveis: ordemNiveisRaw,
      ignorar_finais_semana,
      ignorar_feriados,
      ignorar_folgas,
      cliente_id,
      produto_id,
      tipo_tarefa_id,
      tarefa_id,
    } = validatedBody;

    // Aplicar regra de default seguro e limite de profundidade
    const ordem_niveis: Nivel[] = hasOrdemNiveis ? (ordemNiveisRaw as Nivel[] || []) : ['colaborador' as Nivel];
    if (ordem_niveis.length > 3) {
      throw new Error("Hierarquia acima do limite seguro (max 3 níveis)");
    }

    console.time('SupabaseQueries');
    // 1️⃣ Buscar colaboradores
    let queryMembros = supabase.schema(SCHEMA)
      .from('membro')
      .select('id, usuario_id, nome');
    if (colaborador_id != null && colaborador_id.length > 0) {
      queryMembros = colaborador_id.length === 1
        ? queryMembros.eq('id', colaborador_id[0])
        : queryMembros.in('id', colaborador_id);
    }
    const { data: membrosData, error: errMembros } = await queryMembros;

    if (errMembros) throw errMembros;
    const membros = membrosData ?? [];
    if (!membros.length) return c.json({ success: true, data: {} });

    const membroIds = membros.map((m: Membro) => m.id);
    const usuarioParaMembro = new Map<number, number>();
    membros.forEach((m: Membro) => {
      if (m.usuario_id != null) usuarioParaMembro.set(m.usuario_id, m.id);
    });
    const usuarioIds = Array.from(usuarioParaMembro.keys());

    // 2️⃣ Buscar registros de tempo
    const inicioStr = `${data_inicio}T00:00:00`;
    const fimStr = `${data_fim}T23:59:59.999`;
    const orOverlap = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
      `and(data_inicio.lte.${fimStr},data_fim.is.null)`
    ].join(',');

    let queryTempo = supabase.schema(SCHEMA)
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, usuario_id, cliente_id, produto_id, tipo_tarefa_id, tarefa_id')
      .or(orOverlap)
      .in('usuario_id', usuarioIds.length ? usuarioIds : [-1]);

    if (cliente_id && cliente_id.length > 0) {
      queryTempo = cliente_id.length === 1
        ? queryTempo.eq('cliente_id', cliente_id[0])
        : queryTempo.in('cliente_id', cliente_id);
    }
    if (produto_id && produto_id.length > 0) {
      queryTempo = produto_id.length === 1
        ? queryTempo.eq('produto_id', produto_id[0])
        : queryTempo.in('produto_id', produto_id);
    }
    if (tipo_tarefa_id && tipo_tarefa_id.length > 0) {
      queryTempo = tipo_tarefa_id.length === 1
        ? queryTempo.eq('tipo_tarefa_id', tipo_tarefa_id[0])
        : queryTempo.in('tipo_tarefa_id', tipo_tarefa_id);
    }
    if (tarefa_id && tarefa_id.length > 0) {
      queryTempo = tarefa_id.length === 1
        ? queryTempo.eq('tarefa_id', tarefa_id[0])
        : queryTempo.in('tarefa_id', tarefa_id);
    }

    const { data: registrosData, error: errRegistros } = await queryTempo;
    if (errRegistros) throw errRegistros;
    const registros = registrosData ?? [];

    if (registros.length > 3000) {
      console.warn("[GESTAO-CAPACIDADE] Volume alto detectado", { count: registros.length });
    }

    // 3️⃣ Buscar regras de tempo estimado
    const periodoFimStr = `${data_fim}T23:59:59.999`;
    const periodoInicioStr = `${data_inicio}T00:00:00`;
    let queryEstimado = supabase.schema(SCHEMA)
      .from('tempo_estimado_regra')
      .select('*')
      .lte('data_inicio', periodoFimStr)
      .gte('data_fim', periodoInicioStr)
      .in('responsavel_id', membroIds);

    if (cliente_id && cliente_id.length > 0) {
      queryEstimado = cliente_id.length === 1
        ? queryEstimado.eq('cliente_id', cliente_id[0])
        : queryEstimado.in('cliente_id', cliente_id);
    }
    if (produto_id && produto_id.length > 0) {
      queryEstimado = produto_id.length === 1
        ? queryEstimado.eq('produto_id', produto_id[0])
        : queryEstimado.in('produto_id', produto_id);
    }
    if (tipo_tarefa_id && tipo_tarefa_id.length > 0) {
      queryEstimado = tipo_tarefa_id.length === 1
        ? queryEstimado.eq('tipo_tarefa_id', tipo_tarefa_id[0])
        : queryEstimado.in('tipo_tarefa_id', tipo_tarefa_id);
    }
    if (tarefa_id && tarefa_id.length > 0) {
      queryEstimado = tarefa_id.length === 1
        ? queryEstimado.eq('tarefa_id', tarefa_id[0])
        : queryEstimado.in('tarefa_id', tarefa_id);
    }

    const { data: estimadosData, error: errEstimados } = await queryEstimado;
    if (errEstimados) throw errEstimados;
    const estimados = estimadosData ?? [];

    // 4️⃣ Buscar vigência
    const { data: vigenciasData, error: errVigencias } = await supabase.schema(SCHEMA)
      .from('custo_membro_vigencia')
      .select('*')
      .in('membro_id', membroIds)
      .lte('dt_vigencia', data_fim)
      .order('dt_vigencia', { ascending: false });
    if (errVigencias) throw errVigencias;
    const vigencias = vigenciasData ?? [];
    const vigenciaPorMembro = new Map<number, Vigencia>();
    for (const v of vigencias) {
      if (!vigenciaPorMembro.has(v.membro_id)) vigenciaPorMembro.set(v.membro_id, v);
    }

    // 5️⃣ Agregar nomes
    const clienteIds = Array.from(new Set([...registros.map((r: RegistroTempo) => r.cliente_id), ...estimados.map((e: EstimadoRegra) => e.cliente_id)])).filter(Boolean) as string[];
    const produtoIds = Array.from(new Set([...registros.map((r: RegistroTempo) => r.produto_id), ...estimados.map((e: EstimadoRegra) => e.produto_id)])).filter(Boolean) as string[];
    const tipoTarefaIds = Array.from(new Set([...registros.map((r: RegistroTempo) => r.tipo_tarefa_id), ...estimados.map((e: EstimadoRegra) => e.tipo_tarefa_id)])).filter(Boolean) as string[];
    const tarefaIdsRaw = Array.from(new Set([...registros.map((r: RegistroTempo) => r.tarefa_id), ...estimados.map((e: EstimadoRegra) => e.tarefa_id)])).filter(Boolean);
    const tarefaIds = tarefaIdsRaw.map((id) => String(id));

    const nomeColaborador: NomeMap = {};
    membros.forEach((m: Membro) => { nomeColaborador[String(m.id)] = m.nome ?? ''; });

    const nomeCliente: NomeMap = {};
    const nomeProduto: NomeMap = {};
    const nomeTipoTarefa: NomeMap = {};
    const nomeTarefa: NomeMap = {};

    if (clienteIds.length) {
      const { data: clientes } = await supabase.schema(SCHEMA).from('cp_cliente').select('id, nome').in('id', clienteIds);
      clientes?.forEach((c: { id: string | number; nome?: string }) => {
        nomeCliente[String(c.id)] = c.nome ?? '';
      });
    }
    if (produtoIds.length) {
      const { data: produtos } = await supabase.schema(SCHEMA).from('cp_produto').select('id, nome').in('id', produtoIds);
      produtos?.forEach((p: { id: string | number; nome?: string }) => {
        nomeProduto[String(p.id)] = p.nome ?? '';
      });
    }
    if (tipoTarefaIds.length) {
      const { data: tipos } = await supabase.schema(SCHEMA).from('cp_tarefa_tipo').select('id, nome').in('id', tipoTarefaIds);
      tipos?.forEach((t: { id: string | number; nome?: string }) => {
        nomeTipoTarefa[String(t.id)] = t.nome ?? '';
      });
    }
    if (tarefaIds.length) {
      const tarefaIdsNum = tarefaIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
      const idsQuery = tarefaIdsNum.length === tarefaIds.length ? tarefaIdsNum : tarefaIds;
      const { data: tarefas } = await supabase.schema(SCHEMA).from('cp_tarefa').select('id, nome').in('id', idsQuery);
      tarefas?.forEach((t: Record<string, unknown>) => {
        const key = String(t.id);
        const nome = String(t.nome ?? t.Nome ?? t.name ?? t.titulo ?? '').trim();
        nomeTarefa[key] = nome;
      });
    }

    // 5.1️⃣ Buscar nomes dos tipos de contrato
    const nomeTipoContrato: NomeMap = {};
    const { data: tiposContratoData } = await supabase.schema(SCHEMA).from('cp_tipo_contrato_membro').select('id, nome');
    tiposContratoData?.forEach((tc: { id: number; nome: string }) => {
      nomeTipoContrato[String(tc.id)] = tc.nome;
    });

    // 6️⃣ Feriados
    const feriados = ignorar_feriados ? await getFeriados(data_inicio, data_fim) : [];

    // 7️⃣ Hierarquia global
    const hierarquia = montarHierarquia({
      registros,
      estimados,
      ordem_niveis,
      usuarioParaMembro,
      nomeColaborador,
      nomeCliente,
      nomeProduto,
      nomeTipoTarefa,
      nomeTarefa,
      data_inicio,
      data_fim,
      ignorar_finais_semana,
      feriados
    });

    adicionarFormatosNaHierarquia(hierarquia);
    adicionarTotalizadoresNaHierarquia(hierarquia, ordem_niveis, 0, registros, estimados, usuarioParaMembro);
    adicionarCustoNaHierarquia(hierarquia, ordem_niveis, 0, registros, estimados, usuarioParaMembro, vigenciaPorMembro, data_inicio, data_fim, ignorar_finais_semana, feriados, nomeTipoContrato);
    reordenarResumoAntesDeDetalhes(hierarquia);

    // Totalizadores globais (distintos no período)
    const colaboradorIdsResumo = new Set<number>();
    registros.forEach((r: RegistroTempo) => {
      const mid = usuarioParaMembro.get(r.usuario_id) ?? r.usuario_id;
      colaboradorIdsResumo.add(mid);
    });
    estimados.forEach((e: EstimadoRegra) => colaboradorIdsResumo.add(e.responsavel_id));

    const resumoTotalizadores = {
      total_tarefas: tarefaIds.length,
      total_produtos: produtoIds.length,
      total_clientes: clienteIds.length,
      total_colaboradores: colaboradorIdsResumo.size,
    };

    // Período filtrado e quantidade de dias úteis (considerando finais de semana e feriados conforme parâmetros)
    const quantidadeDias = diasNaInterseccao(data_inicio, data_fim, data_inicio, data_fim, !!ignorar_finais_semana, feriados);
    const periodo = {
      data_inicio,
      data_fim,
      quantidade_dias: quantidadeDias,
      ignorar_finais_semana: !!ignorar_finais_semana,
      ignorar_feriados: !!ignorar_feriados,
      ignorar_folgas: !!ignorar_folgas,
    };

    // Gerar resumo percorrendo a árvore pronta (evita reconstrução dupla)
    const nivelRaiz = ordem_niveis[0];
    const RESUMO_KEYS: Record<string, string> = {
      colaborador: 'resumo_colaboradores',
      cliente: 'resumo_clientes',
      produto: 'resumo_produtos',
      tipo_tarefa: 'resumo_tipos_tarefa',
      tarefa: 'resumo_tarefas'
    };
    const resumoKey = RESUMO_KEYS[nivelRaiz] || `resumo_${nivelRaiz}s`;

    const resumoPorNivel: Record<string, any> = {};
    for (const [id, node] of Object.entries(hierarquia)) {
      const { detalhes, ...resumoItem } = node;
      resumoPorNivel[id] = resumoItem;
    }

    const finalResult = {
      success: true,
      periodo,
      data: hierarquia,
      resumo: resumoTotalizadores,
      [resumoKey]: resumoPorNivel
    };

    // Proteção anti-JSON gigante
    const jsonSize = JSON.stringify(finalResult).length;
    if (jsonSize > 15_000_000) {
      throw new Error("Resposta excede limite seguro");
    }

    console.log("[GESTAO-CAPACIDADE] tempo:", Date.now() - start, "ms");
    console.timeEnd('TotalRequest');
    return c.json(finalResult);

  } catch (error: unknown) {
    console.error('[CARDS-ENDPOINT] Error:', error);
    const message = extrairMensagemErro(error);
    return c.json({ success: false, error: message }, 500 as const);
  }
}
