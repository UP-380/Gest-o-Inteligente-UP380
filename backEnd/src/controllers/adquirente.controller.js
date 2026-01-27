// =============================================================
// === CONTROLLER DE ADQUIRENTE ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os adquirentes (com paginação opcional)
async function getAdquirentes(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      
      .from('cp_adquirente')
      .select('id, nome, created_at', { count: 'exact' })
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
      console.error('❌ Erro ao buscar adquirentes:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar adquirentes',
        details: error.message
      });
    }

    console.log(`✅ Adquirentes encontrados: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar adquirentes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar adquirente por ID
async function getAdquirentePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_adquirente')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar adquirente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar adquirente',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar adquirente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo adquirente
async function criarAdquirente(req, res) {
  try {
    const { nome } = req.body;

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

    // Preparar dados para inserção
    const dadosInsert = {
      nome: nomeTrimmed
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cp_adquirente')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar adquirente:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar adquirente',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar adquirente: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Adquirente criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar adquirente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar adquirente
async function atualizarAdquirente(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente é obrigatório'
      });
    }

    // Verificar se adquirente existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_adquirente')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar adquirente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar adquirente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente não encontrado'
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
      
      // Buscar todos os adquirentes e fazer comparação case-insensitive
      const { data: todosAdquirentes, error: errorNome } = await supabase
        
        .from('cp_adquirente')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      // Verificar se existe outro adquirente com mesmo nome (case-insensitive)
      const nomeExistente = (todosAdquirentes || []).find(
        adquirente => 
          adquirente.id !== parseInt(id, 10) && 
          adquirente.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Adquirente com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nomeTrimmed;
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
      
      .from('cp_adquirente')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar adquirente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar adquirente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Adquirente atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar adquirente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar adquirente
async function deletarAdquirente(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente é obrigatório'
      });
    }

    // Verificar se adquirente existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_adquirente')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar adquirente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar adquirente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      
      .from('cp_adquirente')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar adquirente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar adquirente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Adquirente deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar adquirente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getAdquirentes,
  getAdquirentePorId,
  criarAdquirente,
  atualizarAdquirente,
  deletarAdquirente
};

