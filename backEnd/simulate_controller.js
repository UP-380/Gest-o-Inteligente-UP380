
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const schemas = ['up_gestaointeligente', 'up_gestaointeligente_dev'];

async function simulateListarComunicados(schema) {
    let log = `\n--- Simulating listarComunicados in ${schema} ---\n`;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema } });

    try {
        const { data, error } = await supabase
            .from('comunicacao_mensagens')
            .select('*')
            .eq('tipo', 'COMUNICADO')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            log += "No comunicados found\n";
            return log;
        }

        const criadorIds = [...new Set(data.map(m => m.criador_id).filter(Boolean))];
        log += `Criador IDs: ${criadorIds.join(', ')}\n`;

        const { data: criadores, error: errCriadores } = await supabase
            .from('usuarios')
            .select('id, nome_usuario, foto_perfil')
            .in('id', criadorIds);

        if (errCriadores) throw errCriadores;

        log += `Criadores found: ${criadores.length}\n`;

        const dataEnriquecida = data.map(msg => ({
            ...msg,
            criador: criadores?.find(c => c.id === msg.criador_id) || null
        }));

        log += `Success: Mapped ${dataEnriquecida.length} items\n`;
    } catch (err) {
        log += `ERROR: ${err.message} (${err.code})\n`;
        log += `Details: ${JSON.stringify(err)}\n`;
    }
    return log;
}

async function run() {
    let output = '';
    for (const schema of schemas) {
        output += await simulateListarComunicados(schema);
    }
    fs.writeFileSync('simulation_results.txt', output);
    console.log(output);
}

run();
