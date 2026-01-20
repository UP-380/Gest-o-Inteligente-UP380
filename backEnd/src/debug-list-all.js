
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'up_gestaointeligente' }
});

async function listAllProducts() {
    console.log('🔍 Listando 100 primeiros produtos...');

    const { data, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .limit(100);

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    console.log(`✅ ${data.length} produtos encontrados.`);
    data.forEach(p => {
        console.log(`ID: "${p.id}" | ClickUp: "${p.clickup_id}" | Nome: "${p.nome}"`);
    });
}

listAllProducts();
