// =============================================================
// === UTILITÁRIO PARA SUPABASE STORAGE ===
// =============================================================

const supabase = require('../config/database');

/**
 * Upload de imagem de perfil para o Supabase Storage com metadados
 * @param {Buffer} fileBuffer - Buffer do arquivo (de multer.memoryStorage())
 * @param {string} bucketName - Nome do bucket ('avatars' para usuários ou 'cliente-avatars' para clientes)
 * @param {string} fileName - Nome do arquivo (ex: 'user-123-1234567890.jpg')
 * @param {string} contentType - Tipo MIME da imagem (ex: 'image/jpeg')
 * @param {object} metadata - Metadados customizados { entityId: string, entityType: 'user'|'cliente' }
 * @returns {Promise<{publicUrl: string, path: string, fullPath: string}>}
 */
async function uploadImageToStorage(fileBuffer, bucketName, fileName, contentType = 'image/jpeg', metadata = {}) {
  try {
    // Deletar arquivos antigos do mesmo usuário/cliente usando metadados
    if (metadata.entityId && metadata.entityType) {
      await deleteOldAvatarFiles(bucketName, metadata.entityId, metadata.entityType);
    }

    // Preparar metadados para o arquivo
    // O Supabase Storage aceita metadados customizados via headers
    const metadataHeaders = {};
    if (metadata.entityId) {
      metadataHeaders['x-entity-id'] = metadata.entityId;
    }
    if (metadata.entityType) {
      metadataHeaders['x-entity-type'] = metadata.entityType;
    }

    // Fazer upload para o Supabase Storage com metadados
    // Nota: O Supabase Storage não suporta metadados customizados diretamente no upload
    // Vamos usar uma abordagem alternativa: salvar metadados no nome do arquivo ou usar uma tabela de metadados
    // Por enquanto, vamos usar a convenção de nomenclatura: {type}-{id}-{timestamp}.{ext}
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: contentType,
        upsert: true, // Substituir se já existir
        cacheControl: '3600' // Cache por 1 hora
      });

    if (error) {
      console.error('❌ Erro ao fazer upload para Supabase Storage:', error);
      throw error;
    }

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    console.error(`✅ Imagem enviada para Supabase Storage: ${publicUrl}`);

    return {
      publicUrl: publicUrl,
      path: data.path,
      fullPath: `${bucketName}/${data.path}`
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload de imagem:', error);
    throw error;
  }
}

/**
 * Deletar arquivos antigos de avatar usando metadados implícitos (nome do arquivo)
 * @param {string} bucketName - Nome do bucket
 * @param {string} entityId - ID do usuário ou cliente
 * @param {string} entityType - Tipo: 'user' ou 'cliente'
 */
