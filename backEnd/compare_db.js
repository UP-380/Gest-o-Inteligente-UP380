
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const tables = [
    'comunicacao_mensagens',
    'comunicacao_leituras',
    'usuarios',
    'cp_chamados_categorias',
    'base_conhecimento_atualizacoes'
];
const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function inspectTable(schema, table) {
    const client = createClient(supabaseUrl, supabaseServiceKey, {
        db: { schema: schema }
    });

    const { data, error } = await client.from(table).select('*').limit(1);

    if (error) {
        return { error: error.message };
    }

    if (data && data.length > 0) {
        return { columns: Object.keys(data[0]) };
    } else {
        return { empty: true };
    }
}

async function run() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    for (const table of tables) {
        log(`\n=== Table: ${table} ===`);
        const results = {};
        for (const schema of schemas) {
            results[schema] = await inspectTable(schema, table);
        }

        if (results[schemas[0]].columns && results[schemas[1]].columns) {
            const colsProd = results[schemas[0]].columns;
            const colsDev = results[schemas[1]].columns;

            const onlyInProd = colsProd.filter(c => !colsDev.includes(c));
            const onlyInDev = colsDev.filter(c => !colsProd.includes(c));

            log(`Columns in Prod (${schemas[0]}): ${colsProd.join(', ')}`);
            log(`Columns in Dev (${schemas[1]}): ${colsDev.join(', ')}`);

            if (onlyInProd.length > 0) log(`Only in PROD: ${onlyInProd.join(', ')}`);
            if (onlyInDev.length > 0) log(`Only in DEV: ${onlyInDev.join(', ')}`);
            if (onlyInProd.length === 0 && onlyInDev.length === 0) log('Schemas match! (based on top row keys)');
        } else {
            if (results[schemas[0]].error) log(`Prod Error: ${results[schemas[0]].error}`);
            if (results[schemas[1]].error) log(`Dev Error: ${results[schemas[1]].error}`);
            if (results[schemas[0]].empty) log('Prod is empty');
            if (results[schemas[1]].empty) log('Dev is empty');
        }
    }
    fs.writeFileSync('compare_results.txt', output);
}

run();
