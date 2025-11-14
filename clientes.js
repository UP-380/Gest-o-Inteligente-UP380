// Clientes JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de clientes (COM PAGINAÇÃO)');
    
    // Inicializar controles de paginação
    initializePagination();
    
    // Inicializar filtros
    initializeExposedFilters();

    // Diagnóstico: verificar presença do filtro de período no DOM
    try {
        const hasModernClass = !!document.querySelector('.modern-periodo-filter');
        const periodoTriggerEl = document.getElementById('periodoTrigger');
        const periodoCalendarCardEl = document.getElementById('periodoCalendarCard');
        console.log('🔎 DOM após ExposedFilters:', {
            hasModernClass,
            periodoTriggerEl: !!periodoTriggerEl,
            periodoCalendarCardEl: !!periodoCalendarCardEl
        });
        // Fallback: anexar clique para abrir calendário se inicialização moderna falhar
        if (periodoTriggerEl) {
            periodoTriggerEl.addEventListener('click', () => {
                if (window.__modernPeriodoInitialized) return;
                console.log('🖱️ Fallback: clique em #periodoTrigger');
                const card = document.getElementById('periodoCalendarCard');
                if (card) {
                    card.style.display = 'block';
                    periodoTriggerEl.classList.add('active');
                }
            });
        }
    } catch (e) {
        console.warn('⚠️ Diagnóstico do filtro de período falhou:', e);
    }
    
    // Carregar clientes
    try {
        if (filtrosAplicados) {
            loadClients();
        } else {
            // Mostrar mensagem para aplicar filtros
            const clientsGrid = document.getElementById('clientsGrid');
            if (clientsGrid) {
                clientsGrid.innerHTML = `
                    <div class="apply-filters-prompt" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:#555;font-size:20px;font-weight:600;letter-spacing:0.5px;text-align:center;">
                        POR FAVOR APLIQUE OS FILTROS
                    </div>
                `;
            }
            const totalCardsContainer = document.getElementById('totalCardsContainer');
            if (totalCardsContainer) totalCardsContainer.style.display = 'none';
            const paginationContainer = document.getElementById('paginationContainer');
            if (paginationContainer) paginationContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ ERRO ao chamar loadClients():', error);
    }
});

// ========================================
// 🚀 VARIÁVEIS GLOBAIS - Incluindo Paginação
// ========================================
let allClients = [];
let allStatuses = [];
let activeFilters = [];
let filterIdCounter = 0;

// Variáveis de paginação
let currentPage = 1;
let itemsPerPage = 20;
let totalPages = 1;
let totalClients = 0;

// Variáveis de filtros ativos
let activeStatusFilters = [];
let activeClienteFilters = [];
let activeColaboradorFilters = [];
let activePeriodoFilter = null;
// Flag para controlar exibição inicial sem filtros
let filtrosAplicados = false;

// ========================================
// 🚀 FUNÇÕES DE PAGINAÇÃO
// ========================================

function initializePagination() {
    // Event listeners para controles de paginação
    document.getElementById('firstPageBtn').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPageBtn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPageBtn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPageBtn').addEventListener('click', () => goToPage(totalPages));
    
    // Event listener para mudança de limite de itens
    document.getElementById('paginationLimit').addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1; // Resetar para primeira página
        loadClients();
    });
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadClients();
}

function updatePaginationUI(paginationData) {
    const paginationContainer = document.getElementById('paginationContainer');
    const paginationInfo = document.getElementById('paginationInfo');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    
    // Atualizar variáveis globais
    totalClients = paginationData.total || 0;
    totalPages = paginationData.totalPages || 1;
    currentPage = paginationData.page || 1;
    
    // Calcular range de itens exibidos
    const startItem = totalClients === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(startItem + paginationData.count - 1, totalClients);
    
    // Atualizar informações
    paginationInfo.textContent = `Mostrando ${startItem} a ${endItem} de ${totalClients} clientes`;
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    
    // Habilitar/desabilitar botões
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    lastPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Mostrar controles de paginação se houver clientes
    if (totalClients > 0) {
        paginationContainer.style.display = 'flex';
    } else {
        paginationContainer.style.display = 'none';
    }
}


// Variáveis do calendário customizado
let currentCalendarDate = new Date();
let selectedStartDate = null;
let selectedEndDate = null;
let isSelectingEndDate = false;

// Tentativas para inicializar filtro de período moderno quando DOM ainda não está pronto
let modernPeriodoInitAttempts = 0;
const MODERN_PERIODO_MAX_ATTEMPTS = 10;

// Função para inicializar os filtros expostos
function initializeExposedFilters() {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    // Inicializar cada tipo de filtro
    initializeStatusFilter();
    initializeClienteFilter();
    initializeColaboradorFilter();
    
    // Inicializar filtro de período: moderno se existir, senão legado
    try {
        console.log('➡️ Filtro de período desativado; mantendo apenas o botão visual.');
    } catch (e) {
        console.error('Erro ao inicializar filtro de período:', e);
    }

    // Aplicar todos os filtros sem bloqueio
    applyFiltersBtn.addEventListener('click', () => {
        applyAllFilters();
    });

    // Limpar todos os filtros
    clearFiltersBtn.addEventListener('click', () => {
        // Limpar variáveis globais de filtros
        activeStatusFilters = [];
        activeClienteFilters = [];
        activeColaboradorFilters = [];
        activePeriodoFilter = null;
        
        // Limpar filtro de período moderno
        if (typeof clearModernPeriodoFilter === 'function') {
            clearModernPeriodoFilter();
        }
        
        // Recarregar página para limpar todos os filtros
        location.reload();
    });

    // Ajustar visibilidade inicial dos botões conforme estado dos filtros
    try { updateFilterButtonsVisibility(); } catch (_) {}
}

// Função para inicializar filtro de status exposto
function initializeStatusFilter() {
    const statusSelectField = document.getElementById('statusSelectField');
    const statusSelectDisplay = document.getElementById('statusSelectDisplay');
    const statusDropdown = document.getElementById('statusDropdown');
    const statusSelectText = document.getElementById('statusSelectText');
    const statusSelectArrow = document.getElementById('statusSelectArrow');
    
    let selectedStatuses = [];
    
    // Carregar opções de status
    loadStatusOptions();
    
    // Event listener para abrir/fechar dropdown
    statusSelectDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStatusDropdown();
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!statusSelectField.contains(e.target)) {
            closeStatusDropdown();
        }
    });
    
    function toggleStatusDropdown() {
        const isOpen = statusDropdown.style.display === 'block';
        if (isOpen) {
            closeStatusDropdown();
        } else {
            openStatusDropdown();
        }
    }
    
    function openStatusDropdown() {
        statusDropdown.style.display = 'block';
        statusSelectDisplay.classList.add('active');
        statusSelectArrow.classList.add('rotated');
    }
    
    function closeStatusDropdown() {
        statusDropdown.style.display = 'none';
        statusSelectDisplay.classList.remove('active');
        statusSelectArrow.classList.remove('rotated');
    }
    
    function loadStatusOptions() {
        fetch('/api/tarefas-status')
            .then(response => response.json())
            .then(data => {
                const dropdownContent = statusDropdown.querySelector('.status-dropdown-content');
                
                if (data && data.success && Array.isArray(data.statuses)) {
                    renderStatusOptions(data.statuses, dropdownContent);
                } else {
                    // Fallback com status padrão
                    const defaultStatuses = ['a fazer', 'em andamento', 'concluído'];
                    renderStatusOptions(defaultStatuses, dropdownContent);
                }
            })
            .catch(error => {
                console.error('Erro ao carregar status:', error);
                // Fallback com status padrão
                const defaultStatuses = ['a fazer', 'em andamento', 'concluído'];
                const dropdownContent = statusDropdown.querySelector('.status-dropdown-content');
                renderStatusOptions(defaultStatuses, dropdownContent);
            });
    }
    
    function renderStatusOptions(statuses, container) {
        container.innerHTML = '';
        
        statuses.forEach(status => {
            const option = document.createElement('div');
            option.className = 'status-option';
            option.innerHTML = `
                <div class="status-option-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <span>${status}</span>
            `;
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleStatusSelection(status, option);
            });
            
            container.appendChild(option);
        });
    }
    
    function toggleStatusSelection(status, optionElement) {
        const isSelected = selectedStatuses.includes(status);
        
        if (isSelected) {
            selectedStatuses = selectedStatuses.filter(s => s !== status);
            optionElement.classList.remove('selected');
        } else {
            selectedStatuses.push(status);
            optionElement.classList.add('selected');
        }
        
        updateStatusDisplay();
        updateFilterButtonsVisibility();
    }
    
    function updateStatusDisplay() {
        if (selectedStatuses.length === 0) {
            statusSelectText.textContent = 'Selecionar status';
            statusSelectText.classList.remove('has-selection');
        } else if (selectedStatuses.length === 1) {
            statusSelectText.textContent = selectedStatuses[0];
            statusSelectText.classList.add('has-selection');
        } else {
            statusSelectText.textContent = `${selectedStatuses.length} status selecionados`;
            statusSelectText.classList.add('has-selection');
        }
    }
    
    // Função para obter status selecionados (usada por outras funções)
    window.getSelectedStatuses = function() {
        return selectedStatuses;
    };
    
    // Função para limpar seleção (usada pelo botão limpar)
    window.clearStatusSelection = function() {
        selectedStatuses = [];
        updateStatusDisplay();
        
        // Remover classe selected de todas as opções
        const options = statusDropdown.querySelectorAll('.status-option');
        options.forEach(option => option.classList.remove('selected'));
    };
}

// Variável global para clientes selecionados no filtro exposto
let exposedSelectedClientes = [];

// Variável global para colaboradores selecionados no filtro exposto
let exposedSelectedColaboradores = [];

// Variável global para armazenar tarefas carregadas por cliente
let clienteTarefasCarregadas = new Map();

// Helper: contar colaboradores únicos a partir das tarefas em cache
function countCollaboratorsFromTasks(clienteId) {
    try {
        const tarefas = clienteTarefasCarregadas.get(clienteId) || [];
        const unicos = new Set();
        tarefas.forEach(tarefa => {
            const colaboradores = tarefa && tarefa.colaboradores ? tarefa.colaboradores : [];
            colaboradores.forEach(colab => {
                const uid = parseInt(colab.usuario_id, 10);
                if (!isNaN(uid)) unicos.add(uid);
            });
        });
        return unicos.size;
    } catch (e) {
        return 0;
    }
}

// Atualiza o card com a contagem de colaboradores vinda das tarefas em cache
function updateCollaboratorsCountFromTasks(clienteId) {
    const count = countCollaboratorsFromTasks(clienteId);
    updateClientCard(clienteId, { colaboradores: count, colaboradores_loaded: true });
}

// Função para inicializar filtro de cliente exposto
function initializeClienteFilter() {
    const clienteSelectField = document.getElementById('clienteSelectField');
    const clienteSelectDisplay = document.getElementById('clienteSelectDisplay');
    const clienteDropdown = document.getElementById('clienteDropdown');
    const clienteSelectText = document.getElementById('clienteSelectText');
    const clienteSelectArrow = document.getElementById('clienteSelectArrow');
    const clienteSearchInput = document.getElementById('clienteSearchInput');
    
    let selectedClientes = [];
    let allClientes = [];
    
    // Carregar opções de clientes
    loadClienteOptionsNew();
    
    // Event listener para abrir/fechar dropdown
    clienteSelectDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleClienteDropdown();
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!clienteSelectField.contains(e.target)) {
            closeClienteDropdown();
        }
    });
    
    // Event listener para busca
    clienteSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredClientes = allClientes.filter(cliente => 
            cliente.nome.toLowerCase().includes(searchTerm)
        );
        renderClienteOptions(filteredClientes);
    });
    
    function toggleClienteDropdown() {
        const isOpen = clienteDropdown.style.display === 'block';
        if (isOpen) {
            closeClienteDropdown();
        } else {
            openClienteDropdown();
        }
    }
    
    function openClienteDropdown() {
        clienteDropdown.style.display = 'block';
        clienteSelectDisplay.classList.add('active');
        clienteSelectArrow.classList.add('rotated');
        clienteSearchInput.focus();
    }
    
    function closeClienteDropdown() {
        clienteDropdown.style.display = 'none';
        clienteSelectDisplay.classList.remove('active');
        clienteSelectArrow.classList.remove('rotated');
        clienteSearchInput.value = '';
        renderClienteOptions(allClientes); // Mostrar todos novamente
    }
    
    function loadClienteOptionsNew() {
        fetch('/api/clientes-filtro')
            .then(response => response.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.clientes)) {
                    allClientes = data.clientes;
                    renderClienteOptions(allClientes);
                } else {
                    console.error('Erro ao buscar clientes:', data);
                }
            })
            .catch(error => {
                console.error('Erro ao carregar clientes:', error);
            });
    }
    
    function renderClienteOptions(clientes) {
        const optionsContainer = clienteDropdown.querySelector('.cliente-options-container');
        optionsContainer.innerHTML = '';
        
        clientes.forEach(cliente => {
            const option = document.createElement('div');
            option.className = 'cliente-option';
            option.innerHTML = `
                <div class="cliente-option-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <span>${cliente.nome}</span>
            `;
            
            // Verificar se está selecionado
            const isSelected = selectedClientes.some(c => c.id === cliente.id);
            if (isSelected) {
                option.classList.add('selected');
            }
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleClienteSelection(cliente, option);
            });
            
            optionsContainer.appendChild(option);
        });
    }
    
    function toggleClienteSelection(cliente, optionElement) {
        const isSelected = selectedClientes.some(c => c.id === cliente.id);
        
        if (isSelected) {
            selectedClientes = selectedClientes.filter(c => c.id !== cliente.id);
            optionElement.classList.remove('selected');
        } else {
            selectedClientes.push(cliente);
            optionElement.classList.add('selected');
        }
        
        // Atualizar variável global
        exposedSelectedClientes = [...selectedClientes];
        
        updateClienteDisplay();
        updateFilterButtonsVisibility();
    }
    
    function updateClienteDisplay() {
        if (selectedClientes.length === 0) {
            clienteSelectText.textContent = 'Selecionar clientes';
            clienteSelectText.classList.remove('has-selection');
        } else if (selectedClientes.length === 1) {
            clienteSelectText.textContent = selectedClientes[0].nome;
            clienteSelectText.classList.add('has-selection');
        } else {
            clienteSelectText.textContent = `${selectedClientes.length} clientes selecionados`;
            clienteSelectText.classList.add('has-selection');
        }
    }
    
    // Função para obter clientes selecionados (usada por outras funções)
    window.getSelectedClientes = function() {
        return selectedClientes;
    };
    
    // Função para limpar seleção (usada pelo botão limpar)
    window.clearClienteSelection = function() {
        selectedClientes = [];
        exposedSelectedClientes = [];
        updateClienteDisplay();
        
        // Remover classe selected de todas as opções
        const options = clienteDropdown.querySelectorAll('.cliente-option');
        options.forEach(option => option.classList.remove('selected'));
    };
}

// Função para inicializar filtro de colaborador exposto
function initializeColaboradorFilter() {
    const colaboradorSelectField = document.getElementById('colaboradorSelectField');
    const colaboradorSelectDisplay = document.getElementById('colaboradorSelectDisplay');
    const colaboradorDropdown = document.getElementById('colaboradorDropdown');
    const colaboradorSelectText = document.getElementById('colaboradorSelectText');
    const colaboradorSelectArrow = document.getElementById('colaboradorSelectArrow');
    const colaboradorSearchInput = document.getElementById('colaboradorSearchInput');
    
    if (!colaboradorSelectField || !colaboradorSelectDisplay || !colaboradorDropdown) {
        console.error('❌ Elementos do filtro de colaborador não encontrados');
        return;
    }
    
    let selectedColaboradores = [];
    let allColaboradores = [];
    
    // Controlar abertura/fechamento do dropdown
    colaboradorSelectDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleColaboradorDropdown();
    });
    
    function toggleColaboradorDropdown() {
        const isOpen = colaboradorDropdown.style.display === 'block';
        
        // Fechar outros dropdowns
        document.querySelectorAll('.status-dropdown, .cliente-dropdown, .periodo-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
        
        if (isOpen) {
            closeColaboradorDropdown();
        } else {
            openColaboradorDropdown();
        }
    }
    
    function openColaboradorDropdown() {
        colaboradorDropdown.style.display = 'block';
        colaboradorSelectDisplay.classList.add('active');
        colaboradorSelectArrow.classList.add('rotated');
        
        // Carregar colaboradores se ainda não foram carregados
        if (allColaboradores.length === 0) {
            loadColaboradorOptions();
        } else {
            renderColaboradorOptions(allColaboradores);
        }
        
        // Focar no campo de busca
        setTimeout(() => {
            colaboradorSearchInput.focus();
        }, 100);
    }
    
    function closeColaboradorDropdown() {
        colaboradorDropdown.style.display = 'none';
        colaboradorSelectDisplay.classList.remove('active');
        colaboradorSelectArrow.classList.remove('rotated');
    }
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!colaboradorSelectField.contains(e.target)) {
            closeColaboradorDropdown();
        }
    });
    
    // Busca de colaboradores
    colaboradorSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterColaboradorOptions(searchTerm);
    });
    
    function loadColaboradorOptions() {
        fetch('/api/colaboradores')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success && Array.isArray(data.colaboradores)) {
                    allColaboradores = data.colaboradores;
                    renderColaboradorOptions(allColaboradores);
                } else {
                    console.error('❌ Erro ao buscar colaboradores - dados inválidos:', data);
                }
            })
            .catch(error => {
                console.error('❌ Erro ao carregar colaboradores:', error);
            });
    }
    
    function renderColaboradorOptions(colaboradores) {
        const colaboradorOptions = document.querySelector('.colaborador-options-container');
        if (!colaboradorOptions) {
            console.error('❌ Elemento colaborador-options-container não encontrado!');
            return;
        }
        colaboradorOptions.innerHTML = '';
        
        colaboradores.forEach(colaborador => {
            const option = document.createElement('div');
            option.className = 'colaborador-option';
            option.innerHTML = `
                <div class="colaborador-option-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <span>${colaborador.nome}</span>
            `;
            option.dataset.colaboradorId = colaborador.id;
            
            // Marcar como selecionado se já estiver na lista
            if (selectedColaboradores.some(c => c.id === colaborador.id)) {
                option.classList.add('selected');
            }
            
            option.addEventListener('click', () => {
                toggleColaboradorSelection(colaborador, option);
            });
            
            colaboradorOptions.appendChild(option);
        });
    }
    
    function filterColaboradorOptions(searchTerm) {
        const filteredColaboradores = allColaboradores.filter(colaborador => 
            colaborador.nome.toLowerCase().includes(searchTerm)
        );
        renderColaboradorOptions(filteredColaboradores);
    }
    
    function toggleColaboradorSelection(colaborador, optionElement) {
        const index = selectedColaboradores.findIndex(c => c.id === colaborador.id);
        
        if (index > -1) {
            // Remover colaborador
            selectedColaboradores.splice(index, 1);
            optionElement.classList.remove('selected');
        } else {
            // Adicionar colaborador
            selectedColaboradores.push(colaborador);
            optionElement.classList.add('selected');
        }
        
        // Atualizar variável global
        exposedSelectedColaboradores = [...selectedColaboradores];
        updateColaboradorDisplay();
    }
    
    function updateColaboradorDisplay() {
        if (selectedColaboradores.length === 0) {
            colaboradorSelectText.textContent = 'Selecionar colaboradores';
            colaboradorSelectText.classList.remove('has-selection');
        } else if (selectedColaboradores.length === 1) {
            colaboradorSelectText.textContent = selectedColaboradores[0].nome;
            colaboradorSelectText.classList.add('has-selection');
        } else {
            colaboradorSelectText.textContent = `${selectedColaboradores.length} colaboradores selecionados`;
            colaboradorSelectText.classList.add('has-selection');
        }
    }
    
    // Função para obter colaboradores selecionados (usada por outras funções)
    window.getSelectedColaboradores = function() {
        return selectedColaboradores.map(c => c.id);
    };
    
    // Função para limpar seleção (usada pelo botão limpar)
    window.clearColaboradorSelection = function() {
        selectedColaboradores = [];
        exposedSelectedColaboradores = [];
        updateColaboradorDisplay();
        
        // Remover classe selected de todas as opções
        const options = colaboradorDropdown.querySelectorAll('.colaborador-option');
        options.forEach(option => option.classList.remove('selected'));
    };
}

// Função para inicializar filtro de período exposto (desativado)
function initializePeriodoFilter() {
    // No-op: filtro de período desativado completamente
    return;
}

// Função para inicializar o calendário principal do filtro de período
function initializeMainCalendar() { return; }

// Função para renderizar o calendário principal
function renderMainCalendar() { return; }

// Função para lidar com clique em data no calendário principal
function handleMainCalendarDateClick(clickedDate) { return; }

// Função para converter mês selecionado em período (primeiro e último dia do mês)
function convertMonthToPeriod(monthValue) {
    if (!monthValue) return;
    
    // monthValue está no formato "YYYY-MM"
    const [year, month] = monthValue.split('-').map(Number);
    
    // Primeiro dia do mês
    selectedStartDate = new Date(year, month - 1, 1);
    
    // Último dia do mês
    selectedEndDate = new Date(year, month, 0);
    

}

// Função para atualizar o display do período
function updatePeriodoDisplay() {
    const periodoSelectText = document.getElementById('periodoSelectText');
    
    if (!periodoSelectText) {
        // Ainda assim atualizar botões de filtro
        try { updateFilterButtonsVisibility(); } catch (_) {}
        return;
    }
    
    if (selectedStartDate && selectedEndDate) {
        const startStr = selectedStartDate.toLocaleDateString('pt-BR');
        const endStr = selectedEndDate.toLocaleDateString('pt-BR');
        
        // Verificar se é um período de mês completo para mostrar formato mais amigável
        const isFullMonth = selectedStartDate.getDate() === 1 && 
                           selectedEndDate.getDate() === new Date(selectedEndDate.getFullYear(), selectedEndDate.getMonth() + 1, 0).getDate();
        
        if (isFullMonth) {
            const monthName = selectedStartDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            periodoSelectText.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        } else {
            periodoSelectText.textContent = `${startStr} - ${endStr}`;
        }
        
        periodoSelectText.classList.add('has-selection');
        // Remover marcação de validação quando período está completo
        periodoSelectText.classList.remove('validation-required');
    } else if (selectedStartDate) {
        const startStr = selectedStartDate.toLocaleDateString('pt-BR');
        periodoSelectText.textContent = `${startStr} - Selecione vencimento`;
        periodoSelectText.classList.add('has-selection');
    } else {
        periodoSelectText.textContent = 'Selecionar período';
        periodoSelectText.classList.remove('has-selection');
    }
    // Atualizar estado dos botões ao alterar período
    try { updateFilterButtonsVisibility(); } catch (_) {}
}

// Função para obter período selecionado (usada por outras funções)
window.getSelectedPeriodo = function() {
    return {
        startDate: selectedStartDate,
        endDate: selectedEndDate
    };
};

// Função para limpar seleção de período (usada pelo botão limpar)
window.clearPeriodoSelection = function() {
    selectedStartDate = null;
    selectedEndDate = null;
    isSelectingEndDate = false;

    // Limpar inputs de data do novo filtro
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    updatePeriodoDisplay();
};

// Funções auxiliares para o calendário
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function isDateInRange(date, startDate, endDate) {
    return date >= startDate && date <= endDate;
}

// Função para adicionar novo filtro
function addNewFilter() {
    const filterId = `filter_${++filterIdCounter}`;
    const filtersContainer = document.getElementById('filtersContainer');
    const template = document.getElementById('filterRowTemplate');
    const filterRow = template.content.cloneNode(true);
    
    // Configurar ID único
    const filterRowElement = filterRow.querySelector('.filter-row');
    filterRowElement.setAttribute('data-filter-id', filterId);
    
    // Configurar eventos
    const typeSelect = filterRow.querySelector('.filter-type-select');
    const removeBtn = filterRow.querySelector('.remove-filter-btn');
    
    typeSelect.addEventListener('change', (e) => {
        handleFilterTypeChange(filterId, e.target.value);
    });
    
    removeBtn.addEventListener('click', () => {
        removeFilter(filterId);
    });
    
    filtersContainer.appendChild(filterRow);
    updateFilterButtons();
}

// Função para remover filtro
function removeFilter(filterId) {
    const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
    if (filterRow) {
        filterRow.remove();
        // Remover dos filtros ativos
        activeFilters = activeFilters.filter(filter => filter.id !== filterId);
        updateFilterButtons();
    }
}

// Função para lidar com mudança de tipo de filtro
function handleFilterTypeChange(filterId, filterType) {
    const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
    const optionsSection = filterRow.querySelector('.filter-options-section');
    
    if (!filterType) {
        optionsSection.style.display = 'none';
        optionsSection.innerHTML = '';
        return;
    }
    
    // Limpar opções anteriores
    optionsSection.innerHTML = '';
    
    if (filterType === 'status') {
        setupStatusFilter(filterId, optionsSection);
    } else if (filterType === 'periodo') {
        setupPeriodoFilter(filterId, optionsSection);
    } else if (filterType === 'cliente') {
        setupClienteFilter(filterId, optionsSection);
    }
    
    optionsSection.style.display = 'block';
    updateFilterButtons();
}

// Função para configurar filtro de status
function setupStatusFilter(filterId, container) {
    const template = document.getElementById('statusOptionsTemplate');
    const statusOptions = template.content.cloneNode(true);
    container.appendChild(statusOptions);
    
    // Carregar status disponíveis
    loadStatusCheckboxes(container.querySelector('.status-checkboxes'), filterId);
}

// Função para configurar filtro de período
function setupPeriodoFilter(filterId, container) {
    const template = document.getElementById('periodoOptionsTemplate');
    const periodoOptions = template.content.cloneNode(true);
    container.appendChild(periodoOptions);
    
    // Inicializar calendário para este filtro
    initializeCalendarForFilter(filterId, container);
}

// Função para configurar filtro de cliente
function setupClienteFilter(filterId, container) {
    const template = document.getElementById('clienteOptionsTemplate');
    const clienteOptions = template.content.cloneNode(true);
    container.appendChild(clienteOptions);
    
    // Carregar clientes disponíveis
    loadClienteOptions(container, filterId);
}

// Função para inicializar calendário para um filtro específico
function initializeCalendarForFilter(filterId, container) {
    const calendar = container.querySelector('.custom-calendar');
    const prevBtn = calendar.querySelector('.prev-month');
    const nextBtn = calendar.querySelector('.next-month');
    const monthYearSpan = calendar.querySelector('.calendar-month-year');
    const daysContainer = calendar.querySelector('.calendar-days');
    
    let calendarDate = new Date();
    let startDate = null;
    let endDate = null;
    let selectingStart = true;
    
    prevBtn.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendarForFilter(filterId, calendar, calendarDate, startDate, endDate);
    });
    
    nextBtn.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendarForFilter(filterId, calendar, calendarDate, startDate, endDate);
    });
    
    // Renderizar calendário inicial
    renderCalendarForFilter(filterId, calendar, calendarDate, startDate, endDate);
}

