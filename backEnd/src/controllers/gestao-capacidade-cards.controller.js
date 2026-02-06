// =============================================================
// === CONTROLLER GESTÃO DE CAPACIDADE - CARDS (Pai + Filhos) ===
// =============================================================
// Um POST por tipo de filtro; retorna card pai + detalhes (filhos) no mesmo payload.
// Garante integridade: busca TODOS os dados necessários (sem truncar resultados).
// Proteção: retorna erro 400 se mais de 500 IDs (requer múltiplas requisições no frontend).

const supabase = require('../config/database');
const { buscarTodosComPaginacao } = require('../services/database-utils');
const vigenciaService = require('../services/custo-membro-vigencia.service');
const { calcularRegistrosDinamicos } = require('./tempo-estimado.controller');

// Limite apenas para proteção contra requisições excessivamente grandes (retorna erro, não trunca)
// Valores acima disso devem ser divididos em múltiplas requisições pelo frontend
const MAX_IDS_PROTECAO = 500;
const PAGINATION_LIMIT = 1000;

function normalizarDataStr(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val.includes('T') ? val.split('T')[0] : val.slice(0, 10);
  if (typeof val === 'number') return new Date(val).toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 10);
}

/**
 * Valida body comum e normaliza parâmetros. Retorna null e envia 400 em caso de erro.
 */
function validateAndNormalizeBody(req, res) {
  const {
    ids,
    data_inicio,
    data_fim,
    considerar_finais_semana = false,
    considerar_feriados = false,
    filtros_adicionais = {},
    incluir_detalhes = false
  } = req.body || {};

  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ success: false, error: 'ids (array) é obrigatório' });
    return null;
  }
  const idList = ids.map(id => String(id).trim()).filter(Boolean);
  if (idList.length === 0) {
    res.status(400).json({ success: false, error: 'ids não pode ser vazio' });
    return null;
  }
  if (idList.length > MAX_IDS_PROTECAO) {
    res.status(400).json({
      success: false,
      error: `Muitos IDs na requisição (${idList.length}). Máximo recomendado: ${MAX_IDS_PROTECAO}. Divida em múltiplas requisições para garantir dados completos.`
    });
    return null;
  }

  if (!data_inicio || !data_fim) {
    res.status(400).json({ success: false, error: 'data_inicio e data_fim são obrigatórios' });
    return null;
  }
  const dataInicio = normalizarDataStr(data_inicio);
  const dataFim = normalizarDataStr(data_fim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ success: false, error: 'data_inicio e data_fim inválidos' });
    return null;
  }

  const fa = filtros_adicionais && typeof filtros_adicionais === 'object' ? filtros_adicionais : {};
  const filtrosAdicionais = {
    cliente_id: fa.cliente_id != null ? (Array.isArray(fa.cliente_id) ? fa.cliente_id : [fa.cliente_id]).map(String).filter(Boolean) : [],
    produto_id: fa.produto_id != null ? (Array.isArray(fa.produto_id) ? fa.produto_id : [fa.produto_id]).map(String).filter(Boolean) : [],
    tarefa_id: fa.tarefa_id != null ? (Array.isArray(fa.tarefa_id) ? fa.tarefa_id : [fa.tarefa_id]).map(String).filter(Boolean) : []
  };

  return {
    ids: idList,
    dataInicio,
    dataFim,
    considerarFinaisSemana: considerar_finais_semana === true || considerar_finais_semana === 'true',
    considerarFeriados: considerar_feriados === true || considerar_feriados === 'true',
    filtrosAdicionais,
    incluirDetalhes: incluir_detalhes === true || incluir_detalhes === 'true'
  };
}

/**
 * Contrato canônico: todo nó da árvore deve ter tempo_estimado e tempo_realizado.
 * Garante total_estimado_ms e total_realizado_ms (0 se ausente).
 */
function noCanonico(node) {
  if (!node || typeof node !== 'object') return node;
  return {
    ...node,
    total_estimado_ms: node.total_estimado_ms ?? node.tempo_estimado_ms ?? 0,
    total_realizado_ms: node.total_realizado_ms ?? node.tempo_realizado_ms ?? 0
  };
}

/** Aplica contrato canônico (estimado/realizado) à árvore de detalhes (raiz + clientes, tarefas, produtos). */
function normalizarDataDetalhes(data) {
  if (!Array.isArray(data)) return [];
  return data.map(noCanonico).map(item => {
    const out = { ...item };
    if (Array.isArray(out.clientes)) out.clientes = out.clientes.map(noCanonico);
    if (Array.isArray(out.tarefas)) out.tarefas = out.tarefas.map(noCanonico);
    if (Array.isArray(out.produtos)) out.produtos = out.produtos.map(noCanonico);
    return out;
  });
}

// --- Tempo realizado: agregar por responsavel e por (responsavel, tarefa/cliente/produto) ---
async function getRealizadoPorResponsavel(supabaseClient, opts) {
  const {
    usuarioIds,
    dataInicioStr,
    dataFimStr,
    usuarioParaMembro,
    filtrosAdicionais,
    withBreakdown
  } = opts;
  if (!usuarioIds || usuarioIds.length === 0) return { porMembro: {}, breakdown: { tarefas: {}, clientes: {}, produtos: {} } };

  const inicioStr = `${dataInicioStr}T00:00:00`;
  const fimStr = `${dataFimStr}T23:59:59.999`;
  const orConditions = [
    `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
    `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
    `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
    `and(data_inicio.lte.${fimStr},data_fim.is.null)`
  ].join(',');

  const criarQuery = () => {
    let q = supabaseClient
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
      .or(orConditions)
      .not('tempo_realizado', 'is', null)
      .in('usuario_id', usuarioIds);
    if (filtrosAdicionais.cliente_id?.length) q = q.not('cliente_id', 'is', null);
    if (filtrosAdicionais.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id);
    if (filtrosAdicionais.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id);
    return q;
  };

  let registros;
  try {
    registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
  } catch (e) {
    console.error('❌ [GESTAO-CAPACIDADE] Erro registro_tempo:', e);
    return { porMembro: {}, breakdown: { tarefas: {}, clientes: {}, produtos: {} } };
  }

  if (filtrosAdicionais.cliente_id?.length && registros?.length) {
    const norm = filtrosAdicionais.cliente_id.map(c => String(c).trim().toLowerCase());
    registros = registros.filter(reg => {
      const ids = String(reg.cliente_id || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      return ids.some(id => norm.includes(id));
    });
  }

  const porMembro = {};
  const breakdown = { tarefas: {}, clientes: {}, produtos: {}, tarefaClientes: {} };

  (registros || []).forEach(reg => {
    if (reg.cliente_id === null && reg.produto_id === null) return;
    const membroId = usuarioParaMembro[reg.usuario_id];
    if (!membroId) return;

    let tempo = Number(reg.tempo_realizado) || 0;
    if (!tempo && reg.data_inicio) {
      const d1 = new Date(reg.data_inicio).getTime();
      const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
      tempo = Math.max(0, d2 - d1);
    }
    if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);

    const key = String(membroId);
    if (!porMembro[key]) porMembro[key] = 0;
    porMembro[key] += tempo;

    if (withBreakdown) {
      const mid = key;
      const tid = reg.tarefa_id != null ? String(reg.tarefa_id) : null;
      if (tid) {
        const tk = `${mid}_${tid}`;
        if (!breakdown.tarefas[tk]) breakdown.tarefas[tk] = 0;
        breakdown.tarefas[tk] += tempo;
      }
      const clienteIds = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      const nClientes = clienteIds.length || 1;
      const tempoPorCliente = tempo / nClientes;
      clienteIds.forEach(cid => {
        const ck = `${mid}_${cid}`;
        if (!breakdown.clientes[ck]) breakdown.clientes[ck] = 0;
        breakdown.clientes[ck] += tempoPorCliente;
        if (tid) {
          const tck = `${mid}_${tid}_${cid}`;
          breakdown.tarefaClientes[tck] = (breakdown.tarefaClientes[tck] || 0) + tempoPorCliente;
        }
      });
      if (reg.produto_id != null) {
        const pk = `${mid}_${reg.produto_id}`;
        if (!breakdown.produtos[pk]) breakdown.produtos[pk] = 0;
        breakdown.produtos[pk] += tempo;
      }
    }
  });

  return { porMembro, breakdown };
}

// --- Pendentes por responsavel (soma tempo_pendente) ---
async function getPendentesPorResponsavel(supabaseClient, opts) {
  const { usuarioIds, dataInicioStr, dataFimStr, usuarioParaMembro } = opts;
  if (!usuarioIds || usuarioIds.length === 0) return {};

  const inicioStr = `${dataInicioStr}T00:00:00`;
  const fimStr = `${dataFimStr}T23:59:59.999`;
  const orConditions = [
    `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
    `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
    `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
    `and(data_inicio.lte.${fimStr},data_fim.is.null)`
  ].join(',');

  const criarQuery = () => supabaseClient
    .from('registro_tempo_pendente')
    .select('data_inicio, data_fim, usuario_id')
    .or(orConditions)
    .in('usuario_id', usuarioIds);

  let pendentes;
  try {
    pendentes = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
  } catch (e) {
    return {};
  }

  const porMembro = {};
  (pendentes || []).forEach(p => {
    const mid = usuarioParaMembro[p.usuario_id];
    if (!mid) return;
    const key = String(mid);
    if (!porMembro[key]) porMembro[key] = 0;
    const d1 = new Date(p.data_inicio).getTime();
    const d2 = p.data_fim ? new Date(p.data_fim).getTime() : Date.now();
    porMembro[key] += Math.max(0, d2 - d1);
  });
  return porMembro;
}

// --- Tempo realizado: agregar por cliente e por (cliente, tarefa/produto/responsavel) ---
async function getRealizadoPorCliente(supabaseClient, opts) {
  const {
    clienteIds,
    dataInicioStr,
    dataFimStr,
    filtrosAdicionais,
    withBreakdown
  } = opts;
  if (!clienteIds || clienteIds.length === 0) return { porCliente: {}, breakdown: { tarefas: {}, produtos: {}, responsaveis: {} } };

  const inicioStr = `${dataInicioStr}T00:00:00`;
  const fimStr = `${dataFimStr}T23:59:59.999`;
  const orConditions = [
    `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
    `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
    `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
    `and(data_inicio.lte.${fimStr},data_fim.is.null)`
  ].join(',');

  const criarQuery = () => {
    let q = supabaseClient
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
      .or(orConditions)
      .not('tempo_realizado', 'is', null)
      .not('cliente_id', 'is', null);
    if (filtrosAdicionais?.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id);
    if (filtrosAdicionais?.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id);
    return q;
  };

  let registros;
  try {
    registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
  } catch (e) {
    return { porCliente: {}, breakdown: { tarefas: {}, produtos: {}, responsaveis: {} } };
  }

  // Filtrar por clienteIds
  if (registros?.length) {
    const norm = clienteIds.map(c => String(c).trim().toLowerCase());
    registros = registros.filter(reg => {
      const list = String(reg.cliente_id || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      return list.some(c => norm.includes(c));
    });
  }

  const porCliente = {};
  const breakdown = { tarefas: {}, produtos: {}, responsaveis: {}, produtoTarefas: {} };
  (registros || []).forEach(reg => {
    const list = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
    let tempo = Number(reg.tempo_realizado) || 0;
    if (!tempo && reg.data_inicio) {
      const d1 = new Date(reg.data_inicio).getTime();
      const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
      tempo = Math.max(0, d2 - d1);
    }
    if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
    list.forEach(cid => {
      if (!clienteIds.includes(cid)) return;
      const key = String(cid);
      if (!porCliente[key]) porCliente[key] = 0;
      porCliente[key] += tempo;
      if (withBreakdown) {
        if (reg.tarefa_id != null) {
          const tk = `${key}_${reg.tarefa_id}`;
          breakdown.tarefas[tk] = (breakdown.tarefas[tk] || 0) + tempo;
        }
        if (reg.produto_id != null) {
          const pk = `${key}_${reg.produto_id}`;
          breakdown.produtos[pk] = (breakdown.produtos[pk] || 0) + tempo;
          if (reg.tarefa_id != null) {
            const ptk = `${key}_${reg.produto_id}_${reg.tarefa_id}`;
            breakdown.produtoTarefas[ptk] = (breakdown.produtoTarefas[ptk] || 0) + tempo;
          }
        }
        if (reg.usuario_id) {
          breakdown.responsaveis[`${key}_${reg.usuario_id}`] = (breakdown.responsaveis[`${key}_${reg.usuario_id}`] || 0) + tempo;
        }
      }
    });
  });

  return { porCliente, breakdown };
}

// --- Tempo realizado: agregar por produto e por (produto, tarefa/cliente/responsavel) ---
async function getRealizadoPorProduto(supabaseClient, opts) {
  const {
    produtoIds,
    dataInicioStr,
    dataFimStr,
    filtrosAdicionais,
    withBreakdown
  } = opts;
  if (!produtoIds || produtoIds.length === 0) return { porProduto: {}, breakdown: { tarefas: {}, clientes: {}, responsaveis: {} } };

  const inicioStr = `${dataInicioStr}T00:00:00`;
  const fimStr = `${dataFimStr}T23:59:59.999`;
  const orConditions = [
    `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
    `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
    `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
    `and(data_inicio.lte.${fimStr},data_fim.is.null)`
  ].join(',');

  const criarQuery = () => {
    let q = supabaseClient
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
      .or(orConditions)
      .not('tempo_realizado', 'is', null)
      .in('produto_id', produtoIds);
    if (filtrosAdicionais?.cliente_id?.length) q = q.not('cliente_id', 'is', null);
    if (filtrosAdicionais?.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id);
    return q;
  };

  let registros;
  try {
    registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
  } catch (e) {
    return { porProduto: {}, breakdown: { tarefas: {}, clientes: {}, responsaveis: {} } };
  }

  const porProduto = {};
  const breakdown = { tarefas: {}, clientes: {}, responsaveis: {}, clienteTarefas: {} };
  const tempoSemTarefaPorProduto = {};
  const tempoSemClientePorProduto = {};
  (registros || []).forEach(reg => {
    const pid = String(reg.produto_id);
    if (!produtoIds.includes(Number(reg.produto_id))) return;
    let tempo = Number(reg.tempo_realizado) || 0;
    if (!tempo && reg.data_inicio) {
      const d1 = new Date(reg.data_inicio).getTime();
      const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
      tempo = Math.max(0, d2 - d1);
    }
    if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
    if (!porProduto[pid]) porProduto[pid] = 0;
    porProduto[pid] += tempo;
    if (withBreakdown) {
      const tid = reg.tarefa_id != null ? String(reg.tarefa_id) : 'sem_tarefa';
      if (reg.tarefa_id != null) {
        const tk = `${pid}_${reg.tarefa_id}`;
        breakdown.tarefas[tk] = (breakdown.tarefas[tk] || 0) + tempo;
      } else {
        tempoSemTarefaPorProduto[pid] = (tempoSemTarefaPorProduto[pid] || 0) + tempo;
      }
      const clienteIds = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      const nClientes = clienteIds.length || 1;
      if (nClientes > 0) {
        const tempoPorCliente = tempo / nClientes;
        clienteIds.forEach(cid => {
          const ck = `${pid}_${cid}`;
          breakdown.clientes[ck] = (breakdown.clientes[ck] || 0) + tempoPorCliente;
          const keyCt = `${pid}_${cid}_${tid}`;
          breakdown.clienteTarefas[keyCt] = (breakdown.clienteTarefas[keyCt] || 0) + tempoPorCliente;
        });
      } else {
        tempoSemClientePorProduto[pid] = (tempoSemClientePorProduto[pid] || 0) + tempo;
      }
      if (reg.usuario_id) {
        breakdown.responsaveis[`${pid}_${reg.usuario_id}`] = (breakdown.responsaveis[`${pid}_${reg.usuario_id}`] || 0) + tempo;
      }
    }
  });
  if (withBreakdown) {
    produtoIds.forEach(pid => {
      const idStr = String(pid);
      const msTarefa = tempoSemTarefaPorProduto[idStr] || 0;
      const msCliente = tempoSemClientePorProduto[idStr] || 0;
      if (msTarefa > 0) breakdown.tarefas[`${idStr}_sem_tarefa`] = msTarefa;
      if (msCliente > 0) breakdown.clientes[`${idStr}_sem_cliente`] = msCliente;
    });
  }

  return { porProduto, breakdown };
}

