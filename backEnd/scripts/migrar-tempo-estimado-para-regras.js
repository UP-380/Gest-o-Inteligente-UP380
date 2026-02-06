/**
 * Script de Migração: tempo_estimado -> tempo_estimado_regra
 * 
 * Este script migra os dados da tabela tempo_estimado (registros diários)
 * para a nova tabela tempo_estimado_regra (regras com período).
 * 
 * Lógica:
 * 1. Buscar todos os registros agrupados por agrupador_id
 * 2. Para cada agrupador, identificar período (data min/max) e combinações únicas
 * 3. Criar 1 registro na nova tabela para cada combinação única
 * 
 * Execute: node scripts/migrar-tempo-estimado-para-regras.js
 * 
 * IMPORTANTE:
 * - Faça backup da tabela tempo_estimado antes de executar
 * - Teste em ambiente de desenvolvimento primeiro
 * - Execute em horário de baixo uso em produção
 */

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabase = require('../src/config/database');
const { buscarTodosComPaginacao } = require('../src/services/database-utils');

// Contador de estatísticas
const stats = {
  agrupadoresProcessados: 0,
  regrasCriadas: 0,
  registrosAntigos: 0,
  erros: 0
};

/**
 * Função principal de migração
 */
async function migrarTempoEstimadoParaRegras() {
  console.log('🚀 Iniciando migração: tempo_estimado -> tempo_estimado_regra');
  console.log('='.repeat(80));
  console.log('⚠️  ATENÇÃO: Faça backup da tabela tempo_estimado antes de continuar!');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Buscar todos os registros da tabela antiga (paginação automática)
    console.log('📊 Passo 1: Buscando todos os registros da tabela tempo_estimado...');
    const criarQueryTodos = () => {
      return supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado')
        .select('agrupador_id, cliente_id, produto_id, tarefa_id, responsavel_id, tipo_tarefa_id, data, tempo_estimado_dia')
        .order('agrupador_id', { ascending: true })
        .order('data', { ascending: true });
    };

    const todosRegistros = await buscarTodosComPaginacao(criarQueryTodos, {
      limit: 1000,
      logProgress: true
    });

    if (!todosRegistros || todosRegistros.length === 0) {
      console.log('⚠️  Nenhum registro encontrado na tabela tempo_estimado. Nada para migrar.');
      return;
    }

    stats.registrosAntigos = todosRegistros.length;
    console.log(`✅ Total de ${stats.registrosAntigos} registros encontrados`);
    console.log('');

    // 2. Agrupar registros por agrupador_id
    console.log('📦 Passo 2: Agrupando registros por agrupador_id...');
    const agrupadores = new Map();

    todosRegistros.forEach(registro => {
      const agrupadorId = registro.agrupador_id || 'sem-grupo';
      
      if (!agrupadores.has(agrupadorId)) {
        agrupadores.set(agrupadorId, {
          agrupador_id: agrupadorId,
          combinacoes: new Map(), // Map<chave, {config, datas}>
          dataMinima: null,
          dataMaxima: null
        });
      }

      const grupo = agrupadores.get(agrupadorId);

      // Extrair data do registro
      let dataRegistro = null;
      if (registro.data) {
        if (typeof registro.data === 'string') {
          dataRegistro = registro.data.split('T')[0]; // Extrair apenas a data (YYYY-MM-DD)
        } else if (registro.data instanceof Date) {
          const yyyy = registro.data.getFullYear();
          const mm = String(registro.data.getMonth() + 1).padStart(2, '0');
          const dd = String(registro.data.getDate()).padStart(2, '0');
          dataRegistro = `${yyyy}-${mm}-${dd}`;
        }
      }

      // Calcular data mínima e máxima do grupo
      if (dataRegistro) {
        if (!grupo.dataMinima || dataRegistro < grupo.dataMinima) {
          grupo.dataMinima = dataRegistro;
        }
        if (!grupo.dataMaxima || dataRegistro > grupo.dataMaxima) {
          grupo.dataMaxima = dataRegistro;
        }
      }

      // Criar chave única para combinação (cliente, produto, tarefa, responsavel, tipo_tarefa)
      const chave = [
        String(registro.cliente_id || '').trim(),
        String(registro.produto_id || '').trim(),
        String(registro.tarefa_id || '').trim(),
        String(registro.responsavel_id || '').trim(),
        String(registro.tipo_tarefa_id || '').trim()
      ].join('|');

      // Agrupar por combinação única
      if (!grupo.combinacoes.has(chave)) {
        grupo.combinacoes.set(chave, {
          cliente_id: String(registro.cliente_id || '').trim(),
          produto_id: registro.produto_id ? parseInt(registro.produto_id, 10) : null,
          tarefa_id: registro.tarefa_id ? parseInt(registro.tarefa_id, 10) : null,
          responsavel_id: registro.responsavel_id ? parseInt(registro.responsavel_id, 10) : null,
          tipo_tarefa_id: registro.tipo_tarefa_id ? String(registro.tipo_tarefa_id).trim() : null,
          tempo_estimado_dia: registro.tempo_estimado_dia ? parseInt(registro.tempo_estimado_dia, 10) : null,
          datas: [],
          dataMinima: null,
          dataMaxima: null
        });
      }

      const combinacao = grupo.combinacoes.get(chave);
      
      // Validar que tempo_estimado_dia é consistente (deve ser o mesmo para todos)
      if (combinacao.tempo_estimado_dia && registro.tempo_estimado_dia && 
          combinacao.tempo_estimado_dia !== parseInt(registro.tempo_estimado_dia, 10)) {
        console.warn(`⚠️  AVISO: Tempo estimado inconsistente no agrupador ${agrupadorId}, combinação ${chave}`);
        console.warn(`    Esperado: ${combinacao.tempo_estimado_dia}, Encontrado: ${registro.tempo_estimado_dia}`);
      }

      // Adicionar data à combinação
      if (dataRegistro && !combinacao.datas.includes(dataRegistro)) {
        combinacao.datas.push(dataRegistro);
        
        // Atualizar min/max da combinação
        if (!combinacao.dataMinima || dataRegistro < combinacao.dataMinima) {
          combinacao.dataMinima = dataRegistro;
        }
        if (!combinacao.dataMaxima || dataRegistro > combinacao.dataMaxima) {
          combinacao.dataMaxima = dataRegistro;
        }
      }
    });

    console.log(`✅ Total de ${agrupadores.size} agrupadores encontrados`);
    console.log('');

    // 3. Criar regras na nova tabela
    console.log('📝 Passo 3: Criando regras na tabela tempo_estimado_regra...');
    const regrasParaInserir = [];

    for (const [agrupadorId, grupo] of agrupadores.entries()) {
      stats.agrupadoresProcessados++;

      if (!grupo.dataMinima || !grupo.dataMaxima) {
        console.warn(`⚠️  Agrupador ${agrupadorId} não tem datas válidas, pulando...`);
        stats.erros++;
        continue;
      }

      // Para cada combinação única, criar uma regra
      for (const [chave, combinacao] of grupo.combinacoes.entries()) {
        // Usar período da combinação (pode ser menor que o período do grupo)
        const dataInicio = combinacao.dataMinima || grupo.dataMinima;
        const dataFim = combinacao.dataMaxima || grupo.dataMaxima;

        if (!dataInicio || !dataFim) {
          console.warn(`⚠️  Combinação ${chave} do agrupador ${agrupadorId} não tem datas válidas, pulando...`);
          stats.erros++;
          continue;
        }

        if (!combinacao.tarefa_id || !combinacao.responsavel_id || !combinacao.tempo_estimado_dia) {
          console.warn(`⚠️  Combinação ${chave} do agrupador ${agrupadorId} tem campos obrigatórios faltando, pulando...`);
          stats.erros++;
          continue;
        }

        // Criar regra
        regrasParaInserir.push({
          agrupador_id: agrupadorId,
          cliente_id: combinacao.cliente_id,
          produto_id: combinacao.produto_id,
          tarefa_id: combinacao.tarefa_id,
          responsavel_id: combinacao.responsavel_id,
          tipo_tarefa_id: combinacao.tipo_tarefa_id,
          data_inicio: dataInicio,
          data_fim: dataFim,
          tempo_estimado_dia: combinacao.tempo_estimado_dia,
          // Assumir valores padrão (não estavam na tabela antiga)
          incluir_finais_semana: true,
          incluir_feriados: true
        });

        stats.regrasCriadas++;
      }
    }

    console.log(`✅ Total de ${regrasParaInserir.length} regras preparadas para inserção`);
    console.log('');

    // 4. Inserir regras na nova tabela (em lotes para evitar timeout)
    if (regrasParaInserir.length > 0) {
      console.log('💾 Passo 4: Inserindo regras na tabela tempo_estimado_regra...');
      const TAMANHO_LOTE = 100;
      
      for (let i = 0; i < regrasParaInserir.length; i += TAMANHO_LOTE) {
        const lote = regrasParaInserir.slice(i, i + TAMANHO_LOTE);
        const inicioLote = i + 1;
        const fimLote = Math.min(i + TAMANHO_LOTE, regrasParaInserir.length);
        
        console.log(`   Inserindo lote ${Math.floor(i / TAMANHO_LOTE) + 1} (registros ${inicioLote} a ${fimLote} de ${regrasParaInserir.length})...`);
        
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado_regra')
          .insert(lote)
          .select();

        if (error) {
          console.error(`❌ Erro ao inserir lote (registros ${inicioLote} a ${fimLote}):`, error);
          stats.erros += lote.length;
          continue;
        }

        console.log(`   ✅ Lote inserido com sucesso (${data?.length || 0} regras)`);
      }
    }

    // 5. Relatório final
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 RELATÓRIO DE MIGRAÇÃO');
    console.log('='.repeat(80));
    console.log(`✅ Agrupadores processados: ${stats.agrupadoresProcessados}`);
    console.log(`✅ Regras criadas: ${stats.regrasCriadas}`);
    console.log(`📦 Registros antigos: ${stats.registrosAntigos}`);
    console.log(`📉 Redução: ${stats.registrosAntigos > 0 ? ((1 - stats.regrasCriadas / stats.registrosAntigos) * 100).toFixed(2) : 0}%`);
    console.log(`❌ Erros: ${stats.erros}`);
    console.log('');
    
    if (stats.erros > 0) {
      console.log('⚠️  ATENÇÃO: Alguns registros não puderam ser migrados. Verifique os avisos acima.');
    } else {
      console.log('✅ Migração concluída com sucesso!');
    }
    
    console.log('');
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('   1. Validar que todas as regras foram criadas corretamente');
    console.log('   2. Testar o endpoint GET /api/tempo-estimado com os novos dados');
    console.log('   3. Comparar resultados antes/depois da migração');
    console.log('   4. A tabela tempo_estimado permanece intacta (conforme solicitado)');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Erro fatal durante a migração:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar migração
if (require.main === module) {
  migrarTempoEstimadoParaRegras()
    .then(() => {
      console.log('✅ Script finalizado.');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrarTempoEstimadoParaRegras };

