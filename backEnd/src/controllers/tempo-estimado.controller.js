// =============================================================
// === CONTROLLER DE TEMPO ESTIMADO ===
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { buscarTodosComPaginacao } = require('../services/database-utils');

// Função auxiliar para recalcular período do histórico baseado nas tarefas restantes
async function recalcularPeriodoHistorico(agrupador_id) {
  try {
    if (!agrupador_id) return;

    // Buscar histórico associado ao agrupador
    const { data: historico, error: historicoError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .select('id')
      .eq('agrupador_id', agrupador_id)
      .maybeSingle();

    if (historicoError || !historico) {
      console.warn('⚠️ Histórico não encontrado para agrupador:', agrupador_id);
      return;
    }

    // Buscar todas as tarefas restantes do agrupamento
    const { data: registrosRestantes, error: registrosError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('data')
      .eq('agrupador_id', agrupador_id)
      .order('data', { ascending: true });

    if (registrosError) {
      console.error('❌ Erro ao buscar registros restantes:', registrosError);
      return;
    }

    // Se não há registros restantes, não atualizar (ou poderia deletar o histórico)
    if (!registrosRestantes || registrosRestantes.length === 0) {
      console.warn('⚠️ Nenhum registro restante para o agrupador:', agrupador_id);
      return;
    }

    // Calcular data mínima e máxima
    const datas = registrosRestantes
      .map(reg => reg.data ? reg.data.split('T')[0] : null)
      .filter(Boolean)
      .sort();

    if (datas.length === 0) return;

    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    // Atualizar histórico com novo período
    const { error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('historico_atribuicoes')
      .update({
        data_inicio: dataInicio,
        data_fim: dataFim,
        updated_at: new Date().toISOString()
      })
      .eq('id', historico.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar período do histórico:', updateError);
    } else {
      console.log(`✅ Período do histórico atualizado: ${dataInicio} - ${dataFim}`);
    }
  } catch (error) {
    console.error('❌ Erro inesperado ao recalcular período:', error);
  }
}
const https = require('https');

// Cache de feriados por ano
const feriadosCache = {};

// Função para buscar feriados da API Brasil API
async function buscarFeriados(ano) {
  // Verificar cache primeiro
  if (feriadosCache[ano]) {
    return feriadosCache[ano];
  }

  try {
    return new Promise((resolve, reject) => {
      const url = `https://brasilapi.com.br/api/feriados/v1/${ano}`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const feriados = JSON.parse(data);
            const feriadosMap = {};
            feriados.forEach(feriado => {
              feriadosMap[feriado.date] = feriado.name;
            });
            // Armazenar no cache
            feriadosCache[ano] = feriadosMap;
            resolve(feriadosMap);
          } catch (error) {
            console.error('Erro ao processar resposta de feriados:', error);
            resolve({});
          }
        });
      }).on('error', (error) => {
        console.error('Erro ao buscar feriados:', error);
        resolve({}); // Retornar objeto vazio em caso de erro
      });
    });
  } catch (error) {
    console.error('Erro ao buscar feriados:', error);
    return {};
  }
}

// Função para verificar se uma data é feriado
async function isHoliday(dateStr, feriadosMap = null) {
  try {
    const date = new Date(dateStr);
    const ano = date.getFullYear();
    const mes = date.getMonth();
    const dia = date.getDate();
    const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
    const anoFormatado = String(ano);
    const mesFormatado = String(mes + 1).padStart(2, '0');
    const diaFormatado = String(dia).padStart(2, '0');
    const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
    
    // Se não foi passado o mapa de feriados, buscar
    let feriados = feriadosMap;
    if (!feriados) {
      feriados = await buscarFeriados(ano);
    }
    
    return feriados[dateKey] !== undefined;
  } catch (error) {
    console.error('Erro ao verificar se é feriado:', error);
    return false;
  }
}

