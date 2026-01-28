import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import FilterColaborador from '../../components/filters/FilterColaborador';
import FiltersCard from '../../components/filters/FiltersCard';
import CardContainer from '../../components/common/CardContainer';
import DataTable from '../../components/common/DataTable';
import LoadingState from '../../components/common/LoadingState';
import EditButton from '../../components/common/EditButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import Avatar from '../../components/user/Avatar';
import './ConfiguracoesColaboradores.css';

const API_BASE_URL = '/api';

const GestaoColaboradores = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Estado para filtro de status
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'ativo', 'inativo'
  
  // Estados principais
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroColaboradorBusca, setFiltroColaboradorBusca] = useState(null); // Para o FilterColaborador
  const [todosColaboradoresParaFiltro, setTodosColaboradoresParaFiltro] = useState([]); // Lista completa para o filtro
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalColaboradores, setTotalColaboradores] = useState(0);


  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [colaboradorToDelete, setColaboradorToDelete] = useState(null);
  

  // Função utilitária para tratamento de erros HTTP
  const handleHttpError = useCallback((response, errorMessage = 'Erro na requisição') => {
    if (response.status === 401) {
      window.location.href = '/login';
      return true; // Indica que foi redirecionado
    }

    if (response.status === 503) {
      return true; // Service Unavailable - não tentar novamente
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return true; // Resposta não é JSON
    }

    return false; // Não foi tratado aqui
  }, []);

  // Carregar membros/colaboradores (consolidado - usado tanto para exibir nomes quanto para filtro)
  const loadMembros = useCallback(async (forFilter = false) => {
    if (!forFilter) {
      setLoadingMembros(true);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (handleHttpError(response)) {
        if (!forFilter) {
          setMembros([]);
          setLoadingMembros(false);
        }
        setTodosColaboradoresParaFiltro([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const data = result.data || [];
        if (forFilter) {
          setTodosColaboradoresParaFiltro(data);
        } else {
          setMembros(data);
          // Também atualizar o filtro quando carregar membros
          setTodosColaboradoresParaFiltro(data);
        }
      } else {
        throw new Error(result.error || 'Erro ao carregar membros');
      }
    } catch (error) {
      if (!forFilter) {
        showToast('error', 'Erro ao carregar membros. Tente novamente.');
        setMembros([]);
        setLoadingMembros(false);
      }
      setTodosColaboradoresParaFiltro([]);
    } finally {
      if (!forFilter) {
        setLoadingMembros(false);
      }
    }
  }, [showToast, handleHttpError]);


  // Carregar colaboradores
  const loadColaboradores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Se houver colaboradores selecionados no filtro, passar os IDs para o backend filtrar
      if (filtroColaboradorBusca && filtroColaboradorBusca.length > 0) {
        // Passar IDs para o backend filtrar (sem paginação quando há filtro)
        filtroColaboradorBusca.forEach(id => {
          params.append('ids', String(id));
        });
        params.append('page', '1');
        params.append('limit', '1000'); // Limite razoável para filtros
      } else {
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
        
        // Usar o searchTerm apenas se não houver filtro de colaborador selecionado
        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }
      }

      // Aplicar filtro de status
      if (filtroStatus === 'inativo') {
        params.append('status', 'inativo');
      } else if (filtroStatus === 'ativo') {
        params.append('status', 'ativo');
      }
      
      const response = await fetch(`${API_BASE_URL}/colaboradores?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (handleHttpError(response)) {
        setColaboradores([]);
        setTotalColaboradores(0);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const colaboradoresData = result.data || [];
        
        // Quando há filtro por IDs, o backend já retorna apenas os filtrados
        if (filtroColaboradorBusca && filtroColaboradorBusca.length > 0) {
          setTotalColaboradores(colaboradoresData.length);
          setTotalPages(1); // Sem paginação quando há filtro selecionado
        } else {
          setTotalColaboradores(result.total || 0);
          setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
        }
        
        setColaboradores(colaboradoresData);
      } else {
        throw new Error(result.error || 'Erro ao carregar colaboradores');
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao carregar colaboradores. Tente novamente.';
      showToast('error', errorMessage);
      setColaboradores([]);
      setTotalColaboradores(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, filtroStatus, filtroColaboradorBusca, handleHttpError, showToast]);



  // Inativar colaborador
  const handleInativar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inativo' }),
      });

      if (handleHttpError(response)) {
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        await response.text();
        throw new Error(`Erro ao inativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Colaborador inativado com sucesso!');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
        // Atualizar também as listas dos filtros
        await loadMembros();
        await loadMembros(true);
      } else {
        throw new Error(result.error || 'Erro ao inativar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao inativar colaborador. Tente novamente.');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores, loadMembros, handleHttpError, showToast]);

  // Ativar colaborador
  const handleAtivar = useCallback(async () => {
    if (!colaboradorToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorToDelete.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ativo' }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        await response.text();
        throw new Error(`Erro ao ativar colaborador. Resposta do servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Colaborador ativado com sucesso!');
        setShowDeleteModal(false);
        setColaboradorToDelete(null);
        await loadColaboradores();
        // Atualizar também as listas dos filtros
        await loadMembros();
        await loadMembros(true);
      } else {
        throw new Error(result.error || 'Erro ao ativar colaborador');
      }
    } catch (error) {
      showToast('error', error.message || 'Erro ao ativar colaborador. Tente novamente.');
      setShowDeleteModal(false);
    }
  }, [colaboradorToDelete, loadColaboradores, loadMembros, handleHttpError, showToast]);


  // Abrir formulário para novo colaborador
  const handleNewColaborador = () => {
    navigate('/cadastro/colaborador');
  };

  // Navegar para página de editar colaborador
  const handleEdit = (colaborador) => {
    navigate(`/cadastro/colaborador?id=${colaborador.id}`);
  };

  // Confirmar inativação
  const confirmInativar = (colaborador) => {
    setColaboradorToDelete(colaborador);
    setShowDeleteModal(true);
  };

  // Confirmar ativação
  const confirmAtivar = (colaborador) => {
    setColaboradorToDelete(colaborador);
    setShowDeleteModal(true);
  };


  // Funções para drag and drop de colunas com animação Swap
  const handleDragStart = (e, index) => {
    setDraggedColumn(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    
    // Adicionar classe dragging ao elemento
    const th = e.target;
    th.classList.add('dragging');
    
    // Criar um elemento fantasma personalizado
    const dragImage = th.cloneNode(true);
    dragImage.style.width = `${th.offsetWidth}px`;
    dragImage.style.opacity = '0.8';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = (e) => {
    // Remover todas as classes de drag
    const allThs = document.querySelectorAll('.listing-table-draggable th');
    allThs.forEach(th => {
      th.classList.remove('dragging', 'drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    });
    
    setDraggedColumn(null);
    setDragOverIndex(null);
    setIsSwapping(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (e.target.tagName === 'TH' && draggedColumn !== null && draggedColumn !== index) {
      setDragOverIndex(index);
      const th = e.target;
      th.classList.add('drag-over');
      
      // Determinar direção do drag
      if (draggedColumn < index) {
        th.classList.add('drag-over-right');
        th.classList.remove('drag-over-left');
      } else {
        th.classList.add('drag-over-left');
        th.classList.remove('drag-over-right');
      }
    }
  };

  const handleDragLeave = (e) => {
    if (e.target.tagName === 'TH') {
      const th = e.target;
      th.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    // Limpar classes visuais
    const allThs = document.querySelectorAll('.listing-table-draggable th');
    allThs.forEach(th => {
      th.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
      th.style.backgroundColor = '';
    });
    
    if (draggedColumn === null || draggedColumn === dropIndex) {
      setDraggedColumn(null);
      setDragOverIndex(null);
      return;
    }

    // Adicionar classe de animação swap
    setIsSwapping(true);
    const table = e.target.closest('.listing-table-draggable');
    if (table) {
      table.classList.add('swapping');
    }

    // Realizar a troca
    const newColunas = [...colunasVigencias];
    const draggedItem = newColunas[draggedColumn];
    newColunas.splice(draggedColumn, 1);
    newColunas.splice(dropIndex, 0, draggedItem);
    setColunasVigencias(newColunas);
    
    // Remover classe de animação após a transição
    setTimeout(() => {
      setIsSwapping(false);
      if (table) {
        table.classList.remove('swapping');
      }
    }, 300);
    
    setDraggedColumn(null);
    setDragOverIndex(null);
  };






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

  // Handler para mudança no filtro de colaborador
  const handleFiltroColaboradorBuscaChange = useCallback((e) => {
    const selectedIds = e.target.value;
    setFiltroColaboradorBusca(selectedIds ? (Array.isArray(selectedIds) ? selectedIds : [selectedIds]) : null);
    setSearchTerm(''); // Limpar searchTerm quando usar o filtro
    setCurrentPage(1); // Resetar para primeira página quando filtrar
  }, []);

  // Função para limpar filtros
  const limparFiltros = useCallback(() => {
    setFiltroColaboradorBusca(null);
    setSearchTerm('');
    setCurrentPage(1);
    // Resetar filtro de status para 'todos'
    setFiltroStatus('todos');
  }, []);



  // Efeitos
  useEffect(() => {
    loadColaboradores();
  }, [loadColaboradores]);

  // Carregar colaboradores para o filtro na montagem do componente
  useEffect(() => {
    loadMembros(true);
  }, [loadMembros]);

  // Calcular range de itens exibidos
  const startItem = totalColaboradores === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, colaboradores.length) - 1, totalColaboradores);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="colaboradores-listing-section">
          <div className="cadastro-listing-page-header">
            <div className="cadastro-listing-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="cadastro-listing-header-left">
                <div className="cadastro-listing-header-icon">
                  <i className="fas fa-user-cog" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                </div>
                <div>
                  <h1 className="cadastro-listing-page-title">Cadastro Colaboradores</h1>
                  <p className="cadastro-listing-page-subtitle">
                    Gerencie os colaboradores do sistema
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/configuracoes/custo-colaborador')}
                className="custo-colaborador-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: 0.7
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.opacity = '0.7';
                }}
                title="Configurações de Custo Colaborador"
              >
                <i className="fas fa-cog custo-colaborador-icon" style={{ 
                  fontSize: '16px'
                }}></i>
                <span>Custo Contrato</span>
              </button>
            </div>
          </div>

          {/* Controles e Filtros */}
          <div className="listing-controls" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
            <div className="listing-controls-right">
              <button
                className="add-client-btn active"
                onClick={handleNewColaborador}
                disabled={false}
                type="button"
              >
                <i className="fas fa-user-plus"></i>
                Novo Colaborador
              </button>
            </div>
          </div>
          <FiltersCard
            onClear={limparFiltros}
            showActions={true}
          >
                <div className="filter-group" style={{ flex: '0 0 200px' }}>
                  <label htmlFor="filtro-status" className="filter-label" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Status
                  </label>
                  <select
                    id="filtro-status"
                    value={filtroStatus}
                    onChange={(e) => {
                      setFiltroStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '14px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#495057',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      minHeight: '44px',
                      height: '44px',
                      boxSizing: 'border-box',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236c757d\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      paddingRight: '40px'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#0e3b6f';
                      e.target.style.boxShadow = '0 0 0 2px rgba(14, 59, 111, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#dee2e6';
                      e.target.style.boxShadow = 'none';
                    }}
                    onMouseEnter={(e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = '#0e3b6f';
                        e.target.style.boxShadow = '0 0 0 2px rgba(14, 59, 111, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = '#dee2e6';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <option value="todos">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
            <div className="filter-group" style={{ flex: '1', minWidth: '300px' }}>
              <FilterColaborador
                value={filtroColaboradorBusca}
                onChange={handleFiltroColaboradorBuscaChange}
                options={todosColaboradoresParaFiltro}
                disabled={false}
              />
            </div>
          </FiltersCard>

          {/* Lista de colaboradores */}
          <div className="listing-table-container view-transition view-enter">
              {loading ? (
                <LoadingState message="Carregando colaboradores..." />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'nome',
                      label: 'Nome',
                      render: (colaborador) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar
                            avatarId={colaborador.foto_perfil}
                            nomeUsuario={colaborador.nome || ''}
                            size="small"
                            entityType="user"
                            entityId={colaborador.usuario_id}
                          />
                          <span>{colaborador.nome || '-'}</span>
                        </div>
                      )
                    },
                  ]}
                  data={colaboradores}
                  renderActions={(colaborador) => (
                    <>
                      <EditButton
                        onClick={() => handleEdit(colaborador)}
                        title="Editar"
                        disabled={false}
                      />
                      {filtroStatus === 'inativo' ? (
                        <button
                          className="btn-icon activate-btn"
                          onClick={() => confirmAtivar(colaborador)}
                          title="Ativar"
                          disabled={false}
                          style={{ color: '#10b981' }}
                        >
                          <svg viewBox="0 0 512 512" className="icon-check" width="22" height="22">
                            <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" fill="currentColor"/>
                          </svg>
                        </button>
                      ) : (
                        <button
                          className="btn-icon inactivate-btn"
                          onClick={() => confirmInativar(colaborador)}
                          title="Inativar"
                          disabled={false}
                          style={{ color: '#ef4444' }}
                        >
                          <svg viewBox="0 0 512 512" className="icon-ban" width="22" height="22">
                            <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
                            <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
                            <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  emptyMessage="Nenhum colaborador encontrado"
                  emptyIcon="fa-users"
                />
              )}
              {!loading && colaboradores.length > 0 && (
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
                    Mostrando {startItem} a {endItem} de {totalColaboradores} colaboradores
                  </div>
                </>
              )}
            </div>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação de exclusão de colaborador */}
      <ConfirmModal
        isOpen={showDeleteModal && !!colaboradorToDelete}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={filtroStatus === 'inativo' ? handleAtivar : handleInativar}
        title="Confirmar Ação"
        message={
          <>
            <p>
              Tem certeza que deseja {filtroStatus === 'inativo' ? 'ativar' : 'inativar'} o colaborador{' '}
              <strong>{colaboradorToDelete?.nome}</strong>?
            </p>
            <p className="warning-text">
              {filtroStatus === 'inativo' 
                ? 'O colaborador será marcado como ativo e aparecerá novamente nas listagens ativas.'
                : 'O colaborador será marcado como inativo e não aparecerá mais nas listagens ativas.'}
            </p>
          </>
        }
        confirmText={filtroStatus === 'inativo' ? 'Ativar' : 'Inativar'}
        confirmButtonClass={filtroStatus === 'inativo' ? "btn-success btn-ativar" : "btn-danger btn-inativar"}
      />

    </Layout>
  );
};

export default GestaoColaboradores;


