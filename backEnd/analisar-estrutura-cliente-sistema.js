/**
 * Script para analisar a estrutura real da tabela cliente_sistema no Supabase
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'up_gestaointeligente' }
});

async function analisarEstrutura() {
  try {
    console.log('🔍 Analisando estrutura da tabela cliente_sistema...\n');

    // Buscar algumas linhas para ver os campos
    const { data: amostras, error: errorAmostras } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select('*')
      .limit(5);

    if (errorAmostras) {
      console.error('❌ Erro ao buscar amostras:', errorAmostras);
      return;
    }

    console.log('📊 Amostras de dados:');
    console.log(JSON.stringify(amostras, null, 2));
    console.log('\n');

    // Buscar informações sobre a estrutura da tabela através do information_schema
    const { data: colunas, error: errorColunas } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'up_gestaointeligente')
      .eq('table_name', 'cliente_sistema')
      .order('ordinal_position');

    if (errorColunas) {
      console.log('⚠️  Não foi possível buscar informações do information_schema diretamente.');
      console.log('📋 Campos identificados através das amostras:\n');
      
      if (amostras && amostras.length > 0) {
        const campos = Object.keys(amostras[0]);
        console.log('Total de campos:', campos.length);
        console.log('\nLista de campos:');
        campos.forEach((campo, index) => {
          const exemplo = amostras[0][campo];
          const tipo = typeof exemplo;
          console.log(`  ${index + 1}. ${campo} (${tipo}${exemplo === null ? ', nullable' : ''})`);
        });
      }
    } else {
      console.log('📋 Estrutura da tabela cliente_sistema:\n');
      console.log(`Total de colunas: ${colunas.length}\n`);
      
      colunas.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name}`);
        console.log(`   Tipo: ${col.data_type}`);
        console.log(`   Nullable: ${col.is_nullable}`);
        if (col.column_default) {
          console.log(`   Default: ${col.column_default}`);
        }
        console.log('');
      });
    }

    // Buscar relacionamentos (foreign keys)
    console.log('\n🔗 Verificando relacionamentos...\n');
    
    // Buscar dados com relacionamentos para entender melhor
    const { data: comRelacionamentos, error: errorRel } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select(`
        *,
        cp_sistema (
          id,
          nome,
          codigo
        ),
        cp_cliente (
          id,
          nome
        )
      `)
      .limit(1);

    if (!errorRel && comRelacionamentos && comRelacionamentos.length > 0) {
      console.log('✅ Relacionamentos encontrados:');
      console.log('   - cp_sistema (sistema relacionado)');
      console.log('   - cp_cliente (cliente relacionado)');
    }

    console.log('\n✅ Análise concluída!');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

analisarEstrutura();

