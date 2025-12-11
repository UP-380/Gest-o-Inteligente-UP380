// =============================================================
// === CONTROLLER DE VINCULADOS ===
// =============================================================

const supabase = require('../config/database');

// POST - Criar novo registro de vinculado
async function criarVinculado(req, res) {
  try {
    const { cp_tarefa, cp_tarefa_tipo, cp_produto, cp_cliente } = req.body;

    // Preparar dados para inserção (apenas valores não nulos)
    // Nota: A tabela vinculados ainda usa os nomes antigos das colunas
    const dadosVinculado = {};
    
    if (cp_tarefa !== undefined && cp_tarefa !== null && cp_tarefa !== '') {
      dadosVinculado.cp_atividade = parseInt(cp_tarefa, 10);
    }
    
    if (cp_tarefa_tipo !== undefined && cp_tarefa_tipo !== null && cp_tarefa_tipo !== '') {
      dadosVinculado.cp_atividade_tipo = parseInt(cp_tarefa_tipo, 10);
    }
    
    if (cp_produto !== undefined && cp_produto !== null && cp_produto !== '') {
      dadosVinculado.cp_produto = parseInt(cp_produto, 10);
    }

    // cp_cliente é TEXT, então enviar como string
    if (cp_cliente !== undefined && cp_cliente !== null && cp_cliente !== '') {
      dadosVinculado.cp_cliente = String(cp_cliente).trim();
    }

    // Verificar se pelo menos um campo foi preenchido
    if (Object.keys(dadosVinculado).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um campo (cp_atividade, cp_atividade_tipo, cp_produto ou cp_cliente) deve ser fornecido'
      });
    }

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .insert(dadosVinculado)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar vinculado:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar vinculado',
        details: error.message
      });
    }

    console.log('✅ Vinculado criado com sucesso:', data);

    return res.status(201).json({
      success: true,
      data,
      message: 'Vinculado criado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao criar vinculado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar múltiplos registros de vinculados
async function criarMultiplosVinculados(req, res) {
  try {
    const { vinculados } = req.body;

    if (!Array.isArray(vinculados) || vinculados.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'vinculados deve ser um array não vazio'
      });
    }

    // Preparar dados para inserção
    const dadosParaInserir = vinculados.map(item => {
      const dadosVinculado = {};
      
      // Nota: A tabela vinculados ainda usa os nomes antigos das colunas
      if (item.cp_tarefa !== undefined && item.cp_tarefa !== null && item.cp_tarefa !== '') {
        dadosVinculado.cp_atividade = parseInt(item.cp_tarefa, 10);
      }
      
      if (item.cp_tarefa_tipo !== undefined && item.cp_tarefa_tipo !== null && item.cp_tarefa_tipo !== '') {
        dadosVinculado.cp_atividade_tipo = parseInt(item.cp_tarefa_tipo, 10);
      }
      
      if (item.cp_produto !== undefined && item.cp_produto !== null && item.cp_produto !== '') {
        dadosVinculado.cp_produto = parseInt(item.cp_produto, 10);
      }

      // cp_cliente é TEXT, então enviar como string
      if (item.cp_cliente !== undefined && item.cp_cliente !== null && item.cp_cliente !== '') {
        dadosVinculado.cp_cliente = String(item.cp_cliente).trim();
      }

      return dadosVinculado;
    }).filter(item => Object.keys(item).length > 0); // Remover itens vazios

    if (dadosParaInserir.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado válido para inserir'
      });
    }

    // Inserir no banco
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .insert(dadosParaInserir)
      .select();

    if (error) {
      console.error('❌ Erro ao criar múltiplos vinculados:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar vinculados',
        details: error.message
      });
    }

    console.log(`✅ ${data?.length || 0} vinculado(s) criado(s) com sucesso`);

    return res.status(201).json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      message: `${data?.length || 0} vinculado(s) criado(s) com sucesso!`
    });
  } catch (error) {
    console.error('Erro inesperado ao criar múltiplos vinculados:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar todos os vinculados com nomes relacionados
async function getVinculados(req, res) {
  try {
    const { page = 1, limit = 50, filtro_produto, filtro_atividade, filtro_tipo_atividade, filtro_cliente } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Buscar vinculados
    let query = supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id, cp_atividade, cp_atividade_tipo, cp_produto, cp_cliente', { count: 'exact' })
      .order('id', { ascending: false });

    // Aplicar filtros - apenas mostrar registros que têm os campos selecionados
    const temFiltroProduto = filtro_produto === 'true' || filtro_produto === '1';
    const temFiltroAtividade = filtro_atividade === 'true' || filtro_atividade === '1';
    const temFiltroTipoAtividade = filtro_tipo_atividade === 'true' || filtro_tipo_atividade === '1';
    const temFiltroCliente = filtro_cliente === 'true' || filtro_cliente === '1';

    console.log('🔍 Filtros recebidos:', {
      filtro_produto,
      filtro_atividade,
      filtro_tipo_atividade,
      filtro_cliente,
      temFiltroProduto,
      temFiltroAtividade,
      temFiltroTipoAtividade,
      temFiltroCliente
    });

    if (temFiltroProduto) {
      query = query.not('cp_produto', 'is', null);
      console.log('✅ Filtro produto aplicado: cp_produto IS NOT NULL');
    }
    if (temFiltroAtividade) {
      query = query.not('cp_atividade', 'is', null);
      console.log('✅ Filtro atividade aplicado: cp_atividade IS NOT NULL');
    }
    if (temFiltroTipoAtividade) {
      query = query.not('cp_atividade_tipo', 'is', null);
      console.log('✅ Filtro tipo atividade aplicado: cp_atividade_tipo IS NOT NULL');
    }
    if (temFiltroCliente) {
      query = query.not('cp_cliente', 'is', null);
      console.log('✅ Filtro cliente aplicado: cp_cliente IS NOT NULL');
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data: vinculados, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar vinculados:', error);
      console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculados',
        details: error.message
      });
    }

    console.log(`📋 Vinculados encontrados após filtros: ${vinculados?.length || 0} de ${count || 0} total`);
    
    // Filtrar no código também para garantir (backup caso a query não funcione)
    let vinculadosFiltrados = vinculados || [];
    if (temFiltroProduto) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.cp_produto !== null && v.cp_produto !== undefined);
    }
    if (temFiltroAtividade) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.cp_atividade !== null && v.cp_atividade !== undefined);
    }
    if (temFiltroTipoAtividade) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.cp_atividade_tipo !== null && v.cp_atividade_tipo !== undefined);
    }
    if (temFiltroCliente) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.cp_cliente !== null && v.cp_cliente !== undefined && v.cp_cliente !== '');
    }

    if (vinculadosFiltrados.length !== (vinculados?.length || 0)) {
      console.warn(`⚠️ Filtro aplicado no código: ${vinculados?.length || 0} -> ${vinculadosFiltrados.length} registros`);
    }

    if (vinculadosFiltrados && vinculadosFiltrados.length > 0) {
      console.log('📋 Primeiro vinculado filtrado:', JSON.stringify(vinculadosFiltrados[0], null, 2));
    }

    // Buscar nomes relacionados (garantir que são números) - usar vinculadosFiltrados
    const idsAtividades = [...new Set(vinculadosFiltrados?.filter(v => v.cp_atividade).map(v => parseInt(v.cp_atividade, 10)) || [])];
    const idsProdutos = [...new Set(vinculadosFiltrados?.filter(v => v.cp_produto).map(v => parseInt(v.cp_produto, 10)) || [])];
    const idsTipoAtividades = [...new Set(vinculadosFiltrados?.filter(v => v.cp_atividade_tipo).map(v => parseInt(v.cp_atividade_tipo, 10)) || [])];
    // cp_cliente é TEXT, então manter como string
    const idsClientes = [...new Set(vinculadosFiltrados?.filter(v => v.cp_cliente && v.cp_cliente.trim() !== '').map(v => String(v.cp_cliente).trim()) || [])];

    console.log(`🔍 IDs de atividades para buscar: [${idsAtividades.join(', ')}]`);
    console.log(`🔍 IDs de produtos para buscar: [${idsProdutos.join(', ')}]`);
    console.log(`🔍 IDs de tipo de atividades para buscar: [${idsTipoAtividades.join(', ')}]`);
    console.log(`🔍 IDs de clientes para buscar: [${idsClientes.join(', ')}]`);

    // Buscar atividades
    const atividadesMap = new Map();
    if (idsAtividades.length > 0) {
      console.log(`🔍 Buscando atividades com IDs: [${idsAtividades.join(', ')}]`);
      
      // Tentar buscar cada ID individualmente se a query .in() não funcionar
      for (const atividadeId of idsAtividades) {
        const { data: atividade, error: errorAtividade } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_tarefa')
          .select('id, nome')
          .eq('id', atividadeId)
          .maybeSingle();
        
        if (errorAtividade) {
          console.error(`❌ Erro ao buscar atividade ID ${atividadeId}:`, errorAtividade);
        } else if (atividade) {
          const id = parseInt(atividade.id, 10);
          atividadesMap.set(id, atividade.nome);
          console.log(`  ✅ ID ${id}: ${atividade.nome}`);
        } else {
          console.warn(`⚠️ Atividade ID ${atividadeId} não encontrada na tabela cp_tarefa`);
        }
      }
    }

    // Buscar produtos
    const produtosMap = new Map();
    if (idsProdutos.length > 0) {
      console.log(`🔍 Buscando produtos com IDs: [${idsProdutos.join(', ')}]`);
      
      for (const produtoId of idsProdutos) {
        const { data: produto, error: errorProduto } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_produto')
          .select('id, nome')
          .eq('id', produtoId)
          .maybeSingle();
        
        if (errorProduto) {
          console.error(`❌ Erro ao buscar produto ID ${produtoId}:`, errorProduto);
        } else if (produto) {
          const id = parseInt(produto.id, 10);
          produtosMap.set(id, produto.nome);
          console.log(`  ✅ ID ${id}: ${produto.nome}`);
        } else {
          console.warn(`⚠️ Produto ID ${produtoId} não encontrado na tabela cp_produto`);
        }
      }
    }

    // Buscar tipo de atividades
    const tipoAtividadesMap = new Map();
    if (idsTipoAtividades.length > 0) {
      console.log(`🔍 Buscando tipo de atividades com IDs: [${idsTipoAtividades.join(', ')}]`);
      
      for (const tipoAtividadeId of idsTipoAtividades) {
        const { data: tipoAtividade, error: errorTipoAtividade } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_tarefa_tipo')
          .select('id, nome')
          .eq('id', tipoAtividadeId)
          .maybeSingle();
        
        if (errorTipoAtividade) {
          console.error(`❌ Erro ao buscar tipo de atividade ID ${tipoAtividadeId}:`, errorTipoAtividade);
        } else if (tipoAtividade) {
          const id = parseInt(tipoAtividade.id, 10);
          tipoAtividadesMap.set(id, tipoAtividade.nome);
          console.log(`  ✅ ID ${id}: ${tipoAtividade.nome}`);
        } else {
          console.warn(`⚠️ Tipo de atividade ID ${tipoAtividadeId} não encontrado na tabela cp_tarefa_tipo`);
        }
      }
    }

    // Buscar clientes
    // cp_cliente contém UUID (string), então buscar diretamente pelo id (UUID)
    const clientesMap = new Map();
    if (idsClientes.length > 0) {
      console.log(`🔍 Buscando clientes com IDs: [${idsClientes.join(', ')}]`);
      
      for (const clienteId of idsClientes) {
        // cp_cliente é UUID (string), buscar diretamente pelo id
        const { data: cliente, error: errorCliente } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_cliente')
          .select('id, nome, nome_amigavel, nome_fantasia, razao_social')
          .eq('id', clienteId.trim())
          .maybeSingle();
        
        if (errorCliente) {
          console.error(`❌ Erro ao buscar cliente ID ${clienteId}:`, errorCliente);
        } else if (cliente) {
          const nome = cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`;
          // Armazenar o UUID original e também o id retornado para matching
          clientesMap.set(clienteId.trim(), nome);
          clientesMap.set(String(cliente.id).trim(), nome);
          console.log(`  ✅ ID ${clienteId}: ${nome}`);
        } else {
          console.warn(`⚠️ Cliente ID ${clienteId} não encontrado na tabela cp_cliente`);
        }
      }
    }

    // Enriquecer dados com nomes (garantir comparação correta de tipos) - usar vinculadosFiltrados
    const dadosEnriquecidos = (vinculadosFiltrados || []).map(v => {
      const atividadeId = v.cp_atividade ? parseInt(v.cp_atividade, 10) : null;
      const produtoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
      const tipoAtividadeId = v.cp_atividade_tipo ? parseInt(v.cp_atividade_tipo, 10) : null;

      console.log(`🔍 Processando vinculado ID ${v.id}:`);
      console.log(`  - cp_atividade: ${v.cp_atividade} (tipo: ${typeof v.cp_atividade}) -> parseInt: ${atividadeId}`);
      console.log(`  - cp_produto: ${v.cp_produto} (tipo: ${typeof v.cp_produto}) -> parseInt: ${produtoId}`);
      console.log(`  - cp_atividade_tipo: ${v.cp_atividade_tipo} (tipo: ${typeof v.cp_atividade_tipo}) -> parseInt: ${tipoAtividadeId}`);

      const atividadeNome = atividadeId ? atividadesMap.get(atividadeId) : null;
      const produtoNome = produtoId ? produtosMap.get(produtoId) : null;
      const tipoAtividadeNome = tipoAtividadeId ? tipoAtividadesMap.get(tipoAtividadeId) : null;
      
      // Buscar nome do cliente (cp_cliente é TEXT/UUID)
      let clienteNome = null;
      if (v.cp_cliente) {
        const clienteIdStr = String(v.cp_cliente).trim();
        // Buscar pelo UUID diretamente
        clienteNome = clientesMap.get(clienteIdStr) || null;
      }

      console.log(`  - atividade_nome: ${atividadeNome || 'null'}`);
      console.log(`  - produto_nome: ${produtoNome || 'null'}`);
      console.log(`  - tipo_atividade_nome: ${tipoAtividadeNome || 'null'}`);
      console.log(`  - cliente_nome: ${clienteNome || 'null'}`);

      // Debug para cada vinculado
      if (atividadeId && !atividadeNome) {
        console.warn(`⚠️ Nome não encontrado para atividade ID: ${atividadeId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(atividadesMap.keys()).join(', ')}]`);
      }
      if (produtoId && !produtoNome) {
        console.warn(`⚠️ Nome não encontrado para produto ID: ${produtoId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(produtosMap.keys()).join(', ')}]`);
      }
      if (tipoAtividadeId && !tipoAtividadeNome) {
        console.warn(`⚠️ Nome não encontrado para tipo de atividade ID: ${tipoAtividadeId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(tipoAtividadesMap.keys()).join(', ')}]`);
      }

      return {
        ...v,
        atividade_nome: atividadeNome,
        produto_nome: produtoNome,
        tipo_atividade_nome: tipoAtividadeNome,
        cliente_nome: clienteNome
      };
    });

    console.log(`✅ Dados enriquecidos: ${dadosEnriquecidos.length} registros`);

    // Ajustar o total se filtros foram aplicados no código
    const totalAjustado = temFiltroProduto || temFiltroAtividade || temFiltroTipoAtividade || temFiltroCliente
      ? dadosEnriquecidos.length 
      : count || 0;

    return res.json({
      success: true,
      data: dadosEnriquecidos,
      count: dadosEnriquecidos.length,
      total: totalAjustado,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar vinculados:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar vinculado por ID
async function getVinculadoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do vinculado é obrigatório'
      });
    }

    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar vinculado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculado',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Vinculado não encontrado'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar vinculado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar vinculado
async function atualizarVinculado(req, res) {
  try {
    const { id } = req.params;
    const { cp_tarefa, cp_tarefa_tipo, cp_produto, cp_cliente } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do vinculado é obrigatório'
      });
    }

    // Preparar dados para atualização (apenas valores não nulos)
    const dadosVinculado = {};
    
    // Nota: A tabela vinculados ainda usa os nomes antigos das colunas
    if (cp_tarefa !== undefined) {
      dadosVinculado.cp_atividade = cp_tarefa !== null && cp_tarefa !== '' ? parseInt(cp_tarefa, 10) : null;
    }
    
    if (cp_tarefa_tipo !== undefined) {
      dadosVinculado.cp_atividade_tipo = cp_tarefa_tipo !== null && cp_tarefa_tipo !== '' ? parseInt(cp_tarefa_tipo, 10) : null;
    }
    
    if (cp_produto !== undefined) {
      dadosVinculado.cp_produto = cp_produto !== null && cp_produto !== '' ? parseInt(cp_produto, 10) : null;
    }

    // cp_cliente é TEXT, então enviar como string
    if (cp_cliente !== undefined) {
      dadosVinculado.cp_cliente = cp_cliente !== null && cp_cliente !== '' ? String(cp_cliente).trim() : null;
    }

    // Verificar se pelo menos um campo foi preenchido
    if (Object.keys(dadosVinculado).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um campo deve ser fornecido para atualização'
      });
    }

    // Verificar se o vinculado existe
    const { data: existingData, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar vinculado:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vinculado',
        details: checkError.message
      });
    }

    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: 'Vinculado não encontrado'
      });
    }

    // Atualizar
    const { data, error } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .update(dadosVinculado)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar vinculado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar vinculado',
        details: error.message
      });
    }

    console.log('✅ Vinculado atualizado com sucesso:', data);

    return res.json({
      success: true,
      data,
      message: 'Vinculado atualizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar vinculado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar vinculado
async function deletarVinculado(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do vinculado é obrigatório'
      });
    }

    // Converter ID para número se for string
    const idNum = typeof id === 'string' ? parseInt(id, 10) : id;
    
    console.log(`🗑️ Tentando deletar vinculado ID: ${id} (tipo: ${typeof id}, convertido: ${idNum})`);

    // Verificar se o vinculado existe
    const { data: existingData, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id')
      .eq('id', idNum)
      .maybeSingle();

    if (checkError) {
      console.error('Erro ao verificar vinculado:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar vinculado',
        details: checkError.message
      });
    }

    if (!existingData) {
      console.log(`⚠️ Vinculado ID ${idNum} não encontrado`);
      return res.status(404).json({
        success: false,
        error: 'Vinculado não encontrado'
      });
    }

    console.log(`✅ Vinculado ID ${idNum} encontrado, deletando...`);

    // Deletar
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .delete()
      .eq('id', idNum);

    if (error) {
      console.error('❌ Erro ao deletar vinculado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar vinculado',
        details: error.message
      });
    }

    console.log('✅ Vinculado deletado com sucesso');

    return res.json({
      success: true,
      message: 'Vinculado deletado com sucesso!'
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar vinculado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tarefas vinculadas a produtos
async function getTarefasPorProdutos(req, res) {
  try {
    const { produtoIds } = req.query;
    
    if (!produtoIds) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "produtoIds" é obrigatório. Use: ?produtoIds=id1,id2,id3'
      });
    }

    // Converter string de IDs separados por vírgula em array
    const idsArray = [...new Set(
      String(produtoIds)
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id) && id > 0)
    )];

    if (idsArray.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar vinculados que têm esses produtos e têm tarefa vinculada
    const { data: vinculados, error: vinculadosError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('cp_atividade, cp_produto')
      .in('cp_produto', idsArray)
      .not('cp_atividade', 'is', null);

    if (vinculadosError) {
      console.error('❌ Erro ao buscar vinculados:', vinculadosError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculados',
        details: vinculadosError.message
      });
    }

    // Extrair IDs únicos de tarefas
    const tarefaIds = [...new Set(
      (vinculados || [])
        .map(v => v.cp_atividade)
        .filter(id => id !== null && id !== undefined)
    )];

    if (tarefaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar tarefas na tabela cp_tarefa (igual ao getVinculados)
    const tarefasMap = new Map();
    if (tarefaIds.length > 0) {
      console.log(`🔍 Buscando tarefas com IDs: [${tarefaIds.join(', ')}]`);flie
      
      // Buscar cada tarefa individualmente (igual ao getVinculados)
      for (const tarefaId of tarefaIds) {
        const { data: tarefa, error: errorTarefa } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_tarefa')
          .select('id, nome')
          .eq('id', tarefaId)
          .maybeSingle();
        
        if (errorTarefa) {
          console.error(`❌ Erro ao buscar tarefa ID ${tarefaId}:`, errorTarefa);
        } else if (tarefa) {
          const id = parseInt(tarefa.id, 10);
          tarefasMap.set(id, tarefa.nome || null);
          console.log(`  ✅ ID ${id}: ${tarefa.nome}`);
        } else {
          console.warn(`⚠️ Tarefa ID ${tarefaId} não encontrada na tabela cp_tarefa`);
        }
      }
    }

    // Criar mapa de produto -> tarefas vinculadas
    const produtoTarefasMap = {};
    
    idsArray.forEach(produtoId => {
      produtoTarefasMap[produtoId] = [];
    });

    vinculados.forEach(vinculado => {
      const produtoId = vinculado.cp_produto;
      const tarefaId = vinculado.cp_atividade;
      
      if (produtoTarefasMap[produtoId] && !produtoTarefasMap[produtoId].includes(tarefaId)) {
        produtoTarefasMap[produtoId].push(tarefaId);
      }
    });

    // Formatar resultado: array de objetos { produtoId, produtoNome, tarefas: [...] }
    const resultado = idsArray.map(produtoId => {
      const tarefaIdsDoProduto = produtoTarefasMap[produtoId] || [];
      const tarefasDoProduto = tarefaIdsDoProduto
        .map(tarefaId => {
          const nome = tarefasMap.get(tarefaId);
          return nome ? { id: tarefaId, nome } : null;
        })
        .filter(Boolean);

      return {
        produtoId,
        tarefas: tarefasDoProduto
      };
    });

    res.json({
      success: true,
      data: resultado,
      count: resultado.length
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar tarefas por produtos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  criarVinculado,
  criarMultiplosVinculados,
  getVinculados,
  getVinculadoPorId,
  atualizarVinculado,
  deletarVinculado,
  getTarefasPorProdutos
};

