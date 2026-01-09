// =============================================================
// === SERVICE DE CUSTO MEMBRO VIGÊNCIA ===
// =============================================================

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Aceitar ambos os nomes: SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validar que as credenciais foram fornecidas
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERRO CRÍTICO: SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_SERVICE_ROLE_KEY) devem estar definidas nas variáveis de ambiente!');
  console.error('   Configure estas variáveis no arquivo .env.production');
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

// Buscar vigências com filtros (com join com membro)
async function buscarVigencias(filters = {}, page = 1, limit = 50) {
  try {
    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select(`
        *,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `, { count: 'exact' });

    // Aplicar filtros
    if (filters.membro_id) {
      // Se for array, usar .in(), senão usar .eq()
      if (Array.isArray(filters.membro_id) && filters.membro_id.length > 0) {
        // Converter para números se necessário
        const membroIds = filters.membro_id.map(id => {
          const numId = parseInt(id, 10);
          return isNaN(numId) ? id : numId;
        });
        query = query.in('membro_id', membroIds);
      } else if (!Array.isArray(filters.membro_id)) {
        const membroId = parseInt(filters.membro_id, 10);
        query = query.eq('membro_id', isNaN(membroId) ? filters.membro_id : membroId);
      }
    }

    if (filters.dt_vigencia_inicio) {
      query = query.gte('dt_vigencia', filters.dt_vigencia_inicio);
    }

    if (filters.dt_vigencia_fim) {
      query = query.lte('dt_vigencia', filters.dt_vigencia_fim);
    }

    // Filtro por status (buscar membros com status específico)
    if (filters.status) {
      // Primeiro buscar membros com o status
      const { data: membros, error: membrosError } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id')
        .eq('status', filters.status);

      if (membrosError) {
        return { data: null, count: 0, error: membrosError };
      }

      const membroIds = (membros || []).map(m => m.id);
      if (membroIds.length > 0) {
        query = query.in('membro_id', membroIds);
      } else {
        // Se não há membros com esse status, retornar vazio
        return { data: [], count: 0, error: null };
      }
    }

    // Ordenar por data de vigência (mais recente primeiro)
    query = query.order('dt_vigencia', { ascending: false });

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { data: null, count: 0, error };
    }

    return { data: data || [], count: count || 0, error: null };
  } catch (error) {
    return { data: null, count: 0, error };
  }
}

// Buscar vigência por ID (com join com membro)
async function buscarVigenciaPorId(id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select(`
        *,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Buscar vigências por membro_id (com join com membro)
async function buscarVigenciasPorMembro(membroId) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select(`
        *,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `)
      .eq('membro_id', membroId)
      .order('dt_vigencia', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Verificar se membro existe
async function verificarMembroExiste(membroId) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id')
      .eq('id', membroId)
      .single();

    if (error || !data) {
      return { exists: false, error: error || new Error('Membro não encontrado') };
    }

    return { exists: true, error: null };
  } catch (error) {
    return { exists: false, error };
  }
}

// Verificar se vigência existe
async function verificarVigenciaExiste(id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return { data: null, error: error || new Error('Vigência não encontrada') };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Verificar unicidade de vigência (membro_id + dt_vigencia)
// Se excludeId for fornecido, exclui esse ID da verificação (útil para updates)
async function verificarVigenciaUnica(membroId, dtVigencia, excludeId = null) {
  try {
    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('id')
      .eq('membro_id', membroId)
      .eq('dt_vigencia', dtVigencia);

    // Se excludeId fornecido, excluir da verificação (para updates)
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      return { exists: false, error };
    }

    // Se encontrou algum registro, já existe
    return { exists: (data && data.length > 0), error: null };
  } catch (error) {
    return { exists: false, error };
  }
}

// Buscar horas contratadas por dia mais recente por membro_id e período
async function buscarHorasContratadasPorMembroEPeriodo(membroId, dataInicio, dataFim) {
  try {
    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('horascontratadasdia, dt_vigencia, tipo_contrato')
      .eq('membro_id', membroId);

    // Filtrar vigências que sejam <= data_fim (a mais recente antes ou no período)
    if (dataFim) {
      query = query.lte('dt_vigencia', dataFim);
    }

    // Ordenar por dt_vigencia descendente e pegar apenas o primeiro (mais recente)
    query = query.order('dt_vigencia', { ascending: false }).limit(1);

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    // Retornar o primeiro registro (mais recente) ou null se não houver
    return { data: data && data.length > 0 ? data[0] : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Buscar custo mais recente por membro_id e período
// Retorna a vigência com dt_vigencia mais recente que seja <= data_fim do período
async function buscarCustoMaisRecentePorMembroEPeriodo(membroId, dataInicio, dataFim) {
  try {
    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('membro_id', membroId);

    // Filtrar vigências que sejam <= data_fim (a mais recente antes ou no período)
    if (dataFim) {
      query = query.lte('dt_vigencia', dataFim);
    }

    // Ordenar por dt_vigencia descendente e pegar apenas o primeiro (mais recente)
    query = query.order('dt_vigencia', { ascending: false }).limit(1);

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    // Retornar o primeiro registro (mais recente) ou null se não houver
    return { data: data && data.length > 0 ? data[0] : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Criar vigência
async function criarVigencia(dados) {
  try {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [SERVICE] Tentando inserir dados:', JSON.stringify(dados, null, 2));
    }
    
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .insert([dados])
      .select(`
        *,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `)
      .single();

    if (error) {
      console.error('Erro ao inserir vigência:', error);
      return { data: null, error };
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ [SERVICE] Vigência criada com sucesso');
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao criar vigência:', error);
    return { data: null, error };
  }
}

// Atualizar vigência
async function atualizarVigencia(id, dados) {
  try {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 [SERVICE] Atualizando vigência ID:', id);
    }
    
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .update(dados)
      .eq('id', id)
      .select(`
        *,
        membro:membro_id (
          id,
          nome,
          cpf
        )
      `)
      .single();

    if (error) {
      console.error('Erro do Supabase ao atualizar vigência:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Erro inesperado ao atualizar vigência:', error);
    return { data: null, error };
  }
}

// Deletar vigência
async function deletarVigencia(id) {
  try {
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = {
  buscarVigencias,
  buscarVigenciaPorId,
  buscarVigenciasPorMembro,
  verificarMembroExiste,
  verificarVigenciaExiste,
  verificarVigenciaUnica,
  criarVigencia,
  atualizarVigencia,
  deletarVigencia,
  buscarCustoMaisRecentePorMembroEPeriodo,
  buscarHorasContratadasPorMembroEPeriodo
};

