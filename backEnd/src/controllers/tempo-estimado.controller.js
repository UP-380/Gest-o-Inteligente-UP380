// =============================================================
// === CONTROLLER DE TEMPO ESTIMADO ===
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// POST - Criar novo(s) registro(s) de tempo estimado
async function criarTempoEstimado(req, res) {
  try {
    const { cliente_id, produto_ids, tarefa_ids, data_inicio, data_fim, tempo_estimado_dia, responsavel_id } = req.body;

    // Validações
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    if (!produto_ids || !Array.isArray(produto_ids) || produto_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'produto_ids deve ser um array não vazio'
      });
    }

    if (!tarefa_ids || !Array.isArray(tarefa_ids) || tarefa_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tarefa_ids deve ser um array não vazio'
      });
    }

    if (!data_inicio) {
      return res.status(400).json({
        success: false,
        error: 'data_inicio é obrigatória'
      });
    }

    if (!data_fim) {
      return res.status(400).json({
        success: false,
        error: 'data_fim é obrigatória'
      });
    }

    if (!responsavel_id) {
      return res.status(400).json({
        success: false,
        error: 'responsavel_id é obrigatório'
      });
    }

    // Função para gerar todas as datas entre início e fim
    const gerarDatasDoPeriodo = (inicioStr, fimStr) => {
      const inicio = new Date(inicioStr + 'T00:00:00');
      const fim = new Date(fimStr + 'T00:00:00');
      const datas = [];
      
      // Garantir que fim seja maior ou igual a início
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
        
        // Avançar para o próximo dia
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      
      return datas;
    };

    // Gerar todas as datas do período
    const datasDoPeriodo = gerarDatasDoPeriodo(data_inicio, data_fim);
    
    if (datasDoPeriodo.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Data fim deve ser maior ou igual à data início'
      });
    }

    // Gerar um ID único para agrupar todos os registros desta delegação
    const agrupador_id = uuidv4();

    // Criar todas as combinações: produto x tarefa x data (um registro para cada dia)
    const registrosParaInserir = [];
    
    produto_ids.forEach(produtoId => {
      tarefa_ids.forEach(tarefaId => {
        datasDoPeriodo.forEach(dataDoDia => {
          registrosParaInserir.push({
            cliente_id: String(cliente_id).trim(),
            produto_id: String(produtoId).trim(),
            tarefa_id: String(tarefaId).trim(),
            data: dataDoDia,
            tempo_estimado_dia: parseInt(tempo_estimado_dia, 10), // em milissegundos
            responsavel_id: String(responsavel_id).trim(),
            agrupador_id: agrupador_id
          });
        });
      });
    });

    console.log(`📝 Criando ${registrosParaInserir.length} registro(s) de tempo estimado`);
    console.log(`   - ${produto_ids.length} produto(s) × ${tarefa_ids.length} tarefa(s) × ${datasDoPeriodo.length} dia(s) = ${registrosParaInserir.length} registro(s)`);
    console.log(`   - Tempo estimado por dia: ${tempo_estimado_dia}ms (${Math.round(tempo_estimado_dia / (1000 * 60 * 60))}h ${Math.round((tempo_estimado_dia % (1000 * 60 * 60)) / (1000 * 60))}min)`);
    
    // Log do primeiro registro para debug
    if (registrosParaInserir.length > 0) {
      console.log('📋 Exemplo de registro:', JSON.stringify(registrosParaInserir[0], null, 2));
    }

    // Inserir todos os registros
    const { data: dadosInseridos, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .insert(registrosParaInserir)
      .select();

    if (error) {
      console.error('❌ Erro ao criar tempo estimado:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      console.error('❌ Primeiro registro que tentou inserir:', registrosParaInserir[0]);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tempo estimado',
        details: error.message,
        hint: error.hint || null
      });
    }

    console.log(`✅ ${dadosInseridos.length} registro(s) de tempo estimado criado(s) com sucesso`);

    return res.status(201).json({
      success: true,
      data: dadosInseridos,
      count: dadosInseridos.length,
      message: `${dadosInseridos.length} registro(s) de tempo estimado criado(s) com sucesso!`
    });
  } catch (error) {
    console.error('Erro inesperado ao criar tempo estimado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar registros de tempo estimado (com paginação e filtros)
async function getTempoEstimado(req, res) {
  try {
    const { 
      page = 1, 
      limit = 20,
      cliente_id = null,
      produto_id = null,
      tarefa_id = null,
      responsavel_id = null,
      data = null,
      data_inicio = null,
      data_fim = null
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (cliente_id) {
      query = query.eq('cliente_id', String(cliente_id).trim());
    }

    if (produto_id) {
      query = query.eq('produto_id', String(produto_id).trim());
    }

    if (tarefa_id) {
      query = query.eq('tarefa_id', String(tarefa_id).trim());
    }

    if (responsavel_id) {
      query = query.eq('responsavel_id', String(responsavel_id).trim());
    }

    // Filtro por data específica
    if (data) {
      const dataFormatada = data.includes('T') ? data : `${data}T00:00:00`;
      query = query.eq('data', dataFormatada);
    }

    // Filtro por intervalo de datas
    if (data_inicio && data_fim) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      query = query.gte('data', inicioFormatado).lte('data', fimFormatado);
    } else if (data_inicio) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      query = query.gte('data', inicioFormatado);
    } else if (data_fim) {
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      query = query.lte('data', fimFormatado);
    }

    // Ordenar por data (mais recentes primeiro)
    query = query.order('data', { ascending: false });

    // Aplicar paginação
    query = query.range(offset, offset + limitNum - 1);

    const { data: dadosTempoEstimado, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo estimado',
        details: error.message
      });
    }

    const totalPages = Math.ceil((count || 0) / limitNum);

    return res.json({
      success: true,
      data: dadosTempoEstimado || [],
      count: dadosTempoEstimado?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tempo estimado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tempo estimado por ID
async function getTempoEstimadoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tempo estimado é obrigatório'
      });
    }

    const { data: tempoEstimado, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo estimado',
        details: error.message
      });
    }

    if (!tempoEstimado) {
      return res.status(404).json({
        success: false,
        error: 'Tempo estimado não encontrado'
      });
    }

    return res.json({
      success: true,
      data: tempoEstimado
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tempo estimado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar tempo estimado
async function atualizarTempoEstimado(req, res) {
  try {
    const { id } = req.params;
    const { cliente_id, produto_id, tarefa_id, data, responsavel_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tempo estimado é obrigatório'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (cliente_id !== undefined) {
      dadosUpdate.cliente_id = cliente_id ? String(cliente_id).trim() : null;
    }

    if (produto_id !== undefined) {
      dadosUpdate.produto_id = produto_id ? String(produto_id).trim() : null;
    }

    if (tarefa_id !== undefined) {
      dadosUpdate.tarefa_id = tarefa_id ? String(tarefa_id).trim() : null;
    }

    if (data !== undefined) {
      dadosUpdate.data = data ? (data.includes('T') || data.includes(' ') ? data : `${data}T00:00:00`) : null;
    }

    if (responsavel_id !== undefined) {
      dadosUpdate.responsavel_id = responsavel_id ? String(responsavel_id).trim() : null;
    }

    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo fornecido para atualização'
      });
    }

    const { data: tempoEstimadoAtualizado, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tempo estimado',
        details: error.message
      });
    }

    if (!tempoEstimadoAtualizado) {
      return res.status(404).json({
        success: false,
        error: 'Tempo estimado não encontrado'
      });
    }

    console.log('✅ Tempo estimado atualizado com sucesso:', tempoEstimadoAtualizado);

    return res.json({
      success: true,
      data: tempoEstimadoAtualizado,
      message: 'Tempo estimado atualizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar tempo estimado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar tempo estimado
async function deletarTempoEstimado(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tempo estimado é obrigatório'
      });
    }

    const { data: tempoEstimadoDeletado, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao deletar tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar tempo estimado',
        details: error.message
      });
    }

    if (!tempoEstimadoDeletado) {
      return res.status(404).json({
        success: false,
        error: 'Tempo estimado não encontrado'
      });
    }

    console.log('✅ Tempo estimado deletado com sucesso');

    return res.json({
      success: true,
      message: 'Tempo estimado deletado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar tempo estimado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar todos os registros de um agrupamento
async function atualizarTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;
    const { cliente_id, produto_ids, tarefa_ids, data_inicio, data_fim, tempo_estimado_dia, responsavel_id } = req.body;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    // Validações
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    if (!produto_ids || !Array.isArray(produto_ids) || produto_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'produto_ids deve ser um array não vazio'
      });
    }

    if (!tarefa_ids || !Array.isArray(tarefa_ids) || tarefa_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tarefa_ids deve ser um array não vazio'
      });
    }

    if (!data_inicio) {
      return res.status(400).json({
        success: false,
        error: 'data_inicio é obrigatória'
      });
    }

    if (!data_fim) {
      return res.status(400).json({
        success: false,
        error: 'data_fim é obrigatória'
      });
    }

    if (!tempo_estimado_dia || tempo_estimado_dia <= 0) {
      return res.status(400).json({
        success: false,
        error: 'tempo_estimado_dia é obrigatório e deve ser maior que zero'
      });
    }

    if (!responsavel_id) {
      return res.status(400).json({
        success: false,
        error: 'responsavel_id é obrigatório'
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
    const datasDoPeriodo = gerarDatasDoPeriodo(data_inicio, data_fim);
    
    if (datasDoPeriodo.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Data fim deve ser maior ou igual à data início'
      });
    }

    // Primeiro, deletar todos os registros do agrupamento antigo
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      console.error('❌ Erro ao deletar registros antigos:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar agrupamento',
        details: deleteError.message
      });
    }

    // Criar novos registros com os dados atualizados
    const registrosParaInserir = [];
    
    produto_ids.forEach(produtoId => {
      tarefa_ids.forEach(tarefaId => {
        datasDoPeriodo.forEach(dataDoDia => {
          registrosParaInserir.push({
            cliente_id: String(cliente_id).trim(),
            produto_id: String(produtoId).trim(),
            tarefa_id: String(tarefaId).trim(),
            data: dataDoDia,
            tempo_estimado_dia: parseInt(tempo_estimado_dia, 10), // em milissegundos
            responsavel_id: String(responsavel_id).trim(),
            agrupador_id: agrupador_id
          });
        });
      });
    });

    // Inserir novos registros
    const { data: dadosInseridos, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .insert(registrosParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao criar novos registros:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar agrupamento',
        details: insertError.message
      });
    }

    console.log(`✅ Agrupamento ${agrupador_id} atualizado: ${dadosInseridos.length} registro(s) criado(s)`);

    return res.json({
      success: true,
      data: dadosInseridos,
      count: dadosInseridos.length,
      agrupador_id: agrupador_id,
      message: `${dadosInseridos.length} registro(s) atualizado(s) com sucesso!`
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar agrupamento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar todos os registros de um agrupamento
async function deletarTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    // Buscar quantos registros serão deletados
    const { count, error: countError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*', { count: 'exact', head: true })
      .eq('agrupador_id', agrupador_id);

    if (countError) {
      console.error('❌ Erro ao contar registros:', countError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar agrupamento',
        details: countError.message
      });
    }

    // Deletar todos os registros do agrupamento
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (error) {
      console.error('❌ Erro ao deletar agrupamento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar agrupamento',
        details: error.message
      });
    }

    console.log(`✅ Agrupamento ${agrupador_id} deletado: ${count || 0} registro(s) removido(s)`);

    return res.json({
      success: true,
      count: count || 0,
      message: `${count || 0} registro(s) deletado(s) com sucesso!`
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar agrupamento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar registros por agrupador_id
async function getTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*')
      .eq('agrupador_id', agrupador_id)
      .order('data', { ascending: true });

    if (error) {
      console.error('Erro ao buscar registros por agrupador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      agrupador_id: agrupador_id
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar registros por agrupador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  criarTempoEstimado,
  getTempoEstimado,
  getTempoEstimadoPorId,
  atualizarTempoEstimado,
  deletarTempoEstimado,
  atualizarTempoEstimadoPorAgrupador,
  deletarTempoEstimadoPorAgrupador,
  getTempoEstimadoPorAgrupador
};

