
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function run() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    for (const schema of schemas) {
        log(`\n--- Testing ${schema} ---`);
        const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });

        // Test 1: Listar Comunicados
        const { data: d1, error: e1 } = await supabase
            .from('comunicacao_mensagens')
            .select('*')
            .eq('tipo', 'COMUNICADO')
            .order('created_at', { ascending: false });

        if (e1) {
            log(`listarComunicados ERROR: ${e1.message} (${e1.code})`);
            log(`Details: ${JSON.stringify(e1)}`);
        } else {
            log(`listarComunicados Success: Found ${d1.length} messages`);
        }

        // Test 2: Listar Destaque
        let query = supabase
            .from('comunicacao_mensagens')
            .select('*, criador:criador_id(nome_usuario)')
            .eq('tipo', 'COMUNICADO')
            .filter('metadata->>destacado', 'eq', 'true')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        const { data: d2, error: e2 } = await query.limit(1).maybeSingle();

        if (e2) {
            log(`listarDestaque ERROR: ${e2.message} (${e2.code})`);
            log(`Details: ${JSON.stringify(e2)}`);
        } else {
            log(`listarDestaque Success: ${d2 ? 'Found one' : 'None found'}`);
        }
    }
    fs.writeFileSync('test_output_utf8.txt', output);
}

run();