// Função para renderizar calendário para um filtro específico
function renderCalendarForFilter(filterId, calendar, calendarDate, startDate, endDate) {
    const monthYearSpan = calendar.querySelector('.calendar-month-year');
    const daysContainer = calendar.querySelector('.calendar-days');
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    monthYearSpan.textContent = `${calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    daysContainer.innerHTML = '';
    
    // Dias vazios do início
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        daysContainer.appendChild(emptyDay);
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const currentDateObj = new Date(year, month, day);
        
        // Adicionar classes para datas selecionadas
        if (startDate && isSameDay(currentDateObj, startDate)) {
            dayElement.classList.add('selected', 'start-date');
        }
        if (endDate && isSameDay(currentDateObj, endDate)) {
            dayElement.classList.add('selected', 'end-date');
        }
        if (startDate && endDate && isDateInRange(currentDateObj, startDate, endDate)) {
            dayElement.classList.add('in-range');
        }
        
        dayElement.addEventListener('click', () => {
            handleDateClickForFilter(filterId, currentDateObj, calendar);
        });
        
        daysContainer.appendChild(dayElement);
    }
}

// Função para lidar com clique em data para filtro específico
function handleDateClickForFilter(filterId, clickedDate, calendar) {
    let container, startDateSpan, endDateSpan;
    
    // Verificar se é o filtro exposto de período
    if (filterId === 'exposed_periodo') {
        container = calendar.closest('.periodo-filter-container');
        startDateSpan = document.getElementById('selectedStartDate');
        endDateSpan = document.getElementById('selectedEndDate');
    } else {
        container = calendar.closest('.filter-options-section');
        startDateSpan = container.querySelector('.selected-start-date');
        endDateSpan = container.querySelector('.selected-end-date');
    }
    
    if (!startDateSpan || !endDateSpan) {
        console.error('❌ Elementos de data não encontrados para filtro:', filterId);
        return;
    }
    
    // Para o filtro exposto, usar as variáveis globais
    if (filterId === 'exposed_periodo') {
        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            // Selecionar data de início
            selectedStartDate = new Date(clickedDate);
            selectedEndDate = null;
            startDateSpan.textContent = formatDateForDisplay(clickedDate);
            endDateSpan.textContent = 'Selecione';
            isSelectingEndDate = true;
            // Atualizar texto do campo de período
            updatePeriodoDisplay();
        } else {
            // Selecionar data de fim
            if (clickedDate < selectedStartDate) {
                // Se a data clicada é anterior à data de início, trocar
                selectedEndDate = selectedStartDate;
                selectedStartDate = new Date(clickedDate);
                startDateSpan.textContent = formatDateForDisplay(clickedDate);
                endDateSpan.textContent = formatDateForDisplay(selectedEndDate);
            } else {
                selectedEndDate = new Date(clickedDate);
                endDateSpan.textContent = formatDateForDisplay(clickedDate);
            }
            isSelectingEndDate = false;
            // Atualizar texto do campo de período
            updatePeriodoDisplay();

            // Autoaplicar quando fim selecionado
            if (selectedStartDate && selectedEndDate) {
                // Normalizar fim do dia
                selectedEndDate.setHours(23, 59, 59, 999);
                applyAllFilters();
                // Não fechar aqui: manter aberto até clique fora
            }
        }
        
        // Re-renderizar calendário com as variáveis globais
        const calendarDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
        renderCalendarForFilter(filterId, calendar, calendarDate, selectedStartDate, selectedEndDate);
    } else {
        // Lógica original para filtros dinâmicos
        let filterData = activeFilters.find(f => f.id === filterId);
        if (!filterData) {
            filterData = { id: filterId, type: 'periodo', startDate: null, endDate: null };
            activeFilters.push(filterData);
        }
        
        if (!filterData.startDate || (filterData.startDate && filterData.endDate)) {
            // Selecionar data de início
            filterData.startDate = new Date(clickedDate);
            filterData.endDate = null;
            startDateSpan.textContent = formatDateForDisplay(clickedDate);
            endDateSpan.textContent = 'Selecione';
        } else {
            // Selecionar data de fim
            if (clickedDate < filterData.startDate) {
                // Se a data clicada é anterior à data de início, trocar
                filterData.endDate = filterData.startDate;
                filterData.startDate = new Date(clickedDate);
                startDateSpan.textContent = formatDateForDisplay(clickedDate);
                endDateSpan.textContent = formatDateForDisplay(filterData.endDate);
            } else {
                filterData.endDate = new Date(clickedDate);
                endDateSpan.textContent = formatDateForDisplay(clickedDate);
            }
        }
        
        // Re-renderizar calendário
        const calendarDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
        renderCalendarForFilter(filterId, calendar, calendarDate, filterData.startDate, filterData.endDate);
    }
    
    // Atualizar visibilidade dos botões
    updateFilterButtons();
    
    console.log('📅 Data selecionada para filtro', filterId, ':', formatDateForDisplay(clickedDate));
    console.log('📋 Estado atual - Início:', selectedStartDate ? formatDateForDisplay(selectedStartDate) : 'null', 'Vencimento:', selectedEndDate ? formatDateForDisplay(selectedEndDate) : 'null');
}

// Inicializar calendário customizado
function initializeCustomCalendar() {
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }
    
    renderCalendar();
}

// Renderizar calendário
function renderCalendar() {
    const calendarMonthYear = document.getElementById('calendarMonthYear');
    const calendarDays = document.getElementById('calendarDays');
    
    if (!calendarMonthYear || !calendarDays) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Atualizar cabeçalho
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    calendarMonthYear.textContent = `${monthNames[month]} ${year}`;
    
    // Limpar dias anteriores
    calendarDays.innerHTML = '';
    
    // Primeiro dia do mês e último dia do mês
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Gerar 42 dias (6 semanas)
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();
        
        // Adicionar classes baseadas no estado
        if (date.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }
        
        if (isToday(date)) {
            dayElement.classList.add('today');
        }
        
        if (selectedStartDate && isSameDay(date, selectedStartDate)) {
            dayElement.classList.add('selected-start');
        }
        
        if (selectedEndDate && isSameDay(date, selectedEndDate)) {
            dayElement.classList.add('selected-end');
        }
        
        if (selectedStartDate && selectedEndDate && isDateInRange(date, selectedStartDate, selectedEndDate)) {
            dayElement.classList.add('in-range');
        }
        
        // Adicionar evento de clique
        dayElement.addEventListener('click', () => handleDateClick(date));
        
        calendarDays.appendChild(dayElement);
    }
}

// Manipular clique em data
function handleDateClick(date) {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
        // Primeira seleção ou reiniciar seleção
        selectedStartDate = new Date(date);
        selectedEndDate = null;
        isSelectingEndDate = true;
    } else if (isSelectingEndDate) {
        // Segunda seleção
        if (date < selectedStartDate) {
            // Se a data final for anterior à inicial, trocar
            selectedEndDate = selectedStartDate;
            selectedStartDate = new Date(date);
        } else {
            selectedEndDate = new Date(date);
        }
        isSelectingEndDate = false;
    }
    
    updateSelectedDatesDisplay();
    updatePeriodoDisplay();
    renderCalendar();
}

// Atualizar display das datas selecionadas
function updateSelectedDatesDisplay() {
    const selectedStartDateElement = document.getElementById('selectedStartDate');
    const selectedEndDateElement = document.getElementById('selectedEndDate');
    
    if (selectedStartDateElement) {
        selectedStartDateElement.textContent = selectedStartDate ? 
            formatDateForDisplay(selectedStartDate) : 'Selecione';
        selectedStartDateElement.className = selectedStartDate ? 'date-value selected' : 'date-value';
    }
    
    if (selectedEndDateElement) {
        selectedEndDateElement.textContent = selectedEndDate ? 
            formatDateForDisplay(selectedEndDate) : 'Selecione';
        selectedEndDateElement.className = selectedEndDate ? 'date-value selected' : 'date-value';
    }
    
    // Atualizar filtros ativos
    if (selectedStartDate) {
        activeFilters.periodo.dataInicial = formatDateForAPI(selectedStartDate);
    }
    if (selectedEndDate) {
        activeFilters.periodo.dataFinal = formatDateForAPI(selectedEndDate);
    }
    
    // Atualizar display do período no novo campo
    updatePeriodoDisplay();
}

// Atualizar display do período no campo principal
function updatePeriodoDisplayOld() {
    const periodoDisplayText = document.getElementById('periodo-display-text');
    
    if (!periodoDisplayText) return;
    
    if (selectedStartDate && selectedEndDate) {
        periodoDisplayText.textContent = `${formatDateForDisplay(selectedStartDate)} - ${formatDateForDisplay(selectedEndDate)}`;
    } else if (selectedStartDate) {
        periodoDisplayText.textContent = `${formatDateForDisplay(selectedStartDate)} - Selecione vencimento`;
    } else {
        periodoDisplayText.textContent = 'Selecionar período';
    }
    
    // Atualizar visibilidade dos botões de filtro
    updateFilterButtonsVisibility();
}

// Alternar visibilidade da seção de contratos
function toggleClientContracts(clienteId) {
    const contractsSection = document.getElementById(`contracts-section-${clienteId}`);
    const expandIcon = document.getElementById(`expand-icon-${clienteId}`);
    
    if (!contractsSection || !expandIcon) return;
    
    const isExpanded = contractsSection.style.display !== 'none';
    
    if (isExpanded) {
        // Contrair
        contractsSection.style.display = 'none';
        expandIcon.className = 'fas fa-chevron-down';
    } else {
        // Expandir
        contractsSection.style.display = 'block';
        expandIcon.className = 'fas fa-chevron-up';
        
        // Carregar contratos se ainda não foram carregados
        const contractsGrid = document.getElementById(`contracts-grid-${clienteId}`);
        if (contractsGrid && contractsGrid.children.length === 0) {
            loadClientContracts(clienteId);
        }
    }
}

// Função para carregar e renderizar contratos do cliente
async function loadClientContracts(clienteId) {
    const contractsGrid = document.getElementById(`contracts-grid-${clienteId}`);
    const contractsLoading = document.getElementById(`contracts-loading-${clienteId}`);
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    
    if (!contractsGrid || !clientCard) {
        console.error('Elementos não encontrados para carregar contratos');
        return;
    }
    
    // Buscar o nome do cliente no h3 do header
    const clienteNome = clientCard.querySelector('.client-card-header h3').textContent.trim();
    
    try {
        // Mostrar loading
        if (contractsLoading) {
            contractsLoading.style.display = 'block';
        }
        contractsGrid.innerHTML = '';
        

        const response = await fetch(`/api/contratos-cliente/${encodeURIComponent(clienteNome)}`);
        const result = await response.json();
        
        // Ocultar loading
        if (contractsLoading) {
            contractsLoading.style.display = 'none';
        }
        
        if (!result.success) {
            contractsGrid.innerHTML = '<div class="no-contracts-message">Nenhum contrato encontrado</div>';
            return;
        }
        
        const contratos = result.data;
        
        if (!contratos || contratos.length === 0) {
            contractsGrid.innerHTML = '<div class="no-contracts-message">Nenhum contrato encontrado</div>';
            return;
        }
        
        // Renderizar contratos usando a mesma estrutura do app.js
        renderClientContracts(contratos, contractsGrid);
        
    } catch (error) {
        console.error('Erro ao carregar contratos:', error);
        if (contractsLoading) {
            contractsLoading.style.display = 'none';
        }
        contractsGrid.innerHTML = '<div class="no-contracts-message">Erro ao carregar contratos</div>';
    }
}

// Função para renderizar cards de contratos (baseada no app.js)
function renderClientContracts(contratos, container) {
    container.innerHTML = '';
    
    // Criar estrutura de navegação
    const navigationContainer = document.createElement('div');
    navigationContainer.className = 'contracts-navigation';
    
    // Criar wrapper dos contratos
    const contractsWrapper = document.createElement('div');
    contractsWrapper.className = 'contracts-wrapper';
    
    // Adicionar contratos ao wrapper
    contratos.forEach((contrato, index) => {
        const contratoCard = document.createElement('div');
        contratoCard.className = 'contrato-card';
        contratoCard.innerHTML = `
            <div class="contrato-card-header">
                <div class="contrato-title-section">
                    <h3 class="contrato-card-title">${contrato.nome_contrato || `PRODUTO ${index + 1}`}</h3>
                </div>
                <div class="contrato-icons">
                    ${contrato.url_atividade ? `
                        <button class="contrato-card-icon contrato-redirect-icon" 
                                onclick="abrirUrlAtividade('${contrato.url_atividade}')"
                                title="Abrir atividade">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    ` : ''}

                </div>
            </div>
            <div class="contrato-card-info">
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Data Início: </span>
                    <span class="contrato-info-value">${contrato.data_inicio || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Prx. Renovação: </span>
                    <span class="contrato-info-value">${contrato.proxima_renovacao || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">CNPJ: </span>
                    <span class="contrato-info-value">${contrato.cpf_cnpj || 'N/A'}</span>
                </div>
                <div class="contrato-info-item">
                    <span class="contrato-info-label">Status: </span>
                    <span class="contrato-info-value">${contrato.status || 'N/A'}</span>
                </div>
            </div>
        `;
        
        contractsWrapper.appendChild(contratoCard);
    });
    
    // Adicionar setas de navegação se necessário
    if (contratos.length > 1) {
        const leftArrow = document.createElement('button');
        leftArrow.className = 'contract-nav-arrow left disabled';
        leftArrow.innerHTML = '<i class="fas fa-chevron-left"></i>';
        
        const rightArrow = document.createElement('button');
        rightArrow.className = 'contract-nav-arrow right';
        rightArrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
        
        navigationContainer.appendChild(leftArrow);
        navigationContainer.appendChild(rightArrow);
        
        // Adicionar lógica de navegação
        let currentIndex = 0;
        const cardWidth = 188; // 180px + 8px gap
        const maxIndex = Math.max(0, contratos.length - Math.floor(container.offsetWidth / cardWidth));
        
        leftArrow.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                contractsWrapper.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
                updateArrowStates();
            }
        });
        
        rightArrow.addEventListener('click', () => {
            if (currentIndex < maxIndex) {
                currentIndex++;
                contractsWrapper.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
                updateArrowStates();
            }
        });
        
        function updateArrowStates() {
            leftArrow.classList.toggle('disabled', currentIndex === 0);
            rightArrow.classList.toggle('disabled', currentIndex >= maxIndex);
        }
        
        // Atualizar estado inicial das setas
        updateArrowStates();
    }
    
    navigationContainer.appendChild(contractsWrapper);
    container.appendChild(navigationContainer);
}

// Função para abrir URL da atividade (reutilizada do app.js)
function abrirUrlAtividade(url) {
    if (url && url.trim() !== '') {
        window.open(url, '_blank');
    } else {
        alert('URL da atividade não disponível');
    }
}

// Função para abrir URL da primeira tarefa
function abrirPrimeiraTarefaUrl(url) {
    if (url && url.trim() !== '') {
        console.log('🔗 Abrindo primeira tarefa:', url);
        window.open(url, '_blank');
    } else {
        alert('URL da tarefa não disponível');
    }
}

// Função auxiliar para extrair status dos contratos já carregados no DOM
function getClientContractsFromDOM(clienteId) {
    const contractsGrid = document.getElementById(`contracts-grid-${clienteId}`);
    
    // Verificar se os contratos já foram carregados
    if (!contractsGrid || contractsGrid.children.length === 0) {
        return null; // Contratos não carregados
    }
    
    const statusArray = [];
    
    // Buscar todos os cards de contratos dentro do grid (podem estar dentro de um wrapper)
    const contratoCards = contractsGrid.querySelectorAll('.contrato-card');
    
    if (contratoCards.length === 0) {
        return null; // Contratos não carregados ainda
    }
    
    contratoCards.forEach(card => {
        // Buscar todos os elementos de informação do contrato
        const infoItems = card.querySelectorAll('.contrato-info-item');
        
        infoItems.forEach(item => {
            const label = item.querySelector('.contrato-info-label');
            const value = item.querySelector('.contrato-info-value');
            
            if (label && value && label.textContent.includes('Status:')) {
                const statusText = value.textContent.trim();
                if (statusText && statusText !== 'N/A') {
                    statusArray.push(statusText);
                }
            }
        });
    });
    
    return statusArray;
}

// Função auxiliar para carregar contratos silenciosamente (sem mostrar loading)
async function loadClientContractsSilently(clienteId, clienteNome) {
    try {
        const response = await fetch(`/api/contratos-cliente/${encodeURIComponent(clienteNome)}`);
        
        // Se for 404, é esperado (cliente sem contratos) - retornar array vazio silenciosamente
        if (response.status === 404) {
            return [];
        }
        
        // Para outros erros HTTP, ainda loggar
        if (!response.ok) {
            console.warn(`⚠️ Erro HTTP ${response.status} ao buscar contratos para cliente ${clienteNome}`);
            return [];
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            return [];
        }
        
        // Retornar apenas os status dos contratos
        return result.data.map(contrato => contrato.status?.trim()).filter(status => status && status !== 'N/A');
        
    } catch (error) {
        // Só loggar erros de rede ou parsing, não 404s esperados
        console.error(`❌ Erro de rede ao carregar contratos para cliente ${clienteNome}:`, error);
        return [];
    }
}



// Funções auxiliares do calendário
function isToday(date) {
    const today = new Date();
    return isSameDay(date, today);
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function isDateInRange(date, startDate, endDate) {
    return date > startDate && date < endDate;
}

function formatDateForDisplay(date) {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

// Atualizar UI com total global de horas no período
function updateGlobalPeriodHoursUI(totalHoras) {
    const el = document.getElementById('periodoGlobalHoursText');
    if (!el) return;
    // Ocultar sempre para evitar duplicidade com o card principal
    el.style.display = 'none';
}

// Chamar backend para somar horas realizadas por período selecionado
async function updateGlobalPeriodHoursFromSelection() {
    // Tornar no-op: card principal já reflete período; ocultamos UI global
    try { updateGlobalPeriodHoursUI(null); } catch (_) {}
    return;
}

// Converter data para formato timestamptz (PostgreSQL)
function formatDateForTimestamptz(date) {
    // Para filtros de data, queremos o início do dia (00:00:00) em UTC
    // Criar uma nova data com ano, mês e dia, mas em UTC
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Criar data em UTC (sem conversão de timezone)
    const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    return utcDate.toISOString();
}

// Converter data dd/mm/yyyy para Date object
function parseDateFromBrazilianFormat(dateString) {
    if (!dateString) return null;
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
}

// Alias para compatibilidade
function parseDateFromDisplay(dateString) {
    return parseDateFromBrazilianFormat(dateString);
}

// Carregar e renderizar clientes
// ========================================
// 🚀 FUNÇÃO LOAD CLIENTS (OTIMIZADA COM PAGINAÇÃO)
// ========================================
async function loadClients() {
    // Gate inicial: se filtros não foram aplicados, não buscar clientes
    if (!filtrosAplicados) {
        const clientsGrid = document.getElementById('clientsGrid');
        if (clientsGrid) {
            clientsGrid.innerHTML = `
                <div class="apply-filters-prompt" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:#555;font-size:20px;font-weight:600;letter-spacing:0.5px;text-align:center;">
                    POR FAVOR APLIQUE OS FILTROS
                </div>
            `;
        }
        const totalCardsContainer = document.getElementById('totalCardsContainer');
        if (totalCardsContainer) totalCardsContainer.style.display = 'none';
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    console.log(`🔄 Carregando clientes - Página ${currentPage}, Limite ${itemsPerPage}`);

    const loadingMessage = document.getElementById('loadingMessage');
    const clientsGrid = document.getElementById('clientsGrid');
    
    if (!clientsGrid) {
        console.error('Elemento clientsGrid não encontrado');
        return;
    }
    
    try {
        // Mostrar loading
        if (loadingMessage) {
            loadingMessage.style.display = 'flex';
        }
        
        // ========================================
        // 📡 BUSCAR CLIENTES DA API (COM PAGINAÇÃO + FILTROS)
        // ========================================
        
        // Construir URL com filtros ativos
        let url = `/api/clientes?page=${currentPage}&limit=${itemsPerPage}`;
        
        // Adicionar filtros se existirem
        if (activeClienteFilters.length > 0) {
            url += `&clienteIds=${activeClienteFilters.join(',')}`;
        }
        
        if (activeStatusFilters.length > 0) {
            url += `&status=${activeStatusFilters.join(',')}`;
        }
        
        if (activeColaboradorFilters.length > 0) {
            url += `&colaboradorIds=${activeColaboradorFilters.join(',')}`;
        }
        
        if (activePeriodoFilter) {
            if (activePeriodoFilter.startDate) {
                url += `&startDate=${activePeriodoFilter.startDate}`;
            }
            if (activePeriodoFilter.endDate) {
                url += `&endDate=${activePeriodoFilter.endDate}`;
            }
        }
        
        console.log('📡 Requisição para:', url);
        console.log('🔍 Filtros ativos:', {
            clientes: activeClienteFilters,
            status: activeStatusFilters,
            colaboradores: activeColaboradorFilters,
            periodo: activePeriodoFilter
        });
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        console.log('✅ Resposta recebida:', {
            success: data.success,
            count: data.count,
            total: data.total,
            page: data.page,
            totalPages: data.totalPages
        });
        
        // ========================================
        // 📊 PROCESSAR DADOS PAGINADOS
        // ========================================
        if (!data || !data.success) {
            throw new Error(data.message || 'Erro ao carregar clientes');
        }
        
        // Clientes já vêm processados do backend (com faturamento)
        const clientes = data.data || [];
        
        console.log(`✅ ${clientes.length} clientes carregados`);
        
        // ========================================
        // 🎨 ATUALIZAR UI
        // ========================================
        
        // Esconder loading
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        // Armazenar clientes globalmente
        allClients = clientes;
        
        // Atualizar interface de paginação
        updatePaginationUI(data);
        
        // Renderizar cards dos clientes
        if (clientes.length > 0) {
            // Mapear clientes para formato esperado pelos cards
            const clientesFormatados = clientes.map(cliente => {
                // ✅ CORREÇÃO: Usar o campo 'nome' que realmente tem dados!
                const nomeExtraido = cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || 'Nome não informado';
                
                return {
                    id: cliente.id,
                    nome: nomeExtraido,
                    razao_social: cliente.razao_social,
                    nome_fantasia: cliente.nome_fantasia,
                    status: cliente.status || 'ativo',
                    created_at: cliente.created_at,
                    faturamento_registros: cliente.faturamento_registros || [],
                    faturamento_total_registros: cliente.faturamento_total_registros || 0,
                    tarefas_count: 'loading',
                    tarefas_loaded: false,
                    contratos_count: 'loading',
                    contratos_loaded: false,
                    horas_estimadas: 'loading',
                    horas_loaded: false
                };
            });
            
            renderClientCards(clientesFormatados);
            
            // ========================================
            // 🎯 DESTACAR CLIENTES SE HÁ FILTROS ATIVOS
            // ========================================
            // Verificar se há filtros ativos
            const hasFilters = activeClienteFilters.length > 0 || 
                               activeStatusFilters.length > 0 || 
                               activeColaboradorFilters.length > 0 || 
                               activePeriodoFilter !== null;
            
            if (hasFilters) {
                console.log('🎯 Marcando clientes como destacados (filtros ativos)');
                // Aguardar um pouco para garantir que os cards foram renderizados
                setTimeout(() => {
                    const allCards = document.querySelectorAll('.client-card');
                    allCards.forEach(card => {
                        card.classList.add('client-highlighted');
                    });
                    
                    // Atualizar métricas após destacar
                    console.log('📊 Atualizando métricas dos filtros...');
                    updateClientsCount();
                    updateTasksCount();
                    updateEstimatedHoursCount();
                    updateRealizedHoursCount();
                    updateFaturamentoCount();
                }, 150);
            } else {
                console.log('🔍 Nenhum filtro ativo - métricas ocultas');
                // Remover destaque de todos os cards
                setTimeout(() => {
                    const allCards = document.querySelectorAll('.client-card');
                    allCards.forEach(card => {
                        card.classList.remove('client-highlighted');
                    });
                }, 100);
            }
            
            // ========================================
            // 💰 PROCESSAR FATURAMENTO QUE JÁ VEIO DO BACKEND
            // ========================================
            // Renderizar faturamento imediatamente (já veio na resposta)
            clientesFormatados.forEach(cliente => {
                if (cliente.faturamento_registros && cliente.faturamento_registros.length > 0) {
                    // Calcular faturamento total
                    const faturamentoTotal = cliente.faturamento_registros.reduce((sum, registro) => {
                        return sum + (parseFloat(registro.valor_bruto) || 0);
                    }, 0);
                    
                    const faturamentoFormatado = formatCurrency(faturamentoTotal);
                    const totalRegistros = cliente.faturamento_registros.length;
                    
                    // Atualizar card imediatamente
                    updateClientCard(cliente.id, {
                        faturamento_registros: cliente.faturamento_registros,
                        faturamento_total_registros: totalRegistros
                    });
                } else {
                    // Sem faturamento
                    updateClientCard(cliente.id, {
                        faturamento_registros: [],
                        faturamento_total_registros: 0
                    });
                }
            });
            
            // Carregar dados assíncronos em segundo plano
            setTimeout(() => {
                loadTaskCountsAsync(clientesFormatados);
                loadContractCountsAsync(clientesFormatados);
                loadEstimatedHoursAsync(clientesFormatados);
                loadRealizedHoursAsync(clientesFormatados);
                // Reativar colaboradores com lógica simples
                loadCollaboratorsAsync(clientesFormatados);
                loadCustosTotaisAsync(clientesFormatados);
                loadProdutosAsync(clientesFormatados);
                
                // Atualizar card de faturamento após renderizar os dados
                setTimeout(() => {
                    updateFaturamentoCount();
                }, 200);
            }, 100);
            
        } else {
            clientsGrid.innerHTML = `
                <div class="clients-empty">
                    <i class="fas fa-users"></i>
                    <h3>Nenhum cliente encontrado</h3>
                    <p>Não há clientes para exibir no momento.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        if (loadingMessage) {
            loadingMessage.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar clientes</p>
                    <button class="btn btn-secondary" onclick="loadClients()">
                        <i class="fas fa-redo"></i>
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

// Buscar contagem de tarefas para cada cliente
async function loadTaskCounts(clientes) {
    try {
        // Buscar contagem de tarefas para cada cliente em paralelo
        const taskCountPromises = clientes.map(async (cliente) => {
            try {
                const filterParams = buildTaskFilterParams();
                const url = `/api/tarefas-count/${cliente.id}${filterParams ? '?' + filterParams : ''}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.success) {
                    cliente.tarefas_count = data.count;
                } else {
                    console.warn(`Erro ao buscar tarefas para cliente ${cliente.nome}:`, data);
                    cliente.tarefas_count = 0;
                }
            } catch (error) {
                console.error(`Erro ao buscar tarefas para cliente ${cliente.nome}:`, error);
                cliente.tarefas_count = 0;
            }
        });
        
        // Aguardar todas as requisições
        await Promise.all(taskCountPromises);
        
    } catch (error) {
        console.error('Erro ao carregar contagens de tarefas:', error);
        // Em caso de erro, manter tarefas_count como 0 para todos
    }
}

// Carregar contagens de tarefas de forma assíncrona (em lotes)
async function loadTaskCountsAsync(clientes) {
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    

    
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        
        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                // Construir URL com filtros de colaboradores se existirem
                let url = `/api/tarefas-count/${cliente.id}`;
                const params = new URLSearchParams();
                
                if (activeColaboradorFilters.length > 0) {
                    params.append('colaboradorIds', activeColaboradorFilters.join(','));
                }
                
                if (activePeriodoFilter) {
                    if (activePeriodoFilter.startDate) {
                        params.append('startDate', activePeriodoFilter.startDate);
                    }
                    if (activePeriodoFilter.endDate) {
                        params.append('endDate', activePeriodoFilter.endDate);
                    }
                    const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
                    params.append('periodoLogica', logic);
                }
                
                const queryString = params.toString();
                if (queryString) {
                    url += `?${queryString}`;
                }
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.success) {
                    cliente.tarefas_count = data.count;
                    cliente.primeira_tarefa_url = data.primeira_tarefa_url; // Armazenar URL da primeira tarefa
                    cliente.tarefas_loaded = true; // Marcar como carregado
                    // Atualizar card individual imediatamente
                    updateClientCard(cliente.id, { 
                        tarefas: data.count, 
                        tarefas_loaded: true,
                        primeira_tarefa_url: data.primeira_tarefa_url
                    });
                } else {
                    console.warn(`Erro ao buscar tarefas para cliente ${cliente.nome}:`, data);
                    cliente.tarefas_count = 0;
                    cliente.primeira_tarefa_url = null;
                    cliente.tarefas_loaded = true; // Marcar como carregado mesmo com erro
                    updateClientCard(cliente.id, { 
                        tarefas: 0, 
                        tarefas_loaded: true,
                        primeira_tarefa_url: null
                    });
                }
            } catch (error) {
                console.error(`Erro ao buscar tarefas para cliente ${cliente.nome}:`, error);
                cliente.tarefas_count = 0;
                cliente.primeira_tarefa_url = null;
                cliente.tarefas_loaded = true; // Marcar como carregado mesmo com erro
                updateClientCard(cliente.id, { 
                    tarefas: 0, 
                    tarefas_loaded: true,
                    primeira_tarefa_url: null
                });
            }
        });
        
        // Aguardar lote atual
        await Promise.all(batchPromises);
        
        // Pequeno delay antes do próximo lote (exceto no último)
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        

    }
    

    
    // Atualizar contagem total de tarefas após carregamento completo
    updateTasksCount();
    updateEstimatedHoursCount();
    updateRealizedHoursCount();

    // Atualizar contagem de colaboradores usando tarefas em cache
    updateCollaboratorsAfterRender(clientesParaRenderizar);
}

// Carregar contagens de contratos de forma assíncrona (em lotes)
async function loadContractCountsAsync(clientes) {
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    

    
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        
        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                const response = await fetch(`/api/contratos-count/${cliente.id}`);
                const data = await response.json();
                
                if (data && data.success) {
                    cliente.contratos_count = data.count;
                    cliente.contratos_loaded = true; // Marcar como carregado
                    cliente.status_cliente = data.status_cliente || cliente.status_cliente;
                    updateClientCard(cliente.id, { contratos: data.count, contratos_loaded: true, status_cliente: data.status_cliente });
                } else {
                    console.warn(`Erro ao buscar contratos para cliente ${cliente.nome}:`, data);
                    cliente.contratos_count = 0;
                    cliente.contratos_loaded = true; // Marcar como carregado mesmo com erro
                    updateClientCard(cliente.id, { contratos: 0, contratos_loaded: true });
                }
            } catch (error) {
                console.error(`Erro ao buscar contratos para cliente ${cliente.nome}:`, error);
                cliente.contratos_count = 0;
                cliente.contratos_loaded = true; // Marcar como carregado mesmo com erro
                updateClientCard(cliente.id, { contratos: 0, contratos_loaded: true });
            }
        });
        
        // Aguardar lote atual
        await Promise.all(batchPromises);
        
        // Pequeno delay antes do próximo lote (exceto no último)
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        

    }
    

}

// Função auxiliar para construir parâmetros de filtro para horas
function buildHoursFilterParams() {
    const queryParams = new URLSearchParams();
    
    // Obter filtros ativos
    const statusFilters = activeFilters.filter(f => f.type === 'status');
    const periodoFilters = activeFilters.filter(f => f.type === 'periodo');
    
    // Adicionar filtros de status
    if (statusFilters.length > 0) {
        const allStatusIds = [];
        statusFilters.forEach(filter => {
            allStatusIds.push(...filter.statuses);
        });
        const uniqueStatusIds = [...new Set(allStatusIds)];
        if (uniqueStatusIds.length > 0) {
            queryParams.append('status', uniqueStatusIds.join(','));

        }
    }
    
    // Adicionar filtros de período
    if (periodoFilters.length > 0) {
        let finalStartDate = null;
        let finalEndDate = null;
        
        periodoFilters.forEach(filter => {

            if (filter.startDate && filter.endDate) {
                if (!finalStartDate || filter.startDate > finalStartDate) {
                    finalStartDate = filter.startDate;
                }
                if (!finalEndDate || filter.endDate < finalEndDate) {
                    finalEndDate = filter.endDate;
                }
            }
        });
        

        
        if (finalStartDate && finalEndDate) {
            const startDateFormatted = formatDateForAPI(finalStartDate);
            const endDateFormatted = formatDateForAPI(finalEndDate);
            queryParams.append('startDate', startDateFormatted);
            queryParams.append('endDate', endDateFormatted);

        }
    }
    
    const result = queryParams.toString();
    return result;
}

// Função auxiliar para construir parâmetros de filtro APENAS para tarefas (exclui status de contratos)
function buildTaskFilterParams() {
    const queryParams = new URLSearchParams();
    
    // 👥 USAR VARIÁVEIS GLOBAIS DE FILTROS (mais confiável que activeFilters)
    // Adicionar filtros de colaboradores usando a variável global
    if (activeColaboradorFilters && activeColaboradorFilters.length > 0) {
        queryParams.append('colaboradorIds', activeColaboradorFilters.join(','));
        console.log('👥 Incluindo colaboradores nos filtros de horas:', activeColaboradorFilters);
    }
    
    // Adicionar filtros de período usando a variável global + lógica E/OU
    if (activePeriodoFilter) {
        // Garantir datas válidas como yyyy-mm-dd
        const start = activePeriodoFilter.startDate || (typeof window !== 'undefined' ? window.selectedStartDate : null);
        const end = activePeriodoFilter.endDate || (typeof window !== 'undefined' ? window.selectedEndDate : null);
        if (start) {
            queryParams.append('inicio', formatDateForAPI(start));
        }
        if (end) {
            queryParams.append('fim', formatDateForAPI(end));
        }
        // Incluir lógica E/OU
        const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
        queryParams.append('periodoLogica', logic);
        console.log('📅 Incluindo período nos filtros de horas:', { inicio: start, fim: end, periodoLogica: logic });
    } else {
        // Fallback: usar seleção global do calendário
        const start = (typeof window !== 'undefined' ? window.selectedStartDate : null) || selectedStartDate;
        const end = (typeof window !== 'undefined' ? window.selectedEndDate : null) || selectedEndDate;
        if (start) queryParams.append('inicio', formatDateForAPI(start));
        if (end) queryParams.append('fim', formatDateForAPI(end));
        const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
        queryParams.append('periodoLogica', logic);
    }
    
    // FALLBACK: Obter de activeFilters se as variáveis globais não tiverem dados
    if (!activeColaboradorFilters || activeColaboradorFilters.length === 0) {
        const colaboradorFilters = activeFilters.filter(f => f.type === 'colaborador');
        if (colaboradorFilters.length > 0) {
            const allColaboradorIds = [];
            colaboradorFilters.forEach(filter => {
                if (filter.colaboradores) {
                    allColaboradorIds.push(...filter.colaboradores);
                }
            });
            const uniqueColaboradorIds = [...new Set(allColaboradorIds)];
            if (uniqueColaboradorIds.length > 0) {
                queryParams.append('colaboradorIds', uniqueColaboradorIds.join(','));
            }
        }
    }
    
    const result = queryParams.toString();
    return result;
}

// Função auxiliar para construir parâmetros de filtro SEM período (para visualização rápida)
function buildFilterParamsWithoutPeriod() {
    const queryParams = new URLSearchParams();
    
    // Obter apenas filtros de status (ignorar período)
    const statusFilters = activeFilters.filter(f => f.type === 'status');
    
    // Adicionar apenas filtros de status
    if (statusFilters.length > 0) {
        const allStatusIds = [];
        statusFilters.forEach(filter => {
            allStatusIds.push(...filter.statuses);
        });
        const uniqueStatusIds = [...new Set(allStatusIds)];
        if (uniqueStatusIds.length > 0) {
            queryParams.append('status', uniqueStatusIds.join(','));

        }
    }
    
    const result = queryParams.toString();
    return result;
}

// Carregar horas estimadas de forma assíncrona (em lotes)
async function loadEstimatedHoursAsync(clientes) {
    // INATIVO: horas/custos estimados
    try {
        const estimatedHoursCountCard = document.getElementById('estimatedHoursCountCard');
        if (estimatedHoursCountCard) estimatedHoursCountCard.style.display = 'none';
    } catch (_) {}
    return; // não carregar estimados
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    

    
    // Usar os parâmetros atuais (compatíveis com timestamps e lógica de período)
    const filterParams = getCurrentFilterParams();
    const queryString = filterParams ? `?${filterParams}` : '';

    
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        
        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                const response = await fetch(`/api/tempo-estimado/${cliente.id}${queryString}`);
                const data = await response.json();
                
                if (data && data.success) {
                    cliente.horas_estimadas = (data.tempo_decimal || 0).toFixed(2);
                    cliente.horas_loaded = true;
                    
                    // Calcular diferença se horas realizadas já estão carregadas
                    let updateData = { horas_estimadas: cliente.horas_estimadas, horas_loaded: true };
                    if (cliente.horas_realizadas_loaded) {
                        const diferenca = calculateTimeDifference(cliente.horas_estimadas, cliente.horas_realizadas);
                        cliente.diferenca = diferenca;
                        cliente.diferenca_loaded = true;
                        updateData.diferenca = diferenca;
                        updateData.diferenca_loaded = true;
                    }
                    
                    updateClientCard(cliente.id, updateData);
                } else {
                    console.warn(`Erro ao buscar horas estimadas para cliente ${cliente.nome}:`, data);
                    cliente.horas_estimadas = '0.00';
                    cliente.horas_loaded = true;
                    updateClientCard(cliente.id, { horas_estimadas: '0.00', horas_loaded: true });
                }
            } catch (error) {
                console.error(`Erro ao buscar horas estimadas para cliente ${cliente.nome}:`, error);
                cliente.horas_estimadas = '0.00';
                cliente.horas_loaded = true;
                updateClientCard(cliente.id, { horas_estimadas: '0.00', horas_loaded: true });
            }
        });
        
        // Aguardar lote atual
        await Promise.all(batchPromises);
        
        // Pequeno delay antes do próximo lote (exceto no último)
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        

    }
    

}

// Carregar horas realizadas de forma assíncrona (em lotes)
async function loadRealizedHoursAsync(clientes) {
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    

    
    // Usar os filtros atuais (inclui período, status e colaboradores)
    const queryParams = getCurrentFilterParams();
    const queryString = queryParams ? `?${queryParams}` : '';

    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);

        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                // Buscar colaboradores com suas horas realizadas/estimadas e somar conforme a regra
                const response = await fetch(`/api/colaboradores-nomes/${cliente.id}${queryString}`);
                const data = await response.json();

                let totalRealizadas = 0;
                if (data && data.success && Array.isArray(data.colaboradores)) {
                    if (data.colaboradores.length === 1) {
                        totalRealizadas = parseFloat(data.colaboradores[0].horas_realizadas) || 0;
                    } else {
                        totalRealizadas = data.colaboradores.reduce((sum, c) => sum + (parseFloat(c.horas_realizadas) || 0), 0);
                    }
                }

                cliente.horas_realizadas = totalRealizadas.toFixed(2);
                cliente.horas_realizadas_loaded = true;

                // Calcular diferença se horas estimadas já estão carregadas
                let updateData = { horas_realizadas: cliente.horas_realizadas, horas_realizadas_loaded: true };
                if (cliente.horas_loaded) {
                    const diferenca = calculateTimeDifference(cliente.horas_estimadas, cliente.horas_realizadas);
                    cliente.diferenca = diferenca;
                    cliente.diferenca_loaded = true;
                    updateData.diferenca = diferenca;
                    updateData.diferenca_loaded = true;
                }

                updateClientCard(cliente.id, updateData);
            } catch (error) {
                console.error(`Erro ao somar horas realizadas por colaboradores do cliente ${cliente.nome}:`, error);
                cliente.horas_realizadas = '0.00';
                cliente.horas_realizadas_loaded = true;
                updateClientCard(cliente.id, { horas_realizadas: '0.00', horas_realizadas_loaded: true });
            }
        });

        // Aguardar lote atual
        await Promise.all(batchPromises);

        // Pequeno delay antes do próximo lote (exceto no último)
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        

    }
    

}

// Carregar custos totais (estimado e realizado) de forma assíncrona (em lotes)
async function loadCustosTotaisAsync(clientes) {
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes

    // Parâmetros de filtro atuais
    const filterParams = getCurrentFilterParams();
    const queryString = filterParams ? `?${filterParams}` : '';

    // Buscar lista de colaboradores uma vez para mapear nome → membroId
    let colaboradoresLista = [];
    try {
        const respColabs = await fetch('/api/colaboradores', { credentials: 'include' });
        if (respColabs.ok) {
            const dColabs = await respColabs.json();
            colaboradoresLista = Array.isArray(dColabs.colaboradores) ? dColabs.colaboradores : [];
        }
    } catch (_) {}

    const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const findMemberByName = (nome) => {
        const alvo = normalize(nome || '');
        if (!alvo) return null;
        // Primeiro correspondência EXATA
        let match = colaboradoresLista.find(c => normalize(c.nome) === alvo);
        // Senão, aproximação por includes
        if (!match) {
            match = colaboradoresLista.find(c => {
                const cn = normalize(c.nome);
                return cn.includes(alvo) || alvo.includes(cn);
            });
        }
        return match && match.id ? match.id : null;
    };

    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (cliente) => {
            try {
                // Tarefas do cliente: usar cache, senão buscar
                let tarefas = clienteTarefasCarregadas.get(cliente.id) || [];
                if (!tarefas || tarefas.length === 0) {
                    try {
                        const resp = await fetch(`/api/tarefas-detalhes/${cliente.id}${queryString}`, { credentials: 'include' });
                        const json = await resp.json();
                        tarefas = (json && json.success) ? (json.tarefas || []) : [];
                        clienteTarefasCarregadas.set(cliente.id, tarefas);
                        updateCollaboratorsCountFromTasks(cliente.id);
                    } catch (_) {
                        tarefas = [];
                        clienteTarefasCarregadas.set(cliente.id, tarefas);
                        updateCollaboratorsCountFromTasks(cliente.id);
                    }
                }

                // Agregar ms por usuário a partir das tarefas e registros
                const msPorUsuario = new Map();
                const nomePorUsuario = new Map();
                const toMs = (val) => {
                    let n = typeof val === 'string' ? parseFloat(val) : Number(val);
                    if (!Number.isFinite(n) || n <= 0) return 0;
                    // Se parecer horas decimais (ex.: 0.15), converter para ms
                    if (n < 1000) return Math.round(n * 3600000);
                    // Caso contrário, já está em ms
                    return Math.round(n);
                };

                const fetchRegPromises = [];
                tarefas.forEach(t => {
                    const usuarios = Array.isArray(t.colaboradores) ? t.colaboradores : [];
                    usuarios.forEach(u => {
                        const uid = parseInt(u.usuario_id, 10);
                        if (!isNaN(uid) && u.nome) nomePorUsuario.set(uid, u.nome);
                    });

                    const registrosLocais = (t.registros && Array.isArray(t.registros)) ? t.registros : null;
                    if (registrosLocais) {
                        registrosLocais.forEach(r => {
                            const uid = parseInt(r.usuario_id, 10);
                            if (!isNaN(uid)) {
                                const ms = toMs(r.tempo_realizado);
                                msPorUsuario.set(uid, (msPorUsuario.get(uid) || 0) + ms);
                            }
                        });
                    } else if (t.id != null) {
                        // Buscar registros quando não estão no cache
                        fetchRegPromises.push(
                            fetch(`/api/tarefa-registros-tempo/${t.id}`, { credentials: 'include' })
                                .then(resp => resp.json())
                                .then(data => {
                                    const regs = (data && data.success) ? (data.registros || []) : [];
                                    regs.forEach(r => {
                                        const uid = parseInt(r.usuario_id, 10);
                                        if (!isNaN(uid)) {
                                            const ms = toMs(r.tempo_realizado);
                                            msPorUsuario.set(uid, (msPorUsuario.get(uid) || 0) + ms);
                                        }
                                    });
                                })
                                .catch(() => {})
                        );
                    }
                });

                await Promise.all(fetchRegPromises);

                const usuariosDetalhados = Array.from(msPorUsuario.keys()).map(uid => {
                    const horas = parseFloat(((msPorUsuario.get(uid) || 0) / 3600000).toFixed(2));
                    const nome = nomePorUsuario.get(uid) || `Usuário ${uid}`;
                    return { usuario_id: uid, nome, horas };
                });

                // Somar custo realizado: horas × custo_por_hora por colaborador
                let custoRealizadoTotal = 0;
                for (const u of usuariosDetalhados) {
                    const membroId = findMemberByName(u.nome);
                    if (!membroId) {
                        // Se não resolver membroId com segurança, ignorar para evitar valor incorreto
                        continue;
                    }
                    try {
                        const respCPH = await fetch(`/api/custo-hora-membro/${membroId}`, { credentials: 'include' });
                        if (respCPH.ok) {
                            const d3 = await respCPH.json();
                            const cph = parseFloat(d3?.custo_por_hora) || 0;
                            if (cph > 0) {
                                custoRealizadoTotal += (cph * u.horas);
                            }
                        }
                    } catch (_) {}
                }

                const custoRealizadoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoRealizadoTotal);

                // Atualizar custo realizado no card (novo cálculo somado por colaborador)
                updateClientCard(cliente.id, {
                    custo: custoRealizadoFormatado,
                    custo_loaded: true
                });

                // Manter custo estimado via endpoint dedicado (sem alterar a lógica atual)
                try {
                    const respEst = await fetch(`/api/custo-estimado/${cliente.id}${queryString}`, { credentials: 'include' });
                    const jEst = await respEst.json();
                    const custoEstimadoFormatado = jEst && jEst.success ? (jEst.custo_estimado_formatado || 'R$ 0,00') : 'R$ 0,00';
                    updateClientCard(cliente.id, {
                        custo_estimado: custoEstimadoFormatado,
                        custo_estimado_loaded: true
                    });
                } catch (_) {
                    updateClientCard(cliente.id, {
                        custo_estimado: 'R$ 0,00',
                        custo_estimado_loaded: true
                    });
                }
            } catch (error) {
                console.error(`💰💡 Erro ao calcular custo realizado somado para cliente ${cliente.id}:`, error);
                updateClientCard(cliente.id, {
                    custo: 'R$ 0,00',
                    custo_loaded: true
                });
            }
        });

        // Aguardar conclusão do lote atual
        await Promise.all(batchPromises);

        // Delay entre lotes para não sobrecarregar o servidor
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }
}



// Carregar produtos de forma assíncrona (em lotes)
async function loadProdutosAsync(clientes) {
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    

    
    try {
    
    // Verificar se 7 MARES está na lista
    const cliente7Mares = clientes.find(c => c.nome === '7 MARES');
    
    // Usar parâmetros atuais (inclui colaboradores, período com timestamps e periodoLogica)
    const filterParams = getCurrentFilterParams();
    const queryString = filterParams ? `?${filterParams}` : '';
    
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        
        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                const url = `/api/produtos-cliente/${cliente.id}${queryString}`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.success) {
                    const produtosFormatados = data.produtos_formatados || '';
                    updateClientCard(cliente.id, { 
                        produtos: produtosFormatados,
                        produtos_loaded: true 
                    });
                } else {
                    console.warn(`🛍️ Erro ao buscar produtos para cliente ${cliente.nome}:`, data);
                    updateClientCard(cliente.id, { 
                        produtos: '',
                        produtos_loaded: true 
                    });
                }
            } catch (error) {
                console.error(`🛍️ Erro ao buscar produtos para cliente ${cliente.nome}:`, error);
                updateClientCard(cliente.id, { 
                    produtos: '',
                    produtos_loaded: true 
                });
            }
        });
        
        // Aguardar conclusão do lote atual
        await Promise.all(batchPromises);
        
        // Delay entre lotes para não sobrecarregar o servidor
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    }
    

    
    } catch (error) {
        console.error('🛍️ ERRO na função loadProdutosAsync:', error);
        console.error('🛍️ Stack trace:', error.stack);
    }
}

// Carregar colaboradores de forma assíncrona (em lotes)
async function loadCollaboratorsAsync(clientes) {
    try {
        for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
            const batch = clientes.slice(i, i + BATCH_SIZE);

            const batchPromises = batch.map(async (cliente) => {
                try {
                    // Usar dados de tarefas em cache para contar colaboradores únicos
                    const count = countCollaboratorsFromTasks(cliente.id);
                    updateClientCard(cliente.id, { colaboradores: count, colaboradores_loaded: true });
                } catch (error) {
                    console.warn('💥 Erro na busca de colaboradores (simples):', error);
                    updateClientCard(cliente.id, { colaboradores: 0, colaboradores_loaded: true });
                }
            });

            await Promise.all(batchPromises);

            // Delay entre lotes para não sobrecarregar o servidor
            if (i + BATCH_SIZE < clientes.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
    } catch (error) {
        console.error('👥 ERRO na função loadCollaboratorsAsync:', error);
    }
}

// Atualizar contagem de colaboradores imediatamente após renderizar os cards, sem backend
function updateCollaboratorsAfterRender(clientes) {
    try {
        clientes.forEach(c => {
            const count = countCollaboratorsFromTasks(c.id);
            updateClientCard(c.id, { colaboradores: count, colaboradores_loaded: true });
        });
    } catch (e) {
        console.warn('Falha ao atualizar colaboradores após render:', e);
    }
}



// Renderizar cards dos clientes
function renderClientCards(clientes, highlightedClientIds = []) {
    const clientsGrid = document.getElementById('clientsGrid');
    
    if (!clientsGrid) {
        console.error('Elemento clientsGrid não encontrado');
        return;
    }
    
    if (clientes.length === 0) {
        clientsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>Nenhum cliente encontrado</h3>
                <p>Cadastre o primeiro cliente para começar</p>
                <a href="/" class="btn btn-primary">
                    <i class="fas fa-plus"></i>
                    Cadastrar Cliente
                </a>
            </div>
        `;
        return;
    }
    
    // OTIMIZAÇÃO: Se há filtros aplicados, renderizar apenas os clientes destacados
    let clientesParaRenderizar = clientes;
    
    if (highlightedClientIds.length > 0) {
        // Filtrar apenas os clientes que devem ser destacados
        clientesParaRenderizar = clientes.filter(cliente => {
            const clienteId = cliente.id;
            return highlightedClientIds.includes(clienteId);
        });
    }
    
    // Gerar HTML apenas dos cards necessários
    const cardsHTML = clientesParaRenderizar.map(cliente => createClientCard(cliente)).join('');

    // Substituir "Carregando..." de colaboradores por 0 imediatamente
    try {
        clientesParaRenderizar.forEach(c => {
            updateClientCard(c.id, { colaboradores: 0, colaboradores_loaded: true });
        });
    } catch (_) {}

    clientsGrid.innerHTML = cardsHTML;
    
    // Atualizar contador de clientes e tarefas
    updateClientsCount();
    updateTasksCount();
    updateEstimatedHoursCount();
    updateRealizedHoursCount();
}

// Criar HTML de um card de cliente
function createClientCard(cliente) {
    const nome = cliente.nome || 'Nome não informado';
    
    // Determinar o texto da contagem de tarefas
    let tarefasText;
    if (cliente.tarefas_count === 'loading') {
        tarefasText = 'Tarefas: <span class="loading-text">Carregando...</span>';
    } else {
        tarefasText = `Tarefas: ${cliente.tarefas_count || 0}`;
    }
    
    // Determinar o texto da contagem de contratos
    let contratosText;
    if (cliente.contratos_count === 'loading') {
        contratosText = 'Contratos: <span class="loading-text">Carregando...</span>';
    } else {
        contratosText = `Contratos: ${cliente.contratos_count || 0}`;
    }
    
    // Verificar se deve mostrar ícone de expandir (apenas se tem contratos)
    const hasContracts = cliente.contratos_count && cliente.contratos_count !== 'loading' && cliente.contratos_count > 0;
    const expandIcon = hasContracts ? `
        <div class="expand-icon" onclick="toggleClientContracts('${cliente.id}')">
            <i class="fas fa-chevron-down" id="expand-icon-${cliente.id}"></i>
        </div>
    ` : '';
    
    const statusBadge = cliente.status_cliente && cliente.status_cliente === 'inativo' ? `<span class="client-status inativo">INATIVO</span>` : '';
    return `
        <div class="client-card" data-client-id="${cliente.id}">
            <div class="client-card-header">
                <h3>${nome}</h3>
                ${statusBadge}
                ${expandIcon}
            </div>
            <div class="client-card-body">
                <div class="client-info">
                    <div class="client-info-item">
                        <i class="fas fa-tasks"></i>
                        <span class="value tarefas-value">${tarefasText}</span>
                    </div>
                    <div class="client-info-item">
                        <i class="fas fa-box"></i>
                        <span class="value produtos-value">Produtos: <span class="loading-text">Carregando...</span></span>
                    </div>
                    <div class="client-info-item">
                        <i class="fas fa-users"></i>
                        <span class="value colaboradores-value">Colaboradores: 0</span>
                    </div>
                    <!-- INATIVO: Hrs estimadas
                    <div class="client-info-item">
                        <i class="fas fa-clock"></i>
                        <span class="value horas-estimadas-value">Hrs estimadas: <span class="loading-text">Carregando...</span></span>
                    </div>
                    -->
                    <div class="client-info-item">
                        <i class="fas fa-stopwatch"></i>
                        <span class="value horas-realizadas-value">Hrs realizadas: <span class="loading-text">Carregando...</span></span>
                    </div>
                    <!-- INATIVO: Diferença
                    <div class="client-info-item">
                        <i class="fas fa-calculator"></i>
                        <span class="value diferenca-value">Diferença: <span class="loading-text">Carregando...</span></span>
                    </div>
                    -->
                    <!-- INATIVO: Custo Estimado
                    <div class="client-info-item">
                        <i class="fas fa-coins"></i>
                        <span class="value custo-estimado-value">Custo Estimado: <span class="loading-text">Carregando...</span></span>
                    </div>
                    -->
                    <div class="client-info-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span class="value custo-value">Realizado: <span class="loading-text">Carregando...</span></span>
                    </div>
                    <div class="client-info-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span class="value faturamento-value">Faturamento: <span class="loading-text">Carregando...</span></span>
                    </div>
                    <div class="client-info-item margem-item" style="display: none;">
                        <i class="fas fa-chart-line"></i>
                        <span class="value margem-value">Margem: <span class="loading-text">Carregando...</span></span>
                    </div>
                    <div class="client-info-item">
                        <i class="fas fa-file-contract"></i>
                        <span class="value contratos-value">${contratosText}</span>
                    </div>

                </div>
                <div class="client-contracts-section" id="contracts-section-${cliente.id}" style="display: none;">
                    <div class="contracts-loading" id="contracts-loading-${cliente.id}" style="display: none;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Carregando contratos...</span>
                    </div>
                    <div class="contracts-grid" id="contracts-grid-${cliente.id}"></div>
                </div>
            </div>
        </div>
    `;
}

// Atualizar card individual com contagem de tarefas e/ou contratos
function updateClientCard(clienteId, updates) {
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) {
        return;
    }
    
    // Verificar se deve mostrar/ocultar a margem baseado no período
    const margemItem = clientCard.querySelector('.margem-item');
    if (margemItem) {
        const isSingleMonth = checkIfSingleMonth();
        if (isSingleMonth) {
            margemItem.style.display = 'block';
            
            // Calcular margem se temos faturamento e custo realizado
            const faturamentoValueSpan = clientCard.querySelector('.faturamento-value');
            const custoValueSpan = clientCard.querySelector('.custo-value');
            const margemValue = margemItem.querySelector('.margem-value');
            
            if (margemValue && faturamentoValueSpan && custoValueSpan) {
                // Extrair valores numéricos do faturamento e custo
                const faturamentoText = faturamentoValueSpan.textContent || '';
                const custoText = custoValueSpan.textContent || '';
                
                // Regex para extrair valores monetários (R$ 123,45 ou 123,45)
                const faturamentoMatch = faturamentoText.match(/R\$\s*([\d.,]+)/);
                const custoMatch = custoText.match(/R\$\s*([\d.,]+)/);
                
                if (faturamentoMatch && custoMatch) {
                    // Converter strings para números (substituir vírgula por ponto)
                    const faturamentoValue = parseFloat(faturamentoMatch[1].replace(/\./g, '').replace(',', '.'));
                    const custoValue = parseFloat(custoMatch[1].replace(/\./g, '').replace(',', '.'));
                    
                    // Calcular margem (Faturamento - Custo Realizado)
                    const margem = faturamentoValue - custoValue;
                    
                    // Formatar e exibir a margem
                    const margemFormatada = formatCurrency(margem);
                    margemValue.innerHTML = `Margem: <span class="margin-loaded">${margemFormatada}</span>`;
                } else {
                    // Fallbacks robustos para zero
                    const faturamentoZero = /R\$\s*0,00/i.test(faturamentoText) || /\b0\s*registro(s)?\b/i.test(faturamentoText);
                    const custoZero = /R\$\s*0,00/i.test(custoText);

                    if (faturamentoZero) {
                        // Quando faturamento for zero/ausente, considerar margem como zero
                        margemValue.innerHTML = 'Margem: <span class="margin-loaded">R$ 0,00</span>';
                    } else if (custoZero && faturamentoMatch) {
                        // Se custo for zero e faturamento presente numérico, margem = faturamento
                        const faturamentoValue = parseFloat(faturamentoMatch[1].replace(/\./g, '').replace(',', '.'));
                        const margemFormatada = formatCurrency(faturamentoValue);
                        margemValue.innerHTML = `Margem: <span class="margin-loaded">${margemFormatada}</span>`;
                    } else {
                        // Dados ainda não prontos
                        margemValue.innerHTML = 'Margem: <span class="loading-text">Carregando...</span>';
                    }
                }
            }
        } else {
            margemItem.style.display = 'none';
        }
    }
    
    // Atualizar tarefas se fornecido
    if (updates.tarefas !== undefined) {
        const tarefasValueSpan = clientCard.querySelector('.tarefas-value');
        if (tarefasValueSpan) {
            if (updates.tarefas_loaded) {
                const hasTarefas = updates.tarefas && updates.tarefas > 0;
                const arrowIcon = hasTarefas ? '<span class="tarefas-arrow" onclick="toggleTarefasDetails(\'' + clienteId + '\')" title="Ver detalhes das tarefas">></span>' : '';
                tarefasValueSpan.innerHTML = `Tarefas: <span class="task-count-loaded">${updates.tarefas || 0}</span>${arrowIcon}`;
                
                // Botão de redirecionamento removido - mantendo apenas os botões individuais nas tarefas detalhadas
            } else {
                tarefasValueSpan.innerHTML = `Tarefas: ${updates.tarefas || 0}`;
            }
        } else {
            console.warn(`Elemento .tarefas-value não encontrado para cliente ${clienteId}`);
        }
    }
    
    // Atualizar contratos se fornecido
    if (updates.contratos !== undefined) {
        const contratosValueSpan = clientCard.querySelector('.contratos-value');
        if (contratosValueSpan) {
            if (updates.contratos_loaded) {
                contratosValueSpan.innerHTML = `Contratos: <span class="contract-count-loaded">${updates.contratos || 0}</span>`;
            } else {
                contratosValueSpan.innerHTML = `Contratos: ${updates.contratos || 0}`;
            }
        }
        
        // Verificar se deve mostrar/ocultar ícone de expandir
        if (updates.contratos_loaded) {
            const header = clientCard.querySelector('.client-card-header');
            const existingExpandIcon = header.querySelector('.expand-icon');
            const hasContracts = updates.contratos && updates.contratos > 0;
            
            if (hasContracts && !existingExpandIcon) {
                // Adicionar ícone de expandir se não existe e tem contratos
                const expandIcon = document.createElement('div');
                expandIcon.className = 'expand-icon';
                expandIcon.onclick = () => toggleClientContracts(clienteId);
                expandIcon.innerHTML = `<i class="fas fa-chevron-down" id="expand-icon-${clienteId}"></i>`;
                header.appendChild(expandIcon);
            } else if (!hasContracts && existingExpandIcon) {
                // Remover ícone de expandir se não tem contratos
                existingExpandIcon.remove();
            }
        }
    }

    if (updates.status_cliente !== undefined) {
        const header = clientCard.querySelector('.client-card-header');
        let badge = header.querySelector('.client-status');
        if (updates.status_cliente === 'inativo') {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'client-status inativo';
                badge.textContent = 'INATIVO';
                header.insertBefore(badge, header.querySelector('.expand-icon'));
            } else {
                badge.classList.remove('ativo');
                badge.classList.add('inativo');
                badge.textContent = 'INATIVO';
            }
        } else {
            if (badge) badge.remove();
        }
    }
    
    // Atualizar horas estimadas se fornecido
    if (updates.horas_estimadas !== undefined) {
        const horasValueSpan = clientCard.querySelector('.horas-estimadas-value');
        if (horasValueSpan) {
            if (updates.horas_loaded) {
                horasValueSpan.innerHTML = `Hrs estimadas: <span class="hours-loaded">${updates.horas_estimadas}</span>`;
            } else {
                horasValueSpan.innerHTML = `Hrs estimadas: ${updates.horas_estimadas}`;
            }
        }
    }
    
    // Atualizar horas realizadas se fornecido
    if (updates.horas_realizadas !== undefined) {
        const horasRealizadasValueSpan = clientCard.querySelector('.horas-realizadas-value');
        if (horasRealizadasValueSpan) {
            if (updates.horas_realizadas_loaded) {
                horasRealizadasValueSpan.innerHTML = `Hrs realizadas: <span class="hours-realized-loaded">${updates.horas_realizadas}</span>`;
            } else {
                horasRealizadasValueSpan.innerHTML = `Hrs realizadas: ${updates.horas_realizadas}`;
            }
        }
    }
    
    // Atualizar colaboradores se fornecido
    if (updates.colaboradores !== undefined) {
        const colaboradoresValueSpan = clientCard.querySelector('.colaboradores-value');
        if (colaboradoresValueSpan) {
            if (updates.colaboradores_loaded) {
                const hasColabs = (updates.colaboradores || 0) > 0;
                const arrowIcon = hasColabs ? '<span class="colaboradores-arrow" onclick="toggleColaboradoresDetailsSimples(\'' + clienteId + '\')" title="Ver detalhes dos colaboradores">></span>' : '';
                colaboradoresValueSpan.innerHTML = `Colaboradores: <span class="collaborators-loaded">${updates.colaboradores || 0}</span>${arrowIcon}`;
            } else {
                colaboradoresValueSpan.innerHTML = `Colaboradores: ${updates.colaboradores || 0}`;
            }
        }
    }

    
    // Atualizar custo se fornecido
    if (updates.custo !== undefined) {
        // Verificar se o card ainda existe no DOM antes de procurar elementos filhos
        if (!document.body.contains(clientCard)) {
            return; // Card foi removido/filtrado, não processar
        }
        
        const custoValueSpan = clientCard.querySelector('.custo-value');
        if (custoValueSpan) {
            if (updates.custo_loaded) {
                custoValueSpan.innerHTML = `Realizado: <span class="cost-loaded">${updates.custo}</span>`;
            } else {
                custoValueSpan.innerHTML = `Realizado: ${updates.custo}`;
            }
            
            // Forçar refresh visual
            custoValueSpan.style.display = 'none';
            custoValueSpan.offsetHeight; // Trigger reflow
            custoValueSpan.style.display = '';
            
            // Verificação adicional para garantir que o valor foi atualizado
            setTimeout(() => {
                const verificacao = document.querySelector(`[data-client-id="${clienteId}"] .custo-value`);
                if (verificacao && !verificacao.innerHTML.includes(updates.custo)) {
                    verificacao.innerHTML = `Realizado: <span class="cost-loaded">${updates.custo}</span>`;
                }
            }, 100);
        }
    }
    
    // Atualizar custo estimado se fornecido
    if (updates.custo_estimado !== undefined) {
        const custoEstimadoValueSpan = clientCard.querySelector('.custo-estimado-value');
        if (custoEstimadoValueSpan) {
            if (updates.custo_estimado_loaded) {
                custoEstimadoValueSpan.innerHTML = `Custo Estimado: <span class="cost-estimated-loaded">${updates.custo_estimado}</span>`;
            } else {
                custoEstimadoValueSpan.innerHTML = `Custo Estimado: ${updates.custo_estimado}`;
            }
        }
    }
    
    // Atualizar produtos se fornecido
    if (updates.produtos !== undefined) {
        const produtosValueSpan = clientCard.querySelector('.produtos-value');
        if (produtosValueSpan) {
            if (updates.produtos_loaded) {
                // Separar produtos por vírgula e contar
                const produtos = updates.produtos ? updates.produtos.split(',').map(p => p.trim()).filter(p => p) : [];
                const produtosCount = produtos.length;
                if (produtosCount > 0) {
                    const arrowIcon = '<span class="produtos-arrow" onclick="toggleProdutosDetails(\'' + clienteId + '\')" title="Ver detalhes dos produtos">></span>';
                    produtosValueSpan.innerHTML = `Produtos: <span class="products-loaded">${produtosCount}</span>${arrowIcon}`;
                    
                    // Adicionar event listener diretamente como alternativa
                    setTimeout(() => {
                        const arrowElement = produtosValueSpan.querySelector('.produtos-arrow');
                        if (arrowElement) {
                            arrowElement.addEventListener('click', function() {
                                window.toggleProdutosDetails(clienteId);
                            });
                        }
                    }, 100);
                } else {
                    produtosValueSpan.innerHTML = `Produtos: <span class="products-loaded">0</span>`;
                }
            } else {
                produtosValueSpan.innerHTML = `Produtos: ${updates.produtos}`;
            }
        } else {
            console.warn('produtosValueSpan não encontrado para cliente:', clienteId);
        }
    }
    
    // Atualizar faturamento se fornecido
    if (updates.faturamento_registros !== undefined) {
        const faturamentoValueSpan = clientCard.querySelector('.faturamento-value');
        
        if (faturamentoValueSpan) {
            const registros = updates.faturamento_registros || [];
            const totalRegistros = updates.faturamento_total_registros || 0;
            
            if (totalRegistros > 0) {
                // Verificar se o período selecionado é de um único mês
                const isSingleMonth = checkIfSingleMonth();
                
                if (isSingleMonth) {
                    // Mostrar apenas o valor total sem seta de detalhes
                    const valorTotal = registros.reduce((sum, registro) => sum + parseFloat(registro.valor_bruto || 0), 0);
                    const valorFormatado = formatCurrency(valorTotal);
                    faturamentoValueSpan.innerHTML = `Faturamento: <span class="billing-loaded">${valorFormatado}</span>`;
                } else {
                    // Mostrar com setinha expansível (ícone alterado para >)
                    const arrowIcon = '<span class="faturamento-arrow" onclick="toggleFaturamentoDetails(\'' + clienteId + '\')" style="cursor: pointer; margin-left: 5px;">></span>';
                    faturamentoValueSpan.innerHTML = `Faturamento: <span class="billing-loaded">${totalRegistros} registro${totalRegistros > 1 ? 's' : ''}</span>${arrowIcon}`;
                    
                    // Armazenar registros do faturamento no elemento para uso posterior
                    faturamentoValueSpan.dataset.faturamentoRegistros = JSON.stringify(registros);
                }
            } else {
                // Sem registros de faturamento
                faturamentoValueSpan.innerHTML = `Faturamento: <span class="billing-loaded">0 registros</span>`;
            }
        }
    }

    
    // Atualizar diferença se fornecido
    if (updates.diferenca !== undefined) {
        const diferencaValueSpan = clientCard.querySelector('.diferenca-value');
        if (diferencaValueSpan) {
            if (updates.diferenca_loaded) {
                diferencaValueSpan.innerHTML = `Diferença: <span class="hours-difference-loaded">${updates.diferenca}</span>`;
            } else {
                diferencaValueSpan.innerHTML = `Diferença: ${updates.diferenca}`;
            }
        }
    }
}

// Funções auxiliares

// Formatar valor monetário
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'R$ 0,00';
    }
    
    const numericValue = parseFloat(value);
    return numericValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Formatar data
function formatDate(dateString) {
    if (!dateString) return 'Data não informada';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

// Calcular diferença entre tempo estimado e realizado
function calculateTimeDifference(estimatedTime, realizedTime) {
    // Converter strings para números decimais
    const estimated = parseFloat(estimatedTime) || 0;
    const realized = parseFloat(realizedTime) || 0;
    
    // Calcular diferença (estimado - realizado)
    const difference = estimated - realized;
    
    // Retornar com 2 casas decimais
    return difference.toFixed(2);
}

// Função para verificar se o período selecionado é de um único mês
function checkIfSingleMonth() {
    if (!selectedStartDate || !selectedEndDate) {
        return false; // Sem período selecionado, não é um único mês
    }
    
    const startMonth = selectedStartDate.getMonth();
    const startYear = selectedStartDate.getFullYear();
    const endMonth = selectedEndDate.getMonth();
    const endYear = selectedEndDate.getFullYear();
    
    // Verificar se é o mesmo mês e ano
    return startMonth === endMonth && startYear === endYear;
}

// Função para atualizar a visibilidade da margem em todos os cards
function updateMargemVisibilityInAllCards() {

    
    const clientCards = document.querySelectorAll('.client-card');
    const isSingleMonth = checkIfSingleMonth();
    

    
    clientCards.forEach(card => {
        const margemItem = card.querySelector('.margem-item');
        if (margemItem) {
            if (isSingleMonth) {
                margemItem.style.display = 'block';
                
                // Calcular margem se temos faturamento e custo realizado
                const faturamentoValueSpan = card.querySelector('.faturamento-value');
                const custoValueSpan = card.querySelector('.custo-value');
                const margemValue = margemItem.querySelector('.margem-value');
                
                if (margemValue && faturamentoValueSpan && custoValueSpan) {
                    // Extrair valores numéricos do faturamento e custo
                    const faturamentoText = faturamentoValueSpan.textContent || '';
                    const custoText = custoValueSpan.textContent || '';
                    
                    // Regex para extrair valores monetários (R$ 123,45 ou 123,45)
                    const faturamentoMatch = faturamentoText.match(/R\$\s*([\d.,]+)/);
                    const custoMatch = custoText.match(/R\$\s*([\d.,]+)/);
                    
                    if (faturamentoMatch && custoMatch) {
                        // Converter strings para números (substituir vírgula por ponto)
                        const faturamentoValue = parseFloat(faturamentoMatch[1].replace(/\./g, '').replace(',', '.'));
                        const custoValue = parseFloat(custoMatch[1].replace(/\./g, '').replace(',', '.'));
                        
                        // Calcular margem (Faturamento - Custo Realizado)
                        const margem = faturamentoValue - custoValue;
                        
                        // Formatar e exibir a margem
                        const margemFormatada = formatCurrency(margem);
                        margemValue.innerHTML = `Margem: <span class="margin-loaded">${margemFormatada}</span>`;
                    } else {
                        // Fallbacks robustos para zero
                        const faturamentoText = faturamentoValueSpan.textContent || '';
                        const custoText = custoValueSpan.textContent || '';
                        const faturamentoZero = /R\$\s*0,00/i.test(faturamentoText) || /\b0\s*registro(s)?\b/i.test(faturamentoText);
                        const custoZero = /R\$\s*0,00/i.test(custoText);

                        if (faturamentoZero) {
                            margemValue.innerHTML = 'Margem: <span class="margin-loaded">R$ 0,00</span>';
                        } else if (custoZero && faturamentoMatch) {
                            const faturamentoValue = parseFloat(faturamentoMatch[1].replace(/\./g, '').replace(',', '.'));
                            const margemFormatada = formatCurrency(faturamentoValue);
                            margemValue.innerHTML = `Margem: <span class="margin-loaded">${margemFormatada}</span>`;
                        } else {
                            margemValue.innerHTML = 'Margem: <span class="loading-text">Carregando...</span>';
                        }
                    }
                }
                
        
            } else {
                margemItem.style.display = 'none';

            }
        }
    });
}

// Função para alternar detalhes do faturamento
function toggleFaturamentoDetails(clienteId) {

    
    // Verificar se já existe um mini card aberto e fechá-lo
    const existingMiniCard = document.querySelector('.faturamento-mini-card');
    if (existingMiniCard) {
        closeFaturamentoMiniCard();
        return;
    }
    
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) {
        console.error('❌ Card do cliente não encontrado:', clienteId);
        return;
    }
    
    const faturamentoValueSpan = clientCard.querySelector('.faturamento-value');
    if (!faturamentoValueSpan) {
        console.error('❌ Span de faturamento não encontrado');
        return;
    }
    
    // Obter registros do faturamento
    const faturamentoRegistrosStr = faturamentoValueSpan.dataset.faturamentoRegistros;
    if (!faturamentoRegistrosStr) {
        console.error('❌ Registros do faturamento não encontrados');
        return;
    }
    
    let faturamentoRegistros;
    try {
        faturamentoRegistros = JSON.parse(faturamentoRegistrosStr);
    } catch (error) {
        console.error('❌ Erro ao parsear registros do faturamento:', error);
        return;
    }
    

    
    // Mostrar mini card com os dados
    showFaturamentoMiniCard(clienteId, faturamentoRegistros);
}

// Função para carregar checkboxes de status
function loadStatusCheckboxes(container, filterId) {
    fetch('/api/tarefas-status')
        .then(response => response.json())
        .then(data => {
            if (data && data.success && Array.isArray(data.statuses)) {
                container.innerHTML = '';
                
                data.statuses.forEach(status => {
                    const checkboxContainer = document.createElement('div');
                    checkboxContainer.className = 'status-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `status_${filterId}_${status}`;
                    checkbox.value = status;
                    checkbox.addEventListener('change', () => {
                        updateStatusFilter(filterId);
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = checkbox.id;
                    label.textContent = status;
                    
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(label);
                    container.appendChild(checkboxContainer);
                });
            } else {
                // Fallback com status padrão
                const defaultStatuses = ['a fazer', 'em andamento', 'concluído'];
                container.innerHTML = '';
                
                defaultStatuses.forEach(status => {
                    const checkboxContainer = document.createElement('div');
                    checkboxContainer.className = 'status-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `status_${filterId}_${status}`;
                    checkbox.value = status;
                    checkbox.addEventListener('change', () => {
                        updateStatusFilter(filterId);
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = checkbox.id;
                    label.textContent = status;
                    
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(label);
                    container.appendChild(checkboxContainer);
                });
            }
        })
        .catch(error => {
            console.error('Erro ao carregar status:', error);
        });
}

// Função para carregar opções de clientes
function loadClienteOptions(container, filterId) {
    const searchInput = container.querySelector('.cliente-search-input');
    const dropdown = container.querySelector('.cliente-dropdown');
    const selectedContainer = container.querySelector('.selected-clientes-list');
    
    let allClientes = [];
    // Usar variável global para filtro exposto, local para outros
    let selectedClientes = filterId === 'exposed_cliente' ? exposedSelectedClientes : [];
    
    // Carregar clientes da API
    fetch('/api/clientes-filtro')
        .then(response => response.json())
        .then(data => {
            console.log('=== DEBUG LOAD CLIENTE OPTIONS ===');
            console.log('Response data:', data);
            console.log('Total clientes recebidos da API:', data.clientes ? data.clientes.length : 0);
            
            if (data && data.success && Array.isArray(data.clientes)) {
                allClientes = data.clientes;
                
                console.log('Primeiros 3 clientes recebidos:', allClientes.slice(0, 3));
                console.log('Total clientes em allClientes:', allClientes.length);
                
                renderClienteDropdown(allClientes);
            } else {
                console.error('Erro ao buscar clientes:', data);
            }
        })
        .catch(error => {
            console.error('Erro ao carregar clientes:', error);
        });
    
    // Função para renderizar dropdown de clientes
    function renderClienteDropdown(clientes) {
        console.log('=== DEBUG RENDER CLIENTE DROPDOWN ===');
        console.log('Clientes para renderizar:', clientes.length);
        console.log('Primeiros 3 clientes para renderizar:', clientes.slice(0, 3));
        
        dropdown.innerHTML = '';
        
        clientes.forEach(cliente => {
            const option = document.createElement('div');
            option.className = 'cliente-option';
            option.textContent = cliente.nome;
            option.dataset.clienteId = cliente.id;
            
            // Verificar se está selecionado e adicionar classe
            const isSelected = selectedClientes.some(c => c.id === cliente.id);
            if (isSelected) {
                option.classList.add('selected');
            }
            
            option.addEventListener('click', () => {
                selectCliente(cliente);
            });
            
            dropdown.appendChild(option);
        });
        
        console.log('Total de opções renderizadas no dropdown:', dropdown.children.length);
    }
    
    // Função para destacar opções selecionadas
    function highlightSelectedOptions() {
        const options = dropdown.querySelectorAll('.cliente-option');
        options.forEach(option => {
            const clienteId = option.dataset.clienteId;
            const isSelected = selectedClientes.some(c => c.id == clienteId);
            
            if (isSelected) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
    
    // Função para selecionar cliente
    function selectCliente(cliente) {
        console.log('=== SELECIONANDO CLIENTE ===');
        console.log('Cliente recebido:', cliente);
        console.log('Cliente ID:', cliente.id, '(tipo:', typeof cliente.id, ')');
        console.log('selectedClientes antes:', selectedClientes);
        
        // Verificar se já está selecionado
        if (selectedClientes.find(c => c.id === cliente.id)) {
            console.log('Cliente já estava selecionado, ignorando');
            return;
        }
        
        selectedClientes.push(cliente);
        
        // Atualizar variável global se for filtro exposto
        if (filterId === 'exposed_cliente') {
            exposedSelectedClientes = [...selectedClientes];
        }
        
        console.log('selectedClientes depois:', selectedClientes);
        renderSelectedClientes();
        updateClienteFilter(filterId);
        
        // Destacar opção selecionada no dropdown
        highlightSelectedOptions();
        
        // Limpar input de busca
        searchInput.value = '';
        dropdown.style.display = 'none';
    }
    
    // Função para remover cliente selecionado
    function removeCliente(clienteId) {
        selectedClientes = selectedClientes.filter(c => c.id !== clienteId);
        
        // Atualizar variável global se for filtro exposto
        if (filterId === 'exposed_cliente') {
            exposedSelectedClientes = [...selectedClientes];
        }
        
        renderSelectedClientes();
        updateClienteFilter(filterId);
        
        // Atualizar destaque das opções
        highlightSelectedOptions();
    }
    
    // Função para renderizar clientes selecionados
    function renderSelectedClientes() {
    if (!selectedContainer) {
        console.error('Elemento selected-clientes-list não encontrado');
        return;
    }
    selectedContainer.innerHTML = '';
        
        selectedClientes.forEach(cliente => {
            const tag = document.createElement('div');
            tag.className = 'selected-cliente-tag';
            tag.innerHTML = `
                <span>${cliente.nome}</span>
                <button type="button" class="remove-cliente" data-cliente-id="${cliente.id}">&times;</button>
            `;
            
            const removeBtn = tag.querySelector('.remove-cliente');
            removeBtn.addEventListener('click', () => {
                removeCliente(cliente.id);
            });
            
            selectedContainer.appendChild(tag);
        });
    }
    
    // Função para atualizar filtro de cliente
    function updateClienteFilter(filterId) {
        let filterData = activeFilters.find(f => f.id === filterId);
        if (!filterData) {
            filterData = { id: filterId, type: 'cliente', clientes: [] };
            activeFilters.push(filterData);
        }
        
        filterData.clientes = selectedClientes.map(c => c.id);
        
        // Remover filtro se nenhum cliente selecionado
        if (selectedClientes.length === 0) {
            activeFilters = activeFilters.filter(f => f.id !== filterId);
        }
        
        // Atualizar visibilidade dos botões
        updateFilterButtons();
    }
    
    // Event listeners para busca
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        const filteredClientes = allClientes.filter(cliente => 
            cliente.nome.toLowerCase().includes(searchTerm)
        );
        
        renderClienteDropdown(filteredClientes);
        dropdown.style.display = 'block';
    });
    
    // Esconder dropdown quando clicar fora
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Mostrar dropdown quando focar no input
    searchInput.addEventListener('focus', () => {
        if (allClientes.length > 0) {
            renderClienteDropdown(allClientes);
            dropdown.style.display = 'block';
        }
    });
}

// Função para atualizar filtro de status
function updateStatusFilter(filterId) {
    const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
    
    const checkboxes = filterRow.querySelectorAll('input[type="checkbox"]:checked');
    
    const selectedStatuses = Array.from(checkboxes).map(cb => cb.value);
    
    // Atualizar ou criar filtro
    let filterData = activeFilters.find(f => f.id === filterId);
    if (!filterData) {
        filterData = { id: filterId, type: 'status', statuses: [] };
        activeFilters.push(filterData);
    }
    
    filterData.statuses = selectedStatuses;
    
    // Remover filtro se nenhum status selecionado
    if (selectedStatuses.length === 0) {
        activeFilters = activeFilters.filter(f => f.id !== filterId);
    }
    
    // Atualizar visibilidade dos botões
    updateFilterButtons();
}

// Buscar status disponíveis da tabela tarefa
async function loadAvailableStatuses() {
    try {
        console.log('Carregando status disponíveis da tabela tarefa...');
        const response = await fetch('/api/tarefas-status');
        const data = await response.json();
        
        if (data && data.success && Array.isArray(data.statuses)) {
            availableStatuses = data.statuses;
            console.log('Status carregados:', availableStatuses);
            renderStatusCheckboxes();
        } else {
            console.error('Erro ao buscar status:', data);
            // Fallback com status padrão caso não consiga buscar da API
            availableStatuses = ['a fazer', 'em andamento', 'concluído'];
            renderStatusCheckboxes();
        }
    } catch (error) {
        console.error('Erro ao buscar status disponíveis:', error);
        // Fallback com status padrão caso não consiga buscar da API
        availableStatuses = ['a fazer', 'em andamento', 'concluído'];
        renderStatusCheckboxes();
    }
}

// Renderizar checkboxes de status
function renderStatusCheckboxes() {
    const statusCheckboxes = document.getElementById('statusCheckboxes');
    
    if (!statusCheckboxes) {
        console.error('Elemento statusCheckboxes não encontrado');
        return;
    }
    
    const checkboxesHTML = availableStatuses.map(status => `
        <div class="status-checkbox-item">
            <input type="checkbox" id="status-${status}" value="${status}" 
                   ${activeFilters.status && activeFilters.status.includes(status) ? 'checked' : ''}>
            <label for="status-${status}">${status}</label>
        </div>
    `).join('');
    
    statusCheckboxes.innerHTML = checkboxesHTML;
}

// Funções para coletar dados dos filtros expostos
function collectStatusFilterData() {
    // Usar a nova função global para obter status selecionados
    if (typeof window.getSelectedStatuses === 'function') {
        return window.getSelectedStatuses();
    }
    
    // Fallback para compatibilidade (caso a função não esteja disponível)
    const selectedStatuses = [];
    const statusCheckboxes = document.querySelectorAll('#statusCheckboxes input[type="checkbox"]:checked');
    
    statusCheckboxes.forEach(checkbox => {
        selectedStatuses.push(checkbox.value);
    });
    
    return selectedStatuses;
}

function collectPeriodoFilterData() {

    // Ler do calendário moderno (window.*) com fallback para variáveis globais
    const startDate = (typeof window !== 'undefined' && typeof window.selectedStartDate !== 'undefined')
        ? window.selectedStartDate
        : selectedStartDate;
    const endDate = (typeof window !== 'undefined' && typeof window.selectedEndDate !== 'undefined')
        ? window.selectedEndDate
        : selectedEndDate;


    return { startDate, endDate };
}

function collectClienteFilterData() {
    // Usar a nova função global para obter clientes selecionados
    if (typeof window.getSelectedClientes === 'function') {
        const selectedClientes = window.getSelectedClientes();
        const clienteIds = selectedClientes.map(cliente => cliente.id);

        return clienteIds;
    }
    
    // Fallback para compatibilidade (caso a função não esteja disponível)
    const selectedClientes = [];
    const selectedClientesList = document.querySelector('.cliente-filter-container .selected-clientes-list');
    
    console.log('🔍 Elemento selectedClientesList encontrado:', !!selectedClientesList);
    
    if (selectedClientesList) {
        const selectedItems = selectedClientesList.querySelectorAll('.selected-cliente-tag');
        console.log('🔍 Items selecionados encontrados:', selectedItems.length);
        
        selectedItems.forEach(item => {
            const removeBtn = item.querySelector('.remove-cliente');
            if (removeBtn) {
                const clienteId = removeBtn.getAttribute('data-cliente-id');
                if (clienteId) {
                    selectedClientes.push(clienteId);
                    console.log('🔍 Cliente ID coletado:', clienteId);
                }
            }
        });
    } else {
        console.warn('🔍 Elemento .selected-clientes-list não encontrado no filtro exposto');
    }
    
    
    return selectedClientes;
}

function collectColaboradorFilterData() {
    // Usar a função getSelectedColaboradores para obter colaboradores selecionados
    const selectedColaboradores = getSelectedColaboradores();

    return selectedColaboradores;
}

// Função para aplicar todos os filtros (adaptada para filtros expostos)
function applyAllFilters() {
    console.log('🔍 Aplicando filtros...');
    
    // Limpar cache de tarefas quando filtros são aplicados
    clienteTarefasCarregadas.clear();
    
    // Coletar dados dos filtros expostos
    const statusData = collectStatusFilterData();
    const periodoData = collectPeriodoFilterData();
    const clienteData = collectClienteFilterData();
    const colaboradorData = collectColaboradorFilterData();
    
    console.log('📊 Dados coletados:', {
        status: statusData,
        periodo: periodoData,
        clientes: clienteData,
        colaboradores: colaboradorData
    });

    // Regra: se houver colaboradores OU clientes selecionados, período (início e fim) é obrigatório
    const hasColabs = Array.isArray(colaboradorData) && colaboradorData.length > 0;
    const hasClientes = Array.isArray(clienteData) && clienteData.length > 0;
    const hasValidPeriod = !!(periodoData && periodoData.startDate && periodoData.endDate);
    if ((hasColabs || hasClientes) && !hasValidPeriod) {
        // Notificação no topo e foco no seletor de período
        showTopNotification('Por favor, selecione um período para aplicar os filtros.', 'error');
        try {
            const periodoSelectText = document.getElementById('periodoSelectText') || document.getElementById('periodoText');
            if (periodoSelectText) periodoSelectText.classList.add('validation-required');

            const periodoTrigger = document.getElementById('periodoTrigger');
            if (periodoTrigger) {
                periodoTrigger.classList.add('active');
                periodoTrigger.click();
            }
        } catch (_) {}
        return; // Não aplicar filtros sem período
    }
    
    // Atualizar variáveis globais de filtros para uso na paginação
    activeStatusFilters = statusData;
    activeClienteFilters = clienteData;
    activeColaboradorFilters = colaboradorData;
    activePeriodoFilter = (periodoData.startDate || periodoData.endDate) ? {
        startDate: periodoData.startDate ? formatDateForAPI(periodoData.startDate) : null,
        endDate: periodoData.endDate ? formatDateForAPI(periodoData.endDate) : null
    } : null;
    
    // Limpar filtros ativos anteriores (mantém para compatibilidade com código legado)
    activeFilters = [];

    // Atualizar activeFilters com os dados coletados (mantém para compatibilidade)
    if (statusData.length > 0) {
        const filtroStatus = {
            id: 'exposed_status',
            type: 'status',
            statuses: statusData
        };
        activeFilters.push(filtroStatus);
    }
    
    if (periodoData.startDate || periodoData.endDate) {
        const filtroPeriodo = {
            id: 'exposed_periodo',
            type: 'periodo',
            startDate: periodoData.startDate,
            endDate: periodoData.endDate
        };
        activeFilters.push(filtroPeriodo);
    }
    
    if (clienteData.length > 0) {
        const filtroCliente = {
            id: 'exposed_cliente',
            type: 'cliente',
            clientes: clienteData
        };
        activeFilters.push(filtroCliente);
    }
    
    // Adicionar filtro de colaboradores se houver dados
    if (colaboradorData.length > 0) {
        const filtroColaborador = {
            id: 'exposed_colaborador',
            type: 'colaborador',
            colaboradores: colaboradorData
        };
        activeFilters.push(filtroColaborador);
    }

    
    // ========================================
    // 🚀 CARREGAR CLIENTES COM PAGINAÇÃO + FILTROS
    // ========================================
    
    // Resetar para página 1 ao aplicar novos filtros
    currentPage = 1;
    
    console.log('✅ Filtros configurados! Carregando clientes...');
    
    // Marcar que filtros foram aplicados e carregar
    filtrosAplicados = true;
    loadClients();

    // Esconder qualquer UI de Global período; card principal cuidará do período
    try {
        const el = document.getElementById('periodoGlobalHoursText');
        if (el) el.style.display = 'none';
    } catch (_) {}

    // Garantir que fecha o card flutuante de período ao aplicar filtros
    if (typeof closePeriodoFloatingCard === 'function') {
        try { closePeriodoFloatingCard(); } catch (_) {}
    }
}

// Notificação simples no topo da tela
function showTopNotification(message, type = 'info') {
    try {
        const notification = document.createElement('div');
        notification.className = `top-notification top-notification-${type}`;
        notification.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#d93025' : '#2196F3'};
            color: #fff;
            padding: 10px 16px;
            border-radius: 6px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.14);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            min-width: 280px;
            max-width: 640px;
            text-align: center;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 200ms ease-in';
            setTimeout(() => {
                if (notification.parentNode) notification.parentNode.removeChild(notification);
            }, 220);
        }, 2800);
    } catch (e) {
        console.warn('Falha ao exibir notificação:', e);
    }
}

// Função para carregar clientes com destaque
function loadClientsWithHighlight(selectedClienteIds) {

    
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'flex';
        loadingMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Carregando clientes...
        `;
    }
    
    // Carregar todos os clientes e aplicar destaque
    loadClients().then(() => {
        highlightSelectedClients(selectedClienteIds);
        // Recarregar faturamento após carregar clientes
        const clientes = Array.from(document.querySelectorAll('.client-card')).map(card => ({
            id: card.getAttribute('data-client-id')
        }));
        if (clientes.length > 0) {
    
            loadFaturamentoAsync(clientes);

            loadProdutosAsync(clientes);
        }
    });
}

// Função para filtrar clientes com destaque
function filterClientsWithHighlight(queryParams, selectedClienteIds) {

    

    
    // IDs são UUIDs (strings), não precisam de conversão
    
    // Aplicar filtros normais primeiro
    filterClients(queryParams).then((clientsWithCounts) => {
        // Re-renderizar com reordenação e depois aplicar destaque
        renderClientCards(clientsWithCounts, selectedClienteIds);
        
        // Aplicar classes de destaque após renderização
        setTimeout(() => {
            const clientCards = document.querySelectorAll('.client-card');
            
            // OTIMIZAÇÃO: Todos os cards renderizados são destacados quando há filtros
            clientCards.forEach(card => {
                const clientIdAttr = card.getAttribute('data-client-id');
                
                if (selectedClienteIds.includes(clientIdAttr)) {
                    card.classList.add('client-highlighted');
                    card.classList.remove('client-dimmed');
                }
                // Cards não destacados não são mais renderizados, então não precisamos aplicar client-dimmed
            });
            
            // Atualizar contador de clientes e tarefas após aplicar destaque
            updateClientsCount();
            updateTasksCount();
            updateEstimatedHoursCount();
            updateRealizedHoursCount();
            
            // Recarregar faturamento após aplicar filtros com destaque
            const clientes = Array.from(document.querySelectorAll('.client-card')).map(card => ({
                id: card.getAttribute('data-client-id')
            }));
            if (clientes.length > 0) {
        
                loadFaturamentoAsync(clientes);

                loadProdutosAsync(clientes);
            }
        }, 100);
    });
}

// Função para destacar clientes selecionados
function highlightSelectedClients(selectedClienteIds) {

    
    // Re-renderizar cards com reordenação e destaque
    renderClientCards(allClients, selectedClienteIds);
    
    // Aplicar classes de destaque após renderização
    setTimeout(() => {
        const clientCards = document.querySelectorAll('.client-card');

        
        // OTIMIZAÇÃO: Todos os cards renderizados são destacados quando há filtros
        clientCards.forEach((card, index) => {
            const clientIdAttr = card.getAttribute('data-client-id');
            const isSelected = selectedClienteIds.includes(clientIdAttr);
            
            if (isSelected) {
                // Cliente selecionado - destacar
                card.classList.add('client-highlighted');
                card.classList.remove('client-dimmed');
            }
            // Cards não destacados não são mais renderizados, então não precisamos aplicar client-dimmed
        });
        
        // Atualizar contador de clientes e tarefas após aplicar destaque
        updateClientsCount();
        updateTasksCount();
        updateEstimatedHoursCount();
        updateRealizedHoursCount();
    }, 100);
}

// Função para carregar clientes com destaque por colaborador
async function loadClientsWithColaboradorHighlight(selectedColaboradorIds) {


    
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'flex';
        loadingMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Buscando clientes dos colaboradores...
        `;
    }
    
    try {
        // Buscar clientes que têm os colaboradores selecionados
        const response = await fetch(`/api/clientes-por-colaboradores?colaboradores=${selectedColaboradorIds.join(',')}`);
        const data = await response.json();
        
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        if (data.success && data.clientes) {
            const clienteIds = data.clientes.map(cliente => cliente.id);
            console.log('✅ Cliente IDs dos colaboradores:', clienteIds);
            
            // Carregar apenas esses clientes do backend para evitar paginação ocultar cards
            const respClientes = await fetch(`/api/clientes?clienteIds=${clienteIds.join(',')}`);
            const clientesData = await respClientes.json();
            const clientes = (clientesData && clientesData.data) ? clientesData.data : [];
            
            // Mapear para o formato dos cards
            const clientesFormatados = clientes.map(cliente => {
                const nomeExtraido = cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || 'Nome não informado';
                return {
                    id: cliente.id,
                    nome: nomeExtraido,
                    razao_social: cliente.razao_social,
                    nome_fantasia: cliente.nome_fantasia,
                    status: cliente.status || 'ativo',
                    created_at: cliente.created_at,
                    faturamento_registros: cliente.faturamento_registros || [],
                    faturamento_total_registros: cliente.faturamento_total_registros || 0,
                    tarefas_count: 'loading',
                    tarefas_loaded: false,
                    contratos_count: 'loading',
                    contratos_loaded: false,
                    horas_estimadas: 'loading',
                    horas_loaded: false
                };
            });
            
            // Atualizar lista global e renderizar somente os clientes destacados
            allClients = clientesFormatados;
            renderClientCards(clientesFormatados, clienteIds);
        } else {
            console.log('Nenhum cliente encontrado para os colaboradores selecionados');
            // Mostrar todos os clientes sem destaque
            renderClientCards(allClients);
        }
    } catch (error) {
        console.error('Erro ao buscar clientes por colaboradores:', error);
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        // Em caso de erro, mostrar todos os clientes
        renderClientCards(allClients);
    }
}

// Função para filtrar clientes com destaque por colaborador
async function filterClientsWithColaboradorHighlight(queryParams, selectedColaboradorIds) {



    
    try {
        // Primeiro buscar clientes que têm os colaboradores selecionados
        const response = await fetch(`/api/clientes-por-colaboradores?colaboradores=${selectedColaboradorIds.join(',')}`);
        const data = await response.json();
        
        if (data.success && data.clientes && data.clientes.length > 0) {
            const clienteIds = data.clientes.map(cliente => cliente.id);

            
            // Aplicar filtros normais e depois destacar os clientes dos colaboradores
            const clientsWithCounts = await filterClients(queryParams);
            
            // Aplicar destaque após renderização
            setTimeout(() => {
                const clientCards = document.querySelectorAll('.client-card');
                
                // OTIMIZAÇÃO: Todos os cards renderizados são destacados quando há filtros
                clientCards.forEach(card => {
                    const clientIdAttr = card.getAttribute('data-client-id');
                    
                    if (clienteIds.includes(clientIdAttr)) {
                        card.classList.add('client-highlighted');
                        card.classList.remove('client-dimmed');
                    }
                    // Cards não destacados não são mais renderizados
                });
            }, 100);
        } else {
            console.log('Nenhum cliente encontrado para os colaboradores selecionados');
            // Aplicar filtros normais sem destaque
            filterClients(queryParams);
        }
    } catch (error) {
        console.error('Erro ao filtrar clientes por colaboradores:', error);
        // Em caso de erro, aplicar filtros normais
        filterClients(queryParams);
    }
}

// Função para filtrar clientes com destaque combinado (cliente E colaborador)
async function filterClientsWithColaboradorAndClienteHighlight(queryParams, selectedClienteIds, selectedColaboradorIds) {




    
    try {
        // Buscar clientes que têm os colaboradores selecionados
        const response = await fetch(`/api/clientes-por-colaboradores?colaboradores=${selectedColaboradorIds.join(',')}`);
        const data = await response.json();
        
        if (data.success && data.clientes) {
            const clienteIds = data.clientes.map(cliente => cliente.id);
            // Encontrar interseção entre clientes selecionados e clientes dos colaboradores
            const intersectionIds = selectedClienteIds.filter(clienteId => 
                clienteIds.includes(clienteId)
            );
            
            console.log('Interseção de clientes:', intersectionIds);
            
            if (intersectionIds.length > 0) {
                // Aplicar filtros normais e depois destacar a interseção
                const clientsWithCounts = await filterClients(queryParams);
                
                setTimeout(() => {
                    const clientCards = document.querySelectorAll('.client-card');
                    
                    // OTIMIZAÇÃO: Todos os cards renderizados são destacados quando há filtros
                    clientCards.forEach(card => {
                        const clientIdAttr = card.getAttribute('data-client-id');
                        
                        if (intersectionIds.includes(clientIdAttr)) {
                            card.classList.add('client-highlighted');
                            card.classList.remove('client-dimmed');
                        }
                        // Cards não destacados não são mais renderizados
                    });
                }, 100);
            } else {
                console.log('Nenhuma interseção encontrada entre clientes e colaboradores');
                // Aplicar filtros normais sem destaque
                filterClients(queryParams);
            }
        } else {
            console.log('Nenhum cliente encontrado para os colaboradores selecionados');
            filterClients(queryParams);
        }
    } catch (error) {
        console.error('Erro ao filtrar clientes com destaque combinado:', error);
        filterClients(queryParams);
    }
}

// Função para filtrar clientes por status de contratos (CLIENT-SIDE) - REFATORADA
function filterClientsByContractStatus(queryParams) {
    // Extrair status selecionados dos parâmetros
    const statusParam = queryParams.get('status');
    if (!statusParam) {
        showAllClientCards();
        return Promise.resolve(allClients);
    }
    
    const selectedStatuses = statusParam.split(',').map(s => s.trim());
    
    // Limpar cache de tarefas quando filtros são aplicados
    clienteTarefasCarregadas.clear();
    
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'flex';
        loadingMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Filtrando clientes por status de contratos...
        `;
    }
    
    // Aplicar filtro client-side nos cards existentes
    return new Promise(async (resolve) => {
        try {
            const clientCards = document.querySelectorAll('.client-card');
            let visibleClients = [];
            
            // Criar array de promises para verificar todos os clientes
            const checkPromises = Array.from(clientCards).map(async (card) => {
                const clientId = card.getAttribute('data-client-id');
                const clientName = card.querySelector('.client-card-header h3')?.textContent || '';
                
                try {
                    // Verificar se o cliente tem contratos com status selecionado
                    const hasMatchingStatus = await checkClientContractStatusOptimized(clientId, clientName, selectedStatuses);
                    
                    if (hasMatchingStatus) {
                        card.style.display = 'block';
                        visibleClients.push({ id: clientId, nome: clientName });
                    } else {
                        card.style.display = 'none';
                    }
                } catch (error) {
                    console.error(`Erro ao verificar contratos do cliente ${clientId}:`, error);
                    // Em caso de erro, manter o card visível
                    card.style.display = 'block';
                    visibleClients.push({ id: clientId, nome: clientName });
                }
            });
            
            // Aguardar todas as verificações
            await Promise.all(checkPromises);
            
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            
            // 🔥 CORREÇÃO: Recarregar informações dos clientes visíveis após filtrar
            // Isso corrige o bug onde as informações ficavam zeradas após aplicar filtro de status
            setTimeout(() => {
                const visibleClientCards = document.querySelectorAll('.client-card[style*="display: block"], .client-card:not([style*="display: none"])');
                const clientesVisiveis = Array.from(visibleClientCards).map(card => ({
                    id: card.getAttribute('data-client-id')
                })).filter(cliente => cliente.id); // Filtrar IDs válidos
                
                if (clientesVisiveis.length > 0) {
                    
                    // Recarregar todas as informações dos clientes visíveis
                    loadEstimatedHoursAsync(clientesVisiveis);
                    loadRealizedHoursAsync(clientesVisiveis);
                    // Colaboradores desativados
// loadCollaboratorsAsync(clientesVisiveis);
                    loadCustosTotaisAsync(clientesVisiveis);
                    loadProdutosAsync(clientesVisiveis);
                    loadFaturamentoAsync(clientesVisiveis);
                    
                    // Iniciar monitoramento para atualizar contadores
                    startTaskLoadingMonitor(clientesVisiveis);
                }
            }, 500); // Aguardar um pouco para garantir que os cards estão renderizados
            
            resolve(visibleClients);
            
        } catch (error) {
            console.error('Erro ao aplicar filtro de contratos:', error);
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }
            resolve([]);
        }
    });
}

// Função otimizada para verificar se um cliente tem contratos com status específicos
async function checkClientContractStatusOptimized(clientId, clientName, selectedStatuses) {
    try {
        // PRIMEIRO: Tentar usar contratos já carregados no DOM
        const contractsFromDOM = getClientContractsFromDOM(clientId);
        
        if (contractsFromDOM !== null) {
            // Contratos já estão carregados no DOM, usar esses dados
            return contractsFromDOM.some(status => selectedStatuses.includes(status));
        }
        
        // SEGUNDO: Se não estão carregados, carregar silenciosamente
        const contractStatuses = await loadClientContractsSilently(clientId, clientName);
        
        if (contractStatuses.length === 0) {
            return false; // Cliente não tem contratos
        }
        
        // Verificar se algum contrato tem o status selecionado
        return contractStatuses.some(status => selectedStatuses.includes(status));
        
    } catch (error) {
        console.error(`Erro ao verificar contratos do cliente "${clientName}":`, error);
        return true; // Em caso de erro, manter visível
    }
}

// Função para mostrar todos os cards de clientes
function showAllClientCards() {
    const clientCards = document.querySelectorAll('.client-card');
    clientCards.forEach(card => {
        card.style.display = 'block';
    });
}

// Função para filtrar clientes
function filterClients(queryParams) {



    
    // Limpar cache de tarefas quando filtros são aplicados

    clienteTarefasCarregadas.clear();
    
    const clientsGrid = document.getElementById('clientsGrid');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'flex';
        loadingMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            Aplicando filtros...
        `;
    }
    
    return Promise.all(allClients.map(async (client) => {
        try {
            // Garantir que colaboradorIds e periodoLogica estejam presentes
            const params = new URLSearchParams(queryParams.toString());
            if (Array.isArray(activeColaboradorFilters) && activeColaboradorFilters.length > 0 && !params.has('colaboradorIds')) {
                params.append('colaboradorIds', activeColaboradorFilters.join(','));
            }
            // Se houver período mas não lógica, incluir a lógica atual (E/OU)
            const hasPeriodo = params.has('inicio') || params.has('fim') || params.has('startDate') || params.has('endDate') || (selectedStartDate && selectedEndDate);
            if (hasPeriodo && !params.has('periodoLogica')) {
                const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
                params.append('periodoLogica', logic);
            }
            const url = `/api/tarefas-count/${client.id}?${params.toString()}`;

            const response = await fetch(url);
             const data = await response.json();
             console.log(`Resposta para cliente ${client.id}:`, data);
             return {
                 ...client,
                 tarefas_count: data.count || 0,
                 tarefas_loaded: true, // Marcar como carregado para mostrar a setinha
                 primeira_tarefa_url: data.primeira_tarefa_url || client.primeira_tarefa_url // Preservar URL se disponível
             };
        } catch (error) {
            console.error(`Erro ao carregar tarefas para cliente ${client.id}:`, error);
            return {
                ...client,
                tarefas_count: 0,
                tarefas_loaded: true, // Marcar como carregado mesmo com erro
                primeira_tarefa_url: client.primeira_tarefa_url // Preservar URL original
            };
        }
    }))
    .then(clientsWithCounts => {
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        renderClientCards(clientsWithCounts);
        
        // Carregar dados assíncronos após renderização (necessário para mostrar setinhas)
        setTimeout(() => {
            const clientCards = document.querySelectorAll('.client-card');
            const clientes = Array.from(clientCards).map(card => ({
                id: card.getAttribute('data-client-id')
            }));
            
            if (clientes.length > 0) {
                // Não carregar loadTaskCountsAsync aqui para não sobrescrever valores filtrados
                loadEstimatedHoursAsync(clientes);
                loadRealizedHoursAsync(clientes);
                // Colaboradores desativados
// // Colaboradores desativados
// // Colaboradores desativados
// // Colaboradores desativados
// // Colaboradores desativados
// // Colaboradores desativados
// // Colaboradores desativados
// loadCollaboratorsAsync(clientes);
                loadCustosTotaisAsync(clientes);
                loadProdutosAsync(clientes); // Adicionar carregamento de produtos
                
                // Iniciar monitoramento para atualizar card de total de tarefas
                startTaskLoadingMonitor(clientes);
            }
            
            // Após renderizar, atualizar cada card individualmente para garantir que as setinhas apareçam
            clientsWithCounts.forEach(client => {
                updateClientCard(client.id, {
                    tarefas: client.tarefas_count,
                    tarefas_loaded: true,
                    primeira_tarefa_url: client.primeira_tarefa_url
                });
            });
        }, 500); // Aguardar renderização dos cards
        
        return clientsWithCounts; // Retornar para permitir chaining
    })
    .catch(error => {
        console.error('Erro ao filtrar clientes:', error);
        if (loadingMessage) {
            loadingMessage.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao aplicar filtros</p>
                </div>
            `;
        }
        throw error; // Re-throw para permitir tratamento upstream
    });
}

// Função para limpar todos os filtros (adaptada para filtros expostos)
function clearAllFilters() {
    console.log('🧹 === LIMPANDO TODOS OS FILTROS EXPOSTOS ===');
    
    // Limpar cache de tarefas quando filtros são limpos
    console.log('🗑️ Limpando cache de tarefas devido à limpeza de filtros');
    clienteTarefasCarregadas.clear();
    
    // Limpar filtros de status usando a nova função
    if (typeof window.clearStatusSelection === 'function') {
        window.clearStatusSelection();
    } else {
        // Fallback para compatibilidade
        const statusCheckboxes = document.querySelectorAll('#exposed-status-filter input[type="checkbox"]');
        statusCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    // Limpar filtros de período
    const startDateSpan = document.querySelector('#exposed-periodo-filter .start-date');
    const endDateSpan = document.querySelector('#exposed-periodo-filter .end-date');
    if (startDateSpan) startDateSpan.textContent = 'Data inicial';
    if (endDateSpan) endDateSpan.textContent = 'Data final';
    
    // Limpar filtros de cliente
    const clienteCheckboxes = document.querySelectorAll('#exposed-cliente-filter input[type="checkbox"]');
    clienteCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Limpar filtros de colaboradores
    if (typeof window.clearColaboradorSelection === 'function') {
        window.clearColaboradorSelection();
    } else {
        // Fallback para compatibilidade
        const colaboradorCheckboxes = document.querySelectorAll('#exposed-colaborador-filter input[type="checkbox"]');
        colaboradorCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Limpar array de colaboradores selecionados
        if (typeof exposedSelectedColaboradores !== 'undefined') {
            exposedSelectedColaboradores.length = 0;
        }
        
        // Atualizar display do filtro
        const colaboradorDisplay = document.querySelector('#exposed-colaborador-filter .filter-display');
        if (colaboradorDisplay) {
            colaboradorDisplay.textContent = 'Selecionar colaboradores';
        }
    }
    
    // Limpar destaques dos clientes
    clearClientHighlights();
    
    // Renderizar na ordem original (sem IDs destacados)
    renderClientCards(allClients);
    
    console.log('Todos os filtros expostos foram limpos e ordem original restaurada');
}

// Função para limpar destaques dos clientes
function clearClientHighlights() {
    const clientCards = document.querySelectorAll('.client-card');
    clientCards.forEach(card => {
        card.classList.remove('client-highlighted', 'client-dimmed');
    });
}

// Função para atualizar botões do modal
function updateFilterButtons() {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    // Verificar se há filtros ativos (incluindo os filtros expostos)
    const hasActiveFilters = activeFilters.length > 0;
    const hasExposedStatusFilter = (typeof window.getSelectedStatuses === 'function') ? window.getSelectedStatuses().length > 0 : false;
    const hasExposedClientFilter = (typeof window.getSelectedClientes === 'function') ? window.getSelectedClientes().length > 0 : false;
    const hasExposedColabFilter = (typeof window.getSelectedColaboradores === 'function') ? window.getSelectedColaboradores().length > 0 : false;
    const hasExposedPeriodFilter = !!(selectedStartDate || selectedEndDate);
    
    const hasFilters = hasActiveFilters || hasExposedStatusFilter || hasExposedClientFilter || hasExposedColabFilter || hasExposedPeriodFilter;
    
    console.log('updateFilterButtons chamada:', { 
        hasFilters, 
        hasActiveFilters, 
        hasExposedStatusFilter, 
        hasExposedClientFilter, 
        hasExposedPeriodFilter,
        selectedStartDate,
        selectedEndDate
    });
    
    if (applyFiltersBtn) {
        // Botão sempre visível e habilitado (sem bloqueio)
        applyFiltersBtn.style.display = 'inline-block';
        applyFiltersBtn.disabled = false;

    } else {
        console.error('Botão applyFiltersBtn não encontrado');
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.style.display = hasFilters ? 'inline-block' : 'none';

    } else {
        console.error('Botão clearFiltersBtn não encontrado');
    }
}

// Aplicar filtros (função legada mantida para compatibilidade)
function applyFilters() {
    // Limpar cache de tarefas quando filtros são aplicados

    clienteTarefasCarregadas.clear();
    
    const filterTypeSelect = document.getElementById('filterTypeSelect');
    const selectedType = filterTypeSelect ? filterTypeSelect.value : '';
    
    if (selectedType === 'status') {
        // Coletar status selecionados
        const selectedStatuses = [];
        const statusCheckboxes = document.querySelectorAll('#statusCheckboxes input[type="checkbox"]:checked');
        
        statusCheckboxes.forEach(checkbox => {
            selectedStatuses.push(checkbox.value);
        });
        
        // Se nenhum filtro selecionado, mostrar todos os clientes
        if (selectedStatuses.length === 0) {
            renderClientCards(allClients);
            return;
        }
        
        // Filtrar clientes baseado nos status selecionados
        filterClientsByStatus(selectedStatuses);
        
    } else if (selectedType === 'periodo') {
        // Verificar se as datas foram selecionadas
        if (!selectedStartDate || !selectedEndDate) {
            alert('Por favor, selecione as datas de início e vencimento.');
            return;
        }
        
        // Converter datas para timestamptz
        console.log('=== DEBUG CONVERSÃO DE DATAS FRONTEND ===');
        console.log('selectedStartDate:', selectedStartDate);
        console.log('selectedEndDate:', selectedEndDate);
        
        const dataInicialTimestamp = formatDateForTimestamptz(selectedStartDate);
        const dataFinalTimestamp = formatDateForTimestamptz(selectedEndDate);
        
        console.log('Data inicial convertida:', dataInicialTimestamp);
        console.log('Data final convertida:', dataFinalTimestamp);
        
        console.log('Filtro de período aplicado:', {
            dataInicial: dataInicialTimestamp,
            dataFinal: dataFinalTimestamp
        });
        
        // Filtrar clientes baseado no período selecionado
        filterClientsByPeriod(dataInicialTimestamp, dataFinalTimestamp);
    }
}

// Filtrar clientes por status das tarefas
async function filterClientsByStatus(selectedStatuses) {
    const loadingMessage = document.getElementById('loadingMessage');
    const clientsGrid = document.getElementById('clientsGrid');
    
    if (!clientsGrid) {
        console.error('Elemento clientsGrid não encontrado');
        return;
    }
    
    try {
        // Salvar estado das mini-cards abertas
        const openMiniCards = saveOpenMiniCardsState();
        
        // Mostrar loading
        if (loadingMessage) {
            loadingMessage.style.display = 'flex';
            loadingMessage.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Aplicando filtros...
            `;
        }
        
        // Buscar contagem de tarefas filtradas para cada cliente
        const filteredClients = await Promise.all(
            allClients.map(async (cliente) => {
                try {
                    const params = new URLSearchParams();
                    params.append('status', selectedStatuses.join(','));
                    if (Array.isArray(activeColaboradorFilters) && activeColaboradorFilters.length > 0) {
                        params.append('colaboradorIds', activeColaboradorFilters.join(','));
                    }
                    const start = (typeof window !== 'undefined' && window.selectedStartDate) ? window.selectedStartDate : selectedStartDate;
                    const end = (typeof window !== 'undefined' && window.selectedEndDate) ? window.selectedEndDate : selectedEndDate;
                    if (start && end) {
                        params.append('inicio', formatDateForAPI(start));
                        params.append('fim', formatDateForAPI(end));
                        const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
                        params.append('periodoLogica', logic);
                    }
                    const response = await fetch(`/api/tarefas-count/${cliente.id}?${params.toString()}`);
                    const data = await response.json();
                    
                    if (data && data.success) {
                        return {
                            ...cliente,
                            tarefas_count: data.count
                        };
                    } else {
                        return {
                            ...cliente,
                            tarefas_count: 0
                        };
                    }
                } catch (error) {
                    console.error(`Erro ao filtrar tarefas para cliente ${cliente.nome}:`, error);
                    return {
                        ...cliente,
                        tarefas_count: 0
                    };
                }
            })
        );
        
        // Esconder loading
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        // Renderizar cards filtrados
        renderClientCards(filteredClients);
        
        // Carregar dados assíncronos após renderização (necessário para mostrar setinhas)
        setTimeout(() => {
            // OTIMIZAÇÃO: Carregar dados apenas dos cards destacados (visíveis)
            const highlightedCards = document.querySelectorAll('.client-card.client-highlighted');
            const visibleCards = highlightedCards.length > 0 ? highlightedCards : document.querySelectorAll('.client-card');
            
            const clientes = Array.from(visibleCards).map(card => ({
                id: card.getAttribute('data-client-id')
            }));
            

            
            if (clientes.length > 0) {
                // Não carregar loadTaskCountsAsync aqui para não sobrescrever valores filtrados
                loadEstimatedHoursAsync(clientes);
                loadRealizedHoursAsync(clientes);
                // Reativar colaboradores com lógica simples de contagem
                loadCollaboratorsAsync(clientes);
                loadCustosTotaisAsync(clientes);
                loadProdutosAsync(clientes); // Adicionar carregamento de produtos
                
                // Iniciar monitoramento para atualizar card de total de tarefas
                startTaskLoadingMonitor(clientes);
            }
            
            // Atualizar cada card individualmente para garantir que as setinhas apareçam
            filteredClients.forEach(client => {
                updateClientCard(client.id, {
                    tarefas: client.tarefas_count,
                    tarefas_loaded: true
                });
            });
            
            // Restaurar estado das mini-cards após carregar dados
            restoreOpenMiniCardsState(openMiniCards);
        }, 500); // Aguardar renderização dos cards
        
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        if (loadingMessage) {
            loadingMessage.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao aplicar filtros</p>
                </div>
            `;
        }
    }
}

// Filtrar clientes por período das tarefas
async function filterClientsByPeriod(dataInicial, dataFinal) {
    const loadingMessage = document.getElementById('loadingMessage');
    const clientsGrid = document.getElementById('clientsGrid');
    
    if (!clientsGrid) {
        console.error('Elemento clientsGrid não encontrado');
        return;
    }
    
    try {
        // Salvar estado das mini-cards abertas
        const openMiniCards = saveOpenMiniCardsState();
        
        // Mostrar loading
        if (loadingMessage) {
            loadingMessage.style.display = 'flex';
            loadingMessage.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Aplicando filtro de período...
            `;
        }
        
        const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
        
        // Buscar contagem de tarefas filtradas por período para cada cliente
        const filteredClients = await Promise.all(
            allClients.map(async (cliente) => {
                try {
                    // Incluir colaboradores filtrados na contagem, se houver
                    const selectedColaboradores = (typeof getSelectedColaboradores === 'function') ? getSelectedColaboradores() : [];
                    const colaboradores = (selectedColaboradores && selectedColaboradores.length > 0)
                        ? selectedColaboradores
                        : (Array.isArray(activeColaboradorFilters) && activeColaboradorFilters.length > 0 ? activeColaboradorFilters : []);
                    const colabParam = (colaboradores && colaboradores.length > 0) 
                        ? `&colaboradorIds=${encodeURIComponent(colaboradores.join(','))}` 
                        : '';

                    const response = await fetch(`/api/tarefas-count/${cliente.id}?dataInicial=${encodeURIComponent(dataInicial)}&dataFinal=${encodeURIComponent(dataFinal)}&periodoLogica=${encodeURIComponent(logic)}${colabParam}`);
                    const data = await response.json();
                    
                    if (data && data.success) {
                        return {
                            ...cliente,
                            tarefas_count: data.count
                        };
                    } else {
                        return {
                            ...cliente,
                            tarefas_count: 0
                        };
                    }
                } catch (error) {
                    console.error(`Erro ao filtrar tarefas por período para cliente ${cliente.nome}:`, error);
                    return {
                        ...cliente,
                        tarefas_count: 0
                    };
                }
            })
        );
        
        // Esconder loading
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
        // Renderizar cards filtrados
        renderClientCards(filteredClients);
        
        // Carregar dados assíncronos após renderização (necessário para mostrar setinhas)
        setTimeout(() => {
            // OTIMIZAÇÃO: Carregar dados apenas dos cards destacados (visíveis)
            const highlightedCards = document.querySelectorAll('.client-card.client-highlighted');
            const visibleCards = highlightedCards.length > 0 ? highlightedCards : document.querySelectorAll('.client-card');
            
            const clientes = Array.from(visibleCards).map(card => ({
                id: card.getAttribute('data-client-id')
            }));
            

            
            if (clientes.length > 0) {
                // Não carregar loadTaskCountsAsync aqui para não sobrescrever valores filtrados
                loadEstimatedHoursAsync(clientes);
                loadRealizedHoursAsync(clientes);
                // Colaboradores desativados
                // loadCollaboratorsAsync(clientes);
                loadCustosTotaisAsync(clientes);
                loadProdutosAsync(clientes); // Adicionar carregamento de produtos
                
                // Iniciar monitoramento para atualizar card de total de tarefas
                startTaskLoadingMonitor(clientes);
            }
            
            // Atualizar cada card individualmente para garantir que as setinhas apareçam
            filteredClients.forEach(client => {
                updateClientCard(client.id, {
                    tarefas: client.tarefas_count,
                    tarefas_loaded: true
                });
            });
            
            // Restaurar estado das mini-cards após carregar dados
            restoreOpenMiniCardsState(openMiniCards);
        }, 500); // Aguardar renderização dos cards
        
    } catch (error) {
        console.error('Erro ao aplicar filtro de período:', error);
        if (loadingMessage) {
            loadingMessage.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao aplicar filtro de período</p>
                </div>
            `;
        }
    }
}

// Função para atualizar visibilidade dos botões de filtro (filtros expostos)
function updateFilterButtonsVisibility() {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    // Verificar se há filtros ativos nos filtros expostos
    const hasStatusFilter = (typeof window.getSelectedStatuses === 'function') ? 
        window.getSelectedStatuses().length > 0 : false;
    
    // Corrigir detecção do filtro de cliente usando a função global
    const hasClienteFilter = (typeof window.getSelectedClientes === 'function') ? 
        window.getSelectedClientes().length > 0 : false;
    
    // Incluir colaboradores
    const hasColabFilter = (typeof window.getSelectedColaboradores === 'function') ?
        window.getSelectedColaboradores().length > 0 : false;
    
    // Verificar filtro de período usando window.* com fallback
    const periodoStart = (typeof window !== 'undefined' && typeof window.selectedStartDate !== 'undefined')
        ? window.selectedStartDate
        : selectedStartDate;
    const periodoEnd = (typeof window !== 'undefined' && typeof window.selectedEndDate !== 'undefined')
        ? window.selectedEndDate
        : selectedEndDate;
    const hasPeriodoFilter = periodoStart != null || periodoEnd != null;
    
    const hasFilters = hasStatusFilter || hasClienteFilter || hasColabFilter || hasPeriodoFilter;
    

    
    if (applyFiltersBtn) {
        // Botão sempre visível e habilitado (sem bloqueio)
        applyFiltersBtn.style.display = 'inline-block';
        applyFiltersBtn.disabled = false;
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.style.display = hasFilters ? 'inline-block' : 'none';
    }
}

// Event listener DOMContentLoaded removido para evitar duplicação
// A inicialização já é feita no início do arquivo

// Função para mostrar/ocultar detalhes dos colaboradores
// Versão simples: abre mini-card com agregação local do cache de tarefas
function toggleColaboradoresDetailsSimples(clienteId) {
    const existingMiniCard = document.querySelector('.colaboradores-mini-card');
    if (existingMiniCard) {
        existingMiniCard.remove();
        return;
    }
    // Buscar tarefas do cliente no cache
    const tarefas = clienteTarefasCarregadas.get(clienteId) || [];
    showColaboradoresSimplesMiniCard(clienteId, tarefas);
}

async function showColaboradoresSimplesMiniCard(clienteId, tarefas) {
    // Verificar existência do card
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) return;

    // Encontrar a arrow de colaboradores
    const colabsArrow = clientCard.querySelector('.colaboradores-arrow');
    if (!colabsArrow) return;

    // Cache global de colaboradores e custo-hora
    window.colaboradoresCache = window.colaboradoresCache || null;
    window.colaboradoresCachePromise = window.colaboradoresCachePromise || null;
    window.custoHoraCache = window.custoHoraCache || {};

    const ensureColaboradoresCache = () => {
        if (!window.colaboradoresCachePromise) {
            window.colaboradoresCachePromise = fetch('/api/colaboradores', { credentials: 'include' })
                .then(r => r.ok ? r.json() : { colaboradores: [] })
                .then(j => {
                    const lista = Array.isArray(j.colaboradores) ? j.colaboradores : [];
                    window.colaboradoresCache = lista;
                    return lista;
                })
                .catch(() => {
                    window.colaboradoresCache = [];
                    return [];
                });
        }
        return window.colaboradoresCachePromise;
    };

    const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const findMemberIdByName = (nome) => {
        const alvo = normalize(nome || '');
        if (!alvo) return null;
        const lista = window.colaboradoresCache || [];
        let match = lista.find(c => normalize(c.nome) === alvo);
        if (!match) {
            match = lista.find(c => {
                const cn = normalize(c.nome);
                return cn.includes(alvo) || alvo.includes(cn);
            });
        }
        return match && match.id ? match.id : null;
    };

    const getCustoHora = async (membroId) => {
        if (!membroId) return 0;
        if (window.custoHoraCache[membroId] != null) return window.custoHoraCache[membroId];
        try {
            const resp = await fetch(`/api/custo-hora-membro/${membroId}`, { credentials: 'include' });
            if (resp.ok) {
                const j = await resp.json();
                const cph = parseFloat(j?.custo_por_hora) || 0;
                window.custoHoraCache[membroId] = cph;
                return cph;
            }
        } catch (_) {}
        window.custoHoraCache[membroId] = 0;
        return 0;
    };

    // Agregar horas por colaborador a partir das tarefas, sem bloquear renderização
    const msPorUsuario = new Map();
    const nomePorUsuario = new Map();
    const fetchPromises = [];

    const toMs = (val) => {
        let n = typeof val === 'string' ? parseFloat(val) : Number(val);
        if (!Number.isFinite(n) || n <= 0) return 0;
        if (n < 1000) return Math.round(n * 3600000); // horas decimais → ms
        return Math.round(n); // já em ms
    };

    tarefas.forEach(t => {
        const usuarios = Array.isArray(t.colaboradores) ? t.colaboradores : [];
        usuarios.forEach(u => {
            const uid = parseInt(u.usuario_id, 10);
            if (!isNaN(uid) && u.nome) nomePorUsuario.set(uid, u.nome);
        });
        const registrosLocais = (t.registros && Array.isArray(t.registros)) ? t.registros : null;
        if (registrosLocais) {
            registrosLocais.forEach(r => {
                const uid = parseInt(r.usuario_id, 10);
                if (!isNaN(uid)) {
                    const ms = toMs(r.tempo_realizado);
                    msPorUsuario.set(uid, (msPorUsuario.get(uid) || 0) + ms);
                }
            });
        } else if (t.id != null) {
            // Lazy loading: buscar registros em background
            fetchPromises.push(
                fetch(`/api/tarefa-registros-tempo/${t.id}`)
                    .then(resp => resp.json())
                    .then(data => {
                        const regs = (data && data.success) ? (data.registros || []) : [];
                        regs.forEach(r => {
                            const uid = parseInt(r.usuario_id, 10);
                            if (!isNaN(uid)) {
                                const ms = toMs(r.tempo_realizado);
                                msPorUsuario.set(uid, (msPorUsuario.get(uid) || 0) + ms);
                            }
                        });
                    })
                    .catch(() => {})
            );
        }
    });

    // Renderizar imediatamente com dados parciais (sem await)
    const usuariosParciais = Array.from(nomePorUsuario.keys()).map(uid => {
        const nome = nomePorUsuario.get(uid) || `Usuário ${uid}`;
        const horas = parseFloat(((msPorUsuario.get(uid) || 0) / 3600000).toFixed(2));
        return { usuario_id: uid, nome, horas };
    }).sort((a, b) => b.horas - a.horas);

    const miniCard = document.createElement('div');
    miniCard.className = 'colaboradores-mini-card';
    miniCard.innerHTML = `
        <button class="mini-card-close" onclick="closeColaboradoresMiniCard()">
            <i class="fas fa-times"></i>
        </button>
        <div class="mini-card-content">
            ${usuariosParciais.length > 0 ? usuariosParciais.map(u => `
                <div class="colaborador-item" data-colaborador-id="${u.usuario_id}">
                    <i class="fas fa-user"></i>
                    <div class="colaborador-info">
                        <div class="colaborador-header">
                            <span class="colaborador-nome">${u.nome}</span>
                            <span class="colaborador-tarefas-arrow" onclick="toggleColaboradorTarefas('${clienteId}', '${u.usuario_id}', this)" title="Ver tarefas do colaborador">
                                <i class="fas fa-chevron-right"></i>
                            </span>
                        </div>
                        <div class="colaborador-realizadas-card">
                            <div class="realizadas-top">
                                Realizadas: <span class="colaborador-horas" data-uid="${u.usuario_id}">${u.horas.toFixed(2)}h</span>
                            </div>
                            <small class="colaborador-custo-realizado" data-uid="${u.usuario_id}">Realizado: Carregando...</small>
                        </div>
                    </div>
                </div>
            `).join('') : '<div class="no-colaboradores">Nenhum colaborador com tempo registrado</div>'}
        </div>
    `;
    document.body.appendChild(miniCard);

    // Posicionar próximo da arrow
    const rect = colabsArrow.getBoundingClientRect();
    const mrect = miniCard.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    let left = rect.left + scrollLeft + rect.width + 10;
    let top = rect.top + scrollTop;
    const vw = window.innerWidth; const vh = window.innerHeight;
    if ((left - scrollLeft) + mrect.width > vw) left = rect.left + scrollLeft - mrect.width - 10;
    if ((left - scrollLeft) < 10) left = scrollLeft + 10;
    if ((top - scrollTop) + mrect.height > vh) top = scrollTop + vh - mrect.height - 10;
    if ((top - scrollTop) < 10) top = scrollTop + 10;
    miniCard.style.position = 'absolute';
    miniCard.style.left = `${left}px`;
    miniCard.style.top = `${top}px`;
    miniCard.style.zIndex = '1000';
    setTimeout(() => miniCard.classList.add('show'), 10);

    // Handler para preencher custos e horas quando dados chegarem
    const custoBRL = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    const updateHorasECustos = async () => {
        // Recalcular horas
        const horasSpans = miniCard.querySelectorAll('.colaborador-horas');
        horasSpans.forEach(span => {
            const uid = parseInt(span.getAttribute('data-uid'), 10);
            const horas = parseFloat(((msPorUsuario.get(uid) || 0) / 3600000).toFixed(2));
            span.textContent = `${horas.toFixed(2)}h`;
        });
        // Garantir cache de colaboradores
        await ensureColaboradoresCache();
        // Preencher custos
        const custoSpans = miniCard.querySelectorAll('.colaborador-custo-realizado');
        await Promise.all(Array.from(custoSpans).map(async span => {
            const uid = parseInt(span.getAttribute('data-uid'), 10);
            const nome = nomePorUsuario.get(uid) || `Usuário ${uid}`;
            const horas = parseFloat(((msPorUsuario.get(uid) || 0) / 3600000).toFixed(2));
            const membroId = findMemberIdByName(nome);
            if (!membroId) {
                span.textContent = 'Realizado: —';
                return;
            }
            const cph = await getCustoHora(membroId);
            if (cph > 0 && horas > 0) {
                span.textContent = `Realizado: ${custoBRL(cph * horas)}`;
            } else {
                span.textContent = 'Realizado: —';
            }
        }));
    };

    // Disparar atualizações em background, sem bloquear abertura
    Promise.all(fetchPromises)
        .then(updateHorasECustos)
        .catch(() => updateHorasECustos());
    ensureColaboradoresCache().then(() => updateHorasECustos());

    // Fechar ao clicar fora
    setTimeout(() => {
        if (window.colaboradoresOutsideClickHandler) {
            document.removeEventListener('click', window.colaboradoresOutsideClickHandler);
        }
        window.colaboradoresOutsideClickHandler = function(event) {
            if (!miniCard.contains(event.target) && !event.target.closest('.colaboradores-arrow')) {
                closeColaboradoresMiniCard();
                document.removeEventListener('click', window.colaboradoresOutsideClickHandler);
                window.colaboradoresOutsideClickHandler = null;
            }
        };
        document.addEventListener('click', window.colaboradoresOutsideClickHandler);
    }, 100);
}

function closeColaboradoresMiniCard() {
    const miniCard = document.querySelector('.colaboradores-mini-card');
    if (miniCard) miniCard.remove();
}

// Função para exibir o mini card com os detalhes dos produtos
window.showProdutosMiniCard = function(clienteId, produtos) {

    
    // Verificar se o card do cliente existe no DOM (pode ter sido filtrado)
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) {

        return;
    }
    
    // Verificar se o card ainda existe no DOM antes de procurar elementos filhos
    if (!document.body.contains(clientCard)) {
        return; // Card foi removido/filtrado, não processar
    }
    
    // Encontrar especificamente o ícone de produtos que foi clicado
    const produtosArrow = clientCard.querySelector('.produtos-arrow');
    if (!produtosArrow) {
        // Não loggar erro - pode ter sido filtrado
        return;
    }
    
    // Criar o mini card
    const miniCard = document.createElement('div');
    miniCard.className = 'produtos-mini-card';
    miniCard.innerHTML = `
        <button class="mini-card-close" onclick="closeProdutosMiniCard()">
            <i class="fas fa-times"></i>
        </button>
        <div class="mini-card-content">
            ${produtos.length > 0 ? 
                produtos.map(produto => `
                    <div class="produto-item">
                        <i class="fas fa-box"></i>
                        <div class="produto-info">
                            <span class="produto-nome">${produto}</span>
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-produtos">Nenhum produto encontrado</div>'
            }
         </div>
     `;
     
     // Adicionar ao body primeiro para calcular dimensões
     document.body.appendChild(miniCard);
     
     // Calcular posição ABSOLUTA baseada na posição do documento (não viewport)
     const arrowRect = produtosArrow.getBoundingClientRect();
     const miniCardRect = miniCard.getBoundingClientRect();
     const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
     const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
     
     // Calcular posição absoluta no documento (viewport + scroll)
     const documentLeft = arrowRect.left + scrollLeft;
     const documentTop = arrowRect.top + scrollTop;
     
     // Posicionar ao lado direito do ícone de produtos
     let left = documentLeft + arrowRect.width + 10;
     let top = documentTop;
     
     // Verificar limites da viewport para ajustar se necessário
     const viewportWidth = window.innerWidth;
     const viewportHeight = window.innerHeight;
     
     // Se sair da tela pela direita, posicionar à esquerda
     if ((left - scrollLeft) + miniCardRect.width > viewportWidth) {
         left = documentLeft - miniCardRect.width - 10;
     }
     
     // Se ainda sair pela esquerda, ajustar
     if ((left - scrollLeft) < 10) {
         left = scrollLeft + 10;
     }
     
     // Se sair por baixo, ajustar
     if ((top - scrollTop) + miniCardRect.height > viewportHeight) {
         top = scrollTop + viewportHeight - miniCardRect.height - 10;
     }
     
     // Se sair por cima, ajustar
     if ((top - scrollTop) < 10) {
         top = scrollTop + 10;
     }
     
     // Aplicar posicionamento ABSOLUTO com coordenadas do documento
     miniCard.style.position = 'absolute';
     miniCard.style.left = `${left}px`;
     miniCard.style.top = `${top}px`;
     miniCard.style.zIndex = '1000';
     
     // Adicionar animação de entrada
     setTimeout(() => {
         miniCard.classList.add('show');
     }, 10);
     
     // Fechar ao clicar fora
     setTimeout(() => {
         // Remover listener anterior se existir
         if (window.produtosOutsideClickHandler) {
             document.removeEventListener('click', window.produtosOutsideClickHandler);
         }
         
         // Criar novo handler
         window.produtosOutsideClickHandler = function(event) {
             if (!miniCard.contains(event.target) && !event.target.closest('.produtos-arrow')) {
                 closeProdutosMiniCard();
                 document.removeEventListener('click', window.produtosOutsideClickHandler);
                 window.produtosOutsideClickHandler = null;
             }
         };
         
         document.addEventListener('click', window.produtosOutsideClickHandler);
     }, 100);
}

// Função para mostrar/ocultar detalhes dos produtos
window.toggleProdutosDetails = function(clienteId) {

    
    // Verificar se já existe um mini card aberto
    const existingMiniCard = document.querySelector('.produtos-mini-card');
    if (existingMiniCard) {
        closeProdutosMiniCard();
        return;
    }
    
    // Verificar se já está fazendo uma requisição para evitar múltiplas aberturas
    if (window.produtosRequestInProgress) {
        return;
    }
    
    // Marcar que uma requisição está em andamento
    window.produtosRequestInProgress = true;
    
    // Buscar detalhes dos produtos
    const queryParams = getCurrentFilterParams();
    const queryString = queryParams ? `?${queryParams}` : '';
    const url = `/api/produtos-cliente/${clienteId}${queryString}`;
    
    
    fetch(url)
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data && data.success) {
                showProdutosMiniCard(clienteId, data.produtos);
            } else {
                showProdutosMiniCard(clienteId, []);
            }
        })
        .catch(error => {
            showProdutosMiniCard(clienteId, []);
        })
        .finally(() => {
            // Limpar flag de requisição em andamento
            window.produtosRequestInProgress = false;
        });
}

// Função para alternar detalhes das tarefas
function toggleTarefasDetails(clienteId) {
    // Fechar mini-card se já estiver aberto
    const existingMiniCard = document.querySelector('.tarefas-mini-card');
    if (existingMiniCard) {
        existingMiniCard.remove();
        return;
    }
    
    // Buscar detalhes das tarefas com filtros atuais (inclui colaboradorIds e período)
    const queryParams = getCurrentFilterParams();
    const queryString = queryParams ? `?${queryParams}` : '';
    const url = `/api/tarefas-detalhes/${clienteId}${queryString}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const tarefas = (data && data.success) ? (data.tarefas || []) : [];
            showTarefasMiniCard(clienteId, tarefas);
            // Atualizar contagem de colaboradores no card a partir das tarefas recebidas
            clienteTarefasCarregadas.set(clienteId, tarefas);
            updateCollaboratorsCountFromTasks(clienteId);
        })
        .catch(error => {
            console.error('❌ Erro na requisição:', error);
            showTarefasMiniCard(clienteId, []);
            // Mesmo em erro, garantir que não fique "Carregando..."
            clienteTarefasCarregadas.set(clienteId, []);
            updateCollaboratorsCountFromTasks(clienteId);
        });
}

// Função para alternar tarefas de um colaborador específico
async function toggleColaboradorTarefas(clienteId, colaboradorId, arrowElement) {

    
    // Verificar se já existe um card lateral de tarefas aberto
    const existingCard = document.querySelector('.colaborador-tarefas-lateral-card');
    const arrowIcon = arrowElement.querySelector('i');
    
    if (existingCard) {
        // Se já existe um card, fechar
        closeColaboradorTarefasLateralCard();
        arrowIcon.className = 'fas fa-chevron-right';
        return;
    }
    
    // Criar e mostrar o card lateral
    await showColaboradorTarefasLateralCard(clienteId, colaboradorId, arrowElement);
    arrowIcon.className = 'fas fa-chevron-down';
}

// Função para carregar tarefas de um colaborador específico
// Função para carregar tarefas para o cache automaticamente
async function loadTarefasParaCache(clienteId, useFilters = true) {
    try {
        let url = `/api/tarefas-detalhes/${clienteId}`;
        
        // Aplicar filtros atuais se solicitado
        if (useFilters) {
            const filterParams = getCurrentFilterParams();
            if (filterParams) {
                // Converter em URLSearchParams para manipular
                const qs = new URLSearchParams(filterParams);
                // Remover compat de responsavel_id (não usamos mais aqui)
                qs.delete('responsavel_id');
                // Incluir periodoLogica se disponível
                const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : null;
                if (logic) qs.set('periodoLogica', logic);
                url += `?${qs.toString()}`;
            }
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const tarefas = data.tarefas || [];
        
        // Armazenar no cache
        clienteTarefasCarregadas.set(clienteId, tarefas);
        // Atualizar contador de colaboradores no card
        updateCollaboratorsCountFromTasks(clienteId);
    } catch (error) {
        console.error('❌ Erro ao carregar tarefas para cache:', error);
        clienteTarefasCarregadas.set(clienteId, []);
        // Garantir que não fique "Carregando..." mesmo em erro
        updateCollaboratorsCountFromTasks(clienteId);
    }
}

function loadColaboradorTarefas(clienteId, colaboradorId, container) {
    // Mostrar loading
    container.innerHTML = '<div class="loading-tarefas"><i class="fas fa-spinner fa-spin"></i> Carregando tarefas...</div>';
    
    // Buscar tarefas já carregadas do cliente no cache
    const tarefasDoCliente = clienteTarefasCarregadas.get(clienteId) || [];
    
    // Filtrar tarefas onde o colaborador aparece nos registros de tempo
    const tarefasDoColaborador = tarefasDoCliente.filter(tarefa => {
        const usuarios = Array.isArray(tarefa.colaboradores) ? tarefa.colaboradores : [];
        return usuarios.some(u => String(u.usuario_id) === String(colaboradorId));
    });
    
    // Exibir as tarefas
    showColaboradorTarefasContent(container, tarefasDoColaborador);
}

// Função para exibir o conteúdo das tarefas do colaborador
function showColaboradorTarefasContent(container, tarefas) {
    
    
    if (tarefas.length === 0) {
        container.innerHTML = '<div class="no-tarefas-colaborador">Nenhuma tarefa encontrada para este colaborador</div>';
        return;
    }
    
    const tarefasHTML = tarefas.map((tarefa, index) => `
        <div class="colaborador-tarefa-item" data-tarefa-url="${tarefa.url || ''}" data-tarefa-index="${index}">
            <div class="colaborador-tarefa-header">
                <i class="fas fa-tasks"></i>
                <span class="colaborador-tarefa-nome">${tarefa.nome}</span>
                <span class="colaborador-tarefa-id">#${tarefa.id}</span>
                ${tarefa.url && tarefa.url.trim() !== '' ? `
                    <button class="colaborador-tarefa-redirect-btn" data-url="${tarefa.url}" title="Abrir tarefa">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                ` : ''}
                <button class="colaborador-tarefa-expand-btn" data-tarefa-id="${tarefa.id}" title="Expandir registros">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="colaborador-tarefa-details">
                <div class="colaborador-tempo-item">
                    <i class="fas fa-clock"></i>
                    <span>Estimado: ${Number(tarefa.tempo_estimado).toFixed(2)}h</span>
                </div>
                <div class="colaborador-tempo-item">
                    <i class="fas fa-stopwatch"></i>
                    <span>Realizado: ${Number(tarefa.tempo_realizado).toFixed(2)}h</span>
                </div>
            </div>
            <div class="colaborador-tarefa-registros" data-tarefa-id="${tarefa.id}" style="display:none"></div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="colaborador-tarefas-list">${tarefasHTML}</div>`;
    
    // Adicionar event listeners para botões de redirecionamento
    const redirectButtons = container.querySelectorAll('.colaborador-tarefa-redirect-btn');
    redirectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = button.getAttribute('data-url');
            
            if (url && url.trim() !== '') {
                window.open(url, '_blank');

            }
        });
    });

    // Adicionar eventos para expandir registros
    const expandButtons = container.querySelectorAll('.colaborador-tarefa-expand-btn');
    expandButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tarefaId = btn.getAttribute('data-tarefa-id');
            const registrosContainer = container.querySelector(`.colaborador-tarefa-registros[data-tarefa-id="${tarefaId}"]`);
            if (!registrosContainer) return;

            const toggleDisplay = () => {
                const icon = btn.querySelector('i');
                const willShow = registrosContainer.style.display === 'none';
                registrosContainer.style.display = willShow ? 'block' : 'none';
                icon.className = willShow ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
            };

            // Se já tem conteúdo, apenas alterna visibilidade
            if (registrosContainer.innerHTML && registrosContainer.innerHTML.trim() !== '') {
                toggleDisplay();
                return;
            }

            // Buscar registros de tempo da tarefa
            try {
                const resp = await fetch(`/api/tarefa-registros-tempo/${tarefaId}`);
                const json = await resp.json();
                if (!json.success) {
                    registrosContainer.innerHTML = '<div class="registro-erro">Erro ao carregar registros</div>';
                    registrosContainer.style.display = 'block';
                    return;
                }

                const toHoras = (n) => {
                    const num = Number(n);
                    if (!Number.isFinite(num) || num <= 0) return 0;
                    if (num < 1000) return num; // já em horas
                    return parseFloat((num / 3600000).toFixed(2));
                };

                const formatDate = (iso) => {
                    if (!iso) return '-';
                    const d = new Date(iso);
                    const pad = (v) => String(v).padStart(2, '0');
                    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };

                const registros = json.registros || [];
                if (registros.length === 0) {
                    registrosContainer.innerHTML = '<div class="registro-vazio">Sem registros de tempo</div>';
                } else {
                    const items = registros.map(r => `
                        <div class="registro-item">
                            <span class="registro-inicio">${formatDate(r.data_inicio)}</span>
                            <span class="registro-duracao">${toHoras(r.tempo_realizado).toFixed(2)}h</span>
                        </div>
                    `).join('');
                    registrosContainer.innerHTML = `<div class="registros-list">${items}</div>`;
                }
                registrosContainer.style.display = 'block';
            } catch (err) {
                console.error('Erro ao carregar registros da tarefa', tarefaId, err);
                registrosContainer.innerHTML = '<div class="registro-erro">Erro ao carregar registros</div>';
                registrosContainer.style.display = 'block';
            }
        });
    });
}

// Função para mostrar o card lateral de tarefas do colaborador
async function showColaboradorTarefasLateralCard(clienteId, colaboradorId, arrowElement) {

    
    // Obter a posição do elemento colaborador
    const colaboradorElement = arrowElement.closest('.colaborador-item');
    const rect = colaboradorElement.getBoundingClientRect();
    
    // Criar o card lateral
    const lateralCard = document.createElement('div');
    lateralCard.className = 'colaborador-tarefas-lateral-card';
    lateralCard.innerHTML = `
        <div class="lateral-card-header">
            <h4><i class="fas fa-tasks"></i> Tarefas do Colaborador</h4>
            <button class="close-lateral-card" onclick="closeColaboradorTarefasLateralCard()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="lateral-card-content" id="lateral-tarefas-content-${colaboradorId}">
            <div class="loading-tarefas"><i class="fas fa-spinner fa-spin"></i> Carregando tarefas...</div>
        </div>
    `;
    
    // Adicionar ao body primeiro para calcular dimensões
    document.body.appendChild(lateralCard);
    
    // Calcular posicionamento absoluto baseado no documento (não viewport)
    const cardRect = lateralCard.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calcular posição absoluta no documento (viewport + scroll)
    const documentLeft = rect.left + scrollLeft;
    const documentTop = rect.top + scrollTop;
    
    // Posição inicial: à direita do colaborador (fixo no documento)
    let left = documentLeft + rect.width + 10;
    let top = documentTop;
    
    // Verificar limites da viewport para ajustar se necessário
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Se sair da tela pela direita, posicionar à esquerda
    if ((left - scrollLeft) + cardRect.width > viewportWidth - 20) {
        left = documentLeft - cardRect.width - 10;
        
        // Se ainda sair pela esquerda, ajustar
        if ((left - scrollLeft) < 20) {
            left = scrollLeft + 20;
        }
    }
    
    // Se sair por baixo, ajustar
    if ((top - scrollTop) + cardRect.height > viewportHeight - 20) {
        top = Math.max(scrollTop + 20, documentTop - cardRect.height + rect.height);
    }
    
    // Se sair por cima, ajustar
    if ((top - scrollTop) < 20) {
        top = scrollTop + 20;
    }
    
    // Aplicar posicionamento ABSOLUTO com coordenadas do documento
    lateralCard.style.position = 'absolute';
    lateralCard.style.left = `${left}px`;
    lateralCard.style.top = `${top}px`;
    lateralCard.style.zIndex = '1001';
    
    // Adicionar animação de entrada
    setTimeout(() => {
        lateralCard.classList.add('show');
    }, 10);
    
    // Verificar se as tarefas estão no cache, se não, carregar primeiro
    const tarefasNoCache = clienteTarefasCarregadas.get(clienteId) || [];
    if (tarefasNoCache.length === 0) {

        await loadTarefasParaCache(clienteId, true); // Aguardar carregamento com filtros atuais
    }
    
    // Carregar as tarefas no card lateral
    const contentContainer = document.getElementById(`lateral-tarefas-content-${colaboradorId}`);
    loadColaboradorTarefasLateral(clienteId, colaboradorId, contentContainer);
    
    // Adicionar event listener para fechar ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClickLateral);
    }, 100);
}

// Função para fechar o card lateral
function closeColaboradorTarefasLateralCard() {
    const lateralCard = document.querySelector('.colaborador-tarefas-lateral-card');
    if (lateralCard) {
        lateralCard.classList.remove('show');
        setTimeout(() => {
            lateralCard.remove();
        }, 300);
        document.removeEventListener('click', handleOutsideClickLateral);
        
        // Resetar todas as setas dos colaboradores
        const arrows = document.querySelectorAll('.colaborador-tarefas-arrow i');
        arrows.forEach(arrow => {
            arrow.className = 'fas fa-chevron-right';
        });
    }
}

// Função para lidar com cliques fora do card lateral
function handleOutsideClickLateral(event) {
    const lateralCard = document.querySelector('.colaborador-tarefas-lateral-card');
    const colaboradorItems = document.querySelectorAll('.colaborador-item');
    
    if (lateralCard && !lateralCard.contains(event.target)) {
        // Verificar se o clique foi em algum colaborador
        let clickedOnColaborador = false;
        colaboradorItems.forEach(item => {
            if (item.contains(event.target)) {
                clickedOnColaborador = true;
            }
        });
        
        if (!clickedOnColaborador) {
            closeColaboradorTarefasLateralCard();
        }
    }
}

// Função para carregar tarefas no card lateral
function loadColaboradorTarefasLateral(clienteId, colaboradorId, container) {
    // Buscar tarefas já carregadas do cliente no cache
    const tarefasDoCliente = clienteTarefasCarregadas.get(clienteId) || [];
    
    // Filtrar tarefas onde o colaborador aparece nos registros de tempo
    const tarefasDoColaborador = tarefasDoCliente.filter(tarefa => {
        const usuarios = Array.isArray(tarefa.colaboradores) ? tarefa.colaboradores : [];
        return usuarios.some(u => String(u.usuario_id) === String(colaboradorId));
    });
    
    // Exibir as tarefas no card lateral
    showColaboradorTarefasContentLateral(container, tarefasDoColaborador);
}

// Função para exibir o conteúdo das tarefas no card lateral
function showColaboradorTarefasContentLateral(container, tarefas) {
    
    
    if (tarefas.length === 0) {
        container.innerHTML = '<div class="no-tarefas-colaborador-lateral">Nenhuma tarefa encontrada para este colaborador</div>';
        return;
    }
    
    const tarefasHTML = tarefas.map((tarefa, index) => `
        <div class="colaborador-tarefa-item-lateral" data-tarefa-url="${tarefa.url || ''}" data-tarefa-index="${index}">
            <div class="colaborador-tarefa-header-lateral">
                <div class="tarefa-title-section">
                    <i class="fas fa-tasks"></i>
                    <span class="colaborador-tarefa-nome">${tarefa.nome}</span>
                    <span class="colaborador-tarefa-id">#${tarefa.id}</span>
                </div>
                ${tarefa.url && tarefa.url.trim() !== '' ? `
                    <button class="colaborador-tarefa-redirect-btn-lateral" data-url="${tarefa.url}" title="Abrir tarefa">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                ` : ''}
                <button class="colaborador-tarefa-expand-btn-lateral" data-tarefa-id="${tarefa.id}" title="Mostrar registros">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="colaborador-tarefa-details-lateral">
                <div class="colaborador-tempo-item-lateral">
                    <i class="fas fa-clock"></i>
                    <span>Estimado: ${Number(tarefa.tempo_estimado).toFixed(2)}h</span>
                </div>
                <div class="colaborador-tempo-item-lateral">
                    <i class="fas fa-stopwatch"></i>
                    <span>Realizado: ${Number(tarefa.tempo_realizado).toFixed(2)}h</span>
                </div>
            </div>
            <div class="colaborador-tarefa-registros-lateral" data-tarefa-id="${tarefa.id}" style="display:none"></div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="colaborador-tarefas-list-lateral">${tarefasHTML}</div>`;
    
    // Adicionar event listeners para botões de redirecionamento
    const redirectButtons = container.querySelectorAll('.colaborador-tarefa-redirect-btn-lateral');
    redirectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = button.getAttribute('data-url');
            console.log('🎯 Clique no botão de redirecionamento lateral detectado, URL:', url);
            if (url && url.trim() !== '') {
                window.open(url, '_blank');
    
            }
        });
    });

    // Expandir registros no card lateral
    const expandButtons = container.querySelectorAll('.colaborador-tarefa-expand-btn-lateral');
    expandButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tarefaId = btn.getAttribute('data-tarefa-id');
            const registrosContainer = container.querySelector(`.colaborador-tarefa-registros-lateral[data-tarefa-id="${tarefaId}"]`);
            if (!registrosContainer) return;

            const toggleDisplay = () => {
                registrosContainer.style.display = registrosContainer.style.display === 'none' ? 'block' : 'none';
            };

            if (registrosContainer.innerHTML && registrosContainer.innerHTML.trim() !== '') {
                toggleDisplay();
                return;
            }

            try {
                // Montar query string com filtros atuais, se disponível
                let qs = '';
                try {
                    if (typeof getCurrentFilterParams === 'function') {
                        const paramsStr = getCurrentFilterParams();
                        qs = paramsStr ? `?${paramsStr}` : '';
                    }
                } catch (e) {}

                // Buscar usuários com tempo para a tarefa
                const resp = await fetch(`/api/tarefa-usuarios-tempo/${tarefaId}${qs}`);
                const json = await resp.json();
                if (!json.success) {
                    registrosContainer.innerHTML = '<div class="registro-erro">Erro ao carregar usuários</div>';
                    registrosContainer.style.display = 'block';
                    return;
                }

                const usuarios = json.usuarios || [];
                if (usuarios.length === 0) {
                    registrosContainer.innerHTML = '<div class="registro-vazio">Nenhum usuário com registros</div>';
                    registrosContainer.style.display = 'block';
                    return;
                }

                // Funções utilitárias
                const toHoursDisplay = (val) => {
                    if (val == null) return '0.00';
                    if (typeof val === 'string' && val.includes(':')) {
                        const parts = val.split(':').map(p => parseInt(p, 10) || 0);
                        const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;
                        const ms = ((h * 60 + m) * 60 + s) * 1000;
                        return (ms / 3600000).toFixed(2);
                    }
                    const num = parseFloat(val);
                    if (!Number.isFinite(num) || num <= 0) return '0.00';
                    const horas = num < 1000 ? num : (num / 3600000);
                    return horas.toFixed(2);
                };
                const formatDate = (iso) => {
                    if (!iso) return '-';
                    const d = new Date(iso);
                    const pad = (v) => String(v).padStart(2, '0');
                    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };

                // Renderizar usuários com botão de expandir registros
                registrosContainer.innerHTML = `<div class="usuarios-list">
                    ${usuarios.map(u => `
                        <div class="usuario-item" data-usuario-id="${u.usuario_id}">
                            <div class="usuario-header">
                                <i class="fas fa-user usuario-icon"></i>
                                <span class="usuario-nome">${u.nome || 'Usuário'}</span>
                                <span class="usuario-tempo-pill">${toHoursDisplay(u.tempo_total)}h</span>
                                <button class="usuario-toggle-btn" title="Mostrar registros"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="registros-list" style="display:none"></div>
                        </div>
                    `).join('')}
                </div>`;

                // Adicionar listeners para expandir registros por usuário
                const userItems = registrosContainer.querySelectorAll('.usuario-item');
                userItems.forEach(userItem => {
                    const usuarioId = parseInt(userItem.getAttribute('data-usuario-id'), 10);
                    const toggleBtn = userItem.querySelector('.usuario-toggle-btn');
                    const registrosList = userItem.querySelector('.registros-list');
                    toggleBtn.addEventListener('click', async (ev) => {
                        ev.stopPropagation();
                        const ic = toggleBtn.querySelector('i');
                        if (registrosList.style.display === 'none') {
                            ic.className = 'fas fa-chevron-down';
                            try {
                                const resp2 = await fetch(`/api/tarefa-registros-tempo/${tarefaId}`);
                                const data2 = await resp2.json();
                                const registros = (data2 && data2.success) ? (data2.registros || []) : [];
                                const registrosUsuario = registros.filter(r => parseInt(r.usuario_id, 10) === usuarioId);
                                registrosList.innerHTML = registrosUsuario.length > 0 ? registrosUsuario.map(r => `
                                    <div class="registro-item">
                                        <i class="fas fa-stopwatch registro-icon"></i>
                                        <span class="registro-tempo-pill">${toHoursDisplay(r.tempo_realizado)}h</span>
                                        <span class="registro-data">${formatDate(r.data_inicio)}</span>
                                    </div>
                                `).join('') : '<div class="no-registros">Sem registros deste usuário</div>';
                                registrosList.style.display = '';
                            } catch (e2) {
                                registrosList.innerHTML = '<div class="no-registros">Erro ao carregar registros</div>';
                                registrosList.style.display = '';
                            }
                        } else {
                            ic.className = 'fas fa-chevron-right';
                            registrosList.style.display = 'none';
                        }
                    });
                });

                registrosContainer.style.display = 'block';
            } catch (err) {
                console.error('Erro ao carregar registros da tarefa (lateral)', tarefaId, err);
                registrosContainer.innerHTML = '<div class="registro-erro">Erro ao carregar registros</div>';
                registrosContainer.style.display = 'block';
            }
        });
    });
}

// Função para exibir o mini card com os nomes dos colaboradores
async function showColaboradoresMiniCard(clienteId, colaboradores) {
    console.log('👥 Mini-card de colaboradores desativado para o card.');
    // Remover qualquer mini-card aberto
    const existingMiniCard = document.querySelector('.colaboradores-mini-card');
    if (existingMiniCard) existingMiniCard.remove();
    return;


    
    // Verificar se o card do cliente existe no DOM (pode ter sido filtrado)
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) {

        return;
    }
    
    // Verificar se o card ainda existe no DOM antes de procurar elementos filhos
    if (!document.body.contains(clientCard)) {
        return; // Card foi removido/filtrado, não processar
    }

    // Calcular Hrs realizadas dos colaboradores (apenas exibição no mini-card; card é atualizado por loadRealizedHoursAsync)
    try {
        // Sem atualização do card aqui para evitar duplicidade/confusão.
        // Dados exibidos seguem abaixo no mini-card.
    } catch (e) {
        console.warn('Falha ao calcular horas realizadas dos colaboradores:', e);
    }
    
    // Carregar tarefas automaticamente se não estiverem no cache
    const tarefasNoCache = clienteTarefasCarregadas.get(clienteId) || [];
    if (tarefasNoCache.length === 0) {

        await loadTarefasParaCache(clienteId, true); // Aguardar carregamento com filtros atuais
    } else {

    }
    
    // Encontrar especificamente o ícone de colaboradores que foi clicado
    const colaboradoresArrow = clientCard.querySelector('.colaboradores-arrow');
    if (!colaboradoresArrow) {
        // Não loggar erro - pode ter sido filtrado
        return;
    }
    
    // Criar o mini card
    const miniCard = document.createElement('div');
    miniCard.className = 'colaboradores-mini-card';
    miniCard.innerHTML = `
        <button class="mini-card-close" onclick="closeColaboradoresMiniCard()">
            <i class="fas fa-times"></i>
        </button>
        <div class="mini-card-content">
            ${colaboradores.length > 0 ? 
                colaboradores.map((colaborador, index) => `
                    <div class="colaborador-item" data-colaborador-id="${colaborador.id}">
                        <i class="fas fa-user usuario-icon"></i>
                        <div class="colaborador-info">
                            <div class="colaborador-header">
                                <span class="colaborador-nome">${colaborador.nome}</span>
                                <span class="colaborador-tarefas-arrow" onclick="toggleColaboradorTarefas('${clienteId}', '${colaborador.id}', this)" title="Ver tarefas do colaborador">
                                    <i class="fas fa-chevron-right"></i>
                                </span>
                            </div>
                            <div class="colaborador-realizadas-card">
                                <div class="colaborador-realizadas-top-text">
                                    Realizadas: ${(parseFloat(colaborador.horas_realizadas) || 0).toFixed(2)}h
                                </div>
                                <div class="colaborador-realizadas-cost-text">
                                    Realizado: ${colaborador.custo_realizacao_formatado || 'R$ 0,00'}
                                </div>
                            </div>
                            <div class="colaborador-tarefas-container" id="colaborador-tarefas-${colaborador.id}" style="display: none;">
                                <!-- Tarefas do colaborador serão inseridas aqui -->
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-colaboradores">Nenhum colaborador encontrado</div>'
            }
        </div>
    `;

    // Adicionar ao body primeiro para calcular dimensões
    document.body.appendChild(miniCard);
    
    // Calcular posição ABSOLUTA baseada na posição do documento (não viewport)
    const arrowRect = colaboradoresArrow.getBoundingClientRect();
    const miniCardRect = miniCard.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calcular posição absoluta no documento (viewport + scroll)
    const documentLeft = arrowRect.left + scrollLeft;
    const documentTop = arrowRect.top + scrollTop;
    
    // Posicionar ao lado direito do ícone de colaboradores
    let left = documentLeft + arrowRect.width + 10;
    let top = documentTop;
    
    // Verificar limites da viewport para ajustar se necessário
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Se sair da tela pela direita, posicionar à esquerda
    if ((left - scrollLeft) + miniCardRect.width > viewportWidth) {
        left = documentLeft - miniCardRect.width - 10;
    }
    
    // Se ainda sair pela esquerda, ajustar
    if ((left - scrollLeft) < 10) {
        left = scrollLeft + 10;
    }
    
    // Se sair por baixo, ajustar
    if ((top - scrollTop) + miniCardRect.height > viewportHeight) {
        top = scrollTop + viewportHeight - miniCardRect.height - 10;
    }
    
    // Se sair por cima, ajustar
    if ((top - scrollTop) < 10) {
        top = scrollTop + 10;
    }
    
    // Aplicar posicionamento ABSOLUTO com coordenadas do documento
    miniCard.style.position = 'absolute';
    miniCard.style.left = `${left}px`;
    miniCard.style.top = `${top}px`;
    miniCard.style.zIndex = '1000';
    
    // Adicionar animação de entrada
    setTimeout(() => {
        miniCard.classList.add('show');
    }, 10);
    
    // Fechar ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
    
    function handleOutsideClick(event) {
        if (!miniCard.contains(event.target) && !event.target.closest('.colaboradores-arrow')) {
            closeColaboradoresMiniCard();
            document.removeEventListener('click', handleOutsideClick);
        }
    }
}

// Função para exibir o mini card com os detalhes das tarefas
function showTarefasMiniCard(clienteId, tarefas) {

    
    // Armazenar tarefas no cache para uso posterior pelos colaboradores
    clienteTarefasCarregadas.set(clienteId, tarefas || []);

    
    // Verificar se o card do cliente existe no DOM (pode ter sido filtrado)
    const clientCard = document.querySelector(`[data-client-id="${clienteId}"]`);
    if (!clientCard) {

        return;
    }
    
    // Verificar se o card ainda existe no DOM antes de procurar elementos filhos
    if (!document.body.contains(clientCard)) {
        return; // Card foi removido/filtrado, não processar
    }
    
    // Encontrar especificamente o ícone de tarefas que foi clicado
    const tarefasArrow = clientCard.querySelector('.tarefas-expand-btn') || clientCard.querySelector('.tarefas-arrow');
    if (!tarefasArrow) {
        // Não loggar erro - pode ter sido filtrado
        return;
    }
    
    // Criar o mini card
    const miniCard = document.createElement('div');
    miniCard.className = 'tarefas-mini-card';
    miniCard.innerHTML = `
        <button class="mini-card-close" onclick="closeTarefasMiniCard()">
            <i class="fas fa-times"></i>
        </button>
        <div class="mini-card-content">
            ${tarefas.length > 0 ? 
                tarefas.map((tarefa, index) => `
                    <div class="tarefa-item" data-tarefa-url="${tarefa.url || ''}" data-tarefa-index="${index}">
                        <div class="tarefa-header">
                            <i class="fas fa-tasks"></i>
                            <span class="tarefa-nome">${tarefa.nome}</span>
                            <span class="tarefa-id">#${tarefa.id}</span>
                            ${tarefa.url && tarefa.url.trim() !== '' ? `
                                <button class="tarefa-redirect-btn" data-url="${tarefa.url}" title="Abrir tarefa">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="tarefa-details">
                            <div class="tempo-item">
                                <i class="fas fa-clock"></i>
                                <span>Estimado: ${tarefa.tempo_estimado}h</span>
                            </div>
                            <div class="tempo-item">
                                <i class="fas fa-stopwatch"></i>
                                <span>Realizado: ${tarefa.tempo_realizado}h</span>
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<div class="no-tarefas">Nenhuma tarefa encontrada</div>'
            }
        </div>
    `;
    
    // Adicionar ao body primeiro para calcular dimensões
    document.body.appendChild(miniCard);
    
    // Adicionar event listeners para botões de redirecionamento
    const redirectButtons = miniCard.querySelectorAll('.tarefa-redirect-btn');
    redirectButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = button.getAttribute('data-url');

            if (url && url.trim() !== '') {
                window.open(url, '_blank');

            }
        });
    });

    // Inserir expansão por usuários e registros por usuário
    const tarefaItems = miniCard.querySelectorAll('.tarefa-item');
    tarefaItems.forEach(item => {
        const idx = parseInt(item.getAttribute('data-tarefa-index'), 10);
        const tarefa = Array.isArray(tarefas) ? tarefas[idx] : null;
        const tarefaId = tarefa ? tarefa.id : null;
        if (!tarefaId) return;

        const headerEl = item.querySelector('.tarefa-header');
        const usuariosToggleBtn = document.createElement('button');
        usuariosToggleBtn.className = 'tarefa-expand-btn';
        usuariosToggleBtn.title = 'Mostrar usuários com tempo';
        usuariosToggleBtn.style.marginLeft = '8px';
        usuariosToggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        headerEl.appendChild(usuariosToggleBtn);

        const usuariosList = document.createElement('div');
        usuariosList.className = 'usuarios-list';
        usuariosList.style.display = 'none';
        usuariosList.style.marginTop = '6px';
        item.appendChild(usuariosList);

        usuariosToggleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const icon = usuariosToggleBtn.querySelector('i');
            if (usuariosList.style.display === 'none') {
                icon.className = 'fas fa-chevron-down';
                let qs = '';
                try {
                    if (typeof getCurrentFilterParams === 'function') {
                        const paramsStr = getCurrentFilterParams();
                        qs = paramsStr ? `?${paramsStr}` : '';
                    }
                } catch (e) {}
                const url = `/api/tarefa-usuarios-tempo/${tarefaId}${qs}`;
                try {
                    const resp = await fetch(url);
                    const data = await resp.json();
                    const usuarios = (data && data.success) ? (data.usuarios || []) : [];
                    usuariosList.innerHTML = usuarios.length > 0 ? usuarios.map(u => `
                        <div class="usuario-item" data-usuario-id="${u.usuario_id}">
                            <div class="usuario-header">
                                <i class="fas fa-user usuario-icon"></i>
                                <span class="usuario-nome">${u.nome || 'Usuário'}</span>
                                <span class="usuario-tempo-pill">${u.tempo_total}h</span>
                                <button class="usuario-toggle-btn" title="Mostrar registros"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="registros-list" style="display:none"></div>
                        </div>
                    `).join('') : '<div class="no-usuarios">Nenhum registro de tempo</div>';

                    const userItems = usuariosList.querySelectorAll('.usuario-item');
                    userItems.forEach(userItem => {
                        const usuarioId = parseInt(userItem.getAttribute('data-usuario-id'), 10);
                        const toggleBtn = userItem.querySelector('.usuario-toggle-btn');
                        const registrosList = userItem.querySelector('.registros-list');
                        toggleBtn.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            const ic = toggleBtn.querySelector('i');
                            if (registrosList.style.display === 'none') {
                                ic.className = 'fas fa-chevron-down';
                                try {
                                    let qs2 = '';
                                    try {
                                        if (typeof getCurrentFilterParams === 'function') {
                                            const paramsStr = getCurrentFilterParams();
                                            qs2 = paramsStr ? `?${paramsStr}` : '';
                                        }
                                    } catch (e) {}
                                    const resp2 = await fetch(`/api/tarefa-registros-tempo/${tarefaId}${qs2}`);
                                    const data2 = await resp2.json();
                                    const registros = (data2 && data2.success) ? (data2.registros || []) : [];
                                    const registrosUsuario = registros.filter(r => parseInt(r.usuario_id, 10) === usuarioId);
                                    const toHoursDisplay = (val) => {
                                        if (val == null) return '0.00';
                                        if (typeof val === 'string' && val.includes(':')) {
                                            const parts = val.split(':').map(p => parseInt(p, 10) || 0);
                                            const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;
                                            const ms = ((h * 60 + m) * 60 + s) * 1000;
                                            return (ms / 3600000).toFixed(2);
                                        }
                                        const num = parseFloat(val);
                                        if (!Number.isFinite(num) || num <= 0) return '0.00';
                                        const horas = num < 1000 ? num : (num / 3600000);
                                        return horas.toFixed(2);
                                    };
                                    const formatDate = (iso) => {
                                        if (!iso) return '-';
                                        const d = new Date(iso);
                                        const pad = (v) => String(v).padStart(2, '0');
                                        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                    };
                                    registrosList.innerHTML = registrosUsuario.length > 0 ? registrosUsuario.map(r => `
                                        <div class="registro-item">
                                            <i class="fas fa-stopwatch registro-icon"></i>
                                            <span class="registro-tempo-pill">${toHoursDisplay(r.tempo_realizado)}h</span>
                                            <span class="registro-data">${formatDate(r.data_inicio)}</span>
                                        </div>
                                    `).join('') : '<div class="no-registros">Sem registros deste usuário</div>';
                                    registrosList.style.display = '';
                                } catch (e2) {
                                    registrosList.innerHTML = '<div class="no-registros">Erro ao carregar registros</div>';
                                    registrosList.style.display = '';
                                }
                            } else {
                                ic.className = 'fas fa-chevron-right';
                                registrosList.style.display = 'none';
                            }
                        });
                    });
                } catch (e1) {
                    usuariosList.innerHTML = '<div class="no-usuarios">Erro ao carregar usuários</div>';
                }
                usuariosList.style.display = '';
            } else {
                icon.className = 'fas fa-chevron-right';
                usuariosList.style.display = 'none';
                usuariosList.innerHTML = '';
            }
        });
    });
    
    // Calcular posição ABSOLUTA baseada na posição do documento (não viewport)
    const arrowRect = tarefasArrow.getBoundingClientRect();
    const miniCardRect = miniCard.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calcular posição absoluta no documento (viewport + scroll)
    const documentLeft = arrowRect.left + scrollLeft;
    const documentTop = arrowRect.top + scrollTop;
    
    // Posicionar ao lado direito do ícone de tarefas
    let left = documentLeft + arrowRect.width + 10;
    let top = documentTop;
    
    // Verificar limites da viewport para ajustar se necessário
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Se sair da tela pela direita, posicionar à esquerda
    if ((left - scrollLeft) + miniCardRect.width > viewportWidth) {
        left = documentLeft - miniCardRect.width - 10;
    }
    
    // Se ainda sair pela esquerda, ajustar
    if ((left - scrollLeft) < 10) {
        left = scrollLeft + 10;
    }
    
    // Se sair por baixo, ajustar
    if ((top - scrollTop) + miniCardRect.height > viewportHeight) {
        top = scrollTop + viewportHeight - miniCardRect.height - 10;
    }
    
    // Se sair por cima, ajustar
    if ((top - scrollTop) < 10) {
        top = scrollTop + 10;
    }
    
    // Aplicar posicionamento ABSOLUTO com coordenadas do documento
    miniCard.style.position = 'absolute';
    miniCard.style.left = `${left}px`;
    miniCard.style.top = `${top}px`;
    miniCard.style.zIndex = '1000';
    
    // Adicionar animação de entrada
    setTimeout(() => {
        miniCard.classList.add('show');
    }, 10);
    
    // Fechar ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
    
    function handleOutsideClick(event) {
        // Verificar se o clique foi no botão de redirecionamento (não fechar o card)
        if (event.target.closest('.tarefa-redirect-btn')) {

            return;
        }
        
        // Fechar apenas se clicou fora do mini card e não na seta de tarefas
        if (!miniCard.contains(event.target) && !event.target.closest('.tarefas-expand-btn')) {
    
            closeTarefasMiniCard();
            document.removeEventListener('click', handleOutsideClick);
        }
    }
}

// Função para abrir URL da tarefa (definir no escopo global)
window.openTarefaUrl = function(url) {


    
    if (url && url.trim() !== '') {

        window.open(url, '_blank');

        return true;
    } else {

        return false;
    }
};

// Também definir como função normal para compatibilidade
function openTarefaUrl(url) {
    return window.openTarefaUrl(url);
}

// Função para fechar o mini card das tarefas
function closeTarefasMiniCard() {
    const miniCard = document.querySelector('.tarefas-mini-card');
    if (miniCard) {
        miniCard.classList.add('hide');
        setTimeout(() => {
            miniCard.remove();
        }, 200);
    }
}

// Função para fechar o mini card
function closeColaboradoresMiniCard() {
    // Colaboradores desativados: garantir que mini-card não permaneça
    const miniCard = document.querySelector('.colaboradores-mini-card');
    if (miniCard) {
        miniCard.remove();
    }
}

// Função para fechar o mini card dos produtos
window.closeProdutosMiniCard = function() {
    const miniCard = document.querySelector('.produtos-mini-card');
    if (miniCard) {
        miniCard.classList.add('hide');
        setTimeout(() => {
            miniCard.remove();
        }, 200);
    }
    
    // Remover event listener se existir
    if (window.produtosOutsideClickHandler) {
        document.removeEventListener('click', window.produtosOutsideClickHandler);
        window.produtosOutsideClickHandler = null;
    }
    
    // Limpar flag de requisição se existir
    window.produtosRequestInProgress = false;
}

// Função para mostrar mini card de faturamento
function showFaturamentoMiniCard(clienteId, faturamentoRegistros) {
    // Remover qualquer mini card existente
    const existingMiniCard = document.querySelector('.faturamento-mini-card');
    if (existingMiniCard) {
        existingMiniCard.remove();
    }
    
    // Encontrar a seta do faturamento
    const faturamentoArrow = document.querySelector(`[data-client-id="${clienteId}"] .faturamento-arrow`);
    if (!faturamentoArrow) {
        console.error('❌ Seta do faturamento não encontrada');
        return;
    }
    
    // Criar o mini card
    const miniCard = document.createElement('div');
    miniCard.className = 'faturamento-mini-card';
    
    // Ordenar registros por data (mais recente primeiro)
    const registrosOrdenados = faturamentoRegistros.sort((a, b) => {
        return new Date(b.data_solicitacao) - new Date(a.data_solicitacao);
    });
    
    // Criar conteúdo do mini card - apenas valor e mês/ano
    let content = `
        <button class="mini-card-close" onclick="closeFaturamentoMiniCard()">×</button>
        <div class="mini-card-content">
    `;
    
    registrosOrdenados.forEach((registro, index) => {
        const valorFormatado = formatCurrency(registro.valor_bruto);
        const mesAno = registro.mes_ano || 'N/A';
        
        content += `
            <div class="faturamento-item" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                ${index < registrosOrdenados.length - 1 ? 'border-bottom: 1px solid #f0f0f0;' : ''}
            ">
                <span style="color: #6c757d; font-size: 13px;">${mesAno}</span>
                <span style="color: #28a745; font-weight: 600; font-size: 14px;">${valorFormatado}</span>
            </div>
        `;
    });
    
    content += '</div>';
    miniCard.innerHTML = content;
    
    // Adicionar ao DOM
    document.body.appendChild(miniCard);
    
    // Posicionar o mini card AO LADO da setinha
    const arrowRect = faturamentoArrow.getBoundingClientRect();
    const miniCardRect = miniCard.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const gap = 8;

    // Posição padrão: à direita da seta, centralizado verticalmente
    let left = arrowRect.right + scrollX + gap;
    let top = arrowRect.top + scrollY + (arrowRect.height / 2) - (miniCardRect.height / 2);

    // Limites da viewport
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Se estourar à direita, posicionar à esquerda da seta
    if (left + miniCardRect.width > scrollX + windowWidth - 10) {
        left = arrowRect.left + scrollX - miniCardRect.width - gap;
    }

    // Clamp vertical para evitar overflow
    const minTop = scrollY + 10;
    const maxTop = scrollY + windowHeight - miniCardRect.height - 10;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;

    miniCard.style.left = `${left}px`;
    miniCard.style.top = `${top}px`;
    
    // Mostrar com animação
    setTimeout(() => {
        miniCard.classList.add('show');
    }, 10);
    
    // Fechar ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', function closeFaturamentoOnOutsideClick(event) {
            if (!miniCard.contains(event.target) && !faturamentoArrow.contains(event.target)) {
                closeFaturamentoMiniCard();
                document.removeEventListener('click', closeFaturamentoOnOutsideClick);
            }
        });
    }, 100);
}

