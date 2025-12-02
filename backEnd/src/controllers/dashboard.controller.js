// =============================================================
// === CONTROLLER DE DASHBOARD ===
// =============================================================

const supabase = require('../config/database');
const apiClientes = require('../services/api-clientes');
const { getMembrosPorIds, getProdutosPorIds } = apiClientes;
const { buscarTodosComPaginacao } = require('../services/database-utils');

// Função auxiliar para extrair IDs de clientes de uma string que pode conter múltiplos IDs separados por ", "
function extrairClienteIds(clienteIdString) {
  if (!clienteIdString) return [];
  const ids = String(clienteIdString)
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  return ids;
}

async function buscarTodosRegistrosComPaginacao(criarQueryBuilder) {
  return await buscarTodosComPaginacao(criarQueryBuilder, { 
    limit: 1000, 
    logProgress: false 
  });
}

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
  const clienteIdsSet = new Set(clienteIdsList.map(id => String(id).trim().toLowerCase()));
  
  // Comparar normalizando para lowercase para garantir match
  const match = idsDoRegistro.some(id => {
    const idNormalizado = String(id).trim().toLowerCase();
    return clienteIdsSet.has(idNormalizado);
  });
  
  return match;
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
      
      colaboradorIdsArray = idsParaProcessar.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));
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
      
      clienteIdsArray = idsParaProcessar.map(id => String(id).trim()).filter(Boolean);
    }

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

        // Criar função para query builder (para usar paginação automática se necessário)
        const criarQueryBuilderRegistros = () => {
          let query = supabase
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
              query = query.eq('usuario_id', colaboradorIdsArray[0]);
            } else {
              query = query.in('usuario_id', colaboradorIdsArray);
            }
          }

          return query;
        };

        // Usar paginação automática se não há filtro de colaborador (pode ter muitos registros)
        let registros;
        let registrosError = null;
        
        if (colaboradorIdsArray.length === 0) {
          try {
            registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, { 
              limit: 1000, 
              logProgress: false 
            });
          } catch (error) {
            registrosError = error;
            registros = [];
          }
        } else {
          const { data, error } = await criarQueryBuilderRegistros();
          registros = data;
          registrosError = error;
        }
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
          clienteIdsComRegistros = clienteIdsComRegistros.filter(clienteId => {
            const clienteIdStr = String(clienteId).trim();
            return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
          });
        }
        
        clienteIds = clienteIdsArray.filter(clienteId => {
          const clienteIdStr = String(clienteId).trim();
          return clienteIdsComRegistros.some(id => String(id).trim() === clienteIdStr);
        });
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
          clienteIds = clienteIdsArray.filter(clienteId => {
            const clienteIdStr = String(clienteId).trim();
            return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
          });
        } else {
          clienteIds = clienteIdsArray;
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
    } else if (dataInicio && dataFim && clienteIdsArray.length === 0) {
      // Se não tem status mas tem período E NÃO tem clientes selecionados, buscar clientes pelos registros de tempo
      const dateInicialObj = new Date(dataInicio);
      const dateFinalObj = new Date(dataFim);
      dateInicialObj.setUTCHours(0, 0, 0, 0);
      dateFinalObj.setUTCHours(23, 59, 59, 999);
      const inicioStr = dateInicialObj.toISOString();
      const fimStr = dateFinalObj.toISOString();

      // Criar função para query builder (para usar paginação automática se necessário)
      const criarQueryBuilderRegistros = () => {
        let query = supabase
          .schema('up_gestaointeligente')
          .from('v_registro_tempo_vinculado')
          .select('cliente_id')
          .not('cliente_id', 'is', null)
          .not('data_inicio', 'is', null)
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);

        if (colaboradorIdsArray.length > 0) {
          if (colaboradorIdsArray.length === 1) {
            query = query.eq('usuario_id', colaboradorIdsArray[0]);
          } else {
            query = query.in('usuario_id', colaboradorIdsArray);
          }
        }

        return query;
      };

      // Usar paginação automática se não há filtro de colaborador (pode ter muitos registros)
      let registros;
      let registrosError = null;
      
      if (colaboradorIdsArray.length === 0) {
        try {
          registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, { 
            limit: 1000, 
            logProgress: false 
          });
        } catch (error) {
          registrosError = error;
          registros = [];
        }
      } else {
        const { data, error } = await criarQueryBuilderRegistros();
        registros = data;
        registrosError = error;
      }
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
      
      // Se há status, filtrar também por status
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
        clienteIds = clienteIds.filter(clienteId => {
          const clienteIdStr = String(clienteId).trim();
          return clienteIdsComStatus.some(id => String(id).trim() === clienteIdStr);
        });
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
        message: 'Nenhum cliente encontrado com os filtros selecionados.',
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
    
    // Se há filtros de colaborador e cliente, mas não há clientes identificados, construir mensagem específica
    if (clienteIds.length === 0 && colaboradorIdsArray.length > 0 && clienteIdsArray.length > 0) {
      // Buscar nomes dos colaboradores
      let colaboradorNomes = '';
      try {
        const membrosFiltro = await getMembrosPorIds(colaboradorIdsArray);
        colaboradorNomes = colaboradorIdsArray.map(id => {
          const membro = membrosFiltro.find(m => String(m.id).trim() === String(id).trim() || parseInt(String(m.id).trim(), 10) === parseInt(String(id).trim(), 10));
          return membro ? membro.nome : `Colaborador ${id}`;
        }).join(', ');
      } catch (error) {
        colaboradorNomes = colaboradorIdsArray.join(', ');
      }
      
      // Buscar nomes dos clientes
      let clienteNomes = '';
      try {
        const { data: clientesFiltro } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome')
          .in('id', clienteIdsArray);
        clienteNomes = (clientesFiltro || []).map(c => c.nome || c.id).join(', ');
      } catch (error) {
        clienteNomes = clienteIdsArray.join(', ');
      }
      
      const mensagem = clienteNomes && colaboradorNomes
        ? `Sem registros do(s) cliente(s) "${clienteNomes}" para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`
        : 'Nenhum cliente encontrado com os filtros selecionados.';
      
      return res.json({
        success: true,
        data: [],
        count: 0,
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
        message: mensagem,
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
    
    // Se não há clientes para a página atual, mas há filtros de colaborador e cliente, retornar mensagem
    if (clienteIdsPaginated.length === 0 && clienteIds.length === 0 && colaboradorIdsArray.length > 0 && clienteIdsArray.length > 0) {
      // Buscar nomes dos colaboradores
      let colaboradorNomes = '';
      try {
        const membrosFiltro = await getMembrosPorIds(colaboradorIdsArray);
        colaboradorNomes = colaboradorIdsArray.map(id => {
          const membro = membrosFiltro.find(m => String(m.id).trim() === String(id).trim() || parseInt(String(m.id).trim(), 10) === parseInt(String(id).trim(), 10));
          return membro ? membro.nome : `Colaborador ${id}`;
        }).join(', ');
      } catch (error) {
        colaboradorNomes = colaboradorIdsArray.join(', ');
      }
      
      // Buscar nomes dos clientes
      let clienteNomes = '';
      try {
        const { data: clientesFiltro } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome')
          .in('id', clienteIdsArray);
        clienteNomes = (clientesFiltro || []).map(c => c.nome || c.id).join(', ');
      } catch (error) {
        clienteNomes = clienteIdsArray.join(', ');
      }
      
      const mensagem = clienteNomes && colaboradorNomes
        ? `Sem registros do(s) cliente(s) "${clienteNomes}" para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`
        : 'Nenhum cliente encontrado com os filtros selecionados.';
      
      return res.json({
        success: true,
        data: [],
        count: 0,
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
        message: mensagem,
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
      
      // Se não encontrou nenhum cliente, construir mensagem específica
      if (clientes.length === 0) {
        let mensagem = 'Nenhum cliente encontrado com os filtros selecionados.';
        
        // Se há filtros de colaborador e/ou cliente, construir mensagem mais específica
        if (colaboradorIdsArray.length > 0 || clienteIds.length > 0) {
          // Buscar nomes dos colaboradores se houver filtro
          let colaboradorNomes = '';
          if (colaboradorIdsArray.length > 0) {
            try {
              const membrosFiltro = await getMembrosPorIds(colaboradorIdsArray);
              colaboradorNomes = colaboradorIdsArray.map(id => {
                const membro = membrosFiltro.find(m => String(m.id).trim() === String(id).trim() || parseInt(String(m.id).trim(), 10) === parseInt(String(id).trim(), 10));
                return membro ? membro.nome : `Colaborador ${id}`;
              }).join(', ');
            } catch (error) {
              colaboradorNomes = colaboradorIdsArray.join(', ');
            }
          }
          
          // Buscar nomes dos clientes se houver filtro
          let clienteNomes = '';
          if (clienteIds.length > 0) {
            try {
              const { data: clientesFiltro } = await supabase
                .schema('up_gestaointeligente')
                .from('cp_cliente')
                .select('id, nome')
                .in('id', clienteIds);
              clienteNomes = (clientesFiltro || []).map(c => c.nome || c.id).join(', ');
            } catch (error) {
              clienteNomes = clienteIds.join(', ');
            }
          }
          
          // Construir mensagem específica
          if (colaboradorNomes && clienteNomes) {
            mensagem = `Sem registros do(s) cliente(s) "${clienteNomes}" para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`;
          } else if (colaboradorNomes) {
            mensagem = `Sem registros para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`;
          } else if (clienteNomes) {
            mensagem = `Sem registros do(s) cliente(s) "${clienteNomes}" no período selecionado.`;
          }
        }
        
        return res.json({
          success: true,
          data: [],
          count: 0,
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0,
          message: mensagem,
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

    // Buscar registros da página atual (cliente_id pode conter múltiplos IDs, filtrar manualmente)
    let registrosQuery = null;
    if (clienteIdsPaginated.length > 0 || temFiltrosPeriodoOuColaborador) {
      registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('*', { count: 'exact' }) // Adicionar count para verificar se há mais registros
        .not('cliente_id', 'is', null)
        .not('data_inicio', 'is', null);

      // Aplicar filtro de período se fornecido
      if (dataInicio && dataFim) {
        registrosQuery = registrosQuery
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      }

      if (colaboradorIdsArray.length > 0) {
        if (colaboradorIdsArray.length === 1) {
          registrosQuery = registrosQuery.eq('usuario_id', colaboradorIdsArray[0]);
        } else {
          registrosQuery = registrosQuery.in('usuario_id', colaboradorIdsArray);
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

    // Buscar TODOS os registros (para totais do dashboard)
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

      if (colaboradorIdsArray.length > 0) {
        if (colaboradorIdsArray.length === 1) {
          todosRegistrosQuery = todosRegistrosQuery.eq('usuario_id', colaboradorIdsArray[0]);
        } else {
          todosRegistrosQuery = todosRegistrosQuery.in('usuario_id', colaboradorIdsArray);
        }
      }
    }

    const [contratosData, registrosData, todosContratosData] = await Promise.all([
      contratosQuery ? contratosQuery : Promise.resolve({ data: [], error: null }),
      registrosQuery ? registrosQuery : Promise.resolve({ data: [], error: null }),
      todosContratosQuery ? todosContratosQuery : Promise.resolve({ data: [], error: null })
    ]);
    
    let todosRegistrosData = { data: [], error: null };
    if (todosRegistrosQuery) {
      if (colaboradorIdsArray.length === 0) {
        try {
          const criarQueryBuilder = () => {
            let query = supabase
              .schema('up_gestaointeligente')
              .from('v_registro_tempo_vinculado')
              .select('*')
              .not('cliente_id', 'is', null)
              .not('data_inicio', 'is', null);
            
            if (dataInicio && dataFim) {
              query = query
                .gte('data_inicio', inicioStr)
                .lte('data_inicio', fimStr);
            }
            
            return query;
          };
          
          const todosRegistros = await buscarTodosRegistrosComPaginacao(criarQueryBuilder);
          todosRegistrosData = { data: todosRegistros, error: null };
        } catch (error) {
          console.error('Erro ao buscar todos os registros com paginação:', error);
          todosRegistrosData = { data: [], error };
        }
      } else {
        todosRegistrosData = await todosRegistrosQuery;
      }
    }
    
    if (registrosData.error) {
      console.error('Erro na query de registros:', registrosData.error);
    }
    if (todosRegistrosData.error) {
      console.error('Erro na query de todos os registros:', todosRegistrosData.error);
    }

    const contratosPagina = contratosData.data || [];
    const registrosPaginaRaw = registrosData.data || [];
    
    const registrosPagina = clienteIdsPaginated.length > 0 
      ? registrosPaginaRaw.filter(r => registroPertenceAosClientes(r, clienteIdsPaginated))
      : registrosPaginaRaw;
    
    const todosContratos = todosContratosData.data || [];
    const todosRegistrosRaw = todosRegistrosData.data || [];
    
    const todosRegistros = clienteIds.length > 0
      ? todosRegistrosRaw.filter(r => registroPertenceAosClientes(r, clienteIds))
      : todosRegistrosRaw;

    const registrosParaBuscarTarefasEMembros = colaboradorIdsArray.length > 0 
      ? registrosPaginaRaw
      : todosRegistrosRaw;
    
    const todosTarefaIds = [...new Set([
      ...todosRegistros.map(r => r.tarefa_id).filter(Boolean),
      ...registrosParaBuscarTarefasEMembros.map(r => r.tarefa_id).filter(Boolean)
    ])];
    const todosUsuarioIds = [...new Set([
      ...todosRegistros.map(r => r.usuario_id).filter(Boolean),
      ...registrosParaBuscarTarefasEMembros.map(r => r.usuario_id).filter(Boolean)
    ])];

    // Buscar membros primeiro para poder usar na validação de interseção
    const membrosData = colaboradorIdsArray.length > 0 
      ? await getMembrosPorIds(colaboradorIdsArray)
      : (todosUsuarioIds.length > 0 ? await getMembrosPorIds(todosUsuarioIds) : []);
    
    const tarefasData = todosTarefaIds.length > 0 ? (async () => {
      const tarefaIdsStrings = todosTarefaIds.map(id => String(id).trim());
      const orConditions = tarefaIdsStrings.map(id => `id.eq.${id}`).join(',');
      const { data: tarefas } = await supabase
        .schema('up_gestaointeligente')
        .from('tarefa')
        .select('*')
        .or(orConditions);
      return tarefas || [];
    })() : Promise.resolve([]);
    
    const tarefasDataResolved = await tarefasData;

    const todosProdutoIds = [...new Set(tarefasDataResolved.map(t => t.produto_id).filter(Boolean))];
    const produtosData = todosProdutoIds.length > 0 ? await getProdutosPorIds(todosProdutoIds) : [];

    const produtosMapGlobal = {};
    produtosData.forEach(produto => {
      produtosMapGlobal[String(produto.id).trim()] = produto;
    });

    const tarefasMapGlobal = {};
    tarefasDataResolved.forEach(tarefa => {
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

    const registrosParaFiltrarPorCliente = colaboradorIdsArray.length > 0 
      ? registrosPaginaRaw
      : todosRegistrosRaw;
    
    // Validar interseção entre colaborador e cliente quando ambos estão filtrados
    if (colaboradorIdsArray.length > 0 && clienteIds.length > 0) {
      const colaboradorIdsNumericos = colaboradorIdsArray.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));
      const registrosComInterseccao = registrosParaFiltrarPorCliente.filter(r => {
        const pertenceAoCliente = registroPertenceAosClientes(r, clienteIds);
        const pertenceAoColaborador = r.usuario_id && colaboradorIdsNumericos.includes(parseInt(String(r.usuario_id).trim(), 10));
        return pertenceAoCliente && pertenceAoColaborador;
      });
      
      if (registrosComInterseccao.length === 0) {
        const clienteNomes = clientes.map(c => c.nome || c.id).join(', ');
        const colaboradorNomes = membrosData.length > 0 
          ? colaboradorIdsArray.map(id => {
              const membro = membrosData.find(m => String(m.id).trim() === String(id).trim() || parseInt(String(m.id).trim(), 10) === parseInt(String(id).trim(), 10));
              return membro ? membro.nome : `Colaborador ${id}`;
            }).join(', ')
          : colaboradorIdsArray.join(', ');
        
        return res.json({
          success: true,
          data: [],
          count: 0,
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0,
          message: `Sem registros do(s) cliente(s) "${clienteNomes}" para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`,
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
    }
    
    const clientesComResumos = (clientes || []).map(cliente => {
      const clienteIdStr = String(cliente.id).trim();
      const contratos = contratosPagina.filter(c => String(c.id_cliente).trim() === clienteIdStr);
      const registrosTempo = registrosParaFiltrarPorCliente.filter(r => {
        const pertenceAoCliente = registroPertenceAosClientes(r, [clienteIdStr]);
        // Se há filtro de colaborador, também verificar se o registro pertence ao colaborador
        if (colaboradorIdsArray.length > 0 && r.usuario_id) {
          const colaboradorIdsNumericos = colaboradorIdsArray.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));
          const pertenceAoColaborador = colaboradorIdsNumericos.includes(parseInt(String(r.usuario_id).trim(), 10));
          return pertenceAoCliente && pertenceAoColaborador;
        }
        return pertenceAoCliente;
      });

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
        if (r.usuario_id) {
          const colaboradorId = String(r.usuario_id).trim();
          
          // IMPORTANTE: Incluir colaborador mesmo se membro não for encontrado
          // Isso garante que todos os colaboradores com registros apareçam no resumo
          if (!tempoPorColaborador[colaboradorId]) {
            tempoPorColaborador[colaboradorId] = {
              nome: r.membro?.nome || `Colaborador ${colaboradorId}`,
              status: r.membro?.status || 'ativo',
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

    const todosTarefaIdsGerais = [...new Set(todosRegistros.map(r => r.tarefa_id).filter(Boolean))];
    const todosUsuarioIdsGerais = [...new Set(todosRegistros.map(r => r.usuario_id).filter(Boolean))];
    
    let todosClienteIdsGerais = [];
    if (clienteIds.length > 0) {
      todosClienteIdsGerais = clienteIds.map(id => String(id).trim());
    } else if (todosRegistros.length > 0) {
      const clientesUnicosDosRegistros = new Set();
      todosRegistros.forEach(registro => {
        if (registro.cliente_id) {
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


    // Período não é mais obrigatório - pode filtrar apenas por cliente ou colaborador

    // 1. Identificar quais colaboradores devem ser retornados
    let colaboradorIds = [];

    if (colaboradorIdsArray.length > 0) {
      colaboradorIds = colaboradorIdsArray.map(id => String(id).trim());
    } else if (clienteIdsArray.length > 0) {
      const dateInicialObj = dataInicio ? new Date(dataInicio) : null;
      const dateFinalObj = dataFim ? new Date(dataFim) : null;
      if (dateInicialObj) dateInicialObj.setUTCHours(0, 0, 0, 0);
      if (dateFinalObj) dateFinalObj.setUTCHours(23, 59, 59, 999);
      const inicioStr = dateInicialObj ? dateInicialObj.toISOString() : null;
      const fimStr = dateFinalObj ? dateFinalObj.toISOString() : null;

      const criarQueryBuilderRegistros = () => {
        let query = supabase
          .schema('up_gestaointeligente')
          .from('v_registro_tempo_vinculado')
          .select('usuario_id, cliente_id')
          .not('usuario_id', 'is', null)
          .not('cliente_id', 'is', null);

        if (dataInicio && dataFim) {
          query = query
            .not('data_inicio', 'is', null)
            .gte('data_inicio', inicioStr)
            .lte('data_inicio', fimStr);
        }

        return query;
      };

      let registros;
      let registrosError = null;
      
      try {
        registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, { 
          limit: 1000, 
          logProgress: false 
        });
      } catch (error) {
        registrosError = error;
        registros = [];
      }

      if (registrosError) {
        console.error('Erro ao buscar registros:', registrosError);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }

      const clienteIdsNormalizados = clienteIdsArray.map(id => String(id).trim().toLowerCase());
      const registrosFiltrados = (registros || []).filter(r => {
        if (!r.cliente_id) return false;
        const idsExtraidos = extrairClienteIds(r.cliente_id);
        return idsExtraidos.some(id => {
          const idNormalizado = String(id).trim().toLowerCase();
          return clienteIdsNormalizados.includes(idNormalizado);
        });
      });

      colaboradorIds = [...new Set(registrosFiltrados.map(r => String(r.usuario_id).trim()).filter(Boolean))];
    } else if (dataInicio && dataFim) {
      const dateInicialObj = new Date(dataInicio);
      const dateFinalObj = new Date(dataFim);
      dateInicialObj.setUTCHours(0, 0, 0, 0);
      dateFinalObj.setUTCHours(23, 59, 59, 999);
      const inicioStr = dateInicialObj.toISOString();
      const fimStr = dateFinalObj.toISOString();

      const criarQueryBuilderRegistros = () => {
        return supabase
          .schema('up_gestaointeligente')
          .from('v_registro_tempo_vinculado')
          .select('usuario_id')
          .not('usuario_id', 'is', null)
          .not('data_inicio', 'is', null)
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      };

      try {
        const registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, { 
          limit: 1000, 
          logProgress: false 
        });
        colaboradorIds = [...new Set(registros.map(r => String(r.usuario_id).trim()).filter(Boolean))];
      } catch (error) {
        console.error('Erro ao buscar registros:', error);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }
    } else {
      const criarQueryBuilderRegistros = () => {
        return supabase
          .schema('up_gestaointeligente')
          .from('v_registro_tempo_vinculado')
          .select('usuario_id')
          .not('usuario_id', 'is', null);
      };

      try {
        const registros = await buscarTodosComPaginacao(criarQueryBuilderRegistros, { 
          limit: 1000, 
          logProgress: false 
        });
        colaboradorIds = [...new Set(registros.map(r => String(r.usuario_id).trim()).filter(Boolean))];
      } catch (error) {
        console.error('Erro ao buscar registros:', error);
        return res.status(500).json({ success: false, error: 'Erro ao buscar registros de tempo' });
      }
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

    const colaboradorIdsPaginatedNumericos = colaboradorIdsPaginated.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    let registrosQuery = null;
    if (colaboradorIdsPaginatedNumericos.length > 0) {
      registrosQuery = supabase
        .schema('up_gestaointeligente')
        .from('v_registro_tempo_vinculado')
        .select('*')
        .not('usuario_id', 'is', null)
        .not('cliente_id', 'is', null)
        .in('usuario_id', colaboradorIdsPaginatedNumericos);

      if (dataInicio && dataFim) {
        registrosQuery = registrosQuery
          .gte('data_inicio', inicioStr)
          .lte('data_inicio', fimStr);
      }
    }

    const [registrosData] = await Promise.all([
      registrosQuery ? registrosQuery : Promise.resolve({ data: [], error: null })
    ]);

    let todosRegistrosData = { data: [], error: null };
    const colaboradorIdsNumericos = colaboradorIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    
    if (colaboradorIdsNumericos.length > 0) {
      const criarQueryBuilderTodosRegistros = () => {
        let query = supabase
          .schema('up_gestaointeligente')
          .from('v_registro_tempo_vinculado')
          .select('*')
          .not('usuario_id', 'is', null)
          .not('cliente_id', 'is', null)
          .in('usuario_id', colaboradorIdsNumericos);

        if (dataInicio && dataFim) {
          query = query
            .gte('data_inicio', inicioStr)
            .lte('data_inicio', fimStr);
        }

        return query;
      };

      try {
        const todosRegistros = await buscarTodosComPaginacao(criarQueryBuilderTodosRegistros, { 
          limit: 1000, 
          logProgress: false 
        });
        todosRegistrosData = { data: todosRegistros, error: null };
      } catch (error) {
        console.error('Erro ao buscar todos os registros com paginação:', error);
        todosRegistrosData = { data: [], error };
      }
    }

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
      
      // Validar interseção: se há filtro de colaborador E cliente, verificar se há registros
      if (colaboradorIdsArray.length > 0 && todosRegistros.length === 0) {
        const colaboradorNomes = await (async () => {
          const membros = await getMembrosPorIds(colaboradorIdsArray);
          return colaboradorIdsArray.map(id => {
            const membro = membros.find(m => String(m.id).trim() === String(id).trim() || parseInt(String(m.id).trim(), 10) === parseInt(String(id).trim(), 10));
            return membro ? membro.nome : `Colaborador ${id}`;
          }).join(', ');
        })();
        
        const clienteNomes = await (async () => {
          const { data: clientes } = await supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id, nome')
            .in('id', clienteIdsArray);
          return (clientes || []).map(c => c.nome || c.id).join(', ');
        })();
        
        return res.json({
          success: true,
          data: [],
          count: 0,
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0,
          message: `Sem registros do(s) cliente(s) "${clienteNomes}" para o(s) colaborador(es) "${colaboradorNomes}" no período selecionado.`
        });
      }
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

