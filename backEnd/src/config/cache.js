// =============================================================
// === SISTEMA DE CACHE - Otimização de Performance ===
// =============================================================

const NodeCache = require('node-cache');

// Cache com TTL de 5 minutos (300 segundos)
const cache = new NodeCache({ 
  stdTTL: 300,           // Tempo padrão de vida: 5 minutos
  checkperiod: 60,       // Verificar itens expirados a cada 60 segundos
  useClones: false       // Performance: não clonar objetos
});

// Função helper para cache
function getCachedData(key) {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  return null;
}

function setCachedData(key, data, ttl = 300) {
  cache.set(key, data, ttl);
}

// Função para limpar cache específico
function clearCache(pattern) {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => key.includes(pattern));
  keysToDelete.forEach(key => cache.del(key));
}


module.exports = {
  cache,
  getCachedData,
  setCachedData,
  clearCache
};