// Função para fechar mini card de faturamento
window.closeFaturamentoMiniCard = function() {
    const miniCard = document.querySelector('.faturamento-mini-card');
    if (miniCard) {
        miniCard.classList.add('hide');
        setTimeout(() => {
            miniCard.remove();
        }, 200);
    }
}

// Função auxiliar para obter parâmetros de filtro atuais (incluindo status de contrato)
function getCurrentFilterParamsWithStatus() {

    const params = new URLSearchParams();
    
    // Adicionar filtros de status se existirem
    if (typeof window.getSelectedStatuses === 'function') {
        const selectedStatuses = window.getSelectedStatuses();

        if (selectedStatuses.length > 0) {
            params.append('status', selectedStatuses.join(','));
        }
    }
    
    // Adicionar filtros de cliente se existirem
    if (typeof window.getSelectedClientes === 'function') {
        const selectedClientes = window.getSelectedClientes();

        if (selectedClientes.length > 0) {
            const clienteIds = selectedClientes.map(cliente => cliente.id);
            params.append('clienteIds', clienteIds.join(','));
        }
    }
    
    // Adicionar filtros de período se existirem
    if (selectedStartDate && selectedEndDate) {
    
        const dataInicialTimestamp = formatDateForTimestamptz(selectedStartDate);
        const dataFinalTimestamp = formatDateForTimestamptz(selectedEndDate);
        params.append('dataInicial', dataInicialTimestamp);
        params.append('dataFinal', dataFinalTimestamp);
    }
    
    const paramsString = params.toString();

    return paramsString;
}

