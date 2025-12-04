import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import Layout from '../../components/layout/Layout';
import '../../styles/global.css';

// Estilos inline exatamente como no HTML original
const inlineStyles = `
  .inline-child-panel{overflow:hidden;max-height:0;opacity:0;transition:max-height .28s ease,opacity .28s ease;margin-top:10px}
  .inline-child-panel.open{max-height:2000px;opacity:1;overflow:visible}
  .inline-child-card{border:1px solid #E0E7FF;background:#F8FAFC;border-radius:10px;padding:14px 16px}
  .client-header{display:flex;align-items:center;gap:12px;width:100%;flex:1}
  .client-header .client-name{flex:1}
  .client-header .client-actions{margin-left:auto;display:flex;gap:8px}
  .searchable-select{position:relative}
  .searchable-select .dropdown-list{position:absolute;top:calc(100% + 4px);right:0;left:auto;min-width:420px;max-width:calc(100vw - 80px);max-height:260px;overflow:auto;background:#fff;border:1px solid #E0E7FF;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.12);z-index:10000}
  .searchable-select .dropdown-item{padding:10px 12px;white-space:normal}
  .inline-child-card .select-with-icon{border:1px solid #E0E7FF;border-radius:8px}
  .client-list-item{border-color:#E0E7FF}
  .inline-fields-grid{display:grid;gap:10px;grid-template-columns:2fr 2fr 2fr 1.4fr 1.3fr 1.3fr;align-items:end}
  @media (max-width: 900px){.inline-fields-grid{grid-template-columns:repeat(2,minmax(160px,1fr))}}
  .form-group{min-width:140px}
  .form-input{width:100%}
  .inline-save-row{display:flex;justify-content:flex-end;margin-top:10px}
  .inline-save-row .activate-btn{margin-left:auto}
  .select-wrapper{display:flex;align-items:center}
`;

const API_BASE_URL = '/api';

