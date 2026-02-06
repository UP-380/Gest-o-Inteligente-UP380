// =============================================================
// === CONTROLLER DE TAREFA (cp_tarefa) ===
// =============================================================

const supabase = require('../config/database');

// GET - Listar todas as tarefas (com paginação opcional)
async function getTarefas(req, res) {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase

      .from('cp_tarefa')
      .select('id, nome, clickup_id, descricao, created_at, updated_at', { count: 'exact' })
      .order('nome', { ascending: true });

    // Busca por nome ou clickup_id
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const ilikePattern = `%${searchTerm}%`;
      query = query.or(`nome.ilike.${ilikePattern},clickup_id.ilike.${ilikePattern}`);
    }

    // Aplicar paginação
    if (limitNum > 0) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Erro ao buscar tarefas:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefas',
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
    console.error('Erro inesperado ao buscar tarefas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar tarefa por ID
async function getTarefaPorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    const { data, error } = await supabase

      .from('cp_tarefa')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar tarefa',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    return res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao buscar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova tarefa
async function criarTarefa(req, res) {
  try {
    const { nome, clickup_id, descricao } = req.body;

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

    // Função auxiliar para limpar valores (retorna null para campos opcionais)
    const cleanValue = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    // Função auxiliar específica para clickup_id (NOT NULL, então retorna string vazia)
    const cleanClickupId = (value) => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? '' : trimmed;
    };

    // Preparar dados para inserção (sem ID - banco gera automaticamente)
    // clickup_id é obrigatório (NOT NULL), então usa string vazia se não fornecido
    // descricao é opcional
    const dadosInsert = {
      nome: nomeTrimmed,
      clickup_id: cleanClickupId(clickup_id),
      descricao: cleanValue(descricao)
    };

    // Inserir no banco
    const { data, error: insertError } = await supabase

      .from('cp_tarefa')
      .insert([dadosInsert])
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar tarefa:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tarefa',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar tarefa: nenhum dado retornado'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Tarefa criada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao criar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar tarefa
async function atualizarTarefa(req, res) {
  try {
    const { id } = req.params;
    const { nome, clickup_id, descricao } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    // Verificar se tarefa existe
    const { data: existente, error: errorCheck } = await supabase

      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    // Função auxiliar para limpar valores (retorna null para campos opcionais)
    const cleanValue = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    // Função auxiliar específica para clickup_id (NOT NULL, então retorna string vazia)
    const cleanClickupId = (value) => {
      if (value === undefined || value === null || value === '') {
        return '';
      }
      const trimmed = String(value).trim();
      return trimmed === '' ? '' : trimmed;
    };

    // Preparar dados para atualização
    const dadosUpdate = {};
    let temAlteracao = false;

    if (nome !== undefined) {
      if (!nome || !nome.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome não pode ser vazio'
        });
      }

      const nomeTrimmed = nome.trim();

      // Buscar todas as tarefas e fazer comparação case-insensitive
      const { data: todasTarefas, error: errorNome } = await supabase

        .from('cp_tarefa')
        .select('id, nome');

      if (errorNome) {
        console.error('Erro ao verificar nome:', errorNome);
        return res.status(500).json({
          success: false,
          error: 'Erro ao verificar nome',
          details: errorNome.message
        });
      }

      // Verificar se existe outra tarefa com mesmo nome (case-insensitive)
      const nomeExistente = (todasTarefas || []).find(
        tarefa =>
          tarefa.id !== parseInt(id, 10) &&
          tarefa.nome?.trim().toLowerCase() === nomeTrimmed.toLowerCase()
      );

      if (nomeExistente) {
        return res.status(409).json({
          success: false,
          error: 'Tarefa com este nome já existe',
          data: {
            id: nomeExistente.id,
            nome: nomeExistente.nome
          }
        });
      }

      dadosUpdate.nome = nomeTrimmed;
      temAlteracao = true;
    }

    if (clickup_id !== undefined) {
      // clickup_id tem NOT NULL constraint, então usa string vazia se não fornecido
      dadosUpdate.clickup_id = cleanClickupId(clickup_id);
      temAlteracao = true;
    }

    if (descricao !== undefined) {
      dadosUpdate.descricao = cleanValue(descricao);
      temAlteracao = true;
    }

    // Atualizar updated_at apenas uma vez se houver alterações
    if (temAlteracao) {
      dadosUpdate.updated_at = new Date().toISOString();
    }

    // Se não há nada para atualizar
    if (Object.keys(dadosUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum dado fornecido para atualização'
      });
    }

    // Log para debug
    console.log('📝 Atualizando tarefa:', {
      id,
      dadosUpdate: {
        ...dadosUpdate,
        descricao: dadosUpdate.descricao ? `${dadosUpdate.descricao.substring(0, 50)}...` : null
      }
    });

    // Atualizar no banco
    const { data, error } = await supabase

      .from('cp_tarefa')
      .update(dadosUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar tarefa:', error);
      console.error('   Detalhes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tarefa atualizada com sucesso',
      data: data
    });
  } catch (error) {
    console.error('Erro inesperado ao atualizar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Deletar tarefa
async function deletarTarefa(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da tarefa é obrigatório'
      });
    }

    // Verificar se tarefa existe
    const { data: existente, error: errorCheck } = await supabase

      .from('cp_tarefa')
      .select('id, nome')
      .eq('id', id)
      .maybeSingle();

    if (errorCheck) {
      console.error('Erro ao verificar tarefa:', errorCheck);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar tarefa',
        details: errorCheck.message
      });
    }

    if (!existente) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    // Deletar do banco
    const { error } = await supabase

      .from('cp_tarefa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tarefa:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar tarefa',
        details: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Tarefa deletada com sucesso',
      data: {
        id: existente.id,
        nome: existente.nome
      }
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar tarefa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar Tarefa Rápida (Plug Rápido)
// Cria tarefa e vínculos (atomicamente via rollback manual)
async function criarTarefaRapida(req, res) {
  let newTaskId = null;

  try {
    const {
      nome,
      clickup_id,
      tipo_tarefa_id,
      cliente_id,
      produto_id,
      subtarefas_ids
    } = req.body;

    // 1. Validações Básicas
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ success: false, error: 'Nome da tarefa é obrigatório' });
    }
    if (!tipo_tarefa_id) {
      return res.status(400).json({ success: false, error: 'Tipo de tarefa é obrigatório' });
    }
    if (!cliente_id) {
      return res.status(400).json({ success: false, error: 'Cliente é obrigatório' });
    }
    if (!produto_id) {
      return res.status(400).json({ success: false, error: 'Produto é obrigatório' });
    }

    const nomeTrimmed = String(nome).trim();
    const cleanClickupId = clickup_id ? String(clickup_id).trim() : '';
    const tipoTarefaIdInt = parseInt(tipo_tarefa_id, 10);
    const clienteIdStr = String(cliente_id).trim();
    const produtoIdInt = parseInt(produto_id, 10);

    console.log('⚡ [Plug Rápido] Iniciando criação rápida:', { nome: nomeTrimmed, tipo: tipoTarefaIdInt, cliente: clienteIdStr, produto: produtoIdInt });

    // 1.1 Verificar duplicidade de nome para este cliente/produto (Evitar múltiplos cadastros da mesma tarefa por engano)
    try {
      const { data: vinculadas, error: erroVincCheck } = await supabase

        .from('vinculados')
        .select(`
                tarefa_id,
                cp_tarefa!inner ( nome )
            `)
        .eq('cliente_id', clienteIdStr)
        .eq('produto_id', produtoIdInt)
        .is('subtarefa_id', null); // Apenas tarefas master

      if (!erroVincCheck && vinculadas) {
        const duplicata = vinculadas.find(v =>
          v.cp_tarefa && v.cp_tarefa.nome.trim().toLowerCase() === nomeTrimmed.toLowerCase()
        );

        if (duplicata) {
          return res.status(400).json({
            success: false,
            error: `A tarefa "${nomeTrimmed}" já existe para este cliente e produto. Por favor, selecione-a na lista de tarefas em vez de criar uma nova.`
          });
        }
      }
    } catch (err) {
      console.warn('Aviso: Falha na verificação de duplicidade de tarefa, prosseguindo...', err);
    }

    // 2. Criar a Tarefa (Passo 1)
    const { data: novaTarefa, error: erroTarefa } = await supabase

      .from('cp_tarefa')
      .insert([{
        nome: nomeTrimmed,
        clickup_id: cleanClickupId,
        descricao: null
      }])
      .select()
      .single();

    if (erroTarefa) {
      console.error('❌ [Plug Rápido] Erro ao criar tarefa:', erroTarefa);
      throw new Error(`Erro ao criar tarefa: ${erroTarefa.message}`);
    }

    if (!novaTarefa) {
      throw new Error('Tarefa criada mas nenhum dado retornado.');
    }

    newTaskId = novaTarefa.id;
    console.log('✅ [Plug Rápido] Tarefa criada com ID:', newTaskId);

    // 3. Preparar Vínculos (Passo 2)
    const linksParaCriar = [];


    console.log(`🔗 [Plug Rápido] Preparando ${linksParaCriar.length} vínculos...`);

    // 3.1 VÍNCULOS "MASTER" (Para aparecer nas seções genéricas do sistema)
    // Link Tarefa -> Tipo (Master)
    linksParaCriar.push({
      tarefa_tipo_id: tipoTarefaIdInt,
      tarefa_id: newTaskId,
      produto_id: null,
      cliente_id: null,
      subtarefa_id: null,
      tipo_relacionamento: 'tipo_tarefa_tarefa',
      eh_excecao: false
    });

    // Links Tarefa -> Tipo -> Subtarefa (Master) - se houver
    if (Array.isArray(subtarefas_ids) && subtarefas_ids.length > 0) {
      subtarefas_ids.forEach(subId => {
        linksParaCriar.push({
          tarefa_tipo_id: tipoTarefaIdInt,
          tarefa_id: newTaskId,
          produto_id: null,
          cliente_id: null,
          subtarefa_id: parseInt(subId, 10),
          tipo_relacionamento: 'tarefa_subtarefa',
          eh_excecao: false
        });
      });
    }

    // 3.2 VÍNCULOS ESPECÍFICOS (Cliente x Produto x Tarefa)
    // Vínculo Tarefa Principal no Cliente/Produto
    linksParaCriar.push({
      tarefa_tipo_id: tipoTarefaIdInt,
      cliente_id: clienteIdStr,
      produto_id: produtoIdInt,
      tarefa_id: newTaskId,
      subtarefa_id: null,
      tipo_relacionamento: 'cliente_produto_tarefa',
      eh_excecao: true
    });

    // Vínculos de Subtarefas no Cliente/Produto (se houver)
    if (Array.isArray(subtarefas_ids) && subtarefas_ids.length > 0) {
      subtarefas_ids.forEach(subId => {
        linksParaCriar.push({
          tarefa_tipo_id: tipoTarefaIdInt,
          cliente_id: clienteIdStr,
          produto_id: produtoIdInt,
          tarefa_id: newTaskId,
          subtarefa_id: parseInt(subId, 10),
          tipo_relacionamento: 'cliente_produto_tarefa_subtarefa',
          eh_excecao: true
        });
      });
    }

    console.log('🔗 [Plug Rápido] Vínculos que serão inseridos:', JSON.stringify(linksParaCriar, null, 2));

    // 4. Salvar Vínculos
    const { error: erroVinculos } = await supabase

      .from('vinculados')
      .insert(linksParaCriar);

    if (erroVinculos) {
      console.error('❌ [Plug Rápido] Erro ao criar vínculos:', erroVinculos);
      throw new Error(`Erro ao criar vínculos: ${erroVinculos.message}`);
    }

    console.log('✅ [Plug Rápido] Vínculos criados com sucesso no banco!');

    // 5. Sucesso
    return res.status(201).json({
      success: true,
      message: 'Tarefa criada e vinculada com sucesso (incluindo vínculos master)',
      data: novaTarefa
    });

  } catch (error) {
    console.error('❌ [Plug Rápido] Falha no fluxo. Iniciando rollback...', error);

    // ROLLBACK MANUAL
    if (newTaskId) {
      try {
        await supabase

          .from('cp_tarefa')
          .delete()
          .eq('id', newTaskId);
        console.log('↩️ [Plug Rápido] Rollback: Tarefa deletada com sucesso.');
      } catch (rollbackError) {
        console.error('💀 [Plug Rápido] ERRO NO ROLLBACK (Tarefa órfã pode ter ficado):', rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar criação rápida'
    });
  }
}

