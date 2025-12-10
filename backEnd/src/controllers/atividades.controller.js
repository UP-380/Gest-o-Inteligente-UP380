// =============================================================
// === CONTROLLER DE ATIVIDADES ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as atividades (com paginação opcional)
async function getAtividades(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
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
      console.error('❌ Erro ao buscar atividades:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar atividades',
        details: error.message
      });
    }

    console.log(`✅ Atividades encontradas: ${data?.length || 0} de ${count || 0} total`);
    if (data && data.length > 0) {
      console.log('📋 Primeira atividade:', JSON.stringify(data[0], null, 2));
      console.log('📋 clickup_id da primeira:', data[0].clickup_id);
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
    console.error('Erro inesperado ao buscar atividades:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar atividade por ID
async function getAtividadePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da atividade é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar atividade',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Atividade não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova atividade
async function criarAtividade(req, res) {
  try {
    console.log('📥 [CRIAR] req.body recebido:', JSON.stringify(req.body, null, 2));
    
    const { nome, clickup_id } = req.body;

    // Validação do nome
    if (!nome) {
      console.error('❌ [CRIAR] Nome não fornecido');
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório'
      });
    }

    const nomeTrimmed = String(nome).trim();
    if (!nomeTrimmed) {
      console.error('❌ [CRIAR] Nome vazio após trim');
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

    console.log('💾 [CRIAR] Dados para inserção:', JSON.stringify(dadosInsert, null, 2));

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('❌ [CRIAR] Erro ao criar atividade:', insertError);
      console.error('❌ [CRIAR] Detalhes completos do erro:', JSON.stringify({
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      }, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar atividade',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      console.error('❌ [CRIAR] Nenhum dado retornado após inserção');
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar atividade: nenhum dado retornado'
      });
    }

    console.log('✅ [CRIAR] Atividade criada com sucesso:', JSON.stringify(data, null, 2));

    return res.status(201).json({
      success: true,
      message: 'Atividade criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ [CRIAR] Erro inesperado ao criar atividade:', error);
    console.error('❌ [CRIAR] Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar atividade
async function atualizarAtividade(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da atividade é obrigatório'
      });
    }

    // Verificar se atividade existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar atividade:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar atividade',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Atividade não encontrada'
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

      // Verificar se nome já existe em outra atividade (case-insensitive)
      const nomeTrimmed = nome.trim();
      
      // Buscar todas as atividades e fazer comparação case-insensitive no código
      const { data: todasAtividades, error: errorNome } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tarefa')
        .select('id, nome');
      
      if (errorNome) {
        console.error('❌ Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      // Verificar se existe outra atividade com mesmo nome (case-insensitive)
      const nomeExistente = (todasAtividades || []).find(
        atividade => 
          atividade.id !== id && 
          atividade.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Atividade com este nome já existe',
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
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar atividade',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Atividade atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar atividade
async function deletarAtividade(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da atividade é obrigatório'
      });
    }

    // Verificar se atividade existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar atividade:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar atividade',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Atividade não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_tarefa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar atividade:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar atividade',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Atividade deletada com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar atividade:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getAtividades,
  getAtividadePorId,
  criarAtividade,
  atualizarAtividade,
  deletarAtividade
};

