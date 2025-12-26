// =============================================================
// === CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE) ===
// =============================================================

const { createClient } = require('@supabase/supabase-js');

// Obter credenciais do Supabase das variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validar que as credenciais foram fornecidas
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERRO CRÍTICO: SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar definidas nas variáveis de ambiente!');
  console.error('   Crie um arquivo .env na pasta backEnd com estas variáveis.');
  console.error('   Veja o arquivo .env.example para referência.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'up_gestaointeligente' },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});

module.exports = supabase;

