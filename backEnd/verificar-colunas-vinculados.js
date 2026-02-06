// =============================================================
// === SCRIPT PARA VERIFICAR COLUNAS DA TABELA VINCULADOS ===
// =============================================================

require('dotenv').config();
const supabase = require('./src/config/database');

async function verificarColunas() {
  try {
    console.log('🔍 Verificando colunas da tabela vinculados no Supabase...\n');

    // Método 1: Buscar um registro e ver as chaves
    console.log('📊 MÉTODO 1: Analisando estrutura de um registro');
    console.log('='.repeat(60));
    const { data: registro, error: errorRegistro } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('*')
      .limit(1);

    if (errorRegistro) {
      console.error('❌ Erro:', errorRegistro);
    } else if (registro && registro.length > 0) {
      const colunas = Object.keys(registro[0]);
      console.log('\n✅ Colunas encontradas no registro:');
      colunas.forEach(col => {
        console.log(`  - ${col}`);
      });

      // Verificar especificamente
      const temAtividade = colunas.includes('cp_atividade');
      const temTarefa = colunas.includes('cp_tarefa');
      const temAtividadeTipo = colunas.includes('cp_atividade_tipo');
      const temTarefaTipo = colunas.includes('cp_tarefa_tipo');

      console.log('\n🔍 Verificação específica:');
      console.log(`  cp_atividade: ${temAtividade ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  cp_tarefa: ${temTarefa ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  cp_atividade_tipo: ${temAtividadeTipo ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
      console.log(`  cp_tarefa_tipo: ${temTarefaTipo ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);

      console.log('\n📋 Registro completo:');
      console.log(JSON.stringify(registro[0], null, 2));
    }

    // Método 2: Tentar queries diretas
    console.log('\n\n📊 MÉTODO 2: Testando queries diretas');
    console.log('='.repeat(60));

    // Testar cp_atividade
    console.log('\n🧪 Testando SELECT com cp_atividade:');
    const { data: teste1, error: erro1 } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cp_atividade, cp_atividade_tipo')
      .limit(1);

    if (erro1) {
      console.log(`  ❌ Erro: ${erro1.message}`);
      console.log(`  Código: ${erro1.code}`);
    } else {
      console.log(`  ✅ Sucesso! Dados: ${JSON.stringify(teste1)}`);
    }

    // Testar cp_tarefa
    console.log('\n🧪 Testando SELECT com cp_tarefa:');
    const { data: teste2, error: erro2 } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cp_tarefa, cp_tarefa_tipo')
      .limit(1);

    if (erro2) {
      console.log(`  ❌ Erro: ${erro2.message}`);
      console.log(`  Código: ${erro2.code}`);
    } else {
      console.log(`  ✅ Sucesso! Dados: ${JSON.stringify(teste2)}`);
    }

    // Método 3: Verificar todas as colunas possíveis
    console.log('\n\n📊 MÉTODO 3: Verificando todas as colunas relacionadas');
    console.log('='.repeat(60));

    const colunasParaTestar = [
      'cp_atividade',
      'cp_tarefa',
      'cp_atividade_tipo',
      'cp_tarefa_tipo',
      'cp_produto',
      'cp_cliente'
    ];

    for (const coluna of colunasParaTestar) {
      try {
        const { data, error } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .select(`id, ${coluna}`)
          .limit(1);

        if (error) {
          console.log(`  ${coluna}: ❌ ${error.message}`);
        } else {
          console.log(`  ${coluna}: ✅ EXISTE`);
        }
      } catch (e) {
        console.log(`  ${coluna}: ❌ ${e.message}`);
      }
    }

    console.log('\n\n✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

verificarColunas();

