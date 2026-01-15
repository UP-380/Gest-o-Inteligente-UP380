// =============================================================
// === CONTROLLER DE REGISTRO DE TEMPO ===
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Função auxiliar para buscar tipo_tarefa_id da tabela vinculados
async function buscarTipoTarefaIdPorTarefa(tarefaId) {
  try {
    if (!tarefaId) return null;

    const tarefaIdStr = String(tarefaId).trim();
    const tarefaIdNum = parseInt(tarefaIdStr, 10);

    if (isNaN(tarefaIdNum)) {
      console.warn('⚠️ tarefa_id não é um número válido:', tarefaIdStr);
      return null;
    }

    console.log('🔍 Buscando tipo_tarefa_id para tarefa_id:', tarefaIdNum, '(tipo:', typeof tarefaIdNum + ')');

    // Buscar na tabela vinculados onde há vínculo entre tarefa e tipo_tarefa
    // (sem produto, cliente ou subtarefa)
    const { data: vinculados, error: vinculadoError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_tipo_id, tarefa_id, produto_id, cliente_id, subtarefa_id')
      .eq('tarefa_id', tarefaIdNum)
      .not('tarefa_tipo_id', 'is', null)
      .is('produto_id', null)
      .is('cliente_id', null)
      .is('subtarefa_id', null)
      .limit(10);

    if (vinculadoError) {
      console.error('❌ Erro ao buscar tipo_tarefa_id do vinculado:', vinculadoError);
      console.error('❌ Detalhes do erro:', JSON.stringify(vinculadoError, null, 2));
      return null;
    }

    console.log(`📋 Vinculados encontrados: ${vinculados?.length || 0}`);
    if (vinculados && vinculados.length > 0) {
      console.log('📋 Dados dos vinculados:', JSON.stringify(vinculados, null, 2));
      // Pegar o primeiro vinculado encontrado
      const vinculado = vinculados[0];
      if (vinculado && vinculado.tarefa_tipo_id !== null && vinculado.tarefa_tipo_id !== undefined) {
        const tipoTarefaId = typeof vinculado.tarefa_tipo_id === 'number'
          ? vinculado.tarefa_tipo_id
          : parseInt(vinculado.tarefa_tipo_id, 10);
        if (!isNaN(tipoTarefaId)) {
          console.log('✅ Tipo_tarefa_id encontrado:', tipoTarefaId);
          return tipoTarefaId;
        } else {
          console.warn('⚠️ tipo_tarefa_id não é um número válido:', vinculado.tarefa_tipo_id);
        }
      }
    }

    console.warn('⚠️ Tipo_tarefa_id não encontrado para tarefa_id:', tarefaIdNum);
    return null;
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar tipo_tarefa_id:', error);
    return null;
  }
}

// POST - Iniciar registro de tempo (criar com data_inicio)
async function iniciarRegistroTempo(req, res) {
  try {
    const { tarefa_id, cliente_id, usuario_id, produto_id } = req.body;

    // Validações obrigatórias
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

    // Definir produtoId (Prioridade: Body > Tarefa > Vinculados)
    let produtoId = produto_id ? String(produto_id).trim() : null;

    // Se veio no body, logar
    if (produtoId) {
      console.log('✅ Produto_id recebido do frontend:', produtoId);
    }

    // Se NÃO veio no body, buscar no banco (Fallback)
    if (!produtoId) {
      try {
        console.log('🔍 Buscando produto_id da tarefa (fallback):', tarefa_id);
        const { data: tarefa, error: tarefaError } = await supabase
          .schema('up_gestaointeligente')
          .from('tarefa')
          .select('produto_id, id')
          .eq('id', String(tarefa_id).trim())
          .maybeSingle();

        if (tarefaError) {
          console.error('❌ Erro ao buscar produto_id da tarefa:', tarefaError);
        } else if (tarefa) {
          console.log('📋 Dados da tarefa encontrada:', JSON.stringify(tarefa, null, 2));
          if (tarefa.produto_id) {
            produtoId = String(tarefa.produto_id).trim();
            console.log('✅ Produto_id encontrado na tarefa:', produtoId);
          } else {
            console.warn('⚠️ Tarefa não possui produto_id');
          }
        } else {
          console.warn('⚠️ Tarefa não encontrada para id:', tarefa_id);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar produto_id:', error);
      }
    }

    // Se não encontrou na tabela tarefa, tentar buscar na tabela vinculados
    if (!produtoId) {
      try {
        console.log('🔍 Buscando produto_id na tabela vinculados para tarefa:', tarefa_id);
        // Converter para inteiro pois tarefa_id em vinculados geralmente é int8
        const tarefaIdInt = parseInt(String(tarefa_id).trim(), 10);

        if (!isNaN(tarefaIdInt)) {
          const { data: vinculados, error: vinculadoError } = await supabase
            .schema('up_gestaointeligente')
            .from('vinculados')
            .select('produto_id')
            .eq('tarefa_id', tarefaIdInt)
            .not('produto_id', 'is', null)
            .limit(1);

          if (vinculadoError) {
            console.error('❌ Erro ao buscar produto_id em vinculados:', vinculadoError);
          } else if (vinculados && vinculados.length > 0) {
            produtoId = String(vinculados[0].produto_id).trim();
            console.log('✅ Produto_id encontrado em vinculados:', produtoId);
          } else {
            console.log('⚠️ Nenhum vínculo de produto encontrado para esta tarefa em vinculados');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar produto_id em vinculados:', error);
      }
    }

    // Buscar tipo_tarefa_id da tabela vinculados
    let tipoTarefaId = null;
    try {
      tipoTarefaId = await buscarTipoTarefaIdPorTarefa(tarefa_id);
    } catch (error) {
      console.error('❌ Erro ao buscar tipo_tarefa_id:', error);
    }

    // Criar registro com data_inicio (timestamp atual)
    const dataInicio = new Date().toISOString();

    // Gerar UUID para o ID do registro
    const registroId = uuidv4();

    const dadosInsert = {
      id: registroId,
      tarefa_id: String(tarefa_id).trim(),
      cliente_id: String(cliente_id).trim(),
      usuario_id: parseInt(usuario_id, 10),
      data_inicio: dataInicio,
      data_fim: null,
      tempo_realizado: null,
      produto_id: produtoId || null, // Sempre incluir produto_id, mesmo se null
      tipo_tarefa_id: tipoTarefaId || null // Sempre incluir tipo_tarefa_id, mesmo se null
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
    const { usuario_id, tarefa_id, cliente_id, data } = req.query;

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

    let query = supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
      .eq('usuario_id', parseInt(usuario_id, 10))
      .eq('tarefa_id', String(tarefa_id).trim())
      .eq('cliente_id', String(cliente_id).trim())
      .is('data_fim', null);

    // Se data for fornecida, filtrar por data_inicio (apenas a parte da data, sem hora)
    if (data) {
      const dataStr = typeof data === 'string' ? data.split('T')[0] : new Date(data).toISOString().split('T')[0];
      const inicioDia = `${dataStr}T00:00:00.000Z`;
      const fimDia = `${dataStr}T23:59:59.999Z`;

      query = query
        .gte('data_inicio', inicioDia)
        .lte('data_inicio', fimDia);
    }

    const { data: registroAtivo, error } = await query.maybeSingle();

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
    const { tarefa_id, cliente_id, usuario_id, data } = req.query;

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

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id é obrigatório'
      });
    }

    // Construir query para buscar registros de tempo
    let query = supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('tempo_realizado, produto_id, tipo_tarefa_id') // Incluir produto_id e tipo_tarefa_id
      .eq('usuario_id', parseInt(usuario_id, 10))
      .eq('tarefa_id', String(tarefa_id).trim())
      .eq('cliente_id', String(cliente_id).trim());

    // Adicionar filtro por data se fornecido
    if (data) {
      // Normalizar data para formato YYYY-MM-DD
      const dataStr = data.includes('T') ? data.split('T')[0] : data;
      const dataInicio = new Date(dataStr + 'T00:00:00');
      const dataFim = new Date(dataStr + 'T23:59:59.999');

      const inicioStr = dataInicio.toISOString();
      const fimStr = dataFim.toISOString();

      // Filtrar registros que se sobrepõem ao período
      // Usar OR para garantir que encontramos TODOS os registros relevantes:
      // 1. data_inicio está dentro do período, OU
      // 2. data_fim está dentro do período, OU
      // 3. registro cobre todo o período (começa antes e termina depois), OU
      // 4. registro ativo (data_fim é NULL) que começou no período ou antes
      const orConditions = [
        `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`, // data_inicio dentro do período
        `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`, // data_fim dentro do período
        `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`, // registro cobre o período
        `and(data_inicio.lte.${fimStr},data_fim.is.null)` // registro ativo que começou no período ou antes
      ].join(',');

      query = query.or(orConditions);
    }

    query = query.not('tempo_realizado', 'is', null);

    const { data: registros, error } = await query;

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

    // Coletar IDs únicos de produto e tipo_tarefa dos registros encontrados
    const produtoIds = [...new Set((registros || []).map(r => r.produto_id).filter(Boolean))];
    const tipoTarefaIds = [...new Set((registros || []).map(r => r.tipo_tarefa_id).filter(Boolean))];

    return res.json({
      success: true,
      data: {
        tempo_realizado_ms: tempoTotalMs,
        tempo_realizado_horas: tempoTotalMs / (1000 * 60 * 60),
        registros_count: (registros || []).length,
        produto_ids: produtoIds, // IDs de produtos relacionados
        tipo_tarefa_ids: tipoTarefaIds // IDs de tipos de tarefa relacionados
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

// GET - Buscar registros de tempo individuais por critérios
// Aceita parâmetros (cliente_id, tarefa_id, responsavel_id, data) para buscar registros
async function getRegistrosPorTempoEstimado(req, res) {
  try {
    const { cliente_id, tarefa_id, responsavel_id, data, usuario_id } = req.query;

    console.log('🚀 [getRegistrosPorTempoEstimado] Recebido:', {
      query: req.query,
      url: req.url
    });

    let registros = [];
    let usuarioIdParaBusca = usuario_id ? parseInt(usuario_id, 10) : null;

    // Se temos responsavel_id (membro.id), precisamos obter o usuario_id real
    // O frontend pode estar enviando responsavel_id no campo usuario_id, então
    // sempre que houver responsavel_id, vamos validar/buscar o usuario_id correto.
    if (responsavel_id) {
      const responsavelIdNum = parseInt(String(responsavel_id).trim(), 10);

      const { data: membro, error: errorMembro } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, usuario_id')
        .eq('id', responsavelIdNum)
        .maybeSingle();

      if (!errorMembro && membro && membro.usuario_id) {
        usuarioIdParaBusca = membro.usuario_id;
        console.log(`✅ [getRegistrosPorTempoEstimado] Convertido responsavel_id ${responsavelIdNum} -> usuario_id ${usuarioIdParaBusca}`);
      } else {
        console.warn(`⚠️ [getRegistrosPorTempoEstimado] Não foi possível converter responsavel_id ${responsavelIdNum} para usuario_id`, errorMembro || 'Membro não encontrado ou sem usuario_id');
      }
    }


    // NOVA LÓGICA: Buscar usando os mesmos critérios do getTempoRealizado
    // (tarefa_id + cliente_id + usuario_id + data)
    if (tarefa_id && cliente_id && usuarioIdParaBusca) {
      console.log('[getRegistrosPorTempoEstimado] NOVA LÓGICA iniciada:', { tarefa_id, cliente_id, usuario_id: usuarioIdParaBusca, data });

      let query = supabase
        .schema('up_gestaointeligente')
        .from('registro_tempo')
        .select('*') // Selecionar tudo para debug
        .eq('usuario_id', usuarioIdParaBusca)
        .eq('tarefa_id', String(tarefa_id).trim())
        .eq('cliente_id', String(cliente_id).trim());

      // Filtrar por data se fornecido
      if (data) {
        const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
        const dataInicio = `${dataFormatada}T00:00:00`;
        const dataFim = `${dataFormatada}T23:59:59.999`;
        query = query.gte('data_inicio', dataInicio).lte('data_inicio', dataFim);
        console.log('[getRegistrosPorTempoEstimado] Filtro de data aplicado:', { dataInicio, dataFim });
      }

      // Incluir apenas registros finalizados (com tempo_realizado)
      query = query.not('tempo_realizado', 'is', null);
      query = query.order('data_inicio', { ascending: false });

      const { data: registrosPorCriterios, error: errorPorCriterios } = await query;

      if (errorPorCriterios) {
        console.error('[getRegistrosPorTempoEstimado] Erro na query:', errorPorCriterios);
      } else {
        console.log('[getRegistrosPorTempoEstimado] Registros encontrados:', registrosPorCriterios ? registrosPorCriterios.length : 0);
        if (registrosPorCriterios && registrosPorCriterios.length > 0) {
          // console.log('[getRegistrosPorTempoEstimado] Exemplo:', registrosPorCriterios[0]);
        }
      }

      if (!errorPorCriterios && registrosPorCriterios) {
        registros = registrosPorCriterios;
      }
    }
    // LÓGICA ORIGINAL: Buscar usando critérios (cliente_id, tarefa_id, responsavel_id, data)
    // Mantida para compatibilidade com outras partes do sistema
    else if (data && (tarefa_id || cliente_id || responsavel_id)) {

      const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
      const dataInicio = `${dataFormatada}T00:00:00`;
      const dataFim = `${dataFormatada}T23:59:59`;

      let query = supabase
        .schema('up_gestaointeligente')
        .from('registro_tempo')
        .select('id, tempo_realizado, data_inicio, data_fim, created_at, usuario_id, cliente_id, tarefa_id');

      // Aplicar filtros dinamicamente
      if (cliente_id) {
        query = query.eq('cliente_id', String(cliente_id).trim());
      } else {
        query = query.not('cliente_id', 'is', null);
      }

      if (tarefa_id) {
        query = query.eq('tarefa_id', String(tarefa_id).trim());
      }

      if (responsavel_id) {
        query = query.eq('usuario_id', parseInt(responsavel_id, 10));
      }

      // Filtro de data é obrigatório para esse caso de uso
      query = query.gte('data_inicio', dataInicio).lte('data_inicio', dataFim);

      query = query.order('data_inicio', { ascending: false });

      const { data: registrosPorCritérios, error: errorPorCritérios } = await query;

      if (!errorPorCritérios && registrosPorCritérios) {
        registros = registrosPorCritérios;
      }
    }

    return res.json({
      success: true,
      data: registros || [],
      count: (registros || []).length
    });
  } catch (error) {
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
      .select('id, tempo_realizado, data_inicio, data_fim, created_at, usuario_id, cliente_id, tarefa_id')
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
    const { tempo_realizado, data_inicio, data_fim, justificativa, tarefa_id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do registro é obrigatório'
      });
    }

    // Validar que pelo menos um campo foi fornecido
    if (tempo_realizado === undefined && !data_inicio && !data_fim && !tarefa_id) {
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

    // REGRA 1: Apenas registros finalizados podem ser editados
    if (!registroExistente.data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Apenas registros finalizados podem ser editados'
      });
    }

    // REGRA 6: Justificativa é obrigatória
    if (!justificativa || justificativa.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Justificativa é obrigatória para editar o registro'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    // Atualizar tarefa_id se fornecido
    if (tarefa_id) {
      dadosUpdate.tarefa_id = String(tarefa_id).trim();
    }

    // Buscar produto_id da tarefa
    try {
      const tarefaIdParaBuscar = tarefa_id || registroExistente.tarefa_id;
      let produtoIdEncontrado = null;

      if (tarefaIdParaBuscar) {
        console.log('🔍 [atualizarRegistroTempo] Tentando buscar produto_id da tarefa:', tarefaIdParaBuscar);
        const { data: tarefa, error: tarefaError } = await supabase
          .schema('up_gestaointeligente')
          .from('tarefa')
          .select('produto_id, id')
          .eq('id', String(tarefaIdParaBuscar).trim())
          .maybeSingle();

        if (tarefaError) {
          console.error('❌ [atualizarRegistroTempo] Erro ao buscar produto_id da tarefa:', tarefaError);
        } else if (tarefa) {
          console.log('📋 [atualizarRegistroTempo] Dados da tarefa encontrada:', JSON.stringify(tarefa, null, 2));
          if (tarefa.produto_id) {
            produtoIdEncontrado = String(tarefa.produto_id).trim();
            console.log('✅ [atualizarRegistroTempo] Produto_id encontrado na tarefa:', produtoIdEncontrado);
          } else {
            console.warn('⚠️ [atualizarRegistroTempo] Tarefa não possui produto_id');
          }
        } else {
          console.warn('⚠️ [atualizarRegistroTempo] Tarefa não encontrada para id:', tarefaIdParaBuscar);
        }
      }

      // Atualizar produto_id se encontrado
      if (produtoIdEncontrado) {
        dadosUpdate.produto_id = produtoIdEncontrado;
      } else if (tarefaIdParaBuscar) {
        // Se tentou buscar mas não encontrou, definir como null explicitamente
        dadosUpdate.produto_id = null;
        console.warn('⚠️ [atualizarRegistroTempo] Produto_id não encontrado');
      }
    } catch (error) {
      console.error('❌ [atualizarRegistroTempo] Erro ao buscar produto_id:', error);
    }

    // Buscar tipo_tarefa_id da tabela vinculados
    try {
      const tipoTarefaIdEncontrado = await buscarTipoTarefaIdPorTarefa(tarefaIdParaBuscar);
      if (tipoTarefaIdEncontrado !== null) {
        dadosUpdate.tipo_tarefa_id = tipoTarefaIdEncontrado;
        console.log('✅ [atualizarRegistroTempo] Tipo_tarefa_id encontrado:', tipoTarefaIdEncontrado);
      } else if (tarefaIdParaBuscar) {
        // Se tentou buscar mas não encontrou, definir como null explicitamente
        dadosUpdate.tipo_tarefa_id = null;
        console.warn('⚠️ [atualizarRegistroTempo] Tipo_tarefa_id não encontrado');
      }
    } catch (error) {
      console.error('❌ [atualizarRegistroTempo] Erro ao buscar tipo_tarefa_id:', error);
    }

    // Atualizar data_inicio se fornecida
    if (data_inicio) {
      dadosUpdate.data_inicio = new Date(data_inicio).toISOString();
    } else {
      dadosUpdate.data_inicio = registroExistente.data_inicio;
    }

    // Atualizar data_fim se fornecida
    if (data_fim) {
      dadosUpdate.data_fim = new Date(data_fim).toISOString();
    } else {
      dadosUpdate.data_fim = registroExistente.data_fim;
    }

    // Converter para Date objects para validações
    const novoInicio = new Date(dadosUpdate.data_inicio);
    const novoFim = new Date(dadosUpdate.data_fim);
    const agora = new Date();

    // REGRA 2: Validar não-futuro
    if (novoInicio > agora) {
      return res.status(400).json({
        success: false,
        error: 'Data de início não pode ser no futuro'
      });
    }

    if (novoFim > agora) {
      return res.status(400).json({
        success: false,
        error: 'Data de fim não pode ser no futuro'
      });
    }

    // REGRA 3: Validar ordem cronológica
    if (novoInicio >= novoFim) {
      return res.status(400).json({
        success: false,
        error: 'Data de início deve ser anterior à data de fim'
      });
    }

    // REGRA 4: Validar duração mínima (1 segundo)
    const duracao = novoFim.getTime() - novoInicio.getTime();
    if (duracao < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Duração mínima é de 1 segundo'
      });
    }

    // REGRA 5: Validar sobreposição com outros registros do mesmo usuário
    const { data: registrosUsuario, error: errorRegistros } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('id, data_inicio, data_fim')
      .eq('usuario_id', registroExistente.usuario_id)
      .not('id', 'eq', id) // Excluir o registro atual
      .not('data_fim', 'is', null); // Apenas registros finalizados

    if (errorRegistros) {
      console.error('[atualizarRegistroTempo] Erro ao buscar registros do usuário:', errorRegistros);
      return res.status(500).json({
        success: false,
        error: 'Erro ao validar sobreposição',
        details: errorRegistros.message
      });
    }

    // Verificar sobreposição
    if (registrosUsuario && registrosUsuario.length > 0) {
      for (const registro of registrosUsuario) {
        const outroInicio = new Date(registro.data_inicio);
        const outroFim = new Date(registro.data_fim);

        // Sobreposição: (novo_inicio < outro_fim) E (novo_fim > outro_inicio)
        const temSobreposicao = (novoInicio < outroFim) && (novoFim > outroInicio);

        if (temSobreposicao) {
          const formatarData = (date) => {
            return date.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          };

          return res.status(400).json({
            success: false,
            error: `Conflito com registro existente: ${formatarData(outroInicio)} - ${formatarData(outroFim)}`
          });
        }
      }
    }

    // Calcular tempo_realizado
    dadosUpdate.tempo_realizado = duracao;

    console.log('📝 Atualizando registro de tempo:', { id, dadosUpdate });

    // ============================================
    // SALVAR HISTÓRICO DE EDIÇÃO
    // ============================================

    // Buscar histórico anterior (se existir)
    const { data: historicoAnterior, error: errorHistorico } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo_edicoes')
      .select('*')
      .eq('registro_tempo_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorHistorico) {
      console.error('[atualizarRegistroTempo] Erro ao buscar histórico:', errorHistorico);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de edições',
        details: errorHistorico.message
      });
    }

    // Preparar dados do histórico
    const dadosHistorico = {
      registro_tempo_id: id,
      data_inicio_nova: dadosUpdate.data_inicio,
      data_fim_nova: dadosUpdate.data_fim,
      justificativa_nova: justificativa.trim()
    };

    if (historicoAnterior) {
      // CASO 2: Registro já editado anteriormente
      // Usar dados da última edição como "anterior"
      dadosHistorico.data_inicio_anterior = historicoAnterior.data_inicio_nova;
      dadosHistorico.data_fim_anterior = historicoAnterior.data_fim_nova;
      dadosHistorico.justificativa_anterior = historicoAnterior.justificativa_nova;
    } else {
      // CASO 1: Primeira edição do registro
      // Usar dados originais do registro_tempo como "anterior"
      dadosHistorico.data_inicio_anterior = registroExistente.data_inicio;
      dadosHistorico.data_fim_anterior = registroExistente.data_fim;
      dadosHistorico.justificativa_anterior = null; // Não havia justificativa antes
    }

    // Salvar histórico
    const { data: historicoSalvo, error: errorSalvarHistorico } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo_edicoes')
      .insert([dadosHistorico])
      .select()
      .single();

    if (errorSalvarHistorico) {
      console.error('[atualizarRegistroTempo] Erro ao salvar histórico:', errorSalvarHistorico);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar histórico de edição',
        details: errorSalvarHistorico.message
      });
    }

    console.log('✅ Histórico de edição salvo:', historicoSalvo.id);

    // Atualizar registro principal
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
    const { justificativa } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do registro é obrigatório'
      });
    }

    // Validar justificativa obrigatória
    if (!justificativa || justificativa.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Justificativa é obrigatória para deletar o registro'
      });
    }

    console.log('🗑️ Deletando registro de tempo:', id);

    // Buscar registro completo antes de deletar
    const { data: registroExistente, error: errorBusca } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('*')
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

    // REGRA: Apenas registros finalizados podem ser deletados
    if (!registroExistente.data_fim) {
      return res.status(400).json({
        success: false,
        error: 'Apenas registros finalizados podem ser deletados'
      });
    }

    // ============================================
    // SALVAR HISTÓRICO DE DELEÇÃO
    // ============================================

    // Buscar histórico anterior (se existir)
    const { data: historicoAnterior, error: errorHistorico } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo_edicoes')
      .select('*')
      .eq('registro_tempo_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorHistorico) {
      console.error('[deletarRegistroTempo] Erro ao buscar histórico:', errorHistorico);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de edições',
        details: errorHistorico.message
      });
    }

    // Preparar dados do histórico de deleção
    const dadosHistorico = {
      registro_tempo_id: id,
      data_inicio_nova: null, // Null indica que foi deletado
      data_fim_nova: null, // Null indica que foi deletado
      justificativa_nova: justificativa.trim(),
      deletado: true // Marcar como deletado
    };

    if (historicoAnterior) {
      // CASO 2: Registro já editado anteriormente
      // Usar dados da última edição como "anterior"
      dadosHistorico.data_inicio_anterior = historicoAnterior.data_inicio_nova;
      dadosHistorico.data_fim_anterior = historicoAnterior.data_fim_nova;
      dadosHistorico.justificativa_anterior = historicoAnterior.justificativa_nova;
    } else {
      // CASO 1: Primeira edição (deleção) do registro
      // Usar dados originais do registro_tempo como "anterior"
      dadosHistorico.data_inicio_anterior = registroExistente.data_inicio;
      dadosHistorico.data_fim_anterior = registroExistente.data_fim;
      dadosHistorico.justificativa_anterior = null; // Não havia justificativa antes
    }

    // Salvar histórico ANTES de deletar
    let historicoSalvo = null;
    const { data: historicoSalvoData, error: errorSalvarHistorico } = await supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo_edicoes')
      .insert([dadosHistorico])
      .select()
      .single();

    if (errorSalvarHistorico) {
      console.error('[deletarRegistroTempo] Erro ao salvar histórico:', errorSalvarHistorico);
      console.error('[deletarRegistroTempo] Dados tentados:', JSON.stringify(dadosHistorico, null, 2));

      // Se o erro for relacionado à coluna deletado não existir, tentar sem ela
      if (errorSalvarHistorico.message && (
        errorSalvarHistorico.message.includes('deletado') ||
        errorSalvarHistorico.message.includes('column') ||
        errorSalvarHistorico.hint && errorSalvarHistorico.hint.includes('deletado')
      )) {
        console.warn('[deletarRegistroTempo] Coluna deletado não encontrada, tentando sem ela...');
        const dadosHistoricoSemDeletado = { ...dadosHistorico };
        delete dadosHistoricoSemDeletado.deletado;

        const { data: historicoSalvo2, error: errorSalvarHistorico2 } = await supabase
          .schema('up_gestaointeligente')
          .from('registro_tempo_edicoes')
          .insert([dadosHistoricoSemDeletado])
          .select()
          .single();

        if (errorSalvarHistorico2) {
          console.error('[deletarRegistroTempo] Erro ao salvar histórico (sem deletado):', errorSalvarHistorico2);
          return res.status(500).json({
            success: false,
            error: 'Erro ao salvar histórico de deleção',
            details: errorSalvarHistorico2.message,
            hint: errorSalvarHistorico2.hint || null
          });
        }

        historicoSalvo = historicoSalvo2;
        console.log('✅ Histórico de deleção salvo (sem coluna deletado):', historicoSalvo.id);
      } else {
        return res.status(500).json({
          success: false,
          error: 'Erro ao salvar histórico de deleção',
          details: errorSalvarHistorico.message,
          hint: errorSalvarHistorico.hint || null
        });
      }
    } else {
      historicoSalvo = historicoSalvoData;
      console.log('✅ Histórico de deleção salvo:', historicoSalvo.id);
    }

    console.log('✅ Histórico de deleção salvo:', historicoSalvo.id);

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

