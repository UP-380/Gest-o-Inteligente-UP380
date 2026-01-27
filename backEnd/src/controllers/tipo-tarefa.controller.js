// =============================================================
// === CONTROLLER DE TIPO TAREFA ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os tipos de tarefa (com paginação opcional)
async function getTipoTarefas(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase

      .from('cp_tarefa_tipo')
      .select('id, nome, clickup_id, created_at, updated_at', { count: 'exact' })
      .order('nome', { ascending: true });

    // Busca por nome ou clickup_id
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`nome.ilike.${ilikePattern},clickup_id.ilike.${ilikePattern}`);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar tipos de tarefa:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipos de tarefa',
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
    console.error('Erro inesperado ao buscar tipos de tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tipo de tarefa por ID
async function getTipoTarefaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de tarefa é obrigatório'
      });
    }

    const { data, error } = await supabase

      .from('cp_tarefa_tipo')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tipo de tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tipo de tarefa',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de tarefa não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tipo de tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo tipo de tarefa
async function criarTipoTarefa(req, res) {
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
      console.error('Erro ao criar tipo de tarefa:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tipo de tarefa',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tipo de tarefa: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tipo de tarefa criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar tipo de tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar tipo de tarefa
async function atualizarTipoTarefa(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de tarefa é obrigatório'
      });
    }

    // Verificar se tipo de tarefa existe
    const { data: existente, error: errorCheck } = await supabase

      .from('cp_tarefa_tipo')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tipo de tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de tarefa não encontrado'
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

      // Buscar todos os tipos de tarefa e fazer comparação case-insensitive
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
          error: 'Tipo de tarefa com este nome já existe',
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
      console.error('Erro ao atualizar tipo de tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tipo de tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tipo de tarefa atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar tipo de tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar tipo de tarefa
async function deletarTipoTarefa(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do tipo de tarefa é obrigatório'
      });
    }

    // Verificar se tipo de tarefa existe
    const { data: existente, error: errorCheck } = await supabase

      .from('cp_tarefa_tipo')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tipo de tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tipo de tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tipo de tarefa não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase

      .from('cp_tarefa_tipo')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tipo de tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar tipo de tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tipo de tarefa deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar tipo de tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getTipoTarefas,
  getTipoTarefaPorId,
  criarTipoTarefa,
  atualizarTipoTarefa,
  deletarTipoTarefa
};







