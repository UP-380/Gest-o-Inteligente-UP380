// =============================================================
// === SCRIPT DE ANÁLISE E MELHORIA DAS TABELAS DE VINCULAÇÕES ===
// =============================================================

const supabase = require('./src/config/database');

async function analisarEstrutura() {
  console.log('🔍 Analisando estrutura das tabelas de vinculações...\n');

  try {
    // 1. Analisar tabela cp_vinculacao
    console.log('📊 Analisando tabela cp_vinculacao...');
    const { data: vinculacoes, error: errorVinculacoes } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('*')
      .limit(10);

    if (errorVinculacoes) {
      console.error('❌ Erro ao buscar cp_vinculacao:', errorVinculacoes);
    } else {
      console.log(`✅ Total de registros em cp_vinculacao: ${vinculacoes?.length || 0}`);
      if (vinculacoes && vinculacoes.length > 0) {
        console.log('📋 Exemplo de registro:', JSON.stringify(vinculacoes[0], null, 2));
      }
    }

    // 2. Analisar tabela vinculados
    console.log('\n📊 Analisando tabela vinculados...');
    const { data: vinculados, error: errorVinculados } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('*')
      .limit(10);

    if (errorVinculados) {
      console.error('❌ Erro ao buscar vinculados:', errorVinculados);
    } else {
      console.log(`✅ Total de registros em vinculados: ${vinculados?.length || 0}`);
      if (vinculados && vinculados.length > 0) {
        console.log('📋 Exemplo de registro:', JSON.stringify(vinculados[0], null, 2));
      }
    }

    // 3. Verificar duplicatas na tabela vinculados
    console.log('\n🔍 Verificando duplicatas na tabela vinculados...');
    const { data: todosVinculados, error: errorTodos } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('cp_atividade, cp_atividade_tipo, cp_produto, cp_cliente');

    if (errorTodos) {
      console.error('❌ Erro ao buscar todos vinculados:', errorTodos);
    } else {
      const duplicatas = {};
      todosVinculados?.forEach((v, idx) => {
        const chave = JSON.stringify({
          cp_atividade: v.cp_atividade,
          cp_atividade_tipo: v.cp_atividade_tipo,
          cp_produto: v.cp_produto,
          cp_cliente: v.cp_cliente
        });
        if (!duplicatas[chave]) {
          duplicatas[chave] = [];
        }
        duplicatas[chave].push(idx);
      });

      const duplicatasEncontradas = Object.entries(duplicatas).filter(([_, indices]) => indices.length > 1);
      console.log(`⚠️  Duplicatas encontradas: ${duplicatasEncontradas.length}`);
      if (duplicatasEncontradas.length > 0) {
        console.log('📋 Primeiras duplicatas:');
        duplicatasEncontradas.slice(0, 5).forEach(([chave, indices]) => {
          console.log(`   - ${chave} (${indices.length} ocorrências)`);
        });
      }
    }

    // 4. Verificar índices existentes (via query SQL)
    console.log('\n📊 Verificando índices existentes...');
    const { data: indices, error: errorIndices } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          indexname, 
          indexdef 
        FROM pg_indexes 
        WHERE schemaname = 'up_gestaointeligente' 
        AND tablename IN ('vinculados', 'cp_vinculacao')
        ORDER BY tablename, indexname;
      `
    }).catch(() => {
      // Se RPC não existir, tentar query direta
      return { data: null, error: { message: 'RPC não disponível' } };
    });

    if (errorIndices) {
      console.log('ℹ️  Não foi possível verificar índices via RPC. Verificando via query direta...');
      // Tentar verificar constraints via query de informações
      const { data: constraints, error: errorConstraints } = await supabase
        .from('information_schema.table_constraints')
        .select('*')
        .eq('table_schema', 'up_gestaointeligente')
        .in('table_name', ['vinculados', 'cp_vinculacao']);

      if (!errorConstraints && constraints) {
        console.log(`✅ Constraints encontradas: ${constraints.length}`);
        constraints.forEach(c => {
          console.log(`   - ${c.table_name}.${c.constraint_name} (${c.constraint_type})`);
        });
      }
    } else if (indices) {
      console.log(`✅ Índices encontrados: ${indices.length}`);
      indices.forEach(idx => {
        console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
      });
    }

    // 5. Estatísticas gerais
    console.log('\n📈 Estatísticas gerais:');
    const { count: countVinculados } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('*', { count: 'exact', head: true });

    const { count: countVinculacoes } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_vinculacao')
      .select('*', { count: 'exact', head: true });

    console.log(`   - Total de registros em vinculados: ${countVinculados || 0}`);
    console.log(`   - Total de registros em cp_vinculacao: ${countVinculacoes || 0}`);

    // Verificar distribuição de valores não-nulos
    if (todosVinculados && todosVinculados.length > 0) {
      const stats = {
        com_atividade: todosVinculados.filter(v => v.cp_atividade !== null).length,
        com_atividade_tipo: todosVinculados.filter(v => v.cp_atividade_tipo !== null).length,
        com_produto: todosVinculados.filter(v => v.cp_produto !== null).length,
        com_cliente: todosVinculados.filter(v => v.cp_cliente !== null && v.cp_cliente !== '').length
      };
      console.log('\n📊 Distribuição de valores não-nulos em vinculados:');
      console.log(`   - Com atividade: ${stats.com_atividade}`);
      console.log(`   - Com atividade_tipo: ${stats.com_atividade_tipo}`);
      console.log(`   - Com produto: ${stats.com_produto}`);
      console.log(`   - Com cliente: ${stats.com_cliente}`);
    }

    return {
      vinculados: todosVinculados,
      duplicatas: duplicatasEncontradas?.length || 0
    };

  } catch (error) {
    console.error('❌ Erro na análise:', error);
    throw error;
  }
}

async function criarIndicesEConstraints() {
  console.log('\n🔧 Criando índices e constraints...\n');

  try {
    // Nota: Supabase não permite executar DDL diretamente via cliente JS
    // Essas queries devem ser executadas manualmente no Supabase SQL Editor
    // ou via migrations

    const sqlQueries = [
      // 1. Criar índice único parcial para evitar duplicatas (considerando NULLs)
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculados_unique 
       ON up_gestaointeligente.vinculados (
         COALESCE(cp_atividade::text, 'NULL'),
         COALESCE(cp_atividade_tipo::text, 'NULL'),
         COALESCE(cp_produto::text, 'NULL'),
         COALESCE(cp_cliente, 'NULL')
       );`,

      // 2. Criar índices para melhorar performance de queries
      `CREATE INDEX IF NOT EXISTS idx_vinculados_atividade 
       ON up_gestaointeligente.vinculados(cp_atividade) 
       WHERE cp_atividade IS NOT NULL;`,

      `CREATE INDEX IF NOT EXISTS idx_vinculados_atividade_tipo 
       ON up_gestaointeligente.vinculados(cp_atividade_tipo) 
       WHERE cp_atividade_tipo IS NOT NULL;`,

      `CREATE INDEX IF NOT EXISTS idx_vinculados_produto 
       ON up_gestaointeligente.vinculados(cp_produto) 
       WHERE cp_produto IS NOT NULL;`,

      `CREATE INDEX IF NOT EXISTS idx_vinculados_cliente 
       ON up_gestaointeligente.vinculados(cp_cliente) 
       WHERE cp_cliente IS NOT NULL AND cp_cliente != '';`,

      // 3. Adicionar constraint para garantir que pelo menos 2 campos estejam preenchidos
      // (Isso deve ser feito via trigger ou validação no backend)
    ];

    console.log('📝 SQL Queries para executar no Supabase SQL Editor:\n');
    sqlQueries.forEach((sql, idx) => {
      console.log(`-- Query ${idx + 1}:`);
      console.log(sql);
      console.log('');
    });

    console.log('⚠️  IMPORTANTE: Execute essas queries no Supabase SQL Editor!');
    console.log('   O cliente JS do Supabase não permite executar DDL diretamente.\n');

  } catch (error) {
    console.error('❌ Erro ao gerar queries:', error);
    throw error;
  }
}

// Executar análise
async function main() {
  try {
    const resultado = await analisarEstrutura();
    await criarIndicesEConstraints();
    
    console.log('\n✅ Análise concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Execute as queries SQL no Supabase SQL Editor');
    console.log('   2. Atualize o backend para validar duplicatas antes de inserir');
    console.log('   3. Teste a criação de vinculações para verificar se duplicatas são bloqueadas');
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { analisarEstrutura, criarIndicesEConstraints };

