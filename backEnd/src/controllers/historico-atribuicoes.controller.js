// =============================================================
// === CONTROLLER DE HISTÓRICO DE ATRIBUIÇÕES ===
// =============================================================

const supabase = require('../config/database');
const { buscarTodosComPaginacao } = require('../services/database-utils');

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

    // Buscar dados relacionados (cliente, responsável, usuário criador)
    console.log('🔍 Buscando dados relacionados...');
    const historicoCompleto = await Promise.all((data || []).map(async (item) => {
      try {
        const [clienteResult, responsavelResult, usuarioCriadorResult] = await Promise.all([
          supabase
            .schema('up_gestaointeligente')
            .from('cp_cliente')
            .select('id, nome')
            .eq('id', item.cliente_id)
            .maybeSingle(),
          supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id, nome')
            .eq('id', item.responsavel_id)
            .maybeSingle(),
          supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id, nome')
            .eq('id', item.usuario_criador_id)
            .maybeSingle()
        ]);

        return {
          ...item,
          cliente: clienteResult.data || null,
          responsavel: responsavelResult.data || null,
          usuario_criador: usuarioCriadorResult.data || null
        };
      } catch (err) {
        console.error('❌ Erro ao buscar dados relacionados para item:', item.id, err);
        return {
          ...item,
          cliente: null,
          responsavel: null,
          usuario_criador: null
        };
      }
    }));

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

    // Deletar todos os registros antigos do agrupamento
    console.log('🗑️ Deletando registros antigos do agrupamento:', agrupador_id);
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      console.error('❌ Erro ao deletar registros antigos:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar atribuição',
        details: deleteError.message
      });
    }

    // Criar novos registros
    const registrosParaInserir = [];
    
    produtoIdsFinal.forEach(produtoId => {
      tarefasFinal.forEach(tarefa => {
        const tarefaId = String(tarefa.tarefa_id).trim();
        const tempoEstimado = tempoPorTarefa.get(tarefaId);
        
        if (!tempoEstimado || tempoEstimado <= 0) {
          console.warn(`⚠️ Tarefa ${tarefaId} não tem tempo estimado válido, pulando...`);
          return;
        }

        datasDoPeriodo.forEach(dataDoDia => {
          registrosParaInserir.push({
            cliente_id: String(clienteIdFinal).trim(),
            produto_id: String(produtoId).trim(),
            tarefa_id: tarefaId,
            data: dataDoDia,
            tempo_estimado_dia: tempoEstimado,
            responsavel_id: String(responsavelIdFinal).trim(),
            agrupador_id: agrupador_id
          });
        });
      });
    });

    console.log(`📝 Criando ${registrosParaInserir.length} novo(s) registro(s) de tempo estimado`);

    // Inserir novos registros
    const { data: dadosInseridos, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .insert(registrosParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir novos registros:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar atribuição',
        details: insertError.message
      });
    }

    console.log(`✅ ${dadosInseridos.length} registro(s) de tempo estimado atualizado(s) com sucesso`);

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

    // Deletar todos os registros de tempo_estimado relacionados ao agrupador
    if (agrupador_id) {
      console.log('🗑️ Deletando registros de tempo_estimado do agrupamento:', agrupador_id);
      const { error: deleteTempoError } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado')
        .delete()
        .eq('agrupador_id', agrupador_id);

      if (deleteTempoError) {
        console.error('❌ Erro ao deletar registros de tempo_estimado:', deleteTempoError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao deletar registros relacionados',
          details: deleteTempoError.message
        });
      }
    }

    // Deletar o histórico
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

    // Buscar todos os registros de tempo_estimado para este agrupador
    const { data: registrosTempo, error: tempoError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*')
      .eq('agrupador_id', historico.agrupador_id)
      .order('data', { ascending: true });

    if (tempoError) {
      console.error('❌ Erro ao buscar registros de tempo:', tempoError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar detalhes diários',
        details: tempoError.message
      });
    }

    // Buscar nomes de tarefas
    const tarefaIds = new Set();
    registrosTempo.forEach(reg => {
      if (reg.tarefa_id) tarefaIds.add(String(reg.tarefa_id));
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

    // Agrupar por data
    const detalhesPorData = {};
    registrosTempo.forEach(reg => {
      const dataStr = reg.data ? reg.data.split('T')[0] : null;
      if (!dataStr) return;

      if (!detalhesPorData[dataStr]) {
        detalhesPorData[dataStr] = [];
      }

      detalhesPorData[dataStr].push({
        id: reg.id, // ID do registro de tempo_estimado para editar/deletar
        tarefa_id: reg.tarefa_id,
        tarefa_nome: nomesTarefas[String(reg.tarefa_id)] || `Tarefa #${reg.tarefa_id}`,
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

module.exports = {
  getHistoricoAtribuicoes,
  getHistoricoAtribuicaoPorId,
  atualizarHistoricoAtribuicao,
  deletarHistoricoAtribuicao,
  getDetalhesDiariosAtribuicao
};

