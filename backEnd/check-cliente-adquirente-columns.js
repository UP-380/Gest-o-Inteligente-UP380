const supabase = require('./src/config/database');

(async () => {
  try {
    // Tentar inserir um registro temporário e depois deletar para ver a estrutura
    // Ou buscar a estrutura via query direta
    console.log('Verificando estrutura da tabela cliente_adquirente...\n');
    
    // Tentar fazer um select com campos específicos para ver quais existem
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_adquirente')
      .select('*')
      .limit(0); // Não retorna dados, mas valida os campos

    if (error) {
      console.log('Erro ao acessar tabela:', error.message);
      console.log('Código:', error.code);
      console.log('\nA tabela pode não ter registros ou os campos podem ter nomes diferentes.');
      console.log('Por favor, verifique no Supabase quais são os nomes exatos das colunas.');
    } else {
      console.log('Tabela acessível. Campos disponíveis devem ser consultados diretamente no Supabase.');
    }
    
    // Vamos tentar fazer uma query simples para ver os campos
    console.log('\nTentando identificar campos...');
    console.log('Se possível, execute no Supabase SQL Editor:');
    console.log('SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = \'up_gestaointeligente\' AND table_name = \'cliente_adquirente\' ORDER BY ordinal_position;');
    
  } catch (err) {
    console.error('Erro:', err);
  }
  process.exit(0);
})();