// POST - Buscar tempo realizado total por responsável com período e filtros opcionais
// Similar ao getTempoRealizado mas aceita responsavel_id e não exige tarefa_id/cliente_id
async function getTempoRealizadoTotal(req, res) {
  try {
    const {
      responsavel_id,
      data_inicio,
      data_fim,
      tarefa_id,
      cliente_id,
      produto_id
    } = req.body;

    console.log('🔍 [TEMPO-REALIZADO-TOTAL] Busca iniciada:', { responsavel_id, data_inicio, data_fim, tarefa_id, cliente_id, produto_id });

    // Validar que responsavel_id e período são obrigatórios
    if (!responsavel_id) {
      return res.status(400).json({
        success: false,
        error: 'responsavel_id é obrigatório'
      });
    }

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'data_inicio e data_fim são obrigatórios'
      });
    }

    // Converter responsavel_id (membro.id) para usuario_id via tabela membro
    const responsavelIdNum = parseInt(String(responsavel_id).trim(), 10);
    if (isNaN(responsavelIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'responsavel_id inválido'
      });
    }

    const { data: membro, error: errorMembro } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, usuario_id')
      .eq('id', responsavelIdNum)
      .maybeSingle();

    if (errorMembro) {
      console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro ao buscar membro:', errorMembro);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membro',
        details: errorMembro.message
      });
    }

    if (!membro) {
      console.error(`❌ [TEMPO-REALIZADO-TOTAL] Membro não encontrado para responsavel_id (membro.id) = ${responsavelIdNum}`);
      return res.status(404).json({
        success: false,
        error: 'Responsável não encontrado'
      });
    }

    if (!membro.usuario_id) {
      console.error(`❌ [TEMPO-REALIZADO-TOTAL] Membro encontrado (id=${membro.id}) mas sem usuario_id associado`);
      return res.status(404).json({
        success: false,
        error: 'Responsável não possui usuario_id associado'
      });
    }

    const usuarioId = membro.usuario_id;
    console.log(`✅ [TEMPO-REALIZADO-TOTAL] responsavel_id ${responsavelIdNum} → usuario_id ${usuarioId}`);

    // Preparar filtros de período - SIMPLES como em getTempoRealizado
    // Normalizar datas para formato YYYY-MM-DD (remover parte de tempo se existir)
    const dataInicioStr = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
    const dataFimStr = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;

    console.log(`📅 [TEMPO-REALIZADO-TOTAL] Período normalizado: ${dataInicioStr} até ${dataFimStr}`);

    // Criar datas de início e fim do período (00:00:00 até 23:59:59.999)
    // Usar timezone local para garantir consistência
    const dataInicioFiltro = new Date(dataInicioStr + 'T00:00:00');
    const dataFimFiltro = new Date(dataFimStr + 'T23:59:59.999');

    const inicioStr = dataInicioFiltro.toISOString();
    const fimStr = dataFimFiltro.toISOString();

    console.log(`📅 [TEMPO-REALIZADO-TOTAL] Período ISO: ${inicioStr} até ${fimStr}`);

    // Construir query base
    // Incluir tarefa_id para poder fazer JOIN com tabela tarefa se necessário
    let query = supabase
      .schema('up_gestaointeligente')
      .from('registro_tempo')
      .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tipo_tarefa_id, tarefa_id')
      .eq('usuario_id', usuarioId);

    // Filtrar registros que se sobrepõem ao período
    // Usar OR para garantir que encontramos TODOS os registros relevantes:
    // 1. data_inicio está dentro do período, OU
    // 2. data_fim está dentro do período, OU
    // 3. registro cobre todo o período (começa antes e termina depois), OU
    // 4. registro ativo (data_fim é NULL) que começou no período ou antes
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`, // data_inicio dentro do período
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`, // data_fim dentro do período
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`, // registro cobre o período
      `and(data_inicio.lte.${fimStr},data_fim.is.null)` // registro ativo que começou no período ou antes
    ].join(',');

    query = query.or(orConditions);

    console.log(`🔍 [TEMPO-REALIZADO-TOTAL] Query base: usuario_id=${usuarioId}, período: ${inicioStr} até ${fimStr}`);

    // Filtros adicionais opcionais
    if (tarefa_id) {
      const tarefaIds = Array.isArray(tarefa_id) ? tarefa_id : [tarefa_id];
      const tarefaIdsLimpos = tarefaIds.map(id => String(id).trim()).filter(id => id.length > 0);
      if (tarefaIdsLimpos.length > 0) {
        if (tarefaIdsLimpos.length === 1) {
          query = query.eq('tarefa_id', tarefaIdsLimpos[0]);
        } else {
          query = query.in('tarefa_id', tarefaIdsLimpos);
        }
        console.log(`🔍 [TEMPO-REALIZADO-TOTAL] Filtro tarefa_id aplicado:`, tarefaIdsLimpos);
      }
    }

    if (cliente_id) {
      const clienteIds = Array.isArray(cliente_id) ? cliente_id : [cliente_id];
      const clienteIdsLimpos = clienteIds.map(id => String(id).trim()).filter(id => id.length > 0);
      if (clienteIdsLimpos.length > 0) {
        if (clienteIdsLimpos.length === 1) {
          query = query.eq('cliente_id', clienteIdsLimpos[0]);
        } else {
          query = query.in('cliente_id', clienteIdsLimpos);
        }
        console.log(`🔍 [TEMPO-REALIZADO-TOTAL] Filtro cliente_id aplicado:`, clienteIdsLimpos);
      }
    }

    // Excluir registros onde tempo_realizado é NULL
    query = query.not('tempo_realizado', 'is', null);

    const { data: registros, error: errorTempo } = await query;

    if (errorTempo) {
      console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro ao buscar registros de tempo:', errorTempo);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo',
        details: errorTempo.message
      });
    }

    console.log(`📊 [TEMPO-REALIZADO-TOTAL] ${registros?.length || 0} registros encontrados na query`);

    // Aplicar regra de exclusão: excluir registros onde cliente_id, produto_id E tipo_tarefa_id são TODOS NULL
    // REGRA: Excluir apenas quando TODAS as três colunas são NULL simultaneamente
    let registrosExcluidosPorRegra = 0;
    let registrosFiltrados = (registros || []).filter(reg => {
      const todasNull = reg.cliente_id === null && reg.produto_id === null && reg.tipo_tarefa_id === null;
      if (todasNull) {
        registrosExcluidosPorRegra++;
        return false;
      }
      return true;
    });

    console.log(`📊 [TEMPO-REALIZADO-TOTAL] ${registrosFiltrados.length} registros após regra de exclusão (${registrosExcluidosPorRegra} excluídos)`);

    // Se há filtro de produto_id, aplicar estritamente com base na coluna produto_id do registro
    // LÓGICA ATUALIZADA: Não buscar produto_id na tarefa se estiver vazio no registro.
    // Se produto_id no registro for null, ignorar o registro para este cálculo.
    if (produto_id) {
      const produtoIds = Array.isArray(produto_id) ? produto_id : [produto_id];
      // Normalizar para strings para comparação segura
      const produtoIdsLimpos = produtoIds.map(id => String(id).trim()).filter(id => id.length > 0 && id !== 'null' && id !== 'undefined');

      if (produtoIdsLimpos.length > 0) {
        console.log(`🔍 [TEMPO-REALIZADO-TOTAL] Aplicando filtro produto_id estrito (sem fallback):`, produtoIdsLimpos);

        const registrosAntesFiltro = registrosFiltrados.length;
        registrosFiltrados = registrosFiltrados.filter(reg => {
          // Se coluna produto_id é nula ou vazia, não considerar
          if (!reg.produto_id) return false;

          // Normalizar ID do registro para string e comparar
          const regProdutoId = String(reg.produto_id).trim();
          return produtoIdsLimpos.includes(regProdutoId);
        });

        console.log(`📊 [TEMPO-REALIZADO-TOTAL] ${registrosFiltrados.length} registros após filtro produto_id estrito (${registrosAntesFiltro - registrosFiltrados.length} excluídos por não terem o produto_id correspondente)`);
      }
    }

    // Calcular tempo total
    let tempoTotalMs = 0;
    registrosFiltrados.forEach(reg => {
      let tempo = Number(reg.tempo_realizado) || 0;

      // Se não tem tempo_realizado mas tem data_inicio e data_fim, calcular
      if (!tempo && reg.data_inicio) {
        const dataInicio = new Date(reg.data_inicio);
        const dataFim = reg.data_fim ? new Date(reg.data_fim) : new Date();
        tempo = Math.max(0, dataFim.getTime() - dataInicio.getTime());
      }

      // Se valor < 1 (decimal), está em horas -> converter para ms
      if (tempo > 0 && tempo < 1) {
        tempo = Math.round(tempo * 3600000);
      }

      tempoTotalMs += tempo;
    });

    const tempoTotalSegundos = (tempoTotalMs / 1000).toFixed(2);
    const tempoTotalMinutos = (tempoTotalMs / 60000).toFixed(2);
    console.log(`✅ [TEMPO-REALIZADO-TOTAL] Tempo total calculado: ${tempoTotalMs}ms (${tempoTotalSegundos}s / ${tempoTotalMinutos}min) de ${registrosFiltrados.length} registros`);

    // Log detalhado para debug
    if (registrosFiltrados.length > 0) {
      console.log(`📋 [TEMPO-REALIZADO-TOTAL] Detalhes dos registros encontrados:`);
      registrosFiltrados.slice(0, 5).forEach((reg, idx) => {
        console.log(`  [${idx + 1}] tarefa_id: ${reg.tarefa_id}, produto_id: ${reg.produto_id}, tempo: ${reg.tempo_realizado}ms`);
      });
      if (registrosFiltrados.length > 5) {
        console.log(`  ... e mais ${registrosFiltrados.length - 5} registros`);
      }
    } else {
      console.log(`⚠️ [TEMPO-REALIZADO-TOTAL] Nenhum registro encontrado após todos os filtros`);
      console.log(`   Filtros aplicados: usuario_id=${usuarioId}, período=${dataInicioStr} até ${dataFimStr}, produto_id=${produto_id || 'não especificado'}, tarefa_id=${tarefa_id || 'não especificado'}, cliente_id=${cliente_id || 'não especificado'}`);
    }

    return res.json({
      success: true,
      data: {
        tempo_realizado_ms: tempoTotalMs,
        registros_count: registrosFiltrados.length
      }
    });
  } catch (error) {
    console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro inesperado:', error);
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
  getTempoRealizadoTotal,
  getRegistrosAtivos,
  getRegistrosPorTempoEstimado,
  getHistoricoRegistros,
  getRegistrosTempo, // Novo: endpoint genérico consolidado
  getRegistrosSemTarefa, // Novo: endpoint de debug
  atualizarRegistroTempo,
  deletarRegistroTempo
};