// --- Tempo realizado: agregar por tarefa e por (tarefa, produto/cliente/responsavel) ---
async function getRealizadoPorTarefa(supabaseClient, opts) {
  const {
    tarefaIds,
    dataInicioStr,
    dataFimStr,
    filtrosAdicionais,
    withBreakdown
  } = opts;
  if (!tarefaIds || tarefaIds.length === 0) return { porTarefa: {}, breakdown: { produtos: {}, clientes: {}, responsaveis: {} } };

  const inicioStr = `${dataInicioStr}T00:00:00`;
  const fimStr = `${dataFimStr}T23:59:59.999`;
  const orConditions = [
    `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
    `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
    `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
    `and(data_inicio.lte.${fimStr},data_fim.is.null)`
  ].join(',');

  const criarQuery = () => {
    let q = supabaseClient
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
      .or(orConditions)
      .not('tempo_realizado', 'is', null)
      .in('tarefa_id', tarefaIds);
    if (filtrosAdicionais?.cliente_id?.length) q = q.not('cliente_id', 'is', null);
    if (filtrosAdicionais?.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id);
    return q;
  };

  let registros;
  try {
    registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
  } catch (e) {
    return { porTarefa: {}, breakdown: { produtos: {}, clientes: {}, responsaveis: {} } };
  }

  const porTarefa = {};
  const breakdown = { produtos: {}, clientes: {}, responsaveis: {}, clienteTarefas: {}, produtoClienteTarefas: {} };
  const tempoSemClientePorTarefa = {};
  (registros || []).forEach(reg => {
    const tid = String(reg.tarefa_id);
    if (!tarefaIds.includes(Number(reg.tarefa_id))) return;
    let tempo = Number(reg.tempo_realizado) || 0;
    if (!tempo && reg.data_inicio) {
      const d1 = new Date(reg.data_inicio).getTime();
      const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
      tempo = Math.max(0, d2 - d1);
    }
    if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
    if (!porTarefa[tid]) porTarefa[tid] = 0;
    porTarefa[tid] += tempo;
    if (withBreakdown) {
      const pid = reg.produto_id != null ? String(reg.produto_id) : null;
      if (pid) {
        const pk = `${tid}_${pid}`;
        breakdown.produtos[pk] = (breakdown.produtos[pk] || 0) + tempo;
      }
      const clienteIds = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      const nClientes = clienteIds.length || 1;
      if (nClientes > 0) {
        const tempoPorCliente = tempo / nClientes;
        clienteIds.forEach(cid => {
          const ck = `${tid}_${cid}`;
          breakdown.clientes[ck] = (breakdown.clientes[ck] || 0) + tempoPorCliente;
          const keyCt = `${tid}_${cid}_${tid}`;
          breakdown.clienteTarefas[keyCt] = (breakdown.clienteTarefas[keyCt] || 0) + tempoPorCliente;
          if (pid) {
            const keyPct = `${tid}_${pid}_${cid}`;
            breakdown.produtoClienteTarefas[keyPct] = (breakdown.produtoClienteTarefas[keyPct] || 0) + tempoPorCliente;
          }
        });
      } else {
        tempoSemClientePorTarefa[tid] = (tempoSemClientePorTarefa[tid] || 0) + tempo;
      }
      if (reg.usuario_id) {
        breakdown.responsaveis[`${tid}_${reg.usuario_id}`] = (breakdown.responsaveis[`${tid}_${reg.usuario_id}`] || 0) + tempo;
      }
    }
  });
  if (withBreakdown) {
    tarefaIds.forEach(tid => {
      const idStr = String(tid);
      const msCliente = tempoSemClientePorTarefa[idStr] || 0;
      if (msCliente > 0) breakdown.clientes[`${idStr}_sem_cliente`] = msCliente;
    });
  }

  return { porTarefa, breakdown };
}

// --- Calcular apenas contagens (sem montar arrays) para total_tarefas, total_clientes, total_produtos ---
async function getContagensDetalhesResponsavel(supabaseClient, opts) {
  const {
    responsavelIds,
    dataInicioStr,
    dataFimStr,
    realizadoBreakdown
  } = opts;

  const contagens = {}; // { responsavelId: { tarefas: Set, clientes: Set, produtos: Set } }
  responsavelIds.forEach(rid => {
    contagens[String(rid)] = { tarefas: new Set(), clientes: new Set(), produtos: new Set() };
  });

  // Contagens do realizado (breakdown já tem as chaves)
  if (realizadoBreakdown) {
    Object.keys(realizadoBreakdown.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) {
        const rid = parts[0];
        const tid = parts.slice(1).join('_');
        if (contagens[rid]) contagens[rid].tarefas.add(tid);
      }
    });
    Object.keys(realizadoBreakdown.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) {
        const rid = parts[0];
        const cid = parts.slice(1).join('_');
        if (contagens[rid]) contagens[rid].clientes.add(cid);
      }
    });
    Object.keys(realizadoBreakdown.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) {
        const rid = parts[0];
        const pid = parts.slice(1).join('_');
        if (contagens[rid]) contagens[rid].produtos.add(pid);
      }
    });
  }

  // Contagens do estimado (buscar regras mas só contar, não calcular totais)
  const criarQuery = () => supabaseClient
    .from('tempo_estimado_regra')
    .select('responsavel_id, cliente_id, produto_id, tarefa_id')
    .in('responsavel_id', responsavelIds)
    .lte('data_inicio', `${dataFimStr}T23:59:59.999`)
    .gte('data_fim', `${dataInicioStr}T00:00:00`);

  try {
    const regras = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
    regras.forEach(regra => {
      const rid = String(regra.responsavel_id);
      if (!contagens[rid]) return;
      if (regra.tarefa_id != null) contagens[rid].tarefas.add(String(regra.tarefa_id));
      if (regra.cliente_id != null) contagens[rid].clientes.add(String(regra.cliente_id).trim());
      if (regra.produto_id != null) contagens[rid].produtos.add(String(regra.produto_id));
    });
  } catch (e) {
    console.warn('⚠️ Erro ao contar detalhes:', e.message);
  }

  const resultado = {};
  Object.keys(contagens).forEach(rid => {
    resultado[rid] = {
      total_tarefas: contagens[rid].tarefas.size,
      total_clientes: contagens[rid].clientes.size,
      total_produtos: contagens[rid].produtos.size
    };
  });
  return resultado;
}

// --- Detalhes estimado por responsavel (tarefas, clientes, produtos) a partir de regras ---
async function getDetalhesEstimadoResponsavel(supabaseClient, opts) {
  const {
    responsavelIds,
    dataInicioStr,
    dataFimStr,
    considerarFinaisSemana,
    considerarFeriados
  } = opts;

  const criarQuery = () => supabaseClient
    .from('tempo_estimado_regra')
    .select('id, responsavel_id, cliente_id, produto_id, tarefa_id, data_inicio, data_fim, tempo_estimado_dia, incluir_finais_semana')
    .in('responsavel_id', responsavelIds)
    .lte('data_inicio', `${dataFimStr}T23:59:59.999`)
    .gte('data_fim', `${dataInicioStr}T00:00:00`)
    .order('data_inicio', { ascending: false });

  let regras;
  try {
    // IMPORTANTE: Buscar TODAS as regras sem limite para garantir detalhes completos
    // buscarTodosComPaginacao já faz paginação automática até buscar tudo
    regras = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: true });
  } catch (e) {
    console.error('❌ [GESTAO-CAPACIDADE] Erro tempo_estimado_regra:', e);
    return { tarefas: {}, clientes: {}, produtos: {} };
  }

  const detalhes = { tarefas: {}, clientes: {}, produtos: {} };
  const cacheFeriados = {};
  const pInicio = `${dataInicioStr}T00:00:00`;
  const pFim = `${dataFimStr}T23:59:59.999`;

  for (const regra of regras) {
    try {
      const incluirFinais = considerarFinaisSemana && (regra.incluir_finais_semana !== false);
      const expandidos = await calcularRegistrosDinamicos(regra, pInicio, pFim, cacheFeriados, incluirFinais, considerarFeriados);
      const qtdDias = expandidos.length;
      if (qtdDias === 0) continue;

      let tempoMs = Number(regra.tempo_estimado_dia) || 0;
      if (tempoMs > 0 && tempoMs < 1000) tempoMs = Math.round(tempoMs * 3600000);
      const totalRegra = qtdDias * tempoMs;
      const rid = String(regra.responsavel_id);

      if (regra.tarefa_id != null) {
        const tk = `${rid}_${regra.tarefa_id}`;
        detalhes.tarefas[tk] = (detalhes.tarefas[tk] || 0) + totalRegra;
      }
      if (regra.cliente_id != null) {
        const ck = `${rid}_${String(regra.cliente_id).trim()}`;
        detalhes.clientes[ck] = (detalhes.clientes[ck] || 0) + totalRegra;
      }
      if (regra.produto_id != null) {
        const pk = `${rid}_${regra.produto_id}`;
        detalhes.produtos[pk] = (detalhes.produtos[pk] || 0) + totalRegra;
      }
    } catch (e) {
      console.warn('⚠️ Regra detalhe estimado:', e.message);
    }
  }

  return detalhes;
}

// --- Detalhes estimado por cliente (tarefas, produtos, responsaveis) a partir de regras ---
async function getDetalhesEstimadoCliente(supabaseClient, opts) {
  const {
    clienteIds,
    dataInicioStr,
    dataFimStr,
    considerarFinaisSemana,
    considerarFeriados,
    filtrosAdicionais
  } = opts;

  const criarQuery = () => {
    let q = supabaseClient
      .from('tempo_estimado_regra')
      .select('id, responsavel_id, cliente_id, produto_id, tarefa_id, data_inicio, data_fim, tempo_estimado_dia, incluir_finais_semana')
      .not('cliente_id', 'is', null)
      .lte('data_inicio', `${dataFimStr}T23:59:59.999`)
      .gte('data_fim', `${dataInicioStr}T00:00:00`);
    if (filtrosAdicionais?.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)));
    if (filtrosAdicionais?.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)));
    return q.order('data_inicio', { ascending: false });
  };

  let regras;
  try {
    regras = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: true });
  } catch (e) {
    console.error('❌ [GESTAO-CAPACIDADE] Erro tempo_estimado_regra (cliente):', e);
    return { tarefas: {}, produtos: {}, responsaveis: {} };
  }

  // Filtrar regras que correspondem aos clienteIds (cliente_id pode ser string com vírgulas)
  const clienteIdsNorm = clienteIds.map(c => String(c).trim().toLowerCase());
  regras = regras.filter(regra => {
    const clienteIdsRegra = String(regra.cliente_id || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return clienteIdsRegra.some(cid => clienteIdsNorm.includes(cid));
  });

  const detalhes = { tarefas: {}, produtos: {}, responsaveis: {}, produtoTarefas: {} };
  const cacheFeriados = {};
  const pInicio = `${dataInicioStr}T00:00:00`;
  const pFim = `${dataFimStr}T23:59:59.999`;

  for (const regra of regras) {
    try {
      const incluirFinais = considerarFinaisSemana && (regra.incluir_finais_semana !== false);
      const expandidos = await calcularRegistrosDinamicos(regra, pInicio, pFim, cacheFeriados, incluirFinais, considerarFeriados);
      const qtdDias = expandidos.length;
      if (qtdDias === 0) continue;

      let tempoMs = Number(regra.tempo_estimado_dia) || 0;
      if (tempoMs > 0 && tempoMs < 1000) tempoMs = Math.round(tempoMs * 3600000);
      const totalRegra = qtdDias * tempoMs;

      // Para cada cliente na regra que corresponde aos clienteIds solicitados
      const clienteIdsRegra = String(regra.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      clienteIdsRegra.forEach(cid => {
        if (!clienteIdsNorm.includes(cid.toLowerCase())) return;
        const cidStr = String(cid);

        if (regra.tarefa_id != null) {
          const tk = `${cidStr}_${regra.tarefa_id}`;
          detalhes.tarefas[tk] = (detalhes.tarefas[tk] || 0) + totalRegra;
        }
        if (regra.produto_id != null) {
          const pk = `${cidStr}_${regra.produto_id}`;
          detalhes.produtos[pk] = (detalhes.produtos[pk] || 0) + totalRegra;
          if (regra.tarefa_id != null) {
            const ptk = `${cidStr}_${regra.produto_id}_${regra.tarefa_id}`;
            detalhes.produtoTarefas[ptk] = (detalhes.produtoTarefas[ptk] || 0) + totalRegra;
          }
        }
        if (regra.responsavel_id != null) {
          const rk = `${cidStr}_${regra.responsavel_id}`;
          detalhes.responsaveis[rk] = (detalhes.responsaveis[rk] || 0) + totalRegra;
        }
      });
    } catch (e) {
      console.warn('⚠️ Regra detalhe estimado (cliente):', e.message);
    }
  }

  return detalhes;
}

// --- Detalhes estimado por produto (tarefas, clientes, responsaveis) a partir de regras ---
async function getDetalhesEstimadoProduto(supabaseClient, opts) {
  const {
    produtoIds,
    dataInicioStr,
    dataFimStr,
    considerarFinaisSemana,
    considerarFeriados,
    filtrosAdicionais
  } = opts;

  const criarQuery = () => {
    let q = supabaseClient
      .from('tempo_estimado_regra')
      .select('id, responsavel_id, cliente_id, produto_id, tarefa_id, data_inicio, data_fim, tempo_estimado_dia, incluir_finais_semana')
      .in('produto_id', produtoIds)
      .lte('data_inicio', `${dataFimStr}T23:59:59.999`)
      .gte('data_fim', `${dataInicioStr}T00:00:00`);
    if (filtrosAdicionais?.cliente_id?.length) q = q.not('cliente_id', 'is', null);
    if (filtrosAdicionais?.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)));
    return q.order('data_inicio', { ascending: false });
  };

  let regras;
  try {
    regras = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: true });
  } catch (e) {
    console.error('❌ [GESTAO-CAPACIDADE] Erro tempo_estimado_regra (produto):', e);
    return { tarefas: {}, clientes: {}, responsaveis: {} };
  }

  const detalhes = { tarefas: {}, clientes: {}, responsaveis: {}, clienteTarefas: {} };
  const cacheFeriados = {};
  const pInicio = `${dataInicioStr}T00:00:00`;
  const pFim = `${dataFimStr}T23:59:59.999`;

  for (const regra of regras) {
    try {
      const incluirFinais = considerarFinaisSemana && (regra.incluir_finais_semana !== false);
      const expandidos = await calcularRegistrosDinamicos(regra, pInicio, pFim, cacheFeriados, incluirFinais, considerarFeriados);
      const qtdDias = expandidos.length;
      if (qtdDias === 0) continue;

      let tempoMs = Number(regra.tempo_estimado_dia) || 0;
      if (tempoMs > 0 && tempoMs < 1000) tempoMs = Math.round(tempoMs * 3600000);
      const totalRegra = qtdDias * tempoMs;
      const pid = String(regra.produto_id);

      if (regra.tarefa_id != null) {
        const tk = `${pid}_${regra.tarefa_id}`;
        detalhes.tarefas[tk] = (detalhes.tarefas[tk] || 0) + totalRegra;
      }
      const clienteIds = String(regra.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      clienteIds.forEach(cid => {
        const ck = `${pid}_${cid}`;
        detalhes.clientes[ck] = (detalhes.clientes[ck] || 0) + totalRegra;
        if (regra.tarefa_id != null) {
          const ctk = `${pid}_${cid}_${regra.tarefa_id}`;
          detalhes.clienteTarefas[ctk] = (detalhes.clienteTarefas[ctk] || 0) + totalRegra;
        }
      });
      if (regra.responsavel_id != null) {
        const rk = `${pid}_${regra.responsavel_id}`;
        detalhes.responsaveis[rk] = (detalhes.responsaveis[rk] || 0) + totalRegra;
      }
    } catch (e) {
      console.warn('⚠️ Regra detalhe estimado (produto):', e.message);
    }
  }

  return detalhes;
}

// --- Detalhes estimado por tarefa (produtos, clientes, responsaveis) a partir de regras ---
async function getDetalhesEstimadoTarefa(supabaseClient, opts) {
  const {
    tarefaIds,
    dataInicioStr,
    dataFimStr,
    considerarFinaisSemana,
    considerarFeriados,
    filtrosAdicionais
  } = opts;

  const criarQuery = () => {
    let q = supabaseClient
      .from('tempo_estimado_regra')
      .select('id, responsavel_id, cliente_id, produto_id, tarefa_id, data_inicio, data_fim, tempo_estimado_dia, incluir_finais_semana')
      .in('tarefa_id', tarefaIds)
      .lte('data_inicio', `${dataFimStr}T23:59:59.999`)
      .gte('data_fim', `${dataInicioStr}T00:00:00`);
    if (filtrosAdicionais?.cliente_id?.length) q = q.not('cliente_id', 'is', null);
    if (filtrosAdicionais?.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)));
    return q.order('data_inicio', { ascending: false });
  };

  let regras;
  try {
    regras = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: true });
  } catch (e) {
    console.error('❌ [GESTAO-CAPACIDADE] Erro tempo_estimado_regra (tarefa):', e);
    return { produtos: {}, clientes: {}, responsaveis: {} };
  }

  const detalhes = { produtos: {}, clientes: {}, responsaveis: {} };
  const cacheFeriados = {};
  const pInicio = `${dataInicioStr}T00:00:00`;
  const pFim = `${dataFimStr}T23:59:59.999`;

  for (const regra of regras) {
    try {
      const incluirFinais = considerarFinaisSemana && (regra.incluir_finais_semana !== false);
      const expandidos = await calcularRegistrosDinamicos(regra, pInicio, pFim, cacheFeriados, incluirFinais, considerarFeriados);
      const qtdDias = expandidos.length;
      if (qtdDias === 0) continue;

      let tempoMs = Number(regra.tempo_estimado_dia) || 0;
      if (tempoMs > 0 && tempoMs < 1000) tempoMs = Math.round(tempoMs * 3600000);
      const totalRegra = qtdDias * tempoMs;
      const tid = String(regra.tarefa_id);

      if (regra.produto_id != null) {
        const pk = `${tid}_${regra.produto_id}`;
        detalhes.produtos[pk] = (detalhes.produtos[pk] || 0) + totalRegra;
      }
      const clienteIds = String(regra.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      clienteIds.forEach(cid => {
        const ck = `${tid}_${cid}`;
        detalhes.clientes[ck] = (detalhes.clientes[ck] || 0) + totalRegra;
      });
      if (regra.responsavel_id != null) {
        const rk = `${tid}_${regra.responsavel_id}`;
        detalhes.responsaveis[rk] = (detalhes.responsaveis[rk] || 0) + totalRegra;
      }
    } catch (e) {
      console.warn('⚠️ Regra detalhe estimado (tarefa):', e.message);
    }
  }

  return detalhes;
}

// --- POST /api/gestao-capacidade/cards/responsavel ---
async function cardsResponsavel(req, res) {
  try {
    const params = validateAndNormalizeBody(req, res);
    if (!params) return;

    const { ids, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, incluirDetalhes } = params;

    const { data: membros, error: errMembros } = await supabase
      .from('membro')
      .select('id, usuario_id, nome')
      .in('id', ids);

    if (errMembros) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar membros', details: errMembros.message });
    }

    const membrosList = membros || [];
    const usuarioParaMembro = {};
    const membroPorId = {};
    membrosList.forEach(m => {
      if (m && m.id != null) {
        usuarioParaMembro[m.usuario_id] = m.id;
        membroPorId[String(m.id)] = m;
      }
    });
    const usuarioIds = Object.keys(usuarioParaMembro);
    if (usuarioIds.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const responsavelIdsStr = membrosList.map(m => String(m.id));

    const realizadoResult = await getRealizadoPorResponsavel(supabase, {
      usuarioIds,
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      usuarioParaMembro,
      filtrosAdicionais,
      withBreakdown: incluirDetalhes
    });

    const promisesBase = [
      supabase.rpc('get_tempo_estimado_total_agregado', {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_considerar_finais_semana: considerarFinaisSemana,
        p_responsavel_ids: responsavelIdsStr,
        p_cliente_ids: filtrosAdicionais.cliente_id?.length ? filtrosAdicionais.cliente_id : null,
        p_produto_ids: filtrosAdicionais.produto_id?.length ? filtrosAdicionais.produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
        p_tarefa_ids: filtrosAdicionais.tarefa_id?.length ? filtrosAdicionais.tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
        p_agrupar_por: 'responsavel'
      }),
      Promise.resolve(realizadoResult),
      getPendentesPorResponsavel(supabase, {
        usuarioIds,
        dataInicioStr: dataInicio,
        dataFimStr: dataFim,
        usuarioParaMembro
      }),
      vigenciaService.buscarHorasContratadasLote(ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n)), dataFim),
      vigenciaService.buscarCustoMaisRecenteLote(ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n)), dataFim)
    ];

    if (incluirDetalhes) {
      promisesBase.push(getDetalhesEstimadoResponsavel(supabase, {
        responsavelIds: responsavelIdsStr,
        dataInicioStr: dataInicio,
        dataFimStr: dataFim,
        considerarFinaisSemana,
        considerarFeriados
      }));
    } else {
      promisesBase.push(getContagensDetalhesResponsavel(supabase, {
        responsavelIds: responsavelIdsStr,
        dataInicioStr: dataInicio,
        dataFimStr: dataFim,
        realizadoBreakdown: realizadoResult.breakdown
      }));
    }

    const [rpcEstimado, , pendentesResult, horasLote, custoLote, detalhesOuContagens] = await Promise.all(promisesBase);

    const estimadoPorId = {};
    if (!rpcEstimado.error && rpcEstimado.data && Array.isArray(rpcEstimado.data)) {
      rpcEstimado.data.forEach(row => {
        if (row && row.entity_id != null) {
          estimadoPorId[String(row.entity_id).trim()] = Number(row.total_ms) || 0;
        }
      });
    }

    const tipoContratoIds = new Set();
    (Object.values(horasLote.data || {})).forEach(v => {
      if (v && v.tipo_contrato != null) tipoContratoIds.add(v.tipo_contrato);
    });
    let tiposContratoMap = {};
    if (tipoContratoIds.size > 0) {
      const { data: tiposData } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tipo_contrato_membro')
        .select('id, nome')
        .in('id', [...tipoContratoIds]);
      (tiposData || []).forEach(t => { tiposContratoMap[t.id] = t.nome || null; });
    }

    // Se incluirDetalhes=false, detalhesOuContagens contém apenas contagens
    // Se incluirDetalhes=true, detalhesOuContagens contém objetos de detalhes completos
    const detalhesEstimado = incluirDetalhes ? detalhesOuContagens : null;
    const contagens = incluirDetalhes ? null : detalhesOuContagens;

    const nomeTarefa = {};
    const nomeCliente = {};
    const nomeProduto = {};

    // Só buscar nomes se precisar montar arrays de detalhes
    if (incluirDetalhes) {
      const tarefaIds = new Set();
      const clienteIds = new Set();
      const produtoIds = new Set();
      if (realizadoResult.breakdown) {
        Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
        });
        Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
        });
        Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
        });
      }
      if (detalhesEstimado) {
        Object.keys(detalhesEstimado.tarefas || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
        });
        Object.keys(detalhesEstimado.clientes || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
        });
        Object.keys(detalhesEstimado.produtos || {}).forEach(k => {
          const parts = k.split('_');
          if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
        });
      }

      const [tarefasNomes, clientesNomes, produtosNomes] = await Promise.all([
        tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds]) : { data: [] },
        clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
        produtoIds.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIds]) : { data: [] }
      ]);

      (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome || null; });
      (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome || null; });
      (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome || null; });
    }

    const data = {};
    const horasData = horasLote.data || {};
    const custoData = custoLote.data || {};

    for (const m of membrosList) {
      const idStr = String(m.id);
      const totalEstimadoMs = estimadoPorId[idStr] || 0;
      const totalRealizadoMs = realizadoResult.porMembro[idStr] || 0;
      const totalPendenteMs = pendentesResult[idStr] || 0;

      const vigencia = horasData[m.id];
      const horasDia = vigencia ? (Number(vigencia.horascontratadasdia) || 0) : 0;
      const diasNoPeriodo = Math.ceil((new Date(dataFim) - new Date(dataInicio)) / (24 * 60 * 60 * 1000)) + 1;
      const totalContratadoMs = horasDia * diasNoPeriodo * 3600000;
      const totalDisponivelMs = Math.max(0, totalContratadoMs - totalEstimadoMs);

      const custoRow = custoData[m.id];
      let custoEstimado = 0;
      let custoHoraNum = 0;
      if (custoRow && (custoRow.custohora || custoRow.custo_hora)) {
        custoHoraNum = Number(custoRow.custohora ?? custoRow.custo_hora) || 0;
        custoEstimado = (totalEstimadoMs / (3600 * 1000)) * custoHoraNum;
      }

      const tipoContrato = vigencia?.tipo_contrato ?? null;
      const tipoContratoNome = tipoContrato != null ? (tiposContratoMap[tipoContrato] || null) : null;

      let detalhesTarefas = [];
      let detalhesClientes = [];
      let detalhesProdutos = [];
      let totalTarefas = 0;
      let totalClientes = 0;
      let totalProdutos = 0;

      if (incluirDetalhes && detalhesEstimado) {
        // Montar arrays completos de detalhes
        const seenTarefas = new Set();
        const seenClientes = new Set();
        const seenProdutos = new Set();

        const addTarefa = (tid, estimadoMs, realizadoMs, custo) => {
          const key = `${idStr}_${tid}`;
          if (seenTarefas.has(key)) return;
          seenTarefas.add(key);
          const eMs = estimadoMs || (detalhesEstimado.tarefas[key] || 0);
          const rMs = realizadoMs || (realizadoResult.breakdown?.tarefas?.[key] || 0);
          let c = custo;
          if (c == null && custoRow && (custoRow.custohora || custoRow.custo_hora)) {
            c = (eMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
          }
          detalhesTarefas.push({
            id: `t${tid}_c0_p0`,
            original_id: String(tid),
            nome: nomeTarefa[String(tid)] || `Tarefa #${tid}`,
            total_estimado_ms: eMs,
            total_realizado_ms: rMs,
            custo_estimado: c != null ? c : 0
          });
        };
        const addCliente = (cid, estimadoMs, realizadoMs, custo) => {
          const key = `${idStr}_${cid}`;
          if (seenClientes.has(key)) return;
          seenClientes.add(key);
          const eMs = estimadoMs || (detalhesEstimado.clientes[key] || 0);
          const rMs = realizadoMs || (realizadoResult.breakdown?.clientes?.[key] || 0);
          let c = custo;
          if (c == null && custoRow && (custoRow.custohora || custoRow.custo_hora)) {
            c = (eMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
          }
          detalhesClientes.push({
            id: String(cid),
            nome: nomeCliente[String(cid)] || `Cliente #${cid}`,
            total_estimado_ms: eMs,
            total_realizado_ms: rMs,
            custo_estimado: c != null ? c : 0
          });
        };
        const addProduto = (pid, estimadoMs, realizadoMs, custo) => {
          const key = `${idStr}_${pid}`;
          if (seenProdutos.has(key)) return;
          seenProdutos.add(key);
          const eMs = estimadoMs || (detalhesEstimado.produtos[key] || 0);
          const rMs = realizadoMs || (realizadoResult.breakdown?.produtos?.[key] || 0);
          let c = custo;
          if (c == null && custoRow && (custoRow.custohora || custoRow.custo_hora)) {
            c = (eMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
          }
          detalhesProdutos.push({
            id: String(pid),
            nome: nomeProduto[String(pid)] || `Produto #${pid}`,
            total_estimado_ms: eMs,
            total_realizado_ms: rMs,
            custo_estimado: c != null ? c : 0
          });
        };

        Object.keys(detalhesEstimado.tarefas || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const tid = k.slice(idStr.length + 1);
          addTarefa(tid, detalhesEstimado.tarefas[k], realizadoResult.breakdown?.tarefas?.[k]);
        });
        Object.keys(realizadoResult.breakdown?.tarefas || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const tid = k.slice(idStr.length + 1);
          if (!seenTarefas.has(`${idStr}_${tid}`)) addTarefa(tid, detalhesEstimado.tarefas[`${idStr}_${tid}`], realizadoResult.breakdown.tarefas[k]);
        });

        Object.keys(detalhesEstimado.clientes || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const cid = k.slice(idStr.length + 1);
          addCliente(cid, detalhesEstimado.clientes[k], realizadoResult.breakdown?.clientes?.[k]);
        });
        Object.keys(realizadoResult.breakdown?.clientes || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const cid = k.slice(idStr.length + 1);
          if (!seenClientes.has(`${idStr}_${cid}`)) addCliente(cid, detalhesEstimado.clientes[`${idStr}_${cid}`], realizadoResult.breakdown.clientes[k]);
        });

        Object.keys(detalhesEstimado.produtos || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const pid = k.slice(idStr.length + 1);
          addProduto(pid, detalhesEstimado.produtos[k], realizadoResult.breakdown?.produtos?.[k]);
        });
        Object.keys(realizadoResult.breakdown?.produtos || {}).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const pid = k.slice(idStr.length + 1);
          if (!seenProdutos.has(`${idStr}_${pid}`)) addProduto(pid, detalhesEstimado.produtos[`${idStr}_${pid}`], realizadoResult.breakdown.produtos[k]);
        });

        totalTarefas = detalhesTarefas.length;
        totalClientes = detalhesClientes.length;
        totalProdutos = detalhesProdutos.length;
      } else {
        // Usar apenas contagens (sem montar arrays)
        const contagensCard = contagens?.[idStr] || {};
        totalTarefas = contagensCard.total_tarefas || 0;
        totalClientes = contagensCard.total_clientes || 0;
        totalProdutos = contagensCard.total_produtos || 0;
      }

      data[idStr] = {
        id: m.id,
        nome: m.nome || `Responsável #${m.id}`,
        foto_perfil: null,
        foto_perfil_path: null,
        tipo_contrato: tipoContrato,
        tipo_contrato_nome: tipoContratoNome,
        total_estimado_ms: totalEstimadoMs,
        total_realizado_ms: totalRealizadoMs,
        total_contratado_ms: totalContratadoMs,
        total_disponivel_ms: totalDisponivelMs,
        custo_estimado: Math.round(custoEstimado * 100) / 100,
        custo_hora: custoHoraNum,
        horas_contratadas_dia: horasDia,
        total_tarefas: totalTarefas,
        total_clientes: totalClientes,
        total_produtos: totalProdutos,
        detalhes: incluirDetalhes ? {
          tarefas: detalhesTarefas,
          clientes: detalhesClientes,
          produtos: detalhesProdutos
        } : {}
      };
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] cardsResponsavel:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// --- POST /api/gestao-capacidade/cards/cliente ---
async function cardsCliente(req, res) {
  try {
    const params = validateAndNormalizeBody(req, res);
    if (!params) return;

    const { ids, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, incluirDetalhes } = params;

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_tempo_estimado_total_agregado', {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_considerar_finais_semana: considerarFinaisSemana,
      p_cliente_ids: ids,
      p_responsavel_ids: null,
      p_produto_ids: filtrosAdicionais.produto_id?.length ? filtrosAdicionais.produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
      p_tarefa_ids: filtrosAdicionais.tarefa_id?.length ? filtrosAdicionais.tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
      p_agrupar_por: 'cliente'
    });

    const estimadoPorCliente = {};
    if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
      rpcRows.forEach(row => {
        if (row && row.entity_id != null) {
          estimadoPorCliente[String(row.entity_id).trim()] = Number(row.total_ms) || 0;
        }
      });
    }

    const inicioStr = `${dataInicio}T00:00:00`;
    const fimStr = `${dataFim}T23:59:59.999`;
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
      `and(data_inicio.lte.${fimStr},data_fim.is.null)`
    ].join(',');

    const criarQueryRealizado = () => {
      let q = supabase
        .from('registro_tempo')
        .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
        .or(orConditions)
        .not('tempo_realizado', 'is', null);
      if (ids.length) {
        const norm = ids.map(c => String(c).trim().toLowerCase());
        q = q.not('cliente_id', 'is', null);
      }
      if (filtrosAdicionais.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id);
      if (filtrosAdicionais.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id);
      return q;
    };

    let registros;
    try {
      registros = await buscarTodosComPaginacao(criarQueryRealizado, { limit: PAGINATION_LIMIT, logProgress: false });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar realizado' });
    }

    if (ids.length && registros?.length) {
      const norm = ids.map(c => String(c).trim().toLowerCase());
      registros = registros.filter(reg => {
        const list = String(reg.cliente_id || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return list.some(c => norm.includes(c));
      });
    }

    const realizadoPorCliente = {};
    const breakdown = { tarefas: {}, produtos: {}, responsaveis: {} };
    (registros || []).forEach(reg => {
      const list = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      let tempo = Number(reg.tempo_realizado) || 0;
      if (!tempo && reg.data_inicio) {
        const d1 = new Date(reg.data_inicio).getTime();
        const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
        tempo = Math.max(0, d2 - d1);
      }
      if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
      list.forEach(cid => {
        if (!ids.includes(cid)) return;
        const key = String(cid);
        realizadoPorCliente[key] = (realizadoPorCliente[key] || 0) + tempo;
        if (reg.tarefa_id != null) {
          const tk = `${key}_${reg.tarefa_id}`;
          breakdown.tarefas[tk] = (breakdown.tarefas[tk] || 0) + tempo;
        }
        if (reg.produto_id != null) {
          const pk = `${key}_${reg.produto_id}`;
          breakdown.produtos[pk] = (breakdown.produtos[pk] || 0) + tempo;
        }
        if (reg.usuario_id) {
          breakdown.responsaveis[`${key}_${reg.usuario_id}`] = (breakdown.responsaveis[`${key}_${reg.usuario_id}`] || 0) + tempo;
        }
      });
    });

    const { data: clientesList } = await supabase.from('cp_cliente').select('id, nome').in('id', ids);
    const clientePorId = {};
    (clientesList || []).forEach(c => { clientePorId[String(c.id)] = c; });

    const usuarioIdsResponsaveis = [...new Set(Object.keys(breakdown.responsaveis).map(k => k.split('_').slice(1).join('_')))];
    let usuarioParaMembro = {};
    if (usuarioIdsResponsaveis.length) {
      const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsResponsaveis);
      (membros || []).forEach(m => { usuarioParaMembro[m.usuario_id] = m.id; });
    }

    const nomeTarefa = {};
    const nomeProduto = {};
    const nomeMembro = {};

    // Só buscar nomes se precisar montar arrays de detalhes
    if (incluirDetalhes) {
      const tarefaIds = new Set();
      const produtoIdsSet = new Set();
      const responsavelIdsSet = new Set();
      Object.keys(breakdown.tarefas).forEach(k => tarefaIds.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.produtos).forEach(k => produtoIdsSet.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.responsaveis).forEach(k => responsavelIdsSet.add(usuarioParaMembro[k.split('_').slice(1).join('_')]));

      const [tarefasNomes, produtosNomes, membrosNomes] = await Promise.all([
        tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds]) : { data: [] },
        produtoIdsSet.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIdsSet]) : { data: [] },
        responsavelIdsSet.size ? supabase.from('membro').select('id, nome').in('id', [...responsavelIdsSet]) : { data: [] }
      ]);

      (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome; });
      (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome; });
      (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });
    }

    const data = {};
    for (const cid of ids) {
      const idStr = String(cid);
      const cliente = clientePorId[idStr] || { id: cid, nome: `Cliente #${cid}` };
      const totalEstimado = estimadoPorCliente[idStr] || 0;
      const totalRealizado = realizadoPorCliente[idStr] || 0;

      let detalhesTarefas = [];
      let detalhesProdutos = [];
      let detalhesResponsaveis = [];
      let totalTarefas = 0;
      let totalProdutos = 0;
      let totalResponsaveis = 0;

      if (incluirDetalhes) {
        Object.keys(breakdown.tarefas).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const tid = k.split('_').slice(1).join('_');
          detalhesTarefas.push({
            id: `t${tid}_c${idStr}_p0`,
            original_id: String(tid),
            nome: nomeTarefa[tid] || `Tarefa #${tid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.tarefas[k] || 0,
            custo_estimado: 0
          });
        });
        Object.keys(breakdown.produtos).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const pid = k.split('_').slice(1).join('_');
          detalhesProdutos.push({
            id: String(pid),
            nome: nomeProduto[pid] || `Produto #${pid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.produtos[k] || 0,
            custo_estimado: 0
          });
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const uid = k.split('_').slice(1).join('_');
          const mid = usuarioParaMembro[uid];
          if (!mid) return;
          detalhesResponsaveis.push({
            id: mid,
            nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.responsaveis[k] || 0,
            custo_estimado: 0
          });
        });
        totalTarefas = detalhesTarefas.length;
        totalProdutos = detalhesProdutos.length;
        totalResponsaveis = detalhesResponsaveis.length;
      } else {
        // Calcular apenas contagens
        const tarefasSet = new Set();
        const produtosSet = new Set();
        const responsaveisSet = new Set();
        Object.keys(breakdown.tarefas).forEach(k => {
          if (k.startsWith(idStr + '_')) tarefasSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.produtos).forEach(k => {
          if (k.startsWith(idStr + '_')) produtosSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (k.startsWith(idStr + '_')) {
            const uid = k.split('_').slice(1).join('_');
            const mid = usuarioParaMembro[uid];
            if (mid) responsaveisSet.add(mid);
          }
        });
        totalTarefas = tarefasSet.size;
        totalProdutos = produtosSet.size;
        totalResponsaveis = responsaveisSet.size;
      }

      data[idStr] = {
        id: cliente.id,
        nome: cliente.nome,
        total_estimado_ms: totalEstimado,
        total_realizado_ms: totalRealizado,
        total_tarefas: totalTarefas,
        total_produtos: totalProdutos,
        total_responsaveis: totalResponsaveis,
        detalhes: incluirDetalhes ? {
          tarefas: detalhesTarefas,
          produtos: detalhesProdutos,
          responsaveis: detalhesResponsaveis
        } : {}
      };
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] cardsCliente:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

