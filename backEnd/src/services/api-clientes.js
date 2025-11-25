// =============================================================
// === 🍃 CONTÉM FUNÇÕES DE API/QUERIES (API/BANCO DE DADOS) ===
// =============================================================

//===================== CONFIGURAÇÃO INICIAL =====================
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

const supabaseUrl = 'https://gijgjvfwxmkkihdmfmdg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpamdqdmZ3eG1ra2loZG1mbWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjEzNzIxNywiZXhwIjoyMDU3NzEzMjE3fQ.b9F3iLwtnpYp54kPyQORmfe8hW2fLxoKlXmIXuTY99U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'up_gestaointeligente' },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});
//====================================

//===================== FUNÇÕES UTILITÁRIAS DE DATA =====================
function dataBRparaISO(dataBR) {
  if (!dataBR || typeof dataBR !== 'string') return null;
  const [dia, mes, ano] = dataBR.split('/');
  if (!dia || !mes || !ano) return null;
  return `${ano.padStart(4,'0')}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;
}

function dataHoraBRparaISO(dataHoraBR) {
  if (!dataHoraBR || typeof dataHoraBR !== 'string') return null;
  const [data, hora = '00:00'] = dataHoraBR.split(' ');
  const [dia, mes, ano] = (data || '').split('/');
  if (!dia || !mes || !ano) return null;
  return `${ano.padStart(4,'0')}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}T${hora}:00`;
}

function isoParaDataBR(isoDate) {
  if (!isoDate) return '';
  let d;
  if (isoDate instanceof Date) {
    d = isoDate;
  } else {
    d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
  }
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const ano = d.getFullYear().toString();
  return `${dia}/${mes}/${ano}`;
}

function isoParaDataHoraBR(isoDateTime) {
  if (!isoDateTime) return '';
  let d;
  if (isoDateTime instanceof Date) {
    d = isoDateTime;
  } else {
    d = new Date(isoDateTime);
    if (isNaN(d.getTime())) return '';
  }
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const ano = d.getFullYear().toString();
  const hora = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - CLIENTES =====================
async function getAllClientes() {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('cp_cliente')
    .select('id, nome')
    .not('id', 'is', null)
    .not('nome', 'is', null)
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }
  return data || [];
}

async function getClientesByStatus(status) {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('contratos_clientes')
    .select('id_cliente')
    .eq('status', status);

  if (error) {
    throw error;
  }

  const idsClientes = [...new Set(data.map(row => row.id_cliente).filter(Boolean))];
  
  if (idsClientes.length === 0) {
    return [];
  }

  const { data: clientesData, error: clientesError } = await supabase
    .schema('up_gestaointeligente')
    .from('cp_cliente')
    .select('id, nome')
    .in('id', idsClientes)
    .order('nome', { ascending: true });

  if (clientesError) {
    throw clientesError;
  }

  return clientesData || [];
}

async function getTodoscp_clientesIdNomeMap() {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('cp_cliente')
    .select('id, nome');

  if (error) {
    throw error;
  }
  
  const cp_clientesMap = {};
  (data || []).forEach(m => {
    cp_clientesMap[m.id] = m.nome;
  });
  return cp_clientesMap;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - STATUS =====================
async function getAllDistinctStatus() {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('contratos_clientes')
    .select('status', { distinct: true });

  if (error) {
    throw error;
  }
  const statusList = [...new Set(data.map(row => row.status).filter(Boolean))];
  return statusList;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - STATUS POR CLIENTE =====================
async function getDistinctStatusByCliente(idCliente) {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('contratos_clientes')
    .select('status', { distinct: true })
    .eq('id_cliente', idCliente);

  if (error) {
    throw error;
  }
  const statusList = [...new Set(data.map(row => row.status).filter(Boolean))];
  return statusList;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - CONTRATOS =====================
async function getContratosByStatusAndCliente(status, idCliente) {
  let query = supabase
    .schema('up_gestaointeligente')
    .from('contratos_clientes')
    .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social');

  if (status) {
    query = query.eq('status', status);
  }
  if (idCliente) {
    query = query.eq('id_cliente', idCliente);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Erro ao buscar contratos:', error);
    console.error('❌ Detalhes:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
  return data || [];
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - TAREFAS =====================
async function getTarefasPorCliente(clienteId) {
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('tarefa')
    .select('*')
    .eq('cliente_id', clienteId);

  if (error) {
    throw error;
  }
  return data || [];
}
//====================================

//===================== ENDPOINTS HTTP - ID/NOME =====================
async function getcp_clientesIdNome(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome')
      .not('id', 'is', null)
      .not('nome', 'is', null);

    if (error) {
      console.error('Erro ao buscar cp_clientes id/nome:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cp_clientes'
      });
    }

    const cp_clientes = (data || []).map(row => ({
      id: row.id,
      nome: row.nome
    }));

    return res.json({
      success: true,
      data: cp_clientes,
      count: cp_clientes.length
    });
  } catch (e) {
    console.error('Erro inesperado em /api/cp_clientes-id-nome:', e);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
//====================================

//===================== ENDPOINTS HTTP - MEMBROS =====================
async function getMembrosIdNome(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome')
      .not('id', 'is', null)
      .order('nome', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros'
      });
    }

    const membros = (data || []).map(row => ({
      id: row.id,
      nome: row.nome
    }));

    return res.json({
      success: true,
      data: membros,
      count: membros.length
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
//====================================

//===================== ENDPOINTS HTTP - CLIENTES =====================
async function getClientesEndpoint(req, res) {
  try {
    const { status } = req.query;
    
    let clientes;
    if (status) {
      clientes = await getClientesByStatus(status);
    } else {
      clientes = await getAllClientes();
    }

    res.json({ success: true, data: clientes, count: clientes.length });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
  }
}
//====================================

//===================== ENDPOINTS HTTP - STATUS =====================
async function getStatusEndpoint(req, res) {
  try {
    const { clienteId } = req.query;
    
    let statusList;
    if (clienteId) {
      statusList = await getDistinctStatusByCliente(clienteId);
    } else {
      statusList = await getAllDistinctStatus();
    }

    res.json({ success: true, data: statusList, count: statusList.length });
  } catch (error) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar status' });
  }
}
//====================================

//===================== ENDPOINTS HTTP - CONTRATOS =====================
async function getContratosEndpoint(req, res) {
  try {
    const { status, clienteId } = req.query;

    console.log('🔍 [CONTRATOS] Buscando contratos com filtros:', { status, clienteId });

    const contratos = await getContratosByStatusAndCliente(status, clienteId);

    console.log('✅ [CONTRATOS] Contratos encontrados:', contratos.length);

    res.json({ success: true, data: contratos, count: contratos.length });
  } catch (error) {
    console.error('❌ [CONTRATOS] Erro ao buscar contratos:', error);
    console.error('❌ [CONTRATOS] Detalhes do erro:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar contratos',
      details: error.message || 'Erro desconhecido'
    });
  }
}
//====================================

//===================== ENDPOINTS HTTP - TAREFAS =====================
async function getTarefasEndpoint(req, res) {
  try {
    const { clienteId } = req.params;

    const tarefas = await getTarefasPorCliente(clienteId);

    res.json({ success: true, data: tarefas, count: tarefas.length });
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar tarefas' });
  }
}
//====================================

//===================== ENDPOINTS HTTP - REGISTRO DE TEMPO =====================
async function getRegistrosTempo(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('*');

    if (error) {
      console.error('Erro ao buscar registros de tempo:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo'
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: (data || []).length
    });
  } catch (e) {
    console.error('Erro inesperado em /api/registro-tempo:', e);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
//====================================

//===================== ENDPOINTS HTTP - CUSTO HORA MEMBRO =====================
async function getCustoHoraMembro(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('v_custo_hora_membro')
      .select('*');

    if (error) {
      console.error('Erro ao buscar v_custo_hora_membro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar v_custo_hora_membro'
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: (data || []).length
    });
  } catch (e) {
    console.error('Erro inesperado em /api/v_custo_hora_membro:', e);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
//====================================

//===================== ENDPOINTS HTTP - FATURAMENTO =====================
async function getFaturamento(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('faturamento')
      .select('*');

    if (error) {
      console.error('Erro ao buscar faturamento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar faturamento'
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: (data || []).length
    });
  } catch (e) {
    console.error('Erro inesperado em /api/faturamento:', e);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

//===================== FUNÇÕES REUTILIZÁVEIS - PRODUTOS =====================
async function getProdutoPorId(produtoId) {
  // Como a coluna id é tipo text, usar .eq() é mais confiável
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('cp_produto')
    .select('id, nome')
    .eq('id', produtoId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function getProdutosPorIds(produtoIds) {
  // Para colunas do tipo text, buscar um por um é mais confiável
  const produtos = [];
  
  for (const produtoId of produtoIds) {
    try {
      console.log(`🔍 Buscando produto ID: "${produtoId}" (tipo: ${typeof produtoId})`);
      
      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, nome')
        .eq('id', produtoId)
        .maybeSingle();
      
      if (error) {
        console.error(`❌ Erro ao buscar produto "${produtoId}":`, error);
      } else if (data) {
        console.log(`✅ Produto encontrado: ID="${data.id}", Nome="${data.nome}"`);
        produtos.push(data);
      } else {
        console.log(`⚠️ Produto não encontrado para ID: "${produtoId}"`);
      }
    } catch (err) {
      // Continuar para próximo produto se der erro
      console.error(`❌ Exceção ao buscar produto "${produtoId}":`, err);
    }
  }
  
  console.log(`📦 Total de produtos encontrados: ${produtos.length} de ${produtoIds.length}`);
  return produtos;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - MEMBROS =====================
async function getAllMembros() {
  // Buscar todos os membros (mesma lógica do getMembrosIdNome)
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('membro')
    .select('id, nome')
    .not('id', 'is', null)
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }
  
  return data || [];
}

async function getMembrosPorIds(membroIds) {
  if (!membroIds || membroIds.length === 0) {
    return [];
  }
  
  // Buscar apenas os membros necessários usando .in() ou .or()
  const membroIdsUnicos = [...new Set(membroIds.map(id => String(id).trim()).filter(Boolean))];
  
  if (membroIdsUnicos.length === 0) {
    return [];
  }
  
  // Tentar usar .in() primeiro (mais rápido)
  // Se falhar, fazer queries individuais
  let membros = [];
  
  try {
    // Tentar com .in() (pode não funcionar se coluna for text)
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome')
      .in('id', membroIdsUnicos);
    
    if (!error && data) {
      membros = data;
    } else {
      // Fallback: buscar individualmente
      const membrosPromises = membroIdsUnicos.map(async (id) => {
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, nome')
          .eq('id', id)
          .maybeSingle();
        return error ? null : data;
      });
      
      const resultados = await Promise.all(membrosPromises);
      membros = resultados.filter(Boolean);
    }
  } catch (err) {
    // Se der erro, retornar array vazio
    return [];
  }
  
  // Criar map com múltiplos formatos de ID para matching robusto
  const membrosMap = {};
  membros.forEach(membro => {
    if (!membro) return;
    const membroId = membro.id;
    const membroIdStr = String(membroId).trim();
    
    membrosMap[membroId] = membro;
    membrosMap[membroIdStr] = membro;
    
    const membroIdNum = parseInt(membroIdStr, 10);
    if (!isNaN(membroIdNum)) {
      membrosMap[membroIdNum] = membro;
    }
  });
  
  // Retornar membros encontrados na ordem dos IDs solicitados
  return membroIds
    .map(id => {
      const idStr = String(id).trim();
      return membrosMap[id] || membrosMap[idStr] || membrosMap[parseInt(idStr, 10)] || null;
    })
    .filter(Boolean);
}

//===================== FUNÇÕES REUTILIZÁVEIS - MEMBROS POR CLIENTE =====================
async function getMembrosPorCliente(clienteId, periodoInicio = null, periodoFim = null) {
  try {
    if (!clienteId) {
      return [];
    }

    const clienteIdStr = String(clienteId).trim();

    // Buscar registros de tempo desse cliente
    let query = supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('usuario_id')
      .eq('cliente_id', clienteIdStr)
      .not('usuario_id', 'is', null);

    // Se houver período, filtrar por ele
    if (periodoInicio && periodoFim) {
      const inicioISO = new Date(`${periodoInicio}T00:00:00.000Z`);
      const fimISO = new Date(`${periodoFim}T23:59:59.999Z`);
      const inicioStr = inicioISO.toISOString();
      const fimStr = fimISO.toISOString();
      
      const orConditions = [
        `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
        `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
        `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`
      ].join(',');
      
      query = query.or(orConditions);
    }

    const { data: registros, error } = await query;

    if (error) {
      throw error;
    }

    // Extrair IDs únicos de usuários
    const usuarioIds = [...new Set((registros || []).map(r => r.usuario_id).filter(Boolean))];

    if (usuarioIds.length === 0) {
      return [];
    }

    // Buscar membros por esses IDs usando a função já existente
    const membros = await getMembrosPorIds(usuarioIds);
    
    // Ordenar por nome
    membros.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    
    return membros || [];
  } catch (error) {
    console.error('Erro ao buscar membros por cliente:', error);
    return [];
  }
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - CLIENTES POR COLABORADOR =====================
async function getClientesPorColaborador(colaboradorId, periodoInicio = null, periodoFim = null) {
  try {
    if (!colaboradorId) {
      return [];
    }

    // Suportar múltiplos colaboradores (array ou valor único)
    let colaboradorIds = [];
    if (Array.isArray(colaboradorId)) {
      colaboradorIds = colaboradorId.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    } else {
      const idNum = parseInt(colaboradorId, 10);
      if (!isNaN(idNum)) {
        colaboradorIds = [idNum];
      }
    }
    
    if (colaboradorIds.length === 0) {
      return [];
    }

    console.log(`🔍 [GET-CLIENTES-POR-COLABORADOR] Buscando clientes para colaboradores:`, {
      colaboradorIds,
      periodoInicio,
      periodoFim,
      temPeriodo: !!(periodoInicio && periodoFim)
    });

    // Buscar registros de tempo desses colaboradores
    let query = supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('cliente_id')
      .not('cliente_id', 'is', null);
    
    // Aplicar filtro de colaborador(es)
    if (colaboradorIds.length === 1) {
      query = query.eq('usuario_id', colaboradorIds[0]);
      console.log(`✅ [GET-CLIENTES-POR-COLABORADOR] Filtro: usuario_id = ${colaboradorIds[0]}`);
    } else {
      query = query.in('usuario_id', colaboradorIds);
      console.log(`✅ [GET-CLIENTES-POR-COLABORADOR] Filtro: usuario_id IN [${colaboradorIds.join(', ')}]`);
    }

    // Se houver período, filtrar por ele
    if (periodoInicio && periodoFim) {
      const inicioISO = new Date(`${periodoInicio}T00:00:00.000Z`);
      const fimISO = new Date(`${periodoFim}T23:59:59.999Z`);
      const inicioStr = inicioISO.toISOString();
      const fimStr = fimISO.toISOString();
      
      const orConditions = [
        `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
        `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
        `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`
      ].join(',');
      
      query = query.or(orConditions);
    }

    const { data: registros, error } = await query;

    if (error) {
      console.error(`❌ [GET-CLIENTES-POR-COLABORADOR] Erro na query:`, error);
      throw error;
    }

    console.log(`📊 [GET-CLIENTES-POR-COLABORADOR] Registros encontrados: ${(registros || []).length}`);

    // Extrair IDs únicos de clientes
    const clienteIds = [...new Set((registros || []).map(r => String(r.cliente_id).trim()).filter(Boolean))];

    console.log(`📋 [GET-CLIENTES-POR-COLABORADOR] IDs únicos de clientes: ${clienteIds.length}`);

    if (clienteIds.length === 0) {
      console.log(`⚠️ [GET-CLIENTES-POR-COLABORADOR] Nenhum cliente encontrado`);
      return [];
    }

    // Buscar clientes por esses IDs
    const clientes = [];
    for (const clienteId of clienteIds) {
      try {
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome')
          .eq('id', clienteId)
          .maybeSingle();
        
        if (!error && data) {
          clientes.push(data);
        }
      } catch (err) {
        console.error(`Erro ao buscar cliente "${clienteId}":`, err);
      }
    }

    // Ordenar por nome
    clientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    console.log(`✅ [GET-CLIENTES-POR-COLABORADOR] Retornando ${clientes.length} clientes`);

    return clientes;
  } catch (error) {
    console.error('Erro ao buscar clientes por colaborador:', error);
    return [];
  }
}
//====================================

//===================== ENDPOINTS HTTP - PRODUTOS =====================
async function getProdutos(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .select('*');

    if (error) {
      console.error('Erro ao buscar produtos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar produtos'
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: (data || []).length
    });
  } catch (e) {
    console.error('Erro inesperado em /api/cp_produto:', e);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

//===================== REGISTRO DE ROTAS HTTP =====================
// Função para registrar todas as rotas em um app Express
function registrarRotasAPI(app, requireAuth = null) {
  // Endpoints de ID/Nome (com autenticação se disponível)
  app.get('/api/cp_clientes-id-nome', requireAuth ? requireAuth : (_req,_res,next)=>next(), getcp_clientesIdNome);
  app.get('/api/membros-id-nome', requireAuth ? requireAuth : (_req,_res,next)=>next(), getMembrosIdNome);
  
  // Endpoints do Dashboard Clientes (com autenticação se disponível)
  // IMPORTANTE: Estes endpoints são usados pelo Dashboard Clientes React e HTML
  app.get('/api/clientes', requireAuth ? requireAuth : (_req,_res,next)=>next(), getClientesEndpoint);
  app.get('/api/status', requireAuth ? requireAuth : (_req,_res,next)=>next(), getStatusEndpoint);
  app.get('/api/contratos', requireAuth ? requireAuth : (_req,_res,next)=>next(), getContratosEndpoint);
  app.get('/api/tarefas/:clienteId', requireAuth ? requireAuth : (_req,_res,next)=>next(), getTarefasEndpoint);
  app.get('/api/registro-tempo', requireAuth ? requireAuth : (_req,_res,next)=>next(), getRegistrosTempo);
  
  // Endpoints outros (com autenticação se disponível)
  app.get('/api/v_custo_hora_membro', requireAuth ? requireAuth : (_req,_res,next)=>next(), getCustoHoraMembro);
  app.get('/api/faturamento', requireAuth ? requireAuth : (_req,_res,next)=>next(), getFaturamento);
}

// Auto-registro se app estiver disponível (compatibilidade com node.js principal)
if (typeof app !== 'undefined' && app.get) {
  registrarRotasAPI(app, requireAuth);
}
//====================================

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Funções reutilizáveis
    getAllClientes,
    getClientesByStatus,
    getTodoscp_clientesIdNomeMap,
    getAllDistinctStatus,
    getDistinctStatusByCliente,
    getContratosByStatusAndCliente,
    getTarefasPorCliente,
    getProdutoPorId,
    getProdutosPorIds,
    getMembrosPorIds,
    getMembrosPorCliente,
    getClientesPorColaborador,
    // Endpoints
    getClientesEndpoint,
    getStatusEndpoint,
    getContratosEndpoint,
    getTarefasEndpoint,
    getRegistrosTempo,
    getcp_clientesIdNome,
    getMembrosIdNome,
    getCustoHoraMembro,
    getFaturamento,
    // Função de registro
    registrarRotasAPI,
    // Supabase client (para compartilhar configuração)
    supabase
  };
}
//====================================
