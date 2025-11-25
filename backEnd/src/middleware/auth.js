// =============================================================
// === MIDDLEWARE DE AUTENTICAÇÃO ===
// =============================================================

function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  } else {
    // Sempre retornar JSON para requisições /api
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acesso negado. Faça login primeiro.',
        message: 'Acesso negado. Faça login primeiro.',
        redirect: '/login'
      });
    }
    // Se for uma requisição AJAX/API, retornar JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Acesso negado. Faça login primeiro.',
        message: 'Acesso negado. Faça login primeiro.',
        redirect: '/login'
      });
    }
    // Se for uma requisição normal, redirecionar para login
    return res.redirect('/login');
  }
}

// Middleware para bloquear acesso direto a páginas HTML protegidas
function protectHTMLPages(req, res, next) {
  // Verificar se é uma requisição direta para páginas HTML protegidas
  if (req.path.endsWith('.html') && 
      req.path.includes('dashboard.html')) {
    
    // Verificar se o usuário está autenticado
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login');
    }
  }
  next();
}

module.exports = {
  requireAuth,
  protectHTMLPages
};

