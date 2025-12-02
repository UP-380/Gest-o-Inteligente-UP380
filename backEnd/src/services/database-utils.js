// =============================================================
// === UTILITÁRIOS DE BANCO DE DADOS ===
// =============================================================

/**
 * Busca TODOS os registros de uma query com paginação automática
 * O Supabase limita a 1000 registros por padrão, então esta função
 * faz múltiplas requisições paginadas até buscar todos os registros
 * 
 * @param {Function} criarQueryBuilder - Função que retorna um novo query builder a cada chamada
 * @param {Object} options - Opções de configuração
 * @param {number} options.limit - Limite por página (padrão: 1000)
 * @param {boolean} options.logProgress - Se deve logar o progresso (padrão: true)
 * @returns {Promise<Array>} Array com todos os registros encontrados
 */
async function buscarTodosComPaginacao(criarQueryBuilder, options = {}) {
  const { limit = 1000, logProgress = true } = options;
  const todosRegistros = [];
  let offset = 0;
  let hasMore = true;
  let totalBuscado = 0;
  let page = 1;

  while (hasMore) {
    // Criar um novo query builder a cada iteração (não pode reutilizar)
    const queryBuilder = criarQueryBuilder();
    const queryComPaginacao = queryBuilder.range(offset, offset + limit - 1);
    const { data, error } = await queryComPaginacao;

    if (error) {
      const errorMsg = `Erro ao buscar registros (página ${page}, offset ${offset}): ${error.message || error}`;
      console.error(`❌ [DB-UTILS] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (data && data.length > 0) {
      todosRegistros.push(...data);
      totalBuscado += data.length;
      offset += limit;
      page++;
      hasMore = data.length === limit; // Se retornou menos que o limite, não há mais registros
      
      if (logProgress && hasMore) {
        console.log(`📊 [DB-UTILS] Busca paginada: ${totalBuscado} registros até agora... (página ${page - 1})`);
      }
    } else {
      hasMore = false;
    }
  }

  if (logProgress) {
    console.log(`✅ [DB-UTILS] Busca paginada completa: ${todosRegistros.length} registros encontrados em ${page - 1} página(s)`);
  }
  
  return todosRegistros;
}

/**
 * Executa uma query do Supabase com paginação automática se necessário
 * Esta função detecta automaticamente se precisa usar paginação baseado
 * no número de registros retornados
 * 
 * @param {Function} criarQueryBuilder - Função que retorna um novo query builder
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.forcarPaginacao - Se deve forçar paginação mesmo com poucos registros (padrão: false)
 * @param {number} options.limit - Limite por página (padrão: 1000)
 * @param {boolean} options.logProgress - Se deve logar o progresso (padrão: false)
 * @returns {Promise<{data: Array, error: null|Error}>} Objeto com data e error
 */
async function executarQueryComPaginacao(criarQueryBuilder, options = {}) {
  const { forcarPaginacao = false, limit = 1000, logProgress = false } = options;

  // Se forçar paginação, usar diretamente
  if (forcarPaginacao) {
    try {
      const data = await buscarTodosComPaginacao(criarQueryBuilder, { limit, logProgress });
      return { data, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  // Caso contrário, tentar query normal primeiro
  const queryBuilder = criarQueryBuilder();
  const { data: primeiraPagina, error } = await queryBuilder.limit(limit + 1); // Buscar 1 a mais para detectar se há mais

  if (error) {
    return { data: [], error };
  }

  // Se retornou exatamente limit + 1, significa que há mais registros
  // Nesse caso, usar paginação automática
  if (primeiraPagina && primeiraPagina.length > limit) {
    if (logProgress) {
      console.log(`📊 [DB-UTILS] Detectado mais de ${limit} registros, usando paginação automática...`);
    }
    
    // Remover o registro extra
    primeiraPagina.pop();
    
    try {
      // Buscar o restante com paginação
      const criarQueryBuilderComOffset = () => {
        const qb = criarQueryBuilder();
        // Não aplicar range aqui, será aplicado na função de paginação
        return qb;
      };
      
      // Ajustar a função para começar da página 2
      let offsetInicial = limit;
      const criarQueryBuilderPaginado = () => {
        const qb = criarQueryBuilder();
        return qb;
      };
      
      // Buscar o restante
      const restante = await buscarTodosComPaginacao(
        () => {
          const qb = criarQueryBuilder();
          return qb;
        },
        { limit, logProgress }
      );
      
      // Combinar resultados
      const todosRegistros = [...primeiraPagina, ...restante];
      return { data: todosRegistros, error: null };
    } catch (pagError) {
      // Se der erro na paginação, retornar pelo menos a primeira página
      return { data: primeiraPagina, error: null };
    }
  }

  // Se retornou menos ou igual ao limite, não precisa paginação
  return { data: primeiraPagina || [], error: null };
}

module.exports = {
  buscarTodosComPaginacao,
  executarQueryComPaginacao
};

