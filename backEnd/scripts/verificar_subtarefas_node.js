/**
 * Script Node.js para verificar subtarefas vinculadas no banco de dados
 * Execute: node verificar_subtarefas_node.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente ID para testar (substitua pelo ID real)
const CLIENTE_ID = '25775b0a-e907-414e-985a-673d43f31de9';

async function verificarSubtarefas() {
  console.log('🔍 Verificando subtarefas vinculadas ao cliente:', CLIENTE_ID);
  console.log('='.repeat(80));

  try {
    // 1. Buscar todos os vinculados com subtarefa para este cliente
    console.log('\n1️⃣ Buscando vinculados com subtarefa...');
    const { data: vinculados, error: errorVinculados } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cliente_id, produto_id, tarefa_id, subtarefa_id, tipo_relacionamento')
      .eq('cliente_id', CLIENTE_ID)
      .not('subtarefa_id', 'is', null);

    if (errorVinculados) {
      console.error('❌ Erro ao buscar vinculados:', errorVinculados);
      return;
    }

    console.log(`✅ Encontrados ${vinculados?.length || 0} vinculado(s) com subtarefa`);
    
    if (vinculados && vinculados.length > 0) {
      console.log('\n📋 Detalhes dos vinculados:');
      vinculados.forEach((v, idx) => {
        console.log(`  ${idx + 1}. ID: ${v.id}`);
        console.log(`     Produto: ${v.produto_id}, Tarefa: ${v.tarefa_id}, Subtarefa: ${v.subtarefa_id}`);
        console.log(`     Tipo: ${v.tipo_relacionamento || 'N/A'}`);
      });
    }

    // 2. Agrupar por produto e tarefa
    console.log('\n2️⃣ Agrupando por produto e tarefa...');
    const agrupados = {};
    vinculados?.forEach(v => {
      const key = `${v.produto_id}_${v.tarefa_id}`;
      if (!agrupados[key]) {
        agrupados[key] = {
          produto_id: v.produto_id,
          tarefa_id: v.tarefa_id,
          subtarefa_ids: []
        };
      }
      if (v.subtarefa_id) {
        agrupados[key].subtarefa_ids.push(v.subtarefa_id);
      }
    });

    console.log(`✅ Encontrados ${Object.keys(agrupados).length} combinação(ões) produto-tarefa`);
    
    // 3. Para cada combinação, buscar detalhes e verificar o que a API retorna
    for (const [key, grupo] of Object.entries(agrupados)) {
      console.log(`\n3️⃣ Processando Produto ${grupo.produto_id} → Tarefa ${grupo.tarefa_id}...`);
      
      // Buscar nomes
      const { data: produto } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, nome')
        .eq('id', grupo.produto_id)
        .single();

      const { data: tarefa } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tarefa')
        .select('id, nome')
        .eq('id', grupo.tarefa_id)
        .single();

      const { data: subtarefas } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_subtarefa')
        .select('id, nome')
        .in('id', grupo.subtarefa_ids);

      console.log(`   Produto: ${produto?.nome || `#${grupo.produto_id}`}`);
      console.log(`   Tarefa: ${tarefa?.nome || `#${grupo.tarefa_id}`}`);
      console.log(`   Subtarefas vinculadas ao cliente (${grupo.subtarefa_ids.length}):`);
      grupo.subtarefa_ids.forEach((stId, idx) => {
        const st = subtarefas?.find(s => s.id === stId);
        console.log(`     ${idx + 1}. ID: ${stId} - ${st?.nome || 'N/A'}`);
      });

      // 4. Simular o que a API getTarefasPorClienteEProdutos retorna
      console.log(`\n4️⃣ Simulando resposta da API...`);
      
      // Buscar vinculados do cliente para este produto e tarefa
      const { data: vinculadosCliente } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('tarefa_id, subtarefa_id')
        .eq('cliente_id', CLIENTE_ID)
        .eq('produto_id', grupo.produto_id)
        .eq('tarefa_id', grupo.tarefa_id)
        .not('subtarefa_id', 'is', null);

      const subtarefasVinculadasCliente = vinculadosCliente
        ?.map(v => v.subtarefa_id)
        .filter(id => id !== null && id !== undefined) || [];

      console.log(`   subtarefasVinculadasCliente que a API deveria retornar:`);
      console.log(`   [${subtarefasVinculadasCliente.join(', ')}]`);
      console.log(`   Tipo dos IDs: ${subtarefasVinculadasCliente.length > 0 ? typeof subtarefasVinculadasCliente[0] : 'N/A'}`);

      // 5. Buscar todas as subtarefas vinculadas à tarefa (herança)
      const { data: vinculadosHeranca } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('subtarefa_id')
        .eq('tarefa_id', grupo.tarefa_id)
        .not('subtarefa_id', 'is', null)
        .is('produto_id', null)
        .is('cliente_id', null);

      const subtarefasHeranca = vinculadosHeranca
        ?.map(v => v.subtarefa_id)
        .filter(id => id !== null && id !== undefined) || [];

      console.log(`\n   Subtarefas vinculadas à tarefa (herança - ${subtarefasHeranca.length}):`);
      console.log(`   [${subtarefasHeranca.join(', ')}]`);

      // 6. Comparar
      console.log(`\n5️⃣ Comparação:`);
      console.log(`   Subtarefas do cliente: ${subtarefasVinculadasCliente.length}`);
      console.log(`   Subtarefas herdadas: ${subtarefasHeranca.length}`);
      console.log(`   IDs do cliente: ${JSON.stringify(subtarefasVinculadasCliente)}`);
      console.log(`   IDs herdados: ${JSON.stringify(subtarefasHeranca)}`);
    }

    // 7. Verificar tipos de dados
    console.log(`\n6️⃣ Verificando tipos de dados...`);
    if (vinculados && vinculados.length > 0) {
      const primeiro = vinculados[0];
      console.log(`   produto_id: ${primeiro.produto_id} (tipo: ${typeof primeiro.produto_id})`);
      console.log(`   tarefa_id: ${primeiro.tarefa_id} (tipo: ${typeof primeiro.tarefa_id})`);
      console.log(`   subtarefa_id: ${primeiro.subtarefa_id} (tipo: ${typeof primeiro.subtarefa_id})`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro ao verificar subtarefas:', error);
  }
}

// Executar
verificarSubtarefas()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

