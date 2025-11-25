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
        setCnpjOptions(options);
      });
      setKaminoSearchTerm(editData.kaminoNome || '');
    }
  }, [isExpanded, client.id, client.clickupNome, editData.kaminoNome, loadCnpjOptions]);

  // Filtrar clientes Kamino
  const filteredKamino = React.useMemo(() => {
    if (!allClientesKamino || !Array.isArray(allClientesKamino) || allClientesKamino.length === 0) {
      console.warn('⚠️ InlineEditForm - allClientesKamino está vazio ou inválido:', allClientesKamino);
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

  // Debug: verificar dados
  useEffect(() => {
    if (isExpanded) {
      console.log('🔍 InlineEditForm - allClientesKamino:', allClientesKamino);
      console.log('🔍 InlineEditForm - allClientesKamino length:', allClientesKamino?.length);
      console.log('🔍 InlineEditForm - filteredKamino:', filteredKamino);
      console.log('🔍 InlineEditForm - filteredKamino length:', filteredKamino.length);
      console.log('🔍 InlineEditForm - kaminoSearchTerm:', kaminoSearchTerm);
      console.log('🔍 InlineEditForm - showKaminoDropdown:', showKaminoDropdown);
      console.log('🔍 InlineEditForm - clientesKaminoMap size:', clientesKaminoMap?.size);
    }
  }, [isExpanded, allClientesKamino, filteredKamino, kaminoSearchTerm, showKaminoDropdown, clientesKaminoMap]);

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
                value={editData.cnpj || ''}
                onChange={(e) => onUpdateEditData({ ...editData, cnpj: e.target.value })}
              >
                <option value="">Selecione o CNPJ</option>
                {cnpjOptions.map((cnpj) => (
                  <option key={cnpj} value={cnpj}>
                    {aplicarMascaraCpfCnpj(cnpj)}
                  </option>
                ))}
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
                  setKaminoSearchTerm(e.target.value);
                  setShowKaminoDropdown(true);
                }}
                onFocus={() => {
                  console.log('🔍 Campo Cliente Kamino focado');
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
                  console.log('🔍 Ícone clicado, showKaminoDropdown:', !showKaminoDropdown);
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
                            console.log('✅ Cliente Kamino selecionado:', nomeExibicao, 'ID:', c.id);
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

const CarteiraClientes = () => {
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

  // Refs para dados externos
  const allClientesKaminoRef = useRef([]);
  const clientesKaminoMapRef = useRef(new Map());
  const currentRequestControllerRef = useRef(null);

  // Carregar clientes Kamino
  const loadClientesKamino = useCallback(async () => {
    try {
      console.log('📡 Carregando clientes Kamino...');
      const response = await fetch(`${API_BASE_URL}/clientes-kamino`, {
        credentials: 'include',
      });
      const result = await response.json();
      console.log('📡 Resultado da API clientes-kamino:', result);
      if (result && result.success && Array.isArray(result.clientes)) {
        allClientesKaminoRef.current = result.clientes;
        clientesKaminoMapRef.current.clear();
        result.clientes.forEach(cliente => {
          if (cliente && cliente.nome_fantasia && cliente.id) {
            clientesKaminoMapRef.current.set(cliente.nome_fantasia, cliente.id);
          }
        });
        console.log(`✅ ${result.clientes.length} clientes Kamino carregados`);
        console.log('📋 Mapa de clientes:', Array.from(clientesKaminoMapRef.current.entries()));
      } else {
        console.warn('⚠️ Resposta da API não contém clientes válidos:', result);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes Kamino:', error);
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
      if (error.name !== 'AbortError') {
        console.error('Erro ao carregar contagem de incompletos:', error);
      }
    }
  }, []);

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
      
      let url = `${API_BASE_URL}/carteira-clientes?page=${currentPage}&limit=${itemsPerPage}`;
      
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
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      if (error.message.includes('401')) {
        window.location.href = '/login';
        return;
      }
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
      currentRequestControllerRef.current = null;
    }
  }, [currentPage, itemsPerPage, searchTerm, currentStatusFilter, showIncompleteClients]);

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
      if (!response.ok) return [];
      
      const result = await response.json();
      const valores = (result && result.success && Array.isArray(result.data))
        ? Array.from(new Set(result.data.map(c => c.cpf_cnpj).filter(v => v && v !== 'N/A')))
        : [];
      
      return valores;
    } catch (error) {
      console.error('Erro ao carregar opções de CNPJ:', error);
      return [];
    }
  }, []);

  // Salvar cliente inline
  const salvarClienteInline = useCallback(async (id) => {
    try {
      const cliente = clientes.find(c => String(c.id) === String(id));
      if (!cliente) return;

      const editData = editingData[id] || {};
      const razao = editData.razao || cliente.raw?.razao_social || '';
      const fantasia = editData.fantasia || cliente.raw?.nome_fantasia || '';
      const amigavel = editData.amigavel || cliente.raw?.nome_amigavel || '';
      const cnpj = editData.cnpj || cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '';
      const status = editData.status || cliente.raw?.status || '';
      const kaminoNome = editData.kaminoNome || cliente.raw?.nome_cli_kamino || cliente.raw?.cli_kamino || '';
      const kaminoId = editData.kaminoId || '';
      const clickupName = cliente.clickupNome || '';

      const sanitize = (v) => {
        const t = String(v || '').trim();
        return t.length ? t : null;
      };
      const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

      const payloadClickup = {
        razao_social: sanitize(razao),
        nome_fantasia: sanitize(fantasia),
        nome_amigavel: sanitize(amigavel),
        cpf_cnpj: sanitize(onlyDigits(cnpj)),
        status: sanitize(status),
        clienteKamino: sanitize(kaminoNome),
        idCliKamino: sanitize(kaminoId),
      };
      const payloadById = {
        razao_social: sanitize(razao),
        nome_fantasia: sanitize(fantasia),
        nome_amigavel: sanitize(amigavel),
        cpf_cnpj: sanitize(onlyDigits(cnpj)),
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
          const data = await resp.json();
          msg = data && (data.error || data.message || msg);
        } catch (_) {
          const txt = await resp.text();
          msg = txt || msg;
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
        setEditingData({
          [id]: {
            razao: cliente.raw?.razao_social || '',
            fantasia: cliente.raw?.nome_fantasia || '',
            amigavel: cliente.raw?.nome_amigavel || '',
            cnpj: cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '',
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
            <h2 className="form-title">Carteira de Clientes</h2>
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

                  return (
                    <React.Fragment key={client.id}>
                      <div className={`client-list-item ${statusClass}`} data-client-id={client.id} data-client-status={client.status}>
                        <div className="client-header">
                          <p className="client-name">{client.nome}</p>
                          <div className="client-actions">
                            <button
                              className="client-action-btn edit-btn"
                              onClick={() => toggleInlineEdit(client.id)}
                              title="Editar cliente"
                            >
                              <i className="fas fa-pencil-alt"></i>
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
                                <i className="fas fa-ban"></i>
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

export default memo(CarteiraClientes);

