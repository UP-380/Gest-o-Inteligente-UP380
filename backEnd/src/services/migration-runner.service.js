const fs = require('fs');
const path = require('path');

// Usar variáveis de ambiente para conexão (CARREGAR ANTES DE TUDO)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabase = require('../config/database');

async function runMigration(filePath) {
    if (!filePath) {
        console.error('❌ Por favor, especifique o caminho para o arquivo SQL.');
        process.exit(1);
    }

    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Arquivo não encontrado: ${fullPath}`);
        process.exit(1);
    }

    console.log(`🚀 Executando migração: ${path.basename(fullPath)}`);
    console.log('   Lendo arquivo...');

    const sql = fs.readFileSync(fullPath, 'utf8');

    console.log('   Enviando para o Supabase...');

    // O Supabase JS client não tem um método direto para rodar SQL raw via API pública (por segurança).
    // Mas podemos usar uma RPC se tivermos configurado, ou usar a técnica de rodar via psql externamente.
    // Como estamos no ambiente de desenvolvimento e temos a SERVICE_KEY, vamos tentar rodar via RPC se existir,
    // OU simplesmente avisar o usuário que ele precisa rodar manualmente no SQL Editor do Supabase se não tivermos um endpoint.

    // TENTATIVA 1: Usar rpc 'exec_sql' se existir (comum em setups dev)
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (rpcError) {
        console.warn('⚠️  Não foi possível executar via RPC exec_sql (talvez a função não exista).');
        console.warn('   Erro:', rpcError.message);
        console.log('\n🔄 Tentando método alternativo via API Rest (apenas para INSERT/UPDATE/DELETE)...');

        // Se for um script complexo (CREATE TABLE, etc), a library JS client padrão não suporta raw query arbitrário facilmente sem uma function.
        // O melhor fallback aqui é instruir o usuário ou usar uma conexão direta via postgres string se disponível.

        console.error('\n❌ ERRO: O cliente JS do Supabase não suporta execução direta de scripts SQL DDL (CREATE TABLE, etc).');
        console.error('   Por favor, execute o conteúdo do arquivo abaixo manualmente no SQL Editor do Supabase:');
        console.error(`   Arquivo: ${fullPath}`);

        console.log('\n--- CONTEÚDO PARA COPIAR ---');
        console.log(sql);
        console.log('------------------------------');
        process.exit(1);
    }

    console.log('✅ Migração executada com sucesso!');
}

const args = process.argv.slice(2);
runMigration(args[0]);
