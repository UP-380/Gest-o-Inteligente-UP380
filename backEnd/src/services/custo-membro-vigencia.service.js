// =============================================================
// === SERVICE DE CUSTO MEMBRO VIGÊNCIA ===
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

// Buscar vigências com filtros
async function buscarVigencias(filters = {}, page = 1, limit = 50) {
  try {
    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (filters.membro_id) {
      // Se for array, usar .in(), senão usar .eq()
      if (Array.isArray(filters.membro_id) && filters.membro_id.length > 0) {
        console.log('🔍 [SERVICE] Filtrando por múltiplos membro_id:', filters.membro_id);
        // Converter para números se necessário
        const membroIds = filters.membro_id.map(id => {
          const numId = parseInt(id, 10);
          return isNaN(numId) ? id : numId;
        });
        query = query.in('membro_id', membroIds);
        console.log('✅ [SERVICE] Query com filtro .in() aplicado');
      } else if (!Array.isArray(filters.membro_id)) {
        console.log('🔍 [SERVICE] Filtrando por único membro_id:', filters.membro_id);
        const membroId = parseInt(filters.membro_id, 10);
        query = query.eq('membro_id', isNaN(membroId) ? filters.membro_id : membroId);
        console.log('✅ [SERVICE] Query com filtro .eq() aplicado');
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

// Buscar vigência por ID
async function buscarVigenciaPorId(id) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
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

// Buscar vigências por membro_id
async function buscarVigenciasPorMembro(membroId) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
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

// Criar vigência
async function criarVigencia(dados) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .insert([dados])
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Atualizar vigência
async function atualizarVigencia(id, dados) {
  try {
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
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
  criarVigencia,
  atualizarVigencia,
  deletarVigencia
};