// Ajustar URL de detalhes para incluir periodoLogica quando presente
function buildDetalhesQueryString(baseQueryString) {
    const qs = new URLSearchParams(baseQueryString);
    const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : null;
    if (logic) {
        qs.append('periodoLogica', logic);
    }
    return `?${qs.toString()}`;
}

// Função auxiliar para obter parâmetros de filtro atuais (SEM status de contrato - para visualizações detalhadas)
function getCurrentFilterParams() {

    const params = new URLSearchParams();
    
    // Adicionar filtros de cliente se existirem
    if (typeof window.getSelectedClientes === 'function') {
        const selectedClientes = window.getSelectedClientes();

        if (selectedClientes.length > 0) {
            const clienteIds = selectedClientes.map(cliente => cliente.id);
            params.append('clienteIds', clienteIds.join(','));
        }
    }

    // Adicionar filtros de colaboradores: enviar TODOS como colaboradorIds
    let colaboradorIdsToSend = [];

    // Preferir activeColaboradorFilters
    if (typeof activeColaboradorFilters !== 'undefined' && Array.isArray(activeColaboradorFilters) && activeColaboradorFilters.length > 0) {
        colaboradorIdsToSend = [...new Set(activeColaboradorFilters.map(id => id.toString()))];
    }

    // Fallback: getSelectedColaboradores()
    if (colaboradorIdsToSend.length === 0 && typeof getSelectedColaboradores === 'function') {
        const selected = getSelectedColaboradores();
        if (Array.isArray(selected) && selected.length > 0) {
            colaboradorIdsToSend = [...new Set(selected.map(id => id.toString()))];
        }
    }

    // Fallback: activeFilters com type==='colaborador'
    if (colaboradorIdsToSend.length === 0 && Array.isArray(activeFilters)) {
        const colaboradorFilters = activeFilters.filter(f => f.type === 'colaborador');
        if (colaboradorFilters.length > 0) {
            const allColaboradorIds = [];
            colaboradorFilters.forEach(filter => {
                if (filter.colaboradores) {
                    allColaboradorIds.push(...filter.colaboradores);
                }
            });
            colaboradorIdsToSend = [...new Set(allColaboradorIds.map(id => id.toString()))];
        }
    }

    if (colaboradorIdsToSend.length > 0) {
        params.append('colaboradorIds', colaboradorIdsToSend.join(','));
        if (typeof console !== 'undefined') {
            console.log('👥 Incluindo colaboradorIds nos detalhes:', colaboradorIdsToSend);
        }
        // Manter compatibilidade com endpoints que aceitam apenas um responsavel_id
        params.append('responsavel_id', colaboradorIdsToSend[0]);
    }
    
    // Adicionar filtros de período se existirem
    if (selectedStartDate && selectedEndDate) {
    
        const dataInicialTimestamp = formatDateForTimestamptz(selectedStartDate);
        const dataFinalTimestamp = formatDateForTimestamptz(selectedEndDate);
        params.append('dataInicial', dataInicialTimestamp);
        params.append('dataFinal', dataFinalTimestamp);
        // Incluir lógica E/OU
        const logic = (typeof window !== 'undefined' && window.periodoAndOr) ? window.periodoAndOr : 'E';
        params.append('periodoLogica', logic);
    }
    
    const paramsString = params.toString();

    return paramsString;
}

