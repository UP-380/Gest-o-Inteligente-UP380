// =============================================================
// === CONTROLLER DE TEMPO ESTIMADO ===
// =============================================================

const supabase = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { buscarTodosComPaginacao } = require('../services/database-utils');

// Função auxiliar para recalcular período do histórico baseado nas tarefas restantes
async function recalcularPeriodoHistorico(agrupador_id) {
  try {
    if (!agrupador_id) return;

    // Buscar histórico associado ao agrupador
    const { data: historico, error: historicoError } = await supabase

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

// Função para processar datas individuais (filtrar por finais de semana e feriados)
async function processarDatasIndividuais(datasIndividuais = [], incluirFinaisSemana = true, incluirFeriados = true) {
  if (!Array.isArray(datasIndividuais) || datasIndividuais.length === 0) {
    return [];
  }

  try {
    // Buscar feriados para todos os anos presentes nas datas individuais
    const anosNoConjunto = new Set();
    datasIndividuais.forEach(dataStr => {
      try {
        const date = new Date(dataStr + 'T00:00:00');
        if (!isNaN(date.getTime())) {
          anosNoConjunto.add(date.getFullYear());
        }
      } catch (error) {
        console.warn('Erro ao processar data individual:', dataStr, error);
      }
    });

    // Buscar feriados para todos os anos
    const feriadosPorAno = {};
    for (const ano of anosNoConjunto) {
      feriadosPorAno[ano] = await buscarFeriados(ano);
    }

    const datasValidas = [];
    let feriadosPulados = 0;
    let finaisSemanaPulados = 0;

    // Processar cada data individual
    for (const dataStr of datasIndividuais) {
      if (!dataStr || typeof dataStr !== 'string') continue;

      try {
        const date = new Date(dataStr + 'T00:00:00');
        if (isNaN(date.getTime())) {
          console.warn('Data inválida ignorada:', dataStr);
          continue;
        }

        const ano = date.getFullYear();
        const mes = date.getMonth();
        const dia = date.getDate();

        // Criar data para cálculo do dia da semana
        const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
        const diaDaSemana = dataParaCalcular.getUTCDay();
        const isWeekend = diaDaSemana === 0 || diaDaSemana === 6;

        // Verificar se é feriado
        const anoFormatado = String(ano);
        const mesFormatado = String(mes + 1).padStart(2, '0');
        const diaFormatado = String(dia).padStart(2, '0');
        const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
        const isHolidayDay = feriadosPorAno[ano] && feriadosPorAno[ano][dateKey] !== undefined;

        // Se não deve incluir finais de semana e é final de semana, pular
        if (!incluirFinaisSemana && isWeekend) {
          finaisSemanaPulados++;
          continue;
        }

        // Se não deve incluir feriados e é feriado, pular
        if (!incluirFeriados && isHolidayDay) {
          feriadosPulados++;
          const nomeFeriado = isHolidayDay ? feriadosPorAno[ano][dateKey] : '';
          console.log(`📅 [DATAS-INDIVIDUAIS] Pulando feriado: ${dateKey} - ${nomeFeriado} (incluirFeriados=${incluirFeriados})`);
          continue;
        }

        // Data válida - adicionar no formato usado pelo banco
        const dataFormatada = `${anoFormatado}-${mesFormatado}-${diaFormatado}T00:00:00`;
        datasValidas.push(dataFormatada);
      } catch (error) {
        console.warn('Erro ao processar data individual:', dataStr, error);
      }
    }

    if (feriadosPulados > 0) {
      console.log(`📅 [DATAS-INDIVIDUAIS] Total de ${feriadosPulados} feriado(s) pulado(s)`);
    }
    if (finaisSemanaPulados > 0) {
      console.log(`📅 [DATAS-INDIVIDUAIS] Total de ${finaisSemanaPulados} final(is) de semana pulado(s)`);
    }

    return datasValidas;
  } catch (error) {
    console.error('Erro ao processar datas individuais:', error);
    return [];
  }
}

// Função auxiliar para gerar datas do período (usado na função anterior e no cálculo dinâmico)
async function gerarDatasDoPeriodo(dataInicio, dataFim, incluirFinaisSemana = true, incluirFeriados = true, cacheFeriados = null) {
  try {
    // Converter strings de data para Date objects
    const inicio = new Date(dataInicio + (dataInicio.includes('T') ? '' : 'T00:00:00'));
    const fim = new Date(dataFim + (dataFim.includes('T') ? '' : 'T23:59:59'));

    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      console.error('❌ Datas inválidas para gerar período:', dataInicio, dataFim);
      return [];
    }

    // Normalizar para início do dia
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);

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
      if (dataAtualTemp.getFullYear() > fim.getFullYear() + 1) break;
    }

    // Buscar feriados para todos os anos (usar cache se fornecido, senão usar cache global)
    const feriadosPorAno = {};
    const cacheParaUsar = cacheFeriados || feriadosCache;
    for (const ano of anosNoPeriodo) {
      // Verificar cache primeiro
      if (cacheParaUsar[ano]) {
        feriadosPorAno[ano] = cacheParaUsar[ano];
      } else {
        feriadosPorAno[ano] = await buscarFeriados(ano);
        // Armazenar no cache fornecido se existir
        if (cacheFeriados) {
          cacheFeriados[ano] = feriadosPorAno[ano];
        }
      }
    }

    const dataAtual = new Date(inicio);
    let feriadosPulados = 0;
    let finaisSemanaPulados = 0;

    while (dataAtual <= fim) {
      // Verificar se é final de semana (sábado = 6, domingo = 0)
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

      // Se não deve incluir finais de semana e é final de semana, pular
      if (!incluirFinaisSemana && isWeekend) {
        finaisSemanaPulados++;
        dataAtual.setDate(dataAtual.getDate() + 1);
        continue;
      }

      // Se não deve incluir feriados e é feriado, pular
      if (!incluirFeriados && isHolidayDay) {
        feriadosPulados++;
        dataAtual.setDate(dataAtual.getDate() + 1);
        continue;
      }

      const dataFormatada = `${anoFormatado}-${mesFormatado}-${diaFormatado}T00:00:00`;
      datas.push(dataFormatada);

      // Avançar para o próximo dia
      dataAtual.setDate(dataAtual.getDate() + 1);
    }

    if (feriadosPulados > 0) {
      console.log(`📅 [GERAR-DATAS] Total de ${feriadosPulados} feriado(s) pulado(s)`);
    }
    if (finaisSemanaPulados > 0) {
      console.log(`📅 [GERAR-DATAS] Total de ${finaisSemanaPulados} final(is) de semana pulado(s)`);
    }

    return datas;
  } catch (error) {
    console.error('❌ Erro ao gerar datas do período:', error);
    return [];
  }
}

