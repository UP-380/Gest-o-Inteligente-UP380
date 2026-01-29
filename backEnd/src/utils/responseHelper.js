// =============================================================
// === HELPER PARA RESPOSTAS PADRONIZADAS DA API ===
// =============================================================

/**
 * Envia resposta padronizada de sucesso
 * @param {Object} res - Objeto response do Express
 * @param {Number} status - Status HTTP (padrão: 200)
 * @param {any} data - Dados a serem retornados
 * @param {String} message - Mensagem opcional
 * @param {Object} meta - Metadados opcionais (page, limit, total, count)
 */
function sendSuccess(res, status = 200, data = null, message = null, meta = {}) {
  const response = {
    success: true
  };

  if (data !== null) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  // Adicionar metadados se fornecidos
  if (meta.page !== undefined) response.page = meta.page;
  if (meta.limit !== undefined) response.limit = meta.limit;
  if (meta.total !== undefined) response.total = meta.total;
  if (meta.count !== undefined) response.count = meta.count;

  return res.status(status).json(response);
}

/**
 * Envia resposta padronizada de erro
 * @param {Object} res - Objeto response do Express
 * @param {Number} status - Status HTTP (padrão: 500)
 * @param {String} error - Mensagem de erro
 * @param {String} details - Detalhes opcionais do erro
 * @param {String} code - Código de erro opcional
 */
function sendError(res, status = 500, error, details = null, code = null) {
  const response = {
    success: false,
    error: error || 'Erro interno do servidor'
  };

  if (details) {
    response.details = details;
  }

  if (code) {
    response.code = code;
  }

  return res.status(status).json(response);
}

/**
 * Envia resposta de criação bem-sucedida (status 201)
 */
function sendCreated(res, data, message = 'Registro criado com sucesso') {
  return sendSuccess(res, 201, data, message);
}

/**
 * Envia resposta de atualização bem-sucedida (status 200)
 */
function sendUpdated(res, data, message = 'Registro atualizado com sucesso') {
  return sendSuccess(res, 200, data, message);
}

/**
 * Envia resposta de exclusão bem-sucedida (status 200)
 */
function sendDeleted(res, data = null, message = 'Registro deletado com sucesso') {
  return sendSuccess(res, 200, data, message);
}

/**
 * Envia resposta de validação (status 400)
 */
function sendValidationError(res, error, details = null) {
  return sendError(res, 400, error, details, 'VALIDATION_ERROR');
}

/**
 * Envia resposta de não encontrado (status 404)
 */
function sendNotFound(res, resource = 'Recurso') {
  return sendError(res, 404, `${resource} não encontrado`, null, 'NOT_FOUND');
}

/**
 * Envia resposta de conflito (status 409)
 */
function sendConflict(res, error, details = null) {
  return sendError(res, 409, error, details, 'CONFLICT');
}

module.exports = {
  sendSuccess,
  sendError,
  sendCreated,
  sendUpdated,
  sendDeleted,
  sendValidationError,
  sendNotFound,
  sendConflict
};

