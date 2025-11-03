const express = require('express');
const path = require('path');
const router = express.Router();

// Middleware de autenticação para as rotas
function requireAuth(req, res, next) {
  console.log('🔐 Verificando autenticação para:', req.path);
  console.log('🔐 Sessão:', req.session);
  console.log('🔐 Usuário na sessão:', req.session ? req.session.usuario : 'Nenhum');
  
  if (req.session && req.session.usuario) {
    console.log('✅ Usuário autenticado, permitindo acesso');
    return next();
  } else {
    console.log('❌ Usuário não autenticado, redirecionando para login');
    // Se for uma requisição AJAX/API, retornar JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acesso negado. Faça login primeiro.',
        redirect: '/login'
      });
    }
    // Se for uma requisição normal, redirecionar para login
    return res.redirect('/login');
  }
}

// Rota para a página principal (index) - sem autenticação
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para o painel - COM autenticação
router.get('/painel', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Rota para voltar ao cadastro de clientes - COM autenticação
router.get('/clientes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'clientes.html'));
});

// Rota para a página de portfólio de clientes - COM autenticação
router.get('/portifolio-clientes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro-cliente.html'));
});

// Rota para a página de configuração de clientes - COM autenticação
router.get('/configuracao-clientes', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'configuracao-clientes.html'));
});

module.exports = router;