// =============================================================
// === CONTROLLER DE CONTATO CLIENTE ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os contatos (com paginação e busca)
async function getContatos(req, res) {
  try {
    const { page = 1, limit = 50, search = '', ativo = null } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      
      .from('cp_contato')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true });

    // Busca por nome, email ou telefone
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`nome.ilike.${ilikePattern},email.ilike.${ilikePattern},telefone.ilike.${ilikePattern}`);
    }

    // Filtro por status ativo
    if (ativo !== null && ativo !== undefined && ativo !== '') {
      const ativoBool = ativo === 'true' || ativo === true;
      query = query.eq('ativo', ativoBool);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar contatos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar contatos',
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
    console.error('Erro inesperado ao buscar contatos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar contato por ID
async function getContatoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do contato é obrigatório'
      });
    }

    const { data, error } = await supabase
      
      .from('cp_contato')
      .select(`
        *,
        cliente_contato (
          id,
          cliente_id,
          cp_cliente (
            id,
            nome,
            razao_social
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar contato:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar contato',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar contato:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar contatos de um cliente específico
async function getContatosPorCliente(req, res) {
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
      
      .from('cliente_contato')
      .select(`
        id,
        cliente_id,
        contato_id,
        created_at,
        cp_contato (
          id,
          nome,
          email,
          telefone,
          cargo,
          departamento,
          observacoes,
          ativo,
          permite_envio_documentos,
          created_at,
          updated_at
        )
      `, { count: 'exact' })
      .eq('cliente_id', cliente_id)
      .order('created_at', { ascending: false });

    // Busca por nome, email ou telefone do contato
    if (search && search.trim()) {
      // Para busca em relacionamento, precisamos fazer de forma diferente
      // Vamos buscar primeiro os contatos que correspondem e depois filtrar
      const { data: contatosEncontrados } = await supabase
        
        .from('cp_contato')
        .select('id')
        .or(`nome.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,telefone.ilike.%${search.trim()}%`);

      if (contatosEncontrados && contatosEncontrados.length > 0) {
        const contatoIds = contatosEncontrados.map(c => c.id);
        query = query.in('contato_id', contatoIds);
      } else {
        // Se não encontrou nenhum contato, retornar vazio
        return res.json({
          success: true,
          data: [],
          count: 0,
          total: 0,
          page: pageNum,
          limit: limitNum
        });
      }
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar contatos do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar contatos do cliente',
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
    console.error('Erro inesperado ao buscar contatos do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo contato
async function criarContato(req, res) {
  try {
    const { 
      nome,
      email,
      telefone,
      cargo,
      departamento,
      observacoes,
      ativo = true,
      permite_envio_documentos = false
    } = req.body;

    // Validação
    if (!nome || !nome.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nome do contato é obrigatório'
      });
    }

    // Preparar dados para inserção
    const dadosInsert = {
      nome: String(nome).trim(),
      email: email ? String(email).trim() : null,
      telefone: telefone ? String(telefone).trim() : null,
      cargo: cargo ? String(cargo).trim() : null,
      departamento: departamento ? String(departamento).trim() : null,
      observacoes: observacoes ? String(observacoes).trim() : null,
      ativo: ativo === true || ativo === 'true',
      permite_envio_documentos: permite_envio_documentos === true || permite_envio_documentos === 'true'
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      
      .from('cp_contato')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar contato:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar contato',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Contato criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao criar contato:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar contato
async function atualizarContato(req, res) {
  try {
    const { id } = req.params;
    const { 
      nome,
      email,
      telefone,
      cargo,
      departamento,
      observacoes,
      ativo,
      permite_envio_documentos
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do contato é obrigatório'
      });
    }

    // Verificar se contato existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_contato')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar contato:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar contato',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }

    // Preparar dados para atualização
    const dadosUpdate = {};

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome do contato não pode ser vazio'
        });
      }
      dadosUpdate.nome = String(nome).trim();
    }
    if (email !== undefined) {
      dadosUpdate.email = email ? String(email).trim() : null;
    }
    if (telefone !== undefined) {
      dadosUpdate.telefone = telefone ? String(telefone).trim() : null;
    }
    if (cargo !== undefined) {
      dadosUpdate.cargo = cargo ? String(cargo).trim() : null;
    }
    if (departamento !== undefined) {
      dadosUpdate.departamento = departamento ? String(departamento).trim() : null;
    }
    if (observacoes !== undefined) {
      dadosUpdate.observacoes = observacoes ? String(observacoes).trim() : null;
    }
    if (ativo !== undefined) {
      dadosUpdate.ativo = ativo === true || ativo === 'true';
    }
    if (permite_envio_documentos !== undefined) {
      dadosUpdate.permite_envio_documentos = permite_envio_documentos === true || permite_envio_documentos === 'true';
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
      
      .from('cp_contato')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar contato:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar contato',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Contato atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar contato:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar contato
async function deletarContato(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do contato é obrigatório'
      });
    }

    // Verificar se contato existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cp_contato')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar contato:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar contato',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }

    // Deletar do banco (CASCADE vai deletar automaticamente os vínculos em cliente_contato)
    const { error } = await supabase
      
      .from('cp_contato')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar contato:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar contato',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Contato deletado com sucesso',
      data: {
        id: existente.id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar contato:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Vincular contato a cliente
async function vincularContatoCliente(req, res) {
  try {
    const { cliente_id, contato_id } = req.body;

    // Validação
    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!contato_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do contato é obrigatório'
      });
    }

    // Verificar se cliente existe
    const { data: clienteExiste, error: errorCliente } = await supabase
      
      .from('cp_cliente')
      .select('id')
      .eq('id', String(cliente_id).trim())
      .maybeSingle();

    if (errorCliente) {
      console.error('Erro ao verificar cliente:', errorCliente);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar cliente',
        details: errorCliente.message
      });
    }

    if (!clienteExiste) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Verificar se contato existe
    const { data: contatoExiste, error: errorContato } = await supabase
      
      .from('cp_contato')
      .select('id')
      .eq('id', contato_id)
      .maybeSingle();

    if (errorContato) {
      console.error('Erro ao verificar contato:', errorContato);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar contato',
        details: errorContato.message
      });
    }

    if (!contatoExiste) {
      return res.status(404).json({
        success: false,
        error: 'Contato não encontrado'
      });
    }

    // Verificar se já existe vínculo
    const { data: vinculoExiste, error: errorVinculo } = await supabase
      
      .from('cliente_contato')
      .select('id')
      .eq('cliente_id', String(cliente_id).trim())
      .eq('contato_id', contato_id)
      .maybeSingle();

    if (errorVinculo) {
      console.error('Erro ao verificar vínculo:', errorVinculo);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vínculo',
        details: errorVinculo.message
      });
    }

    if (vinculoExiste) {
      return res.status(400).json({
        success: false,
        error: 'Contato já está vinculado a este cliente'
      });
    }

    // Criar vínculo
    const dadosInsert = {
      cliente_id: String(cliente_id).trim(),
      contato_id: contato_id
    };

    const { data, error: insertError } = await supabase
      
      .from('cliente_contato')
      .insert([dadosInsert])
      .select(`
        *,
        cp_contato (
          id,
          nome,
          email,
          telefone
        ),
        cp_cliente (
          id,
          nome,
          razao_social
        )
      `)
      .single();

    if (insertError) {
      console.error('❌ Erro ao vincular contato ao cliente:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao vincular contato ao cliente',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Contato vinculado ao cliente com sucesso',
      data: data
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao vincular contato ao cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Desvincular contato de cliente
async function desvincularContatoCliente(req, res) {
  try {
    const { id } = req.params; // ID do vínculo (cliente_contato.id)

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do vínculo é obrigatório'
      });
    }

    // Verificar se vínculo existe
    const { data: existente, error: errorCheck } = await supabase
      
      .from('cliente_contato')
      .select('id, cliente_id, contato_id')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar vínculo:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vínculo',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Vínculo não encontrado'
      });
    }

    // Deletar vínculo
    const { error } = await supabase
      
      .from('cliente_contato')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao desvincular contato do cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao desvincular contato do cliente',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Contato desvinculado do cliente com sucesso',
      data: {
        id: existente.id,
        cliente_id: existente.cliente_id,
        contato_id: existente.contato_id
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao desvincular contato do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getContatos,
  getContatoPorId,
  getContatosPorCliente,
  criarContato,
  atualizarContato,
  deletarContato,
  vincularContatoCliente,
  desvincularContatoCliente
};




