// =============================================================
// === CONTROLLER DE TIPO CONTRATO MEMBRO ===
// =============================================================

const supabase = require('../config/database');
const { sendSuccess, sendError, sendCreated, sendUpdated, sendDeleted, sendValidationError, sendNotFound, sendConflict } = require('../utils/responseHelper');

// GET - Listar todos os tipos de contrato (com paginação opcional)
async function getTiposContrato(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('id, nome, created_at, updated_at', { count: 'exact' })
      .order('nome', { ascending: true });

    // Busca por nome
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.ilike('nome', ilikePattern);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar tipos de contrato:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return sendError(res, 500, 'Erro ao buscar tipos de contrato', error.message);
    }

    console.log(`✅ Tipos de contrato encontrados: ${data?.length || 0} de ${count || 0} total`);

    return sendSuccess(res, 200, data || [], null, {
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipos de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// GET - Buscar tipo de contrato por ID
async function getTipoContratoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID do tipo de contrato é obrigatório');
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tipo de contrato:', error);
      return sendError(res, 500, 'Erro ao buscar tipo de contrato', error.message);
    }

    if (!data) {
      return sendNotFound(res, 'Tipo de contrato');
    }

    return sendSuccess(res, 200, data);
  } catch (error) {
    console.error('Erro inesperado ao buscar tipo de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// POST - Criar novo tipo de contrato
async function criarTipoContrato(req, res) {
  try {
    const { nome } = req.body;

    // Validação do nome
    if (!nome) {
      return sendValidationError(res, 'Nome é obrigatório');
    }

    const nomeTrimmed = String(nome).trim();
    if (!nomeTrimmed) {
      return sendValidationError(res, 'Nome não pode ser vazio');
    }

    // Verificar se já existe tipo de contrato com mesmo nome (case-insensitive)
    const { data: tiposExistentes, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('id, nome');

    if (errorCheck) {
      console.error('Erro ao verificar nome:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar nome', errorCheck.message);
    }

    const nomeExistente = (tiposExistentes || []).find(
      tipo => tipo.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
    );

    if (nomeExistente) {
      return sendConflict(res, 'Tipo de contrato com este nome já existe', {
        id: nomeExistente.id,
        nome: nomeExistente.nome
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      nome: nomeTrimmed
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar tipo de contrato:', insertError);
      return sendError(res, 500, 'Erro ao criar tipo de contrato', insertError.message, insertError.code);
    }

    if (!data) {
      return sendError(res, 500, 'Erro ao criar tipo de contrato: nenhum dado retornado');
    }

    return sendCreated(res, data, 'Tipo de contrato criado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao criar tipo de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// PUT - Atualizar tipo de contrato
async function atualizarTipoContrato(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return sendValidationError(res, 'ID do tipo de contrato é obrigatório');
    }

    // Verificar se tipo de contrato existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de contrato:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar tipo de contrato', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Tipo de contrato');
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return sendValidationError(res, 'Nome não pode ser vazio');
      }

      const nomeTrimmed = nome.trim();
      
      // Verificar se existe outro tipo com mesmo nome (case-insensitive)
      const { data: todosTipos, error: errorNome } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tipo_contrato_membro')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return sendError(res, 500, 'Erro ao verificar nome', errorNome.message);
      }
      
      const nomeExistente = (todosTipos || []).find(
        tipo => 
          tipo.id !== parseInt(id, 10) && 
          tipo.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return sendConflict(res, 'Tipo de contrato com este nome já existe', {
          id: nomeExistente.id,
          nome: nomeExistente.nome
        });
      }

      dadosUpdate.nome = nomeTrimmed;
      dadosUpdate.updated_at = new Date().toISOString();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return sendValidationError(res, 'Nenhum dado fornecido para atualização');
    }

    // Atualizar no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar tipo de contrato:', error);
      return sendError(res, 500, 'Erro ao atualizar tipo de contrato', error.message);
    }

    return sendUpdated(res, data, 'Tipo de contrato atualizado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao atualizar tipo de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

// DELETE - Deletar tipo de contrato
async function deletarTipoContrato(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return sendValidationError(res, 'ID do tipo de contrato é obrigatório');
    }

    // Verificar se tipo de contrato existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de contrato:', errorCheck);
      return sendError(res, 500, 'Erro ao verificar tipo de contrato', errorCheck.message);
    }

    if (!existente) {
      return sendNotFound(res, 'Tipo de contrato');
    }

    // Verificar se há vigências usando este tipo de contrato
    const { data: vigencias, error: errorVigencias } = await supabase
      .schema('up_gestaointeligente')
      .from('custo_membro_vigencia')
      .select('id')
      .eq('tipo_contrato', id)
      .limit(1);

    if (errorVigencias) {
      console.error('Erro ao verificar vigências:', errorVigencias);
      return sendError(res, 500, 'Erro ao verificar uso do tipo de contrato', errorVigencias.message);
    }

    if (vigencias && vigencias.length > 0) {
      return sendConflict(res, 'Não é possível deletar este tipo de contrato pois ele está sendo utilizado em vigências', {
        count: vigencias.length
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tipo_contrato_membro')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tipo de contrato:', error);
      return sendError(res, 500, 'Erro ao deletar tipo de contrato', error.message);
    }

    return sendDeleted(res, {
      id: existente.id,
      nome: existente.nome
    }, 'Tipo de contrato deletado com sucesso');
  } catch (error) {
    console.error('Erro inesperado ao deletar tipo de contrato:', error);
    return sendError(res, 500, 'Erro interno do servidor', error.message);
  }
}

module.exports = {
  getTiposContrato,
  getTipoContratoPorId,
  criarTipoContrato,
  atualizarTipoContrato,
  deletarTipoContrato
};






