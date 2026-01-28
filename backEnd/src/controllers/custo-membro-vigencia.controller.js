// =============================================================
// === CONTROLLER DE CUSTO COLABORADOR VIGÊNCIA ===
// =============================================================

const vigenciaService = require('../services/custo-membro-vigencia.service');
const { sendSuccess, sendError, sendCreated, sendUpdated, sendDeleted, sendValidationError, sendNotFound, sendConflict } = require('../utils/responseHelper');

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
      return sendError(res, 500, 'Erro ao buscar custos colaborador vigência', error.message);
    }

    return sendSuccess(res, 200, data || [], null, {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custos colaborador vigência:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar vigência por ID
async function getCustoColaboradorVigenciaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID da vigência é obrigatório');
    }

    const { data, error } = await vigenciaService.buscarVigenciaPorId(id);

    if (error) {
      console.error('Erro ao buscar custo colaborador vigência:', error);
      return sendError(res, 500, 'Erro ao buscar custo colaborador vigência', error.message);
    }

    if (!data) {
      return sendNotFound(res, 'Vigência');
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar custo colaborador vigência:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar vigências por membro_id
async function getCustosPorMembro(req, res) {
  try {
    const { membro_id } = req.params;

    if (!membro_id) {
      return sendValidationError(res, 'ID do membro é obrigatório');
    }

    const { data, error } = await vigenciaService.buscarVigenciasPorMembro(membro_id);

    if (error) {
      console.error('Erro ao buscar custos por colaborador:', error);
      return sendError(res, 500, 'Erro ao buscar custos por colaborador', error.message);
    }

    return sendSuccess(res, 200, data || [], null, {
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar custos por colaborador:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// POST - Criar nova vigência
// VERSÃO LIMPA: Salva exatamente o que vem do frontend, sem cálculos
async function criarCustoColaboradorVigencia(req, res) {
  try {
    // Log apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 [POST] Criando nova vigência');
    }
    
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
      insscolaborador,
      ajudacusto,
      valetransporte,
      vale_refeicao,
      descricao
      // descricao_beneficios - removido pois a coluna não existe na tabela
      // diasuteis - removido pois a coluna não existe na tabela
      // insspatronal - removido pois o campo não existe mais
    } = req.body;

    // Validações obrigatórias
    if (!membro_id) {
      return sendValidationError(res, 'membro_id é obrigatório');
    }

    if (!dt_vigencia) {
      return sendValidationError(res, 'dt_vigencia é obrigatória');
    }

    // Validar formato de data (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataRegex.test(dt_vigencia)) {
      return sendValidationError(res, 'dt_vigencia deve estar no formato YYYY-MM-DD');
    }

    // Validar se data não é muito futura (limite de 10 anos)
    const dataVigencia = new Date(dt_vigencia);
    const dataLimite = new Date();
    dataLimite.setFullYear(dataLimite.getFullYear() + 10);
    if (dataVigencia > dataLimite) {
      return sendValidationError(res, 'Data de vigência não pode ser mais de 10 anos no futuro');
    }

    // Verificar se membro existe
    const { exists, error: errorMembro } = await vigenciaService.verificarMembroExiste(membro_id);

    if (errorMembro) {
      console.error('Erro ao verificar membro:', errorMembro);
      return sendError(res, 500, 'Erro ao verificar membro', errorMembro.message);
    }

    if (!exists) {
      return sendNotFound(res, 'Membro');
    }

    // Verificar se já existe vigência com mesmo membro_id e dt_vigencia
    const { exists: vigenciaExiste, error: errorVigencia } = await vigenciaService.verificarVigenciaUnica(membro_id, dt_vigencia);
    
    if (errorVigencia) {
      console.error('Erro ao verificar unicidade de vigência:', errorVigencia);
      return sendError(res, 500, 'Erro ao verificar vigência', errorVigencia.message);
    }

    if (vigenciaExiste) {
      return sendConflict(res, 'Já existe uma vigência para este colaborador com esta data', 'Não é permitido criar vigências duplicadas para o mesmo colaborador na mesma data');
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
    if (ferias !== null && ferias !== undefined && ferias !== '') {
      dadosInsert.ferias = toString(ferias);
    }
    if (terco_ferias !== null && terco_ferias !== undefined && terco_ferias !== '') {
      dadosInsert.um_terco_ferias = toString(terco_ferias); // Nome correto da coluna
    }
    if (decimoterceiro !== null && decimoterceiro !== undefined && decimoterceiro !== '') {
      dadosInsert.decimoterceiro = toString(decimoterceiro);
    }
    if (fgts !== null && fgts !== undefined && fgts !== '') {
      dadosInsert.fgts = toString(fgts);
    }
    if (custo_hora !== null && custo_hora !== undefined && custo_hora !== '') {
      dadosInsert.custo_hora = toString(custo_hora);
    }
    // Criar vigência
    const { data, error } = await vigenciaService.criarVigencia(dadosInsert);

    if (error) {
      console.error('Erro ao criar vigência:', error);
      return sendError(res, 500, 'Erro ao criar custo colaborador vigência', error.message, error.code);
    }

    return sendCreated(res, data, 'Custo colaborador vigência criado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao criar custo colaborador vigência:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
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
      insscolaborador,
      ajudacusto,
      valetransporte,
      vale_refeicao,
      descricao
      // descricao_beneficios - removido pois a coluna não existe na tabela
      // diasuteis - removido pois a coluna não existe na tabela
      // custo_total_mensal - não existe na tabela, é calculado
      // insspatronal - removido pois o campo não existe mais
    } = req.body;

    if (!id) {
      return sendValidationError(res, 'ID da vigência é obrigatório');
    }

    // Verificar se vigência existe
    const { data: existente, error: errorCheck } = await vigenciaService.verificarVigenciaExiste(id);

    if (errorCheck) {
      console.error('Erro ao verificar vigência:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar vigência', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Vigência');
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
        return sendError(res, 500, 'Erro ao verificar membro', errorMembro.message);
      }
      if (!exists) {
        return sendNotFound(res, 'Membro');
      }
      dadosUpdate.membro_id = parseInt(membro_id, 10);
    }

    if (dt_vigencia !== undefined) {
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(dt_vigencia)) {
        return sendValidationError(res, 'dt_vigencia deve estar no formato YYYY-MM-DD');
      }
      
      // Validar se data não é muito futura
      const dataVigencia = new Date(dt_vigencia);
      const dataLimite = new Date();
      dataLimite.setFullYear(dataLimite.getFullYear() + 10);
      if (dataVigencia > dataLimite) {
        return sendValidationError(res, 'Data de vigência não pode ser mais de 10 anos no futuro');
      }

      // Verificar unicidade se dt_vigencia ou membro_id mudaram
      const membroIdParaVerificar = dadosUpdate.membro_id || existente.membro_id;
      const { exists: vigenciaExiste, error: errorVigencia } = await vigenciaService.verificarVigenciaUnica(membroIdParaVerificar, dt_vigencia, id);
      
      if (errorVigencia) {
        console.error('Erro ao verificar unicidade de vigência:', errorVigencia);
        return sendError(res, 500, 'Erro ao verificar vigência', errorVigencia.message);
      }

      if (vigenciaExiste) {
        return sendConflict(res, 'Já existe uma vigência para este colaborador com esta data', 'Não é permitido ter vigências duplicadas para o mesmo colaborador na mesma data');
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
    // insspatronal REMOVIDO - campo não existe mais
    // if (insscolaborador !== undefined) dadosUpdate.insscolaborador = toNumber(insscolaborador);
    if (descricao !== undefined) dadosUpdate.descricao = descricao || null;
    // descricao_beneficios - removido pois a coluna não existe na tabela

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return sendValidationError(res, 'Nenhum dado fornecido para atualização');
    }

    // Atualizar vigência
    const { data, error } = await vigenciaService.atualizarVigencia(id, dadosUpdate);

    if (error) {
      console.error('Erro ao atualizar custo colaborador vigência:', error);
      return sendError(res, 500, 'Erro ao atualizar custo colaborador vigência', error.message, error.code);
    }

    return sendUpdated(res, data, 'Custo colaborador vigência atualizado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao atualizar custo colaborador vigência:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar horas contratadas por membro_id e período
async function getHorasContratadasPorMembroEPeriodo(req, res) {
  try {
    const { membro_id, data_inicio, data_fim } = req.query;

    if (!membro_id) {
      return sendValidationError(res, 'ID do membro é obrigatório');
    }

    const membroId = parseInt(membro_id, 10);
    if (isNaN(membroId)) {
      return sendValidationError(res, 'ID do membro inválido');
    }

    const { data, error } = await vigenciaService.buscarHorasContratadasPorMembroEPeriodo(
      membroId,
      data_inicio || null,
      data_fim || null
    );

    if (error) {
      console.error('Erro ao buscar horas contratadas:', error);
      return sendError(res, 500, 'Erro ao buscar horas contratadas', error.message);
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar horas contratadas:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar custo mais recente por membro_id e período
async function getCustoMaisRecentePorMembroEPeriodo(req, res) {
  try {
    const { membro_id, data_inicio, data_fim } = req.query;

    if (!membro_id) {
      return sendValidationError(res, 'ID do membro é obrigatório');
    }

    const membroId = parseInt(membro_id, 10);
    if (isNaN(membroId)) {
      return sendValidationError(res, 'ID do membro inválido');
    }

    const { data, error } = await vigenciaService.buscarCustoMaisRecentePorMembroEPeriodo(
      membroId,
      data_inicio || null,
      data_fim || null
    );

    if (error) {
      console.error('Erro ao buscar custo mais recente:', error);
      return sendError(res, 500, 'Erro ao buscar custo mais recente', error.message);
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar custo mais recente:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar todos os colaboradores com suas últimas vigências (para relatório)
async function getColaboradoresComUltimaVigencia(req, res) {
  try {
    const { data, error } = await vigenciaService.buscarColaboradoresComUltimaVigencia();

    if (error) {
      console.error('Erro ao buscar colaboradores com últimas vigências:', error);
      return sendError(res, 500, 'Erro ao buscar colaboradores com últimas vigências', error.message);
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar colaboradores com últimas vigências:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// DELETE - Deletar vigência
async function deletarCustoColaboradorVigencia(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID da vigência é obrigatório');
    }

    // Verificar se vigência existe
    const { data: existente, error: errorCheck } = await vigenciaService.verificarVigenciaExiste(id);

    if (errorCheck) {
      console.error('Erro ao verificar vigência:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar vigência', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Vigência');
    }

    // Deletar vigência
    const { success, error } = await vigenciaService.deletarVigencia(id);

    if (error) {
      console.error('Erro ao deletar custo colaborador vigência:', error);
      return sendError(res, 500, 'Erro ao deletar custo colaborador vigência', error.message);
    }

    return sendDeleted(res, {
      id: existente.id,
      membro_id: existente.membro_id,
      dt_vigencia: existente.dt_vigencia
    }, 'Custo colaborador vigência deletado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao deletar custo colaborador vigência:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

module.exports = {
  getCustosColaboradorVigencia,
  getCustoColaboradorVigenciaPorId,
  getCustosPorMembro,
  getCustoMaisRecentePorMembroEPeriodo,
  getHorasContratadasPorMembroEPeriodo,
  getColaboradoresComUltimaVigencia,
  criarCustoColaboradorVigencia,
  atualizarCustoColaboradorVigencia,
  deletarCustoColaboradorVigencia
};
