// =============================================================
// === CONTROLLER DE PRODUTOS ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todos os produtos (com paginação opcional)
async function getProdutos(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
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
      console.error('❌ Erro ao buscar produtos:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar produtos',
        details: error.message
      });
    }

    console.log(`✅ Produtos encontrados: ${data?.length || 0} de ${count || 0} total`);

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar produto por ID
async function getProdutoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto é obrigatório'
      });
    }

    let query = supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .select('*');

    // Verificação de tipo para evitar erro 500 (invalid input syntax for type bigint)
    // Se for puramente numérico, pode ser ID (PK) ou clickup_id
    // Se contiver letras/traços (ex: UUID), SÓ pode ser clickup_id (pois ID é bigint)
    const isNumeric = /^\d+$/.test(id);

    if (isNumeric) {
      // Se numérico, busca em ambos (prioridade para ID, mas o OR resolve)
      // Sintaxe OR do PostgREST: id.eq.valor,clickup_id.eq.valor
      query = query.or(`id.eq.${id},clickup_id.eq.${id}`).limit(1);
    } else {
      // Se não for numérico (ex: UUID), busca SOMENTE no clickup_id
      query = query.eq('clickup_id', id).maybeSingle();
    }

    const { data, error } = await query;

    // Se usou .or() com .limit(1), data é array. Se usou .maybeSingle(), data é objeto ou null.
    // Normalizar para objeto
    let produtoEncontrado = data;
    if (Array.isArray(data)) {
      produtoEncontrado = data.length > 0 ? data[0] : null;
    }

    if (error) {
      console.error('Erro ao buscar produto:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar produto',
        details: error.message
      });
    }

    if (!produtoEncontrado) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    return res.json({
      success: true,
      data: produtoEncontrado
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar produtos por múltiplos IDs
async function getProdutosPorIds(req, res) {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "ids" é obrigatório. Use: ?ids=id1,id2,id3'
      });
    }

    // Converter string de IDs separados por vírgula em array e remover duplicatas
    const produtoIds = [...new Set(
      String(ids)
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )];

    if (produtoIds.length === 0) {
      return res.json({
        success: true,
        data: {},
        count: 0
      });
    }

    // Identificar UUIDs válidos para coluna 'id' (tipo uuid)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validUuids = produtoIds.filter(id => uuidRegex.test(id));

    // Identificar IDs numéricos para coluna 'clickup_id' (tipo bigint)
    // Isso evita o erro "invalid input syntax for type bigint" ao tentar buscar UUIDs nesta coluna
    const numericRegex = /^\d+$/;
    const validNumericIds = produtoIds.filter(id => numericRegex.test(id));

    // Preparar strings formatadas para o PostgREST
    const validUuidsList = validUuids.map(id => `"${id}"`).join(',');
    const validNumericIdsList = validNumericIds.map(id => `"${id}"`).join(',');

    // Construir a query OR dinamicamente
    let orQueryParts = [];

    // 1. Busca por clickup_id (apenas se houver IDs numéricos válidos)
    if (validNumericIds.length > 0) {
      orQueryParts.push(`clickup_id.in.(${validNumericIdsList})`);
    }

    // 2. Busca por ID (apenas se houver UUIDs válidos)
    if (validUuids.length > 0) {
      orQueryParts.push(`id.in.(${validUuidsList})`);
    }

    // Se por algum motivo não tivermos partes (ex: lista vazia), retornamos vazio
    if (orQueryParts.length === 0) {
      return res.json({ success: true, data: {}, count: 0 });
    }

    // Lógica para evitar conflitos de tipo no PostgREST
    let query;
    if (validUuids.length > 0 && validNumericIds.length === 0) {
      // Apenas UUIDs -> consulta simples na coluna ID
      query = supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .in('id', validUuids);
    } else if (validNumericIds.length > 0 && validUuids.length === 0) {
      // Apenas Numéricos -> consulta simples na coluna clickup_id
      query = supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .in('clickup_id', validNumericIds);
    } else {
      // Misto -> usa o OR (PostgREST deve lidar com isso se as clauses estiverem corretas, 
      // mas se falhar, o ideal seria duas queries separadas. Vamos tentar o OR padrão primeiro com as listas limpas)
      query = supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, clickup_id, nome')
        .or(orQueryParts.join(','));
    }

    const { data: produtos, error: produtosError } = await query;

    if (produtosError) {
      console.error('Erro ao buscar produtos por IDs:', produtosError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar produtos',
        details: produtosError.message
      });
    }

    // Criar mapa de ID -> nome (mapeando tanto ID interno quanto ClickUp ID)
    const produtosMap = {};
    (produtos || []).forEach(produto => {
      // Mapear pelo ID interno
      if (produto.id) {
        produtosMap[String(produto.id)] = produto.nome || null;
      }
      // Mapear pelo ClickUp ID
      if (produto.clickup_id) {
        produtosMap[String(produto.clickup_id)] = produto.nome || null;

        // Caso especial: também mapear para a versão sem zeros à esquerda ou spaces se for numérico
        const clickupClean = String(produto.clickup_id).trim();
        if (clickupClean !== String(produto.clickup_id)) {
          produtosMap[clickupClean] = produto.nome || null;
        }
      }
    });

    res.json({
      success: true,
      data: produtosMap,
      count: Object.keys(produtosMap).length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos por IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar novo produto
async function criarProduto(req, res) {
  try {
    const { nome, clickup_id } = req.body;

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

    // Preparar dados para inserção (sem ID - banco gera automaticamente)
    // clickup_id é obrigatório, usar valor fornecido ou string vazia como padrão
    const dadosInsert = {
      nome: nomeTrimmed,
      clickup_id: clickup_id ? String(clickup_id).trim() : ''
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar produto:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar produto',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar produto: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar produto
async function atualizarProduto(req, res) {
  try {
    const { id } = req.params;
    const { nome } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto é obrigatório'
      });
    }

    // Verificar se produto existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar produto:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar produto',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
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

      // Buscar todos os produtos e fazer comparação case-insensitive
      const { data: todosProdutos, error: errorNome } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_produto')
        .select('id, nome');

      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }

      // Verificar se existe outro produto com mesmo nome (case-insensitive)
      const nomeExistente = (todosProdutos || []).find(
        produto =>
          produto.id !== id &&
          produto.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Produto com este nome já existe',
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
      .from('cp_produto')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar produto:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar produto',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Produto atualizado com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar produto
async function deletarProduto(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto é obrigatório'
      });
    }

    // Verificar se produto existe
    const { data: existente, error: errorCheck } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar produto:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar produto',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_produto')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar produto:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar produto',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Produto deletado com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getProdutos,
  getProdutoPorId,
  getProdutosPorIds,
  criarProduto,
  atualizarProduto,
  deletarProduto
};

