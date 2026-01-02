// =============================================================
// === CONTROLLER DE TAREFA (cp_tarefa) ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as tarefas (com paginação opcional)
async function getTarefas(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('id, nome, clickup_id, descricao, created_at, updated_at', { count: 'exact' })
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
      console.error('❌ Erro ao buscar tarefas:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefas',
        details: error.message
      });
    }

    console.log(`✅ Tarefas encontradas: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tarefa por ID
async function getTarefaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefa',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova tarefa
async function criarTarefa(req, res) {
  try {
    const { nome, clickup_id, descricao } = req.body;

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

    // Função auxiliar específica para clickup_id (NOT NULL, então retorna string vazia)
    const cleanClickupId = (value) => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? '' : trimmed;
    };

    // Preparar dados para inserção (sem ID - banco gera automaticamente)
    // clickup_id é obrigatório (NOT NULL), então usa string vazia se não fornecido
    // descricao é opcional
    const dadosInsert = {
      nome: nomeTrimmed,
      clickup_id: cleanClickupId(clickup_id),
      descricao: cleanValue(descricao)
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar tarefa:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tarefa',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tarefa: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tarefa criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar tarefa
async function atualizarTarefa(req, res) {
  try {
    const { id } = req.params;
    const { nome, clickup_id, descricao } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    // Verificar se tarefa existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
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

    // Função auxiliar específica para clickup_id (NOT NULL, então retorna string vazia)
    const cleanClickupId = (value) => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? '' : trimmed;
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
      
      // Buscar todas as tarefas e fazer comparação case-insensitive
      const { data: todasTarefas, error: errorNome } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tarefa')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      // Verificar se existe outra tarefa com mesmo nome (case-insensitive)
      const nomeExistente = (todasTarefas || []).find(
        tarefa => 
          tarefa.id !== parseInt(id, 10) && 
          tarefa.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Tarefa com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nomeTrimmed;
      temAlteracao = true;
    }

    if (clickup_id !== undefined) {
      // clickup_id tem NOT NULL constraint, então usa string vazia se não fornecido
      dadosUpdate.clickup_id = cleanClickupId(clickup_id);
      temAlteracao = true;
    }

    if (descricao !== undefined) {
      dadosUpdate.descricao = cleanValue(descricao);
      temAlteracao = true;
    }

    // Atualizar updated_at apenas uma vez se houver alterações
    if (temAlteracao) {
      dadosUpdate.updated_at = new Date().toISOString();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Log para debug
    console.log('📝 Atualizando tarefa:', {
      id,
      dadosUpdate: {
        ...dadosUpdate,
        descricao: dadosUpdate.descricao ? `${dadosUpdate.descricao.substring(0, 50)}...` : null
      }
    });

    // Atualizar no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar tarefa:', error);
      console.error('   Detalhes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tarefa atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar tarefa
async function deletarTarefa(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    // Verificar se tarefa existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tarefa deletada com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getTarefas,
  getTarefaPorId,
  criarTarefa,
  atualizarTarefa,
  deletarTarefa
};

