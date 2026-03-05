
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente'];

async function run() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: schemas[0] } });

    console.log("Testing in('id', []) on usuarios...");
    const { data, error } = await supabase
        .from('usuarios')
        .select('id')
        .in('id', []);

    if (error) {
        console.error("ERRO ao usar .in('id', []):", error.message);
        console.error("Código:", error.code);
    } else {
        console.log("Sucesso ao usar .in('id', []):", data.length, "rows");
    }
}

run();
