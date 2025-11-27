// =============================================================
// === SERVICE DE CUSTO MEMBRO VIGÊNCIA ===
// =============================================================
// Service responsável por toda a lógica de acesso ao banco de dados
// relacionada a custo_membro_vigencia

const apiClientes = require('./api-clientes');
const { supabase } = apiClientes;

/**
 * Buscar todas as vigências com filtros opcionais
 * @param {Object} filters - Filtros de busca
 * @param {number} filters.membro_id - ID do membro (opcional)
 * @param {string} filters.dt_vigencia_inicio - Data início (opcional)
 * @param {string} filters.dt_vigencia_fim - Data fim (opcional)
 * @param {number} page - Página atual
 * @param {number} limit - Limite de itens por página
 * @returns {Promise<Object>} - { data, count, error }
 */
async function buscarVigencias(filters = {}, page = 1, limit = 50) {
  try {
    const { membro_id, dt_vigencia_inicio, dt_vigencia_fim } = filters;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    console.log('🔍 [SERVICE] Buscando vigências com filtros:', {
      membro_id,
      dt_vigencia_inicio,
      dt_vigencia_fim,
      page: pageNum,
      limit: limitNum,
      offset
    });

    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*', { count: 'exact' })
      .order('dt_vigencia', { ascending: false });

    // Aplicar filtros
    if (membro_id) {
      query = query.eq('membro_id', membro_id);
      console.log('✅ [SERVICE] Filtro aplicado: membro_id =', membro_id);
    }

    if (dt_vigencia_inicio) {
      query = query.gte('dt_vigencia', dt_vigencia_inicio);
      console.log('✅ [SERVICE] Filtro aplicado: dt_vigencia >=', dt_vigencia_inicio);
    }

    if (dt_vigencia_fim) {
      query = query.lte('dt_vigencia', dt_vigencia_fim);
      console.log('✅ [SERVICE] Filtro aplicado: dt_vigencia <=', dt_vigencia_fim);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
      console.log('✅ [SERVICE] Paginação aplicada: range(', offset, ',', offset + limitNum - 1, ')');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ [SERVICE] Erro ao buscar vigências:', error);
      return { data: null, count: 0, error };
    }

    console.log('✅ [SERVICE] Vigências encontradas:', {
      total: count,
      retornadas: data?.length || 0,
      primeiras_datas: data?.slice(0, 3).map(v => v.dt_vigencia) || []
    });

    return { data: data || [], count: count || 0, error: null };
  } catch (error) {
    console.error('❌ [SERVICE] Erro inesperado ao buscar vigências:', error);
    return { data: null, count: 0, error };
  }
}

/**
 * Buscar vigência por ID
 * @param {number} id - ID da vigência
 * @returns {Promise<Object>} - { data, error }
 */
async function buscarVigenciaPorId(id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar vigência por ID:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao buscar vigência por ID:', error);
    return { data: null, error };
  }
}

/**
 * Buscar vigências por membro_id
 * @param {number} membro_id - ID do membro
 * @returns {Promise<Object>} - { data, error }
 */
async function buscarVigenciasPorMembro(membro_id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('membro_id', membro_id)
      .order('dt_vigencia', { ascending: false });

    if (error) {
      console.error('Erro ao buscar vigências por membro:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erro inesperado ao buscar vigências por membro:', error);
    return { data: null, error };
  }
}

/**
 * Verificar se membro existe
 * @param {number} membro_id - ID do membro
 * @returns {Promise<Object>} - { exists, error }
 */
async function verificarMembroExiste(membro_id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id')
      .eq('id', membro_id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar membro:', error);
      return { exists: false, error };
    }

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao verificar membro:', error);
    return { exists: false, error };
  }
}

/**
 * Criar nova vigência
 * @param {Object} dadosVigencia - Dados da vigência
 * @returns {Promise<Object>} - { data, error }
 */
async function criarVigencia(dadosVigencia) {
  try {
    console.log('🔍 [SERVICE] Dados recebidos para criar vigência:', JSON.stringify(dadosVigencia, null, 2));
    
    // Remover colunas que são calculadas automaticamente (generated columns - não podem ser inseridas)
    const colunasCalculadas = ['ferias', 'decimoterceiro', 'insspatronal', 'insscolaborador', 'fgts', 'horas_mensal'];
    const dadosLimpos = { ...dadosVigencia };
    colunasCalculadas.forEach(col => {
      delete dadosLimpos[col];
    });
    
    console.log('🔍 [SERVICE] Dados limpos (sem colunas calculadas):', JSON.stringify(dadosLimpos, null, 2));
    
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .insert([dadosLimpos])
      .select()
      .single();

    if (error) {
      console.error('❌ [SERVICE] Erro ao criar vigência:', error);
      console.error('❌ [SERVICE] Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return { data: null, error };
    }

    console.log('✅ [SERVICE] Vigência criada com sucesso:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ [SERVICE] Erro inesperado ao criar vigência:', error);
    return { data: null, error };
  }
}

/**
 * Atualizar vigência existente
 * @param {number} id - ID da vigência
 * @param {Object} dadosUpdate - Dados para atualizar
 * @returns {Promise<Object>} - { data, error }
 */
async function atualizarVigencia(id, dadosUpdate) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar vigência:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao atualizar vigência:', error);
    return { data: null, error };
  }
}

/**
 * Verificar se vigência existe
 * @param {number} id - ID da vigência
 * @returns {Promise<Object>} - { data, error }
 */
async function verificarVigenciaExiste(id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('id, membro_id, dt_vigencia')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar vigência:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao verificar vigência:', error);
    return { data: null, error };
  }
}

/**
 * Deletar vigência
 * @param {number} id - ID da vigência
 * @returns {Promise<Object>} - { success, error }
 */
async function deletarVigencia(id) {
  try {
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar vigência:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro inesperado ao deletar vigência:', error);
    return { success: false, error };
  }
}

module.exports = {
  buscarVigencias,
  buscarVigenciaPorId,
  buscarVigenciasPorMembro,
  verificarMembroExiste,
  criarVigencia,
  atualizarVigencia,
  verificarVigenciaExiste,
  deletarVigencia
};

