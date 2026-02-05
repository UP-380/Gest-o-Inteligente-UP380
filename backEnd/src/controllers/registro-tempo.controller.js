// =============================================================
// === CONTROLLER DE REGISTRO DE TEMPO ===
// =============================================================

const supabase = require('../config/database');
const { buscarTodosComPaginacao } = require('../services/database-utils');
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



    // Buscar na tabela vinculados onde há vínculo entre tarefa e tipo_tarefa
    // (sem produto, cliente ou subtarefa)
    const { data: vinculados, error: vinculadoError } = await supabase

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


    // Pegar o primeiro vinculado encontrado
    const vinculado = vinculados[0];
    if (vinculado && vinculado.tarefa_tipo_id !== null && vinculado.tarefa_tipo_id !== undefined) {
      const tipoTarefaId = typeof vinculado.tarefa_tipo_id === 'number'
        ? vinculado.tarefa_tipo_id
        : parseInt(vinculado.tarefa_tipo_id, 10);
      if (!isNaN(tipoTarefaId)) {

        return tipoTarefaId;
      } else {
        console.warn('⚠️ tipo_tarefa_id não é um número válido:', vinculado.tarefa_tipo_id);
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

    // [NOVO] Antes de iniciar um novo registro, devemos garantir que não existam outros registros ativos para este usuário.
    // Isso evita o erro de "atividades simultâneas" e garante que o cronômetro do front se comporte corretamente.
    const usuarioIdInt = parseInt(usuario_id, 10);

    try {
      // 1. Finalizar registros normais ativos (registro_tempo)
      const { data: ativosNormais } = await supabase
        .from('registro_tempo')
        .select('id, data_inicio')
        .eq('usuario_id', usuarioIdInt)
        .is('data_fim', null);

      if (ativosNormais && ativosNormais.length > 0) {
        const agora = new Date().toISOString();
        const agoraMs = new Date(agora).getTime();

        for (const reg of ativosNormais) {
          const inicioMs = new Date(reg.data_inicio).getTime();
          const tempoRealizado = Math.max(0, agoraMs - inicioMs);

          await supabase
            .from('registro_tempo')
            .update({
              data_fim: agora,
              tempo_realizado: tempoRealizado
            })
            .eq('id', reg.id);
        }
      }

      // 2. Finalizar registros pendentes ativos (registro_tempo_pendente - Plug Rápido)
      const { data: ativosPendentes } = await supabase
        .from('registro_tempo_pendente')
        .select('id')
        .eq('usuario_id', usuarioIdInt)
        .is('data_fim', null);

      if (ativosPendentes && ativosPendentes.length > 0) {
        const agora = new Date().toISOString();
        for (const reg of ativosPendentes) {
          await supabase
            .from('registro_tempo_pendente')
            .update({ data_fim: agora })
            .eq('id', reg.id);
        }
      }
    } catch (errAutoStop) {
      console.error('Erro ao finalizar registros anteriores automaticamente:', errAutoStop);
      // Se falhar o stop automático, não bloqueamos o início do novo, mas logamos
    }

    // Definir produtoId (Prioridade: Body > Tarefa > Vinculados)
    let produtoId = produto_id ? String(produto_id).trim() : null;

    // Se veio no body, logar
    if (produtoId) {

    }

    // Se NÃO veio no body, buscar no banco (Fallback)
    if (!produtoId) {
      try {

        const { data: tarefa, error: tarefaError } = await supabase

          .from('tarefa')
          .select('produto_id, id')
          .eq('id', String(tarefa_id).trim())
          .maybeSingle();

        if (tarefaError) {
          console.error('❌ Erro ao buscar produto_id da tarefa:', tarefaError);
        } else if (tarefa) {
          if (tarefa.produto_id) {
            produtoId = String(tarefa.produto_id).trim();
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

        // Converter para inteiro pois tarefa_id em vinculados geralmente é int8
        const tarefaIdInt = parseInt(String(tarefa_id).trim(), 10);

        if (!isNaN(tarefaIdInt)) {
          const { data: vinculados, error: vinculadoError } = await supabase

            .from('vinculados')
            .select('produto_id')
            .eq('tarefa_id', tarefaIdInt)
            .not('produto_id', 'is', null)
            .limit(1);

          if (vinculadoError) {
            console.error('❌ Erro ao buscar produto_id em vinculados:', vinculadoError);
          } else if (vinculados && vinculados.length > 0) {
            produtoId = String(vinculados[0].produto_id).trim();

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



    const { data: registroCriado, error: insertError } = await supabase

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



    const { data: registroAtualizado, error: updateError } = await supabase

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
      let tempo = Number(reg.tempo_realizado);

      // Fallback: se não tem tempo_realizado materializado mas tem datas, calcular
      if (!tempo && reg.data_inicio && reg.data_fim) {
        const dInicio = new Date(reg.data_inicio);
        const dFim = new Date(reg.data_fim);
        tempo = Math.max(0, dFim.getTime() - dInicio.getTime());
      }

      return sum + (tempo || 0);
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

// GET - Buscar todos os registros ativos de um usuário (incluindo pendentes)
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

    // 1. Buscar registros normais
    const { data: registrosNormais, error: errorNormais } = await supabase

      .from('registro_tempo')
      .select('*')
      .eq('usuario_id', usuarioIdInt)
      .is('data_fim', null)
      .order('data_inicio', { ascending: false });

    // 2. Buscar registros pendentes (Plug Rápido)
    // NOTA: Como não há FK rígida, fazemos o join manualmente
    const { data: registrosPendentesData, error: errorPendentes } = await supabase

      .from('registro_tempo_pendente')
      .select('*')
      .eq('usuario_id', usuarioIdInt)
      .is('data_fim', null);

    if (errorNormais) {
      console.error('[getRegistrosAtivos] Erro ao buscar registros normais:', errorNormais);
      throw errorNormais;
    }

    if (errorPendentes) {
      console.error('[getRegistrosAtivos] Erro ao buscar registros pendentes:', errorPendentes);
      throw errorPendentes;
    }

    let registrosPendentes = [];

    // Enriquecer registros pendentes com dados da atribuição (Manual Join)
    if (registrosPendentesData && registrosPendentesData.length > 0) {
      const idsAtribuicoes = registrosPendentesData.map(r => r.atribuicao_pendente_id);

      const { data: atribuicoes, error: errAttr } = await supabase

        .from('atribuicoes_pendentes')
        .select('id, cliente_id, produto_id, tarefa_id, comentario_colaborador')
        .in('id', idsAtribuicoes);

      if (errAttr) {
        console.error('[getRegistrosAtivos] Erro ao buscar atribuições pendentes:', errAttr);
        // Não nãfalha tudo, apenas segue sem dados extras
      } else {
        const atribuicoesMap = new Map(atribuicoes.map(a => [a.id, a]));

        registrosPendentes = registrosPendentesData.map(r => {
          const attr = atribuicoesMap.get(r.atribuicao_pendente_id);
          return {
            ...r,
            atribuicoes_pendentes: attr || null
          };
        });
      }
    } else {
      registrosPendentes = [];
    }

    // 3. Normalizar e combinar (Normalizado para o TimerAtivo.jsx)
    const normaisMapeados = (registrosNormais || []).map(r => ({
      ...r,
      is_pendente: false
    }));

    const pendentesMapeados = (registrosPendentes || []).map(r => ({
      id: r.id, // ID do registro de tempo pendente
      atribuicao_pendente_id: r.atribuicao_pendente_id,
      usuario_id: r.usuario_id,
      data_inicio: r.data_inicio,
      data_fim: null,
      cliente_id: r.atribuicoes_pendentes?.cliente_id,
      produto_id: r.atribuicoes_pendentes?.produto_id,
      tarefa_id: r.tarefa_id || r.atribuicoes_pendentes?.tarefa_id,
      tempo_realizado: null,
      is_pendente: true,
      observacao: r.atribuicoes_pendentes?.comentario_colaborador || 'Plug Rápido (Pendente)'
    }));

    // Combinar e ordenar por data_inicio decrescente (mais recente primeiro)
    const todosRegistros = [...normaisMapeados, ...pendentesMapeados].sort((a, b) => {
      return new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
    });

    return res.json({
      success: true,
      data: todosRegistros
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



    let registros = [];
    let usuarioIdParaBusca = usuario_id ? parseInt(usuario_id, 10) : null;

    // Se temos responsavel_id (membro.id), precisamos obter o usuario_id real
    // O frontend pode estar enviando responsavel_id no campo usuario_id, então
    // sempre que houver responsavel_id, vamos validar/buscar o usuario_id correto.
    if (responsavel_id) {
      const responsavelIdNum = parseInt(String(responsavel_id).trim(), 10);

      const { data: membro, error: errorMembro } = await supabase

        .from('membro')
        .select('id, usuario_id')
        .eq('id', responsavelIdNum)
        .maybeSingle();

      if (!errorMembro && membro && membro.usuario_id) {
        usuarioIdParaBusca = membro.usuario_id;

      } else {

      }
    }


    // NOVA LÓGICA: Buscar usando os mesmos critérios do getTempoRealizado
    // (tarefa_id + cliente_id + usuario_id + data)
    if (tarefa_id && cliente_id && usuarioIdParaBusca) {


      let query = supabase

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

      }

      // Incluir apenas registros finalizados (com tempo_realizado)
      query = query.not('tempo_realizado', 'is', null);
      query = query.order('data_inicio', { ascending: false });

      const { data: registrosPorCriterios, error: errorPorCriterios } = await query;

      if (errorPorCriterios) {
        console.error('Erro na query getRegistrosPorTempoEstimado:', errorPorCriterios);
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

      .from('registro_tempo')
      .select('id, tempo_realizado, data_inicio, data_fim, created_at, usuario_id, cliente_id, tarefa_id, bloqueado')
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
        error: 'Registro de tempo não encontrado'
      });
    }

    // TICKET 2: Bloqueio de Imutabilidade - REMOVIDO POR SOLICITAÇÃO DO USUÁRIO
    /*
    if (registroExistente.bloqueado) {
      console.warn(`⚠️ Tentativa de edição em registro bloqueado: ${id}`);
      return res.status(403).json({
        success: false,
        error: 'Este registro foi auditado e aprovado, não pode ser alterado.'
      });
    }
    */

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

    // REGRA 5: Ajuste Inteligente de Sobreposições (Cascading Update)
    // Em vez de bloquear, ajustamos os registros conflitantes
    const { data: registrosUsuario, error: errorRegistros } = await supabase
      .from('registro_tempo')
      .select('id, data_inicio, data_fim, usuario_id, tarefa_id')
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

    // Verificar sobreposição e realizar ajustes
    if (registrosUsuario && registrosUsuario.length > 0) {
      for (const registro of registrosUsuario) {
        const outroInicio = new Date(registro.data_inicio);
        const outroFim = new Date(registro.data_fim);

        // Sobreposição: (novo_inicio < outro_fim) E (novo_fim > outro_inicio)
        const temSobreposicao = (novoInicio < outroFim) && (novoFim > outroInicio);

        if (temSobreposicao) {
          console.log(`⚠️ [SmartEdit] Conflito detectado com registro ${registro.id}. Iniciando ajuste automático...`);

          const dadosAjuste = {};
          let motivoAjuste = '';

          // CASO A: O novo registro "empurra" o início do próximo registro
          // Ex: Novo termina 10:30, Outro começava 10:00 -> Outro passa a começar 10:30
          if (novoFim > outroInicio && novoInicio < outroInicio) {
            dadosAjuste.data_inicio = novoFim.toISOString();
            motivoAjuste = `Ajuste automático: Início alterado de ${outroInicio.toISOString()} para ${novoFim.toISOString()} devido à extensão da tarefa anterior.`;
          }

          // CASO B: O novo registro "anteceipa" o fim do registro anterior
          // Ex: Novo começa 10:00, Outro terminava 10:30 -> Outro passa a terminar 10:00
          else if (novoInicio < outroFim && novoFim > outroFim) {
            dadosAjuste.data_fim = novoInicio.toISOString();
            motivoAjuste = `Ajuste automático: Fim alterado de ${outroFim.toISOString()} para ${novoInicio.toISOString()} devido à antecipação da tarefa seguinte.`;
          }

          // CASO C: Envelopamento (Novo está DENTRO do Outro ou Outro está DENTRO do Novo)
          // Implementação simplificada: Ajustar o lado que invade menos, priorizando a integridade do Novo
          else {
            // Se a invasão for pelo início do "Outro"
            if (novoFim > outroInicio) {
              dadosAjuste.data_inicio = novoFim.toISOString();
            }
            // Se a invasão for pelo fim do "Outro"
            else {
              dadosAjuste.data_fim = novoInicio.toISOString();
            }
            motivoAjuste = 'Ajuste automático devido à sobreposição total ou parcial complexa.';
          }

          // Recalcular tempo realizado do registro ajustado
          let novoInicioAjustado = dadosAjuste.data_inicio ? new Date(dadosAjuste.data_inicio) : outroInicio;
          let novoFimAjustado = dadosAjuste.data_fim ? new Date(dadosAjuste.data_fim) : outroFim;

          // Se o ajuste resultar em duração negativa ou zero, deletar o registro vizinho?
          // Por segurança, vamos definir duração mínima de 1s ou pular (mas isso manteria sobreposição)
          // Decisão: Permitir atualização, mas se invalidar tempo, logar aviso.
          const novaDuracaoAjustada = novoFimAjustado.getTime() - novoInicioAjustado.getTime();

          if (novaDuracaoAjustada < 1000) {
            console.warn(`⚠️ [SmartEdit] Ajuste tornaria registro ${registro.id} inválido (<1s).`);
            // Opcional: Deletar registro ou impedir?
            // Por enquanto, vamos ajustar para 1s após o início (token change) ou simplesmente permitir e o sistema que lide
            dadosAjuste.tempo_realizado = 1000; // Forçar 1s mínimo visual
          } else {
            dadosAjuste.tempo_realizado = novaDuracaoAjustada;
          }

          // Realizar o UPDATE no registro conflitante
          const { error: errorAjuste } = await supabase
            .from('registro_tempo')
            .update(dadosAjuste)
            .eq('id', registro.id);

          if (errorAjuste) {
            console.error(`❌ [SmartEdit] Falha ao ajustar registro vizinho ${registro.id}:`, errorAjuste);
            continue; // Tenta ajustar os outros se houver
          }

          // Registrar no Histórico de Edições do registro vizinho
          const historicoAjuste = {
            registro_tempo_id: registro.id,
            data_inicio_nova: dadosAjuste.data_inicio || registro.data_inicio,
            data_fim_nova: dadosAjuste.data_fim || registro.data_fim,
            justificativa_nova: motivoAjuste,
            data_inicio_anterior: registro.data_inicio,
            data_fim_anterior: registro.data_fim,
            justificativa_anterior: 'Registro Original'
          };

          await supabase.from('registro_tempo_edicoes').insert([historicoAjuste]);

          console.log(`✅ [SmartEdit] Registro vizinho ${registro.id} ajustado com sucesso.`);
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

    // TICKET 2: Bloqueio de Delexão - REMOVIDO POR SOLICITAÇÃO DO USUÁRIO
    // if (registroExistente && registroExistente.bloqueado) {
    //   console.warn(`⚠️ Tentativa de exclusão em registro bloqueado: ${id}`);
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Este registro foi auditado e aprovado, não pode ser excluído.'
    //   });
    // }

    // Deletar registro
    const { error: deleteError } = await supabase

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

// POST - Buscar tempo realizado total (Agregado por entidade)
// Suporta agragação por responsavel_id, cliente_id, produto_id ou tarefa_id
async function getTempoRealizadoTotal(req, res) {
  try {
    const {
      responsavel_id,
      data_inicio,
      data_fim,
      tarefa_id,
      cliente_id,
      produto_id,
      agrupar_por // 'responsavel', 'cliente', 'produto', 'tarefa' (default: 'responsavel' se responsavel_id fornecido)
    } = req.body;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ success: false, error: 'data_inicio e data_fim são obrigatórios' });
    }

    // Normalizar datas para string YYYY-MM-DD (evita 500 se vier timestamp ou Date)
    const normalizarDataStr = (val) => {
      if (val == null) return null;
      if (typeof val === 'string') return val.includes('T') ? val.split('T')[0] : val.slice(0, 10);
      if (typeof val === 'number') return new Date(val).toISOString().split('T')[0];
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val).slice(0, 10);
    };
    const dataInicioStr = normalizarDataStr(data_inicio);
    const dataFimStr = normalizarDataStr(data_fim);
    if (!dataInicioStr || !dataFimStr) {
      return res.status(400).json({ success: false, error: 'data_inicio e data_fim inválidos' });
    }

    // Determinar chave de agrupamento
    let groupKey = agrupar_por;
    if (!groupKey) {
      if (responsavel_id) groupKey = 'responsavel';
      else if (cliente_id) groupKey = 'cliente';
      else if (produto_id) groupKey = 'produto';
      else groupKey = 'tarefa';
    }

    // Normalizar IDs de entrada para arrays (responsavel_id pode ser inteiro ou UUID)
    const responsavelIds = responsavel_id ? (Array.isArray(responsavel_id) ? responsavel_id : [responsavel_id]).map(id => String(id).trim()).filter(Boolean) : [];
    const clienteIds = cliente_id ? (Array.isArray(cliente_id) ? cliente_id : [cliente_id]).map(id => String(id).trim()).filter(Boolean) : [];
    const produtoIds = produto_id ? (Array.isArray(produto_id) ? produto_id : [produto_id]).map(id => String(id).trim()).filter(Boolean) : [];
    // tarefa_id no banco é bigint: aceitar só numéricos (evitar ID composto tipo "98_uuid_131" que quebra a query)
    const tarefaIdsRaw = tarefa_id ? (Array.isArray(tarefa_id) ? tarefa_id : [tarefa_id]).map(id => String(id).trim()).filter(Boolean) : [];
    const tarefaIds = tarefaIdsRaw.filter(id => /^\d+$/.test(id));

    // Se não houver nenhum filtro de entidade, não podemos buscar "tudo" sem perigo de sobrecarga
    if (responsavelIds.length === 0 && clienteIds.length === 0 && produtoIds.length === 0 && tarefaIds.length === 0) {
      return res.json({ success: true, data: {} });
    }

    // Mapeamento de Responsáveis (Necessário se agrupar ou filtrar por responsável)
    let usuarioParaMembro = {};
    let usuariosIdsFiltro = [];

    if (responsavelIds.length > 0) {
      const { data: membros, error: errorMembros } = await supabase
        .from('membro')
        .select('id, usuario_id')
        .in('id', responsavelIds);

      if (errorMembros) throw errorMembros;

      (membros || []).forEach(m => {
        if (m && m.usuario_id) {
          usuarioParaMembro[m.usuario_id] = m.id;
          usuariosIdsFiltro.push(m.usuario_id);
        }
      });

      // Se filtrou por responsáveis e não achou usuários, retorna vazio
      if (usuariosIdsFiltro.length === 0) {
        return res.json({ success: true, data: {} });
      }
    } else if (groupKey === 'responsavel') {
      // Se agrupa por responsável mas não filtrou, precisamos buscar o mapa reverso na iteração ou buscar todos?
      // Vamos buscar todos os membros para ter o mapa completo se necessário
      // Otimização: Se não tem filtro de responsável, buscamos o mapa apenas dos user_ids que retornarem na query?
      // Sim, faremos isso DEPOIS da query principal.
    }

    // Preparar filtros de período (dataInicioStr/dataFimStr já normalizados acima)
    const inicioStr = `${dataInicioStr}T00:00:00`;
    const fimStr = `${dataFimStr}T23:59:59.999`;

    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
      `and(data_inicio.lte.${fimStr},data_fim.is.null)`
    ].join(',');

    // ============================================
    // 1. QUERY REGISTRO_TEMPO (REALIZADO) – com paginação para considerar todos os registros
    // ============================================
    const criarQueryBuilderRealizado = () => {
      let q = supabase
        .from('registro_tempo')
        .select('tempo_realizado, data_inicio, data_fim, cliente_id, produto_id, tipo_tarefa_id, tarefa_id, usuario_id')
        .or(orConditions)
        .not('tempo_realizado', 'is', null);
      if (usuariosIdsFiltro.length > 0) q = q.in('usuario_id', usuariosIdsFiltro);
      if (clienteIds.length > 0) q = q.not('cliente_id', 'is', null);
      if (produtoIds.length > 0) q = q.in('produto_id', produtoIds);
      if (tarefaIds.length > 0) q = q.in('tarefa_id', tarefaIds);
      return q;
    };

    let registros;
    try {
      registros = await buscarTodosComPaginacao(criarQueryBuilderRealizado, { limit: 1000, logProgress: false });
    } catch (errRealizado) {
      console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro ao buscar registro_tempo paginado:', errRealizado);
      throw errRealizado;
    }

    if (clienteIds.length > 0 && registros && registros.length > 0) {
      const clienteIdsNorm = clienteIds.map(c => String(c).trim().toLowerCase());
      registros = registros.filter(reg => {
        const ids = String(reg.cliente_id || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return ids.some(id => clienteIdsNorm.includes(id));
      });
    }

    // Se agrupar por responsável e não tínhamos filtro, precisamos buscar os membros agora
    if (groupKey === 'responsavel' && responsavelIds.length === 0 && registros && registros.length > 0) {
      const uIdsPresentes = [...new Set(registros.map(r => r.usuario_id))];
      if (uIdsPresentes.length > 0) {
        const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', uIdsPresentes);
        membros?.forEach(m => { if (m.usuario_id) usuarioParaMembro[m.usuario_id] = m.id; });
      }
    }

    // Inicializar Resultados Map
    const resultados = {}; // Key -> { tempo_realizado_ms, tempo_pendente_ms, registros_count }

    // Helper para inicializar chave
    const initKey = (key) => {
      if (!resultados[key]) resultados[key] = { tempo_realizado_ms: 0, tempo_pendente_ms: 0, registros_count: 0 };
    };

    // Helper para obter chave do registro com base no agrupamento
    const getRecordKey = (reg) => {
      if (groupKey === 'cliente') return reg.cliente_id;
      if (groupKey === 'produto') return reg.produto_id;
      if (groupKey === 'tarefa') return reg.tarefa_id;
      if (groupKey === 'responsavel') return usuarioParaMembro[reg.usuario_id];
      return null;
    };

    // Processar Realizado
    (registros || []).forEach(reg => {
      // Regra de exclusão (todas null)
      if (reg.cliente_id === null && reg.produto_id === null && reg.tipo_tarefa_id === null) return;

      const key = getRecordKey(reg);
      if (!key) return; // Ignorar se não conseguir mapear (ex: usuario sem membro, ou cliente null na task)

      initKey(key);

      let tempo = Number(reg.tempo_realizado) || 0;
      if (!tempo && reg.data_inicio) {
        const d1 = new Date(reg.data_inicio);
        const d2 = reg.data_fim ? new Date(reg.data_fim) : new Date();
        tempo = Math.max(0, d2.getTime() - d1.getTime());
      }
      if (tempo > 0 && tempo < 1) tempo = Math.round(tempo * 3600000);

      resultados[key].tempo_realizado_ms += tempo;
      resultados[key].registros_count++;
    });

    // ============================================
    // 2. QUERY PENDENTES (EM ANDAMENTO) – com paginação para considerar todos
    // ============================================
    const criarQueryBuilderPendentes = () => {
      let q = supabase
        .from('registro_tempo_pendente')
        .select('data_inicio, data_fim, usuario_id, tarefa_id, atribuicao_pendente_id')
        .or(orConditions);
      if (usuariosIdsFiltro.length > 0) q = q.in('usuario_id', usuariosIdsFiltro);
      if (tarefaIds.length > 0) q = q.in('tarefa_id', tarefaIds);
      return q;
    };

    let pendentes;
    try {
      pendentes = await buscarTodosComPaginacao(criarQueryBuilderPendentes, { limit: 1000, logProgress: false });
    } catch (errPendentes) {
      console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro ao buscar registro_tempo_pendente paginado:', errPendentes);
      throw errPendentes;
    }

    if (pendentes && pendentes.length > 0) {
      let pendentesAptos = pendentes;
      const attrIds = [...new Set(pendentes.map(p => p.atribuicao_pendente_id).filter(Boolean))];
      const attrsMap = new Map();

      // Se precisarmos filtrar ou agrupar por cliente/produto, precisamos dos dados da atribuição
      if (attrIds.length > 0 && (clienteIds.length > 0 || produtoIds.length > 0 || groupKey === 'cliente' || groupKey === 'produto')) {
        const { data: attrs } = await supabase.from('atribuicoes_pendentes').select('id, cliente_id, produto_id').in('id', attrIds);
        attrs?.forEach(a => attrsMap.set(String(a.id), a));

        // Filtrar se houver filtros de cliente/produto
        if (clienteIds.length > 0 || produtoIds.length > 0) {
          pendentesAptos = pendentes.filter(p => {
            const attr = attrsMap.get(String(p.atribuicao_pendente_id));
            // Se não tem atribuição e estamos apenas filtrando:
            // Se o filtro é estrito, talvez devêssemos ignorar. Mas Plug Rapido pode ser órfão de cliente? Difícil.
            // Vamos assumir que se o filtro existe, precisamos validar.
            if (!attr) return false;

            if (clienteIds.length > 0 && !clienteIds.includes(String(attr.cliente_id || '').trim())) return false;
            if (produtoIds.length > 0 && !produtoIds.includes(String(attr.produto_id || '').trim())) return false;
            return true;
          });
        }
      }

      // Processar Pendentes
      // Se agrupar por responsável e não tinha filtro, garantir mapa
      if (groupKey === 'responsavel' && responsavelIds.length === 0) {
        const uIdsPendentes = [...new Set(pendentesAptos.map(p => p.usuario_id))];
        const uIdsFaltantes = uIdsPendentes.filter(id => !usuarioParaMembro.hasOwnProperty(id));
        if (uIdsFaltantes.length > 0) {
          const { data: membros } = await supabase.from('membro').select('id, usuario_id').in('usuario_id', uIdsFaltantes);
          membros?.forEach(m => { if (m.usuario_id) usuarioParaMembro[m.usuario_id] = m.id; });
        }
      }

      pendentesAptos.forEach(p => {
        let key = null;

        if (groupKey === 'responsavel') {
          key = usuarioParaMembro[p.usuario_id];
        } else if (groupKey === 'tarefa') {
          key = p.tarefa_id;
        } else if (groupKey === 'cliente' || groupKey === 'produto') {
          const attr = attrsMap.get(String(p.atribuicao_pendente_id));
          if (attr) {
            key = groupKey === 'cliente' ? attr.cliente_id : attr.produto_id;
          }
          // Se não tiver atribuição, tentamos inferir? Não, impossível para cliente/produto sem join.
        }

        if (!key) return;

        initKey(key);

        const d1 = new Date(p.data_inicio).getTime();
        const d2 = p.data_fim ? new Date(p.data_fim).getTime() : Date.now();
        resultados[key].tempo_pendente_ms += Math.max(0, d2 - d1);
      });
    }

    return res.json({
      success: true,
      data: resultados
    });

  } catch (error) {
    console.error('❌ [TEMPO-REALIZADO-TOTAL] Erro inesperado:', error);
    console.error('❌ [TEMPO-REALIZADO-TOTAL] Stack:', error.stack);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
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