// Função para salvar o estado das mini-cards abertas
function saveOpenMiniCardsState() {
    const openMiniCards = [];
    
    // Verificar se há mini-card de tarefas aberto
    const tarefasMiniCard = document.querySelector('.tarefas-mini-card');
    if (tarefasMiniCard) {
        // Encontrar o cliente ID baseado na posição da mini-card
        const tarefasArrows = document.querySelectorAll('.tarefas-expand-btn, .tarefas-arrow');
        for (let arrow of tarefasArrows) {
            const clientCard = arrow.closest('[data-client-id]');
            if (clientCard) {
                const clienteId = clientCard.getAttribute('data-client-id');
                openMiniCards.push({
                    type: 'tarefas',
                    clienteId: clienteId
                });
                break;
            }
        }
    }
    
    // Verificar se há mini-card de colaboradores aberto
    // Colaboradores desativados: não salvar estado de mini-card de colaboradores
    const colaboradoresMiniCard = document.querySelector('.colaboradores-mini-card');
    if (colaboradoresMiniCard) {
        colaboradoresMiniCard.remove();
    }
    

    return openMiniCards;
}

// Função para restaurar o estado das mini-cards abertas
function restoreOpenMiniCardsState(openMiniCards) {
    if (!openMiniCards || openMiniCards.length === 0) {

        return;
    }
    

    
    openMiniCards.forEach(miniCard => {
        if (miniCard.type === 'tarefas') {
            // Reabrir mini-card de tarefas
            toggleTarefasDetails(miniCard.clienteId);
        } else if (miniCard.type === 'colaboradores') {
            // Colaboradores desativados: não reabrir mini-card
            console.log('👥 Mini-card de colaboradores desativado; ignorando restauração.');
        }
    });
}