// --- POST /api/gestao-capacidade/cards/produto ---
async function cardsProduto(req, res) {
  try {
    const params = validateAndNormalizeBody(req, res);
    if (!params) return;

    const { ids, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, incluirDetalhes } = params;
    const idsNum = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    if (idsNum.length === 0) return res.json({ success: true, data: {} });

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_tempo_estimado_total_agregado', {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_considerar_finais_semana: considerarFinaisSemana,
      p_cliente_ids: filtrosAdicionais.cliente_id?.length ? filtrosAdicionais.cliente_id : null,
      p_responsavel_ids: null,
      p_produto_ids: idsNum,
      p_tarefa_ids: filtrosAdicionais.tarefa_id?.length ? filtrosAdicionais.tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
      p_agrupar_por: 'produto'
    });

    const estimadoPorProduto = {};
    if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
      rpcRows.forEach(row => {
        if (row && row.entity_id != null) {
          estimadoPorProduto[String(row.entity_id)] = Number(row.total_ms) || 0;
        }
      });
    }

    const inicioStr = `${dataInicio}T00:00:00`;
    const fimStr = `${dataFim}T23:59:59.999`;
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
      `and(data_inicio.lte.${fimStr},data_fim.is.null)`
    ].join(',');

    const criarQuery = () => {
      let q = supabase
        .from('registro_tempo')
        .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
        .or(orConditions)
        .not('tempo_realizado', 'is', null)
        .in('produto_id', idsNum);
      if (filtrosAdicionais.cliente_id?.length) q = q.not('cliente_id', 'is', null);
      if (filtrosAdicionais.tarefa_id?.length) q = q.in('tarefa_id', filtrosAdicionais.tarefa_id);
      return q;
    };

    let registros;
    try {
      registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar realizado' });
    }

    const realizadoPorProduto = {};
    const breakdown = { tarefas: {}, clientes: {}, responsaveis: {}, clienteTarefas: {} };
    const tempoSemTarefaPorProduto = {};
    const tempoSemClientePorProduto = {};
    (registros || []).forEach(reg => {
      const pid = String(reg.produto_id);
      let tempo = Number(reg.tempo_realizado) || 0;
      if (!tempo && reg.data_inicio) {
        const d1 = new Date(reg.data_inicio).getTime();
        const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
        tempo = Math.max(0, d2 - d1);
      }
      if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
      realizadoPorProduto[pid] = (realizadoPorProduto[pid] || 0) + tempo;
      const tid = reg.tarefa_id != null ? String(reg.tarefa_id) : 'sem_tarefa';
      if (reg.tarefa_id != null) {
        breakdown.tarefas[`${pid}_${reg.tarefa_id}`] = (breakdown.tarefas[`${pid}_${reg.tarefa_id}`] || 0) + tempo;
      } else {
        tempoSemTarefaPorProduto[pid] = (tempoSemTarefaPorProduto[pid] || 0) + tempo;
      }
      const cids = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      const nClientes = cids.length || 1;
      if (nClientes > 0) {
        const tempoPorCliente = tempo / nClientes;
        cids.forEach(cid => {
          breakdown.clientes[`${pid}_${cid}`] = (breakdown.clientes[`${pid}_${cid}`] || 0) + tempoPorCliente;
          const keyCt = `${pid}_${cid}_${tid}`;
          breakdown.clienteTarefas[keyCt] = (breakdown.clienteTarefas[keyCt] || 0) + tempoPorCliente;
        });
      } else {
        tempoSemClientePorProduto[pid] = (tempoSemClientePorProduto[pid] || 0) + tempo;
      }
      if (reg.usuario_id) breakdown.responsaveis[`${pid}_${reg.usuario_id}`] = (breakdown.responsaveis[`${pid}_${reg.usuario_id}`] || 0) + tempo;
    });
    idsNum.forEach(pid => {
      const idStr = String(pid);
      const msTarefa = tempoSemTarefaPorProduto[idStr] || 0;
      const msCliente = tempoSemClientePorProduto[idStr] || 0;
      if (msTarefa > 0) breakdown.tarefas[`${idStr}_sem_tarefa`] = msTarefa;
      if (msCliente > 0) breakdown.clientes[`${idStr}_sem_cliente`] = msCliente;
    });

    const { data: produtosList } = await supabase.from('cp_produto').select('id, nome').in('id', idsNum);
    const produtoPorId = {};
    (produtosList || []).forEach(p => { produtoPorId[String(p.id)] = p; });

    const usuarioIdsR = [...new Set(Object.keys(breakdown.responsaveis).map(k => k.split('_').slice(1).join('_')))];
    let usuarioParaMembro = {};
    if (usuarioIdsR.length) {
      const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsR);
      (membros || []).forEach(m => { usuarioParaMembro[m.usuario_id] = m.id; });
    }

    const nomeTarefa = {};
    const nomeCliente = {};
    const nomeMembro = {};

    // Só buscar nomes se precisar montar arrays de detalhes
    if (incluirDetalhes) {
      const tarefaIds = new Set();
      const clienteIds = new Set();
      const responsavelIds = new Set();
      Object.keys(breakdown.tarefas).forEach(k => tarefaIds.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.clientes).forEach(k => clienteIds.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.responsaveis).forEach(k => responsavelIds.add(usuarioParaMembro[k.split('_').slice(1).join('_')]));

      const [tarefasNomes, clientesNomes, membrosNomes] = await Promise.all([
        tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds]) : { data: [] },
        clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
        responsavelIds.size ? supabase.from('membro').select('id, nome').in('id', [...responsavelIds]) : { data: [] }
      ]);

      (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome; });
      (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome; });
      (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });
    }

    const data = {};
    for (const pid of idsNum) {
      const idStr = String(pid);
      const produto = produtoPorId[idStr] || { id: pid, nome: `Produto #${pid}` };
      let detalhesTarefas = [];
      let detalhesClientes = [];
      let detalhesResponsaveis = [];
      let totalTarefas = 0;
      let totalClientes = 0;
      let totalResponsaveis = 0;

      if (incluirDetalhes) {
        Object.keys(breakdown.tarefas).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const tid = k.split('_').slice(1).join('_');
          detalhesTarefas.push({
            id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c0_p${idStr}`,
            original_id: String(tid),
            nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.tarefas[k] || 0,
            custo_estimado: 0
          });
        });
        Object.keys(breakdown.clientes).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const cid = k.split('_').slice(1).join('_');
          const tarefasDoCliente = [];
          Object.keys(breakdown.clienteTarefas || {}).forEach(ctKey => {
            if (!ctKey.startsWith(`${idStr}_${cid}_`)) return;
            const tid = ctKey.split('_').slice(2).join('_');
            const totalRealizadoMs = breakdown.clienteTarefas[ctKey] || 0;
            tarefasDoCliente.push({
              id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c0_p${idStr}`,
              original_id: String(tid),
              nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
              total_estimado_ms: 0,
              total_realizado_ms: totalRealizadoMs
            });
          });
          detalhesClientes.push({
            id: String(cid),
            nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.clientes[k] || 0,
            custo_estimado: 0,
            tarefas: tarefasDoCliente
          });
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const uid = k.split('_').slice(1).join('_');
          const mid = usuarioParaMembro[uid];
          if (!mid) return;
          detalhesResponsaveis.push({
            id: mid,
            nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.responsaveis[k] || 0,
            custo_estimado: 0
          });
        });
        totalTarefas = detalhesTarefas.length;
        totalClientes = detalhesClientes.length;
        totalResponsaveis = detalhesResponsaveis.length;
      } else {
        // Calcular apenas contagens
        const tarefasSet = new Set();
        const clientesSet = new Set();
        const responsaveisSet = new Set();
        Object.keys(breakdown.tarefas).forEach(k => {
          if (k.startsWith(idStr + '_')) tarefasSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.clientes).forEach(k => {
          if (k.startsWith(idStr + '_')) clientesSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (k.startsWith(idStr + '_')) {
            const uid = k.split('_').slice(1).join('_');
            const mid = usuarioParaMembro[uid];
            if (mid) responsaveisSet.add(mid);
          }
        });
        totalTarefas = tarefasSet.size;
        totalClientes = clientesSet.size;
        totalResponsaveis = responsaveisSet.size;
      }

      data[idStr] = {
        id: produto.id,
        nome: produto.nome,
        total_estimado_ms: estimadoPorProduto[idStr] || 0,
        total_realizado_ms: realizadoPorProduto[idStr] || 0,
        total_tarefas: totalTarefas,
        total_clientes: totalClientes,
        total_responsaveis: totalResponsaveis,
        detalhes: incluirDetalhes ? {
          tarefas: detalhesTarefas,
          clientes: detalhesClientes,
          responsaveis: detalhesResponsaveis
        } : {}
      };
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] cardsProduto:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

