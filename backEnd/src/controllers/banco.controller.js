// =============================================================
// === CONTROLLER DE BANCO ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os bancos (com paginação opcional)
async function getBancos(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      
      .from('cp_banco')
      .select('id, nome, codigo, created_at', { count: 'exact' })
      .order('nome', { ascending: true });

    // Busca por nome ou código
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      // Buscar por nome ou código usando filtro OR
      query = query.or(`nome.ilike.${ilikePattern},codigo.ilike.${ilikePattern}`);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar bancos:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar bancos',
        details: error.message
      });
    }

    console.log(`✅ Bancos encontrados: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar bancos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar banco por ID
async function getBancoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do banco é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_banco')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar banco:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar banco',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Banco não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar banco:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo banco
async function criarBanco(req, res) {
  try {
    const { nome, codigo } = req.body;

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
      nome: nomeTrimmed,
      codigo: codigo ? String(codigo).trim() : null
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cp_banco')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar banco:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar banco',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar banco: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Banco criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar banco:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar banco
async function atualizarBanco(req, res) {
  try {
    const { id } = req.params;
    const { nome, codigo } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do banco é obrigatório'
      });
    }

    // Verificar se banco existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_banco')
      .select('id, nome, codigo')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar banco:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar banco',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Banco não encontrado'
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
      
      // Buscar todos os bancos e fazer comparação case-insensitive
      const { data: todosBancos, error: errorNome } = await supabase
        
        .from('cp_banco')
        .select('id, nome');
      
      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }
      
      // Verificar se existe outro banco com mesmo nome (case-insensitive)
      const nomeExistente = (todosBancos || []).find(
        banco => 
          banco.id !== parseInt(id, 10) && 
          banco.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Banco com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nomeTrimmed;
    }

    if (codigo !== undefined) {
      dadosUpdate.codigo = codigo ? String(codigo).trim() : null;
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
      
      .from('cp_banco')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar banco:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar banco',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Banco atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar banco:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar banco
async function deletarBanco(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do banco é obrigatório'
      });
    }

    // Verificar se banco existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_banco')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar banco:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar banco',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Banco não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      
      .from('cp_banco')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar banco:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar banco',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Banco deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar banco:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getBancos,
  getBancoPorId,
  criarBanco,
  atualizarBanco,
  deletarBanco
};

