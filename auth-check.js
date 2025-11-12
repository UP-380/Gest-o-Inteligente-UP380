// Verificação de autenticação no lado cliente
function checkAuth() {
  // Verificar se há uma sessão ativa fazendo uma requisição para uma rota protegida
  return fetch('/api/colaboradores', {
    method: 'GET',
    credentials: 'include' // Incluir cookies de sessão
  })
  .then(response => {
    if (response.status === 401) {
      // Usuário não autenticado
      return false;
    }
    return response.ok;
  })
  .catch(() => false);
}

// Redirecionar para login se não autenticado
function requireAuth() {
  checkAuth().then(isAuthenticated => {
    if (!isAuthenticated) {
      // Salvar a URL atual para redirecionamento após login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      window.location.href = '/login';
    }
  });
}

// Executar verificação automaticamente em páginas protegidas
document.addEventListener('DOMContentLoaded', function() {
  // Lista de páginas que requerem autenticação
  const protectedPages = ['/painel', '/clientes', '/dashboard.html', '/clientes.html', '/cadastro-cliente.html'];
  const currentPath = window.location.pathname;
  
  // Se estiver em uma página protegida, verificar autenticação
  if (protectedPages.some(page => currentPath.includes(page))) {
    requireAuth();
  }
});

// Função para logout
function logout() {
  // Limpar dados locais
  sessionStorage.clear();
  localStorage.clear();
  
  // Redirecionar para login
  window.location.href = '/login';
}

// Interceptar requisições AJAX para verificar autenticação
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args)
    .then(response => {
      // Se receber 401, redirecionar para login
      if (response.status === 401) {
        const data = response.json().catch(() => ({}));
        data.then(result => {
          if (result.redirect === '/login') {
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = '/login';
          }
        });
      }
      return response;
    });
};
