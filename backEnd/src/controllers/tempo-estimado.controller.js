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
async function calcularRegistrosDinamicos(regra, dataInicioFiltro = null, dataFimFiltro = null, cacheFeriados = null) {
  try {
    if (!regra || !regra.data_inicio || !regra.data_fim) {
      console.warn('⚠️ Regra inválida para cálculo dinâmico:', regra);
      return [];
    }

    // Gerar datas do período da regra
    const incluirFinaisSemana = regra.incluir_finais_semana !== false; // Default true
    const incluirFeriados = regra.incluir_feriados !== false; // Default true
    
    let datasDoPeriodo = await gerarDatasDoPeriodo(
      regra.data_inicio,
      regra.data_fim,
      incluirFinaisSemana,
      incluirFeriados,
      cacheFeriados
    );

    // Aplicar filtro de período se fornecido (intersectar com período da regra)
    if (dataInicioFiltro && dataFimFiltro) {
      const filtroInicio = new Date(dataInicioFiltro.split('T')[0]);
      const filtroFim = new Date(dataFimFiltro.split('T')[0]);
      
      // Normalizar para comparação (apenas data, sem hora)
      filtroInicio.setHours(0, 0, 0, 0);
      filtroFim.setHours(23, 59, 59, 999);
      
      datasDoPeriodo = datasDoPeriodo.filter(dataStr => {
        const dataRegistro = new Date(dataStr.split('T')[0]);
        dataRegistro.setHours(0, 0, 0, 0);
        return dataRegistro >= filtroInicio && dataRegistro <= filtroFim;
      });
    }

    // Criar registros virtuais
    const registros = datasDoPeriodo.map(dataStr => {
      const regraId = regra.id || String(regra.agrupador_id);
      const idVirtual = gerarIdVirtual(regraId, dataStr);
      
      return {
        id: idVirtual, // ID virtual estável
        tempo_estimado_id: idVirtual, // Compatibilidade com frontend (usado em registro_tempo)
        agrupador_id: regra.agrupador_id,
        cliente_id: regra.cliente_id,
        produto_id: regra.produto_id,
        tarefa_id: regra.tarefa_id,
        responsavel_id: regra.responsavel_id,
        tipo_tarefa_id: regra.tipo_tarefa_id,
        data: dataStr,
        tempo_estimado_dia: regra.tempo_estimado_dia,
        // Campos adicionais para compatibilidade
        incluir_finais_semana: incluirFinaisSemana,
        incluir_feriados: incluirFeriados,
        // Metadados da regra (úteis para debug)
        regra_id: regra.id,
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

// POST - Criar novo(s) registro(s) de tempo estimado
async function criarTempoEstimado(req, res) {
  try {
    console.log('📥 Recebendo requisição para criar tempo estimado');
    console.log('📦 Body recebido:', JSON.stringify(req.body, null, 2));
    
    const { cliente_id, produto_ids, tarefa_ids, tarefas, produtos_com_tarefas, data_inicio, data_fim, tempo_estimado_dia, responsavel_id, incluir_finais_semana = true, incluir_feriados = true, datas_individuais = [] } = req.body;

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

    // responsavel_id global é obrigatório APENAS se nenhuma tarefa tiver responsavel_id próprio
    // Verificar se pelo menos uma tarefa tem responsavel_id ou se há responsavel_id global
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
    
    if (!temResponsavelGlobal && !temResponsavelPorTarefa) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer responsavel_id global ou responsavel_id em cada tarefa'
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
          .schema('up_gestaointeligente')
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
              .schema('up_gestaointeligente')
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
          .schema('up_gestaointeligente')
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
    // Calcular período (data_inicio e data_fim)
    const datasApenasData = datasDoPeriodo.map(d => d.split('T')[0]).sort();
    const dataInicioRegra = datasApenasData[0];
    const dataFimRegra = datasApenasData[datasApenasData.length - 1];
    
    const regrasParaInserir = [];
    
    // Buscar membro_id do criador (se disponível)
    let membroIdCriador = null;
    try {
      const usuarioId = req.session?.usuario?.id || null;
      if (usuarioId) {
        const { data: membro } = await supabase
          .schema('up_gestaointeligente')
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
    
    // Iterar sobre cada produto e APENAS suas tarefas específicas
    Object.entries(produtosComTarefasMap).forEach(([produtoId, tarefasDoProduto]) => {
      tarefasDoProduto.forEach(tarefaObj => {
        const tarefaId = String(tarefaObj.tarefa_id).trim();
        const tempoEstimado = parseInt(tarefaObj.tempo_estimado_dia, 10);
        
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
        
        // Criar uma regra para esta combinação produto x tarefa
        regrasParaInserir.push({
          agrupador_id: agrupador_id,
          cliente_id: String(cliente_id).trim(),
          produto_id: produtoId ? parseInt(produtoId, 10) : null,
          tarefa_id: parseInt(tarefaId, 10),
          responsavel_id: parseInt(responsavelIdParaTarefa, 10),
          tipo_tarefa_id: tipoTarefaId,
          data_inicio: dataInicioRegra,
          data_fim: dataFimRegra,
          tempo_estimado_dia: tempoEstimado, // em milissegundos
          incluir_finais_semana: incluirFinaisSemana,
          incluir_feriados: incluirFeriados,
          created_by: membroIdCriador
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

    // Inserir todas as regras
    const { data: regrasInseridas, error } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .insert(regrasParaInserir)
      .select();

    if (error) {
      console.error('❌ Erro ao criar regras de tempo estimado:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      console.error('❌ Primeira regra que tentou inserir:', regrasParaInserir[0]);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tempo estimado',
        details: error.message,
        hint: error.hint || null
      });
    }

    console.log(`✅ ${regrasInseridas.length} regra(s) de tempo estimado criada(s) com sucesso`);
    
    // Calcular registros virtuais para retornar no formato esperado pelo frontend
    // (para manter compatibilidade - frontend espera registros individuais)
    const dadosInseridos = [];
    for (const regra of regrasInseridas) {
      const registrosVirtuais = await calcularRegistrosDinamicos(regra);
      dadosInseridos.push(...registrosVirtuais);
    }

    // Salvar histórico da atribuição (usando dados calculados acima)
    try {
      // Se encontrou o membro_id, salvar histórico
      if (membroIdCriador) {
        const historicoData = {
          agrupador_id: agrupador_id,
          cliente_id: String(cliente_id).trim(),
          responsavel_id: String(responsavel_id).trim(),
          usuario_criador_id: String(membroIdCriador).trim(),
          data_inicio: dataInicioRegra,
          data_fim: dataFimRegra,
          produto_ids: produtoIdsArray.map(id => String(id).trim()),
          tarefas: todasTarefasComTempo
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
    
    console.log('🔍 [TEMPO-ESTIMADO-REGRA] req.query completo:', JSON.stringify(req.query, null, 2));
    
    const { 
      page = 1, 
      limit = 20,
      data = null,
      data_inicio = null,
      data_fim = null,
      cliente_status = null // 'ativo', 'inativo', ou null/undefined
    } = req.query;
    
    // Processar IDs que podem vir como array
    const cliente_id = processarParametroArray(req.query.cliente_id);
    const produto_id = processarParametroArray(req.query.produto_id);
    const tarefa_id = processarParametroArray(req.query.tarefa_id);
    
    // Filtrar apenas valores numéricos válidos para responsavel_id (campo INTEGER no banco)
    // O frontend pode enviar email, nome, etc., mas precisamos apenas dos IDs numéricos
    const responsavel_id_raw = processarParametroArray(req.query.responsavel_id);
    const responsavel_id = responsavel_id_raw 
      ? responsavel_id_raw
          .map(id => parseInt(String(id).trim(), 10))
          .filter(id => !isNaN(id) && id > 0)
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
          .schema('up_gestaointeligente')
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
      .schema('up_gestaointeligente')
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
            .schema('up_gestaointeligente')
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
    
    // NOVA LÓGICA: Se houver filtro por data específica (data_inicio === data_fim ou parâmetro 'data'),
    // expandir as regras em registros dinâmicos para o PainelUsuario
    // Normalizar datas para comparação (remover hora se houver)
    const dataInicioNormalizada = data_inicio ? (data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio) : null;
    const dataFimNormalizada = data_fim ? (data_fim.includes('T') ? data_fim.split('T')[0] : data_fim) : null;
    const deveExpandirRegras = (dataInicioNormalizada && dataFimNormalizada && dataInicioNormalizada === dataFimNormalizada) || data;
    
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
      // Expandir regras em registros dinâmicos
      console.log('🔄 Expandindo regras em registros dinâmicos para filtro por data específica');
      
      // Determinar data(s) para filtrar
      let dataInicioFiltro = null;
      let dataFimFiltro = null;
      
      if (data) {
        const dataFormatada = data.includes('T') ? data.split('T')[0] : data;
        dataInicioFiltro = dataFormatada;
        dataFimFiltro = dataFormatada;
      } else if (dataInicioNormalizada && dataFimNormalizada && dataInicioNormalizada === dataFimNormalizada) {
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
      
      dadosParaRetornar = todosRegistros;
      totalParaRetornar = todosRegistros.length;
      
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
      .schema('up_gestaointeligente')
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
              .schema('up_gestaointeligente')
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
    
    // Validar período
    const dataInicioDate = new Date(data_inicio);
    const dataFimDate = new Date(data_fim);
    if (dataFimDate < dataInicioDate) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Data fim deve ser maior ou igual à data início'
      });
    }

    // NOVA LÓGICA: Deletar todas as regras antigas do agrupamento
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      console.error('❌ Erro ao deletar regras antigas:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar agrupamento',
        details: deleteError.message
      });
    }

    // Função auxiliar para buscar tipo_tarefa_id da tabela vinculados
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

    // Buscar tipo_tarefa_id para todas as tarefas
    console.log('🔍 [UPDATE] Buscando tipo_tarefa_id para as tarefas...');
    const tipoTarefaPorTarefa = new Map();
    for (const tarefaId of tarefa_ids) {
      const tipoTarefaId = await buscarTipoTarefaIdPorTarefa(tarefaId);
      if (tipoTarefaId) {
        tipoTarefaPorTarefa.set(String(tarefaId).trim(), tipoTarefaId);
        console.log(`✅ [UPDATE] Tarefa ${tarefaId}: tipo_tarefa_id = ${tipoTarefaId}`);
      } else {
        console.warn(`⚠️ [UPDATE] Tarefa ${tarefaId}: tipo_tarefa_id não encontrado`);
      }
    }

    // NOVA LÓGICA: Criar regras atualizadas (uma regra para cada combinação produto x tarefa)
    const regrasParaInserir = [];
    
    produto_ids.forEach(produtoId => {
      tarefa_ids.forEach(tarefaId => {
        const tipoTarefaId = tipoTarefaPorTarefa.get(String(tarefaId).trim()) || null;
        
        regrasParaInserir.push({
          agrupador_id: agrupador_id,
          cliente_id: String(cliente_id).trim(),
          produto_id: produtoId ? parseInt(produtoId, 10) : null,
          tarefa_id: parseInt(tarefaId, 10),
          responsavel_id: parseInt(responsavel_id, 10),
          tipo_tarefa_id: tipoTarefaId,
          data_inicio: data_inicio,
          data_fim: data_fim,
          tempo_estimado_dia: parseInt(tempo_estimado_dia, 10), // em milissegundos
          incluir_finais_semana: incluirFinaisSemana,
          incluir_feriados: incluirFeriados
        });
      });
    });

    // Inserir novas regras
    const { data: regrasInseridas, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .insert(regrasParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao criar novas regras:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar agrupamento',
        details: insertError.message
      });
    }

    console.log(`✅ Agrupamento ${agrupador_id} atualizado: ${regrasInseridas.length} regra(s) criada(s)`);
    
    // Calcular registros virtuais para retornar no formato esperado pelo frontend
    const dadosInseridos = [];
    for (const regra of regrasInseridas) {
      const registrosVirtuais = await calcularRegistrosDinamicos(regra);
      dadosInseridos.push(...registrosVirtuais);
    }

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
      .schema('up_gestaointeligente')
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
      .schema('up_gestaointeligente')
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
      .schema('up_gestaointeligente')
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

// GET - Calcular tempo estimado total por responsável
async function getTempoEstimadoTotal(req, res) {
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
    
    console.log('🔍 [TEMPO-ESTIMADO-TOTAL] req.query completo:', JSON.stringify(req.query, null, 2));
    
    const { 
      data_inicio = null,
      data_fim = null,
      cliente_status = null
    } = req.query;
    
    // Processar IDs que podem vir como array
    const cliente_id = processarParametroArray(req.query.cliente_id);
    const produto_id = processarParametroArray(req.query.produto_id);
    const tarefa_id = processarParametroArray(req.query.tarefa_id);
    
    // Filtrar apenas valores numéricos válidos para responsavel_id
    const responsavel_id_raw = processarParametroArray(req.query.responsavel_id);
    const responsavel_id = responsavel_id_raw 
      ? responsavel_id_raw
          .map(id => parseInt(String(id).trim(), 10))
          .filter(id => !isNaN(id) && id > 0)
      : null;
    
    // Validar período obrigatório
    if (!data_inicio || !data_fim) {
      return res.status(400).json({
        success: false,
        error: 'data_inicio e data_fim são obrigatórios para calcular tempo estimado total'
      });
    }
    
    // FILTRO DE STATUS DE CLIENTE
    let clienteIdsFinais = cliente_id;
    
    if (cliente_status && cliente_status !== 'todos' && (cliente_status === 'ativo' || cliente_status === 'inativo')) {
      try {
        let clientesQuery = supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id');
        
        if (cliente_status === 'ativo') {
          clientesQuery = clientesQuery.eq('status', 'ativo');
        } else if (cliente_status === 'inativo') {
          clientesQuery = clientesQuery.eq('status', 'inativo');
        }
        
        const { data: clientesFiltrados, error: clientesError } = await clientesQuery;
        
        if (!clientesError && clientesFiltrados && clientesFiltrados.length > 0) {
          const clienteIdsFiltrados = clientesFiltrados.map(c => String(c.id).trim()).filter(Boolean);
          
          if (cliente_id && cliente_id.length > 0) {
            const clienteIdsLimpos = cliente_id.map(id => String(id).trim()).filter(Boolean);
            clienteIdsFinais = clienteIdsLimpos.filter(id => clienteIdsFiltrados.includes(id));
          } else {
            clienteIdsFinais = clienteIdsFiltrados;
          }
          
          if (clienteIdsFinais.length === 0) {
            return res.json({
              success: true,
              data: {}
            });
          }
        } else if (!clientesFiltrados || clientesFiltrados.length === 0) {
          return res.json({
            success: true,
            data: {}
          });
        }
      } catch (error) {
        console.error('❌ Erro ao processar filtro de status de cliente:', error);
      }
    }
    
    // Buscar TODAS as regras (sem paginação, usando paginação automática)
    const criarQueryBuilder = () => {
      let queryBuilder = supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado_regra')
        .select('*');
      
      // Aplicar filtros
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
      const periodoInicioFiltro = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
      const periodoFimFiltro = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;
      queryBuilder = queryBuilder.lte('data_inicio', periodoFimFiltro).gte('data_fim', periodoInicioFiltro);
      
      return queryBuilder.order('data_inicio', { ascending: false });
    };
    
    // Buscar todas as regras usando paginação automática
    const regrasEncontradas = await buscarTodosComPaginacao(criarQueryBuilder, {
      limit: 1000,
      logProgress: true
    });
    
    console.log(`📊 [TEMPO-ESTIMADO-TOTAL] Encontradas ${regrasEncontradas.length} regra(s)`);
    
    // Expandir regras em registros usando calcularRegistrosDinamicos
    const periodoInicioFiltro = data_inicio.includes('T') ? data_inicio.split('T')[0] : data_inicio;
    const periodoFimFiltro = data_fim.includes('T') ? data_fim.split('T')[0] : data_fim;
    
    const cacheFeriados = {};
    const todosRegistros = [];
    
    for (const regra of regrasEncontradas) {
      try {
        const registrosExpandidos = await calcularRegistrosDinamicos(
          regra,
          periodoInicioFiltro,
          periodoFimFiltro,
          cacheFeriados
        );
        todosRegistros.push(...registrosExpandidos);
      } catch (error) {
        console.error(`❌ Erro ao expandir regra ${regra.id}:`, error);
      }
    }
    
    console.log(`📊 [TEMPO-ESTIMADO-TOTAL] Expandidas ${regrasEncontradas.length} regra(s) em ${todosRegistros.length} registro(s)`);
    
    // Calcular tempo estimado total por responsável (mesma lógica do frontend)
    const temposPorResponsavel = {};
    
    // Agrupar registros por responsável
    const registrosPorResponsavel = {};
    todosRegistros.forEach(registro => {
      if (!registro.responsavel_id) return;
      const responsavelId = String(registro.responsavel_id);
      if (!registrosPorResponsavel[responsavelId]) {
        registrosPorResponsavel[responsavelId] = [];
      }
      registrosPorResponsavel[responsavelId].push(registro);
    });
    
    console.log(`🔍 [TEMPO-ESTIMADO-TOTAL] Encontrados ${Object.keys(registrosPorResponsavel).length} responsáveis únicos`);
    
    // Para cada responsável, calcular tempo estimado total
    Object.keys(registrosPorResponsavel).forEach(responsavelId => {
      const registrosDoResponsavel = registrosPorResponsavel[responsavelId];
      
      // Map de data -> maior tempo_estimado_dia (evitar duplicação)
      const tempoPorData = new Map();
      
      registrosDoResponsavel.forEach(registro => {
        // Extrair data do registro
        const dataStr = registro.data ? registro.data.split('T')[0] : null;
        if (!dataStr) return;
        
        // Verificar se a data está no período (já deve estar, mas garantir)
        if (periodoInicioFiltro && periodoFimFiltro) {
          if (dataStr < periodoInicioFiltro || dataStr > periodoFimFiltro) return;
        }
        
        // Obter tempo estimado do registro
        let tempoEstimadoDia = Number(registro.tempo_estimado_dia) || 0;
        
        // Converter se necessário (horas decimais para milissegundos)
        if (tempoEstimadoDia > 0 && tempoEstimadoDia < 1000) {
          tempoEstimadoDia = Math.round(tempoEstimadoDia * 3600000);
        }
        
        // Usar o maior valor para a mesma data
        const tempoAtual = tempoPorData.get(dataStr) || 0;
        tempoPorData.set(dataStr, Math.max(tempoAtual, tempoEstimadoDia));
      });
      
      // Somar todos os tempos do Map
      let tempoTotal = 0;
      tempoPorData.forEach((tempoDia) => {
        tempoTotal += tempoDia;
      });
      
      temposPorResponsavel[responsavelId] = tempoTotal;
      
      // DEBUG: Log por responsável
      console.log(`🔍 [TEMPO-ESTIMADO-TOTAL] Responsável ${responsavelId}: ${registrosDoResponsavel.length} registro(s), ${tempoPorData.size} data(s) única(s), total=${tempoTotal}ms (${(tempoTotal/3600000).toFixed(2)}h)`);
    });
    
    return res.json({
      success: true,
      data: temposPorResponsavel
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao calcular tempo estimado total:', error);
    console.error('❌ Stack trace:', error.stack);
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
  getTempoRealizadoPorTarefasEstimadas,
  getTempoEstimadoTotal,
  calcularRegistrosDinamicos
};


