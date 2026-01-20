
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'up_gestaointeligente' }
});

async function listarProdutos() {
    console.log('🔍 Listando produtos do banco...');

    const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome');

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    console.log(`✅ ${data.length} produtos encontrados.`);
    console.log('--- Amostra de produtos ---');
    console.log(JSON.stringify(data.slice(0, 10), null, 2));

    console.log('\n--- Verificando IDs problemáticos (68, 131, 69) ---');
    const problematicos = ['68', '131', '69'];

    problematicos.forEach(idBusca => {
        const porId = data.find(p => String(p.id).trim() === idBusca);
        const porClickup = data.find(p => String(p.clickup_id).trim() === idBusca);

        if (porId) console.log(`[ENCONTRADO POR ID] ${idBusca} -> ${porId.nome} (ID: ${porId.id})`);
        if (porClickup) console.log(`[ENCONTRADO POR CLICKUP] ${idBusca} -> ${porClickup.nome} (ClickUp: ${porClickup.clickup_id})`);
        if (!porId && !porClickup) console.log(`[NÃO ENCONTRADO] ${idBusca}`);
    });
}

listarProdutos();
