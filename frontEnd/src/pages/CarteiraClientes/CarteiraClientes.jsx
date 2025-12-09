import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import Layout from '../../components/layout/Layout';
import ClienteTable from '../../components/clients/ClienteTable';
import ClienteModal from '../../components/clients/ClienteModal';
import InactiveButton from '../../components/common/InactiveButton';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterClientes from '../../components/filters/FilterClientes';
import { clientesAPI } from '../../services/api';
import '../../styles/global.css';
import './CarteiraClientes.css';

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

const GestaoClientes = () => {
  // Estados principais
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroClienteId, setFiltroClienteId] = useState(null);
  const [clientesParaFiltro, setClientesParaFiltro] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [showIncompleteClients, setShowIncompleteClients] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  // Estados para modal de edição
  const [showModalEditarCliente, setShowModalEditarCliente] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [clienteEditFormData, setClienteEditFormData] = useState({
    id: null,
    razao: '',
    fantasia: '',
    amigavel: '',
    cnpj: '',
    status: '',
    kaminoNome: '',
    kaminoId: '',
    clickupNome: ''
  });
  const [clienteEditFormErrors, setClienteEditFormErrors] = useState({});
  const [submittingEditCliente, setSubmittingEditCliente] = useState(false);
  const [cnpjOptionsModal, setCnpjOptionsModal] = useState([]);

  // Estados para modais de confirmação
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

  // Carregar clientes para o filtro
  const loadClientesParaFiltro = useCallback(async () => {
    try {
      // Usar getAll igual ao DashboardClientes
      const result = await clientesAPI.getAll(null, false);
      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os clientes tenham nome e status
        const clientesComDados = result.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`,
          status: cliente.status || 'ativo'
        }));
        setClientesParaFiltro(clientesComDados);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes para filtro:', error);
      setClientesParaFiltro([]);
    }
  }, []);

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
          const count = parseInt(data.count) || 0;
          setIncompleteCount(count);
        }
      } else {
        console.error('Erro ao carregar contagem de incompletos:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao carregar contagem de incompletos:', error);
      }
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
      
      // Verificar se há filtro de cliente
      const temFiltroCliente = filtroClienteId && Array.isArray(filtroClienteId) && filtroClienteId.length > 0;
      
      // Quando há filtro, buscar todos os clientes (até 10000) para filtrar no frontend
      // Quando não há filtro, usar paginação normal no backend
      const limitParaBusca = temFiltroCliente ? 10000 : itemsPerPage;
      const pageParaBusca = temFiltroCliente ? 1 : currentPage;
      
      let url = `${API_BASE_URL}/cadastro/clientes?page=${pageParaBusca}&limit=${limitParaBusca}`;
      
      if (!showIncompleteClients) {
        url += `&status=${encodeURIComponent(mostrarInativos ? 'inativo' : 'ativo')}`;
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
      
      let clientesRaw = Array.isArray(data.data) ? data.data : [];
      
      // Aplicar filtro de cliente no frontend se houver
      if (temFiltroCliente) {
        const filtroIds = filtroClienteId.map(id => String(id).trim());
        // Filtrar todos os clientes que correspondem aos IDs selecionados
        const clientesFiltrados = clientesRaw.filter(cliente => 
          filtroIds.includes(String(cliente.id).trim())
        );
        
        // Aplicar paginação no frontend após filtrar
        const offset = (currentPage - 1) * itemsPerPage;
        clientesRaw = clientesFiltrados.slice(offset, offset + itemsPerPage);
        
        // Total é o número de clientes filtrados
        const totalFiltrados = clientesFiltrados.length;
        
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
        setTotalClients(totalFiltrados);
        setTotalPages(Math.max(1, Math.ceil(totalFiltrados / itemsPerPage)));
      } else {
        // Sem filtro, usar dados paginados normalmente
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
      }
      
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
  }, [currentPage, itemsPerPage, filtroClienteId, mostrarInativos, showIncompleteClients, verificarContratosAtivos]);

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

  // Abrir modal de editar cliente
  const handleEdit = useCallback(async (cliente) => {
    // Carregar opções de CNPJ
    const options = await loadCnpjOptions(cliente.id, cliente.clickupNome);
    const cnpjSalvo = cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '';
    let finalOptions = options;
    if (cnpjSalvo) {
      const cnpjLimpo = cnpjSalvo.replace(/\D/g, '');
      const optionsLimpos = options.map(opt => opt.replace(/\D/g, ''));
      if (!optionsLimpos.includes(cnpjLimpo)) {
        finalOptions = [...options, cnpjLimpo];
      }
    }
    setCnpjOptionsModal(finalOptions);

    // Garantir que o CNPJ seja apenas números
    const cnpjRaw = cliente.raw?.cpf_cnpj || cliente.raw?.cnpj_cpf || '';
    const cnpjLimpo = cnpjRaw ? cnpjRaw.replace(/\D/g, '') : '';

    setClienteEditFormData({
      id: cliente.id,
      razao: cliente.raw?.razao_social || '',
      fantasia: cliente.raw?.nome_fantasia || '',
      amigavel: cliente.raw?.nome_amigavel || '',
      cnpj: cnpjLimpo,
      status: cliente.raw?.status || '',
      kaminoNome: cliente.raw?.nome_cli_kamino || cliente.raw?.cli_kamino || '',
      kaminoId: cliente.raw?.id_cli_kamino || cliente.raw?.id_kamino || '',
      clickupNome: cliente.clickupNome || ''
    });
    setClienteEditFormErrors({});
    setClienteEditando(cliente);
    setShowModalEditarCliente(true);
  }, [loadCnpjOptions]);

  // Fechar modal de editar cliente
  const fecharModalEditarCliente = useCallback(() => {
    setShowModalEditarCliente(false);
    setClienteEditando(null);
    setClienteEditFormData({
      id: null,
      razao: '',
      fantasia: '',
      amigavel: '',
      cnpj: '',
      status: '',
      kaminoNome: '',
      kaminoId: '',
      clickupNome: ''
    });
    setClienteEditFormErrors({});
    setCnpjOptionsModal([]);
  }, []);

  // Salvar edição de cliente
  const handleSalvarEditarCliente = useCallback(async (e) => {
    e.preventDefault();
    if (!clienteEditando) return;

    setSubmittingEditCliente(true);
    setClienteEditFormErrors({});

    try {
      const sanitize = (v) => {
        const t = String(v || '').trim();
        return t.length ? t : null;
      };
      const onlyDigits = (v) => String(v || '').replace(/\D+/g, '');

      const cnpjLimpo = onlyDigits(clienteEditFormData.cnpj);

      const payloadClickup = {
        razao_social: sanitize(clienteEditFormData.razao),
        nome_fantasia: sanitize(clienteEditFormData.fantasia),
        nome_amigavel: sanitize(clienteEditFormData.amigavel),
        cpf_cnpj: sanitize(cnpjLimpo),
        status: sanitize(clienteEditFormData.status),
        clienteKamino: sanitize(clienteEditFormData.kaminoNome),
        idCliKamino: sanitize(clienteEditFormData.kaminoId),
      };
      const payloadById = {
        razao_social: sanitize(clienteEditFormData.razao),
        nome_fantasia: sanitize(clienteEditFormData.fantasia),
        nome_amigavel: sanitize(clienteEditFormData.amigavel),
        cpf_cnpj: sanitize(cnpjLimpo),
        status: sanitize(clienteEditFormData.status),
        nome_cli_kamino: sanitize(clienteEditFormData.kaminoNome),
        id_cli_kamino: sanitize(clienteEditFormData.kaminoId),
      };

      const useClickup = clienteEditFormData.clickupNome && clienteEditFormData.clickupNome.trim() !== '';
      const endpoint = useClickup
        ? `${API_BASE_URL}/cliente-dados/${encodeURIComponent(clienteEditFormData.clickupNome.trim())}`
        : `${API_BASE_URL}/clientes/${clienteEditando.id}`;
      
      const resp = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useClickup ? payloadClickup : payloadById),
        credentials: 'include',
      });

      if (resp.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || data?.message || 'Erro ao salvar cliente');
      }

      const result = await resp.json();
      if (result.success) {
        showMessage('Cliente atualizado com sucesso!', 'success');
        fecharModalEditarCliente();
        await loadClients();
      } else {
        throw new Error(result.error || 'Erro ao salvar cliente');
      }
    } catch (error) {
      showMessage(error.message || 'Erro ao salvar cliente. Tente novamente.', 'error');
    } finally {
      setSubmittingEditCliente(false);
    }
  }, [clienteEditando, clienteEditFormData, loadClients, showMessage, fecharModalEditarCliente]);

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

  // Handlers para inativar/ativar
  const handleInativar = useCallback((cliente) => {
    setCurrentClientId(cliente.id);
    setCurrentClientName(cliente.nome);
    setShowInactivateModal(true);
  }, []);

  const handleAtivar = useCallback((cliente) => {
    setCurrentClientId(cliente.id);
    setCurrentClientName(cliente.nome);
    setShowActivateModal(true);
  }, []);

  // Toggle clientes incompletos
  const toggleIncompleteClients = useCallback(() => {
    setShowIncompleteClients(prev => !prev);
    setCurrentPage(1);
  }, []);

  // Handler para filtro de cliente
  const handleFiltroClienteChange = useCallback((e) => {
    const selectedIds = e.target.value;
    const idsArray = selectedIds 
      ? (Array.isArray(selectedIds) 
          ? selectedIds.map(id => String(id)) 
          : [String(selectedIds)])
      : null;
    setFiltroClienteId(idsArray);
    setCurrentPage(1);
  }, []);

  // Limpar filtros
  const limparFiltros = useCallback(() => {
    setFiltroClienteId(null);
    setCurrentPage(1);
  }, []);

  // Limpar estado de contratos ativos quando sair da visualização de pendentes
  useEffect(() => {
    if (!showIncompleteClients) {
      setClientesComContratosAtivos(new Set());
    }
  }, [showIncompleteClients]);

  // Efeitos
  // Carregar dados iniciais no mount
  useEffect(() => {
    loadClientesKamino();
    loadIncompleteClientsCount();
    loadClientesParaFiltro();
  }, [loadClientesKamino, loadIncompleteClientsCount, loadClientesParaFiltro]);

  // Garantir que o contador seja carregado no início
  useEffect(() => {
    loadIncompleteClientsCount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Calcular range de itens exibidos
  const startItem = totalClients === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, clientes.length) - 1, totalClients);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="colaboradores-listing-section">
            <div className="form-header">
              <div>
                <h2 className="form-title">Clientes</h2>
                <p className="form-subtitle" style={{ display: showIncompleteClients ? 'none' : 'block' }}>
                  {mostrarInativos 
                    ? 'Gerencie seus clientes Inativos'
                    : 'Gerencie seus clientes ATIVOS'}
                </p>
              </div>
            </div>
            
            {/* Controles acima dos filtros */}
            <div className="listing-controls" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
              <div className="listing-controls-right">
                <InactiveButton
                  active={mostrarInativos}
                  onClick={() => {
                    setMostrarInativos(!mostrarInativos);
                    setShowIncompleteClients(false);
                    setCurrentPage(1);
                  }}
                  label="Inativos"
                />
                {/* Botão para Clientes Incompletos */}
                <button
                  id="incompleteClientsBtn"
                  className={`incomplete-clients-btn ${showIncompleteClients ? 'active' : ''}`}
                  onClick={toggleIncompleteClients}
                >
                  <i className="fas fa-exclamation-triangle"></i>
                  Pendentes
                  {incompleteCount > 0 ? (
                    <span className="incomplete-badge" id="incompleteBadge">
                      {incompleteCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {/* Filtros */}
            <FiltersCard
              onClear={limparFiltros}
              showActions={true}
            >
              <div className="filter-group" style={{ flex: '1', minWidth: '300px' }}>
                <FilterClientes
                  value={filtroClienteId}
                  onChange={handleFiltroClienteChange}
                  options={clientesParaFiltro.filter(cliente => {
                    // Se mostrarInativos estiver desativado, filtrar clientes inativos
                    if (!mostrarInativos) {
                      const status = cliente.status || 'ativo';
                      return status !== 'inativo';
                    }
                    // Se mostrarInativos estiver ativado, mostrar todos os clientes
                    return true;
                  })}
                  disabled={false}
                />
              </div>
            </FiltersCard>
              
            {/* Descrição para clientes incompletos */}
            <div id="incompleteDescription" className="incomplete-description" style={{ display: showIncompleteClients ? 'block' : 'none', marginBottom: '16px' }}>
              <p>Clientes com cadastro incompleto</p>
            </div>
            
            {/* Tabela de clientes */}
            <div className="listing-table-container view-transition view-enter">
              <ClienteTable
                clientes={clientes}
                loading={loading}
                onEdit={handleEdit}
                onInativar={handleInativar}
                onAtivar={handleAtivar}
                clientesComContratosAtivos={clientesComContratosAtivos}
                showIncompleteClients={showIncompleteClients}
              />
              {!loading && clientes.length > 0 && (
                <>
                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || loading}
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <span className="pagination-info">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || loading}
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  )}

                  {/* Info de paginação */}
                  <div className="pagination-info-bottom">
                    Mostrando {startItem} a {endItem} de {totalClients} clientes
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Modal de Editar Cliente */}
      <ClienteModal
        isOpen={showModalEditarCliente && !!clienteEditando}
        onClose={fecharModalEditarCliente}
        onSubmit={handleSalvarEditarCliente}
        formData={clienteEditFormData}
        setFormData={setClienteEditFormData}
        formErrors={clienteEditFormErrors}
        setFormErrors={setClienteEditFormErrors}
        submitting={submittingEditCliente}
        allClientesKamino={allClientesKaminoRef.current}
        clientesKaminoMap={clientesKaminoMapRef.current}
        cnpjOptions={cnpjOptionsModal}
        loadCnpjOptions={loadCnpjOptions}
        clienteEditando={clienteEditando}
      />

      {/* Modal de Confirmação para Inativar Cliente */}
      <div id="inactivateModal" className="modal-overlay" style={{ display: showInactivateModal ? 'flex' : 'none' }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <h3 className="modal-title-simple">Confirmar inativar cliente <span id="modalClientName">{currentClientName}</span>?</h3>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setShowInactivateModal(false)}>
              Cancelar
            </button>
            <button className="btn-danger" id="confirmInactivateBtn" onClick={confirmInactivateClient}>
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
            <button className="btn-secondary" onClick={() => setShowActivateModal(false)}>
              Cancelar
            </button>
            <button className="btn-success" id="confirmActivateBtn" onClick={confirmActivateClient}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default memo(GestaoClientes);

