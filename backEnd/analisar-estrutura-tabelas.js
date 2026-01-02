// =============================================================
// === SCRIPT PARA ANALISAR ESTRUTURA DAS TABELAS NO SUPABASE ===
// =============================================================

require('dotenv').config();
const supabase = require('./src/config/database');

async function analisarEstruturaTabelas() {
  try {
    console.log('🔍 Analisando estrutura das tabelas no Supabase...\n');

    // 1. Analisar tabela vinculados
    console.log('📊 ==========================================');
    console.log('📊 TABELA: vinculados');
    console.log('📊 ==========================================\n');

    // Buscar alguns registros para ver a estrutura
    const { data: vinculados, error: errorVinculados } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('*')
      .limit(5);

    if (errorVinculados) {
      console.error('❌ Erro ao buscar vinculados:', errorVinculados);
    } else {
      console.log(`✅ Total de registros encontrados: ${vinculados?.length || 0}`);
      if (vinculados && vinculados.length > 0) {
        console.log('\n📋 Estrutura do primeiro registro:');
        console.log(JSON.stringify(vinculados[0], null, 2));
        
        console.log('\n📋 Colunas encontradas:');
        const colunas = Object.keys(vinculados[0]);
        colunas.forEach(col => {
          const valor = vinculados[0][col];
          const tipo = typeof valor;
          console.log(`  - ${col}: ${tipo} (valor exemplo: ${valor === null ? 'null' : valor})`);
        });
      }
    }

    // 2. Resumo das colunas encontradas
    console.log('\n\n📊 ==========================================');
    console.log('📊 RESUMO DAS COLUNAS ENCONTRADAS');
    console.log('📊 ==========================================\n');

    if (vinculados && vinculados.length > 0) {
      const colunas = Object.keys(vinculados[0]);
      console.log('✅ Colunas da tabela vinculados:');
      colunas.forEach(col => {
        const exemplo = vinculados[0][col];
        const tipo = typeof exemplo;
        const valorExemplo = exemplo === null ? 'null' : (typeof exemplo === 'object' ? JSON.stringify(exemplo) : exemplo);
        console.log(`  - ${col}: ${tipo} (exemplo: ${valorExemplo})`);
      });
    }

    // 3. Verificar se as colunas cp_atividade ou cp_tarefa existem
    console.log('\n\n📊 ==========================================');
    console.log('📊 VERIFICAÇÃO DE COLUNAS ESPECÍFICAS');
    console.log('📊 ==========================================\n');

    if (vinculados && vinculados.length > 0) {
      const primeiroRegistro = vinculados[0];
      const temCpAtividade = 'cp_atividade' in primeiroRegistro;
      const temCpTarefa = 'cp_tarefa' in primeiroRegistro;
      const temCpAtividadeTipo = 'cp_atividade_tipo' in primeiroRegistro;
      const temCpTarefaTipo = 'cp_tarefa_tipo' in primeiroRegistro;

      console.log('🔍 Verificando colunas:');
      console.log(`  - cp_atividade: ${temCpAtividade ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  - cp_tarefa: ${temCpTarefa ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  - cp_atividade_tipo: ${temCpAtividadeTipo ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  - cp_tarefa_tipo: ${temCpTarefaTipo ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);

      if (temCpAtividade) {
        console.log(`\n  📌 Valor exemplo de cp_atividade: ${primeiroRegistro.cp_atividade}`);
      }
      if (temCpTarefa) {
        console.log(`\n  📌 Valor exemplo de cp_tarefa: ${primeiroRegistro.cp_tarefa}`);
      }
    }

    // 4. Testar queries com diferentes nomes de colunas
    console.log('\n\n📊 ==========================================');
    console.log('📊 TESTE DE QUERIES COM DIFERENTES COLUNAS');
    console.log('📊 ==========================================\n');

    // Testar com cp_atividade
    console.log('🧪 Testando query com cp_atividade:');
    const { data: testeAtividade, error: erroAtividade } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cp_atividade, cp_atividade_tipo, cp_produto, cp_cliente')
      .limit(1);

    if (erroAtividade) {
      console.log(`  ❌ Erro: ${erroAtividade.message}`);
    } else {
      console.log(`  ✅ Sucesso! Retornou ${testeAtividade?.length || 0} registro(s)`);
      if (testeAtividade && testeAtividade.length > 0) {
        console.log(`  📋 Dados: ${JSON.stringify(testeAtividade[0], null, 2)}`);
      }
    }

    // Testar com cp_tarefa
    console.log('\n🧪 Testando query com cp_tarefa:');
    const { data: testeTarefa, error: erroTarefa } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cp_tarefa, cp_tarefa_tipo, cp_produto, cp_cliente')
      .limit(1);

    if (erroTarefa) {
      console.log(`  ❌ Erro: ${erroTarefa.message}`);
    } else {
      console.log(`  ✅ Sucesso! Retornou ${testeTarefa?.length || 0} registro(s)`);
      if (testeTarefa && testeTarefa.length > 0) {
        console.log(`  📋 Dados: ${JSON.stringify(testeTarefa[0], null, 2)}`);
      }
    }

    // 5. Conclusão
    console.log('\n\n📊 ==========================================');
    console.log('📊 CONCLUSÃO');
    console.log('📊 ==========================================\n');

    if (vinculados && vinculados.length > 0) {
      const primeiroRegistro = vinculados[0];
      const temCpAtividade = 'cp_atividade' in primeiroRegistro;
      const temCpTarefa = 'cp_tarefa' in primeiroRegistro;

      if (temCpAtividade && !temCpTarefa) {
        console.log('✅ CONFIRMADO: A tabela usa cp_atividade e cp_atividade_tipo');
        console.log('   O código deve usar estes nomes nas queries SQL.');
      } else if (temCpTarefa && !temCpAtividade) {
        console.log('✅ CONFIRMADO: A tabela usa cp_tarefa e cp_tarefa_tipo');
        console.log('   O código está correto.');
      } else {
        console.log('⚠️ ATENÇÃO: Verifique manualmente os nomes das colunas');
      }
    }

    console.log('\n\n✅ Análise concluída!\n');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar análise
analisarEstruturaTabelas();

