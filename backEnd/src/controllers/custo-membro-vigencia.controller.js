// =============================================================
// === CONTROLLER DE CUSTO MEMBRO VIGÊNCIA ===
// =============================================================

const { supabase } = require('../services/api-clientes');

// GET - Listar todas as vigências (com filtros opcionais)
async function getCustosMembroVigencia(req, res) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      membro_id,
      dt_vigencia_inicio,
      dt_vigencia_fim
    } = req.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*', { count: 'exact' })
      .order('dt_vigencia', { ascending: false });

    // Filtro por membro_id
    if (membro_id) {
      query = query.eq('membro_id', membro_id);
    }

    // Filtro por período de vigência
    if (dt_vigencia_inicio) {
      query = query.gte('dt_vigencia', dt_vigencia_inicio);
    }
    if (dt_vigencia_fim) {
      query = query.lte('dt_vigencia', dt_vigencia_fim);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar custos membro vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custos membro vigência',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custos membro vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar vigência por ID
async function getCustoMembroVigenciaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vigência é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar custo membro vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custo membro vigência',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Vigência não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custo membro vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar vigências por membro_id
async function getCustosPorMembro(req, res) {
  try {
    const { membro_id } = req.params;

    if (!membro_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do membro é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('*')
      .eq('membro_id', membro_id)
      .order('dt_vigencia', { ascending: false });

    if (error) {
      console.error('Erro ao buscar custos por membro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custos por membro',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custos por membro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova vigência
async function criarCustoMembroVigencia(req, res) {
  try {
    const {
      membro_id,
      dt_vigencia,
      diasuteis,
      horascontratadasdia,
      salariobase,
      ajudacusto = 0,
      valetransporte = 0,
      ferias = 0,
      decimoterceiro = 0,
      insspatronal = 0,
      insscolaborador = 0,
      fgts = 0,
      horas_mensal,
      descricao = null
    } = req.body;

    // Validações obrigatórias
    if (!membro_id) {
      return res.status(400).json({
        success: false,
        error: 'membro_id é obrigatório'
      });
    }

    if (!dt_vigencia) {
      return res.status(400).json({
        success: false,
        error: 'dt_vigencia é obrigatória'
      });
    }

    // Validar formato de data (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataRegex.test(dt_vigencia)) {
      return res.status(400).json({
        success: false,
        error: 'dt_vigencia deve estar no formato YYYY-MM-DD'
      });
    }

    // Verificar se membro existe
    const { data: membroExiste, error: errorMembro } = await supabase
      .schema('up_gestaointeligente')
      .from('membro')
      .select('id')
      .eq('id', membro_id)
      .maybeSingle();

    if (errorMembro) {
      console.error('Erro ao verificar membro:', errorMembro);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar membro',
        details: errorMembro.message
      });
    }

    if (!membroExiste) {
      return res.status(404).json({
        success: false,
        error: 'Membro não encontrado'
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      membro_id: parseInt(membro_id, 10),
      dt_vigencia: dt_vigencia,
      diasuteis: diasuteis ? parseFloat(diasuteis) : null,
      horascontratadasdia: horascontratadasdia ? parseFloat(horascontratadasdia) : null,
      salariobase: salariobase ? parseFloat(salariobase) : null,
      ajudacusto: ajudacusto ? parseFloat(ajudacusto) : 0,
      valetransporte: valetransporte ? parseFloat(valetransporte) : 0,
      ferias: ferias ? parseFloat(ferias) : 0,
      decimoterceiro: decimoterceiro ? parseFloat(decimoterceiro) : 0,
      insspatronal: insspatronal ? parseFloat(insspatronal) : 0,
      insscolaborador: insscolaborador ? parseFloat(insscolaborador) : 0,
      fgts: fgts ? parseFloat(fgts) : 0,
      horas_mensal: horas_mensal ? parseFloat(horas_mensal) : null,
      descricao: descricao || null
    };

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .insert([dadosInsert])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar custo membro vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar custo membro vigência',
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Custo membro vigência criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar custo membro vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar vigência
async function atualizarCustoMembroVigencia(req, res) {
  try {
    const { id } = req.params;
    const {
      membro_id,
      dt_vigencia,
      diasuteis,
      horascontratadasdia,
      salariobase,
      ajudacusto,
      valetransporte,
      ferias,
      decimoterceiro,
      insspatronal,
      insscolaborador,
      fgts,
      horas_mensal,
      descricao
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vigência é obrigatório'
      });
    }

    // Verificar se vigência existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('id, membro_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar vigência:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vigência',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Vigência não encontrada'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (membro_id !== undefined) {
      // Verificar se novo membro existe
      const { data: membroExiste, error: errorMembro } = await supabase
        .schema('up_gestaointeligente')
        .from('membro')
        .select('id')
        .eq('id', membro_id)
        .maybeSingle();

      if (errorMembro) {
        console.error('Erro ao verificar membro:', errorMembro);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar membro',
          details: errorMembro.message
        });
      }

      if (!membroExiste) {
        return res.status(404).json({
          success: false,
          error: 'Membro não encontrado'
        });
      }

      dadosUpdate.membro_id = parseInt(membro_id, 10);
    }

    if (dt_vigencia !== undefined) {
      // Validar formato de data
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(dt_vigencia)) {
        return res.status(400).json({
          success: false,
          error: 'dt_vigencia deve estar no formato YYYY-MM-DD'
        });
      }
      dadosUpdate.dt_vigencia = dt_vigencia;
    }

    // Campos numéricos opcionais
    if (diasuteis !== undefined) dadosUpdate.diasuteis = diasuteis ? parseFloat(diasuteis) : null;
    if (horascontratadasdia !== undefined) dadosUpdate.horascontratadasdia = horascontratadasdia ? parseFloat(horascontratadasdia) : null;
    if (salariobase !== undefined) dadosUpdate.salariobase = salariobase ? parseFloat(salariobase) : null;
    if (ajudacusto !== undefined) dadosUpdate.ajudacusto = ajudacusto ? parseFloat(ajudacusto) : 0;
    if (valetransporte !== undefined) dadosUpdate.valetransporte = valetransporte ? parseFloat(valetransporte) : 0;
    if (ferias !== undefined) dadosUpdate.ferias = ferias ? parseFloat(ferias) : 0;
    if (decimoterceiro !== undefined) dadosUpdate.decimoterceiro = decimoterceiro ? parseFloat(decimoterceiro) : 0;
    if (insspatronal !== undefined) dadosUpdate.insspatronal = insspatronal ? parseFloat(insspatronal) : 0;
    if (insscolaborador !== undefined) dadosUpdate.insscolaborador = insscolaborador ? parseFloat(insscolaborador) : 0;
    if (fgts !== undefined) dadosUpdate.fgts = fgts ? parseFloat(fgts) : 0;
    if (horas_mensal !== undefined) dadosUpdate.horas_mensal = horas_mensal ? parseFloat(horas_mensal) : null;
    if (descricao !== undefined) dadosUpdate.descricao = descricao || null;

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Atualizar no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar custo membro vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar custo membro vigência',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Custo membro vigência atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar custo membro vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar vigência
async function deletarCustoMembroVigencia(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da vigência é obrigatório'
      });
    }

    // Verificar se vigência existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('id, membro_id, dt_vigencia')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar vigência:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vigência',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Vigência não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar custo membro vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar custo membro vigência',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Custo membro vigência deletado com sucesso',
      data: {
        id: existente.id,
        membro_id: existente.membro_id,
        dt_vigencia: existente.dt_vigencia
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar custo membro vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getCustosMembroVigencia,
  getCustoMembroVigenciaPorId,
  getCustosPorMembro,
  criarCustoMembroVigencia,
  atualizarCustoMembroVigencia,
  deletarCustoMembroVigencia
};

