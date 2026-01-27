// =============================================================
// === CONTROLLER DE CLIENTE ADQUIRENTE ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os adquirentes de um cliente (com paginação opcional)
async function getAdquirentesCliente(req, res) {
  try {
    const { cliente_id } = req.params;
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    let query = supabase
      
      .from('cliente_adquirente')
      .select(`
        *,
        cp_adquirente (
          id,
          nome
        )
      `, { count: 'exact' })
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false });

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar adquirentes do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar adquirentes do cliente',
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
    console.error('Erro inesperado ao buscar adquirentes do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar adquirente do cliente por ID
async function getAdquirenteClientePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente do cliente é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cliente_adquirente')
      .select(`
        *,
        cp_adquirente (
          id,
          nome
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar adquirente do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar adquirente do cliente',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente do cliente não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar adquirente do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo adquirente para cliente
async function criarAdquirenteCliente(req, res) {
  try {
    const { 
      cliente_id, 
      adquirente_id,
      email,
      usuario,
      senha,
      estabelecimento
    } = req.body;

    // Validação
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!adquirente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente é obrigatório'
      });
    }

    // Verificar se já existe a combinação cliente + adquirente
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cliente_adquirente')
      .select('id')
      .eq('cliente_id', cliente_id)
      .eq('adquirente_id', adquirente_id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar adquirente do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar adquirente do cliente',
        details: errorCheck.message
      });
    }

    if (existente) {
      return res.status(409).json({
        success: false,
        error: 'Este adquirente já está vinculado a este cliente'
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      cliente_id: cliente_id,
      adquirente_id: parseInt(adquirente_id, 10),
      'e-mail': email ? String(email).trim() : null,
      usuario: usuario ? String(usuario).trim() : null,
      senha: senha ? String(senha).trim() : null,
      estabelecimento: estabelecimento ? String(estabelecimento).trim() : null
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cliente_adquirente')
      .insert([dadosInsert])
      .select(`
        *,
        cp_adquirente (
          id,
          nome
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar adquirente do cliente:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar adquirente do cliente',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Adquirente vinculado ao cliente com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar adquirente do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar adquirente do cliente
async function atualizarAdquirenteCliente(req, res) {
  try {
    const { id } = req.params;
    const { 
      adquirente_id,
      email,
      usuario,
      senha,
      estabelecimento
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente do cliente é obrigatório'
      });
    }

    // Verificar se registro existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cliente_adquirente')
      .select('id, cliente_id, adquirente_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar adquirente do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar adquirente do cliente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente do cliente não encontrado'
      });
    }

    // Verificar se já existe outra combinação cliente + adquirente (se adquirente_id foi alterado)
    if (adquirente_id !== undefined && existente.adquirente_id !== parseInt(adquirente_id, 10)) {
      const { data: outroExistente, error: errorOutro } = await supabase
        
        .from('cliente_adquirente')
        .select('id')
        .eq('cliente_id', existente.cliente_id)
        .eq('adquirente_id', adquirente_id)
        .neq('id', id)
        .maybeSingle();

      if (errorOutro) {
        console.error('Erro ao verificar adquirente duplicado:', errorOutro);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar adquirente duplicado',
          details: errorOutro.message
        });
      }

      if (outroExistente) {
        return res.status(409).json({
          success: false,
          error: 'Este adquirente já está vinculado a este cliente'
        });
      }
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (adquirente_id !== undefined) {
      dadosUpdate.adquirente_id = parseInt(adquirente_id, 10);
    }
    if (email !== undefined) {
      dadosUpdate['e-mail'] = email ? String(email).trim() : null;
    }
    if (usuario !== undefined) {
      dadosUpdate.usuario = usuario ? String(usuario).trim() : null;
    }
    if (senha !== undefined) {
      dadosUpdate.senha = senha ? String(senha).trim() : null;
    }
    if (estabelecimento !== undefined) {
      dadosUpdate.estabelecimento = estabelecimento ? String(estabelecimento).trim() : null;
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
      
      .from('cliente_adquirente')
      .update(dadosUpdate)
      .eq('id', id)
      .select(`
        *,
        cp_adquirente (
          id,
          nome
        )
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar adquirente do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar adquirente do cliente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Adquirente do cliente atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar adquirente do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar adquirente do cliente
async function deletarAdquirenteCliente(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do adquirente do cliente é obrigatório'
      });
    }

    // Verificar se registro existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cliente_adquirente')
      .select('id, cliente_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar adquirente do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar adquirente do cliente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Adquirente do cliente não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      
      .from('cliente_adquirente')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar adquirente do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar adquirente do cliente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Adquirente removido do cliente com sucesso',
      data: {
        id: existente.id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar adquirente do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getAdquirentesCliente,
  getAdquirenteClientePorId,
  criarAdquirenteCliente,
  atualizarAdquirenteCliente,
  deletarAdquirenteCliente
};

