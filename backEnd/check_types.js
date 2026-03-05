
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function inspectTypes(schema) {
    let log = `\n--- Inspecting types in ${schema} ---\n`;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });

    const { data: msg, error: e1 } = await supabase.from('comunicacao_mensagens').select('id, criador_id').limit(1).maybeSingle();
    const { data: user, error: e2 } = await supabase.from('usuarios').select('id').limit(1).maybeSingle();

    if (e1) log += `MSGS ERROR: ${e1.message}\n`;
    if (msg) log += `comunicacao_mensagens.id type: ${typeof msg.id} (${msg.id}), criador_id type: ${typeof msg.criador_id} (${msg.criador_id})\n`;

    if (e2) log += `USERS ERROR: ${e2.message}\n`;
    if (user) log += `usuarios.id type: ${typeof user.id} (${user.id})\n`;

    return log;
}

async function run() {
    let output = '';
    for (const schema of schemas) {
        output += await inspectTypes(schema);
    }
    fs.writeFileSync('types_output_utf8.txt', output);
    console.log(output);
}

run();