async function deleteOldAvatarFiles(bucketName, entityId, entityType) {
  try {
    const prefix = entityType === 'cliente' ? `cliente-${entityId}-` : `user-${entityId}-`;
    
    // Listar todos os arquivos do bucket (limitar para performance)
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000
      });

    if (error) {
      console.error('⚠️ Aviso ao listar arquivos antigos:', error.message);
      return;
    }

    // Filtrar arquivos que começam com o prefixo
    const oldFiles = (files || [])
      .filter(file => file.name && file.name.startsWith(prefix))
      .map(file => file.name);

    if (oldFiles.length > 0) {
      // Deletar arquivos antigos
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove(oldFiles);

      if (deleteError) {
        console.error('⚠️ Aviso ao deletar arquivos antigos:', deleteError.message);
      } else {
        console.error(`✅ ${oldFiles.length} arquivo(s) antigo(s) deletado(s) para ${entityType} ${entityId}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Erro ao deletar arquivos antigos:', error.message);
  }
}

/**
 * Deletar imagem do Supabase Storage
 * @param {string} bucketName - Nome do bucket
 * @param {string} fileName - Nome do arquivo ou caminho
 * @returns {Promise<boolean>}
 */
async function deleteImageFromStorage(bucketName, fileName) {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('❌ Erro ao deletar imagem do Supabase Storage:', error);
      // Não lançar erro se o arquivo não existir
      if (!error.message.includes('not found')) {
        throw error;
      }
      return false;
    }

    console.error(`✅ Imagem deletada do Supabase Storage: ${bucketName}/${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar imagem:', error);
    return false;
  }
}

/**
 * Obter URL pública de uma imagem no Supabase Storage
 * @param {string} bucketName - Nome do bucket
 * @param {string} fileName - Nome do arquivo ou caminho
 * @returns {string} URL pública da imagem
 */
function getPublicUrl(bucketName, fileName) {
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);
  
  return data.publicUrl;
}

/**
 * Obter URL de avatar customizado usando metadados (convenção de nomenclatura)
 * Busca o arquivo mais recente baseado no ID da entidade (usuário ou cliente)
 * @param {string} customId - ID customizado (ex: 'custom-123' para usuário ou 'custom-456' para cliente)
 * @param {string} type - Tipo: 'user' ou 'cliente'
 * @returns {Promise<string|null>} URL pública da imagem ou null se não encontrada
 */
async function getCustomAvatarUrl(customId, type = 'user') {
  try {
    if (!customId || !customId.startsWith('custom-')) {
      return null;
    }

    const entityId = customId.replace('custom-', '');
    const bucketName = type === 'cliente' ? 'cliente-avatars' : 'avatars';
    const prefix = type === 'cliente' ? `cliente-${entityId}-` : `user-${entityId}-`;

    // Listar arquivos do bucket usando metadados implícitos (prefixo no nome)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('❌ Erro ao listar arquivos do storage:', error);
      return null;
    }

    // Filtrar arquivos que começam com o prefixo (metadados implícitos via nome do arquivo)
    // O nome do arquivo segue a convenção: {type}-{entityId}-{timestamp}.{ext}
    const entityFiles = (data || [])
      .filter(file => file.name && file.name.startsWith(prefix))
      .sort((a, b) => {
        // Ordenar por timestamp no nome do arquivo (mais recente primeiro)
        const timestampA = parseInt(a.name.match(/-(\d+)\./)?.[1] || '0');
        const timestampB = parseInt(b.name.match(/-(\d+)\./)?.[1] || '0');
        return timestampB - timestampA;
      });

    if (entityFiles.length === 0) {
      return null;
    }

    // Retornar URL pública do arquivo mais recente
    return getPublicUrl(bucketName, entityFiles[0].name);
  } catch (error) {
    console.error('❌ Erro ao obter URL do avatar customizado:', error);
    return null;
  }
}

/**
 * Resolver foto_perfil: se for custom-{id}, buscar URL no Storage usando metadados
 * @param {string} fotoPerfil - Valor do campo foto_perfil (pode ser URL completa, custom-{id}, ou avatar padrão)
 * @param {string} entityType - Tipo: 'user' ou 'cliente'
 * @returns {Promise<string|null>} URL pública da imagem ou null se não for avatar customizado
 */
async function resolveAvatarUrl(fotoPerfil, entityType = 'user') {
  try {
    // Se já é uma URL completa, retornar diretamente
    if (fotoPerfil && (fotoPerfil.startsWith('http://') || fotoPerfil.startsWith('https://'))) {
      return fotoPerfil;
    }

    // Se é custom-{id}, buscar no Storage usando metadados
    if (fotoPerfil && fotoPerfil.startsWith('custom-')) {
      return await getCustomAvatarUrl(fotoPerfil, entityType);
    }

    // Caso contrário, não é avatar customizado
    return null;
  } catch (error) {
    console.error('❌ Erro ao resolver URL do avatar:', error);
    return null;
  }
}

module.exports = {
  uploadImageToStorage,
  deleteImageFromStorage,
  getPublicUrl,
  getCustomAvatarUrl,
  resolveAvatarUrl,
  deleteOldAvatarFiles
};

