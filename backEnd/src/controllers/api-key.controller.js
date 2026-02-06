// =============================================================
// === CONTROLLER DE CHAVE DE API (API Key / Bearer Token) ===
// =============================================================

const crypto = require('crypto');
const supabase = require('../config/database');

const TOKEN_PREFIX = 'up_';
const TOKEN_RANDOM_BYTES = 32;

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateToken() {
  return TOKEN_PREFIX + crypto.randomBytes(TOKEN_RANDOM_BYTES).toString('hex');
}

function maskToken(token) {
  if (!token || token.length < 12) return 'up_••••••••••••';
  const visibleStart = 3;
  const visibleEnd = 4;
  const middle = Math.max(0, token.length - visibleStart - visibleEnd);
  return token.slice(0, visibleStart) + '•'.repeat(Math.min(middle, 24)) + token.slice(-visibleEnd);
}

/**
 * GET /api/auth/api-key
 * Retorna se o usuário possui chave ativa e uma versão mascarada (nunca a chave em claro).
 */
async function getApiKey(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }
    const userId = req.session.usuario.id;

    const { data: row, error } = await supabase
      .from('api_tokens')
      .select('id, criado_em')
      .eq('usuario_id', userId)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar api_key:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }

    if (!row) {
      return res.json({
        success: true,
        hasKey: false
      });
    }

    return res.json({
      success: true,
      hasKey: true,
      maskedKey: TOKEN_PREFIX + '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
    });
  } catch (err) {
    console.error('Erro em getApiKey:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /api/auth/api-key
 * Gera nova chave (invalida a anterior). Retorna a chave em claro UMA vez.
 */
async function createApiKey(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }
    const userId = req.session.usuario.id;
    const nome = req.body && req.body.nome ? String(req.body.nome).trim() : null;

    await supabase
      .from('api_tokens')
      .update({ ativo: false })
      .eq('usuario_id', userId);

    const token = generateToken();
    const tokenHash = hashToken(token);

    const { data: inserted, error } = await supabase
      .from('api_tokens')
      .insert({
        usuario_id: userId,
        token_hash: tokenHash,
        nome: nome || null,
        ativo: true
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar api_key:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar chave de API'
      });
    }

    return res.json({
      success: true,
      message: 'Guarde esta chave em local seguro; ela não será mostrada novamente.',
      apiKey: token
    });
  } catch (err) {
    console.error('Erro em createApiKey:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * DELETE /api/auth/api-key
 * Revoga a chave ativa do usuário.
 */
async function revokeApiKey(req, res) {
  try {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Faça login primeiro.'
      });
    }
    const userId = req.session.usuario.id;

    const { error } = await supabase
      .from('api_tokens')
      .update({ ativo: false })
      .eq('usuario_id', userId)
      .eq('ativo', true);

    if (error) {
      console.error('Erro ao revogar api_key:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao revogar chave de API'
      });
    }

    return res.json({
      success: true,
      message: 'Chave de API revogada com sucesso.'
    });
  } catch (err) {
    console.error('Erro em revokeApiKey:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

module.exports = {
  getApiKey,
  createApiKey,
  revokeApiKey,
  hashToken,
  maskToken
};
