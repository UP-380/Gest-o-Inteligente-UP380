// =============================================================
// === UTILITÁRIO PARA SUPABASE STORAGE - DOCUMENTOS ===
// =============================================================

const supabase = require('../config/database');
const path = require('path');

// Tipos MIME permitidos para documentos
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif'
];

// Extensões permitidas
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif'];

/**
 * Validar tipo de arquivo permitido
 * @param {string} fileName - Nome do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {boolean} True se permitido
 */
function validateDocumentType(fileName, mimeType) {
  const ext = path.extname(fileName).toLowerCase();
  const isValidExtension = ALLOWED_EXTENSIONS.includes(ext);
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(mimeType);
  
  return isValidExtension && isValidMimeType;
}

/**
 * Sanitizar nome do arquivo para evitar caracteres especiais
 * @param {string} fileName - Nome original do arquivo
 * @returns {string} Nome sanitizado
 */
function sanitizeFileName(fileName) {
  // Remover caracteres especiais e espaços, manter apenas alfanuméricos, pontos, hífens e underscores
  const baseName = path.basename(fileName, path.extname(fileName));
  const ext = path.extname(fileName);
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100); // Limitar tamanho
  
  return sanitized + ext;
}

/**
 * Gerar caminho do arquivo no storage
 * @param {string} clienteId - ID do cliente
 * @param {string} tipoDocumento - Tipo do documento (certificado_digital, contrato, etc.)
 * @param {string} fileName - Nome do arquivo
 * @returns {string} Caminho completo no storage
 */
function generateStoragePath(clienteId, tipoDocumento, fileName) {
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(fileName);
  return `cliente-${clienteId}/${tipoDocumento}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Upload de documento para o Supabase Storage
 * @param {Buffer} fileBuffer - Buffer do arquivo (de multer.memoryStorage())
 * @param {string} clienteId - ID do cliente
 * @param {string} tipoDocumento - Tipo do documento
 * @param {string} fileName - Nome original do arquivo
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {Promise<{path: string, fullPath: string, publicUrl: string}>}
 */
async function uploadDocumentToStorage(fileBuffer, clienteId, tipoDocumento, fileName, mimeType) {
  try {
    // Validar tipo de arquivo
    if (!validateDocumentType(fileName, mimeType)) {
      throw new Error(`Tipo de arquivo não permitido. Tipos permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    // Gerar caminho no storage
    const storagePath = generateStoragePath(clienteId, tipoDocumento, fileName);
    const bucketName = 'cliente-documentos';

    // Fazer upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false, // Não substituir automaticamente
        cacheControl: '3600' // Cache por 1 hora
      });

    if (error) {
      console.error('❌ Erro ao fazer upload do documento para Supabase Storage:', error);
      throw error;
    }

    // Obter URL do documento (signed URL para documentos privados)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 3600); // URL válida por 1 hora

    if (urlError) {
      console.error('⚠️ Aviso ao gerar URL assinada:', urlError);
      // Tentar URL pública como fallback (se o bucket for público)
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);
      
      return {
        path: data.path,
        fullPath: `${bucketName}/${data.path}`,
        publicUrl: publicUrlData.publicUrl
      };
    }

    console.error(`✅ Documento enviado para Supabase Storage: ${storagePath}`);

    return {
      path: data.path,
      fullPath: `${bucketName}/${data.path}`,
      publicUrl: urlData.signedUrl
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload de documento:', error);
    throw error;
  }
}

/**
 * Deletar documento do Supabase Storage
 * @param {string} storagePath - Caminho do arquivo no storage
 * @returns {Promise<boolean>} True se deletado com sucesso
 */
async function deleteDocumentFromStorage(storagePath) {
  try {
    const bucketName = 'cliente-documentos';
    
    // Extrair apenas o nome do arquivo do caminho completo
    const fileName = storagePath.includes('/') 
      ? storagePath.split('/').slice(1).join('/') 
      : storagePath;

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('❌ Erro ao deletar documento do Supabase Storage:', error);
      // Não lançar erro se o arquivo não existir
      if (!error.message.includes('not found') && !error.message.includes('No such file')) {
        throw error;
      }
      return false;
    }

    console.error(`✅ Documento deletado do Supabase Storage: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar documento:', error);
    return false;
  }
}

/**
 * Obter URL assinada do documento (para acesso temporário)
 * @param {string} storagePath - Caminho do arquivo no storage
 * @param {number} expiresIn - Tempo de expiração em segundos (padrão: 3600 = 1 hora)
 * @returns {Promise<string|null>} URL assinada ou null se erro
 */
async function getDocumentUrl(storagePath, expiresIn = 3600) {
  try {
    const bucketName = 'cliente-documentos';
    if (!storagePath || typeof storagePath !== 'string') {
      return null;
    }
    const pathInBucket = storagePath.trim();

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(pathInBucket, expiresIn);

    if (error) {
      // 404 = arquivo não existe no Storage (foi removido ou path incorreto) - não inundar o log
      if (error.statusCode === '404' || error.message?.includes('not found')) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`⚠️ Documento não encontrado no Storage: ${pathInBucket}`);
        }
      } else {
        console.error('❌ Erro ao gerar URL assinada do documento:', error.message, pathInBucket);
      }
      return null;
    }

    return data?.signedUrl ?? null;
  } catch (error) {
    if (error?.statusCode === '404' || error?.message?.includes('not found')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ Documento não encontrado no Storage:`, storagePath);
      }
    } else {
      console.error('❌ Erro ao obter URL do documento:', error?.message);
    }
    return null;
  }
}

/**
 * Obter URL pública do documento (se o bucket for público)
 * @param {string} storagePath - Caminho do arquivo no storage
 * @returns {string} URL pública
 */
function getDocumentPublicUrl(storagePath) {
  const bucketName = 'cliente-documentos';
  const pathInBucket = (storagePath && typeof storagePath === 'string') ? storagePath.trim() : '';
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(pathInBucket);
  return data.publicUrl;
}

/**
 * Verificar se um arquivo pode ser visualizado diretamente (preview)
 * @param {string} mimeType - Tipo MIME do arquivo
 * @returns {boolean} True se pode ser visualizado
 */
function canPreviewDocument(mimeType) {
  const previewableTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif'
  ];
  
  return previewableTypes.includes(mimeType);
}

/**
 * Obter URL de preview do documento (se aplicável)
 * @param {string} storagePath - Caminho do arquivo no storage
 * @param {string} mimeType - Tipo MIME do arquivo
 * @param {number} expiresIn - Tempo de expiração em segundos
 * @returns {Promise<string|null>} URL de preview ou null
 */
async function getDocumentPreviewUrl(storagePath, mimeType, expiresIn = 3600) {
  if (!canPreviewDocument(mimeType)) {
    return null;
  }

  return await getDocumentUrl(storagePath, expiresIn);
}

module.exports = {
  uploadDocumentToStorage,
  deleteDocumentFromStorage,
  getDocumentUrl,
  getDocumentPublicUrl,
  getDocumentPreviewUrl,
  validateDocumentType,
  sanitizeFileName,
  generateStoragePath,
  canPreviewDocument,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
};
