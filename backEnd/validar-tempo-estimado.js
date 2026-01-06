// =============================================================
// === SCRIPT DE VALIDAÇÃO DA TABELA TEMPO_ESTIMADO ===
// =============================================================
// 
// Este script valida os dados da tabela tempo_estimado no Supabase
// e compara com o que deveria ser retornado pela API
//
// Uso: node validar-tempo-estimado.js [data_inicio] [data_fim] [cliente_id] [responsavel_id] [tarefa_id] [produto_id]

// Carregar variáveis de ambiente PRIMEIRO (antes de qualquer outro módulo)
require('dotenv').config();

const supabase = require('./src/config/database');

// Função para buscar feriados
const https = require('https');
const feriadosCache = {};

async function buscarFeriados(ano) {
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
            feriadosCache[ano] = feriadosMap;
            resolve(feriadosMap);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  } catch (error) {
    console.error(`Erro ao buscar feriados para ${ano}:`, error);
    return {};
  }
}

// Função para verificar se é final de semana
function isWeekendDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const ano = date.getFullYear();
    const mes = date.getMonth();
    const dia = date.getDate();
    const dataParaCalcular = new Date(Date.UTC(ano, mes, dia));
    const diaDaSemana = dataParaCalcular.getUTCDay();
    return diaDaSemana === 0 || diaDaSemana === 6; // 0 = domingo, 6 = sábado
  } catch (e) {
    return false;
  }
}

// Função para verificar se é feriado
async function isHolidayDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const ano = date.getFullYear();
    const mes = date.getMonth();
    const dia = date.getDate();
    const anoFormatado = String(ano);
    const mesFormatado = String(mes + 1).padStart(2, '0');
    const diaFormatado = String(dia).padStart(2, '0');
    const dateKey = `${anoFormatado}-${mesFormatado}-${diaFormatado}`;
    
    const feriados = await buscarFeriados(ano);
    return feriados[dateKey] !== undefined;
  } catch (e) {
    return false;
  }
}

// Função para processar parâmetros de array
function processarParametroArray(param) {
  if (!param) return null;
  if (Array.isArray(param)) {
    return param.filter(Boolean);
  }
  if (typeof param === 'string' && param.includes(',')) {
    return param.split(',').map(id => id.trim()).filter(Boolean);
  }
  return [String(param).trim()].filter(Boolean);
}

