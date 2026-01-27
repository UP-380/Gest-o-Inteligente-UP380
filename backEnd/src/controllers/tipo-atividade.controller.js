// =============================================================
// === CONTROLLER DE TIPO ATIVIDADE ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os tipos de atividade (com paginação opcional)
async function getTipoAtividades(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      
      .from('cp_tarefa_tipo')
      .select('id, nome, clickup_id, created_at, updated_at', { count: 'exact' })
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
      console.error('❌ Erro ao buscar tipos de atividade:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipos de atividade',
        details: error.message
      });
    }

    console.log(`✅ Tipos de atividade encontrados: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipos de atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tipo de atividade por ID
async function getTipoAtividadePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de atividade é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_tarefa_tipo')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tipo de atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipo de atividade',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de atividade não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipo de atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tipo de atividade por clickup_id
async function getTipoAtividadePorClickupId(req, res) {
  try {
    const { clickup_id } = req.query;

    if (!clickup_id) {
      return res.status(400).json({
        success: false,
        error: 'clickup_id é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_tarefa_tipo')
      .select('id, nome, clickup_id')
      .eq('clickup_id', clickup_id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tipo de atividade por clickup_id:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipo de atividade',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de atividade não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipo de atividade por clickup_id:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo tipo de atividade
async function criarTipoAtividade(req, res) {
  try {
    const { nome, clickup_id } = req.body;

    // Validação do nome
    if (!nome) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório'
      });
    }

    const nomeTrimmed = String(nome).trim();
    if (!nomeTrimmed) {
      return res.status(400).json({
        success: false,
        error: 'Nome não pode ser vazio'
      });
    }

    // Preparar dados para inserção (sem ID - banco gera automaticamente)
    // clickup_id é obrigatório, usar valor fornecido ou string vazia como padrão
    const dadosInsert = {
      nome: nomeTrimmed,
      clickup_id: clickup_id ? String(clickup_id).trim() : ''
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cp_tarefa_tipo')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar tipo de atividade:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tipo de atividade',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tipo de atividade: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tipo de atividade criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar tipo de atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar tipo de atividade
async function atualizarTipoAtividade(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de atividade é obrigatório'
      });
    }

    // Verificar se tipo de atividade existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_tarefa_tipo')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de atividade:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tipo de atividade',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de atividade não encontrado'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio'
        });
      }

      const nomeTrimmed = nome.trim();
      
      // Buscar todos os tipos de atividade e fazer comparação case-insensitive
      const { data: todosTipos, error: errorNome } = await supabase
        
        .from('cp_tarefa_tipo')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      // Verificar se existe outro tipo com mesmo nome (case-insensitive)
      const nomeExistente = (todosTipos || []).find(
        tipo => 
          tipo.id !== id && 
          tipo.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Tipo de atividade com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nome.trim();
      dadosUpdate.updated_at = new Date().toISOString();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Atualizar no banco
    const { data, error } = await supabase
      
      .from('cp_tarefa_tipo')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar tipo de atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tipo de atividade',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tipo de atividade atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar tipo de atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar tipo de atividade
async function deletarTipoAtividade(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de atividade é obrigatório'
      });
    }

    // Verificar se tipo de atividade existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_tarefa_tipo')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de atividade:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tipo de atividade',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de atividade não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      
      .from('cp_tarefa_tipo')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tipo de atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar tipo de atividade',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tipo de atividade deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar tipo de atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getTipoAtividades,
  getTipoAtividadePorId,
  getTipoAtividadePorClickupId,
  criarTipoAtividade,
  atualizarTipoAtividade,
  deletarTipoAtividade
};
