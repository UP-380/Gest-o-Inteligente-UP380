// =============================================================
// === SERVIÇOS DE API/QUERIES (API/BANCO DE DADOS) ===
// =============================================================
// Este arquivo contém todas as funções reutilizáveis de API
// Movido de api-clientes.js para manter compatibilidade

// A função registrarRotasAPI e outras funções serão importadas do arquivo original
// durante a migração gradual

const path = require('path');
const apiClientesPath = path.join(__dirname, '../../../api-clientes.js');

// Re-exportar tudo do api-clientes.js original
// Isso mantém compatibilidade durante a migração
const apiClientes = require(apiClientesPath);

module.exports = apiClientes;

