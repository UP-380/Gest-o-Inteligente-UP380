// Configuração de Clientes JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Página de configuração de clientes carregada');
    loadClientes();
});

// Função para carregar lista de clientes
async function loadClientes() {
    const loadingMessage = document.getElementById('loading-message');
    const clientesList = document.getElementById('clientes-list');
    const errorMessage = document.getElementById('error-message');
    
    try {
        // Mostrar loading
        loadingMessage.style.display = 'block';
        clientesList.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Buscar clientes da API
        const response = await fetch('/api/clientes-clickup', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar clientes');
        }
        
        const result = await response.json();
        
        if (result.success && result.data && Array.isArray(result.data)) {
            // Esconder loading
            loadingMessage.style.display = 'none';
            
            // Limpar lista anterior
            clientesList.innerHTML = '';
            
            // Criar elementos para cada cliente
            result.data.forEach((nomeCliente, index) => {
                const clienteItem = document.createElement('div');
                clienteItem.className = 'cliente-item';
                clienteItem.innerHTML = `
                    <span class="cliente-nome">${nomeCliente}</span>
                `;
                clientesList.appendChild(clienteItem);
            });
            
            // Mostrar lista
            clientesList.style.display = 'block';
            
            console.log(`✅ ${result.data.length} clientes carregados`);
        } else {
            throw new Error('Formato de resposta inválido');
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        
        // Esconder loading
        loadingMessage.style.display = 'none';
        
        // Mostrar erro
        errorMessage.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erro ao carregar clientes. Por favor, tente novamente.</p>
            </div>
        `;
        errorMessage.style.display = 'block';
    }
}



