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

// Função auxiliar para converter tempo_realizado para milissegundos
// Lógica: 
// - Se valor < 1 (decimal), está em horas decimais -> converter para ms
// - Se valor >= 1, está em milissegundos
// - Se resultado < 1 segundo (1000ms), arredondar para 1 segundo
function converterTempoParaMilissegundos(tempoRealizado) {
  if (!tempoRealizado || tempoRealizado === 0) return 0;
  
  let tempoMs;
  
  // Se o valor for menor que 1, está em horas decimais (ex: 0.5 = 0.5 horas)
  if (tempoRealizado < 1) {
    tempoMs = Math.round(tempoRealizado * 3600000);
  } else {
    // Caso contrário, já está em milissegundos
    tempoMs = tempoRealizado;
  }
  
  // Se o resultado for menor que 1 segundo, arredondar para 1 segundo
  if (tempoMs > 0 && tempoMs < 1000) {
    tempoMs = 1000;
  }
  
  return tempoMs;
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
      // Se tem clienteId(s) específico(s), verificar se têm registros no período (se período foi fornecido)
      if (dataInicio && dataFim) {
        // Filtrar apenas os clientes selecionados que têm registros no período
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
          } else {
            registrosQuery = registrosQuery.in('usuario_id', colaboradorIdsArray);
          }
        }

        const { data: registros, error: registrosError } = await registrosQuery;
        if (registrosError) {
          console.error('Erro ao buscar registros:', registrosError);
          return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
        }

        // Extrair todos os IDs de clientes dos registros
        const todosClienteIdsDosRegistros = [];
        (registros || []).forEach(r => {
          if (r.cliente_id) {
            const idsExtraidos = extrairClienteIds(r.cliente_id);
            todosClienteIdsDosRegistros.push(...idsExtraidos);
          }
        });
        let clienteIdsComRegistros = [...new Set(todosClienteIdsDosRegistros.filter(Boolean))];
        
        // Se há filtro de status, também filtrar por status
        if (status) {
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

          const clienteIdsComStatus = [...new Set((contratos || []).map(c => String(c.id_cliente).trim()).filter(Boolean))];
          
          // Interseção: clientes que têm registros no período E têm contratos com o status
          clienteIdsComRegistros = clienteIdsComRegistros.filter(clienteId => {
            const clienteIdStr = String(clienteId).trim();
            return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
          });
          
          console.log(`✅ [DASHBOARD-CLIENTES] Clientes com status "${status}": ${clienteIdsComStatus.length} cliente(s)`);
        }
        
        // Filtrar apenas os clientes selecionados que têm registros no período (e status, se aplicável)
        clienteIds = clienteIdsArray.filter(clienteId => {
          const clienteIdStr = String(clienteId).trim();
          return clienteIdsComRegistros.some(id => String(id).trim() === clienteIdStr);
        });
        
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados: ${clienteIdsArray.length} cliente(s)`);
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes com registros no período${status ? ` e status "${status}"` : ''}: ${clienteIdsComRegistros.length} cliente(s)`);
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados COM registros: ${clienteIds.length} cliente(s) - [${clienteIds.join(', ')}]`);
      } else {
        // Se não há período, mas há status, filtrar por status
        if (status) {
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

          const clienteIdsComStatus = [...new Set((contratos || []).map(c => String(c.id_cliente).trim()).filter(Boolean))];
          
          // Filtrar apenas os clientes selecionados que têm o status
          clienteIds = clienteIdsArray.filter(clienteId => {
            const clienteIdStr = String(clienteId).trim();
            return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
          });
          
          console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados: ${clienteIdsArray.length} cliente(s)`);
          console.log(`✅ [DASHBOARD-CLIENTES] Clientes com status "${status}": ${clienteIdsComStatus.length} cliente(s)`);
          console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados COM status: ${clienteIds.length} cliente(s) - [${clienteIds.join(', ')}]`);
        } else {
          // Se não há período nem status, usar todos os clientes selecionados
          clienteIds = clienteIdsArray;
          console.log(`✅ [DASHBOARD-CLIENTES] Clientes selecionados (sem período nem status): ${clienteIds.length} cliente(s) - [${clienteIds.join(', ')}]`);
        }
      }
    } else if (status && !dataInicio && !dataFim) {
      // PRIORIDADE 1: Se tem status MAS NÃO tem período, buscar clientes pelos contratos com aquele status
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
      
      // Se há status, filtrar também por status (interseção: clientes com registros no período E com status)
      if (status) {
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

        const clienteIdsComStatus = [...new Set((contratos || []).map(c => String(c.id_cliente).trim()).filter(Boolean))];
        
        // Interseção: apenas clientes que têm registros no período E têm contratos com o status
        const clientesAntes = clienteIds.length;
        clienteIds = clienteIds.filter(clienteId => {
          const clienteIdStr = String(clienteId).trim();
          return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
        });
        
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes com registros no período: ${clientesAntes} cliente(s)`);
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes com status "${status}": ${clienteIdsComStatus.length} cliente(s)`);
        console.log(`✅ [DASHBOARD-CLIENTES] Clientes com registros no período E status "${status}": ${clienteIds.length} cliente(s)`);
      }
    }

    // Se não há clientes encontrados, mas há filtros de período e/ou colaborador,
    // ainda buscar registros para retornar totais gerais do dashboard
    const temFiltrosPeriodoOuColaborador = (dataInicio && dataFim) || colaboradorIdsArray.length > 0;
    
    if (clienteIds.length === 0 && !temFiltrosPeriodoOuColaborador) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
        totaisGerais: {
          totalTarefas: 0,
          totalRegistros: 0,
          totalColaboradores: 0,
          totalClientes: 0,
          totalTempo: 0,
          todosRegistros: [],
          todosContratos: []
        }
      });
    }

    // 2. Paginar os IDs de clientes (ou usar array vazio se não há clientes)
    const totalClientes = clienteIds.length;
    const totalPages = Math.max(1, Math.ceil(totalClientes / limitNum));
    const clienteIdsPaginated = clienteIds.length > 0 ? clienteIds.slice(offset, offset + limitNum) : [];

    // 3. Buscar dados dos clientes da página atual (apenas se houver clientes)
    let clientes = [];
    if (clienteIdsPaginated.length > 0) {
      const { data: clientesData, error: clientesError } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .select('id, nome')
        .in('id', clienteIdsPaginated);

      if (clientesError) {
        console.error('Erro ao buscar clientes:', clientesError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
      }
      clientes = clientesData || [];
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
    // Se não há clientes mas há filtros de período/colaborador, buscar todos os registros que atendem aos filtros
    let registrosQuery = null;
    if (clienteIdsPaginated.length > 0 || temFiltrosPeriodoOuColaborador) {
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
    let todosContratosQuery = null;
    if (clienteIds.length > 0) {
      todosContratosQuery = supabase
        .schema('up_gestaointeligente')
        .from('contratos_clientes')
        .select('id_cliente, status, cpf_cnpj, url_atividade, dt_inicio, proxima_renovacao, ultima_renovacao, nome_contrato, razao_social')
        .in('id_cliente', clienteIds); // TODOS os clientes, não apenas da página
      
      if (status) {
        todosContratosQuery = todosContratosQuery.eq('status', status);
      }
    }

    // Buscar TODOS os registros de TODOS os clientes (para totais do dashboard)
    // NOTA: cliente_id pode conter múltiplos IDs separados por ", ", então não podemos usar .in() diretamente
    // Vamos buscar todos os registros que atendem aos outros filtros e filtrar manualmente por cliente_id
    // Se não há clientes mas há filtros de período/colaborador, buscar todos os registros que atendem aos filtros
    let todosRegistrosQuery = null;
    if (clienteIds.length > 0 || temFiltrosPeriodoOuColaborador) {
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
    // Se não há clientes, não filtrar por cliente (usar todos os registros que atendem aos filtros)
    const registrosPaginaRaw = registrosData.data || [];
    const registrosPagina = clienteIdsPaginated.length > 0 
      ? registrosPaginaRaw.filter(r => registroPertenceAosClientes(r, clienteIdsPaginated))
      : registrosPaginaRaw;
    
    // TODOS os contratos e registros (para totais do dashboard)
    const todosContratos = todosContratosData.data || [];
    // Filtrar registros manualmente, pois cliente_id pode conter múltiplos IDs separados por ", "
    // Se não há clientes, não filtrar por cliente (usar todos os registros que atendem aos filtros)
    const todosRegistrosRaw = todosRegistrosData.data || [];
    const todosRegistros = clienteIds.length > 0
      ? todosRegistrosRaw.filter(r => registroPertenceAosClientes(r, clienteIds))
      : todosRegistrosRaw;

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
              status: r.membro.status || 'ativo',
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

    // Calcular totais gerais para o dashboard
    // IMPORTANTE: Considerar apenas os clientes que estão sendo retornados (clienteIds)
    const todosTarefaIdsGerais = [...new Set(todosRegistros.map(r => r.tarefa_id).filter(Boolean))];
    const todosUsuarioIdsGerais = [...new Set(todosRegistros.map(r => r.usuario_id).filter(Boolean))];
    
    // Total de clientes: calcular a partir dos registros se não há clientes encontrados
    // ou usar os clientes encontrados se houver
    let todosClienteIdsGerais = [];
    if (clienteIds.length > 0) {
      // Se há clientes encontrados, usar eles
      todosClienteIdsGerais = clienteIds.map(id => String(id).trim());
    } else if (todosRegistros.length > 0) {
      // Se não há clientes encontrados mas há registros, calcular clientes únicos dos registros
      const clientesUnicosDosRegistros = new Set();
      todosRegistros.forEach(registro => {
        if (registro.cliente_id) {
          // cliente_id pode conter múltiplos IDs separados por ", "
          const ids = String(registro.cliente_id)
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
          ids.forEach(id => clientesUnicosDosRegistros.add(String(id).trim()));
        }
      });
      todosClienteIdsGerais = Array.from(clientesUnicosDosRegistros);
    }

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

// ========================================
// === GET /api/dashboard-colaboradores ===
// ========================================
async function getDashboardColaboradores(req, res) {
  try {
    const { 
      page = 1, 
      limit = 20, 
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
      
      if (Array.isArray(colaboradorIdsFromQuery)) {
        idsParaProcessar = colaboradorIdsFromQuery;
      } else if (typeof colaboradorIdsFromQuery === 'string' && colaboradorIdsFromQuery.includes(',')) {
        idsParaProcessar = colaboradorIdsFromQuery.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        idsParaProcessar = [colaboradorIdsFromQuery];
      }
      
      colaboradorIdsArray = idsParaProcessar.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));
    }

    // Processar clienteId - pode vir como array, múltiplos parâmetros na query string, ou string separada por vírgula
    let clienteIdsArray = [];
    const clienteIdsFromQuery = req.query.clienteId;
    
    if (clienteIdsFromQuery) {
      let idsParaProcessar = [];
      
      if (Array.isArray(clienteIdsFromQuery)) {
        idsParaProcessar = clienteIdsFromQuery;
      } else if (typeof clienteIdsFromQuery === 'string' && clienteIdsFromQuery.includes(',')) {
        idsParaProcessar = clienteIdsFromQuery.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        idsParaProcessar = [clienteIdsFromQuery];
      }
      
      clienteIdsArray = idsParaProcessar.map(id => String(id).trim()).filter(Boolean);
    }

    console.log('🔍 [DASHBOARD-COLABORADORES] Buscando colaboradores paginados:', {
      page: pageNum,
      limit: limitNum,
      clienteIds: clienteIdsArray,
      colaboradorIds: colaboradorIdsArray,
      dataInicio,
      dataFim
    });

    // Período não é mais obrigatório - pode filtrar apenas por cliente ou colaborador

    // 1. Identificar quais colaboradores devem ser retornados
    let colaboradorIds = [];

    if (colaboradorIdsArray.length > 0) {
      // Se tem colaboradorId(s) específico(s), usar apenas ele(s)
      colaboradorIds = colaboradorIdsArray.map(id => String(id).trim());
      console.log(`✅ [DASHBOARD-COLABORADORES] Colaboradores selecionados: ${colaboradorIds.length} colaborador(es) - [${colaboradorIds.join(', ')}]`);
    } else if (clienteIdsArray.length > 0) {
      // Se tem clienteId(s), buscar colaboradores pelos registros de tempo desses clientes
      console.log(`🔍 [DASHBOARD-COLABORADORES] Buscando colaboradores para clientes: [${clienteIdsArray.join(', ')}]`);
      
      let registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('usuario_id, cliente_id')
        .not('usuario_id', 'is', null)
        .not('cliente_id', 'is', null);

      // Se período foi fornecido, aplicar filtro de data
      if (dataInicio && dataFim) {
        const dateInicialObj = new Date(dataInicio);
        const dateFinalObj = new Date(dataFim);
        dateInicialObj.setUTCHours(0, 0, 0, 0);
        dateFinalObj.setUTCHours(23, 59, 59, 999);
        const inicioStr = dateInicialObj.toISOString();
        const fimStr = dateFinalObj.toISOString();
        
        registrosQuery = registrosQuery
          .not('data_inicio', 'is', null)
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      }

      const { data: registros, error: registrosError } = await registrosQuery;
      if (registrosError) {
        console.error('❌ Erro ao buscar registros:', registrosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }

      console.log(`📊 [DASHBOARD-COLABORADORES] Total de registros retornados da query: ${registros?.length || 0}`);

      // Filtrar registros que pertencem aos clientes especificados
      // Normalizar clienteIdsArray para comparação (garantir que todos sejam strings)
      const clienteIdsNormalizados = clienteIdsArray.map(id => String(id).trim().toLowerCase());
      console.log(`🔍 [DASHBOARD-COLABORADORES] Clientes normalizados para busca: [${clienteIdsNormalizados.join(', ')}]`);
      
      const registrosFiltrados = (registros || []).filter(r => {
        if (!r.cliente_id) return false;
        const idsExtraidos = extrairClienteIds(r.cliente_id);
        // Comparar normalizando os IDs (lowercase para garantir match)
        const match = idsExtraidos.some(id => {
          const idNormalizado = String(id).trim().toLowerCase();
          return clienteIdsNormalizados.includes(idNormalizado);
        });
        return match;
      });

      console.log(`📋 [DASHBOARD-COLABORADORES] Registros filtrados por cliente: ${registrosFiltrados.length} de ${registros?.length || 0}`);

      colaboradorIds = [...new Set(registrosFiltrados.map(r => String(r.usuario_id).trim()).filter(Boolean))];
      console.log(`✅ [DASHBOARD-COLABORADORES] Filtro de cliente aplicado: ${colaboradorIds.length} colaboradores únicos encontrados`);
    } else if (dataInicio && dataFim) {
      // Se não tem cliente nem colaborador mas tem período, buscar colaboradores pelos registros de tempo no período
      const dateInicialObj = new Date(dataInicio);
      const dateFinalObj = new Date(dataFim);
      dateInicialObj.setUTCHours(0, 0, 0, 0);
      dateFinalObj.setUTCHours(23, 59, 59, 999);
      const inicioStr = dateInicialObj.toISOString();
      const fimStr = dateFinalObj.toISOString();

      const { data: registros, error: registrosError } = await supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('usuario_id')
        .not('usuario_id', 'is', null)
        .not('data_inicio', 'is', null)
        .gte('data_inicio', inicioStr)
        .lte('data_inicio', fimStr);

      if (registrosError) {
        console.error('Erro ao buscar registros:', registrosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }

      colaboradorIds = [...new Set((registros || []).map(r => String(r.usuario_id).trim()).filter(Boolean))];
      console.log(`✅ [DASHBOARD-COLABORADORES] Filtro de período aplicado: ${colaboradorIds.length} colaboradores encontrados no período`);
    } else {
      // Se não tem nenhum filtro, buscar todos os colaboradores que têm registros de tempo
      const { data: registros, error: registrosError } = await supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('usuario_id')
        .not('usuario_id', 'is', null);

      if (registrosError) {
        console.error('Erro ao buscar registros:', registrosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }

      colaboradorIds = [...new Set((registros || []).map(r => String(r.usuario_id).trim()).filter(Boolean))];
      console.log(`✅ [DASHBOARD-COLABORADORES] Sem filtros: ${colaboradorIds.length} colaboradores encontrados`);
    }

    if (colaboradorIds.length === 0) {
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

    // 2. Paginar os IDs de colaboradores
    const totalColaboradores = colaboradorIds.length;
    const totalPages = Math.max(1, Math.ceil(totalColaboradores / limitNum));
    const colaboradorIdsPaginated = colaboradorIds.slice(offset, offset + limitNum);

    // 3. Buscar dados dos colaboradores da página atual
    const colaboradoresData = await getMembrosPorIds(colaboradorIdsPaginated.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
    const colaboradoresMap = {};
    colaboradoresData.forEach(colab => {
      const idStr = String(colab.id).trim();
      colaboradoresMap[idStr] = colab;
    });

    // 4. Buscar todos os dados em paralelo
    const dateInicialObj = dataInicio ? new Date(dataInicio) : null;
    const dateFinalObj = dataFim ? new Date(dataFim) : null;
    if (dateInicialObj) dateInicialObj.setUTCHours(0, 0, 0, 0);
    if (dateFinalObj) dateFinalObj.setUTCHours(23, 59, 59, 999);
    const inicioStr = dateInicialObj ? dateInicialObj.toISOString() : null;
    const fimStr = dateFinalObj ? dateFinalObj.toISOString() : null;

    // Buscar registros APENAS dos colaboradores da página atual (para exibição)
    let registrosQuery = supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('*')
      .not('usuario_id', 'is', null)
      .not('cliente_id', 'is', null)
      .in('usuario_id', colaboradorIdsPaginated.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));

    // Aplicar filtro de período se fornecido
    if (dataInicio && dataFim) {
      registrosQuery = registrosQuery
        .gte('data_inicio', inicioStr)
        .lte('data_inicio', fimStr);
    }

    // Buscar TODOS os registros de TODOS os colaboradores (para totais do dashboard)
    let todosRegistrosQuery = supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('*')
      .not('usuario_id', 'is', null)
      .not('cliente_id', 'is', null)
      .in('usuario_id', colaboradorIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));

    // Aplicar filtro de período se fornecido
    if (dataInicio && dataFim) {
      todosRegistrosQuery = todosRegistrosQuery
        .gte('data_inicio', inicioStr)
        .lte('data_inicio', fimStr);
    }

    const [registrosData, todosRegistrosData] = await Promise.all([
      registrosQuery,
      todosRegistrosQuery
    ]);

    // Filtrar registros por cliente se necessário
    let registrosPagina = registrosData.data || [];
    let todosRegistros = todosRegistrosData.data || [];
    
    if (clienteIdsArray.length > 0) {
      registrosPagina = registrosPagina.filter(r => {
        if (!r.cliente_id) return false;
        const idsExtraidos = extrairClienteIds(r.cliente_id);
        return idsExtraidos.some(id => clienteIdsArray.includes(id));
      });
      
      todosRegistros = todosRegistros.filter(r => {
        if (!r.cliente_id) return false;
        const idsExtraidos = extrairClienteIds(r.cliente_id);
        return idsExtraidos.some(id => clienteIdsArray.includes(id));
      });
    }

    // Buscar tarefas, produtos, clientes e membros
    const todosTarefaIds = [...new Set(todosRegistros.map(r => r.tarefa_id).filter(Boolean))];
    const todosClienteIds = [...new Set(
      todosRegistros.flatMap(r => {
        if (!r.cliente_id) return [];
        return extrairClienteIds(r.cliente_id);
      })
    )];
    const todosUsuarioIds = [...new Set(todosRegistros.map(r => r.usuario_id).filter(Boolean))];

    const [tarefasData, clientesData, membrosData] = await Promise.all([
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
      todosClienteIds.length > 0 ? (async () => {
        const { data: clientes } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome')
          .in('id', todosClienteIds);
        return clientes || [];
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

    const clientesMapGlobal = {};
    clientesData.forEach(cliente => {
      const clienteIdStr = String(cliente.id).trim();
      clientesMapGlobal[clienteIdStr] = cliente;
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

    // 5. Agrupar dados por colaborador e calcular resumos
    // IMPORTANTE: Se há filtro de cliente, os resumos devem considerar apenas os registros filtrados
    const colaboradoresComResumos = colaboradorIdsPaginated.map(colaboradorIdStr => {
      const colaborador = colaboradoresMap[colaboradorIdStr] || { id: colaboradorIdStr, nome: `Colaborador #${colaboradorIdStr}` };
      let registrosTempo = registrosPagina.filter(r => String(r.usuario_id).trim() === colaboradorIdStr);

      // Se há filtro de cliente, garantir que apenas registros dos clientes filtrados sejam considerados
      if (clienteIdsArray.length > 0) {
        const clienteIdsNormalizados = clienteIdsArray.map(id => String(id).trim().toLowerCase());
        registrosTempo = registrosTempo.filter(r => {
          if (!r.cliente_id) return false;
          const idsExtraidos = extrairClienteIds(r.cliente_id);
          return idsExtraidos.some(id => {
            const idNormalizado = String(id).trim().toLowerCase();
            return clienteIdsNormalizados.includes(idNormalizado);
          });
        });
      }

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
        if (registro.cliente_id) {
          const idsExtraidos = extrairClienteIds(registro.cliente_id);
          registroRetorno.cliente = idsExtraidos.length > 0 
            ? clientesMapGlobal[idsExtraidos[0]] || null
            : null;
        }
        return registroRetorno;
      });

      // Calcular resumos apenas com base nos registros filtrados
      const tarefasUnicas = new Set(registrosCompletos.map(r => r.tarefa_id).filter(Boolean));
      const totalTarefasUnicas = tarefasUnicas.size;
      
      const produtosUnicos = new Set();
      registrosCompletos.forEach(r => {
        if (r.tarefa && r.tarefa.produto_id) {
          produtosUnicos.add(String(r.tarefa.produto_id).trim());
        }
      });
      const totalProdutosUnicos = produtosUnicos.size;

      const clientesUnicos = new Set();
      registrosCompletos.forEach(r => {
        if (r.cliente_id) {
          const idsExtraidos = extrairClienteIds(r.cliente_id);
          // Se há filtro de cliente, considerar apenas os clientes filtrados
          if (clienteIdsArray.length > 0) {
            const clienteIdsNormalizados = clienteIdsArray.map(id => String(id).trim().toLowerCase());
            idsExtraidos.forEach(id => {
              const idNormalizado = String(id).trim().toLowerCase();
              if (clienteIdsNormalizados.includes(idNormalizado)) {
                clientesUnicos.add(id);
              }
            });
          } else {
            idsExtraidos.forEach(id => clientesUnicos.add(id));
          }
        }
      });
      const totalClientesUnicos = clientesUnicos.size;

      // Calcular tempo total realizado (horas realizadas)
      let tempoTotalRealizado = 0;
      registrosCompletos.forEach(r => {
        let tempoRealizado = Number(r.tempo_realizado) || 0;
        
        // Se tempo_realizado não estiver presente ou for 0, calcular a partir de data_inicio e data_fim
        if (!tempoRealizado && r.data_inicio && r.data_fim) {
          const inicio = new Date(r.data_inicio);
          const fim = new Date(r.data_fim);
          tempoRealizado = fim.getTime() - inicio.getTime();
        }
        
        // Converter tempo para milissegundos usando a função auxiliar
        const tempoMs = converterTempoParaMilissegundos(tempoRealizado);
        tempoTotalRealizado += tempoMs;
      });
      
      // Debug: log para verificar se está calculando corretamente
      if (registrosCompletos.length > 0) {
        const primeiroRegistro = registrosCompletos[0];
        console.log(`🔍 [DASHBOARD-COLABORADORES] Colaborador ${colaboradorIdStr}:`, {
          totalRegistros: registrosCompletos.length,
          tempoTotalRealizado: `${tempoTotalRealizado}ms`,
          primeiroRegistro: {
            id: primeiroRegistro.id,
            tempo_realizado: primeiroRegistro.tempo_realizado,
            usuario_id: primeiroRegistro.usuario_id
          }
        });
      } else {
        console.log(`⚠️ [DASHBOARD-COLABORADORES] Colaborador ${colaboradorIdStr}: Nenhum registro encontrado`);
      }

      return {
        colaborador: colaborador,
        registros: registrosCompletos,
        resumo: {
          totalTarefasUnicas,
          totalProdutosUnicos,
          totalClientesUnicos,
          tempoTotalRealizado
        }
      };
    });

    res.json({
      success: true,
      data: colaboradoresComResumos,
      count: colaboradoresComResumos.length,
      total: totalColaboradores,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages,
      // Totais gerais para o dashboard
      totaisGerais: {
        totalTarefas: todosTarefaIds.length,
        totalRegistros: todosRegistros.length,
        todosRegistros: todosRegistros
      }
    });

  } catch (error) {
    console.error('Erro inesperado no endpoint dashboard-colaboradores:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// ========================================
// === GET /api/debug-tarefa/:tarefaId ===
// === Endpoint para debugar uma tarefa específica ===
// ========================================
async function debugTarefa(req, res) {
  try {
    const { tarefaId } = req.params;
    
    if (!tarefaId) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    console.log(`🔍 [DEBUG-TAREFA] Investigando tarefa: ${tarefaId}`);

    // 1. Buscar registros na VIEW v_registro_tempo_vinculado
    const { data: registrosView, error: errorView } = await supabase
      .schema('up_gestaointeligente')
      .from('v_registro_tempo_vinculado')
      .select('*')
      .eq('tarefa_id', tarefaId);

    if (errorView) {
      console.error('❌ Erro ao buscar na view:', errorView);
    }

    // 2. Buscar registros na TABELA registro_tempo
    const { data: registrosTabela, error: errorTabela } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('tarefa_id', tarefaId);

    if (errorTabela) {
      console.error('❌ Erro ao buscar na tabela:', errorTabela);
    }

    // 3. Calcular totais
    let totalView = 0;
    let totalTabela = 0;
    let totalCalculadoView = 0; // Calculado a partir de data_inicio e data_fim

    (registrosView || []).forEach(r => {
      const tempoRealizado = Number(r.tempo_realizado) || 0;
      totalView += tempoRealizado;
      
      // Se não tem tempo_realizado, calcular a partir de datas
      if (!tempoRealizado && r.data_inicio && r.data_fim) {
        const inicio = new Date(r.data_inicio);
        const fim = new Date(r.data_fim);
        const tempoCalculado = fim.getTime() - inicio.getTime();
        totalCalculadoView += tempoCalculado;
      }
    });

    (registrosTabela || []).forEach(r => {
      const tempoRealizado = Number(r.tempo_realizado) || 0;
      totalTabela += tempoRealizado;
    });

    // Converter para horas para facilitar leitura
    const totalViewHoras = totalView / (1000 * 60 * 60);
    const totalTabelaHoras = totalTabela / (1000 * 60 * 60);
    const totalCalculadoViewHoras = totalCalculadoView / (1000 * 60 * 60);

    res.json({
      success: true,
      tarefaId: tarefaId,
      resumo: {
        registrosNaView: registrosView?.length || 0,
        registrosNaTabela: registrosTabela?.length || 0,
        totalViewMs: totalView,
        totalViewHoras: totalViewHoras.toFixed(2),
        totalTabelaMs: totalTabela,
        totalTabelaHoras: totalTabelaHoras.toFixed(2),
        totalCalculadoViewMs: totalCalculadoView,
        totalCalculadoViewHoras: totalCalculadoViewHoras.toFixed(2)
      },
      registrosView: registrosView || [],
      registrosTabela: registrosTabela || [],
      detalhes: {
        registrosComTempoRealizado: (registrosView || []).filter(r => r.tempo_realizado && Number(r.tempo_realizado) > 0),
        registrosSemTempoRealizado: (registrosView || []).filter(r => !r.tempo_realizado || Number(r.tempo_realizado) === 0),
        registrosComDatas: (registrosView || []).filter(r => r.data_inicio && r.data_fim).map(r => {
          const inicio = new Date(r.data_inicio);
          const fim = new Date(r.data_fim);
          const diffMs = fim.getTime() - inicio.getTime();
          const diffHoras = diffMs / (1000 * 60 * 60);
          return {
            id: r.id,
            data_inicio: r.data_inicio,
            data_fim: r.data_fim,
            tempo_realizado: r.tempo_realizado,
            tempoCalculadoMs: diffMs,
            tempoCalculadoHoras: diffHoras.toFixed(2)
          };
        })
      }
    });

  } catch (error) {
    console.error('❌ Erro inesperado no debug de tarefa:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getDashboardClientes,
  getDashboardColaboradores,
  debugTarefa
};