// POST - Criar novo(s) registro(s) de tempo estimado
async function criarTempoEstimado(req, res) {
  try {
    console.log('📥 Recebendo requisição para criar tempo estimado');
    console.log('📦 Body recebido:', JSON.stringify(req.body, null, 2));
    
    const { cliente_id, produto_ids, tarefa_ids, tarefas, data_inicio, data_fim, tempo_estimado_dia, responsavel_id, incluir_finais_semana = true, incluir_feriados = true } = req.body;

    // Validações
    if (!cliente_id) {
      console.error('❌ Validação falhou: cliente_id é obrigatório');
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

    // Suportar tanto o formato antigo (tarefa_ids + tempo_estimado_dia) quanto o novo (tarefas array)
    let tarefasComTempo = [];
    if (tarefas && Array.isArray(tarefas) && tarefas.length > 0) {
      // Novo formato: array de objetos { tarefa_id, tempo_estimado_dia }
      tarefasComTempo = tarefas;
    } else if (tarefa_ids && Array.isArray(tarefa_ids) && tarefa_ids.length > 0 && tempo_estimado_dia) {
      // Formato antigo: array de IDs + tempo único
      tarefasComTempo = tarefa_ids.map(tarefaId => ({
        tarefa_id: String(tarefaId).trim(),
        tempo_estimado_dia: parseInt(tempo_estimado_dia, 10)
      }));
    } else {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer "tarefas" (array de objetos com tarefa_id e tempo_estimado_dia) ou "tarefa_ids" + "tempo_estimado_dia"'
      });
    }

    // Validar que todas as tarefas têm tempo estimado
    const tarefasSemTempo = tarefasComTempo.filter(t => !t.tarefa_id || !t.tempo_estimado_dia || t.tempo_estimado_dia <= 0);
    if (tarefasSemTempo.length > 0) {
      console.error('❌ Validação falhou: tarefas sem tempo válido:', tarefasSemTempo);
      return res.status(400).json({
        success: false,
        error: 'Todas as tarefas devem ter um tempo estimado válido (maior que zero)',
        detalhes: tarefasSemTempo
      });
    }
    
    console.log('✅ Validações passaram. Tarefas com tempo:', tarefasComTempo.length);

    const tarefaIdsArray = tarefasComTempo.map(t => String(t.tarefa_id).trim());

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
    const gerarDatasDoPeriodo = async (inicioStr, fimStr, incluirFinaisSemana = true, incluirFeriados = true) => {
      const inicio = new Date(inicioStr + 'T00:00:00');
      const fim = new Date(fimStr + 'T00:00:00');
      const datas = [];
      
      // Garantir que fim seja maior ou igual a início
      if (fim < inicio) {
        return [];
      }
      
      // Buscar feriados para todos os anos no período
      const anosNoPeriodo = new Set();
      const dataAtualTemp = new Date(inicio);
      while (dataAtualTemp <= fim) {
        anosNoPeriodo.add(dataAtualTemp.getFullYear());
        dataAtualTemp.setFullYear(dataAtualTemp.getFullYear() + 1);
      }
      
      // Buscar feriados para todos os anos
      const feriadosPorAno = {};
      for (const ano of anosNoPeriodo) {
        feriadosPorAno[ano] = await buscarFeriados(ano);
      }
      
      const dataAtual = new Date(inicio);
      let feriadosPulados = 0;
      let finaisSemanaPulados = 0;
      
      while (dataAtual <= fim) {
        // Verificar se é final de semana (sábado = 6, domingo = 0)
        // Usar getFullYear, getMonth, getDate para garantir que estamos usando a data local correta
        const ano = dataAtual.getFullYear();
        const mes = dataAtual.getMonth();
        const dia = dataAtual.getDate();
        // Criar uma nova data com UTC para garantir consistência no cálculo do dia da semana
        const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
        const diaDaSemana = dataParaCalcular.getUTCDay();
        const isWeekend = diaDaSemana === 0 || diaDaSemana === 6;
        
        // Verificar se é feriado
        const anoFormatado = String(ano);
        const mesFormatado = String(mes + 1).padStart(2, '0');
        const diaFormatado = String(dia).padStart(2, '0');
        const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
        const isHolidayDay = feriadosPorAno[ano] && feriadosPorAno[ano][dateKey] !== undefined;
        const nomeFeriado = isHolidayDay ? feriadosPorAno[ano][dateKey] : null;
        
        // Se não deve incluir finais de semana e é final de semana, pular
        if (!incluirFinaisSemana && isWeekend) {
          finaisSemanaPulados++;
          dataAtual.setDate(dataAtual.getDate() + 1);
          continue;
        }
        
        // Se não deve incluir feriados e é feriado, pular
        if (!incluirFeriados && isHolidayDay) {
          feriadosPulados++;
          console.log(`📅 [TEMPO-ESTIMADO] Pulando feriado: ${dateKey} - ${nomeFeriado} (incluirFeriados=${incluirFeriados})`);
          dataAtual.setDate(dataAtual.getDate() + 1);
          continue;
        }
        
        const dataFormatada = `${anoFormatado}-${mesFormatado}-${diaFormatado}T00:00:00`;
        datas.push(dataFormatada);
        
        // Avançar para o próximo dia
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      
      if (feriadosPulados > 0) {
        console.log(`📅 [TEMPO-ESTIMADO] Total de ${feriadosPulados} feriado(s) pulado(s)`);
      }
      if (finaisSemanaPulados > 0) {
        console.log(`📅 [TEMPO-ESTIMADO] Total de ${finaisSemanaPulados} final(is) de semana pulado(s)`);
      }
      
      return datas;
    };

    // Gerar todas as datas do período (filtrar finais de semana e feriados se necessário)
    // Se incluir_finais_semana não foi enviado, assume true (compatibilidade)
    // Se foi enviado explicitamente como false, usa false
    // IMPORTANTE: Se o parâmetro não existir no body, assume true. Se existir (mesmo que false), usa o valor.
    const incluirFinaisSemana = incluir_finais_semana === undefined ? true : Boolean(incluir_finais_semana);
    const incluirFeriados = incluir_feriados === undefined ? true : Boolean(incluir_feriados);
    console.log('📅 [TEMPO-ESTIMADO] Parâmetro incluir_finais_semana recebido:', incluir_finais_semana, 'tipo:', typeof incluir_finais_semana);
    console.log('📅 [TEMPO-ESTIMADO] Parâmetro incluir_feriados recebido:', incluir_feriados, 'tipo:', typeof incluir_feriados);
    console.log('📅 [TEMPO-ESTIMADO] Valor processado incluirFinaisSemana:', incluirFinaisSemana);
    console.log('📅 [TEMPO-ESTIMADO] Valor processado incluirFeriados:', incluirFeriados);
    console.log('📅 [TEMPO-ESTIMADO] Período:', data_inicio, 'até', data_fim);
    const datasDoPeriodo = await gerarDatasDoPeriodo(data_inicio, data_fim, incluirFinaisSemana, incluirFeriados);
    console.log('📅 [TEMPO-ESTIMADO] Total de datas geradas:', datasDoPeriodo.length);
    if (datasDoPeriodo.length > 0 && datasDoPeriodo.length <= 5) {
      console.log('📅 [TEMPO-ESTIMADO] Datas geradas:', datasDoPeriodo);
    } else if (datasDoPeriodo.length > 5) {
      console.log('📅 [TEMPO-ESTIMADO] Primeiras 5 datas:', datasDoPeriodo.slice(0, 5));
    }
    
    if (datasDoPeriodo.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Data fim deve ser maior ou igual à data início'
      });
    }

    // Verificar duplicatas: não pode ter o mesmo conjunto de tarefas para o mesmo cliente + responsável + produto + período
    const verificarDuplicatas = async () => {
      // Para cada produto, verificar se já existe um agrupamento com exatamente as mesmas tarefas
      for (const produtoId of produto_ids) {
        // Buscar todos os registros existentes para este cliente + produto + responsável
        const { data: registrosExistentes, error: errorBusca } = await supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado')
          .select('agrupador_id, data, cliente_id, produto_id, tarefa_id, responsavel_id')
          .eq('cliente_id', String(cliente_id).trim())
          .eq('produto_id', String(produtoId).trim())
          .eq('responsavel_id', String(responsavel_id).trim());
        
        if (errorBusca) {
          console.error('Erro ao verificar duplicatas:', errorBusca);
          continue;
        }
        
        if (registrosExistentes && registrosExistentes.length > 0) {
          // Agrupar por agrupador_id
          const gruposExistentes = new Map();
          registrosExistentes.forEach(reg => {
            const agrupadorId = reg.agrupador_id || 'sem-grupo';
            if (!gruposExistentes.has(agrupadorId)) {
              gruposExistentes.set(agrupadorId, {
                tarefas: new Set(),
                datas: []
              });
            }
            gruposExistentes.get(agrupadorId).tarefas.add(String(reg.tarefa_id).trim());
            gruposExistentes.get(agrupadorId).datas.push(reg.data);
          });
          
          // Criar conjunto de tarefas solicitadas (normalizado)
          const tarefasSolicitadas = new Set(tarefaIdsArray.map(id => String(id).trim()));
          
          // Verificar cada grupo existente
          for (const [agrupadorId, grupo] of gruposExistentes) {
            // Verificar se o conjunto de tarefas é exatamente o mesmo
            const tarefasExistentes = grupo.tarefas;
            const temMesmasTarefas = 
              tarefasSolicitadas.size === tarefasExistentes.size &&
              [...tarefasSolicitadas].every(t => tarefasExistentes.has(t));
            
            if (temMesmasTarefas) {
              // Verificar se o período se sobrepõe
              const datasGrupo = grupo.datas.sort();
              if (datasGrupo.length > 0) {
                const grupoInicio = datasGrupo[0].split('T')[0];
                const grupoFim = datasGrupo[datasGrupo.length - 1].split('T')[0];
                
                // Verificar sobreposição: dois períodos se sobrepõem se (inicio1 <= fim2) && (fim1 >= inicio2)
                const inicioGrupo = new Date(grupoInicio);
                const fimGrupo = new Date(grupoFim);
                const inicioSolicitado = new Date(data_inicio);
                const fimSolicitado = new Date(data_fim);
                
                // Normalizar para comparar apenas datas (sem hora)
                inicioGrupo.setHours(0, 0, 0, 0);
                fimGrupo.setHours(23, 59, 59, 999);
                inicioSolicitado.setHours(0, 0, 0, 0);
                fimSolicitado.setHours(23, 59, 59, 999);
                
                if (inicioGrupo <= fimSolicitado && fimGrupo >= inicioSolicitado) {
                  return {
                    duplicado: true,
                    produto_id: produtoId,
                    tarefas: Array.from(tarefasSolicitadas),
                    periodo_existente: `${grupoInicio} até ${grupoFim}`,
                    periodo_solicitado: `${data_inicio} até ${data_fim}`
                  };
                }
              }
            }
          }
        }
      }
      
      return { duplicado: false };
    };
    
    const resultadoDuplicatas = await verificarDuplicatas();
    if (resultadoDuplicatas.duplicado) {
      return res.status(400).json({
        success: false,
        error: `Não é possível criar atribuições duplicadas. Já existe um registro para o mesmo conjunto de tarefas, cliente, responsável, produto e período sobreposto.`,
        detalhes: {
          produto_id: resultadoDuplicatas.produto_id,
          tarefas: resultadoDuplicatas.tarefas,
          periodo_existente: resultadoDuplicatas.periodo_existente,
          periodo_solicitado: resultadoDuplicatas.periodo_solicitado
        }
      });
    }

    // Gerar um ID único para agrupar todos os registros desta delegação
    const agrupador_id = uuidv4();

    // Criar todas as combinações: produto x tarefa x data (um registro para cada dia)
    const registrosParaInserir = [];
    
    // Criar mapa de tempo por tarefa para acesso rápido
    const tempoPorTarefa = new Map();
    tarefasComTempo.forEach(t => {
      tempoPorTarefa.set(String(t.tarefa_id).trim(), parseInt(t.tempo_estimado_dia, 10));
    });
    
    produto_ids.forEach(produtoId => {
      tarefaIdsArray.forEach(tarefaId => {
        const tempoEstimado = tempoPorTarefa.get(String(tarefaId).trim());
        if (!tempoEstimado || tempoEstimado <= 0) {
          console.warn(`⚠️ Tarefa ${tarefaId} não tem tempo estimado válido, pulando...`);
          return;
        }
        datasDoPeriodo.forEach(dataDoDia => {
          registrosParaInserir.push({
            cliente_id: String(cliente_id).trim(),
            produto_id: String(produtoId).trim(),
            tarefa_id: String(tarefaId).trim(),
            data: dataDoDia,
            tempo_estimado_dia: tempoEstimado, // em milissegundos
            responsavel_id: String(responsavel_id).trim(),
            agrupador_id: agrupador_id
          });
        });
      });
    });

    console.log(`📝 Criando ${registrosParaInserir.length} registro(s) de tempo estimado`);
    console.log(`   - ${produto_ids.length} produto(s) × ${tarefaIdsArray.length} tarefa(s) × ${datasDoPeriodo.length} dia(s) = ${registrosParaInserir.length} registro(s)`);
    console.log(`   - Tempos estimados por tarefa:`);
    tarefasComTempo.forEach(t => {
      const horas = Math.floor(t.tempo_estimado_dia / (1000 * 60 * 60));
      const minutos = Math.round((t.tempo_estimado_dia % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`     * Tarefa ${t.tarefa_id}: ${horas}h ${minutos}min`);
    });
    
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

    // Salvar histórico da atribuição
    try {
      const usuarioId = req.session?.usuario?.id || null;
      if (usuarioId) {
        // Buscar membro_id a partir do usuario_id
        let membroIdCriador = null;
        try {
          const { data: membro, error: membroError } = await supabase
            .schema('up_gestaointeligente')
            .from('membro')
            .select('id')
            .eq('usuario_id', String(usuarioId).trim())
            .maybeSingle();

          if (!membroError && membro) {
            membroIdCriador = String(membro.id).trim();
          }
        } catch (error) {
          console.error('⚠️ Erro ao buscar membro_id do usuário:', error);
        }

        // Se encontrou o membro_id, salvar histórico
        if (membroIdCriador) {
          const historicoData = {
            agrupador_id: agrupador_id,
            cliente_id: String(cliente_id).trim(),
            responsavel_id: String(responsavel_id).trim(),
            usuario_criador_id: membroIdCriador,
            data_inicio: data_inicio,
            data_fim: data_fim,
            produto_ids: produto_ids.map(id => String(id).trim()),
            tarefas: tarefasComTempo
          };

          const { error: historicoError } = await supabase
            .schema('up_gestaointeligente')
            .from('historico_atribuicoes')
            .insert([historicoData]);

          if (historicoError) {
            console.error('⚠️ Erro ao salvar histórico de atribuição:', historicoError);
            // Não falhar a requisição se o histórico não for salvo
          } else {
            console.log('✅ Histórico de atribuição salvo com sucesso');
          }
        } else {
          console.warn('⚠️ Não foi possível encontrar membro_id para o usuário, histórico não será salvo');
        }
      }
    } catch (historicoError) {
      console.error('⚠️ Erro ao salvar histórico de atribuição:', historicoError);
      // Não falhar a requisição se o histórico não for salvo
    }

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
    // Processar parâmetros que podem vir como array (quando múltiplos valores são passados)
    const processarParametroArray = (param) => {
      if (!param) return null;
      if (Array.isArray(param)) {
        return param.filter(Boolean);
      }
      if (typeof param === 'string' && param.includes(',')) {
        return param.split(',').map(id => id.trim()).filter(Boolean);
      }
      // Valor único - retornar como array
      return [String(param).trim()].filter(Boolean);
    };
    
    console.log('🔍 [TEMPO-ESTIMADO] req.query completo:', JSON.stringify(req.query, null, 2));
    console.log('🔍 [TEMPO-ESTIMADO] req.query.responsavel_id:', req.query.responsavel_id);
    console.log('🔍 [TEMPO-ESTIMADO] Tipo:', typeof req.query.responsavel_id);
    console.log('🔍 [TEMPO-ESTIMADO] É array?', Array.isArray(req.query.responsavel_id));
    
    const { 
      page = 1, 
      limit = 20,
      data = null,
      data_inicio = null,
      data_fim = null
    } = req.query;
    
    // Processar IDs que podem vir como array
    const cliente_id = processarParametroArray(req.query.cliente_id);
    const produto_id = processarParametroArray(req.query.produto_id);
    const tarefa_id = processarParametroArray(req.query.tarefa_id);
    const responsavel_id = processarParametroArray(req.query.responsavel_id);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    // Agora cliente_id, produto_id, tarefa_id e responsavel_id já são arrays ou null
    if (cliente_id && cliente_id.length > 0) {
      const clienteIdsLimpos = cliente_id.map(id => String(id).trim()).filter(Boolean);
      if (clienteIdsLimpos.length === 1) {
        query = query.eq('cliente_id', clienteIdsLimpos[0]);
      } else if (clienteIdsLimpos.length > 1) {
        query = query.in('cliente_id', clienteIdsLimpos);
      }
    }

    if (produto_id && produto_id.length > 0) {
      const produtoIdsLimpos = produto_id.map(id => String(id).trim()).filter(Boolean);
      if (produtoIdsLimpos.length === 1) {
        query = query.eq('produto_id', produtoIdsLimpos[0]);
      } else if (produtoIdsLimpos.length > 1) {
        query = query.in('produto_id', produtoIdsLimpos);
      }
    }

    if (tarefa_id && tarefa_id.length > 0) {
      const tarefaIdsLimpos = tarefa_id.map(id => String(id).trim()).filter(Boolean);
      if (tarefaIdsLimpos.length === 1) {
        query = query.eq('tarefa_id', tarefaIdsLimpos[0]);
      } else if (tarefaIdsLimpos.length > 1) {
        query = query.in('tarefa_id', tarefaIdsLimpos);
      }
    }

    if (responsavel_id && responsavel_id.length > 0) {
      const responsavelIdsLimpos = responsavel_id.map(id => String(id).trim()).filter(Boolean);
      console.log('🔍 [TEMPO-ESTIMADO] Filtrando por responsavel_id:', responsavelIdsLimpos);
      if (responsavelIdsLimpos.length === 1) {
        query = query.eq('responsavel_id', responsavelIdsLimpos[0]);
      } else if (responsavelIdsLimpos.length > 1) {
        query = query.in('responsavel_id', responsavelIdsLimpos);
      }
    }

    // Filtro por data específica
    if (data) {
      const dataFormatada = data.includes('T') ? data : `${data}T00:00:00`;
      query = query.eq('data', dataFormatada);
    }

    // Filtro por intervalo de datas - busca registros cujo período (agrupado) se sobrepõe ao período filtrado
    let aplicarFiltroPeriodo = false;
    let periodoInicioFiltro = null;
    let periodoFimFiltro = null;
    
    if (data_inicio && data_fim) {
      aplicarFiltroPeriodo = true;
      periodoInicioFiltro = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      periodoFimFiltro = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      // Não aplicar filtro direto na query - vamos buscar todos e filtrar por agrupamento depois
    } else if (data_inicio) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      query = query.gte('data', inicioFormatado);
    } else if (data_fim) {
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      query = query.lte('data', fimFormatado);
    }

    // Se não há filtro de período completo, aplicar paginação normalmente
    // Se há filtro de período, precisamos buscar todos os registros primeiro para agrupar
    let queryFinal = query.order('data', { ascending: false });
    
    if (!aplicarFiltroPeriodo) {
      // Aplicar paginação normalmente
      queryFinal = queryFinal.range(offset, offset + limitNum - 1);
    }

    const { data: dadosTempoEstimado, error, count } = await queryFinal;

    if (error) {
      console.error('❌ Erro ao buscar tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo estimado',
        details: error.message
      });
    }

    // Se há filtro de período, filtrar agrupamentos cujo período se sobrepõe
    let dadosFiltrados = dadosTempoEstimado || [];
    let totalFiltrado = count || 0;
    
    if (aplicarFiltroPeriodo) {
      // Primeiro, buscar TODOS os agrupadores únicos e calcular min/max de data
      // Usar paginação automática para buscar todos os registros em lotes de 1000
      const criarQueryAgrupadores = () => {
        let queryAgrupadores = supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado')
          .select('agrupador_id, data');
        
        // Aplicar outros filtros básicos (mas não filtro de data)
        // Agora cliente_id, produto_id, tarefa_id e responsavel_id já são arrays ou null
        if (cliente_id && cliente_id.length > 0) {
          const clienteIdsLimpos = cliente_id.map(id => String(id).trim()).filter(Boolean);
          if (clienteIdsLimpos.length === 1) {
            queryAgrupadores = queryAgrupadores.eq('cliente_id', clienteIdsLimpos[0]);
          } else if (clienteIdsLimpos.length > 1) {
            queryAgrupadores = queryAgrupadores.in('cliente_id', clienteIdsLimpos);
          }
        }
        if (produto_id && produto_id.length > 0) {
          const produtoIdsLimpos = produto_id.map(id => String(id).trim()).filter(Boolean);
          if (produtoIdsLimpos.length === 1) {
            queryAgrupadores = queryAgrupadores.eq('produto_id', produtoIdsLimpos[0]);
          } else if (produtoIdsLimpos.length > 1) {
            queryAgrupadores = queryAgrupadores.in('produto_id', produtoIdsLimpos);
          }
        }
        if (tarefa_id && tarefa_id.length > 0) {
          const tarefaIdsLimpos = tarefa_id.map(id => String(id).trim()).filter(Boolean);
          if (tarefaIdsLimpos.length === 1) {
            queryAgrupadores = queryAgrupadores.eq('tarefa_id', tarefaIdsLimpos[0]);
          } else if (tarefaIdsLimpos.length > 1) {
            queryAgrupadores = queryAgrupadores.in('tarefa_id', tarefaIdsLimpos);
          }
        }
        if (responsavel_id && responsavel_id.length > 0) {
          const responsavelIdsLimpos = responsavel_id.map(id => String(id).trim()).filter(Boolean);
          console.log('🔍 [TEMPO-ESTIMADO-AGRUPADORES] Filtrando por responsavel_id:', responsavelIdsLimpos);
          if (responsavelIdsLimpos.length === 1) {
            queryAgrupadores = queryAgrupadores.eq('responsavel_id', responsavelIdsLimpos[0]);
          } else if (responsavelIdsLimpos.length > 1) {
            queryAgrupadores = queryAgrupadores.in('responsavel_id', responsavelIdsLimpos);
          }
        }
        
        // Aplicar filtros de agrupamento se existirem
        if (req.query.filtro_produto === 'true') {
          queryAgrupadores = queryAgrupadores.not('produto_id', 'is', null);
        }
        if (req.query.filtro_atividade === 'true') {
          queryAgrupadores = queryAgrupadores.not('tarefa_id', 'is', null);
        }
        if (req.query.filtro_cliente === 'true') {
          queryAgrupadores = queryAgrupadores.not('cliente_id', 'is', null);
        }
        if (req.query.filtro_responsavel === 'true') {
          queryAgrupadores = queryAgrupadores.not('responsavel_id', 'is', null);
        }
        
        return queryAgrupadores.order('data', { ascending: false });
      };
      
      let todosRegistros = [];
      try {
        console.log('📊 Buscando todos os registros para calcular períodos dos agrupamentos...');
        todosRegistros = await buscarTodosComPaginacao(criarQueryAgrupadores, { 
          limit: 1000, 
          logProgress: true 
        });
        console.log(`✅ Total de ${todosRegistros.length} registros encontrados para análise de períodos`);
      } catch (errorTodos) {
        console.error('❌ Erro ao buscar registros para filtro de período:', errorTodos);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar registros para filtro de período',
          details: errorTodos.message
        });
      }
      
      // Agrupar por agrupador_id e calcular min/max
      const grupos = new Map();
      
      (todosRegistros || []).forEach(registro => {
        const agrupadorId = registro.agrupador_id || 'sem-grupo';
        
        if (!grupos.has(agrupadorId)) {
          grupos.set(agrupadorId, {
            agrupador_id: agrupadorId,
            dataMinima: null,
            dataMaxima: null,
            registros: [] // Adicionar array de registros para poder verificar dias úteis
          });
        }
        
        const grupo = grupos.get(agrupadorId);
        
        // Adicionar registro ao grupo
        grupo.registros.push(registro);
        
        // Calcular data mínima e máxima do grupo
        // Extrair apenas a parte da data (sem hora) para evitar problemas de timezone
        if (registro.data) {
          const dataStr = typeof registro.data === 'string' ? registro.data.split('T')[0] : registro.data;
          const [ano, mes, dia] = dataStr.split('-');
          const dataRegistro = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
          
          if (!isNaN(dataRegistro.getTime())) {
            if (!grupo.dataMinima || dataRegistro < grupo.dataMinima) {
              grupo.dataMinima = dataRegistro;
            }
            if (!grupo.dataMaxima || dataRegistro > grupo.dataMaxima) {
              grupo.dataMaxima = dataRegistro;
            }
          }
        }
      });
      
      // Filtrar grupos cujo período se sobrepõe ao período filtrado
      // Converter strings de data para Date objects (considerando apenas a parte da data, sem hora)
      const parseDateFromString = (dateStr) => {
        if (!dateStr) return null;
        // Remover a parte de hora se existir
        const dateOnly = dateStr.split('T')[0];
        const [ano, mes, dia] = dateOnly.split('-');
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      };
      
      const filtroInicio = parseDateFromString(periodoInicioFiltro);
      const filtroFim = parseDateFromString(periodoFimFiltro);
      
      if (!filtroInicio || !filtroFim) {
        console.error('❌ Erro ao parsear datas do filtro de período');
        return res.status(400).json({
          success: false,
          error: 'Datas do período inválidas'
        });
      }
      
      const agrupadoresValidos = [];
      
      // Normalizar datas do filtro (apenas data, sem hora)
      const filtroInicioDate = new Date(filtroInicio.getFullYear(), filtroInicio.getMonth(), filtroInicio.getDate());
      const filtroFimDate = new Date(filtroFim.getFullYear(), filtroFim.getMonth(), filtroFim.getDate());
      
      console.log(`🔍 [FILTRO-PERIODO] Período filtrado: ${periodoInicioFiltro} até ${periodoFimFiltro}`);
      console.log(`🔍 [FILTRO-PERIODO] Datas normalizadas: ${filtroInicioDate.toISOString().split('T')[0]} até ${filtroFimDate.toISOString().split('T')[0]}`);
      
      for (const [agrupadorId, grupo] of grupos.entries()) {
        if (grupo.dataMinima && grupo.dataMaxima) {
          // Normalizar datas do grupo (apenas data, sem hora)
          const grupoInicio = new Date(grupo.dataMinima.getFullYear(), grupo.dataMinima.getMonth(), grupo.dataMinima.getDate());
          const grupoFim = new Date(grupo.dataMaxima.getFullYear(), grupo.dataMaxima.getMonth(), grupo.dataMaxima.getDate());
          
          // Dois períodos se sobrepõem se: (inicio1 <= fim2) && (fim1 >= inicio2)
          const seSobrepoe = grupoInicio <= filtroFimDate && grupoFim >= filtroInicioDate;
          
          if (seSobrepoe) {
            agrupadoresValidos.push(agrupadorId);
          }
        }
      }
      
      // Se não há agrupadores válidos, retornar vazio
      if (agrupadoresValidos.length === 0) {
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
      
      // Buscar TODOS os registros dos agrupamentos válidos usando paginação automática
      const criarQueryRegistrosFiltrados = () => {
        let queryFiltrada = supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado')
          .select('*')
          .in('agrupador_id', agrupadoresValidos);
        
        // Aplicar outros filtros
        // Agora cliente_id, produto_id, tarefa_id e responsavel_id já são arrays ou null
        if (cliente_id && cliente_id.length > 0) {
          const clienteIdsLimpos = cliente_id.map(id => String(id).trim()).filter(Boolean);
          if (clienteIdsLimpos.length === 1) {
            queryFiltrada = queryFiltrada.eq('cliente_id', clienteIdsLimpos[0]);
          } else if (clienteIdsLimpos.length > 1) {
            queryFiltrada = queryFiltrada.in('cliente_id', clienteIdsLimpos);
          }
        }
        if (produto_id && produto_id.length > 0) {
          const produtoIdsLimpos = produto_id.map(id => String(id).trim()).filter(Boolean);
          if (produtoIdsLimpos.length === 1) {
            queryFiltrada = queryFiltrada.eq('produto_id', produtoIdsLimpos[0]);
          } else if (produtoIdsLimpos.length > 1) {
            queryFiltrada = queryFiltrada.in('produto_id', produtoIdsLimpos);
          }
        }
        if (tarefa_id && tarefa_id.length > 0) {
          const tarefaIdsLimpos = tarefa_id.map(id => String(id).trim()).filter(Boolean);
          if (tarefaIdsLimpos.length === 1) {
            queryFiltrada = queryFiltrada.eq('tarefa_id', tarefaIdsLimpos[0]);
          } else if (tarefaIdsLimpos.length > 1) {
            queryFiltrada = queryFiltrada.in('tarefa_id', tarefaIdsLimpos);
          }
        }
        if (responsavel_id && responsavel_id.length > 0) {
          const responsavelIdsLimpos = responsavel_id.map(id => String(id).trim()).filter(Boolean);
          console.log('🔍 [TEMPO-ESTIMADO-FILTRADA] Filtrando por responsavel_id:', responsavelIdsLimpos);
          if (responsavelIdsLimpos.length === 1) {
            queryFiltrada = queryFiltrada.eq('responsavel_id', responsavelIdsLimpos[0]);
          } else if (responsavelIdsLimpos.length > 1) {
            queryFiltrada = queryFiltrada.in('responsavel_id', responsavelIdsLimpos);
          }
        }
        
        // Aplicar filtros de agrupamento se existirem
        if (req.query.filtro_produto === 'true') {
          queryFiltrada = queryFiltrada.not('produto_id', 'is', null);
        }
        if (req.query.filtro_atividade === 'true') {
          queryFiltrada = queryFiltrada.not('tarefa_id', 'is', null);
        }
        if (req.query.filtro_cliente === 'true') {
          queryFiltrada = queryFiltrada.not('cliente_id', 'is', null);
        }
        if (req.query.filtro_responsavel === 'true') {
          queryFiltrada = queryFiltrada.not('responsavel_id', 'is', null);
        }
        
        return queryFiltrada.order('data', { ascending: false });
      };
      
      try {
        console.log(`📊 Buscando todos os registros dos ${agrupadoresValidos.length} agrupamentos válidos...`);
        const todosRegistrosFiltrados = await buscarTodosComPaginacao(criarQueryRegistrosFiltrados, { 
          limit: 1000, 
          logProgress: true 
        });
        console.log(`✅ Total de ${todosRegistrosFiltrados.length} registros encontrados dos agrupamentos válidos`);
        
        // IMPORTANTE: Filtrar os registros individuais pelo período filtrado
        // Mesmo que o agrupamento se sobreponha ao período, só devemos retornar os registros que estão dentro do período
        let registrosNoPeriodo = todosRegistrosFiltrados.filter(reg => {
          if (!reg.data) return false;
          
          try {
            // Extrair apenas a data (sem hora) do registro
            // A data pode vir como string ISO (2026-02-13T00:00:00+00 ou 2026-02-16 00:00:00+01) ou como Date object
            let dataRegistroStr;
            if (typeof reg.data === 'string') {
              // Se for string, extrair apenas a parte da data (YYYY-MM-DD)
              // Pode vir como "2026-02-13T00:00:00+00" ou "2026-02-16 00:00:00+01"
              if (reg.data.includes('T')) {
                dataRegistroStr = reg.data.split('T')[0];
              } else if (reg.data.includes(' ')) {
                dataRegistroStr = reg.data.split(' ')[0];
              } else {
                // Já está no formato YYYY-MM-DD
                dataRegistroStr = reg.data;
              }
            } else if (reg.data instanceof Date) {
              // Se for Date object, converter para string YYYY-MM-DD usando UTC para evitar problemas de timezone
              const ano = reg.data.getUTCFullYear();
              const mes = String(reg.data.getUTCMonth() + 1).padStart(2, '0');
              const dia = String(reg.data.getUTCDate()).padStart(2, '0');
              dataRegistroStr = `${ano}-${mes}-${dia}`;
            } else {
              return false;
            }
            
            // Parsear a data do registro
            const [anoReg, mesReg, diaReg] = dataRegistroStr.split('-');
            if (!anoReg || !mesReg || !diaReg) {
              console.warn(`⚠️ Data do registro inválida: ${reg.data} (extraído: ${dataRegistroStr})`);
              return false;
            }
            
            // Criar data normalizada (apenas data, sem hora, sem timezone)
            const dataRegistro = new Date(parseInt(anoReg), parseInt(mesReg) - 1, parseInt(diaReg));
            const dataRegistroNormalizada = new Date(dataRegistro.getFullYear(), dataRegistro.getMonth(), dataRegistro.getDate());
            
            // Se a data do registro está dentro do período filtrado (inclusive)
            const dentroDoPeriodo = dataRegistroNormalizada >= filtroInicioDate && dataRegistroNormalizada <= filtroFimDate;
            
            if (!dentroDoPeriodo) {
              console.log(`🚫 Registro fora do período: ${dataRegistroStr} (período: ${periodoInicioFiltro} até ${periodoFimFiltro})`);
            }
            
            return dentroDoPeriodo;
          } catch (e) {
            console.error('❌ Erro ao processar data do registro:', e, 'Registro:', reg);
            return false;
          }
        });
        
        console.log(`📅 Filtrados ${registrosNoPeriodo.length} registros que estão dentro do período ${periodoInicioFiltro} até ${periodoFimFiltro} (de ${todosRegistrosFiltrados.length} registros dos agrupamentos válidos)`);
        
        // Log detalhado dos registros filtrados (apenas se houver poucos)
        if (registrosNoPeriodo.length > 0 && registrosNoPeriodo.length <= 10) {
          const datasFiltradas = registrosNoPeriodo.map(r => {
            const dataStr = typeof r.data === 'string' ? r.data.split('T')[0] : r.data;
            return dataStr;
          });
          console.log(`📅 Datas dos registros filtrados: ${datasFiltradas.join(', ')}`);
        }
        
        // Contar quantos agrupamentos únicos temos nos registros filtrados
        const agrupadoresUnicos = new Set(registrosNoPeriodo.map(r => r.agrupador_id));
        console.log(`📦 Total de ${agrupadoresUnicos.size} agrupamentos únicos nos registros filtrados pelo período`);
        
        // IMPORTANTE: Não aplicar paginação manual aqui, pois o frontend agrupa por agrupador_id
        // Se aplicarmos paginação aqui, podemos perder agrupamentos completos
        // O frontend vai fazer a paginação após agrupar
        
        // Retornar todos os registros do período sem exclusões
        totalFiltrado = registrosNoPeriodo.length;
        dadosFiltrados = registrosNoPeriodo;
        
        // Não aplicar paginação manual - deixar o frontend fazer a paginação após agrupar
        // dadosFiltrados = todosRegistrosFiltrados.slice(offset, offset + limitNum);
      } catch (errorFiltrado) {
        console.error('❌ Erro ao buscar registros filtrados:', errorFiltrado);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar registros filtrados',
          details: errorFiltrado.message
        });
      }
    }

    // Buscar fotos de perfil dos responsáveis
    if (dadosFiltrados && dadosFiltrados.length > 0) {
      // Extrair responsavel_ids únicos
      const responsavelIds = [...new Set(
        dadosFiltrados
          .map(r => r.responsavel_id)
          .filter(Boolean)
      )];

      if (responsavelIds.length > 0) {
        // Buscar membros por responsavel_id
        const { data: membros, error: membrosError } = await supabase
          .schema('up_gestaointeligente')
          .from('membro')
          .select('id, usuario_id')
          .in('id', responsavelIds);

        if (!membrosError && membros && membros.length > 0) {
          // Extrair usuario_ids únicos
          const usuarioIds = [...new Set(
            membros
              .map(m => m.usuario_id)
              .filter(Boolean)
          )];

          if (usuarioIds.length > 0) {
            // Buscar usuarios por usuario_id
            const { data: usuarios, error: usuariosError } = await supabase
              .schema('up_gestaointeligente')
              .from('usuarios')
              .select('id, foto_perfil')
              .in('id', usuarioIds);

            if (!usuariosError && usuarios && usuarios.length > 0) {
              // Criar mapas para lookup rápido
              const membroMap = new Map();
              membros.forEach(membro => {
                membroMap.set(String(membro.id), membro.usuario_id);
              });

              const usuarioMap = new Map();
              usuarios.forEach(usuario => {
                usuarioMap.set(String(usuario.id), usuario.foto_perfil);
              });

              // Adicionar foto_perfil aos registros
              // O frontend resolve avatares customizados via resolveAvatarUrl do Supabase Storage
              dadosFiltrados.forEach(registro => {
                if (registro.responsavel_id) {
                  const responsavelIdStr = String(registro.responsavel_id);
                  const usuarioId = membroMap.get(responsavelIdStr);
                  if (usuarioId) {
                    const fotoPerfil = usuarioMap.get(String(usuarioId));
                    registro.responsavel_foto_perfil = fotoPerfil || null;
                  } else {
                    registro.responsavel_foto_perfil = null;
                  }
                } else {
                  registro.responsavel_foto_perfil = null;
                }
              });
            } else {
              // Se não encontrar usuarios, definir foto_perfil como null
              dadosFiltrados.forEach(registro => {
                registro.responsavel_foto_perfil = null;
              });
            }
          } else {
            // Se não houver usuario_ids, definir foto_perfil como null
            dadosFiltrados.forEach(registro => {
              registro.responsavel_foto_perfil = null;
            });
          }
        } else {
          // Se não encontrar membros, definir foto_perfil como null
          dadosFiltrados.forEach(registro => {
            registro.responsavel_foto_perfil = null;
          });
        }
      } else {
        // Se não houver responsavel_ids, definir foto_perfil como null
        dadosFiltrados.forEach(registro => {
          registro.responsavel_foto_perfil = null;
        });
      }
    }

    // Quando há filtro de período, retornamos todos os registros dos agrupamentos válidos
    // O frontend vai agrupar e fazer a paginação. Por isso, totalPages deve ser 1
    // e total deve ser o número total de registros (não agrupamentos)
    let totalPagesCalculado = 1;
    if (!aplicarFiltroPeriodo) {
      // Sem filtro de período, usar paginação normal
      totalPagesCalculado = Math.ceil((totalFiltrado || 0) / limitNum);
    } else {
      // Com filtro de período, retornamos todos os registros
      // O frontend vai agrupar e paginar
      totalPagesCalculado = 1;
    }

    console.log(`📄 Retornando ${dadosFiltrados.length} registros (total: ${totalFiltrado}, página: ${pageNum}, totalPages: ${totalPagesCalculado})`);

    return res.json({
      success: true,
      data: dadosFiltrados || [],
      count: dadosFiltrados?.length || 0,
      total: totalFiltrado || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPagesCalculado
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar tempo estimado:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ req.query:', JSON.stringify(req.query, null, 2));
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    const { cliente_id, produto_id, tarefa_id, data, responsavel_id, tempo_estimado_dia } = req.body;

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

    if (tempo_estimado_dia !== undefined) {
      dadosUpdate.tempo_estimado_dia = tempo_estimado_dia ? parseInt(tempo_estimado_dia, 10) : null;
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

    // Se a data foi alterada, recalcular período do histórico
    if (dadosUpdate.data && tempoEstimadoAtualizado.agrupador_id) {
      await recalcularPeriodoHistorico(tempoEstimadoAtualizado.agrupador_id);
    }

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

    // Buscar o registro antes de deletar para obter o agrupador_id
    const { data: tempoEstimadoAntes, error: buscaError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('agrupador_id')
      .eq('id', id)
      .single();

    if (buscaError || !tempoEstimadoAntes) {
      return res.status(404).json({
        success: false,
        error: 'Tempo estimado não encontrado'
      });
    }

    const agrupador_id = tempoEstimadoAntes.agrupador_id;

    // Deletar o registro
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

    // Recalcular período do histórico
    if (agrupador_id) {
      await recalcularPeriodoHistorico(agrupador_id);
    }

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
    const { cliente_id, produto_ids, tarefa_ids, data_inicio, data_fim, tempo_estimado_dia, responsavel_id, incluir_finais_semana = true, incluir_feriados = true } = req.body;

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

    // Função para gerar todas as datas entre início e fim (reutilizar a função async)
    const gerarDatasDoPeriodoUpdate = async (inicioStr, fimStr, incluirFinaisSemana = true, incluirFeriados = true) => {
      const inicio = new Date(inicioStr + 'T00:00:00');
      const fim = new Date(fimStr + 'T00:00:00');
      const datas = [];
      
      if (fim < inicio) {
        return [];
      }
      
      // Buscar feriados para todos os anos no período
      const anosNoPeriodo = new Set();
      const dataAtualTemp = new Date(inicio);
      while (dataAtualTemp <= fim) {
        anosNoPeriodo.add(dataAtualTemp.getFullYear());
        dataAtualTemp.setFullYear(dataAtualTemp.getFullYear() + 1);
      }
      
      // Buscar feriados para todos os anos
      const feriadosPorAno = {};
      for (const ano of anosNoPeriodo) {
        feriadosPorAno[ano] = await buscarFeriados(ano);
      }
      
      const dataAtual = new Date(inicio);
      let feriadosPulados = 0;
      let finaisSemanaPulados = 0;
      
      while (dataAtual <= fim) {
        // Verificar se é final de semana (sábado = 6, domingo = 0)
        // Usar getFullYear, getMonth, getDate para garantir que estamos usando a data local correta
        const ano = dataAtual.getFullYear();
        const mes = dataAtual.getMonth();
        const dia = dataAtual.getDate();
        // Criar uma nova data com UTC para garantir consistência no cálculo do dia da semana
        const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
        const diaDaSemana = dataParaCalcular.getUTCDay();
        const isWeekend = diaDaSemana === 0 || diaDaSemana === 6;
        
        // Verificar se é feriado
        const anoFormatado = String(ano);
        const mesFormatado = String(mes + 1).padStart(2, '0');
        const diaFormatado = String(dia).padStart(2, '0');
        const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
        const isHolidayDay = feriadosPorAno[ano] && feriadosPorAno[ano][dateKey] !== undefined;
        const nomeFeriado = isHolidayDay ? feriadosPorAno[ano][dateKey] : null;
        
        // Se não deve incluir finais de semana e é final de semana, pular
        if (!incluirFinaisSemana && isWeekend) {
          finaisSemanaPulados++;
          dataAtual.setDate(dataAtual.getDate() + 1);
          continue;
        }
        
        // Se não deve incluir feriados e é feriado, pular
        if (!incluirFeriados && isHolidayDay) {
          feriadosPulados++;
          console.log(`📅 [TEMPO-ESTIMADO-UPDATE] Pulando feriado: ${dateKey} - ${nomeFeriado} (incluirFeriados=${incluirFeriados})`);
          dataAtual.setDate(dataAtual.getDate() + 1);
          continue;
        }
        
        const dataFormatada = `${anoFormatado}-${mesFormatado}-${diaFormatado}T00:00:00`;
        datas.push(dataFormatada);
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      
      if (feriadosPulados > 0) {
        console.log(`📅 [TEMPO-ESTIMADO-UPDATE] Total de ${feriadosPulados} feriado(s) pulado(s)`);
      }
      if (finaisSemanaPulados > 0) {
        console.log(`📅 [TEMPO-ESTIMADO-UPDATE] Total de ${finaisSemanaPulados} final(is) de semana pulado(s)`);
      }
      
      return datas;
    };

    // Gerar todas as datas do período (filtrar finais de semana e feriados se necessário)
    // Se incluir_finais_semana não foi enviado, assume true (compatibilidade)
    // Se foi enviado explicitamente como false, usa false
    // IMPORTANTE: Se o parâmetro não existir no body, assume true. Se existir (mesmo que false), usa o valor.
    const incluirFinaisSemana = incluir_finais_semana === undefined ? true : Boolean(incluir_finais_semana);
    const incluirFeriados = incluir_feriados === undefined ? true : Boolean(incluir_feriados);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Parâmetro incluir_finais_semana recebido:', incluir_finais_semana, 'tipo:', typeof incluir_finais_semana);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Parâmetro incluir_feriados recebido:', incluir_feriados, 'tipo:', typeof incluir_feriados);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Valor processado incluirFinaisSemana:', incluirFinaisSemana);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Valor processado incluirFeriados:', incluirFeriados);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Período:', data_inicio, 'até', data_fim);
    const datasDoPeriodo = await gerarDatasDoPeriodoUpdate(data_inicio, data_fim, incluirFinaisSemana, incluirFeriados);
    console.log('📅 [TEMPO-ESTIMADO-UPDATE] Total de datas geradas:', datasDoPeriodo.length);
    if (datasDoPeriodo.length > 0 && datasDoPeriodo.length <= 5) {
      console.log('📅 [TEMPO-ESTIMADO-UPDATE] Datas geradas:', datasDoPeriodo);
    } else if (datasDoPeriodo.length > 5) {
      console.log('📅 [TEMPO-ESTIMADO-UPDATE] Primeiras 5 datas:', datasDoPeriodo.slice(0, 5));
    }
    
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

// GET - Buscar tempo realizado para registros de tempo estimado
async function getTempoRealizadoPorTarefasEstimadas(req, res) {
  try {
    const { registros } = req.body;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'registros é obrigatório e deve ser um array não vazio'
      });
    }

    // Criar mapa de tempo realizado por chave: tempo_estimado_id (ou fallback)
    const tempoRealizadoMap = new Map();

    // Extrair todos os tempo_estimado_id únicos dos registros
    const tempoEstimadoIds = registros
      .map(reg => reg.id || reg.tempo_estimado_id)
      .filter(Boolean)
      .map(id => String(id).trim());
      
    // Buscar todos os registros de tempo que correspondem aos tempo_estimado_id
    // IMPORTANTE: Filtrar apenas registros onde cliente_id NÃO é NULL
    // IMPORTANTE: Incluir registros ativos (sem data_fim) para calcular tempo parcial do dia atual
      const { data: registrosTempo, error: errorTempo } = await supabase
        .schema('up_gestaointeligente')
        .from('registro_tempo')
      .select('id, tempo_realizado, data_inicio, data_fim, usuario_id, cliente_id, tempo_estimado_id')
      .in('tempo_estimado_id', tempoEstimadoIds)
      .not('cliente_id', 'is', null) // SOMENTE registros onde cliente_id não é NULL
        .not('data_inicio', 'is', null);
        // REMOVIDO: .not('data_fim', 'is', null) - para incluir registros ativos do dia atual
        // REMOVIDO: .not('tempo_realizado', 'is', null) - tempo_realizado pode ser null para registros ativos

      if (errorTempo) {
      console.error('Erro ao buscar registros de tempo:', errorTempo);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo',
        details: errorTempo.message
      });
    }

    // Buscar membros para converter usuario_id em responsavel_id
    const usuarioIds = [...new Set((registrosTempo || []).map(reg => reg.usuario_id).filter(Boolean))];
    const membrosMap = new Map();

    if (usuarioIds.length > 0) {
      const { data: membros, error: errorMembros } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id, usuario_id')
        .in('usuario_id', usuarioIds);

      if (!errorMembros && membros) {
        membros.forEach(membro => {
          membrosMap.set(membro.usuario_id, membro.id);
        });
      }
    }

    // Agrupar registros de tempo por tempo_estimado_id
    const registrosPorTempoEstimado = new Map();
    (registrosTempo || []).forEach(reg => {
      const tempoEstimadoId = String(reg.tempo_estimado_id || '').trim();
      if (!tempoEstimadoId) return;

      if (!registrosPorTempoEstimado.has(tempoEstimadoId)) {
        registrosPorTempoEstimado.set(tempoEstimadoId, []);
      }
      registrosPorTempoEstimado.get(tempoEstimadoId).push(reg);
    });

    // Para cada registro de tempo estimado, calcular tempo realizado total
    registros.forEach(registro => {
      const tempoEstimadoId = String(registro.id || registro.tempo_estimado_id || '').trim();
      if (!tempoEstimadoId) {
        return;
      }

      const tarefaId = String(registro.tarefa_id || '').trim();
      // Normalizar responsavel_id: pode vir como string ou número, sempre converter para número
      const responsavelIdRaw = registro.responsavel_id || 0;
      const responsavelId = parseInt(String(responsavelIdRaw).trim(), 10);
      const clienteId = String(registro.cliente_id || '').trim();
      
      // Extrair data para fallback
      let dataEstimado = null;
      if (registro.data) {
        const dataStr = typeof registro.data === 'string' ? registro.data.split('T')[0] : registro.data;
        dataEstimado = dataStr;
      }

      // Buscar registros de tempo para este tempo_estimado_id específico
      const registrosTempoParaEste = registrosPorTempoEstimado.get(tempoEstimadoId) || [];

      // Filtrar por responsável (converter usuario_id para responsavel_id através da tabela membro)
      const registrosFiltrados = registrosTempoParaEste.filter(reg => {
        if (responsavelId && !isNaN(responsavelId)) {
          const responsavelIdDoRegistro = membrosMap.get(reg.usuario_id);
          return responsavelIdDoRegistro === responsavelId;
        }
        return true;
      });

      // Calcular tempo total realizado
      let tempoTotalRealizado = 0;
        registrosFiltrados.forEach(reg => {
          let tempoRealizado = Number(reg.tempo_realizado) || 0;
          
          // Se o registro não tem tempo_realizado, calcular a partir de data_inicio e data_fim
          // IMPORTANTE: Incluir registros ativos (sem data_fim) calculando tempo parcial até agora
          if (!tempoRealizado && reg.data_inicio) {
            const dataInicio = new Date(reg.data_inicio);
            const dataFim = reg.data_fim ? new Date(reg.data_fim) : new Date(); // Se ativo (sem data_fim), usar agora
            tempoRealizado = Math.max(0, dataFim.getTime() - dataInicio.getTime());
          }
          
          // Se ainda não tem tempo_realizado e tem data_inicio, calcular tempo parcial
          if (!tempoRealizado && reg.data_inicio) {
            const dataInicio = new Date(reg.data_inicio);
            const agora = new Date();
            tempoRealizado = Math.max(0, agora.getTime() - dataInicio.getTime());
          }
          
          // Se valor < 1 (decimal), está em horas -> converter para ms
          // Se valor >= 1, já está em ms
          const tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
          tempoTotalRealizado += tempoMs;
        });

      // Criar chave: usar tempo_estimado_id quando disponível (mais preciso)
      // Fallback: tarefa_id + responsavel_id + cliente_id + data
      const chave = tempoEstimadoId 
        ? `${tarefaId}_${responsavelId}_${clienteId}_${tempoEstimadoId}`
        : (dataEstimado ? `${tarefaId}_${responsavelId}_${clienteId}_${dataEstimado}` : null);

      if (chave) {
        tempoRealizadoMap.set(chave, {
        tempo_realizado: tempoTotalRealizado,
        quantidade_registros: registrosFiltrados.length
    });
      }
    });

    return res.json({
      success: true,
      data: Object.fromEntries(tempoRealizadoMap),
      count: tempoRealizadoMap.size
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

module.exports = {
  criarTempoEstimado,
  getTempoEstimado,
  getTempoEstimadoPorId,
  atualizarTempoEstimado,
  deletarTempoEstimado,
  atualizarTempoEstimadoPorAgrupador,
  deletarTempoEstimadoPorAgrupador,
  getTempoEstimadoPorAgrupador,
  getTempoRealizadoPorTarefasEstimadas
};

