// =============================================================
// === CONTROLLER DE DASHBOARD ===
// =============================================================

const supabase = require('../config/database');
const apiClientes = require('../services/api-clientes');
const { getMembrosPorIds, getProdutosPorIds } = apiClientes;

// Função auxiliar para extrair IDs de clientes de uma string que pode conter múltiplos IDs separados por ", "
function extrairClienteIds(clienteIdString) {
  if (!clienteIdString) return [];
  const ids = String(clienteIdString)
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  return ids;
}

// Função auxiliar para verificar se um registro pertence a algum dos clientes especificados
function registroPertenceAosClientes(registro, clienteIdsList) {
  if (!registro.cliente_id || !clienteIdsList || clienteIdsList.length === 0) return false;
  const idsDoRegistro = extrairClienteIds(registro.cliente_id);
  const clienteIdsSet = new Set(clienteIdsList.map(id => String(id).trim()));
  return idsDoRegistro.some(id => clienteIdsSet.has(String(id).trim()));
}

// ========================================
// === GET /api/dashboard-clientes ===
// ========================================
async function getDashboardClientes(req, res) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      clienteId, 
      colaboradorId, 
      dataInicio, 
      dataFim 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Processar colaboradorId - pode vir como array, múltiplos parâmetros na query string, ou string separada por vírgula
    let colaboradorIdsArray = [];
    const colaboradorIdsFromQuery = req.query.colaboradorId;
    
    if (colaboradorIdsFromQuery) {
      let idsParaProcessar = [];
      
      // Se for array (múltiplos parâmetros na query string)
      if (Array.isArray(colaboradorIdsFromQuery)) {
        idsParaProcessar = colaboradorIdsFromQuery;
      } 
      // Se for string que contém vírgulas (fallback)
      else if (typeof colaboradorIdsFromQuery === 'string' && colaboradorIdsFromQuery.includes(',')) {
        idsParaProcessar = colaboradorIdsFromQuery.split(',').map(id => id.trim()).filter(Boolean);
      }
      // Valor único
      else {
        idsParaProcessar = [colaboradorIdsFromQuery];
      }
      
      // Converter para números válidos
      colaboradorIdsArray = idsParaProcessar.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));
      
      console.log(`📋 [DASHBOARD-CLIENTES] Processamento colaboradorId:`, {
        original: colaboradorIdsFromQuery,
        processado: colaboradorIdsArray,
        tipo: typeof colaboradorIdsFromQuery,
        isArray: Array.isArray(colaboradorIdsFromQuery)
      });
    }

    // Processar clienteId - pode vir como array, múltiplos parâmetros na query string, ou string separada por vírgula
    let clienteIdsArray = [];
    const clienteIdsFromQuery = req.query.clienteId;
    
    if (clienteIdsFromQuery) {
      let idsParaProcessar = [];
      
      // Se for array (múltiplos parâmetros na query string)
      if (Array.isArray(clienteIdsFromQuery)) {
        idsParaProcessar = clienteIdsFromQuery;
      } 
      // Se for string que contém vírgulas (fallback)
      else if (typeof clienteIdsFromQuery === 'string' && clienteIdsFromQuery.includes(',')) {
        idsParaProcessar = clienteIdsFromQuery.split(',').map(id => id.trim()).filter(Boolean);
      }
      // Valor único
      else {
        idsParaProcessar = [clienteIdsFromQuery];
      }
      
      // Converter para strings (IDs de clientes são strings)
      clienteIdsArray = idsParaProcessar.map(id => String(id).trim()).filter(Boolean);
      
      console.log(`📋 [DASHBOARD-CLIENTES] Processamento clienteId:`, {
        original: clienteIdsFromQuery,
        processado: clienteIdsArray,
        tipo: typeof clienteIdsFromQuery,
        isArray: Array.isArray(clienteIdsFromQuery)
      });
    }

    console.log('🔍 [DASHBOARD-CLIENTES] Buscando clientes paginados:', {
      page: pageNum,
      limit: limitNum,
      status,
      clienteIds: clienteIdsArray,
      colaboradorIds: colaboradorIdsArray,
      dataInicio,
      dataFim
    });

    // Validar período se necessário
    const temColaboradores = colaboradorIdsArray.length > 0;
    const temClientes = clienteIdsArray.length > 0;
    if ((temClientes || temColaboradores) && (!dataInicio || !dataFim)) {
      return res.status(400).json({
        success: false,
        error: 'Período (dataInicio e dataFim) é obrigatório quando filtrar por cliente ou colaborador'
      });
    }

    // 1. Identificar quais clientes devem ser retornados
    let clienteIds = [];

    if (clienteIdsArray.length > 0) {
      // Se tem clienteId(s) específico(s), usar apenas ele(s)
      clienteIds = clienteIdsArray;
      console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados: ${clienteIds.length} cliente(s) - [${clienteIds.join(', ')}]`);
    } else if (status) {
      // PRIORIDADE 1: Se tem status, buscar clientes pelos contratos com aquele status
      const { data: contratos, error: contratosError } = await supabase
        .schema('up_gestaointeligente')
        .from('contratos_clientes')
        .select('id_cliente')
        .eq('status', status)
        .not('id_cliente', 'is', null);

      if (contratosError) {
        console.error('Erro ao buscar contratos:', contratosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar contratos' });
      }

      clienteIds = [...new Set((contratos || []).map(c => String(c.id_cliente).trim()).filter(Boolean))];
      console.log(`✅ [DASHBOARD-CLIENTES] Filtro de status aplicado: ${clienteIds.length} clientes encontrados com status "${status}"`);
    } else if (dataInicio && dataFim && clienteIdsArray.length === 0) {
      // Se não tem status mas tem período E NÃO tem clientes selecionados, buscar clientes pelos registros de tempo
      const dateInicialObj = new Date(dataInicio);
      const dateFinalObj = new Date(dataFim);
      dateInicialObj.setUTCHours(0, 0, 0, 0);
      dateFinalObj.setUTCHours(23, 59, 59, 999);
      const inicioStr = dateInicialObj.toISOString();
      const fimStr = dateFinalObj.toISOString();

      let registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('cliente_id')
        .not('cliente_id', 'is', null)
        .not('data_inicio', 'is', null)
        .gte('data_inicio', inicioStr)
        .lte('data_inicio', fimStr);

      // Filtro de colaborador(es) - usar array já processado
      if (colaboradorIdsArray.length > 0) {
        if (colaboradorIdsArray.length === 1) {
          registrosQuery = registrosQuery.eq('usuario_id', colaboradorIdsArray[0]);
          console.log(`✅ [DASHBOARD-CLIENTES] Filtro de colaborador (busca clientes): usuario_id = ${colaboradorIdsArray[0]}`);
        } else {
          registrosQuery = registrosQuery.in('usuario_id', colaboradorIdsArray);
          console.log(`✅ [DASHBOARD-CLIENTES] Filtro de colaboradores (busca clientes): usuario_id IN [${colaboradorIdsArray.join(', ')}]`);
        }
      }

      const { data: registros, error: registrosError } = await registrosQuery;
      if (registrosError) {
        console.error('Erro ao buscar registros:', registrosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }

      // Extrair todos os IDs de clientes, considerando que cliente_id pode conter múltiplos IDs separados por ", "
      const todosClienteIdsDosRegistros = [];
      (registros || []).forEach(r => {
        if (r.cliente_id) {
          const idsExtraidos = extrairClienteIds(r.cliente_id);
          todosClienteIdsDosRegistros.push(...idsExtraidos);
        }
      });
      clienteIds = [...new Set(todosClienteIdsDosRegistros.filter(Boolean))];
      console.log(`✅ [DASHBOARD-CLIENTES] Filtro de período aplicado: ${clienteIds.length} clientes encontrados no período`);
    }

    if (clienteIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0
      });
    }

    // 2. Paginar os IDs de clientes
    const totalClientes = clienteIds.length;
    const totalPages = Math.max(1, Math.ceil(totalClientes / limitNum));
    const clienteIdsPaginated = clienteIds.slice(offset, offset + limitNum);

    // 3. Buscar dados dos clientes da página atual
    const { data: clientes, error: clientesError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome')
      .in('id', clienteIdsPaginated);

    if (clientesError) {
      console.error('Erro ao buscar clientes:', clientesError);
      return res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
    }

    // 4. Buscar todos os dados em paralelo
    const dateInicialObj = dataInicio ? new Date(dataInicio) : null;
    const dateFinalObj = dataFim ? new Date(dataFim) : null;
    if (dateInicialObj) dateInicialObj.setUTCHours(0, 0, 0, 0);
    if (dateFinalObj) dateFinalObj.setUTCHours(23, 59, 59, 999);
    const inicioStr = dateInicialObj ? dateInicialObj.toISOString() : null;
    const fimStr = dateFinalObj ? dateFinalObj.toISOString() : null;

    // Buscar contratos e registros APENAS dos clientes da página atual (para exibição)
    let contratosQuery = supabase
      .schema('up_gestaointeligente')
      .from('contratos_clientes')
      .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social')
      .in('id_cliente', clienteIdsPaginated);
    
    if (status) {
      contratosQuery = contratosQuery.eq('status', status);
    }

    // Buscar registros APENAS dos clientes da página atual (para exibição nos cards individuais)
    // NOTA: cliente_id pode conter múltiplos IDs separados por ", ", então não podemos usar .in() diretamente
    // Vamos buscar todos os registros que atendem aos outros filtros e filtrar manualmente por cliente_id
    let registrosQuery = null;
    if (clienteIdsPaginated.length > 0) {
      registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('*')
        .not('cliente_id', 'is', null)
        .not('data_inicio', 'is', null);

      // Aplicar filtro de período se fornecido
      if (dataInicio && dataFim) {
        registrosQuery = registrosQuery
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      }

      // Filtro de colaborador(es) - usar array já processado
      if (colaboradorIdsArray.length > 0) {
        if (colaboradorIdsArray.length === 1) {
          registrosQuery = registrosQuery.eq('usuario_id', colaboradorIdsArray[0]);
          console.log(`✅ [DASHBOARD-CLIENTES] Filtro de colaborador (registros): usuario_id = ${colaboradorIdsArray[0]}`);
        } else {
          registrosQuery = registrosQuery.in('usuario_id', colaboradorIdsArray);
          console.log(`✅ [DASHBOARD-CLIENTES] Filtro de colaboradores (registros): usuario_id IN [${colaboradorIdsArray.join(', ')}]`);
        }
      }
    }

    // Buscar TODOS os registros e contratos de TODOS os clientes (para totais do dashboard)
    let todosContratosQuery = supabase
      .schema('up_gestaointeligente')
      .from('contratos_clientes')
      .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social')
      .in('id_cliente', clienteIds); // TODOS os clientes, não apenas da página
    
    if (status) {
      todosContratosQuery = todosContratosQuery.eq('status', status);
    }

    // Buscar TODOS os registros de TODOS os clientes (para totais do dashboard)
    // NOTA: cliente_id pode conter múltiplos IDs separados por ", ", então não podemos usar .in() diretamente
    // Vamos buscar todos os registros que atendem aos outros filtros e filtrar manualmente por cliente_id
    let todosRegistrosQuery = null;
    if (clienteIds.length > 0) {
      todosRegistrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('*')
        .not('cliente_id', 'is', null)
        .not('data_inicio', 'is', null);

      // Aplicar filtro de período se fornecido
      if (dataInicio && dataFim) {
        todosRegistrosQuery = todosRegistrosQuery
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      }

      // Filtro de colaborador(es) - usar array já processado
      if (colaboradorIdsArray.length > 0) {
        if (colaboradorIdsArray.length === 1) {
          todosRegistrosQuery = todosRegistrosQuery.eq('usuario_id', colaboradorIdsArray[0]);
        } else {
          todosRegistrosQuery = todosRegistrosQuery.in('usuario_id', colaboradorIdsArray);
        }
      }
    }

    const [contratosData, registrosData, todosContratosData, todosRegistrosData] = await Promise.all([
      contratosQuery ? contratosQuery : Promise.resolve({ data: [], error: null }),
      registrosQuery ? registrosQuery : Promise.resolve({ data: [], error: null }),
      todosContratosQuery ? todosContratosQuery : Promise.resolve({ data: [], error: null }),
      todosRegistrosQuery ? todosRegistrosQuery : Promise.resolve({ data: [], error: null })
    ]);

    // Contratos e registros da página atual (para exibição nos cards individuais)
    const contratosPagina = contratosData.data || [];
    // Filtrar registros manualmente, pois cliente_id pode conter múltiplos IDs separados por ", "
    const registrosPaginaRaw = registrosData.data || [];
    const registrosPagina = registrosPaginaRaw.filter(r => registroPertenceAosClientes(r, clienteIdsPaginated));
    
    // TODOS os contratos e registros (para totais do dashboard)
    const todosContratos = todosContratosData.data || [];
    // Filtrar registros manualmente, pois cliente_id pode conter múltiplos IDs separados por ", "
    const todosRegistrosRaw = todosRegistrosData.data || [];
    const todosRegistros = todosRegistrosRaw.filter(r => registroPertenceAosClientes(r, clienteIds));

    // IMPORTANTE: Buscar tarefas de TODOS os registros (incluindo os que têm múltiplos cliente_id)
    // Usar registrosPaginaRaw (antes do filtro) para garantir que pegamos todas as tarefas
    // que podem estar vinculadas a múltiplos clientes
    const todosTarefaIds = [...new Set([
      ...todosRegistros.map(r => r.tarefa_id).filter(Boolean),
      ...registrosPaginaRaw.map(r => r.tarefa_id).filter(Boolean)
    ])];
    const todosUsuarioIds = [...new Set([
      ...todosRegistros.map(r => r.usuario_id).filter(Boolean),
      ...registrosPaginaRaw.map(r => r.usuario_id).filter(Boolean)
    ])];

    const [tarefasData, membrosData] = await Promise.all([
      todosTarefaIds.length > 0 ? (async () => {
        const tarefaIdsStrings = todosTarefaIds.map(id => String(id).trim());
        const orConditions = tarefaIdsStrings.map(id => `id.eq.${id}`).join(',');
        const { data: tarefas } = await supabase
          .schema('up_gestaointeligente')
          .from('tarefa')
          .select('*')
          .or(orConditions);
        return tarefas || [];
      })() : Promise.resolve([]),
      todosUsuarioIds.length > 0 ? getMembrosPorIds(todosUsuarioIds) : Promise.resolve([])
    ]);

    const todosProdutoIds = [...new Set(tarefasData.map(t => t.produto_id).filter(Boolean))];
    const produtosData = todosProdutoIds.length > 0 ? await getProdutosPorIds(todosProdutoIds) : [];

    const produtosMapGlobal = {};
    produtosData.forEach(produto => {
      produtosMapGlobal[String(produto.id).trim()] = produto;
    });

    const tarefasMapGlobal = {};
    tarefasData.forEach(tarefa => {
      const tarefaComProduto = { ...tarefa };
      if (tarefa.produto_id) {
        const produtoId = String(tarefa.produto_id).trim();
        const produtoVinculado = produtosMapGlobal[produtoId];
        tarefaComProduto.produto = produtoVinculado || null;
      }
      tarefasMapGlobal[String(tarefa.id).trim()] = tarefaComProduto;
    });

    const membrosMapGlobal = {};
    membrosData.forEach(membro => {
      const membroId = membro.id;
      const membroIdStr = String(membroId).trim();
      membrosMapGlobal[membroId] = membro;
      membrosMapGlobal[membroIdStr] = membro;
      const membroIdNum = parseInt(membroIdStr, 10);
      if (!isNaN(membroIdNum)) {
        membrosMapGlobal[membroIdNum] = membro;
      }
    });

    // 5. Agrupar dados por cliente e calcular resumos (usando dados da página atual)
    // IMPORTANTE: Um registro pode pertencer a múltiplos clientes (cliente_id pode conter "id1, id2, id3")
    // Então, quando um registro pertence a um cliente, ele deve aparecer no card desse cliente
    // Usar registrosPaginaRaw (antes do filtro) para garantir que pegamos todos os registros
    // que podem ter múltiplos cliente_id e pertencem a este cliente
    const clientesComResumos = (clientes || []).map(cliente => {
      const clienteIdStr = String(cliente.id).trim();
      const contratos = contratosPagina.filter(c => String(c.id_cliente).trim() === clienteIdStr);
      // Filtrar registros que pertencem a este cliente (pode ser um dos múltiplos IDs no cliente_id)
      // Usar registrosPaginaRaw para garantir que pegamos todos os registros, mesmo os que têm múltiplos cliente_id
      const registrosTempo = registrosPaginaRaw.filter(r => registroPertenceAosClientes(r, [clienteIdStr]));

      const registrosCompletos = registrosTempo.map(registro => {
        const registroRetorno = { ...registro };
        if (registro.tarefa_id) {
          registroRetorno.tarefa = tarefasMapGlobal[String(registro.tarefa_id).trim()] || null;
        }
        if (registro.usuario_id) {
          const usuarioId = registro.usuario_id;
          registroRetorno.membro = membrosMapGlobal[usuarioId] || 
                                   membrosMapGlobal[String(usuarioId)] || 
                                   membrosMapGlobal[parseInt(usuarioId)] || 
                                   null;
        }
        return registroRetorno;
      });

      const totalContratos = contratos.length;
      const tarefasUnicas = new Set(registrosCompletos.map(r => r.tarefa_id).filter(Boolean));
      const totalTarefasUnicas = tarefasUnicas.size;
      
      const produtosUnicos = new Set();
      registrosCompletos.forEach(r => {
        if (r.tarefa && r.tarefa.produto_id) {
          produtosUnicos.add(String(r.tarefa.produto_id).trim());
        }
      });
      const totalProdutosUnicos = produtosUnicos.size;

      const colaboradoresUnicos = new Set(registrosCompletos.map(r => r.usuario_id).filter(Boolean));
      const totalColaboradoresUnicos = colaboradoresUnicos.size;

      let tempoTotalGeral = 0;
      registrosCompletos.forEach(r => {
        tempoTotalGeral += Number(r.tempo_realizado) || 0;
      });

      const tempoPorColaborador = {};
      registrosCompletos.forEach(r => {
        if (r.usuario_id && r.membro) {
          const colaboradorId = String(r.usuario_id).trim();
          if (!tempoPorColaborador[colaboradorId]) {
            tempoPorColaborador[colaboradorId] = {
              nome: r.membro.nome || `Colaborador ${colaboradorId}`,
              total: 0
            };
          }
          tempoPorColaborador[colaboradorId].total += Number(r.tempo_realizado) || 0;
        }
      });

      return {
        cliente: cliente,
        contratos: contratos,
        registros: registrosCompletos,
        resumo: {
          totalContratos,
          totalTarefasUnicas,
          totalProdutosUnicos,
          totalColaboradoresUnicos,
          tempoTotalGeral,
          tempoPorColaborador
        }
      };
    });

    // Calcular totais gerais para o dashboard (de TODOS os clientes, não apenas da página)
    const todosTarefaIdsGerais = [...new Set(todosRegistros.map(r => r.tarefa_id).filter(Boolean))];
    const todosUsuarioIdsGerais = [...new Set(todosRegistros.map(r => r.usuario_id).filter(Boolean))];
    // Extrair todos os IDs de clientes, considerando que cliente_id pode conter múltiplos IDs separados por ", "
    const todosClienteIdsGeraisArray = [];
    todosRegistros.forEach(r => {
      if (r.cliente_id) {
        const idsExtraidos = extrairClienteIds(r.cliente_id);
        todosClienteIdsGeraisArray.push(...idsExtraidos);
      }
    });
    const todosClienteIdsGerais = [...new Set(todosClienteIdsGeraisArray.filter(Boolean))];

    res.json({
      success: true,
      data: clientesComResumos,
      count: clientesComResumos.length,
      total: totalClientes,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages,
      // Totais gerais para o dashboard (de todas as páginas)
      totaisGerais: {
        totalTarefas: todosTarefaIdsGerais.length,
        totalRegistros: todosRegistros.length,
        totalColaboradores: todosUsuarioIdsGerais.length,
        totalClientes: todosClienteIdsGerais.length,
        totalTempo: todosRegistros.reduce((sum, r) => sum + (Number(r.tempo_realizado) || 0), 0),
        todosRegistros: todosRegistros,
        todosContratos: todosContratos
      }
    });

  } catch (error) {
    console.error('Erro inesperado no endpoint dashboard-clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getDashboardClientes
};

