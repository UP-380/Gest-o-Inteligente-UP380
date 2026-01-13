/**
 * Script temporário para verificar tarefas estimadas para hoje
 * 
 * Este script verifica se há regras de tempo estimado que cobrem a data de hoje
 */

// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabase = require('../src/config/database');

async function verificarTarefasHoje() {
  try {
    // Data de hoje no formato YYYY-MM-DD
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    
    console.log('🔍 Verificando tarefas estimadas para:', hojeStr);
    console.log('='.repeat(80));
    console.log('');

    // 1. Buscar todas as regras que cobrem a data de hoje
    console.log('📊 Passo 1: Buscando regras que cobrem a data de hoje...');
    const { data: regras, error: regrasError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .select('*')
      .lte('data_inicio', hojeStr)
      .gte('data_fim', hojeStr);

    if (regrasError) {
      console.error('❌ Erro ao buscar regras:', regrasError);
      return;
    }

    console.log(`✅ Encontradas ${regras?.length || 0} regra(s) que cobrem a data de hoje`);
    console.log('');

    if (!regras || regras.length === 0) {
      console.log('⚠️  Nenhuma regra encontrada que cubra a data de hoje.');
      console.log('');
      console.log('📊 Verificando se há regras no sistema...');
      
      // Verificar se há regras no sistema (sem filtro de data)
      const { data: todasRegras, error: todasRegrasError } = await supabase
        .schema('up_gestaointeligente')
        .from('tempo_estimado_regra')
        .select('id, data_inicio, data_fim, responsavel_id, cliente_id')
        .limit(10);

      if (todasRegrasError) {
        console.error('❌ Erro ao buscar todas as regras:', todasRegrasError);
        return;
      }

      console.log(`✅ Total de regras no sistema (amostra de 10): ${todasRegras?.length || 0}`);
      if (todasRegras && todasRegras.length > 0) {
        console.log('');
        console.log('📋 Exemplos de regras encontradas:');
        todasRegras.forEach((regra, index) => {
          console.log(`  ${index + 1}. ID: ${regra.id}`);
          console.log(`     Período: ${regra.data_inicio} até ${regra.data_fim}`);
          console.log(`     Responsável ID: ${regra.responsavel_id}`);
          console.log(`     Cliente ID: ${regra.cliente_id}`);
          console.log('');
        });
      }
      return;
    }

    // 2. Agrupar por responsável
    console.log('👥 Passo 2: Agrupando por responsável...');
    const porResponsavel = new Map();
    regras.forEach(regra => {
      const responsavelId = regra.responsavel_id;
      if (!porResponsavel.has(responsavelId)) {
        porResponsavel.set(responsavelId, []);
      }
      porResponsavel.get(responsavelId).push(regra);
    });

    console.log(`✅ Encontradas regras para ${porResponsavel.size} responsável(is)`);
    console.log('');

    // 3. Buscar informações dos responsáveis
    const responsavelIds = Array.from(porResponsavel.keys());
    const { data: membros, error: membrosError } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id, nome, usuario_id')
      .in('id', responsavelIds);

    const membroMap = new Map();
    if (!membrosError && membros) {
      membros.forEach(membro => {
        membroMap.set(membro.id, membro);
      });
    }

    // 4. Exibir detalhes
    console.log('📋 Detalhes das regras por responsável:');
    console.log('='.repeat(80));
    porResponsavel.forEach((regrasDoResponsavel, responsavelId) => {
      const membro = membroMap.get(responsavelId);
      const nomeResponsavel = membro ? membro.nome : `ID ${responsavelId}`;
      
      console.log('');
      console.log(`👤 Responsável: ${nomeResponsavel} (ID: ${responsavelId})`);
      console.log(`   Total de regras: ${regrasDoResponsavel.length}`);
      
      // Agrupar por cliente
      const porCliente = new Map();
      regrasDoResponsavel.forEach(regra => {
        const clienteId = regra.cliente_id;
        if (!porCliente.has(clienteId)) {
          porCliente.set(clienteId, []);
        }
        porCliente.get(clienteId).push(regra);
      });
      
      console.log(`   Clientes: ${porCliente.size}`);
      porCliente.forEach((regrasDoCliente, clienteId) => {
        console.log(`     - Cliente ID: ${clienteId} (${regrasDoCliente.length} regra(s))`);
        regrasDoCliente.forEach(regra => {
          const tempoHoras = (regra.tempo_estimado_dia / (1000 * 60 * 60)).toFixed(2);
          console.log(`       • Produto: ${regra.produto_id}, Tarefa: ${regra.tarefa_id}`);
          console.log(`         Período: ${regra.data_inicio} até ${regra.data_fim}`);
          console.log(`         Tempo/dia: ${tempoHoras}h`);
          console.log(`         Finais de semana: ${regra.incluir_finais_semana ? 'Sim' : 'Não'}`);
          console.log(`         Feriados: ${regra.incluir_feriados ? 'Sim' : 'Não'}`);
        });
      });
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    console.error(error.stack);
  }
}

// Executar
verificarTarefasHoje()
  .then(() => {
    console.log('');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

