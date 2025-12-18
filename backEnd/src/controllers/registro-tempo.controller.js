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

module.exports = {
  iniciarRegistroTempo,
  finalizarRegistroTempo,
  getRegistroAtivo,
  getTempoRealizado,
  getRegistrosAtivos
};

