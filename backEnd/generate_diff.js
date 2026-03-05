
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];
const tables = ['comunicacao_mensagens', 'comunicacao_leituras', 'base_conhecimento_atualizacoes'];

async function run() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let diffReport = "=== Database Schema Diff Report ===\n\n";

    for (const table of tables) {
        diffReport += `\n--- Table: ${table} ---\n`;

        // Attempt to get column info via RPC or queries
        // Since we can't run raw SQL, we use our previous inspection technique
        const results = {};
        for (const schema of schemas) {
            const client = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });
            const { data } = await client.from(table).select('*').limit(1).maybeSingle();
            results[schema] = data ? Object.keys(data) : [];
        }

        const prodCols = results['up_gestaointeligente'];
        const devCols = results['up_gestaointeligente_dev'];

        const missingInProd = devCols.filter(c => !prodCols.includes(c));
        const extraInProd = prodCols.filter(c => !devCols.includes(c));

        if (missingInProd.length > 0) diffReport += `MISSING in Production: ${missingInProd.join(', ')}\n`;
        if (extraInProd.length > 0) diffReport += `EXTRA in Production: ${extraInProd.join(', ')}\n`;
        if (missingInProd.length === 0 && extraInProd.length === 0) diffReport += "Columns match.\n";

        // Specifically check for the ambiguity issue found
        if (table === 'comunicacao_mensagens') {
            const client = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'up_gestaointeligente' } });
            const { error } = await client.from(table).select('*, usuarios(id)').limit(1);
            if (error && error.code === 'PGRST201') {
                diffReport += "[DIVERGENCE] Production has redundant Foreign Keys for comunicacao_mensagens(criador_id) -> usuarios(id).\n";
                diffReport += "Details: fk_comunic_criador AND fk_comunic_msg_criador exist.\n";
            }
        }
    }

    fs.writeFileSync('schema_diff.txt', diffReport);
    console.log(diffReport);
}

run();
