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
    const { data: cliente, error: errorCliente } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino, id_cli_kamino, nome, foto_perfil')
      .eq('id', cliente_id)
      .single();

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

    // Se for avatar customizado, buscar o caminho completo da imagem
    let fotoPerfilCompleto = cliente.foto_perfil;
    if (cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-')) {
      const fs = require('fs');
      const path = require('path');
      // Usar o cliente_id do parâmetro, não do foto_perfil
      const customDir = process.env.NODE_ENV === 'production'
        ? '/app/frontEnd/public/assets/images/avatars/clientes'
        : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
      
      if (fs.existsSync(customDir)) {
        try {
          const files = fs.readdirSync(customDir);
          const clienteFiles = files.filter(file => file.startsWith(`cliente-${cliente_id}-`));
          
          if (clienteFiles.length > 0) {
            // Ordenar por timestamp (mais recente primeiro)
            clienteFiles.sort((a, b) => {
              const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
              const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
              return timestampB - timestampA;
            });
            
            const latestFile = clienteFiles[0];
            fotoPerfilCompleto = `/assets/images/avatars/clientes/${latestFile}`;
          }
        } catch (readError) {
          // Erro ao ler diretório - usar foto_perfil original
          console.error('Erro ao ler diretório de fotos de clientes:', readError);
          fotoPerfilCompleto = cliente.foto_perfil;
        }
      }
    }

    // Adicionar caminho completo se for customizado
    if (fotoPerfilCompleto !== cliente.foto_perfil) {
      cliente.foto_perfil_path = fotoPerfilCompleto;
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
      foto_perfil: cliente.foto_perfil,
      foto_perfil_path: cliente.foto_perfil_path
    };

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
        .eq('cliente_id', cliente_id)
        .order('created_at', { ascending: false }),
      
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
        .eq('cliente_id', cliente_id)
        .order('created_at', { ascending: false }),
      
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
        .order('created_at', { ascending: false })
    ]);

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