/**
 * Atualiza uma tarefa criada via Plug Rápido (ou qualquer tarefa master)
 * Além do nome/tipo, sincroniza os vínculos de subtarefa para o cliente/produto específico
 */
async function atualizarTarefaRapida(req, res) {
  try {
    const { id } = req.params;
    const {
      nome,
      tipo_tarefa_id,
      cliente_id,
      produto_id,
      subtarefas_ids
    } = req.body;

    if (!id) return res.status(400).json({ success: false, error: 'ID da tarefa é obrigatório' });

    console.log(`🔄 [Plug Rápido] Atualizando tarefa ${id}:`, { nome, tipo: tipo_tarefa_id });

    // 1. Atualizar o nome na tarefa base (cp_tarefa não tem tipo_tarefa_id)
    const { error: errorTarefa } = await supabase

      .from('cp_tarefa')
      .update({
        nome: nome.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (errorTarefa) throw errorTarefa;

    // 2. Atualizar o TIPO da tarefa em TODOS os vínculos existentes (Master e Específicos)
    if (tipo_tarefa_id) {
      const { error: errorTipoVinc } = await supabase

        .from('vinculados')
        .update({
          tarefa_tipo_id: parseInt(tipo_tarefa_id, 10)
        })
        .eq('tarefa_id', id);

      if (errorTipoVinc) {
        console.error('Erro ao atualizar tipo nos vínculos:', errorTipoVinc);
      }
    }

    // 3. Se tivermos cliente e produto, sincronizamos as subtarefas vinculadas (exceções)
    if (cliente_id && produto_id) {
      // Deletar vínculos de subtarefa antigos para este contexto (exceções)
      await supabase

        .from('vinculados')
        .delete()
        .eq('tarefa_id', id)
        .eq('cliente_id', cliente_id)
        .eq('produto_id', produto_id)
        .not('subtarefa_id', 'is', null);

      // Inserir novos se houver
      if (subtarefas_ids && subtarefas_ids.length > 0) {
        const novosVinculos = subtarefas_ids.map(subId => ({
          tarefa_id: id,
          cliente_id: cliente_id,
          produto_id: produto_id,
          subtarefa_id: parseInt(subId, 10),
          tarefa_tipo_id: parseInt(tipo_tarefa_id, 10),
          tipo_relacionamento: 'cliente_produto_tarefa_subtarefa',
          eh_excecao: true
        }));

        const { error: errorVinculos } = await supabase

          .from('vinculados')
          .insert(novosVinculos);

        if (errorVinculos) {
          console.error('Erro ao atualizar subtarefas vinculadas:', errorVinculos);
        }
      }
    }

    return res.json({ success: true, message: 'Tarefa atualizada com sucesso' });

  } catch (error) {
    console.error('❌ [Plug Rápido] Fallha na atualização:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar tarefa' });
  }
}

module.exports = {
  getTarefas,
  getTarefaPorId,
  criarTarefa,
  atualizarTarefa,
  deletarTarefa,
  criarTarefaRapida,
  atualizarTarefaRapida
};

