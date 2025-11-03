// Login JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Limpar mensagens anteriores
        hideMessages();
        
        // Desabilitar botão durante o processo
        loginBtn.disabled = true;
        loginBtn.textContent = 'Entrando...';
        
        // Capturar dados do formulário
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        
        // Validação básica
        if (!email || !senha) {
            showError('Por favor, preencha todos os campos.');
            resetButton();
            return;
        }
        
        try {
            // Fazer requisição para o endpoint de login
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    senha: senha
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Login bem-sucedido
                showSuccess('Login realizado com sucesso! Redirecionando...');
                
                // Salvar dados do usuário no localStorage (opcional)
                if (data.usuario) {
                    localStorage.setItem('usuario', JSON.stringify(data.usuario));
                }
                
                // Redirecionar para o painel após um breve delay
                setTimeout(() => {
                    window.location.href = '/painel';
                }, 1500);
                
            } else {
                // Login falhou
                showError(data.message || 'Email ou senha incorretos.');
                resetButton();
            }
            
        } catch (error) {
            console.error('Erro no login:', error);
            showError('Erro de conexão. Tente novamente.');
            resetButton();
        }
    });
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }
    
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }
    
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }
    
    function resetButton() {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Entrar';
    }
    
    // Permitir login com Enter
    document.getElementById('email').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('senha').focus();
        }
    });
    
    document.getElementById('senha').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
});