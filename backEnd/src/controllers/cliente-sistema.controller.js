// =============================================================
// === CONTROLLER DE CLIENTE SISTEMA ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os sistemas de um cliente (com paginação opcional)
async function getSistemasCliente(req, res) {
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
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select(`
        id,
        cliente_id,
        sistema_id,
        servidor,
        usuario_servidor,
        vpn,
        usuario_vpn,
        senha_vpn,
        usuario_sistema,
        senha_sistema,
        created_at,
        cp_sistema (
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
      console.error('❌ Erro ao buscar sistemas do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar sistemas do cliente',
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
    console.error('Erro inesperado ao buscar sistemas do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar sistema do cliente por ID
async function getSistemaClientePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do sistema do cliente é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select(`
        *,
        cp_sistema (
          id,
          nome
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar sistema do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar sistema do cliente',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Sistema do cliente não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar sistema do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo sistema para cliente
async function criarSistemaCliente(req, res) {
  try {
    const { 
      cliente_id, 
      sistema_id,
      servidor,
      usuario_servidor,
      vpn,
      usuario_vpn,
      senha_vpn,
      usuario_sistema,
      senha_sistema
    } = req.body;

    // Validação
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!sistema_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do sistema é obrigatório'
      });
    }

    // Verificar se já existe a combinação cliente + sistema
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select('id')
      .eq('cliente_id', cliente_id)
      .eq('sistema_id', sistema_id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar sistema do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar sistema do cliente',
        details: errorCheck.message
      });
    }

    if (existente) {
      return res.status(409).json({
        success: false,
        error: 'Este sistema já está vinculado a este cliente'
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      cliente_id: cliente_id,
      sistema_id: parseInt(sistema_id, 10),
      servidor: servidor ? String(servidor).trim() : null,
      usuario_servidor: usuario_servidor ? String(usuario_servidor).trim() : null,
      vpn: vpn ? String(vpn).trim() : null,
      usuario_vpn: usuario_vpn ? String(usuario_vpn).trim() : null,
      senha_vpn: senha_vpn ? String(senha_vpn).trim() : null,
      usuario_sistema: usuario_sistema ? String(usuario_sistema).trim() : null,
      senha_sistema: senha_sistema ? String(senha_sistema).trim() : null
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .insert([dadosInsert])
      .select(`
        *,
        cp_sistema (
          id,
          nome
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar sistema do cliente:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar sistema do cliente',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Sistema vinculado ao cliente com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar sistema do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar sistema do cliente
async function atualizarSistemaCliente(req, res) {
  try {
    const { id } = req.params;
    const { 
      sistema_id,
      servidor,
      usuario_servidor,
      vpn,
      usuario_vpn,
      senha_vpn,
      usuario_sistema,
      senha_sistema
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do sistema do cliente é obrigatório'
      });
    }

    // Verificar se registro existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select('id, cliente_id, sistema_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar sistema do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar sistema do cliente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Sistema do cliente não encontrado'
      });
    }

    // Verificar se já existe outra combinação cliente + sistema (se sistema_id foi alterado)
    if (sistema_id !== undefined && existente.sistema_id !== parseInt(sistema_id, 10)) {
      const { data: outroExistente, error: errorOutro } = await supabase
        .schema('up_gestaointeligente')
        .from('cliente_sistema')
        .select('id')
        .eq('cliente_id', existente.cliente_id)
        .eq('sistema_id', sistema_id)
        .neq('id', id)
        .maybeSingle();

      if (errorOutro) {
        console.error('Erro ao verificar sistema duplicado:', errorOutro);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar sistema duplicado',
          details: errorOutro.message
        });
      }

      if (outroExistente) {
        return res.status(409).json({
          success: false,
          error: 'Este sistema já está vinculado a este cliente'
        });
      }
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (sistema_id !== undefined) {
      dadosUpdate.sistema_id = parseInt(sistema_id, 10);
    }
    if (servidor !== undefined) {
      dadosUpdate.servidor = servidor ? String(servidor).trim() : null;
    }
    if (usuario_servidor !== undefined) {
      dadosUpdate.usuario_servidor = usuario_servidor ? String(usuario_servidor).trim() : null;
    }
    if (vpn !== undefined) {
      dadosUpdate.vpn = vpn ? String(vpn).trim() : null;
    }
    if (usuario_vpn !== undefined) {
      dadosUpdate.usuario_vpn = usuario_vpn ? String(usuario_vpn).trim() : null;
    }
    if (senha_vpn !== undefined) {
      dadosUpdate.senha_vpn = senha_vpn ? String(senha_vpn).trim() : null;
    }
    if (usuario_sistema !== undefined) {
      dadosUpdate.usuario_sistema = usuario_sistema ? String(usuario_sistema).trim() : null;
    }
    if (senha_sistema !== undefined) {
      dadosUpdate.senha_sistema = senha_sistema ? String(senha_sistema).trim() : null;
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
      .from('cliente_sistema')
      .update(dadosUpdate)
      .eq('id', id)
      .select(`
        *,
        cp_sistema (
          id,
          nome
        )
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar sistema do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar sistema do cliente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Sistema do cliente atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar sistema do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar sistema do cliente
async function deletarSistemaCliente(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do sistema do cliente é obrigatório'
      });
    }

    // Verificar se registro existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .select('id, cliente_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar sistema do cliente:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar sistema do cliente',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Sistema do cliente não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_sistema')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar sistema do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar sistema do cliente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Sistema removido do cliente com sucesso',
      data: {
        id: existente.id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar sistema do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getSistemasCliente,
  getSistemaClientePorId,
  criarSistemaCliente,
  atualizarSistemaCliente,
  deletarSistemaCliente
};

