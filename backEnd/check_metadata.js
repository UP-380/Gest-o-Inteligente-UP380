
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function checkMetadataType(schema) {
    let log = `\n--- Checking metadata type in ${schema} ---\n`;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });

    // Attempt to use JSONB operator
    const { data, error } = await supabase
        .from('comunicacao_mensagens')
        .select('metadata')
        .filter('metadata->>destacado', 'eq', 'true')
        .limit(1);

    if (error) {
        log += `JSONB Filter ERROR: ${error.message} (${error.code})\n`;
    } else {
        log += `JSONB Filter Success\n`;
    }

    // Also check raw value
    const { data: raw } = await supabase.from('comunicacao_mensagens').select('metadata').limit(1).maybeSingle();
    if (raw) {
        log += `Raw metadata type: ${typeof raw.metadata}\n`;
        log += `Is object? ${raw.metadata && typeof raw.metadata === 'object'}\n`;
    }

    return log;
}

async function run() {
    let output = '';
    for (const schema of schemas) {
        output += await checkMetadataType(schema);
    }
    fs.writeFileSync('metadata_check.txt', output);
    console.log(output);
}

run();
