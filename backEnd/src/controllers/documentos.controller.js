// =============================================================
// === CONTROLLER DE DOCUMENTOS (GED) ===
// =============================================================

const supabase = require('../config/database');
const multer = require('multer');
const path = require('path');
const {
  uploadDocumentToStorage,
  deleteDocumentFromStorage,
  getDocumentUrl,
  getDocumentPreviewUrl,
  canPreviewDocument,
  validateDocumentType,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
} = require('../utils/documentStorage');

// ========================================
// CONSTANTES E CONFIGURAÇÕES
// ========================================

// Tipos de documento que permitem apenas 1 por cliente (contrato liberado para múltiplos)
const TIPOS_UNICOS = ['certificado_digital', 'proposta'];

// Configurar multer para usar memória (arquivo será enviado para Supabase Storage)
const documentoFileFilter = (req, file, cb) => {
  const isValid = validateDocumentType(file.originalname, file.mimetype);
  
  if (isValid) {
    return cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido. Tipos permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

const uploadDocumento = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo
  },
  fileFilter: documentoFileFilter
});

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Validar se o ID foi fornecido
 * @param {string} id - ID a validar
 * @returns {Object|null} Objeto de erro ou null se válido
 */
function validarId(id) {
  if (!id) {
    return {
      status: 400,
      json: {
        success: false,
        error: 'ID é obrigatório'
      }
    };
  }
  return null;
}

/**
 * Verificar se documento único já existe para o cliente
 * @param {string} clienteId - ID do cliente
 * @param {string} tipoDocumento - Tipo do documento
 * @returns {Promise<boolean>} True se já existe
 */
async function documentoUnicoExiste(clienteId, tipoDocumento) {
  if (!TIPOS_UNICOS.includes(tipoDocumento)) {
    return false; // Permite múltiplos
  }

  const { data, error } = await supabase
    .from('cp_documento')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('tipo_documento', tipoDocumento)
    .eq('ativo', true)
    .limit(1);

  if (error) {
    console.error('❌ Erro ao verificar documento único:', error);
    return false;
  }

  return (data && data.length > 0);
}

