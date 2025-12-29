// =============================================================
// === CONTROLLER DE CLIENTES ===
// =============================================================

const supabase = require('../config/database');
const { clearCache } = require('../config/cache');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer para upload de fotos de clientes
const getClienteUploadPath = () => {
  if (process.env.UPLOAD_CLIENTE_AVATAR_PATH) {
    return process.env.UPLOAD_CLIENTE_AVATAR_PATH;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return '/app/frontEnd/public/assets/images/avatars/clientes';
  }
  
  return path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
};

const clienteStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadPath = getClienteUploadPath();
      
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true, mode: 0o755 });
      }
      
      fs.accessSync(uploadPath, fs.constants.W_OK);
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    try {
      const clienteId = req.params.clienteId || 'unknown';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `cliente-${clienteId}-${timestamp}${ext}`);
    } catch (error) {
      cb(error);
    }
  }
});

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
  storage: clienteStorage,
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

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
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

    // Deletar fotos de perfil customizadas do cliente
    const fs = require('fs');
    const path = require('path');
    const customDir = process.env.NODE_ENV === 'production'
      ? '/app/frontEnd/public/assets/images/avatars/clientes'
      : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');

    if (fs.existsSync(customDir)) {
      try {
        const files = fs.readdirSync(customDir);
        const idStr = String(id);
        const clienteFiles = files.filter(file => file.startsWith(`cliente-${idStr}-`));
        
        clienteFiles.forEach(file => {
          const filePath = path.join(customDir, file);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Foto removida: ${file}`);
            }
          } catch (unlinkError) {
            console.error(`⚠️ Erro ao deletar foto ${file}:`, unlinkError);
          }
        });
      } catch (readError) {
        console.error('❌ Erro ao limpar fotos:', readError);
      }
    }

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
// === GET /api/clientes ===
// ========================================
async function getCarteiraClientes(req, res) {
  console.log('📡 Endpoint /api/clientes chamado');
  try {
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
      .select('*');

    let countQuery = supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id', { count: 'exact', head: true });

    if (search) {
      const ilike = `%${search}%`;
      baseQuery = baseQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
      countQuery = countQuery.or(`nome.ilike.${ilike},razao_social.ilike.${ilike},nome_fantasia.ilike.${ilike},nome_amigavel.ilike.${ilike}`);
    }

    // Removida validação de status e incompletos - sempre retorna todos os clientes

    baseQuery = baseQuery.order('razao_social', { ascending: true }).range(offset, offset + limit - 1);

    const [{ data, error: dataErr }, { count, error: countErr }] = await Promise.all([
      baseQuery,
      countQuery
    ]);

    if (dataErr || countErr) {
      const err = dataErr || countErr;
      console.error('Erro na carteira de clientes:', err);
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }

    // Processar fotos de perfil customizadas
    const fs = require('fs');
    const path = require('path');
    const customDir = process.env.NODE_ENV === 'production'
      ? '/app/frontEnd/public/assets/images/avatars/clientes'
      : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
    
    // Buscar todas as fotos de uma vez para melhor performance
    let fotosMap = {};
    if (fs.existsSync(customDir)) {
      try {
        const files = fs.readdirSync(customDir);
        // Criar um mapa de cliente_id -> arquivo mais recente
        // Formato do arquivo: cliente-{uuid}-{timestamp}.{ext}
        files.forEach(file => {
          // Regex para capturar UUID completo (com hífens) e timestamp
          const match = file.match(/^cliente-(.+?)-(\d+)\./);
          if (match) {
            const clienteId = String(match[1]); // UUID completo como string
            const timestamp = parseInt(match[2] || '0');
            
            if (!fotosMap[clienteId] || timestamp > parseInt(fotosMap[clienteId].match(/-(\d+)\./)?.[1] || '0')) {
              fotosMap[clienteId] = file;
            }
          }
        });
      } catch (readError) {
        console.error('❌ Erro ao ler diretório de fotos:', readError);
      }
    }
    
    const clientesProcessados = (data || []).map(cliente => {
      // Criar uma cópia do cliente para não modificar o original
      const clienteProcessado = { ...cliente };
      
      // Se for avatar customizado, buscar o caminho completo da imagem
      if (cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-')) {
        // Garantir que o ID seja string para comparação
        const clienteIdStr = String(cliente.id);
        const fotoFile = fotosMap[clienteIdStr];
        if (fotoFile) {
          clienteProcessado.foto_perfil_path = `/assets/images/avatars/clientes/${fotoFile}`;
        }
      }
      return clienteProcessado;
    });

    const totalPages = Math.max(1, Math.ceil((count || 0) / limit));
    return res.json({
      success: true,
      data: clientesProcessados,
      count: clientesProcessados.length,
      total: count || 0,
      page,
      limit,
      totalPages
    });
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
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
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
    
    // Se estava usando foto customizada e mudou para avatar padrão, limpar fotos antigas
    if (clienteAntesUpdate?.foto_perfil && 
        clienteAntesUpdate.foto_perfil.startsWith('custom-') && 
        foto_perfil && 
        !foto_perfil.startsWith('custom-')) {
      // Mudou de foto customizada para avatar padrão - limpar fotos antigas
      const fs = require('fs');
      const path = require('path');
      const customDir = process.env.NODE_ENV === 'production'
        ? '/app/frontEnd/public/assets/images/avatars/clientes'
        : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
      
      if (fs.existsSync(customDir)) {
        try {
          const files = fs.readdirSync(customDir);
          const idStr = String(id);
          const clienteFiles = files.filter(file => file.startsWith(`cliente-${idStr}-`));
          
          // Deletar todas as fotos antigas do cliente
          clienteFiles.forEach(file => {
            const filePath = path.join(customDir, file);
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Foto antiga removida (mudança para avatar padrão): ${file}`);
              }
            } catch (unlinkError) {
              console.error(`⚠️ Erro ao deletar foto antiga ${file}:`, unlinkError);
            }
          });
        } catch (readError) {
          console.error('❌ Erro ao limpar fotos antigas:', readError);
        }
      }
    }
    
    // Buscar foto_perfil_path se for foto customizada
    let fotoPerfilPath = null;
    if (clienteAtualizado.foto_perfil && clienteAtualizado.foto_perfil.startsWith('custom-')) {
      const fs = require('fs');
      const path = require('path');
      const customDir = process.env.NODE_ENV === 'production'
        ? '/app/frontEnd/public/assets/images/avatars/clientes'
        : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
      
      if (fs.existsSync(customDir)) {
        try {
          const files = fs.readdirSync(customDir);
          const idStr = String(id);
          const clienteFiles = files.filter(file => file.startsWith(`cliente-${idStr}-`));
          
          if (clienteFiles.length > 0) {
            // Ordenar por timestamp (mais recente primeiro)
            clienteFiles.sort((a, b) => {
              const timestampA = parseInt(a.match(/-(\d+)\./)?.[1] || '0');
              const timestampB = parseInt(b.match(/-(\d+)\./)?.[1] || '0');
              return timestampB - timestampA;
            });
            
            const latestFile = clienteFiles[0];
            fotoPerfilPath = `/assets/images/avatars/clientes/${latestFile}`;
          }
        } catch (readError) {
          console.error('❌ Erro ao buscar foto_perfil_path:', readError);
        }
      }
    }
    
    // Adicionar foto_perfil_path ao retorno
    const clienteRetorno = { ...clienteAtualizado };
    if (fotoPerfilPath) {
      clienteRetorno.foto_perfil_path = fotoPerfilPath;
    }
    
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
// === GET /api/clientes/:id ===
// ========================================
async function getClientePorId(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    console.log('📡 Buscando cliente por ID:', id);

    const { data: cliente, error } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome, razao_social, nome_fantasia, nome_amigavel, cpf_cnpj, status, nome_cli_kamino, id_cli_kamino, foto_perfil')
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

    // Se for avatar customizado, buscar o caminho completo da imagem
    let fotoPerfilCompleto = cliente.foto_perfil;
    if (cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-')) {
      const fs = require('fs');
      const path = require('path');
      const customDir = process.env.NODE_ENV === 'production'
        ? '/app/frontEnd/public/assets/images/avatars/clientes'
        : path.join(__dirname, '../../../frontEnd/public/assets/images/avatars/clientes');
      
      if (fs.existsSync(customDir)) {
        try {
          const files = fs.readdirSync(customDir);
          // Garantir que o ID seja string para comparação
          const idStr = String(id);
          const clienteFiles = files.filter(file => file.startsWith(`cliente-${idStr}-`));
          
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
          console.error('❌ Erro ao ler diretório de fotos de clientes:', readError);
          fotoPerfilCompleto = cliente.foto_perfil;
        }
      }
    }

    // Usar nome_amigavel se disponível, senão nome_fantasia, senão razao_social
    const nomeExibicao = cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Cliente';

    const clienteCompleto = {
      ...cliente,
      nome: nomeExibicao
    };

    // Adicionar caminho completo se for customizado
    if (fotoPerfilCompleto !== cliente.foto_perfil) {
      clienteCompleto.foto_perfil_path = fotoPerfilCompleto;
    }

    return res.json({
      success: true,
      data: {
        cliente: clienteCompleto
      }
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar cliente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// ========================================
// === POST /api/clientes/:clienteId/upload-foto ===
// ========================================
async function uploadClienteFotoPerfil(req, res) {
  let uploadedFilePath = null;
  
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

    uploadedFilePath = req.file.path;
    if (!fs.existsSync(uploadedFilePath)) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar arquivo no servidor'
      });
    }

    // Ajustar permissões do arquivo
    try {
      fs.chmodSync(uploadedFilePath, 0o644);
    } catch (chmodError) {
      // Não falhar o upload por causa disso
    }

    // Caminho relativo da imagem
    const imagePath = `/assets/images/avatars/clientes/${req.file.filename}`;
    
    // ID único para a imagem customizada
    const customFotoId = `custom-${clienteId}`;

    // Buscar dados do cliente
    const { data: clienteAtual, error: clienteError } = await supabase
      .schema('up_gestaointeligente')
      .from('cp_cliente')
      .select('id, nome_fantasia, razao_social, nome_amigavel, foto_perfil')
      .eq('id', clienteId)
      .maybeSingle();

    if (clienteError) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (unlinkError) {
          // Ignorar erro ao deletar
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar upload',
        details: clienteError.message
      });
    }

    if (!clienteAtual) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (unlinkError) {
          // Ignorar erro ao deletar
        }
      }
      
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Retornar dados com o ID da foto customizada (sem atualizar o banco ainda)
    res.json({
      success: true,
      message: 'Foto carregada com sucesso. Clique em "Salvar" para confirmar.',
      cliente: {
        ...clienteAtual,
        foto_perfil: customFotoId
      },
      imagePath: imagePath
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer upload de foto de cliente:', error);
    
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (unlinkError) {
        // Ignorar erro ao deletar
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

module.exports = {
  getClientesKamino,
  getClientesIncompletosCount,
  getCarteiraClientes,
  atualizarClientePorId,
  getClientePorId,
  deletarCliente,
  uploadClienteFotoPerfil,
  uploadClienteFoto // Exportar multer para usar nas rotas
};

