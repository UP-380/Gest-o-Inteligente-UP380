console.log('App.js carregado com sucesso!');

// Variáveis globais
let allClientes = [];
let allClientesKamino = [];
let allClientesClickup = [];

// Log para verificar se o arquivo está sendo carregado
console.log('🚀🚀🚀 APP.JS CARREGADO COMPLETAMENTE! 🚀🚀🚀'); // Array de clientes Kamino
let clientesKaminoMap = new Map(); // Mapeamento nome_fantasia -> id
let clientesClickupMap = new Map(); // Mapeamento nome -> id

// Funcao para carregar clientes Kamino da API
async function loadClientesKamino() {
    try {
        console.log('Carregando clientes Kamino da API...');
        
        // Aguardar um pouco para garantir que o DOM esteja carregado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const dropdown = document.getElementById('clienteKamino-container');
        console.log('Dropdown encontrado:', !!dropdown);
        
        if (!dropdown) {
            console.error('Dropdown searchable nao encontrado!');
            return;
        }
        
        const optionsList = document.getElementById('clienteKamino-list');
        if (!optionsList) {
            console.error('Options list nao encontrada!');
            return;
        }
        
        // Limpar opcoes existentes
        optionsList.innerHTML = '';
        
        const response = await fetch('/api/clientes-kamino');
        const result = await response.json();
        
        console.log('Resposta completa da API Kamino:', result);
        console.log('result.success:', result.success);
        console.log('result.data:', result.data);
        
        if (result.success && result.data) {
            console.log('Dados recebidos:', result.data);
            console.log('Tipo dos dados:', typeof result.data);
            console.log('E array?', Array.isArray(result.data));
            console.log('Clientes completos:', result.clientes);
            
            // Armazenar todos os clientes (mantem compatibilidade)
            allClientes = result.data.filter(razaosocial => razaosocial && razaosocial.trim());
            
            // Armazenar clientes Kamino completos
            if (result.clientes && Array.isArray(result.clientes)) {
                allClientesKamino = result.clientes;
                console.log('allClientesKamino populado com:', allClientesKamino.length, 'clientes');
            } else {
                allClientesKamino = [];
            }
            
            // Criar mapeamento nome_fantasia -> id usando dados completos
            clientesKaminoMap.clear();
            console.log('=== DEBUG CRIACAO CLIENTESKAMINOMAP ===');
            console.log('result.clientes existe?', !!result.clientes);
            console.log('result.clientes é array?', Array.isArray(result.clientes));
            
            if (result.clientes && Array.isArray(result.clientes)) {
                console.log('Processando', result.clientes.length, 'clientes para mapeamento');
                let contadorMapeados = 0;
                
                result.clientes.forEach((cliente, index) => {
                    if (cliente.nome_fantasia && cliente.id) {
                        clientesKaminoMap.set(cliente.nome_fantasia, cliente.id);
                        contadorMapeados++;
                        
                        // Log dos primeiros 3 clientes para debug
                        if (index < 3) {
                            console.log(`Cliente ${index + 1}:`, {
                                nome_fantasia: cliente.nome_fantasia,
                                id: cliente.id
                            });
                        }
                    } else {
                        if (index < 3) {
                            console.log(`Cliente ${index + 1} IGNORADO:`, {
                                nome_fantasia: cliente.nome_fantasia,
                                id: cliente.id,
                                motivo: !cliente.nome_fantasia ? 'sem nome_fantasia' : 'sem id'
                            });
                        }
                    }
                });
                
                console.log('Total de clientes mapeados:', contadorMapeados);
                console.log('Tamanho do clientesKaminoMap:', clientesKaminoMap.size);
                
                // Verificar se "Fit Comercio e Locacao Ltda" está no mapa
                const fitId = clientesKaminoMap.get('Fit Comercio e Locacao Ltda');
                console.log('ID do "Fit Comercio e Locacao Ltda":', fitId);
            }
            
            console.log('Clientes Kamino carregados com sucesso!');
        } else {
            console.error('Erro ao carregar clientes Kamino:', result.message);
            allClientesKamino = [];
        }
    } catch (error) {
        console.error('Erro na requisicao de clientes Kamino:', error);
    }
}

// ===== FUNCIONALIDADES DE GERENCIAMENTO DE CLIENTES =====

// Variaveis globais para clientes
let todosClientes = [];
let clienteParaExcluir = null;
let clienteEditando = null;



// Funcao para abrir o modal de clientes
async function openClientesModal() {
    const modal = document.getElementById('clientesModal');
    if (modal) {
        modal.style.display = 'block';
        await carregarListaClientes();
    }
}

// Funcao para fechar o modal de clientes
function closeClientesModal() {
    const modal = document.getElementById('clientesModal');
    if (modal) {
        modal.style.display = 'none';
        // Fechar secao de edicao se estiver aberta
        cancelarEdicao();
    }
}

// Funcao para carregar e exibir a lista de clientes
async function carregarListaClientes() {
    try {
        const response = await fetch('/api/clientes');
        if (response.ok) {
            const result = await response.json();
            todosClientes = result.success ? result.data : [];
            renderizarListaClientes();
        } else {
            console.error('Erro ao carregar lista de clientes');
            alert('Erro ao carregar lista de clientes');
        }
    } catch (error) {
        console.error('Erro na requisicao de lista de clientes:', error);
        alert('Erro ao carregar lista de clientes');
    }
}

