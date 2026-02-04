import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterVinculacao from '../../components/filters/FilterVinculacao';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import './CadastroVinculacoes.css';

const API_BASE_URL = '/api';

// Componente para seções expansíveis na visualização por produto
const ProdutoSectionExpandable = ({ title, icon, items, emptyMessage }) => {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="produto-section-expandable">
      <button
        className="produto-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="produto-section-header-left">
          <i className={icon}></i>
          <span className="produto-section-title">{title}</span>
          {items.length > 0 && (
            <span className="produto-section-count">({items.length})</span>
          )}
        </div>
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}></i>
      </button>
      {expanded && (
        <div className="produto-section-content">
          {items.length > 0 ? (
            <div className="produto-section-items">
              {items.map((item, idx) => (
                <div key={`${item.id}_${idx}`} className="produto-section-item">
                  <i className={icon}></i>
                  <span>{item.nome}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="produto-section-empty">
              <span>{emptyMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CadastroVinculacoes = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const [vinculados, setVinculados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(0); // 0 = sem limite (carrega todas as vinculações)
  const [totalPages, setTotalPages] = useState(1);
  const [totalVinculados, setTotalVinculados] = useState(0);
  
  // Estados para modais de confirmação
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [vinculadoToDelete, setVinculadoToDelete] = useState(null);
  const [showDeleteGroupConfirmModal, setShowDeleteGroupConfirmModal] = useState(false);
  const [vinculadosIdsToDelete, setVinculadosIdsToDelete] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Filtros - cliente como padrão
  const [filtros, setFiltros] = useState({
    produto: false,
    atividade: false,
    tipoTarefa: false,
    subtarefa: false,
    cliente: true
  });
  const [filtroPrincipal, setFiltroPrincipal] = useState(null); // 'produto', 'atividade', 'tipoTarefa', 'subtarefa', 'cliente'
  const [ordemFiltros, setOrdemFiltros] = useState(['cliente']); // Array para rastrear ordem de aplicação
  const [filtrosAplicados, setFiltrosAplicados] = useState(false); // Rastrear se filtros foram aplicados
  const [filtrosUltimosAplicados, setFiltrosUltimosAplicados] = useState(null); // Armazenar últimos filtros aplicados
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroHover, setFiltroHover] = useState(null); // Filtro em hover
  const [tarefasPadraoPorProduto, setTarefasPadraoPorProduto] = useState({}); // { produtoId: [{ id, nome }] }

  // Carregar vinculados
  const loadVinculados = useCallback(async (filtrosParaAplicar = null) => {
    setLoading(true);
    try {
      // Usar filtros passados como parâmetro ou os do estado
      const filtrosAUsar = filtrosParaAplicar !== null ? filtrosParaAplicar : filtros;
      
      const params = new URLSearchParams({
        page: '1',
        limit: itemsPerPage === 0 ? 'all' : itemsPerPage.toString()
      });

      // Adicionar filtros
      if (filtrosAUsar.produto) {
        params.append('filtro_produto', 'true');
      }
      if (filtrosAUsar.atividade) {
        params.append('filtro_atividade', 'true');
      }
      if (filtrosAUsar.tipoTarefa) {
        params.append('filtro_tipo_atividade', 'true');
      }
      if (filtrosAUsar.subtarefa) {
        params.append('filtro_subtarefa', 'true');
      }
      if (filtrosAUsar.cliente) {
        params.append('filtro_cliente', 'true');
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
        setTotalPages(itemsPerPage === 0 ? 1 : Math.ceil((result.total || 0) / itemsPerPage));
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

  // Buscar tarefas padrão dos produtos quando filtrar por cliente
  useEffect(() => {
    const buscarTarefasPadrao = async () => {
      if (filtroPrincipal === 'cliente' && vinculados.length > 0) {
        // Extrair IDs únicos de produtos vinculados ao cliente
        const produtoIds = [...new Set(
          vinculados
            .filter(v => v.cp_produto)
            .map(v => parseInt(v.cp_produto, 10))
            .filter(id => !isNaN(id))
        )];

        if (produtoIds.length > 0) {
          try {
            const response = await fetch(`${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoIds.join(',')}`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                const tarefasMap = {};
                result.data.forEach(item => {
                  tarefasMap[item.produtoId] = item.tarefas || [];
                });
                setTarefasPadraoPorProduto(tarefasMap);
              }
            }
          } catch (error) {
            console.error('Erro ao buscar tarefas padrão dos produtos:', error);
          }
        } else {
          setTarefasPadraoPorProduto({});
        }
      } else {
        setTarefasPadraoPorProduto({});
      }
    };

    buscarTarefasPadrao();
  }, [filtroPrincipal, vinculados]);

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

  // Nova vinculação
  const handleNewVinculacao = () => {
    navigate('/cadastro/vinculacao');
  };


  // Abrir modal de confirmação para excluir vinculado individual
  const handleRequestDeleteVinculado = (vinculadoId) => {
    setVinculadoToDelete(vinculadoId);
    setShowDeleteConfirmModal(true);
  };

  // Excluir vinculado (sem confirmação - pode ser chamado de outros lugares)
  const handleDeleteVinculado = async (vinculadoId, showConfirm = true) => {
    try {
      // Garantir que o ID seja um número
      const idParaDeletar = typeof vinculadoId === 'string' 
        ? (isNaN(parseInt(vinculadoId, 10)) ? vinculadoId : parseInt(vinculadoId, 10))
        : vinculadoId;
      
      console.log(`🗑️ Tentando deletar vinculado ID: ${idParaDeletar} (tipo: ${typeof idParaDeletar})`);
      
      const response = await fetch(`${API_BASE_URL}/vinculados/${idParaDeletar}`, {
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
    
    // Garantir que os IDs sejam números (caso sejam strings)
    const idsParaDeletar = vinculadosIdsToDelete.map(id => {
      // Se for string, converter para número
      if (typeof id === 'string') {
        const numId = parseInt(id, 10);
        return isNaN(numId) ? id : numId;
      }
      return id;
    });
    
    console.log('🗑️ IDs para deletar:', idsParaDeletar);
    
    for (const id of idsParaDeletar) {
      const result = await handleDeleteVinculado(id, false);
      if (result) {
        sucesso++;
      } else {
        erros++;
        console.error(`❌ Erro ao deletar vinculado ID: ${id}`);
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

  // Limpar filtros - volta para cliente como padrão
  const limparFiltros = () => {
    const filtrosLimpos = {
      produto: false,
      atividade: false,
      tipoTarefa: false,
      subtarefa: false,
      cliente: true
    };
    setFiltros(filtrosLimpos);
    setFiltroPrincipal(null);
    setOrdemFiltros(['cliente']);
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
      filtros.tipoTarefa !== filtrosUltimosAplicados.tipoTarefa ||
      filtros.subtarefa !== filtrosUltimosAplicados.subtarefa ||
      filtros.cliente !== filtrosUltimosAplicados.cliente
    );
  };

  // Handler para mudança de filtro - apenas uma seleção por vez
  const handleFilterChange = (filtroKey, checked) => {
    if (checked) {
      // Se está marcando, desmarcar todos os outros e marcar apenas este
      setFiltros({
        produto: false,
        atividade: false,
        tipoTarefa: false,
        subtarefa: false,
        cliente: false,
        [filtroKey]: true
      });
      setOrdemFiltros([filtroKey]);
    } else {
      // Se está desmarcando, voltar para cliente como padrão
      setFiltros({
        produto: false,
        atividade: false,
        tipoTarefa: false,
        subtarefa: false,
        cliente: true
      });
      setOrdemFiltros(['cliente']);
    }
  };

  // Aplicar filtros
  const handleApplyFilters = () => {
    // Verificar se pelo menos um filtro está selecionado
    const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.tipoTarefa || filtros.subtarefa || filtros.cliente;
    
    if (!temFiltroAtivo) {
      showToast('warning', 'Selecione um filtro para aplicar.');
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
        return 'TAREFA';
      case 'tipoTarefa':
        return 'TIPO DE TAREFA';
      case 'subtarefa':
        return 'SUBTAREFA';
      case 'cliente':
        return 'CLIENTE';
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

  // Calcular range de itens exibidos (quando itemsPerPage=0, exibe todos)
  const startItem = totalVinculados === 0 ? 0 : ((currentPage - 1) * (itemsPerPage || 1)) + 1;
  const endItem = itemsPerPage === 0 ? totalVinculados : Math.min(startItem + Math.min(itemsPerPage, vinculados.length) - 1, totalVinculados);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="vinculacoes-listing-section vinculacoes-filters-horizontal">
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
                  >
                    Vinculação
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
                {/* 1. Tipo de Tarefa */}
                <FilterVinculacao
                  filtroKey="tipoTarefa"
                  checked={filtros.tipoTarefa}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('tipoTarefa')}
                  title="Tipo de Tarefa"
                  subtitle="Filtrar por tipos de tarefa"
                  icon="fas fa-list"
                  filtroNome={getFiltroNome('tipoTarefa')}
                  onMouseEnter={() => setFiltroHover('tipoTarefa')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                {/* 2. Tarefa */}
                <FilterVinculacao
                  filtroKey="atividade"
                  checked={filtros.atividade}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('atividade')}
                  title="Tarefa"
                  subtitle="Filtrar por tarefas"
                  icon="fas fa-list"
                  filtroNome={getFiltroNome('atividade')}
                  onMouseEnter={() => setFiltroHover('atividade')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                {/* 3. Subtarefas */}
                <FilterVinculacao
                  filtroKey="subtarefa"
                  checked={filtros.subtarefa}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('subtarefa')}
                  title="Subtarefas"
                  subtitle="Filtrar por subtarefas"
                  icon="fas fa-list"
                  filtroNome={getFiltroNome('subtarefa')}
                  onMouseEnter={() => setFiltroHover('subtarefa')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                {/* 4. Produto */}
                <FilterVinculacao
                  filtroKey="produto"
                  checked={filtros.produto}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('produto')}
                  title="Produto"
                  subtitle="Filtrar por produtos"
                  icon="fas fa-box"
                  filtroNome={getFiltroNome('produto')}
                  onMouseEnter={() => setFiltroHover('produto')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                {/* 5. Cliente */}
                <FilterVinculacao
                  filtroKey="cliente"
                  checked={filtros.cliente}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('cliente')}
                  title="Cliente"
                  subtitle="Filtrar por clientes"
                  icon="fas fa-briefcase"
                  filtroNome={getFiltroNome('cliente')}
                  onMouseEnter={() => setFiltroHover('cliente')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
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
                          } else if (filtroPrincipal === 'atividade' && vinculado.cp_tarefa) {
                            const tarefaId = vinculado.cp_tarefa;
                            chaveAgrupamento = `atividade_${tarefaId}`;
                            nomeAgrupamento = vinculado.atividade_nome || 'Tarefa não encontrada';
                          } else if (filtroPrincipal === 'tipoTarefa' && vinculado.cp_tarefa_tipo) {
                            const tipoId = vinculado.cp_tarefa_tipo;
                            chaveAgrupamento = `tipo_${tipoId}`;
                            nomeAgrupamento = vinculado.tipo_atividade_nome || 'Tipo não encontrado';
                          } else if (filtroPrincipal === 'subtarefa' && vinculado.cp_subtarefa) {
                            const subtarefaId = vinculado.cp_subtarefa;
                            chaveAgrupamento = `subtarefa_${subtarefaId}`;
                            nomeAgrupamento = vinculado.subtarefa_nome || 'Subtarefa não encontrada';
                          } else if (filtroPrincipal === 'cliente' && vinculado.cp_cliente) {
                            const clienteId = String(vinculado.cp_cliente).trim();
                            chaveAgrupamento = `cliente_${clienteId}`;
                            nomeAgrupamento = vinculado.cliente_nome || 'Cliente não encontrado';
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
                          // Se for cliente, organizar hierarquicamente: Cliente > Produtos > Tipo de Tarefa > Tarefas
                          if (filtroPrincipal === 'cliente') {
                            const produtosMap = new Map();
                            
                            // Primeiro, identificar todos os tipos de tarefa vinculados (mesmo sem tarefa específica)
                            grupo.vinculados.forEach(vinculado => {
                              if (vinculado.cp_produto && vinculado.produto_nome) {
                                const produtoId = vinculado.cp_produto;
                                if (!produtosMap.has(produtoId)) {
                                  produtosMap.set(produtoId, {
                                    id: produtoId,
                                    nome: vinculado.produto_nome,
                                    tiposTarefa: new Map()
                                  });
                                }
                                
                                const produto = produtosMap.get(produtoId);
                                const tipoTarefaId = vinculado.cp_tarefa_tipo;
                                
                                // Se tem tipo de tarefa vinculado (com ou sem tarefa específica)
                                if (tipoTarefaId && vinculado.tipo_atividade_nome) {
                                  if (!produto.tiposTarefa.has(tipoTarefaId)) {
                                    produto.tiposTarefa.set(tipoTarefaId, {
                                      id: tipoTarefaId,
                                      nome: vinculado.tipo_atividade_nome,
                                      tarefas: []
                                    });
                                  }
                                }
                              }
                            });
                            
                            // Depois, adicionar tarefas às seções de tipo correspondentes
                            grupo.vinculados.forEach(vinculado => {
                              // Produtos vinculados ao cliente (com ou sem tarefa)
                              if (vinculado.cp_produto && vinculado.produto_nome) {
                                const produtoId = vinculado.cp_produto;
                                const produto = produtosMap.get(produtoId);
                                const tarefaId = vinculado.cp_tarefa !== null && vinculado.cp_tarefa !== undefined 
                                  ? vinculado.cp_tarefa : null;
                                const tipoTarefaId = vinculado.cp_tarefa_tipo;
                                
                                const atividadeNome = vinculado.atividade_nome || vinculado.tarefa_nome || null;
                                
                                // Adicionar tarefa se tiver ID e nome
                                if (tarefaId !== null && tarefaId !== undefined && atividadeNome) {
                                  const subtarefaId = vinculado.cp_subtarefa;
                                  const subtarefaNome = vinculado.subtarefa_nome;
                                  
                                  // Se tem tipo de tarefa neste vinculado, adicionar à seção do tipo
                                  if (tipoTarefaId && vinculado.tipo_atividade_nome) {
                                    const tipoTarefa = produto.tiposTarefa.get(tipoTarefaId);
                                    if (tipoTarefa) {
                                      const tarefaExistente = tipoTarefa.tarefas.find(t => 
                                        t.id === tarefaId || String(t.id) === String(tarefaId)
                                      );
                                      if (!tarefaExistente) {
                                        tipoTarefa.tarefas.push({
                                          id: tarefaId,
                                          nome: atividadeNome,
                                          vinculadoId: vinculado.id,
                                          subtarefas: []
                                        });
                                      }
                                      
                                      // Adicionar subtarefa se houver
                                      if (subtarefaId && subtarefaNome) {
                                        const tarefa = tipoTarefa.tarefas.find(t => 
                                          t.id === tarefaId || String(t.id) === String(tarefaId)
                                        );
                                        if (tarefa && !tarefa.subtarefas) {
                                          tarefa.subtarefas = [];
                                        }
                                        if (tarefa) {
                                          const subtarefaExistente = tarefa.subtarefas.find(s => 
                                            s.id === subtarefaId || String(s.id) === String(subtarefaId)
                                          );
                                          if (!subtarefaExistente) {
                                            tarefa.subtarefas.push({
                                              id: subtarefaId,
                                              nome: subtarefaNome,
                                          vinculadoId: vinculado.id
                                        });
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    // Se não tem tipo de tarefa neste vinculado, verificar se a tarefa tem tipo em outro vinculado do grupo
                                    const tarefaComTipo = grupo.vinculados.find(v => 
                                      v.cp_tarefa === tarefaId && v.cp_tarefa_tipo && v.tipo_atividade_nome
                                    );
                                    
                                    if (tarefaComTipo && tarefaComTipo.cp_tarefa_tipo) {
                                      // Tarefa tem tipo em outro vinculado, adicionar à seção do tipo
                                      const tipoTarefa = produto.tiposTarefa.get(tarefaComTipo.cp_tarefa_tipo);
                                      if (tipoTarefa) {
                                        const tarefaExistente = tipoTarefa.tarefas.find(t => 
                                          t.id === tarefaId || String(t.id) === String(tarefaId)
                                        );
                                        if (!tarefaExistente) {
                                          tipoTarefa.tarefas.push({
                                            id: tarefaId,
                                            nome: atividadeNome,
                                            vinculadoId: vinculado.id
                                          });
                                        }
                                      }
                                    } else {
                                      // Tarefa realmente não tem tipo vinculado, criar seção "Sem Tipo"
                                      const semTipoKey = 'sem_tipo';
                                      if (!produto.tiposTarefa.has(semTipoKey)) {
                                        produto.tiposTarefa.set(semTipoKey, {
                                          id: semTipoKey,
                                          nome: 'Sem Tipo',
                                          tarefas: []
                                        });
                                      }
                                      const semTipo = produto.tiposTarefa.get(semTipoKey);
                                      const tarefaExistente = semTipo.tarefas.find(t => 
                                        t.id === tarefaId || String(t.id) === String(tarefaId)
                                      );
                                      if (!tarefaExistente) {
                                        semTipo.tarefas.push({
                                          id: tarefaId,
                                          nome: atividadeNome,
                                          vinculadoId: vinculado.id,
                                          subtarefas: []
                                        });
                                      }
                                      
                                      // Adicionar subtarefa se houver
                                      const subtarefaId = vinculado.cp_subtarefa;
                                      const subtarefaNome = vinculado.subtarefa_nome;
                                      if (subtarefaId && subtarefaNome) {
                                        const tarefa = semTipo.tarefas.find(t => 
                                          t.id === tarefaId || String(t.id) === String(tarefaId)
                                        );
                                        if (tarefa && !tarefa.subtarefas) {
                                          tarefa.subtarefas = [];
                                        }
                                        if (tarefa) {
                                          const subtarefaExistente = tarefa.subtarefas.find(s => 
                                            s.id === subtarefaId || String(s.id) === String(subtarefaId)
                                          );
                                          if (!subtarefaExistente) {
                                            tarefa.subtarefas.push({
                                              id: subtarefaId,
                                              nome: subtarefaNome,
                                          vinculadoId: vinculado.id
                                        });
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            });
                            
                            // Converter Map de tipos de tarefa para arrays
                            const produtosArray = Array.from(produtosMap.values()).map(produto => ({
                              ...produto,
                              tiposTarefa: Array.from(produto.tiposTarefa.values())
                            }));
                            
                            // Adicionar tarefas padrão dos produtos (tarefas vinculadas ao produto sem cliente)
                            produtosArray.forEach(produto => {
                              const tarefasPadrao = tarefasPadraoPorProduto[produto.id] || [];
                              tarefasPadrao.forEach(tarefaPadrao => {
                                // Verificar se a tarefa padrão já não está nas tarefas vinculadas ao cliente
                                let jaExiste = false;
                                for (const tipoTarefa of produto.tiposTarefa) {
                                  const existe = tipoTarefa.tarefas.find(t => 
                                    t.id === tarefaPadrao.id || String(t.id) === String(tarefaPadrao.id)
                                  );
                                  if (existe) {
                                    jaExiste = true;
                                    break;
                                  }
                                }
                                
                                if (!jaExiste) {
                                  // Verificar se a tarefa padrão tem tipo vinculado em algum registro do grupo
                                  const tarefaComTipo = grupo.vinculados.find(v => 
                                    v.cp_tarefa === tarefaPadrao.id && v.cp_tarefa_tipo && v.tipo_atividade_nome
                                  );
                                  
                                  if (tarefaComTipo && tarefaComTipo.cp_tarefa_tipo) {
                                    // Tarefa padrão tem tipo vinculado, adicionar à seção do tipo
                                    const tipoTarefa = produto.tiposTarefa.find(t => t.id === tarefaComTipo.cp_tarefa_tipo);
                                    if (tipoTarefa) {
                                      tipoTarefa.tarefas.push({
                                        id: tarefaPadrao.id,
                                        nome: tarefaPadrao.nome,
                                        vinculadoId: null,
                                        isPadrao: true
                                      });
                                    } else {
                                      // Tipo não existe ainda, criar
                                      produto.tiposTarefa.push({
                                        id: tarefaComTipo.cp_tarefa_tipo,
                                        nome: tarefaComTipo.tipo_atividade_nome,
                                        tarefas: [{
                                          id: tarefaPadrao.id,
                                          nome: tarefaPadrao.nome,
                                          vinculadoId: null,
                                          isPadrao: true
                                        }]
                                      });
                                    }
                                  } else {
                                    // Tarefa padrão realmente não tem tipo vinculado, adicionar na seção "Sem Tipo"
                                    let semTipo = produto.tiposTarefa.find(t => t.id === 'sem_tipo');
                                    if (!semTipo) {
                                      semTipo = {
                                        id: 'sem_tipo',
                                        nome: 'Sem Tipo',
                                        tarefas: []
                                      };
                                      produto.tiposTarefa.push(semTipo);
                                    }
                                    semTipo.tarefas.push({
                                      id: tarefaPadrao.id,
                                      nome: tarefaPadrao.nome,
                                      vinculadoId: null,
                                      isPadrao: true
                                    });
                                  }
                                }
                              });
                            });
                            
                            return (
                              <div key={index} className="client-card">
                                <div className="client-card-header">
                                  <h3 className="client-card-title">{grupo.nome}</h3>
                                  <div className="client-card-header-actions">
                                    <DeleteButton
                                      onClick={() => {
                                        const vinculadosIds = grupo.vinculados.map(v => {
                                          const id = v.id;
                                          if (typeof id === 'string') {
                                            const numId = parseInt(id, 10);
                                            return isNaN(numId) ? id : numId;
                                          }
                                          return id;
                                        });
                                        handleRequestDeleteGroup(vinculadosIds);
                                      }}
                                      title="Excluir todas as vinculações do grupo"
                                    />
                                  </div>
                                </div>
                                <div className="client-card-body">
                                  <div className="vinculado-items-container">
                                    {/* Seções de Tipos de Tarefa + Produto com suas Tarefas (expansível) - Estrutura primária */}
                                    {(() => {
                                      // Agrupar por tipo de tarefa + produto
                                      const tiposTarefaProdutoMap = new Map();
                                      produtosArray.forEach(produto => {
                                        produto.tiposTarefa.forEach(tipoTarefa => {
                                          // Criar chave única combinando tipo de tarefa + produto
                                          const key = `${tipoTarefa.id}_${produto.id}`;
                                          if (!tiposTarefaProdutoMap.has(key)) {
                                            tiposTarefaProdutoMap.set(key, {
                                              id: key,
                                              tipoTarefaId: tipoTarefa.id,
                                              tipoTarefaNome: tipoTarefa.nome,
                                              produtoId: produto.id,
                                              produtoNome: produto.nome,
                                              tarefas: []
                                            });
                                          }
                                          // Adicionar tarefas deste tipo deste produto
                                          if (tipoTarefa.tarefas) {
                                            tipoTarefa.tarefas.forEach(tarefa => {
                                              const tarefaExistente = tiposTarefaProdutoMap.get(key).tarefas.find(
                                                t => t.id === tarefa.id || String(t.id) === String(tarefa.id)
                                              );
                                              if (!tarefaExistente) {
                                                tiposTarefaProdutoMap.get(key).tarefas.push({
                                                  id: tarefa.id,
                                                  nome: tarefa.nome,
                                                  isPadrao: tarefa.isPadrao
                                                });
                                              }
                                            });
                                          }
                                        });
                                      });
                                      
                                      return Array.from(tiposTarefaProdutoMap.values()).map(tipoTarefaProduto => (
                                        <ProdutoSectionExpandable
                                          key={tipoTarefaProduto.id}
                                          title={`${tipoTarefaProduto.tipoTarefaNome} (${tipoTarefaProduto.produtoNome})`}
                                          icon="fas fa-tags"
                                          items={tipoTarefaProduto.tarefas.map(tarefa => ({
                                            id: tarefa.id,
                                            nome: tarefa.nome
                                          }))}
                                          emptyMessage="Nenhuma tarefa vinculada a este tipo"
                                        />
                                      ));
                                    })()}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Se for produto, mostrar Tarefas, Tipos de Tarefa e Clientes vinculados (mesmo padrão de tarefa)
                          if (filtroPrincipal === 'produto') {
                            const tarefasMap = new Map(); // Tarefas vinculadas ao produto
                            const tiposTarefaMap = new Map(); // Tipos de tarefa vinculados ao produto
                            const clientesMap = new Map(); // Clientes vinculados ao produto
                            
                            grupo.vinculados.forEach(vinculado => {
                              // Tarefas vinculadas ao produto (sem cliente)
                              if (vinculado.cp_tarefa && vinculado.atividade_nome && !vinculado.cp_cliente) {
                                const tarefaId = vinculado.cp_tarefa;
                                if (!tarefasMap.has(tarefaId)) {
                                  tarefasMap.set(tarefaId, {
                                    id: tarefaId,
                                    nome: vinculado.atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Tipos de tarefa vinculados ao produto
                              if (vinculado.cp_tarefa_tipo && vinculado.tipo_atividade_nome && !vinculado.cp_cliente) {
                                const tipoId = vinculado.cp_tarefa_tipo;
                                if (!tiposTarefaMap.has(tipoId)) {
                                  tiposTarefaMap.set(tipoId, {
                                    id: tipoId,
                                    nome: vinculado.tipo_atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Clientes vinculados ao produto
                              if (vinculado.cp_cliente && vinculado.cliente_nome) {
                                const clienteId = String(vinculado.cp_cliente).trim();
                                if (!clientesMap.has(clienteId)) {
                                  clientesMap.set(clienteId, {
                                    id: clienteId,
                                    nome: vinculado.cliente_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                            });
                            
                            const tarefasArray = Array.from(tarefasMap.values());
                            const tiposTarefaArray = Array.from(tiposTarefaMap.values());
                            const clientesArray = Array.from(clientesMap.values());
                            
                            return (
                              <div key={index} className="client-card">
                                <div className="client-card-header">
                                  <h3 className="client-card-title">{grupo.nome}</h3>
                                  <div className="client-card-header-actions">
                                    <DeleteButton
                                      onClick={() => {
                                        const vinculadosIds = grupo.vinculados.map(v => {
                                          const id = v.id;
                                          if (typeof id === 'string') {
                                            const numId = parseInt(id, 10);
                                            return isNaN(numId) ? id : numId;
                                          }
                                          return id;
                                        });
                                        handleRequestDeleteGroup(vinculadosIds);
                                      }}
                                      title="Excluir todas as vinculações do grupo"
                                    />
                                  </div>
                                </div>
                                <div className="client-card-body">
                                  <div className="vinculado-items-container">
                                    {/* Seção de Tarefas (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tarefas Vinculadas"
                                      icon="fas fa-tasks"
                                      items={tarefasArray}
                                      emptyMessage="Nenhuma tarefa vinculada a este produto"
                                    />
                                    
                                    {/* Seção de Tipos de Tarefa (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tipos de Tarefa Vinculados"
                                      icon="fas fa-tags"
                                      items={tiposTarefaArray}
                                      emptyMessage="Nenhum tipo de tarefa vinculado a este produto"
                                    />
                                    
                                    {/* Seção de Clientes (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Clientes Vinculados"
                                      icon="fas fa-briefcase"
                                      items={clientesArray}
                                      emptyMessage="Nenhum cliente vinculado a este produto"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Se for tarefa (atividade), mostrar Tipos de Tarefa, Produtos e Clientes vinculados
                          if (filtroPrincipal === 'atividade') {
                            const tiposTarefaMap = new Map(); // Tipos de tarefa vinculados à tarefa
                            const produtosMap = new Map(); // Produtos vinculados à tarefa
                            const clientesMap = new Map(); // Clientes vinculados à tarefa
                            
                            grupo.vinculados.forEach(vinculado => {
                              // Tipos de tarefa vinculados à tarefa
                              if (vinculado.cp_tarefa_tipo && vinculado.tipo_atividade_nome) {
                                const tipoId = vinculado.cp_tarefa_tipo;
                                if (!tiposTarefaMap.has(tipoId)) {
                                  tiposTarefaMap.set(tipoId, {
                                    id: tipoId,
                                    nome: vinculado.tipo_atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Produtos vinculados à tarefa
                              if (vinculado.cp_produto && vinculado.produto_nome) {
                                const produtoId = vinculado.cp_produto;
                                if (!produtosMap.has(produtoId)) {
                                  produtosMap.set(produtoId, {
                                    id: produtoId,
                                    nome: vinculado.produto_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Clientes vinculados à tarefa
                              if (vinculado.cp_cliente && vinculado.cliente_nome) {
                                const clienteId = String(vinculado.cp_cliente).trim();
                                if (!clientesMap.has(clienteId)) {
                                  clientesMap.set(clienteId, {
                                    id: clienteId,
                                    nome: vinculado.cliente_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                            });
                            
                            const tiposTarefaArray = Array.from(tiposTarefaMap.values());
                            const produtosArray = Array.from(produtosMap.values());
                            const clientesArray = Array.from(clientesMap.values());
                            
                            return (
                              <div key={index} className="client-card">
                                <div className="client-card-header">
                                  <h3 className="client-card-title">{grupo.nome}</h3>
                                  <div className="client-card-header-actions">
                                    <DeleteButton
                                      onClick={() => {
                                        const vinculadosIds = grupo.vinculados.map(v => {
                                          const id = v.id;
                                          if (typeof id === 'string') {
                                            const numId = parseInt(id, 10);
                                            return isNaN(numId) ? id : numId;
                                          }
                                          return id;
                                        });
                                        handleRequestDeleteGroup(vinculadosIds);
                                      }}
                                      title="Excluir todas as vinculações do grupo"
                                    />
                                  </div>
                                </div>
                                <div className="client-card-body">
                                  <div className="vinculado-items-container">
                                    {/* Seção de Tipos de Tarefa (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tipos de Tarefa Vinculados"
                                      icon="fas fa-tags"
                                      items={tiposTarefaArray}
                                      emptyMessage="Nenhum tipo de tarefa vinculado a esta tarefa"
                                    />
                                    
                                    {/* Seção de Produtos (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Produtos Vinculados"
                                      icon="fas fa-box"
                                      items={produtosArray}
                                      emptyMessage="Nenhum produto vinculado a esta tarefa"
                                    />
                                    
                                    {/* Seção de Clientes (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Clientes Vinculados"
                                      icon="fas fa-briefcase"
                                      items={clientesArray}
                                      emptyMessage="Nenhum cliente vinculado a esta tarefa"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Se for tipo de tarefa, organizar hierarquicamente: Tipo de Tarefa > Tarefas, Produtos e Clientes
                          if (filtroPrincipal === 'tipoTarefa') {
                            const tarefasMap = new Map(); // Tarefas vinculadas ao tipo
                            const produtosMap = new Map(); // Produtos vinculados ao tipo
                            const clientesMap = new Map(); // Clientes vinculados ao tipo
                            
                            grupo.vinculados.forEach(vinculado => {
                              // Tarefas vinculadas ao tipo
                              if (vinculado.cp_tarefa && vinculado.atividade_nome) {
                                const tarefaId = vinculado.cp_tarefa;
                                if (!tarefasMap.has(tarefaId)) {
                                  tarefasMap.set(tarefaId, {
                                    id: tarefaId,
                                    nome: vinculado.atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Produtos vinculados ao tipo
                              if (vinculado.cp_produto && vinculado.produto_nome) {
                                const produtoId = vinculado.cp_produto;
                                if (!produtosMap.has(produtoId)) {
                                  produtosMap.set(produtoId, {
                                    id: produtoId,
                                    nome: vinculado.produto_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Clientes vinculados ao tipo
                              if (vinculado.cp_cliente && vinculado.cliente_nome) {
                                const clienteId = String(vinculado.cp_cliente).trim();
                                if (!clientesMap.has(clienteId)) {
                                  clientesMap.set(clienteId, {
                                    id: clienteId,
                                    nome: vinculado.cliente_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                            });
                            
                            const tarefasArray = Array.from(tarefasMap.values());
                            const produtosArray = Array.from(produtosMap.values());
                            const clientesArray = Array.from(clientesMap.values());
                            
                            return (
                              <div key={index} className="client-card">
                                <div className="client-card-header">
                                  <h3 className="client-card-title">{grupo.nome}</h3>
                                  <div className="client-card-header-actions">
                                    <DeleteButton
                                      onClick={() => {
                                        const vinculadosIds = grupo.vinculados.map(v => {
                                          const id = v.id;
                                          if (typeof id === 'string') {
                                            const numId = parseInt(id, 10);
                                            return isNaN(numId) ? id : numId;
                                          }
                                          return id;
                                        });
                                        handleRequestDeleteGroup(vinculadosIds);
                                      }}
                                      title="Excluir todas as vinculações do grupo"
                                    />
                                  </div>
                                </div>
                                <div className="client-card-body">
                                  <div className="vinculado-items-container">
                                    {/* Seção de Tarefas (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tarefas Vinculadas"
                                      icon="fas fa-list"
                                      items={tarefasArray}
                                      emptyMessage="Nenhuma tarefa vinculada a este tipo"
                                    />
                                    
                                    {/* Seção de Produtos (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Produtos Vinculados"
                                      icon="fas fa-box"
                                      items={produtosArray}
                                      emptyMessage="Nenhum produto vinculado a este tipo"
                                    />
                                    
                                    {/* Seção de Clientes (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Clientes Vinculados"
                                      icon="fas fa-briefcase"
                                      items={clientesArray}
                                      emptyMessage="Nenhum cliente vinculado a este tipo"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Se for subtarefa, mostrar Tarefas, Tipos de Tarefa, Produtos e Clientes vinculados
                          if (filtroPrincipal === 'subtarefa') {
                            const tarefasMap = new Map(); // Tarefas vinculadas à subtarefa
                            const tiposTarefaMap = new Map(); // Tipos de tarefa vinculados à subtarefa
                            const produtosMap = new Map(); // Produtos vinculados à subtarefa
                            const clientesMap = new Map(); // Clientes vinculados à subtarefa
                            
                            grupo.vinculados.forEach(vinculado => {
                              // Tarefas vinculadas à subtarefa
                              if (vinculado.cp_tarefa && vinculado.atividade_nome) {
                                const tarefaId = vinculado.cp_tarefa;
                                if (!tarefasMap.has(tarefaId)) {
                                  tarefasMap.set(tarefaId, {
                                    id: tarefaId,
                                    nome: vinculado.atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Tipos de tarefa vinculados à subtarefa
                              if (vinculado.cp_tarefa_tipo && vinculado.tipo_atividade_nome) {
                                const tipoId = vinculado.cp_tarefa_tipo;
                                if (!tiposTarefaMap.has(tipoId)) {
                                  tiposTarefaMap.set(tipoId, {
                                    id: tipoId,
                                    nome: vinculado.tipo_atividade_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Produtos vinculados à subtarefa
                              if (vinculado.cp_produto && vinculado.produto_nome) {
                                const produtoId = vinculado.cp_produto;
                                if (!produtosMap.has(produtoId)) {
                                  produtosMap.set(produtoId, {
                                    id: produtoId,
                                    nome: vinculado.produto_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                              
                              // Clientes vinculados à subtarefa
                              if (vinculado.cp_cliente && vinculado.cliente_nome) {
                                const clienteId = String(vinculado.cp_cliente).trim();
                                if (!clientesMap.has(clienteId)) {
                                  clientesMap.set(clienteId, {
                                    id: clienteId,
                                    nome: vinculado.cliente_nome,
                                    vinculadoId: vinculado.id
                                  });
                                }
                              }
                            });
                            
                            const tarefasArray = Array.from(tarefasMap.values());
                            const tiposTarefaArray = Array.from(tiposTarefaMap.values());
                            const produtosArray = Array.from(produtosMap.values());
                            const clientesArray = Array.from(clientesMap.values());
                            
                            return (
                              <div key={index} className="client-card">
                                <div className="client-card-header">
                                  <h3 className="client-card-title">{grupo.nome}</h3>
                                  <div className="client-card-header-actions">
                                    <DeleteButton
                                      onClick={() => {
                                        const vinculadosIds = grupo.vinculados.map(v => {
                                          const id = v.id;
                                          if (typeof id === 'string') {
                                            const numId = parseInt(id, 10);
                                            return isNaN(numId) ? id : numId;
                                          }
                                          return id;
                                        });
                                        handleRequestDeleteGroup(vinculadosIds);
                                      }}
                                      title="Excluir todas as vinculações do grupo"
                                    />
                                  </div>
                                </div>
                                <div className="client-card-body">
                                  <div className="vinculado-items-container">
                                    {/* Seção de Tarefas (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tarefas Vinculadas"
                                      icon="fas fa-tasks"
                                      items={tarefasArray}
                                      emptyMessage="Nenhuma tarefa vinculada a esta subtarefa"
                                    />
                                    
                                    {/* Seção de Tipos de Tarefa (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Tipos de Tarefa Vinculados"
                                      icon="fas fa-tags"
                                      items={tiposTarefaArray}
                                      emptyMessage="Nenhum tipo de tarefa vinculado a esta subtarefa"
                                    />
                                    
                                    {/* Seção de Produtos (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Produtos Vinculados"
                                      icon="fas fa-box"
                                      items={produtosArray}
                                      emptyMessage="Nenhum produto vinculado a esta subtarefa"
                                    />
                                    
                                    {/* Seção de Clientes (expansível) */}
                                    <ProdutoSectionExpandable
                                      title="Clientes Vinculados"
                                      icon="fas fa-briefcase"
                                      items={clientesArray}
                                      emptyMessage="Nenhum cliente vinculado a esta subtarefa"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          // Para outros filtros, manter lógica atual
                          // Coletar itens únicos para evitar duplicatas
                          const itensUnicos = {
                            atividades: new Set(),
                            produtos: new Set(),
                            tiposAtividade: new Set(),
                            clientes: new Set()
                          };
                          
                          grupo.vinculados.forEach(vinculado => {
                            const tarefaId = vinculado.cp_tarefa;
                            const tipoId = vinculado.cp_tarefa_tipo;
                            
                            if (filtroPrincipal !== 'atividade' && filtroPrincipal !== 'subtarefa' && tarefaId && vinculado.atividade_nome) {
                              itensUnicos.atividades.add(JSON.stringify({
                                id: tarefaId,
                                nome: vinculado.atividade_nome
                              }));
                            }
                            if (filtroPrincipal !== 'produto' && vinculado.cp_produto && vinculado.produto_nome) {
                              itensUnicos.produtos.add(JSON.stringify({
                                id: vinculado.cp_produto,
                                nome: vinculado.produto_nome
                              }));
                            }
                            if (filtroPrincipal !== 'tipoTarefa' && tipoId && vinculado.tipo_atividade_nome) {
                              itensUnicos.tiposAtividade.add(JSON.stringify({
                                id: tipoId,
                                nome: vinculado.tipo_atividade_nome
                              }));
                            }
                            if (filtroPrincipal !== 'cliente' && vinculado.cp_cliente && vinculado.cliente_nome) {
                              itensUnicos.clientes = itensUnicos.clientes || new Set();
                              itensUnicos.clientes.add(JSON.stringify({
                                id: String(vinculado.cp_cliente).trim(),
                                nome: vinculado.cliente_nome
                              }));
                            }
                          });
                          
                          // Converter Sets para arrays
                          const atividadesArray = Array.from(itensUnicos.atividades).map(item => JSON.parse(item));
                          const produtosArray = Array.from(itensUnicos.produtos).map(item => JSON.parse(item));
                          const tiposArray = Array.from(itensUnicos.tiposAtividade).map(item => JSON.parse(item));
                          const clientesArray = Array.from(itensUnicos.clientes || []).map(item => JSON.parse(item));
                          
                          return (
                            <div key={index} className="client-card">
                              <div className="client-card-header">
                                <h3 className="client-card-title">{grupo.nome}</h3>
                                <div className="client-card-header-actions">
                                  <DeleteButton
                                    onClick={() => {
                                      // Garantir que os IDs sejam números
                                      const vinculadosIds = grupo.vinculados.map(v => {
                                        const id = v.id;
                                        // Se for string, tentar converter para número
                                        if (typeof id === 'string') {
                                          const numId = parseInt(id, 10);
                                          return isNaN(numId) ? id : numId;
                                        }
                                        return id;
                                      });
                                      console.log('🗑️ IDs coletados do grupo:', vinculadosIds, 'Tipo do primeiro:', typeof vinculadosIds[0]);
                                      handleRequestDeleteGroup(vinculadosIds);
                                    }}
                                    title="Excluir todas as vinculações do grupo"
                                  />
                                </div>
                              </div>
                              <div className="client-card-body">
                                <div className="vinculado-items-container">
                                  {/* Tarefas */}
                                  {atividadesArray.map((item, idx) => (
                                    <div key={`atividade_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-list"></i>
                                        <span className="vinculado-item-label">Tarefa</span>
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
                                  
                                  {/* Tipos de Tarefa */}
                                  {tiposArray.map((item, idx) => (
                                    <div key={`tipo_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-list"></i>
                                        <span className="vinculado-item-label">Tipo de Tarefa</span>
                                      </div>
                                      <div className="vinculado-item-value">
                                        {item.nome}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Clientes */}
                                  {clientesArray.map((item, idx) => (
                                    <div key={`cliente_${item.id}_${idx}`} className="vinculado-item-card">
                                      <div className="vinculado-item-header">
                                        <i className="fas fa-briefcase"></i>
                                        <span className="vinculado-item-label">Cliente</span>
                                      </div>
                                      <div className="vinculado-item-value">
                                        {item.nome}
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Se não houver itens secundários */}
                                  {atividadesArray.length === 0 && produtosArray.length === 0 && tiposArray.length === 0 && clientesArray.length === 0 && (
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
                              {vinculado.cp_tarefa && (
                                <div className="vinculado-item-row">
                                  <div className="vinculado-item-header">
                                    <i className="fas fa-list"></i>
                                    <span className="vinculado-item-label">Tarefa</span>
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
                              {vinculado.cp_tarefa_tipo && (
                                <div className="vinculado-item-row">
                                  <div className="vinculado-item-header">
                                    <i className="fas fa-list"></i>
                                    <span className="vinculado-item-label">Tipo de Tarefa</span>
                                  </div>
                                  <div className="vinculado-item-value">
                                    {vinculado.tipo_atividade_nome || 'Nome não encontrado'}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="vinculado-item-actions">
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
                        const val = e.target.value;
                        setItemsPerPage(val === 'all' ? 0 : parseInt(val, 10));
                        setCurrentPage(1);
                      }}
                    >
                      <option value="0">Todos</option>
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

