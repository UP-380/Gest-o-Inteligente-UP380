// =============================================================
// === CONTROLLER DE CLIENTES ===
// =============================================================

const supabase = require('../config/database');
const { clearCache } = require('../config/cache');

// ========================================
// === GET /api/clientes-kamino ===
// ========================================
async function getClientesKamino(req, res) {
  try {
    console.log('📡 Endpoint /api/clientes-kamino chamado');
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cliente_kamino')
      .select('id, nome_fantasia')
      .not('nome_fantasia', 'is', null)
      .order('nome_fantasia');
    
    if (error) {
      console.error('Erro ao buscar clientes Kamino:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Retornar dados no formato esperado: array de objetos com id e nome_fantasia
    const clientesData = (data || []).map(row => ({
      id: row.id,
      nome_fantasia: row.nome_fantasia || ''
    })).filter(cliente => cliente.nome_fantasia && cliente.nome_fantasia.trim() !== '');
    
    console.log(`✅ Retornando ${clientesData.length} clientes Kamino`);
    
    res.json({ 
      success: true, 
      data: clientesData.map(c => c.nome_fantasia), // Para compatibilidade
      clientes: clientesData, // Dados completos: [{id, nome_fantasia}, ...]
      count: clientesData.length 
    });
  } catch (error) {
    console.error('Erro ao buscar clientes Kamino:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
}

// ========================================
// === GET /api/clientes-incompletos-count ===
// ========================================
async function getClientesIncompletosCount(req, res) {
  try {
    // Filtrar clientes onde QUALQUER um dos campos especificados está vazio ou null
    // Campos: razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino
    const incompletosFilter = `or(razao_social.is.null,razao_social.eq.,nome_fantasia.is.null,nome_fantasia.eq.,nome_amigavel.is.null,nome_amigavel.eq.,cpf_cnpj.is.null,cpf_cnpj.eq.,status.is.null,status.eq.,nome_cli_kamino.is.null,nome_cli_kamino.eq.)`;
    
    const { data, error, count } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true })
      .or(incompletosFilter);
    
    if (error) {
      console.error('Erro ao contar clientes incompletos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    console.log('📋 Total de clientes incompletos:', count);
    
    res.json({ 
      success: true, 
      count: count || 0
    });
  } catch (error) {
    console.error('Erro ao contar clientes incompletos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
}

// ========================================
// === GET /api/carteira-clientes ===
// ========================================
async function getCarteiraClientes(req, res) {
  console.log('📡 Endpoint /api/carteira-clientes chamado');
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const incompletosParam = req.query.incompletos;
    const showIncompletos = incompletosParam === 'true' || incompletosParam === true;

    const offset = (page - 1) * limit;

    let baseQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('*');

    let countQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true });

    if (search) {
      const ilike = `%${search}%`;
      baseQuery = baseQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
      countQuery = countQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
    }

    if (showIncompletos) {
      const f = `or(nome.is.null,nome.eq.,cpf_cnpj.is.null,cpf_cnpj.eq.,status.is.null,status.eq.,nome_cli_kamino.is.null,nome_cli_kamino.eq.)`;
      baseQuery = baseQuery.or(f);
      countQuery = countQuery.or(f);
    } else if (status) {
      baseQuery = baseQuery.eq('status', status);
      countQuery = countQuery.eq('status', status);
    }

    baseQuery = baseQuery.order('razao_social', { ascending: true }).range(offset, offset + limit - 1);

    const [{ data, error: dataErr }, { count, error: countErr }] = await Promise.all([
      baseQuery,
      countQuery
    ]);

    if (dataErr || countErr) {
      const err = dataErr || countErr;
      console.error('Erro na carteira de clientes:', err);
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }

    const totalPages = Math.max(1, Math.ceil((count || 0) / limit));
    return res.json({
      success: true,
      data: data || [],
      count: data ? data.length : 0,
      total: count || 0,
      page,
      limit,
      totalPages
    });
  } catch (e) {
    console.error('Erro no endpoint /api/carteira-clientes:', e);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

// ========================================
// === PUT /api/clientes/:id/inativar ===
// ========================================
async function inativarCliente(req, res) {
  try {
    const { id } = req.params;
    
    console.log('Inativando cliente com ID:', id);
    
    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, status, nome')
      .eq('id', id)
      .single();
    
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    // Verificar se o cliente já está inativo
    if (clienteExistente.status === 'inativo') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cliente já está inativo' 
      });
    }
    
    // Atualizar status para inativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({ 
        status: 'inativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Erro ao inativar cliente:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('Cliente inativado com sucesso:', clienteExistente.nome);
    try {
      await supabase
        .schema('up_gestaointeligente')
        .from('contratos_clientes')
        .update({ status_cliente: 'inativo' })
        .eq('id_cliente', id);
      console.log('Status_cliente sincronizado para INATIVO em contratos_clientes:', id);
    } catch (syncErr) {
      console.warn('Falha ao sincronizar status_cliente (inativar):', syncErr);
    }
    
    res.json({ 
      success: true, 
      message: 'Cliente inativado com sucesso',
      data: data[0]
    });
  } catch (error) {
    console.error('Erro ao inativar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
}

// ========================================
// === PUT /api/clientes/:id/ativar ===
// ========================================
async function ativarCliente(req, res) {
  try {
    const { id } = req.params;
    
    console.log('Ativando cliente com ID:', id);
    
    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, status, nome')
      .eq('id', id)
      .single();
    
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente não encontrado' 
      });
    }
    
    // Verificar se o cliente já está ativo
    if (clienteExistente.status === 'ativo') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cliente já está ativo' 
      });
    }
    
    // Atualizar status para ativo
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({ 
        status: 'ativo',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Erro ao ativar cliente:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('Cliente ativado com sucesso:', clienteExistente.nome);
    try {
      await supabase
        .schema('up_gestaointeligente')
        .from('contratos_clientes')
        .update({ status_cliente: 'ativo' })
        .eq('id_cliente', id);
      console.log('Status_cliente sincronizado para ATIVO em contratos_clientes:', id);
    } catch (syncErr) {
      console.warn('Falha ao sincronizar status_cliente (ativar):', syncErr);
    }
    
    res.json({ 
      success: true, 
      message: 'Cliente ativado com sucesso',
      data: data[0]
    });
  } catch (error) {
    console.error('Erro ao ativar cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
}

// ========================================
// === PUT /api/clientes/:id ===
// ========================================
async function atualizarClientePorId(req, res) {
  try {
    const { id } = req.params;
    const { 
      razao_social, 
      nome_fantasia, 
      nome_amigavel, 
      cpf_cnpj, 
      status, 
      nome_cli_kamino, 
      id_cli_kamino 
    } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }
    
    console.log('📝 Atualizando cliente por ID:', id);
    
    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();
    
    if (checkError) {
      console.error('❌ Erro ao buscar cliente:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({
        success: false,
        error: `Cliente não encontrado com ID: ${id}`
      });
    }
    
    // Preparar dados para atualização
    const dadosUpdate = {
      updated_at: new Date().toISOString()
    };
    
    if (razao_social !== undefined && razao_social !== null) {
      dadosUpdate.razao_social = razao_social.trim() || null;
    }
    if (nome_fantasia !== undefined && nome_fantasia !== null) {
      dadosUpdate.nome_fantasia = nome_fantasia.trim() || null;
    }
    if (nome_amigavel !== undefined && nome_amigavel !== null) {
      dadosUpdate.nome_amigavel = nome_amigavel.trim() || null;
    }
    if (cpf_cnpj !== undefined && cpf_cnpj !== null) {
      dadosUpdate.cpf_cnpj = cpf_cnpj.trim() || null;
    }
    if (status !== undefined && status !== null) {
      dadosUpdate.status = status.trim() || null;
    }
    if (nome_cli_kamino !== undefined && nome_cli_kamino !== null) {
      dadosUpdate.nome_cli_kamino = nome_cli_kamino.trim() || null;
    }
    if (id_cli_kamino !== undefined && id_cli_kamino !== null) {
      dadosUpdate.id_cli_kamino = id_cli_kamino.trim() || null;
    }
    
    // Atualizar cliente
    const { data: clienteAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Erro ao atualizar cliente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar cliente',
        details: updateError.message
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('✅ Cliente atualizado com sucesso:', clienteExistente.nome);
    
    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: clienteAtualizado
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// ========================================
// === PUT /api/cliente-dados/:nomeClienteClickup ===
// ========================================
async function atualizarClientePorNomeClickup(req, res) {
  try {
    const { nomeClienteClickup } = req.params;
    const { 
      razao_social, 
      nome_fantasia, 
      nome_amigavel, 
      cpf_cnpj, 
      status, 
      clienteKamino, 
      idCliKamino 
    } = req.body;
    
    if (!nomeClienteClickup || nomeClienteClickup.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome do cliente ClickUp é obrigatório'
      });
    }
    
    console.log('📝 Atualizando cliente por nome ClickUp:', nomeClienteClickup);
    
    // Buscar cliente pelo nome (campo "nome" na tabela cp_cliente)
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome')
      .eq('nome', nomeClienteClickup.trim())
      .maybeSingle();
    
    if (checkError) {
      console.error('❌ Erro ao buscar cliente:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
    
    if (!clienteExistente) {
      return res.status(404).json({
        success: false,
        error: `Cliente não encontrado com nome: ${nomeClienteClickup}`
      });
    }
    
    // Preparar dados para atualização
    const dadosUpdate = {
      updated_at: new Date().toISOString()
    };
    
    if (razao_social !== undefined && razao_social !== null) {
      dadosUpdate.razao_social = razao_social.trim() || null;
    }
    if (nome_fantasia !== undefined && nome_fantasia !== null) {
      dadosUpdate.nome_fantasia = nome_fantasia.trim() || null;
    }
    if (nome_amigavel !== undefined && nome_amigavel !== null) {
      dadosUpdate.nome_amigavel = nome_amigavel.trim() || null;
    }
    if (cpf_cnpj !== undefined && cpf_cnpj !== null) {
      dadosUpdate.cpf_cnpj = cpf_cnpj.trim() || null;
    }
    if (status !== undefined && status !== null) {
      dadosUpdate.status = status.trim() || null;
    }
    if (clienteKamino !== undefined && clienteKamino !== null) {
      dadosUpdate.nome_cli_kamino = clienteKamino.trim() || null;
    }
    if (idCliKamino !== undefined && idCliKamino !== null) {
      dadosUpdate.id_cli_kamino = idCliKamino.trim() || null;
    }
    
    // Atualizar cliente
    const { data: clienteAtualizado, error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update(dadosUpdate)
      .eq('id', clienteExistente.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Erro ao atualizar cliente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar cliente',
        details: updateError.message
      });
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('✅ Cliente atualizado com sucesso:', clienteExistente.nome);
    
    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      data: clienteAtualizado
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getClientesKamino,
  getClientesIncompletosCount,
  getCarteiraClientes,
  inativarCliente,
  ativarCliente,
  atualizarClientePorId,
  atualizarClientePorNomeClickup
};