// ========================================
// === GET /api/clientes/:clienteId/documentos ===
// ========================================
async function getDocumentosCliente(req, res) {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    // Verificar se cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from('cp_cliente')
      .select('id')
      .eq('id', clienteId)
      .maybeSingle();

    if (clienteError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cliente',
        details: clienteError.message
      });
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Buscar documentos do cliente
    const { data: documentos, error } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documentos',
        details: error.message
      });
    }

    // Gerar URLs assinadas para cada documento
    const documentosComUrl = await Promise.all(
      (documentos || []).map(async (doc) => {
        const url = await getDocumentUrl(doc.caminho_storage, 3600);
        return {
          ...doc,
          url_download: url
        };
      })
    );

    return res.json({
      success: true,
      data: documentosComUrl,
      count: documentosComUrl.length
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar documentos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === GET /api/documentos/:id ===
// ========================================
async function getDocumentoPorId(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    const { data: documento, error } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar documento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento',
        details: error.message
      });
    }

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Gerar URL assinada
    const url = await getDocumentUrl(documento.caminho_storage, 3600);

    return res.json({
      success: true,
      data: {
        ...documento,
        url_download: url
      }
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar documento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === POST /api/clientes/:clienteId/documentos ===
// ========================================
async function uploadDocumentoCliente(req, res) {
  try {
    const { clienteId } = req.params;
    const { tipo_documento, nome_exibicao, descricao } = req.body;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    if (!tipo_documento) {
      return res.status(400).json({
        success: false,
        error: 'Tipo do documento é obrigatório'
      });
    }

    // Validar tipo de documento
    const tiposValidos = ['certificado_digital', 'contrato', 'proposta', 'ata_reuniao', 'outros'];
    if (!tiposValidos.includes(tipo_documento)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de documento inválido. Tipos válidos: ${tiposValidos.join(', ')}`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    // Verificar se cliente existe
    const { data: cliente, error: clienteError } = await supabase
      .from('cp_cliente')
      .select('id')
      .eq('id', clienteId)
      .maybeSingle();

    if (clienteError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cliente',
        details: clienteError.message
      });
    }

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado'
      });
    }

    // Verificar se documento único já existe
    const isUnico = TIPOS_UNICOS.includes(tipo_documento);
    if (isUnico) {
      const existe = await documentoUnicoExiste(clienteId, tipo_documento);
      if (existe) {
        return res.status(400).json({
          success: false,
          error: `Já existe um documento do tipo "${tipo_documento}" para este cliente. Remova o documento existente antes de adicionar um novo.`
        });
      }
    }

    // Obter ID do usuário da sessão
    const userId = req.session?.usuario?.id || null;

    // Fazer upload para Supabase Storage
    const uploadResult = await uploadDocumentToStorage(
      req.file.buffer,
      clienteId,
      tipo_documento,
      req.file.originalname,
      req.file.mimetype
    );

    // Salvar metadados no banco
    const { data: documento, error: insertError } = await supabase
      .from('cp_documento')
      .insert({
        cliente_id: clienteId,
        tipo_documento: tipo_documento,
        nome_arquivo: req.file.originalname,
        nome_exibicao: nome_exibicao || req.file.originalname,
        descricao: descricao || null,
        tamanho_bytes: req.file.size,
        mime_type: req.file.mimetype,
        caminho_storage: uploadResult.path,
        obrigatorio: false,
        ativo: true,
        created_by: userId
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar documento no banco:', insertError);
      // Tentar deletar arquivo do storage se falhar
      await deleteDocumentFromStorage(uploadResult.path);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar documento no banco de dados',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Documento carregado e salvo com sucesso',
      data: documento
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer upload de documento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === PUT /api/documentos/:id ===
// ========================================
async function updateDocumento(req, res) {
  try {
    const { id } = req.params;
    const { nome_exibicao, descricao } = req.body;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    // Buscar documento existente
    const { data: documentoExistente, error: fetchError } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento',
        details: fetchError.message
      });
    }

    if (!documentoExistente) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Preparar dados para atualização
    const dadosAtualizacao = {};
    if (nome_exibicao !== undefined) dadosAtualizacao.nome_exibicao = nome_exibicao;
    if (descricao !== undefined) dadosAtualizacao.descricao = descricao;

    if (Object.keys(dadosAtualizacao).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar foi fornecido'
      });
    }

    // Atualizar documento
    const { data: documentoAtualizado, error: updateError } = await supabase
      .from('cp_documento')
      .update(dadosAtualizacao)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar documento:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar documento',
        details: updateError.message
      });
    }

    return res.json({
      success: true,
      message: 'Documento atualizado com sucesso',
      data: documentoAtualizado
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao atualizar documento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === DELETE /api/documentos/:id ===
// ========================================
async function deleteDocumento(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    // Buscar documento existente
    const { data: documento, error: fetchError } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento',
        details: fetchError.message
      });
    }

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Deletar arquivo do storage
    const deletadoStorage = await deleteDocumentFromStorage(documento.caminho_storage);
    if (!deletadoStorage) {
      console.error('⚠️ Aviso: Não foi possível deletar arquivo do storage, mas continuando com soft delete');
    }

    // Soft delete no banco (marcar como inativo)
    const { error: deleteError } = await supabase
      .from('cp_documento')
      .update({ ativo: false })
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Erro ao deletar documento:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar documento',
        details: deleteError.message
      });
    }

    return res.json({
      success: true,
      message: 'Documento deletado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao deletar documento:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === GET /api/documentos/:id/download ===
// ========================================
async function downloadDocumento(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    const { data: documento, error } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento',
        details: error.message
      });
    }

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    // Gerar URL assinada (válida por 1 hora)
    const url = await getDocumentUrl(documento.caminho_storage, 3600);

    if (!url) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado no Storage. O registro existe, mas o arquivo pode ter sido removido.'
      });
    }

    // Redirecionar para a URL assinada
    return res.redirect(url);
  } catch (error) {
    console.error('❌ Erro inesperado ao fazer download:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === GET /api/documentos/:id/preview ===
// ========================================
async function previewDocumento(req, res) {
  try {
    const { id } = req.params;

    const idError = validarId(id);
    if (idError) {
      return res.status(idError.status).json(idError.json);
    }

    const { data: documento, error } = await supabase
      .from('cp_documento')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar documento',
        details: error.message
      });
    }

    if (!documento) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    if (!canPreviewDocument(documento.mime_type)) {
      return res.status(400).json({
        success: false,
        error: 'Este tipo de documento não pode ser visualizado diretamente'
      });
    }

    const url = await getDocumentPreviewUrl(documento.caminho_storage, documento.mime_type, 3600);

    if (!url) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado no Storage. O registro existe, mas o arquivo pode ter sido removido.'
      });
    }

    return res.json({
      success: true,
      data: {
        url_preview: url,
        mime_type: documento.mime_type,
        nome_exibicao: documento.nome_exibicao
      }
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao gerar preview:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// ========================================
// === GET /api/clientes/:clienteId/documentos/validacao ===
// ========================================
async function validarDocumentosObrigatorios(req, res) {
  try {
    const { clienteId } = req.params;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }

    // Usar função SQL para validar documentos obrigatórios
    const { data, error } = await supabase.rpc('validar_documentos_obrigatorios', {
      p_cliente_id: clienteId
    });

    if (error) {
      console.error('❌ Erro ao validar documentos obrigatórios:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao validar documentos obrigatórios',
        details: error.message
      });
    }

    const validacao = {
      certificado_digital: false,
      contrato: false,
      proposta: false,
      completo: true
    };

    (data || []).forEach(item => {
      validacao[item.tipo_documento] = item.possui_documento;
      if (!item.possui_documento) {
        validacao.completo = false;
      }
    });

    return res.json({
      success: true,
      data: validacao,
      detalhes: data || []
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao validar documentos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

module.exports = {
  getDocumentosCliente,
  getDocumentoPorId,
  uploadDocumentoCliente,
  updateDocumento,
  deleteDocumento,
  downloadDocumento,
  previewDocumento,
  validarDocumentosObrigatorios,
  uploadDocumento // Middleware multer para upload
};
