// =============================================================
// === CONTROLLER DE SUBTAREFA (cp_subtarefa) ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as subtarefas (com paginação opcional)
async function getSubtarefas(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      
      .from('cp_subtarefa')
      .select('id, nome, descricao, created_at', { count: 'exact' })
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
      console.error('❌ Erro ao buscar subtarefas:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar subtarefas',
        details: error.message
      });
    }

    console.log(`✅ Subtarefas encontradas: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar subtarefas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar subtarefa por ID
async function getSubtarefaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da subtarefa é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_subtarefa')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar subtarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar subtarefa',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Subtarefa não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar subtarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova subtarefa
async function criarSubtarefa(req, res) {
  try {
    const { nome, descricao } = req.body;

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

    // Função auxiliar para limpar valores (retorna null para campos opcionais)
    const cleanValue = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    // Preparar dados para inserção
    const dadosInsert = {
      nome: nomeTrimmed,
      descricao: cleanValue(descricao)
    };

    console.log('💾 Criando subtarefa:', dadosInsert);

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cp_subtarefa')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar subtarefa:', insertError);
      console.error('❌ Detalhes do erro:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar subtarefa',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar subtarefa: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Subtarefa criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar subtarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar subtarefa
async function atualizarSubtarefa(req, res) {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da subtarefa é obrigatório'
      });
    }

    // Verificar se subtarefa existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_subtarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar subtarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar subtarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Subtarefa não encontrada'
      });
    }

    // Função auxiliar para limpar valores
    const cleanValue = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    // Preparar dados para atualização
    const dadosUpdate = {};
    let temAlteracao = false;

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio'
        });
      }

      const nomeTrimmed = nome.trim();
      
      // Verificar se existe outra subtarefa com mesmo nome (case-insensitive)
      const { data: todasSubtarefas, error: errorNome } = await supabase
        
        .from('cp_subtarefa')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      const nomeExistente = (todasSubtarefas || []).find(
        item => 
          item.id !== parseInt(id, 10) && 
          item.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Subtarefa com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nomeTrimmed;
      temAlteracao = true;
    }

    if (descricao !== undefined) {
      dadosUpdate.descricao = cleanValue(descricao);
      temAlteracao = true;
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    console.log('📝 Atualizando subtarefa:', {
      id,
      dadosUpdate: {
        ...dadosUpdate,
        descricao: dadosUpdate.descricao ? `${dadosUpdate.descricao.substring(0, 50)}...` : null
      }
    });

    // Atualizar no banco
    const { data, error } = await supabase
      
      .from('cp_subtarefa')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar subtarefa:', error);
      console.error('   Detalhes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar subtarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Subtarefa atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar subtarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar subtarefa
async function deletarSubtarefa(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da subtarefa é obrigatório'
      });
    }

    // Verificar se subtarefa existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_subtarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar subtarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar subtarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Subtarefa não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      
      .from('cp_subtarefa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar subtarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar subtarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Subtarefa deletada com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar subtarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getSubtarefas,
  getSubtarefaPorId,
  criarSubtarefa,
  atualizarSubtarefa,
  deletarSubtarefa
};

