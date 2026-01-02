// =============================================================
// === CONTROLLER DE VINCULADOS ===
// =============================================================

const supabase = require('../config/database');

// Função auxiliar para verificar duplicatas
async function verificarDuplicata(dadosVinculado) {
  try {
    // Construir query para verificar duplicata
    // Usar uma abordagem que funcione com NULLs
    let query = supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('id');

    // Para cada campo, adicionar condição apropriada (AND)
    // Mapear nomes do frontend para nomes do banco: cp_tarefa → tarefa_id, etc
    const tarefaId = dadosVinculado.cp_tarefa !== undefined ? dadosVinculado.cp_tarefa : dadosVinculado.tarefa_id;
    const tarefaTipoId = dadosVinculado.cp_tarefa_tipo !== undefined ? dadosVinculado.cp_tarefa_tipo : dadosVinculado.tarefa_tipo_id;
    const produtoId = dadosVinculado.cp_produto !== undefined ? dadosVinculado.cp_produto : dadosVinculado.produto_id;
    const clienteId = dadosVinculado.cp_cliente !== undefined ? dadosVinculado.cp_cliente : dadosVinculado.cliente_id;

    if (tarefaId !== undefined && tarefaId !== null) {
      query = query.eq('tarefa_id', tarefaId);
    } else {
      query = query.is('tarefa_id', null);
    }

    if (tarefaTipoId !== undefined && tarefaTipoId !== null) {
      query = query.eq('tarefa_tipo_id', tarefaTipoId);
    } else {
      query = query.is('tarefa_tipo_id', null);
    }

    if (produtoId !== undefined && produtoId !== null) {
      query = query.eq('produto_id', produtoId);
    } else {
      query = query.is('produto_id', null);
    }

    if (clienteId !== undefined && clienteId !== null && clienteId !== '') {
      query = query.eq('cliente_id', clienteId);
    } else {
      query = query.is('cliente_id', null);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('Erro ao verificar duplicata:', error);
      // Em caso de erro na query, tentar uma abordagem alternativa
      // Buscar todos e comparar em memória (menos eficiente, mas funciona)
      const { data: todos, error: errorTodos } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('tarefa_id, tarefa_tipo_id, produto_id, cliente_id');

      if (errorTodos) {
        console.error('Erro ao buscar todos para verificação:', errorTodos);
        return false; // Em caso de erro, permitir inserção (será tratado pelo índice único)
      }

      // Comparar em memória
      const tarefaId = dadosVinculado.cp_tarefa !== undefined ? dadosVinculado.cp_tarefa : dadosVinculado.tarefa_id;
      const tarefaTipoId = dadosVinculado.cp_tarefa_tipo !== undefined ? dadosVinculado.cp_tarefa_tipo : dadosVinculado.tarefa_tipo_id;
      const produtoId = dadosVinculado.cp_produto !== undefined ? dadosVinculado.cp_produto : dadosVinculado.produto_id;
      const clienteId = dadosVinculado.cp_cliente !== undefined ? dadosVinculado.cp_cliente : dadosVinculado.cliente_id;

      return todos.some(v => {
        const tarefaMatch = (v.tarefa_id === tarefaId) ||
                               (v.tarefa_id === null && (tarefaId === undefined || tarefaId === null));
        const tarefaTipoMatch = (v.tarefa_tipo_id === tarefaTipoId) ||
                                   (v.tarefa_tipo_id === null && (tarefaTipoId === undefined || tarefaTipoId === null));
        const produtoMatch = (v.produto_id === produtoId) ||
                            (v.produto_id === null && (produtoId === undefined || produtoId === null));
        const clienteMatch = (v.cliente_id === clienteId) ||
                            ((v.cliente_id === null || v.cliente_id === '') && (clienteId === undefined || clienteId === null || clienteId === ''));

        return tarefaMatch && tarefaTipoMatch && produtoMatch && clienteMatch;
      });
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Erro ao verificar duplicata:', error);
    return false; // Em caso de erro, permitir inserção (será tratado pelo índice único)
  }
}

// POST - Criar novo registro de vinculado
async function criarVinculado(req, res) {
  try {
    const { cp_tarefa, cp_tarefa_tipo, cp_produto, cp_cliente } = req.body;

    // Preparar dados para inserção (apenas valores não nulos)
    // Mapear nomes do frontend para nomes do banco
    const dadosVinculado = {};
    
    if (cp_tarefa !== undefined && cp_tarefa !== null && cp_tarefa !== '') {
      dadosVinculado.tarefa_id = parseInt(cp_tarefa, 10);
    }
    
    if (cp_tarefa_tipo !== undefined && cp_tarefa_tipo !== null && cp_tarefa_tipo !== '') {
      dadosVinculado.tarefa_tipo_id = parseInt(cp_tarefa_tipo, 10);
    }
    
    if (cp_produto !== undefined && cp_produto !== null && cp_produto !== '') {
      dadosVinculado.produto_id = parseInt(cp_produto, 10);
    }

    // cliente_id é TEXT, então enviar como string
    if (cp_cliente !== undefined && cp_cliente !== null && cp_cliente !== '') {
      dadosVinculado.cliente_id = String(cp_cliente).trim();
    }

    // Verificar se pelo menos um campo foi preenchido
    if (Object.keys(dadosVinculado).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos um campo (cp_tarefa, cp_tarefa_tipo, cp_produto ou cp_cliente) deve ser fornecido'
      });
    }

    // Verificar duplicata antes de inserir
    const existeDuplicata = await verificarDuplicata(dadosVinculado);
    if (existeDuplicata) {
      return res.status(409).json({
        success: false,
        error: 'Esta vinculação já existe. Duplicatas não são permitidas.'
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
      
      // Verificar se é erro de duplicata (código 23505 = unique_violation)
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(409).json({
          success: false,
          error: 'Esta vinculação já existe. Duplicatas não são permitidas.',
          details: error.message
        });
      }
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
      
      // Mapear nomes do frontend para nomes do banco
      if (item.cp_tarefa !== undefined && item.cp_tarefa !== null && item.cp_tarefa !== '') {
        dadosVinculado.tarefa_id = parseInt(item.cp_tarefa, 10);
      }
      
      if (item.cp_tarefa_tipo !== undefined && item.cp_tarefa_tipo !== null && item.cp_tarefa_tipo !== '') {
        dadosVinculado.tarefa_tipo_id = parseInt(item.cp_tarefa_tipo, 10);
      }
      
      if (item.cp_produto !== undefined && item.cp_produto !== null && item.cp_produto !== '') {
        dadosVinculado.produto_id = parseInt(item.cp_produto, 10);
      }

      // cliente_id é TEXT, então enviar como string
      if (item.cp_cliente !== undefined && item.cp_cliente !== null && item.cp_cliente !== '') {
        dadosVinculado.cliente_id = String(item.cp_cliente).trim();
      }

      return dadosVinculado;
    }).filter(item => Object.keys(item).length > 0); // Remover itens vazios

    if (dadosParaInserir.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado válido para inserir'
      });
    }

    // Verificar duplicatas antes de inserir (em lote)
    const duplicatas = [];
    for (let i = 0; i < dadosParaInserir.length; i++) {
      const existeDuplicata = await verificarDuplicata(dadosParaInserir[i]);
      if (existeDuplicata) {
        duplicatas.push(i);
      }
    }

    if (duplicatas.length > 0) {
      return res.status(409).json({
        success: false,
        error: `${duplicatas.length} vinculação(ões) já existem e não podem ser duplicadas.`,
        duplicatas: duplicatas,
        total: dadosParaInserir.length
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
      
      // Verificar se é erro de duplicata
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return res.status(409).json({
          success: false,
          error: 'Uma ou mais vinculações já existem. Duplicatas não são permitidas.',
          details: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar vinculados',
        details: error.message
      });
    }

    console.log(`✅ ${data?.length || 0} vinculado(s) criado(s) com sucesso`);

    // Após criar vinculados, verificar se há novas tarefas vinculadas a produtos (sem cliente)
    // Se houver, vincular essas tarefas aos clientes que já estão vinculados ao produto
    await aplicarHerancaParaNovasTarefas(data || []);
    
    // Aplicar herança quando vincular tarefa ao tipo de tarefa
    await aplicarHerancaTipoTarefa(data || []);
    
    // Aplicar herança quando vincular tarefa ao produto (vincular tipo de tarefa ao produto)
    await aplicarHerancaTipoTarefaParaProduto(data || []);

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

// Função auxiliar para aplicar herança quando tarefa é vinculada ao produto
// Se a tarefa tem tipo de tarefa, vincular o tipo de tarefa ao produto também
async function aplicarHerancaTipoTarefaParaProduto(vinculadosCriados) {
  try {
    // Identificar vinculações tarefa-produto criadas (sem cliente)
    const tarefasProduto = vinculadosCriados.filter(v => 
      v.tarefa_id && v.produto_id && !v.cliente_id
    );

    if (tarefasProduto.length === 0) {
      return; // Nenhuma vinculação tarefa-produto criada
    }

    console.log(`🔄 Aplicando herança de tipo de tarefa para produto: ${tarefasProduto.length} vinculação(ões)`);

    // Para cada tarefa-produto, verificar se a tarefa tem tipo de tarefa vinculado
    for (const vinculado of tarefasProduto) {
      // Buscar se existe vinculado com essa tarefa e tipo de tarefa (pode ser com ou sem produto/cliente)
      const { data: tarefaComTipo, error: buscarError } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('tarefa_tipo_id')
        .eq('tarefa_id', vinculado.tarefa_id)
        .not('tarefa_tipo_id', 'is', null)
        .limit(1);

      if (buscarError) {
        console.error(`❌ Erro ao buscar tipo de tarefa para tarefa ${vinculado.tarefa_id}:`, buscarError);
        continue;
      }

      if (!tarefaComTipo || tarefaComTipo.length === 0) {
        continue; // Tarefa não tem tipo de tarefa vinculado
      }

      const tarefaTipoId = tarefaComTipo[0].tarefa_tipo_id;

      // Atualizar o vinculado tarefa-produto para incluir o tipo de tarefa
      if (!vinculado.tarefa_tipo_id || vinculado.tarefa_tipo_id !== tarefaTipoId) {
        const { error: updateError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .update({ tarefa_tipo_id: tarefaTipoId })
          .eq('id', vinculado.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar vinculado ${vinculado.id} com tipo de tarefa:`, updateError);
        } else {
          console.log(`✅ Vinculado ${vinculado.id} atualizado: Tarefa ${vinculado.tarefa_id} → Produto ${vinculado.produto_id} → Tipo ${tarefaTipoId}`);
        }
      }

      // Verificar se já existe vinculado produto-tipo de tarefa (sem tarefa e sem cliente)
      const { data: existente, error: checkError } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('id')
        .eq('produto_id', vinculado.produto_id)
        .eq('tarefa_tipo_id', tarefaTipoId)
        .is('tarefa_id', null)
        .is('cliente_id', null)
        .limit(1);

      if (checkError) {
        console.error(`❌ Erro ao verificar existência:`, checkError);
        continue;
      }

      if (!existente || existente.length === 0) {
        // Criar vinculado produto-tipo de tarefa
        const novoVinculado = {
          produto_id: vinculado.produto_id,
          tarefa_tipo_id: tarefaTipoId,
          tarefa_id: null,
          cliente_id: null
        };

        const existeDuplicata = await verificarDuplicata(novoVinculado);
        if (!existeDuplicata) {
          const { error: insertError } = await supabase
            .schema('up_gestaointeligente')
            .from('vinculados')
            .insert([novoVinculado]);

          if (insertError) {
            console.error(`❌ Erro ao criar vinculado produto-tipo de tarefa:`, insertError);
          } else {
            console.log(`✅ Vinculado criado: Produto ${vinculado.produto_id} → Tipo de Tarefa ${tarefaTipoId}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao aplicar herança de tipo de tarefa para produto:', error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

// Função auxiliar para aplicar herança quando tarefa é vinculada ao tipo de tarefa
async function aplicarHerancaTipoTarefa(vinculadosCriados) {
  try {
    // Identificar vinculações tarefa-tipo de tarefa criadas
    const tarefasComTipo = vinculadosCriados.filter(v => 
      v.tarefa_id && v.tarefa_tipo_id
    );

    if (tarefasComTipo.length === 0) {
      return; // Nenhuma vinculação tarefa-tipo criada
    }

    console.log(`🔄 Aplicando herança de tipo de tarefa para ${tarefasComTipo.length} vinculação(ões)`);

    // Agrupar por tarefa e tipo de tarefa
    const tarefasPorTipo = {};
    tarefasComTipo.forEach(v => {
      const key = `${v.tarefa_id}_${v.tarefa_tipo_id}`;
      if (!tarefasPorTipo[key]) {
        tarefasPorTipo[key] = {
          tarefa_id: v.tarefa_id,
          tarefa_tipo_id: v.tarefa_tipo_id
        };
      }
    });

    // Para cada combinação tarefa-tipo, buscar todas as combinações onde essa tarefa aparece
    // (com produtos/clientes) mas sem tarefa_tipo_id, e criar novos vinculados com o tipo
    for (const key of Object.keys(tarefasPorTipo)) {
      const { tarefa_id, tarefa_tipo_id } = tarefasPorTipo[key];
      
      // Buscar vinculados com essa tarefa mas sem tipo de tarefa
      const { data: vinculadosSemTipo, error: buscarError } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('produto_id, cliente_id, tarefa_id')
        .eq('tarefa_id', tarefa_id)
        .is('tarefa_tipo_id', null);

      if (buscarError) {
        console.error(`❌ Erro ao buscar vinculados sem tipo para tarefa ${tarefa_id}:`, buscarError);
        continue;
      }

      if (!vinculadosSemTipo || vinculadosSemTipo.length === 0) {
        continue;
      }

      // Criar novos vinculados com o tipo de tarefa
      const novosVinculados = vinculadosSemTipo.map(v => ({
        tarefa_id: v.tarefa_id,
        tarefa_tipo_id: tarefa_tipo_id,
        produto_id: v.produto_id,
        cliente_id: v.cliente_id
      }));

      // Verificar duplicatas antes de inserir
      const vinculadosParaInserir = [];
      for (const novoVinculado of novosVinculados) {
        const existeDuplicata = await verificarDuplicata(novoVinculado);
        if (!existeDuplicata) {
          vinculadosParaInserir.push(novoVinculado);
        }
      }

      if (vinculadosParaInserir.length > 0) {
        console.log(`📝 Criando ${vinculadosParaInserir.length} vinculação(ões) com tipo de tarefa ${tarefa_tipo_id} para tarefa ${tarefa_id}`);
        
        const { error: insertError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .insert(vinculadosParaInserir);

        if (insertError) {
          console.error(`❌ Erro ao criar vinculados com tipo de tarefa:`, insertError);
        } else {
          console.log(`✅ ${vinculadosParaInserir.length} vinculação(ões) criada(s) com sucesso`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao aplicar herança de tipo de tarefa:', error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

// Função auxiliar para aplicar herança quando novas tarefas são vinculadas a produtos
async function aplicarHerancaParaNovasTarefas(vinculadosCriados) {
  try {
    // Identificar vinculações produto-tarefa sem cliente (tarefas padrão adicionadas)
    const novasTarefasProduto = vinculadosCriados.filter(v => 
      v.produto_id && v.tarefa_id && !v.cliente_id
    );

    if (novasTarefasProduto.length === 0) {
      return; // Nenhuma nova tarefa padrão adicionada
    }

    console.log(`🔄 Aplicando herança para ${novasTarefasProduto.length} nova(s) tarefa(s) padrão`);

    // Agrupar por produto para processar de forma eficiente
    const tarefasPorProduto = {};
    novasTarefasProduto.forEach(v => {
      if (!tarefasPorProduto[v.produto_id]) {
        tarefasPorProduto[v.produto_id] = [];
      }
      tarefasPorProduto[v.produto_id].push(v.tarefa_id);
    });

    // Para cada produto, buscar clientes vinculados e vincular as novas tarefas
    for (const [produtoId, tarefaIds] of Object.entries(tarefasPorProduto)) {
      // Buscar clientes vinculados a este produto
      const { data: clientesVinculados, error: clientesError } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('cliente_id')
        .eq('produto_id', parseInt(produtoId, 10))
        .not('cliente_id', 'is', null);

      if (clientesError) {
        console.error(`❌ Erro ao buscar clientes vinculados ao produto ${produtoId}:`, clientesError);
        continue;
      }

      if (!clientesVinculados || clientesVinculados.length === 0) {
        console.log(`ℹ️ Nenhum cliente vinculado ao produto ${produtoId}`);
        continue;
      }

      // Extrair IDs únicos de clientes
      const clienteIds = [...new Set(
        clientesVinculados
          .map(v => v.cliente_id)
          .filter(id => id !== null && id !== '')
      )];

      console.log(`📋 Produto ${produtoId}: ${clienteIds.length} cliente(s) vinculado(s), ${tarefaIds.length} nova(s) tarefa(s)`);

      // Para cada cliente, vincular as novas tarefas
      for (const clienteId of clienteIds) {
        const novosVinculados = tarefaIds.map(tarefaId => ({
          produto_id: parseInt(produtoId, 10),
          tarefa_id: tarefaId,
          cliente_id: String(clienteId).trim(),
          tarefa_tipo_id: null
        }));

        // Verificar duplicatas antes de inserir
        const vinculadosParaInserir = [];
        for (const novoVinculado of novosVinculados) {
          const existeDuplicata = await verificarDuplicata(novoVinculado);
          if (!existeDuplicata) {
            vinculadosParaInserir.push(novoVinculado);
          }
        }

        if (vinculadosParaInserir.length > 0) {
          const { error: insertError } = await supabase
            .schema('up_gestaointeligente')
            .from('vinculados')
            .insert(vinculadosParaInserir);

          if (insertError) {
            console.error(`❌ Erro ao vincular tarefas ao cliente ${clienteId}:`, insertError);
          } else {
            console.log(`✅ ${vinculadosParaInserir.length} tarefa(s) vinculada(s) ao cliente ${clienteId}`);
            
            // Aplicar herança de tipo de tarefa para os novos vinculados criados
            await aplicarHerancaTipoTarefa(vinculadosParaInserir);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao aplicar herança para novas tarefas:', error);
    // Não lançar erro para não interromper o fluxo principal
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
      .select('id, tarefa_id, tarefa_tipo_id, produto_id, cliente_id', { count: 'exact' })
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
      query = query.not('produto_id', 'is', null);
      console.log('✅ Filtro produto aplicado: produto_id IS NOT NULL');
    }
    if (temFiltroAtividade) {
      query = query.not('tarefa_id', 'is', null);
      console.log('✅ Filtro atividade aplicado: tarefa_id IS NOT NULL');
    }
    if (temFiltroTipoAtividade) {
      query = query.not('tarefa_tipo_id', 'is', null);
      console.log('✅ Filtro tipo atividade aplicado: tarefa_tipo_id IS NOT NULL');
    }
    if (temFiltroCliente) {
      query = query.not('cliente_id', 'is', null);
      console.log('✅ Filtro cliente aplicado: cliente_id IS NOT NULL');
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
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.produto_id !== null && v.produto_id !== undefined);
    }
    if (temFiltroAtividade) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.tarefa_id !== null && v.tarefa_id !== undefined);
    }
    if (temFiltroTipoAtividade) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.tarefa_tipo_id !== null && v.tarefa_tipo_id !== undefined);
    }
    if (temFiltroCliente) {
      vinculadosFiltrados = vinculadosFiltrados.filter(v => v.cliente_id !== null && v.cliente_id !== undefined && v.cliente_id !== '');
    }

    if (vinculadosFiltrados.length !== (vinculados?.length || 0)) {
      console.warn(`⚠️ Filtro aplicado no código: ${vinculados?.length || 0} -> ${vinculadosFiltrados.length} registros`);
    }

    if (vinculadosFiltrados && vinculadosFiltrados.length > 0) {
      console.log('📋 Primeiro vinculado filtrado:', JSON.stringify(vinculadosFiltrados[0], null, 2));
    }

    // Buscar nomes relacionados (garantir que são números) - usar vinculadosFiltrados
    const idsTarefas = [...new Set(vinculadosFiltrados?.filter(v => v.tarefa_id).map(v => parseInt(v.tarefa_id, 10)) || [])];
    const idsProdutos = [...new Set(vinculadosFiltrados?.filter(v => v.produto_id).map(v => parseInt(v.produto_id, 10)) || [])];
    const idsTipoTarefas = [...new Set(vinculadosFiltrados?.filter(v => v.tarefa_tipo_id).map(v => parseInt(v.tarefa_tipo_id, 10)) || [])];
    // cliente_id é TEXT, então manter como string
    const idsClientes = [...new Set(vinculadosFiltrados?.filter(v => v.cliente_id && v.cliente_id.trim() !== '').map(v => String(v.cliente_id).trim()) || [])];

    console.log(`🔍 IDs de tarefas para buscar: [${idsTarefas.join(', ')}]`);
    console.log(`🔍 IDs de produtos para buscar: [${idsProdutos.join(', ')}]`);
    console.log(`🔍 IDs de tipo de tarefas para buscar: [${idsTipoTarefas.join(', ')}]`);
    console.log(`🔍 IDs de clientes para buscar: [${idsClientes.join(', ')}]`);

    // Buscar tarefas
    const tarefasMap = new Map();
    if (idsTarefas.length > 0) {
      console.log(`🔍 Buscando tarefas com IDs: [${idsTarefas.join(', ')}]`);
      
      // Tentar buscar cada ID individualmente se a query .in() não funcionar
      for (const tarefaId of idsTarefas) {
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
          tarefasMap.set(id, tarefa.nome);
          console.log(`  ✅ ID ${id}: ${tarefa.nome}`);
        } else {
          console.warn(`⚠️ Tarefa ID ${tarefaId} não encontrada na tabela cp_tarefa`);
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

    // Buscar tipo de tarefas
    const tipoTarefasMap = new Map();
    if (idsTipoTarefas.length > 0) {
      console.log(`🔍 Buscando tipo de tarefas com IDs: [${idsTipoTarefas.join(', ')}]`);
      
      for (const tipoTarefaId of idsTipoTarefas) {
        const { data: tipoTarefa, error: errorTipoTarefa } = await supabase
          .schema('up_gestaointeligente')
          .from('cp_tarefa_tipo')
          .select('id, nome')
          .eq('id', tipoTarefaId)
          .maybeSingle();
        
        if (errorTipoTarefa) {
          console.error(`❌ Erro ao buscar tipo de tarefa ID ${tipoTarefaId}:`, errorTipoTarefa);
        } else if (tipoTarefa) {
          const id = parseInt(tipoTarefa.id, 10);
          tipoTarefasMap.set(id, tipoTarefa.nome);
          console.log(`  ✅ ID ${id}: ${tipoTarefa.nome}`);
        } else {
          console.warn(`⚠️ Tipo de tarefa ID ${tipoTarefaId} não encontrado na tabela cp_tarefa_tipo`);
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
      const tarefaId = v.tarefa_id ? parseInt(v.tarefa_id, 10) : null;
      const produtoId = v.produto_id ? parseInt(v.produto_id, 10) : null;
      const tipoTarefaId = v.tarefa_tipo_id ? parseInt(v.tarefa_tipo_id, 10) : null;

      console.log(`🔍 Processando vinculado ID ${v.id}:`);
      console.log(`  - tarefa_id: ${v.tarefa_id} (tipo: ${typeof v.tarefa_id}) -> parseInt: ${tarefaId}`);
      console.log(`  - produto_id: ${v.produto_id} (tipo: ${typeof v.produto_id}) -> parseInt: ${produtoId}`);
      console.log(`  - tarefa_tipo_id: ${v.tarefa_tipo_id} (tipo: ${typeof v.tarefa_tipo_id}) -> parseInt: ${tipoTarefaId}`);

      const tarefaNome = tarefaId ? tarefasMap.get(tarefaId) : null;
      const produtoNome = produtoId ? produtosMap.get(produtoId) : null;
      const tipoTarefaNome = tipoTarefaId ? tipoTarefasMap.get(tipoTarefaId) : null;
      
      // Buscar nome do cliente (cliente_id é TEXT/UUID)
      let clienteNome = null;
      if (v.cliente_id) {
        const clienteIdStr = String(v.cliente_id).trim();
        // Buscar pelo UUID diretamente
        clienteNome = clientesMap.get(clienteIdStr) || null;
      }

      console.log(`  - tarefa_nome: ${tarefaNome || 'null'}`);
      console.log(`  - produto_nome: ${produtoNome || 'null'}`);
      console.log(`  - tipo_tarefa_nome: ${tipoTarefaNome || 'null'}`);
      console.log(`  - cliente_nome: ${clienteNome || 'null'}`);

      // Debug para cada vinculado
      if (tarefaId && !tarefaNome) {
        console.warn(`⚠️ Nome não encontrado para tarefa ID: ${tarefaId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(tarefasMap.keys()).join(', ')}]`);
      }
      if (produtoId && !produtoNome) {
        console.warn(`⚠️ Nome não encontrado para produto ID: ${produtoId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(produtosMap.keys()).join(', ')}]`);
      }
      if (tipoTarefaId && !tipoTarefaNome) {
        console.warn(`⚠️ Nome não encontrado para tipo de tarefa ID: ${tipoTarefaId}`);
        console.warn(`⚠️ Chaves disponíveis no Map: [${Array.from(tipoTarefasMap.keys()).join(', ')}]`);
      }

      return {
        ...v,
        // Manter compatibilidade: adicionar nomes antigos para o frontend
        cp_tarefa: v.tarefa_id,
        cp_tarefa_tipo: v.tarefa_tipo_id,
        cp_produto: v.produto_id,
        cp_cliente: v.cliente_id,
        atividade_nome: tarefaNome, // Manter compatibilidade com frontend
        tarefa_nome: tarefaNome,
        produto_nome: produtoNome,
        tipo_atividade_nome: tipoTarefaNome, // Manter compatibilidade com frontend
        tipo_tarefa_nome: tipoTarefaNome,
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
    // Mapear nomes do frontend para nomes do banco
    const dadosVinculado = {};
    
    if (cp_tarefa !== undefined) {
      dadosVinculado.tarefa_id = cp_tarefa !== null && cp_tarefa !== '' ? parseInt(cp_tarefa, 10) : null;
    }
    
    if (cp_tarefa_tipo !== undefined) {
      dadosVinculado.tarefa_tipo_id = cp_tarefa_tipo !== null && cp_tarefa_tipo !== '' ? parseInt(cp_tarefa_tipo, 10) : null;
    }
    
    if (cp_produto !== undefined) {
      dadosVinculado.produto_id = cp_produto !== null && cp_produto !== '' ? parseInt(cp_produto, 10) : null;
    }

    // cliente_id é TEXT, então enviar como string
    if (cp_cliente !== undefined) {
      dadosVinculado.cliente_id = cp_cliente !== null && cp_cliente !== '' ? String(cp_cliente).trim() : null;
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
    // IMPORTANTE: Buscar apenas tarefas vinculadas ao produto sem cliente específico (cp_cliente = null)
    const { data: vinculados, error: vinculadosError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_id, produto_id')
      .in('produto_id', idsArray)
      .is('cliente_id', null)
      .not('tarefa_id', 'is', null);

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
        .map(v => v.tarefa_id)
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
      console.log(`🔍 Buscando tarefas com IDs: [${tarefaIds.join(', ')}]`);
      
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
      const produtoId = vinculado.produto_id;
      const tarefaId = vinculado.tarefa_id;
      
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

// GET - Buscar tarefas vinculadas a um cliente
async function getTarefasPorCliente(req, res) {
  try {
    const { clienteId } = req.query;
    
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "clienteId" é obrigatório. Use: ?clienteId=id'
      });
    }

    const clienteIdStr = String(clienteId).trim();

    // Buscar vinculados que têm este cliente e têm tarefa vinculada
    const { data: vinculados, error: vinculadosError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_id')
      .eq('cliente_id', clienteIdStr)
      .not('tarefa_id', 'is', null);

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
        .map(v => v.tarefa_id)
        .filter(id => id !== null && id !== undefined)
    )];

    if (tarefaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar tarefas na tabela cp_tarefa
    const tarefasMap = new Map();
    if (tarefaIds.length > 0) {
      console.log(`🔍 Buscando tarefas com IDs: [${tarefaIds.join(', ')}]`);
      
      // Buscar cada tarefa individualmente
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
          tarefasMap.set(id, { id, nome: tarefa.nome || null });
          console.log(`  ✅ ID ${id}: ${tarefa.nome}`);
        } else {
          console.warn(`⚠️ Tarefa ID ${tarefaId} não encontrada na tabela cp_tarefa`);
        }
      }
    }

    // Converter Map para array
    const tarefas = Array.from(tarefasMap.values());

    return res.json({
      success: true,
      data: tarefas,
      count: tarefas.length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefas por cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tarefas vinculadas a um cliente e produtos específicos
async function getTarefasPorClienteEProdutos(req, res) {
  try {
    const { clienteId, produtoIds } = req.query;
    
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "clienteId" é obrigatório. Use: ?clienteId=id&produtoIds=id1,id2,id3'
      });
    }

    if (!produtoIds) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "produtoIds" é obrigatório. Use: ?clienteId=id&produtoIds=id1,id2,id3'
      });
    }

    const clienteIdStr = String(clienteId).trim();
    
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

    // Primeiro, verificar se o cliente está vinculado aos produtos (pode ser em registros separados)
    // Buscar registros onde o cliente está vinculado aos produtos
    const { data: vinculadosClienteProduto, error: errorClienteProduto } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('produto_id')
      .eq('cliente_id', clienteIdStr)
      .in('produto_id', idsArray);

    if (errorClienteProduto) {
      console.error('❌ Erro ao verificar vinculação cliente-produto:', errorClienteProduto);
    }

    // Produtos que estão vinculados ao cliente
    const produtosVinculadosAoCliente = new Set(
      (vinculadosClienteProduto || []).map(v => v.produto_id).filter(Boolean)
    );

    // Buscar tarefas vinculadas aos produtos (pode ter ou não o cliente no mesmo registro)
    // Se o produto está vinculado ao cliente, buscar todas as tarefas desse produto
    const { data: vinculados, error: vinculadosError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_id, produto_id, cliente_id')
      .in('produto_id', idsArray)
      .not('tarefa_id', 'is', null);

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
        .map(v => v.tarefa_id)
        .filter(id => id !== null && id !== undefined)
    )];

    if (tarefaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar tarefas na tabela cp_tarefa
    const tarefasMap = new Map();
    if (tarefaIds.length > 0) {
      console.log(`🔍 Buscando tarefas com IDs: [${tarefaIds.join(', ')}]`);
      
      // Buscar cada tarefa individualmente
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
          tarefasMap.set(id, { id, nome: tarefa.nome || null });
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
      const produtoId = vinculado.produto_id;
      const tarefaId = vinculado.tarefa_id;
      
      // Se o produto está vinculado ao cliente (em qualquer registro), 
      // mostrar todas as tarefas vinculadas a esse produto
      const produtoVinculadoAoCliente = produtosVinculadosAoCliente.has(produtoId);
      
      if (produtoVinculadoAoCliente && produtoTarefasMap[produtoId] && tarefasMap.has(tarefaId)) {
        const tarefa = tarefasMap.get(tarefaId);
        // Verificar se já não foi adicionada
        if (!produtoTarefasMap[produtoId].find(t => t.id === tarefa.id)) {
          produtoTarefasMap[produtoId].push(tarefa);
        }
      }
    });

    // Formatar resultado: array de objetos { produtoId, tarefas: [...] }
    const resultado = idsArray.map(produtoId => ({
      produtoId,
      tarefas: produtoTarefasMap[produtoId] || []
    }));

    return res.json({
      success: true,
      data: resultado,
      count: resultado.length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefas por cliente e produtos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar produtos vinculados a um cliente
async function getProdutosPorCliente(req, res) {
  try {
    const { clienteId } = req.query;
    
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "clienteId" é obrigatório. Use: ?clienteId=id'
      });
    }

    const clienteIdStr = String(clienteId).trim();

    // Buscar vinculados que têm este cliente e têm produto vinculado
    const { data: vinculados, error: vinculadosError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('produto_id')
      .eq('cliente_id', clienteIdStr)
      .not('produto_id', 'is', null);

    if (vinculadosError) {
      console.error('❌ Erro ao buscar vinculados:', vinculadosError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar vinculados',
        details: vinculadosError.message
      });
    }

    // Extrair IDs únicos de produtos
    const produtoIds = [...new Set(
      (vinculados || [])
        .map(v => v.produto_id)
        .filter(id => id !== null && id !== undefined)
    )];

    if (produtoIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Buscar produtos na tabela cp_produto
    const produtosMap = new Map();
    if (produtoIds.length > 0) {
      console.log(`🔍 Buscando produtos com IDs: [${produtoIds.join(', ')}]`);
      
      // Buscar cada produto individualmente
      for (const produtoId of produtoIds) {
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
          produtosMap.set(id, { id, nome: produto.nome || null });
          console.log(`  ✅ ID ${id}: ${produto.nome}`);
        } else {
          console.warn(`⚠️ Produto ID ${produtoId} não encontrado na tabela cp_produto`);
        }
      }
    }

    // Converter Map para array
    const produtos = Array.from(produtosMap.values());

    return res.json({
      success: true,
      data: produtos,
      count: produtos.length
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos por cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Aplicar herança de tarefas ao vincular produto a cliente
async function aplicarHeranca(req, res) {
  try {
    const { produtoId, clienteId } = req.body;

    if (!produtoId || !clienteId) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros "produtoId" e "clienteId" são obrigatórios'
      });
    }

    console.log(`🔄 Aplicando herança: Produto ${produtoId} → Cliente ${clienteId}`);

    // Buscar todas as tarefas vinculadas ao produto (cp_cliente = null), incluindo tipos de tarefa
    const { data: tarefasVinculadas, error: tarefasError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_id, tarefa_tipo_id')
      .eq('produto_id', parseInt(produtoId, 10))
      .is('cliente_id', null)
      .not('tarefa_id', 'is', null);

    if (tarefasError) {
      console.error('❌ Erro ao buscar tarefas vinculadas:', tarefasError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefas vinculadas',
        details: tarefasError.message
      });
    }

    // Se não houver tarefas vinculadas ao produto, buscar todas as tarefas disponíveis
    // e vinculá-las ao produto (sem cliente) primeiro
    if (!tarefasVinculadas || tarefasVinculadas.length === 0) {
      console.log('ℹ️ Nenhuma tarefa vinculada ao produto. Buscando todas as tarefas disponíveis...');
      
      // Buscar todas as tarefas da tabela cp_tarefa
      const { data: todasTarefas, error: tarefasError2 } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_tarefa')
        .select('id');
      
      if (tarefasError2) {
        console.error('❌ Erro ao buscar todas as tarefas:', tarefasError2);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar tarefas',
          details: tarefasError2.message
        });
      }
      
      if (!todasTarefas || todasTarefas.length === 0) {
        console.log('ℹ️ Nenhuma tarefa disponível no sistema');
        return res.json({
          success: true,
          message: 'Nenhuma tarefa disponível no sistema',
          count: 0
        });
      }
      
      // Vincular todas as tarefas ao produto (sem cliente) se ainda não estiverem vinculadas
      const tarefaIds = todasTarefas.map(t => parseInt(t.id, 10)).filter(id => !isNaN(id));
      const vinculadosProdutoTarefa = [];
      
      for (const tarefaId of tarefaIds) {
        // Verificar se já existe vinculação produto-tarefa (sem cliente)
        const { data: existente, error: checkError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .select('id')
          .eq('produto_id', parseInt(produtoId, 10))
          .eq('tarefa_id', tarefaId)
          .is('cliente_id', null)
          .limit(1);
        
        if (checkError) {
          console.error(`❌ Erro ao verificar existência para tarefa ${tarefaId}:`, checkError);
          continue;
        }
        
        if (!existente || existente.length === 0) {
          vinculadosProdutoTarefa.push({
            produto_id: parseInt(produtoId, 10),
            tarefa_id: tarefaId,
            cliente_id: null,
            tarefa_tipo_id: null
          });
        }
      }
      
      // Criar vinculações produto-tarefa (sem cliente) se necessário
      if (vinculadosProdutoTarefa.length > 0) {
        console.log(`📝 Criando ${vinculadosProdutoTarefa.length} vinculação(ões) produto-tarefa (sem cliente)`);
        const { error: createProdutoTarefaError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .insert(vinculadosProdutoTarefa);
        
        if (createProdutoTarefaError) {
          console.error('❌ Erro ao criar vinculações produto-tarefa:', createProdutoTarefaError);
          return res.status(500).json({
            success: false,
            error: 'Erro ao criar vinculações produto-tarefa',
            details: createProdutoTarefaError.message
          });
        }
        
        console.log(`✅ ${vinculadosProdutoTarefa.length} vinculação(ões) produto-tarefa criada(s)`);
      }
      
      // Agora buscar novamente as tarefas vinculadas ao produto, incluindo tipos de tarefa
      const { data: tarefasVinculadasNovas, error: tarefasError3 } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('tarefa_id, tarefa_tipo_id')
        .eq('produto_id', parseInt(produtoId, 10))
        .is('cliente_id', null)
        .not('tarefa_id', 'is', null);
      
      if (tarefasError3) {
        console.error('❌ Erro ao buscar tarefas vinculadas após criação:', tarefasError3);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar tarefas vinculadas',
          details: tarefasError3.message
        });
      }
      
      if (!tarefasVinculadasNovas || tarefasVinculadasNovas.length === 0) {
        console.log('ℹ️ Ainda não há tarefas vinculadas ao produto após tentativa de criação');
        return res.json({
          success: true,
          message: 'Nenhuma tarefa vinculada ao produto',
          count: 0
        });
      }
      
      // Usar as tarefas recém-buscadas
      tarefasVinculadas = tarefasVinculadasNovas;
    }

    // Criar um mapa de tarefa_id -> tarefa_tipo_id para preservar os tipos
    const tarefaTipoMap = new Map();
    tarefasVinculadas.forEach(v => {
      if (v.tarefa_id && v.tarefa_tipo_id) {
        tarefaTipoMap.set(v.tarefa_id, v.tarefa_tipo_id);
      }
    });

    // Extrair IDs únicos de tarefas
    const tarefaIds = [...new Set(
      tarefasVinculadas
        .map(v => v.tarefa_id)
        .filter(id => id !== null && id !== undefined)
    )];

    console.log(`📋 Tarefas encontradas: ${tarefaIds.length} tarefa(s)`);

    // Verificar quais já existem para evitar duplicatas
    const vinculadosExistentes = [];
    for (const tarefaId of tarefaIds) {
      const { data: existente, error: checkError } = await supabase
        .schema('up_gestaointeligente')
        .from('vinculados')
        .select('id')
        .eq('produto_id', parseInt(produtoId, 10))
        .eq('tarefa_id', tarefaId)
        .eq('cliente_id', String(clienteId).trim())
        .limit(1);

      if (checkError) {
        console.error(`❌ Erro ao verificar existência para tarefa ${tarefaId}:`, checkError);
        continue;
      }

      if (!existente || existente.length === 0) {
        // Buscar o tipo de tarefa associado a esta tarefa no produto
        const tarefaTipoId = tarefaTipoMap.get(tarefaId) || null;
        
        vinculadosExistentes.push({
          produto_id: parseInt(produtoId, 10),
          tarefa_id: tarefaId,
          cliente_id: String(clienteId).trim(),
          tarefa_tipo_id: tarefaTipoId
        });
      }
    }

    if (vinculadosExistentes.length === 0) {
      console.log('ℹ️ Todas as tarefas já estão vinculadas ao cliente');
      return res.json({
        success: true,
        message: 'Todas as tarefas já estão vinculadas',
        count: 0
      });
    }

    // Criar registros com cp_cliente preenchido
    const { data: novosVinculados, error: createError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .insert(vinculadosExistentes)
      .select();

    if (createError) {
      console.error('❌ Erro ao criar vinculados:', createError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar vinculados',
        details: createError.message
      });
    }

    console.log(`✅ Herança aplicada: ${novosVinculados.length} tarefa(s) vinculada(s)`);
    
    // Buscar tipos de tarefa vinculados diretamente ao produto (sem tarefa específica)
    const { data: tiposTarefaProduto, error: tiposError } = await supabase
      .schema('up_gestaointeligente')
      .from('vinculados')
      .select('tarefa_tipo_id')
      .eq('produto_id', parseInt(produtoId, 10))
      .is('cliente_id', null)
      .is('tarefa_id', null)
      .not('tarefa_tipo_id', 'is', null);

    if (tiposError) {
      console.error('❌ Erro ao buscar tipos de tarefa vinculados ao produto:', tiposError);
    } else if (tiposTarefaProduto && tiposTarefaProduto.length > 0) {
      // Vincular tipos de tarefa ao cliente também
      const tiposTarefaIds = [...new Set(
        tiposTarefaProduto
          .map(v => v.tarefa_tipo_id)
          .filter(id => id !== null && id !== undefined)
      )];

      console.log(`📋 Tipos de tarefa encontrados: ${tiposTarefaIds.length} tipo(s)`);

      const tiposVinculadosExistentes = [];
      for (const tipoTarefaId of tiposTarefaIds) {
        // Verificar se já existe vinculação produto-cliente-tipo de tarefa
        const { data: existente, error: checkError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .select('id')
          .eq('produto_id', parseInt(produtoId, 10))
          .eq('tarefa_tipo_id', tipoTarefaId)
          .eq('cliente_id', String(clienteId).trim())
          .is('tarefa_id', null)
          .limit(1);

        if (checkError) {
          console.error(`❌ Erro ao verificar existência para tipo de tarefa ${tipoTarefaId}:`, checkError);
          continue;
        }

        if (!existente || existente.length === 0) {
          tiposVinculadosExistentes.push({
            produto_id: parseInt(produtoId, 10),
            tarefa_tipo_id: tipoTarefaId,
            cliente_id: String(clienteId).trim(),
            tarefa_id: null
          });
        }
      }

      // Criar vinculações produto-cliente-tipo de tarefa se necessário
      if (tiposVinculadosExistentes.length > 0) {
        console.log(`📝 Criando ${tiposVinculadosExistentes.length} vinculação(ões) produto-cliente-tipo de tarefa`);
        const { error: createTiposError } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .insert(tiposVinculadosExistentes);

        if (createTiposError) {
          console.error('❌ Erro ao criar vinculações produto-cliente-tipo de tarefa:', createTiposError);
        } else {
          console.log(`✅ ${tiposVinculadosExistentes.length} vinculação(ões) produto-cliente-tipo de tarefa criada(s)`);
        }
      }
    }
    
    // Aplicar herança de tipo de tarefa para os novos vinculados criados
    if (novosVinculados && novosVinculados.length > 0) {
      await aplicarHerancaTipoTarefa(novosVinculados);
    }

    return res.json({
      success: true,
      message: 'Herança aplicada com sucesso',
      data: novosVinculados,
      count: novosVinculados.length
    });
  } catch (error) {
    console.error('Erro inesperado ao aplicar herança:', error);
    return res.status(500).json({
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
  getTarefasPorProdutos,
  getTarefasPorCliente,
  getTarefasPorClienteEProdutos,
  getProdutosPorCliente,
  aplicarHeranca
};

