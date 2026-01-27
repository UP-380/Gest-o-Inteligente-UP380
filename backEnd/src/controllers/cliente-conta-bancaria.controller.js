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
        status_cadastro,
        status_acesso,
        observacoes,
        chave_acesso,
        senha_4digitos,
        senha_6digitos,
        senha_8digitos,
        link_acesso,
        created_at,
        cp_banco (
          id,
          nome,
          codigo
        )
      `, { count: 'exact' })
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false });

    // Busca por agência, conta, usuário ou observações
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`agencia.ilike.${ilikePattern},conta.ilike.${ilikePattern},usuario.ilike.${ilikePattern},observacoes.ilike.${ilikePattern}`);
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
    const { 
      cliente_id, 
      banco_id, 
      agencia, 
      conta, 
      operador, 
      usuario, 
      senha,
      status_cadastro,
      status_acesso,
      observacoes,
      chave_acesso,
      senha_4digitos,
      senha_6digitos,
      senha_8digitos,
      link_acesso
    } = req.body;

    console.log('📥 POST /clientes-contas-bancarias - Dados recebidos:', {
      cliente_id,
      banco_id,
      agencia: agencia ? '***' : null,
      conta: conta ? '***' : null,
      operador: operador ? '***' : null,
      usuario: usuario ? '***' : null,
      senha: senha ? '***' : null,
      status_cadastro,
      status_acesso,
      observacoes: observacoes ? '***' : null,
      chave_acesso: chave_acesso ? '***' : null,
      senha_4digitos: senha_4digitos ? '***' : null,
      senha_6digitos: senha_6digitos ? '***' : null,
      senha_8digitos: senha_8digitos ? '***' : null,
      link_acesso
    });

    // Validação
    if (!cliente_id) {
      console.error('❌ Validação falhou: cliente_id é obrigatório');
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!banco_id) {
      console.error('❌ Validação falhou: banco_id é obrigatório');
      return res.status(400).json({
        success: false,
        error: 'ID do banco é obrigatório'
      });
    }

    // Validar se banco_id é um número válido
    const bancoIdNum = parseInt(banco_id, 10);
    if (isNaN(bancoIdNum) || bancoIdNum <= 0) {
      console.error('❌ Validação falhou: banco_id deve ser um número válido:', banco_id);
      return res.status(400).json({
        success: false,
        error: 'ID do banco deve ser um número válido'
      });
    }

    // Função auxiliar para limpar valores
    // IMPORTANTE: Preserva valores válidos, apenas remove strings vazias
    const cleanValue = (value, fieldName = '') => {
      // Se for undefined ou null, retorna null
      if (value === undefined || value === null) {
        return null;
      }
      
      // Se for string vazia, retorna null
      if (typeof value === 'string' && value.trim() === '') {
        return null;
      }
      
      // Se for número 0, preserva (pode ser um valor válido)
      if (typeof value === 'number') {
        return value;
      }
      
      // Para strings, retorna trim() mas preserva se não estiver vazia
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
      }
      
      // Para outros tipos, retorna como está
      return value;
    };

    // Preparar dados para inserção
    // IMPORTANTE: Incluir TODOS os campos, mesmo que sejam null
    const dadosInsert = {
      cliente_id: String(cliente_id).trim(),
      banco_id: bancoIdNum,
      agencia: cleanValue(agencia, 'agencia'),
      conta: cleanValue(conta, 'conta'),
      operador: cleanValue(operador, 'operador'),
      usuario: cleanValue(usuario, 'usuario'),
      senha: cleanValue(senha, 'senha'),
      status_cadastro: cleanValue(status_cadastro, 'status_cadastro'),
      status_acesso: cleanValue(status_acesso, 'status_acesso'),
      observacoes: cleanValue(observacoes, 'observacoes'),
      chave_acesso: cleanValue(chave_acesso, 'chave_acesso'),
      senha_4digitos: cleanValue(senha_4digitos, 'senha_4digitos'),
      senha_6digitos: cleanValue(senha_6digitos, 'senha_6digitos'),
      senha_8digitos: cleanValue(senha_8digitos, 'senha_8digitos'),
      link_acesso: cleanValue(link_acesso, 'link_acesso')
    };

    // Log detalhado de cada campo antes e depois da limpeza
    console.log('🔍 Comparação de campos (antes → depois):');
    const campos = [
      { nome: 'agencia', original: agencia, processado: dadosInsert.agencia },
      { nome: 'conta', original: conta, processado: dadosInsert.conta },
      { nome: 'operador', original: operador, processado: dadosInsert.operador },
      { nome: 'usuario', original: usuario, processado: dadosInsert.usuario },
      { nome: 'senha', original: senha ? '***' : senha, processado: dadosInsert.senha ? '***' : dadosInsert.senha },
      { nome: 'status_cadastro', original: status_cadastro, processado: dadosInsert.status_cadastro },
      { nome: 'status_acesso', original: status_acesso, processado: dadosInsert.status_acesso },
      { nome: 'observacoes', original: observacoes ? (observacoes.substring(0, 30) + '...') : observacoes, processado: dadosInsert.observacoes ? (dadosInsert.observacoes.substring(0, 30) + '...') : dadosInsert.observacoes },
      { nome: 'chave_acesso', original: chave_acesso ? '***' : chave_acesso, processado: dadosInsert.chave_acesso ? '***' : dadosInsert.chave_acesso },
      { nome: 'senha_4digitos', original: senha_4digitos ? '***' : senha_4digitos, processado: dadosInsert.senha_4digitos ? '***' : dadosInsert.senha_4digitos },
      { nome: 'senha_6digitos', original: senha_6digitos ? '***' : senha_6digitos, processado: dadosInsert.senha_6digitos ? '***' : dadosInsert.senha_6digitos },
      { nome: 'senha_8digitos', original: senha_8digitos ? '***' : senha_8digitos, processado: dadosInsert.senha_8digitos ? '***' : dadosInsert.senha_8digitos },
      { nome: 'link_acesso', original: link_acesso, processado: dadosInsert.link_acesso }
    ];
    
    campos.forEach(campo => {
      if (campo.original !== campo.processado) {
        console.log(`   ⚠️  ${campo.nome}: "${campo.original}" → "${campo.processado}"`);
      } else {
        console.log(`   ✅ ${campo.nome}: "${campo.original}"`);
      }
    });

    console.log('💾 Dados preparados para inserção:');
    console.log('   cliente_id:', dadosInsert.cliente_id);
    console.log('   banco_id:', dadosInsert.banco_id);
    console.log('   agencia:', dadosInsert.agencia);
    console.log('   conta:', dadosInsert.conta);
    console.log('   operador:', dadosInsert.operador);
    console.log('   usuario:', dadosInsert.usuario);
    console.log('   senha:', dadosInsert.senha ? '***' : null);
    console.log('   status_cadastro:', dadosInsert.status_cadastro);
    console.log('   status_acesso:', dadosInsert.status_acesso);
    console.log('   observacoes:', dadosInsert.observacoes ? (dadosInsert.observacoes.substring(0, 50) + '...') : null);
    console.log('   chave_acesso:', dadosInsert.chave_acesso ? '***' : null);
    console.log('   senha_4digitos:', dadosInsert.senha_4digitos ? '***' : null);
    console.log('   senha_6digitos:', dadosInsert.senha_6digitos ? '***' : null);
    console.log('   senha_8digitos:', dadosInsert.senha_8digitos ? '***' : null);
    console.log('   link_acesso:', dadosInsert.link_acesso);

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
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
      console.error('❌ Erro ao criar conta bancária:', insertError);
      console.error('   Código:', insertError.code);
      console.error('   Mensagem:', insertError.message);
      console.error('   Detalhes:', insertError.details);
      console.error('   Hint:', insertError.hint);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar conta bancária',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    console.log('✅ Conta bancária criada com sucesso!');
    console.log('📋 Dados retornados do banco:');
    console.log('   id:', data?.id);
    console.log('   agencia:', data?.agencia);
    console.log('   conta:', data?.conta);
    console.log('   operador:', data?.operador);
    console.log('   usuario:', data?.usuario);
    console.log('   senha:', data?.senha ? '***' : null);
    console.log('   status_cadastro:', data?.status_cadastro);
    console.log('   status_acesso:', data?.status_acesso);
    console.log('   observacoes:', data?.observacoes ? (data.observacoes.substring(0, 50) + '...') : null);
    console.log('   chave_acesso:', data?.chave_acesso ? '***' : null);
    console.log('   senha_4digitos:', data?.senha_4digitos ? '***' : null);
    console.log('   senha_6digitos:', data?.senha_6digitos ? '***' : null);
    console.log('   senha_8digitos:', data?.senha_8digitos ? '***' : null);
    console.log('   link_acesso:', data?.link_acesso);
    return res.status(201).json({
      success: true,
      message: 'Conta bancária criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao criar conta bancária:', error);
    console.error('   Stack:', error.stack);
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
    const { 
      banco_id, 
      agencia, 
      conta, 
      operador, 
      usuario, 
      senha,
      status_cadastro,
      status_acesso,
      observacoes,
      chave_acesso,
      senha_4digitos,
      senha_6digitos,
      senha_8digitos,
      link_acesso
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da conta bancária é obrigatório'
      });
    }

    // Verificar se conta existe
    const { data: existente, error: errorCheck } = await supabase
      
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
    if (status_cadastro !== undefined) {
      dadosUpdate.status_cadastro = status_cadastro ? String(status_cadastro).trim() : null;
    }
    if (status_acesso !== undefined) {
      dadosUpdate.status_acesso = status_acesso ? String(status_acesso).trim() : null;
    }
    if (observacoes !== undefined) {
      dadosUpdate.observacoes = observacoes ? String(observacoes).trim() : null;
    }
    if (chave_acesso !== undefined) {
      dadosUpdate.chave_acesso = chave_acesso ? String(chave_acesso).trim() : null;
    }
    if (senha_4digitos !== undefined) {
      dadosUpdate.senha_4digitos = senha_4digitos ? String(senha_4digitos).trim() : null;
    }
    if (senha_6digitos !== undefined) {
      dadosUpdate.senha_6digitos = senha_6digitos ? String(senha_6digitos).trim() : null;
    }
    if (senha_8digitos !== undefined) {
      dadosUpdate.senha_8digitos = senha_8digitos ? String(senha_8digitos).trim() : null;
    }
    if (link_acesso !== undefined) {
      dadosUpdate.link_acesso = link_acesso ? String(link_acesso).trim() : null;
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