// Funcao para renderizar a lista de clientes
function renderizarListaClientes() {
    const clientesList = document.getElementById('clientes-list');
    if (!clientesList) return;
    
    clientesList.innerHTML = '';
    
    if (todosClientes.length === 0) {
        clientesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Nenhum cliente cadastrado</div>';
        return;
    }
    
    todosClientes.forEach(cliente => {
        const clienteItem = document.createElement('div');
        clienteItem.className = 'cliente-item';
        const statusClass = cliente.status === 'ativo' ? 'status-ativo' : 'status-inativo';
        const statusText = cliente.status === 'ativo' ? 'Ativo' : 'Inativo';
        
        clienteItem.innerHTML = `
            <div class="cliente-info">
                <div class="cliente-nome">${cliente.razao_social || 'N/A'}</div>
                <div class="cliente-detalhes">
                    ${cliente.nome_fantasia ? `${cliente.nome_fantasia}  ` : ''}
                    ${cliente.cnpj_cpf || 'N/A'}
                </div>
            </div>
            <div class="cliente-status">
                <div class="${statusClass}">${statusText}</div>
            </div>
            <div class="cliente-actions">
                <button class="btn-edit" onclick="editarCliente('${cliente.id}')" title="Editar Cliente">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="btn-delete" onclick="confirmarExclusao('${cliente.id}')" title="Excluir Cliente">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;
        clientesList.appendChild(clienteItem);
    });
}

// Funcao toggleActionsMenu removida - nao e mais necessaria

// Funcao para confirmar exclusao
function confirmarExclusao(clienteId) {
    clienteParaExcluir = clienteId;
    const modal = document.getElementById('confirmDeleteModal');
    const nomeElement = document.getElementById('delete-cliente-name');
    
    // Buscar o cliente pelo ID para obter o nome
    const cliente = todosClientes.find(c => c.id === clienteId);
    const nomeCliente = cliente ? cliente.razao_social : 'Cliente';
    
    if (nomeElement) {
        nomeElement.textContent = nomeCliente;
    }
    
    if (modal) {
        modal.style.display = 'block';
    }
    
    // Menu de acoes removido - nao e mais necessario
}

// Funcao para fechar modal de confirmacao de exclusao
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
    clienteParaExcluir = null;
}

// Funcao para confirmar e executar exclusao
async function confirmarExclusaoCliente() {
    if (!clienteParaExcluir) return;
    
    try {
        const response = await fetch(`/api/clientes/${clienteParaExcluir}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Fechar modal de confirmacao
            closeConfirmDeleteModal();
            
            // Recarregar lista
            await carregarListaClientes();
            
            // Dashboard update removed - dashboards will be in another section
            
            showSuccessMessage('Cliente excluido com sucesso!');
        } else {
            const error = await response.json();
            alert('Erro ao excluir cliente: ' + (error.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        alert('Erro ao excluir cliente');
    }
}

// Funcao para editar cliente
function editarCliente(clienteId) {
    try {
        console.log('Iniciando edicao do cliente:', clienteId);
        
        const cliente = todosClientes.find(c => c.id === clienteId);
        if (!cliente) {
            console.error('Cliente nao encontrado:', clienteId);
            return;
        }
        
        clienteEditando = cliente;
        console.log('Cliente encontrado:', cliente);
        
        // Verificar se todos os elementos existem antes de preencher
        const elementos = {
            'edit-cliente-id': cliente.id,
            'edit-razao-social': cliente.razao_social || '',
            'edit-nome-fantasia': cliente.nome_fantasia || '',
            'editNomeAmigavel': cliente.nome_amigavel || '',
            'edit-grupo': cliente.grupo || '',
            'edit-cnpj-cpf': cliente.cnpj_cpf || '',
            'edit-status': cliente.status || 'ativo',
            'edit-segmento': cliente.segmento || '',
            'edit-subsegmento': cliente.subsegmento || '',
            'edit-cliente-kamino': cliente.cliente_kamino || '',
            'edit-cliente-clickup': cliente.cliente_clickup || ''
        };
        
        // Preencher campos de edicao com verificacao
        for (const [id, valor] of Object.entries(elementos)) {
            const elemento = document.getElementById(id);
            if (elemento) {
                // Campos especiais que nao devem ser preenchidos diretamente
                if (id === 'edit-grupo' || 
                    id === 'edit-cliente-kamino' || id === 'edit-cliente-clickup') {
                    continue;
                }
                elemento.value = valor;
                console.log(`Campo ${id} preenchido com:`, valor);
            } else {
                console.error(`Elemento nao encontrado: ${id}`);
            }
        }
        
        // Configurar campos especiais de edicao
        configurarCamposEdicao(cliente);
        
        // Mostrar secao de edicao
        const editSection = document.getElementById('edit-cliente-section');
        const listContainer = document.querySelector('.clientes-list-container');
        
        if (editSection) {
            editSection.style.display = 'block';
            console.log('Secao de edicao mostrada');
        } else {
            console.error('Secao de edicao nao encontrada');
        }
        
        if (listContainer) {
            listContainer.style.display = 'none';
            console.log('Lista de clientes ocultada');
        } else {
            console.error('Container da lista nao encontrado');
        }
        
    } catch (error) {
        console.error('Erro na funcao editarCliente:', error);
        alert('Erro ao abrir edicao do cliente: ' + error.message);
    }
}

// Funcao para configurar campos especiais de edicao
async function configurarCamposEdicao(cliente) {
    try {
        console.log('Configurando campos especiais de edicao para:', cliente);
        
        // Campos de grupo e produto foram removidos - apenas elementos HTML básicos permanecem
        
        // Configurar selects pesquisaveis de Kamino e ClickUp
        await configurarSelectsEdicao(cliente);
        
    } catch (error) {
        console.error('Erro ao configurar campos de edicao:', error);
    }
}

// Funcao para configurar selects pesquisaveis na edicao
async function configurarSelectsEdicao(cliente) {
    try {
        console.log('=== CONFIGURANDO SELECTS DE EDICAO ===');
        console.log('Cliente recebido:', cliente);
        
        // Carregar dados dos selects se ainda nao foram carregados
        if (!allClientesKamino || allClientesKamino.length === 0) {
            console.log('Carregando clientes Kamino...');
            await loadClientesKamino();
        }
        if (!allClientesClickup || allClientesClickup.length === 0) {
            console.log('Carregando clientes ClickUp...');
            await loadClientesClickup();
        }
        
        console.log('Dados carregados:');
        console.log('- allClientesKamino:', allClientesKamino.length);
        console.log('- allClientesClickup:', allClientesClickup.length);
        console.log('- clientesKaminoMap:', clientesKaminoMap.size);
        console.log('- clientesClickupMap:', clientesClickupMap.size);
        
        // Configurar select de Kamino
        const editKaminoSearch = document.getElementById('edit-clienteKamino-search');
        const editKaminoHidden = document.getElementById('edit-cliente-kamino');
        
        console.log('Elementos Kamino encontrados:');
        console.log('- editKaminoSearch:', !!editKaminoSearch);
        console.log('- editKaminoHidden:', !!editKaminoHidden);
        console.log('- cliente.cli_kamino:', cliente.cli_kamino);
        console.log('- cliente.id_kamino:', cliente.id_kamino);
        
        if (editKaminoSearch && editKaminoHidden) {
            // Se o cliente tem um nome Kamino salvo, usar esse nome
            if (cliente.cli_kamino) {
                editKaminoSearch.value = cliente.cli_kamino;
                // Se também tem ID, usar o ID, senão buscar pelo nome
                if (cliente.id_kamino) {
                    editKaminoHidden.value = cliente.id_kamino;
                } else {
                    // Buscar ID pelo nome no mapeamento
                    const idKamino = clientesKaminoMap.get(cliente.cli_kamino);
                    editKaminoHidden.value = idKamino || '';
                }
                console.log('Kamino configurado - Nome:', cliente.cli_kamino, 'ID:', editKaminoHidden.value);
            } else {
                // Limpar campos se não há cliente Kamino
                editKaminoSearch.value = '';
                editKaminoHidden.value = '';
                console.log('Kamino limpo - sem cliente associado');
            }
        }
        
        // Configurar select de ClickUp
        const editClickupSearch = document.getElementById('edit-clienteClickup-search');
        const editClickupHidden = document.getElementById('edit-cliente-clickup');
        
        console.log('Elementos ClickUp encontrados:');
        console.log('- editClickupSearch:', !!editClickupSearch);
        console.log('- editClickupHidden:', !!editClickupHidden);
        console.log('- cliente.cli_clickup:', cliente.cli_clickup);
        console.log('- cliente.id_clickup:', cliente.id_clickup);
        
        if (editClickupSearch && editClickupHidden) {
            // Se o cliente tem um nome ClickUp salvo, usar esse nome
            if (cliente.cli_clickup) {
                editClickupSearch.value = cliente.cli_clickup;
                // Se também tem ID, usar o ID, senão buscar pelo nome
                if (cliente.id_clickup) {
                    editClickupHidden.value = cliente.id_clickup;
                } else {
                    // Buscar ID pelo nome no mapeamento
                    const idClickup = clientesClickupMap.get(cliente.cli_clickup);
                    editClickupHidden.value = idClickup || '';
                }
                console.log('ClickUp configurado - Nome:', cliente.cli_clickup, 'ID:', editClickupHidden.value);
            } else {
                // Limpar campos se não há cliente ClickUp
                editClickupSearch.value = '';
                editClickupHidden.value = '';
                console.log('ClickUp limpo - sem cliente associado');
            }
        }
        
        // Configurar eventos dos selects pesquisaveis
        setupEditSearchableDropdowns();
        
        console.log('=== SELECTS DE EDICAO CONFIGURADOS ===');
        
    } catch (error) {
        console.error('Erro ao configurar selects de edicao:', error);
    }
}

// Funcao para cancelar edicao
function cancelarEdicao() {
    const editSection = document.getElementById('edit-cliente-section');
    const listContainer = document.querySelector('.clientes-list-container');
    
    if (editSection) {
        editSection.style.display = 'none';
    }
    
    if (listContainer) {
        listContainer.style.display = 'block';
    }
    
    clienteEditando = null;
}

// Funcao para salvar edicao do cliente
async function salvarEdicaoCliente() {
    console.log('=== INICIANDO SALVAMENTO DE EDICAO ===');
    console.log('Timestamp:', new Date().toISOString());
    
    if (!clienteEditando) {
        console.error('Nenhum cliente sendo editado!');
        alert('Erro: Nenhum cliente selecionado para edição');
        return;
    }
    
    console.log('Cliente sendo editado:', clienteEditando);
    console.log('ID do cliente:', clienteEditando.id);
    console.log('Tipo do ID:', typeof clienteEditando.id);
    
    // Verificar se todos os elementos existem
    const elementos = [
        'edit-razao-social', 'edit-nome-fantasia', 'editNomeAmigavel', 'edit-grupo', 'edit-cnpj-cpf',
        'edit-status', 'edit-segmento', 'edit-subsegmento',
        'edit-cliente-kamino', 'edit-cliente-clickup'
    ];
    
    const elementosNaoEncontrados = [];
    const dadosAtualizados = {};
    
    // Mapeamento correto dos campos para a tabela
    const mapeamentoCampos = {
        'edit-razao-social': 'razao_social',
        'edit-nome-fantasia': 'nome_fantasia',
        'editNomeAmigavel': 'nome_amigavel',
        'edit-grupo': 'grupo',
        'edit-cnpj-cpf': 'cnpj_cpf',
        'edit-status': 'status',
        'edit-segmento': 'segmento',
        'edit-subsegmento': 'subsegmento',
        'edit-cliente-kamino': 'cli_kamino',
        'edit-cliente-clickup': 'cli_clickup'
    };
    
    elementos.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            const nomeCampo = mapeamentoCampos[id];
            if (nomeCampo) {
                // Para campos especiais, usar os valores dos campos ocultos ou displays
                if (id === 'edit-grupo') {
                    // Campo de grupo removido - apenas elemento HTML básico
                    dadosAtualizados[nomeCampo] = elemento.value || '';
                } else if (id === 'edit-cliente-kamino') {
                    // Para Kamino: salvar o nome na coluna cli_kamino e o ID na coluna id_kamino
                    const kaminoSearchInput = document.getElementById('edit-clienteKamino-search');
                    if (kaminoSearchInput && kaminoSearchInput.value) {
                        dadosAtualizados['cli_kamino'] = kaminoSearchInput.value; // Nome
                        dadosAtualizados['id_kamino'] = elemento.value; // ID
                    } else {
                        // Se o campo de busca está vazio, preservar os valores originais (não alterar)
                        // Não definir como null para manter os valores existentes no banco
                        console.log('🔄 Cliente Kamino não alterado - preservando valores originais');
                    }
                } else if (id === 'edit-cliente-clickup') {
                    // Para ClickUp: salvar o nome na coluna cli_clickup e o ID na coluna id_clickup
                    const clickupSearchInput = document.getElementById('edit-clienteClickup-search');
                    if (clickupSearchInput && clickupSearchInput.value) {
                        dadosAtualizados['cli_clickup'] = clickupSearchInput.value; // Nome
                        dadosAtualizados['id_clickup'] = elemento.value; // ID
                    } else {
                        dadosAtualizados['cli_clickup'] = null;
                        dadosAtualizados['id_clickup'] = null;
                    }
                } else {
                    dadosAtualizados[nomeCampo] = elemento.value;
                }
                console.log(`Campo ${nomeCampo}:`, dadosAtualizados[nomeCampo]);
            } else {
                console.error(`Mapeamento não encontrado para: ${id}`);
            }
        } else {
            elementosNaoEncontrados.push(id);
            console.error(`Elemento não encontrado: ${id}`);
        }
    });
    
    if (elementosNaoEncontrados.length > 0) {
        alert(`Erro: Elementos do formulário não encontrados: ${elementosNaoEncontrados.join(', ')}`);
        return;
    }
    
    console.log('Dados a serem enviados:', dadosAtualizados);
    console.log('URL da requisição:', `/api/clientes/${clienteEditando.id}`);
    
    try {
        const response = await fetch(`/api/clientes/${clienteEditando.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosAtualizados)
        });
        
        console.log('Status da resposta:', response.status);
        console.log('Response OK:', response.ok);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Resposta do servidor:', result);
            
            // Cancelar edicao
            cancelarEdicao();
            
            // Recarregar lista
            await carregarListaClientes();
            
            showSuccessMessage('Cliente atualizado com sucesso!');
        } else {
            const errorText = await response.text();
            console.error('Erro na resposta:', errorText);
            
            try {
                const error = JSON.parse(errorText);
                alert('Erro ao atualizar cliente: ' + (error.message || error.error || 'Erro desconhecido'));
            } catch (parseError) {
                alert('Erro ao atualizar cliente: ' + errorText);
            }
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro de conexão: ' + error.message);
    }
}

// Fechar menus ao clicar fora
document.addEventListener('click', function(event) {
    if (!event.target.closest('.cliente-actions')) {
        document.querySelectorAll('.actions-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

// Fechar modais ao clicar fora
window.addEventListener('click', function(event) {
    const clientesModal = document.getElementById('clientesModal');
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    
    if (event.target === clientesModal) {
        closeClientesModal();
    }
    
    if (event.target === confirmDeleteModal) {
        closeConfirmDeleteModal();
    }
});

// Carregar quantidade de clientes quando a pagina carregar
document.addEventListener('DOMContentLoaded', function() {
    // Dashboard functions removed - dashboards will be in another section
});

// Função de teste para debug - pode ser chamada no console do navegador
window.testarEdicaoCliente = async function() {
    console.log('=== TESTE DE EDIÇÃO DE CLIENTE ===');
    
    // Carregar lista de clientes primeiro
    await carregarListaClientes();
    
    if (todosClientes.length === 0) {
        console.error('Nenhum cliente encontrado para teste');
        return;
    }
    
    // Pegar o primeiro cliente para teste
    const clienteTeste = todosClientes[0];
    console.log('Cliente para teste:', clienteTeste);
    
    // Simular edição
    editarCliente(clienteTeste.id);
    
    // Aguardar um pouco para o DOM ser atualizado
    setTimeout(() => {
        console.log('Tentando salvar edição...');
        salvarEdicaoCliente();
    }, 1000);
};

// Funcao para carregar clientes ClickUp da API
async function loadClientesClickup() {
    try {
        console.log(' === INICIANDO CARREGAMENTO CLICKUP === ');
        console.log(' Carregando clientes ClickUp da API...');
        console.log(' Funcao loadClientesClickup EXECUTADA!');
        
        // Aguardar um pouco para garantir que o DOM esteja carregado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const dropdown = document.getElementById('clienteClickup-container');
        console.log('Dropdown ClickUp encontrado:', !!dropdown);
        
        if (!dropdown) {
            console.error('Dropdown ClickUp searchable nao encontrado!');
            console.log('Elementos disponiveis:', document.querySelectorAll('[id*="clienteClickup"]'));
            return;
        }
        
        const optionsList = document.getElementById('clienteClickup-list');
        console.log('Options list ClickUp encontrada:', !!optionsList);
        
        if (!optionsList) {
            console.error('Options list ClickUp nao encontrada!');
            return;
        }
        
        // Limpar opcoes existentes
        optionsList.innerHTML = '';
        console.log('Lista de opcoes limpa');
        
        const response = await fetch('/api/clientes-clickup');
        const result = await response.json();
        
        console.log('Resposta completa da API ClickUp:', result);
        
        if (result.data && Array.isArray(result.data)) {
            console.log('Dados ClickUp recebidos:', result.data.slice(0, 5));
            console.log('Tipo dos dados ClickUp:', typeof result.data);
            console.log('E array ClickUp?', Array.isArray(result.data));
            console.log('Total de registros ClickUp:', result.count);
            
            // Verificar se temos dados completos dos clientes ou apenas nomes
            if (result.clientes && Array.isArray(result.clientes)) {
                // Armazenar objetos completos dos clientes ClickUp
                allClientesClickup = result.clientes.filter(cliente => cliente && cliente.nome && cliente.nome.trim());
                
                // Criar mapeamento nome -> id
                clientesClickupMap.clear();
                result.clientes.forEach(cliente => {
                    if (cliente.nome && cliente.id) {
                        clientesClickupMap.set(cliente.nome, cliente.id);
                    }
                });
                console.log('Mapeamento ClickUp criado:', clientesClickupMap.size, 'entradas');
                console.log('Primeiros 3 mapeamentos:', Array.from(clientesClickupMap.entries()).slice(0, 3));
            } else {
                // Fallback: converter nomes simples em objetos para compatibilidade
                const nomesSimples = result.data.filter(nome => nome && nome.trim());
                allClientesClickup = nomesSimples.map((nome, index) => ({
                    id: index + 1, // ID temporário
                    nome: nome
                }));
                
                // Criar mapeamento básico
                clientesClickupMap.clear();
                allClientesClickup.forEach(cliente => {
                    clientesClickupMap.set(cliente.nome, cliente.id);
                });
                console.log('AVISO: Usando fallback para clientes ClickUp');
            }
            
            console.log('Clientes ClickUp filtrados:', allClientesClickup.length);
            
            // Renderizar todas as opcoes ClickUp (passar objetos completos)
            renderOptionsClickup(allClientesClickup);
            
            console.log('Clientes ClickUp carregados da API:', allClientesClickup.length);
        } else {
            console.error('Erro ao carregar clientes ClickUp - formato inesperado:', result);
            // Adicionar opcao de erro
            const errorItem = document.createElement('li');
            errorItem.className = 'dropdown-item';
            errorItem.textContent = 'Erro ao carregar dados';
            optionsList.appendChild(errorItem);
        }
    } catch (error) {
        console.error('Erro na requisicao ClickUp:', error);
        // Adicionar opcao de erro se optionsList existir
        const optionsList = document.getElementById('clienteClickup-list');
        if (optionsList) {
            const errorItem = document.createElement('li');
            errorItem.className = 'dropdown-item';
            errorItem.textContent = 'Erro ao conectar com a API';
            optionsList.appendChild(errorItem);
        }
    }
}

// Funcao para renderizar opcoes Kamino (igual ao ClickUp)
function renderOptionsKamino(clientes) {
    const optionsList = document.getElementById('clienteKamino-list');
    
    if (!optionsList) {
        console.error('ERRO: Lista de opcoes Kamino nao encontrada na renderizacao!');
        return;
    }
    
    optionsList.innerHTML = '';
    
    if (!clientes || clientes.length === 0) {
        return;
    }
    
    clientes.forEach((cliente, index) => {
        const item = document.createElement('li');
        item.className = 'dropdown-item';
        
        // Usar nome_fantasia como nome principal para Kamino
        const nomeCliente = cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Cliente sem nome';
        
        item.textContent = nomeCliente;
        item.addEventListener('click', () => selectOptionKamino(nomeCliente));
        optionsList.appendChild(item);
    });
}

// ========== FUNCIONALIDADES DO MODAL DE GRUPOS ==========



// ========== FUNCIONALIDADES DO MODAL DE PRODUTOS ==========

// Variáveis globais removidas - não precisamos mais de arrays de produtos
// O sistema agora trabalha apenas com os três campos separados

// Funcao para abrir o modal de grupos












// Função removida - não precisamos mais carregar produtos existentes

// Função removida - não precisamos mais renderizar lista de produtos

// Função removida - não precisamos mais excluir produtos da lista



// Função removida - não precisamos mais confirmar seleção de produtos



// Funcao para selecionar uma opcao Kamino (igual ao ClickUp)
function selectOptionKamino(value) {
    const searchInput = document.getElementById('clienteKamino-search');
    const hiddenInput = document.getElementById('clienteKamino');
    const optionsList = document.getElementById('clienteKamino-list');
    
    searchInput.value = value;
    
    // Buscar o ID correspondente no mapeamento usando o nome fantasia
    const clienteId = clientesKaminoMap.get(value);
    if (clienteId) {
        hiddenInput.value = clienteId;
    } else {
        hiddenInput.value = value; // fallback para compatibilidade
    }
    
    optionsList.style.display = 'none';
    
    // Limpar erro se existir
    const errorElement = document.getElementById('clienteKamino-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Funcao para renderizar opcoes ClickUp
function renderOptionsClickup(clientes) {
    console.log('=== RENDERIZANDO OPCOES CLICKUP ===');
    console.log('Clientes recebidos para renderizar:', clientes.length);
    console.log('Primeiros 3 clientes:', clientes.slice(0, 3));
    
    const optionsList = document.getElementById('clienteClickup-list');
    console.log('Lista de opcoes encontrada para renderizar:', !!optionsList);
    
    if (!optionsList) {
        console.error('ERRO: Lista de opcoes nao encontrada na renderizacao!');
        return;
    }
    
    optionsList.innerHTML = '';
    
    clientes.forEach((cliente, index) => {
        const item = document.createElement('li');
        item.className = 'dropdown-item';
        
        // Verificar se é um objeto com propriedade nome ou uma string simples
        const nomeCliente = typeof cliente === 'object' && cliente.nome ? cliente.nome : cliente;
        
        item.textContent = nomeCliente;
        item.addEventListener('click', () => selectOptionClickup(nomeCliente));
        optionsList.appendChild(item);
        
        if (index < 3) {
            console.log(`Item ${index + 1} adicionado:`, nomeCliente);
        }
    });
    
    console.log('Total de itens renderizados:', optionsList.children.length);
}

function renderOptionsCnpj(opcoes) {
    const optionsList = document.getElementById('cnpj-list');
    if (!optionsList) return;
    optionsList.innerHTML = '';
    if (!opcoes || opcoes.length === 0) return;
    opcoes.forEach((valor) => {
        const item = document.createElement('li');
        item.className = 'dropdown-item';
        item.textContent = valor;
        item.addEventListener('click', () => {
            const input = document.getElementById('teste');
            if (!input) return;
            const formatado = aplicarMascaraCpfCnpj(valor);
            input.value = formatado;
            optionsList.style.display = 'none';
        });
        optionsList.appendChild(item);
    });
}
// Funcao para selecionar uma opcao ClickUp
function selectOptionClickup(value) {
    console.log('🔥 selectOptionClickup chamada com valor:', value);
    
    const searchInput = document.getElementById('clienteClickup-search');
    const hiddenInput = document.getElementById('clienteClickup');
    const optionsList = document.getElementById('clienteClickup-list');
    
    console.log('🔥 Elementos encontrados:', {
        searchInput: !!searchInput,
        hiddenInput: !!hiddenInput,
        optionsList: !!optionsList
    });
    
    searchInput.value = value;
    hiddenInput.value = value;
    optionsList.style.display = 'none';
    
    // Limpar erro se existir
    const errorElement = document.getElementById('clienteClickup-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    // Preencher campos automaticamente com dados do cliente ClickUp
    preencherCamposAutomaticamente(value);
    
    // Carregar dados dos contratos
    carregarDadosContratos(value);
    loadCnpjOptionsFromContratos(value);
    
    // Atualizar título do formulário (modo edição)
    if (typeof updateFormTitle === 'function') {
        setTimeout(() => {
            updateFormTitle();
        }, 200);
    }
}

// Função para limpar todos os campos do formulário
function limparCamposFormulario() {
    console.log('🧹 === LIMPANDO CAMPOS DO FORMULÁRIO ===');
    
    // Lista de IDs dos campos que devem ser limpos
    const camposParaLimpar = [
        'razaoSocial',
        'nomeFantasia', 
        'nomeAmigavel',
        'cpfCnpj',
        'status',
        'grupo',
        'segmento',
        'subsegmento',
        'clienteKamino-search',
        'clienteKamino'
    ];
    
    camposParaLimpar.forEach(campoId => {
        const elemento = document.getElementById(campoId);
        if (elemento) {
            const valorAnterior = elemento.value;
            elemento.value = '';
            console.log(`🧹 Campo ${campoId}: "${valorAnterior}" → "" (limpo)`);
        } else {
            console.log(`🧹 Campo ${campoId}: elemento não encontrado`);
        }
    });
    
    console.log('🧹 === LIMPEZA CONCLUÍDA ===');
}

// Funcao para preencher campos automaticamente com dados da tabela cp_cliente e contratos_clientes
async function preencherCamposAutomaticamente(nomeClienteClickup) {
    try {
        console.log('🔥 === INICIANDO PREENCHIMENTO AUTOMÁTICO ===');
        console.log('🔥 Nome do cliente ClickUp:', nomeClienteClickup);
        
        // PRIMEIRO: Limpar todos os campos do formulário
        console.log('🔥 === LIMPANDO TODOS OS CAMPOS ===');
        limparCamposFormulario();
        
        if (!nomeClienteClickup || !nomeClienteClickup.trim()) {
            console.log('🔥 Nome do cliente está vazio, campos foram limpos');
            return;
        }
        
        // Buscar dados da tabela cp_cliente
        const urlCpCliente = `/api/cliente-dados/${encodeURIComponent(nomeClienteClickup)}`;
        console.log('🔥 URL da requisição cp_cliente:', urlCpCliente);
        
        const responseCpCliente = await fetch(urlCpCliente);
        
        // Buscar dados da tabela contratos_clientes para preenchimento dos campos do contrato
        const urlContratosClientes = `/api/dados-cliente-contrato/${encodeURIComponent(nomeClienteClickup)}`;
        console.log('🔥 URL da requisição contratos_clientes:', urlContratosClientes);
        
        const responseContratosClientes = await fetch(urlContratosClientes);
        
        // Processar dados da tabela cp_cliente
        const response = responseCpCliente;
        
        console.log('🔥 Status da resposta:', response.status);
        console.log('🔥 Response OK:', response.ok);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Cliente ClickUp não encontrado na base de dados (404) - campos permanecem vazios');
                return;
            }
            const errorText = await response.text();
            console.log('🔥 Erro na resposta:', errorText);
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API:', result);
        
        if (result.success && result.data) {
            const clienteData = result.data;
            console.log('🔥 Dados do cliente encontrados:', clienteData);
            
            // Preencher campos do formulário APENAS com os dados que existem
            console.log('🔥 === PREENCHENDO CAMPOS COM DADOS VÁLIDOS ===');
            
            // Razão Social
            const razaoSocialInput = document.getElementById('razaoSocial');
            if (razaoSocialInput && clienteData.razao_social && clienteData.razao_social.trim()) {
                console.log('🔥 Razão Social - Preenchendo:', clienteData.razao_social);
                razaoSocialInput.value = clienteData.razao_social;
            } else {
                console.log('🔥 Razão Social - Campo vazio ou null, mantendo vazio');
            }
            
            // Nome Fantasia
            const nomeFantasiaInput = document.getElementById('nomeFantasia');
            if (nomeFantasiaInput && clienteData.nome_fantasia && clienteData.nome_fantasia.trim()) {
                console.log('🔥 Nome Fantasia - Preenchendo:', clienteData.nome_fantasia);
                nomeFantasiaInput.value = clienteData.nome_fantasia;
            } else {
                console.log('🔥 Nome Fantasia - Campo vazio ou null, mantendo vazio');
            }
            
            // Nome Amigável
            const nomeAmigavelInput = document.getElementById('nomeAmigavel');
            if (nomeAmigavelInput && clienteData.nome_amigavel && clienteData.nome_amigavel.trim()) {
                console.log('🔥 Nome Amigável - Preenchendo:', clienteData.nome_amigavel);
                nomeAmigavelInput.value = clienteData.nome_amigavel;
            } else {
                console.log('🔥 Nome Amigável - Campo vazio ou null, mantendo vazio');
            }
            
            // CPF/CNPJ - Preencher campo com ID 'teste'
            const cpfCnpjInput = document.getElementById('teste'); // Campo CPF/CNPJ tem ID 'teste'
            if (cpfCnpjInput && clienteData.cpf_cnpj && clienteData.cpf_cnpj.trim()) {
                console.log('🔥 CPF/CNPJ (teste) - Preenchendo:', clienteData.cpf_cnpj);
                cpfCnpjInput.value = clienteData.cpf_cnpj;
            } else {
                console.log('🔥 CPF/CNPJ (teste) - Campo vazio ou null, mantendo vazio');
            }
            
            // Status - Preencher campo com ID 'testeDois'
            const statusInput = document.getElementById('testeDois'); // Campo Status tem ID 'testeDois'
            if (statusInput && clienteData.status && clienteData.status.trim()) {
                console.log('🔥 Status (testeDois) - Preenchendo:', clienteData.status);
                statusInput.value = clienteData.status;
            } else {
                console.log('🔥 Status (testeDois) - Campo vazio ou null, mantendo vazio');
            }
            
            // Grupo - removido conforme solicitação
            
            // Segmento
            const segmentoInput = document.getElementById('segmento');
            if (segmentoInput && clienteData.segmento && clienteData.segmento.trim()) {
                console.log('🔥 Segmento - Preenchendo:', clienteData.segmento);
                segmentoInput.value = clienteData.segmento;
            } else {
                console.log('🔥 Segmento - Campo vazio ou null, mantendo vazio');
            }
            
            // Subsegmento
            const subsegmentoInput = document.getElementById('subsegmento');
            if (subsegmentoInput && clienteData.subsegmento && clienteData.subsegmento.trim()) {
                console.log('🔥 Subsegmento - Preenchendo:', clienteData.subsegmento);
                subsegmentoInput.value = clienteData.subsegmento;
            } else {
                console.log('🔥 Subsegmento - Campo vazio ou null, mantendo vazio');
            }
            
            // Cliente Kamino Search
            const clienteKaminoSearch = document.getElementById('clienteKamino-search');
            if (clienteKaminoSearch && clienteData.nome_cli_kamino && clienteData.nome_cli_kamino.trim()) {
                console.log('🔥 Cliente Kamino Search - Preenchendo:', clienteData.nome_cli_kamino);
                clienteKaminoSearch.value = clienteData.nome_cli_kamino;
            } else {
                console.log('🔥 Cliente Kamino Search - Campo vazio ou null, mantendo vazio');
            }
            
            // Cliente Kamino Hidden
            const clienteKaminoHidden = document.getElementById('clienteKamino');
            if (clienteKaminoHidden && clienteData.id_cli_kamino && clienteData.id_cli_kamino.toString().trim()) {
                console.log('🔥 Cliente Kamino Hidden - Preenchendo:', clienteData.id_cli_kamino);
                clienteKaminoHidden.value = clienteData.id_cli_kamino;
            } else {
                console.log('🔥 Cliente Kamino Hidden - Campo vazio ou null, mantendo vazio');
            }
            
            console.log('🔥 === CAMPOS PREENCHIDOS COM SUCESSO ===');
        } else {
            console.log('🔥 Nenhum dado encontrado para o cliente - campos permanecem vazios');
        }
        
        // Processar dados da tabela contratos_clientes para preenchimento dos campos do contrato
        console.log('🔥 === PROCESSANDO DADOS DA TABELA CONTRATOS_CLIENTES ===');
        console.log('🔥 Status da resposta contratos_clientes:', responseContratosClientes.status);
        
        if (responseContratosClientes.ok) {
            const resultContratosClientes = await responseContratosClientes.json();
            console.log('🔥 Resultado da API contratos_clientes:', resultContratosClientes);
            
            if (resultContratosClientes.success && resultContratosClientes.data) {
                const dadosContrato = resultContratosClientes.data;
                console.log('🔥 Dados do contrato encontrados:', dadosContrato);
                
                // Preencher campos do contrato APENAS se os dados existem e não estão vazios
                console.log('🔥 === PREENCHENDO CAMPOS DO CONTRATO ===');
                
                // Razão Social do contrato
                const razaoSocialInput = document.getElementById('razaoSocial');
                if (razaoSocialInput && dadosContrato.razaoSocial && dadosContrato.razaoSocial.trim()) {
                    console.log('🔥 Razão Social (contrato) - Preenchendo:', dadosContrato.razaoSocial);
                    razaoSocialInput.value = dadosContrato.razaoSocial;
                } else {
                    console.log('🔥 Razão Social (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                // Nome Fantasia do contrato
                const nomeFantasiaInput = document.getElementById('nomeFantasia');
                if (nomeFantasiaInput && dadosContrato.nomeFantasia && dadosContrato.nomeFantasia.trim()) {
                    console.log('🔥 Nome Fantasia (contrato) - Preenchendo:', dadosContrato.nomeFantasia);
                    nomeFantasiaInput.value = dadosContrato.nomeFantasia;
                } else {
                    console.log('🔥 Nome Fantasia (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                // Nome Amigável do contrato
                const nomeAmigavelInput = document.getElementById('nomeAmigavel');
                if (nomeAmigavelInput && dadosContrato.nomeAmigavel && dadosContrato.nomeAmigavel.trim()) {
                    console.log('🔥 Nome Amigável (contrato) - Preenchendo:', dadosContrato.nomeAmigavel);
                    nomeAmigavelInput.value = dadosContrato.nomeAmigavel;
                } else {
                    console.log('🔥 Nome Amigável (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                // CPF/CNPJ do contrato
                const cpfCnpjInput = document.getElementById('cpfCnpj');
                if (cpfCnpjInput && dadosContrato.cpfCnpj && dadosContrato.cpfCnpj.trim()) {
                    console.log('🔥 CPF/CNPJ (contrato) - Preenchendo:', dadosContrato.cpfCnpj);
                    cpfCnpjInput.value = dadosContrato.cpfCnpj;
                } else {
                    console.log('🔥 CPF/CNPJ (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                // Status do contrato
                const statusInput = document.getElementById('status');
                if (statusInput && dadosContrato.status && dadosContrato.status.trim()) {
                    console.log('🔥 Status (contrato) - Preenchendo:', dadosContrato.status);
                    statusInput.value = dadosContrato.status;
                } else {
                    console.log('🔥 Status (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                // Cliente Kamino do contrato
                const clienteKaminoInput = document.getElementById('clienteKamino');
                if (clienteKaminoInput && dadosContrato.clienteKamino && dadosContrato.clienteKamino.trim()) {
                    console.log('🔥 Cliente Kamino (contrato) - Preenchendo:', dadosContrato.clienteKamino);
                    clienteKaminoInput.value = dadosContrato.clienteKamino;
                } else {
                    console.log('🔥 Cliente Kamino (contrato) - Campo vazio ou null, mantendo valor atual');
                }
                
                console.log('🔥 === CAMPOS DO CONTRATO PROCESSADOS ===');
            } else {
                console.log('🔥 Nenhum dado de contrato encontrado - campos do contrato mantêm valores atuais');
            }
        } else if (responseContratosClientes.status === 404) {
            console.log('🔥 Dados do contrato não encontrados (404) - campos do contrato mantêm valores atuais');
        } else {
            console.log('🔥 Erro ao buscar dados do contrato - campos do contrato mantêm valores atuais');
        }
        
    } catch (error) {
        console.error('Erro ao buscar dados do cliente ClickUp:', error);
        console.log('🔥 Erro ocorreu - campos permanecem limpos');
    }
}

// Função para carregar contratos como cards
async function carregarContratosCards(nomeClienteClickup) {
    try {
        console.log('🔥 === CARREGANDO CONTRATOS COMO CARDS ===');
        console.log('🔥 Cliente ClickUp:', nomeClienteClickup);
        
        const cardsContainer = document.getElementById('contratos-cards');
        console.log('🔥 Container encontrado:', cardsContainer);
        if (!cardsContainer) {
            console.error('❌ Container de cards não encontrado');
            return;
        }
        console.log('✅ Container de cards encontrado com sucesso');
        
        if (!nomeClienteClickup || !nomeClienteClickup.trim()) {
            console.log('🔥 Nome do cliente está vazio, mostrando mensagem padrão');
            mostrarMensagemSemContratos();
            return;
        }
        
        // Fazer requisição para buscar todos os contratos do cliente
        const url = `/api/contratos-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para contratos completos:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhum contrato encontrado para este cliente');
                mostrarMensagemSemContratos();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de contratos completos:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Contratos encontrados:', result.data.length);
            renderizarCardsContratos(result.data);
        } else {
            console.log('🔥 Nenhum contrato encontrado');
            mostrarMensagemSemContratos();
        }
        
    } catch (error) {
        console.error('Erro ao carregar contratos como cards:', error);
        mostrarMensagemSemContratos();
    }
}

