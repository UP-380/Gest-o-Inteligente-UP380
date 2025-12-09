import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import VinculacaoModal from '../../components/vinculacoes/VinculacaoModal';
import FiltersCard from '../../components/filters/FiltersCard';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import './CadastroVinculacoes.css';

const API_BASE_URL = '/api';

const CadastroVinculacoes = () => {
  const showToast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingVinculado, setEditingVinculado] = useState(null); // ID do vinculado sendo editado
  const [vinculados, setVinculados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVinculados, setTotalVinculados] = useState(0);
  
  // Estados para modais de confirmação
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [vinculadoToDelete, setVinculadoToDelete] = useState(null);
  const [showDeleteGroupConfirmModal, setShowDeleteGroupConfirmModal] = useState(false);
  const [vinculadosIdsToDelete, setVinculadosIdsToDelete] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    produto: false,
    atividade: false,
    tipoAtividade: false
  });
  const [filtroPrincipal, setFiltroPrincipal] = useState(null); // 'produto', 'atividade', 'tipoAtividade'
  const [ordemFiltros, setOrdemFiltros] = useState([]); // Array para rastrear ordem de aplicação
  const [filtrosAplicados, setFiltrosAplicados] = useState(false); // Rastrear se filtros foram aplicados
  const [filtrosUltimosAplicados, setFiltrosUltimosAplicados] = useState(null); // Armazenar últimos filtros aplicados
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroHover, setFiltroHover] = useState(null); // Filtro em hover

  // Carregar vinculados
  const loadVinculados = useCallback(async (filtrosParaAplicar = null) => {
    setLoading(true);
    try {
      // Usar filtros passados como parâmetro ou os do estado
      const filtrosAUsar = filtrosParaAplicar !== null ? filtrosParaAplicar : filtros;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      // Adicionar filtros
      if (filtrosAUsar.produto) {
        params.append('filtro_produto', 'true');
      }
      if (filtrosAUsar.atividade) {
        params.append('filtro_atividade', 'true');
      }
      if (filtrosAUsar.tipoAtividade) {
        params.append('filtro_tipo_atividade', 'true');
      }

      const response = await fetch(`${API_BASE_URL}/vinculados?${params}`, {
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Status:', response.status);
        throw new Error(`Resposta inválida do servidor. Status: ${response.status}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setVinculados(result.data || []);
        setTotalVinculados(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar vinculados');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar vinculados:', error);
      showMessage(error.message || 'Erro ao carregar vinculados. Tente novamente.', 'error');
      setVinculados([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

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
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }, []);

  // Não carregar automaticamente - apenas quando filtros forem aplicados ou paginação mudar (se houver filtros aplicados)
  useEffect(() => {
    if (filtrosAplicados) {
      loadVinculados(filtros);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);
  
  // Resetar estado quando filtros forem desaplicados
  useEffect(() => {
    if (!filtrosAplicados) {
      setVinculados([]);
      setTotalVinculados(0);
      setTotalPages(1);
    }
  }, [filtrosAplicados]);

  const handleNewVinculacao = () => {
    setShowModal(true);
  };

  const handleCloseModal = (saved = false) => {
    setShowModal(false);
    setEditingVinculado(null);
    if (saved && filtrosAplicados) {
      // Recarregar lista após salvar apenas se houver filtros aplicados
      loadVinculados(filtros);
    }
  };

  // Editar vinculado
  const handleEditVinculado = (vinculadoId) => {
    setEditingVinculado(vinculadoId);
    setShowModal(true);
  };

  // Abrir modal de confirmação para excluir vinculado individual
  const handleRequestDeleteVinculado = (vinculadoId) => {
    setVinculadoToDelete(vinculadoId);
    setShowDeleteConfirmModal(true);
  };

  // Excluir vinculado (sem confirmação - pode ser chamado de outros lugares)
  const handleDeleteVinculado = async (vinculadoId, showConfirm = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return false;
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || `Erro HTTP ${response.status}`;
        if (showConfirm) {
          showToast('error', errorMsg);
        }
        return false;
      }

      if (result.success) {
        if (showConfirm) {
          showToast('success', 'Vinculação excluída com sucesso!');
          // Recarregar lista
          if (filtrosAplicados) {
            loadVinculados(filtros);
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao excluir vinculação:', error);
      if (showConfirm) {
        showToast('error', error.message || 'Erro ao excluir vinculação. Verifique sua conexão e tente novamente.');
      }
      return false;
    }
  };

  // Confirmar exclusão de vinculado individual
  const confirmDeleteVinculado = async () => {
    if (!vinculadoToDelete) return;
    
    setDeleteLoading(true);
    const success = await handleDeleteVinculado(vinculadoToDelete, true);
    setDeleteLoading(false);
    
    if (success) {
      setShowDeleteConfirmModal(false);
      setVinculadoToDelete(null);
    }
  };

  // Abrir modal de confirmação para excluir grupo de vinculados
  const handleRequestDeleteGroup = (vinculadosIds) => {
    setVinculadosIdsToDelete(vinculadosIds);
    setShowDeleteGroupConfirmModal(true);
  };

  // Confirmar exclusão de grupo de vinculados
  const confirmDeleteGroup = async () => {
    if (vinculadosIdsToDelete.length === 0) return;
    
    setDeleteLoading(true);
    let sucesso = 0;
    let erros = 0;
    
    for (const id of vinculadosIdsToDelete) {
      const result = await handleDeleteVinculado(id, false);
      if (result) {
        sucesso++;
      } else {
        erros++;
      }
    }
    
    setDeleteLoading(false);
    setShowDeleteGroupConfirmModal(false);
    setVinculadosIdsToDelete([]);
    
    // Recarregar lista após todas as exclusões
    if (sucesso > 0 && filtrosAplicados) {
      await loadVinculados(filtros);
    }
    
    if (sucesso > 0) {
      showToast('success', `${sucesso} vinculação(ões) excluída(s) com sucesso!${erros > 0 ? ` (${erros} erro(s))` : ''}`);
    } else if (erros > 0) {
      showToast('error', `Erro ao excluir ${erros} vinculação(ões).`);
    }
  };

  // Limpar filtros
  const limparFiltros = () => {
    const filtrosLimpos = {
      produto: false,
      atividade: false,
      tipoAtividade: false
    };
    setFiltros(filtrosLimpos);
    setFiltroPrincipal(null);
    setOrdemFiltros([]);
    setFiltrosAplicados(false);
    setFiltrosUltimosAplicados(null);
    setVinculados([]);
    setTotalVinculados(0);
    setTotalPages(1);
    setCurrentPage(1);
  };

  // Verificar se há mudanças pendentes nos filtros
  const hasPendingChanges = () => {
    // Se não há filtros aplicados, não há mudanças pendentes
    if (!filtrosAplicados || !filtrosUltimosAplicados) {
      return false;
    }
    
    // Comparar filtros atuais com os últimos aplicados
    return (
      filtros.produto !== filtrosUltimosAplicados.produto ||
      filtros.atividade !== filtrosUltimosAplicados.atividade ||
      filtros.tipoAtividade !== filtrosUltimosAplicados.tipoAtividade
    );
  };

  // Handler para mudança de filtro (rastreia ordem)
  const handleFilterChange = (filtroKey, checked) => {
    const novoFiltros = { ...filtros, [filtroKey]: checked };
    setFiltros(novoFiltros);
    
    // Atualizar ordem de filtros
    if (checked) {
      // Se foi marcado, adicionar à ordem se não estiver lá
      setOrdemFiltros(prev => {
        if (!prev.includes(filtroKey)) {
          return [...prev, filtroKey];
        }
        return prev;
      });
    } else {
      // Se foi desmarcado, remover da ordem
      setOrdemFiltros(prev => prev.filter(f => f !== filtroKey));
    }
  };

  // Aplicar filtros
  const handleApplyFilters = () => {
    // Verificar se pelo menos um filtro está selecionado
    const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.tipoAtividade;
    
    if (!temFiltroAtivo) {
      showToast('warning', 'Selecione pelo menos um filtro para aplicar.');
      return;
    }
    
    // O primeiro filtro na ordem será o principal
    const novoFiltroPrincipal = ordemFiltros.length > 0 ? ordemFiltros[0] : null;
    setFiltroPrincipal(novoFiltroPrincipal);
    setFiltrosAplicados(true);
    // Salvar os filtros aplicados para comparação
    setFiltrosUltimosAplicados({ ...filtros });
    
    setCurrentPage(1);
    // Passar os filtros atuais para aplicar
    loadVinculados(filtros);
  };


  // Obter nome do filtro para o tooltip
  const getFiltroNome = (filtroKey) => {
    switch (filtroKey) {
      case 'produto':
        return 'PRODUTO';
      case 'atividade':
        return 'ATIVIDADE';
      case 'tipoAtividade':
        return 'TIPO DE ATIVIDADE';
      default:
        return '';
    }
  };

  // Obter o filtro pai atual (primeiro na ordem, mesmo antes de aplicar)
  const getFiltroPaiAtual = () => {
    // Se os filtros já foram aplicados, usar o filtroPrincipal
    if (filtrosAplicados && filtroPrincipal) {
      return filtroPrincipal;
    }
    // Caso contrário, usar o primeiro filtro na ordem de seleção
    if (ordemFiltros.length > 0) {
      return ordemFiltros[0];
    }
    return null;
  };

  // Verificar se um filtro deve ter o contorno laranja
  const isFiltroPai = (filtroKey) => {
    const filtroPaiAtual = getFiltroPaiAtual();
    // Se já há um filtro pai selecionado, mostrar apenas ele
    if (filtroPaiAtual) {
      return filtroPaiAtual === filtroKey;
    }
    // Se não há filtro selecionado ainda, mostrar o hover
    if (filtroHover === filtroKey) {
      return true;
    }
    return false;
  };

  // Calcular range de itens exibidos
  const startItem = totalVinculados === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, vinculados.length) - 1, totalVinculados);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="vinculacoes-listing-section">
              <div className="form-header">
                <h2 className="form-title">Vinculações</h2>
                <p className="form-subtitle">
                  Cadastre e gerencie as vinculações entre catálogos.
                </p>
              </div>

              <div className="listing-controls">
                <div className="listing-controls-right">
                  <ButtonPrimary
                    onClick={handleNewVinculacao}
                    icon="fas fa-plus"
                    disabled={showModal}
                  >
                    Nova Vinculação
                  </ButtonPrimary>
                </div>
              </div>

              {/* Filtros usando FiltersCard */}
              <FiltersCard
                onApply={handleApplyFilters}
                onClear={limparFiltros}
                showActions={true}
                loading={loading}
                hasPendingChanges={hasPendingChanges()}
                showInfoMessage={true}
              >
                <div className="filter-group">
                  <div className={`filtro-pai-wrapper ${isFiltroPai('produto') ? 'has-tooltip' : ''}`}>
                    <label 
                      className={`filtro-card-option ${isFiltroPai('produto') ? 'filtro-pai' : ''}`}
                      onMouseEnter={() => setFiltroHover('produto')}
                      onMouseLeave={() => setFiltroHover(null)}
                    >
                      <input
                        type="checkbox"
                        checked={filtros.produto}
                        onChange={(e) => {
                          handleFilterChange('produto', e.target.checked);
                        }}
                      />
                      <div className="filtro-card-content">
                        <div className="filtro-card-icon">
                          <i className="fas fa-box"></i>
                        </div>
                        <div className="filtro-card-text">
                          <span className="filtro-card-title">Produto</span>
                          <span className="filtro-card-subtitle">Filtrar por produtos</span>
                        </div>
                        <div className="filtro-card-check">
                          <i className="fas fa-check"></i>
                        </div>
                        <div className="filtro-card-click-indicator">
                          <i className="fas fa-hand-pointer"></i>
                        </div>
                      </div>
                    </label>
                    {isFiltroPai('produto') && (
                      <div className="filter-tooltip">
                        Separar resultados por {getFiltroNome('produto')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="filter-group">
                  <div className={`filtro-pai-wrapper ${isFiltroPai('atividade') ? 'has-tooltip' : ''}`}>
                    <label 
                      className={`filtro-card-option ${isFiltroPai('atividade') ? 'filtro-pai' : ''}`}
                      onMouseEnter={() => setFiltroHover('atividade')}
                      onMouseLeave={() => setFiltroHover(null)}
                    >
                      <input
                        type="checkbox"
                        checked={filtros.atividade}
                        onChange={(e) => {
                          handleFilterChange('atividade', e.target.checked);
                        }}
                      />
                      <div className="filtro-card-content">
                        <div className="filtro-card-icon">
                          <i className="fas fa-list"></i>
                        </div>
                        <div className="filtro-card-text">
                          <span className="filtro-card-title">Atividade</span>
                          <span className="filtro-card-subtitle">Filtrar por atividades</span>
                        </div>
                        <div className="filtro-card-check">
                          <i className="fas fa-check"></i>
                        </div>
                        <div className="filtro-card-click-indicator">
                          <i className="fas fa-hand-pointer"></i>
                        </div>
                      </div>
                    </label>
                    {isFiltroPai('atividade') && (
                      <div className="filter-tooltip">
                        Separar resultados por {getFiltroNome('atividade')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="filter-group">
                  <div className={`filtro-pai-wrapper ${isFiltroPai('tipoAtividade') ? 'has-tooltip' : ''}`}>
                    <label 
                      className={`filtro-card-option ${isFiltroPai('tipoAtividade') ? 'filtro-pai' : ''}`}
                      onMouseEnter={() => setFiltroHover('tipoAtividade')}
                      onMouseLeave={() => setFiltroHover(null)}
                    >
                      <input
                        type="checkbox"
                        checked={filtros.tipoAtividade}
                        onChange={(e) => {
                          handleFilterChange('tipoAtividade', e.target.checked);
                        }}
                      />
                      <div className="filtro-card-content">
                        <div className="filtro-card-icon">
                          <i className="fas fa-list"></i>
                        </div>
                        <div className="filtro-card-text">
                          <span className="filtro-card-title">Tipo de Atividade</span>
                          <span className="filtro-card-subtitle">Filtrar por tipos</span>
                        </div>
                        <div className="filtro-card-check">
                          <i className="fas fa-check"></i>
                        </div>
                        <div className="filtro-card-click-indicator">
                          <i className="fas fa-hand-pointer"></i>
                        </div>
                      </div>
                    </label>
                    {isFiltroPai('tipoAtividade') && (
                      <div className="filter-tooltip">
                        Separar resultados por {getFiltroNome('tipoAtividade')}
                      </div>
                    )}
                  </div>
                </div>
              </FiltersCard>

              {/* Lista de vinculados */}
              {!filtrosAplicados ? (
                <SemResultadosFiltros 
                  filtrosAplicados={false}
                />
              ) : loading ? (
                <div className="loading-container">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Carregando vinculações...</span>
                </div>
              ) : vinculados.length === 0 ? (
                <SemResultadosFiltros 
                  mensagem="Nenhuma vinculação encontrada com os filtros selecionados."
                  filtrosAplicados={true}
                />
              ) : (
                <>
                  <div className="vinculados-grid">
                    {(() => {
                      // Se há filtro principal, agrupar por ele
                      if (filtroPrincipal) {
                        const agrupados = {};
                        
                        vinculados.forEach(vinculado => {
                          let chaveAgrupamento = null;
                          let nomeAgrupamento = null;
                          
                          if (filtroPrincipal === 'produto' && vinculado.cp_produto) {
                            chaveAgrupamento = `produto_${vinculado.cp_produto}`;
                            nomeAgrupamento = vinculado.produto_nome || 'Produto não encontrado';
                          } else if (filtroPrincipal === 'atividade' && vinculado.cp_atividade) {
                            chaveAgrupamento = `atividade_${vinculado.cp_atividade}`;
                            nomeAgrupamento = vinculado.atividade_nome || 'Atividade não encontrada';
                          } else if (filtroPrincipal === 'tipoAtividade' && vinculado.cp_atividade_tipo) {
                            chaveAgrupamento = `tipo_${vinculado.cp_atividade_tipo}`;
                            nomeAgrupamento = vinculado.tipo_atividade_nome || 'Tipo não encontrado';
                          }
                          
                          if (chaveAgrupamento) {
                            if (!agrupados[chaveAgrupamento]) {
                              agrupados[chaveAgrupamento] = {
                                nome: nomeAgrupamento,
                                tipo: filtroPrincipal,
                                vinculados: []
                              };
                            }
                            agrupados[chaveAgrupamento].vinculados.push(vinculado);
                          }
                        });
                        
                        // Renderizar cards agrupados
                        return Object.values(agrupados).map((grupo, index) => {
                          // Coletar itens únicos para evitar duplicatas
                          const itensUnicos = {
                            atividades: new Set(),
                            produtos: new Set(),
                            tiposAtividade: new Set()
                          };
                          
                          grupo.vinculados.forEach(vinculado => {
                            if (filtroPrincipal !== 'atividade' && vinculado.cp_atividade && vinculado.atividade_nome) {
                              itensUnicos.atividades.add(JSON.stringify({
                                id: vinculado.cp_atividade,
                                nome: vinculado.atividade_nome
                              }));
                            }
                            if (filtroPrincipal !== 'produto' && vinculado.cp_produto && vinculado.produto_nome) {
                              itensUnicos.produtos.add(JSON.stringify({
                                id: vinculado.cp_produto,
                                nome: vinculado.produto_nome
                              }));
                            }
                            if (filtroPrincipal !== 'tipoAtividade' && vinculado.cp_atividade_tipo && vinculado.tipo_atividade_nome) {
                              itensUnicos.tiposAtividade.add(JSON.stringify({
                                id: vinculado.cp_atividade_tipo,
                                nome: vinculado.tipo_atividade_nome
                              }));
                            }
                          });
                          
                          // Converter Sets para arrays
                          const atividadesArray = Array.from(itensUnicos.atividades).map(item => JSON.parse(item));
                          const produtosArray = Array.from(itensUnicos.produtos).map(item => JSON.parse(item));
                          const tiposArray = Array.from(itensUnicos.tiposAtividade).map(item => JSON.parse(item));
                          
                          return (
                            <div key={index} className="client-card">
                              <div className="client-card-header">
                                <h3 className="client-card-title">{grupo.nome}</h3>
                                <div className="client-card-header-actions">
                                  <EditButton
                                    onClick={() => {
                                      // Editar o primeiro vinculado do grupo
                                      if (grupo.vinculados.length > 0) {
                                        handleEditVinculado(grupo.vinculados[0].id);
                                      }
                                    }}
                                    title="Editar vinculação"
                                  />
                                  <DeleteButton
                                    onClick={() => {
                                      const vinculadosIds = grupo.vinculados.map(v => v.id);
                                      handleRequestDeleteGroup(vinculadosIds);
                                    }}
                                    title="Excluir todas as vinculações do grupo"
                                  />
                                </div>
                              </div>
                              <div className="client-card-body">
                                <div className="vinculado-items-container">
                                  {/* Atividades */}
                                  {atividadesArray.map((item, idx) => (
                                    <div key={`atividade_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-list"></i>
                                        <span className="vinculado-item-label">Atividade</span>
                                      </div>
                                      <div className="vinculado-item-value">
                                        {item.nome}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Produtos */}
                                  {produtosArray.map((item, idx) => (
                                    <div key={`produto_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-box"></i>
                                        <span className="vinculado-item-label">Produto</span>
                                      </div>
                                      <div className="vinculado-item-value">
                                        {item.nome}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Tipos de Atividade */}
                                  {tiposArray.map((item, idx) => (
                                    <div key={`tipo_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-list"></i>
                                        <span className="vinculado-item-label">Tipo de Atividade</span>
                                      </div>
                                      <div className="vinculado-item-value">
                                        {item.nome}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Se não houver itens secundários */}
                                  {atividadesArray.length === 0 && produtosArray.length === 0 && tiposArray.length === 0 && (
                                    <div className="vinculado-item-card">
                                      <div className="vinculado-item-value" style={{ color: '#64748b', fontStyle: 'italic' }}>
                                        Nenhum item vinculado
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      } else {
                        // Sem filtro principal, exibir cards individuais com ações
                        return vinculados.map((vinculado) => (
                          <div key={vinculado.id} className="vinculado-item-card">
                            <div className="vinculado-item-content">
                              {vinculado.cp_atividade && (
                                <div className="vinculado-item-row">
                                  <div className="vinculado-item-header">
                                    <i className="fas fa-list"></i>
                                    <span className="vinculado-item-label">Atividade</span>
                                  </div>
                                  <div className="vinculado-item-value">
                                    {vinculado.atividade_nome || 'Nome não encontrado'}
                                  </div>
                                </div>
                              )}
                              {vinculado.cp_produto && (
                                <div className="vinculado-item-row">
                                  <div className="vinculado-item-header">
                                    <i className="fas fa-box"></i>
                                    <span className="vinculado-item-label">Produto</span>
                                  </div>
                                  <div className="vinculado-item-value">
                                    {vinculado.produto_nome || 'Nome não encontrado'}
                                  </div>
                                </div>
                              )}
                              {vinculado.cp_atividade_tipo && (
                                <div className="vinculado-item-row">
                                  <div className="vinculado-item-header">
                                    <i className="fas fa-list"></i>
                                    <span className="vinculado-item-label">Tipo de Atividade</span>
                                  </div>
                                  <div className="vinculado-item-value">
                                    {vinculado.tipo_atividade_nome || 'Nome não encontrado'}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="vinculado-item-actions">
                              <button
                                className="btn-edit-vinculado"
                                onClick={() => handleEditVinculado(vinculado.id)}
                                title="Editar vinculação"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="btn-delete-vinculado"
                                onClick={() => handleRequestDeleteVinculado(vinculado.id)}
                                title="Excluir vinculação"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        ));
                      }
                    })()}
                  </div>
                </>
              )}

              {/* Controles de Paginação */}
              {totalVinculados > 0 && (
                <div className="pagination-container" style={{ display: 'flex' }}>
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
                      <option value="50">50 itens</option>
                    </select>
                  </div>
                  
                  <div className="pagination-info">
                    <span>
                      Mostrando {startItem} a {endItem} de {totalVinculados} vinculações
                    </span>
                  </div>
                  
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn" 
                      title="Primeira página"
                      disabled={currentPage === 1 || loading}
                      onClick={() => setCurrentPage(1)}
                    >
                      <i className="fas fa-angle-double-left"></i>
                    </button>
                    <button 
                      className="pagination-btn" 
                      title="Página anterior"
                      disabled={currentPage === 1 || loading}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <i className="fas fa-angle-left"></i>
                    </button>
                    
                    <span className="pagination-current">
                      Página <span>{currentPage}</span> de <span>{totalPages}</span>
                    </span>
                    
                    <button 
                      className="pagination-btn" 
                      title="Próxima página"
                      disabled={currentPage === totalPages || totalPages === 0 || loading}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      <i className="fas fa-angle-right"></i>
                    </button>
                    <button 
                      className="pagination-btn" 
                      title="Última página"
                      disabled={currentPage === totalPages || totalPages === 0 || loading}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      <i className="fas fa-angle-double-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
        </main>
      </div>

        <VinculacaoModal
          isOpen={showModal}
          onClose={handleCloseModal}
          editingVinculado={editingVinculado}
        />

        {/* Modal de confirmação para exclusão individual */}
        <ConfirmModal
          isOpen={showDeleteConfirmModal}
          onClose={() => {
            setShowDeleteConfirmModal(false);
            setVinculadoToDelete(null);
          }}
          onConfirm={confirmDeleteVinculado}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir esta vinculação?"
          confirmText="Excluir"
          cancelText="Cancelar"
          confirmButtonClass="btn-danger"
          loading={deleteLoading}
        />

        {/* Modal de confirmação para exclusão em grupo */}
        <ConfirmModal
          isOpen={showDeleteGroupConfirmModal}
          onClose={() => {
            setShowDeleteGroupConfirmModal(false);
            setVinculadosIdsToDelete([]);
          }}
          onConfirm={confirmDeleteGroup}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir todas as ${vinculadosIdsToDelete.length} vinculação(ões) deste grupo?`}
          confirmText="Excluir Todas"
          cancelText="Cancelar"
          confirmButtonClass="btn-danger"
          loading={deleteLoading}
        />
    </Layout>
  );
};

export default CadastroVinculacoes;

