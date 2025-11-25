// =============================================================
// === CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE) ===
// =============================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gijgjvfwxmkkihdmfmdg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpamdqdmZ3eG1ra2loZG1mbWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjEzNzIxNywiZXhwIjoyMDU3NzEzMjE3fQ.b9F3iLwtnpYp54kPyQORmfe8hW2fLxoKlXmIXuTY99U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'up_gestaointeligente' },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});

module.exports = supabase;