// Função para mostrar mensagem quando não há contratos
function mostrarMensagemSemContratos() {
    const cardsContainer = document.getElementById('contratos-cards');
    if (cardsContainer) {
        cardsContainer.innerHTML = `
            <div class="no-contracts-message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 9H9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>Nenhum contrato encontrado para este cliente</p>
            </div>
        `;
    }
}

// Função para renderizar os cards de contratos
function renderizarCardsContratos(contratos) {
    const cardsContainer = document.getElementById('contratos-cards');
    if (!cardsContainer) {
        console.error('Container de cards não encontrado');
        return;
    }
    
    console.log('🔥 Renderizando cards para contratos:', contratos);
    
    cardsContainer.innerHTML = '';
    
    contratos.forEach((contrato, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'contrato-card';

        
        cardElement.innerHTML = `
            <div class="contrato-card-header">
                <div class="contrato-title-section">
                    <h4 class="contrato-card-title">${contrato.nome_contrato}</h4>
                    <span class="contrato-card-id">ID: ${contrato.id}</span>
                </div>
                <div class="contrato-icons">
                    <svg class="contrato-card-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg class="contrato-redirect-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" onclick="abrirUrlAtividade('${contrato.url_atividade || ''}', event)" title="Abrir atividade">
                        <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
            <div class="contrato-card-info">
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Grupo: </span>
                    <span class="contrato-info-value">${contrato.grupo || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Período: </span>
                    <span class="contrato-info-value">${contrato.periodo || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Início: </span>
                    <span class="contrato-info-value">${contrato.data_inicio || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Próxima Renovação: </span>
                    <span class="contrato-info-value">${contrato.proxima_renovacao || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Status: </span>
                    <span class="contrato-info-value">${contrato.status || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">CNPJ: </span>
                    <span class="contrato-info-value">${contrato.cpf_cnpj || 'N/A'}</span>
                </div>
            </div>
        `;
        
        cardsContainer.appendChild(cardElement);
        console.log(`🔥 Card ${index + 1} adicionado para contrato:`, contrato);
    });
}

