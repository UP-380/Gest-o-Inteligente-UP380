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

module.exports = {
  getBaseConhecimentoCliente,
  getBaseConhecimentoBulkSummary
};

