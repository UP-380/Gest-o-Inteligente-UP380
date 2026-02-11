// =============================================================
// === CONTROLLER DE BASE DE CONHECIMENTO ===
// =============================================================

const supabase = require('../config/database');

// GET - Buscar todos os dados consolidados de um cliente para base de conhecimento
async function getBaseConhecimentoCliente(req, res) {
  try {
    const { cliente_id } = req.params;

    if (!cliente_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    // Buscar dados básicos do cliente - apenas campos necessários para a tela
    // Usar .maybeSingle() para melhor performance em vez de .single()
    const { data: cliente, error: errorCliente } = await supabase

      .from('cp_cliente')
      .select('id, razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino, id_cli_kamino, nome, foto_perfil')
      .eq('id', cliente_id)
      .maybeSingle();

    if (errorCliente) {
      console.error('❌ Erro ao buscar cliente:', errorCliente);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do cliente',
        details: errorCliente.message
      });
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Buscar todos os dados relacionados em paralelo para melhor performance
    const [sistemasResult, contasResult, adquirentesResult, vinculadosResult] = await Promise.all([
      // Buscar sistemas do cliente
      supabase

        .from('cliente_sistema')
        .select(`
          id,
          cliente_id,
          sistema_id,
          servidor,
          usuario_servidor,
          senha_servidor,
          vpn,
          usuario_vpn,
          senha_vpn,
          usuario_sistema,
          senha_sistema,
          link_acesso,
          observacoes,
          created_at,
          cp_sistema (
            id,
            nome
          )
        `)
        .eq('cliente_id', cliente_id),

      // Buscar contas bancárias do cliente
      supabase

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
        `)
        .eq('cliente_id', cliente_id),

      // Buscar adquirentes do cliente
      supabase

        .from('cliente_adquirente')
        .select(`
          *,
          cp_adquirente (
            id,
            nome
          )
        `)
        .eq('cliente_id', cliente_id),

      // Buscar vinculados do cliente
      supabase

        .from('vinculados')
        .select(`
          id,
          tarefa_id,
          tarefa_tipo_id,
          produto_id,
          subtarefa_id,
          cliente_id
        `)
        .eq('cliente_id', cliente_id)
    ]);

    // Resolver foto_perfil: se for custom-{id}, buscar URL no Storage usando metadados
    const { resolveAvatarUrl } = require('../utils/storage');
    let fotoPerfilUrl = cliente.foto_perfil;
    if (cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-')) {
      const resolvedUrl = await resolveAvatarUrl(cliente.foto_perfil, 'cliente');
      if (resolvedUrl) {
        fotoPerfilUrl = resolvedUrl;
      }
    }

    // Mapear campos do cliente para o formato esperado pelo frontend
    const clienteFormatado = {
      id: cliente.id,
      razao: cliente.razao_social,
      fantasia: cliente.nome_fantasia,
      nome_amigavel: cliente.nome_amigavel,
      amigavel: cliente.nome_amigavel,
      cnpj: cliente.cpf_cnpj,
      cpf_cnpj: cliente.cpf_cnpj,
      status: cliente.status,
      kaminoNome: cliente.nome_cli_kamino,
      nome_cli_kamino: cliente.nome_cli_kamino,
      nome: cliente.nome,
      foto_perfil: fotoPerfilUrl // URL resolvida usando metadados
    };

    // Extrair dados e tratar erros
    const sistemas = sistemasResult.error ? [] : (sistemasResult.data || []);
    const contasBancarias = contasResult.error ? [] : (contasResult.data || []);
    const adquirentes = adquirentesResult.error ? [] : (adquirentesResult.data || []);
    const vinculados = vinculadosResult.error ? [] : (vinculadosResult.data || []);

    // Log de erros se houver
    if (sistemasResult.error) {
      console.error('❌ Erro ao buscar sistemas do cliente:', sistemasResult.error);
    }
    if (contasResult.error) {
      console.error('❌ Erro ao buscar contas bancárias do cliente:', contasResult.error);
    }
    if (adquirentesResult.error) {
      console.error('❌ Erro ao buscar adquirentes do cliente:', adquirentesResult.error);
    }
    if (vinculadosResult.error) {
      console.error('❌ Erro ao buscar vinculados do cliente:', vinculadosResult.error);
    }
    // Buscar informações detalhadas dos vinculados
    let vinculacoesDetalhadas = [];
    if (vinculados && vinculados.length > 0) {
      // Extrair IDs únicos
      const idsTarefas = [...new Set(vinculados.filter(v => v.tarefa_id).map(v => parseInt(v.tarefa_id, 10)))];
      const idsProdutos = [...new Set(vinculados.filter(v => v.produto_id).map(v => parseInt(v.produto_id, 10)))];
      const idsTipoTarefas = [...new Set(vinculados.filter(v => v.tarefa_tipo_id).map(v => parseInt(v.tarefa_tipo_id, 10)))];
      const idsSubtarefas = [...new Set(vinculados.filter(v => v.subtarefa_id).map(v => parseInt(v.subtarefa_id, 10)))];

      // Buscar dados relacionados
      const [tarefasResult, produtosResult, tiposTarefaResult, subtarefasResult] = await Promise.all([
        idsTarefas.length > 0 ? supabase

          .from('cp_tarefa')
          .select('id, nome, descricao')
          .in('id', idsTarefas) : { data: [], error: null },
        idsProdutos.length > 0 ? supabase

          .from('cp_produto')
          .select('id, nome')
          .in('id', idsProdutos) : { data: [], error: null },
        idsTipoTarefas.length > 0 ? supabase

          .from('cp_tarefa_tipo')
          .select('id, nome')
          .in('id', idsTipoTarefas) : { data: [], error: null },
        idsSubtarefas.length > 0 ? supabase

          .from('cp_subtarefa')
          .select('id, nome, descricao')
          .in('id', idsSubtarefas) : { data: [], error: null }
      ]);

      // Buscar observações particulares do cliente para as subtarefas
      const observacoesResult = await supabase

        .from('cliente_subtarefa_observacao')
        .select('subtarefa_id, observacao')
        .eq('cliente_id', cliente_id);

      const observacoesMap = new Map();
      if (observacoesResult.data && !observacoesResult.error) {
        observacoesResult.data.forEach(obs => {
          observacoesMap.set(obs.subtarefa_id, obs.observacao);
        });
      }

      // Criar maps para acesso rápido
      const tarefasMap = new Map((tarefasResult.data || []).map(t => [t.id, { nome: t.nome, descricao: t.descricao || null }]));
      const produtosMap = new Map((produtosResult.data || []).map(p => [p.id, p.nome]));
      const tiposTarefaMap = new Map((tiposTarefaResult.data || []).map(tt => [tt.id, tt.nome]));
      const subtarefasMap = new Map((subtarefasResult.data || []).map(s => {
        const subtarefaId = s.id;
        const observacaoParticular = observacoesMap.get(subtarefaId) || null;
        return [subtarefaId, {
          nome: s.nome,
          descricao: s.descricao || null,
          observacaoParticular: observacaoParticular
        }];
      }));

      // Montar array de vinculações detalhadas
      vinculacoesDetalhadas = vinculados.map(v => {
        const tarefa = v.tarefa_id ? tarefasMap.get(parseInt(v.tarefa_id, 10)) : null;
        const produto = v.produto_id ? produtosMap.get(parseInt(v.produto_id, 10)) : null;
        const tipoTarefa = v.tarefa_tipo_id ? tiposTarefaMap.get(parseInt(v.tarefa_tipo_id, 10)) : null;
        const subtarefa = v.subtarefa_id ? subtarefasMap.get(parseInt(v.subtarefa_id, 10)) : null;

        return {
          id: v.id,
          produto: produto ? { id: v.produto_id, nome: produto } : null,
          tipoTarefa: tipoTarefa ? { id: v.tarefa_tipo_id, nome: tipoTarefa } : null,
          tarefa: tarefa ? { id: v.tarefa_id, nome: tarefa.nome, descricao: tarefa.descricao } : null,
          subtarefa: subtarefa ? {
            id: v.subtarefa_id,
            nome: subtarefa.nome,
            descricao: subtarefa.descricao,
            observacaoParticular: subtarefa.observacaoParticular
          } : null
        };
      });
    }

    // Retornar dados consolidados
    const dadosConsolidados = {
      cliente: clienteFormatado || null,
      sistemas: sistemas,
      contasBancarias: contasBancarias,
      adquirentes: adquirentes,
      vinculacoes: vinculacoesDetalhadas
    };

    return res.json({
      success: true,
      data: dadosConsolidados
    });
  } catch (error) {
    console.error('❌ Erro ao buscar base de conhecimento do cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Buscar resumo simplificado de múltiplos clientes para ícones de validação
async function getBaseConhecimentoBulkSummary(req, res) {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'IDs dos clientes são obrigatórios'
      });
    }

    const clienteIds = String(ids).split(',').map(id => id.trim()).filter(Boolean);

    if (clienteIds.length === 0) {
      return res.json({
        success: true,
        data: {}
      });
    }

    // Executar contagens globais para todos os IDs solicitados
    // Isso é MUITO mais eficiente do que 20 chamadas individuais
    const [sistemasCounts, contasCounts, adquirentesCounts] = await Promise.all([
      supabase
        .from('cliente_sistema')
        .select('cliente_id')
        .in('cliente_id', clienteIds),
      supabase
        .from('cliente_conta_bancaria')
        .select('cliente_id')
        .in('cliente_id', clienteIds),
      supabase
        .from('cliente_adquirente')
        .select('cliente_id')
        .in('cliente_id', clienteIds)
    ]);

    // Consolidar resultados por cliente
    const summary = {};
    clienteIds.forEach(id => {
      summary[id] = {
        hasSistemas: false,
        hasContas: false,
        hasAdquirentes: false
      };
    });

    // Marcar presença de dados
    if (sistemasCounts.data) {
      sistemasCounts.data.forEach(item => {
        if (summary[item.cliente_id]) summary[item.cliente_id].hasSistemas = true;
      });
    }
    if (contasCounts.data) {
      contasCounts.data.forEach(item => {
        if (summary[item.cliente_id]) summary[item.cliente_id].hasContas = true;
      });
    }
    if (adquirentesCounts.data) {
      adquirentesCounts.data.forEach(item => {
        if (summary[item.cliente_id]) summary[item.cliente_id].hasAdquirentes = true;
      });
    }

    return res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ Erro no bulk summary da base de conhecimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar anexo na base de conhecimento
async function criarAnexo(req, res) {
  try {
    const usuarioId = req.session?.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    const { titulo, conteudo, pasta_id } = req.body || {};
    const conteudoTrim = typeof conteudo === 'string' ? conteudo.trim() : '';
    if (!conteudoTrim) {
      return res.status(400).json({
        success: false,
        error: 'Conteúdo é obrigatório'
      });
    }

    // Validar pasta_id se fornecido
    if (pasta_id !== undefined && pasta_id !== null) {
      const pastaIdNum = parseInt(pasta_id, 10);
      if (isNaN(pastaIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'pasta_id inválido'
        });
      }

      // Verificar se a pasta existe
      const { data: pastaExiste, error: errorPasta } = await supabase
        .from('base_conhecimento_pastas')
        .select('id')
        .eq('id', pastaIdNum)
        .single();

      if (errorPasta || !pastaExiste) {
        return res.status(400).json({
          success: false,
          error: 'Pasta não encontrada'
        });
      }
    }

    const insertData = {
      usuario_id: parseInt(usuarioId, 10) || usuarioId,
      titulo: typeof titulo === 'string' ? titulo.trim() || null : null,
      conteudo: conteudoTrim
    };

    if (pasta_id !== undefined && pasta_id !== null) {
      insertData.pasta_id = parseInt(pasta_id, 10);
    }

    const { data, error } = await supabase
      .from('base_conhecimento_anexos')
      .insert(insertData)
      .select('id, titulo, created_at')
      .single();

    if (error) {
      console.error('Erro ao criar anexo base conhecimento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar anexo.',
        details: error.message
      });
    }

    // Registrar em tutorial_logs (auditoria da página Tutoriais)
    const userEmail = req.session?.usuario?.nome_usuario || req.session?.usuario?.email || null;
    const { error: logError } = await supabase.from('tutorial_logs').insert({
      tutorial_id: data.id,
      user_id: parseInt(usuarioId, 10) || usuarioId,
      user_email: userEmail,
      action_type: 'CREATE',
      changes_json: { new: { id: data.id, titulo: data.titulo } }
    });
    if (logError) {
      console.warn('Erro ao registrar tutorial_logs (tabela pode não existir ainda):', logError.message);
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro ao criar anexo base conhecimento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar todas as pastas
async function listarPastas(req, res) {
  try {
    const { data, error } = await supabase
      .from('base_conhecimento_pastas')
      .select('id, nome, descricao, created_at')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao listar pastas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar pastas',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Erro ao listar pastas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// POST - Criar nova pasta
async function criarPasta(req, res) {
  try {
    const { nome, descricao } = req.body || {};

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório'
      });
    }

    const { data, error } = await supabase
      .from('base_conhecimento_pastas')
      .insert({
        nome: nome.trim(),
        descricao: typeof descricao === 'string' ? descricao.trim() || null : null
      })
      .select('id, nome, descricao, created_at')
      .single();

    if (error) {
      console.error('Erro ao criar pasta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar pasta',
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro ao criar pasta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar pasta
async function atualizarPasta(req, res) {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da pasta é obrigatório'
      });
    }

    const pastaIdNum = parseInt(id, 10);
    if (isNaN(pastaIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'ID da pasta inválido'
      });
    }

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório'
      });
    }

    const updateData = {
      nome: nome.trim(),
      descricao: typeof descricao === 'string' ? descricao.trim() || null : null
    };

    const { data, error } = await supabase
      .from('base_conhecimento_pastas')
      .update(updateData)
      .eq('id', pastaIdNum)
      .select('id, nome, descricao, created_at')
      .single();

    if (error) {
      console.error('Erro ao atualizar pasta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar pasta',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Pasta não encontrada'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Erro ao atualizar pasta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// DELETE - Excluir pasta
// Query: excluir_anexos=true para remover também os anexos da pasta no Supabase; caso contrário, apenas desvincula (pasta_id = null)
async function excluirPasta(req, res) {
  try {
    const { id } = req.params;
    const excluirAnexos = req.query.excluir_anexos === 'true';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da pasta é obrigatório'
      });
    }

    const pastaIdNum = parseInt(id, 10);
    if (isNaN(pastaIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'ID da pasta inválido'
      });
    }

    if (excluirAnexos) {
      // Excluir todos os anexos desta pasta no Supabase e depois a pasta
      const { error: errorDeleteAnexos } = await supabase
        .from('base_conhecimento_anexos')
        .delete()
        .eq('pasta_id', pastaIdNum);

      if (errorDeleteAnexos) {
        console.error('Erro ao excluir anexos da pasta:', errorDeleteAnexos);
        return res.status(500).json({
          success: false,
          error: 'Erro ao excluir anexos da pasta',
          details: errorDeleteAnexos.message
        });
      }
    } else {
      // Apenas desvincular anexos (pasta_id = null)
      const { error: errorUpdate } = await supabase
        .from('base_conhecimento_anexos')
        .update({ pasta_id: null })
        .eq('pasta_id', pastaIdNum);

      if (errorUpdate) {
        console.error('Erro ao desvincular anexos da pasta:', errorUpdate);
        return res.status(500).json({
          success: false,
          error: 'Erro ao desvincular anexos da pasta',
          details: errorUpdate.message
        });
      }
    }

    const { error: errorDelete } = await supabase
      .from('base_conhecimento_pastas')
      .delete()
      .eq('id', pastaIdNum);

    if (errorDelete) {
      console.error('Erro ao excluir pasta:', errorDelete);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir pasta',
        details: errorDelete.message
      });
    }

    return res.json({
      success: true,
      message: 'Pasta excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir pasta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar anexos por pasta
async function listarAnexosPorPasta(req, res) {
  try {
    const usuarioId = req.session?.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    const pastaId = req.query.pasta_id;
    if (pastaId === undefined || pastaId === null || pastaId === '') {
      return res.status(400).json({
        success: false,
        error: 'pasta_id é obrigatório'
      });
    }

    const pastaIdNum = parseInt(pastaId, 10);
    if (isNaN(pastaIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'pasta_id inválido'
      });
    }

    const { data, error } = await supabase
      .from('base_conhecimento_anexos')
      .select('id, usuario_id, titulo, conteudo, pasta_id, created_at')
      .eq('pasta_id', pastaIdNum)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar anexos por pasta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anexos da pasta',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Erro ao listar anexos por pasta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// PUT - Atualizar anexo
async function atualizarAnexo(req, res) {
  try {
    const usuarioId = req.session?.usuario?.id;
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }

    const anexoId = parseInt(req.params.id, 10);
    if (isNaN(anexoId)) {
      return res.status(400).json({
        success: false,
        error: 'ID do anexo inválido'
      });
    }

    const { titulo, conteudo, snapshot_before_url } = req.body || {};

    const { data: anexoAtual, error: errBusca } = await supabase
      .from('base_conhecimento_anexos')
      .select('id, titulo, conteudo, usuario_id')
      .eq('id', anexoId)
      .single();

    if (errBusca || !anexoAtual) {
      return res.status(404).json({
        success: false,
        error: 'Anexo não encontrado'
      });
    }

    if (parseInt(anexoAtual.usuario_id, 10) !== parseInt(usuarioId, 10)) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este anexo'
      });
    }

    const updateData = {};
    if (titulo !== undefined) {
      updateData.titulo = typeof titulo === 'string' ? titulo.trim() || null : null;
    }
    if (conteudo !== undefined) {
      updateData.conteudo = typeof conteudo === 'string' ? conteudo.trim() : '';
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        data: anexoAtual
      });
    }

    const { data: atualizado, error: errUpdate } = await supabase
      .from('base_conhecimento_anexos')
      .update(updateData)
      .eq('id', anexoId)
      .select('id, titulo, conteudo, pasta_id, created_at')
      .single();

    if (errUpdate) {
      console.error('Erro ao atualizar anexo:', errUpdate);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar anexo',
        details: errUpdate.message
      });
    }

    const userEmail = req.session?.usuario?.nome_usuario || req.session?.usuario?.email || null;
    const changesJson = {
      old: { titulo: anexoAtual.titulo, conteudo: anexoAtual.conteudo },
      new: updateData
    };
    if (snapshot_before_url && typeof snapshot_before_url === 'string') {
      changesJson.snapshot_before_url = snapshot_before_url;
    }
    const { error: logError } = await supabase.from('tutorial_logs').insert({
      tutorial_id: atualizado.id,
      user_id: parseInt(usuarioId, 10) || usuarioId,
      user_email: userEmail,
      action_type: 'UPDATE',
      changes_json: changesJson
    });
    if (logError) {
      console.warn('Erro ao registrar tutorial_logs:', logError.message);
    }

    return res.json({
      success: true,
      data: atualizado
    });
  } catch (error) {
    console.error('Erro ao atualizar anexo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// GET - Listar logs da página Tutoriais (auditoria de anexos). Opcional: pasta_id para filtrar por pasta.
async function getTutorialLogs(req, res) {
  try {
    const { limit = 100, pasta_id: pastaIdParam } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const pastaId = pastaIdParam ? parseInt(pastaIdParam, 10) : null;

    let tutorialIds = null;
    if (pastaId != null && !isNaN(pastaId)) {
      const { data: anexos, error: errAnexos } = await supabase
        .from('base_conhecimento_anexos')
        .select('id')
        .eq('pasta_id', pastaId);
      if (errAnexos) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar anexos da pasta',
          details: errAnexos.message
        });
      }
      tutorialIds = (anexos || []).map((a) => a.id);
      if (tutorialIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
    }

    let query = supabase
      .from('tutorial_logs')
      .select('id, tutorial_id, user_id, user_email, action_type, changes_json, created_at')
      .order('created_at', { ascending: false })
      .limit(limitNum);

    if (tutorialIds !== null) {
      query = query.in('tutorial_id', tutorialIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar tutorial_logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar histórico de tutoriais',
        details: error.message
      });
    }

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Erro ao listar tutorial_logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

module.exports = {
  getBaseConhecimentoCliente,
  getBaseConhecimentoBulkSummary,
  criarAnexo,
  listarAnexosPorPasta,
  atualizarAnexo,
  listarPastas,
  criarPasta,
  atualizarPasta,
  excluirPasta,
  getTutorialLogs
};

