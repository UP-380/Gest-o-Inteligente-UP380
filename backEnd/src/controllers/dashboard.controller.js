// =============================================================
// === CONTROLLER DE DASHBOARD ===
// =============================================================

const supabase = require('../config/database');
const apiClientes = require('../services/api-clientes');
const { getMembrosPorIds, getProdutosPorIds } = apiClientes;

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

    console.log('🔍 [DASHBOARD-CLIENTES] Buscando clientes paginados:', {
      page: pageNum,
      limit: limitNum,
      status,
      clienteId,
      colaboradorIds: colaboradorIdsArray,
      dataInicio,
      dataFim
    });

    // Validar período se necessário
    const temColaboradores = colaboradorIdsArray.length > 0;
    if ((clienteId || temColaboradores) && (!dataInicio || !dataFim)) {
      return res.status(400).json({
        success: false,
        error: 'Período (dataInicio e dataFim) é obrigatório quando filtrar por cliente ou colaborador'
      });
    }

    // 1. Identificar quais clientes devem ser retornados
    let clienteIds = [];

    if (clienteId) {
      clienteIds = [String(clienteId).trim()];
    } else if (dataInicio && dataFim) {
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

      clienteIds = [...new Set((registros || []).map(r => String(r.cliente_id).trim()).filter(Boolean))];
    } else if (status) {
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

    let contratosQuery = supabase
      .schema('up_gestaointeligente')
      .from('contratos_clientes')
      .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social')
      .in('id_cliente', clienteIdsPaginated);
    
    if (status) {
      contratosQuery = contratosQuery.eq('status', status);
    }

    let registrosQuery = null;
    if (dataInicio && dataFim) {
      registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('*')
        .in('cliente_id', clienteIdsPaginated)
        .not('data_inicio', 'is', null)
        .gte('data_inicio', inicioStr)
        .lte('data_inicio', fimStr);

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

    const [contratosData, registrosData] = await Promise.all([
      contratosQuery ? contratosQuery : Promise.resolve({ data: [], error: null }),
      registrosQuery ? registrosQuery : Promise.resolve({ data: [], error: null })
    ]);

    const todosContratos = contratosData.data || [];
    const todosRegistros = registrosData.data || [];

    const todosTarefaIds = [...new Set(todosRegistros.map(r => r.tarefa_id).filter(Boolean))];
    const todosUsuarioIds = [...new Set(todosRegistros.map(r => r.usuario_id).filter(Boolean))];

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

    // 5. Agrupar dados por cliente e calcular resumos
    const clientesComResumos = (clientes || []).map(cliente => {
      const clienteIdStr = String(cliente.id).trim();
      const contratos = todosContratos.filter(c => String(c.id_cliente).trim() === clienteIdStr);
      const registrosTempo = todosRegistros.filter(r => String(r.cliente_id).trim() === clienteIdStr);

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

    res.json({
      success: true,
      data: clientesComResumos,
      count: clientesComResumos.length,
      total: totalClientes,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages
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

