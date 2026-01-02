import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ClienteTable from '../../components/clients/ClienteTable';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterClientes from '../../components/filters/FilterClientes';
import ConfirmModal from '../../components/common/ConfirmModal';
import { clientesAPI } from '../../services/api';
import '../../styles/global.css';
import './CadastroClientes.css';

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

const CadastroClientes = () => {
  const navigate = useNavigate();
  
  // Estados principais
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroClienteId, setFiltroClienteId] = useState(null);
  const [clientesParaFiltro, setClientesParaFiltro] = useState([]);

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);


  // Estados para modais de confirmação
  const [showInactivateModal, setShowInactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [currentClientName, setCurrentClientName] = useState('');
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Refs para dados externos
  const allClientesKaminoRef = useRef([]);
  const clientesKaminoMapRef = useRef(new Map());
  const currentRequestControllerRef = useRef(null);

  // Carregar clientes para o filtro - buscar TODOS sem limite
  const loadClientesParaFiltro = useCallback(async () => {
    try {
      // Buscar todos os clientes sem limite de paginação
      const params = new URLSearchParams({
        page: '1',
        limit: '10000' // Limite alto para pegar todos os clientes
      });

      const response = await fetch(`${API_BASE_URL}/clientes?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os clientes tenham nome e status
        const clientesComDados = result.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || `Cliente #${cliente.id}`,
          status: cliente.status || 'ativo'
        }));
        console.log(`✅ Carregados ${clientesComDados.length} clientes para o filtro (Cadastro Clientes)`);
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
      
      let url = `${API_BASE_URL}/clientes?page=${pageParaBusca}&limit=${limitParaBusca}`;
      
      // Removida validação de status e incompletos - sempre lista todos os clientes
      
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
      
      // Log para debug: verificar se os dados estão completos
      if (clientesRaw.length > 0) {
        console.log('📋 DADOS DO GETCLIENTES (Cadastro Clientes - primeiro cliente):', clientesRaw[0]);
        const primeiroCliente = clientesRaw[0];
        const camposEsperados = ['id', 'nome', 'razao_social', 'nome_fantasia', 'nome_amigavel', 'cpf_cnpj', 'status', 'foto_perfil'];
        const camposPresentes = camposEsperados.filter(campo => primeiroCliente.hasOwnProperty(campo));
        console.log(`✅ Campos presentes: ${camposPresentes.length}/${camposEsperados.length}`, camposPresentes);
      }
      
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
  }, [currentPage, itemsPerPage, filtroClienteId]);

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

  // Navegar para página de editar cliente
  const handleEdit = useCallback((cliente) => {
    navigate(`/cadastro/cliente?id=${cliente.id}`, {
      state: { from: '/cadastro/clientes' }
    });
  }, [navigate]);

  // Inativar cliente
  const confirmInactivateClient = useCallback(async () => {
    if (!currentClientId) {
      showMessage('Erro: ID do cliente não encontrado', 'error');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clientes/${currentClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inativo' }),
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
  }, [currentClientId, loadClients, showMessage]);

  // Ativar cliente
  const confirmActivateClient = useCallback(async () => {
    if (!currentClientId) {
      showMessage('Erro: ID do cliente não encontrado', 'error');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/clientes/${currentClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ativo' }),
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
  }, [currentClientId, loadClients, showMessage]);

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

  // Handler para deletar
  const handleDelete = useCallback((cliente) => {
    setClienteToDelete(cliente);
    setShowDeleteModal(true);
  }, []);

  // Confirmar exclusão
  const confirmDelete = useCallback(async () => {
    if (!clienteToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${clienteToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showMessage('Cliente deletado com sucesso!', 'success');
        setShowDeleteModal(false);
        setClienteToDelete(null);
        await loadClients();
      } else {
        throw new Error(result.error || 'Erro ao deletar cliente');
      }
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      showMessage(error.message || 'Erro ao deletar cliente. Tente novamente.', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [clienteToDelete, loadClients, showMessage]);

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

  // Efeitos
  // Carregar dados iniciais no mount
  useEffect(() => {
    // Removido loadClientesKamino - será carregado apenas quando necessário no formulário
    loadClientesParaFiltro();
  }, [loadClientesParaFiltro]);

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
            <div className="cadastro-listing-page-header">
              <div className="cadastro-listing-header-content">
                <div className="cadastro-listing-header-left">
                  <div className="cadastro-listing-header-icon">
                    <i className="fas fa-briefcase" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                  </div>
                  <div>
                    <h1 className="cadastro-listing-page-title">Cadastro Clientes</h1>
                    <p className="cadastro-listing-page-subtitle">
                      Gerencie seus clientes
                    </p>
                  </div>
                </div>
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
                  options={clientesParaFiltro}
                  disabled={false}
                />
              </div>
            </FiltersCard>
              
            {/* Tabela de clientes */}
            <div className="listing-table-container view-transition view-enter">
              <ClienteTable
                clientes={clientes}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onInativar={handleInativar}
                onAtivar={handleAtivar}
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

      {/* Modal de Confirmação para Deletar Cliente */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setClienteToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message={
          clienteToDelete ? (
            <>
              <p>
                Tem certeza que deseja deletar o cliente{' '}
                <strong>{clienteToDelete.nome || clienteToDelete.raw?.nome_amigavel || clienteToDelete.raw?.nome_fantasia || clienteToDelete.raw?.razao_social || 'este cliente'}</strong>?
              </p>
              <p className="warning-text" style={{ color: '#ef4444', marginTop: '10px' }}>
                Esta ação não pode ser desfeita.
              </p>
            </>
          ) : null
        }
        confirmText="Deletar"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleteLoading}
      />
    </Layout>
  );
};

export default memo(CadastroClientes);

