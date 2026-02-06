// =============================================================
// === MIDDLEWARE DE AUTENTICAÇÃO ===
// =============================================================

const crypto = require('crypto');
const supabase = require('../config/database');

function sendUnauthorized(res, req) {
  if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(401).json({
      success: false,
      error: 'Acesso negado. Faça login primeiro.',
      message: 'Acesso negado. Faça login primeiro.',
      redirect: '/login'
    });
  }
  return res.redirect('/login');
}

async function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const bearerMatch = authHeader && authHeader.match(/^\s*Bearer\s+(.+)\s*$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : null;

  if (token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
      const { data: tokenRow, error: tokenError } = await supabase
        .from('api_tokens')
        .select('usuario_id')
        .eq('token_hash', tokenHash)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();

      if (!tokenError && tokenRow) {
        const { data: usuario, error: userError } = await supabase
          .from('usuarios')
          .select('id, email_usuario, nome_usuario, foto_perfil, permissoes')
          .eq('id', tokenRow.usuario_id)
          .maybeSingle();

        if (!userError && usuario) {
          if (!req.session) {
            req.session = {};
          }
          req.session.usuario = {
            id: usuario.id,
            email_usuario: usuario.email_usuario,
            nome_usuario: usuario.nome_usuario,
            foto_perfil: usuario.foto_perfil || null,
            permissoes: usuario.permissoes !== undefined ? usuario.permissoes : null
          };
          return next();
        }
      }
    } catch (err) {
      console.error('Erro ao validar Bearer token:', err);
    }
  }

  return sendUnauthorized(res, req);
}

// Middleware para bloquear acesso direto a páginas HTML protegidas
function protectHTMLPages(req, res, next) {
  try {
    // Ignorar rotas de API completamente
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // Verificar se é uma requisição direta para páginas HTML protegidas
    if (req.path.endsWith('.html') &&
      req.path.includes('dashboard.html')) {

      // Verificar se o usuário está autenticado
      if (!req.session || !req.session.usuario) {
        return res.redirect('/login');
      }
    }
    next();
  } catch (error) {
    console.error('Erro no middleware protectHTMLPages:', error);
    // Em caso de erro, permitir que a requisição continue
    next();
  }
}

function requireGestor(req, res, next) {
  if (req.session && req.session.usuario &&
    (req.session.usuario.permissoes === 'administrador' || req.session.usuario.permissoes === 'gestor')) {
    return next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas gestores podem realizar esta ação.'
    });
  }
}

module.exports = {
  requireAuth,
  requireGestor,
  protectHTMLPages
};

