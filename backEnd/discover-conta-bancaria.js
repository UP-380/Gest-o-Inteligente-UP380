const supabase = require('./src/config/database');

(async () => {
  try {
    console.log('🔍 Testando campos da tabela cliente_conta_bancaria...\n');
    
    // Buscar um cliente válido
    const { data: clientes } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id')
      .limit(1);
    
    const clienteId = clientes[0].id;
    
    // Buscar um banco válido
    const { data: bancos } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_banco')
      .select('id')
      .limit(1);
    
    const bancoId = bancos[0].id;
    
    console.log('Cliente ID:', clienteId);
    console.log('Banco ID:', bancoId);
    
    // Testar campos individuais
    const camposParaTestar = [
      'id', 'created_at', 'cliente_id', 'banco_id',
      'agencia', 'conta', 'tipo_conta', 'tipo', 'tipoconta',
      'digito', 'digito_conta', 'observacao', 'obs',
      'titular', 'cpf_titular', 'cnpj_titular'
    ];
    
    console.log('\nTestando quais campos existem...\n');
    const camposExistentes = [];
    
    for (const campo of camposParaTestar) {
      const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cliente_conta_bancaria')
        .select(campo)
        .limit(1);
      
      if (!error) {
        console.log(`   ✅ ${campo}`);
        camposExistentes.push(campo);
      } else if (error.code === 'PGRST204') {
        console.log(`   ❌ ${campo}`);
      }
    }
    
    console.log('\n\n📋 CAMPOS QUE EXISTEM:');
    console.log(camposExistentes.join(', '));
    
    // Tentar inserir com apenas campos básicos
    console.log('\n\nTentando inserir com campos básicos...');
    const { data: testRecord, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .insert([{
        cliente_id: clienteId,
        banco_id: bancoId,
        agencia: '0001',
        conta: '12345-6'
      }])
      .select('*')
      .single();
    
    if (insertError) {
      console.log('❌ Erro:', insertError.message);
    } else if (testRecord) {
      console.log('✅ SUCESSO! Todos os campos da tabela:\n');
      const campos = Object.keys(testRecord);
      campos.forEach((campo, index) => {
        console.log(`   ${index + 1}. ${campo} = ${JSON.stringify(testRecord[campo])}`);
      });
      
      // Deletar
      await supabase
        .schema('up_gestaointeligente')
        .from('cliente_conta_bancaria')
        .delete()
        .eq('id', testRecord.id);
      console.log('\n✅ Registro de teste deletado');
    }
    
  } catch (err) {
    console.error('Erro:', err);
  }
  process.exit(0);
})();