// Função auxiliar para aplicar máscara de CPF/CNPJ
const aplicarMascaraCpfCnpj = (valor) => {
  const apenasNumeros = valor.replace(/\D/g, '');
  const numeroLimitado = apenasNumeros.substring(0, 14);
  return numeroLimitado
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Componente para formulário inline de edição
const InlineEditForm = memo(({ 
  client, 
  editData, 
  isExpanded, 
  onUpdateEditData, 
  onSave, 
  allClientesKamino, 
  clientesKaminoMap,
  loadCnpjOptions 
}) => {
  const [cnpjOptions, setCnpjOptions] = useState([]);
  const [kaminoSearchTerm, setKaminoSearchTerm] = useState(editData.kaminoNome || '');
  const [showKaminoDropdown, setShowKaminoDropdown] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      loadCnpjOptions(client.id, client.clickupNome).then(options => {
        // Garantir que o CNPJ salvo no banco esteja nas opções
        const cnpjSalvo = editData.cnpj || client.raw?.cpf_cnpj || client.raw?.cnpj_cpf || '';
        if (cnpjSalvo) {
          const cnpjLimpo = cnpjSalvo.replace(/\D/g, '');
          const optionsLimpos = options.map(opt => opt.replace(/\D/g, ''));
          if (!optionsLimpos.includes(cnpjLimpo)) {
            // Adicionar o CNPJ salvo às opções se não estiver presente
            setCnpjOptions([...options, cnpjSalvo.replace(/\D/g, '')]);
          } else {
            setCnpjOptions(options);
          }
        } else {
          setCnpjOptions(options);
        }
      });
      setKaminoSearchTerm(editData.kaminoNome || '');
    }
  }, [isExpanded, client.id, client.clickupNome, editData.kaminoNome, editData.cnpj, client.raw, loadCnpjOptions]);

  // Filtrar clientes Kamino
  const filteredKamino = React.useMemo(() => {
    if (!allClientesKamino || !Array.isArray(allClientesKamino) || allClientesKamino.length === 0) {
      return [];
    }
    
    return allClientesKamino.filter(c => {
      if (!c || !c.nome_fantasia) return false;
      // Se não há termo de busca, mostrar todos
      if (!kaminoSearchTerm || kaminoSearchTerm.trim() === '') {
        return true;
      }
      const nomeFantasia = (c.nome_fantasia || '').toLowerCase();
      const search = kaminoSearchTerm.toLowerCase();
      return nomeFantasia.includes(search);
    });
  }, [allClientesKamino, kaminoSearchTerm]);


  if (!isExpanded) return null;

  return (
    <div className="inline-child-panel open">
      <div className="inline-child-card">
        <div className="inline-fields-grid">
          <div className="form-group">
            <label className="form-label">Razão Social*</label>
            <input
              type="text"
              className="form-input"
              value={editData.razao || ''}
              onChange={(e) => onUpdateEditData({ ...editData, razao: e.target.value })}
              placeholder="Digite a razão social"
            />
          </div>
          <div className="form-group">
            <label className="form-label">N. Fantasia *</label>
            <input
              type="text"
              className="form-input"
              value={editData.fantasia || ''}
              onChange={(e) => onUpdateEditData({ ...editData, fantasia: e.target.value })}
              placeholder="Digite o nome fantasia"
            />
          </div>
          <div className="form-group">
            <label className="form-label">N. Amigável *</label>
            <input
              type="text"
              className="form-input"
              value={editData.amigavel || ''}
              onChange={(e) => onUpdateEditData({ ...editData, amigavel: e.target.value })}
              placeholder="Digite o nome amigável"
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              CNPJ<span className="info-icon" title="O CNPJ vem do contrato que é cadastrado no CLICKUP">
                <i className="fas fa-info-circle"></i>
              </span>
            </label>
            <div className="select-wrapper">
              <select
                className="form-input select-with-icon"
                value={editData.cnpj ? editData.cnpj.replace(/\D/g, '') : ''}
                onChange={(e) => onUpdateEditData({ ...editData, cnpj: e.target.value })}
              >
                <option value="">Selecione o CNPJ</option>
                {cnpjOptions.map((cnpj) => {
                  const cnpjLimpo = cnpj.replace(/\D/g, '');
                  return (
                    <option key={cnpjLimpo} value={cnpjLimpo}>
                      {aplicarMascaraCpfCnpj(cnpjLimpo)}
                    </option>
                  );
                })}
              </select>
              <i className="fas fa-chevron-down select-icon"></i>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <div className="select-wrapper">
              <select
                className="form-input select-with-icon"
                value={editData.status || ''}
                onChange={(e) => onUpdateEditData({ ...editData, status: e.target.value })}
              >
                <option value="">Selecione o status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
              <i className="fas fa-chevron-down select-icon"></i>
            </div>
          </div>
          <div className="form-group" style={{ position: 'relative', zIndex: showKaminoDropdown ? 1001 : 'auto' }}>
            <label className="form-label">Cliente Kamino *</label>
            <div className="select-wrapper searchable-select" style={{ position: 'relative', zIndex: showKaminoDropdown ? 1002 : 'auto' }}>
              <input
                type="text"
                className="form-input select-with-icon searchable-input"
                value={kaminoSearchTerm}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setKaminoSearchTerm(newValue);
                  setShowKaminoDropdown(true);
                  // Se o campo foi limpo, limpar também o kaminoId
                  if (!newValue || newValue.trim() === '') {
                    onUpdateEditData({
                      ...editData,
                      kaminoNome: '',
                      kaminoId: '',
                    });
                  }
                }}
                onFocus={() => {
                  setShowKaminoDropdown(true);
                }}
                onBlur={(e) => {
                  // Não fechar se o clique foi no dropdown
                  const relatedTarget = e.relatedTarget;
                  if (!relatedTarget || !relatedTarget.closest('.dropdown-list')) {
                    setTimeout(() => setShowKaminoDropdown(false), 200);
                  }
                }}
                placeholder="Digite para pesquisar..."
                autoComplete="off"
              />
              <i 
                className="fas fa-chevron-down select-icon" 
                onClick={() => {
                  setShowKaminoDropdown(!showKaminoDropdown);
                }}
                style={{ cursor: 'pointer' }}
              ></i>
              {showKaminoDropdown && (
                <ul 
                  className="dropdown-list" 
                  style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    left: 'auto',
                    width: '150%',
                    minWidth: '300px',
                    maxWidth: '500px',
                    zIndex: 10000,
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginTop: '4px',
                    padding: 0,
                    listStyle: 'none',
                    display: 'block',
                    visibility: 'visible',
                    opacity: 1,
                    textAlign: 'left',
                    transform: 'translateX(0)'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {filteredKamino.length > 0 ? (
                    filteredKamino.slice(0, 100).map((c) => {
                      const nomeExibicao = c.nome_fantasia || 'Cliente sem nome';
                      return (
                        <li
                          key={c.id || nomeExibicao}
                          className="dropdown-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const idMap = clientesKaminoMap.get(c.nome_fantasia) || c.id;
                            onUpdateEditData({
                              ...editData,
                              kaminoNome: nomeExibicao,
                              kaminoId: idMap || c.id || '',
                            });
                            setKaminoSearchTerm(nomeExibicao);
                            setShowKaminoDropdown(false);
                          }}
                          style={{ 
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderBottom: '1px solid #f0f0f0',
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                        >
                          {nomeExibicao}
                        </li>
                      );
                    })
                  ) : allClientesKamino && allClientesKamino.length > 0 ? (
                    <li className="dropdown-item" style={{ color: '#999', fontStyle: 'italic', padding: '8px 12px' }}>
                      Nenhum cliente encontrado para "{kaminoSearchTerm}"
                    </li>
                  ) : (
                    <li className="dropdown-item" style={{ color: '#999', fontStyle: 'italic', padding: '8px 12px' }}>
                      Carregando clientes...
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="inline-save-row">
          <button
            className="client-action-btn activate-btn"
            type="button"
            title="Salvar cliente"
            onClick={() => onSave(client.id)}
          >
            <i className="fas fa-check"></i>
          </button>
        </div>
      </div>
    </div>
  );
});

const GestaoClientes = () => {
  // Estados principais
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStatusFilter, setCurrentStatusFilter] = useState('ativo');
  const [showIncompleteClients, setShowIncompleteClients] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  // Estados para edição inline
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [editingData, setEditingData] = useState({});

  // Estados para modais
  const [showInactivateModal, setShowInactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [currentClientName, setCurrentClientName] = useState('');

  // Estado para armazenar quais clientes têm contratos não inativos
  const [clientesComContratosAtivos, setClientesComContratosAtivos] = useState(new Set());

  // Refs para dados externos
  const allClientesKaminoRef = useRef([]);
  const clientesKaminoMapRef = useRef(new Map());
  const currentRequestControllerRef = useRef(null);

  // Carregar clientes Kamino
  const loadClientesKamino = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes-kamino`, {
        credentials: 'include',
      });
      const result = await response.json();
      if (result && result.success && Array.isArray(result.clientes)) {
        allClientesKaminoRef.current = result.clientes;
        clientesKaminoMapRef.current.clear();
        result.clientes.forEach(cliente => {
          if (cliente && cliente.nome_fantasia && cliente.id) {
            clientesKaminoMapRef.current.set(cliente.nome_fantasia, cliente.id);
          }
        });
      }
    } catch (error) {
      // Erro silencioso ao carregar clientes Kamino
    }
  }, []);

  // Carregar contagem de incompletos
  const loadIncompleteClientsCount = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clientes-incompletos-count`, {
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          setIncompleteCount(parseInt(data.count) || 0);
        }
      }
    } catch (error) {
      // Erro silencioso ao carregar contagem de incompletos
    }
  }, []);

  // Verificar quais clientes têm contratos não inativos
  const verificarContratosAtivos = useCallback(async (clientesList) => {
    if (!showIncompleteClients || !clientesList || clientesList.length === 0) {
      setClientesComContratosAtivos(new Set());
      return;
    }

    try {
      const clientesComContratos = new Set();
      
      // Verificar contratos de cada cliente em paralelo
      const promises = clientesList.map(async (cliente) => {
        try {
          const url = `${API_BASE_URL}/contratos-cliente-id/${encodeURIComponent(String(cliente.id).trim())}`;
          const response = await fetch(url, { credentials: 'include' });
          
          if (response.ok) {
            const result = await response.json();
            if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
              // Verificar se há pelo menos um contrato com status diferente de "inativo"
              const temContratoAtivo = result.data.some(contrato => {
                const status = String(contrato.status || '').toLowerCase().trim();
                return status !== 'inativo' && status !== '';
              });
              
              if (temContratoAtivo) {
                return String(cliente.id);
              }
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      const resultados = await Promise.all(promises);
      resultados.forEach(id => {
        if (id) {
          clientesComContratos.add(id);
        }
      });
      
      setClientesComContratosAtivos(clientesComContratos);
    } catch (error) {
      setClientesComContratosAtivos(new Set());
    }
  }, [showIncompleteClients]);

  // Carregar clientes
  const loadClients = useCallback(async () => {
    // Cancelar requisição anterior se existir
    if (currentRequestControllerRef.current) {
      currentRequestControllerRef.current.abort();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    currentRequestControllerRef.current = controller;

    try {
      setLoading(true);
      
      let url = `${API_BASE_URL}/gestao-clientes?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (searchTerm && searchTerm.trim() !== '') {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      
      if (currentStatusFilter && !showIncompleteClients) {
        url += `&status=${encodeURIComponent(currentStatusFilter)}`;
      }
      
      if (showIncompleteClients) {
        url += `&incompletos=true`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Erro ao carregar clientes (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data || !data.success) {
        throw new Error(data.message || 'Erro ao carregar clientes');
      }
      
      const clientesRaw = Array.isArray(data.data) ? data.data : [];
      
      const processedClients = clientesRaw.map(cliente => {
        const nomeExtraido = cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || 'Nome não informado';
        return {
          id: cliente.id,
          nome: nomeExtraido,
          status: cliente.status || 'ativo',
          clickupNome: cliente.nome || '',
          raw: cliente,
        };
      });
      
      setClientes(processedClients);
      setTotalClients(data.total || 0);
      setTotalPages(data.totalPages || 1);
      
      // Se estiver mostrando pendentes, verificar contratos ativos
      if (showIncompleteClients) {
        verificarContratosAtivos(processedClients);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      if (error.message.includes('401')) {
        window.location.href = '/login';
        return;
      }
    } finally {
      setLoading(false);
      currentRequestControllerRef.current = null;
    }
  }, [currentPage, itemsPerPage, searchTerm, currentStatusFilter, showIncompleteClients, verificarContratosAtivos]);

  // Carregar opções de CNPJ para um cliente
  const loadCnpjOptions = useCallback(async (clientId, clickupName) => {
    try {
      let url;
      if (clickupName && clickupName.trim() !== '') {
        url = `${API_BASE_URL}/contratos-cliente/${encodeURIComponent(String(clickupName).trim())}`;
      } else {
        url = `${API_BASE_URL}/contratos-cliente-id/${encodeURIComponent(String(clientId).trim())}`;
      }
      
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        return [];
      }
      
      const result = await response.json();
      
      if (!result || !result.success) {
        return [];
      }
      
      if (!Array.isArray(result.data)) {
        return [];
      }
      
      const valores = Array.from(new Set(result.data.map(c => c.cpf_cnpj).filter(v => v && v !== 'N/A' && v && v.trim() !== '')));
      
      return valores;
    } catch (error) {
      return [];
    }
  }, []);

  // Salvar cliente inline
  const salvarClienteInline = useCallback(async (id) => {
    try {
      const cliente = clientes.find(c => String(c.id) === String(id));
      if (!cliente) return;

      const editData = editingData[id] || {};
      // Se o campo existe em editData (mesmo que vazio), usar o valor de editData
      // Caso contrário, usar o valor do cliente.raw para manter o valor existente
      const razao = editData.hasOwnProperty('razao') ? editData.razao : (cliente.raw?.razao_social || '');
      const fantasia = editData.hasOwnProperty('fantasia') ? editData.fantasia : (cliente.raw?.nome_fantasia || '');
      const amigavel = editData.hasOwnProperty('amigavel') ? editData.amigavel : (cliente.raw?.nome_amigavel || '');
      // CNPJ: se existe em editData, usar (já vem limpo), senão usar do raw (pode ter formatação)
      const cnpjRaw = editData.hasOwnProperty('cnpj') ? editData.cnpj : (cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '');
      const cnpj = cnpjRaw ? cnpjRaw.replace(/\D/g, '') : '';
      const status = editData.hasOwnProperty('status') ? editData.status : (cliente.raw?.status || '');
      const kaminoNome = editData.hasOwnProperty('kaminoNome') ? editData.kaminoNome : (cliente.raw?.nome_cli_kamino || cliente.raw?.cli_kamino || '');
      const kaminoId = editData.hasOwnProperty('kaminoId') ? editData.kaminoId : (cliente.raw?.id_cli_kamino || cliente.raw?.id_kamino || '');
      const clickupName = cliente.clickupNome || '';

      const sanitize = (v) => {
        const t = String(v || '').trim();
        return t.length ? t : null;
      };
      const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

      // CNPJ já vem limpo, mas garantir que está apenas com números
      const cnpjLimpo = onlyDigits(cnpj);

      const payloadClickup = {
        razao_social: sanitize(razao),
        nome_fantasia: sanitize(fantasia),
        nome_amigavel: sanitize(amigavel),
        cpf_cnpj: sanitize(cnpjLimpo),
        status: sanitize(status),
        clienteKamino: sanitize(kaminoNome),
        idCliKamino: sanitize(kaminoId),
      };
      const payloadById = {
        razao_social: sanitize(razao),
        nome_fantasia: sanitize(fantasia),
        nome_amigavel: sanitize(amigavel),
        cpf_cnpj: sanitize(cnpjLimpo),
        status: sanitize(status),
        nome_cli_kamino: sanitize(kaminoNome),
        id_cli_kamino: sanitize(kaminoId),
      };

      const useClickup = clickupName && clickupName.trim() !== '';
      const endpoint = useClickup
        ? `${API_BASE_URL}/cliente-dados/${encodeURIComponent(clickupName.trim())}`
        : `${API_BASE_URL}/clientes/${id}`;
      
      const resp = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useClickup ? payloadClickup : payloadById),
        credentials: 'include',
      });

      if (!resp.ok) {
        let msg = 'Erro ao salvar';
        try {
          // Clonar a resposta antes de ler o body para evitar erro "body stream already read"
          const clonedResponse = resp.clone();
          const data = await clonedResponse.json().catch(() => null);
          if (data) {
            msg = data.error || data.message || msg;
          } else {
            // Se não conseguir parsear JSON, tentar texto
            const txt = await resp.text().catch(() => 'Erro desconhecido');
            msg = txt || msg;
          }
        } catch (error) {
          msg = `Erro HTTP ${resp.status}: ${resp.statusText}`;
        }
        alert(msg);
        return;
      }

      await loadClients();
      showMessage('Cliente atualizado com sucesso!', 'success');
      setExpandedClientId(null);
      setEditingData({});
    } catch (err) {
      alert(`Falha ao salvar: ${err.message}`);
    }
  }, [clientes, editingData, loadClients]);

  // Mostrar mensagem
  const showMessage = useCallback((message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }, []);

  // Inativar cliente
  const confirmInactivateClient = useCallback(async () => {
    if (!currentClientId) {
      showMessage('Erro: ID do cliente não encontrado', 'error');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clientes/${currentClientId}/inativar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setShowInactivateModal(false);
        showMessage('Cliente inativado com sucesso!', 'success');
        await loadClients();
        await loadIncompleteClientsCount();
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showMessage('Requisição cancelada. Tempo de espera excedido.', 'error');
      } else if (error.message) {
        showMessage('Erro ao inativar cliente: ' + error.message, 'error');
      } else {
        showMessage('Erro ao inativar cliente. Por favor, tente novamente.', 'error');
      }
    }
  }, [currentClientId, loadClients, loadIncompleteClientsCount, showMessage]);

  // Ativar cliente
  const confirmActivateClient = useCallback(async () => {
    if (!currentClientId) {
      showMessage('Erro: ID do cliente não encontrado', 'error');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clientes/${currentClientId}/ativar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setShowActivateModal(false);
        showMessage('Cliente ativado com sucesso!', 'success');
        await loadClients();
        await loadIncompleteClientsCount();
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showMessage('Requisição cancelada. Tempo de espera excedido.', 'error');
      } else if (error.message) {
        showMessage('Erro ao ativar cliente: ' + error.message, 'error');
      } else {
        showMessage('Erro ao ativar cliente. Por favor, tente novamente.', 'error');
      }
    }
  }, [currentClientId, loadClients, loadIncompleteClientsCount, showMessage]);

  // Toggle edição inline
  const toggleInlineEdit = useCallback((id) => {
    if (expandedClientId === id) {
      setExpandedClientId(null);
      setEditingData({});
    } else {
      setExpandedClientId(id);
      const cliente = clientes.find(c => String(c.id) === String(id));
      if (cliente) {
        // Garantir que o CNPJ seja apenas números para comparação no select
        const cnpjRaw = cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '';
        const cnpjLimpo = cnpjRaw ? cnpjRaw.replace(/\D/g, '') : '';
        setEditingData({
          [id]: {
            razao: cliente.raw?.razao_social || '',
            fantasia: cliente.raw?.nome_fantasia || '',
            amigavel: cliente.raw?.nome_amigavel || '',
            cnpj: cnpjLimpo,
            status: cliente.raw?.status || '',
            kaminoNome: cliente.raw?.nome_cli_kamino || cliente.raw?.cli_kamino || '',
            kaminoId: cliente.raw?.id_cli_kamino || cliente.raw?.id_kamino || '',
          },
        });
      }
    }
  }, [expandedClientId, clientes]);

  // Toggle filtro de status
  const handleStatusToggle = useCallback((checked) => {
    setCurrentStatusFilter(checked ? 'inativo' : 'ativo');
    setShowIncompleteClients(false);
    setCurrentPage(1);
  }, []);

  // Toggle clientes incompletos
  const toggleIncompleteClients = useCallback(() => {
    setShowIncompleteClients(prev => !prev);
    setCurrentStatusFilter(null);
    setCurrentPage(1);
  }, []);

  // Debounce para busca
  const searchTimeoutRef = useRef(null);
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
  }, []);

  // Limpar estado de contratos ativos quando sair da visualização de pendentes
  useEffect(() => {
    if (!showIncompleteClients) {
      setClientesComContratosAtivos(new Set());
    }
  }, [showIncompleteClients]);

  // Efeitos
  useEffect(() => {
    loadClientesKamino();
    loadIncompleteClientsCount();
  }, [loadClientesKamino, loadIncompleteClientsCount]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Calcular range de itens exibidos
  const startItem = totalClients === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, clientes.length) - 1, totalClients);

  return (
    <Layout>
      <style>{inlineStyles}</style>
      <div className="container">
        <main className="clients-listing-section">
          <div className="form-header">
            <h2 className="form-title">Gestão de Clientes</h2>
            <p className="form-subtitle" style={{ display: showIncompleteClients ? 'none' : 'block' }}>
              {currentStatusFilter === 'ativo' 
                ? 'Gerencie seus clientes ATIVOS'
                : currentStatusFilter === 'inativo'
                ? 'Gerencie seus clientes Inativos'
                : 'Gerencie seus clientes cadastrados'}
            </p>
          </div>
          
          {/* Filtro de busca e botão adicionar */}
          <div className="listing-controls">
            <div className="search-container">
              <div className="search-input-wrapper">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  id="clientSearchFilter"
                  className="search-input"
                  placeholder="Buscar cliente por nome amigavel..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="listing-controls-right">
              {/* Toggle Switch minimalista para Filtro de Status */}
              <div className="status-toggle-minimal">
                <span 
                  id="activeLabel"
                  className={`toggle-option-minimal ${currentStatusFilter === 'ativo' ? 'active' : ''}`}
                  onClick={() => handleStatusToggle(false)}
                >
                  Ativos
                </span>
                <div className="toggle-switch-minimal" id="statusToggle">
                  <input
                    type="checkbox"
                    id="statusToggleInput"
                    className="toggle-input-minimal"
                    checked={currentStatusFilter === 'inativo'}
                    onChange={(e) => handleStatusToggle(e.target.checked)}
                  />
                  <label htmlFor="statusToggleInput" className="toggle-slider-minimal"></label>
                </div>
                <span 
                  id="inactiveLabel"
                  className={`toggle-option-minimal ${currentStatusFilter === 'inativo' ? 'active' : ''}`}
                  onClick={() => handleStatusToggle(true)}
                >
                  Inativos
                </span>
              </div>
              {/* Botão para Clientes Incompletos */}
              <button
                id="incompleteClientsBtn"
                className={`incomplete-clients-btn ${showIncompleteClients ? 'active' : ''}`}
                onClick={toggleIncompleteClients}
              >
                <i className="fas fa-exclamation-triangle"></i>
                Pendentes
                <span className="incomplete-badge" id="incompleteBadge" style={{ display: incompleteCount > 0 ? 'flex' : 'none' }}>
                  {incompleteCount}
                </span>
              </button>
            </div>
          </div>
          
          {/* Descrição para clientes incompletos */}
          <div id="incompleteDescription" className="incomplete-description" style={{ display: showIncompleteClients ? 'block' : 'none' }}>
            <p>Clientes com cadastro incompleto</p>
          </div>
          
          {/* Lista de clientes */}
          <div className="clients-list-container">
            <div className="clients-simple-list" id="clientsSimpleList">
              {loading ? (
                <div className="loading-message" id="clientsLoadingMessage">
                  <i className="fas fa-spinner fa-spin"></i>
                  Carregando clientes...
                </div>
              ) : clientes.length === 0 ? (
                <div className="no-clients-message">
                  <i className="fas fa-users"></i>
                  <p>Nenhum cliente encontrado</p>
                </div>
              ) : (
                clientes.map((client) => {
                  const isAtivo = client.status === 'ativo';
                  const statusClass = isAtivo ? 'status-ativo' : 'status-inativo';
                  const isExpanded = expandedClientId === client.id;
                  const editData = editingData[client.id] || {};
                  
                  // Verificar se o cliente tem contratos não inativos (apenas quando mostrar pendentes)
                  const temContratosAtivos = showIncompleteClients && clientesComContratosAtivos.has(String(client.id));
                  const highlightClass = temContratosAtivos ? 'has-active-contracts' : '';

                  return (
                    <React.Fragment key={client.id}>
                      <div 
                        className={`client-list-item ${statusClass} ${highlightClass}`} 
                        data-client-id={client.id} 
                        data-client-status={client.status}
                        style={temContratosAtivos ? {
                          border: '2px solid #10b981',
                          borderRadius: '8px',
                          boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.1)'
                        } : {}}
                      >
                        <div className="client-header">
                          <p className="client-name">{client.nome}</p>
                          <div className="client-actions">
                            <button
                              className="client-action-btn edit-btn edit-anim"
                              onClick={() => toggleInlineEdit(client.id)}
                              title="Editar cliente"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 512 512"
                                className="edit-anim-icon"
                              >
                                <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                              </svg>
                            </button>
                            {isAtivo ? (
                              <button
                                className="client-action-btn inactivate-btn"
                                onClick={() => {
                                  setCurrentClientId(client.id);
                                  setCurrentClientName(client.nome);
                                  setShowInactivateModal(true);
                                }}
                                title="Inativar cliente"
                              >
                                <svg viewBox="0 0 512 512" className="icon-ban" width="14" height="14">
                                  <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
                                  <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
                                  <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
                                </svg>
                              </button>
                            ) : (
                              <button
                                className="client-action-btn activate-btn"
                                onClick={() => {
                                  setCurrentClientId(client.id);
                                  setCurrentClientName(client.nome);
                                  setShowActivateModal(true);
                                }}
                                title="Ativar cliente"
                              >
                                <i className="fas fa-check-circle"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <InlineEditForm
                        client={client}
                        editData={editData}
                        isExpanded={isExpanded}
                        onUpdateEditData={(newData) => {
                          setEditingData({
                            ...editingData,
                            [client.id]: newData,
                          });
                        }}
                        onSave={salvarClienteInline}
                        allClientesKamino={allClientesKaminoRef.current}
                        clientesKaminoMap={clientesKaminoMapRef.current}
                        loadCnpjOptions={loadCnpjOptions}
                      />
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Controles de Paginação */}
          <div className="pagination-container" id="paginationContainer" style={{ display: totalClients > 0 ? 'flex' : 'none' }}>
              <div className="pagination-limit-selector">
                <label htmlFor="paginationLimit">Exibir:</label>
                <select
                  id="paginationLimit"
                  className="pagination-limit-select"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value="10">10 itens</option>
                  <option value="20">20 itens</option>
                  <option value="30">30 itens</option>
                </select>
              </div>
              
              <div className="pagination-info">
                <span id="paginationInfo">Mostrando {startItem} a {endItem} de {totalClients} clientes</span>
              </div>
              
              <div className="pagination-controls">
                <button
                  id="firstPageBtn"
                  className="pagination-btn"
                  title="Primeira página"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button
                  id="prevPageBtn"
                  className="pagination-btn"
                  title="Página anterior"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <i className="fas fa-angle-left"></i>
                </button>
                
                <span className="pagination-current">
                  Página <span id="currentPageDisplay">{currentPage}</span> de <span id="totalPagesDisplay">{totalPages}</span>
                </span>
                
                <button
                  id="nextPageBtn"
                  className="pagination-btn"
                  title="Próxima página"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button
                  id="lastPageBtn"
                  className="pagination-btn"
                  title="Última página"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
        </main>
      </div>
      
      {/* Modal de Confirmação para Inativar Cliente */}
      <div id="inactivateModal" className="modal-overlay" style={{ display: showInactivateModal ? 'flex' : 'none' }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <h3 className="modal-title-simple">Confirmar inativar cliente <span id="modalClientName">{currentClientName}</span>?</h3>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={() => setShowInactivateModal(false)}>
              Cancelar
            </button>
            <button className="btn-confirm" id="confirmInactivateBtn" onClick={confirmInactivateClient}>
              Confirmar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação para Ativar Cliente */}
      <div id="activateModal" className="modal-overlay" style={{ display: showActivateModal ? 'flex' : 'none' }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <h3 className="modal-title-simple">Confirmar ativar cliente <span id="modalActivateClientName">{currentClientName}</span>?</h3>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={() => setShowActivateModal(false)}>
              Cancelar
            </button>
            <button className="btn-confirm activate-btn" id="confirmActivateBtn" onClick={confirmActivateClient}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default memo(GestaoClientes);

