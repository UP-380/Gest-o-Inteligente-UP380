// =============================================================
// === CONTROLLER DE CUSTO MEMBRO VIGÊNCIA ===
// =============================================================

const vigenciaService = require('../services/custo-membro-vigencia.service');

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

    const filters = {
      membro_id: membro_id || undefined,
      dt_vigencia_inicio: dt_vigencia_inicio || undefined,
      dt_vigencia_fim: dt_vigencia_fim || undefined
    };

    const { data, count, error } = await vigenciaService.buscarVigencias(filters, pageNum, limitNum);

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

    const { data, error } = await vigenciaService.buscarVigenciaPorId(id);

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

    const { data, error } = await vigenciaService.buscarVigenciasPorMembro(membro_id);

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
      // ferias, decimoterceiro, insspatronal, insscolaborador, fgts são calculados automaticamente
      // não devem ser recebidos do req.body
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
    const { exists, error: errorMembro } = await vigenciaService.verificarMembroExiste(membro_id);

    if (errorMembro) {
      console.error('Erro ao verificar membro:', errorMembro);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar membro',
        details: errorMembro.message
      });
    }

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Membro não encontrado'
      });
    }

    // Função auxiliar para converter valor para número ou null
    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para número ou 0
    const toNumberOrZero = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : num;
    };

    // Preparar dados para inserção
    // NOTA: Algumas colunas são calculadas automaticamente (generated columns) e não podem ser inseridas:
    // - ferias, decimoterceiro, insspatronal, insscolaborador, fgts, horas_mensal
    const dadosInsert = {
      membro_id: parseInt(membro_id, 10),
      dt_vigencia: dt_vigencia,
      diasuteis: toNumberOrNull(diasuteis),
      horascontratadasdia: toNumberOrNull(horascontratadasdia),
      salariobase: toNumberOrNull(salariobase),
      ajudacusto: toNumberOrZero(ajudacusto),
      valetransporte: toNumberOrZero(valetransporte),
      descricao: descricao || null
    };
    
    // Garantir que colunas calculadas não sejam incluídas
    const colunasCalculadas = ['ferias', 'decimoterceiro', 'insspatronal', 'insscolaborador', 'fgts', 'horas_mensal'];
    colunasCalculadas.forEach(col => {
      delete dadosInsert[col];
    });

    // Log para debug
    console.log('📝 Dados para inserção:', JSON.stringify(dadosInsert, null, 2));

    // Criar vigência
    const { data, error } = await vigenciaService.criarVigencia(dadosInsert);

    if (error) {
      console.error('❌ Erro ao criar custo membro vigência:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Retornar mensagem mais detalhada
      const errorMessage = error.message || 'Erro desconhecido';
      const errorDetails = error.details || error.hint || '';
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar custo membro vigência',
        details: errorMessage,
        hint: errorDetails,
        code: error.code
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
    const { data: existente, error: errorCheck } = await vigenciaService.verificarVigenciaExiste(id);

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
      const { exists, error: errorMembro } = await vigenciaService.verificarMembroExiste(membro_id);

      if (errorMembro) {
        console.error('Erro ao verificar membro:', errorMembro);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar membro',
          details: errorMembro.message
        });
      }

      if (!exists) {
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

    // Função auxiliar para converter valor para número ou null
    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para número ou 0
    const toNumberOrZero = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : num;
    };

    // Campos numéricos opcionais
    if (diasuteis !== undefined) dadosUpdate.diasuteis = toNumberOrNull(diasuteis);
    if (horascontratadasdia !== undefined) dadosUpdate.horascontratadasdia = toNumberOrNull(horascontratadasdia);
    if (salariobase !== undefined) dadosUpdate.salariobase = toNumberOrNull(salariobase);
    if (ajudacusto !== undefined) dadosUpdate.ajudacusto = toNumberOrZero(ajudacusto);
    if (valetransporte !== undefined) dadosUpdate.valetransporte = toNumberOrZero(valetransporte);
    if (ferias !== undefined) dadosUpdate.ferias = toNumberOrZero(ferias);
    if (decimoterceiro !== undefined) dadosUpdate.decimoterceiro = toNumberOrZero(decimoterceiro);
    if (insspatronal !== undefined) dadosUpdate.insspatronal = toNumberOrZero(insspatronal);
    if (insscolaborador !== undefined) dadosUpdate.insscolaborador = toNumberOrZero(insscolaborador);
    if (fgts !== undefined) dadosUpdate.fgts = toNumberOrZero(fgts);
    if (horas_mensal !== undefined) dadosUpdate.horas_mensal = toNumberOrNull(horas_mensal);
    if (descricao !== undefined) dadosUpdate.descricao = descricao || null;

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Atualizar vigência
    const { data, error } = await vigenciaService.atualizarVigencia(id, dadosUpdate);

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
    const { data: existente, error: errorCheck } = await vigenciaService.verificarVigenciaExiste(id);

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

    // Deletar vigência
    const { success, error } = await vigenciaService.deletarVigencia(id);

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
