/**
 * Helper para processar requisições em batches com limite de concorrência e suporte a prioridade
 * Isso evita ERR_INSUFFICIENT_RESOURCES e permite que interações do usuário furem a fila
 */

class RequestPool {
  constructor(concurrencyLimit = 5) {
    this.concurrencyLimit = concurrencyLimit;
    this.activeRequests = 0;
    this.queue = []; // { fn, resolve, reject, priority }
    this.paused = false;
  }

  /**
   * Adiciona uma tarefa à fila
   * @param {Function} asyncFn - Função assíncrona a ser executada
   * @param {boolean} highPriority - Se true, coloca no início da fila
   * @returns {Promise}
   */
  add(asyncFn, highPriority = false) {
    return new Promise((resolve, reject) => {
      const task = { asyncFn, resolve, reject, highPriority };

      if (highPriority) {
        // Encontrar o ponto de inserção para manter prioridades agrupadas
        // (Isso é uma simplificação, poderia ser mais complexo)
        // Adiciona logo no início para execução imediata
        this.queue.unshift(task);
      } else {
        this.queue.push(task);
      }

      this.processNext();
    });
  }

  processNext() {
    if (this.paused || this.activeRequests >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.activeRequests++;
    const task = this.queue.shift();

    task.asyncFn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        this.activeRequests--;
        this.processNext();
      });
  }
}

// Singleton global do pool para compartilhar limite entre componentes se necessário
// ou pode ser instanciado localmente por componente
export const globalRequestPool = new RequestPool(5);

/**
 * Função wrapper compatível com a API anterior processBatch, 
 * mas usando o pool global com prioridade baixa por padrão
 */
export async function processBatch(items, asyncFn, concurrencyLimit = 5) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Ajustar limite global se necessário (aviso: isso afeta todos)
  // globalRequestPool.concurrencyLimit = concurrencyLimit;

  const promises = items.map((item, index) => {
    return globalRequestPool.add(() => asyncFn(item, index, items), false);
  });

  return Promise.all(promises);
}

/**
 * Executa uma tarefa com ALTA prioridade (fura fila)
 */
export function executeHighPriority(asyncFn) {
  return globalRequestPool.add(asyncFn, true);
}
