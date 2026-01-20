import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterMembro from '../../components/filters/FilterMembro';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import {
  clientesAPI,
  colaboradoresAPI,
  produtosAPI,
  tarefasAPI,
  historicoAtribuicoesAPI
} from '../../services/api';
import '../AtribuicaoCliente/AtribuicaoCliente.css';
import './HistoricoAtribuicoes.css';

const HistoricoAtribuicoes = () => {
  const navigate = useNavigate();
  const showToast = useToast();

  // Estado principal
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Filtros
  const [filtroResponsavel, setFiltroResponsavel] = useState(null);
  const [filtroUsuarioCriador, setFiltroUsuarioCriador] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Dados auxiliares
  const [todosClientes, setTodosClientes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);
  const [nomesProdutos, setNomesProdutos] = useState({});
  const [nomesTarefas, setNomesTarefas] = useState({});

  // Estados de Modais e Ações
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para clientes no formato CustomSelect
  const [clientes, setClientes] = useState([]);

  // Controle de expansão e detalhes
  const [linhasExpandidas, setLinhasExpandidas] = useState(new Set());
  const [detalhesDiarios, setDetalhesDiarios] = useState({});
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(new Set());

  // Edição/Exclusão de tarefa diária
  const [modalEdicaoTarefaDiaria, setModalEdicaoTarefaDiaria] = useState(false);
  const [tarefaDiariaEditando, setTarefaDiariaEditando] = useState(null);
  const [tempoEditando, setTempoEditando] = useState({ horas: 0, minutos: 0 });
  const [salvandoTarefaDiaria, setSalvandoTarefaDiaria] = useState(false);
  const [showDeleteTarefaDiariaModal, setShowDeleteTarefaDiariaModal] = useState(false);
  const [tarefaDiariaParaDeletar, setTarefaDiariaParaDeletar] = useState(null);
  const [deletandoTarefaDiaria, setDeletandoTarefaDiaria] = useState(false);

  // Regras Órfãs
  const [regrasOrfas, setRegrasOrfas] = useState([]);
  const [carregandoRegrasOrfas, setCarregandoRegrasOrfas] = useState(false);
  const [sincronizandoOrfas, setSincronizandoOrfas] = useState(false);
  const [showDeleteRegraOrfaModal, setShowDeleteRegraOrfaModal] = useState(false);
  const [regraOrfaParaDeletar, setRegraOrfaParaDeletar] = useState(null);
  const [deletandoRegraOrfa, setDeletandoRegraOrfa] = useState(false);

  // Carregar dados iniciais (Clientes e Colaboradores)
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [clientesResponse, colaboradoresResponse] = await Promise.all([
          clientesAPI.getPaginated({ page: 1, limit: 10000, incompletos: false }),
          colaboradoresAPI.getAll({ page: 1, limit: 10000 })
        ]);

        if (clientesResponse.success && clientesResponse.data) {
          const clientesArray = Array.isArray(clientesResponse.data)
            ? clientesResponse.data
            : (clientesResponse.data.data || []);

          if (Array.isArray(clientesArray)) {
            const clientesComDados = clientesArray.map(cliente => ({
              id: cliente.id,
              nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`
            }));
            setClientes(clientesComDados);
            setTodosClientes(clientesArray);
          }
        }

        if (colaboradoresResponse.success) {
          setTodosColaboradores(colaboradoresResponse.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar dados para filtros:', error);
        showToast('error', 'Erro ao carregar dados iniciais.');
      }
    };

    carregarDados();
  }, [showToast]);

  // Carregar nomes de produtos e tarefas baseado no histórico visível
  useEffect(() => {
    const carregarNomes = async () => {
      const produtoIds = new Set();
      const tarefaIds = new Set();

      historico.forEach(item => {
        if (Array.isArray(item.produto_ids)) {
          item.produto_ids.forEach(id => {
            const idStr = String(id).trim();
            if (idStr) produtoIds.add(idStr);
          });
        }
        if (Array.isArray(item.tarefas)) {
          item.tarefas.forEach(t => {
            const idStr = String(t.tarefa_id).trim();
            if (idStr) tarefaIds.add(idStr);
          });
        }
      });

      if (produtoIds.size > 0) {
        try {
          const idsArray = Array.from(produtoIds);
          const response = await produtosAPI.getByIds(idsArray);

          if (response.success && response.data) {
            const produtosMap = {};
            Object.keys(response.data).forEach(key => {
              produtosMap[String(key)] = response.data[key];
            });
            setNomesProdutos(prev => ({ ...prev, ...produtosMap }));
          }
        } catch (error) {
          console.error('Erro ao carregar nomes de produtos:', error);
        }
      }

      if (tarefaIds.size > 0) {
        try {
          const idsArray = Array.from(tarefaIds);
          const response = await tarefasAPI.getByIds(idsArray);

          if (response.success && response.data) {
            const tarefasMap = {};
            Object.keys(response.data).forEach(key => {
              tarefasMap[String(key)] = response.data[key];
            });
            setNomesTarefas(prev => ({ ...prev, ...tarefasMap }));
          }
        } catch (error) {
          console.error('Erro ao carregar nomes de tarefas:', error);
        }
      }
    };

    if (historico.length > 0) {
      carregarNomes();
    }
  }, [historico]);

  // Carregar histórico principal
  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const response = await historicoAtribuicoesAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        responsavel_id: filtroResponsavel,
        usuario_criador_id: filtroUsuarioCriador,
        data_inicio: filtroDataInicio,
        data_fim: filtroDataFim
      });

      if (response.success) {
        setHistorico(response.data || []);
        setTotalRegistros(response.total || 0);
        setTotalPages(response.totalPages || 1);
      } else {
        showToast('error', response.error || 'Erro ao carregar histórico');
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      showToast('error', 'Erro ao carregar histórico. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroResponsavel, filtroUsuarioCriador, filtroDataInicio, filtroDataFim, showToast]);

  // Carregar regras órfãs
  const carregarRegrasOrfas = useCallback(async () => {
    try {
      setCarregandoRegrasOrfas(true);
      const response = await historicoAtribuicoesAPI.getOrfas();

      if (response.success) {
        setRegrasOrfas(response.data || []);
      } else {
        setRegrasOrfas([]);
      }
    } catch (error) {
      // Falha silenciosa para não atrapalhar o usuário se for apenas um erro de rede secundário
      setRegrasOrfas([]);
    } finally {
      setCarregandoRegrasOrfas(false);
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    carregarRegrasOrfas();
  }, [carregarRegrasOrfas]);

  // Operações com Regras Órfãs
  const sincronizarRegrasOrfas = useCallback(async () => {
    setSincronizandoOrfas(true);
    try {
      const result = await historicoAtribuicoesAPI.sincronizarOrfas();
      if (result.success) {
        showToast('success', `Sincronização concluída: ${result.historicosCriados} histórico(s) criado(s)`);
        await carregarHistorico();
        await carregarRegrasOrfas();
      } else {
        showToast('error', result.error || 'Erro ao sincronizar regras órfãs');
      }
    } catch (error) {
      console.error('Erro ao sincronizar regras órfãs:', error);
      showToast('error', 'Erro ao sincronizar regras órfãs');
    } finally {
      setSincronizandoOrfas(false);
    }
  }, [carregarHistorico, carregarRegrasOrfas, showToast]);

  const deletarRegraOrfa = useCallback(async () => {
    if (!regraOrfaParaDeletar) return;
    setDeletandoRegraOrfa(true);
    try {
      const result = await historicoAtribuicoesAPI.deleteOrfa(regraOrfaParaDeletar.agrupador_id);
      if (result.success) {
        showToast('success', 'Regras deletadas com sucesso');
        setShowDeleteRegraOrfaModal(false);
        setRegraOrfaParaDeletar(null);
        await carregarRegrasOrfas();
      } else {
        showToast('error', result.error || 'Erro ao deletar regras');
      }
    } catch (error) {
      console.error('Erro ao deletar regra órfã:', error);
      showToast('error', 'Erro ao deletar regras');
    } finally {
      setDeletandoRegraOrfa(false);
    }
  }, [regraOrfaParaDeletar, carregarRegrasOrfas, showToast]);

  // Handlers de Filtros
  const handleResponsavelChange = (e) => {
    setFiltroResponsavel(e.target.value || null);
    setCurrentPage(1);
  };

  const handleUsuarioCriadorChange = (e) => {
    setFiltroUsuarioCriador(e.target.value || null);
    setCurrentPage(1);
  };

  const handleDataInicioChange = (e) => {
    setFiltroDataInicio(e.target.value || '');
    setCurrentPage(1);
  };

  const handleDataFimChange = (e) => {
    setFiltroDataFim(e.target.value || '');
    setCurrentPage(1);
  };

  const limparFiltros = () => {
    setFiltroResponsavel(null);
    setFiltroUsuarioCriador(null);
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setCurrentPage(1);
  };

  const hasPendingChanges = () => {
    return filtroResponsavel || filtroUsuarioCriador || filtroDataInicio || filtroDataFim;
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    carregarHistorico();
  };

  // Formatters
  const formatarTempo = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0h';
    const horas = Math.floor(milissegundos / (1000 * 60 * 60));
    const minutos = Math.floor((milissegundos % (1000 * 60 * 60)) / (1000 * 60));
    if (horas > 0 && minutos > 0) return `${horas}h ${minutos}min`;
    if (horas > 0) return `${horas}h`;
    return `${minutos}min`;
  };

  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Detalhes Diários / Expansão
  const toggleExpandirLinha = async (itemId) => {
    const novoSet = new Set(linhasExpandidas);

    if (novoSet.has(itemId)) {
      novoSet.delete(itemId);
      setLinhasExpandidas(novoSet);
    } else {
      novoSet.add(itemId);
      setLinhasExpandidas(novoSet);

      if (!detalhesDiarios[itemId] && !carregandoDetalhes.has(itemId)) {
        setCarregandoDetalhes(prev => new Set(prev).add(itemId));
        try {
          const response = await historicoAtribuicoesAPI.getDetalhesDiarios(itemId);
          if (response.success) {
            setDetalhesDiarios(prev => ({
              ...prev,
              [itemId]: response.data || []
            }));
          }
        } catch (error) {
          console.error('Erro ao carregar detalhes diários:', error);
          showToast('error', 'Erro ao carregar detalhes diários');
        } finally {
          setCarregandoDetalhes(prev => {
            const novo = new Set(prev);
            novo.delete(itemId);
            return novo;
          });
        }
      }
    }
  };

  // Edição de Atribuição
  const handleEditarAtribuicao = (item) => {
    let id = item.agrupador_id;
    if (id && typeof id === 'object') {
      id = id.agrupador_id;
    }
    if (!id) {
      id = item.id;
    }
    navigate(`/atribuicao/nova?agrupador_id=${id}`);
  };

  // Exclusão de Histórico
  const handleAbrirModalDeletar = (item) => {
    if (!item || !item.id) return;
    setItemParaDeletar(item);
    setShowDeleteConfirmModal(true);
  };

  const handleDeletarHistorico = async () => {
    if (!itemParaDeletar || !itemParaDeletar.id) return;

    setDeleteLoading(true);
    try {
      const result = await historicoAtribuicoesAPI.delete(itemParaDeletar.id);
      if (result.success) {
        showToast('success', 'Atribuição deletada com sucesso!');
        setShowDeleteConfirmModal(false);
        setItemParaDeletar(null);
        carregarHistorico();
      } else {
        showToast('error', result.error || 'Erro ao deletar atribuição');
      }
    } catch (error) {
      console.error('Erro ao deletar histórico:', error);
      showToast('error', `Erro ao deletar atribuição: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Edição de Tarefa Diária
  const abrirModalEdicaoTarefaDiaria = (tarefa, diaData, historicoId) => {
    const horas = Math.floor((tarefa.tempo_estimado_dia || 0) / (1000 * 60 * 60));
    const minutos = Math.floor(((tarefa.tempo_estimado_dia || 0) % (1000 * 60 * 60)) / (1000 * 60));
    setTarefaDiariaEditando({ ...tarefa, diaData, historicoId });
    setTempoEditando({ horas, minutos });
    setModalEdicaoTarefaDiaria(true);
  };

  const fecharModalEdicaoTarefaDiaria = () => {
    setModalEdicaoTarefaDiaria(false);
    setTarefaDiariaEditando(null);
    setTempoEditando({ horas: 0, minutos: 0 });
  };

  const salvarEdicaoTarefaDiaria = async () => {
    if (!tarefaDiariaEditando || !tarefaDiariaEditando.id) return;

    setSalvandoTarefaDiaria(true);
    try {
      const novoTempo = (tempoEditando.horas * 60 * 60 + tempoEditando.minutos * 60) * 1000;
      const result = await historicoAtribuicoesAPI.updateDetalheDiario(tarefaDiariaEditando.id, {
        tempo_estimado_dia: novoTempo
      });

      if (result.success) {
        showToast('success', 'Tarefa diária atualizada com sucesso!');
        fecharModalEdicaoTarefaDiaria();
        await carregarHistorico();

        // Atualizar lista expandida
        if (tarefaDiariaEditando.historicoId) {
          const responseDetalhes = await historicoAtribuicoesAPI.getDetalhesDiarios(tarefaDiariaEditando.historicoId);
          if (responseDetalhes.success) {
            setDetalhesDiarios(prev => ({
              ...prev,
              [tarefaDiariaEditando.historicoId]: responseDetalhes.data || []
            }));
          }
        }
      } else {
        showToast('error', result.error || 'Erro ao atualizar tarefa diária');
      }
    } catch (error) {
      console.error('Erro ao atualizar tarefa diária:', error);
      showToast('error', `Erro ao atualizar tarefa diária: ${error.message}`);
    } finally {
      setSalvandoTarefaDiaria(false);
    }
  };

  const abrirModalDeletarTarefaDiaria = (tarefa, diaData, historicoId) => {
    setTarefaDiariaParaDeletar({ ...tarefa, diaData, historicoId });
    setShowDeleteTarefaDiariaModal(true);
  };

  const deletarTarefaDiaria = async () => {
    if (!tarefaDiariaParaDeletar || !tarefaDiariaParaDeletar.id) return;

    setDeletandoTarefaDiaria(true);
    try {
      const result = await historicoAtribuicoesAPI.deleteDetalheDiario(tarefaDiariaParaDeletar.id);
      if (result.success) {
        showToast('success', 'Tarefa diária deletada com sucesso!');
        const historicoIdParaRecarregar = tarefaDiariaParaDeletar.historicoId;
        setShowDeleteTarefaDiariaModal(false);
        setTarefaDiariaParaDeletar(null);
        await carregarHistorico();

        if (historicoIdParaRecarregar) {
          const responseDetalhes = await historicoAtribuicoesAPI.getDetalhesDiarios(historicoIdParaRecarregar);
          if (responseDetalhes.success) {
            setDetalhesDiarios(prev => ({
              ...prev,
              [historicoIdParaRecarregar]: responseDetalhes.data || []
            }));
          }
        }
      } else {
        showToast('error', result.error || 'Erro ao deletar tarefa diária');
      }
    } catch (error) {
      console.error('Erro ao deletar tarefa diária:', error);
      showToast('error', `Erro ao deletar tarefa diária: ${error.message}`);
    } finally {
      setDeletandoTarefaDiaria(false);
    }
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="historico-atribuicoes-page">
              {/* Header */}
              <div className="historico-header">
                <div>
                  <h1 className="historico-title">Histórico de Atribuições</h1>
                  <p className="historico-subtitle">
                    Visualize todas as atribuições realizadas no sistema
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/atribuir-responsaveis')}
                  style={{ marginLeft: 'auto' }}
                >
                  <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>
                  Voltar
                </button>
              </div>

              {/* Filtros */}
              <FiltersCard
                onApply={handleApplyFilters}
                onClear={limparFiltros}
                showActions={true}
                loading={loading}
                hasPendingChanges={hasPendingChanges()}
              >
                <div className="filter-group">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Responsável
                  </label>
                  <FilterMembro
                    value={filtroResponsavel}
                    onChange={handleResponsavelChange}
                    options={todosColaboradores}
                    disabled={false}
                  />
                </div>

                <div className="filter-group">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Usuário Criador
                  </label>
                  <FilterMembro
                    value={filtroUsuarioCriador}
                    onChange={handleUsuarioCriadorChange}
                    options={todosColaboradores}
                    disabled={false}
                  />
                </div>

                <div className="filter-group">
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Período
                  </label>
                  <FilterPeriodo
                    dataInicio={filtroDataInicio}
                    dataFim={filtroDataFim}
                    onInicioChange={handleDataInicioChange}
                    onFimChange={handleDataFimChange}
                    disabled={false}
                  />
                </div>
              </FiltersCard>

              {/* Regras Órfãs */}
              {regrasOrfas && regraOrfaParaDeletar && regraOrfaParaDeletar.length > 0 && <div className="orfas-placeholder" />}
              {regrasOrfas && Array.isArray(regrasOrfas) && regrasOrfas.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-exclamation-triangle"></i>
                        Atribuições sem Histórico ({regrasOrfas.length})
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#78350f' }}>
                        Estas atribuições têm regras de tempo estimado mas não possuem histórico associado.
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={sincronizarRegrasOrfas}
                      disabled={sincronizandoOrfas}
                      style={{ minWidth: '180px' }}
                    >
                      {sincronizandoOrfas ? (
                        <>
                          <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-sync" style={{ marginRight: '8px' }}></i>
                          Criar Históricos
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #fde68a', borderRadius: '6px', backgroundColor: '#fffbeb' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fef3c7', borderBottom: '2px solid #fbbf24' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Cliente</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Responsável</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Período</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Tarefas</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: '#92400e', width: '100px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regrasOrfas.map((regra, index) => (
                          <tr key={regra.agrupador_id || index} style={{ borderBottom: '1px solid #fde68a', backgroundColor: index % 2 === 0 ? '#fffbeb' : '#fef3c7' }}>
                            <td style={{ padding: '10px' }}>{regra.cliente?.nome || `Cliente #${regra.cliente_id}`}</td>
                            <td style={{ padding: '10px' }}>{regra.responsavel?.nome || `Responsável #${regra.responsavel_id}`}</td>
                            <td style={{ padding: '10px' }}>{regra.data_inicio && regra.data_fim ? `${formatarData(regra.data_inicio)} até ${formatarData(regra.data_fim)}` : '-'}</td>
                            <td style={{ padding: '10px' }}>
                              {regra.tarefas && Array.isArray(regra.tarefas) ? `${regra.tarefas.length} tarefas` : '-'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setRegraOrfaParaDeletar(regra);
                                  setShowDeleteRegraOrfaModal(true);
                                }}
                                style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela Principal */}
              <div className="historico-table-container with-horizontal-scroll">
                {loading ? (
                  <div className="loading-state">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Carregando histórico...</p>
                  </div>
                ) : historico.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-history"></i>
                    <p>Nenhum registro de histórico encontrado</p>
                  </div>
                ) : (
                  <>
                    <div className="table-scroll-container" style={{ overflowX: 'auto' }}>
                      <table className="historico-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Data/Hora</th>
                            <th>Cliente</th>
                            <th>Responsável</th>
                            <th>Produtos</th>
                            <th>Período</th>
                            <th>Tarefas</th>
                            <th>Usuário Criador</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historico.map((item) => {
                            const estaExpandida = linhasExpandidas.has(item.id);
                            const detalhes = detalhesDiarios[item.id] || [];
                            const carregando = carregandoDetalhes.has(item.id);

                            return (
                              <React.Fragment key={item.id}>
                                <tr>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      onClick={() => toggleExpandirLinha(item.id)}
                                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0e3b6f' }}
                                    >
                                      <i className={`fas fa-chevron-${estaExpandida ? 'down' : 'right'}`}></i>
                                    </button>
                                  </td>
                                  <td>
                                    <div className="historico-date-time">
                                      <div className="historico-date">{formatarData(item.created_at?.split('T')[0])}</div>
                                      <div className="historico-time">{item.created_at?.split('T')[1]?.substring(0, 5)}</div>
                                    </div>
                                  </td>
                                  <td><div className="historico-cliente">{item.cliente?.nome || `Cliente #${item.cliente_id}`}</div></td>
                                  <td><div className="historico-responsavel">{item.responsavel?.nome || `Colaborador #${item.responsavel_id}`}</div></td>
                                  <td>
                                    <div className="historico-produtos">
                                      {item.produto_ids && Array.isArray(item.produto_ids) && item.produto_ids.length > 0 ? (
                                        item.produto_ids.map((produtoId) => (
                                          <div key={produtoId} className="historico-badge">
                                            <div className="historico-badge-label"><i className="fas fa-box"></i><span>PRODUTO</span></div>
                                            <div className="historico-badge-valor">{nomesProdutos[String(produtoId)] || `Produto #${produtoId}`}</div>
                                          </div>
                                        ))
                                      ) : <span>-</span>}
                                    </div>
                                  </td>
                                  <td><div className="historico-periodo">{formatarData(item.data_inicio)} - {formatarData(item.data_fim)}</div></td>
                                  <td>
                                    <div className="historico-tarefas">
                                      {item.tarefas && Array.isArray(item.tarefas) && item.tarefas.length > 0 ? (
                                        <div className="tarefas-list">
                                          {item.tarefas.map((tarefa, idx) => (
                                            <div key={idx} className="tarefa-item">
                                              <span className="tarefa-nome">{nomesTarefas[String(tarefa.tarefa_id)] || `Tarefa #${tarefa.tarefa_id}`}</span>
                                              <div className="tarefa-tempo-card">
                                                <div className="tarefa-tempo-label"><i className="fas fa-clock"></i><span>ESTIMADO</span></div>
                                                <div className="tarefa-tempo-valor">{formatarTempo(tarefa.tempo_estimado_dia)}</div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : <span>-</span>}
                                    </div>
                                  </td>
                                  <td><div className="historico-usuario-criador">{item.usuario_criador?.nome || `Usuário #${item.usuario_criador_id}`}</div></td>
                                  <td className="actions-column">
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      <EditButton onClick={() => handleEditarAtribuicao(item)} title="Editar" />
                                      <DeleteButton onClick={() => handleAbrirModalDeletar(item)} title="Deletar" />
                                    </div>
                                  </td>
                                </tr>

                                {estaExpandida && (
                                  <tr>
                                    <td colSpan="9" style={{ padding: 0, backgroundColor: '#f9fafb' }}>
                                      <div style={{ padding: '20px', borderTop: '2px solid #e5e7eb' }}>
                                        {carregando ? (
                                          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                            <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Carregando detalhes...
                                          </div>
                                        ) : detalhes.length === 0 ? (
                                          <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>Nenhum detalhe diário encontrado</div>
                                        ) : (
                                          <div>
                                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <i className="fas fa-calendar-day" style={{ color: '#0e3b6f' }}></i> Detalhes Diários
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                              {detalhes.map((dia, idx) => (
                                                <div key={idx} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px 16px' }}>
                                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '10px' }}>
                                                    <i className="fas fa-calendar" style={{ color: '#0e3b6f', fontSize: '12px', marginRight: '6px' }}></i>
                                                    {formatarData(dia.data)}
                                                  </div>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }}>
                                                    {dia.tarefas && dia.tarefas.length > 0 ? (
                                                      dia.tarefas.map((tarefa, tarefaIdx) => (
                                                        <div key={tarefaIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                          <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{tarefa.tarefa_nome}</span>
                                                          <div className="tarefa-tempo-card" style={{ marginLeft: '12px', flexShrink: 0 }}>
                                                            <div className="tarefa-tempo-label"><i className="fas fa-clock"></i><span>ESTIMADO</span></div>
                                                            <div className="tarefa-tempo-valor">{formatarTempo(tarefa.tempo_estimado_dia)}</div>
                                                          </div>
                                                          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                                            <EditButton onClick={() => abrirModalEdicaoTarefaDiaria(tarefa, dia.data, item.id)} title="Editar" />
                                                            <DeleteButton onClick={() => abrirModalDeletarTarefaDiaria(tarefa, dia.data, item.id)} title="Deletar" />
                                                          </div>
                                                        </div>
                                                      ))
                                                    ) : <span style={{ fontSize: '12px', color: '#9ca3af' }}>Nenhuma tarefa atribuída</span>}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="pagination">
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || loading}>
                          <i className="fas fa-chevron-left"></i> Anterior
                        </button>
                        <span className="pagination-info">Página {currentPage} de {totalPages} ({totalRegistros} registros)</span>
                        <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || loading}>
                          Próxima <i className="fas fa-chevron-right"></i>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContainer>

          {/* Modais */}
          <ConfirmModal
            isOpen={showDeleteConfirmModal}
            onClose={() => { setShowDeleteConfirmModal(false); setItemParaDeletar(null); }}
            onConfirm={handleDeletarHistorico}
            title="Confirmar Exclusão"
            message={itemParaDeletar ? (
              <>
                <p>Tem certeza que deseja excluir esta atribuição?</p>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                  <strong>Cliente:</strong> {itemParaDeletar.cliente?.nome || `Cliente #${itemParaDeletar.cliente_id}`}<br />
                  <strong>Responsável:</strong> {itemParaDeletar.responsavel?.nome || `Colaborador #${itemParaDeletar.responsavel_id}`}
                </div>
                <p style={{ marginTop: '16px', color: '#dc2626', fontWeight: 500, fontSize: '13px' }}>
                  <i className="fas fa-exclamation-triangle"></i> Esta ação removerá todos os registros associados.
                </p>
              </>
            ) : null}
            confirmText="Excluir"
            cancelText="Cancelar"
            confirmButtonClass="btn-danger"
            loading={deleteLoading}
          />

          {modalEdicaoTarefaDiaria && tarefaDiariaEditando && (
            <div className="modal-overlay" onClick={fecharModalEdicaoTarefaDiaria}>
              <div className="modal-content" style={{ maxWidth: '500px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #eee' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Editar Tarefa Diária</h3>
                  <button className="btn-icon" onClick={fecharModalEdicaoTarefaDiaria} disabled={salvandoTarefaDiaria}><i className="fas fa-times"></i></button>
                </div>
                <div className="modal-body" style={{ padding: '20px 24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Tarefa</label>
                    <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>{tarefaDiariaEditando.tarefa_nome}</div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Tempo Estimado</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" value={tempoEditando.horas} onChange={e => setTempoEditando(p => ({ ...p, horas: +e.target.value }))} className="form-input" style={{ width: '60px' }} /> h
                      <input type="number" value={tempoEditando.minutos} onChange={e => setTempoEditando(p => ({ ...p, minutos: Math.min(59, Math.max(0, +e.target.value)) }))} className="form-input" style={{ width: '60px' }} /> min
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn-secondary" onClick={fecharModalEdicaoTarefaDiaria} disabled={salvandoTarefaDiaria}>Cancelar</button>
                  <button className="btn-primary" onClick={salvarEdicaoTarefaDiaria} disabled={salvandoTarefaDiaria}>
                    {salvandoTarefaDiaria ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={showDeleteTarefaDiariaModal}
            onClose={() => { setShowDeleteTarefaDiariaModal(false); setTarefaDiariaParaDeletar(null); }}
            onConfirm={deletarTarefaDiaria}
            title="Confirmar Exclusão"
            message={tarefaDiariaParaDeletar ? (
              <>
                <p>Tem certeza que deseja excluir esta tarefa diária?</p>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                  <strong>Tarefa:</strong> {tarefaDiariaParaDeletar.tarefa_nome}<br />
                  <strong>Data:</strong> {formatarData(tarefaDiariaParaDeletar.diaData)}
                </div>
              </>
            ) : null}
            confirmText="Excluir"
            confirmButtonClass="btn-danger"
            loading={deletandoTarefaDiaria}
          />

          <ConfirmModal
            isOpen={showDeleteRegraOrfaModal}
            onClose={() => { setShowDeleteRegraOrfaModal(false); setRegraOrfaParaDeletar(null); }}
            onConfirm={deletarRegraOrfa}
            title="Confirmar Exclusão de Regras"
            message={regraOrfaParaDeletar ? "Tem certeza que deseja excluir estas regras? A ação é irreversível." : ""}
            confirmText="Deletar"
            confirmButtonClass="btn-danger"
            loading={deletandoRegraOrfa}
          />

        </main>
      </div>
    </Layout>
  );
};

export default HistoricoAtribuicoes;
