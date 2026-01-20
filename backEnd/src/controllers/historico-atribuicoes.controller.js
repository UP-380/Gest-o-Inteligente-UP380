// =============================================================
// === CONTROLLER DE HISTÓRICO DE ATRIBUIÇÕES ===
// =============================================================

const supabase = require('../config/database');
const { buscarTodosComPaginacao } = require('../services/database-utils');
const { calcularRegistrosDinamicos } = require('./tempo-estimado.controller');

// GET - Buscar histórico de atribuições
async function getHistoricoAtribuicoes(req, res) {
  try {
    console.log('📥 Buscando histórico de atribuições...');
    const { page = 1, limit = 50, cliente_id, responsavel_id, usuario_criador_id, data_inicio, data_fim } = req.query;

    // Construir query base
    let query = supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (cliente_id) {
      query = query.eq('cliente_id', String(cliente_id).trim());
    }

    if (responsavel_id) {
      query = query.eq('responsavel_id', String(responsavel_id).trim());
    }

    if (usuario_criador_id) {
      query = query.eq('usuario_criador_id', String(usuario_criador_id).trim());
    }

    if (data_inicio) {
      query = query.gte('data_inicio', data_inicio);
    }

    if (data_fim) {
      query = query.lte('data_fim', data_fim);
    }

    // Aplicar paginação
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    console.log('🔍 Executando query no banco...');
    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar histórico de atribuições:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de atribuições',
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    console.log(`✅ Encontrados ${data?.length || 0} registros de ${count || 0} total`);

    // Se não houver dados, retornar vazio
    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum)
      });
    }

    // OTIMIZAÇÃO: Buscar dados relacionados em LOTE (Batch Fetching)
    // Em vez de fazer uma query por linha (N+1), fazemos apenas 2 queries extras

    // 1. Coletar IDs únicos
    const clienteIds = [...new Set(data.map(i => i.cliente_id).filter(Boolean))];
    const membroIds = [...new Set([
      ...data.map(i => i.responsavel_id),
      ...data.map(i => i.usuario_criador_id)
    ].filter(Boolean))];

    // 2. Buscar dados em paralelo
    const [clientesResponse, membrosResponse] = await Promise.all([
      clienteIds.length > 0 ? supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .select('id, nome')
        .in('id', clienteIds) : { data: [] },
      membroIds.length > 0 ? supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome')
        .in('id', membroIds) : { data: [] }
    ]);

    // 3. Criar Mapas para acesso O(1)
    const clienteMap = new Map((clientesResponse.data || []).map(c => [String(c.id), c]));
    const membroMap = new Map((membrosResponse.data || []).map(m => [String(m.id), m]));

    // 4. Buscar contagem de regras para determinar se há dias específicos (segmentação)
    const agrupadorIds = data.map(i => i.agrupador_id).filter(Boolean);
    let regrasCountMap = new Map();

    if (agrupadorIds.length > 0) {
      try {
        const { data: regrasIds, error: regrasError } = await supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado_regra')
          .select('agrupador_id')
          .in('agrupador_id', agrupadorIds);

        if (!regrasError && regrasIds) {
          regrasIds.forEach(r => {
            const count = regrasCountMap.get(r.agrupador_id) || 0;
            regrasCountMap.set(r.agrupador_id, count + 1);
          });
        }
      } catch (err) {
        console.error('Erro ao buscar contagem de regras:', err);
      }
    }

    // 5. Enriquecer os dados
    const historicoCompleto = data.map(item => {
      // Determinar se tem dias específicos: se o número de regras for maior que o número de tarefas
      // Isso indica que houve segmentação de regras (múltiplas regras para a mesma tarefa em dias diferentes)
      const numTarefas = Array.isArray(item.tarefas) ? item.tarefas.length : 1;
      const numRegras = regrasCountMap.get(item.agrupador_id) || 0;

      // Se numRegras > numTarefas, significa que pelo menos uma tarefa foi quebrada em segmentos (dias específicos)
      // Nota: isso funciona para novos registros criados com a lógica de segmentos.
      // Para registros antigos (flat rules), isso será falso (o que é correto pois dados foram perdidos)
      const temDiasEspecificos = numRegras > numTarefas;

      return {
        ...item,
        cliente: item.cliente_id ? clienteMap.get(String(item.cliente_id)) || null : null,
        responsavel: item.responsavel_id ? membroMap.get(String(item.responsavel_id)) || null : null,
        usuario_criador: item.usuario_criador_id ? membroMap.get(String(item.usuario_criador_id)) || null : null,
        tem_dias_especificos: temDiasEspecificos
      };
    });

    console.log('✅ Dados relacionados carregados com sucesso');

    return res.json({
      success: true,
      data: historicoCompleto,
      count: historicoCompleto.length,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar histórico de atribuições:', error);
    console.error('❌ Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// GET - Buscar histórico por ID
async function getHistoricoAtribuicaoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Histórico de atribuição não encontrado'
        });
      }

      console.error('Erro ao buscar histórico de atribuição:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de atribuição',
        details: error.message
      });
    }

    // Buscar dados relacionados
    const [clienteData, responsavelData, usuarioCriadorData] = await Promise.all([
      supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .select('id, nome')
        .eq('id', data.cliente_id)
        .maybeSingle(),
      supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome')
        .eq('id', data.responsavel_id)
        .maybeSingle(),
      supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome')
        .eq('id', data.usuario_criador_id)
        .maybeSingle()
    ]);

    const historicoCompleto = {
      ...data,
      cliente: clienteData.data || null,
      responsavel: responsavelData.data || null,
      usuario_criador: usuarioCriadorData.data || null
    };

    return res.json({
      success: true,
      data: historicoCompleto
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar histórico de atribuição:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar histórico de atribuição e tempo_estimado
async function atualizarHistoricoAtribuicao(req, res) {
  try {
    console.log('📥 PUT /api/historico-atribuicoes/:id chamado');
    console.log('📦 Params:', req.params);
    console.log('📦 Body:', req.body);

    const { id } = req.params;
    const { cliente_id, responsavel_id, produto_ids, tarefas, data_inicio, data_fim } = req.body;

    if (!id) {
      console.error('❌ ID não fornecido');
      return res.status(400).json({
        success: false,
        error: 'ID é obrigatório'
      });
    }

    console.log('📝 Atualizando histórico de atribuição:', id);

    // Buscar histórico atual
    const { data: historicoAtual, error: historicoError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('*')
      .eq('id', id)
      .single();

    if (historicoError || !historicoAtual) {
      console.error('❌ Erro ao buscar histórico:', historicoError);
      return res.status(404).json({
        success: false,
        error: 'Histórico de atribuição não encontrado'
      });
    }

    const agrupador_id = historicoAtual.agrupador_id;

    // Preparar dados para atualização do histórico
    const dadosAtualizacao = {
      updated_at: new Date().toISOString()
    };

    if (cliente_id !== undefined) {
      dadosAtualizacao.cliente_id = String(cliente_id).trim();
    }
    if (responsavel_id !== undefined) {
      dadosAtualizacao.responsavel_id = String(responsavel_id).trim();
    }
    if (produto_ids !== undefined && Array.isArray(produto_ids)) {
      dadosAtualizacao.produto_ids = produto_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }
    if (tarefas !== undefined && Array.isArray(tarefas)) {
      dadosAtualizacao.tarefas = tarefas;
    }
    if (data_inicio !== undefined) {
      dadosAtualizacao.data_inicio = data_inicio;
    }
    if (data_fim !== undefined) {
      dadosAtualizacao.data_fim = data_fim;
    }

    // Atualizar histórico
    const { data: historicoAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .update(dadosAtualizacao)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar histórico:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar histórico de atribuição',
        details: updateError.message
      });
    }

    // Preparar dados finais para atualizar tempo_estimado
    const clienteIdFinal = dadosAtualizacao.cliente_id || historicoAtual.cliente_id;
    const responsavelIdFinal = dadosAtualizacao.responsavel_id || historicoAtual.responsavel_id;
    const produtoIdsFinal = dadosAtualizacao.produto_ids || historicoAtual.produto_ids;
    const tarefasFinal = dadosAtualizacao.tarefas || historicoAtual.tarefas;
    const dataInicioFinal = dadosAtualizacao.data_inicio || historicoAtual.data_inicio;
    const dataFimFinal = dadosAtualizacao.data_fim || historicoAtual.data_fim;

    // Validar dados
    if (!clienteIdFinal || !responsavelIdFinal || !produtoIdsFinal || !tarefasFinal || !dataInicioFinal || !dataFimFinal) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos para atualização'
      });
    }

    // Função para gerar todas as datas entre início e fim
    const gerarDatasDoPeriodo = (inicioStr, fimStr) => {
      const inicio = new Date(inicioStr + 'T00:00:00');
      const fim = new Date(fimStr + 'T00:00:00');
      const datas = [];

      if (fim < inicio) {
        return [];
      }

      const dataAtual = new Date(inicio);

      while (dataAtual <= fim) {
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const dataFormatada = `${ano}-${mes}-${dia}T00:00:00`;
        datas.push(dataFormatada);
        dataAtual.setDate(dataAtual.getDate() + 1);
      }

      return datas;
    };

    // Gerar todas as datas do período
    const datasDoPeriodo = gerarDatasDoPeriodo(dataInicioFinal, dataFimFinal);

    if (datasDoPeriodo.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Data fim deve ser maior ou igual à data início'
      });
    }

    // Criar mapa de tempo por tarefa
    const tempoPorTarefa = new Map();
    tarefasFinal.forEach(t => {
      tempoPorTarefa.set(String(t.tarefa_id).trim(), parseInt(t.tempo_estimado_dia, 10));
    });

    // Deletar todas as regras antigas do agrupamento
    console.log('🗑️ Deletando regras antigas do agrupamento:', agrupador_id);
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      console.error('❌ Erro ao deletar regras antigas:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar atribuição',
        details: deleteError.message
      });
    }

    // Buscar tipo_tarefa_id para cada tarefa (se necessário)
    const buscarTipoTarefaIdPorTarefa = async (tarefaId) => {
      try {
        if (!tarefaId) return null;

        const tarefaIdStr = String(tarefaId).trim();
        const tarefaIdNum = parseInt(tarefaIdStr, 10);

        if (isNaN(tarefaIdNum)) {
          return null;
        }

        const { data: vinculados, error } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .select('tarefa_tipo_id')
          .eq('tarefa_id', tarefaIdNum)
          .not('tarefa_tipo_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (error || !vinculados) {
          return null;
        }

        return vinculados.tarefa_tipo_id ? String(vinculados.tarefa_tipo_id).trim() : null;
      } catch (error) {
        console.error('Erro ao buscar tipo_tarefa_id:', error);
        return null;
      }
    };

    // Criar novas regras (agrupando por produto + tarefa + tempo_estimado_dia)
    const regrasParaInserir = [];

    for (const produtoId of produtoIdsFinal) {
      for (const tarefa of tarefasFinal) {
        const tarefaId = String(tarefa.tarefa_id).trim();
        const tempoEstimado = tempoPorTarefa.get(tarefaId);

        if (!tempoEstimado || tempoEstimado <= 0) {
          console.warn(`⚠️ Tarefa ${tarefaId} não tem tempo estimado válido, pulando...`);
          continue;
        }

        // Buscar tipo_tarefa_id
        const tipoTarefaId = await buscarTipoTarefaIdPorTarefa(tarefaId);

        // Criar uma regra para esta combinação produto + tarefa + tempo
        regrasParaInserir.push({
          agrupador_id: agrupador_id,
          cliente_id: String(clienteIdFinal).trim(),
          produto_id: produtoId ? parseInt(produtoId, 10) : null,
          tarefa_id: parseInt(tarefaId, 10),
          responsavel_id: parseInt(responsavelIdFinal, 10),
          tipo_tarefa_id: tipoTarefaId,
          data_inicio: dataInicioFinal.split('T')[0], // Apenas data, sem hora
          data_fim: dataFimFinal.split('T')[0], // Apenas data, sem hora
          tempo_estimado_dia: tempoEstimado,
          incluir_finais_semana: true, // Default true (pode ser ajustado se necessário)
          incluir_feriados: true, // Default true (pode ser ajustado se necessário)
          created_by: historicoAtual.usuario_criador_id || null
        });
      }
    }

    console.log(`📝 Criando ${regrasParaInserir.length} nova(s) regra(s) de tempo estimado`);

    // Inserir novas regras
    const { data: regrasInseridas, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .insert(regrasParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir novas regras:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar atribuição',
        details: insertError.message
      });
    }

    console.log(`✅ ${regrasInseridas.length} regra(s) de tempo estimado atualizada(s) com sucesso`);

    // Buscar histórico atualizado com dados relacionados
    const [clienteData, responsavelData, usuarioCriadorData] = await Promise.all([
      supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .select('id, nome')
        .eq('id', historicoAtualizado.cliente_id)
        .maybeSingle(),
      supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome')
        .eq('id', historicoAtualizado.responsavel_id)
        .maybeSingle(),
      supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, nome')
        .eq('id', historicoAtualizado.usuario_criador_id)
        .maybeSingle()
    ]);

    const historicoCompleto = {
      ...historicoAtualizado,
      cliente: clienteData.data || null,
      responsavel: responsavelData.data || null,
      usuario_criador: usuarioCriadorData.data || null
    };

    return res.json({
      success: true,
      message: 'Histórico e atribuição atualizados com sucesso!',
      data: historicoCompleto
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar histórico de atribuição:', error);
    console.error('❌ Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar histórico de atribuição
async function deletarHistoricoAtribuicao(req, res) {
  try {
    console.log('📥 DELETE /api/historico-atribuicoes/:id chamado');
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID é obrigatório'
      });
    }

    // Buscar histórico atual para obter o agrupador_id
    const { data: historicoAtual, error: historicoError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('agrupador_id')
      .eq('id', id)
      .single();

    if (historicoError || !historicoAtual) {
      console.error('❌ Erro ao buscar histórico:', historicoError);
      return res.status(404).json({
        success: false,
        error: 'Histórico de atribuição não encontrado'
      });
    }

    const agrupador_id = historicoAtual.agrupador_id;

    if (agrupador_id) {
      console.log('🗑️ Iniciando deleção em cascata para agrupador:', agrupador_id);

      // 1. Deletar regras de tempo estimado (tempo_estimado_regra)
      const { error: deleteRegraError } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado_regra')
        .delete()
        .eq('agrupador_id', agrupador_id);

      if (deleteRegraError) {
        console.error('❌ Erro ao deletar regras (tempo_estimado_regra):', deleteRegraError);
        // Não retornar erro fatal aqui, tentar deletar o resto
      } else {
        console.log('✅ Regras deletadas com sucesso');
      }

      // 2. Deletar registros de tempo diários (tempo_estimado)
      // NOTA: Esta tabela pode não existir mais em versões recentes que usam apenas regras dinâmicas
      const { error: deleteTempoError } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado')
        .delete()
        .eq('agrupador_id', agrupador_id);

      if (deleteTempoError) {
        // Ignorar erro se a tabela não existir (código 42P01)
        if (deleteTempoError.code === '42P01') {
          console.warn('⚠️ Tabela tempo_estimado não encontrada, pulando deleção de registros diários (OK se usar apenas regras dinâmicas)');
        } else {
          console.error('❌ Erro ao deletar registros de tempo_estimado:', deleteTempoError);
          return res.status(500).json({
            success: false,
            error: 'Erro ao deletar registros relacionados (tempo_estimado)',
            details: deleteTempoError.message
          });
        }
      } else {
        console.log('✅ Registros diários deletados com sucesso');
      }
    }

    // 3. Deletar o histórico (historico_atribuicoes)
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Erro ao deletar histórico:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar histórico de atribuição',
        details: deleteError.message
      });
    }

    console.log('✅ Histórico de atribuição deletado com sucesso');
    return res.json({
      success: true,
      message: 'Histórico de atribuição deletado com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar histórico de atribuição:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar detalhes diários de uma atribuição (por agrupador_id)
async function getDetalhesDiariosAtribuicao(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID é obrigatório'
      });
    }

    // Buscar histórico para obter o agrupador_id
    const { data: historico, error: historicoError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('agrupador_id, data_inicio, data_fim')
      .eq('id', id)
      .single();

    if (historicoError || !historico) {
      return res.status(404).json({
        success: false,
        error: 'Histórico de atribuição não encontrado'
      });
    }

    if (!historico.agrupador_id) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Buscar todas as regras de tempo_estimado_regra para este agrupador
    const { data: regrasTempo, error: tempoError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .select('*')
      .eq('agrupador_id', historico.agrupador_id)
      .order('data_inicio', { ascending: true });

    if (tempoError) {
      console.error('❌ Erro ao buscar regras de tempo:', tempoError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar detalhes diários',
        details: tempoError.message
      });
    }

    if (!regrasTempo || regrasTempo.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Buscar nomes de tarefas
    const tarefaIds = new Set();
    regrasTempo.forEach(regra => {
      if (regra.tarefa_id) tarefaIds.add(String(regra.tarefa_id));
    });

    const nomesTarefas = {};
    if (tarefaIds.size > 0) {
      const { data: tarefas, error: tarefasError } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tarefa')
        .select('id, nome')
        .in('id', Array.from(tarefaIds));

      if (!tarefasError && tarefas) {
        tarefas.forEach(t => {
          nomesTarefas[String(t.id)] = t.nome;
        });
      }
    }

    // Calcular registros diários dinamicamente a partir das regras
    const registrosTempo = [];
    for (const regra of regrasTempo) {
      // Usar calcularRegistrosDinamicos para gerar registros diários da regra
      const registrosVirtuais = await calcularRegistrosDinamicos(
        regra,
        historico.data_inicio,
        historico.data_fim
      );

      // Adicionar informações adicionais de cada registro virtual
      registrosVirtuais.forEach(reg => {
        registrosTempo.push({
          ...reg,
          tarefa_nome: nomesTarefas[String(reg.tarefa_id)] || `Tarefa #${reg.tarefa_id}`,
          regra_id: regra.id // ID da regra para referência
        });
      });
    }

    // Agrupar por data
    const detalhesPorData = {};
    registrosTempo.forEach(reg => {
      const dataStr = reg.data ? reg.data.split('T')[0] : null;
      if (!dataStr) return;

      if (!detalhesPorData[dataStr]) {
        detalhesPorData[dataStr] = [];
      }

      detalhesPorData[dataStr].push({
        id: reg.regra_id, // ID da regra (para manter compatibilidade com frontend)
        tarefa_id: reg.tarefa_id,
        tarefa_nome: reg.tarefa_nome || nomesTarefas[String(reg.tarefa_id)] || `Tarefa #${reg.tarefa_id}`,
        produto_id: reg.produto_id,
        tempo_estimado_dia: reg.tempo_estimado_dia,
        responsavel_id: reg.responsavel_id
      });
    });

    // Converter para array ordenado por data
    const detalhesArray = Object.keys(detalhesPorData)
      .sort()
      .map(data => ({
        data,
        tarefas: detalhesPorData[data]
      }));

    return res.json({
      success: true,
      data: detalhesArray
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar detalhes diários:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Sincronizar históricos para regras órfãs (sem histórico associado)
async function sincronizarHistoricosOrfaos(req, res) {
  try {
    console.log('🔄 Iniciando sincronização de históricos órfãos...');

    // Buscar todos os agrupador_id únicos de regras que não têm histórico
    const { data: regrasSemHistorico, error: regrasError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .select('agrupador_id, cliente_id, responsavel_id, produto_id, tarefa_id, data_inicio, data_fim, created_by')
      .not('agrupador_id', 'is', null);

    if (regrasError) {
      console.error('❌ Erro ao buscar regras:', regrasError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar regras',
        details: regrasError.message
      });
    }

    if (!regrasSemHistorico || regrasSemHistorico.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhuma regra encontrada',
        historicosCriados: 0
      });
    }

    // Agrupar regras por agrupador_id
    const regrasPorAgrupador = new Map();
    regrasSemHistorico.forEach(regra => {
      const agrupadorId = regra.agrupador_id;
      if (!regrasPorAgrupador.has(agrupadorId)) {
        regrasPorAgrupador.set(agrupadorId, []);
      }
      regrasPorAgrupador.get(agrupadorId).push(regra);
    });

    // Verificar quais agrupadores já têm histórico
    const agrupadoresComHistorico = new Set();
    if (regrasPorAgrupador.size > 0) {
      const agrupadorIds = Array.from(regrasPorAgrupador.keys());

      // Buscar em lotes (Supabase tem limite de 1000 itens no IN)
      const batchSize = 1000;
      for (let i = 0; i < agrupadorIds.length; i += batchSize) {
        const batch = agrupadorIds.slice(i, i + batchSize);
        const { data: historicos, error: historicoError } = await supabase
          .schema('up_gestaointeligente')
          .from('historico_atribuicoes')
          .select('agrupador_id')
          .in('agrupador_id', batch);

        if (!historicoError && historicos) {
          historicos.forEach(h => {
            if (h.agrupador_id) {
              agrupadoresComHistorico.add(h.agrupador_id);
            }
          });
        }
      }
    }

    // Filtrar apenas agrupadores sem histórico
    const agrupadoresOrfaos = Array.from(regrasPorAgrupador.keys()).filter(
      agrupadorId => !agrupadoresComHistorico.has(agrupadorId)
    );

    console.log(`📊 Total de agrupadores: ${regrasPorAgrupador.size}`);
    console.log(`📊 Agrupadores com histórico: ${agrupadoresComHistorico.size}`);
    console.log(`📊 Agrupadores órfãos: ${agrupadoresOrfaos.length}`);

    if (agrupadoresOrfaos.length === 0) {
      return res.json({
        success: true,
        message: 'Todos os agrupadores já têm histórico associado',
        historicosCriados: 0
      });
    }

    // Criar históricos para agrupadores órfãos
    const historicosParaCriar = [];
    let historicosCriados = 0;

    for (const agrupadorId of agrupadoresOrfaos) {
      // Buscar todas as regras completas do agrupador
      const { data: regrasCompletas, error: regrasError } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado_regra')
        .select('*')
        .eq('agrupador_id', agrupadorId);

      if (regrasError || !regrasCompletas || regrasCompletas.length === 0) {
        console.warn(`⚠️ Erro ao buscar regras do agrupador ${agrupadorId}:`, regrasError);
        continue;
      }

      // Pegar dados da primeira regra (todas devem ter os mesmos dados básicos)
      const primeiraRegra = regrasCompletas[0];

      // Calcular período mínimo e máximo
      let dataInicioMin = primeiraRegra.data_inicio;
      let dataFimMax = primeiraRegra.data_fim;
      const produtoIds = new Set();
      const tarefasMap = new Map(); // tarefa_id -> tempo_estimado_dia (usar o maior se houver duplicatas)

      regrasCompletas.forEach(regra => {
        if (regra.data_inicio && regra.data_inicio < dataInicioMin) {
          dataInicioMin = regra.data_inicio;
        }
        if (regra.data_fim && regra.data_fim > dataFimMax) {
          dataFimMax = regra.data_fim;
        }
        if (regra.produto_id) {
          produtoIds.add(regra.produto_id);
        }
        if (regra.tarefa_id) {
          const tarefaIdStr = String(regra.tarefa_id);
          const tempoAtual = tarefasMap.get(tarefaIdStr) || 0;
          // Usar o maior tempo_estimado_dia se houver múltiplas regras para a mesma tarefa
          tarefasMap.set(tarefaIdStr, Math.max(tempoAtual, regra.tempo_estimado_dia || 0));
        }
      });

      // Converter tarefas para array no formato esperado
      const tarefasArray = Array.from(tarefasMap.entries()).map(([tarefa_id, tempo_estimado_dia]) => ({
        tarefa_id: parseInt(tarefa_id, 10),
        tempo_estimado_dia: tempo_estimado_dia
      }));

      // Usar created_by da primeira regra, ou null se não houver
      const usuarioCriadorId = primeiraRegra.created_by || null;

      historicosParaCriar.push({
        agrupador_id: agrupadorId,
        cliente_id: primeiraRegra.cliente_id,
        responsavel_id: primeiraRegra.responsavel_id,
        usuario_criador_id: usuarioCriadorId ? String(usuarioCriadorId) : null,
        data_inicio: dataInicioMin.split('T')[0], // Apenas data, sem hora
        data_fim: dataFimMax.split('T')[0], // Apenas data, sem hora
        produto_ids: Array.from(produtoIds).filter(id => id !== null && id !== undefined).map(id => parseInt(id, 10)),
        tarefas: tarefasArray
      });
    }

    // Inserir históricos em lotes
    const batchSize = 100;
    for (let i = 0; i < historicosParaCriar.length; i += batchSize) {
      const batch = historicosParaCriar.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .schema('up_gestaointeligente')
        .from('historico_atribuicoes')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Erro ao inserir lote ${i / batchSize + 1}:`, insertError);
      } else {
        historicosCriados += batch.length;
        console.log(`✅ Lote ${i / batchSize + 1}: ${batch.length} histórico(s) criado(s)`);
      }
    }

    console.log(`✅ Sincronização concluída: ${historicosCriados} histórico(s) criado(s)`);

    return res.json({
      success: true,
      message: `Sincronização concluída: ${historicosCriados} histórico(s) criado(s)`,
      historicosCriados: historicosCriados,
      totalAgrupadoresOrfaos: agrupadoresOrfaos.length
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao sincronizar históricos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar regras órfãs (sem histórico associado) formatadas para exibição
async function getRegrasOrfas(req, res) {
  try {
    console.log('🔍 Buscando regras órfãs...');

    // Buscar todos os agrupador_id únicos de regras
    const { data: todasRegras, error: regrasError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .select('agrupador_id')
      .not('agrupador_id', 'is', null);

    if (regrasError) {
      console.error('❌ Erro ao buscar regras:', regrasError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar regras',
        details: regrasError.message
      });
    }

    if (!todasRegras || todasRegras.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Obter agrupador_ids únicos
    const agrupadorIds = [...new Set(todasRegras.map(r => r.agrupador_id))];

    // Verificar quais agrupadores já têm histórico
    const agrupadoresComHistorico = new Set();
    const batchSize = 1000;
    for (let i = 0; i < agrupadorIds.length; i += batchSize) {
      const batch = agrupadorIds.slice(i, i + batchSize);
      const { data: historicos } = await supabase
        .schema('up_gestaointeligente')
        .from('historico_atribuicoes')
        .select('agrupador_id')
        .in('agrupador_id', batch);

      if (historicos) {
        historicos.forEach(h => {
          if (h.agrupador_id) {
            agrupadoresComHistorico.add(h.agrupador_id);
          }
        });
      }
    }

    // Filtrar apenas agrupadores sem histórico
    const agrupadoresOrfaos = agrupadorIds.filter(
      agrupadorId => !agrupadoresComHistorico.has(agrupadorId)
    );

    if (agrupadoresOrfaos.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar regras completas para cada agrupador órfão
    const regrasOrfasFormatadas = [];

    for (const agrupadorId of agrupadoresOrfaos) {
      const { data: regrasDoAgrupador } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado_regra')
        .select('*')
        .eq('agrupador_id', agrupadorId)
        .order('data_inicio', { ascending: true });

      if (!regrasDoAgrupador || regrasDoAgrupador.length === 0) continue;

      const primeiraRegra = regrasDoAgrupador[0];

      // Calcular período mínimo e máximo
      let dataInicioMin = primeiraRegra.data_inicio;
      let dataFimMax = primeiraRegra.data_fim;
      const produtoIds = new Set();
      const tarefasMap = new Map();

      regrasDoAgrupador.forEach(regra => {
        if (regra.data_inicio && regra.data_inicio < dataInicioMin) {
          dataInicioMin = regra.data_inicio;
        }
        if (regra.data_fim && regra.data_fim > dataFimMax) {
          dataFimMax = regra.data_fim;
        }
        if (regra.produto_id) {
          produtoIds.add(regra.produto_id);
        }
        if (regra.tarefa_id) {
          const tarefaIdStr = String(regra.tarefa_id);
          const tempoAtual = tarefasMap.get(tarefaIdStr) || 0;
          tarefasMap.set(tarefaIdStr, Math.max(tempoAtual, regra.tempo_estimado_dia || 0));
        }
      });

      // Buscar nomes relacionados
      const [clienteData, responsavelData] = await Promise.all([
        supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome')
          .eq('id', primeiraRegra.cliente_id)
          .maybeSingle(),
        supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, nome')
          .eq('id', primeiraRegra.responsavel_id)
          .maybeSingle()
      ]);

      // Buscar nomes de produtos
      const produtoIdsArray = Array.from(produtoIds).filter(id => id !== null);
      const nomesProdutos = {};
      if (produtoIdsArray.length > 0) {
        const { data: produtos } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_produto')
          .select('id, nome')
          .in('id', produtoIdsArray);

        if (produtos) {
          produtos.forEach(p => {
            nomesProdutos[String(p.id)] = p.nome;
          });
        }
      }

      // Buscar nomes de tarefas
      const tarefaIdsArray = Array.from(tarefasMap.keys());
      const nomesTarefas = {};
      if (tarefaIdsArray.length > 0) {
        const { data: tarefas } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_tarefa')
          .select('id, nome')
          .in('id', tarefaIdsArray.map(id => parseInt(id, 10)));

        if (tarefas) {
          tarefas.forEach(t => {
            nomesTarefas[String(t.id)] = t.nome;
          });
        }
      }

      regrasOrfasFormatadas.push({
        agrupador_id: agrupadorId,
        cliente_id: primeiraRegra.cliente_id,
        cliente: clienteData.data || null,
        responsavel_id: primeiraRegra.responsavel_id,
        responsavel: responsavelData.data || null,
        data_inicio: dataInicioMin.split('T')[0],
        data_fim: dataFimMax.split('T')[0],
        produto_ids: produtoIdsArray,
        produtos: produtoIdsArray.map(id => ({
          id,
          nome: nomesProdutos[String(id)] || `Produto #${id}`
        })),
        tarefas: Array.from(tarefasMap.entries()).map(([tarefa_id, tempo_estimado_dia]) => ({
          tarefa_id: parseInt(tarefa_id, 10),
          tarefa_nome: nomesTarefas[tarefa_id] || `Tarefa #${tarefa_id}`,
          tempo_estimado_dia: tempo_estimado_dia
        })),
        quantidade_regras: regrasDoAgrupador.length,
        created_at: primeiraRegra.created_at || null
      });
    }

    console.log(`✅ Encontradas ${regrasOrfasFormatadas.length} regra(s) órfã(s)`);

    return res.json({
      success: true,
      data: regrasOrfasFormatadas,
      count: regrasOrfasFormatadas.length
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar regras órfãs:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar regras órfãs por agrupador_id
async function deletarRegrasOrfas(req, res) {
  try {
    const { agrupador_id } = req.params;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    console.log(`🗑️ Deletando regras órfãs para agrupador_id: ${agrupador_id}`);

    // Verificar se existe histórico associado (não deveria, mas vamos garantir)
    const { data: historicoExistente } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('id')
      .eq('agrupador_id', agrupador_id)
      .maybeSingle();

    if (historicoExistente) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível deletar: existe histórico associado a este agrupador'
      });
    }

    // Deletar todas as regras do agrupador
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      console.error('❌ Erro ao deletar regras:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar regras',
        details: deleteError.message
      });
    }

    console.log(`✅ Regras órfãs deletadas com sucesso para agrupador_id: ${agrupador_id}`);

    return res.json({
      success: true,
      message: 'Regras deletadas com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar regras órfãs:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getHistoricoAtribuicoes,
  getHistoricoAtribuicaoPorId,
  atualizarHistoricoAtribuicao,
  deletarHistoricoAtribuicao,
  getDetalhesDiariosAtribuicao,
  sincronizarHistoricosOrfaos,
  getRegrasOrfas,
  deletarRegrasOrfas
};