// Função principal de validação
async function validarTempoEstimado(filtros = {}) {
  console.log('\n========================================');
  console.log('🔍 VALIDAÇÃO DA TABELA TEMPO_ESTIMADO');
  console.log('========================================\n');

  try {
    // Processar filtros
    const cliente_id = processarParametroArray(filtros.cliente_id);
    const produto_id = processarParametroArray(filtros.produto_id);
    const tarefa_id = processarParametroArray(filtros.tarefa_id);
    const responsavel_id = processarParametroArray(filtros.responsavel_id);
    const data_inicio = filtros.data_inicio || null;
    const data_fim = filtros.data_fim || null;

    console.log('📋 Filtros aplicados:');
    console.log(`   - Cliente ID: ${cliente_id ? cliente_id.join(', ') : 'Nenhum'}`);
    console.log(`   - Produto ID: ${produto_id ? produto_id.join(', ') : 'Nenhum'}`);
    console.log(`   - Tarefa ID: ${tarefa_id ? tarefa_id.join(', ') : 'Nenhum'}`);
    console.log(`   - Responsável ID: ${responsavel_id ? responsavel_id.join(', ') : 'Nenhum'}`);
    console.log(`   - Data Início: ${data_inicio || 'Nenhuma'}`);
    console.log(`   - Data Fim: ${data_fim || 'Nenhuma'}`);
    console.log('');

    // Construir query base
    let query = supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado')
      .select('*', { count: 'exact' });

    // Aplicar filtros
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
      if (responsavelIdsLimpos.length === 1) {
        query = query.eq('responsavel_id', responsavelIdsLimpos[0]);
      } else if (responsavelIdsLimpos.length > 1) {
        query = query.in('responsavel_id', responsavelIdsLimpos);
      }
    }

    // Aplicar filtro de período
    if (data_inicio && data_fim) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      
      // Buscar TODOS os registros que podem se sobrepor ao período
      // Não aplicar filtro direto na query - vamos buscar todos e filtrar depois
    } else if (data_inicio) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      query = query.gte('data', inicioFormatado);
    } else if (data_fim) {
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      query = query.lte('data', fimFormatado);
    }

    // Executar query
    const { data: registros, error, count } = await query.order('data', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar registros:', error);
      return;
    }

    console.log(`📊 Total de registros encontrados: ${count || 0}`);
    console.log('');

    // Se há filtro de período, agrupar por agrupador_id e verificar sobreposição
    let registrosFiltrados = registros || [];
    
    if (data_inicio && data_fim) {
      const inicioFormatado = data_inicio.includes('T') ? data_inicio : `${data_inicio}T00:00:00`;
      const fimFormatado = data_fim.includes('T') ? data_fim : `${data_fim}T23:59:59`;
      
      // Agrupar por agrupador_id
      const agrupadores = new Map();
      
      registrosFiltrados.forEach(reg => {
        const agrupadorId = reg.agrupador_id || 'sem-grupo';
        if (!agrupadores.has(agrupadorId)) {
          agrupadores.set(agrupadorId, {
            agrupador_id: agrupadorId,
            registros: [],
            dataMin: null,
            dataMax: null
          });
        }
        
        const grupo = agrupadores.get(agrupadorId);
        grupo.registros.push(reg);
        
        if (reg.data) {
          const dataReg = new Date(reg.data);
          if (!grupo.dataMin || dataReg < grupo.dataMin) {
            grupo.dataMin = dataReg;
          }
          if (!grupo.dataMax || dataReg > grupo.dataMax) {
            grupo.dataMax = dataReg;
          }
        }
      });
      
      // Filtrar agrupadores que se sobrepõem ao período
      const agrupadoresFiltrados = [];
      
      for (const [agrupadorId, grupo] of agrupadores) {
        const grupoInicio = grupo.dataMin;
        const grupoFim = grupo.dataMax;
        const filtroInicio = new Date(inicioFormatado);
        const filtroFim = new Date(fimFormatado);
        
        // Verificar sobreposição: registro se sobrepõe se:
        // 1. data_inicio está dentro do período, OU
        // 2. data_fim está dentro do período, OU
        // 3. registro cobre todo o período (começa antes e termina depois)
        const seSobrepoe = 
          (grupoInicio >= filtroInicio && grupoInicio <= filtroFim) ||
          (grupoFim >= filtroInicio && grupoFim <= filtroFim) ||
          (grupoInicio <= filtroInicio && grupoFim >= filtroFim);
        
        if (seSobrepoe) {
          agrupadoresFiltrados.push(grupo);
        }
      }
      
      // Coletar todos os registros dos agrupadores filtrados
      registrosFiltrados = [];
      agrupadoresFiltrados.forEach(grupo => {
        registrosFiltrados.push(...grupo.registros);
      });
      
      console.log(`📊 Registros após filtro de período (agrupados): ${registrosFiltrados.length}`);
      console.log(`   - Agrupadores únicos: ${agrupadoresFiltrados.length}`);
      console.log('');
    }

    // Exibir estatísticas
    console.log('📈 Estatísticas dos registros:');
    console.log('');
    
    // Agrupar por agrupador_id para análise
    const agrupadoresMap = new Map();
    registrosFiltrados.forEach(reg => {
      const agrupadorId = reg.agrupador_id || 'sem-grupo';
      if (!agrupadoresMap.has(agrupadorId)) {
        agrupadoresMap.set(agrupadorId, {
          agrupador_id: agrupadorId,
          registros: [],
          cliente_id: reg.cliente_id,
          responsavel_id: reg.responsavel_id,
          produto_id: reg.produto_id,
          tarefa_id: reg.tarefa_id,
          dataMin: null,
          dataMax: null,
          tempoEstimadoTotal: 0
        });
      }
      
      const grupo = agrupadoresMap.get(agrupadorId);
      grupo.registros.push(reg);
      
      if (reg.data) {
        const dataReg = new Date(reg.data);
        if (!grupo.dataMin || dataReg < grupo.dataMin) {
          grupo.dataMin = dataReg;
        }
        if (!grupo.dataMax || dataReg > grupo.dataMax) {
          grupo.dataMax = dataReg;
        }
      }
      
      grupo.tempoEstimadoTotal += Number(reg.tempo_estimado_dia) || 0;
    });
    
    console.log(`   - Total de agrupadores: ${agrupadoresMap.size}`);
    console.log(`   - Total de registros individuais: ${registrosFiltrados.length}`);
    console.log('');
    
    // Exibir detalhes dos primeiros 10 agrupadores
    console.log('📋 Detalhes dos agrupadores (primeiros 10):');
    console.log('');
    
    let contador = 0;
    for (const [agrupadorId, grupo] of agrupadoresMap) {
      if (contador >= 10) break;
      
      const dataInicioStr = grupo.dataMin ? grupo.dataMin.toISOString().split('T')[0] : 'N/A';
      const dataFimStr = grupo.dataMax ? grupo.dataMax.toISOString().split('T')[0] : 'N/A';
      const horasEstimadas = Math.floor(grupo.tempoEstimadoTotal / (1000 * 60 * 60));
      const minutosEstimados = Math.floor((grupo.tempoEstimadoTotal % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`   ${contador + 1}. Agrupador: ${agrupadorId.substring(0, 8)}...`);
      console.log(`      - Cliente ID: ${grupo.cliente_id}`);
      console.log(`      - Responsável ID: ${grupo.responsavel_id}`);
      console.log(`      - Produto ID: ${grupo.produto_id}`);
      console.log(`      - Tarefa ID: ${grupo.tarefa_id}`);
      console.log(`      - Período: ${dataInicioStr} até ${dataFimStr}`);
      console.log(`      - Registros: ${grupo.registros.length}`);
      console.log(`      - Tempo Estimado Total: ${horasEstimadas}h ${minutosEstimados}min`);
      console.log('');
      
      contador++;
    }
    
    // Verificar problemas comuns
    console.log('🔍 Verificando problemas comuns:');
    console.log('');
    
    let problemasEncontrados = 0;
    
    // Verificar registros sem agrupador_id
    const semAgrupador = registrosFiltrados.filter(reg => !reg.agrupador_id);
    if (semAgrupador.length > 0) {
      console.log(`   ⚠️  ${semAgrupador.length} registro(s) sem agrupador_id`);
      problemasEncontrados++;
    }
    
    // Verificar registros com tempo_estimado_dia inválido
    const tempoInvalido = registrosFiltrados.filter(reg => !reg.tempo_estimado_dia || reg.tempo_estimado_dia <= 0);
    if (tempoInvalido.length > 0) {
      console.log(`   ⚠️  ${tempoInvalido.length} registro(s) com tempo_estimado_dia inválido`);
      problemasEncontrados++;
    }
    
    // Verificar registros com data inválida
    const dataInvalida = registrosFiltrados.filter(reg => !reg.data);
    if (dataInvalida.length > 0) {
      console.log(`   ⚠️  ${dataInvalida.length} registro(s) sem data`);
      problemasEncontrados++;
    }
    
    // Verificar registros duplicados (mesmo agrupador_id, mesma data, mesma tarefa)
    const duplicados = new Map();
    registrosFiltrados.forEach(reg => {
      const chave = `${reg.agrupador_id}_${reg.data}_${reg.tarefa_id}_${reg.responsavel_id}`;
      if (!duplicados.has(chave)) {
        duplicados.set(chave, []);
      }
      duplicados.get(chave).push(reg);
    });
    
    const duplicadosEncontrados = Array.from(duplicados.values()).filter(arr => arr.length > 1);
    if (duplicadosEncontrados.length > 0) {
      console.log(`   ⚠️  ${duplicadosEncontrados.length} conjunto(s) de registros duplicados encontrados`);
      problemasEncontrados++;
    }
    
    if (problemasEncontrados === 0) {
      console.log('   ✅ Nenhum problema comum encontrado');
    }
    
    console.log('');
    console.log('========================================');
    console.log('✅ Validação concluída');
    console.log('========================================\n');
    
    return {
      totalRegistros: registrosFiltrados.length,
      totalAgrupadores: agrupadoresMap.size,
      problemas: problemasEncontrados
    };
    
  } catch (error) {
    console.error('❌ Erro inesperado na validação:', error);
    throw error;
  }
}

// Executar validação
const args = process.argv.slice(2);

const filtros = {};
if (args[0]) filtros.data_inicio = args[0];
if (args[1]) filtros.data_fim = args[1];
if (args[2]) filtros.cliente_id = args[2];
if (args[3]) filtros.responsavel_id = args[3];
if (args[4]) filtros.tarefa_id = args[4];
if (args[5]) filtros.produto_id = args[5];

validarTempoEstimado(filtros)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });

