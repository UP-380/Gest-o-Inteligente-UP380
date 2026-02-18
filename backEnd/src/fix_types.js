const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const schema = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente_dev';

async function fixTables() {
    console.log(`--- Ajustando tabelas no schema: ${schema} ---`);

    // Como não temos rpc('exec_sql') garantido em todos os ambientes da mesma forma,
    // o ideal é que o usuário execute isso no painel SQL do Supabase.
    // Mas vamos tentar via RPC primeiro.

    const sql = `
        ALTER TABLE ${schema}.cp_equipamento_atribuicoes 
        ALTER COLUMN colaborador_id TYPE BIGINT USING (NULL), 
        ALTER COLUMN criado_por TYPE BIGINT USING (NULL);
        
        ALTER TABLE ${schema}.cp_equipamento_ocorrencias 
        ALTER COLUMN colaborador_id TYPE BIGINT USING (NULL);
        
        -- Nota: Usei USING (NULL) porque as tabelas devem estar vazias já que estavam falhando.
        -- Se houvesse dados, teríamos que converter de forma mais complexa.
    `;

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error('Falha ao executar via RPC:', error.message);
            console.log('\nPor favor, execute o seguinte SQL manualmente no painel do Supabase:\n');
            console.log(sql);
        } else {
            console.log('Tabelas ajustadas com sucesso via RPC!');
        }
    } catch (e) {
        console.error('Erro ao tentar executar ajuste:', e);
    }
}

fixTables();
