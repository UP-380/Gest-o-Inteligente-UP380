import app from './app';

// ============================================================
// PORTA — lida exclusivamente do .env, sem fallback hardcoded
// ============================================================
const PORT = Number(process.env.PORT);

if (!PORT || Number.isNaN(PORT)) {
  throw new Error(
    '❌ PORT não definida ou inválida no .env. ' +
    'Defina PORT=3001 no arquivo backend_js/.env antes de iniciar.'
  );
}

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`🔥 Bun API rodando na porta ${server.port}`);

// Validação: confirmar que a porta real é a esperada
if (server.port !== PORT) {
  console.error(`❌ ERRO: Porta esperada ${PORT}, mas servidor iniciou em ${server.port}`);
  process.exit(1);
}
