// =============================================================
// === CONTROLLER DE CONFIGURAÇÃO DE CUSTO COLABORADOR ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as configurações de custo colaborador (com paginação opcional)
async function getConfigCustoColaborador(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .select('id, created_at, updated_at, vigencia, tipo_contrato, dias_uteis, fgts, ferias, terco_ferias, decimo_terceiro, inss_patronal, vale_transporte, vale_alimentacao, ajuda_custo, horas_variaveis', { count: 'exact' });
    
    query = query.order('vigencia', { ascending: false });

    // Busca por data de vigência (formato YYYY-MM-DD ou parte dela)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      try {
        // Buscar por data de vigência (formato ISO ou parcial)
        if (searchTerm.match(/^\d{4}-\d{2}-\d{2}/)) {
          // Se for uma data completa, buscar exata
          query = query.eq('vigencia', searchTerm);
        } else if (searchTerm.match(/^\d{4}-\d{2}/)) {
          // Se for ano-mês, buscar por range
          const inicio = `${searchTerm}-01`;
          const fim = `${searchTerm}-31`;
          query = query.gte('vigencia', inicio).lte('vigencia', fim);
        } else if (searchTerm.match(/^\d{4}/)) {
          // Se for apenas ano, buscar por range do ano inteiro
          const inicio = `${searchTerm}-01-01`;
          const fim = `${searchTerm}-12-31`;
          query = query.gte('vigencia', inicio).lte('vigencia', fim);
        }
        // Se não for um padrão de data reconhecido, não aplicar filtro de busca
      } catch (searchError) {
        console.warn('Aviso: Erro ao aplicar busca, retornando todos os registros:', searchError);
      }
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar configurações de custo membro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar configurações de custo membro',
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
    console.error('Erro inesperado ao buscar configurações de custo membro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar configuração por ID
async function getConfigCustoColaboradorPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da configuração é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar configuração',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar configuração:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova configuração
async function criarConfigCustoColaborador(req, res) {
  try {
    const {
      vigencia,
      tipo_contrato,
      dias_uteis,
      fgts,
      ferias,
      terco_ferias,
      decimo_terceiro,
      inss_patronal,
      vale_transporte,
      vale_alimentacao,
      ajuda_custo
    } = req.body;

    // Validações
    if (!vigencia) {
      return res.status(400).json({
        success: false,
        error: 'Vigência é obrigatória'
      });
    }

    // Validar formato de data (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataRegex.test(vigencia)) {
      return res.status(400).json({
        success: false,
        error: 'Vigência deve estar no formato YYYY-MM-DD'
      });
    }

    // Função auxiliar para converter valor para número ou null
    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para inteiro ou null
    const toIntOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para boolean ou null
    const toBooleanOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);
    };

    // Preparar dados para inserção
    const dadosInsert = {
      vigencia: vigencia,
      tipo_contrato: toIntOrNull(tipo_contrato),
      dias_uteis: toNumberOrNull(dias_uteis),
      fgts: toNumberOrNull(fgts),
      ferias: toNumberOrNull(ferias),
      terco_ferias: toNumberOrNull(terco_ferias),
      decimo_terceiro: toNumberOrNull(decimo_terceiro),
      inss_patronal: toNumberOrNull(inss_patronal),
      vale_transporte: toNumberOrNull(vale_transporte),
      vale_alimentacao: toNumberOrNull(vale_alimentacao),
      ajuda_custo: toNumberOrNull(ajuda_custo),
      horas_variaveis: toBooleanOrNull(horas_variaveis)
    };

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .insert([dadosInsert])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar configuração',
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Configuração criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar configuração:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar configuração
async function atualizarConfigCustoColaborador(req, res) {
  try {
    const { id } = req.params;
    const {
      vigencia,
      tipo_contrato,
      dias_uteis,
      fgts,
      ferias,
      terco_ferias,
      decimo_terceiro,
      inss_patronal,
      vale_transporte,
      vale_alimentacao,
      ajuda_custo,
      horas_variaveis
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da configuração é obrigatório'
      });
    }

    // Verificar se configuração existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar configuração:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar configuração',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (vigencia !== undefined) {
      // Validar formato de data
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dataRegex.test(vigencia)) {
        return res.status(400).json({
          success: false,
          error: 'Vigência deve estar no formato YYYY-MM-DD'
        });
      }
      dadosUpdate.vigencia = vigencia;
    }

    // Função auxiliar para converter valor para número ou null
    const toNumberOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para inteiro ou null
    const toIntOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter valor para boolean ou null
    const toBooleanOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);
    };

    // Campo tipo_contrato (inteiro)
    if (tipo_contrato !== undefined) dadosUpdate.tipo_contrato = toIntOrNull(tipo_contrato);

    // Campos numéricos opcionais
    if (dias_uteis !== undefined) dadosUpdate.dias_uteis = toNumberOrNull(dias_uteis);
    if (fgts !== undefined) dadosUpdate.fgts = toNumberOrNull(fgts);
    if (ferias !== undefined) dadosUpdate.ferias = toNumberOrNull(ferias);
    if (terco_ferias !== undefined) dadosUpdate.terco_ferias = toNumberOrNull(terco_ferias);
    if (decimo_terceiro !== undefined) dadosUpdate.decimo_terceiro = toNumberOrNull(decimo_terceiro);
    if (inss_patronal !== undefined) dadosUpdate.inss_patronal = toNumberOrNull(inss_patronal);
    if (vale_transporte !== undefined) dadosUpdate.vale_transporte = toNumberOrNull(vale_transporte);
    if (vale_alimentacao !== undefined) dadosUpdate.vale_alimentacao = toNumberOrNull(vale_alimentacao);
    if (ajuda_custo !== undefined) dadosUpdate.ajuda_custo = toNumberOrNull(ajuda_custo);
    if (horas_variaveis !== undefined) dadosUpdate.horas_variaveis = toBooleanOrNull(horas_variaveis);

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Atualizar updated_at automaticamente
    dadosUpdate.updated_at = new Date().toISOString();

    // Atualizar no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar configuração',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar configuração:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar configuração