// --- POST /api/gestao-capacidade/cards/tarefa ---
async function cardsTarefa(req, res) {
  try {
    const params = validateAndNormalizeBody(req, res);
    if (!params) return;

    const { ids, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, incluirDetalhes } = params;
    const idsNum = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    if (idsNum.length === 0) return res.json({ success: true, data: {} });

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_tempo_estimado_total_agregado', {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_considerar_finais_semana: considerarFinaisSemana,
      p_cliente_ids: filtrosAdicionais.cliente_id?.length ? filtrosAdicionais.cliente_id : null,
      p_responsavel_ids: null,
      p_produto_ids: filtrosAdicionais.produto_id?.length ? filtrosAdicionais.produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null,
      p_tarefa_ids: idsNum,
      p_agrupar_por: 'tarefa'
    });

    const estimadoPorTarefa = {};
    if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
      rpcRows.forEach(row => {
        if (row && row.entity_id != null) {
          estimadoPorTarefa[String(row.entity_id)] = Number(row.total_ms) || 0;
        }
      });
    }

    const inicioStr = `${dataInicio}T00:00:00`;
    const fimStr = `${dataFim}T23:59:59.999`;
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
      `and(data_inicio.lte.${fimStr},data_fim.is.null)`
    ].join(',');

    const criarQuery = () => {
      let q = supabase
        .from('registro_tempo')
        .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, usuario_id')
        .or(orConditions)
        .not('tempo_realizado', 'is', null)
        .in('tarefa_id', idsNum);
      if (filtrosAdicionais.cliente_id?.length) q = q.not('cliente_id', 'is', null);
      if (filtrosAdicionais.produto_id?.length) q = q.in('produto_id', filtrosAdicionais.produto_id);
      return q;
    };

    let registros;
    try {
      registros = await buscarTodosComPaginacao(criarQuery, { limit: PAGINATION_LIMIT, logProgress: false });
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar realizado' });
    }

    const realizadoPorTarefa = {};
    const breakdown = { produtos: {}, clientes: {}, responsaveis: {}, clienteTarefas: {}, produtoClienteTarefas: {} };
    const tempoSemClientePorTarefa = {};
    (registros || []).forEach(reg => {
      const tid = String(reg.tarefa_id);
      let tempo = Number(reg.tempo_realizado) || 0;
      if (!tempo && reg.data_inicio) {
        const d1 = new Date(reg.data_inicio).getTime();
        const d2 = reg.data_fim ? new Date(reg.data_fim).getTime() : Date.now();
        tempo = Math.max(0, d2 - d1);
      }
      if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);
      realizadoPorTarefa[tid] = (realizadoPorTarefa[tid] || 0) + tempo;
      const pid = reg.produto_id != null ? String(reg.produto_id) : null;
      if (pid) breakdown.produtos[`${tid}_${pid}`] = (breakdown.produtos[`${tid}_${pid}`] || 0) + tempo;
      const cids = String(reg.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean);
      const nClientes = cids.length || 1;
      if (nClientes > 0) {
        const tempoPorCliente = tempo / nClientes;
        cids.forEach(cid => {
          breakdown.clientes[`${tid}_${cid}`] = (breakdown.clientes[`${tid}_${cid}`] || 0) + tempoPorCliente;
          breakdown.clienteTarefas[`${tid}_${cid}_${tid}`] = (breakdown.clienteTarefas[`${tid}_${cid}_${tid}`] || 0) + tempoPorCliente;
          if (pid) breakdown.produtoClienteTarefas[`${tid}_${pid}_${cid}`] = (breakdown.produtoClienteTarefas[`${tid}_${pid}_${cid}`] || 0) + tempoPorCliente;
        });
      } else {
        tempoSemClientePorTarefa[tid] = (tempoSemClientePorTarefa[tid] || 0) + tempo;
      }
      if (reg.usuario_id) breakdown.responsaveis[`${tid}_${reg.usuario_id}`] = (breakdown.responsaveis[`${tid}_${reg.usuario_id}`] || 0) + tempo;
    });
    idsNum.forEach(tid => {
      const idStr = String(tid);
      const msCliente = tempoSemClientePorTarefa[idStr] || 0;
      if (msCliente > 0) breakdown.clientes[`${idStr}_sem_cliente`] = msCliente;
    });

    const { data: tarefasList } = await supabase.from('cp_tarefa').select('id, nome').in('id', idsNum);
    const tarefaPorId = {};
    (tarefasList || []).forEach(t => { tarefaPorId[String(t.id)] = t; });

    const usuarioIdsR = [...new Set(Object.keys(breakdown.responsaveis).map(k => k.split('_').slice(1).join('_')))];
    let usuarioParaMembro = {};
    if (usuarioIdsR.length) {
      const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsR);
      (membros || []).forEach(m => { usuarioParaMembro[m.usuario_id] = m.id; });
    }

    const nomeProduto = {};
    const nomeCliente = {};
    const nomeMembro = {};

    // Só buscar nomes se precisar montar arrays de detalhes
    if (incluirDetalhes) {
      const produtoIds = new Set();
      const clienteIds = new Set();
      const responsavelIds = new Set();
      Object.keys(breakdown.produtos).forEach(k => produtoIds.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.clientes).forEach(k => clienteIds.add(k.split('_').slice(1).join('_')));
      Object.keys(breakdown.responsaveis).forEach(k => responsavelIds.add(usuarioParaMembro[k.split('_').slice(1).join('_')]));

      const [produtosNomes, clientesNomes, membrosNomes] = await Promise.all([
        produtoIds.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIds]) : { data: [] },
        clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
        responsavelIds.size ? supabase.from('membro').select('id, nome').in('id', [...responsavelIds]) : { data: [] }
      ]);

      (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome; });
      (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome; });
      (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });
    }

    const data = {};
    for (const tid of idsNum) {
      const idStr = String(tid);
      const tarefa = tarefaPorId[idStr] || { id: tid, nome: `Tarefa #${tid}` };
      let detalhesProdutos = [];
      let detalhesClientes = [];
      let detalhesResponsaveis = [];
      let totalProdutos = 0;
      let totalClientes = 0;
      let totalResponsaveis = 0;

      if (incluirDetalhes) {
        Object.keys(breakdown.produtos).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const pid = k.split('_').slice(1).join('_');
          detalhesProdutos.push({
            id: String(pid),
            nome: nomeProduto[pid] || `Produto #${pid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.produtos[k] || 0,
            custo_estimado: 0
          });
        });
        Object.keys(breakdown.clientes).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const cid = k.split('_').slice(1).join('_');
          const tarefasDoCliente = [];
          Object.keys(breakdown.clienteTarefas || {}).forEach(ctKey => {
            if (!ctKey.startsWith(`${idStr}_${cid}_`)) return;
            const tidKey = ctKey.split('_').slice(2).join('_');
            const totalRealizadoMs = breakdown.clienteTarefas[ctKey] || 0;
            tarefasDoCliente.push({
              id: idStr,
              original_id: String(idStr),
              nome: tarefa.nome || `Tarefa #${idStr}`,
              total_estimado_ms: 0,
              total_realizado_ms: totalRealizadoMs
            });
          });
          detalhesClientes.push({
            id: String(cid),
            nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.clientes[k] || 0,
            custo_estimado: 0,
            tarefas: tarefasDoCliente
          });
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (!k.startsWith(idStr + '_')) return;
          const uid = k.split('_').slice(1).join('_');
          const mid = usuarioParaMembro[uid];
          if (!mid) return;
          detalhesResponsaveis.push({
            id: mid,
            nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
            total_estimado_ms: 0,
            total_realizado_ms: breakdown.responsaveis[k] || 0,
            custo_estimado: 0
          });
        });
        totalProdutos = detalhesProdutos.length;
        totalClientes = detalhesClientes.length;
        totalResponsaveis = detalhesResponsaveis.length;
      } else {
        // Calcular apenas contagens
        const produtosSet = new Set();
        const clientesSet = new Set();
        const responsaveisSet = new Set();
        Object.keys(breakdown.produtos).forEach(k => {
          if (k.startsWith(idStr + '_')) produtosSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.clientes).forEach(k => {
          if (k.startsWith(idStr + '_')) clientesSet.add(k.split('_').slice(1).join('_'));
        });
        Object.keys(breakdown.responsaveis).forEach(k => {
          if (k.startsWith(idStr + '_')) {
            const uid = k.split('_').slice(1).join('_');
            const mid = usuarioParaMembro[uid];
            if (mid) responsaveisSet.add(mid);
          }
        });
        totalProdutos = produtosSet.size;
        totalClientes = clientesSet.size;
        totalResponsaveis = responsaveisSet.size;
      }

      data[idStr] = {
        id: tarefa.id,
        nome: tarefa.nome,
        total_estimado_ms: estimadoPorTarefa[idStr] || 0,
        total_realizado_ms: realizadoPorTarefa[idStr] || 0,
        total_produtos: totalProdutos,
        total_clientes: totalClientes,
        total_responsaveis: totalResponsaveis,
        detalhes: incluirDetalhes ? {
          produtos: detalhesProdutos,
          clientes: detalhesClientes,
          responsaveis: detalhesResponsaveis
        } : {}
      };
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] cardsTarefa:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

