// =============================================================
// === CONTROLLER DE REGISTRO DE TEMPO ===
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// POST - Iniciar registro de tempo (criar com data_inicio)
async function iniciarRegistroTempo(req, res) {
  try {
    const { tarefa_id, tempo_estimado_id, cliente_id, usuario_id } = req.body;

    // Validações obrigatórias
    if (!tarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'tarefa_id é obrigatório'
      });
    }

    if (!tempo_estimado_id) {
      return res.status(400).json({
        success: false,
        error: 'tempo_estimado_id é obrigatório'
      });
    }

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    // Verificar se já existe um registro ativo (sem data_fim) para este usuário, tarefa E cliente
    const { data: registroAtivo, error: errorAtivo } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('usuario_id', parseInt(usuario_id, 10))
      .eq('tarefa_id', String(tarefa_id).trim())
      .eq('cliente_id', String(cliente_id).trim())
      .is('data_fim', null)
      .maybeSingle();

    if (errorAtivo) {
      console.error('Erro ao verificar registro ativo:', errorAtivo);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar registro ativo',
        details: errorAtivo.message
      });
    }

    if (registroAtivo) {
      return res.status(400).json({
        success: false,
        error: 'Já existe um registro de tempo ativo para esta tarefa neste cliente. Finalize o registro anterior antes de iniciar um novo.',
        registro_id: registroAtivo.id
      });
    }

    // Criar registro com data_inicio (timestamp atual)
    const dataInicio = new Date().toISOString();

    // Gerar UUID para o ID do registro
    const registroId = uuidv4();

    const dadosInsert = {
      id: registroId,
      tarefa_id: String(tarefa_id).trim(),
      tempo_estimado_id: String(tempo_estimado_id).trim(),
      cliente_id: String(cliente_id).trim(),
      usuario_id: parseInt(usuario_id, 10),
      data_inicio: dataInicio,
      data_fim: null,
      tempo_realizado: null
    };

    console.log('📝 Criando registro de tempo:', JSON.stringify(dadosInsert, null, 2));

    const { data: registroCriado, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar registro de tempo:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar registro de tempo',
        details: insertError.message,
        hint: insertError.hint || null
      });
    }

    console.log('✅ Registro de tempo criado com sucesso:', registroCriado.id);

    return res.status(201).json({
      success: true,
      data: registroCriado,
      message: 'Registro de tempo iniciado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao iniciar registro de tempo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Finalizar registro de tempo (atualizar com data_fim e tempo_realizado)
async function finalizarRegistroTempo(req, res) {
  try {
    const { id } = req.params;
    const { tarefa_id, usuario_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do registro é obrigatório'
      });
    }

    // Buscar o registro atual (ID é UUID, não inteiro)
    const { data: registroAtual, error: errorBusca } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('id', String(id).trim())
      .maybeSingle();

    if (errorBusca) {
      console.error('Erro ao buscar registro:', errorBusca);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registro de tempo',
        details: errorBusca.message
      });
    }

    if (!registroAtual) {
      return res.status(404).json({
        success: false,
        error: 'Registro de tempo não encontrado'
      });
    }

    // Validar que o registro pertence ao usuário (se fornecido)
    if (usuario_id && registroAtual.usuario_id !== parseInt(usuario_id, 10)) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para finalizar este registro'
      });
    }

    // Validar que o registro pertence à tarefa (se fornecido)
    if (tarefa_id && registroAtual.tarefa_id !== String(tarefa_id).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Registro não pertence à tarefa informada'
      });
    }

    // Verificar se já foi finalizado
    if (registroAtual.data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Este registro de tempo já foi finalizado',
        data_fim: registroAtual.data_fim
      });
    }

    if (!registroAtual.data_inicio) {
      return res.status(400).json({
        success: false,
        error: 'Registro de tempo não possui data_inicio válida'
      });
    }

    // Calcular tempo realizado (em milissegundos)
    const dataFim = new Date().toISOString();
    const dataInicio = new Date(registroAtual.data_inicio);
    const dataFimDate = new Date(dataFim);
    const tempoRealizado = dataFimDate.getTime() - dataInicio.getTime();

    if (tempoRealizado < 0) {
      return res.status(400).json({
        success: false,
        error: 'Erro ao calcular tempo: data_fim é anterior a data_inicio'
      });
    }

    // Atualizar registro
    const dadosUpdate = {
      data_fim: dataFim,
      tempo_realizado: tempoRealizado
    };

    console.log('📝 Finalizando registro de tempo:', {
      id,
      tempo_realizado_ms: tempoRealizado,
      tempo_realizado_horas: (tempoRealizado / (1000 * 60 * 60)).toFixed(2)
    });

    const { data: registroAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .update(dadosUpdate)
      .eq('id', String(id).trim())
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao finalizar registro de tempo:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao finalizar registro de tempo',
        details: updateError.message
      });
    }

    console.log('✅ Registro de tempo finalizado com sucesso:', registroAtualizado.id);

    return res.json({
      success: true,
      data: registroAtualizado,
      message: 'Registro de tempo finalizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao finalizar registro de tempo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar registro ativo de um usuário para uma tarefa e cliente
async function getRegistroAtivo(req, res) {
  try {
    const { usuario_id, tarefa_id, cliente_id } = req.query;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    if (!tarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'tarefa_id é obrigatório'
      });
    }

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    const { data: registroAtivo, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('usuario_id', parseInt(usuario_id, 10))
      .eq('tarefa_id', String(tarefa_id).trim())
      .eq('cliente_id', String(cliente_id).trim())
      .is('data_fim', null)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar registro ativo:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registro ativo',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: registroAtivo || null
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar registro ativo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tempo realizado total de uma tarefa específica
async function getTempoRealizado(req, res) {
  try {
    const { tarefa_id, tempo_estimado_id, cliente_id, usuario_id } = req.query;

    if (!tarefa_id) {
      return res.status(400).json({
        success: false,
        error: 'tarefa_id é obrigatório'
      });
    }

    if (!tempo_estimado_id) {
      return res.status(400).json({
        success: false,
        error: 'tempo_estimado_id é obrigatório'
      });
    }

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    // Buscar todos os registros finalizados para esta tarefa específica
    const { data: registros, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('tempo_realizado')
      .eq('usuario_id', parseInt(usuario_id, 10))
      .eq('tarefa_id', String(tarefa_id).trim())
      .eq('cliente_id', String(cliente_id).trim())
      .eq('tempo_estimado_id', String(tempo_estimado_id).trim())
      .not('tempo_realizado', 'is', null);

    if (error) {
      console.error('Erro ao buscar tempo realizado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo realizado',
        details: error.message
      });
    }

    // Calcular soma total em milissegundos
    const tempoTotalMs = (registros || []).reduce((sum, reg) => {
      return sum + (Number(reg.tempo_realizado) || 0);
    }, 0);

    return res.json({
      success: true,
      data: {
        tempo_realizado_ms: tempoTotalMs,
        tempo_realizado_horas: tempoTotalMs / (1000 * 60 * 60),
        registros_count: (registros || []).length
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tempo realizado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar todos os registros ativos de um usuário
async function getRegistrosAtivos(req, res) {
  try {
    const { usuario_id } = req.query;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    const usuarioIdInt = parseInt(usuario_id, 10);

    const { data: registrosAtivos, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('usuario_id', usuarioIdInt)
      .is('data_fim', null)
      .order('data_inicio', { ascending: false });

    if (error) {
      console.error('[getRegistrosAtivos] Erro ao buscar registros ativos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros ativos',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: registrosAtivos || []
    });
  } catch (error) {
    console.error('[getRegistrosAtivos] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar registros de tempo individuais por tempo_estimado_id
async function getRegistrosPorTempoEstimado(req, res) {
  try {
    const { tempo_estimado_id } = req.query;

    if (!tempo_estimado_id) {
      return res.status(400).json({
        success: false,
        error: 'tempo_estimado_id é obrigatório'
      });
    }

    console.log(`[getRegistrosPorTempoEstimado] Buscando registros para tempo_estimado_id: ${tempo_estimado_id}`);

    // Buscar todos os registros para este tempo_estimado_id (incluindo finalizados e não finalizados)
    // Filtrar apenas registros onde cliente_id NÃO é NULL
    const { data: registros, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('id, tempo_realizado, data_inicio, data_fim, created_at, usuario_id, cliente_id, tarefa_id')
      .eq('tempo_estimado_id', String(tempo_estimado_id).trim())
      .not('cliente_id', 'is', null) // Apenas registros com cliente_id
      .order('data_inicio', { ascending: false });

    if (error) {
      console.error('[getRegistrosPorTempoEstimado] Erro ao buscar registros de tempo:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo',
        details: error.message
      });
    }

    console.log(`[getRegistrosPorTempoEstimado] Encontrados ${(registros || []).length} registros`);

    return res.json({
      success: true,
      data: registros || [],
      count: (registros || []).length
    });
  } catch (error) {
    console.error('[getRegistrosPorTempoEstimado] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar histórico de registros de tempo de um usuário (finalizados)
async function getHistoricoRegistros(req, res) {
  try {
    const { usuario_id, limite = 50 } = req.query;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    const usuarioIdInt = parseInt(usuario_id, 10);
    if (isNaN(usuarioIdInt)) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id deve ser um número válido'
      });
    }

    // Buscar registros finalizados (com data_fim) ordenados por data_inicio (mais recentes primeiro)
    const { data: registros, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('id, tempo_realizado, data_inicio, data_fim, created_at, usuario_id, cliente_id, tarefa_id, tempo_estimado_id')
      .eq('usuario_id', usuarioIdInt)
      .not('data_fim', 'is', null) // Apenas registros finalizados
      .not('cliente_id', 'is', null) // Apenas registros com cliente_id
      .order('data_inicio', { ascending: false })
      .limit(parseInt(limite, 10));

    if (error) {
      console.error('[getHistoricoRegistros] Erro ao buscar histórico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de registros',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: registros || [],
      count: (registros || []).length
    });
  } catch (error) {
    console.error('[getHistoricoRegistros] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar registro de tempo
async function atualizarRegistroTempo(req, res) {
  try {
    const { id } = req.params;
    const { tempo_realizado, data_inicio, data_fim } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do registro é obrigatório'
      });
    }

    // Validar que pelo menos um campo foi fornecido
    if (tempo_realizado === undefined && !data_inicio && !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um campo deve ser fornecido para atualização'
      });
    }

    // Buscar registro existente
    const { data: registroExistente, error: errorBusca } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (errorBusca) {
      console.error('[atualizarRegistroTempo] Erro ao buscar registro:', errorBusca);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registro',
        details: errorBusca.message
      });
    }

    if (!registroExistente) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    // Atualizar data_inicio se fornecida
    if (data_inicio) {
      dadosUpdate.data_inicio = new Date(data_inicio).toISOString();
    }

    // Atualizar data_fim se fornecida
    if (data_fim) {
      dadosUpdate.data_fim = new Date(data_fim).toISOString();
    }

    // Calcular tempo_realizado se data_inicio e data_fim foram fornecidas
    if (dadosUpdate.data_inicio && dadosUpdate.data_fim) {
      const inicio = new Date(dadosUpdate.data_inicio);
      const fim = new Date(dadosUpdate.data_fim);
      
      if (fim < inicio) {
        return res.status(400).json({
          success: false,
          error: 'data_fim não pode ser anterior a data_inicio'
        });
      }

      dadosUpdate.tempo_realizado = fim.getTime() - inicio.getTime();
    } else if (tempo_realizado !== undefined) {
      // Se tempo_realizado foi fornecido diretamente, usar ele
      dadosUpdate.tempo_realizado = parseInt(tempo_realizado, 10);
    } else if (dadosUpdate.data_inicio || dadosUpdate.data_fim) {
      // Se apenas uma data foi atualizada, recalcular tempo_realizado
      const inicio = dadosUpdate.data_inicio ? new Date(dadosUpdate.data_inicio) : new Date(registroExistente.data_inicio);
      const fim = dadosUpdate.data_fim ? new Date(dadosUpdate.data_fim) : (registroExistente.data_fim ? new Date(registroExistente.data_fim) : new Date());
      
      if (fim < inicio) {
        return res.status(400).json({
          success: false,
          error: 'data_fim não pode ser anterior a data_inicio'
        });
      }

      dadosUpdate.tempo_realizado = fim.getTime() - inicio.getTime();
    }

    console.log('📝 Atualizando registro de tempo:', { id, dadosUpdate });

    // Atualizar registro
    const { data: registroAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[atualizarRegistroTempo] Erro ao atualizar registro:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar registro',
        details: updateError.message
      });
    }

    console.log('✅ Registro de tempo atualizado com sucesso:', registroAtualizado.id);

    return res.json({
      success: true,
      data: registroAtualizado,
      message: 'Registro de tempo atualizado com sucesso!'
    });
  } catch (error) {
    console.error('[atualizarRegistroTempo] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar registros de tempo com filtros (endpoint genérico consolidado)
async function getRegistrosTempo(req, res) {
  try {
    const { 
      usuario_id, 
      cliente_id, 
      tarefa_id, 
      tempo_estimado_id,
      data_inicio, 
      data_fim,
      ativo, // true/false para filtrar apenas ativos ou finalizados
      page = 1,
      limit = 50,
      // Compatibilidade com formato antigo do dashboard-clientes.js
      colaboradorId // alias para usuario_id
    } = req.query;
    
    // Usar colaboradorId se fornecido e usuario_id não foi fornecido (compatibilidade)
    const usuarioIdFinal = usuario_id || colaboradorId;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Construir query base
    let query = supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (usuarioIdFinal) {
      query = query.eq('usuario_id', parseInt(usuarioIdFinal, 10));
    }

    // Compatibilidade: suporta tanto cliente_id quanto clienteId
    const clienteIdFinal = cliente_id || req.query.clienteId;
    if (clienteIdFinal) {
      query = query.eq('cliente_id', String(clienteIdFinal).trim());
    }

    if (tarefa_id) {
      query = query.eq('tarefa_id', String(tarefa_id).trim());
    }

    if (tempo_estimado_id) {
      query = query.eq('tempo_estimado_id', String(tempo_estimado_id).trim());
    }

    // Filtro de status (ativo/finalizado)
    if (ativo === 'true') {
      query = query.is('data_fim', null);
    } else if (ativo === 'false') {
      query = query.not('data_fim', 'is', null);
    }

    // Filtro de período
    // Suporta tanto data_inicio/data_fim quanto dataInicio/dataFim (compatibilidade)
    const periodoInicio = data_inicio || req.query.dataInicio;
    const periodoFim = data_fim || req.query.dataFim;
    
    if (periodoInicio && periodoFim) {
      const inicioISO = new Date(`${periodoInicio}T00:00:00.000Z`);
      const fimISO = new Date(`${periodoFim}T23:59:59.999Z`);
      const inicioStr = inicioISO.toISOString();
      const fimStr = fimISO.toISOString();

      // Registro se sobrepõe se:
      // 1. data_inicio está dentro do período, OU
      // 2. data_fim está dentro do período, OU
      // 3. registro cobre todo o período (começa antes e termina depois)
      const orConditions = [
        `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
        `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
        `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`
      ].join(',');

      query = query.or(orConditions);
    }

    // Ordenar por data_inicio (mais recentes primeiro)
    query = query.order('data_inicio', { ascending: false });

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[getRegistrosTempo] Erro ao buscar registros:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo',
        details: error.message
      });
    }

    const totalPages = limitNum > 0 ? Math.max(1, Math.ceil((count || 0) / limitNum)) : 1;

    return res.json({
      success: true,
      data: data || [],
      count: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (error) {
    console.error('[getRegistrosTempo] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar registros de tempo sem tarefa_id (debug/diagnóstico)
async function getRegistrosSemTarefa(req, res) {
  try {
    console.log('🔍 [getRegistrosSemTarefa] Buscando registros sem tarefa_id...');

    const { page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Buscar registros onde tarefa_id é null OU string vazia
    const { data: registros, count, error } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*', { count: 'exact' })
      .or('tarefa_id.is.null,tarefa_id.eq.')
      .order('data_inicio', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('[getRegistrosSemTarefa] Erro ao buscar registros:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo sem tarefa',
        details: error.message
      });
    }

    console.log(`✅ [getRegistrosSemTarefa] Encontrados ${(registros || []).length} registros sem tarefa_id`);

    const totalPages = Math.max(1, Math.ceil((count || 0) / limitNum));

    return res.json({
      success: true,
      data: registros || [],
      count: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  } catch (error) {
    console.error('[getRegistrosSemTarefa] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar registro de tempo
async function deletarRegistroTempo(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do registro é obrigatório'
      });
    }

    console.log('🗑️ Deletando registro de tempo:', id);

    // Verificar se o registro existe
    const { data: registroExistente, error: errorBusca } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (errorBusca) {
      console.error('[deletarRegistroTempo] Erro ao buscar registro:', errorBusca);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registro',
        details: errorBusca.message
      });
    }

    if (!registroExistente) {
      return res.status(404).json({
        success: false,
        error: 'Registro não encontrado'
      });
    }

    // Deletar registro
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[deletarRegistroTempo] Erro ao deletar registro:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar registro',
        details: deleteError.message
      });
    }

    console.log('✅ Registro de tempo deletado com sucesso:', id);

    return res.json({
      success: true,
      message: 'Registro de tempo deletado com sucesso!'
    });
  } catch (error) {
    console.error('[deletarRegistroTempo] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  iniciarRegistroTempo,
  finalizarRegistroTempo,
  getRegistroAtivo,
  getTempoRealizado,
  getRegistrosAtivos,
  getRegistrosPorTempoEstimado,
  getHistoricoRegistros,
  getRegistrosTempo, // Novo: endpoint genérico consolidado
  getRegistrosSemTarefa, // Novo: endpoint de debug
  atualizarRegistroTempo,
  deletarRegistroTempo
};