async function deletarConfigCustoColaborador(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da configuração é obrigatório'
      });
    }

    // Verificar se configuração existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar configuração:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar configuração',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar configuração:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar configuração',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Configuração deletada com sucesso',
      data: {
        id: existente.id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar configuração:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar configuração vigente por data e tipo de contrato
// Busca a configuração que está vigente (ativa) na data informada
async function getConfigCustoColaboradorMaisRecente(req, res) {
  try {
    const { data_vigencia, tipo_contrato } = req.query;

    // Validar que data_vigencia é obrigatória
    if (!data_vigencia) {
      console.warn('Busca de configuração: data_vigencia não fornecida');
      return res.status(400).json({
        success: false,
        error: 'data_vigencia é obrigatória para buscar configuração vigente'
      });
    }

    // Validar formato da data (YYYY-MM-DD)
    const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dataRegex.test(data_vigencia)) {
      console.warn('Busca de configuração: formato de data inválido', { data_vigencia });
      return res.status(400).json({
        success: false,
        error: 'data_vigencia deve estar no formato YYYY-MM-DD'
      });
    }

    // Validar e converter tipo_contrato se fornecido
    let tipoContratoNum = null;
    if (tipo_contrato !== undefined && tipo_contrato !== null && tipo_contrato !== '') {
      tipoContratoNum = parseInt(tipo_contrato, 10);
      if (isNaN(tipoContratoNum)) {
        console.warn('Busca de configuração: tipo_contrato inválido', { tipo_contrato });
        return res.status(400).json({
          success: false,
          error: 'tipo_contrato deve ser um número válido'
        });
      }
    }

    // Log detalhado do que está sendo buscado
    console.log('Busca de configuração vigente:', {
      data_vigencia,
      tipo_contrato: tipoContratoNum,
      filtro: tipoContratoNum ? `vigencia <= ${data_vigencia} AND tipo_contrato = ${tipoContratoNum}` : `vigencia <= ${data_vigencia}`
    });

    // Construir query: aplicar filtros PRIMEIRO, depois ordenar, depois limitar
    let query = supabase
      .schema('up_gestaointeligente')
      .from('config_custo_membro')
      .select('*');

    // Aplicar filtro de vigência (configuração vigente na data informada)
    query = query.lte('vigencia', data_vigencia);

    // Aplicar filtro de tipo_contrato se fornecido e válido
    if (tipoContratoNum !== null) {
      query = query.eq('tipo_contrato', tipoContratoNum);
    }

    // Ordenar por vigencia DESC (pegar a mais recente que está vigente)
    query = query.order('vigencia', { ascending: false });

    // Limitar a 1 resultado (a configuração vigente mais recente)
    query = query.limit(1);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração vigente:', error, {
        data_vigencia,
        tipo_contrato: tipoContratoNum
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar configuração vigente',
        details: error.message
      });
    }

    // Log do resultado
    if (data) {
      console.log('Configuração vigente encontrada:', {
        id: data.id,
        vigencia: data.vigencia,
        tipo_contrato: data.tipo_contrato,
        data_vigencia_buscada: data_vigencia
      });
    } else {
      console.log('Nenhuma configuração vigente encontrada para:', {
        data_vigencia,
        tipo_contrato: tipoContratoNum
      });
    }

    return res.json({
      success: true,
      data: data || null
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar configuração vigente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getConfigCustoColaborador,
  getConfigCustoColaboradorPorId,
  criarConfigCustoColaborador,
  atualizarConfigCustoColaborador,
  deletarConfigCustoColaborador,
  getConfigCustoColaboradorMaisRecente
};