// Função para gerar ID virtual estável baseado em hash
function gerarIdVirtual(regraId, data) {
  // Criar hash estável baseado na regra + data
  const hashInput = `${regraId}|${data}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex');
  // Retornar formato similar a UUID (mas determinístico)
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

/**
 * Calcula registros dinâmicos a partir de uma regra de tempo estimado
 * 
 * @param {Object} regra - Regra da tabela tempo_estimado_regra
 * @param {string|null} dataInicioFiltro - Data início do filtro (opcional, filtra resultado)
 * @param {string|null} dataFimFiltro - Data fim do filtro (opcional, filtra resultado)
 * @returns {Array} Array de registros virtuais no formato esperado pelo frontend
 */
async function calcularRegistrosDinamicos(regra, dataInicioFiltro = null, dataFimFiltro = null, cacheFeriados = null, overrideFinaisSemana = null, overrideFeriados = null) {
  try {
    if (!regra || !regra.data_inicio || !regra.data_fim) {
      console.warn('⚠️ Regra inválida para cálculo dinâmico:', regra);
      return [];
    }

    // Gerar datas do período da regra
    let incluirFinaisSemana = regra.incluir_finais_semana !== false; // Default true
    let incluirFeriados = regra.incluir_feriados !== false; // Default true

    // Aplicar overrides do filtro global (se fornecidos como booleanos)
    if (typeof overrideFinaisSemana === 'boolean') incluirFinaisSemana = overrideFinaisSemana;
    if (typeof overrideFeriados === 'boolean') incluirFeriados = overrideFeriados;

    let datasDoPeriodo = await gerarDatasDoPeriodo(
      regra.data_inicio,
      regra.data_fim,
      incluirFinaisSemana,
      incluirFeriados,
      cacheFeriados
    );

    // Aplicar filtro de período se fornecido (intersectar com período da regra)
    if (dataInicioFiltro && dataFimFiltro) {
      const dataInicioStr = dataInicioFiltro.split('T')[0];
      const dataFimStr = dataFimFiltro.split('T')[0];

      const filtroInicio = new Date(`${dataInicioStr}T00:00:00`);
      const filtroFim = new Date(`${dataFimStr}T23:59:59.999`);

      datasDoPeriodo = datasDoPeriodo.filter(dataStr => {
        const dataRegistro = new Date(`${dataStr.split('T')[0]}T00:00:00`);
        dataRegistro.setHours(0, 0, 0, 0);
        return dataRegistro >= filtroInicio && dataRegistro <= filtroFim;
      });
    }

    // Criar registros virtuais
    const registros = datasDoPeriodo.map(dataStr => {
      const realRegraId = regra.id; // Deve ser o BIGINT da tabela tempo_estimado_regra
      const idVirtual = gerarIdVirtual(realRegraId, dataStr);

      return {
        id: idVirtual, // ID virtual para uso no DOM/Frontend
        tempo_estimado_id: idVirtual, // Compatibilidade (Timetrack)
        agrupador_id: regra.agrupador_id,
        cliente_id: regra.cliente_id,
        produto_id: regra.produto_id,
        tarefa_id: regra.tarefa_id,
        responsavel_id: regra.responsavel_id,
        tipo_tarefa_id: regra.tipo_tarefa_id,
        data: dataStr,
        tempo_estimado_dia: regra.tempo_estimado_dia,
        incluir_finais_semana: incluirFinaisSemana,
        incluir_feriados: incluirFeriados,
        is_plug_rapido: regra.is_plug_rapido,
        // CRÍTICO: regra_id deve ser o ID real para a tabela de status
        regra_id: realRegraId,
        created_at: regra.created_at,
        updated_at: regra.updated_at
      };
    });

    return registros;
  } catch (error) {
    console.error('❌ Erro ao calcular registros dinâmicos:', error);
    return [];
  }
}

// Função auxiliar para agrupar datas em segmentos contínuos (considerando flags de exclusão)
async function agruparDatasEmSegmentos(datas, incluirFinaisSemana = true, incluirFeriados = true) {
  if (!datas || datas.length === 0) return [];

  // Ordenar datas
  const datasOrdenadas = [...datas].sort();
  const segmentos = [];
  let segmentoAtual = { inicio: datasOrdenadas[0], fim: datasOrdenadas[0] };

  for (let i = 1; i < datasOrdenadas.length; i++) {
    const dataAnterior = new Date(segmentoAtual.fim.includes('T') ? segmentoAtual.fim : `${segmentoAtual.fim}T00:00:00`);
    const dataAtual = new Date(datasOrdenadas[i].includes('T') ? datasOrdenadas[i] : `${datasOrdenadas[i]}T00:00:00`);

    // Calcular diferença em dias
    const diffTime = Math.abs(dataAtual - dataAnterior);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Dia seguinte consecutivo: estender segmento
      segmentoAtual.fim = datasOrdenadas[i];
    } else {
      // Gap maior que 1 dia: verificar se os dias no meio são explicáveis pelos flags
      let gapExpicavel = true;

      // Verificar dias no gap
      const dataTemp = new Date(dataAnterior);
      dataTemp.setDate(dataTemp.getDate() + 1);

      while (dataTemp < dataAtual) {
        const ano = dataTemp.getFullYear();
        const mes = dataTemp.getMonth();
        const dia = dataTemp.getDate();
        const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
        const diaDaSemana = dataParaCalcular.getUTCDay();
        const isWeekend = diaDaSemana === 0 || diaDaSemana === 6;

        // Verificar feriado
        const anoFormatado = String(ano);
        const mesFormatado = String(mes + 1).padStart(2, '0');
        const diaFormatado = String(dia).padStart(2, '0');
        const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
        const isHolidayDay = await isHoliday(`${anoFormatado}-${mesFormatado}-${diaFormatado}`);

        let diaPulavel = false;
        if (!incluirFinaisSemana && isWeekend) diaPulavel = true;
        if (!incluirFeriados && isHolidayDay) diaPulavel = true;

        if (!diaPulavel) {
          gapExpicavel = false;
          break;
        }

        dataTemp.setDate(dataTemp.getDate() + 1);
      }

      if (gapExpicavel) {
        segmentoAtual.fim = datasOrdenadas[i];
      } else {
        // Fechar segmento anterior e iniciar novo
        segmentos.push(segmentoAtual);
        segmentoAtual = { inicio: datasOrdenadas[i], fim: datasOrdenadas[i] };
      }
    }
  }

  // Adicionar último segmento
  segmentos.push(segmentoAtual);
  return segmentos;
}

// POST - Criar novo(s) registro(s) de tempo estimado
async function criarTempoEstimado(req, res) {
  try {
    console.log('📥 Recebendo requisição para criar tempo estimado');
    console.log('📦 Body recebido:', JSON.stringify(req.body, null, 2));

    const { cliente_id, produto_ids, tarefa_ids, tarefas, produtos_com_tarefas, data_inicio, data_fim, tempo_estimado_dia, tempo_minutos, responsavel_id, incluir_finais_semana = true, incluir_feriados = true, datas_individuais = [] } = req.body;

    // Validações
    if (!cliente_id) {
      console.error('❌ Validação falhou: cliente_id é obrigatório');
      return res.status(400).json({
        success: false,
        error: 'cliente_id é obrigatório'
      });
    }

    // NOVO FORMATO: produtos_com_tarefas = { produtoId: [{ tarefa_id, tempo_estimado_dia }] }
    // Este formato garante que apenas as combinações corretas de produto x tarefa sejam criadas
    let produtosComTarefasMap = {};
    let produtoIdsArray = [];
    let todasTarefasComTempo = [];

    console.log('🔍 Verificando formato dos dados recebidos...');
    console.log('  - produtos_com_tarefas existe?', !!produtos_com_tarefas);
    console.log('  - produtos_com_tarefas tipo:', typeof produtos_com_tarefas);
    console.log('  - produtos_com_tarefas keys:', produtos_com_tarefas ? Object.keys(produtos_com_tarefas) : 'N/A');
    console.log('  - produto_ids existe?', !!produto_ids);
    console.log('  - produto_ids tipo:', typeof produto_ids);

    if (produtos_com_tarefas && typeof produtos_com_tarefas === 'object' && Object.keys(produtos_com_tarefas).length > 0) {
      // Formato novo: produtos agrupados com suas tarefas específicas
      console.log('📦 Usando formato novo: produtos_com_tarefas');
      produtosComTarefasMap = produtos_com_tarefas;
      produtoIdsArray = Object.keys(produtos_com_tarefas).map(id => String(id).trim());
      console.log('  - Produtos encontrados:', produtoIdsArray);

      // Validar estrutura
      for (const [produtoId, tarefasDoProduto] of Object.entries(produtosComTarefasMap)) {
        if (!Array.isArray(tarefasDoProduto) || tarefasDoProduto.length === 0) {
          return res.status(400).json({
            success: false,
            error: `Produto ${produtoId} deve ter pelo menos uma tarefa`
          });
        }

        // Validar cada tarefa do produto
        for (const t of tarefasDoProduto) {
          if (!t.tarefa_id || !t.tempo_estimado_dia || t.tempo_estimado_dia <= 0) {
            return res.status(400).json({
              success: false,
              error: `Tarefa do produto ${produtoId} deve ter tarefa_id e tempo_estimado_dia válido (maior que zero)`
            });
          }
          // responsavel_id é opcional na tarefa (será usado o global se não fornecido)
        }

        todasTarefasComTempo.push(...tarefasDoProduto);
      }
    } else if (produto_ids && Array.isArray(produto_ids) && produto_ids.length > 0) {
      // FORMATO ANTIGO (compatibilidade): produto_ids + tarefas
      console.log('📦 Usando formato antigo: produto_ids + tarefas');
      produtoIdsArray = produto_ids.map(id => String(id).trim());

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
          error: 'É necessário fornecer "produtos_com_tarefas" (novo formato) ou "produto_ids" + "tarefas"/"tarefa_ids" (formato antigo)'
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

      todasTarefasComTempo = tarefasComTempo;

      // Converter para o formato novo (compatibilidade): criar produtos_com_tarefas a partir do formato antigo
      // ATENÇÃO: No formato antigo, todas as tarefas são aplicadas a todos os produtos
      produtosComTarefasMap = {};
      produtoIdsArray.forEach(produtoId => {
        produtosComTarefasMap[produtoId] = tarefasComTempo;
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer "produtos_com_tarefas" (novo formato) ou "produto_ids" (formato antigo)'
      });
    }

    console.log('✅ Validações passaram. Produtos:', produtoIdsArray.length, 'Tarefas totais:', todasTarefasComTempo.length);
    console.log('📋 Estrutura produtos_com_tarefas:', Object.keys(produtosComTarefasMap).map(produtoId => ({
      produto: produtoId,
      tarefas: produtosComTarefasMap[produtoId].length
    })));

    const tarefaIdsArray = todasTarefasComTempo.map(t => String(t.tarefa_id).trim());

    // Validar: precisa de período completo OU datas individuais
    const temPeriodoCompleto = data_inicio && data_fim;
    const temDatasIndividuais = Array.isArray(datas_individuais) && datas_individuais.length > 0;

    if (!temPeriodoCompleto && !temDatasIndividuais) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer data_inicio e data_fim OU datas_individuais'
      });
    }

    // responsavel_id global é OPCIONAL (se não informado, será salvo como NULL para estimativa estrutural)
    let temResponsavelGlobal = !!responsavel_id;
    let temResponsavelPorTarefa = false;

    if (produtosComTarefasMap && Object.keys(produtosComTarefasMap).length > 0) {
      for (const tarefasDoProduto of Object.values(produtosComTarefasMap)) {
        for (const t of tarefasDoProduto) {
          if (t.responsavel_id) {
            temResponsavelPorTarefa = true;
            break;
          }
        }
        if (temResponsavelPorTarefa) break;
      }
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

    // Lógica para gerar datas: usar apenas datas individuais OU período completo (com filtro de datas individuais se fornecido)
    let datasDoPeriodo = [];

    if (temDatasIndividuais && !temPeriodoCompleto) {
      // Caso 1: Apenas datas individuais (sem período completo)
      console.log('📅 [TEMPO-ESTIMADO] Usando apenas datas individuais:', datas_individuais.length, 'data(s)');
      datasDoPeriodo = await processarDatasIndividuais(datas_individuais, incluirFinaisSemana, incluirFeriados);
      console.log('📅 [TEMPO-ESTIMADO] Total de datas válidas após filtrar finais de semana/feriados:', datasDoPeriodo.length);
    } else if (temPeriodoCompleto) {
      // Caso 2: Período completo (com ou sem datas individuais como filtro)
      console.log('📅 [TEMPO-ESTIMADO] Período:', data_inicio, 'até', data_fim);
      const todasDatas = await gerarDatasDoPeriodo(data_inicio, data_fim, incluirFinaisSemana, incluirFeriados);
      console.log('📅 [TEMPO-ESTIMADO] Total de datas geradas do período:', todasDatas.length);

      if (temDatasIndividuais) {
        // Aplicar filtro: incluir apenas datas que estão na lista de individuais
        const datasIndividuaisSet = new Set(datas_individuais);
        datasDoPeriodo = todasDatas.filter(data => {
          const dataStr = data.split('T')[0]; // Extrair apenas a data (YYYY-MM-DD)
          return datasIndividuaisSet.has(dataStr);
        });
        console.log('📅 [TEMPO-ESTIMADO] Total de datas após aplicar filtro de datas individuais:', datasDoPeriodo.length);
      } else {
        datasDoPeriodo = todasDatas;
      }
    }

    if (datasDoPeriodo.length > 0 && datasDoPeriodo.length <= 5) {
      console.log('📅 [TEMPO-ESTIMADO] Datas finais:', datasDoPeriodo);
    } else if (datasDoPeriodo.length > 5) {
      console.log('📅 [TEMPO-ESTIMADO] Primeiras 5 datas:', datasDoPeriodo.slice(0, 5));
    }

    if (datasDoPeriodo.length === 0) {
      const mensagemErro = temPeriodoCompleto
        ? 'Período inválido ou nenhuma data válida após aplicar filtros'
        : 'Nenhuma data válida encontrada nas datas individuais fornecidas';
      return res.status(400).json({
        success: false,
        error: mensagemErro
      });
    }

    // NOVA LÓGICA: Verificar duplicatas na tabela de regras
    const verificarDuplicatas = async () => {
      // Para cada produto, verificar se já existe uma regra com exatamente as mesmas tarefas
      for (const produtoId of produtoIdsArray) {
        // Buscar todas as regras existentes para este cliente + produto + responsável
        const { data: regrasExistentes, error: errorBusca } = await supabase

          .from('tempo_estimado_regra')
          .select('agrupador_id, data_inicio, data_fim, cliente_id, produto_id, tarefa_id, responsavel_id')
          .eq('cliente_id', String(cliente_id).trim())
          .eq('produto_id', String(produtoId).trim())
          .eq('responsavel_id', String(responsavel_id).trim());

        if (errorBusca) {
          console.error('Erro ao verificar duplicatas:', errorBusca);
          continue;
        }

        if (regrasExistentes && regrasExistentes.length > 0) {
          // Agrupar por agrupador_id
          const gruposExistentes = new Map();
          regrasExistentes.forEach(reg => {
            const agrupadorId = reg.agrupador_id || 'sem-grupo';
            if (!gruposExistentes.has(agrupadorId)) {
              gruposExistentes.set(agrupadorId, {
                tarefas: new Set(),
                dataInicio: null,
                dataFim: null
              });
            }
            gruposExistentes.get(agrupadorId).tarefas.add(String(reg.tarefa_id).trim());
            // Guardar período mínimo/máximo do grupo
            if (reg.data_inicio && (!gruposExistentes.get(agrupadorId).dataInicio || reg.data_inicio < gruposExistentes.get(agrupadorId).dataInicio)) {
              gruposExistentes.get(agrupadorId).dataInicio = reg.data_inicio;
            }
            if (reg.data_fim && (!gruposExistentes.get(agrupadorId).dataFim || reg.data_fim > gruposExistentes.get(agrupadorId).dataFim)) {
              gruposExistentes.get(agrupadorId).dataFim = reg.data_fim;
            }
          });

          // Calcular período solicitado
          const datasSolicitadas = datasDoPeriodo.map(d => d.split('T')[0]).sort();
          const solicitadoInicio = datasSolicitadas[0];
          const solicitadoFim = datasSolicitadas[datasSolicitadas.length - 1];

          // Criar conjunto de tarefas solicitadas para este produto específico (normalizado)
          const tarefasDoProduto = produtosComTarefasMap[produtoId] || [];
          const tarefasSolicitadas = new Set(tarefasDoProduto.map(t => String(t.tarefa_id).trim()));

          // Verificar cada grupo existente
          for (const [agrupadorId, grupo] of gruposExistentes) {
            // Verificar se o conjunto de tarefas é exatamente o mesmo
            const tarefasExistentes = grupo.tarefas;
            const temMesmasTarefas =
              tarefasSolicitadas.size === tarefasExistentes.size &&
              [...tarefasSolicitadas].every(t => tarefasExistentes.has(t));

            if (temMesmasTarefas) {
              // Verificar se há sobreposição de períodos
              // Dois períodos se sobrepõem se: (inicio1 <= fim2) && (fim1 >= inicio2)
              const periodoExistenteInicio = grupo.dataInicio;
              const periodoExistenteFim = grupo.dataFim;
              const seSobrepoe = periodoExistenteInicio <= solicitadoFim && periodoExistenteFim >= solicitadoInicio;

              if (seSobrepoe) {
                return {
                  duplicado: true,
                  produto_id: produtoId,
                  tarefas: Array.from(tarefasSolicitadas),
                  periodo_existente: `${periodoExistenteInicio} até ${periodoExistenteFim}`,
                  periodo_solicitado: temPeriodoCompleto ? `${data_inicio} até ${data_fim}` : `${solicitadoInicio} até ${solicitadoFim} (${datasSolicitadas.length} dia(s) específico(s))`
                };
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

    // Função auxiliar para buscar tipo_tarefa_id da tabela vinculados considerando herança
    // Herança: Produto → Tipo → Tarefa
    const buscarTipoTarefaIdPorTarefaEProduto = async (tarefaId, produtoId) => {
      try {
        if (!tarefaId) return null;

        const tarefaIdStr = String(tarefaId).trim();
        const tarefaIdNum = parseInt(tarefaIdStr, 10);

        if (isNaN(tarefaIdNum)) {
          console.warn('⚠️ tarefa_id não é um número válido:', tarefaIdStr);
          return null;
        }

        // Se temos produto_id, buscar primeiro considerando a herança do produto
        if (produtoId) {
          const produtoIdStr = String(produtoId).trim();
          const produtoIdNum = parseInt(produtoIdStr, 10);

          if (!isNaN(produtoIdNum)) {
            // 1. Buscar vínculo específico: produto + tarefa + tipo_tarefa (herança do produto)
            const { data: vinculadoProduto, error: errorProduto } = await supabase

              .from('vinculados')
              .select('tarefa_tipo_id')
              .eq('tarefa_id', tarefaIdNum)
              .eq('produto_id', produtoIdNum)
              .not('tarefa_tipo_id', 'is', null)
              .is('cliente_id', null)
              .is('subtarefa_id', null)
              .limit(1);

            if (!errorProduto && vinculadoProduto && vinculadoProduto.length > 0) {
              const tipoTarefaId = vinculadoProduto[0].tarefa_tipo_id;
              if (tipoTarefaId !== null && tipoTarefaId !== undefined) {
                const tipoId = typeof tipoTarefaId === 'number'
                  ? tipoTarefaId
                  : parseInt(tipoTarefaId, 10);
                if (!isNaN(tipoId)) {
                  console.log(`✅ Tipo_tarefa_id encontrado via herança do produto ${produtoId} para tarefa ${tarefaId}: ${tipoId}`);
                  return String(tipoId);
                }
              }
            }
          }
        }

        // 2. Se não encontrou com produto, buscar vínculo padrão: tarefa + tipo_tarefa (sem produto, sem cliente)
        const { data: vinculados, error: vinculadoError } = await supabase

          .from('vinculados')
          .select('tarefa_tipo_id')
          .eq('tarefa_id', tarefaIdNum)
          .not('tarefa_tipo_id', 'is', null)
          .is('produto_id', null)
          .is('cliente_id', null)
          .is('subtarefa_id', null)
          .limit(1);

        if (vinculadoError) {
          console.error('❌ Erro ao buscar tipo_tarefa_id do vinculado:', vinculadoError);
          return null;
        }

        if (vinculados && vinculados.length > 0) {
          const vinculado = vinculados[0];
          if (vinculado && vinculado.tarefa_tipo_id !== null && vinculado.tarefa_tipo_id !== undefined) {
            const tipoTarefaId = typeof vinculado.tarefa_tipo_id === 'number'
              ? vinculado.tarefa_tipo_id
              : parseInt(vinculado.tarefa_tipo_id, 10);
            if (!isNaN(tipoTarefaId)) {
              console.log(`✅ Tipo_tarefa_id encontrado via vínculo padrão para tarefa ${tarefaId}: ${tipoTarefaId}`);
              return String(tipoTarefaId); // Retornar como string (text)
            }
          }
        }

        return null;
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar tipo_tarefa_id:', error);
        return null;
      }
    };

    // Buscar tipo_tarefa_id para cada combinação produto x tarefa (considerando herança)
    console.log('🔍 Buscando tipo_tarefa_id para as tarefas considerando herança (produto → tipo → tarefa)...');
    const tipoTarefaPorProdutoTarefa = new Map(); // Chave: "produtoId_tarefaId" -> tipo_tarefa_id

    // Iterar sobre cada produto e suas tarefas para buscar o tipo_tarefa_id correto
    for (const [produtoId, tarefasDoProduto] of Object.entries(produtosComTarefasMap)) {
      for (const tarefaObj of tarefasDoProduto) {
        const tarefaId = String(tarefaObj.tarefa_id).trim();
        const chave = `${produtoId}_${tarefaId}`;

        // Buscar tipo_tarefa_id considerando a herança do produto
        const tipoTarefaId = await buscarTipoTarefaIdPorTarefaEProduto(tarefaId, produtoId);
        if (tipoTarefaId) {
          tipoTarefaPorProdutoTarefa.set(chave, tipoTarefaId);
          console.log(`✅ Produto ${produtoId} → Tarefa ${tarefaId}: tipo_tarefa_id = ${tipoTarefaId}`);
        } else {
          console.warn(`⚠️ Produto ${produtoId} → Tarefa ${tarefaId}: tipo_tarefa_id não encontrado`);
        }
      }
    }

    // NOVA LÓGICA: Criar regras (ao invés de múltiplos registros)
    // Uma regra para cada combinação produto x tarefa
    // Calcular período (data_inicio e data_fim) ou segmentos
    const datasApenasData = datasDoPeriodo.map(d => d.split('T')[0]).sort();

    // Agrupar datas em segmentos contínuos para respeitar os "gaps"
    const segmentos = await agruparDatasEmSegmentos(datasApenasData, incluirFinaisSemana, incluirFeriados);
    console.log(`📅 [TEMPO-ESTIMADO] Datas agrupadas em ${segmentos.length} segmento(s)`);
    segmentos.forEach((seg, idx) => console.log(`   - Segmento ${idx + 1}: ${seg.inicio} até ${seg.fim}`));

    // Usar período total para log/histórico, mas armazenar regras segmentadas
    const dataInicioRegra = datasApenasData[0];
    const dataFimRegra = datasApenasData[datasApenasData.length - 1];

    const regrasParaInserir = [];

    // Buscar membro_id do criador (OBRIGATÓRIO para garantir histórico sempre criado)
    let membroIdCriador = null;
    try {
      const usuarioId = req.session?.usuario?.id || null;
      if (usuarioId) {
        const { data: membro } = await supabase

          .from('membro')
          .select('id')
          .eq('usuario_id', String(usuarioId).trim())
          .maybeSingle();
        if (membro) {
          membroIdCriador = parseInt(membro.id, 10);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao buscar membro_id do criador:', error);
    }

    if (!membroIdCriador) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível identificar o criador da atribuição. É necessário ter vínculo de colaborador (membro) para criar atribuições. Faça login com um usuário vinculado a um colaborador.'
      });
    }

    // Iterar sobre cada produto e APENAS suas tarefas específicas
    Object.entries(produtosComTarefasMap).forEach(([produtoId, tarefasDoProduto]) => {
      tarefasDoProduto.forEach(tarefaObj => {
        const tarefaId = String(tarefaObj.tarefa_id).trim();
        let tempoEstimado = parseInt(tarefaObj.tempo_estimado_dia, 10);
        let tempoMinutos = tarefaObj.tempo_minutos ? parseInt(tarefaObj.tempo_minutos, 10) : null;

        // Fallback: se tempo_minutos não existe, calcular a partir de tempo_estimado_dia
        if (tempoMinutos === null && tempoEstimado > 0) {
          tempoMinutos = Math.round(tempoEstimado / 60000);
        }
        // Fallback: se tempo_estimado_dia não existe, calcular a partir de tempo_minutos
        if ((!tempoEstimado || tempoEstimado <= 0) && tempoMinutos !== null && tempoMinutos > 0) {
          tempoEstimado = tempoMinutos * 60000;
        }

        if (!tempoEstimado || tempoEstimado <= 0) {
          console.warn(`⚠️ Tarefa ${tarefaId} do produto ${produtoId} não tem tempo estimado válido, pulando...`);
          return;
        }

        // Buscar tipo_tarefa_id usando a chave produto_tarefa (considerando herança)
        const chave = `${produtoId}_${tarefaId}`;
        const tipoTarefaId = tipoTarefaPorProdutoTarefa.get(chave) || null;

        // Usar responsavel_id da tarefa se fornecido, caso contrário usar o global
        const responsavelIdParaTarefa = tarefaObj.responsavel_id
          ? String(tarefaObj.responsavel_id).trim()
          : (responsavel_id ? String(responsavel_id).trim() : null);

        if (!responsavelIdParaTarefa) {
          console.warn(`⚠️ Tarefa ${tarefaId} do produto ${produtoId} não tem responsavel_id definido, pulando...`);
          return;
        }

        // Criar regras para cada segmento desta combinação produto x tarefa
        segmentos.forEach(segmento => {
          regrasParaInserir.push({
            agrupador_id: agrupador_id,
            cliente_id: String(cliente_id).trim(),
            produto_id: produtoId ? parseInt(produtoId, 10) : null,
            tarefa_id: parseInt(tarefaId, 10),
            responsavel_id: parseInt(responsavelIdParaTarefa, 10),
            tipo_tarefa_id: tipoTarefaId,
            data_inicio: segmento.inicio,
            data_fim: segmento.fim,
            tempo_estimado_dia: tempoEstimado, // em milissegundos
            tempo_minutos: tempoMinutos,
            incluir_finais_semana: incluirFinaisSemana,
            incluir_feriados: incluirFeriados,
            created_by: membroIdCriador
          });
        });
      });
    });

    console.log(`📝 Criando ${regrasParaInserir.length} regra(s) de tempo estimado (ao invés de ${datasDoPeriodo.length} dia(s) × ${regrasParaInserir.length} combinação(ões) = ${datasDoPeriodo.length * regrasParaInserir.length} registros antigos)`);
    console.log(`   - Período: ${dataInicioRegra} até ${dataFimRegra}`);
    console.log(`   - ${produtoIdsArray.length} produto(s), ${regrasParaInserir.length} combinação(ões) produto × tarefa`);
    console.log(`   - Distribuição de tarefas por produto:`);
    Object.entries(produtosComTarefasMap).forEach(([produtoId, tarefasDoProduto]) => {
      console.log(`     * Produto ${produtoId}: ${tarefasDoProduto.length} tarefa(s)`);
      tarefasDoProduto.forEach(t => {
        const horas = Math.floor(t.tempo_estimado_dia / (1000 * 60 * 60));
        const minutos = Math.round((t.tempo_estimado_dia % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`       - Tarefa ${t.tarefa_id}: ${horas}h ${minutos}min`);
      });
    });

    // Log da primeira regra para debug
    if (regrasParaInserir.length > 0) {
      console.log('📋 Exemplo de regra:', JSON.stringify(regrasParaInserir[0], null, 2));
    }

    // 1. CRIAR HISTÓRICO PRIMEIRO (evita regras órfãs sem histórico)
    const historicoData = {
      agrupador_id: agrupador_id,
      cliente_id: String(cliente_id).trim(),
      responsavel_id: String(responsavel_id).trim(),
      usuario_criador_id: String(membroIdCriador).trim(),
      data_inicio: dataInicioRegra,
      data_fim: dataFimRegra,
      produto_ids: produtoIdsArray.map(id => String(id).trim()),
      tarefas: todasTarefasComTempo,
      is_plug_rapido: false
    };

    const { error: historicoError } = await supabase
      .from('historico_atribuicoes')
      .insert([historicoData]);

    if (historicoError) {
      console.error('❌ Erro ao criar histórico de atribuição:', historicoError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar histórico da atribuição. A atribuição não foi criada.',
        details: historicoError.message
      });
    }
    console.log('✅ Histórico de atribuição criado com sucesso');

    // 2. Inserir todas as regras (após histórico garantido)
    const { data: regrasInseridas, error } = await supabase

      .from('tempo_estimado_regra')
      .insert(regrasParaInserir)
      .select();

    if (error) {
      console.error('❌ Erro ao criar regras de tempo estimado (histórico já criado):', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      console.error('❌ Primeira regra que tentou inserir:', regrasParaInserir[0]);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar regras de tempo estimado',
        details: error.message,
        hint: error.hint || null
      });
    }

    console.log(`✅ ${regrasInseridas.length} regra(s) de tempo estimado criada(s) com sucesso`);

    // Calcular registros virtuais para retornar no formato esperado pelo frontend (compatibilidade - frontend espera registros individuais)
    const dadosInseridos = [];
    for (const regra of regrasInseridas) {
      const registrosVirtuais = await calcularRegistrosDinamicos(regra);
      dadosInseridos.push(...registrosVirtuais);
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

// GET/POST - Listar registros de tempo estimado (com paginação e filtros)
// POST aceito para evitar 414 URI Too Long quando há muitos filtros (ex.: muitos responsavel_id)
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

    const data_fonte = req.method === 'POST' ? req.body : req.query;
    console.log('🔍 [TEMPO-ESTIMADO-REGRA] req.' + (req.method === 'POST' ? 'body' : 'query') + ' (amostra):', JSON.stringify({ ...data_fonte, responsavel_id: data_fonte.responsavel_id ? (Array.isArray(data_fonte.responsavel_id) ? `[${data_fonte.responsavel_id.length} ids]` : data_fonte.responsavel_id) : undefined }, null, 2));

    const {
      page = 1,
      limit = 20,
      data = null,
      data_inicio = null,
      data_fim = null,
      cliente_status = null // 'ativo', 'inativo', ou null/undefined
    } = data_fonte;

    // Processar IDs que podem vir como array
    const cliente_id = processarParametroArray(data_fonte.cliente_id);
    const produto_id = processarParametroArray(data_fonte.produto_id);
    const tarefa_id = processarParametroArray(data_fonte.tarefa_id);

    // Aceitar responsavel_id como número ou UUID; descartar email/nome que causam 500
    const responsavel_id_raw = processarParametroArray(data_fonte.responsavel_id);
    const ehIdValido = (s) => /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const responsavel_id = responsavel_id_raw
      ? responsavel_id_raw.map(id => String(id).trim()).filter(Boolean).filter(ehIdValido)
      : null;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // FILTRO DE STATUS DE CLIENTE: Se cliente_status está presente e filtro_cliente está ativo,
    // buscar clientes filtrados por status ANTES de aplicar na query
    let clienteIdsFinais = cliente_id; // Inicializar com os IDs originais

    // Validar valores válidos para cliente_status
    const valoresValidosStatus = ['ativo', 'inativo', 'todos', null, undefined];
    const statusValido = valoresValidosStatus.includes(cliente_status) ||
      (cliente_status && String(cliente_status).toLowerCase() === 'todos');

    // Se cliente_status foi fornecido mas não é válido, retornar erro
    if (cliente_status && !statusValido) {
      return res.status(400).json({
        success: false,
        error: `Valor inválido para cliente_status: "${cliente_status}". Valores aceitos: 'ativo', 'inativo', 'todos' ou null/undefined`
      });
    }

    // Aplicar filtro de status apenas se for 'ativo' ou 'inativo' (não aplicar para 'todos' ou null)
    if (cliente_status && cliente_status !== 'todos' && (cliente_status === 'ativo' || cliente_status === 'inativo')) {
      try {
        // Buscar clientes filtrados por status
        let clientesQuery = supabase

          .from('cp_cliente')
          .select('id');

        if (cliente_status === 'ativo') {
          clientesQuery = clientesQuery.eq('status', 'ativo');
        } else if (cliente_status === 'inativo') {
          clientesQuery = clientesQuery.eq('status', 'inativo');
        }

        const { data: clientesFiltrados, error: clientesError } = await clientesQuery;

        if (clientesError) {
          console.error('❌ Erro ao buscar clientes por status:', clientesError);
          // Se houver erro, continuar sem filtrar por status
        } else if (clientesFiltrados && clientesFiltrados.length > 0) {
          const clienteIdsFiltrados = clientesFiltrados.map(c => String(c.id).trim()).filter(Boolean);

          // Se há cliente_id específicos no filtro, fazer interseção
          if (cliente_id && cliente_id.length > 0) {
            const clienteIdsLimpos = cliente_id.map(id => String(id).trim()).filter(Boolean);
            clienteIdsFinais = clienteIdsLimpos.filter(id => clienteIdsFiltrados.includes(id));
          } else {
            // Se não há cliente_id específicos, usar apenas os clientes filtrados por status
            clienteIdsFinais = clienteIdsFiltrados;
          }

          // Se após a interseção não sobrar nenhum cliente, retornar vazio
          if (clienteIdsFinais.length === 0) {
            return res.json({
              success: true,
              data: [],
              total: 0,
              page: pageNum,
              limit: limitNum,
              totalPages: 0
            });
          }
        } else {
          // Se não encontrou clientes com o status especificado, retornar vazio
          return res.json({
            success: true,
            data: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0
          });
        }
      } catch (error) {
        console.error('❌ Erro ao processar filtro de status de cliente:', error);
        // Se houver erro, continuar sem filtrar por status
      }
    }

    // NOVA LÓGICA: Buscar regras da tabela tempo_estimado_regra
    let query = supabase

      .from('tempo_estimado_regra')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    // Usar clienteIdsFinais (que pode ter sido filtrado por status) ao invés de cliente_id original
    if (clienteIdsFinais && clienteIdsFinais.length > 0) {
      const clienteIdsLimpos = clienteIdsFinais.map(id => String(id).trim()).filter(Boolean);
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
      // responsavel_id já contém apenas números válidos (filtrado anteriormente)
      console.log('🔍 [TEMPO-ESTIMADO] Filtrando por responsavel_id:', responsavel_id);
      if (responsavel_id.length === 1) {
        query = query.eq('responsavel_id', responsavel_id[0]);
      } else if (responsavel_id.length > 1) {
        query = query.in('responsavel_id', responsavel_id);
      }
    } else {
      console.log('🔍 [TEMPO-ESTIMADO] NÃO há filtro de responsavel_id - retornando regras de TODOS os responsáveis');
    }

    // NOVA LÓGICA: Filtro por período - buscar regras cujo período se sobrepõe ao período filtrado
    let aplicarFiltroPeriodo = false;
    let periodoInicioFiltro = null;
    let periodoFimFiltro = null;

    if (data_inicio && data_fim) {
      aplicarFiltroPeriodo = true;
      periodoInicioFiltro = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
      periodoFimFiltro = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;
      // Filtrar regras cujo período se sobrepõe ao período filtrado
      // Dois períodos se sobrepõem se: (regra.data_inicio <= filtro.data_fim) && (regra.data_fim >= filtro.data_inicio)
      // No Supabase, precisamos usar gte/lte com AND implícito
      query = query.lte('data_inicio', periodoFimFiltro).gte('data_fim', periodoInicioFiltro);
    } else if (data_inicio) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
      query = query.gte('data_fim', inicioFormatado); // Regra termina após início do filtro
    } else if (data_fim) {
      const fimFormatado = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;
      query = query.lte('data_inicio', fimFormatado); // Regra começa antes do fim do filtro
    }

    // Filtro por data específica - filtrar regras que incluem essa data
    if (data) {
      const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
      query = query.lte('data_inicio', dataFormatada).gte('data_fim', dataFormatada);
    }

    // IMPORTANTE: Quando há filtro de período, usar paginação automática para garantir
    // que TODAS as regras sejam retornadas (o Supabase tem limite de 1000 por padrão)
    let regrasEncontradas = [];
    let error = null;
    let count = null;

    if (aplicarFiltroPeriodo || data) {
      // Quando há filtro de período, usar paginação automática para buscar TODAS as regras
      // IMPORTANTE: Isso garante que todas as regras sejam retornadas, não apenas as primeiras 1000
      // CRÍTICO: A função criarQueryBuilder deve construir a query do ZERO a cada chamada,
      // não reutilizar a mesma instância (o Supabase query builder não pode ser reutilizado)
      try {
        const criarQueryBuilder = () => {
          // Reconstruir a query do zero a cada chamada
          let queryBuilder = supabase

            .from('tempo_estimado_regra')
            .select('*', { count: 'exact' });

          // Aplicar filtros novamente
          if (clienteIdsFinais && clienteIdsFinais.length > 0) {
            const clienteIdsLimpos = clienteIdsFinais.map(id => String(id).trim()).filter(Boolean);
            if (clienteIdsLimpos.length === 1) {
              queryBuilder = queryBuilder.eq('cliente_id', clienteIdsLimpos[0]);
            } else if (clienteIdsLimpos.length > 1) {
              queryBuilder = queryBuilder.in('cliente_id', clienteIdsLimpos);
            }
          }

          if (produto_id && produto_id.length > 0) {
            const produtoIdsLimpos = produto_id.map(id => String(id).trim()).filter(Boolean);
            if (produtoIdsLimpos.length === 1) {
              queryBuilder = queryBuilder.eq('produto_id', produtoIdsLimpos[0]);
            } else if (produtoIdsLimpos.length > 1) {
              queryBuilder = queryBuilder.in('produto_id', produtoIdsLimpos);
            }
          }

          if (tarefa_id && tarefa_id.length > 0) {
            const tarefaIdsLimpos = tarefa_id.map(id => String(id).trim()).filter(Boolean);
            if (tarefaIdsLimpos.length === 1) {
              queryBuilder = queryBuilder.eq('tarefa_id', tarefaIdsLimpos[0]);
            } else if (tarefaIdsLimpos.length > 1) {
              queryBuilder = queryBuilder.in('tarefa_id', tarefaIdsLimpos);
            }
          }

          if (responsavel_id && responsavel_id.length > 0) {
            if (responsavel_id.length === 1) {
              queryBuilder = queryBuilder.eq('responsavel_id', responsavel_id[0]);
            } else if (responsavel_id.length > 1) {
              queryBuilder = queryBuilder.in('responsavel_id', responsavel_id);
            }
          }

          // Aplicar filtro de período
          if (aplicarFiltroPeriodo) {
            queryBuilder = queryBuilder.lte('data_inicio', periodoFimFiltro).gte('data_fim', periodoInicioFiltro);
          } else if (data_inicio) {
            const inicioFormatado = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
            queryBuilder = queryBuilder.gte('data_fim', inicioFormatado);
          } else if (data_fim) {
            const fimFormatado = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;
            queryBuilder = queryBuilder.lte('data_inicio', fimFormatado);
          }

          if (data) {
            const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
            queryBuilder = queryBuilder.lte('data_inicio', dataFormatada).gte('data_fim', dataFormatada);
          }

          // Aplicar ordenação
          return queryBuilder.order('data_inicio', { ascending: false });
        };

        console.log(`🔍 [TEMPO-ESTIMADO-DEBUG] Iniciando busca paginada com filtros:`, {
          clienteIdsFinais: clienteIdsFinais?.length || 0,
          produto_id: produto_id?.length || 0,
          tarefa_id: tarefa_id?.length || 0,
          responsavel_id: responsavel_id?.length || 0,
          aplicarFiltroPeriodo,
          periodoInicioFiltro,
          periodoFimFiltro
        });

        regrasEncontradas = await buscarTodosComPaginacao(criarQueryBuilder, {
          limit: 1000,
          logProgress: true
        });
        // Quando usamos paginação automática, o count é o tamanho do array retornado
        count = regrasEncontradas.length;
        console.log(`📊 [TEMPO-ESTIMADO] Busca paginada completa: ${regrasEncontradas.length} regra(s) encontradas`);

        // DEBUG: Verificar quantas regras do Luiz Marcelo foram retornadas
        const regrasLuizMarcelo = regrasEncontradas.filter(r => String(r.responsavel_id) === '75397340197');
        console.log(`🔍 [TEMPO-ESTIMADO-DEBUG] Regras do Luiz Marcelo (75397340197) retornadas: ${regrasLuizMarcelo.length}`);
        if (regrasLuizMarcelo.length > 0) {
          console.log(`🔍 [TEMPO-ESTIMADO-DEBUG] Primeiras 3 regras do Luiz Marcelo:`, regrasLuizMarcelo.slice(0, 3).map(r => ({
            id: r.id,
            agrupador_id: r.agrupador_id,
            periodo: `${r.data_inicio} a ${r.data_fim}`,
            tempo_estimado_dia: r.tempo_estimado_dia
          })));
        } else if (regrasEncontradas.length > 0) {
          // Se há regras mas nenhuma do Luiz Marcelo, listar alguns responsáveis presentes
          const responsaveisUnicos = [...new Set(regrasEncontradas.map(r => String(r.responsavel_id)).filter(Boolean))].slice(0, 10);
          console.log(`🔍 [TEMPO-ESTIMADO-DEBUG] Nenhuma regra do Luiz Marcelo encontrada. Responsáveis presentes nas regras:`, responsaveisUnicos);
        }
      } catch (pagError) {
        console.error('❌ Erro ao buscar regras com paginação:', pagError);
        error = pagError;
      }
    } else {
      // Se não há filtro de período, aplicar paginação normalmente
      const queryComOrdenacao = query.order('data_inicio', { ascending: false });
      const queryFinal = queryComOrdenacao.range(offset, offset + limitNum - 1);
      const resultado = await queryFinal;
      regrasEncontradas = resultado.data || [];
      error = resultado.error || null;
      count = resultado.count || null;
    }

    if (error) {
      console.error('❌ Erro ao buscar regras de tempo estimado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tempo estimado',
        details: error.message
      });
    }

    console.log(`📊 Encontradas ${regrasEncontradas?.length || 0} regra(s) que correspondem aos filtros`);

    // DEBUG: Log informações sobre as regras encontradas
    if (regrasEncontradas && regrasEncontradas.length > 0) {
      console.log('🔍 [DEBUG-TEMPO-ESTIMADO] Primeiras regras encontradas:', regrasEncontradas.slice(0, 3).map(r => ({
        id: r.id,
        agrupador_id: r.agrupador_id,
        cliente_id: r.cliente_id,
        tarefa_id: r.tarefa_id,
        responsavel_id: r.responsavel_id,
        periodo: `${r.data_inicio} a ${r.data_fim}`,
        incluir_finais_semana: r.incluir_finais_semana,
        incluir_feriados: r.incluir_feriados
      })));
    }

    const regrasFiltradas = regrasEncontradas || [];

    // NOVA LÓGICA: Se houver filtro por período (data_inicio e data_fim) ou parâmetro 'data',
    // expandir as regras em registros dinâmicos para o PainelUsuario e para a Agenda (semana/mês).
    // Normalizar datas para comparação (remover hora se houver)
    const dataInicioNormalizada = data_inicio ? (data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio) : null;
    const dataFimNormalizada = data_fim ? (data_fim.includes('T') ? data_fim.split('T')[0] : data_fim) : null;
    const deveExpandirRegras = (dataInicioNormalizada && dataFimNormalizada) || data;

    // DEBUG: Log informações sobre filtros e decisão de expansão
    console.log('🔍 [DEBUG-TEMPO-ESTIMADO] Parâmetros recebidos:', {
      data_inicio,
      data_fim,
      data,
      dataInicioNormalizada,
      dataFimNormalizada,
      deveExpandirRegras,
      totalRegrasEncontradas: regrasFiltradas.length
    });

    let dadosParaRetornar = [];
    let totalParaRetornar = 0;

    if (deveExpandirRegras) {
      // Expandir regras em registros dinâmicos (uma data ou intervalo, ex.: Agenda semana/mês)
      console.log('🔄 Expandindo regras em registros dinâmicos para o período solicitado');

      // Determinar data(s) para filtrar (único dia ou intervalo)
      let dataInicioFiltro = null;
      let dataFimFiltro = null;

      if (data) {
        const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
        dataInicioFiltro = dataFormatada;
        dataFimFiltro = dataFormatada;
      } else if (dataInicioNormalizada && dataFimNormalizada) {
        dataInicioFiltro = dataInicioNormalizada;
        dataFimFiltro = dataFimNormalizada;
      }

      // Cache de feriados para otimização (reutilizar entre regras)
      const cacheFeriados = {};

      // Expandir cada regra em registros
      // NOTA: calcularRegistrosDinamicos já filtra pelo período fornecido, então não precisamos filtrar novamente
      const todosRegistros = [];
      for (const regra of regrasFiltradas) {
        try {
          const registrosExpandidos = await calcularRegistrosDinamicos(
            regra,
            dataInicioFiltro,
            dataFimFiltro,
            cacheFeriados
          );

          // DEBUG: Log informações sobre a expansão de cada regra
          console.log(`🔍 [DEBUG-TEMPO-ESTIMADO] Regra ${regra.id} expandida:`, {
            regraId: regra.id,
            agrupadorId: regra.agrupador_id,
            periodoRegra: `${regra.data_inicio} a ${regra.data_fim}`,
            registrosGerados: registrosExpandidos.length,
            dataFiltro: dataInicioFiltro
          });

          // calcularRegistrosDinamicos já filtra pelo período, então adicionamos todos os registros retornados
          todosRegistros.push(...registrosExpandidos);
        } catch (error) {
          console.error(`❌ Erro ao expandir regra ${regra.id}:`, error);
        }
      }

      // ======== JOIN COM TABELA DE STATUS (em lote) ========
      // Buscar todos os status de uma vez para performance
      if (todosRegistros.length > 0) {
        try {
          const regraIdsUnicos = [...new Set(todosRegistros.map(r => r.regra_id).filter(Boolean))];
          const datasUnicas = [...new Set(todosRegistros.map(r => {
            const d = r.data ? (r.data.includes('T') ? r.data.split('T')[0] : r.data) : null;
            return d;
          }).filter(Boolean))];
          const responsavelIdsUnicos = [...new Set(todosRegistros.map(r => String(r.responsavel_id)).filter(Boolean))];

          if (regraIdsUnicos.length > 0 && datasUnicas.length > 0 && responsavelIdsUnicos.length > 0) {
            // Tentar buscar com observação, se falhar (ex: coluna não existe), tentar sem
            let { data: statusRecords, error: statusError } = await supabase
              .from('tempo_estimado_status')
              .select('regra_id, data, responsavel_id, status, observacao')
              .in('regra_id', regraIdsUnicos)
              .in('data', datasUnicas)
              .in('responsavel_id', responsavelIdsUnicos);

            if (statusError && (statusError.code === '42703' || statusError.message?.includes('observacao'))) {
              console.warn('⚠️ [DB] Coluna observacao não encontrada, buscando apenas status');
              const retry = await supabase
                .from('tempo_estimado_status')
                .select('regra_id, data, responsavel_id, status')
                .in('regra_id', regraIdsUnicos)
                .in('data', datasUnicas)
                .in('responsavel_id', responsavelIdsUnicos);
              statusRecords = retry.data;
              statusError = retry.error;
            }

            if (!statusError && statusRecords && statusRecords.length > 0) {
              // Criar mapa para lookup rápido: chave = "regraId|data|responsavelId"
              const statusMap = new Map();
              statusRecords.forEach(sr => {
                const dataFormatada = sr.data ? (sr.data.includes('T') ? sr.data.split('T')[0] : sr.data) : sr.data;
                const chave = `${sr.regra_id}|${dataFormatada}|${sr.responsavel_id}`;
                statusMap.set(chave, { status: sr.status, observacao: sr.observacao });
              });

              // Aplicar status a cada registro virtual
              todosRegistros.forEach(reg => {
                const dataReg = reg.data ? (reg.data.includes('T') ? reg.data.split('T')[0] : reg.data) : reg.data;
                const chave = `${reg.regra_id}|${dataReg}|${reg.responsavel_id}`;
                const statusData = statusMap.get(chave);
                reg.status = statusData?.status || 'NAO_INICIADA';
                reg.observacao = statusData?.observacao || null;
              });
              console.log(`✅ [STATUS] Aplicados ${statusRecords.length} status de ${todosRegistros.length} registros virtuais`);
            } else {
              // Se não há registros de status ou houve erro, definir todos como NAO_INICIADA
              todosRegistros.forEach(reg => { reg.status = 'NAO_INICIADA'; });
              if (statusError) console.warn('⚠️ Erro ao buscar status:', statusError.message);
            }
          } else {
            todosRegistros.forEach(reg => { reg.status = 'NAO_INICIADA'; });
          }
        } catch (statusErr) {
          console.error('❌ Erro ao fazer JOIN com status:', statusErr);
          todosRegistros.forEach(reg => { reg.status = 'NAO_INICIADA'; });
        }
      }
      // ======== FIM JOIN STATUS ========

      dadosParaRetornar = todosRegistros;
      totalParaRetornar = todosRegistros.length;

      // DEBUG: Log detalhado de amostra dos registros gerados
      if (todosRegistros.length > 0) {
        console.log(`🔍 [DEBUG-TEMPO-ESTIMADO] Amostra do primeiro registro expandido:`, {
          id: todosRegistros[0].id,
          regra_id: todosRegistros[0].regra_id, // CRÍTICO: Verificar se isso existe
          tarefa_id: todosRegistros[0].tarefa_id,
          cliente_id: todosRegistros[0].cliente_id,
          responsavel_id: todosRegistros[0].responsavel_id,
          data: todosRegistros[0].data,
          status: todosRegistros[0].status
        });
      }

      // DEBUG: Log amostra dos registros gerados
      if (todosRegistros.length > 0) {
        console.log(`🔍 [DEBUG-TEMPO-ESTIMADO] Amostra do primeiro registro:`, {
          id: todosRegistros[0].id,
          data: todosRegistros[0].data,
          cliente_id: todosRegistros[0].cliente_id,
          tarefa_id: todosRegistros[0].tarefa_id,
          responsavel_id: todosRegistros[0].responsavel_id
        });
      }

      console.log(`✅ Expandidas ${regrasFiltradas.length} regra(s) em ${totalParaRetornar} registro(s) para a data ${dataInicioFiltro || 'especificada'}`);
    } else {
      // Comportamento original: retornar regras sem expandir
      dadosParaRetornar = regrasFiltradas;
      totalParaRetornar = count || regrasFiltradas.length;
    }

    // Buscar fotos de perfil dos responsáveis
    const dadosParaRetornarComFotos = dadosParaRetornar;

    if (dadosParaRetornarComFotos && dadosParaRetornarComFotos.length > 0) {
      // Extrair responsavel_ids únicos
      const responsavelIds = [...new Set(
        dadosParaRetornarComFotos
          .map(r => r.responsavel_id)
          .filter(Boolean)
      )];

      if (responsavelIds.length > 0) {
        // Buscar membros por responsavel_id
        const { data: membros, error: membrosError } = await supabase

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

              // Adicionar foto_perfil aos dados (regras ou registros)
              dadosParaRetornarComFotos.forEach(item => {
                if (item.responsavel_id) {
                  const responsavelIdStr = String(item.responsavel_id);
                  const usuarioId = membroMap.get(responsavelIdStr);
                  if (usuarioId) {
                    const fotoPerfil = usuarioMap.get(String(usuarioId));
                    item.responsavel_foto_perfil = fotoPerfil || null;
                  } else {
                    item.responsavel_foto_perfil = null;
                  }
                } else {
                  item.responsavel_foto_perfil = null;
                }
              });
            } else {
              // Se não encontrar usuarios, definir foto_perfil como null
              dadosParaRetornarComFotos.forEach(item => {
                item.responsavel_foto_perfil = null;
              });
            }
          } else {
            // Se não houver usuario_ids, definir foto_perfil como null
            dadosParaRetornarComFotos.forEach(item => {
              item.responsavel_foto_perfil = null;
            });
          }
        } else {
          // Se não encontrar membros, definir foto_perfil como null
          dadosParaRetornarComFotos.forEach(item => {
            item.responsavel_foto_perfil = null;
          });
        }
      } else {
        // Se não houver responsavel_ids, definir foto_perfil como null
        dadosParaRetornarComFotos.forEach(item => {
          item.responsavel_foto_perfil = null;
        });
      }
    }

    // Aplicar paginação apenas se não expandimos as regras (comportamento original)
    // Quando expandimos, já retornamos apenas os registros da data específica
    let dadosPaginados = dadosParaRetornarComFotos;
    if (!deveExpandirRegras) {
      // Paginação para regras (comportamento original)
      const inicioPagina = offset;
      const fimPagina = offset + limitNum;
      dadosPaginados = dadosParaRetornarComFotos.slice(inicioPagina, fimPagina);
    }

    const totalPagesCalculado = Math.ceil(totalParaRetornar / limitNum);

    const tipoDados = deveExpandirRegras ? 'registro(s)' : 'regra(s)';
    console.log(`📄 Retornando ${dadosPaginados.length} ${tipoDados} (total: ${totalParaRetornar}, página: ${pageNum}, totalPages: ${totalPagesCalculado})`);

    // DEBUG: Log formato dos dados antes de retornar
    if (dadosPaginados.length > 0) {
      const primeiroItem = dadosPaginados[0];
      console.log('🔍 [DEBUG-TEMPO-ESTIMADO] Formato do primeiro item retornado:', {
        temId: !!primeiroItem.id,
        temTempoEstimadoId: !!primeiroItem.tempo_estimado_id,
        temData: !!primeiroItem.data,
        formatoData: primeiroItem.data ? primeiroItem.data.substring(0, 10) : null,
        temTempoEstimadoDia: !!primeiroItem.tempo_estimado_dia,
        temClienteId: !!primeiroItem.cliente_id,
        temTarefaId: !!primeiroItem.tarefa_id,
        temResponsavelId: !!primeiroItem.responsavel_id,
        temResponsavelFotoPerfil: 'responsavel_foto_perfil' in primeiroItem,
        keys: Object.keys(primeiroItem)
      });
    }

    return res.json({
      success: true,
      data: dadosPaginados || [],
      count: dadosPaginados?.length || 0,
      total: totalParaRetornar || 0,
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

    // NOTA: Este endpoint busca apenas na tabela antiga tempo_estimado
    // IDs virtuais (gerados dinamicamente a partir de regras) não existem nesta tabela
    // e não podem ser buscados diretamente por ID, então retornarão 404
    console.log(`🔍 [GET-TEMPO-ESTIMADO-POR-ID] Buscando tempo estimado com ID: ${id}`);

    const { data: tempoEstimado, error } = await supabase

      .from('tempo_estimado')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // Para IDs virtuais ou quando a tabela não existe, retornar 404 em vez de 500
    // Isso evita erros no frontend quando busca IDs virtuais
    if (error || !tempoEstimado) {
      if (error) {
        console.log(`⚠️ [GET-TEMPO-ESTIMADO-POR-ID] Erro ao buscar (provavelmente ID virtual ou tabela não acessível): ${id}`);
      } else {
        console.log(`⚠️ [GET-TEMPO-ESTIMADO-POR-ID] Tempo estimado não encontrado para ID: ${id}`);
      }
      return res.status(404).json({
        success: false,
        error: 'Tempo estimado não encontrado'
      });
    }

    console.log(`✅ [GET-TEMPO-ESTIMADO-POR-ID] Tempo estimado encontrado para ID: ${id}`);
    return res.json({
      success: true,
      data: tempoEstimado
    });
  } catch (error) {
    console.error('❌ [GET-TEMPO-ESTIMADO-POR-ID] Erro inesperado ao buscar tempo estimado:', error);
    console.error('❌ [GET-TEMPO-ESTIMADO-POR-ID] Stack trace:', error.stack);
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

      // Se a tarefa_id foi alterada, buscar o tipo_tarefa_id correspondente
      if (dadosUpdate.tarefa_id) {
        // Função auxiliar para buscar tipo_tarefa_id
        const buscarTipoTarefaIdPorTarefa = async (tarefaId) => {
          try {
            const tarefaIdNum = parseInt(tarefaId, 10);
            if (isNaN(tarefaIdNum)) return null;

            const { data: vinculados, error } = await supabase

              .from('vinculados')
              .select('tarefa_tipo_id')
              .eq('tarefa_id', tarefaIdNum)
              .not('tarefa_tipo_id', 'is', null)
              .is('produto_id', null)
              .is('cliente_id', null)
              .is('subtarefa_id', null)
              .limit(1);

            if (error || !vinculados || vinculados.length === 0) return null;

            const tipoTarefaId = vinculados[0].tarefa_tipo_id;
            return tipoTarefaId ? String(tipoTarefaId) : null;
          } catch (error) {
            console.error('❌ Erro ao buscar tipo_tarefa_id:', error);
            return null;
          }
        };

        const tipoTarefaId = await buscarTipoTarefaIdPorTarefa(dadosUpdate.tarefa_id);
        if (tipoTarefaId) {
          dadosUpdate.tipo_tarefa_id = tipoTarefaId;
          console.log(`✅ Tipo_tarefa_id atualizado para tarefa ${dadosUpdate.tarefa_id}: ${tipoTarefaId}`);
        } else {
          dadosUpdate.tipo_tarefa_id = null;
          console.warn(`⚠️ Tipo_tarefa_id não encontrado para tarefa ${dadosUpdate.tarefa_id}`);
        }
      } else {
        // Se tarefa_id foi removido, remover também tipo_tarefa_id
        dadosUpdate.tipo_tarefa_id = null;
      }
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
    const { cliente_id, grupos } = req.body;

    if (!agrupador_id) {
      return res.status(400).json({ success: false, error: 'agrupador_id é obrigatório' });
    }

    if (!cliente_id) {
      return res.status(400).json({ success: false, error: 'cliente_id é obrigatório' });
    }

    // Função auxiliar local para buscar tipo_tarefa_id
    const buscarTipoTarefaIdPorTarefa = async (tarefaId) => {
      try {
        if (!tarefaId) return null;
        const tarefaIdStr = String(tarefaId).trim();
        const tarefaIdNum = parseInt(tarefaIdStr, 10);
        if (isNaN(tarefaIdNum)) return null;

        const { data: vinculados, error } = await supabase

          .from('vinculados')
          .select('tarefa_tipo_id')
          .eq('tarefa_id', tarefaIdNum)
          .not('tarefa_tipo_id', 'is', null)
          .is('produto_id', null)
          .is('cliente_id', null)
          .is('subtarefa_id', null)
          .limit(1);

        if (error || !vinculados || vinculados.length === 0) return null;
        return vinculados[0].tarefa_tipo_id ? String(vinculados[0].tarefa_tipo_id) : null;
      } catch (error) {
        console.error('❌ Erro ao buscar tipo_tarefa_id:', error);
        return null;
      }
    };

    // Função auxiliar para processar um grupo de regras
    const processarGrupo = async (grupoDados) => {
      const {
        produtos_com_tarefas,
        data_inicio,
        data_fim,
        responsavel_id,
        incluir_finais_semana = true,
        incluir_feriados = true,
        datas_individuais = []
      } = grupoDados;

      const temPeriodoCompleto = data_inicio && data_fim;
      const temDatasIndividuais = Array.isArray(datas_individuais) && datas_individuais.length > 0;

      if (!temPeriodoCompleto && !temDatasIndividuais) {
        throw new Error('Grupo inválido: É necessário fornecer data_inicio e data_fim OU datas_individuais');
      }

      if (!produtos_com_tarefas || typeof produtos_com_tarefas !== 'object' || Object.keys(produtos_com_tarefas).length === 0) {
        throw new Error('Grupo inválido: É necessário fornecer "produtos_com_tarefas"');
      }

      let temResponsavelNoGrupo = !!responsavel_id;
      for (const list of Object.values(produtos_com_tarefas)) {
        for (const t of list) {
          if (t.responsavel_id) temResponsavelNoGrupo = true;
        }
      }
      if (!temResponsavelNoGrupo) {
        throw new Error('Grupo inválido: responsavel_id é obrigatório (global ou nas tarefas)');
      }

      const incFinaisSemanaBool = incluir_finais_semana === undefined ? true : Boolean(incluir_finais_semana);
      const incFeriadosBool = incluir_feriados === undefined ? true : Boolean(incluir_feriados);

      let datasDoPeriodo = [];
      if (temDatasIndividuais && !temPeriodoCompleto) {
        datasDoPeriodo = await processarDatasIndividuais(datas_individuais, incFinaisSemanaBool, incFeriadosBool);
      } else if (temPeriodoCompleto) {
        const todasDatas = await gerarDatasDoPeriodo(data_inicio, data_fim, incFinaisSemanaBool, incFeriadosBool);
        if (temDatasIndividuais) {
          const datasIndividuaisSet = new Set(datas_individuais);
          datasDoPeriodo = todasDatas.filter(data => datasIndividuaisSet.has(data.split('T')[0]));
        } else {
          datasDoPeriodo = todasDatas;
        }
      }

      if (datasDoPeriodo.length === 0) {
        // Ignorar grupos sem datas válidas mas não falhar tudo? Não, melhor falhar.
        throw new Error('Nenhuma data válida encontrada para o grupo.');
      }

      const datasApenasData = datasDoPeriodo.map(d => d.split('T')[0]).sort();
      const segmentos = await agruparDatasEmSegmentos(datasApenasData, incFinaisSemanaBool, incFeriadosBool);

      const tarefasIdsDoGrupo = new Set();
      Object.values(produtos_com_tarefas).forEach(l => l.forEach(t => tarefasIdsDoGrupo.add(String(t.tarefa_id).trim())));

      const tipoTarefaMap = new Map();
      for (const tId of tarefasIdsDoGrupo) {
        const tipoId = await buscarTipoTarefaIdPorTarefa(tId);
        if (tipoId) tipoTarefaMap.set(tId, tipoId);
      }

      const regrasDoGrupo = [];
      for (const [produtoId, tarefasList] of Object.entries(produtos_com_tarefas)) {
        for (const t of tarefasList) {
          const tId = String(t.tarefa_id).trim();
          const tipoId = tipoTarefaMap.get(tId) || null;
          const respId = t.responsavel_id || responsavel_id;
          let tempoEstimado = t.tempo_estimado_dia ? parseInt(t.tempo_estimado_dia, 10) : null;
          let tempoMinutos = t.tempo_minutos ? parseInt(t.tempo_minutos, 10) : null;

          // Fallback: se tempo_minutos não existe, calcular a partir de tempo_estimado_dia
          if (tempoMinutos === null && tempoEstimado !== null && tempoEstimado > 0) {
            tempoMinutos = Math.round(tempoEstimado / 60000);
          }
          // Fallback: se tempo_estimado_dia não existe, calcular a partir de tempo_minutos
          if ((tempoEstimado === null || tempoEstimado <= 0) && tempoMinutos !== null && tempoMinutos > 0) {
            tempoEstimado = tempoMinutos * 60000;
          }

          if (!respId || !tempoEstimado || tempoEstimado <= 0) continue;

          for (const seg of segmentos) {
            regrasDoGrupo.push({
              agrupador_id,
              cliente_id: String(cliente_id).trim(),
              produto_id: String(produtoId).trim(),
              tarefa_id: parseInt(tId, 10),
              tipo_tarefa_id: tipoId ? parseInt(tipoId, 10) : null,
              responsavel_id: String(respId).trim(),
              data_inicio: seg.inicio,
              data_fim: seg.fim,
              tempo_estimado_dia: tempoEstimado,
              tempo_minutos: tempoMinutos,
              incluir_finais_semana: incFinaisSemanaBool,
              incluir_feriados: incFeriadosBool,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
      return regrasDoGrupo;
    };

    let regrasParaInserirTotal = [];

    if (grupos && Array.isArray(grupos) && grupos.length > 0) {
      console.log(`📦 [UPDATE-AGRUPADOR] Processando ${grupos.length} grupos recebidos.`);
      for (const g of grupos) {
        const regras = await processarGrupo(g);
        regrasParaInserirTotal.push(...regras);
      }
    } else {
      // Modo Legacy
      const grupoUnico = {
        produtos_com_tarefas: req.body.produtos_com_tarefas,
        data_inicio: req.body.data_inicio,
        data_fim: req.body.data_fim,
        responsavel_id: req.body.responsavel_id,
        incluir_finais_semana: req.body.incluir_finais_semana,
        incluir_feriados: req.body.incluir_feriados,
        datas_individuais: req.body.datas_individuais
      };

      // Fallback para req.body direto se produtos_com_tarefas não existir
      if (!grupoUnico.produtos_com_tarefas && (req.body.produto_ids || req.body.tarefa_ids)) {
        // Construção manual simplificada para fallback
        const pMap = {};
        const pIds = req.body.produto_ids || [];
        const tList = [];

        const tIds = req.body.tarefa_ids || [];
        if (tIds.length > 0) {
          tIds.forEach(tid => tList.push({
            tarefa_id: tid,
            tempo_estimado_dia: req.body.tempo_estimado_dia,
            responsavel_id: req.body.responsavel_id
          }));
        } else if (req.body.tarefas) {
          req.body.tarefas.forEach(t => tList.push(t));
        }

        if (Array.isArray(pIds)) {
          pIds.forEach(pid => pMap[pid] = tList);
        }
        grupoUnico.produtos_com_tarefas = pMap;
      }

      if (!grupoUnico.produtos_com_tarefas || Object.keys(grupoUnico.produtos_com_tarefas).length === 0) {
        // Se ainda assim falhar, lançar erro ou deixar processarGrupo reclamar
      }

      const regras = await processarGrupo(grupoUnico);
      regrasParaInserirTotal.push(...regras);
    }

    // Deletar TODAS as regras antigas deste agrupador (Operação Atômica Lógica)
    const { error: deleteError } = await supabase

      .from('tempo_estimado_regra')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      return res.status(500).json({ success: false, error: 'Erro ao limpar regras antigas', details: deleteError.message });
    }

    // Inserir Novas Regras
    if (regrasParaInserirTotal.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < regrasParaInserirTotal.length; i += batchSize) {
        const lote = regrasParaInserirTotal.slice(i, i + batchSize);
        const { error: insertError } = await supabase

          .from('tempo_estimado_regra')
          .insert(lote);

        if (insertError) {
          console.error('❌ Erro ao inserir lote de regras:', insertError);
          return res.status(500).json({ success: false, error: 'Erro ao salvar novas regras', details: insertError.message });
        }
      }
    }

    console.log(`✅ Agrupamento ${agrupador_id} atualizado com ${regrasParaInserirTotal.length} novas regras.`);

    // Atualizar período do histórico e lista de tarefas no JSON
    try {
      console.log('🔄 Atualizando tarefas e período no histórico de atribuição:', agrupador_id);

      // Consolidar tarefas para o histórico a partir das regras geradas
      // O histórico precisa de uma lista de objetos { tarefa_id, tempo_estimado_dia }
      // Como regrasParaInserirTotal é "expandido" por segmentos de datas, precisamos desduplicar por (tarefa_id, tempo)

      const tarefasMap = new Map(); // Key: tarefa_id -> { tarefa_id, tempo_estimado_dia }

      regrasParaInserirTotal.forEach(regra => {
        const tId = String(regra.tarefa_id).trim();
        // Se a tarefa já existe, mas com tempo diferente (e.g. produtos diferentes), 
        // idealmente o histórico deveria suportar isso, mas é uma lista simples.
        // Vamos manter a última ocorrência ou a maior.
        // Para simplificar e garantir visualização, adicionamos se não existir.
        if (!tarefasMap.has(tId)) {
          tarefasMap.set(tId, {
            tarefa_id: tId,
            tempo_estimado_dia: regra.tempo_estimado_dia
          });
        }
      });

      const tarefasParaHistorico = Array.from(tarefasMap.values());

      // Coletar produtos únicos das regras
      const produtosIdsUnicos = [...new Set(regrasParaInserirTotal.map(r => String(r.produto_id).trim()))];

      // Atualizar historico_atribuicoes
      const historicoUpdate = {
        updated_at: new Date().toISOString(),
        produto_ids: produtosIdsUnicos,
        tarefas: tarefasParaHistorico,
        // data_inicio e data_fim serão recalculados pelo recalcularPeriodoHistorico, 
        // mas podemos já passar algo aproximado aqui se quisermos, 
        // porém é mais seguro deixar o recalcularPeriodoHistorico (que olha para tempo_estimado, mas aqui estamos inserindo em tempo_estimado_regra...)

        // CORREÇÃO: recalcularPeriodoHistorico olha para 'tempo_estimado' (tabela de registros virtuais expandidos?)
        // Se a tabela 'tempo_estimado' não for mais usada e só usarmos 'tempo_estimado_regra', o recalcula pode falhar.
        // No entanto, assumindo que as rotas de leitura expandem as regras, o histórico deve refletir a regra.
        // Vamos forçar as datas do histórico com base nas regras inseridas, pois é mais preciso agora.
      };

      // Calcular datas min/max das regras
      if (regrasParaInserirTotal.length > 0) {
        const datasInicio = regrasParaInserirTotal.map(r => r.data_inicio).sort();
        const datasFim = regrasParaInserirTotal.map(r => r.data_fim).sort();
        historicoUpdate.data_inicio = datasInicio[0];
        historicoUpdate.data_fim = datasFim[datasFim.length - 1];
      }

      // Se cliente mudou (payload de update tem cliente_id)
      if (cliente_id) historicoUpdate.cliente_id = String(cliente_id).trim();

      const { error: historicoError } = await supabase

        .from('historico_atribuicoes')
        .update(historicoUpdate)
        .eq('agrupador_id', agrupador_id);

      if (historicoError) {
        console.error('⚠️ Erro ao atualizar histórico de atribuição:', historicoError);
      } else {
        console.log('✅ Histórico de atribuição atualizado com sucesso (tarefas e período)');
      }

    } catch (errHistorico) {
      console.error('⚠️ Erro não fatal ao atualizar histórico:', errHistorico);
    }

    // Podemos manter a chamada, mas ela pode ser redundante se já atualizamos acima. 
    // Mal não faz, serve de dupla checagem se ela funcionar com regras.
    // await recalcularPeriodoHistorico(agrupador_id); 

    return res.json({
      success: true,
      message: 'Atribuição atualizada com sucesso',
      count: regrasParaInserirTotal.length
    });

  } catch (error) {
    console.error('Erro inesperado ao atualizar agrupamento:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}


// DELETE - Deletar todas as regras de um agrupamento
async function deletarTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    // NOVA LÓGICA: Buscar quantas regras serão deletadas
    const { count, error: countError } = await supabase

      .from('tempo_estimado_regra')
      .select('*', { count: 'exact', head: true })
      .eq('agrupador_id', agrupador_id);

    if (countError) {
      console.error('❌ Erro ao contar regras:', countError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar agrupamento',
        details: countError.message
      });
    }

    // Deletar todas as regras do agrupamento
    const { error } = await supabase

      .from('tempo_estimado_regra')
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

    console.log(`✅ Agrupamento ${agrupador_id} deletado: ${count || 0} regra(s) removida(s)`);

    return res.json({
      success: true,
      count: count || 0,
      message: `${count || 0} regra(s) deletada(s) com sucesso!`
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

// GET - Buscar registros por agrupador_id (calculados dinamicamente das regras)
async function getTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;

    if (!agrupador_id) {
      return res.status(400).json({
        success: false,
        error: 'agrupador_id é obrigatório'
      });
    }

    // NOVA LÓGICA: Buscar regras do agrupador
    const { data: regras, error } = await supabase

      .from('tempo_estimado_regra')
      .select('*')
      .eq('agrupador_id', agrupador_id)
      .order('data_inicio', { ascending: true });

    if (error) {
      console.error('Erro ao buscar regras por agrupador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros',
        details: error.message
      });
    }

    // Calcular registros dinâmicos para cada regra
    const registros = [];
    if (regras && regras.length > 0) {
      for (const regra of regras) {
        const registrosVirtuais = await calcularRegistrosDinamicos(regra);
        registros.push(...registrosVirtuais);
      }
    }

    // Ordenar por data
    registros.sort((a, b) => {
      const dataA = new Date(a.data || 0);
      const dataB = new Date(b.data || 0);
      return dataA - dataB;
    });

    return res.json({
      success: true,
      data: registros || [],
      count: registros?.length || 0,
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

// GET/POST - Calcular tempo estimado total (Agregado por entidade)
// Agregação em SQL no banco (RPC) para evitar O(n*dias) em memória. Fallback otimizado sem explosão.
async function getTempoEstimadoTotal(req, res) {
  try {
    const processarParametroArray = (param) => {
      if (!param) return null;
      if (Array.isArray(param)) {
        return param.filter(Boolean);
      }
      if (typeof param === 'string' && param.includes(',')) {
        return param.split(',').map(id => id.trim()).filter(Boolean);
      }
      return [String(param).trim()].filter(Boolean);
    };

    const data_fonte = req.method === 'POST' ? req.body : req.query;

    const {
      data_inicio = null,
      data_fim = null,
      cliente_status = null,
      considerarFinaisDeSemana,
      considerarFeriados,
      agrupar_por
    } = data_fonte;

    const considerarFinaisSemana = considerarFinaisDeSemana !== undefined
      ? (considerarFinaisDeSemana === 'true' || considerarFinaisDeSemana === true)
      : true;
    const considerarFeriadosBool = considerarFeriados !== undefined
      ? (considerarFeriados === 'true' || considerarFeriados === true)
      : true;

    const cliente_id = processarParametroArray(data_fonte.cliente_id);
    const produto_id = processarParametroArray(data_fonte.produto_id);
    const tarefa_id = processarParametroArray(data_fonte.tarefa_id);
    const responsavel_id_raw = processarParametroArray(data_fonte.responsavel_id);
    const responsavel_id = responsavel_id_raw
      ? responsavel_id_raw.map(id => String(id).trim()).filter(Boolean)
      : null;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'data_inicio e data_fim são obrigatórios'
      });
    }

    const pInicio = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
    const pFim = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;

    let groupKey = agrupar_por;
    if (!groupKey) {
      if (responsavel_id && responsavel_id.length > 0) groupKey = 'responsavel';
      else if (cliente_id && cliente_id.length > 0) groupKey = 'cliente';
      else if (produto_id && produto_id.length > 0) groupKey = 'produto';
      else groupKey = 'tarefa';
    }

    // Filtro de status de cliente (reduz lista de cliente_ids quando ativo/inativo)
    let clienteIdsFinais = cliente_id;
    if (cliente_status && cliente_status !== 'todos' && (cliente_status === 'ativo' || cliente_status === 'inativo')) {
      try {
        let clientesQuery = supabase.from('cp_cliente').select('id');
        if (cliente_status === 'ativo') clientesQuery = clientesQuery.eq('status', 'ativo');
        else if (cliente_status === 'inativo') clientesQuery = clientesQuery.eq('status', 'inativo');

        const { data: clientesFiltrados } = await clientesQuery;
        if (clientesFiltrados) {
          const idsFiltrados = clientesFiltrados.map(c => String(c.id).trim());
          if (cliente_id && cliente_id.length > 0) {
            clienteIdsFinais = cliente_id.filter(id => idsFiltrados.includes(id));
          } else {
            clienteIdsFinais = idsFiltrados;
          }
          if (clienteIdsFinais.length === 0) {
            return res.json({ success: true, data: {} });
          }
        }
      } catch (e) {
        console.error('Erro filtro status cliente:', e);
      }
    }

    // 1) Tentar agregação via RPC (SQL no banco – sem explosão em memória)
    const pResponsavelIds = (responsavel_id && responsavel_id.length > 0) ? responsavel_id : null;
    const pClienteIds = (clienteIdsFinais && clienteIdsFinais.length > 0) ? clienteIdsFinais : null;
    const pProdutoIds = (produto_id && produto_id.length > 0) ? produto_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null;
    const pTarefaIds = (tarefa_id && tarefa_id.length > 0) ? tarefa_id.map(id => parseInt(id, 10)).filter(n => !isNaN(n)) : null;

    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_tempo_estimado_total_agregado', {
      p_data_inicio: pInicio,
      p_data_fim: pFim,
      p_considerar_finais_semana: considerarFinaisSemana,
      p_cliente_ids: pClienteIds,
      p_responsavel_ids: pResponsavelIds,
      p_produto_ids: pProdutoIds,
      p_tarefa_ids: pTarefaIds,
      p_agrupar_por: groupKey
    });

    if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
      const resultados = {};
      rpcRows.forEach(row => {
        if (row && row.entity_id != null) {
          const total = Number(row.total_ms) || 0;
          resultados[String(row.entity_id).trim()] = total;
        }
      });
      return res.json({ success: true, data: resultados });
    }

    // 2) Fallback: agregação em Node sem explosão (apenas contagem de dias por regra, sem array de registros)
    const criarQueryBuilder = () => {
      let queryBuilder = supabase.from('tempo_estimado_regra').select('id, responsavel_id, cliente_id, produto_id, tarefa_id, data_inicio, data_fim, tempo_estimado_dia, incluir_finais_semana');
      if (clienteIdsFinais && clienteIdsFinais.length > 0) queryBuilder = queryBuilder.in('cliente_id', clienteIdsFinais);
      if (produto_id && produto_id.length > 0) queryBuilder = queryBuilder.in('produto_id', produto_id);
      if (tarefa_id && tarefa_id.length > 0) queryBuilder = queryBuilder.in('tarefa_id', tarefa_id);
      if (responsavel_id && responsavel_id.length > 0) queryBuilder = queryBuilder.in('responsavel_id', responsavel_id);
      queryBuilder = queryBuilder.lte('data_inicio', pFim).gte('data_fim', pInicio);
      return queryBuilder.order('data_inicio', { ascending: false });
    };

    const regrasEncontradas = await buscarTodosComPaginacao(criarQueryBuilder, { limit: 5000, logProgress: true });
    const cacheFeriados = {};
    const resultados = {};

    for (const regra of regrasEncontradas) {
      try {
        const incluirFinaisSemanaRegra = considerarFinaisSemana && (regra.incluir_finais_semana !== false);
        const expandidos = await calcularRegistrosDinamicos(regra, pInicio, pFim, cacheFeriados, incluirFinaisSemanaRegra, considerarFeriadosBool);
        const qtdDias = expandidos.length;
        if (qtdDias === 0) continue;

        let tempoMs = Number(regra.tempo_estimado_dia) || 0;
        if (tempoMs > 0 && tempoMs < 1000) tempoMs = Math.round(tempoMs * 3600000);
        const totalRegra = qtdDias * tempoMs;

        let key = null;
        if (groupKey === 'cliente') key = String(regra.cliente_id).trim();
        else if (groupKey === 'produto') key = String(regra.produto_id).trim();
        else if (groupKey === 'tarefa') key = String(regra.tarefa_id).trim();
        else if (regra.responsavel_id) key = String(regra.responsavel_id).trim();

        if (key) {
          resultados[key] = (resultados[key] || 0) + totalRegra;
        }
      } catch (e) {
        console.error('Erro ao agregar regra (fallback):', e);
      }
    }

    return res.json({ success: true, data: resultados });
  } catch (error) {
    console.error('❌ Erro ao calcular tempo estimado total:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Buscar tempo realizado com filtros aplicados (responsável, período, tarefa, cliente, produto)
async function getTempoRealizadoComFiltros(req, res) {
  try {
    const {
      responsavel_id,
      data_inicio,
      data_fim,
      tarefa_id,
      cliente_id,
      produto_id
    } = req.body;

    console.log('🔍 [TEMPO-REALIZADO-FILTROS] Busca iniciada:', { responsavel_id, data_inicio, data_fim });

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

    // Converter responsavel_id para usuario_id via tabela membro
    const responsavelIdNum = parseInt(String(responsavel_id).trim(), 10);
    if (isNaN(responsavelIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'responsavel_id inválido'
      });
    }

    const { data: membro, error: errorMembro } = await supabase

      .from('membro')
      .select('id, usuario_id')
      .eq('id', responsavelIdNum)
      .maybeSingle();

    if (errorMembro) {
      console.error('❌ [TEMPO-REALIZADO-FILTROS] Erro ao buscar membro:', errorMembro);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar membro',
        details: errorMembro.message
      });
    }

    if (!membro) {
      console.error(`❌ [TEMPO-REALIZADO-FILTROS] Membro não encontrado para responsavel_id (membro.id) = ${responsavelIdNum}`);
      return res.status(404).json({
        success: false,
        error: 'Responsável não encontrado'
      });
    }

    if (!membro.usuario_id) {
      console.error(`❌ [TEMPO-REALIZADO-FILTROS] Membro encontrado (id=${membro.id}) mas sem usuario_id associado`);
      return res.status(404).json({
        success: false,
        error: 'Responsável não possui usuario_id associado'
      });
    }

    const usuarioId = membro.usuario_id;
    console.log(`✅ [TEMPO-REALIZADO-FILTROS] responsavel_id ${responsavelIdNum} → usuario_id ${usuarioId}`);

    // Preparar filtros de período
    // Considerar registros que se sobrepõem ao período:
    // - data_inicio do registro <= data_fim do filtro
    // - data_fim do registro >= data_inicio do filtro (ou NULL para registros ativos)

    // Criar datas usando timezone local explicitamente
    // data_inicio vem como "YYYY-MM-DD", precisamos criar Date no timezone local
    const [anoInicio, mesInicio, diaInicio] = data_inicio.split('-');
    const [anoFim, mesFim, diaFim] = data_fim.split('-');

    // Criar Date no timezone local (não UTC)
    // Isso evita deslocamento de 1 dia causado por conversão UTC
    const dataInicioFiltro = new Date(parseInt(anoInicio), parseInt(mesInicio) - 1, parseInt(diaInicio), 0, 0, 0, 0);
    const dataFimFiltro = new Date(parseInt(anoFim), parseInt(mesFim) - 1, parseInt(diaFim), 23, 59, 59, 999);

    // Construir query base com filtros obrigatórios PRIMEIRO
    let query = supabase

      .from('registro_tempo')
      .select('id, tempo_realizado, data_inicio, data_fim, usuario_id, cliente_id, produto_id, tipo_tarefa_id, tarefa_id, tempo_estimado_id');

    // FILTRO OBRIGATÓRIO: Excluir registros onde cliente_id, produto_id E tipo_tarefa_id são TODOS NULL
    // REGRA: Excluir apenas quando TODAS as três colunas são NULL simultaneamente
    // Como Supabase não suporta facilmente "NOT (A IS NULL AND B IS NULL AND C IS NULL)",
    // vamos buscar todos e filtrar depois no código

    // Filtrar por usuario_id (responsável)
    query = query.eq('usuario_id', usuarioId);

    // Filtrar por período: buscar registros que se sobrepõem ao período
    // Usar OR para garantir que encontramos TODOS os registros do dia:
    // 1. data_inicio está dentro do período, OU
    // 2. data_fim está dentro do período, OU
    // 3. registro cobre todo o período (começa antes e termina depois), OU
    // 4. registro ativo (data_fim é NULL) que começou no período ou antes
    // Converter para ISO string (já está no timezone local, então toISOString() vai converter corretamente)
    const inicioStr = dataInicioFiltro.toISOString();
    const fimStr = dataFimFiltro.toISOString();

    // Criar condições OR para buscar registros que se sobrepõem ao período
    // Incluir também registros ativos (sem data_fim) que começaram no período ou antes
    const orConditions = [
      `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`, // data_inicio dentro do período
      `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`, // data_fim dentro do período
      `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`, // registro cobre o período
      `and(data_inicio.lte.${fimStr},data_fim.is.null)` // registro ativo que começou no período ou antes
    ].join(',');

    query = query.or(orConditions);

    // Filtros adicionais opcionais
    if (tarefa_id) {
      const tarefaIds = Array.isArray(tarefa_id) ? tarefa_id : [tarefa_id];
      query = query.in('tarefa_id', tarefaIds.map(id => String(id).trim()));
    }

    if (cliente_id) {
      const clienteIds = Array.isArray(cliente_id) ? cliente_id : [cliente_id];
      query = query.in('cliente_id', clienteIds.map(id => String(id).trim()));
    }

    if (produto_id) {
      const produtoIds = Array.isArray(produto_id) ? produto_id : [produto_id];
      query = query.in('produto_id', produtoIds.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id)));
    }

    const { data: registrosTempo, error: errorTempo } = await query;

    if (errorTempo) {
      console.error('❌ [TEMPO-REALIZADO-FILTROS] Erro ao buscar registros de tempo:', errorTempo);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar registros de tempo',
        details: errorTempo.message
      });
    }

    console.log(`📊 [TEMPO-REALIZADO-FILTROS] ${registrosTempo?.length || 0} registros encontrados na query`);

    // Aplicar regra de exclusão: excluir apenas quando TODAS as três colunas são NULL
    let registrosExcluidosPorRegra = 0;
    const registrosAposRegra = (registrosTempo || []).filter(reg => {
      const todasNull = reg.cliente_id === null && reg.produto_id === null && reg.tipo_tarefa_id === null;
      if (todasNull) {
        registrosExcluidosPorRegra++;
        return false;
      }
      return true;
    });

    console.log(`📊 [TEMPO-REALIZADO-FILTROS] ${registrosAposRegra.length} registros após regra de exclusão (${registrosExcluidosPorRegra} excluídos)`);

    // A query OR já filtra por período, então não precisamos filtrar novamente no código
    // Apenas garantir que registros tenham data_inicio válida
    const registrosFiltrados = registrosAposRegra.filter(reg => {
      return reg.data_inicio !== null && reg.data_inicio !== undefined;
    });

    console.log(`✅ [TEMPO-REALIZADO-FILTROS] ${registrosFiltrados.length} registros após validar data_inicio`);

    // Calcular tempo total antes do agrupamento
    let tempoTotalAntesAgrupamento = 0;
    registrosFiltrados.forEach(reg => {
      let tempo = Number(reg.tempo_realizado) || 0;
      if (!tempo && reg.data_inicio) {
        const dataInicio = new Date(reg.data_inicio);
        const dataFim = reg.data_fim ? new Date(reg.data_fim) : new Date();
        tempo = Math.max(0, dataFim.getTime() - dataInicio.getTime());
      }
      if (tempo > 0 && tempo < 0.001) {
        tempo = Math.round(tempo * 3600000);
      }
      tempoTotalAntesAgrupamento += tempo;
    });
    console.log(`📊 [TEMPO-REALIZADO-FILTROS] Tempo total antes do agrupamento: ${(tempoTotalAntesAgrupamento / 1000).toFixed(2)}s`);

    // Buscar todos os membros para converter usuario_id para responsavel_id
    const usuarioIds = [...new Set(registrosFiltrados.map(reg => reg.usuario_id).filter(Boolean))];
    const membrosMap = new Map(); // Map: usuario_id -> responsavel_id (membro.id)

    if (usuarioIds.length > 0) {
      const { data: membros, error: errorMembros } = await supabase

        .from('membro')
        .select('id, usuario_id')
        .in('usuario_id', usuarioIds);

      if (errorMembros) {
        console.error('❌ [TEMPO-REALIZADO-FILTROS] Erro ao buscar membros:', errorMembros);
      } else if (membros) {
        membros.forEach(membro => {
          membrosMap.set(membro.usuario_id, membro.id);
        });
      }
    }

    // Para TempoRegistrado, somar todos os tempos diretamente sem agrupar
    // Isso garante que todos os registros sejam incluídos, independente do tempo_estimado_id
    let tempoTotalRealizado = 0;
    let registrosCalculadosDeDatas = 0;
    let registrosComTempoRealizado = 0;

    registrosFiltrados.forEach((reg) => {
      const tempoRealizadoOriginal = reg.tempo_realizado;
      let tempoRealizado = null;

      if (tempoRealizadoOriginal !== null && tempoRealizadoOriginal !== undefined) {
        tempoRealizado = Number(tempoRealizadoOriginal);
        if (isNaN(tempoRealizado) || tempoRealizado < 0) {
          tempoRealizado = null;
        } else {
          registrosComTempoRealizado++;
        }
      }

      if (tempoRealizado === null && reg.data_inicio) {
        registrosCalculadosDeDatas++;
        const dataInicio = new Date(reg.data_inicio);
        const dataFim = reg.data_fim ? new Date(reg.data_fim) : new Date();
        tempoRealizado = Math.max(0, dataFim.getTime() - dataInicio.getTime());
      }

      let tempoMs = tempoRealizado || 0;

      if (tempoMs > 0 && tempoMs < 0.001) {
        tempoMs = Math.round(tempoMs * 3600000);
      }

      tempoTotalRealizado += tempoMs;
    });

    console.log(`📊 [TEMPO-REALIZADO-FILTROS] Processados ${registrosFiltrados.length} registro(s): ${registrosComTempoRealizado} com tempo_realizado, ${registrosCalculadosDeDatas} calculados de datas`);

    // --- BUSCAR TEMPO PENDENTE (Plug Rápido / Em Andamento) ---
    // Buscar registros na tabela registro_tempo_pendente que coincidam com o filtro
    let tempoTotalPendente = 0;
    try {
      let queryPendentes = supabase

        .from('registro_tempo_pendente')
        .select('data_inicio, data_fim, usuario_id, tarefa_id, status');

      // Filtros básicos
      queryPendentes = queryPendentes.eq('usuario_id', usuarioId);

      // Filtro de período (mesma lógica OR)
      const orConditionsPendentes = [
        `and(data_inicio.gte.${inicioStr},data_inicio.lte.${fimStr})`,
        `and(data_fim.gte.${inicioStr},data_fim.lte.${fimStr})`,
        `and(data_inicio.lte.${inicioStr},data_fim.gte.${fimStr})`,
        `and(data_inicio.lte.${fimStr},data_fim.is.null)`
      ].join(',');
      queryPendentes = queryPendentes.or(orConditionsPendentes);

      if (tarefa_id) {
        const tIds = Array.isArray(tarefa_id) ? tarefa_id : [tarefa_id];
        queryPendentes = queryPendentes.in('tarefa_id', tIds.map(String));
      }

      const { data: pendentes } = await queryPendentes;

      if (pendentes) {
        pendentes.forEach(p => {
          const inicio = new Date(p.data_inicio).getTime();
          const fim = p.data_fim ? new Date(p.data_fim).getTime() : Date.now();
          tempoTotalPendente += Math.max(0, fim - inicio);
        });
        console.log(`📊 [TEMPO-REALIZADO-FILTROS] Tempo pendente encontrado: ${tempoTotalPendente}ms (${pendentes.length} registros)`);
      }
    } catch (errPendente) {
      console.error('❌ Erro ao buscar tempo pendente:', errPendente);
    }

    // Criar chave única para o responsável/período
    // Usar informações do primeiro registro MOSTRADO (Realizado) como referência
    const primeiroReg = registrosFiltrados[0];

    // Se não tiver realizado nem pendente, retorna vazio
    if (!primeiroReg && tempoTotalPendente === 0) {
      return res.json({
        success: true,
        data: {},
        count: 0
      });
    }

    let chave;

    if (primeiroReg) {
      const responsavelIdDoRegistro = membrosMap.get(primeiroReg.usuario_id);
      const rId = responsavelIdDoRegistro ? parseInt(String(responsavelIdDoRegistro).trim(), 10) : parseInt(String(responsavel_id).trim(), 10);
      const tId = String(primeiroReg.tarefa_id || '').trim();
      const cId = String(primeiroReg.cliente_id || '').trim();
      const teId = String(primeiroReg.tempo_estimado_id || '').trim();

      if (teId) {
        chave = `${tId}_${rId}_${cId}_${teId}`;
      } else {
        const dataStr = primeiroReg.data_inicio ? new Date(primeiroReg.data_inicio).toISOString().split('T')[0] : null;
        if (dataStr) {
          // Formato fallback compatível
          chave = `${tId}_${rId}_${cId}_${dataStr}`;
        } else {
          chave = `${rId}_periodo`;
        }
      }
    } else {
      // Se só tem pendente, precisamos construir a chave baseada nos filtros (Request)
      // Isso é crítico para o frontend conseguir mapear
      // O frontend espera chave baseada no tempo_estimado se possível.
      // Se não, usa tarefa/responsavel/cliente/data.

      // Tentativa de reconstrução da chave
      const rId = parseInt(String(responsavel_id).trim(), 10);
      // Se temos tarefa_id no filtro, usamos.
      const tId = tarefa_id ? (Array.isArray(tarefa_id) ? String(tarefa_id[0]) : String(tarefa_id)) : '';
      const cId = cliente_id ? (Array.isArray(cliente_id) ? String(cliente_id[0]) : String(cliente_id)) : '';

      // Se não temos tempo_estimado_id (pois é pendente e não realizado vinculado), usamos data?
      // Vamos usar uma chave que o frontend possa aceitar ou que pelo menos não quebre.
      // Se o frontend itera pelos estimados e busca no mapa, a chave TEM que bater com o estimado.
      // Problema: Pendente não tem `tempo_estimado_id`.
      // Se o usuário está vendo a tabela de tarefas, ele tem Estimativas.
      // O frontend gera a chave para lookup: `${tarefa.id}_${responsavel.id}_${cliente.id}_${tarefa.tempo_estimado_id}`
      // Se o pendente pertencer a essa tarefa, devemos somar lá.

      // LIMITAÇÃO: Se houver múltiplas estimativas para a mesma tarefa, não sabemos qual pendente pertence a qual.
      // Solução parcial: Retornar uma chave simplificada também ou esperar que o frontend busque por tarefa?
      // Neste endpoint, retornamos um MAP.

      // Se só tem pendente, retornamos com chave de tarefa se possível.
      if (tId) {
        chave = `${tId}_${rId}_${cId}_PENDENTE`;
      } else {
        chave = `${rId}_PENDENTE`;
      }
    }

    const tempoRealizadoMap = new Map();
    tempoRealizadoMap.set(chave, {
      tempo_realizado: tempoTotalRealizado,
      tempo_pendente: tempoTotalPendente,
      quantidade_registros: registrosFiltrados.length
    });

    // Calcular tempo total para log
    let tempoTotal = 0;
    let chavesComTempo = 0;
    tempoRealizadoMap.forEach((item) => {
      const tempo = (item.tempo_realizado || 0) + (item.tempo_pendente || 0);
      tempoTotal += tempo;
      if (tempo > 0) {
        chavesComTempo++;
      }
    });
    console.log(`✅ [TEMPO-REALIZADO-FILTROS] Resultado: ${tempoRealizadoMap.size} chave(s), ${chavesComTempo} com tempo > 0, tempo total: ${(tempoTotal / 1000).toFixed(2)}s`);

    return res.json({
      success: true,
      data: Object.fromEntries(tempoRealizadoMap),
      count: tempoRealizadoMap.size
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar tempo realizado com filtros:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT /api/tempo-estimado/status - Atualizar status de um registro virtual
async function atualizarStatusTarefa(req, res) {
  try {
    const { regra_id, data, responsavel_id, status, observacao } = req.body;

    // LOG DE ENTRADA PARA DEBUG
    console.log(`📡 [STATUS] Recebido body:`, JSON.stringify(req.body));

    // Validação de campos obrigatórios
    if (!regra_id || !data || !responsavel_id || !status) {
      console.warn('⚠️ [STATUS] Falha na validação de campos:', { regra_id, data, responsavel_id, status });
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: regra_id, data, responsavel_id, status'
      });
    }

    // Validar regra_id (pode ser número ou UUID)
    if (!regra_id) {
      return res.status(400).json({
        success: false,
        error: 'regra_id é obrigatório'
      });
    }

    const regraIdSaneado = String(regra_id).trim();

    // Validação de status: A validação estrita foi removida (o frontend já busca da tabela dinamicamente).
    // Qualquer status enviado será salvo, pois a fonte de verdade na UI é a tabela de configurações.

    // Formatar data (remover hora se houver)
    const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
    const responsavelIdStr = String(responsavel_id).trim();

    console.log(`📝 [STATUS] Saneado: regra_id=${regraIdSaneado}, data=${dataFormatada}, responsavel_id=${responsavelIdStr}, status=${status}`);

    // UPSERT: Inserir ou atualizar
    // UPSERT: Inserir ou atualizar. 
    // Objeto de dados (observacao = campo descrição da tarefa no front)
    const dataUpsert = {
      regra_id: regraIdSaneado,
      data: dataFormatada,
      responsavel_id: responsavelIdStr,
      status: status,
      updated_at: new Date().toISOString()
    };

    if (observacao !== undefined) {
      dataUpsert.observacao = observacao || null;
    }

    const { data: resultado, error } = await supabase
      .from('tempo_estimado_status')
      .upsert(dataUpsert, { onConflict: 'regra_id,data,responsavel_id' })
      .select();

    if (error) {
      console.error('❌ [STATUS] Erro ao atualizar status:', error);
      // LOG TEMPORÁRIO PARA DIAGNÓSTICO
      try {
        const fs = require('fs');
        const logMsg = `\n[${new Date().toISOString()}] BODY: ${JSON.stringify(req.body)} - ERROR: ${error.message} - CODE: ${error.code} - HINT: ${error.hint}\n`;
        fs.appendFileSync('c:/Aplicacao/Gest-o-Inteligente-UP380/error_log.txt', logMsg);
      } catch (e) { }

      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status',
        details: error.message,
        body_sent: req.body // Retornar body para debug no frontend
      });
    }

    console.log(`✅ [STATUS] Status atualizado com sucesso:`, resultado);

    return res.json({
      success: true,
      data: resultado?.[0] || { regra_id, data: dataFormatada, responsavel_id: responsavelIdStr, status },
      message: `Status atualizado para ${status}`
    });
  } catch (error) {
    console.error('❌ [STATUS] Erro inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

/**
 * Segmenta vigências de tempo para uma tarefa baseado em datas de início subsequentes
 */
function segmentarVigenciasTempo(estimativas, dataFimGeral) {
  if (!estimativas || estimativas.length === 0) return [];

  // Ordenar por data de início
  const sorted = [...estimativas].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    const atual = sorted[i];
    const proxima = sorted[i + 1];

    // O fim do segmento atual é o dia anterior ao próximo, ou a data_fim geral
    let fim = dataFimGeral;
    if (proxima && proxima.data_inicio) {
      const d = new Date(proxima.data_inicio + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      fim = d.toISOString().split('T')[0];
    }

    // Garantir que fim não seja anterior ao início (proteção contra dados inválidos)
    if (fim < atual.data_inicio) fim = atual.data_inicio;

    result.push({
      data_inicio: atual.data_inicio,
      data_fim: fim,
      tempo_minutos: parseInt(atual.tempo_minutos, 10),
      tempo_estimado_dia: parseInt(atual.tempo_minutos, 10) * 60000
    });
  }

  return result;
}

/**
 * Salva a configuração estrutural de estimativas de um cliente (NOVA ARQUITETURA ESTRUTURAL)
 * Realiza o cleanup (delete) de todas as regras anteriores do cliente e insere as novas.
 */
async function salvarConfiguracaoCliente(req, res) {
  try {
    console.log('📥 [STRUCTURAL] Recebendo configuração de estimativa por cliente');
    const { cliente_id, data_fim_geral, configuracoes, usuario_id } = req.body;

    if (!cliente_id) {
      return res.status(400).json({ success: false, error: 'cliente_id é obrigatório' });
    }

    // Identificar o criador (membro_id)
    let membroIdCriador = null;
    const uid = usuario_id || req.session?.usuario?.id;
    if (uid) {
      const { data: membro } = await supabase
        .from('membro')
        .select('id')
        .eq('usuario_id', String(uid).trim())
        .maybeSingle();
      if (membro) membroIdCriador = parseInt(membro.id, 10);
    }

    // 1. Limpar regras existentes do cliente (Atomicidade conceitual para "MODO CONFIGURAÇÃO ESTRUTURAL")
    console.log(`🧹 Limpando ${cliente_id} para nova configuração...`);
    const { error: deleteError } = await supabase
      .from('tempo_estimado_regra')
      .delete()
      .eq('cliente_id', String(cliente_id).trim());

    if (deleteError) {
      throw new Error(`Erro ao limpar regras anteriores: ${deleteError.message}`);
    }

    // 2. Processar e Preparar Novas Regras
    const regrasParaInserir = [];
    const agrupador_id = uuidv4();
    const dataFimLimite = data_fim_geral || '2050-12-31';

    for (const config of configuracoes) {
      const {
        produto_id,
        tarefa_id,
        estimativas = [],
        responsaveis = [],
        incluir_finais_semana = false,
        incluir_feriados = false,
        data_fim = null,
        datas_individuais = []
      } = config;

      // Se não houver estimativas, usar um fallback simples de 0 ou ignorar
      if (estimativas.length === 0) continue;

      if (estimativas.length > 0 && (!responsaveis || responsaveis.length === 0)) {
        console.warn(`⚠️ [SALVAR-CONFIG] Config com estimativas mas sem responsáveis (cliente=${cliente_id}, tarefa=${tarefa_id}). Regras serão gravadas com responsavel_id NULL.`);
      }

      // Se a config específica tiver um fim, usamos ele. Caso contrário, usamos o limite geral.
      const dataFimTarefa = data_fim || dataFimLimite;

      // Segmentar as estimativas de tempo ao longo do calendário
      let segmentosTempo = segmentarVigenciasTempo(estimativas, dataFimTarefa);

      // Se houver datas individuais (recorrência ou seleção manual), filtrar vigências por elas
      const validDatasIndividuais = Array.isArray(datas_individuais) ? datas_individuais.filter(d => typeof d === 'string' && d.length >= 10).map(d => d.split('T')[0]) : [];
      if (validDatasIndividuais.length > 0) {
        console.log(`📍 Processando ${validDatasIndividuais.length} datas individuais para tarefa ${tarefa_id}`);
        const novosSegmentos = [];
        const datasSort = [...validDatasIndividuais].sort();

        for (const seg of segmentosTempo) {
          // Filtrar datas que pertencem a esta vigência/segmento
          const datasNoSegmento = datasSort.filter(d => d >= seg.data_inicio && d <= seg.data_fim);
          if (datasNoSegmento.length > 0) {
            // Agrupar estas datas em sub-segmentos contínuos para economia de registros
            // Passamos true, true pois as datas já foram filtradas pelo frontend/recorrência
            const subSegmentos = await agruparDatasEmSegmentos(datasNoSegmento, true, true);
            for (const ss of subSegmentos) {
              novosSegmentos.push({
                ...seg,
                data_inicio: ss.inicio,
                data_fim: ss.fim
              });
            }
          }
        }
        segmentosTempo = novosSegmentos;
      }

      // Se houver responsáveis, as regras são vinculadas a eles.
      // Caso contrário, cria-se uma regra estrutural (responsavel_id = NULL)
      const respsFinal = (responsaveis && responsaveis.length > 0)
        ? responsaveis.map(r => ({ id: r.responsavel_id }))
        : [{ id: null }];

      for (const resp of respsFinal) {
        for (const seg of segmentosTempo) {
          const rawId = resp.id != null && resp.id !== '' ? String(resp.id).trim() : null;
          const responsavelIdNum = rawId ? parseInt(rawId, 10) : null;
          const responsavel_id = (responsavelIdNum != null && !Number.isNaN(responsavelIdNum)) ? responsavelIdNum : null;

          const prodIdRaw = produto_id ? parseInt(String(produto_id).trim(), 10) : null;
          const tarefaIdNum = tarefa_id ? parseInt(String(tarefa_id).trim(), 10) : null;
          const criadorIdNum = membroIdCriador ? parseInt(String(membroIdCriador).trim(), 10) : null;

          regrasParaInserir.push({
            agrupador_id,
            cliente_id: String(cliente_id).trim(),
            produto_id: (prodIdRaw && !isNaN(prodIdRaw)) ? prodIdRaw : null,
            tarefa_id: tarefaIdNum,
            responsavel_id,
            data_inicio: seg.data_inicio,
            data_fim: seg.data_fim,
            tempo_minutos: seg.tempo_minutos,
            tempo_estimado_dia: seg.tempo_estimado_dia,
            incluir_finais_semana,
            incluir_feriados,
            created_by: (criadorIdNum && !isNaN(criadorIdNum)) ? criadorIdNum : null
          });
        }
      }
    }

    // 3. Inserir as novas regras
    if (regrasParaInserir.length > 0) {
      console.log(`💾 Inserindo ${regrasParaInserir.length} novas regras estruturais...`);
      const { error: insertError } = await supabase
        .from('tempo_estimado_regra')
        .insert(regrasParaInserir);

      if (insertError) {
        throw new Error(`Erro ao inserir novas regras: ${insertError.message}`);
      }
    }

    // Calcular a maior data fim real entre as regras criadas para o histórico
    const maxDataFimReal = regrasParaInserir.length > 0
      ? regrasParaInserir.map(r => r.data_fim).sort().reverse()[0]
      : dataFimLimite;

    // 4. Criar Histórico Consolidado
    const { error: histError } = await supabase
      .from('historico_atribuicoes')
      .insert({
        agrupador_id,
        cliente_id: String(cliente_id).trim(),
        responsavel_id: null, // No modo estrutural, o histórico não foca em um responsável único
        usuario_criador_id: membroIdCriador ? parseInt(String(membroIdCriador), 10) : null,
        data_inicio: regrasParaInserir[0]?.data_inicio || null,
        data_fim: maxDataFimReal,
        produto_ids: [...new Set(regrasParaInserir.map(r => r.produto_id).filter(id => id != null))].map(id => parseInt(id, 10)),
        tarefas: configuracoes.map(c => ({
          tarefa_id: parseInt(String(c.tarefa_id), 10),
          produto_id: c.produto_id ? parseInt(String(c.produto_id), 10) : null,
          tempo_minutos: c.estimativas[0]?.tempo_minutos || 0
        })),
        is_plug_rapido: false
      });

    if (histError) console.warn('⚠️ Falha ao registrar log de histórico:', histError.message);

    return res.json({
      success: true,
      message: 'Configuração estrutural de estimativas salva com sucesso',
      agrupador_id,
      count: regrasParaInserir.length
    });

  } catch (error) {
    console.error('❌ [SALVAR-CONFIG] Erro fatal:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao salvar configuração de estimativas',
      details: error.message
    });
  }
}

module.exports = {
  criarTempoEstimado,
  salvarConfiguracaoCliente,
  getTempoEstimado,
  getTempoEstimadoPorId,
  atualizarTempoEstimado,
  deletarTempoEstimado,
  atualizarTempoEstimadoPorAgrupador,
  deletarTempoEstimadoPorAgrupador,
  getTempoEstimadoPorAgrupador,
  getTempoRealizadoPorTarefasEstimadas,
  getTempoRealizadoComFiltros,
  getTempoEstimadoTotal,
  calcularRegistrosDinamicos,
  atualizarStatusTarefa
};