// Função para abrir URL da atividade
function abrirUrlAtividade(url, event) {
    event.stopPropagation(); // Evita que o clique abra o modal
    
    console.log('🔗 Tentando abrir URL da atividade:', url);
    
    if (!url || url.trim() === '' || url === 'undefined' || url === 'null') {
        console.log('❌ URL da atividade não encontrada ou inválida');
        alert('URL da atividade não encontrada para este contrato.');
        return;
    }
    
    // Adiciona https:// se a URL não tiver protocolo
    let urlCompleta = url.trim();
    if (!urlCompleta.startsWith('http://') && !urlCompleta.startsWith('https://')) {
        urlCompleta = 'https://' + urlCompleta;
    }
    
    console.log('✅ Abrindo URL completa:', urlCompleta);
    
    try {
        window.open(urlCompleta, '_blank');
    } catch (error) {
        console.error('❌ Erro ao abrir URL:', error);
        alert('Erro ao abrir a URL da atividade.');
    }
}



// Função para carregar dados dos contratos (mantida para compatibilidade)
async function carregarDadosContratos(nomeClienteClickup) {
    console.log('🚀 === FUNÇÃO carregarDadosContratos EXECUTADA ===');
    console.log('🚀 Parâmetro recebido:', nomeClienteClickup);
    // Agora usa o sistema de cards
    await carregarContratosCards(nomeClienteClickup);
    console.log('🚀 === carregarContratosCards FINALIZADA ===');
}

async function loadCnpjOptionsFromContratos(nomeClienteClickup) {
    try {
        const url = `/api/contratos-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        const response = await fetch(url);
        if (!response.ok) {
            const list = document.getElementById('cnpj-list');
            if (list) list.innerHTML = '';
            return;
        }
        const result = await response.json();
        if (result && result.success && Array.isArray(result.data)) {
            const valores = result.data
                .map(c => c.cpf_cnpj)
                .filter(v => v && v !== 'N/A');
            const unicos = Array.from(new Set(valores));
            renderOptionsCnpj(unicos);
        }
    } catch (e) {
        const list = document.getElementById('cnpj-list');
        if (list) list.innerHTML = '';
    }
}

// Função para carregar grupos
async function carregarGrupos(nomeClienteClickup) {
    try {
        // Fazer requisição diretamente com o nome do cliente ClickUp
        const url = `/api/contratos/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para grupos:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhum contrato encontrado para este cliente');
                limparListaGrupos();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de contratos (grupos):', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Grupos encontrados:', result.data.length);
            preencherListaGrupos(result.data);
        } else {
            console.log('🔥 Nenhum grupo encontrado nos contratos');
            limparListaGrupos();
        }
        
    } catch (error) {
        console.error('Erro ao carregar grupos:', error);
        limparListaGrupos();
    }
}

// Função para carregar segmentos
async function carregarSegmentos(nomeClienteClickup) {
    try {
        // Fazer requisição para segmentos
        const url = `/api/segmentos-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para segmentos:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhum segmento encontrado para este cliente');
                limparListaSegmentos();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de segmentos:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Segmentos encontrados:', result.data.length);
            preencherListaSegmentos(result.data);
        } else {
            console.log('🔥 Nenhum segmento encontrado nos contratos');
            limparListaSegmentos();
        }
        
    } catch (error) {
        console.error('Erro ao carregar segmentos:', error);
        limparListaSegmentos();
    }
}

// Função para limpar a lista de grupos
function limparListaGrupos() {
    const grupoList = document.getElementById('grupo-list');
    if (grupoList) {
        grupoList.innerHTML = '<li class="no-results">Nenhum grupo encontrado</li>';
        console.log('🔥 Lista de grupos limpa');
    }
}

// Função para preencher a lista de grupos
function preencherListaGrupos(grupos) {
    const grupoList = document.getElementById('grupo-list');
    if (!grupoList) {
        console.error('🔥 Elemento grupo-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com grupos:', grupos);
    
    grupoList.innerHTML = '';
    
    grupos.forEach(grupo => {
        const li = document.createElement('li');
        li.textContent = grupo.nome_grupo;
        li.className = 'grupo-item';
        grupoList.appendChild(li);
        console.log('🔥 Grupo adicionado à lista:', grupo.nome_grupo);
    });
}

// Função para limpar a lista de segmentos
function limparListaSegmentos() {
    const segmentoList = document.getElementById('segmento-list');
    if (segmentoList) {
        segmentoList.innerHTML = '<li class="no-results">Nenhum segmento encontrado</li>';
        console.log('🔥 Lista de segmentos limpa');
    }
}

// Função para preencher a lista de segmentos
function preencherListaSegmentos(segmentos) {
    const segmentoList = document.getElementById('segmento-list');
    if (!segmentoList) {
        console.error('🔥 Elemento segmento-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com segmentos:', segmentos);
    
    segmentoList.innerHTML = '';
    
    segmentos.forEach(segmento => {
        const li = document.createElement('li');
        li.textContent = segmento.nome_segmento;
        li.className = 'segmento-item';
        segmentoList.appendChild(li);
        console.log('🔥 Segmento adicionado à lista:', segmento.nome_segmento);
    });
}

// Função para carregar subsegmentos
async function carregarSubsegmentos(nomeClienteClickup) {
    try {
        // Fazer requisição para subsegmentos
        const url = `/api/subsegmentos-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para subsegmentos:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhum subsegmento encontrado para este cliente');
                limparListaSubsegmentos();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de subsegmentos:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Subsegmentos encontrados:', result.data.length);
            preencherListaSubsegmentos(result.data);
        } else {
            console.log('🔥 Nenhum subsegmento encontrado nos contratos');
            limparListaSubsegmentos();
        }
        
    } catch (error) {
        console.error('Erro ao carregar subsegmentos:', error);
        limparListaSubsegmentos();
    }
}