// Adicionar estilos CSS para o mini card
if (!document.getElementById('colaboradores-mini-card-styles')) {
    const style = document.createElement('style');
    style.id = 'colaboradores-mini-card-styles';
    style.textContent = `
        .colaboradores-arrow, .tarefas-arrow, .produtos-arrow, .faturamento-arrow {
            margin-left: 8px;
            color: #007bff;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            padding: 2px 6px;
            border-radius: 3px;
            transition: all 0.2s ease;
        }
        
        .colaboradores-arrow:hover, .tarefas-arrow:hover, .produtos-arrow:hover, .faturamento-arrow:hover {
            background-color: #007bff;
            color: white;
        }
        
        .colaboradores-mini-card, .tarefas-mini-card, .produtos-mini-card, .faturamento-mini-card {
            position: absolute;
            background: white;
            border: 1px solid #e0e6ed;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08);
            min-width: 260px;
            max-width: 400px;
            width: auto;
            z-index: 1000;
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }
        
        .colaboradores-mini-card.show, .tarefas-mini-card.show, .produtos-mini-card.show, .faturamento-mini-card.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        
        .colaboradores-mini-card.hide, .tarefas-mini-card.hide, .produtos-mini-card.hide, .faturamento-mini-card.hide {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
        }
        
        .mini-card-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            cursor: pointer;
            color: #6c757d;
            font-size: 14px;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            z-index: 1001;
        }
        
        .mini-card-close:hover {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
            transform: scale(1.1);
        }
        
        .mini-card-content {
            padding: 16px 20px;
            padding-top: 20px;
            max-height: 280px;
            overflow-y: auto;
        }
        
        .mini-card-content::-webkit-scrollbar {
            width: 4px;
        }
        
        .mini-card-content::-webkit-scrollbar-track {
            background: #f1f3f4;
            border-radius: 2px;
        }
        
        .mini-card-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 2px;
        }
        
        .mini-card-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
        
        .colaborador-item {
            display: flex;
            flex-direction: column;
            padding: 10px 0;
            border-bottom: 1px solid #f8f9fa;
            transition: all 0.2s ease;
            border-radius: 6px;
        }
        
        .colaborador-item:last-child {
            border-bottom: none;
        }
        
        .colaborador-item:hover {
            background: rgba(0,123,255,0.05);
            padding-left: 8px;
            padding-right: 8px;
        }
        
        .colaborador-header {
            display: flex;
            align-items: center;
            width: 100%;
        }
        
        .colaborador-expand-arrow {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
            color: #007bff;
            margin-left: auto;
        }
        
        .colaborador-expand-arrow:hover {
            background: #e3f2fd;
            transform: scale(1.1);
        }
        
        .colaborador-expand-arrow i {
            font-size: 12px;
            transition: transform 0.2s ease;
        }
        
        .colaborador-tarefas-container {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            display: none;
        }
        
        .loading-tarefas {
            text-align: center;
            padding: 15px;
            color: #666;
            font-size: 14px;
        }
        
        .loading-tarefas i {
            margin-right: 8px;
            color: #007bff;
        }
        
        .no-tarefas-colaborador {
            text-align: center;
            padding: 15px;
            color: #999;
            font-size: 13px;
            font-style: italic;
        }
        
        .colaborador-tarefas-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .colaborador-tarefa-item {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin-bottom: 8px;
            padding: 10px;
            transition: all 0.2s ease;
        }
        
        .colaborador-tarefa-item:hover {
            border-color: #007bff;
            box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
        }
        
        .colaborador-tarefa-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .colaborador-tarefa-header i {
            color: #007bff;
            font-size: 14px;
        }
        
        .colaborador-tarefa-nome {
            font-weight: 600;
            color: #333;
            flex: 1;
            font-size: 13px;
        }
        
        .colaborador-tarefa-id {
            background: #e3f2fd;
            color: #1976d2;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
        }
        
        /* Estilos para o card lateral de tarefas do colaborador */
        .colaborador-tarefas-lateral-card {
            position: absolute;
            background: white;
            border: 1px solid #e0e6ed;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
            z-index: 1001;
            width: 300px;
            max-width: calc(100vw - 40px);
            height: 280px;
            max-height: 280px;
            overflow: hidden;
            opacity: 0;
            transform: translateX(-20px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }
        
        .colaborador-tarefas-lateral-card.show {
            opacity: 1;
            transform: translateX(0) scale(1);
        }
        
        .lateral-card-header {
            background: #f8f9fa;
            color: #495057;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px 8px 0 0;
            border-bottom: 1px solid #e9ecef;
            position: relative;
        }
        
        .lateral-card-header h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 400;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .close-lateral-card {
            background: none;
            border: none;
            color: #6c757d;
            font-size: 18px;
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
        }
        
        .close-lateral-card:hover {
            background-color: #f8f9fa;
            color: #495057;
            transform: scale(1.1);
        }
        
        .lateral-card-content {
            padding: 0;
            height: calc(280px - 60px);
            max-height: calc(280px - 60px);
            overflow-y: auto;
        }
        
        .lateral-card-content::-webkit-scrollbar {
            width: 6px;
        }
        
        .lateral-card-content::-webkit-scrollbar-track {
            background: #f1f3f4;
            border-radius: 3px;
        }
        
        .lateral-card-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        .lateral-card-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
        
        .colaborador-tarefas-list-lateral {
            padding: 0;
        }
        
        .colaborador-tarefa-item-lateral {
            padding: 10px 12px;
            border-bottom: 1px solid #f0f2f5;
            transition: all 0.2s ease;
            position: relative;
        }
        
        .colaborador-tarefa-item-lateral:hover {
            background-color: #f8f9fa;
            border-left: 3px solid #007bff;
            padding-left: 9px;
        }
        
        .colaborador-tarefa-item-lateral:last-child {
            border-bottom: none;
        }
        
        .colaborador-tarefa-header-lateral {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }
        
        .tarefa-title-section {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
        }
        
        .tarefa-title-section i {
            color: #007bff;
            font-size: 14px;
            flex-shrink: 0;
        }
        
        .colaborador-tarefa-nome {
            font-weight: 500;
            color: #2d3748;
            font-size: 13px;
            line-height: 1.3;
            flex: 1;
        }
        
        .colaborador-tarefa-id {
            background: linear-gradient(135deg, #e2e8f0, #cbd5e0);
            color: #4a5568;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            margin-left: 4px;
        }
        
        .colaborador-tarefa-redirect-btn-lateral {
            background: #007bff;
            color: white;
            border: none;
            padding: 6px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s ease;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0, 123, 255, 0.3);
        }
        
        .colaborador-tarefa-redirect-btn-lateral:hover {
            background: #0056b3;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 123, 255, 0.4);
        }
        
        .colaborador-tarefa-details-lateral {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .colaborador-tempo-item-lateral {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #4a5568;
            background: #f8f9fa;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
        }
        
        .colaborador-tempo-item-lateral:hover {
            background: #e9ecef;
            transform: translateY(-1px);
        }
        
        .colaborador-tempo-item-lateral i {
            color: #007bff;
            font-size: 10px;
        }
        
        .no-tarefas-colaborador-lateral {
            padding: 40px 20px;
            text-align: center;
            color: #718096;
            font-style: italic;
            font-size: 14px;
        }
        
        .loading-tarefas {
            padding: 40px 20px;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        
        .loading-tarefas i {
            margin-right: 8px;
            color: #007bff;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Responsividade para o card lateral */
        @media (max-width: 768px) {
            .colaborador-tarefas-lateral-card {
                width: 280px;
                max-width: calc(100vw - 20px);
                max-height: calc(100vh - 20px);
            }
            
            .lateral-card-header {
                padding: 10px 12px;
            }
            
            .lateral-card-header h4 {
                font-size: 13px;
            }
            
            .colaborador-tarefa-item-lateral {
                padding: 8px 10px;
            }
            
            .colaborador-tarefa-details-lateral {
                flex-direction: column;
                gap: 4px;
            }
            
            .colaborador-tempo-item-lateral {
                font-size: 10px;
                padding: 3px 5px;
            }
        }
        
        @media (max-width: 480px) {
            .colaborador-tarefas-lateral-card {
                width: 260px;
                max-width: calc(100vw - 10px);
                max-height: calc(100vh - 10px);
            }
            
            .lateral-card-header {
                padding: 8px 10px;
            }
            
            .lateral-card-header h4 {
                font-size: 12px;
            }
            
            .colaborador-tarefa-item-lateral {
                padding: 6px 8px;
            }
            
            .colaborador-tarefa-nome {
                font-size: 12px;
            }
            
            .colaborador-tarefa-id {
                font-size: 9px;
                padding: 1px 4px;
            }
        }
            font-weight: 600;
        }
        
        .colaborador-tarefa-redirect-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            transition: all 0.2s ease;
        }
        
        .colaborador-tarefa-redirect-btn:hover {
            background: #0056b3;
            transform: scale(1.05);
        }

        /* Botões de expandir registros */
        .colaborador-tarefa-expand-btn,
        .colaborador-tarefa-expand-btn-lateral,
        .tarefas-expand-btn {
            background: #f1f3f5;
            color: #495057;
            border: 1px solid #dee2e6;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            margin-left: 6px;
            transition: all 0.2s ease;
        }
        .colaborador-tarefa-expand-btn:hover,
        .colaborador-tarefa-expand-btn-lateral:hover,
        .tarefas-expand-btn:hover {
            background: #e9ecef;
            transform: scale(1.02);
        }

        /* Container e itens dos registros */
        .colaborador-tarefa-registros,
        .colaborador-tarefa-registros-lateral {
            margin-top: 8px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .registros-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        /* Indentação suave para registros dentro de cada usuário */
        .usuario-item .registros-list {
            margin-left: 18px;
            margin-top: 6px;
        }
        .registro-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
        }
        .registro-icon {
            color: #6c757d;
        }
        .registro-tempo-pill {
            background: #e7f1ff;
            color: #0b5ed7;
            border: 1px solid #cfe2ff;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
        }
        .registro-data {
            color: #6c757d;
            font-size: 12px;
        }
        .registro-inicio {
            color: #495057;
            font-size: 12px;
        }
        .registro-duracao {
            color: #007bff;
            font-weight: 600;
            font-size: 12px;
        }
        .registro-vazio {
            color: #6c757d;
            font-style: italic;
            font-size: 12px;
        }
        .registro-erro {
            color: #dc3545;
            font-size: 12px;
        }
        /* Cabeçalho e estilo do bloco por usuário */
        .usuario-header {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .usuario-icon { color: #0d6efd; }
        .usuario-tempo-pill {
            margin-left: auto;
            background: #f1f3f5;
            color: #495057;
            border: 1px solid #dee2e6;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
        }
        .usuario-item { padding: 6px 0; border-bottom: 1px dashed #e9ecef; }
        .usuario-item:last-child { border-bottom: none; }
        .usuario-toggle-btn, .usuarios-toggle-btn {
            background: #f1f3f5;
            color: #495057;
            border: 1px solid #dee2e6;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .usuario-toggle-btn:hover, .usuarios-toggle-btn:hover { background: #e9ecef; }
        
        .colaborador-tarefa-details {
            display: flex;
            gap: 15px;
            font-size: 12px;
        }
        
        .colaborador-tempo-item {
            display: flex;
            align-items: center;
            gap: 4px;
            color: #666;
        }
        
        .colaborador-tempo-item i {
            color: #28a745;
            font-size: 11px;
        }
        
        .colaborador-item i {
            color: #007bff;
            margin-right: 12px;
            font-size: 14px;
            width: 16px;
            text-align: center;
            flex-shrink: 0;
        }
        
        .colaborador-info {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        
        .colaborador-nome {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        /* Quadradinho de Realizadas para colaborador */
        .colaborador-realizadas-card {
            margin-top: 6px;
            padding: 8px 10px;
            border-radius: 6px;
            background: rgba(253, 126, 20, 0.1);
            color: #fd7e14;
            display: inline-block;
        }
        .colaborador-realizadas-card .realizadas-top {
            font-size: 12px;
            font-weight: 600;
            line-height: 1.2;
        }
        .colaborador-realizadas-card .colaborador-custo-realizado {
            display: block;
            margin-top: 2px;
            font-size: 11px;
            font-weight: 500;
        }
        
        .colaborador-horas-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 8px;
            margin-top: 4px;
        }
        
        .hora-item {
            font-size: 11px;
            color: #6c757d;
            font-weight: 400;
            padding: 4px 6px;
            background: #f8f9fa;
            border-radius: 3px;
            text-align: center;
            line-height: 1.3;
        }
        
        .hora-item small {
            font-size: 10px;
            opacity: 0.8;
            display: block;
            margin-top: 2px;
        }
        
        .hora-item:nth-child(1) { /* Estimadas */
            color: #007bff;
            background: rgba(0, 123, 255, 0.1);
        }
        
        .hora-item:nth-child(2) { /* Realizadas */
            color: #fd7e14;
            background: rgba(253, 126, 20, 0.1);
        }
        
        .hora-item:nth-child(3), .hora-item.diferenca-item { /* Diferença */
            color: #17a2b8; /* azul esverdeado para destacar */
            background: rgba(23, 162, 184, 0.1);
        }
        
        /* Estados opcionais, se quiser diferenciar por sinal */
        .hora-item.diferenca-item.positivo { color: #28a745; background: rgba(40,167,69,0.1); }
        .hora-item.diferenca-item.negativo { color: #dc3545; background: rgba(220,53,69,0.1); }
        .hora-item.diferenca-item.neutro { color: #0d6efd; background: rgba(13,110,253,0.12); }
        
        .no-colaboradores, .no-tarefas, .no-produtos {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            font-size: 14px;
            padding: 24px 0;
        }
        
        .produto-item {
            padding: 12px 0;
            border-bottom: 1px solid #f8f9fa;
            transition: all 0.2s ease;
            border-radius: 6px;
            display: flex;
            align-items: center;
        }
        
        .produto-item:last-child {
            border-bottom: none;
        }
        
        .produto-item:hover {
            background: rgba(0,123,255,0.05);
        }
        
        .produto-item i {
            color: #28a745;
            margin-right: 10px;
            font-size: 14px;
            width: 16px;
            text-align: center;
        }
        
        .produto-nome {
            font-size: 14px;
            color: #495057;
            font-weight: 500;
            flex: 1;
        }
        
        .tarefa-item {
            padding: 12px 0;
            border-bottom: 1px solid #f8f9fa;
            transition: all 0.2s ease;
            border-radius: 6px;
        }
        
        .tarefa-item:last-child {
            border-bottom: none;
        }
        
        .tarefa-item:hover {
            background: rgba(0,123,255,0.05);
        }
        
        .tarefa-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .tarefa-header i {
            color: #28a745;
            margin-right: 10px;
            font-size: 14px;
            width: 16px;
            text-align: center;
        }
        
        .tarefa-nome {
            font-size: 14px;
            color: #495057;
            font-weight: 600;
            flex: 1;
        }
        
        .tarefa-id {
            font-size: 12px;
            color: #6c757d;
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
            margin-left: 8px;
        }
        
        .tarefa-redirect-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #007bff;
            font-size: 12px;
            padding: 4px 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            min-width: 24px;
            height: 20px;
        }
        
        .tarefa-redirect-btn:hover {
            background: rgba(0, 123, 255, 0.1);
            color: #0056b3;
            transform: scale(1.1);
        }
        
        .tarefa-redirect-btn i {
            font-size: 10px;
        }
        
        /* Botão de expandir dentro do mini-card da tarefa */
        .tarefa-expand-btn {
            background: #f1f3f5;
            color: #495057;
            border: 1px solid #dee2e6;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            margin-left: 6px;
            transition: all 0.2s ease;
        }
        .tarefa-expand-btn:hover {
            background: #e9ecef;
            transform: scale(1.02);
        }
        }
        
        .tarefa-details {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-left: 26px;
        }
        
        .tempo-item {
            display: flex;
            align-items: center;
            font-size: 13px;
            color: #6c757d;
        }
        
        .tempo-item i {
            margin-right: 8px;
            width: 14px;
            text-align: center;
            font-size: 12px;
        }
        
        .tempo-item:first-child i {
            color: #007bff;
        }
        
        .tempo-item:last-child i {
            color: #fd7e14;
        }
        
        /* Responsividade para diferentes tamanhos de tela */
        @media (max-width: 768px) {
            .tarefas-mini-card, .produtos-mini-card {
                min-width: 240px;
                max-width: calc(100vw - 40px);
                margin: 10px;
            }
            
            .mini-card-content {
                padding: 14px 16px;
                padding-top: 18px;
                max-height: 220px;
            }
        }
        
        @media (max-width: 480px) {
            .tarefas-mini-card, .produtos-mini-card {
                min-width: 200px;
                max-width: calc(100vw - 20px);
                margin: 10px;
            }
            
            .mini-card-content {
                padding: 12px 14px;
                padding-top: 16px;
                max-height: 180px;
            }
        }
    `;
    document.head.appendChild(style);
}

