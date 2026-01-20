
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'up_gestaointeligente' }
});

async function debugBanco() {
    console.log('🔍 Iniciando debug avançado...');

    // 1. Listar todas as tabelas (tentativa simples)
    // (Em supabase-js não é tão direto listar tabelas sem permissões de admin, vamos focar nos conteudos)

    // 2. Buscar Produto "BPO Financeiro" por nome
    console.log('\n🔍 Buscando "BPO Financeiro" em cp_produto...');
    const { data: bpo, error: errBpo } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('*')
        .ilike('nome', '%BPO Financeiro%'); // Case insensitive search

    if (errBpo) console.error('❌ Erro busca nome:', errBpo);
    else {
        console.log(`✅ ${bpo.length} produtos encontrados com "BPO Financeiro":`);
        bpo.forEach(p => console.log(`   - ID: "${p.id}", ClickUpID: "${p.clickup_id}", Nome: "${p.nome}"`));
    }

    // 3. Buscar Produto "68" em qualquer campo
    console.log('\n🔍 Buscando "68" em cp_produto (id ou clickup_id)...');
    const { data: busca68, error: err68 } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('*')
        .or(`id.eq.68,clickup_id.eq.68`);

    if (err68) console.error('❌ Erro busca 68:', err68);
    else {
        if (busca68.length === 0) console.log('⚠️ Nenhum produto encontrado com ID ou ClickUpID = 68');
        else busca68.forEach(p => console.log(`   - [ENCONTRADO] ID: "${p.id}", ClickUpID: "${p.clickup_id}", Nome: "${p.nome}"`));
    }

    // 4. Checar integridade do historico
    console.log('\n🔍 Verificando exemplo de historico com produto_id 68...');
    const { data: hist, error: errHist } = await supabase
        .schema('up_gestaointeligente')
        .from('historico_atribuicoes')
        .select('id, produto_ids, created_at')
        .limit(5);

    if (errHist) console.error('❌ Erro busca historico:', errHist);
    else {
        console.log(`✅ ${hist.length} registros de historico verificados.`);
        // Filtrar localmente por segurança se query complexa falhar
        const com68 = hist.filter(h => h.produto_ids && Array.isArray(h.produto_ids) && (h.produto_ids.includes(68) || h.produto_ids.includes('68')));
        console.log(`   - Registros com produto 68 encontrados: ${com68.length}`);
        com68.forEach(h => console.log(`     -> Histórico ID: ${h.id}, Produto IDs: ${JSON.stringify(h.produto_ids)}`));
    }
}

debugBanco();