// Função para limpar a lista de subsegmentos
function limparListaSubsegmentos() {
    const subsegmentoList = document.getElementById('subsegmento-list');
    if (subsegmentoList) {
        subsegmentoList.innerHTML = '<li class="no-results">Nenhum subsegmento encontrado</li>';
        console.log('🔥 Lista de subsegmentos limpa');
    }
}

// Função para preencher a lista de subsegmentos
function preencherListaSubsegmentos(subsegmentos) {
    const subsegmentoList = document.getElementById('subsegmento-list');
    if (!subsegmentoList) {
        console.error('🔥 Elemento subsegmento-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com subsegmentos:', subsegmentos);
    
    subsegmentoList.innerHTML = '';
    
    subsegmentos.forEach(subsegmento => {
        const li = document.createElement('li');
        li.textContent = subsegmento.nome_subsegmento;
        li.className = 'subsegmento-item';
        subsegmentoList.appendChild(li);
        console.log('🔥 Subsegmento adicionado à lista:', subsegmento.nome_subsegmento);
    });
}

// Função para carregar períodos
async function carregarPeriodos(nomeClienteClickup) {
    try {
        // Fazer requisição para períodos
        const url = `/api/periodos-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para períodos:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhum período encontrado para este cliente');
                limparListaPeriodos();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de períodos:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Períodos encontrados:', result.data.length);
            preencherListaPeriodos(result.data);
        } else {
            console.log('🔥 Nenhum período encontrado nos contratos');
            limparListaPeriodos();
        }
        
    } catch (error) {
        console.error('Erro ao carregar períodos:', error);
        limparListaPeriodos();
    }
}

// Função para limpar a lista de períodos
function limparListaPeriodos() {
    const periodoList = document.getElementById('periodo-list');
    if (periodoList) {
        periodoList.innerHTML = '<div class="no-data-message">Nenhum período encontrado</div>';
        console.log('🔥 Lista de períodos limpa');
    }
}

// Função para preencher a lista de períodos
function preencherListaPeriodos(periodos) {
    const periodoList = document.getElementById('periodo-list');
    if (!periodoList) {
        console.error('🔥 Elemento periodo-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com períodos:', periodos);
    
    periodoList.innerHTML = '';
    
    periodos.forEach(periodo => {
        const div = document.createElement('div');
        div.textContent = periodo.nome_periodo;
        div.className = 'periodo-item';
        periodoList.appendChild(div);
        console.log('🔥 Período adicionado à lista:', periodo.nome_periodo);
    });
}

// Função para carregar data de início
async function carregarDataInicio(nomeClienteClickup) {
    try {
        // Fazer requisição para data de início
        const url = `/api/data-inicio-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        console.log('🔥 URL da requisição para data de início:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥 Nenhuma data de início encontrada para este cliente');
                limparListaDataInicio();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥 Resultado da API de data de início:', result);
        
        if (result.success && result.data && result.data.length > 0) {
            console.log('🔥 Datas de início encontradas:', result.data.length);
            preencherListaDataInicio(result.data);
        } else {
            console.log('🔥 Nenhuma data de início encontrada nos contratos');
            limparListaDataInicio();
        }
        
    } catch (error) {
        console.error('Erro ao carregar data de início:', error);
        limparListaDataInicio();
    }
}

// Função para limpar a lista de data de início
function limparListaDataInicio() {
    const dataInicioList = document.getElementById('dataInicio-list');
    if (dataInicioList) {
        dataInicioList.innerHTML = '<div class="no-data-message">Nenhuma data encontrada</div>';
        console.log('🔥 Lista de data de início limpa');
    }
}

// Função para preencher a lista de data de início
function preencherListaDataInicio(datas) {
    const dataInicioList = document.getElementById('dataInicio-list');
    if (!dataInicioList) {
        console.error('🔥 Elemento dataInicio-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com datas de início:', datas);
    
    dataInicioList.innerHTML = '';
    
    datas.forEach(data => {
        const div = document.createElement('div');
        div.textContent = data.data_inicio;
        div.className = 'data-inicio-item';
        dataInicioList.appendChild(div);
        console.log('🔥 Data de início adicionada à lista:', data.data_inicio);
    });
}

// Função para carregar data de encerramento
async function carregarDataEncerramento(nomeClienteClickup) {
    
    try {
        // Fazer requisição para data de encerramento
        const url = `/api/data-encerramento-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                limparListaDataEncerramento();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            preencherListaDataEncerramento(result.data);
        } else {
            
            limparListaDataEncerramento();
        }
        
    } catch (error) {
        limparListaDataEncerramento();
    }
}

// Função para carregar próxima renovação
async function carregarProximaRenovacao(nomeClienteClickup) {
    
    try {
        // Fazer requisição para próxima renovação
        const url = `/api/proxima-renovacao-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                limparProximaRenovacao();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {

            preencherProximaRenovacao(result.data);
        } else {

            limparProximaRenovacao();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar próxima renovação:', error);
        limparProximaRenovacao();
    }
}

// Função para carregar última renovação
async function carregarUltimaRenovacao(nomeClienteClickup) {
    
    try {
        // Fazer requisição para última renovação
        const url = `/api/data-encerramento-cliente/${encodeURIComponent(nomeClienteClickup.trim())}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                limparUltimaRenovacao();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            preencherUltimaRenovacao(result.data);
        } else {
            limparUltimaRenovacao();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar última renovação:', error);
        limparUltimaRenovacao();
    }
}

// Função para preencher última renovação
function preencherUltimaRenovacao(datas) {
    const ultimaRenovacaoSpan = document.getElementById('contrato-data-encerramento');
    if (!ultimaRenovacaoSpan) {
        console.error('🔥 Elemento contrato-data-encerramento não encontrado');
        return;
    }
    
    
    if (datas && datas.length > 0) {
        // Pegar a primeira data (ou você pode implementar lógica para múltiplas datas)
        ultimaRenovacaoSpan.textContent = datas[0].data_encerramento;
    } else {
        ultimaRenovacaoSpan.textContent = 'Nenhuma data encontrada';
    }
}

// Função para limpar última renovação
function limparUltimaRenovacao() {
    const ultimaRenovacaoSpan = document.getElementById('contrato-data-encerramento');
    if (ultimaRenovacaoSpan) {
        ultimaRenovacaoSpan.textContent = 'Nenhuma data encontrada';
        console.log('🔥 Última renovação limpa');
    }
}

// Função para limpar próxima renovação
function limparProximaRenovacao() {
    const proximaRenovacaoSpan = document.getElementById('contrato-proxima-renovacao');
    if (proximaRenovacaoSpan) {
        proximaRenovacaoSpan.textContent = 'Nenhuma data encontrada';
        console.log('🔥 Próxima renovação limpa');
    }
}

// Função para carregar razão social
async function carregarRazaoSocial(nomeClienteClickup, idContrato) {
    console.log('🔥🔥🔥 === INICIANDO CARREGAMENTO RAZÃO SOCIAL ===');
    console.log('🔥🔥🔥 Nome do cliente recebido:', nomeClienteClickup);
    console.log('🔥🔥🔥 ID do contrato recebido:', idContrato);
    
    try {
        // Fazer requisição para razão social
        const url = `/api/razao-social-cliente/${encodeURIComponent(nomeClienteClickup.trim())}/${encodeURIComponent(idContrato)}`;
        console.log('🔥🔥🔥 URL da requisição para razão social:', url);
        
        console.log('🔥🔥🔥 Fazendo fetch para a URL...');
        const response = await fetch(url);
        console.log('🔥🔥🔥 Response recebida - Status:', response.status, 'OK:', response.ok);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥🔥🔥 Status 404 - Nenhuma razão social encontrada para este cliente');
                limparRazaoSocial();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥🔥🔥 Resultado da API de razão social:', result);
        
        if (result.success && result.data) {
            console.log('🔥🔥🔥 Razão social encontrada:', result.data);
            preencherRazaoSocial(result.data);
        } else {
            console.log('🔥🔥🔥 Nenhuma razão social encontrada nos contratos');
            console.log('🔥🔥🔥 result.success:', result.success);
            console.log('🔥🔥🔥 result.data:', result.data);
            limparRazaoSocial();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar razão social:', error);
        limparRazaoSocial();
    }
    console.log('🔥🔥🔥 === FIM CARREGAMENTO RAZÃO SOCIAL ===');
}

// Função para preencher razão social
function preencherRazaoSocial(dados) {
    const razaoSocialSpan = document.getElementById('contrato-razao-social');
    if (!razaoSocialSpan) {
        console.error('🔥 Elemento contrato-razao-social não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo razão social:', dados);
    
    if (dados && dados.trim() !== '') {
        // Agora dados é uma string direta, não um array
        razaoSocialSpan.textContent = dados;
        console.log('🔥 Razão social definida:', dados);
    } else {
        razaoSocialSpan.textContent = 'Nenhuma razão social encontrada';
        console.log('🔥 Nenhuma razão social para exibir');
    }
}

// Função para limpar razão social
function limparRazaoSocial() {
    const razaoSocialSpan = document.getElementById('contrato-razao-social');
    if (razaoSocialSpan) {
        razaoSocialSpan.textContent = 'Nenhuma razão social encontrada';
        console.log('🔥 Razão social limpa');
    }
}

// Função para carregar nome fantasia
async function carregarNomeFantasia(nomeClienteClickup, idContrato) {
    console.log('🔥🔥🔥 === INICIANDO CARREGAMENTO NOME FANTASIA ===');
    console.log('🔥🔥🔥 Nome do cliente recebido:', nomeClienteClickup);
    console.log('🔥🔥🔥 ID do contrato recebido:', idContrato);
    
    try {
        // Fazer requisição para nome fantasia
        const url = `/api/nome-fantasia-cliente/${encodeURIComponent(nomeClienteClickup.trim())}/${encodeURIComponent(idContrato)}`;
        console.log('🔥🔥🔥 URL da requisição para nome fantasia:', url);
        
        console.log('🔥🔥🔥 Fazendo fetch para a URL...');
        const response = await fetch(url);
        console.log('🔥🔥🔥 Response recebida - Status:', response.status, 'OK:', response.ok);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥🔥🔥 Status 404 - Nenhum nome fantasia encontrado para este cliente');
                limparNomeFantasia();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥🔥🔥 Resultado da API de nome fantasia:', result);
        
        if (result.success && result.data) {
            console.log('🔥🔥🔥 Nome fantasia encontrado:', result.data);
            preencherNomeFantasia(result.data);
        } else {
            console.log('🔥🔥🔥 Nenhum nome fantasia encontrado nos contratos');
            console.log('🔥🔥🔥 result.success:', result.success);
            console.log('🔥🔥🔥 result.data:', result.data);
            limparNomeFantasia();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar nome fantasia:', error);
        limparNomeFantasia();
    }
    console.log('🔥🔥🔥 === FIM CARREGAMENTO NOME FANTASIA ===');
}

// Função para preencher nome fantasia
function preencherNomeFantasia(dados) {
    const nomeFantasiaSpan = document.getElementById('contrato-nome-fantasia');
    if (!nomeFantasiaSpan) {
        console.error('🔥 Elemento contrato-nome-fantasia não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo nome fantasia:', dados);
    
    if (dados && dados.trim() !== '') {
        // Agora dados é uma string direta, não um array
        nomeFantasiaSpan.textContent = dados;
        console.log('🔥 Nome fantasia definido:', dados);
    } else {
        nomeFantasiaSpan.textContent = 'Nenhum nome fantasia encontrado';
        console.log('🔥 Nenhum nome fantasia para exibir');
    }
}

// Função para limpar nome fantasia
function limparNomeFantasia() {
    const nomeFantasiaSpan = document.getElementById('contrato-nome-fantasia');
    if (nomeFantasiaSpan) {
        nomeFantasiaSpan.textContent = 'Nenhum nome fantasia encontrado';
        console.log('🔥 Nome fantasia limpo');
    }
}

// Função para carregar nome amigável
async function carregarNomeAmigavel(nomeClienteClickup, idContrato) {
    console.log('🔥🔥🔥 === INICIANDO CARREGAMENTO NOME AMIGÁVEL ===');
    console.log('🔥🔥🔥 Nome do cliente recebido:', nomeClienteClickup);
    console.log('🔥🔥🔥 ID do contrato recebido:', idContrato);
    
    try {
        // Fazer requisição para nome amigável
        const url = `/api/nome-amigavel-cliente/${encodeURIComponent(nomeClienteClickup.trim())}/${encodeURIComponent(idContrato)}`;
        console.log('🔥🔥🔥 URL da requisição para nome amigável:', url);
        
        console.log('🔥🔥🔥 Fazendo fetch para a URL...');
        const response = await fetch(url);
        console.log('🔥🔥🔥 Response recebida - Status:', response.status, 'OK:', response.ok);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥🔥🔥 Status 404 - Nenhum nome amigável encontrado para este cliente');
                limparNomeAmigavel();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥🔥🔥 Resultado da API de nome amigável:', result);
        
        if (result.success && result.data) {
            console.log('🔥🔥🔥 Nome amigável encontrado:', result.data);
            preencherNomeAmigavel(result.data);
        } else {
            console.log('🔥🔥🔥 Nenhum nome amigável encontrado nos contratos');
            console.log('🔥🔥🔥 result.success:', result.success);
            console.log('🔥🔥🔥 result.data:', result.data);
            limparNomeAmigavel();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar nome amigável:', error);
        limparNomeAmigavel();
    }
    console.log('🔥🔥🔥 === FIM CARREGAMENTO NOME AMIGÁVEL ===');
}

// Função para preencher nome amigável
function preencherNomeAmigavel(dados) {
    const nomeAmigavelSpan = document.getElementById('contrato-nome-amigavel');
    if (!nomeAmigavelSpan) {
        console.error('🔥 Elemento contrato-nome-amigavel não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo nome amigável:', dados);
    
    if (dados && dados.trim() !== '') {
        // Agora dados é uma string direta, não um array
        nomeAmigavelSpan.textContent = dados;
        console.log('🔥 Nome amigável definido:', dados);
    } else {
        nomeAmigavelSpan.textContent = 'Nenhum nome amigável encontrado';
        console.log('🔥 Nenhum nome amigável para exibir');
    }
}

// Função para limpar nome amigável
function limparNomeAmigavel() {
    const nomeAmigavelSpan = document.getElementById('contrato-nome-amigavel');
    if (nomeAmigavelSpan) {
        nomeAmigavelSpan.textContent = 'Nenhum nome amigável encontrado';
        console.log('🔥 Nome amigável limpo');
    }
}

// Função para carregar CPF/CNPJ
async function carregarCpfCnpj(nomeClienteClickup, idContrato) {
    console.log('🔥🔥🔥 === INICIANDO CARREGAMENTO CPF/CNPJ ===');
    console.log('🔥🔥🔥 Nome do cliente recebido:', nomeClienteClickup);
    console.log('🔥🔥🔥 ID do contrato recebido:', idContrato);
    
    try {
        // Fazer requisição para CPF/CNPJ
        const url = `/api/cpf-cnpj-cliente/${encodeURIComponent(nomeClienteClickup.trim())}/${encodeURIComponent(idContrato)}`;
        console.log('🔥🔥🔥 URL da requisição para CPF/CNPJ:', url);
        
        console.log('🔥🔥🔥 Fazendo fetch para a URL...');
        const response = await fetch(url);
        console.log('🔥🔥🔥 Response recebida - Status:', response.status, 'OK:', response.ok);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('🔥🔥🔥 Status 404 - Nenhum CPF/CNPJ encontrado para este cliente');
                limparCpfCnpj();
                return;
            }
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔥🔥🔥 Resultado da API de CPF/CNPJ:', result);
        
        if (result.success && result.data) {
            console.log('🔥🔥🔥 CPF/CNPJ encontrado:', result.data);
            preencherCpfCnpj(result.data);
        } else {
            console.log('🔥🔥🔥 Nenhum CPF/CNPJ encontrado nos contratos');
            console.log('🔥🔥🔥 result.success:', result.success);
            console.log('🔥🔥🔥 result.data:', result.data);
            limparCpfCnpj();
        }
        
    } catch (error) {
        console.error('🔥🔥🔥 Erro ao carregar CPF/CNPJ:', error);
        limparCpfCnpj();
    }
    console.log('🔥🔥🔥 === FIM CARREGAMENTO CPF/CNPJ ===');
}

// Função para preencher CPF/CNPJ
function preencherCpfCnpj(dados) {
    const cpfCnpjSpan = document.getElementById('contrato-cpf-cnpj');
    if (!cpfCnpjSpan) {
        console.error('🔥 Elemento contrato-cpf-cnpj não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo CPF/CNPJ:', dados);
    
    if (dados && dados.trim() !== '') {
        // Agora dados é uma string direta, não um array
        cpfCnpjSpan.textContent = dados;
        console.log('🔥 CPF/CNPJ definido:', dados);
    } else {
        cpfCnpjSpan.textContent = 'Nenhum CPF/CNPJ encontrado';
        console.log('🔥 Nenhum CPF/CNPJ para exibir');
    }
}

// Função para limpar CPF/CNPJ
function limparCpfCnpj() {
    const cpfCnpjSpan = document.getElementById('contrato-cpf-cnpj');
    if (cpfCnpjSpan) {
        cpfCnpjSpan.textContent = 'Nenhum CPF/CNPJ encontrado';
        console.log('🔥 CPF/CNPJ limpo');
    }
}

// Função para preencher próxima renovação
function preencherProximaRenovacao(datas) {
    const proximaRenovacaoSpan = document.getElementById('contrato-proxima-renovacao');
    if (!proximaRenovacaoSpan) {
        console.error('🔥 Elemento contrato-proxima-renovacao não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo próxima renovação:', datas);
    
    if (datas && datas.length > 0) {
        // Pegar a primeira data (ou você pode implementar lógica para múltiplas datas)
        proximaRenovacaoSpan.textContent = datas[0].proxima_renovacao;
        console.log('🔥 Próxima renovação definida:', datas[0].proxima_renovacao);
    } else {
        proximaRenovacaoSpan.textContent = 'Nenhuma data encontrada';
    }
}

// Função para limpar a lista de data de encerramento
function limparListaDataEncerramento() {
    const dataEncerramentoList = document.getElementById('dataEncerramento-list');
    if (dataEncerramentoList) {
        dataEncerramentoList.innerHTML = '<div class="no-data-message">Nenhuma data encontrada</div>';
        console.log('🔥 Lista de data de encerramento limpa');
    }
}

// Função para preencher a lista de data de encerramento
function preencherListaDataEncerramento(datas) {
    const dataEncerramentoList = document.getElementById('dataEncerramento-list');
    if (!dataEncerramentoList) {
        console.error('🔥 Elemento dataEncerramento-list não encontrado');
        return;
    }
    
    console.log('🔥 Preenchendo lista com datas de encerramento:', datas);
    
    dataEncerramentoList.innerHTML = '';
    
    datas.forEach(data => {
        const div = document.createElement('div');
        div.textContent = data.data_encerramento;
        div.className = 'data-encerramento-item';
        dataEncerramentoList.appendChild(div);
        console.log('🔥 Data de encerramento adicionada à lista:', data.data_encerramento);
    });
}

// Funcao para filtrar opcoes Kamino (igual ao ClickUp)
function filterOptionsKamino(searchTerm) {
    if (!allClientesKamino || allClientesKamino.length === 0) {
        return;
    }
    
    const filteredClientes = allClientesKamino.filter(cliente => {
        const nomeFantasia = cliente.nome_fantasia || '';
        const razaoSocial = cliente.razao_social || '';
        const nome = cliente.nome || '';
        
        const searchLower = searchTerm.toLowerCase();
        
        return nomeFantasia.toLowerCase().includes(searchLower) ||
               razaoSocial.toLowerCase().includes(searchLower) ||
               nome.toLowerCase().includes(searchLower);
    });
    
    renderOptionsKamino(filteredClientes);
}

// Funcao para filtrar opcoes ClickUp
function filterOptionsClickup(searchTerm) {
    const filteredClientes = allClientesClickup.filter(cliente => {
        const nomeCliente = typeof cliente === 'object' && cliente.nome ? cliente.nome : cliente;
        return nomeCliente.toLowerCase().includes(searchTerm.toLowerCase());
    });
    renderOptionsClickup(filteredClientes);
}

// Funcao para configurar eventos do dropdown Kamino (igual ao ClickUp)
function setupSearchableDropdownKamino() {
    const searchInput = document.getElementById('clienteKamino-search');
    const optionsList = document.getElementById('clienteKamino-list');
    const dropdownArrow = document.querySelector('#clienteKamino-container .dropdown-arrow');
    
    if (!searchInput || !optionsList) return;
    
    // Evento de input para filtrar
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        filterOptionsKamino(searchTerm);
        optionsList.style.display = 'block';
    });
    
    // Evento de foco para mostrar opcoes
    searchInput.addEventListener('focus', () => {
        optionsList.style.display = 'block';
        if (searchInput.value === '') {
            renderOptionsKamino(allClientesKamino);
        }
    });
    
    // Evento de clique na seta
    if (dropdownArrow) {
        dropdownArrow.addEventListener('click', () => {
            if (optionsList.style.display === 'none' || optionsList.style.display === '') {
                optionsList.style.display = 'block';
                renderOptionsKamino(allClientesKamino);
                searchInput.focus();
            } else {
                optionsList.style.display = 'none';
            }
        });
    }
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#clienteKamino-container')) {
            optionsList.style.display = 'none';
        }
    });
}

// Funcao para configurar eventos do dropdown ClickUp
function setupSearchableDropdownClickup() {
    const searchInput = document.getElementById('clienteClickup-search');
    const optionsList = document.getElementById('clienteClickup-list');
    const dropdownArrow = document.querySelector('#clienteClickup-container .dropdown-arrow');
    
    if (!searchInput || !optionsList) return;
    
    // Evento de input para filtrar
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        filterOptionsClickup(searchTerm);
        optionsList.style.display = 'block';
    });
    
    // Evento de foco para mostrar opcoes
    searchInput.addEventListener('focus', () => {
        optionsList.style.display = 'block';
        if (searchInput.value === '') {
            renderOptionsClickup(allClientesClickup);
        }
    });
    
    // Evento de clique na seta
    if (dropdownArrow) {
        dropdownArrow.addEventListener('click', () => {
            if (optionsList.style.display === 'none' || optionsList.style.display === '') {
                optionsList.style.display = 'block';
                renderOptionsClickup(allClientesClickup);
                searchInput.focus();
            } else {
                optionsList.style.display = 'none';
            }
        });
    }
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#clienteClickup-container')) {
            optionsList.style.display = 'none';
        }
    });
}

function setupDropdownCnpj() {
    const input = document.getElementById('teste');
    const optionsList = document.getElementById('cnpj-list');
    const dropdownArrow = document.querySelector('#cnpj-container .dropdown-arrow');
    if (!input || !optionsList) return;
    input.addEventListener('focus', () => {
        if (optionsList.children.length > 0) optionsList.style.display = 'block';
    });
    if (dropdownArrow) {
        dropdownArrow.addEventListener('click', () => {
            if (optionsList.style.display === 'none' || optionsList.style.display === '') {
                if (optionsList.children.length > 0) optionsList.style.display = 'block';
                input.focus();
            } else {
                optionsList.style.display = 'none';
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#cnpj-container')) {
            optionsList.style.display = 'none';
        }
    });
}
// Funcao para limpar erros
function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.style.display = 'none';
    });
}

// Funcao para mostrar erro
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Funcao para validar formulario
function validateForm() {
    clearErrors();
    let isValid = true;
    
    // Validar Cliente Kamino
    const clienteKamino = document.getElementById('clienteKamino').value;
    if (!clienteKamino) {
        showError('clienteKamino', 'Por favor, selecione um cliente Kamino.');
        isValid = false;
    }
    
    // Validar Cliente ClickUp
    const clienteClickup = document.getElementById('clienteClickup').value;
    if (!clienteClickup) {
        showError('clienteClickup', 'Por favor, selecione um cliente ClickUp.');
        isValid = false;
    }
    
    // Validar Nome
    const nome = document.getElementById('nome').value.trim();
    if (!nome) {
        showError('nome', 'Por favor, digite o nome do cliente.');
        isValid = false;
    } else if (nome.length < 2) {
        showError('nome', 'O nome deve ter pelo menos 2 caracteres.');
        isValid = false;
    }
    
    // Validar Grupo
    const grupo = document.getElementById('grupo').value.trim();
    if (!grupo) {
        showError('grupo', 'Por favor, digite o grupo do cliente.');
        isValid = false;
    } else if (grupo.length < 2) {
        showError('grupo', 'O grupo deve ter pelo menos 2 caracteres.');
        isValid = false;
    }
    

    
    // Validar Razao Social
    const razaoSocial = document.getElementById('razaoSocial').value.trim();
    if (!razaoSocial) {
        showError('razaoSocial', 'Por favor, digite a razao social.');
        isValid = false;
    } else if (razaoSocial.length < 2) {
        showError('razaoSocial', 'A razao social deve ter pelo menos 2 caracteres.');
        isValid = false;
    }
    
    // Validar Nome Fantasia
    const nomeFantasia = document.getElementById('nomeFantasia').value.trim();
    if (!nomeFantasia) {
        showError('nomeFantasia', 'Por favor, digite o nome fantasia.');
        isValid = false;
    } else if (nomeFantasia.length < 2) {
        showError('nomeFantasia', 'O nome fantasia deve ter pelo menos 2 caracteres.');
        isValid = false;
    }
    
    // Validar Nome Amigavel
    const nomeAmigavel = document.getElementById('nomeAmigavel').value.trim();
    if (!nomeAmigavel) {
        showError('nomeAmigavel', 'Por favor, digite o nome amigavel.');
        isValid = false;
    } else if (nomeAmigavel.length < 2) {
        showError('nomeAmigavel', 'O nome amigavel deve ter pelo menos 2 caracteres.');
        isValid = false;
    }

    // Validar Segmento
    const segmento = document.getElementById('segmento').value.trim();
    if (!segmento) {
        showError('segmento', 'Por favor, digite o segmento.');
        isValid = false;
    } else if (segmento.length < 2) {
        showError('segmento', 'O segmento deve ter pelo menos 2 caracteres.');
        isValid = false;
    }
    

    
    return isValid;
}



// Funcao para salvar cliente (atualizar cp_cliente)
async function saveClient() {
    console.log('=== FUNCAO SAVECLIENT CHAMADA ===');
    console.log('Iniciando processo de atualizacao do cliente ClickUp...');
    
    try {
        // Capturar dados do formulario
        const clienteClickupElement = document.getElementById('clienteClickup');
        
        console.log('=== DEBUG ELEMENTOS ===');
        console.log('clienteClickup element:', clienteClickupElement);
        console.log('clienteClickup value:', clienteClickupElement ? clienteClickupElement.value : 'ELEMENTO NaO ENCONTRADO');
        
        // Validar se cliente ClickUp foi selecionado
        const clienteClickupValue = clienteClickupElement ? clienteClickupElement.value : '';
        if (!clienteClickupValue) {
            alert('Por favor, selecione um Cliente ClickUp primeiro.');
            return;
        }
        
        // Capturar dados dos campos do formulário com verificação de null
        const nomeFantasiaElement = document.getElementById('nomeFantasia');
        const razaoSocialElement = document.getElementById('razaoSocial');
        const nomeAmigavelElement = document.getElementById('nomeAmigavel');
        const cpfCnpjElement = document.getElementById('teste'); // Campo CPF/CNPJ correto
        const statusElement = document.getElementById('testeDois'); // Campo Status correto
        const segmentoElement = document.getElementById('segmento');
        const subsegmentoElement = document.getElementById('subsegmento');
        
        const nomeFantasia = nomeFantasiaElement ? nomeFantasiaElement.value.trim() : '';
        const razaoSocial = razaoSocialElement ? razaoSocialElement.value.trim() : '';
        const nomeAmigavel = nomeAmigavelElement ? nomeAmigavelElement.value.trim() : '';
        const cpfCnpj = cpfCnpjElement ? cpfCnpjElement.value.trim() : ''; // Campo CPF/CNPJ
        const status = statusElement ? statusElement.value.trim() : ''; // Campo Status
        // Campo grupo removido conforme solicitação
        const segmento = segmentoElement ? segmentoElement.value.trim() : '';
        const subsegmento = subsegmentoElement ? subsegmentoElement.value.trim() : '';
        
        // Capturar Cliente Kamino (nome e ID)
        const clienteKaminoElement = document.getElementById('clienteKamino');
        const clienteKaminoSearchElement = document.getElementById('clienteKamino-search');
        const clienteKaminoId = clienteKaminoElement ? clienteKaminoElement.value : '';
        const clienteKaminoNome = clienteKaminoSearchElement ? clienteKaminoSearchElement.value.trim() : '';
        
        console.log('=== DEBUG CLIENTE KAMINO ===');
        console.log('clienteKaminoElement:', clienteKaminoElement);
        console.log('clienteKaminoSearchElement:', clienteKaminoSearchElement);
        console.log('clienteKaminoId capturado:', clienteKaminoId);
        console.log('clienteKaminoNome capturado:', clienteKaminoNome);
        console.log('clientesKaminoMap atual:', clientesKaminoMap);

        // Verificar se pelo menos um dos três campos principais foi preenchido
        if (!nomeFantasia && !razaoSocial && !nomeAmigavel) {
            alert('Por favor, preencha pelo menos um dos campos: Razão Social, Nome Fantasia ou Nome Amigável.');
            return;
        }

        const clienteData = {
            clienteClickupNome: clienteClickupValue,
            nomeFantasia: nomeFantasia || undefined,
            razaoSocial: razaoSocial || undefined,
            nomeAmigavel: nomeAmigavel || undefined,
            cpfCnpj: cpfCnpj || undefined,
            status: status || undefined,
            // grupo: removido conforme solicitação
            segmento: segmento || undefined,
            subsegmento: subsegmento || undefined,
            nomeCliKamino: clienteKaminoNome || undefined,
            idCliKamino: clienteKaminoId || undefined
        };
        
        // Remover campos undefined para não enviá-los
        Object.keys(clienteData).forEach(key => {
            if (clienteData[key] === undefined) {
                delete clienteData[key];
            }
        });

        console.log('Dados para atualizacao:', clienteData);
        console.log('Cliente ClickUp selecionado:', clienteData.clienteClickupNome);
        console.log('Campos a serem atualizados:', Object.keys(clienteData).filter(key => key !== 'clienteClickupNome'));

        console.log('Enviando dados para a API de cadastro...');
        
        // 1. Primeiro, cadastrar o cliente na tabela principal
        const clienteSimples = {
            razaoSocial: razaoSocial || null,
            nomeFantasia: nomeFantasia || null,
            nomeAmigavel: nomeAmigavel || null,
            clienteClickup: clienteClickupValue,
            clienteKamino: clienteKaminoNome || null,
            idKamino: clienteKaminoId || null,
            teste: cpfCnpj || null, // Campo CPF/CNPJ mapeado para 'teste'
            testeDois: status || null, // Campo Status mapeado para 'testeDois'
            segmento: segmento || null,
            subsegmento: subsegmento || null
        };
        
        console.log('=== DEBUG DADOS PARA CADASTRO ===');
        console.log('Dados para cadastro do cliente:', clienteSimples);
        console.log('idKamino sendo enviado:', clienteSimples.idKamino);
        console.log('clienteKamino sendo enviado:', clienteSimples.clienteKamino);
        
        const cadastroResponse = await fetch('/api/cliente-simples', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clienteSimples)
        });
        
        console.log('Resposta do cadastro:', cadastroResponse.status);
        
        if (!cadastroResponse.ok) {
            const cadastroError = await cadastroResponse.json();
            console.error('Erro ao cadastrar cliente:', cadastroError);
            alert('Erro ao cadastrar cliente: ' + (cadastroError.message || 'Erro desconhecido'));
            return;
        }
        
        const cadastroResult = await cadastroResponse.json();
        console.log('Cliente cadastrado com sucesso:', cadastroResult);
        
        // 2. Depois, atualizar os dados na tabela cp_cliente
        console.log('Atualizando dados na tabela cp_cliente...');
        
        const updateData = {
            razao_social: razaoSocial || null,
            nome_fantasia: nomeFantasia || null,
            nome_amigavel: nomeAmigavel || null,
            cpf_cnpj: cpfCnpj || null,
            status: status || null,
            clienteKamino: clienteKaminoNome || null,
            idCliKamino: clienteKaminoId || null
        };
        
        console.log('=== DEBUG DADOS PARA UPDATE CP_CLIENTE ===');
        console.log('Dados para update cp_cliente:', updateData);
        console.log('idCliKamino sendo enviado:', updateData.idCliKamino);
        console.log('clienteKamino sendo enviado:', updateData.clienteKamino);
        
        const updateResponse = await fetch(`/api/cliente-dados/${encodeURIComponent(clienteClickupValue)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        });

        console.log('Resposta da atualização cp_cliente:', updateResponse.status);
        
        if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            console.log('Dados cp_cliente atualizados com sucesso:', updateResult);
            
            // Mostrar mensagem de sucesso
            const camposAtualizados = [];
            if (razaoSocial) camposAtualizados.push('Razão Social');
            if (nomeFantasia) camposAtualizados.push('Nome Fantasia');
            if (nomeAmigavel) camposAtualizados.push('Nome Amigável');
            if (cpfCnpj) camposAtualizados.push('CPF/CNPJ');
            if (status) camposAtualizados.push('Status');
            if (clienteKaminoNome) camposAtualizados.push('Cliente Kamino');
            if (clienteKaminoId) camposAtualizados.push('ID Cliente Kamino');
            
            if (camposAtualizados.length > 0) {
                showSuccessMessage(`Cliente cadastrado com sucesso! Campos atualizados na cp_cliente: ${camposAtualizados.join(', ')}`);
            } else {
                showSuccessMessage('Cliente cadastrado com sucesso!');
            }
            
            // Limpar formulário após sucesso
            clearForm();
            
            // Atualizar estatisticas
            updateStats();
        } else {
            const updateError = await updateResponse.json();
            console.error('Erro ao atualizar cp_cliente:', updateError);
            alert('Cliente foi cadastrado, mas houve erro ao atualizar dados adicionais: ' + (updateError.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro na funcao saveClient:', error);
        alert('Erro ao atualizar cliente ClickUp: ' + error.message);
    }
}

// Funcao para limpar formulario
function clearForm() {
    const clienteKamino = document.getElementById('clienteKamino');
    const clienteKaminoSearch = document.getElementById('clienteKamino-search');
    const clienteClickup = document.getElementById('clienteClickup');
    const clienteClickupSearch = document.getElementById('clienteClickup-search');
    const segmento = document.getElementById('segmento');
    const subsegmento = document.getElementById('subsegmento');
    const cpfCnpj = document.getElementById('cpfCnpj');
    const status = document.getElementById('status');
    const razaoSocial = document.getElementById('razaoSocial');
    const nomeFantasia = document.getElementById('nomeFantasia');
    const nomeAmigavel = document.getElementById('nomeAmigavel');
    
    // Campos CPF/CNPJ e Status com IDs corretos
    const testeElement = document.getElementById('teste'); // Campo CPF/CNPJ
    const testeDoisElement = document.getElementById('testeDois'); // Campo Status
    
    if (clienteKamino) clienteKamino.value = '';
    if (clienteKaminoSearch) clienteKaminoSearch.value = '';
    if (clienteClickup) clienteClickup.value = '';
    if (clienteClickupSearch) clienteClickupSearch.value = '';
    // Campos grupo e produto removidos conforme solicitação
    if (segmento) segmento.value = '';
    if (subsegmento) subsegmento.value = '';
    if (cpfCnpj) cpfCnpj.value = '';
    if (status) status.value = '';
    if (razaoSocial) razaoSocial.value = '';
    if (nomeFantasia) nomeFantasia.value = '';
    if (nomeAmigavel) nomeAmigavel.value = '';
    
    // Limpar campos CPF/CNPJ e Status após cadastro bem-sucedido
    if (testeElement) testeElement.value = '';
    if (testeDoisElement) testeDoisElement.value = '';
    
    clearErrors();
}

// Funcao para atualizar estatisticas
function updateStats() {
    // Simular estatisticas
    const totalClients = 150;
    const activeClients = 120;
    const newClients = 15;
    
    const totalElement = document.getElementById('total-clients');
    const activeElement = document.getElementById('active-clients');
    const newElement = document.getElementById('new-clients');
    
    if (totalElement) totalElement.textContent = totalClients;
    if (activeElement) activeElement.textContent = activeClients;
    if (newElement) newElement.textContent = newClients;
}

// Funcao para animar cards
function animateCards() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Funcao para mostrar mensagem de sucesso
function showSuccessMessage(message) {
    console.log('Mostrando mensagem de sucesso:', message);
    
    // Criar elemento de mensagem se nao existir
    let successMessage = document.getElementById('success-message');
    if (!successMessage) {
        successMessage = document.createElement('div');
        successMessage.id = 'success-message';
        successMessage.className = 'alert alert-success';
        successMessage.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 15px 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            display: none;
            font-weight: 500;
        `;
        document.body.appendChild(successMessage);
    }
    
    successMessage.textContent = message || 'Operacao realizada com sucesso!';
    successMessage.style.display = 'block';
    
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 4000);
}

// Funcao para limpar formulario (chamada pelo botao)
function limparFormulario() {
    clearForm();
    
    // Atualizar título do formulário (modo cadastro)
    if (typeof updateFormTitle === 'function') {
        setTimeout(() => {
            updateFormTitle();
        }, 100);
    }
}

// ========== FUNCOES DOS MODAIS DE EDICAO ==========

// Funcao para abrir modal de grupos na edicao




// Funcao para abrir modal de produtos na edicao


// Função removida - renderizarListaProdutosUnificada não é mais necessária
// O sistema agora trabalha apenas com os três campos separados: nome, nome_clickup e nome_kamino



// Função removida - não precisamos mais confirmar seleção de produtos na edição

// ========== FUNCOES DOS SELECTS PESQUISAVEIS DE EDICAO ==========

// Funcao para configurar selects pesquisaveis na edicao
function setupEditSearchableDropdowns() {
    // Configurar select de Kamino na edicao
    const editKaminoSearch = document.getElementById('edit-clienteKamino-search');
    const editKaminoList = document.getElementById('edit-clienteKamino-list');
    
    if (editKaminoSearch && editKaminoList) {
        editKaminoSearch.addEventListener('input', function() {
            filterEditOptionsKamino(this.value);
        });
        
        editKaminoSearch.addEventListener('focus', function() {
            editKaminoList.style.display = 'block';
            renderEditOptionsKamino();
        });
        
        document.addEventListener('click', function(e) {
            if (!editKaminoSearch.contains(e.target) && !editKaminoList.contains(e.target)) {
                editKaminoList.style.display = 'none';
            }
        });
    }
    
    // Configurar select de ClickUp na edicao
    const editClickupSearch = document.getElementById('edit-clienteClickup-search');
    const editClickupList = document.getElementById('edit-clienteClickup-list');
    
    if (editClickupSearch && editClickupList) {
        editClickupSearch.addEventListener('input', function() {
            filterEditOptionsClickup(this.value);
        });
        
        editClickupSearch.addEventListener('focus', function() {
            editClickupList.style.display = 'block';
            renderEditOptionsClickup();
        });
        
        document.addEventListener('click', function(e) {
            if (!editClickupSearch.contains(e.target) && !editClickupList.contains(e.target)) {
                editClickupList.style.display = 'none';
            }
        });
    }
}

// Funcoes para renderizar opcoes dos selects de edicao
function renderEditOptionsKamino() {
    const editKaminoList = document.getElementById('edit-clienteKamino-list');
    if (!editKaminoList || !allClientesKamino) {
        console.log('Erro ao renderizar opcoes Kamino:', {
            editKaminoList: !!editKaminoList,
            allClientesKamino: !!allClientesKamino,
            length: allClientesKamino ? allClientesKamino.length : 0
        });
        return;
    }
    
    console.log('Renderizando opcoes Kamino:', allClientesKamino.length, 'clientes');
    editKaminoList.innerHTML = '';
    
    allClientesKamino.forEach(cliente => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        // Para Kamino, usar nome_fantasia como nome principal
        const nomeExibicao = cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Cliente sem nome';
        option.textContent = nomeExibicao;
        option.onclick = () => selectEditOptionKamino({
            id: cliente.id,
            nome: nomeExibicao,
            nome_fantasia: cliente.nome_fantasia,
            razao_social: cliente.razao_social
        });
        editKaminoList.appendChild(option);
    });
    
    console.log('Opcoes Kamino renderizadas:', editKaminoList.children.length);
}

function renderEditOptionsClickup() {
    const editClickupList = document.getElementById('edit-clienteClickup-list');
    if (!editClickupList || !allClientesClickup) {
        console.log('Erro ao renderizar opcoes ClickUp:', {
            editClickupList: !!editClickupList,
            allClientesClickup: !!allClientesClickup,
            length: allClientesClickup ? allClientesClickup.length : 0
        });
        return;
    }
    
    console.log('Renderizando opcoes ClickUp:', allClientesClickup.length, 'clientes');
    editClickupList.innerHTML = '';
    
    allClientesClickup.forEach(cliente => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        // Para ClickUp, usar nome
        const nomeExibicao = cliente.nome || 'Cliente sem nome';
        option.textContent = nomeExibicao;
        option.onclick = () => selectEditOptionClickup({
            id: cliente.id,
            nome: nomeExibicao
        });
        editClickupList.appendChild(option);
    });
    
    console.log('Opcoes ClickUp renderizadas:', editClickupList.children.length);
}

// Funcoes para selecionar opcoes dos selects de edicao
function selectEditOptionKamino(cliente) {
    const editKaminoSearch = document.getElementById('edit-clienteKamino-search');
    const editKaminoHidden = document.getElementById('edit-cliente-kamino');
    const editKaminoList = document.getElementById('edit-clienteKamino-list');
    
    if (editKaminoSearch) editKaminoSearch.value = cliente.nome;
    if (editKaminoHidden) editKaminoHidden.value = cliente.id;
    if (editKaminoList) editKaminoList.style.display = 'none';
}

function selectEditOptionClickup(cliente) {
    const editClickupSearch = document.getElementById('edit-clienteClickup-search');
    const editClickupHidden = document.getElementById('edit-cliente-clickup');
    const editClickupList = document.getElementById('edit-clienteClickup-list');
    
    if (editClickupSearch) editClickupSearch.value = cliente.nome;
    if (editClickupHidden) editClickupHidden.value = cliente.id;
    if (editClickupList) editClickupList.style.display = 'none';
}

// Funcoes para filtrar opcoes dos selects de edicao
function filterEditOptionsKamino(searchTerm) {
    const editKaminoList = document.getElementById('edit-clienteKamino-list');
    if (!editKaminoList || !allClientesKamino) return;
    
    console.log('Filtrando opcoes Kamino com termo:', searchTerm);
    editKaminoList.innerHTML = '';
    
    const filteredClientes = allClientesKamino.filter(cliente => {
        const nomeExibicao = cliente.nome_fantasia || cliente.razao_social || cliente.nome || '';
        return nomeExibicao.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    console.log('Clientes Kamino filtrados:', filteredClientes.length);
    
    filteredClientes.forEach(cliente => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        const nomeExibicao = cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Cliente sem nome';
        option.textContent = nomeExibicao;
        option.onclick = () => selectEditOptionKamino({
            id: cliente.id,
            nome: nomeExibicao,
            nome_fantasia: cliente.nome_fantasia,
            razao_social: cliente.razao_social
        });
        editKaminoList.appendChild(option);
    });
}

function filterEditOptionsClickup(searchTerm) {
    const editClickupList = document.getElementById('edit-clienteClickup-list');
    if (!editClickupList || !allClientesClickup) return;
    
    console.log('Filtrando opcoes ClickUp com termo:', searchTerm);
    editClickupList.innerHTML = '';
    
    const filteredClientes = allClientesClickup.filter(cliente => {
        const nomeExibicao = cliente.nome || '';
        return nomeExibicao.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    console.log('Clientes ClickUp filtrados:', filteredClientes.length);
    
    filteredClientes.forEach(cliente => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        const nomeExibicao = cliente.nome || 'Cliente sem nome';
        option.textContent = nomeExibicao;
        option.onclick = () => selectEditOptionClickup({
            id: cliente.id,
            nome: nomeExibicao
        });
        editClickupList.appendChild(option);
    });
}

// Funcao para criar novo grupo na edicao




// Inicializacao
function initApp() {
    console.log('🚀🚀🚀 === FUNÇÃO initApp() EXECUTADA ===');
    console.log(' Iniciando aplicacao...');
    
    const form = document.getElementById('clientForm');
    if (!form) {
        console.error(' Formulario nao encontrado!');
        return;
    }
    
    console.log(' Formulario encontrado:', form);
    
    // Configurar dropdowns
    console.log('🔧🔧🔧 === INICIANDO CONFIGURACAO DOS DROPDOWNS ===');
    setupSearchableDropdownKamino();
    console.log('🔧🔧🔧 === DROPDOWN KAMINO CONFIGURADO ===');
    setupSearchableDropdownClickup();
    console.log('🔧🔧🔧 === DROPDOWN CLICKUP CONFIGURADO ===');
    
    // Configurar máscara de CPF/CNPJ
    configurarMascaraCpfCnpj();
    configurarMascaraCpfCnpjEdicao();
    setupDropdownCnpj();
    
    // Event listener simples para o formulario
    form.addEventListener('submit', function(e) {
        console.log(' EVENT LISTENER DO FORM EXECUTADO!');
        e.preventDefault();
        console.log(' Formulario submetido!');
        alert('Formulario funcionando!');
        saveClient();
    });
    
    console.log(' Event listeners configurados');
    
    // Carregar dados
    loadClientesKamino();
    loadClientesClickup();
    updateStats();
    animateCards();
}

// Inicializar quando o DOM estiver pronto
console.log('🔍 Verificando estado do DOM:', document.readyState);
if (document.readyState === 'loading') {
    console.log('📋 DOM ainda carregando - Aguardando DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM carregado, inicializando aplicacao...');
        
        // Limpar campo razao social e adicionar listener
        const razaoSocialField = document.getElementById('razaoSocial');
        if (razaoSocialField) {
            razaoSocialField.value = ''; // Forcar limpeza
            razaoSocialField.addEventListener('input', function() {
                console.log('Campo razaoSocial alterado para:', this.value);
            });
            console.log('Campo razaoSocial limpo e listener adicionado');
        }
        
        initApp();
    });
} else {
    console.log('✅ DOM Ja ESTAVA PRONTO - Executando initApp diretamente');
    initApp();
}

// Função para aplicar máscara de CNPJ
function aplicarMascaraCpfCnpj(valor) {
    const apenasNumeros = valor.replace(/\D/g, '');
    const numeroLimitado = apenasNumeros.substring(0, 14);
    return numeroLimitado
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// Função para configurar máscara no campo CPF/CNPJ
function configurarMascaraCpfCnpj() {
    const campoTeste = document.getElementById('teste');
    if (campoTeste) {
        campoTeste.addEventListener('input', function(e) {
            const valorAtual = e.target.value;
            const valorFormatado = aplicarMascaraCpfCnpj(valorAtual);
            e.target.value = valorFormatado;
            const apenasNumeros = valorAtual.replace(/\D/g, '');
            if (apenasNumeros.length === 0) {
                e.target.placeholder = 'Digite o CNPJ';
            } else {
                e.target.placeholder = 'CNPJ: XX.XXX.XXX/XXXX-XX';
            }
        });
        campoTeste.addEventListener('keypress', function(e) {
            if (!/[0-9]/.test(e.key) && 
                !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

// Função para configurar máscara no campo de edição CPF/CNPJ
function configurarMascaraCpfCnpjEdicao() {
    const campoEdicao = document.getElementById('edit-teste');
    if (campoEdicao) {
        campoEdicao.addEventListener('input', function(e) {
            const valorAtual = e.target.value;
            const valorFormatado = aplicarMascaraCpfCnpj(valorAtual);
            e.target.value = valorFormatado;
            const apenasNumeros = valorAtual.replace(/\D/g, '');
            if (apenasNumeros.length === 0) {
                e.target.placeholder = 'Digite o CNPJ';
            } else {
                e.target.placeholder = 'CNPJ: XX.XXX.XXX/XXXX-XX';
            }
        });
        campoEdicao.addEventListener('keypress', function(e) {
            if (!/[0-9]/.test(e.key) && 
                !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

console.log('🔥 ARQUIVO APP.JS CARREGADO - VERSÃO COM MÁSCARA CPF/CNPJ');
console.log('Script app.js executado completamente');

// FORÇAR EXECUÇÃO DO INITAPP PARA TESTE
console.log('🔧 FORÇANDO EXECUÇÃO DO INITAPP...');
try {
    initApp();
    console.log('✅ initApp executado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao executar initApp:', error);
}

// ===== FUNCIONALIDADES DO MODAL DE CLIENTES ATIVOS =====
// Teste de debug - verificar se o script esta carregando
setTimeout(() => {
    console.log('=== TESTE DE DEBUG ===');
    console.log('DOM ready state:', document.readyState);
    const form = document.getElementById('clientForm');
    console.log('Form encontrado no timeout:', !!form);
    if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        console.log('Submit button encontrado no timeout:', !!submitBtn);
        if (submitBtn) {
            console.log('Submit button text no timeout:', submitBtn.textContent.trim());
        }
    }
}, 1000);

// Adicionar um teste direto no DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Teste direto');
    
    // Teste direto com querySelector
    const testButton = document.querySelector('button[type="submit"]');
    console.log('Botao encontrado diretamente:', testButton);
    
    if (testButton) {
        console.log('Botao submit detectado - Adicionando listener direto para teste');
        
        // Adicionar listener direto para teste
        testButton.addEventListener('click', function(e) {
            console.log(' BOTaO CLICADO DIRETAMENTE!');
            e.preventDefault();
            
            // Chamar a funcao saveClient
            try {
                saveClient();
            } catch (error) {
                console.error('Erro ao chamar saveClient:', error);
            }
        });
        
        console.log('Listener direto adicionado ao botao');
    }
});
