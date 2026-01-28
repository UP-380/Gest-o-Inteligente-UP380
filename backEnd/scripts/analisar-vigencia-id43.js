// ============================================================================
// Script de Análise - Verificar dados da vigência ID 43
// ============================================================================
// Este script consulta diretamente o Supabase para verificar os valores
// armazenados na tabela custo_membro_vigencia para o ID 43
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'up_gestaointeligente' },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});

async function analisarVigencia() {
  console.log('🔍 Consultando vigência ID 43 na tabela custo_membro_vigencia...\n');

  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('id', 43)
      .single();

    if (error) {
      console.error('❌ Erro ao consultar:', error);
      return;
    }

    if (!data) {
      console.error('❌ Vigência ID 43 não encontrada');
      return;
    }

    console.log('✅ Dados encontrados na tabela custo_membro_vigencia:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${data.id}`);
    console.log(`Membro ID: ${data.membro_id}`);
    console.log(`Data Vigência: ${data.dt_vigencia}`);
    console.log(`Horas Contratadas/Dia: ${data.horascontratadasdia}`);
    console.log(`Salário Base: ${data.salariobase} (tipo: ${typeof data.salariobase})`);
    console.log(`Tipo Contrato: ${data.tipo_contrato}`);
    console.log(`Descrição: ${data.descricao || '(vazio)'}`);
    console.log('');
    console.log('📊 BENEFÍCIOS E ENCARGOS:');
    console.log(`  Férias: ${data.ferias} (tipo: ${typeof data.ferias})`);
    console.log(`  Um Terço Férias: ${data.um_terco_ferias} (tipo: ${typeof data.um_terco_ferias})`);
    console.log(`  FGTS: ${data.fgts} (tipo: ${typeof data.fgts})`);
    console.log(`  Décimo Terceiro: ${data.decimoterceiro} (tipo: ${typeof data.decimoterceiro})`);
    console.log(`  Vale Transporte: ${data.valetransporte} (tipo: ${typeof data.valetransporte}) ⭐`);
    console.log(`  Ajuda de Custo: ${data.ajudacusto} (tipo: ${typeof data.ajudacusto})`);
    console.log(`  Vale Refeição: ${data.vale_refeicao} (tipo: ${typeof data.vale_refeicao})`);
    console.log(`  Custo Hora: ${data.custo_hora} (tipo: ${typeof data.custo_hora})`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Análise específica do Vale Transporte
    console.log('🔎 ANÁLISE DO VALE TRANSPORTE:');
    console.log(`  Valor bruto do banco: "${data.valetransporte}"`);
    console.log(`  Tipo de dado: ${typeof data.valetransporte}`);
    console.log(`  É string? ${typeof data.valetransporte === 'string'}`);
    console.log(`  É número? ${typeof data.valetransporte === 'number'}`);
    console.log(`  É null? ${data.valetransporte === null}`);
    console.log(`  É undefined? ${data.valetransporte === undefined}`);
    
    if (data.valetransporte) {
      const valorString = String(data.valetransporte);
      console.log(`  Como string: "${valorString}"`);
      console.log(`  Tamanho: ${valorString.length} caracteres`);
      console.log(`  Contém ponto? ${valorString.includes('.')}`);
      console.log(`  Contém vírgula? ${valorString.includes(',')}`);
      
      // Tentar parsear como número
      const valorNumerico = parseFloat(valorString.replace(',', '.'));
      console.log(`  Como número (parseFloat): ${valorNumerico}`);
      console.log(`  É NaN? ${isNaN(valorNumerico)}`);
    }
    
    console.log('');
    console.log('📋 VALOR ESPERADO: 9,00 ou 9.00');
    console.log('📋 VALOR ATUAL NO BANCO:', data.valetransporte);
    
    if (String(data.valetransporte) === '9,00' || String(data.valetransporte) === '9.00' || parseFloat(String(data.valetransporte).replace(',', '.')) === 9) {
      console.log('✅ Valor no banco está correto (9,00)');
    } else {
      console.log('⚠️  VALOR NO BANCO DIFERE DO ESPERADO!');
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar análise
analisarVigencia()
  .then(() => {
    console.log('\n✅ Análise concluída');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
