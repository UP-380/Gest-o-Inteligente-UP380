// =============================================================
// === CONTROLLER DE CLIENTES ===
// =============================================================

const supabase = require('../config/database');
const { clearCache } = require('../config/cache');
const multer = require('multer');
const path = require('path');
const { uploadImageToStorage, deleteImageFromStorage, resolveAvatarUrl } = require('../utils/storage');

// ========================================
// CONSTANTES E CONFIGURAÇÕES
// ========================================

// Campos do cliente a serem selecionados (todos os campos da tabela)
const CLIENTE_FIELDS = '*';

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Processa um cliente: resolve foto_perfil e mantém TODOS os campos originais
 * @param {Object} cliente - Dados do cliente do banco
 * @returns {Promise<Object>} Cliente processado com foto_perfil resolvido
 */
async function processarCliente(cliente) {
  if (!cliente) return null;

  // Resolver foto_perfil: se for custom-{id}, buscar URL no Storage
  let fotoPerfilUrl = cliente.foto_perfil;
  if (cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-')) {
    const resolvedUrl = await resolveAvatarUrl(cliente.foto_perfil, 'cliente');
    // Se resolveu com sucesso, usar a URL; caso contrário, manter o custom-{id} para o frontend resolver
    if (resolvedUrl) {
      fotoPerfilUrl = resolvedUrl;
    }
    // Se não resolveu, mantém o custom-{id} original para o frontend tentar resolver
  }

  // Retornar TODOS os campos originais do cliente + foto_perfil resolvida
  // NÃO sobrescrever nenhum campo para preservar os dados originais
  return {
    ...cliente,
    foto_perfil: fotoPerfilUrl // URL resolvida ou custom-{id} ou valor original
  };
}

/**
 * Valida se o ID foi fornecido
 * @param {string} id - ID a validar
 * @returns {Object|null} Objeto de erro ou null se válido
 */
function validarId(id) {
  if (!id) {
    return {
      status: 400,
      json: {
        success: false,
        error: 'ID do cliente é obrigatório'
      }
    };
  }
  return null;
}

// Configurar multer para usar memória (arquivo será enviado para Supabase Storage)
const clienteFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF, WEBP)'));
  }
};

