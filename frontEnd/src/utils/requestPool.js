/**
 * Helper para processar requisições em batches com limite de concorrência
 * Isso evita ERR_INSUFFICIENT_RESOURCES ao limitar requisições simultâneas
 * 
 * @param {Array} items - Array de itens para processar
 * @param {Function} asyncFn - Função assíncrona que processa cada item (recebe item, index, array)
 * @param {number} concurrencyLimit - Limite de requisições simultâneas (padrão: 5)
 * @returns {Promise<Array>} Array com os resultados na mesma ordem dos itens
 */
export async function processBatch(items, asyncFn, concurrencyLimit = 5) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  if (typeof asyncFn !== 'function') {
    throw new Error('asyncFn deve ser uma função');
  }

  if (concurrencyLimit < 1) {
    concurrencyLimit = 1;
  }

  const results = [];
  const itemsArray = Array.from(items);

  // Processar em chunks
  for (let i = 0; i < itemsArray.length; i += concurrencyLimit) {
    const chunk = itemsArray.slice(i, i + concurrencyLimit);
    
    // Processar chunk atual em paralelo
    const chunkPromises = chunk.map((item, chunkIndex) => 
      asyncFn(item, i + chunkIndex, itemsArray)
    );
    
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

