// =============================================================
// === CONTROLLER DE CLIENTE CONTA BANCARIA ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as contas bancárias de um cliente (com paginação opcional)
async function getContasBancarias(req, res) {
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
      .from('cliente_conta_bancaria')
      .select(`
        id,
        cliente_id,
        banco_id,
        agencia,
        conta,
        operador,
        usuario,
        senha,
        created_at,
        cp_banco (
          id,
          nome,
          codigo
        )
      `, { count: 'exact' })
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false });

    // Busca por agência ou conta
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`agencia.ilike.${ilikePattern},conta.ilike.${ilikePattern}`);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar contas bancárias:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar contas bancárias',
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
    console.error('Erro inesperado ao buscar contas bancárias:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar conta bancária por ID
async function getContaBancariaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da conta bancária é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .select(`
        *,
        cp_banco (
          id,
          nome,
          codigo
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar conta bancária:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar conta bancária',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Conta bancária não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar conta bancária:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova conta bancária
async function criarContaBancaria(req, res) {
  try {
    const { cliente_id, banco_id, agencia, conta, operador, usuario, senha } = req.body;

    // Validação
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!banco_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do banco é obrigatório'
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      cliente_id: cliente_id,
      banco_id: parseInt(banco_id, 10),
      agencia: agencia ? String(agencia).trim() : null,
      conta: conta ? String(conta).trim() : null,
      operador: operador ? String(operador).trim() : null,
      usuario: usuario ? String(usuario).trim() : null,
      senha: senha ? String(senha).trim() : null
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .insert([dadosInsert])
      .select(`
        *,
        cp_banco (
          id,
          nome,
          codigo
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar conta bancária:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar conta bancária',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Conta bancária criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar conta bancária:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar conta bancária
async function atualizarContaBancaria(req, res) {
  try {
    const { id } = req.params;
    const { banco_id, agencia, conta, operador, usuario, senha } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da conta bancária é obrigatório'
      });
    }

    // Verificar se conta existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .select('id, cliente_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar conta bancária:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar conta bancária',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Conta bancária não encontrada'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (banco_id !== undefined) {
      dadosUpdate.banco_id = parseInt(banco_id, 10);
    }
    if (agencia !== undefined) {
      dadosUpdate.agencia = agencia ? String(agencia).trim() : null;
    }
    if (conta !== undefined) {
      dadosUpdate.conta = conta ? String(conta).trim() : null;
    }
    if (operador !== undefined) {
      dadosUpdate.operador = operador ? String(operador).trim() : null;
    }
    if (usuario !== undefined) {
      dadosUpdate.usuario = usuario ? String(usuario).trim() : null;
    }
    if (senha !== undefined) {
      dadosUpdate.senha = senha ? String(senha).trim() : null;
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
      .from('cliente_conta_bancaria')
      .update(dadosUpdate)
      .eq('id', id)
      .select(`
        *,
        cp_banco (
          id,
          nome,
          codigo
        )
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar conta bancária:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar conta bancária',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Conta bancária atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar conta bancária:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar conta bancária
async function deletarContaBancaria(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da conta bancária é obrigatório'
      });
    }

    // Verificar se conta existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .select('id, cliente_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar conta bancária:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar conta bancária',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Conta bancária não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_conta_bancaria')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar conta bancária:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar conta bancária',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Conta bancária deletada com sucesso',
      data: {
        id: existente.id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar conta bancária:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getContasBancarias,
  getContaBancariaPorId,
  criarContaBancaria,
  atualizarContaBancaria,
  deletarContaBancaria
};

