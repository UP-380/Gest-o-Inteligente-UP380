
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function checkAmbiguity(schema) {
    console.log(`\nTesting ambiguity in ${schema}...`);
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });

    const { error } = await supabase
        .from('comunicacao_mensagens')
        .select('*, criador:criador_id(nome_usuario)')
        .limit(1)
        .maybeSingle();

    if (error) {
        if (error.code === 'PGRST201') {
            console.log(`${schema} HAS ambiguity!`);
        } else {
            console.log(`${schema} Error: ${error.message}`);
        }
    } else {
        console.log(`${schema} is OK (no ambiguity)`);
    }
}

async function run() {
    for (const schema of schemas) {
        await checkAmbiguity(schema);
    }
}

run();