const uploadClienteFoto = multer({
  storage: multer.memoryStorage(), // Usar memória para enviar para Supabase Storage
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB máximo
  },
  fileFilter: clienteFileFilter
});

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
// === DELETE /api/clientes/:id ===
// ========================================
async function deletarCliente(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    console.log('🗑️ Deletando cliente com ID:', id);

    // Verificar se o cliente existe
    const { data: clienteExistente, error: checkError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome, razao_social, nome_fantasia')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Erro ao verificar cliente:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar cliente',
        details: checkError.message
      });
    }

    if (!clienteExistente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Verificar se há relacionamentos (contratos, sistemas, contas bancárias, adquirentes)
    const [
      { count: countContratos },
      { count: countSistemas },
      { count: countContas },
      { count: countAdquirentes }
    ] = await Promise.all([
      supabase.schema('up_gestaointeligente').from('contratos_clientes').select('*', { count: 'exact', head: true }).eq('id_cliente', id),
      supabase.schema('up_gestaointeligente').from('cliente_sistema').select('*', { count: 'exact', head: true }).eq('cliente_id', id),
      supabase.schema('up_gestaointeligente').from('cliente_conta_bancaria').select('*', { count: 'exact', head: true }).eq('cliente_id', id),
      supabase.schema('up_gestaointeligente').from('cliente_adquirente').select('*', { count: 'exact', head: true }).eq('cliente_id', id)
    ]);

    const temRelacionamentos = (countContratos || 0) > 0 || 
                                (countSistemas || 0) > 0 || 
                                (countContas || 0) > 0 || 
                                (countAdquirentes || 0) > 0;

    if (temRelacionamentos) {
      return res.status(409).json({
        success: false,
        error: 'Não é possível deletar cliente com relacionamentos ativos',
        message: 'O cliente possui contratos, sistemas, contas bancárias ou adquirentes vinculados. Remova os relacionamentos antes de deletar.',
        details: {
          contratos: countContratos || 0,
          sistemas: countSistemas || 0,
          contas: countContas || 0,
          adquirentes: countAdquirentes || 0
        }
      });
    }

    // Nota: Fotos estão no Supabase Storage e são gerenciadas via metadados
    // Não é necessário limpar arquivos do sistema de arquivos

    // Deletar do banco
    const { error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao deletar cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar cliente',
        details: error.message
      });
    }

    // Limpar cache relacionado
    clearCache('clientes');

    console.log('✅ Cliente deletado com sucesso:', clienteExistente.nome || clienteExistente.razao_social);

    return res.json({
      success: true,
      message: 'Cliente deletado com sucesso',
      data: {
        id: clienteExistente.id,
        nome: clienteExistente.nome || clienteExistente.razao_social
      }
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// ========================================
// === GET /api/clientes OU /api/clientes/:id ===
// Endpoint unificado que:
// - Com ID: retorna cliente específico
// - Sem ID: retorna lista paginada com filtros
// Ambos usam o mesmo processamento (processarCliente)
// ========================================
async function getClientes(req, res) {
  console.log('\n\n\n');
  console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');
  console.log('🚀 ========== GETCLIENTES CHAMADO ==========');
  console.log('🚀 URL:', req.url);
  console.log('🚀 METHOD:', req.method);
  console.log('🚀 req.params:', JSON.stringify(req.params));
  console.log('🚀 req.query:', JSON.stringify(req.query));
  console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀');
  console.log('\n\n\n');
  
  try {
    const { id } = req.params;

    // ============================================
    // CASO 1: BUSCAR CLIENTE ESPECÍFICO POR ID
    // ============================================
    if (id) {
      console.log('🔍 Entrando no caso 1: BUSCAR POR ID');
      const idError = validarId(id);
      if (idError) {
        return res.status(idError.status).json(idError.json);
      }

      console.log('📡 Buscando cliente por ID:', id);

      const { data: cliente, error } = await supabase
        .schema('up_gestaointeligente')
        .from('cp_cliente')
        .select(CLIENTE_FIELDS)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar cliente:', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar cliente',
          details: error.message
        });
      }

      if (!cliente) {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }

      // Processar cliente usando função auxiliar
      console.log('📥 DADOS BRUTOS DO BANCO (por ID):', cliente);
      const clienteCompleto = await processarCliente(cliente);
      console.log('📤 DADOS PROCESSADOS (por ID):', clienteCompleto);

      const resposta = {
        success: true,
        data: {
          cliente: clienteCompleto
        }
      };
      
      console.log('📨 RESPOSTA FINAL (por ID):', resposta);
      return res.json(resposta);
    }

    // ============================================
    // CASO 2: LISTAR CLIENTES COM PAGINAÇÃO E FILTROS
    // ============================================
    console.log('📋 ========== Entrando no caso 2: LISTAGEM ==========');
    console.log('📡 Endpoint /api/clientes chamado - listagem');
    
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
      .select(CLIENTE_FIELDS);

    let countQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true });

    // Aplicar filtro de busca (search)
    if (search) {
      const ilike = `%${search}%`;
      baseQuery = baseQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
      countQuery = countQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
    }

    // Aplicar filtro de status
    if (status && status !== 'todos') {
      baseQuery = baseQuery.eq('status', status);
      countQuery = countQuery.eq('status', status);
    }

    // Ordenar e paginar
    baseQuery = baseQuery.order('razao_social', { ascending: true }).range(offset, offset + limit - 1);

    const [{ data, error: dataErr }, { count, error: countErr }] = await Promise.all([
      baseQuery,
      countQuery
    ]);

    if (dataErr || countErr) {
      const err = dataErr || countErr;
      console.error('Erro ao listar clientes:', err);
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }

    // Processar todos os clientes usando a mesma função auxiliar
    console.log('🔄 Processando', data.length, 'clientes...');
    console.log('📥 DADOS BRUTOS DO BANCO (primeiro cliente):', data[0]);
    
    const clientesProcessados = await Promise.all((data || []).map(async (cliente) => {
      const processado = await processarCliente(cliente);
      return processado;
    }));

    console.log('📤 DADOS PROCESSADOS (primeiro cliente):', clientesProcessados[0]);
    console.log('✅ Total de clientes processados:', clientesProcessados.length);

    const totalPages = Math.max(1, Math.ceil((count || 0) / limit));
    
    const resposta = {
      success: true,
      data: clientesProcessados,
      count: clientesProcessados.length,
      total: count || 0,
      page,
      limit,
      totalPages
    };
    
    console.log('📨 RESPOSTA FINAL (estrutura):', {
      success: resposta.success,
      dataLength: resposta.data.length,
      primeiroCliente: resposta.data[0]
    });
    
    return res.json(resposta);
  } catch (e) {
    console.error('Erro no endpoint /api/clientes:', e);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
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
      id_cli_kamino,
      foto_perfil
    } = req.body;
    
    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
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
    // Buscar status atual antes de atualizar (para sincronizar com contratos se mudar)
    const { data: clienteStatusAtual, error: statusError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    
    const statusAnterior = clienteStatusAtual?.status;
    const statusNovo = status !== undefined && status !== null ? status.trim() : null;
    const statusMudou = statusNovo && statusAnterior !== statusNovo;
    
    if (status !== undefined && status !== null) {
      dadosUpdate.status = status.trim() || null;
    }
    if (nome_cli_kamino !== undefined && nome_cli_kamino !== null) {
      dadosUpdate.nome_cli_kamino = nome_cli_kamino.trim() || null;
    }
    if (id_cli_kamino !== undefined && id_cli_kamino !== null) {
      dadosUpdate.id_cli_kamino = id_cli_kamino.trim() || null;
    }
    // Buscar foto_perfil atual antes de atualizar (para limpar fotos antigas se necessário)
    const { data: clienteAntesUpdate, error: fetchError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('foto_perfil')
      .eq('id', id)
      .maybeSingle();
    
    if (foto_perfil !== undefined && foto_perfil !== null) {
      dadosUpdate.foto_perfil = foto_perfil.trim() || null;
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
    
    // Nota: Fotos estão no Supabase Storage e são gerenciadas via metadados
    // Se mudou para avatar padrão, o Storage será limpo na próxima atualização de foto
    
    // Retornar cliente atualizado
    const clienteRetorno = { ...clienteAtualizado };
    
    // Se o status mudou, sincronizar com contratos_clientes
    if (statusMudou && statusNovo) {
      try {
        await supabase
          .schema('up_gestaointeligente')
          .from('contratos_clientes')
          .update({ status_cliente: statusNovo })
          .eq('id_cliente', id);
        console.log(`Status_cliente sincronizado para ${statusNovo.toUpperCase()} em contratos_clientes:`, id);
      } catch (syncErr) {
        console.warn('Falha ao sincronizar status_cliente:', syncErr);
      }
    }
    
    // Limpar cache relacionado
    clearCache('clientes');
    
    console.log('✅ Cliente atualizado com sucesso:', clienteExistente.nome);
    
    res.json({
      success: true,
      message: 'Cliente atualizado com sucesso',
      cliente: clienteRetorno
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
// === GET /api/clientes/:id (ALIAS) ===
// Mantido por compatibilidade - apenas chama getClientes
// ========================================
const getClientePorId = getClientes;

// ========================================
// === POST /api/clientes/:clienteId/upload-foto ===
// ========================================
async function uploadClienteFotoPerfil(req, res) {
  try {
    const clienteId = req.params.clienteId;
    
    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada'
      });
    }

    // Buscar dados do cliente primeiro para validar
    const { data: clienteAtual, error: clienteError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome_fantasia, razao_social, nome_amigavel, foto_perfil')
      .eq('id', clienteId)
      .maybeSingle();

    if (clienteError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar upload',
        details: clienteError.message
      });
    }

    if (!clienteAtual) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Preparar nome do arquivo para o Supabase Storage
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `cliente-${clienteId}-${timestamp}${ext}`;
    const bucketName = 'cliente-avatars';

    // Deletar avatares antigos do cliente no storage
    const { deleteOldAvatarFiles } = require('../utils/storage');
    await deleteOldAvatarFiles(bucketName, clienteId, 'cliente');

    // Fazer upload para Supabase Storage
    const uploadResult = await uploadImageToStorage(
      req.file.buffer,
      bucketName,
      fileName,
      req.file.mimetype
    );

    // Salvar identificador customizado no banco (custom-{id}) ao invés da URL completa
    const customFotoId = `custom-${clienteId}`;
    
    const { error: updateError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .update({ foto_perfil: customFotoId })
      .eq('id', clienteId);

    if (updateError) {
      console.error('❌ Erro ao atualizar foto_perfil no banco:', updateError);
      // Tentar deletar o arquivo do storage se falhar
      await deleteImageFromStorage(bucketName, fileName);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar foto no banco de dados',
        details: updateError.message
      });
    }

    // Retornar dados com o identificador customizado e a URL para preview
    res.json({
      success: true,
      message: 'Foto carregada e salva com sucesso.',
      cliente: {
        ...clienteAtual,
        foto_perfil: customFotoId // Identificador customizado
      },
      imagePath: uploadResult.publicUrl // URL pública para preview imediato
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer upload de foto de cliente:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === GET /api/clientes/:id/custom-avatar-path ===
// ========================================
async function getClienteCustomAvatarPath(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    const customId = `custom-${id}`;

    // Buscar URL do avatar customizado no Supabase Storage usando metadados
    const avatarUrl = await resolveAvatarUrl(customId, 'cliente');

    if (!avatarUrl) {
      return res.json({
        success: false,
        imagePath: null
      });
    }

    res.json({
      success: true,
      imagePath: avatarUrl
    });
  } catch (error) {
    console.error('Erro ao buscar caminho do avatar customizado do cliente:', error);
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
  getClientes,
  atualizarClientePorId,
  getClientePorId,
  deletarCliente,
  uploadClienteFotoPerfil,
  uploadClienteFoto, // Exportar multer para usar nas rotas
  getClienteCustomAvatarPath
};

