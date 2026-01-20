// =============================================================
// === 🍃 CONTÉM FUNÇÕES DE API/QUERIES (API/BANCO DE DADOS) ===
// =============================================================

//===================== CONFIGURAÇÃO INICIAL =====================
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const { buscarTodosComPaginacao } = require('./database-utils');

// Carregar variáveis de ambiente
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validar que as credenciais foram fornecidas
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERRO CRÍTICO: SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) devem estar definidas nas variáveis de ambiente!');
  console.error('   Configure estas variáveis no arquivo .env.production');
  process.exit(1);
}

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
  return `${ano.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function dataHoraBRparaISO(dataHoraBR) {
  if (!dataHoraBR || typeof dataHoraBR !== 'string') return null;
  const [data, hora = '00:00'] = dataHoraBR.split(' ');
  const [dia, mes, ano] = (data || '').split('/');
  if (!dia || !mes || !ano) return null;
  return `${ano.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}:00`;
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
    .select('id, nome, status')
    .not('id', 'is', null)
    .not('nome', 'is', null)
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }

  // Garantir que todos os clientes tenham status (assumir 'ativo' se não estiver definido)
  return (data || []).map(row => ({
    id: row.id,
    nome: row.nome,
    status: row.status || 'ativo'
  }));
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

// Buscar contratos por ID do cliente
async function getContratosByClienteId(idCliente) {
  try {
    // Normalizar o ID (pode vir como string ou número)
    const idNormalizado = String(idCliente).trim();

    console.log('🔍 [GET-CONTRATOS-CLIENTE-ID] Buscando contratos para id_cliente:', idNormalizado);

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('contratos_clientes')
      .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social')
      .eq('id_cliente', idNormalizado);

    if (error) {
      console.error('❌ Erro ao buscar contratos por ID do cliente:', error);
      throw error;
    }

    console.log(`✅ [GET-CONTRATOS-CLIENTE-ID] Encontrados ${(data || []).length} contratos`);
    return data || [];
  } catch (error) {
    console.error('❌ Erro em getContratosByClienteId:', error);
    return [];
  }
}

// Buscar contratos por nome do cliente no ClickUp
async function getContratosByClickupNome(nomeClienteClickup) {
  try {
    const nomeNormalizado = String(nomeClienteClickup).trim();
    console.log('🔍 [GET-CONTRATOS-CLICKUP] Buscando cliente por nome:', nomeNormalizado);

    // Primeiro, buscar o cliente pelo nome no ClickUp
    const { data: clienteData, error: clienteError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id')
      .eq('nome', nomeNormalizado)
      .maybeSingle();

    if (clienteError) {
      console.error('❌ [GET-CONTRATOS-CLICKUP] Erro ao buscar cliente por nome:', clienteError);
      return [];
    }

    if (!clienteData || !clienteData.id) {
      console.log(`⚠️ [GET-CONTRATOS-CLICKUP] Cliente não encontrado com nome: ${nomeNormalizado}`);
      return [];
    }

    console.log(`✅ [GET-CONTRATOS-CLICKUP] Cliente encontrado com ID: ${clienteData.id}`);

    // Buscar contratos usando o id_cliente
    const contratos = await getContratosByClienteId(clienteData.id);
    console.log(`✅ [GET-CONTRATOS-CLICKUP] Retornando ${contratos.length} contratos`);

    return contratos;
  } catch (error) {
    console.error('❌ [GET-CONTRATOS-CLICKUP] Erro em getContratosByClickupNome:', error);
    return [];
  }
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
      .select('id, nome, status, usuario_id')
      .not('id', 'is', null)
      .not('usuario_id', 'is', null) // Filtrar apenas membros com usuários vinculados
      .order('nome', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros'
      });
    }

    // Buscar foto_perfil dos usuários vinculados aos membros
    const membros = (data || []).map(row => ({
      id: row.id,
      nome: row.nome,
      status: row.status || 'ativo', // Incluir status, assumir 'ativo' se não estiver definido
      usuario_id: row.usuario_id, // Incluir usuario_id para permitir busca por usuario_id
      foto_perfil: null // Será preenchido abaixo
    }));

    // Buscar fotos de perfil dos usuários e resolver avatares customizados
    if (membros.length > 0) {
      const usuarioIds = [...new Set(membros.map(m => m.usuario_id).filter(Boolean))];

      if (usuarioIds.length > 0) {
        const { data: usuarios, error: usuariosError } = await supabase
          .schema('up_gestaointeligente')
          .from('usuarios')
          .select('id, foto_perfil')
          .in('id', usuarioIds);

        if (!usuariosError && usuarios && usuarios.length > 0) {
          const { resolveAvatarUrl } = require('../utils/storage');
          const usuarioMap = new Map();
          usuarios.forEach(usuario => {
            usuarioMap.set(String(usuario.id), usuario.foto_perfil);
          });

          // Adicionar foto_perfil a cada membro e resolver avatares customizados
          const avataresParaResolver = [];
          membros.forEach((membro, index) => {
            if (membro.usuario_id) {
              const fotoPerfil = usuarioMap.get(String(membro.usuario_id));
              if (fotoPerfil && fotoPerfil.startsWith('custom-')) {
                avataresParaResolver.push({ membro, fotoPerfil, index });
              } else if (fotoPerfil) {
                membro.foto_perfil = fotoPerfil;
              } else {
                membro.foto_perfil = null;
              }
            } else {
              membro.foto_perfil = null;
            }
          });

          // Resolver todas as URLs customizadas em paralelo
          if (avataresParaResolver.length > 0) {
            await Promise.all(
              avataresParaResolver.map(async ({ membro, fotoPerfil }) => {
                const resolvedUrl = await resolveAvatarUrl(fotoPerfil, 'user');
                membro.foto_perfil = resolvedUrl || fotoPerfil;
              })
            );
          }
        }
      }
    }

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

// Função para buscar TODOS os membros (incluindo os sem usuário vinculado)
async function getMembrosIdNomeTodos(req, res) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, status, usuario_id')
      .not('id', 'is', null)
      // NÃO filtrar por usuario_id - retornar todos os membros
      .order('nome', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros'
      });
    }

    const membros = (data || []).map(row => ({
      id: row.id,
      nome: row.nome,
      status: row.status || 'ativo', // Incluir status, assumir 'ativo' se não estiver definido
      usuario_id: row.usuario_id // Incluir usuario_id (pode ser null)
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

// GET /api/contratos-cliente/:nomeClienteClickup
async function getContratosClienteEndpoint(req, res) {
  try {
    const { nomeClienteClickup } = req.params;

    if (!nomeClienteClickup) {
      return res.status(400).json({
        success: false,
        error: 'Nome do cliente é obrigatório'
      });
    }

    console.log('🔍 [CONTRATOS-CLIENTE] Buscando contratos para cliente:', nomeClienteClickup);

    const contratos = await getContratosByClickupNome(nomeClienteClickup);

    console.log('✅ [CONTRATOS-CLIENTE] Contratos encontrados:', contratos.length);

    res.json({ success: true, data: contratos, count: contratos.length });
  } catch (error) {
    console.error('❌ [CONTRATOS-CLIENTE] Erro ao buscar contratos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar contratos',
      details: error.message || 'Erro desconhecido'
    });
  }
}

// GET /api/contratos-cliente-id/:idCliente
async function getContratosClienteIdEndpoint(req, res) {
  try {
    const { idCliente } = req.params;

    if (!idCliente) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    console.log('🔍 [CONTRATOS-CLIENTE-ID] Buscando contratos para cliente ID:', idCliente);

    const contratos = await getContratosByClienteId(idCliente);

    console.log('✅ [CONTRATOS-CLIENTE-ID] Contratos encontrados:', contratos.length);

    res.json({ success: true, data: contratos, count: contratos.length });
  } catch (error) {
    console.error('❌ [CONTRATOS-CLIENTE-ID] Erro ao buscar contratos:', error);
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

// Buscar registros de tempo sem tarefa_id (tarefas desajustadas)
async function getRegistrosTempoSemTarefa(req, res) {
  try {
    console.log('🔍 Buscando registros de tempo sem tarefa_id...');

    // Criar função para query builder (para usar paginação automática)
    // Buscar registros onde tarefa_id é null OU string vazia
    const criarQueryBuilderRegistros = () => {
      const query = supabase
        .schema('up_gestaointeligente')
        .from('registro_tempo')
        .select('*')
        .or('tarefa_id.is.null,tarefa_id.eq.');

      console.log('📋 Query criada: registro_tempo WHERE tarefa_id IS NULL OR tarefa_id = ""');
      return query;
    };

    // Usar paginação automática para buscar todos os registros
    const registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, {
      limit: 1000,
      logProgress: true
    });

    console.log(`✅ Encontrados ${registros.length} registros sem tarefa_id`);

    // Buscar nomes dos membros (usuários)
    const usuarioIds = [...new Set(registros.map(r => r.usuario_id).filter(Boolean))];
    let membrosMap = {};

    if (usuarioIds.length > 0) {
      console.log(`🔍 Buscando nomes de ${usuarioIds.length} membros...`);
      const membros = await getMembrosPorIds(usuarioIds);
      membros.forEach(membro => {
        membrosMap[membro.id] = membro.nome;
      });
      console.log(`✅ Encontrados ${Object.keys(membrosMap).length} nomes de membros`);
    }

    // Adicionar nome do membro a cada registro
    const registrosComNomes = registros.map(registro => ({
      ...registro,
      membro_nome: registro.usuario_id ? (membrosMap[registro.usuario_id] || null) : null
    }));

    // Verificar se encontrou o registro específico mencionado pelo usuário
    const registroEspecifico = registrosComNomes.find(r => String(r.id) === '4688888212977614080');
    if (registroEspecifico) {
      console.log('✅ Registro específico encontrado:', registroEspecifico.id);
    } else {
      console.log('⚠️ Registro específico NÃO encontrado na lista');
    }

    return res.json({
      success: true,
      data: registrosComNomes || [],
      count: (registrosComNomes || []).length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar registros de tempo sem tarefa:', error);
    console.error('❌ Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar registros de tempo sem tarefa',
      details: error.message
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
  // Buscar produtos por IDs (verificando tanto id quanto clickup_id para robustez)
  const produtos = [];

  for (const produtoId of produtoIds) {
    try {
      console.log(`🔍 Buscando produto input: "${produtoId}" (tipo: ${typeof produtoId})`);

      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .or(`id.eq."${produtoId}",clickup_id.eq."${produtoId}"`)
        .maybeSingle();

      if (error) {
        console.error(`❌ Erro ao buscar produto "${produtoId}":`, error);
      } else if (data) {
        console.log(`✅ Produto encontrado: ID="${data.id}", Nome="${data.nome}"`);
        produtos.push(data);
      } else {
        console.log(`⚠️ Produto não encontrado para input: "${produtoId}"`);
      }
    } catch (err) {
      // Continuar para próximo produto se der erro
      console.error(`❌ Exceção ao buscar produto "${produtoId}":`, err);
    }
  }

  console.log(`📦 Total de produtos encontrados: ${produtos.length} de ${produtoIds.length}`);
  return produtos;
}

async function getProdutosPorClickupIds(clickupIds) {
  // Buscar produtos por clickup_id (mas também verificando id para robustez misturando legados)
  const produtos = [];

  for (const clickupId of clickupIds) {
    try {
      console.log(`🔍 Buscando produto por input (clickup/id): "${clickupId}"`);

      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .or(`clickup_id.eq."${clickupId}",id.eq."${clickupId}"`)
        .maybeSingle();

      if (error) {
        console.error(`❌ Erro ao buscar produto por input "${clickupId}":`, error);
      } else if (data) {
        console.log(`✅ Produto encontrado: clickup_id="${data.clickup_id}", id="${data.id}", Nome="${data.nome}"`);
        produtos.push({
          clickup_id: data.clickup_id,
          nome: data.nome,
          id: data.id
        });
      } else {
        console.log(`⚠️ Produto não encontrado para input: "${clickupId}"`);
      }
    } catch (err) {
      // Continuar para próximo produto se der erro
      console.error(`❌ Exceção ao buscar produto por input "${clickupId}":`, err);
    }
  }

  console.log(`📦 Total de produtos encontrados por input: ${produtos.length} de ${clickupIds.length}`);
  return produtos;
}
//====================================

//===================== FUNÇÕES REUTILIZÁVEIS - MEMBROS =====================
async function getAllMembros() {
  // Buscar todos os membros (mesma lógica do getMembrosIdNome)
  const { data, error } = await supabase
    .schema('up_gestaointeligente')
    .from('membro')
    .select('id, nome, status')
    .not('id', 'is', null)
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }

  // Garantir que todos os membros tenham status (assumir 'ativo' se não estiver definido)
  return (data || []).map(row => ({
    id: row.id,
    nome: row.nome,
    status: row.status || 'ativo'
  }));
}

async function getMembrosPorIds(membroIds) {
  if (!membroIds || membroIds.length === 0) {
    return [];
  }

  // Normalizar IDs: tentar converter para número quando possível, mas manter string também
  const membroIdsNormalizados = membroIds.map(id => {
    const idStr = String(id).trim();
    const idNum = parseInt(idStr, 10);
    return { original: id, string: idStr, number: isNaN(idNum) ? null : idNum };
  });

  // Criar lista única de IDs para buscar (tentar número primeiro, depois string)
  const idsParaBuscar = [];
  membroIdsNormalizados.forEach(({ string, number }) => {
    if (number !== null && !idsParaBuscar.includes(number)) {
      idsParaBuscar.push(number);
    } else if (!idsParaBuscar.includes(string)) {
      idsParaBuscar.push(string);
    }
  });

  if (idsParaBuscar.length === 0) {
    return [];
  }

  let membros = [];

  try {
    // Tentar com .in() usando números (se todos forem números)
    const todosNumeros = idsParaBuscar.every(id => typeof id === 'number' || !isNaN(parseInt(String(id), 10)));

    if (todosNumeros) {
      // Converter todos para números
      const idsNumeros = idsParaBuscar.map(id => typeof id === 'number' ? id : parseInt(String(id), 10)).filter(id => !isNaN(id));

      if (idsNumeros.length > 0) {
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, nome, status')
          .in('id', idsNumeros);

        if (!error && data && data.length > 0) {
          membros = data.map(m => ({
            ...m,
            status: m.status || 'ativo'
          }));
        }
      }
    }

    // Se não encontrou todos ou não são todos números, buscar também como string
    if (membros.length < idsParaBuscar.length) {
      const idsStrings = idsParaBuscar.map(id => String(id).trim());
      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome, status')
        .in('id', idsStrings);

      if (!error && data) {
        // Combinar resultados, evitando duplicatas
        const membrosMap = new Map();
        membros.forEach(m => membrosMap.set(String(m.id).trim(), m));
        data.forEach(m => {
          const key = String(m.id).trim();
          if (!membrosMap.has(key)) {
            membrosMap.set(key, {
              ...m,
              status: m.status || 'ativo'
            });
          }
        });
        membros = Array.from(membrosMap.values());
      }
    }

    // Se ainda faltar membros, buscar individualmente (fallback robusto)
    if (membros.length < idsParaBuscar.length) {
      const membrosEncontrados = new Map();
      membros.forEach(m => membrosEncontrados.set(String(m.id).trim(), m));

      const membrosFaltantes = idsParaBuscar.filter(id => {
        const idStr = String(id).trim();
        const idNum = parseInt(idStr, 10);
        return !membrosEncontrados.has(idStr) &&
          !membrosEncontrados.has(String(idNum)) &&
          !Array.from(membrosEncontrados.keys()).some(key => String(key) === idStr || String(key) === String(idNum));
      });

      if (membrosFaltantes.length > 0) {
        const membrosPromises = membrosFaltantes.map(async (id) => {
          const idStr = String(id).trim();
          const idNum = parseInt(idStr, 10);

          // Tentar como número primeiro
          if (!isNaN(idNum)) {
            const { data, error } = await supabase
              .schema('up_gestaointeligente')
              .from('membro')
              .select('id, nome, status')
              .eq('id', idNum)
              .maybeSingle();
            if (!error && data) {
              return {
                ...data,
                status: data.status || 'ativo'
              };
            }
          }

          // Tentar como string
          const { data, error } = await supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id, nome, status')
            .eq('id', idStr)
            .maybeSingle();
          if (error) return null;
          return data ? {
            ...data,
            status: data.status || 'ativo'
          } : null;
        });

        const resultados = await Promise.all(membrosPromises);
        resultados.filter(Boolean).forEach(m => {
          const key = String(m.id).trim();
          if (!membrosEncontrados.has(key)) {
            membrosEncontrados.set(key, m);
          }
        });

        membros = Array.from(membrosEncontrados.values());
      }
    }
  } catch (err) {
    console.error('Erro ao buscar membros por IDs:', err);
    return [];
  }

  // Criar map com múltiplos formatos de ID para matching robusto
  const membrosMap = {};
  membros.forEach(membro => {
    if (!membro) return;
    const membroId = membro.id;
    const membroIdStr = String(membroId).trim();
    const membroIdNum = parseInt(membroIdStr, 10);

    // Armazenar em todos os formatos possíveis
    membrosMap[membroId] = membro;
    membrosMap[membroIdStr] = membro;
    if (!isNaN(membroIdNum)) {
      membrosMap[membroIdNum] = membro;
    }
  });

  // Retornar membros encontrados na ordem dos IDs solicitados
  const membrosRetornados = membroIds
    .map(id => {
      const idStr = String(id).trim();
      const idNum = parseInt(idStr, 10);

      // Tentar todos os formatos possíveis
      const membro = membrosMap[id] ||
        membrosMap[idStr] ||
        (isNaN(idNum) ? null : membrosMap[idNum]) ||
        null;

      // Garantir que o membro tenha status
      if (membro) {
        return {
          ...membro,
          status: membro.status || 'ativo'
        };
      }
      return null;
    })
    .filter(Boolean);

  // Log para debug (apenas se faltar algum membro)
  if (membrosRetornados.length < membroIds.length) {
    const idsNaoEncontrados = membroIds.filter(id => {
      const idStr = String(id).trim();
      const idNum = parseInt(idStr, 10);
      return !membrosMap[id] && !membrosMap[idStr] && (isNaN(idNum) || !membrosMap[idNum]);
    });
    console.warn(`⚠️ [getMembrosPorIds] Alguns membros não foram encontrados:`, idsNaoEncontrados);
  }

  return membrosRetornados;
}

//===================== FUNÇÕES REUTILIZÁVEIS - MEMBROS POR CLIENTE =====================
//===================== FUNÇÕES REUTILIZÁVEIS - MEMBROS POR CLIENTE =====================
// COPIADO EXATAMENTE DE getClientesPorColaborador, MAS INVERTIDO
async function getMembrosPorCliente(clienteId, periodoInicio = null, periodoFim = null) {
  try {
    if (!clienteId) {
      return [];
    }

    // Suportar múltiplos clientes (array ou valor único) - MESMA LÓGICA DE getClientesPorColaborador
    let clienteIds = [];
    if (Array.isArray(clienteId)) {
      // Para clientes, manter como string (não converter para número)
      clienteIds = clienteId.map(id => String(id).trim()).filter(Boolean);
    } else {
      clienteIds = [String(clienteId).trim()];
    }

    if (clienteIds.length === 0) {
      return [];
    }

    console.log(`🔍 [GET-MEMBROS-POR-CLIENTE] Buscando colaboradores para clientes:`, {
      clienteIds,
      periodoInicio,
      periodoFim,
      temPeriodo: !!(periodoInicio && periodoFim)
    });

    // Buscar registros de tempo desses clientes
    // NOTA: cliente_id pode conter múltiplos IDs separados por ", ", então não podemos usar .eq() diretamente
    // Vamos buscar todos os registros e filtrar manualmente (igual getClientesPorColaborador faz)
    // IMPORTANTE: Sem limite para garantir que pegamos todos os registros
    let query = supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('usuario_id, cliente_id')  // INVERTIDO: buscar usuario_id e cliente_id para filtrar
      .not('usuario_id', 'is', null)
      .not('cliente_id', 'is', null)
      .limit(10000); // Limite alto para garantir que pegamos todos os registros

    // Se houver período, filtrar por ele - MESMA LÓGICA DE getClientesPorColaborador
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
      console.error(`❌ [GET-MEMBROS-POR-CLIENTE] Erro na query:`, error);
      throw error;
    }

    console.log(`📊 [GET-MEMBROS-POR-CLIENTE] Registros encontrados: ${(registros || []).length}`);

    // Filtrar registros que pertencem a qualquer um dos clientes (cliente_id pode conter múltiplos IDs separados por ", ")
    // INVERTIDO: filtrar por cliente_id ao invés de usuario_id
    const registrosFiltrados = (registros || []).filter(r => {
      if (!r.cliente_id) return false;
      const ids = String(r.cliente_id)
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      // Verificar se algum dos IDs do registro está na lista de clientes
      return clienteIds.some(clienteIdStr => ids.includes(clienteIdStr));
    });

    console.log(`📊 [GET-MEMBROS-POR-CLIENTE] Registros filtrados por cliente: ${registrosFiltrados.length}`);

    // Extrair IDs únicos de colaboradores - INVERTIDO: extrair usuario_id ao invés de cliente_id
    const todosUsuarioIdsDosRegistros = [];
    registrosFiltrados.forEach(r => {
      if (r.usuario_id) {
        todosUsuarioIdsDosRegistros.push(r.usuario_id);
      }
    });
    const usuarioIds = [...new Set(todosUsuarioIdsDosRegistros.filter(Boolean))];

    console.log(`📋 [GET-MEMBROS-POR-CLIENTE] IDs únicos de colaboradores: ${usuarioIds.length}`);

    if (usuarioIds.length === 0) {
      console.log(`⚠️ [GET-MEMBROS-POR-CLIENTE] Nenhum colaborador encontrado`);
      return [];
    }

    // Buscar membros por esses IDs - MESMA LÓGICA DE getClientesPorColaborador (busca individual)
    const membros = [];
    for (const usuarioId of usuarioIds) {
      try {
        // Tentar como número primeiro
        const idNum = parseInt(usuarioId, 10);
        if (!isNaN(idNum)) {
          const { data, error } = await supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id, nome, status')
            .eq('id', idNum)
            .maybeSingle();

          if (!error && data) {
            membros.push({
              id: data.id,
              nome: data.nome,
              status: data.status || 'ativo'
            });
            continue;
          }
        }

        // Tentar como string
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, nome, status')
          .eq('id', String(usuarioId).trim())
          .maybeSingle();

        if (!error && data) {
          membros.push({
            id: data.id,
            nome: data.nome,
            status: data.status || 'ativo'
          });
        } else {
          // Se não encontrou, adicionar com nome null (frontend vai tratar)
          membros.push({
            id: usuarioId,
            nome: null,
            status: 'ativo' // Assumir ativo se não encontrou
          });
        }
      } catch (err) {
        console.error(`Erro ao buscar membro "${usuarioId}":`, err);
        // Adicionar mesmo sem nome
        membros.push({
          id: usuarioId,
          nome: null,
          status: 'ativo' // Assumir ativo se não encontrou
        });
      }
    }

    // Ordenar por nome - MESMA LÓGICA DE getClientesPorColaborador
    membros.sort((a, b) => {
      if (!a.nome && !b.nome) return 0;
      if (!a.nome) return 1;
      if (!b.nome) return -1;
      return (a.nome || '').localeCompare(b.nome || '');
    });

    console.log(`✅ [GET-MEMBROS-POR-CLIENTE] Retornando ${membros.length} colaboradores`);

    return membros || [];
  } catch (error) {
    console.error('❌ [GET-MEMBROS-POR-CLIENTE] Erro ao buscar membros por cliente:', error);
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
    // IMPORTANTE: cliente_id pode conter múltiplos IDs separados por ", "
    const todosClienteIdsDosRegistros = [];
    (registros || []).forEach(r => {
      if (r.cliente_id) {
        const ids = String(r.cliente_id)
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
        todosClienteIdsDosRegistros.push(...ids);
      }
    });
    const clienteIds = [...new Set(todosClienteIdsDosRegistros.filter(Boolean))];

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
  app.get('/api/cp_clientes-id-nome', requireAuth ? requireAuth : (_req, _res, next) => next(), getcp_clientesIdNome);
  app.get('/api/membros-id-nome', requireAuth ? requireAuth : (_req, _res, next) => next(), getMembrosIdNome);
  app.get('/api/membros-id-nome-todos', requireAuth ? requireAuth : (_req, _res, next) => next(), getMembrosIdNomeTodos);

  // Endpoints do Dashboard Clientes (com autenticação se disponível)
  // IMPORTANTE: Estes endpoints são usados pelo Dashboard Clientes React e HTML
  // REMOVIDO: app.get('/api/clientes', ...) - Agora usando o controller completo em clientes.controller.js
  // app.get('/api/clientes', requireAuth ? requireAuth : (_req,_res,next)=>next(), getClientesEndpoint);
  app.get('/api/status', requireAuth ? requireAuth : (_req, _res, next) => next(), getStatusEndpoint);
  app.get('/api/contratos', requireAuth ? requireAuth : (_req, _res, next) => next(), getContratosEndpoint);
  app.get('/api/contratos-cliente/:nomeClienteClickup', requireAuth ? requireAuth : (_req, _res, next) => next(), getContratosClienteEndpoint);
  app.get('/api/contratos-cliente-id/:idCliente', requireAuth ? requireAuth : (_req, _res, next) => next(), getContratosClienteIdEndpoint);
  app.get('/api/tarefas/:clienteId', requireAuth ? requireAuth : (_req, _res, next) => next(), getTarefasEndpoint);
  // REMOVIDO: /api/registro-tempo - Consolidado no registro-tempo.controller.js
  // REMOVIDO: /api/registro-tempo-sem-tarefa - Movido para /api/registro-tempo/debug/sem-tarefa

  // Endpoints outros (com autenticação se disponível)
  app.get('/api/v_custo_hora_membro', requireAuth ? requireAuth : (_req, _res, next) => next(), getCustoHoraMembro);
  app.get('/api/faturamento', requireAuth ? requireAuth : (_req, _res, next) => next(), getFaturamento);
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
    getContratosByClienteId,
    getContratosByClickupNome,
    getTarefasPorCliente,
    getProdutoPorId,
    getProdutosPorIds,
    getProdutosPorClickupIds,
    getMembrosPorIds,
    getMembrosPorCliente,
    getClientesPorColaborador,
    // Endpoints
    getClientesEndpoint,
    getStatusEndpoint,
    getContratosEndpoint,
    getContratosClienteEndpoint,
    getContratosClienteIdEndpoint,
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