// Função para controlar a visibilidade do container dos cards
function updateTotalCardsContainer() {
    const totalCardsContainer = document.getElementById('totalCardsContainer');
    if (!totalCardsContainer) return;
    
    // Verificar se há filtros ativos
    const hasActiveFilters = checkIfFiltersActive();
    
    if (hasActiveFilters) {
        totalCardsContainer.style.display = 'flex';
    } else {
        totalCardsContainer.style.display = 'none';
    }
}

// Função para atualizar contador de clientes
function updateClientsCount() {
    const clientsCountCard = document.getElementById('clientsCountCard');
    const clientCards = document.querySelectorAll('.client-card');
    
    // Contar apenas os clientes destacados (com classe 'client-highlighted')
    const highlightedCards = Array.from(clientCards).filter(card => {
        const style = window.getComputedStyle(card);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        const isHighlighted = card.classList.contains('client-highlighted');
        return isVisible && isHighlighted;
    });
    
    const count = highlightedCards.length;
    const countText = document.getElementById('clientsCountText');
    
    if (clientsCountCard && countText) {
        // Verificar se há filtros ativos
        const hasActiveFilters = checkIfFiltersActive();
        
        if (hasActiveFilters && count > 0) {
            countText.textContent = `Clientes: ${count}`;
            clientsCountCard.style.display = 'flex';
        } else {
            clientsCountCard.style.display = 'none';
        }
    }
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
    
    // Atualizar card de diferença após finalizar horas estimadas
    setTimeout(() => {
        updateDifferenceCard();
    }, 100);
}

// Função para verificar se há filtros ativos
function checkIfFiltersActive() {
    // Verificar filtros de status
    const hasStatusFilter = (typeof window.getSelectedStatuses === 'function') ? 
        window.getSelectedStatuses().length > 0 : false;
    
    // Verificar filtros de cliente
    const hasClienteFilter = (typeof window.getSelectedClientes === 'function') ? 
        window.getSelectedClientes().length > 0 : false;
    
    // Verificar filtro de período
    const hasPeriodoFilter = selectedStartDate !== null || selectedEndDate !== null;
    
    // Verificar filtros de colaboradores
    const hasColaboradorFilter = (typeof exposedSelectedColaboradores !== 'undefined') ? 
        exposedSelectedColaboradores.length > 0 : false;
    
    return hasStatusFilter || hasClienteFilter || hasPeriodoFilter || hasColaboradorFilter;
}

// ===== NOVA LÓGICA DO CARD DE TOTAL DE TAREFAS =====
// Sistema completamente reescrito para monitorar apenas clientes filtrados

// Variável global para controlar o monitoramento do card de total de tarefas
let totalTasksCardMonitor = {
    isMonitoring: false,
    intervalId: null,
    filteredClientIds: [],
    loadedClients: new Set()
};

// Função principal para gerenciar o card de total de tarefas
function updateTasksCount() {
    
    const tasksCountCard = document.getElementById('tasksCountCard');
    const tasksCountText = document.getElementById('tasksCountText');
    
    if (!tasksCountCard || !tasksCountText) {
        console.warn('📊 Elementos do card de tarefas não encontrados');
        return;
    }
    
    // Verificar se há filtros ativos - CORREÇÃO: verificar também as variáveis globais de período
    const hasActiveFilters = checkIfFiltersActive();
    const hasPeriodFilterGlobal = selectedStartDate !== null || selectedEndDate !== null;
    

    
    if (!hasActiveFilters && !hasPeriodFilterGlobal) {
        // Se não há filtros, ocultar o card
        tasksCountCard.style.display = 'none';

        return;
    }
    
    // Obter clientes filtrados/destacados
    const filteredClients = getFilteredClients();
    
    if (filteredClients.length === 0) {
        // Se não há clientes filtrados, ocultar o card
        tasksCountCard.style.display = 'none';

        return;
    }
    
    // Mostrar o card com "Carregando tarefas..."
    tasksCountCard.style.display = 'flex';
    tasksCountText.textContent = 'Carregando tarefas...';

    
    // Iniciar monitoramento dos clientes filtrados
     startTotalTasksMonitoring(filteredClients);
 }

// Função para obter clientes filtrados/destacados
function getFilteredClients() {
    const clientCards = document.querySelectorAll('.client-card');
    const filteredClients = [];
    
    clientCards.forEach(card => {
        const style = window.getComputedStyle(card);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        const isHighlighted = card.classList.contains('client-highlighted');
        
        if (isVisible && isHighlighted) {
            const clientId = card.getAttribute('data-client-id');
            if (clientId) {
                filteredClients.push({
                    id: clientId,
                    card: card
                });
            }
        }
    });
    

    return filteredClients;
}

// Função para iniciar monitoramento de carregamento de tarefas (alias para compatibilidade)
function startTaskLoadingMonitor(clientes) {

    // Redirecionar para a função principal de monitoramento
    startTotalTasksMonitoring(clientes);
}

// Função para iniciar monitoramento dos clientes filtrados
function startTotalTasksMonitoring(filteredClients) {

    
    // Parar monitoramento anterior se existir
    if (totalTasksCardMonitor.intervalId) {
        clearInterval(totalTasksCardMonitor.intervalId);
    }
    
    // Configurar novo monitoramento
    totalTasksCardMonitor.isMonitoring = true;
    totalTasksCardMonitor.filteredClientIds = filteredClients.map(c => c.id);
    totalTasksCardMonitor.loadedClients = new Set();

    // Pré-carregar detalhes de tarefas no cache para clientes filtrados (com filtros atuais)
    try {
        filteredClients.forEach(c => {
            const cached = clienteTarefasCarregadas.get(c.id);
            if (!cached) {
                loadTarefasParaCache(c.id, true).catch(() => {});
            }
        });
    } catch (e) {
        // Silenciar erros de prefetch para não interromper monitoramento
    }
    
    // Verificar a cada 300ms se todas as tarefas dos clientes filtrados carregaram (via cache)
    totalTasksCardMonitor.intervalId = setInterval(() => {
        checkFilteredClientsTasksLoaded();
    }, 300);
    
    // Timeout de segurança para parar o monitoramento após 20 segundos
    setTimeout(() => {
        if (totalTasksCardMonitor.isMonitoring) {

            finalizeTotalTasksCount();
        }
    }, 20000);
}

// Função para verificar se todas as tarefas dos clientes filtrados carregaram
function checkFilteredClientsTasksLoaded() {
    const filteredClients = getFilteredClients();
    let allLoaded = true;
    
    filteredClients.forEach(client => {
        // Considerar carregado quando existir cache de tarefas (mesmo que vazio)
        const hasCache = clienteTarefasCarregadas.has(client.id);
        if (!hasCache) {
            allLoaded = false;
        } else {
            totalTasksCardMonitor.loadedClients.add(client.id);
        }
    });
    

    
    // Se todos os clientes filtrados carregaram suas tarefas
    if (allLoaded && filteredClients.length > 0) {

        finalizeTotalTasksCount();
    }
}

// Função para finalizar o monitoramento e exibir o total final
function finalizeTotalTasksCount() {
    // Parar monitoramento
    if (totalTasksCardMonitor.intervalId) {
        clearInterval(totalTasksCardMonitor.intervalId);
        totalTasksCardMonitor.intervalId = null;
    }
    totalTasksCardMonitor.isMonitoring = false;
    
    // Calcular total final deduplicando por ID de tarefa
    const filteredClients = getFilteredClients();
    const uniqueTaskIds = new Set();
    const allTaskIdsRaw = [];
    const taskIdToClients = new Map();
    const fallbackClientsMissingCache = [];
    
    filteredClients.forEach(client => {
        const hasCache = clienteTarefasCarregadas.has(client.id);
        const tarefas = clienteTarefasCarregadas.get(client.id) || [];
        // Se ainda não há cache, tentar fallback para o número exibido no card
        if (!hasCache) {
            const tarefasValueElement = client.card.querySelector('.tarefas-value');
            if (tarefasValueElement) {
                const taskText = tarefasValueElement.textContent || '0';
                const taskNumber = parseInt(taskText.replace(/\D/g, '')) || 0;
                // Fallback: adicionar N elementos fictícios distintos para não mostrar 0
                for (let i = 0; i < taskNumber; i++) {
                    uniqueTaskIds.add(`fallback-${client.id}-${i}`);
                }
            }
            fallbackClientsMissingCache.push(client.id);
            return; // seguir para próximo cliente
        }
        tarefas.forEach(t => {
            if (t && t.id !== undefined && t.id !== null) {
                allTaskIdsRaw.push(t.id);
                uniqueTaskIds.add(t.id);
                if (!taskIdToClients.has(t.id)) {
                    taskIdToClients.set(t.id, new Set());
                }
                taskIdToClients.get(t.id).add(client.id);
            }
        });
    });
    
    const totalTasks = uniqueTaskIds.size;

    // DEBUG: Logar IDs de tarefas e clientes quando colaborador 82167848 estiver filtrado
    try {
        let selectedColabs = [];
        if (typeof activeColaboradorFilters !== 'undefined' && Array.isArray(activeColaboradorFilters) && activeColaboradorFilters.length > 0) {
            selectedColabs = [...new Set(activeColaboradorFilters.map(id => id.toString()))];
        }
        if (selectedColabs.length === 0 && typeof getSelectedColaboradores === 'function') {
            const selected = getSelectedColaboradores();
            if (Array.isArray(selected) && selected.length > 0) {
                selectedColabs = [...new Set(selected.map(id => id.toString()))];
            }
        }
        if (selectedColabs.length === 0 && Array.isArray(activeFilters)) {
            const colaboradorFilters = activeFilters.filter(f => f.type === 'colaborador' && Array.isArray(f.colaboradores));
            const allIds = [];
            colaboradorFilters.forEach(filter => { allIds.push(...filter.colaboradores); });
            selectedColabs = [...new Set(allIds.map(id => id.toString()))];
        }
        if (selectedColabs.length === 1 && selectedColabs[0] === '82167848') {
            const taskIdToClientsObj = {};
            taskIdToClients.forEach((set, taskId) => { taskIdToClientsObj[taskId] = Array.from(set); });
            console.group('🧪 DEBUG Tarefas totais para colaborador 82167848');
            console.log('Clientes filtrados:', filteredClients.map(c => c.id));
            console.log('IDs de tarefas (raw, com duplicatas):', allTaskIdsRaw);
            console.log('Total antes da deduplicação:', allTaskIdsRaw.length);
            console.log('IDs de tarefas únicos:', Array.from(uniqueTaskIds));
            console.log('Total após deduplicação:', totalTasks);
            console.log('Mapa Tarefa -> Clientes:', taskIdToClientsObj);
            if (fallbackClientsMissingCache.length > 0) {
                console.warn('Clientes sem cache, fallback aplicado (IDs reais não disponíveis):', fallbackClientsMissingCache);
            }
            console.groupEnd();
        }
    } catch (e) {
        // não interromper fluxo por erro de logging
    }
    
    // Atualizar o card com o total final
    const tasksCountText = document.getElementById('tasksCountText');
    if (tasksCountText) {
        tasksCountText.textContent = `Tarefas: ${totalTasks}`;
    }
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
}

// ===== NOVA LÓGICA DO CARD DE TOTAL DE HORAS ESTIMADAS =====
// Sistema completamente reescrito para monitorar apenas clientes filtrados

// Variável global para controlar o monitoramento do card de total de horas estimadas
let totalEstimatedHoursCardMonitor = {
    isMonitoring: false,
    intervalId: null,
    filteredClientIds: [],
    loadedClients: new Set()
};

// Função principal para gerenciar o card de total de horas estimadas
function updateEstimatedHoursCount() {
    // INATIVO: esconder card de estimados e cancelar monitoramento
    const estimatedHoursCountCard = document.getElementById('estimatedHoursCountCard');
    if (estimatedHoursCountCard) {
        estimatedHoursCountCard.style.display = 'none';
    }
    if (totalEstimatedHoursCardMonitor && totalEstimatedHoursCardMonitor.intervalId) {
        clearInterval(totalEstimatedHoursCardMonitor.intervalId);
        totalEstimatedHoursCardMonitor.intervalId = null;
    }
    if (totalEstimatedHoursCardMonitor) {
        totalEstimatedHoursCardMonitor.isMonitoring = false;
        totalEstimatedHoursCardMonitor.filteredClientIds = [];
        totalEstimatedHoursCardMonitor.loadedClients = new Set();
    }
    return;
}

// Função para iniciar monitoramento dos clientes filtrados para horas estimadas
function startTotalEstimatedHoursMonitoring(filteredClients) {

    
    // Parar monitoramento anterior se existir
    if (totalEstimatedHoursCardMonitor.intervalId) {
        clearInterval(totalEstimatedHoursCardMonitor.intervalId);
    }
    
    // Configurar novo monitoramento
    totalEstimatedHoursCardMonitor.isMonitoring = true;
    totalEstimatedHoursCardMonitor.filteredClientIds = filteredClients.map(c => c.id);
    totalEstimatedHoursCardMonitor.loadedClients = new Set();
    
    // Verificar a cada 300ms se todas as horas estimadas dos clientes filtrados carregaram
    totalEstimatedHoursCardMonitor.intervalId = setInterval(() => {
        checkFilteredClientsEstimatedHoursLoaded();
    }, 300);
    
    // Timeout de segurança para parar o monitoramento após 20 segundos
    setTimeout(() => {
        if (totalEstimatedHoursCardMonitor.isMonitoring) {

            finalizeTotalEstimatedHoursCount();
        }
    }, 20000);
}

// Função para verificar se todas as horas estimadas dos clientes filtrados carregaram
function checkFilteredClientsEstimatedHoursLoaded() {
    const filteredClients = getFilteredClients();
    let allLoaded = true;
    let totalEstimatedHours = 0;
    let totalEstimatedCost = 0;
    
    filteredClients.forEach(client => {
        const horasEstimadasValueElement = client.card.querySelector('.horas-estimadas-value');
        const custoEstimadoValueElement = client.card.querySelector('.custo-estimado-value');
        
        if (horasEstimadasValueElement && custoEstimadoValueElement) {
            const hoursText = horasEstimadasValueElement.textContent || '0';
            const costText = custoEstimadoValueElement.textContent || 'R$ 0,00';
            
            // Verificar se ainda está carregando (contém "...")
            if (hoursText.includes('...') || costText.includes('...')) {
                allLoaded = false;

            } else {
                // Cliente carregou, adicionar ao conjunto de carregados
                totalEstimatedHoursCardMonitor.loadedClients.add(client.id);
                const hoursNumber = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                const costNumber = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                totalEstimatedHours += hoursNumber;
                totalEstimatedCost += costNumber;

            }
        } else {
            allLoaded = false;
        }
    });
    

    
    // Se todos os clientes filtrados carregaram suas horas estimadas e custos
    if (allLoaded && filteredClients.length > 0) {

        finalizeTotalEstimatedHoursCount();
    }
}

// Função para finalizar o monitoramento e exibir o total final de horas estimadas
function finalizeTotalEstimatedHoursCount() {
    // Parar monitoramento
    if (totalEstimatedHoursCardMonitor.intervalId) {
        clearInterval(totalEstimatedHoursCardMonitor.intervalId);
        totalEstimatedHoursCardMonitor.intervalId = null;
    }
    totalEstimatedHoursCardMonitor.isMonitoring = false;
    
    // Calcular totais finais
    const filteredClients = getFilteredClients();
    let totalEstimatedHours = 0;
    let totalEstimatedCost = 0;
    
    filteredClients.forEach(client => {
        const horasEstimadasValueElement = client.card.querySelector('.horas-estimadas-value');
        const custoEstimadoValueElement = client.card.querySelector('.custo-estimado-value');
        
        if (horasEstimadasValueElement) {
            const hoursText = horasEstimadasValueElement.textContent || '0';
            const hoursNumber = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            totalEstimatedHours += hoursNumber;
        }
        
        if (custoEstimadoValueElement) {
            const costText = custoEstimadoValueElement.textContent || 'R$ 0,00';
            const costNumber = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            totalEstimatedCost += costNumber;
        }
    });
    
    // Atualizar o card com os totais finais
    const estimatedHoursCountText = document.getElementById('estimatedHoursCountText');
    const estimatedCostCountText = document.getElementById('estimatedCostCountText');
    
    if (estimatedHoursCountText) {
        estimatedHoursCountText.textContent = `Hrs Estimadas: ${totalEstimatedHours.toFixed(2)}`;

    }
    
    if (estimatedCostCountText) {
        estimatedCostCountText.textContent = `Custo: R$ ${totalEstimatedCost.toFixed(2).replace('.', ',')}`;

    }
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
}

// Carregar faturamento de forma assíncrona (em lotes)
async function loadFaturamentoAsync(clientes) {
    
    const BATCH_SIZE = 10; // Processar 10 clientes por vez
    const DELAY_BETWEEN_BATCHES = 100; // 100ms de delay entre lotes
    
    // Obter período selecionado para filtro por mês/ano
    const selectedPeriod = getSelectedPeriodo();
    let monthsInPeriod = [];
    
    if (selectedPeriod && selectedPeriod.startDate && selectedPeriod.endDate) {
        // Função para gerar lista de meses dentro do período
        function getMonthsInPeriod(startDate, endDate) {
            const months = [];
            const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            
            while (current <= end) {
                months.push({
                    month: current.getMonth() + 1, // getMonth() retorna 0-11, precisamos 1-12
                    year: current.getFullYear()
                });
                current.setMonth(current.getMonth() + 1);
            }
            
            return months;
        }
        
        monthsInPeriod = getMonthsInPeriod(selectedPeriod.startDate, selectedPeriod.endDate);
    } else if (selectedPeriod && selectedPeriod.startDate) {
        // Fallback para compatibilidade: se só tiver startDate, usar apenas esse mês
        const startDate = new Date(selectedPeriod.startDate);
        monthsInPeriod = [{
            month: startDate.getMonth() + 1,
            year: startDate.getFullYear()
        }];
    }
    
    for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE);
        
        // Processar lote atual
        const batchPromises = batch.map(async (cliente) => {
            try {
                // Usar o endpoint correto que já calcula faturamento
                const response = await fetch(`/api/clientes?clienteIds=${cliente.id}`);
                const data = await response.json();
                
                if (data && data.success && data.data && data.data.length > 0) {
                    const clienteData = data.data[0];
                    
                    // Nova estrutura: armazenar registros individuais
                    let registrosFaturamento = clienteData.faturamento_registros || [];
                    
                    // Aplicar filtro por mês/ano se período estiver selecionado
                    if (monthsInPeriod.length > 0) {
                        registrosFaturamento = registrosFaturamento.filter(registro => {
                            if (registro.data_solicitacao) {
                                const dataRegistro = new Date(registro.data_solicitacao);
                                const mesRegistro = dataRegistro.getMonth() + 1;
                                const anoRegistro = dataRegistro.getFullYear();
                                
                                // Verificar se o registro está em qualquer um dos meses do período
                                return monthsInPeriod.some(period => 
                                    mesRegistro === period.month && anoRegistro === period.year
                                );
                            }
                            return false;
                        });
                        
                        const periodosStr = monthsInPeriod.map(p => `${p.month}/${p.year}`).join(', ');
                    }
                    
                    cliente.faturamento_registros = registrosFaturamento;
                    cliente.faturamento_total_registros = registrosFaturamento.length;
                    cliente.faturamento_loaded = true;
                    
                    // Preparar dados para atualização do card
                    const updateData = {
                        faturamento_registros: cliente.faturamento_registros,
                        faturamento_total_registros: cliente.faturamento_total_registros,
                        faturamento_loaded: true
                    };
                    
                    // Atualizar card individual imediatamente
                    updateClientCard(cliente.id, updateData);
                } else {
                    console.warn(`Erro ao buscar faturamento para cliente ${cliente.nome}:`, data);
                    cliente.faturamento_registros = [];
                    cliente.faturamento_total_registros = 0;
                    cliente.faturamento_loaded = true;
                    updateClientCard(cliente.id, { 
                        faturamento_registros: [],
                        faturamento_total_registros: 0,
                        faturamento_loaded: true 
                    });
                }
            } catch (error) {
                console.error(`Erro ao buscar faturamento para cliente ${cliente.nome}:`, error);
                cliente.faturamento_registros = [];
                cliente.faturamento_total_registros = 0;
                cliente.faturamento_loaded = true;
                updateClientCard(cliente.id, { 
                    faturamento_registros: [],
                    faturamento_total_registros: 0,
                    faturamento_loaded: true 
                });
            }
        });
        
        // Aguardar lote atual
        await Promise.all(batchPromises);
        
        // Pequeno delay antes do próximo lote (exceto no último)
        if (i + BATCH_SIZE < clientes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        
    }
}

// Teste manual das funções de contagem
setTimeout(() => {
    updateClientsCount();
}, 2000);

setTimeout(() => {
    updateTasksCount();
}, 2500);

// ===== NOVA LÓGICA DO CARD DE TOTAL DE HORAS REALIZADAS =====
// Sistema completamente reescrito para monitorar apenas clientes filtrados

// Variável global para controlar o monitoramento do card de total de horas realizadas
let totalRealizedHoursCardMonitor = {
    isMonitoring: false,
    intervalId: null,
    filteredClientIds: [],
    loadedClients: new Set()
};

// Função principal para gerenciar o card de total de horas realizadas
function updateRealizedHoursCount() {
    
    const realizedHoursCountCard = document.getElementById('realizedHoursCountCard');
    const realizedHoursCountText = document.getElementById('realizedHoursCountText');
    const realizedCostCountText = document.getElementById('realizedCostCountText');
    
    if (!realizedHoursCountCard || !realizedHoursCountText || !realizedCostCountText) {
        console.warn('⏰ Elementos do card de horas realizadas não encontrados');
        return;
    }
    
    // Verificar se há filtros ativos - CORREÇÃO: verificar também as variáveis globais de período
    const hasActiveFilters = checkIfFiltersActive();
    const hasPeriodFilterGlobal = selectedStartDate !== null || selectedEndDate !== null;
    

    
    if (!hasActiveFilters && !hasPeriodFilterGlobal) {
        // Se não há filtros, ocultar o card
        realizedHoursCountCard.style.display = 'none';

        return;
    }
    
    // NOVA LÓGICA: se houver filtro de colaborador, ignorar outros filtros e calcular direto pelo usuario_id
    if (activeColaboradorFilters && activeColaboradorFilters.length > 0) {
        const start = (typeof window !== 'undefined' && window.selectedStartDate) ? window.selectedStartDate : selectedStartDate;
        const end = (typeof window !== 'undefined' && window.selectedEndDate) ? window.selectedEndDate : selectedEndDate;
        realizedHoursCountCard.style.display = 'flex';
        realizedHoursCountText.textContent = 'Carregando...';
        realizedCostCountText.textContent = 'Custo: R$ 0,00';
        const filteredClients = getFilteredClients();
        (async () => {
            try {
                if (start && end) {
                    // Colaborador + período: se há clientes filtrados, somar pelas APIs por cliente; senão, usar período global
                    const totalHoras = (filteredClients && filteredClients.length > 0)
                        ? await computeTotalRealizedHoursViaAPI(filteredClients)
                        : await computeTotalRealizedHoursByColaboradorPeriodo(start, end);
                    realizedHoursCountText.textContent = `Hrs Realizadas (período): ${totalHoras.toFixed(2)}`;
                    // Iniciar monitoramento para sincronizar com valores exibidos nos cards
                    startTotalRealizedHoursMonitoring(filteredClients);
                } else {
                    // Apenas colaborador: manter lógica atual
                    const totalHoras = await computeTotalRealizedHoursByColaboradorOnly();
                    realizedHoursCountText.textContent = `Hrs Realizadas: ${totalHoras.toFixed(2)}`;
                }
                realizedCostCountText.textContent = `Custo: R$ 0,00`;
                updateTotalCardsContainer();
                setTimeout(() => { updateDifferenceCard(); }, 100);
            } catch (e) {
                realizedHoursCountText.textContent = 'Hrs Realizadas: 0.00';
                realizedCostCountText.textContent = `Custo: R$ 0,00`;
            }
        })();
        return;
    }

    // Obter clientes filtrados/destacados
    const filteredClients = getFilteredClients();
    
    if (filteredClients.length === 0) {
        // Se não há clientes filtrados, ocultar o card
        realizedHoursCountCard.style.display = 'none';

        return;
    }
    
    // Mostrar o card com "Carregando..."
    realizedHoursCountCard.style.display = 'flex';
    realizedHoursCountText.textContent = 'Carregando...';
    realizedCostCountText.textContent = 'Custo: Carregando...';

    // Se houver período, podemos calcular direto via API sem esperar monitoramento
    const start = (typeof window !== 'undefined' && window.selectedStartDate) ? window.selectedStartDate : selectedStartDate;
    const end = (typeof window !== 'undefined' && window.selectedEndDate) ? window.selectedEndDate : selectedEndDate;
    if (start && end) {
        (async () => {
            const totalRealizedHours = await computeTotalRealizedHoursViaAPI(filteredClients);
            realizedHoursCountText.textContent = `Hrs Realizadas (período): ${totalRealizedHours.toFixed(2)}`;
            // custo permanece vindo do monitoramento por cliente
            startTotalRealizedHoursMonitoring(filteredClients);
        })();
        return;
    }
    
    // Iniciar monitoramento dos clientes filtrados
    startTotalRealizedHoursMonitoring(filteredClients);
}

// Função para iniciar monitoramento dos clientes filtrados para horas realizadas
function startTotalRealizedHoursMonitoring(filteredClients) {

    
    // Parar monitoramento anterior se existir
    if (totalRealizedHoursCardMonitor.intervalId) {
        clearInterval(totalRealizedHoursCardMonitor.intervalId);
    }
    
    // Configurar novo monitoramento
    totalRealizedHoursCardMonitor.isMonitoring = true;
    totalRealizedHoursCardMonitor.filteredClientIds = filteredClients.map(c => c.id);
    totalRealizedHoursCardMonitor.loadedClients = new Set();
    
    // Verificar a cada 300ms se todas as horas realizadas dos clientes filtrados carregaram
    totalRealizedHoursCardMonitor.intervalId = setInterval(() => {
        checkFilteredClientsRealizedHoursLoaded();
    }, 300);
    
    // Timeout de segurança para parar o monitoramento após 20 segundos
    setTimeout(() => {
        if (totalRealizedHoursCardMonitor.isMonitoring) {

            finalizeTotalRealizedHoursCount();
        }
    }, 20000);
}

// Função para verificar se todas as horas realizadas dos clientes filtrados carregaram
function checkFilteredClientsRealizedHoursLoaded() {
    const filteredClients = getFilteredClients();
    let allLoaded = true;
    let totalRealizedHours = 0;
    let totalRealizedCost = 0;
    
    filteredClients.forEach(client => {
        const horasRealizadasValueElement = client.card.querySelector('.horas-realizadas-value');
        const custoRealizadoValueElement = client.card.querySelector('.cost-loaded');
        
        if (horasRealizadasValueElement && custoRealizadoValueElement) {
            const hoursText = horasRealizadasValueElement.textContent || '0';
            const costText = custoRealizadoValueElement.textContent || 'R$ 0,00';
            
            // Verificar se ainda está carregando (contém "...")
            if (hoursText.includes('...') || costText.includes('...')) {
                allLoaded = false;

            } else {
                // Cliente carregou, adicionar ao conjunto de carregados
                totalRealizedHoursCardMonitor.loadedClients.add(client.id);
                const hoursNumber = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                const costNumber = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                totalRealizedHours += hoursNumber;
                totalRealizedCost += costNumber;

            }
        } else {
            allLoaded = false;
        }
    });
    

    
    // Se todos os clientes filtrados carregaram suas horas realizadas
    if (allLoaded && filteredClients.length > 0) {

        finalizeTotalRealizedHoursCount();
    }
}