// --- POST /api/gestao-capacidade/cards/{tipo}/detalhes ---
// Retorna apenas os detalhes de um card específico (sempre inclui detalhes completos)

const TIPOS_DETALHE_VALIDOS = ['tarefas', 'clientes', 'produtos', 'responsaveis'];

function validateDetalhesBody(req, res) {
  const {
    id,
    data_inicio,
    data_fim,
    considerar_finais_semana = false,
    considerar_feriados = false,
    filtros_adicionais = {},
    tipo_detalhe = 'tarefas'
  } = req.body || {};

  if (!id) {
    res.status(400).json({ success: false, error: 'id é obrigatório' });
    return null;
  }

  if (!data_inicio || !data_fim) {
    res.status(400).json({ success: false, error: 'data_inicio e data_fim são obrigatórios' });
    return null;
  }
  const dataInicio = normalizarDataStr(data_inicio);
  const dataFim = normalizarDataStr(data_fim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ success: false, error: 'data_inicio e data_fim inválidos' });
    return null;
  }

  const tipoDetalhe = typeof tipo_detalhe === 'string' ? tipo_detalhe.toLowerCase() : 'tarefas';
  if (!TIPOS_DETALHE_VALIDOS.includes(tipoDetalhe)) {
    res.status(400).json({ success: false, error: 'tipo_detalhe deve ser tarefas, clientes, produtos ou responsaveis' });
    return null;
  }

  const fa = filtros_adicionais && typeof filtros_adicionais === 'object' ? filtros_adicionais : {};
  const filtrosAdicionais = {
    cliente_id: fa.cliente_id != null ? (Array.isArray(fa.cliente_id) ? fa.cliente_id : [fa.cliente_id]).map(String).filter(Boolean) : [],
    produto_id: fa.produto_id != null ? (Array.isArray(fa.produto_id) ? fa.produto_id : [fa.produto_id]).map(String).filter(Boolean) : [],
    tarefa_id: fa.tarefa_id != null ? (Array.isArray(fa.tarefa_id) ? fa.tarefa_id : [fa.tarefa_id]).map(String).filter(Boolean) : []
  };

  return {
    id: String(id).trim(),
    dataInicio,
    dataFim,
    considerarFinaisSemana: considerar_finais_semana === true || considerar_finais_semana === 'true',
    considerarFeriados: considerar_feriados === true || considerar_feriados === 'true',
    filtrosAdicionais,
    tipoDetalhe
  };
}

