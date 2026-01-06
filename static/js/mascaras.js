/**
 * MÁSCARAS DE FORMULÁRIO - SISTEMA +COMPLIANCE
 * 
 * Funções JavaScript para aplicar máscaras automáticas em campos de:
 * - CPF (###.###.###-##)
 * - Telefone ((##) #####-####)
 * - CEP (#####-###)
 * 
 * Uso: Incluir este arquivo no template e chamar as funções
 */

/**
 * Aplica máscara de CPF em um campo
 * @param {string} elementId - ID do elemento (ex: 'id_cpf')
 */
function aplicarMascaraCPF(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento ${elementId} não encontrado para aplicar máscara de CPF`);
        return;
    }
    
    element.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Limitar a 11 dígitos
        if (value.length > 11) {
            value = value.substr(0, 11);
        }
        
        // Aplicar máscara: ###.###.###-##
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        
        e.target.value = value;
    });
    
    // Adicionar atributo maxlength se não existir
    if (!element.hasAttribute('maxlength')) {
        element.setAttribute('maxlength', '14');
    }
}

/**
 * Aplica máscara de Telefone em um campo
 * @param {string} elementId - ID do elemento (ex: 'id_telefone')
 */
function aplicarMascaraTelefone(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento ${elementId} não encontrado para aplicar máscara de Telefone`);
        return;
    }
    
    element.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Limitar a 11 dígitos
        if (value.length > 11) {
            value = value.substr(0, 11);
        }
        
        // Aplicar máscara: (##) #####-####
        if (value.length > 0) {
            value = value.replace(/(\d{2})(\d)/, '($1) $2');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
        }
        
        e.target.value = value;
    });
    
    // Adicionar atributo maxlength se não existir
    if (!element.hasAttribute('maxlength')) {
        element.setAttribute('maxlength', '15');
    }
}

/**
 * Aplica máscara de CEP em um campo E integra com ViaCEP
 * @param {string} elementId - ID do elemento (ex: 'id_cep')
 */
