import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import IconButton from '../../components/common/IconButton';
import DetailSideCard from '../../components/clients/DetailSideCard';
import Avatar from '../../components/user/Avatar';
import FilterClientes from '../../components/filters/FilterClientes';
import FiltersCard from '../../components/filters/FiltersCard';
import { DEFAULT_AVATAR } from '../../utils/avatars';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import './ConteudosClientes.css';

const API_BASE_URL = '/api';

const ConteudosClientes = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estados principais
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClientes, setTotalClientes] = useState(0);
  const [viewMode, setViewMode] = useState('cards'); // 'list' ou 'cards'
  
  // Estados do filtro de clientes
  const [filtroClienteId, setFiltroClienteId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'ativo', 'inativo'
  const [clientesParaFiltro, setClientesParaFiltro] = useState([]);
  
  // Estados do DetailSideCard
  const [detailCard, setDetailCard] = useState(null); // { clienteId, tipo, dados }
  const [detailCardPosition, setDetailCardPosition] = useState(null); // { left, top }
  
  // Estados para informações de completude (cache por cliente)
  const [informacoesCache, setInformacoesCache] = useState({}); // Map de cliente_id -> { temConta, temSistema, temAdquirente }

  // Carregar clientes para o filtro
  const loadClientesParaFiltro = useCallback(async () => {
    try {
      const result = await clientesAPI.getAll(null, false);
      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os clientes tenham nome
        const clientesComDados = result.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || `Cliente #${cliente.id}`,
          status: cliente.status || 'ativo'
        }));
        setClientesParaFiltro(clientesComDados);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes para filtro:', error);
      setClientesParaFiltro([]);
    }
  }, []);

  // Carregar informações de completude para múltiplos clientes
  const carregarInformacoesCompletude = useCallback(async (clientesArray) => {
    if (!clientesArray || clientesArray.length === 0) return;

    // Carregar informações para cada cliente de forma paralela
    const promises = clientesArray.map(async (cliente) => {
      try {
        const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${cliente.id}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          return null;
        }

        const result = await response.json();
        if (result.success && result.data) {
          return {
            clienteId: cliente.id,
            temConta: (result.data.contasBancarias || []).length > 0,
            temSistema: (result.data.sistemas || []).length > 0,
            temAdquirente: (result.data.adquirentes || []).length > 0
          };
        }
        return null;
      } catch (error) {
        console.error(`Erro ao carregar informações do cliente ${cliente.id}:`, error);
        return null;
      }
    });

    // Aguardar todas as requisições
    const resultados = await Promise.all(promises);

    // Atualizar cache apenas com os resultados válidos
    const novoCache = {};
    resultados.forEach(result => {
      if (result) {
        novoCache[result.clienteId] = {
          temConta: result.temConta,
          temSistema: result.temSistema,
          temAdquirente: result.temAdquirente
        };
      }
    });

    // Atualizar o cache de forma incremental
    setInformacoesCache(prev => ({
      ...prev,
      ...novoCache
    }));
  }, []);

  // Carregar clientes
  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      // Verificar se há filtro de cliente
      const temFiltroCliente = filtroClienteId && Array.isArray(filtroClienteId) && filtroClienteId.length > 0;
      
      // Quando há filtro, buscar todos os clientes (até 10000) para filtrar no frontend
      // Quando não há filtro, usar paginação normal no backend
      const limitParaBusca = temFiltroCliente ? 10000 : itemsPerPage;
      const pageParaBusca = temFiltroCliente ? 1 : currentPage;
      
      const params = new URLSearchParams({
        page: pageParaBusca.toString(),
        limit: limitParaBusca.toString()
      });
      
      // Adicionar filtro de status se não for 'todos'
      if (filtroStatus !== 'todos') {
        params.append('status', filtroStatus);
      }

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

      if (result.success) {
        let clientesData = result.data || [];
        
        // Aplicar filtro de cliente no frontend se houver
        if (temFiltroCliente) {
          const filtroIds = filtroClienteId.map(id => String(id).trim());
          // Filtrar todos os clientes que correspondem aos IDs selecionados
          const clientesFiltrados = clientesData.filter(cliente => 
            filtroIds.includes(String(cliente.id).trim())
          );
          
          // Aplicar paginação no frontend após filtrar
          const offset = (currentPage - 1) * itemsPerPage;
          clientesData = clientesFiltrados.slice(offset, offset + itemsPerPage);
          
          // Total é o número de clientes filtrados
          setTotalClientes(clientesFiltrados.length);
          setTotalPages(Math.ceil(clientesFiltrados.length / itemsPerPage));
        } else {
          setTotalClientes(result.total || 0);
          setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
        }
        
        setClientes(clientesData);
        
        // Carregar informações de completude para todos os clientes visíveis (assíncrono, não bloqueia)
        if (clientesData.length > 0) {
          setTimeout(() => {
            carregarInformacoesCompletude(clientesData);
          }, 0);
        }
      } else {
        throw new Error(result.error || 'Erro ao carregar clientes');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      showToast('error', 'Erro ao carregar clientes. Tente novamente.');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroClienteId, filtroStatus, showToast, carregarInformacoesCompletude]);

  // Abrir base de conhecimento do cliente
  const handleViewKnowledge = (cliente) => {
    navigate(`/base-conhecimento/cliente/${cliente.id}`);
  };

  // Buscar dados para o DetailSideCard e atualizar cache de informações
  const loadDadosParaCard = useCallback(async (clienteId, tipo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${clienteId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Atualizar cache de informações de completude
        setInformacoesCache(prev => ({
          ...prev,
          [clienteId]: {
            temConta: (result.data.contasBancarias || []).length > 0,
            temSistema: (result.data.sistemas || []).length > 0,
            temAdquirente: (result.data.adquirentes || []).length > 0
          }
        }));
        
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      showToast('error', 'Erro ao carregar dados. Tente novamente.');
      return null;
    }
  }, [showToast]);

  // Abrir DetailSideCard
  const handleOpenContas = async (cliente, e) => {
    // Verificar cache antes de abrir
    const cacheInfo = informacoesCache[cliente.id];
    if (cacheInfo && cacheInfo.temConta === false) {
      return;
    }
    
    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Posição no documento (considerando scroll)
      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;
      
      setDetailCardPosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCard(cliente.id, 'contas-bancarias');
    if (dados && dados.contasBancarias && dados.contasBancarias.length > 0) {
      setDetailCard({
        clienteId: cliente.id,
        tipo: 'contas-bancarias',
        dados: { contasBancarias: dados.contasBancarias || [] }
      });
    }
  };

  const handleOpenSistemas = async (cliente, e) => {
    // Verificar cache antes de abrir
    const cacheInfo = informacoesCache[cliente.id];
    if (cacheInfo && cacheInfo.temSistema === false) {
      return;
    }
    
    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Posição no documento (considerando scroll)
      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;
      
      setDetailCardPosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCard(cliente.id, 'sistemas');
    if (dados && dados.sistemas && dados.sistemas.length > 0) {
      setDetailCard({
        clienteId: cliente.id,
        tipo: 'sistemas',
        dados: { sistemas: dados.sistemas || [] }
      });
    }
  };

  const handleOpenAdquirentes = async (cliente, e) => {
    // Verificar cache antes de abrir
    const cacheInfo = informacoesCache[cliente.id];
    if (cacheInfo && cacheInfo.temAdquirente === false) {
      return;
    }
    
    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Posição no documento (considerando scroll)
      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;
      
      setDetailCardPosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCard(cliente.id, 'adquirentes');
    if (dados && dados.adquirentes && dados.adquirentes.length > 0) {
      setDetailCard({
        clienteId: cliente.id,
        tipo: 'adquirentes',
        dados: { adquirentes: dados.adquirentes || [] }
      });
    }
  };

  // Fechar DetailSideCard
  const handleCloseDetail = () => {
    setDetailCard(null);
    setDetailCardPosition(null);
  };

  // Formatar CNPJ
  const aplicarMascaraCpfCnpj = (valor) => {
    if (!valor) return '';
    const apenasNumeros = valor.replace(/\D/g, '');
    const numeroLimitado = apenasNumeros.substring(0, 14);
    return numeroLimitado
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  // Renderizar card de cliente
  const renderClientCard = (cliente) => {
    // Priorizar nome_amigavel, depois nome_fantasia, depois razao_social
    const nomeExibicao = cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Sem nome';
    const cnpj = cliente.cpf_cnpj || cliente.cnpj || '';
    const status = cliente.status || '';
    const isAtivo = status === 'ativo';
    // Cor azul do sistema: #0e3b6f, Cor laranja: #ff9800, Cor cinza claro: #d1d5db
    const titleColor = isAtivo ? '#0e3b6f' : '#ff9800';
    const iconColor = isAtivo ? '#0e3b6f' : '#ff9800';
    const iconHoverColor = isAtivo ? '#144577' : '#f97316';
    
    // Verificar cache de informações de completude
    const cacheInfo = informacoesCache[cliente.id];
    const temConta = cacheInfo ? cacheInfo.temConta : null; // null = ainda não verificado, false = sem dados, true = com dados
    const temSistema = cacheInfo ? cacheInfo.temSistema : null;
    const temAdquirente = cacheInfo ? cacheInfo.temAdquirente : null;
    
    // Cores dos ícones: cinza claro se não houver dados (false), cor normal se houver (true) ou ainda não verificado (null)
    const contaIconColor = temConta === false ? '#d1d5db' : iconColor;
    const sistemaIconColor = temSistema === false ? '#d1d5db' : iconColor;
    const adquirenteIconColor = temAdquirente === false ? '#d1d5db' : iconColor;
    
    // Desabilitar botões quando não houver dados confirmados
    const contaDisabled = temConta === false;
    const sistemaDisabled = temSistema === false;
    const adquirenteDisabled = temAdquirente === false;

    return (
      <div key={cliente.id} className="cliente-knowledge-card">
        <div className="cliente-knowledge-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <Avatar
              avatarId={
                cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-') && !cliente.foto_perfil_path
                  ? DEFAULT_AVATAR
                  : (cliente.foto_perfil || DEFAULT_AVATAR)
              }
              nomeUsuario={nomeExibicao}
              size="medium"
              customImagePath={cliente.foto_perfil_path || null}
            />
            <h3 
              className="cliente-knowledge-card-title"
              style={{ color: titleColor, flex: 1 }}
            >
              {nomeExibicao}
            </h3>
          </div>
          {status && (
            <span className={`cliente-knowledge-status-badge ${status === 'ativo' ? 'active' : 'inactive'}`}>
              {status === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
          )}
        </div>
        <div className="cliente-knowledge-card-body">
          {cliente.razao_social && cliente.razao_social !== nomeExibicao && (
            <div className="cliente-knowledge-card-field">
              <label>Razão Social</label>
              <div className="cliente-knowledge-card-value">{cliente.razao_social}</div>
            </div>
          )}
          {cnpj && (
            <div className="cliente-knowledge-card-field">
              <label>CNPJ</label>
              <div className="cliente-knowledge-card-value">{aplicarMascaraCpfCnpj(cnpj)}</div>
            </div>
          )}
        </div>
        <div className="cliente-knowledge-card-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {/* Botões de ação (ícones) */}
            <div className="cliente-knowledge-icons-row">
              <button
                className={`cliente-knowledge-icon-button ${contaDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !contaDisabled && handleOpenContas(cliente, e)}
                disabled={contaDisabled}
                title={contaDisabled ? "Nenhuma conta bancária cadastrada" : "Gerenciar Contas Bancárias"}
                style={{ color: contaIconColor }}
              >
                <i className="fas fa-university"></i>
              </button>
              <button
                className={`cliente-knowledge-icon-button ${sistemaDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !sistemaDisabled && handleOpenSistemas(cliente, e)}
                disabled={sistemaDisabled}
                title={sistemaDisabled ? "Nenhum sistema cadastrado" : "Gerenciar Sistemas"}
                style={{ color: sistemaIconColor }}
              >
                <i className="fas fa-server"></i>
              </button>
              <button
                className={`cliente-knowledge-icon-button ${adquirenteDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !adquirenteDisabled && handleOpenAdquirentes(cliente, e)}
                disabled={adquirenteDisabled}
                title={adquirenteDisabled ? "Nenhum adquirente cadastrado" : "Gerenciar Adquirentes"}
                style={{ color: adquirenteIconColor }}
              >
                <i className="fas fa-credit-card"></i>
              </button>
            </div>
            {/* Botão Visualizar */}
            <IconButton
              icon="fa-eye"
              onClick={(e) => {
                e.stopPropagation();
                handleViewKnowledge(cliente);
              }}
              title="Visualizar Base de Conhecimento"
              color={iconColor}
              hoverColor={iconHoverColor}
            />
          </div>
        </div>
      </div>
    );
  };

  // Handler para mudança no filtro de clientes
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

  // Handler para mudança no filtro de status
  const handleFiltroStatusChange = useCallback((e) => {
    setFiltroStatus(e.target.value);
    setCurrentPage(1);
  }, []);

  // Limpar filtros
  const limparFiltros = useCallback(() => {
    setFiltroClienteId(null);
    setFiltroStatus('todos');
    setCurrentPage(1);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadClientesParaFiltro();
  }, [loadClientesParaFiltro]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // Resetar página ao mudar filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroClienteId]);

  // Definir colunas da tabela
  const tableColumns = [
    {
      key: 'cliente',
      label: 'Cliente',
      render: (item) => {
        // Priorizar nome_amigavel, depois nome_fantasia, depois razao_social
        const nomeExibicao = item.nome_amigavel || item.nome_fantasia || item.razao_social || item.nome || 'Sem nome';
        return (
          <div>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              {nomeExibicao}
            </div>
            {item.razao_social && item.razao_social !== nomeExibicao && (
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {item.razao_social}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'cnpj',
      label: 'CNPJ',
      render: (item) => item.cpf_cnpj || item.cnpj || '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: item.status === 'ativo' ? '#d1fae5' : '#fee2e2',
          color: item.status === 'ativo' ? '#065f46' : '#991b1b'
        }}>
          {item.status === 'ativo' ? 'Ativo' : item.status === 'inativo' ? 'Inativo' : item.status || '-'}
        </span>
      )
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (item) => (
    <button
      className="btn-primary"
      onClick={() => handleViewKnowledge(item)}
      style={{
        padding: '8px 16px',
        fontSize: '13px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}
      title="Visualizar Base de Conhecimento"
    >
      <i className="fas fa-book"></i>
      Visualizar
    </button>
  );

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="conteudos-clientes-container">
              {/* Header */}
              <div className="conteudos-clientes-header">
                <div className="conteudos-clientes-header-left">
                  <div className="conteudos-clientes-header-icon">
                    <i className="fas fa-briefcase"></i>
                  </div>
                  <div>
                    <h2 className="conteudos-clientes-title">
                      Base de Conhecimento - Clientes
                    </h2>
                    <p className="conteudos-clientes-subtitle">
                      Selecione um cliente para visualizar suas informações consolidadas
                    </p>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <FiltersCard
                onClear={limparFiltros}
                showActions={true}
                style={{ marginBottom: '24px' }}
              >
                <div className="filter-group" style={{ flex: '1', minWidth: '300px' }}>
                  <FilterClientes
                    value={filtroClienteId}
                    onChange={handleFiltroClienteChange}
                    options={clientesParaFiltro}
                    disabled={false}
                  />
                </div>
                
                <div className="filter-group" style={{ flex: '0 0 auto', minWidth: '200px' }}>
                  <label className="filter-label">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={handleFiltroStatusChange}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#fff',
                      color: '#374151',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#0e3b6f'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    <option value="todos">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </FiltersCard>

              {/* Controles de visualização */}
              <div style={{ 
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '20px'
              }}>
                {/* Toggle de visualização */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '4px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={() => setViewMode('list')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: viewMode === 'list' ? '#fff' : 'transparent',
                      color: viewMode === 'list' ? '#0e3b6f' : '#64748b',
                      boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    title="Visualização em lista"
                  >
                    <i className="fas fa-list"></i>
                    Lista
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: viewMode === 'cards' ? '#fff' : 'transparent',
                      color: viewMode === 'cards' ? '#0e3b6f' : '#64748b',
                      boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    title="Visualização em cards"
                  >
                    <i className="fas fa-th-large"></i>
                    Cards
                  </button>
                </div>
              </div>

              {/* Info Box */}
              <div style={{
                marginBottom: '24px',
                padding: '16px 20px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <i className="fas fa-info-circle" style={{ fontSize: '20px', color: '#3b82f6', marginTop: '2px' }}></i>
                <div>
                  <p style={{ fontSize: '14px', color: '#1e40af', margin: '0 0 4px 0', fontWeight: '600' }}>
                    Template Único de Base de Conhecimento
                  </p>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                    Esta página exibe um template único que consome automaticamente os dados já cadastrados do cliente, 
                    incluindo dados básicos, acessos de sistema, contas bancárias e adquirentes.
                  </p>
                </div>
              </div>

              {/* Visualização de clientes */}
              {loading ? (
                <LoadingState />
              ) : clientes.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#64748b'
                }}>
                  <i className="fas fa-users" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}></i>
                  <p style={{ fontSize: '16px', margin: 0 }}>Nenhum cliente encontrado</p>
                </div>
              ) : viewMode === 'cards' ? (
                <>
                  <div className="clientes-knowledge-grid">
                    {clientes.map(cliente => renderClientCard(cliente))}
                  </div>
                  
                  {totalPages > 1 && (
                    <div style={{ marginTop: '32px' }}>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={totalClientes}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <DataTable
                    columns={tableColumns}
                    data={clientes}
                    renderActions={renderTableActions}
                    emptyMessage="Nenhum cliente encontrado"
                    emptyIcon="fa-users"
                  />

                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalClientes}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  )}
                </>
              )}
            </div>
          </CardContainer>
        </main>
      </div>

      {/* DetailSideCard */}
      {detailCard && (
        <DetailSideCard
          clienteId={detailCard.clienteId}
          tipo={detailCard.tipo}
          dados={detailCard.dados}
          onClose={handleCloseDetail}
          position={detailCardPosition}
        />
      )}
    </Layout>
  );
};

export default ConteudosClientes;