// Função para finalizar o monitoramento e exibir o total final de horas realizadas
// Função utilitária para calcular total de horas realizadas via API nova
async function computeTotalRealizedHoursViaAPI(filteredClients) {
    try {
        if (!filteredClients || filteredClients.length === 0) return 0;

        const params = new URLSearchParams();
        if (activeColaboradorFilters && activeColaboradorFilters.length > 0) {
            params.append('colaboradorIds', activeColaboradorFilters.join(','));
        }
        const periodStart = (typeof window !== 'undefined' && window.selectedStartDate) ? window.selectedStartDate : selectedStartDate;
        const periodEnd = (typeof window !== 'undefined' && window.selectedEndDate) ? window.selectedEndDate : selectedEndDate;
        if (periodStart && periodEnd) {
            // Enviar como YYYY-MM-DD usando inicio/fim (novo padrão)
            const inicio = formatDateForAPI(periodStart);
            const fim = formatDateForAPI(periodEnd);
            params.append('inicio', inicio);
            params.append('fim', fim);
        }

        const requests = filteredClients.map(async (client) => {
            try {
                const url = `/api/tempo-realizado/${client.id}?${params.toString()}`;
                const resp = await fetch(url, { credentials: 'include' });
                if (!resp.ok) return 0;
                const json = await resp.json();
                if (!json || json.success !== true) return 0;
                return parseFloat(json.tempo_decimal) || 0;
            } catch (e) {
                return 0;
            }
        });

        const results = await Promise.all(requests);
        const total = results.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        return parseFloat(total.toFixed(2));
    } catch (error) {
        return 0;
    }
}

// Nova função: somar horas realizadas (global) por colaborador + período
async function computeTotalRealizedHoursByColaboradorPeriodo(start, end) {
    try {
        const params = new URLSearchParams();
        const inicio = formatDateForAPI(start);
        const fim = formatDateForAPI(end);
        params.append('inicio', inicio);
        params.append('fim', fim);
        if (activeColaboradorFilters && activeColaboradorFilters.length > 0) {
            params.append('colaboradorIds', activeColaboradorFilters.join(','));
        }
        const url = `/api/horas-realizadas-por-periodo?${params.toString()}`;
        const resp = await fetch(url, { credentials: 'include' });
        if (!resp.ok) return 0;
        const json = await resp.json();
        const total = parseFloat(json?.totalTempo) || 0;
        return parseFloat(total.toFixed(2));
    } catch (e) {
        return 0;
    }
}

// Nova função: somar horas realizadas direto da tabela registro_tempo, apenas por colaborador
async function computeTotalRealizedHoursByColaboradorOnly() {
    try {
        const ids = (activeColaboradorFilters && activeColaboradorFilters.length > 0)
            ? activeColaboradorFilters
            : (typeof getSelectedColaboradores === 'function' ? getSelectedColaboradores() : []);
        if (!ids || ids.length === 0) return 0;

        const requests = ids.map(async (id) => {
            try {
                const resp = await fetch(`/api/debug-colaborador-horas/${id}`, { credentials: 'include' });
                if (!resp.ok) return 0;
                const json = await resp.json();
                if (!json || json.success !== true) return 0;
                const horas = parseFloat(json?.totais?.total_horas_decimal) || 0;
                return horas;
            } catch (e) {
                return 0;
            }
        });

        const results = await Promise.all(requests);
        const total = results.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        return parseFloat(total.toFixed(2));
    } catch (error) {
        console.error('❌ Erro ao calcular horas por colaborador:', error);
        return 0;
    }
}

// Função para finalizar o monitoramento e exibir o total final de horas realizadas
async function finalizeTotalRealizedHoursCount() {
    // Parar monitoramento
    if (totalRealizedHoursCardMonitor.intervalId) {
        clearInterval(totalRealizedHoursCardMonitor.intervalId);
        totalRealizedHoursCardMonitor.intervalId = null;
    }
    totalRealizedHoursCardMonitor.isMonitoring = false;
    
    // Calcular totais finais
    const filteredClients = getFilteredClients();
    let totalRealizedCost = 0;
    let totalRealizedHours = 0;
    
    filteredClients.forEach(client => {
        const custoRealizadoValueElement = client.card.querySelector('.cost-loaded');
        const horasRealizadasValueElement = client.card.querySelector('.hours-realized-loaded');
        // Somar custo agregado exibido no card
        if (custoRealizadoValueElement) {
            const costText = custoRealizadoValueElement.textContent || 'R$ 0,00';
            const costNumber = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            totalRealizedCost += costNumber;
        }
        // Somar horas realizadas exibidas no card
        if (horasRealizadasValueElement) {
            const hoursText = horasRealizadasValueElement.textContent || '0';
            const hoursNumber = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            totalRealizedHours += hoursNumber;
        } else {
            const horasContainer = client.card.querySelector('.horas-realizadas-value');
            if (horasContainer) {
                const raw = horasContainer.textContent || '0';
                const num = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                totalRealizedHours += num;
            }
        }
    });
    
    // Fallback: se não conseguiu somar pelas views, usar API
    if (!Number.isFinite(totalRealizedHours) || totalRealizedHours <= 0) {
        totalRealizedHours = await computeTotalRealizedHoursViaAPI(filteredClients);
    }
    
    // Atualizar o card com os totais finais
    const realizedHoursCountText = document.getElementById('realizedHoursCountText');
    const realizedCostCountText = document.getElementById('realizedCostCountText');
    
    if (realizedHoursCountText) {
        const hasPeriod = (typeof window !== 'undefined' && window.selectedStartDate) || selectedStartDate || (typeof window !== 'undefined' && window.selectedEndDate) || selectedEndDate;
        realizedHoursCountText.textContent = hasPeriod 
            ? `Hrs Realizadas (período): ${totalRealizedHours.toFixed(2)}`
            : `Hrs Realizadas: ${totalRealizedHours.toFixed(2)}`;
    }
    
    if (realizedCostCountText) {
        realizedCostCountText.textContent = `Custo: R$ ${totalRealizedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    }
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
    
    // Atualizar card de diferença após finalizar horas realizadas
    setTimeout(() => {
        updateDifferenceCard();
    }, 100);
}

// Teste manual da função updateEstimatedHoursCount
setTimeout(() => {
    updateEstimatedHoursCount();
}, 3000);

setTimeout(() => {
    updateRealizedHoursCount();
    // Não precisamos mais de updateGlobalPeriodHoursFromSelection como fonte principal do período
    // O próprio card de horas realizadas reflete o período quando selecionado
}, 3500);

// ===== NOVA LÓGICA DO CARD DE DIFERENÇA =====
// Sistema para calcular e exibir a diferença entre horas realizadas e estimadas

// Variável global para controlar o monitoramento do card de diferença
let differenceCardMonitor = {
    isMonitoring: false,
    intervalId: null,
    estimatedLoaded: false,
    realizedLoaded: false
};

// Função principal para gerenciar o card de diferença
function updateDifferenceCard() {
    // INATIVO: esconder card de diferença e cancelar monitoramento
    const differenceCard = document.getElementById('differenceCountCard');
    if (differenceCard) differenceCard.style.display = 'none';
    if (differenceCardMonitor && differenceCardMonitor.intervalId) {
        clearInterval(differenceCardMonitor.intervalId);
        differenceCardMonitor.intervalId = null;
    }
    if (differenceCardMonitor) {
        differenceCardMonitor.isMonitoring = false;
        differenceCardMonitor.estimatedLoaded = false;
        differenceCardMonitor.realizedLoaded = false;
    }
    return;
}

// Função para iniciar monitoramento dos dados de diferença
function startDifferenceMonitoring() {
    
    // Parar monitoramento anterior se existir
    if (differenceCardMonitor.intervalId) {
        clearInterval(differenceCardMonitor.intervalId);
    }
    
    // Configurar novo monitoramento
    differenceCardMonitor.isMonitoring = true;
    differenceCardMonitor.estimatedLoaded = false;
    differenceCardMonitor.realizedLoaded = false;
    
    // Verificar a cada 500ms se os dados de estimadas e realizadas estão prontos
    differenceCardMonitor.intervalId = setInterval(() => {
        checkDifferenceDataReady();
    }, 500);
    
    // Timeout de segurança para parar o monitoramento após 25 segundos
    setTimeout(() => {
        if (differenceCardMonitor.isMonitoring) {
            finalizeDifferenceCard();
        }
    }, 25000);
}

// Função para verificar se os dados de estimadas e realizadas estão prontos
function checkDifferenceDataReady() {
    // Verificar se os cards de estimadas e realizadas estão carregados
    const estimatedHoursText = document.getElementById('estimatedHoursCountText');
    const estimatedCostText = document.getElementById('estimatedCostCountText');
    const realizedHoursText = document.getElementById('realizedHoursCountText');
    const realizedCostText = document.getElementById('realizedCostCountText');
    
    let estimatedReady = false;
    let realizedReady = false;
    
    // Verificar se dados estimados estão prontos
    if (estimatedHoursText && estimatedCostText) {
        const estimatedHours = estimatedHoursText.textContent || '';
        const estimatedCost = estimatedCostText.textContent || '';
        
        if (!estimatedHours.includes('Carregando') && !estimatedHours.includes('...') &&
            !estimatedCost.includes('Carregando') && !estimatedCost.includes('...') &&
            estimatedHours.trim() !== '' && estimatedCost.trim() !== '') {
            estimatedReady = true;
            differenceCardMonitor.estimatedLoaded = true;
        }
    }
    
    // Verificar se dados realizados estão prontos
    if (realizedHoursText && realizedCostText) {
        const realizedHours = realizedHoursText.textContent || '';
        const realizedCost = realizedCostText.textContent || '';
        
        if (!realizedHours.includes('Carregando') && !realizedHours.includes('...') &&
            !realizedCost.includes('Carregando') && !realizedCost.includes('...') &&
            realizedHours.trim() !== '' && realizedCost.trim() !== '') {
            realizedReady = true;
            differenceCardMonitor.realizedLoaded = true;
        }
    }
    
    // Se ambos os dados estão prontos, calcular a diferença
    if (estimatedReady && realizedReady) {
        finalizeDifferenceCard();
    }
}

// Função para finalizar o monitoramento e calcular a diferença
function finalizeDifferenceCard() {
    // Parar monitoramento
    if (differenceCardMonitor.intervalId) {
        clearInterval(differenceCardMonitor.intervalId);
        differenceCardMonitor.intervalId = null;
    }
    differenceCardMonitor.isMonitoring = false;
    
    // Obter valores dos cards de estimadas e realizadas
    const estimatedHoursText = document.getElementById('estimatedHoursCountText');
    const estimatedCostText = document.getElementById('estimatedCostCountText');
    const realizedHoursText = document.getElementById('realizedHoursCountText');
    const realizedCostText = document.getElementById('realizedCostCountText');
    
    let estimatedHours = 0;
    let estimatedCost = 0;
    let realizedHours = 0;
    let realizedCost = 0;
    
    // Extrair valores estimados
    if (estimatedHoursText) {
        const hoursText = estimatedHoursText.textContent || '0';
        estimatedHours = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    }
    
    if (estimatedCostText) {
        const costText = estimatedCostText.textContent || 'R$ 0,00';
        estimatedCost = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    }
    
    // Extrair valores realizados
    if (realizedHoursText) {
        const hoursText = realizedHoursText.textContent || '0';
        realizedHours = parseFloat(hoursText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    }
    
    if (realizedCostText) {
        const costText = realizedCostText.textContent || 'R$ 0,00';
        realizedCost = parseFloat(costText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    }
    
    // Calcular diferenças (realizadas - estimadas)
    const hoursDifference = realizedHours - estimatedHours;
    const costDifference = realizedCost - estimatedCost;
    

    
    // Atualizar o card com as diferenças
    const differenceHoursText = document.getElementById('differenceHoursText');
    const differenceCostText = document.getElementById('differenceCostText');
    
    if (differenceHoursText) {
        const sign = hoursDifference >= 0 ? '+' : '';
        differenceHoursText.textContent = `Diferença: ${sign}${hoursDifference.toFixed(2)}`;
    }
    
    if (differenceCostText) {
        const sign = costDifference >= 0 ? '+' : '';
        const formattedCost = Math.abs(costDifference).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        differenceCostText.textContent = `Custo: ${sign}R$ ${formattedCost}`;
    }
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
}

setTimeout(() => {
    updateDifferenceCard();
}, 4000);

// ===== FILTRO DE PERÍODO MODERNO =====
function initializeModernPeriodoFilter() {
    console.log('📅 Inicializando filtro de período moderno (modal dinâmico)...');
    window.__modernPeriodoInitialized = false;

    const periodoTrigger = document.getElementById('periodoTrigger');
    const periodoText = document.getElementById('periodoText');

    // Se não houver trigger ainda, tentar novamente
    if (!periodoTrigger || !periodoText) {
        console.error('❌ Elementos do filtro de período não encontrados');
        if (modernPeriodoInitAttempts < MODERN_PERIODO_MAX_ATTEMPTS) {
            modernPeriodoInitAttempts++;
            setTimeout(() => {
                console.log(`🔁 Tentativa ${modernPeriodoInitAttempts} de inicializar filtro de período moderno...`);
                // initializeModernPeriodoFilter(); // desativado temporariamente
            }, 300);
        }
        return;
    }

    // Estado do calendário
    let currentCalendarDate = new Date();
    let selectedStartDate = null;
    let selectedEndDate = null;
    let isSelectingEndDate = false;
    let periodoCalendarModal = null; // Elemento criado dinamicamente

    // Helpers: criar modal
    function createCalendarModal() {
        const modal = document.createElement('div');
        modal.className = 'periodo-calendar-card periodo-calendar-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="calendar-header">
                <button type="button" class="calendar-nav prev-month" aria-label="Mês anterior">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="calendar-month-year"></span>
                <button type="button" class="calendar-nav next-month" aria-label="Próximo mês">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="calendar-weekdays">
                <div class="weekday">Dom</div>
                <div class="weekday">Seg</div>
                <div class="weekday">Ter</div>
                <div class="weekday">Qua</div>
                <div class="weekday">Qui</div>
                <div class="weekday">Sex</div>
                <div class="weekday">Sáb</div>
            </div>
            <div class="calendar-days"></div>
        `;
        return modal;
    }

    // Obter refs internas do modal
    function getModalRefs() {
        if (!periodoCalendarModal) return null;
        const monthYearEl = periodoCalendarModal.querySelector('.calendar-month-year');
        const daysContainer = periodoCalendarModal.querySelector('.calendar-days');
        const prevBtn = periodoCalendarModal.querySelector('.prev-month');
        const nextBtn = periodoCalendarModal.querySelector('.next-month');
        return { monthYearEl, daysContainer, prevBtn, nextBtn };
    }

    // Toggle pelo trigger
    periodoTrigger.addEventListener('click', () => {
        window.__closeReason = 'trigger-click';
        const isOpen = !!periodoCalendarModal;
        if (isOpen) {
            closeCalendar();
        } else {
            openCalendar();
        }
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        const isOpen = !!periodoCalendarModal;
        if (!isOpen) return;
        const clickedInsideCard = periodoCalendarModal.contains(e.target);
        const clickedTrigger = e.target.closest && e.target.closest('#periodoTrigger');
        if (clickedInsideCard || clickedTrigger) return;
        window.__closeReason = 'outside-click';
        closeCalendar();
    });

    function openCalendar() {
        if (!periodoCalendarModal) {
            periodoCalendarModal = createCalendarModal();
            document.body.appendChild(periodoCalendarModal);
            // Bloquear propagação dentro do modal
            periodoCalendarModal.addEventListener('click', (e) => e.stopPropagation());
            // Navegação de meses
            const { prevBtn, nextBtn } = getModalRefs();
            if (prevBtn) prevBtn.addEventListener('click', () => changeMonth(-1));
            if (nextBtn) nextBtn.addEventListener('click', () => changeMonth(1));
        }

        // Posicionar relativo ao trigger
        const rect = periodoTrigger.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const left = rect.left + scrollLeft;
        const top = rect.bottom + scrollTop + 8;
        periodoCalendarModal.style.position = 'absolute';
        periodoCalendarModal.style.zIndex = '1000';
        periodoCalendarModal.style.left = `${left}px`;
        periodoCalendarModal.style.top = `${top}px`;
        periodoCalendarModal.style.display = 'block';
        periodoTrigger.classList.add('active');

        renderCalendar();
    }

    function closeCalendar() {
        console.log('🔒 closeCalendar()', {
            reason: window.__closeReason || 'unknown',
            state: { selectedStartDate, selectedEndDate, isSelectingEndDate }
        });
        periodoTrigger.classList.remove('active');
        if (periodoCalendarModal) {
            periodoCalendarModal.remove(); // remover completamente do DOM
            periodoCalendarModal = null;
        }
        window.__closeReason = null;
    }

    function changeMonth(direction) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
        renderCalendar();
    }

    function renderCalendar() {
        const refs = getModalRefs();
        if (!refs) return;
        const { monthYearEl, daysContainer } = refs;
        if (!monthYearEl || !daysContainer) return;

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        monthYearEl.textContent = `${monthNames[month]} ${year}`;

        daysContainer.innerHTML = '';

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const prevMonth = new Date(year, month - 1, 0);
        const daysInPrevMonth = prevMonth.getDate();
        for (let i = firstDayWeekday - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const dayElement = createDayElement(day, true, new Date(year, month - 1, day));
            daysContainer.appendChild(dayElement);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayElement = createDayElement(day, false, date);
            daysContainer.appendChild(dayElement);
        }

        const totalCells = daysContainer.children.length;
        const remainingCells = 42 - totalCells; // 6x7 grade
        for (let day = 1; day <= remainingCells; day++) {
            const dayElement = createDayElement(day, true, new Date(year, month + 1, day));
            daysContainer.appendChild(dayElement);
        }
    }

    function createDayElement(day, isOtherMonth, date) {
        const el = document.createElement('div');
        el.className = 'calendar-day';
        el.textContent = day;

        if (isOtherMonth) el.classList.add('other-month');

        const today = new Date();
        if (date.toDateString() === today.toDateString()) el.classList.add('today');

        if (selectedStartDate && date.toDateString() === selectedStartDate.toDateString()) el.classList.add('selected-start');
        if (selectedEndDate && date.toDateString() === selectedEndDate.toDateString()) el.classList.add('selected-end');
        if (selectedStartDate && selectedEndDate && date > selectedStartDate && date < selectedEndDate) el.classList.add('in-range');

        if (!isOtherMonth) {
            el.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                selectDate(date);
            });
        }
        return el;
    }

    function selectDate(date) {
        console.log('📅 selectDate()', { date, selectedStartDate, selectedEndDate, isSelectingEndDate });
        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            selectedStartDate = date;
            selectedEndDate = null;
            isSelectingEndDate = true;
        } else if (isSelectingEndDate) {
            if (date >= selectedStartDate) {
                selectedEndDate = date;
                isSelectingEndDate = false;
            } else {
                selectedEndDate = selectedStartDate;
                selectedStartDate = date;
                isSelectingEndDate = false;
            }
        }

        // Sincronizar com variáveis globais usadas em outras rotinas
        window.selectedStartDate = selectedStartDate;
        window.selectedEndDate = selectedEndDate;

        updatePeriodoDisplay();
        renderCalendar();

        // Atualizar filtro global e cards
        activePeriodoFilter = { startDate: selectedStartDate, endDate: selectedEndDate };
        updateTotalCards();
    }

    function updatePeriodoDisplay() {
        if (selectedStartDate && selectedEndDate) {
            const startStr = formatDate(selectedStartDate);
            const endStr = formatDate(selectedEndDate);
            periodoText.textContent = `${startStr} – ${endStr}`;
        } else if (selectedStartDate) {
            const startStr = formatDate(selectedStartDate);
            periodoText.textContent = `${startStr} – ...`;
        } else {
            periodoText.textContent = 'Selecionar período';
        }
        // Atualizar estado dos botões ao alterar período
        try { updateFilterButtonsVisibility(); } catch (_) {}
    }

    function formatDate(date) {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    // Limpar seleção
    window.clearModernPeriodoFilter = function() {
        selectedStartDate = null;
        selectedEndDate = null;
        isSelectingEndDate = false;
        activePeriodoFilter = null;
        window.selectedStartDate = null;
        window.selectedEndDate = null;
        updatePeriodoDisplay();
        renderCalendar();
    };

    console.log('✅ Filtro de período moderno inicializado (modal dinâmico)');
    window.__modernPeriodoInitialized = true;
}

// ===== NOVA LÓGICA DO CARD DE TOTAL DE FATURAMENTO =====
// Função para atualizar o card de faturamento total
function updateFaturamentoCount() {
    console.log('💰 Atualizando card de faturamento...');
    
    const faturamentoCountCard = document.getElementById('faturamentoCountCard');
    const faturamentoCountText = document.getElementById('faturamentoCountText');
    const faturamentoRegistrosText = document.getElementById('faturamentoRegistrosText');
    
    if (!faturamentoCountCard || !faturamentoCountText || !faturamentoRegistrosText) {
        console.warn('💰 Elementos do card de faturamento não encontrados');
        return;
    }
    
    // Verificar se há filtros ativos
    const hasActiveFilters = checkIfFiltersActive();
    const hasPeriodFilterGlobal = selectedStartDate !== null || selectedEndDate !== null;
    
    if (!hasActiveFilters && !hasPeriodFilterGlobal) {
        // Se não há filtros, ocultar o card
        faturamentoCountCard.style.display = 'none';
        console.log('💰 Sem filtros ativos - card oculto');
        return;
    }
    
    // Obter clientes filtrados/destacados
    const filteredClients = getFilteredClients();
    
    if (filteredClients.length === 0) {
        // Se não há clientes filtrados, ocultar o card
        faturamentoCountCard.style.display = 'none';
        console.log('💰 Sem clientes filtrados - card oculto');
        return;
    }
    
    console.log(`💰 Calculando faturamento para ${filteredClients.length} clientes filtrados`);
    
    // Calcular faturamento total
    let totalFaturamento = 0;
    let totalRegistros = 0;
    
    filteredClients.forEach(client => {
        const clientCard = client.card;
        const clientId = client.id;
        
        // 🚀 OTIMIZAÇÃO: Buscar dados dos registros em memória (dataset) ao invés do DOM
        const faturamentoElement = clientCard.querySelector('.faturamento-value');
        if (faturamentoElement && faturamentoElement.dataset.faturamentoRegistros) {
            try {
                const registros = JSON.parse(faturamentoElement.dataset.faturamentoRegistros);
                
                // Calcular faturamento total dos registros
                registros.forEach(registro => {
                    const valor = parseFloat(registro.valor_bruto) || 0;
                    totalFaturamento += valor;
                });
                
                totalRegistros += registros.length;
            } catch (e) {
                console.warn(`⚠️ Erro ao processar faturamento do cliente ${clientId}:`, e);
            }
        } else if (faturamentoElement) {
            // Fallback: tentar extrair do texto se dataset não existir
            const faturamentoText = faturamentoElement.textContent || '';
            
            // Verificar se tem valor monetário (R$ X,XX)
            const matchValor = faturamentoText.match(/R\$\s*([\d.,]+)/);
            if (matchValor) {
                const valorLimpo = matchValor[1].replace(/\./g, '').replace(',', '.');
                const valor = parseFloat(valorLimpo) || 0;
                totalFaturamento += valor;
            }
            
            // Verificar se tem quantidade de registros
            const matchRegistros = faturamentoText.match(/(\d+)\s*registro/i);
            if (matchRegistros) {
                totalRegistros += parseInt(matchRegistros[1]) || 0;
            }
        }
    });
    
    console.log(`💰 Faturamento total calculado: R$ ${totalFaturamento.toFixed(2)} (${totalRegistros} registros)`);
    
    // Atualizar o card
    const formattedFaturamento = totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    faturamentoCountText.textContent = `Faturamento: R$ ${formattedFaturamento}`;
    faturamentoRegistrosText.textContent = `${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`;
    
    // Mostrar o card
    faturamentoCountCard.style.display = 'flex';
    
    // Atualizar visibilidade do container
    updateTotalCardsContainer();
    
    console.log('✅ Card de faturamento atualizado');
}

// ===== CARD FLUTUANTE SIMPLES DO FILTRO DE PERÍODO =====
// Abre um pequeno card flutuante ao clicar em "Selecionar período"
document.addEventListener('DOMContentLoaded', function() {
    const periodoSelectField = document.getElementById('periodoSelectField');
    const periodoSelectDisplay = document.getElementById('periodoSelectDisplay');
    const periodoSelectText = document.getElementById('periodoSelectText');
    const periodoSelectArrow = document.getElementById('periodoSelectArrow');

    if (!periodoSelectField || !periodoSelectDisplay) {
        return; // Elementos não existem na página atual
    }

    let periodoFloatingCard = null;

    function openPeriodoFloatingCard() {
        if (periodoFloatingCard) return;

        periodoFloatingCard = document.createElement('div');
        periodoFloatingCard.id = 'periodoFloatingCard';
        periodoFloatingCard.setAttribute('role', 'dialog');
        periodoFloatingCard.setAttribute('aria-label', 'Filtro de período');

        // Estilo inline para evitar alterar styles.css
        periodoFloatingCard.style.position = 'absolute';
        periodoFloatingCard.style.zIndex = '2000';
        periodoFloatingCard.style.width = '320px';
        periodoFloatingCard.style.maxWidth = '90vw';
        periodoFloatingCard.style.background = '#ffffff';
        periodoFloatingCard.style.border = '1px solid #e5e7eb';
        periodoFloatingCard.style.borderRadius = '12px';
        periodoFloatingCard.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
        periodoFloatingCard.style.padding = '16px';
        periodoFloatingCard.style.display = 'block';

        periodoFloatingCard.innerHTML = `
            <div style="font-weight:600; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-calendar-alt" style="color:#4b5563;"></i>
                Filtro de período
            </div>
            <div class="periodo-cal-selected" style="display:flex; gap:8px; margin-bottom:8px;">
                <div style="flex:1; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:8px;">
                    <div style="font-size:11px; color:#6b7280;">Início</div>
                    <div id="periodoCalInicioText" style="font-size:13px; color:#111827;">Selecione</div>
                </div>
                <div class="andor-separator" style="flex:0; display:flex; align-items:center; justify-content:center;">
                    <select id="periodoAndOrSelect" class="andor-select" aria-label="Operador entre início e vencimento">
                        <option value="E">E</option>
                        <option value="OU">OU</option>
                    </select>
                </div>
                <div style="flex:1; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:8px;">
                    <div style="font-size:11px; color:#6b7280;">Vencimento</div>
                    <div id="periodoCalVencimentoText" style="font-size:13px; color:#111827;">Selecione</div>
                </div>
            </div>
            <div class="periodo-cal-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <button type="button" class="periodo-cal-prev" aria-label="Mês anterior" style="border:none; background:#f3f4f6; color:#374151; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="periodo-cal-month" style="font-weight:600; color:#111827;">Mês Ano</div>
                <button type="button" class="periodo-cal-next" aria-label="Próximo mês" style="border:none; background:#f3f4f6; color:#374151; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="periodo-cal-weekdays" style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; font-size:12px; color:#6b7280; margin-bottom:6px;">
                <div style="text-align:center;">D</div>
                <div style="text-align:center;">S</div>
                <div style="text-align:center;">T</div>
                <div style="text-align:center;">Q</div>
                <div style="text-align:center;">Q</div>
                <div style="text-align:center;">S</div>
                <div style="text-align:center;">S</div>
            </div>
            <div class="periodo-cal-days" style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px;"></div>
        `;

        document.body.appendChild(periodoFloatingCard);

        // Inicializa seletor E/OU (default "E") e persiste escolha
        const andOrSelectEl = periodoFloatingCard.querySelector('#periodoAndOrSelect');
        if (andOrSelectEl) {
            try {
                const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem('periodoAndOr') : null;
                const initial = saved === 'OU' ? 'OU' : 'E';
                andOrSelectEl.value = initial;
                if (typeof window !== 'undefined') {
                    window.periodoAndOr = initial;
                }
                andOrSelectEl.addEventListener('change', () => {
                    const val = andOrSelectEl.value === 'OU' ? 'OU' : 'E';
                    if (typeof window !== 'undefined') {
                        window.periodoAndOr = val;
                    }
                    try { if (typeof localStorage !== 'undefined') localStorage.setItem('periodoAndOr', val); } catch (_) {}
                });
            } catch (_) {}
        }

        // Instalar handler para fechar ao clicar fora
        const onDocClick = (ev) => {
            const clickedInsideCard = ev.target.closest('#periodoFloatingCard');
            const clickedTrigger = ev.target.closest('#periodoSelectDisplay') || ev.target.closest('#periodoSelectField');
            if (clickedInsideCard || clickedTrigger) return;
            closePeriodoFloatingCard();
        };
        document.addEventListener('click', onDocClick, { capture: true });
        // Guardar referência para remoção posterior
        periodoFloatingCard._outsideHandler = onDocClick;

        // Estado visual ativo no campo de período
        periodoSelectDisplay.classList.add('active');
        if (periodoSelectArrow) periodoSelectArrow.classList.add('rotated');

        // Posicionamento relativo ao campo do período
        const rect = periodoSelectField.getBoundingClientRect();
        const left = rect.left + window.scrollX;
        const top = rect.bottom + window.scrollY + 8; // 8px de espaçamento
        periodoFloatingCard.style.left = `${left}px`;
        periodoFloatingCard.style.top = `${top}px`;

        // ===== Calendário básico dentro do card =====
        const monthYearEl = periodoFloatingCard.querySelector('.periodo-cal-month');
        const daysContainerEl = periodoFloatingCard.querySelector('.periodo-cal-days');
        const prevBtnEl = periodoFloatingCard.querySelector('.periodo-cal-prev');
        const nextBtnEl = periodoFloatingCard.querySelector('.periodo-cal-next');

        let calDate = new Date();
        let cardStartDate = null;
        let cardEndDate = null;
        let selectingEnd = false; // controla se próximo clique é o Vencimento

        function formatMonthYear(date) {
            const txt = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return txt.charAt(0).toUpperCase() + txt.slice(1);
        }

        function isSameDay(a, b) {
            return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        }

        function formatDateDDMMYYYY(date) {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        }

        function updateSelectedLabels() {
            const inicioEl = periodoFloatingCard.querySelector('#periodoCalInicioText');
            const vencEl = periodoFloatingCard.querySelector('#periodoCalVencimentoText');
            inicioEl.textContent = cardStartDate ? formatDateDDMMYYYY(cardStartDate) : 'Selecione';
            vencEl.textContent = cardEndDate ? formatDateDDMMYYYY(cardEndDate) : 'Selecione';
            // Atualiza o texto do campo "Selecionar período"
            if (periodoSelectText) {
                if (cardStartDate && cardEndDate) {
                    periodoSelectText.textContent = `${formatDateDDMMYYYY(cardStartDate)} – ${formatDateDDMMYYYY(cardEndDate)}`;
                    periodoSelectText.classList.add('has-selection');
                } else if (cardStartDate && !cardEndDate) {
                    periodoSelectText.textContent = `Início: ${formatDateDDMMYYYY(cardStartDate)}`;
                    periodoSelectText.classList.add('has-selection');
                } else {
                    periodoSelectText.textContent = 'Selecionar período';
                    periodoSelectText.classList.remove('has-selection');
                }
            }
        }

        function renderPeriodoCalendar() {
            const year = calDate.getFullYear();
            const month = calDate.getMonth();
            monthYearEl.textContent = formatMonthYear(calDate);

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startWeekday = firstDay.getDay();
            const daysInMonth = lastDay.getDate();

            daysContainerEl.innerHTML = '';

            // Espaços vazios antes do primeiro dia
            for (let i = 0; i < startWeekday; i++) {
                const empty = document.createElement('div');
                empty.style.height = '36px';
                daysContainerEl.appendChild(empty);
            }

            // Dias do mês
            for (let d = 1; d <= daysInMonth; d++) {
                const dayEl = document.createElement('button');
                dayEl.type = 'button';
                dayEl.textContent = String(d);
                dayEl.style.height = '36px';
                dayEl.style.border = '1px solid #e5e7eb';
                dayEl.style.background = '#fff';
                dayEl.style.borderRadius = '8px';
                dayEl.style.cursor = 'pointer';
                dayEl.style.color = '#111827';

                const current = new Date(year, month, d);
                // Hoje
                if (isSameDay(current, new Date())) {
                    dayEl.style.borderColor = '#9ca3af';
                }
                // Início e vencimento
                if (isSameDay(current, cardStartDate)) {
                    dayEl.style.background = '#144577';
                    dayEl.style.borderColor = '#0e3b6f';
                    dayEl.style.color = '#ffffff';
                    dayEl.style.fontWeight = '600';
                }
                if (isSameDay(current, cardEndDate)) {
                    dayEl.style.background = '#144577';
                    dayEl.style.borderColor = '#0e3b6f';
                    dayEl.style.color = '#ffffff';
                    dayEl.style.fontWeight = '600';
                }
                // Intervalo
                if (cardStartDate && cardEndDate) {
                    const startTime = new Date(cardStartDate.getFullYear(), cardStartDate.getMonth(), cardStartDate.getDate()).getTime();
                    const endTime = new Date(cardEndDate.getFullYear(), cardEndDate.getMonth(), cardEndDate.getDate()).getTime();
                    const curTime = current.getTime();
                    if (curTime > startTime && curTime < endTime) {
                        dayEl.style.background = '#dbeafe';
                    }
                }

                dayEl.addEventListener('click', () => {
                    if (!cardStartDate || (cardStartDate && cardEndDate)) {
                        // Primeiro clique: define INÍCIO
                        cardStartDate = new Date(current);
                        cardEndDate = null;
                        selectingEnd = true;
                    } else if (selectingEnd) {
                        // Segundo clique: define VENCIMENTO
                        const clicked = new Date(current);
                        if (clicked < cardStartDate) {
                            // Troca para manter ordem cronológica
                            cardEndDate = new Date(cardStartDate);
                            cardStartDate = clicked;
                        } else {
                            cardEndDate = clicked;
                        }
                        selectingEnd = false;
                    } else {
                        // Reinicia seleção
                        cardStartDate = new Date(current);
                        cardEndDate = null;
                        selectingEnd = true;
                    }
                    updateSelectedLabels();
                    renderPeriodoCalendar();

                    // Persistir seleção global quando houver início e vencimento
                    if (cardStartDate && cardEndDate) {
                        try {
                            selectedStartDate = new Date(cardStartDate);
                            selectedEndDate = new Date(cardEndDate);
                            if (typeof window !== 'undefined') {
                                window.selectedStartDate = selectedStartDate;
                                window.selectedEndDate = selectedEndDate;
                            }
                            activePeriodoFilter = { startDate: selectedStartDate, endDate: selectedEndDate };
                            // Atualizar indicadores e cards
                            try { updateGlobalPeriodHoursFromSelection(); } catch (err) {}
                            try { updateTotalCards(); } catch (err) {}
                        } catch (err) {
                            console.warn('Falha ao persistir seleção de período global:', err);
                        }
                    }
                });

                daysContainerEl.appendChild(dayEl);
            }
            updateSelectedLabels();
        }

        prevBtnEl.addEventListener('click', () => {
            calDate.setMonth(calDate.getMonth() - 1);
            renderPeriodoCalendar();
        });

        nextBtnEl.addEventListener('click', () => {
            calDate.setMonth(calDate.getMonth() + 1);
            renderPeriodoCalendar();
        });

        renderPeriodoCalendar();
    }

    function closePeriodoFloatingCard() {
        if (!periodoFloatingCard) return;
        // Remover listener global de clique fora se existir
        if (periodoFloatingCard._outsideHandler) {
            document.removeEventListener('click', periodoFloatingCard._outsideHandler, { capture: true });
            periodoFloatingCard._outsideHandler = null;
        }
        periodoFloatingCard.remove();
        periodoFloatingCard = null;
        // Remove estado visual ativo
        periodoSelectDisplay.classList.remove('active');
        if (periodoSelectArrow) periodoSelectArrow.classList.remove('rotated');
    }

    // Toggle ao clicar no display do período
    periodoSelectDisplay.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (periodoFloatingCard) {
            closePeriodoFloatingCard();
        } else {
            openPeriodoFloatingCard();
        }
    });
});
