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

const dbSchema = process.env.SUPABASE_DB_SCHEMA || 'up_gestaointeligente';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: dbSchema },
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
      .schema(dbSchema)
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
    // IMPORTANTE: Quando status for 'todos' ou não informado, NÃO aplicar filtro (mostrar TODOS)
    if (filters.status && filters.status !== 'todos') {
      // Primeiro buscar membros com o status
      const { data: membros, error: membrosError } = await supabase
        .schema(dbSchema)
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
    // Se status for 'todos' ou não informado, não aplicar filtro (mostrar TODAS as vigências)

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
      .schema(dbSchema)
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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

// Buscar horas contratadas em lote
async function buscarHorasContratadasLote(membroIds, dataFim) {
  try {
    let query = supabase
      .schema(dbSchema)
      .from('custo_membro_vigencia')
      .select('membro_id, horascontratadasdia, dt_vigencia, tipo_contrato')
      .in('membro_id', membroIds);

    if (dataFim) {
      query = query.lte('dt_vigencia', dataFim);
    }

    // Ordenar para facilitar picking do mais recente no JS
    query = query.order('dt_vigencia', { ascending: false });

    const { data, error } = await query;
    if (error) return { data: null, error };

    // Pegar o mais recente para cada membro
    const result = {};
    membroIds.forEach(id => result[id] = null);

    (data || []).forEach(v => {
      if (!result[v.membro_id]) {
        result[v.membro_id] = v;
      }
    });

    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Buscar custo mais recente por membro_id e período
async function buscarCustoMaisRecentePorMembroEPeriodo(membroId, dataInicio, dataFim) {
  try {
    let query = supabase
      .schema(dbSchema)
      .from('custo_membro_vigencia')
      .select('*')
      .eq('membro_id', membroId);

    if (dataFim) {
      query = query.lte('dt_vigencia', dataFim);
    }

    query = query.order('dt_vigencia', { ascending: false }).limit(1);

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data: data && data.length > 0 ? data[0] : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Buscar custo mais recente em lote
async function buscarCustoMaisRecenteLote(membroIds, dataFim) {
  try {
    let query = supabase
      .schema(dbSchema)
      .from('custo_membro_vigencia')
      .select('*')
      .in('membro_id', membroIds);

    if (dataFim) {
      query = query.lte('dt_vigencia', dataFim);
    }

    query = query.order('dt_vigencia', { ascending: false });

    const { data, error } = await query;
    if (error) return { data: null, error };

    const result = {};
    membroIds.forEach(id => result[id] = null);

    (data || []).forEach(v => {
      if (!result[v.membro_id]) {
        result[v.membro_id] = v;
      }
    });

    return { data: result, error: null };
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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
      .schema(dbSchema)
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

// Função auxiliar para converter string formatada (ex: "1.234,56") para número
function removerFormatacaoMoeda(valor) {
  if (!valor || valor === '' || valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return valor;
  // Remove pontos (separadores de milhar) e substitui vírgula por ponto
  const valorLimpo = valor.toString().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(valorLimpo);
  return isNaN(num) ? 0 : num;
}

// Função auxiliar para buscar dias úteis da configuração
async function buscarDiasUteisConfig(dataVigencia, tipoContrato) {
  try {
    if (!dataVigencia) return 22; // Valor padrão

    let query = supabase
      .schema(dbSchema)
      .from('config_custo_membro')
      .select('dias_uteis')
      .lte('vigencia', dataVigencia);

    if (tipoContrato !== null && tipoContrato !== undefined) {
      query = query.eq('tipo_contrato', tipoContrato);
    }

    const { data, error } = await query
      .order('vigencia', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao buscar dias úteis da configuração:', error);
      return 22; // Valor padrão
    }

    return data && data.dias_uteis ? data.dias_uteis : 22;
  } catch (error) {
    console.warn('Erro ao buscar dias úteis da configuração:', error);
    return 22; // Valor padrão
  }
}

// Função auxiliar para calcular custos da vigência
async function calcularCustosVigencia(vigencia) {
  if (!vigencia) return null;

  try {
    // Converter valores de string formatada para número
    const salarioBaseMensal = removerFormatacaoMoeda(vigencia.salariobase);
    const feriasDiaria = removerFormatacaoMoeda(vigencia.ferias);
    const tercoFeriasDiaria = removerFormatacaoMoeda(vigencia.um_terco_ferias);
    const decimoTerceiroDiaria = removerFormatacaoMoeda(vigencia.decimoterceiro);
    const fgtsDiaria = removerFormatacaoMoeda(vigencia.fgts);
    const valeTransporteDiaria = removerFormatacaoMoeda(vigencia.valetransporte);
    const valeRefeicaoDiaria = removerFormatacaoMoeda(vigencia.vale_refeicao);
    const ajudaCustoDiaria = removerFormatacaoMoeda(vigencia.ajudacusto);

    // Buscar dias úteis da configuração
    const diasUteis = await buscarDiasUteisConfig(vigencia.dt_vigencia, vigencia.tipo_contrato);

    // Calcular salário base diário
    const salarioBaseDiario = diasUteis > 0 ? salarioBaseMensal / diasUteis : 0;

    // Calcular custo diário total
    const custoDiarioTotal = salarioBaseDiario +
      feriasDiaria +
      tercoFeriasDiaria +
      decimoTerceiroDiaria +
      fgtsDiaria +
      valeTransporteDiaria +
      valeRefeicaoDiaria +
      ajudaCustoDiaria;

    // Calcular custo total mensal
    const custoTotalMensal = custoDiarioTotal * diasUteis;

    // Calcular custo hora
    const horasContratadasDia = parseFloat(vigencia.horascontratadasdia) || 0;
    let custoHora = 0;
    if (horasContratadasDia > 0 && diasUteis > 0) {
      const jornadaMensalHoras = horasContratadasDia * diasUteis;
      if (jornadaMensalHoras > 0) {
        custoHora = custoTotalMensal / jornadaMensalHoras;
      }
    }

    // Retornar vigência com os custos calculados
    // Formatar valores como strings no formato brasileiro (1.234,56)
    const formatarMoedaBR = (valor) => {
      return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    return {
      ...vigencia,
      custo_diario_total: formatarMoedaBR(custoDiarioTotal),
      custo_total_mensal: formatarMoedaBR(custoTotalMensal),
      custo_hora: formatarMoedaBR(custoHora)
    };
  } catch (error) {
    console.error('Erro ao calcular custos da vigência:', error);
    return vigencia; // Retornar vigência original em caso de erro
  }
}

// Buscar todos os colaboradores com suas últimas vigências
async function buscarColaboradoresComUltimaVigencia() {
  try {
    // Buscar todos os colaboradores (ativos e inativos)
    const { data: colaboradores, error: errorColaboradores } = await supabase
      .schema(dbSchema)
      .from('membro')
      .select('id, nome, cpf, status')
      .order('nome', { ascending: true });

    if (errorColaboradores) {
      return { data: null, error: errorColaboradores };
    }

    if (!colaboradores || colaboradores.length === 0) {
      return { data: [], error: null };
    }

    // Para cada colaborador, buscar a última vigência e calcular custos
    const colaboradoresComVigencias = await Promise.all(
      colaboradores.map(async (colaborador) => {
        // Buscar a vigência mais recente deste colaborador
        const { data: vigencia, error: errorVigencia } = await supabase
          .schema(dbSchema)
          .from('custo_membro_vigencia')
          .select('*')
          .eq('membro_id', colaborador.id)
          .order('dt_vigencia', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errorVigencia && errorVigencia.code !== 'PGRST116') {
          // PGRST116 = nenhum resultado encontrado (normal se não tiver vigência)
          console.error(`Erro ao buscar vigência para colaborador ${colaborador.id}:`, errorVigencia);
        }

        // Se houver vigência, calcular os custos
        let vigenciaComCalculos = null;
        if (vigencia) {
          vigenciaComCalculos = await calcularCustosVigencia(vigencia);
        }

        return {
          colaborador: {
            id: colaborador.id,
            nome: colaborador.nome,
            cpf: colaborador.cpf,
            status: colaborador.status
          },
          vigencia: vigenciaComCalculos
        };
      })
    );

    return { data: colaboradoresComVigencias, error: null };
  } catch (error) {
    console.error('Erro ao buscar colaboradores com últimas vigências:', error);
    return { data: null, error };
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
  buscarHorasContratadasPorMembroEPeriodo,
  buscarCustoMaisRecenteLote,
  buscarHorasContratadasLote,
  buscarColaboradoresComUltimaVigencia
};

