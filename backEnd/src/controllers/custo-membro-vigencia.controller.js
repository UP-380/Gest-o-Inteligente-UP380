// =============================================================
// === CONTROLLER DE CUSTO COLABORADOR VIGÊNCIA ===
// =============================================================

const vigenciaService = require('../services/custo-membro-vigencia.service');

// GET - Listar todas as vigências (com filtros opcionais)
async function getCustosColaboradorVigencia(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      membro_id,
      dt_vigencia_inicio,
      dt_vigencia_fim,
      status
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Processar membro_id - pode vir como array, múltiplos parâmetros na query string, ou string separada por vírgula
    let membroIdsArray = [];
    const membroIdsFromQuery = req.query.membro_id;

    if (membroIdsFromQuery) {
      let idsParaProcessar = [];

      // Se for array (múltiplos parâmetros na query string)
      if (Array.isArray(membroIdsFromQuery)) {
        idsParaProcessar = membroIdsFromQuery;
      }
      // Se for string que contém vírgulas (fallback)
      else if (typeof membroIdsFromQuery === 'string' && membroIdsFromQuery.includes(',')) {
        idsParaProcessar = membroIdsFromQuery.split(',').map(id => id.trim()).filter(Boolean);
      }
      // Valor único
      else {
        idsParaProcessar = [membroIdsFromQuery];
      }

      // Converter para números válidos
      membroIdsArray = idsParaProcessar.map(id => parseInt(String(id).trim(), 10)).filter(id => !isNaN(id));

      console.log('🔍 [CONTROLLER] Processamento membro_id:', {
        original: membroIdsFromQuery,
        processado: membroIdsArray,
        tipo: typeof membroIdsFromQuery,
        isArray: Array.isArray(membroIdsFromQuery)
      });
    }

    const filters = {
      membro_id: membroIdsArray.length > 0 ? membroIdsArray : undefined,
      dt_vigencia_inicio: dt_vigencia_inicio || undefined,
      dt_vigencia_fim: dt_vigencia_fim || undefined,
      status: status || undefined
    };

    const { data, count, error } = await vigenciaService.buscarVigencias(filters, pageNum, limitNum);

    if (error) {
      console.error('Erro ao buscar custos colaborador vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custos colaborador vigência',
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
    console.error('Erro inesperado ao buscar custos colaborador vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar vigência por ID
async function getCustoColaboradorVigenciaPorId(req, res) {
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
      console.error('Erro ao buscar custo colaborador vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custo colaborador vigência',
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
    console.error('Erro inesperado ao buscar custo colaborador vigência:', error);
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
      console.error('Erro ao buscar custos por colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custos por colaborador',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custos por colaborador:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova vigência
// VERSÃO LIMPA: Salva exatamente o que vem do frontend, sem cálculos
async function criarCustoColaboradorVigencia(req, res) {
  try {
    console.log('🚀 [POST] Função criarCustoColaboradorVigencia chamada');
    console.log('📥 [POST] Body recebido:', JSON.stringify(req.body, null, 2));

    // Pegar TODOS os campos do body
    // NOTA: diasuteis não existe na tabela, então não extraímos do body
    const {
      membro_id,
      dt_vigencia,
      horascontratadasdia,
      salariobase,
      tipo_contrato,
      ferias,
      terco_ferias,
      decimoterceiro,
      fgts,
      custo_hora,
      insspatronal,
      insscolaborador,
      ajudacusto,
      valetransporte,
      vale_refeicao,
      descricao
      // descricao_beneficios - removido pois a coluna não existe na tabela
      // diasuteis - removido pois a coluna não existe na tabela
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

    // Função para converter para string (campos TEXT)
    const toString = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      return String(value);
    };

    // Função para converter para número (campos numéricos)
    const toNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Preparar dados - Campos TEXT agora recebem string diretamente
    // NOTA: diasuteis não existe na tabela, então não incluímos no insert
    const dadosInsert = {
      membro_id: parseInt(membro_id, 10),
      dt_vigencia: dt_vigencia,
      horascontratadasdia: toNumber(horascontratadasdia),
      salariobase: toNumber(salariobase),
      tipo_contrato: tipo_contrato ? (isNaN(parseInt(tipo_contrato, 10)) ? null : parseInt(tipo_contrato, 10)) : null,
      ajudacusto: toString(ajudacusto) || '0',
      valetransporte: toString(valetransporte) || '0',
      vale_refeicao: toString(vale_refeicao) || '0',
      descricao: descricao || null
    };

    // Campos TEXT - enviar como string
    console.log('🔍 [POST] Valores recebidos do frontend:');
    console.log('   - ferias:', ferias, 'tipo:', typeof ferias);
    console.log('   - terco_ferias:', terco_ferias, 'tipo:', typeof terco_ferias);
    console.log('   - decimoterceiro:', decimoterceiro, 'tipo:', typeof decimoterceiro);
    console.log('   - fgts:', fgts, 'tipo:', typeof fgts);

    if (ferias !== null && ferias !== undefined && ferias !== '') {
      dadosInsert.ferias = toString(ferias);
      console.log('✅ [POST] ferias adicionado:', dadosInsert.ferias);
    }
    if (terco_ferias !== null && terco_ferias !== undefined && terco_ferias !== '') {
      dadosInsert.um_terco_ferias = toString(terco_ferias); // Nome correto da coluna
      console.log('✅ [POST] um_terco_ferias adicionado:', dadosInsert.um_terco_ferias);
    }
    if (decimoterceiro !== null && decimoterceiro !== undefined && decimoterceiro !== '') {
      dadosInsert.decimoterceiro = toString(decimoterceiro);
      console.log('✅ [POST] decimoterceiro adicionado:', dadosInsert.decimoterceiro);
    }
    if (fgts !== null && fgts !== undefined && fgts !== '') {
      dadosInsert.fgts = toString(fgts);
      console.log('✅ [POST] fgts adicionado:', dadosInsert.fgts);
    }
    if (custo_hora !== null && custo_hora !== undefined && custo_hora !== '') {
      dadosInsert.custo_hora = toString(custo_hora);
      console.log('✅ [POST] custo_hora adicionado:', dadosInsert.custo_hora);
    }
    // Campos numéricos - verificar se as colunas existem antes de enviar
    // Se as colunas insspatronal e insscolaborador não existirem, não enviar
    // (comentado temporariamente até confirmar se as colunas existem)
    // if (insspatronal !== null && insspatronal !== undefined && insspatronal !== '') {
    //   const inssPatronalNum = toNumber(insspatronal);
    //   if (inssPatronalNum !== null) dadosInsert.insspatronal = inssPatronalNum;
    // }
    // if (insscolaborador !== null && insscolaborador !== undefined && insscolaborador !== '') {
    //   const inssColabNum = toNumber(insscolaborador);
    //   if (inssColabNum !== null) dadosInsert.insscolaborador = inssColabNum;
    // }

    console.log('📤 [POST] Dados para inserção:', JSON.stringify(dadosInsert, null, 2));

    // Criar vigência - agora sem lógica de correção de trigger (campos são TEXT)
    let { data, error } = await vigenciaService.criarVigencia(dadosInsert);

    if (error) {
      console.error('❌ [POST] Erro ao criar vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar custo colaborador vigência',
        details: error.message || 'Erro desconhecido',
        code: error.code,
        hint: error.hint
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Custo colaborador vigência criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ [POST] Erro inesperado ao criar custo colaborador vigência:', error);
    console.error('❌ [POST] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message || 'Erro desconhecido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// PUT - Atualizar vigência
// VERSÃO LIMPA: Atualiza exatamente o que vem do frontend, sem cálculos
async function atualizarCustoColaboradorVigencia(req, res) {
  try {
    const { id } = req.params;

    // Pegar TODOS os campos do body
    // NOTA: diasuteis não existe na tabela, então não extraímos do body
    const {
      membro_id,
      dt_vigencia,
      horascontratadasdia,
      salariobase,
      tipo_contrato,
      ferias,
      terco_ferias,
      decimoterceiro,
      fgts,
      custo_hora,
      insspatronal,
      insscolaborador,
      ajudacusto,
      valetransporte,
      vale_refeicao,
      descricao
      // descricao_beneficios - removido pois a coluna não existe na tabela
      // diasuteis - removido pois a coluna não existe na tabela
      // custo_total_mensal - não existe na tabela, é calculado
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

    // Função para converter para string (campos TEXT)
    const toString = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      return String(value);
    };

    // Função para converter para número (campos numéricos)
    const toNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Preparar dados - ATUALIZAR EXATAMENTE O QUE VEM DO FRONTEND
    const dadosUpdate = {};

    if (membro_id !== undefined) {
      const { exists, error: errorMembro } = await vigenciaService.verificarMembroExiste(membro_id);
      if (errorMembro) {
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
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(dt_vigencia)) {
        return res.status(400).json({
          success: false,
          error: 'dt_vigencia deve estar no formato YYYY-MM-DD'
        });
      }
      dadosUpdate.dt_vigencia = dt_vigencia;
    }

    // Atualizar TODOS os campos que vierem do frontend
    // Campos numéricos
    // diasuteis não existe na tabela, então não incluímos no update
    if (horascontratadasdia !== undefined) dadosUpdate.horascontratadasdia = toNumber(horascontratadasdia);
    if (salariobase !== undefined) dadosUpdate.salariobase = toNumber(salariobase);
    if (tipo_contrato !== undefined) {
      dadosUpdate.tipo_contrato = tipo_contrato ? (isNaN(parseInt(tipo_contrato, 10)) ? null : parseInt(tipo_contrato, 10)) : null;
    }
    // Campos TEXT (enviar como string)
    if (ferias !== undefined) dadosUpdate.ferias = toString(ferias);
    if (terco_ferias !== undefined) dadosUpdate.um_terco_ferias = toString(terco_ferias); // Nome correto da coluna
    if (decimoterceiro !== undefined) dadosUpdate.decimoterceiro = toString(decimoterceiro);
    if (fgts !== undefined) dadosUpdate.fgts = toString(fgts);
    if (custo_hora !== undefined) {
      const custoHoraStr = toString(custo_hora);
      dadosUpdate.custo_hora = (custoHoraStr && custoHoraStr.trim() !== '') ? custoHoraStr : null;
    }
    if (ajudacusto !== undefined) dadosUpdate.ajudacusto = toString(ajudacusto) || '0';
    if (valetransporte !== undefined) dadosUpdate.valetransporte = toString(valetransporte) || '0';
    if (vale_refeicao !== undefined) dadosUpdate.vale_refeicao = toString(vale_refeicao) || '0';
    // Campos numéricos - verificar se as colunas existem antes de enviar
    // Se as colunas insspatronal e insscolaborador não existirem, não enviar
    // (comentado temporariamente até confirmar se as colunas existem)
    // if (insspatronal !== undefined) dadosUpdate.insspatronal = toNumber(insspatronal);
    // if (insscolaborador !== undefined) dadosUpdate.insscolaborador = toNumber(insscolaborador);
    if (descricao !== undefined) dadosUpdate.descricao = descricao || null;
    // descricao_beneficios - removido pois a coluna não existe na tabela

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    console.log('📤 [PUT] Dados para atualização (EXATOS do frontend):', JSON.stringify(dadosUpdate, null, 2));

    // Atualizar vigência
    const { data, error } = await vigenciaService.atualizarVigencia(id, dadosUpdate);

    if (error) {
      console.error('❌ [PUT] Erro ao atualizar custo colaborador vigência:', error);
      console.error('❌ [PUT] Detalhes do erro:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar custo colaborador vigência',
        details: error.message || 'Erro desconhecido',
        code: error.code,
        hint: error.hint
      });
    }

    return res.json({
      success: true,
      message: 'Custo colaborador vigência atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ [PUT] Erro inesperado ao atualizar custo colaborador vigência:', error);
    console.error('❌ [PUT] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message || 'Erro desconhecido'
    });
  }
}

// GET - Buscar horas contratadas por membro_id e período
async function getHorasContratadasPorMembroEPeriodo(req, res) {
  try {
    const { membro_id, data_inicio, data_fim } = req.query;

    if (!membro_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do membro é obrigatório'
      });
    }

    const membroId = parseInt(membro_id, 10);
    if (isNaN(membroId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do membro inválido'
      });
    }

    const { data, error } = await vigenciaService.buscarHorasContratadasPorMembroEPeriodo(
      membroId,
      data_inicio || null,
      data_fim || null
    );

    if (error) {
      console.error('Erro ao buscar horas contratadas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar horas contratadas',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar horas contratadas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar custo mais recente por membro_id e período
async function getCustoMaisRecentePorMembroEPeriodo(req, res) {
  try {
    const { membro_id, data_inicio, data_fim } = req.query;

    if (!membro_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do membro é obrigatório'
      });
    }

    const membroId = parseInt(membro_id, 10);
    if (isNaN(membroId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do membro inválido'
      });
    }

    const { data, error } = await vigenciaService.buscarCustoMaisRecentePorMembroEPeriodo(
      membroId,
      data_inicio || null,
      data_fim || null
    );

    if (error) {
      console.error('Erro ao buscar custo mais recente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar custo mais recente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custo mais recente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Buscar dados de vigência em lote (horas contratadas e custo mais recente)
async function getDadosVigenciaLote(req, res) {
  try {
    const { membros_ids, data_inicio, data_fim } = req.body;

    if (!membros_ids || !Array.isArray(membros_ids) || membros_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de IDs de membros (membros_ids) é obrigatória e deve ser um array não vazio'
      });
    }

    const { data, error } = await vigenciaService.buscarDadosVigenciaLote(
      membros_ids,
      data_inicio || null,
      data_fim || null
    );

    if (error) {
      console.error('Erro ao buscar dados de vigência em lote:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados de vigência em lote',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar dados de vigência em lote:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar vigência
async function deletarCustoColaboradorVigencia(req, res) {
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
      console.error('Erro ao deletar custo colaborador vigência:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar custo colaborador vigência',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Custo colaborador vigência deletado com sucesso',
      data: {
        id: existente.id,
        membro_id: existente.membro_id,
        dt_vigencia: existente.dt_vigencia
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar custo colaborador vigência:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getCustosColaboradorVigencia,
  getCustoColaboradorVigenciaPorId,
  getCustosPorMembro,
  getCustoMaisRecentePorMembroEPeriodo,
  getHorasContratadasPorMembroEPeriodo,
  criarCustoColaboradorVigencia,
  atualizarCustoColaboradorVigencia,
  atualizarCustoColaboradorVigencia,
  deletarCustoColaboradorVigencia,
  getDadosVigenciaLote
};