function aplicarMascaraCEP(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Elemento ${elementId} não encontrado para aplicar máscara de CEP`);
        return;
    }
    
    element.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Limitar a 8 dígitos
        if (value.length > 8) {
            value = value.substr(0, 8);
        }
        
        // Aplicar máscara: #####-###
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
        
        e.target.value = value;
    });
    
    // Adicionar atributo maxlength se não existir
    if (!element.hasAttribute('maxlength')) {
        element.setAttribute('maxlength', '9');
    }
    
    // Adicionar evento blur para buscar CEP quando campo perder foco
    element.addEventListener('blur', function(e) {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            buscarCEP(cep);
        }
    });
}

/**
 * Busca CEP na API do ViaCEP e preenche os campos automaticamente
 * @param {string} cep - CEP sem formatação (apenas números)
 */
function buscarCEP(cep) {
    // Limpa mensagens anteriores
    limparMensagemCEP();
    
    // Mostra loading
    mostrarLoadingCEP();
    
    // Faz requisição para ViaCEP
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => response.json())
        .then(dados => {
            ocultarLoadingCEP();
            
            if (dados.erro) {
                mostrarErroCEP('CEP não encontrado.');
                return;
            }
            
            // Preenche os campos automaticamente
            preencherEnderecoPorCEP(dados);
            mostrarSucessoCEP('CEP encontrado! Endereço preenchido automaticamente.');
        })
        .catch(erro => {
            ocultarLoadingCEP();
            mostrarErroCEP('Erro ao buscar CEP. Verifique sua conexão.');
            console.error('Erro ao buscar CEP:', erro);
        });
}

/**
 * Preenche os campos de endereço com os dados do ViaCEP
 * @param {object} dados - Dados retornados pela API do ViaCEP
 */
function preencherEnderecoPorCEP(dados) {
    // Mapeamento de campos comuns
    const mapeamentos = {
        // Endereço/Logradouro
        'id_endereco': dados.logradouro,
        'id_logradouro': dados.logradouro,
        'id_rua': dados.logradouro,
        
        // Bairro
        'id_bairro': dados.bairro,
        
        // Cidade/Município
        'id_cidade': dados.localidade,
        'id_municipio': dados.localidade,
        
        // Estado/UF
        'id_estado': dados.uf,
        'id_uf': dados.uf,
        
        // Complemento (se existir no formulário)
        'id_complemento': dados.complemento
    };
    
    // Preenche cada campo encontrado
    for (const [fieldId, valor] of Object.entries(mapeamentos)) {
        const campo = document.getElementById(fieldId);
        if (campo && valor) {
            campo.value = valor;
            
            // Dispara evento de mudança para atualizar validações
            campo.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

/**
 * Mostra loading enquanto busca CEP
 */
function mostrarLoadingCEP() {
    const cepField = document.getElementById('id_cep');
    if (cepField) {
        // Adiciona classe de loading
        cepField.classList.add('loading-cep');
        cepField.disabled = true;
        
        // Cria elemento de loading se não existir
        let loading = document.getElementById('cep-loading');
        if (!loading) {
            loading = document.createElement('small');
            loading.id = 'cep-loading';
            loading.className = 'text-info d-block mt-1';
            loading.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Buscando CEP...';
            cepField.parentNode.appendChild(loading);
        }
    }
}

/**
 * Oculta loading do CEP
 */
function ocultarLoadingCEP() {
    const cepField = document.getElementById('id_cep');
    if (cepField) {
        cepField.classList.remove('loading-cep');
        cepField.disabled = false;
    }
    
    const loading = document.getElementById('cep-loading');
    if (loading) {
        loading.remove();
    }
}

/**
 * Mostra mensagem de sucesso ao buscar CEP
 * @param {string} mensagem - Mensagem a ser exibida
 */
function mostrarSucessoCEP(mensagem) {
    limparMensagemCEP();
    
    const cepField = document.getElementById('id_cep');
    if (cepField) {
        const sucessoDiv = document.createElement('small');
        sucessoDiv.id = 'cep-sucesso';
        sucessoDiv.className = 'text-success d-block mt-1';
        sucessoDiv.innerHTML = `<i class="fas fa-check-circle me-1"></i> ${mensagem}`;
        cepField.parentNode.appendChild(sucessoDiv);
        
        // Remove mensagem após 5 segundos
        setTimeout(() => {
            const msg = document.getElementById('cep-sucesso');
            if (msg) msg.remove();
        }, 5000);
    }
}

/**
 * Mostra mensagem de erro ao buscar CEP
 * @param {string} mensagem - Mensagem de erro
 */
function mostrarErroCEP(mensagem) {
    limparMensagemCEP();
    
    const cepField = document.getElementById('id_cep');
    if (cepField) {
        const erroDiv = document.createElement('small');
        erroDiv.id = 'cep-erro';
        erroDiv.className = 'text-danger d-block mt-1';
        erroDiv.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i> ${mensagem}`;
        cepField.parentNode.appendChild(erroDiv);
    }
}

/**
 * Limpa todas as mensagens de CEP
 */
function limparMensagemCEP() {
    const loading = document.getElementById('cep-loading');
    const sucesso = document.getElementById('cep-sucesso');
    const erro = document.getElementById('cep-erro');
    
    if (loading) loading.remove();
    if (sucesso) sucesso.remove();
    if (erro) erro.remove();
}

/**
 * Aplica todas as máscaras automaticamente baseado nos IDs padrão do Django
 * Busca por: id_cpf, id_telefone, id_cep
 */
function aplicarMascarasAutomaticas() {
    // CPF
    const cpfFields = ['id_cpf', 'cpf'];
    cpfFields.forEach(id => {
        if (document.getElementById(id)) {
            aplicarMascaraCPF(id);
        }
    });
    
    // Telefone
    const telefoneFields = ['id_telefone', 'telefone', 'id_telefone_secundario', 'id_whatsapp'];
    telefoneFields.forEach(id => {
        if (document.getElementById(id)) {
            aplicarMascaraTelefone(id);
        }
    });
    
    // CEP
    const cepFields = ['id_cep'];
    cepFields.forEach(id => {
        if (document.getElementById(id)) {
            aplicarMascaraCEP(id);
        }
    });
}

/**
 * Inicializa as máscaras quando o DOM estiver pronto
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarMascarasAutomaticas);
} else {
    aplicarMascarasAutomaticas();
}

// Exportar funções para uso global
window.aplicarMascaraCPF = aplicarMascaraCPF;
window.aplicarMascaraTelefone = aplicarMascaraTelefone;
window.aplicarMascaraCEP = aplicarMascaraCEP;
window.aplicarMascarasAutomaticas = aplicarMascarasAutomaticas;