async function detalhesResponsavel(req, res) {
  try {
    const params = validateDetalhesBody(req, res);
    if (!params) return;
    const { id, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, tipoDetalhe } = params;
    const idStr = String(id);

    const { data: membros, error: errMembros } = await supabase
      .from('membro')
      .select('id, usuario_id, nome')
      .eq('id', id);

    if (errMembros) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar membro', details: errMembros.message });
    }

    if (!membros || membros.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const membro = membros[0];
    const usuarioParaMembro = { [membro.usuario_id]: membro.id };
    const responsavelIdsStr = [String(membro.id)];

    const realizadoResult = await getRealizadoPorResponsavel(supabase, {
      usuarioIds: [membro.usuario_id],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      usuarioParaMembro,
      filtrosAdicionais,
      withBreakdown: true
    });

    const custoLote = await vigenciaService.buscarCustoMaisRecenteLote(responsavelIdsStr.map(Number), dataFim);
    const custoData = custoLote.data || {};
    const custoRow = custoData[membro.id];

    const detalhesObj = await getDetalhesEstimadoResponsavel(supabase, {
      responsavelIds: responsavelIdsStr,
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      considerarFinaisSemana,
      considerarFeriados,
      filtrosAdicionais
    });

    // detalhesObj = { tarefas: { "rid_tid": ms }, clientes: { "rid_cid": ms }, produtos: { "rid_pid": ms } }
    const tarefaIds = new Set();
    const clienteIds = new Set();
    const produtoIds = new Set();
    Object.keys(detalhesObj.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesObj.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesObj.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
    });
    if (realizadoResult.breakdown) {
      Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
        const parts = k.split('_');
        if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
      });
      Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
        const parts = k.split('_');
        if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
      });
      Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
        const parts = k.split('_');
        if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
      });
    }

    const [tarefasNomes, clientesNomes, produtosNomes] = await Promise.all([
      tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds]) : { data: [] },
      clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
      produtoIds.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIds]) : { data: [] }
    ]);

    const nomeTarefa = {};
    const nomeCliente = {};
    const nomeProduto = {};
    (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome; });
    (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome; });
    (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome; });

    const detalhesTarefas = [];
    const detalhesClientes = [];
    const detalhesProdutos = [];
    const seenTarefas = new Set();
    const seenClientes = new Set();
    const seenProdutos = new Set();

    Object.entries(detalhesObj.tarefas || {}).forEach(([key, totalEstimadoMs]) => {
      const parts = key.split('_');
      const tid = parts.length >= 2 ? parts.slice(1).join('_') : null;
      if (tid && !seenTarefas.has(tid)) {
        seenTarefas.add(tid);
        const rMs = realizadoResult.breakdown?.tarefas?.[key] || 0;
        let custo = 0;
        if (custoRow && (custoRow.custohora || custoRow.custo_hora)) {
          custo = (totalEstimadoMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
        }
        detalhesTarefas.push({
          id: `t${tid}_c0_p0`,
          original_id: String(tid),
          nome: nomeTarefa[String(tid)] || `Tarefa #${tid}`,
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: rMs,
          custo_estimado: custo
        });
      }
    });
    Object.entries(detalhesObj.clientes || {}).forEach(([key, totalEstimadoMs]) => {
      const parts = key.split('_');
      const cid = parts.length >= 2 ? parts.slice(1).join('_') : null;
      if (cid && !seenClientes.has(cid)) {
        seenClientes.add(cid);
        const rMs = realizadoResult.breakdown?.clientes?.[key] || 0;
        let custo = 0;
        if (custoRow && (custoRow.custohora || custoRow.custo_hora)) {
          custo = (totalEstimadoMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
        }
        detalhesClientes.push({
          id: String(cid),
          nome: nomeCliente[String(cid)] || `Cliente #${cid}`,
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: rMs,
          custo_estimado: custo
        });
      }
    });
    Object.entries(detalhesObj.produtos || {}).forEach(([key, totalEstimadoMs]) => {
      const parts = key.split('_');
      const pid = parts.length >= 2 ? parts.slice(1).join('_') : null;
      if (pid && !seenProdutos.has(pid)) {
        seenProdutos.add(pid);
        const rMs = realizadoResult.breakdown?.produtos?.[key] || 0;
        let custo = 0;
        if (custoRow && (custoRow.custohora || custoRow.custo_hora)) {
          custo = (totalEstimadoMs / (3600 * 1000)) * Number(custoRow.custohora ?? custoRow.custo_hora);
        }
        detalhesProdutos.push({
          id: String(pid),
          nome: nomeProduto[String(pid)] || `Produto #${pid}`,
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: rMs,
          custo_estimado: custo
        });
      }
    });

    // Adicionar clientes aninhados a cada tarefa (detalhesResponsavel tipo=tarefas): árvore Responsável > Tarefa > Cliente > Registros
    const tarefaClientesResp = realizadoResult.breakdown?.tarefaClientes || {};
    detalhesTarefas.forEach(tar => {
      const tid = tar.original_id || tar.id;
      const clientesDaTarefa = [];
      Object.keys(tarefaClientesResp).forEach(tcKey => {
        if (!tcKey.startsWith(`${idStr}_${tid}_`)) return;
        const cid = tcKey.split('_').slice(2).join('_');
        const totalRealizadoMs = tarefaClientesResp[tcKey] || 0;
        clientesDaTarefa.push({
          id: String(cid),
          nome: nomeCliente[cid] || `Cliente #${cid}`,
          total_estimado_ms: 0,
          total_realizado_ms: totalRealizadoMs
        });
      });
      tar.clientes = clientesDaTarefa;
    });

    const data = tipoDetalhe === 'tarefas' ? detalhesTarefas : tipoDetalhe === 'clientes' ? detalhesClientes : detalhesProdutos;
    return res.json({ success: true, data: normalizarDataDetalhes(data) });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] detalhesResponsavel:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

async function detalhesCliente(req, res) {
  try {
    const params = validateDetalhesBody(req, res);
    if (!params) return;
    const { id, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, tipoDetalhe } = params;
    
    console.log(`🔍 [DETALHES-CLIENTE] Buscando detalhes para cliente ${id}, tipo: ${tipoDetalhe}`);

    const { data: cliente, error: errCliente } = await supabase
      .from('cp_cliente')
      .select('id, nome')
      .eq('id', id)
      .single();

    if (errCliente || !cliente) {
      return res.json({ success: true, data: [] });
    }

    // Buscar breakdown de estimado usando regras de tempo estimado
    const detalhesEstimado = await getDetalhesEstimadoCliente(supabase, {
      clienteIds: [id],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      considerarFinaisSemana,
      considerarFeriados,
      filtrosAdicionais
    });

    // Buscar breakdown de realizado
    const realizadoResult = await getRealizadoPorCliente(supabase, {
      clienteIds: [id],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      filtrosAdicionais,
      withBreakdown: true
    });
    
    if (!realizadoResult) {
      realizadoResult = { breakdown: { tarefas: {}, produtos: {}, responsaveis: {}, produtoTarefas: {} } };
    } else if (!realizadoResult.breakdown) {
      realizadoResult.breakdown = { tarefas: {}, produtos: {}, responsaveis: {}, produtoTarefas: {} };
    }
    if (!realizadoResult.breakdown.produtoTarefas) {
      realizadoResult.breakdown.produtoTarefas = {};
    }

    // Coletar IDs únicos para buscar nomes
    const tarefaIds = new Set();
    const produtoIdsSet = new Set();
    const responsavelIdsSet = new Set();
    
    Object.keys(detalhesEstimado.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) produtoIdsSet.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });
    
    // Também coletar do breakdown de realizado
    Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) produtoIdsSet.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.produtoTarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 3) tarefaIds.add(parts.slice(2).join('_'));
    });
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });

    // Buscar mapeamento usuario_id -> membro_id para responsaveis
    const usuarioParaMembro = {};
    const membroIdsSet = new Set();
    if (responsavelIdsSet.size) {
      // responsavelIdsSet contém responsavel_id (não usuario_id), então buscar diretamente
      const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('id', [...responsavelIdsSet].map(id => parseInt(id, 10)).filter(n => !isNaN(n)));
      (membros || []).forEach(m => {
        membroIdsSet.add(m.id);
      });
    }

    // Buscar nomes
    const [tarefasNomes, produtosNomes, membrosNomes] = await Promise.all([
      tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds].map(id => parseInt(id, 10)).filter(n => !isNaN(n))) : { data: [] },
      produtoIdsSet.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIdsSet].map(id => parseInt(id, 10)).filter(n => !isNaN(n))) : { data: [] },
      membroIdsSet.size ? supabase.from('membro').select('id, nome').in('id', [...membroIdsSet]) : { data: [] }
    ]);

    const nomeTarefa = {}; (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome; });
    const nomeProduto = {}; (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome; });
    const nomeMembro = {}; (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });

    // Montar arrays de detalhes
    const detalhesTarefas = [];
    const detalhesProdutos = [];
    const detalhesResponsaveis = [];
    const idStr = String(id);
    const seenTarefas = new Set();
    const seenProdutos = new Set();
    const seenResponsaveis = new Set();

    // Processar tarefas
    Object.entries(detalhesEstimado.tarefas || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const tid = key.split('_').slice(1).join('_');
      if (seenTarefas.has(tid)) return;
      seenTarefas.add(tid);
      const realizadoMs = realizadoResult.breakdown?.tarefas?.[key] || 0;
      detalhesTarefas.push({
        id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c${idStr}_p0`,
        original_id: String(tid),
        nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar tarefas que só têm realizado
    Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const tid = k.split('_').slice(1).join('_');
      if (seenTarefas.has(tid)) return;
      seenTarefas.add(tid);
      detalhesTarefas.push({
        id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c${idStr}_p0`,
        original_id: String(tid),
        nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.tarefas[k] || 0,
        custo_estimado: 0
      });
    });

    // Processar produtos
    Object.entries(detalhesEstimado.produtos || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const pid = key.split('_').slice(1).join('_');
      if (seenProdutos.has(pid)) return;
      seenProdutos.add(pid);
      const realizadoMs = realizadoResult.breakdown?.produtos?.[key] || 0;
      detalhesProdutos.push({
        id: String(pid),
        nome: nomeProduto[pid] || `Produto #${pid}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar produtos que só têm realizado (ou que têm estimado no breakdown)
    Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const pid = k.split('_').slice(1).join('_');
      if (seenProdutos.has(pid)) return;
      seenProdutos.add(pid);
      const estimadoMs = detalhesEstimado.produtos?.[k] || 0;
      detalhesProdutos.push({
        id: String(pid),
        nome: nomeProduto[pid] || `Produto #${pid}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoResult.breakdown.produtos[k] || 0,
        custo_estimado: 0
      });
    });

    // Adicionar tarefas aninhadas a cada produto (detalhesCliente tipo=produtos): árvore Produto > Tarefa > Registros
    const produtoTarefasCliente = realizadoResult.breakdown.produtoTarefas || {};
    const produtoTarefasEstimado = detalhesEstimado.produtoTarefas || {};
    detalhesProdutos.forEach(prod => {
      const tarefasDoProduto = [];
      Object.keys(produtoTarefasCliente).forEach(ptKey => {
        if (!ptKey.startsWith(`${idStr}_${prod.id}_`)) return;
        const tid = ptKey.split('_').slice(2).join('_');
        const totalRealizadoMs = produtoTarefasCliente[ptKey] || 0;
        const totalEstimadoMs = produtoTarefasEstimado[ptKey] || 0;
        tarefasDoProduto.push({
          id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c${idStr}_p${prod.id}`,
          original_id: String(tid),
          nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: totalRealizadoMs
        });
      });
      prod.tarefas = tarefasDoProduto;
    });

    // Buscar mapeamentos usuario_id <-> responsavel_id
    const responsavelIdsEstimado = [...new Set(Object.keys(detalhesEstimado.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parseInt(parts.slice(1).join('_'), 10) : null;
    }).filter(n => !isNaN(n)))];
    const usuarioIdsRealizado = [...new Set(Object.keys(realizadoResult.breakdown.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parts.slice(1).join('_') : null;
    }).filter(Boolean))];
    
    const responsavelParaUsuario = {};
    const usuarioParaResponsavel = {};
    if (responsavelIdsEstimado.length > 0) {
      const { data: membrosEstimado } = await supabase.from('membro').select('id, usuario_id').in('id', responsavelIdsEstimado);
      (membrosEstimado || []).forEach(m => {
        responsavelParaUsuario[m.id] = m.usuario_id;
      });
    }
    if (usuarioIdsRealizado.length > 0) {
      const { data: membrosRealizado } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsRealizado);
      (membrosRealizado || []).forEach(m => {
        usuarioParaResponsavel[m.usuario_id] = m.id;
      });
    }

    // Processar responsaveis (usar responsavel_id diretamente)
    Object.entries(detalhesEstimado.responsaveis || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const rid = key.split('_').slice(1).join('_');
      const ridNum = parseInt(rid, 10);
      if (isNaN(ridNum) || seenResponsaveis.has(ridNum)) return;
      seenResponsaveis.add(ridNum);
      // Buscar usuario_id correspondente para encontrar o realizado
      const uid = responsavelParaUsuario[ridNum];
      const realizadoKey = uid ? `${idStr}_${uid}` : null;
      const realizadoMs = realizadoKey ? (realizadoResult.breakdown?.responsaveis?.[realizadoKey] || 0) : 0;
      detalhesResponsaveis.push({
        id: String(ridNum),
        nome: nomeMembro[String(ridNum)] || `Responsável #${ridNum}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar responsaveis que só têm realizado
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const uid = k.split('_').slice(1).join('_');
      const mid = usuarioParaResponsavel[uid];
      if (!mid || seenResponsaveis.has(mid)) return;
      seenResponsaveis.add(mid);
      detalhesResponsaveis.push({
        id: String(mid),
        nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.responsaveis[k] || 0,
        custo_estimado: 0
      });
    });

    // Mapear tipoDetalhe para o array correto (cliente tem: tarefas, produtos, responsaveis)
    const tipoMap = { tarefas: detalhesTarefas, produtos: detalhesProdutos, responsaveis: detalhesResponsaveis };
    const data = tipoMap[tipoDetalhe] || [];
    
    console.log(`✅ [DETALHES-CLIENTE] Retornando ${data.length} itens do tipo ${tipoDetalhe}`);
    return res.json({ success: true, data: normalizarDataDetalhes(data) });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] detalhesCliente:', error);
    console.error('❌ [GESTAO-CAPACIDADE] Stack:', error.stack);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

async function detalhesProduto(req, res) {
  try {
    const params = validateDetalhesBody(req, res);
    if (!params) return;
    const { id, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, tipoDetalhe } = params;

    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.json({ success: true, data: [] });
    }

    const { data: produto, error: errProduto } = await supabase
      .from('cp_produto')
      .select('id, nome')
      .eq('id', idNum)
      .single();

    if (errProduto || !produto) {
      return res.json({ success: true, data: [] });
    }

    // Buscar breakdown de estimado usando regras de tempo estimado
    const detalhesEstimado = await getDetalhesEstimadoProduto(supabase, {
      produtoIds: [idNum],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      considerarFinaisSemana,
      considerarFeriados,
      filtrosAdicionais
    });

    // Buscar breakdown de realizado
    const realizadoResult = await getRealizadoPorProduto(supabase, {
      produtoIds: [idNum],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      filtrosAdicionais,
      withBreakdown: true
    });
    
    if (!realizadoResult) {
      realizadoResult = { breakdown: { tarefas: {}, clientes: {}, responsaveis: {}, clienteTarefas: {} } };
    } else if (!realizadoResult.breakdown) {
      realizadoResult.breakdown = { tarefas: {}, clientes: {}, responsaveis: {}, clienteTarefas: {} };
    }
    if (!realizadoResult.breakdown.clienteTarefas) {
      realizadoResult.breakdown.clienteTarefas = {};
    }

    // Coletar IDs únicos para buscar nomes
    const tarefaIds = new Set();
    const clienteIds = new Set();
    const responsavelIdsSet = new Set();
    
    Object.keys(detalhesEstimado.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });
    
    // Também coletar do breakdown de realizado
    Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) tarefaIds.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.clienteTarefas || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 3) tarefaIds.add(parts.slice(2).join('_'));
    });
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });

    // Buscar mapeamentos usuario_id <-> responsavel_id
    const responsavelIdsEstimado = [...new Set(Object.keys(detalhesEstimado.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parseInt(parts.slice(1).join('_'), 10) : null;
    }).filter(n => !isNaN(n)))];
    const usuarioIdsRealizado = [...new Set(Object.keys(realizadoResult.breakdown.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parts.slice(1).join('_') : null;
    }).filter(Boolean))];
    
    const responsavelParaUsuario = {};
    const usuarioParaResponsavel = {};
    if (responsavelIdsEstimado.length > 0) {
      const { data: membrosEstimado } = await supabase.from('membro').select('id, usuario_id').in('id', responsavelIdsEstimado);
      (membrosEstimado || []).forEach(m => {
        responsavelParaUsuario[m.id] = m.usuario_id;
      });
    }
    if (usuarioIdsRealizado.length > 0) {
      const { data: membrosRealizado } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsRealizado);
      (membrosRealizado || []).forEach(m => {
        usuarioParaResponsavel[m.usuario_id] = m.id;
      });
    }

    // Buscar nomes
    const [tarefasNomes, clientesNomes, membrosNomes] = await Promise.all([
      tarefaIds.size ? supabase.from('cp_tarefa').select('id, nome').in('id', [...tarefaIds].map(id => parseInt(id, 10)).filter(n => !isNaN(n))) : { data: [] },
      clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
      responsavelIdsEstimado.length > 0 || usuarioIdsRealizado.length > 0 ? supabase.from('membro').select('id, nome').in('id', [...responsavelIdsEstimado, ...Object.values(usuarioParaResponsavel)]) : { data: [] }
    ]);

    const nomeTarefa = {}; (tarefasNomes.data || []).forEach(t => { nomeTarefa[String(t.id)] = t.nome; });
    const nomeCliente = {}; (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome; });
    const nomeMembro = {}; (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });

    // Montar arrays de detalhes
    const detalhesTarefas = [];
    const detalhesClientes = [];
    const detalhesResponsaveis = [];
    const idStr = String(idNum);
    const seenTarefas = new Set();
    const seenClientes = new Set();
    const seenResponsaveis = new Set();

    // Processar tarefas
    Object.entries(detalhesEstimado.tarefas || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const tid = key.split('_').slice(1).join('_');
      if (seenTarefas.has(tid)) return;
      seenTarefas.add(tid);
      const realizadoMs = realizadoResult.breakdown?.tarefas?.[key] || 0;
      detalhesTarefas.push({
        id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c0_p${idStr}`,
        original_id: String(tid),
        nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar tarefas que só têm realizado
    Object.keys(realizadoResult.breakdown.tarefas || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const tid = k.split('_').slice(1).join('_');
      if (seenTarefas.has(tid)) return;
      seenTarefas.add(tid);
      detalhesTarefas.push({
        id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c0_p${idStr}`,
        original_id: String(tid),
        nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.tarefas[k] || 0,
        custo_estimado: 0
      });
    });

    // Adicionar clientes aninhados a cada tarefa (detalhesProduto tipo=tarefas): árvore Tarefa > Cliente > Registros
    const clienteTarefasParaTarefas = realizadoResult.breakdown.clienteTarefas || {};
    const clienteTarefasEstimadoParaTarefas = detalhesEstimado.clienteTarefas || {};
    detalhesTarefas.forEach(tar => {
      const tid = tar.original_id || tar.id;
      const clientesDaTarefa = [];
      Object.keys(clienteTarefasParaTarefas).forEach(ctKey => {
        if (!ctKey.startsWith(`${idStr}_`) || !ctKey.endsWith('_' + tid)) return;
        const parts = ctKey.split('_');
        if (parts.length < 3) return;
        const cid = parts[1];
        const totalRealizadoMs = clienteTarefasParaTarefas[ctKey] || 0;
        const totalEstimadoMs = clienteTarefasEstimadoParaTarefas[ctKey] || 0;
        clientesDaTarefa.push({
          id: String(cid),
          nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: totalRealizadoMs
        });
      });
      tar.clientes = clientesDaTarefa;
    });

    // Processar clientes
    Object.entries(detalhesEstimado.clientes || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const cid = key.split('_').slice(1).join('_');
      if (seenClientes.has(cid)) return;
      seenClientes.add(cid);
      const realizadoMs = realizadoResult.breakdown?.clientes?.[key] || 0;
      detalhesClientes.push({
        id: String(cid),
        nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar clientes que só têm realizado (ou que têm estimado no breakdown)
    Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const cid = k.split('_').slice(1).join('_');
      if (seenClientes.has(cid)) return;
      seenClientes.add(cid);
      const estimadoMs = detalhesEstimado.clientes?.[k] || 0;
      detalhesClientes.push({
        id: String(cid),
        nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoResult.breakdown.clientes[k] || 0,
        custo_estimado: 0
      });
    });

    // Adicionar tarefas aninhadas a cada cliente (detalhesProduto)
    const clienteTarefas = realizadoResult.breakdown.clienteTarefas || {};
    const clienteTarefasEstimado = detalhesEstimado.clienteTarefas || {};
    detalhesClientes.forEach(cli => {
      const tarefasDoCliente = [];
      Object.keys(clienteTarefas).forEach(ctKey => {
        if (!ctKey.startsWith(`${idStr}_${cli.id}_`)) return;
        const tid = ctKey.split('_').slice(2).join('_');
        const totalRealizadoMs = clienteTarefas[ctKey] || 0;
        const totalEstimadoMs = clienteTarefasEstimado[ctKey] || 0;
        tarefasDoCliente.push({
          id: tid === 'sem_tarefa' ? 'sem_tarefa' : `t${tid}_c0_p${idStr}`,
          original_id: String(tid),
          nome: tid === 'sem_tarefa' ? 'Demais' : (nomeTarefa[tid] || `Tarefa #${tid}`),
          total_estimado_ms: totalEstimadoMs,
          total_realizado_ms: totalRealizadoMs
        });
      });
      cli.tarefas = tarefasDoCliente;
    });

    // Processar responsaveis
    Object.entries(detalhesEstimado.responsaveis || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const rid = key.split('_').slice(1).join('_');
      const ridNum = parseInt(rid, 10);
      if (isNaN(ridNum) || seenResponsaveis.has(ridNum)) return;
      seenResponsaveis.add(ridNum);
      const uid = responsavelParaUsuario[ridNum];
      const realizadoKey = uid ? `${idStr}_${uid}` : null;
      const realizadoMs = realizadoKey ? (realizadoResult.breakdown?.responsaveis?.[realizadoKey] || 0) : 0;
      detalhesResponsaveis.push({
        id: String(ridNum),
        nome: nomeMembro[String(ridNum)] || `Responsável #${ridNum}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar responsaveis que só têm realizado
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const uid = k.split('_').slice(1).join('_');
      const mid = usuarioParaResponsavel[uid];
      if (!mid || seenResponsaveis.has(mid)) return;
      seenResponsaveis.add(mid);
      detalhesResponsaveis.push({
        id: String(mid),
        nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.responsaveis[k] || 0,
        custo_estimado: 0
      });
    });

    // Mapear tipoDetalhe para o array correto (produto tem: tarefas, clientes, responsaveis)
    const tipoMap = { tarefas: detalhesTarefas, clientes: detalhesClientes, responsaveis: detalhesResponsaveis };
    const data = tipoMap[tipoDetalhe] || [];
    return res.json({ success: true, data: normalizarDataDetalhes(data) });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] detalhesProduto:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

async function detalhesTarefa(req, res) {
  try {
    const params = validateDetalhesBody(req, res);
    if (!params) return;
    const { id, dataInicio, dataFim, considerarFinaisSemana, considerarFeriados, filtrosAdicionais, tipoDetalhe } = params;

    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return res.json({ success: true, data: [] });
    }

    const { data: tarefa, error: errTarefa } = await supabase
      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', idNum)
      .single();

    if (errTarefa || !tarefa) {
      return res.json({ success: true, data: [] });
    }

    // Buscar breakdown de estimado usando regras de tempo estimado
    const detalhesEstimado = await getDetalhesEstimadoTarefa(supabase, {
      tarefaIds: [idNum],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      considerarFinaisSemana,
      considerarFeriados,
      filtrosAdicionais
    });

    // Buscar breakdown de realizado
    const realizadoResult = await getRealizadoPorTarefa(supabase, {
      tarefaIds: [idNum],
      dataInicioStr: dataInicio,
      dataFimStr: dataFim,
      filtrosAdicionais,
      withBreakdown: true
    });
    
    if (!realizadoResult) {
      realizadoResult = { breakdown: { produtos: {}, clientes: {}, responsaveis: {}, clienteTarefas: {}, produtoClienteTarefas: {} } };
    } else if (!realizadoResult.breakdown) {
      realizadoResult.breakdown = { produtos: {}, clientes: {}, responsaveis: {}, clienteTarefas: {}, produtoClienteTarefas: {} };
    }
    if (!realizadoResult.breakdown.clienteTarefas) {
      realizadoResult.breakdown.clienteTarefas = {};
    }
    if (!realizadoResult.breakdown.produtoClienteTarefas) {
      realizadoResult.breakdown.produtoClienteTarefas = {};
    }

    // Coletar IDs únicos para buscar nomes
    const produtoIds = new Set();
    const clienteIds = new Set();
    const responsavelIdsSet = new Set();
    
    Object.keys(detalhesEstimado.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
    });
    Object.keys(detalhesEstimado.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });
    
    // Também coletar do breakdown de realizado
    Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) produtoIds.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) clienteIds.add(parts.slice(1).join('_'));
    });
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      const parts = k.split('_');
      if (parts.length >= 2) responsavelIdsSet.add(parts.slice(1).join('_'));
    });

    // Buscar mapeamentos usuario_id <-> responsavel_id
    const responsavelIdsEstimado = [...new Set(Object.keys(detalhesEstimado.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parseInt(parts.slice(1).join('_'), 10) : null;
    }).filter(n => !isNaN(n)))];
    const usuarioIdsRealizado = [...new Set(Object.keys(realizadoResult.breakdown.responsaveis || {}).map(k => {
      const parts = k.split('_');
      return parts.length >= 2 ? parts.slice(1).join('_') : null;
    }).filter(Boolean))];
    
    const responsavelParaUsuario = {};
    const usuarioParaResponsavel = {};
    if (responsavelIdsEstimado.length > 0) {
      const { data: membrosEstimado } = await supabase.from('membro').select('id, usuario_id').in('id', responsavelIdsEstimado);
      (membrosEstimado || []).forEach(m => {
        responsavelParaUsuario[m.id] = m.usuario_id;
      });
    }
    if (usuarioIdsRealizado.length > 0) {
      const { data: membrosRealizado } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', usuarioIdsRealizado);
      (membrosRealizado || []).forEach(m => {
        usuarioParaResponsavel[m.usuario_id] = m.id;
      });
    }

    // Buscar nomes
    const [produtosNomes, clientesNomes, membrosNomes] = await Promise.all([
      produtoIds.size ? supabase.from('cp_produto').select('id, nome').in('id', [...produtoIds].map(id => parseInt(id, 10)).filter(n => !isNaN(n))) : { data: [] },
      clienteIds.size ? supabase.from('cp_cliente').select('id, nome').in('id', [...clienteIds]) : { data: [] },
      responsavelIdsEstimado.length > 0 || usuarioIdsRealizado.length > 0 ? supabase.from('membro').select('id, nome').in('id', [...responsavelIdsEstimado, ...Object.values(usuarioParaResponsavel)]) : { data: [] }
    ]);

    const nomeProduto = {}; (produtosNomes.data || []).forEach(p => { nomeProduto[String(p.id)] = p.nome; });
    const nomeCliente = {}; (clientesNomes.data || []).forEach(c => { nomeCliente[String(c.id)] = c.nome; });
    const nomeMembro = {}; (membrosNomes.data || []).forEach(m => { nomeMembro[String(m.id)] = m.nome; });

    // Montar arrays de detalhes
    const detalhesProdutos = [];
    const detalhesClientes = [];
    const detalhesResponsaveis = [];
    const idStr = String(idNum);
    const seenProdutos = new Set();
    const seenClientes = new Set();
    const seenResponsaveis = new Set();

    // Processar produtos
    Object.entries(detalhesEstimado.produtos || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const pid = key.split('_').slice(1).join('_');
      if (seenProdutos.has(pid)) return;
      seenProdutos.add(pid);
      const realizadoMs = realizadoResult.breakdown?.produtos?.[key] || 0;
      detalhesProdutos.push({
        id: String(pid),
        nome: nomeProduto[pid] || `Produto #${pid}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar produtos que só têm realizado
    Object.keys(realizadoResult.breakdown.produtos || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const pid = k.split('_').slice(1).join('_');
      if (seenProdutos.has(pid)) return;
      seenProdutos.add(pid);
      detalhesProdutos.push({
        id: String(pid),
        nome: nomeProduto[pid] || `Produto #${pid}`,
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.produtos[k] || 0,
        custo_estimado: 0
      });
    });

    // Adicionar clientes[].tarefas aninhados a cada produto (detalhesTarefa tipo=produtos): árvore Produto > Cliente > Tarefa > Registros
    const produtoClienteTarefasTarefa = realizadoResult.breakdown.produtoClienteTarefas || {};
    detalhesProdutos.forEach(prod => {
      const clientesDoProduto = [];
      Object.keys(produtoClienteTarefasTarefa).forEach(pctKey => {
        if (!pctKey.startsWith(`${idStr}_${prod.id}_`)) return;
        const cid = pctKey.split('_')[2];
        const totalRealizadoMs = produtoClienteTarefasTarefa[pctKey] || 0;
        clientesDoProduto.push({
          id: String(cid),
          nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
          total_estimado_ms: 0,
          total_realizado_ms: totalRealizadoMs,
          tarefas: [{ id: idStr, original_id: String(idStr), nome: tarefa.nome || `Tarefa #${idStr}`, total_estimado_ms: 0, total_realizado_ms: totalRealizadoMs }]
        });
      });
      prod.clientes = clientesDoProduto;
    });

    // Processar clientes
    Object.entries(detalhesEstimado.clientes || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const cid = key.split('_').slice(1).join('_');
      if (seenClientes.has(cid)) return;
      seenClientes.add(cid);
      const realizadoMs = realizadoResult.breakdown?.clientes?.[key] || 0;
      detalhesClientes.push({
        id: String(cid),
        nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar clientes que só têm realizado (ou que têm estimado no breakdown)
    Object.keys(realizadoResult.breakdown.clientes || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const cid = k.split('_').slice(1).join('_');
      if (seenClientes.has(cid)) return;
      seenClientes.add(cid);
      const estimadoMs = detalhesEstimado.clientes?.[k] || 0;
      detalhesClientes.push({
        id: String(cid),
        nome: cid === 'sem_cliente' ? 'Demais' : (nomeCliente[cid] || `Cliente #${cid}`),
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoResult.breakdown.clientes[k] || 0,
        custo_estimado: 0
      });
    });

    // Adicionar tarefas aninhadas a cada cliente (detalhesTarefa)
    const clienteTarefasTarefa = realizadoResult.breakdown.clienteTarefas || {};
    detalhesClientes.forEach(cli => {
      const tarefasDoCliente = [];
      Object.keys(clienteTarefasTarefa).forEach(ctKey => {
        if (!ctKey.startsWith(`${idStr}_${cli.id}_`)) return;
        const totalRealizadoMs = clienteTarefasTarefa[ctKey] || 0;
        tarefasDoCliente.push({
          id: idStr,
          original_id: String(idStr),
          nome: tarefa.nome || `Tarefa #${idStr}`,
          total_estimado_ms: 0,
          total_realizado_ms: totalRealizadoMs
        });
      });
      cli.tarefas = tarefasDoCliente;
    });

    // Processar responsaveis
    Object.entries(detalhesEstimado.responsaveis || {}).forEach(([key, estimadoMs]) => {
      if (!key.startsWith(idStr + '_')) return;
      const rid = key.split('_').slice(1).join('_');
      const ridNum = parseInt(rid, 10);
      if (isNaN(ridNum) || seenResponsaveis.has(ridNum)) return;
      seenResponsaveis.add(ridNum);
      const uid = responsavelParaUsuario[ridNum];
      const realizadoKey = uid ? `${idStr}_${uid}` : null;
      const realizadoMs = realizadoKey ? (realizadoResult.breakdown?.responsaveis?.[realizadoKey] || 0) : 0;
      detalhesResponsaveis.push({
        id: String(ridNum),
        nome: nomeMembro[String(ridNum)] || `Responsável #${ridNum}`,
        total_estimado_ms: estimadoMs,
        total_realizado_ms: realizadoMs,
        custo_estimado: 0
      });
    });
    // Adicionar responsaveis que só têm realizado
    Object.keys(realizadoResult.breakdown.responsaveis || {}).forEach(k => {
      if (!k.startsWith(idStr + '_')) return;
      const uid = k.split('_').slice(1).join('_');
      const mid = usuarioParaResponsavel[uid];
      if (!mid || seenResponsaveis.has(mid)) return;
      seenResponsaveis.add(mid);
      detalhesResponsaveis.push({
        id: String(mid),
        nome: nomeMembro[String(mid)] || `Responsável #${mid}`,
        total_estimado_ms: 0,
        total_realizado_ms: realizadoResult.breakdown.responsaveis[k] || 0,
        custo_estimado: 0
      });
    });

    // Mapear tipoDetalhe para o array correto (tarefa tem: produtos, clientes, responsaveis)
    const tipoMap = { produtos: detalhesProdutos, clientes: detalhesClientes, responsaveis: detalhesResponsaveis };
    const data = tipoMap[tipoDetalhe] || [];
    return res.json({ success: true, data: normalizarDataDetalhes(data) });
  } catch (error) {
    console.error('❌ [GESTAO-CAPACIDADE] detalhesTarefa:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}

module.exports = {
  cardsResponsavel,
  cardsCliente,
  cardsProduto,
  cardsTarefa,
  detalhesResponsavel,
  detalhesCliente,
  detalhesProduto,
  detalhesTarefa
};
