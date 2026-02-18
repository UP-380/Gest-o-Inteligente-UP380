import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterMembro from '../../components/filters/FilterMembro';
import FilterGeneric from '../../components/filters/FilterGeneric';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import { useToast } from '../../hooks/useToast';
import { debounce } from '../../utils/debounce';
import useGestaoCapacidade from '../../hooks/useGestaoCapacidade';
import HierarchyNode from './components/HierarchyNode';
import HierarchyOrderBuilder from './components/HierarchyOrderBuilder';
import HierarchyDetailSideCard from './components/HierarchyDetailSideCard';
import { fetchCapacidade, LABEL_POR_NIVEL } from '../../services/gestaoCapacidadeAPI';
import './GestaoCapacidade.css';

const API_BASE_URL = '/api';

const GestaoCapacidade = () => {
  const navigate = useNavigate();
  const showToast = useToast();

  // === Nova API Hierárquica (v2) ===
  const [estadoHierarquiaUsuario, setEstadoHierarquiaUsuario] = useState([]); // Ordem dos níveis controlada 100% pelo usuário (começa vazio)

  const {
    hierarquia,
    resumo: resumoHierarquia,
    periodo: periodoHierarquia,
    loading: loadingHierarquia,
    ordemNiveis: ordemNiveisAPI,
    carregarDados: carregarDadosHierarquia,
    limpar: limparHierarquia,
  } = useGestaoCapacidade();

  // Filtros
  const [filtros, setFiltros] = useState({
    produto: false,
    atividade: false,
    tipoTarefa: false,
    cliente: false,
    responsavel: false
  });

  const [filtrosAplicados, setFiltrosAplicados] = useState(false);

  // Filtro de período
  const [periodoInicio, setPeriodoInicio] = useState(null);
  const [periodoFim, setPeriodoFim] = useState(null);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
  const [habilitarFeriados, setHabilitarFeriados] = useState(false);
  const [datasIndividuais, setDatasIndividuais] = useState([]);

  // Valores selecionados para filtros
  const [filtroClienteSelecionado, setFiltroClienteSelecionado] = useState(null);
  const [filtroProdutoSelecionado, setFiltroProdutoSelecionado] = useState(null);
  const [filtroTarefaSelecionado, setFiltroTarefaSelecionado] = useState(null);
  const [filtroResponsavelSelecionado, setFiltroResponsavelSelecionado] = useState(null);
  const [filtroTipoTarefaSelecionado, setFiltroTipoTarefaSelecionado] = useState(null);
  const [filtroStatusCliente, setFiltroStatusCliente] = useState('ativo');

  // Estados para carregar dados de opções (globais)
  const [clientes, setClientes] = useState([]);
  const [membros, setMembros] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tiposTarefa, setTiposTarefa] = useState([]);

  // Estados para opções filtradas contextuais
  const [opcoesFiltradasTarefas, setOpcoesFiltradasTarefas] = useState([]);
  const [opcoesFiltradasProdutos, setOpcoesFiltradasProdutos] = useState([]);
  const [opcoesFiltradasClientes, setOpcoesFiltradasClientes] = useState([]);
  const [opcoesFiltradasResponsaveis, setOpcoesFiltradasResponsaveis] = useState([]);
  const [carregandoOpcoesFiltradas, setCarregandoOpcoesFiltradas] = useState({
    tarefa: false,
    produto: false,
    cliente: false,
    responsavel: false
  });

  // Estado do DetailSideCard
  const [detailCardHierarquia, setDetailCardHierarquia] = useState(null); // { nodeId, nodeData, nivelNome, proximosNiveis }

  // === Carregamento de Opções Globais ===

  const loadClientes = async (status = 'ativo') => {
    try {
      let todosClientes = [];
      let page = 1;
      let hasMore = true;
      const limit = 1000;

      while (hasMore) {
        const response = await fetch(`${API_BASE_URL}/clientes?status=${status}&page=${page}&limit=${limit}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            todosClientes = [...todosClientes, ...result.data];
            hasMore = result.data.length === limit;
            page++;
          } else hasMore = false;
        } else hasMore = false;
      }
      setClientes(todosClientes);
      return todosClientes;
    } catch (error) { console.error('Erro ao carregar clientes:', error); return []; }
  };

  const loadMembros = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores?status=ativo`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setMembros(result.data);
        }
      }
    } catch (error) { console.error('Erro ao carregar membros:', error); }
  };

  const loadProdutos = async () => {
    try {
      let todosProdutos = [];
      let page = 1;
      let hasMore = true;
      const limit = 1000;

      while (hasMore) {
        const response = await fetch(`${API_BASE_URL}/produtos?page=${page}&limit=${limit}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            todosProdutos = [...todosProdutos, ...result.data];
            hasMore = result.data.length === limit;
            page++;
          } else hasMore = false;
        } else hasMore = false;
      }
      const produtosComDados = todosProdutos.map(produto => ({
        id: produto.id,
        nome: produto.nome || `Produto #${produto.id}`
      }));
      setProdutos(produtosComDados);
    } catch (error) { console.error('Erro ao carregar produtos:', error); }
  };

  const loadTarefas = async () => {
    try {
      let todasTarefas = [];
      let page = 1;
      let hasMore = true;
      const limit = 1000;

      while (hasMore) {
        const response = await fetch(`${API_BASE_URL}/atividades?page=${page}&limit=${limit}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            todasTarefas = [...todasTarefas, ...result.data];
            hasMore = result.data.length === limit;
            page++;
          } else hasMore = false;
        } else hasMore = false;
      }
      const tarefasComDados = todasTarefas.map(tarefa => ({
        id: tarefa.id,
        nome: tarefa.nome || `Tarefa #${tarefa.id}`
      }));
      setTarefas(tarefasComDados);
    } catch (error) { console.error('Erro ao carregar tarefas:', error); }
  };

  const loadTiposTarefa = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const tiposComDados = (result.data || []).map(t => ({
            id: t.id,
            nome: t.nome || `Tipo #${t.id}`
          }));
          setTiposTarefa(tiposComDados);
        }
      }
    } catch (error) { console.error('Erro ao carregar tipos de tarefa:', error); }
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadClientes();
    loadMembros();
    loadTiposTarefa();
    // Produtos e Tarefas carregados sob demanda ou se filtro "produto/atividade" estiver ativo
  }, []);

  // Recarregar clientes quando status muda
  useEffect(() => {
    if (filtros.cliente || estadoHierarquiaUsuario.includes('cliente')) {
      loadClientes(filtroStatusCliente).then(clientesCarregados => {
        // Validação de seleção removida para simplificar, o filtro cuidará disso
      });
    }
  }, [filtroStatusCliente, filtros.cliente, estadoHierarquiaUsuario]);

  // Carregar produtos se necessário
  useEffect(() => {
    if ((filtros.produto || estadoHierarquiaUsuario.includes('produto')) && produtos.length === 0) {
      loadProdutos();
    }
  }, [filtros.produto, estadoHierarquiaUsuario, produtos.length]);

  // Carregar tarefas se necessário
  useEffect(() => {
    if ((filtros.atividade || estadoHierarquiaUsuario.includes('tarefa') || estadoHierarquiaUsuario.includes('tipo_tarefa')) && tarefas.length === 0) {
      loadTarefas();
    }
  }, [filtros.atividade, estadoHierarquiaUsuario, tarefas.length]);


  // === Lógica de Opções Contextuais ===

  const buscarOpcoesFiltroContextual = async (tipoFiltro) => {
    if (!periodoInicio || !periodoFim) return [];

    setCarregandoOpcoesFiltradas(prev => ({ ...prev, [tipoFiltro]: true }));

    try {
      const nivelAPI = {
        'responsavel': 'colaborador',
        'cliente': 'cliente',
        'produto': 'produto',
        'tarefa': 'tarefa',
        'tipo_tarefa': 'tipo_tarefa'
      }[tipoFiltro] || tipoFiltro;

      const filtrosEnvio = {};
      if (filtroResponsavelSelecionado) filtrosEnvio.colaborador_id = Array.isArray(filtroResponsavelSelecionado) ? filtroResponsavelSelecionado : [filtroResponsavelSelecionado];
      if (filtroClienteSelecionado) filtrosEnvio.cliente_id = Array.isArray(filtroClienteSelecionado) ? filtroClienteSelecionado : [filtroClienteSelecionado];
      if (filtroProdutoSelecionado) filtrosEnvio.produto_id = Array.isArray(filtroProdutoSelecionado) ? filtroProdutoSelecionado : [filtroProdutoSelecionado];
      if (filtroTarefaSelecionado) filtrosEnvio.tarefa_id = Array.isArray(filtroTarefaSelecionado) ? filtroTarefaSelecionado : [filtroTarefaSelecionado];
      if (filtroTipoTarefaSelecionado) filtrosEnvio.tipo_tarefa_id = Array.isArray(filtroTipoTarefaSelecionado) ? filtroTipoTarefaSelecionado : [filtroTipoTarefaSelecionado];

      // Remover o filtro atual para ver todas as opções disponíveis
      if (tipoFiltro === 'responsavel') delete filtrosEnvio.colaborador_id;
      else if (tipoFiltro === 'cliente') delete filtrosEnvio.cliente_id;
      else if (tipoFiltro === 'produto') delete filtrosEnvio.produto_id;
      else if (tipoFiltro === 'tarefa') delete filtrosEnvio.tarefa_id;
      else if (tipoFiltro === 'tipo_tarefa') delete filtrosEnvio.tipo_tarefa_id;

      const result = await fetchCapacidade({
        data_inicio: periodoInicio,
        data_fim: periodoFim,
        ordem_niveis: [nivelAPI],
        filtros: filtrosEnvio,
        ignorar_finais_semana: !habilitarFinaisSemana,
        ignorar_feriados: !habilitarFeriados,
      });

      if (result.success && result.data) {
        // Garantir que result.data seja um array
        let dadosArray = [];
        if (Array.isArray(result.data)) {
          dadosArray = result.data;
        } else if (typeof result.data === 'object') {
          // Se for objeto, tentar converter para array usando Object.values
          dadosArray = Object.values(result.data);
        }

        const opcoes = dadosArray.map(item => ({
          id: isNaN(parseInt(item.id)) ? item.id : parseInt(item.id),
          nome: item.nome || (LABEL_POR_NIVEL[nivelAPI] + ' #' + item.id)
        }));
        opcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        return opcoes;
      }
      return [];
    } catch (error) {
      console.error(`Erro ao buscar opções contextuais para ${tipoFiltro}:`, error);
      return [];
    } finally {
      setCarregandoOpcoesFiltradas(prev => ({ ...prev, [tipoFiltro]: false }));
    }
  };

  // Debounce para recarregar opções
  const debouncedReloadOptionsRef = useRef(null);

  useEffect(() => {
    debouncedReloadOptionsRef.current = debounce(async () => {
      // Recarregar filtros com base na hierarquia e filtros selecionados
      const tiposParaRecarregar = new Set(estadoHierarquiaUsuario);
      // Sempre recarregar opções dos filtros visíveis
      if (filtros.responsavel) tiposParaRecarregar.add('responsavel');
      if (filtros.cliente) tiposParaRecarregar.add('cliente');
      if (filtros.produto) tiposParaRecarregar.add('produto');
      if (filtros.atividade) tiposParaRecarregar.add('tarefa');

      // Se o nível raiz é X, precisamos carregar opções de X
      if (estadoHierarquiaUsuario[0] === 'tarefa') tiposParaRecarregar.add('tarefa');
      if (estadoHierarquiaUsuario[0] === 'produto') tiposParaRecarregar.add('produto');
      if (estadoHierarquiaUsuario[0] === 'cliente') tiposParaRecarregar.add('cliente');
      if (estadoHierarquiaUsuario[0] === 'colaborador') tiposParaRecarregar.add('responsavel');

      if (tiposParaRecarregar.has('tarefa')) {
        const opcoes = await buscarOpcoesFiltroContextual('tarefa');
        setOpcoesFiltradasTarefas(opcoes);
      }
      if (tiposParaRecarregar.has('produto')) {
        const opcoes = await buscarOpcoesFiltroContextual('produto');
        setOpcoesFiltradasProdutos(opcoes);
      }
      if (tiposParaRecarregar.has('cliente')) {
        const opcoes = await buscarOpcoesFiltroContextual('cliente');
        setOpcoesFiltradasClientes(opcoes);
      }
      if (tiposParaRecarregar.has('responsavel')) {
        const opcoes = await buscarOpcoesFiltroContextual('responsavel');
        setOpcoesFiltradasResponsaveis(opcoes);
      }
    }, 300);

    return () => {
      if (debouncedReloadOptionsRef.current && debouncedReloadOptionsRef.current.cancel) {
        debouncedReloadOptionsRef.current.cancel();
      }
    };
  }, [filtros, estadoHierarquiaUsuario]);

  // Disparar recarga quando filtros mudam
  useEffect(() => {
    if (periodoInicio && periodoFim) {
      if (debouncedReloadOptionsRef.current) {
        debouncedReloadOptionsRef.current();
      }
    }
  }, [
    periodoInicio,
    periodoFim,
    filtroClienteSelecionado,
    filtroProdutoSelecionado,
    filtroTarefaSelecionado,
    filtroResponsavelSelecionado,
    estadoHierarquiaUsuario
  ]);


  // === Ações Principais ===

  const limparFiltros = () => {
    setFiltroClienteSelecionado(null);
    setFiltroProdutoSelecionado(null);
    setFiltroTarefaSelecionado(null);
    setFiltroResponsavelSelecionado(null);
    setFiltroTipoTarefaSelecionado(null);
    setDatasIndividuais([]);
    setEstadoHierarquiaUsuario([]);
    limparHierarquia();
    setFiltrosAplicados(false);
  };

  const handleApplyFilters = () => {
    if (estadoHierarquiaUsuario.length === 0) {
      showToast('warning', 'Selecione pelo menos um nível de hierarquia.');
      return;
    }
    if (!periodoInicio || !periodoFim) {
      showToast('warning', 'Selecione um período.');
      return;
    }

    setFiltrosAplicados(true);

    carregarDadosHierarquia({
      dataInicio: periodoInicio,
      dataFim: periodoFim,
      ordemNiveis: estadoHierarquiaUsuario,
      filtros: {
        colaborador_id: filtroResponsavelSelecionado,
        cliente_id: filtroClienteSelecionado,
        produto_id: filtroProdutoSelecionado,
        tarefa_id: filtroTarefaSelecionado,
        tipo_tarefa_id: filtroTipoTarefaSelecionado
      },
      ignorarFinaisSemana: !habilitarFinaisSemana,
      ignorarFeriados: !habilitarFeriados
    });
  };

  const hasPendingChanges = () => {
    // Simplificando: sempre permitir aplicar se tiver hierarquia
    return estadoHierarquiaUsuario.length > 0;
  };

  const handleNewAtribuicao = () => {
    navigate('/atribuicoes/nova');
  };

  // === Detail Card ===

  const handleOpenHierarquiaDetail = useCallback((nodeId, nodeData, e) => {
    let position = null;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;
      const cardWidth = 500;
      const vw = window.innerWidth;

      let calculatedLeft = documentLeft + rect.width + 20;
      if ((calculatedLeft - scrollLeft) + cardWidth > vw - 20) {
        calculatedLeft = documentLeft - cardWidth - 20;
      }
      if ((calculatedLeft - scrollLeft) < 20) {
        calculatedLeft = scrollLeft + 20;
      }

      position = {
        left: calculatedLeft,
        top: documentTop
      };
    }

    setDetailCardHierarquia({
      nodeId,
      nodeData,
      nivelNome: LABEL_POR_NIVEL[ordemNiveisAPI[0]] || ordemNiveisAPI[0],
      proximosNiveis: ordemNiveisAPI.slice(1),
      position
    });
  }, [ordemNiveisAPI]);

  const handleCloseHierarquiaDetail = () => {
    setDetailCardHierarquia(null);
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="vinculacoes-listing-section">
            <div className="gestao-capacidade-page-header">
              <div className="gestao-capacidade-header-content">
                <div className="gestao-capacidade-header-left">
                  <div className="gestao-capacidade-header-icon">
                    <i className="fas fa-user-check" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                  </div>
                  <div>
                    <h1 className="gestao-capacidade-page-title">Gestão de Capacidade</h1>
                    <p className="gestao-capacidade-page-subtitle">
                      Defina quais colaboradores serão responsáveis por quais tarefas, em quais períodos e com qual tempo estimado diário.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="listing-controls">
              <div className="listing-controls-right">
                <button
                  className="custo-colaborador-btn"
                  onClick={() => navigate('/gestao-capacidade/historico')}
                  title="Ver histórico de atribuições"
                  style={{ marginRight: '12px' }}
                >
                  <i className="fas fa-history" style={{ fontSize: '14px' }}></i>
                  Histórico
                </button>
                <button
                  className="custo-colaborador-btn"
                  onClick={() => navigate('/atribuicoes/pendentes/aprovacao')}
                  title="Aprovacoes Pendentes"
                  style={{ marginRight: '12px' }}
                >
                  <i className="fas fa-check-circle" style={{ fontSize: '14px' }}></i>
                  Aprovações Pendentes
                </button>
                <ButtonPrimary
                  onClick={handleNewAtribuicao}
                  icon="fas fa-plus"
                >
                  Nova Atribuição
                </ButtonPrimary>
              </div>
            </div>

            {/* Filtros */}
            <FiltersCard
              onApply={handleApplyFilters}
              onClear={limparFiltros}
              showActions={true}
              loading={loadingHierarquia}
              hasPendingChanges={hasPendingChanges()}
              showInfoMessage={true}
              infoMessage="A ordem em que você clicar nos cards abaixo definirá a estrutura da hierarquia dos resultados."
            >
              <HierarchyOrderBuilder
                ordemNiveis={estadoHierarquiaUsuario}
                onChange={setEstadoHierarquiaUsuario}
              />

              <div className="filtros-detalhados-row">
                <div className="filtro-periodo-wrapper">
                  <label className="filtro-pai-label">Definir Período:</label>
                  <FilterPeriodo
                    dataInicio={periodoInicio}
                    dataFim={periodoFim}
                    onInicioChange={(e) => setPeriodoInicio(e.target.value || null)}
                    onFimChange={(e) => setPeriodoFim(e.target.value || null)}
                    disabled={loadingHierarquia}
                    showWeekendToggle={true}
                    onWeekendToggleChange={setHabilitarFinaisSemana}
                    showHolidayToggle={true}
                    onHolidayToggleChange={setHabilitarFeriados}
                    datasIndividuais={datasIndividuais}
                    onDatasIndividuaisChange={setDatasIndividuais}
                  />
                </div>

                {/* Filtros Contextuais */}
                {estadoHierarquiaUsuario[0] === 'cliente' && (
                  <>
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Definir Clientes:</label>
                      <FilterClientes
                        value={filtroClienteSelecionado}
                        onChange={(e) => setFiltroClienteSelecionado(e.target.value || null)}
                        options={opcoesFiltradasClientes.length > 0 ? opcoesFiltradasClientes : clientes}
                        disabled={loadingHierarquia || carregandoOpcoesFiltradas.cliente}
                      />
                    </div>
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Status:</label>
                      <select
                        value={filtroStatusCliente}
                        onChange={(e) => setFiltroStatusCliente(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                        disabled={loadingHierarquia}
                      >
                        <option value="todos">Todos</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                  </>
                )}

                {estadoHierarquiaUsuario[0] === 'produto' && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Produtos:</label>
                    <FilterGeneric
                      value={filtroProdutoSelecionado}
                      onChange={(e) => setFiltroProdutoSelecionado(e.target.value || null)}
                      options={opcoesFiltradasProdutos.length > 0 ? opcoesFiltradasProdutos : produtos}
                      disabled={loadingHierarquia || carregandoOpcoesFiltradas.produto}
                      placeholder={carregandoOpcoesFiltradas.produto ? "Carregando..." : "Selecionar produtos"}
                    />
                  </div>
                )}

                {estadoHierarquiaUsuario[0] === 'tarefa' && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Tarefas:</label>
                    <FilterGeneric
                      value={filtroTarefaSelecionado}
                      onChange={(e) => setFiltroTarefaSelecionado(e.target.value || null)}
                      options={opcoesFiltradasTarefas.length > 0 ? opcoesFiltradasTarefas : tarefas}
                      disabled={loadingHierarquia || carregandoOpcoesFiltradas.tarefa}
                      placeholder={carregandoOpcoesFiltradas.tarefa ? "Carregando..." : "Selecionar tarefas"}
                    />
                  </div>
                )}

                {estadoHierarquiaUsuario[0] === 'tipo_tarefa' && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Tipo de Tarefa:</label>
                    <select
                      value={filtroTipoTarefaSelecionado ?? ''}
                      onChange={(e) => setFiltroTipoTarefaSelecionado(e.target.value ? Number(e.target.value) : null)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      disabled={loadingHierarquia || tiposTarefa.length === 0}
                    >
                      <option value="">Selecionar tipo de tarefa</option>
                      {tiposTarefa.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {estadoHierarquiaUsuario[0] === 'colaborador' && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Responsáveis:</label>
                    <FilterMembro
                      value={filtroResponsavelSelecionado}
                      onChange={(e) => setFiltroResponsavelSelecionado(e.target.value || null)}
                      options={opcoesFiltradasResponsaveis.length > 0 ? opcoesFiltradasResponsaveis : membros}
                      disabled={loadingHierarquia || carregandoOpcoesFiltradas.responsavel}
                    />
                  </div>
                )}
              </div>
            </FiltersCard>

            {/* Resultados */}
            {!filtrosAplicados ? (
              <SemResultadosFiltros filtrosAplicados={false} />
            ) : loadingHierarquia ? (
              <div className="loading-container" style={{ padding: '40px' }}>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Carregando dados hierárquicos...</span>
              </div>
            ) : (!hierarquia || Object.keys(hierarquia).length === 0) ? (
              <SemResultadosFiltros
                mensagem="Nenhuma atribuição encontrada com os filtros selecionados."
                filtrosAplicados={true}
              />
            ) : (
              <div className="atribuicoes-list-container">
                <div className="tempo-disponivel-section">
                  <h3 className="tempo-disponivel-title">
                    <i className="fas fa-chart-line" style={{ marginRight: '8px' }}></i>
                    Gestão de Capacidade – Visão Hierárquica
                  </h3>

                  <div className="hierarchy-root-grid">
                    {Object.entries(hierarquia).map(([nodeId, nodeData]) => (
                      <HierarchyNode
                        key={nodeId}
                        nodeId={nodeId}
                        nodeData={nodeData}
                        nivelAtual={ordemNiveisAPI[0] || 'colaborador'}
                        proximosNiveis={ordemNiveisAPI.slice(1)}
                        depth={0}
                        iniciarExpandido={false}
                        onToggleExpand={handleOpenHierarquiaDetail}
                        isActive={detailCardHierarquia?.nodeId === nodeId}
                      />
                    ))}
                  </div>

                  {/* Resumo global */}
                  {resumoHierarquia && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                      {resumoHierarquia.total_tarefas != null && (
                        <span style={{ fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                          <i className="fas fa-list" style={{ marginRight: '4px', color: '#64748b' }}></i>
                          Total Tarefas: <strong>{resumoHierarquia.total_tarefas}</strong>
                        </span>
                      )}
                      {resumoHierarquia.total_produtos != null && (
                        <span style={{ fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                          <i className="fas fa-box" style={{ marginRight: '4px', color: '#64748b' }}></i>
                          Total Produtos: <strong>{resumoHierarquia.total_produtos}</strong>
                        </span>
                      )}
                      {resumoHierarquia.total_colaboradores != null && (
                        <span style={{ fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                          <i className="fas fa-user-tie" style={{ marginRight: '4px', color: '#64748b' }}></i>
                          Total Responsáveis: <strong>{resumoHierarquia.total_colaboradores}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {detailCardHierarquia && (
        <div className="hierarchy-backdrop" onClick={handleCloseHierarquiaDetail} />
      )}

      {detailCardHierarquia && (
        <HierarchyDetailSideCard
          nodeId={detailCardHierarquia.nodeId}
          nodeData={detailCardHierarquia.nodeData}
          nivelNome={detailCardHierarquia.nivelNome}
          proximosNiveis={detailCardHierarquia.proximosNiveis}
          onClose={handleCloseHierarquiaDetail}
          position={detailCardHierarquia.position}
        />
      )}
    </Layout>
  );
};

export default GestaoCapacidade;
