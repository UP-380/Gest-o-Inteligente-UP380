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
      .schema('up_gestaointeligente')
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
    const [sistemasResult, contasResult, adquirentesResult] = await Promise.all([
      // Buscar sistemas do cliente
      supabase
        .schema('up_gestaointeligente')
        .from('cliente_sistema')
        .select(`
          id,
          cliente_id,
          sistema_id,
          servidor,
          usuario_servidor,
          vpn,
          usuario_vpn,
          senha_vpn,
          usuario_sistema,
          senha_sistema,
          created_at,
          cp_sistema (
            id,
            nome
          )
        `)
        .eq('cliente_id', cliente_id),
      
      // Buscar contas bancárias do cliente
      supabase
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
        `)
        .eq('cliente_id', cliente_id),
      
      // Buscar adquirentes do cliente
      supabase
        .schema('up_gestaointeligente')
        .from('cliente_adquirente')
        .select(`
          *,
          cp_adquirente (
            id,
            nome
          )
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

    // Retornar dados consolidados
    const dadosConsolidados = {
      cliente: clienteFormatado || null,
      sistemas: sistemas,
      contasBancarias: contasBancarias,
      adquirentes: adquirentes
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

module.exports = {
  getBaseConhecimentoCliente
};

