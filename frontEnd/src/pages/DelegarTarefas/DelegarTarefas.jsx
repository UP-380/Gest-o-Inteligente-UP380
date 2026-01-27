import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterVinculacao from '../../components/filters/FilterVinculacao';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterMembro from '../../components/filters/FilterMembro';
import FilterGeneric from '../../components/filters/FilterGeneric';
import FiltrosAdicionaisDropdown from '../../components/filters/FiltrosAdicionaisDropdown';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import Avatar from '../../components/user/Avatar';
import Tooltip from '../../components/common/Tooltip';
import AtribuicoesTabela from '../../components/atribuicoes/AtribuicoesTabela';
import DetailSideCard from '../../components/dashboard/DetailSideCard';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI, produtosAPI, tarefasAPI } from '../../services/api';
import { calcularDiasUteis, calcularDiasComOpcoes, calcularDiasComOpcoesEDatasIndividuais, obterDatasValidasNoPeriodo } from '../../utils/dateUtils';
import { processBatch } from '../../utils/requestPool';
import '../../pages/CadastroVinculacoes/CadastroVinculacoes.css';
import './DelegarTarefas.css';

const API_BASE_URL = '/api';

const DelegarTarefas = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const [registrosAgrupados, setRegistrosAgrupados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Estados para modais de confirmação
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [agrupamentoParaDeletar, setAgrupamentoParaDeletar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filtros
  const [filtros, setFiltros] = useState({
    produto: false,
    atividade: false,
    cliente: false,
    responsavel: false
  });
  const [filtroPrincipal, setFiltroPrincipal] = useState(null);
  const [ordemFiltros, setOrdemFiltros] = useState([]);
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);
  const [filtrosUltimosAplicados, setFiltrosUltimosAplicados] = useState(null);
  const [filtroHover, setFiltroHover] = useState(null);

  // Filtro de período
  const [periodoInicio, setPeriodoInicio] = useState(null);
  const [periodoFim, setPeriodoFim] = useState(null);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
  const [habilitarFeriados, setHabilitarFeriados] = useState(false);
  const [datasIndividuais, setDatasIndividuais] = useState([]);

  // Valores selecionados para filtros pai
  const [filtroClienteSelecionado, setFiltroClienteSelecionado] = useState(null);
  const [filtroProdutoSelecionado, setFiltroProdutoSelecionado] = useState(null);
  const [filtroTarefaSelecionado, setFiltroTarefaSelecionado] = useState(null);
  const [filtroResponsavelSelecionado, setFiltroResponsavelSelecionado] = useState(null);
  const [filtroStatusCliente, setFiltroStatusCliente] = useState('ativo');

  // Estados para filtros adicionais (que não são o filtro pai)
  const [mostrarFiltrosAdicionais, setMostrarFiltrosAdicionais] = useState(false);
  const [filtrosAdicionaisAtivos, setFiltrosAdicionaisAtivos] = useState({
    cliente: false,
    tarefa: false,
    produto: false
  });
  // Valores selecionados para filtros adicionais
  const [filtroAdicionalCliente, setFiltroAdicionalCliente] = useState(null);
  const [filtroAdicionalTarefa, setFiltroAdicionalTarefa] = useState(null);
  const [filtroAdicionalProduto, setFiltroAdicionalProduto] = useState(null);

  // Estados para carregar dados de produtos e tarefas (globais)
  const [produtos, setProdutos] = useState([]);
  const [tarefas, setTarefas] = useState([]);

  // Estados para opções filtradas de filtros adicionais (baseadas nos filtros já aplicados)
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

  // Estado para grupos expandidos (lista estilo ClickUp)
  const [gruposExpandidos, setGruposExpandidos] = useState(new Set());

  // Estado para tarefas expandidas (mostrar detalhes)
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());

  // Estado para agrupamentos com tarefas expandidas quando filtro pai é "atividade"
  const [agrupamentosTarefasExpandidas, setAgrupamentosTarefasExpandidas] = useState(new Set());

  // Cache de nomes
  const [nomesCache, setNomesCache] = useState({
    produtos: {},
    tarefas: {},
    clientes: {},
    colaboradores: {}
  });

  // Cache de custos por responsável
  const [custosPorResponsavel, setCustosPorResponsavel] = useState({});

  // Cache de horas contratadas por responsável
  const [horasContratadasPorResponsavel, setHorasContratadasPorResponsavel] = useState({});
  // Cache de tipo de contrato por responsável
  const [tipoContratoPorResponsavel, setTipoContratoPorResponsavel] = useState({});
  // Cache de nomes dos tipos de contrato (id -> nome)
  const [tiposContratoMap, setTiposContratoMap] = useState({});

  // Cache de tempo estimado total por responsável no período (independente dos filtros aplicados)
  const [tempoEstimadoTotalPorResponsavel, setTempoEstimadoTotalPorResponsavel] = useState({}); // { responsavelId: tempoEmMs }

  // Cache de tempo realizado por entidade (chave: `${filtroPrincipal}_${entidadeId}`)
  const [temposRealizadosPorEntidade, setTemposRealizadosPorEntidade] = useState({}); // { chave: tempoEmMs }

  // Estado para rastrear se dados auxiliares (horas contratadas, tempo estimado total) foram completamente carregados
  // Isso garante que os dashboards só sejam exibidos quando todos os dados estiverem 100% prontos
  const [dadosAuxiliaresCarregados, setDadosAuxiliaresCarregados] = useState(false);

  // Estados para carregar dados
  const [clientes, setClientes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [membros, setMembros] = useState([]);

  // Estado para controlar expansão dos dashboards
  const [dashboardsExpandidos, setDashboardsExpandidos] = useState(false);

  // Refs para controle de requisições duplicadas (Deduplicação / Circuit Breaker)
  const fetchingCustosRef = useRef(new Set());
  const failedCustosRef = useRef(new Set());
  const fetchingHorasRef = useRef(new Set());
  const failedHorasRef = useRef(new Set());
  const fetchingProductsRef = useRef(new Set());
  const failedProductsRef = useRef(new Set());
  const fetchingTasksRef = useRef(new Set());
  const failedTasksRef = useRef(new Set());

  // Estados do DetailSideCard (EXATAMENTE como na referência Contas Bancárias)
  const [detailCard, setDetailCard] = useState(null); // { entidadeId, tipo, dados }
  const [detailCardPosition, setDetailCardPosition] = useState(null); // { left, top }

  // Função auxiliar para normalizar tempo realizado (usada em buscarDetalhesPorTipo)
  const normalizarTempoRealizado = (tempo) => {
    if (tempo === null || tempo === undefined) return 0;
    let tempoNormalizado = Number(tempo) || 0;
    // Converter horas decimais para milissegundos se necessário
    if (tempoNormalizado > 0 && tempoNormalizado < 1) {
      tempoNormalizado = Math.round(tempoNormalizado * 3600000);
    }
    // Se resultado < 1 segundo, arredondar para 1 segundo
    if (tempoNormalizado > 0 && tempoNormalizado < 1000) {
      tempoNormalizado = 1000;
    }
    return tempoNormalizado;
  };

  // Função para buscar detalhes de tarefas (versão simplificada para handleOpenTarefas)
  const buscarDetalhesTarefas = (entidadeId, tipoEntidade, agrupamentos) => {
    // Obter período e opções aplicadas
    const periodoAplicadoInicio = filtrosUltimosAplicados?.periodoInicio;
    const periodoAplicadoFim = filtrosUltimosAplicados?.periodoFim;
    const habilitarFinaisSemanaAplicado = filtrosUltimosAplicados?.habilitarFinaisSemana ?? false;
    const habilitarFeriadosAplicado = filtrosUltimosAplicados?.habilitarFeriados ?? false;
    const datasIndividuaisAplicado = filtrosUltimosAplicados?.datasIndividuais ?? [];

    // Obter conjunto de datas válidas (considerando opções e datas individuais)
    let datasValidas = new Set();
    let dataEstaNoPeriodoAplicado = () => true; // Default: aceitar todas as datas

    if (periodoAplicadoInicio && periodoAplicadoFim) {
      datasValidas = obterDatasValidasNoPeriodo(
        periodoAplicadoInicio,
        periodoAplicadoFim,
        habilitarFinaisSemanaAplicado,
        habilitarFeriadosAplicado,
        datasIndividuaisAplicado
      );

      // Função auxiliar para verificar se uma data está nas datas válidas
      dataEstaNoPeriodoAplicado = (dataRegistro) => {
        if (!periodoAplicadoInicio || !periodoAplicadoFim || !dataRegistro) return true;
        if (datasValidas.size === 0) return false; // Se não há datas válidas, não incluir nada

        try {
          let dataStr;
          if (dataRegistro instanceof Date) {
            const year = dataRegistro.getFullYear();
            const month = String(dataRegistro.getMonth() + 1).padStart(2, '0');
            const day = String(dataRegistro.getDate()).padStart(2, '0');
            dataStr = `${year}-${month}-${day}`;
          } else if (typeof dataRegistro === 'string') {
            dataStr = dataRegistro.split('T')[0];
          } else {
            const dataReg = new Date(dataRegistro);
            const year = dataReg.getFullYear();
            const month = String(dataReg.getMonth() + 1).padStart(2, '0');
            const day = String(dataReg.getDate()).padStart(2, '0');
            dataStr = `${year}-${month}-${day}`;
          }

          return datasValidas.has(dataStr);
        } catch (error) {
          console.error('Erro ao verificar se data está no período aplicado:', error);
          return false;
        }
      };
    }

    // Filtrar agrupamentos pela entidade
    const agrupamentosFiltrados = agrupamentos.filter(agr => {
      const primeiroRegistro = agr.primeiroRegistro;
      if (tipoEntidade === 'responsavel') {
        return String(primeiroRegistro.responsavel_id) === String(entidadeId);
      } else if (tipoEntidade === 'cliente') {
        const clienteIds = String(primeiroRegistro.cliente_id || '')
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
        return clienteIds.includes(String(entidadeId));
      } else if (tipoEntidade === 'produto') {
        return String(primeiroRegistro.produto_id) === String(entidadeId);
      } else if (tipoEntidade === 'atividade') {
        return String(primeiroRegistro.tarefa_id) === String(entidadeId);
      }
      return false;
    });

    // Agrupar por tarefa e calcular tempo realizado total
    const tarefasMap = new Map();

    agrupamentosFiltrados.forEach(agr => {
      agr.registros.forEach(reg => {
        if (!reg.tarefa_id) return;

        // Aplicar filtro de período - APENAS incluir registros que estão no período aplicado
        if (periodoAplicadoInicio && periodoAplicadoFim && !dataEstaNoPeriodoAplicado(reg.data)) {
          return; // Pular este registro se não estiver no período
        }

        // Se o filtro pai é cliente, garantir que este registro pertence ao cliente
        if (tipoEntidade === 'cliente') {
          const clienteIds = String(reg.cliente_id || '')
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
          if (!clienteIds.includes(String(entidadeId))) return;
        }

        const tarefaId = String(reg.tarefa_id);
        const nomeTarefa = getNomeTarefa(reg.tarefa_id);

        // Usar chave composta para diferenciar tarefas com mesmo ID mas contextos diferentes (cliente/produto)
        const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
        const produtoIdKey = String(reg.produto_id || 'sem_produto');
        const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

        if (!tarefasMap.has(compositeKey)) {
          tarefasMap.set(compositeKey, {
            id: compositeKey, // Usar chave composta como ID para evitar conflitos de estado no frontend
            originalTarefaId: tarefaId, // Manter ID original se necessário
            nome: nomeTarefa,
            tipo: 'tarefa',
            tempoRealizado: 0,
            tempoEstimado: 0,
            responsavelId: reg.responsavel_id || null,
            clienteId: reg.cliente_id || null,
            registros: []
          });
        }

        const tarefa = tarefasMap.get(compositeKey);

        // Tempo realizado sempre 0 (lógica removida)
        tarefa.tempoRealizado += 0;

        // Calcular tempo estimado deste registro
        const tempoEstimadoReg = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
        tarefa.tempoEstimado += tempoEstimadoReg;

        // Adicionar registro para poder buscar detalhes individuais depois
        tarefa.registros.push({
          ...reg,
          tempoRealizado: 0
        });
      });
    });

    return Array.from(tarefasMap.values());
  };

  // Handler genérico para abrir card (EXATAMENTE como handleOpenContas)
  const handleOpenCard = async (entidade, tipo, e, buscarDetalhesFn) => {
    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      // Posição no documento (considerando scroll)
      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;

      // Tamanho do card
      const cardWidth = 500;

      // Tentar posicionar à direita do botão (comportamento padrão)
      let calculatedLeft = documentLeft + rect.width + 20;

      const vw = window.innerWidth;

      // Se não cabe à direita (card na última coluna), posicionar à esquerda
      if ((calculatedLeft - scrollLeft) + cardWidth > vw - 20) {
        calculatedLeft = documentLeft - cardWidth - 20;
      }

      // Garantir que não saia da tela à esquerda
      if ((calculatedLeft - scrollLeft) < 20) {
        calculatedLeft = scrollLeft + 20;
      }

      // Manter a altura original (sem ajustes verticais)
      setDetailCardPosition({
        left: calculatedLeft,
        top: documentTop
      });
    }


    const detalhes = buscarDetalhesFn(entidade.id, filtroPrincipal, registrosAgrupados);
    if (detalhes && detalhes.length > 0) {
      setDetailCard({
        entidadeId: entidade.id,
        tipo: tipo,
        dados: { registros: detalhes }
      });
    }
  };

  // Handler para abrir card de tarefas (EXATAMENTE como handleOpenContas)
  const handleOpenTarefas = (entidade, e) => {
    handleOpenCard(entidade, 'tarefas', e, buscarDetalhesTarefas);
  };

  // Fechar DetailSideCard (EXATAMENTE como na referência)
  const handleCloseDetail = () => {
    setDetailCard(null);
    setDetailCardPosition(null);
  };

  // Carregar clientes, colaboradores e membros ao montar
  useEffect(() => {
    loadClientes();
    loadColaboradores();
    loadMembros();
    carregarTiposContrato();
  }, []);

  // Recarregar clientes quando o filtro de status mudar (apenas se filtro cliente estiver ativo)
  useEffect(() => {
    if (filtros.cliente) {
      // Carregar clientes e validar seleção após carregamento
      loadClientes(filtroStatusCliente).then(clientesCarregados => {
        // Validar se o cliente selecionado ainda está na lista filtrada
        if (filtroClienteSelecionado && clientesCarregados && clientesCarregados.length > 0) {
          const clienteSelecionadoValido = clientesCarregados.some(c => {
            const clienteId = String(c.id).trim();
            const selecionadoId = Array.isArray(filtroClienteSelecionado)
              ? filtroClienteSelecionado.map(id => String(id).trim())
              : [String(filtroClienteSelecionado).trim()];

            if (Array.isArray(filtroClienteSelecionado)) {
              return selecionadoId.includes(clienteId);
            }
            return clienteId === selecionadoId[0];
          });

          // Se o cliente selecionado não está mais na lista filtrada, limpar a seleção
          if (!clienteSelecionadoValido) {
            setFiltroClienteSelecionado(null);
          }
        } else if (filtroClienteSelecionado && (!clientesCarregados || clientesCarregados.length === 0)) {
          // Se não há clientes carregados e havia uma seleção, limpar a seleção
          setFiltroClienteSelecionado(null);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatusCliente, filtros.cliente]);

  // Resetar expansão dos dashboards quando filtros forem aplicados
  useEffect(() => {
    setDashboardsExpandidos(false);
  }, [filtrosAplicados]);

  // Carregar produtos e tarefas quando necessário
  const loadProdutos = async () => {
    try {
      // Buscar todos os produtos usando paginação
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
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const produtosComDados = todosProdutos.map(produto => ({
        id: produto.id,
        nome: produto.nome || `Produto #${produto.id}`
      }));
      setProdutos(produtosComDados);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadTarefas = async () => {
    try {
      // Buscar todas as tarefas usando paginação
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
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const tarefasComDados = todasTarefas.map(tarefa => ({
        id: tarefa.id,
        nome: tarefa.nome || `Tarefa #${tarefa.id}`
      }));
      setTarefas(tarefasComDados);
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    }
  };



  // Função genérica para buscar opções filtradas de QUALQUER filtro (pai ou adicional)
  // Considera TODOS os filtros já ativos, independente da ordem
  const buscarOpcoesFiltroContextual = async (tipoFiltro) => {
    // Precisa de período definido para buscar opções contextuais
    if (!periodoInicio || !periodoFim) {
      return [];
    }

    // Verificar se há pelo menos um filtro ativo (pai ou adicional)
    // Isso garante que sempre busquemos opções contextuais, nunca globais
    const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
    const temFiltroPai = !!filtroPaiAtual;
    const temFiltrosAdicionais = filtrosAdicionaisAtivos.cliente || filtrosAdicionaisAtivos.tarefa || filtrosAdicionaisAtivos.produto;

    // Se não há nenhum filtro ativo, retornar vazio (não mostrar opções globais)
    // A menos que o próprio filtro que está sendo buscado seja um filtro pai
    const eFiltroPai = (tipoFiltro === 'responsavel' && (filtroPaiAtual === 'responsavel' || filtros.responsavel)) ||
      (tipoFiltro === 'cliente' && (filtroPaiAtual === 'cliente' || filtros.cliente)) ||
      (tipoFiltro === 'produto' && (filtroPaiAtual === 'produto' || filtros.produto)) ||
      (tipoFiltro === 'tarefa' && (filtroPaiAtual === 'atividade' || filtros.atividade));

    // Buscar opções se:
    // 1. Há filtro pai E/OU filtros adicionais ativos, OU
    // 2. O filtro sendo buscado é o próprio filtro pai
    if (!temFiltroPai && !temFiltrosAdicionais && !eFiltroPai) {
      return [];
    }

    setCarregandoOpcoesFiltradas(prev => ({ ...prev, [tipoFiltro]: true }));

    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000' // Buscar muitos registros para ter todas as opções
      });

      // Adicionar filtro pai (se existir)
      if (filtroPaiAtual === 'produto' || filtros.produto) {
        params.append('filtro_produto', 'true');
        if (filtroProdutoSelecionado) {
          const produtoIds = Array.isArray(filtroProdutoSelecionado)
            ? filtroProdutoSelecionado
            : [filtroProdutoSelecionado];
          produtoIds.forEach(id => {
            if (id) params.append('produto_id', String(id).trim());
          });
        }
      }
      if (filtroPaiAtual === 'atividade' || filtros.atividade) {
        params.append('filtro_atividade', 'true');
        if (filtroTarefaSelecionado) {
          const tarefaIds = Array.isArray(filtroTarefaSelecionado)
            ? filtroTarefaSelecionado
            : [filtroTarefaSelecionado];
          tarefaIds.forEach(id => {
            if (id) params.append('tarefa_id', String(id).trim());
          });
        }
      }
      if (filtroPaiAtual === 'cliente' || filtros.cliente) {
        params.append('filtro_cliente', 'true');
        if (filtroClienteSelecionado) {
          const clienteIds = Array.isArray(filtroClienteSelecionado)
            ? filtroClienteSelecionado
            : [filtroClienteSelecionado];
          clienteIds.forEach(id => {
            if (id) params.append('cliente_id', String(id).trim());
          });
        }
      }
      if (filtroPaiAtual === 'responsavel' || filtros.responsavel) {
        params.append('filtro_responsavel', 'true');
        if (filtroResponsavelSelecionado) {
          const responsavelIds = Array.isArray(filtroResponsavelSelecionado)
            ? filtroResponsavelSelecionado
            : [filtroResponsavelSelecionado];
          responsavelIds.forEach(id => {
            if (id) params.append('responsavel_id', String(id).trim());
          });
        }
      }

      // Adicionar TODOS os filtros adicionais já aplicados (exceto o que está sendo buscado)
      if (tipoFiltro !== 'cliente' && filtrosAdicionaisAtivos.cliente && filtroAdicionalCliente) {
        const clienteIds = Array.isArray(filtroAdicionalCliente)
          ? filtroAdicionalCliente
          : [filtroAdicionalCliente];
        clienteIds.forEach(id => {
          if (id) params.append('cliente_id', String(id).trim());
        });
      }
      if (tipoFiltro !== 'tarefa' && filtrosAdicionaisAtivos.tarefa && filtroAdicionalTarefa) {
        const tarefaIds = Array.isArray(filtroAdicionalTarefa)
          ? filtroAdicionalTarefa
          : [filtroAdicionalTarefa];
        tarefaIds.forEach(id => {
          if (id) params.append('tarefa_id', String(id).trim());
        });
      }
      if (tipoFiltro !== 'produto' && filtrosAdicionaisAtivos.produto && filtroAdicionalProduto) {
        const produtoIds = Array.isArray(filtroAdicionalProduto)
          ? filtroAdicionalProduto
          : [filtroAdicionalProduto];
        produtoIds.forEach(id => {
          if (id) params.append('produto_id', String(id).trim());
        });
      }

      // Adicionar período
      params.append('data_inicio', periodoInicio);
      params.append('data_fim', periodoFim);

      const url = `${API_BASE_URL}/tempo-estimado?${params}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const registros = result.data || [];

          // Extrair IDs únicos baseado no tipo de filtro
          const idsUnicos = new Set();
          registros.forEach(reg => {
            if (tipoFiltro === 'tarefa' && reg.tarefa_id) {
              idsUnicos.add(String(reg.tarefa_id));
            } else if (tipoFiltro === 'produto' && reg.produto_id) {
              idsUnicos.add(String(reg.produto_id));
            } else if (tipoFiltro === 'cliente' && reg.cliente_id) {
              idsUnicos.add(String(reg.cliente_id));
            } else if (tipoFiltro === 'responsavel' && reg.responsavel_id) {
              idsUnicos.add(String(reg.responsavel_id));
            } else if (tipoFiltro === 'tipo_tarefa' && reg.tipo_tarefa_id) {
              idsUnicos.add(String(reg.tipo_tarefa_id));
            }
          });

          // Buscar nomes dos itens
          const opcoes = [];
          for (const id of idsUnicos) {
            if (tipoFiltro === 'tarefa') {
              // Buscar nome da tarefa
              const nome = nomesCache.tarefas[id];
              if (nome) {
                opcoes.push({ id: parseInt(id), nome });
              } else {
                // Buscar da API se não estiver no cache
                try {
                  const tarefaResponse = await fetch(`${API_BASE_URL}/atividades/${id}`, {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                  if (tarefaResponse.ok) {
                    const tarefaResult = await tarefaResponse.json();
                    if (tarefaResult.success && tarefaResult.data) {
                      const nomeTarefa = tarefaResult.data.nome || `Tarefa #${id}`;
                      opcoes.push({ id: parseInt(id), nome: nomeTarefa });
                      // Atualizar cache
                      setNomesCache(prev => ({
                        ...prev,
                        tarefas: { ...prev.tarefas, [id]: nomeTarefa }
                      }));
                    }
                  }
                } catch (err) {
                  console.error(`Erro ao buscar tarefa ${id}:`, err);
                }
              }
            } else if (tipoFiltro === 'produto') {
              // Buscar nome do produto
              const nome = nomesCache.produtos[id];
              if (nome) {
                opcoes.push({ id: parseInt(id), nome });
              } else {
                // Buscar da API se não estiver no cache
                try {
                  const produtoResponse = await fetch(`${API_BASE_URL}/produtos/${id}`, {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                  if (produtoResponse.ok) {
                    const produtoResult = await produtoResponse.json();
                    if (produtoResult.success && produtoResult.data) {
                      const nomeProduto = produtoResult.data.nome || `Produto #${id}`;
                      opcoes.push({ id: parseInt(id), nome: nomeProduto });
                      // Atualizar cache
                      setNomesCache(prev => ({
                        ...prev,
                        produtos: { ...prev.produtos, [id]: nomeProduto }
                      }));
                    }
                  }
                } catch (err) {
                  console.error(`Erro ao buscar produto ${id}:`, err);
                }
              }
            } else if (tipoFiltro === 'cliente') {
              // Buscar nome do cliente
              const nome = nomesCache.clientes[id];
              if (nome) {
                opcoes.push({ id, nome });
              } else {
                // Buscar da lista de clientes
                const cliente = clientes.find(c => String(c.id) === id);
                if (cliente) {
                  opcoes.push({ id, nome: cliente.nome });
                  // Atualizar cache
                  setNomesCache(prev => ({
                    ...prev,
                    clientes: { ...prev.clientes, [id]: cliente.nome }
                  }));
                }
              }
            } else if (tipoFiltro === 'responsavel') {
              // Buscar nome do responsável
              const nome = nomesCache.colaboradores[id];
              if (nome) {
                opcoes.push({ id: parseInt(id), nome });
              } else {
                // Buscar da lista de membros
                const membro = membros.find(m => String(m.id) === id);
                if (membro) {
                  opcoes.push({ id: parseInt(id), nome: membro.nome });
                  // Atualizar cache
                  setNomesCache(prev => ({
                    ...prev,
                    colaboradores: { ...prev.colaboradores, [id]: membro.nome }
                  }));
                }
              }
            }
          }

          // Ordenar alfabeticamente
          opcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

          return opcoes;
        }
      }
      return [];
    } catch (error) {
      console.error(`Erro ao buscar opções filtradas para ${tipoFiltro}:`, error);
      return [];
    } finally {
      setCarregandoOpcoesFiltradas(prev => ({ ...prev, [tipoFiltro]: false }));
    }
  };

  // Alias para manter compatibilidade com código existente
  const buscarOpcoesFiltroAdicional = buscarOpcoesFiltroContextual;

  // Carregar produtos e tarefas quando o filtro correspondente for selecionado
  useEffect(() => {
    if (filtros.produto && produtos.length === 0) {
      loadProdutos();
    }
  }, [filtros.produto]);

  useEffect(() => {
    if (filtros.atividade && tarefas.length === 0) {
      loadTarefas();
    }
  }, [filtros.atividade]);



  // Buscar opções contextuais quando um filtro pai for selecionado pela primeira vez
  useEffect(() => {
    if (periodoInicio && periodoFim) {
      const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
      const temFiltrosAdicionais = filtrosAdicionaisAtivos.cliente || filtrosAdicionaisAtivos.tarefa || filtrosAdicionaisAtivos.produto;

      // Se há filtros adicionais ativos e um filtro pai foi selecionado, buscar opções contextuais
      if (temFiltrosAdicionais && filtroPaiAtual) {
        const buscarOpcoesPai = async () => {
          if (filtroPaiAtual === 'responsavel' || filtros.responsavel) {
            const opcoes = await buscarOpcoesFiltroContextual('responsavel');
            setOpcoesFiltradasResponsaveis(opcoes);
          }
          if (filtroPaiAtual === 'cliente' || filtros.cliente) {
            const opcoes = await buscarOpcoesFiltroContextual('cliente');
            setOpcoesFiltradasClientes(opcoes);
          }
          if (filtroPaiAtual === 'produto' || filtros.produto) {
            const opcoes = await buscarOpcoesFiltroContextual('produto');
            setOpcoesFiltradasProdutos(opcoes);
          }
          if (filtroPaiAtual === 'atividade' || filtros.atividade) {
            const opcoes = await buscarOpcoesFiltroContextual('tarefa');
            setOpcoesFiltradasTarefas(opcoes);
          }
        };
        buscarOpcoesPai();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.produto, filtros.atividade, filtros.cliente, filtros.responsavel, ordemFiltros]);

  const loadClientes = async (statusFiltro = null) => {
    setLoading(true);
    try {
      // Determinar o status a usar: se statusFiltro for 'todos' ou null, buscar todos
      const statusParaBuscar = (statusFiltro && statusFiltro !== 'todos') ? statusFiltro : null;

      // Buscar clientes com limite alto para garantir que todos sejam retornados
      // Se statusFiltro for fornecido e diferente de 'todos', filtrar por status
      const clientesResult = await clientesAPI.getPaginated({
        page: 1,
        limit: 10000,
        search: null,
        status: statusParaBuscar,
        incompletos: false
      });
      if (clientesResult.success && clientesResult.data && Array.isArray(clientesResult.data)) {
        const clientesComDados = clientesResult.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`,
          status: cliente.status || 'ativo' // Incluir status para validação posterior
        }));
        setClientes(clientesComDados);
        return clientesComDados; // Retornar clientes carregados para validação
      }
      return [];
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      showToast('error', 'Erro ao carregar clientes');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadColaboradores = async () => {
    try {
      const colaboradoresResult = await colaboradoresAPI.getAll();
      if (colaboradoresResult.success && colaboradoresResult.data && Array.isArray(colaboradoresResult.data)) {
        // Filtrar apenas colaboradores ativos
        const colaboradoresAtivos = colaboradoresResult.data
          .filter(colab => colab.status === 'ativo' || !colab.status)
          .map(colab => ({
            id: colab.id,
            nome: colab.nome || `Colaborador #${colab.id}`,
            cpf: colab.cpf || null
          }));
        setColaboradores(colaboradoresAtivos);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      showToast('error', 'Erro ao carregar colaboradores');
    }
  };

  const loadMembros = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && Array.isArray(result.data)) {
          // Mapear membros para o formato esperado (id e nome)
          const membrosFormatados = result.data.map(membro => ({
            id: membro.id,
            nome: membro.nome || `Membro #${membro.id}`
          }));
          setMembros(membrosFormatados);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      showToast('error', 'Erro ao carregar membros');
    }
  };

  // Atualizar cache de nomes quando clientes, colaboradores ou membros forem carregados
  useEffect(() => {
    if (clientes.length > 0 || colaboradores.length > 0 || membros.length > 0) {
      const novosNomes = { ...nomesCache };

      // Atualizar cache de clientes
      clientes.forEach(cliente => {
        novosNomes.clientes[String(cliente.id)] = cliente.nome;
      });

      // Atualizar cache de colaboradores
      colaboradores.forEach(colab => {
        novosNomes.colaboradores[String(colab.id)] = colab.cpf ? `${colab.nome} (${colab.cpf})` : colab.nome;
      });

      // Atualizar cache de membros (usando o mesmo cache de colaboradores)
      membros.forEach(membro => {
        if (!novosNomes.colaboradores[String(membro.id)]) {
          novosNomes.colaboradores[String(membro.id)] = membro.nome;
        }
      });

      setNomesCache(novosNomes);
    }
  }, [clientes, colaboradores, membros]);

  // Handlers de navegação
  const handleNewAtribuicao = () => {
    navigate('/atribuicao/nova');
  };

  const handleEditAtribuicao = (agrupamento) => {
    // Buscar o cliente_id do primeiro registro do agrupamento
    if (agrupamento.registros && agrupamento.registros.length > 0) {
      const clienteId = agrupamento.registros[0].cliente_id;
      navigate(`/atribuicao/cliente/${clienteId}?agrupador_id=${agrupamento.agrupador_id}`);
    } else {
      // Se não houver registros, navegar para nova atribuição
      navigate('/atribuicao/nova');
    }
  };

  // Agrupar registros por agrupador_id
  const agruparRegistros = (registros) => {
    const grupos = new Map();

    registros.forEach(registro => {
      const agrupadorId = registro.agrupador_id || 'sem-grupo';

      if (!grupos.has(agrupadorId)) {
        grupos.set(agrupadorId, {
          agrupador_id: agrupadorId,
          registros: [],
          primeiroRegistro: registro,
          quantidade: 0,
          dataInicio: null,
          dataFim: null
        });
      }

      const grupo = grupos.get(agrupadorId);
      grupo.registros.push(registro);
      grupo.quantidade = grupo.registros.length;

      // Encontrar data mínima e máxima
      // Converter strings de data para Date, tratando apenas a parte da data (sem hora)
      const datas = grupo.registros.map(r => {
        if (!r.data) return null;
        const dataStr = typeof r.data === 'string' ? r.data.split('T')[0] : r.data;
        // Criar data no timezone local para evitar problemas de UTC
        const [ano, mes, dia] = dataStr.split('-');
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      }).filter(d => d !== null).sort((a, b) => a - b);

      if (datas.length > 0) {
        grupo.dataInicio = datas[0];
        grupo.dataFim = datas[datas.length - 1];
      }
    });

    setRegistrosAgrupados(Array.from(grupos.values()));
  };

  // Buscar horas contratadas por responsável
  const buscarHorasContratadasPorResponsavel = async (responsavelId, dataInicio, dataFim) => {
    // Chave única para a requisição (incluir datas para diferenciar períodos)
    const requestKey = `${responsavelId}_${dataInicio}_${dataFim}`;

    // Verificar se já está buscando ou se já falhou
    if (fetchingHorasRef.current.has(requestKey) || failedHorasRef.current.has(requestKey)) {
      return null;
    }

    try {
      fetchingHorasRef.current.add(requestKey);

      const params = new URLSearchParams({
        membro_id: responsavelId
      });
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401 || response.status === 503) {
        failedHorasRef.current.add(requestKey);
        return null;
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return {
            horascontratadasdia: result.data.horascontratadasdia || null,
            tipo_contrato: result.data.tipo_contrato || null
          };
        }
      } else {
        // Se falhou com outro erro, marcar como falha para não insistir
        failedHorasRef.current.add(requestKey);
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar horas contratadas por responsável:', error);
      failedHorasRef.current.add(requestKey);
      return null;
    } finally {
      fetchingHorasRef.current.delete(requestKey);
    }
  };

  // Carregar tipos de contrato do backend
  const carregarTiposContrato = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipos-contrato`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Criar mapa id -> nome
          const mapa = {};
          result.data.forEach(tipo => {
            mapa[String(tipo.id)] = tipo.nome;
          });
          setTiposContratoMap(mapa);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
    }
  };

  // Carregar horas contratadas APENAS para responsáveis dos resultados filtrados
  const carregarHorasContratadasPorResponsaveis = async (agrupamentos, dataInicio, dataFim) => {
    const responsaveisIds = new Set();

    // Adicionar APENAS responsáveis dos registros agrupados (resultados filtrados)
    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      if (primeiroRegistro.responsavel_id) {
        responsaveisIds.add(String(primeiroRegistro.responsavel_id));
      }
    });

    // REMOVIDO: Não adicionar todos os membros do sistema
    // Isso causava busca de horas para responsáveis não filtrados, gerando inconsistências

    console.log(`📊 [HORAS-CONTRATADAS] Buscando horas contratadas para ${responsaveisIds.size} responsável(is) filtrado(s):`, Array.from(responsaveisIds));

    // Limpar cache inicialmente para garantir consistência
    setHorasContratadasPorResponsavel({});
    setTipoContratoPorResponsavel({});

    // Criar array de promises para requisições paralelas
    // Cada requisição atualiza o estado incrementalmente assim que completa
    const promises = Array.from(responsaveisIds).map(async (responsavelId) => {
      try {
        console.log(`  🔍 Buscando horas contratadas para responsável ${responsavelId} no período ${dataInicio} - ${dataFim}`);
        const resultado = await buscarHorasContratadasPorResponsavel(responsavelId, dataInicio, dataFim);

        // Atualizar estado incrementalmente assim que cada requisição completa
        if (resultado) {
          setHorasContratadasPorResponsavel(prev => ({
            ...prev,
            [responsavelId]: resultado.horascontratadasdia || null
          }));
          setTipoContratoPorResponsavel(prev => ({
            ...prev,
            [responsavelId]: resultado.tipo_contrato || null
          }));
          console.log(`  ✅ Responsável ${responsavelId}: ${resultado.horascontratadasdia || 0}h/dia (tipo: ${resultado.tipo_contrato || 'N/A'})`);
        } else {
          setHorasContratadasPorResponsavel(prev => ({
            ...prev,
            [responsavelId]: null
          }));
          setTipoContratoPorResponsavel(prev => ({
            ...prev,
            [responsavelId]: null
          }));
          console.log(`  ⚠️ Responsável ${responsavelId}: Nenhuma vigência encontrada`);
        }

        return resultado;
      } catch (error) {
        // Tratamento de erro individual para cada requisição
        console.error(`  ❌ Erro ao buscar horas contratadas para responsável ${responsavelId}:`, error);
        // Atualizar estado com null em caso de erro
        setHorasContratadasPorResponsavel(prev => ({
          ...prev,
          [responsavelId]: null
        }));
        setTipoContratoPorResponsavel(prev => ({
          ...prev,
          [responsavelId]: null
        }));
        return null;
      }
    });

    // Aguardar todas as requisições paralelas completarem
    await Promise.all(promises);
    console.log(`✅ [HORAS-CONTRATADAS] Todas as requisições completadas para ${responsaveisIds.size} responsável(is)`);
  };

  // Função para obter todos os registros atualmente visíveis (dos agrupamentos)
  const obterTodosRegistrosVisiveis = useCallback(() => {
    const todosRegistros = [];
    registrosAgrupados.forEach(agrupamento => {
      if (agrupamento.registros && Array.isArray(agrupamento.registros)) {
        todosRegistros.push(...agrupamento.registros);
      }
    });
    return todosRegistros;
  }, [registrosAgrupados]);

  // Calcular tempo estimado total diretamente dos registros calculados
  // DEPRECATED: Esta função não é mais usada - o cálculo foi movido para o backend
  // Mantida apenas como referência. O cálculo agora é feito pelo endpoint /api/tempo-estimado/total
  // eslint-disable-next-line no-unused-vars
  const calcularTempoEstimadoDosRegistros = (registrosCalculados, periodoInicio, periodoFim) => {
    const temposPorResponsavel = {};

    console.log(`🔍 [CALCULAR-TEMPO-ESTIMADO] Calculando tempo estimado de ${registrosCalculados.length} registros para período ${periodoInicio} a ${periodoFim}`);

    // Agrupar registros por responsável
    const registrosPorResponsavel = {};
    registrosCalculados.forEach(registro => {
      if (!registro.responsavel_id) return;
      const responsavelId = String(registro.responsavel_id);
      if (!registrosPorResponsavel[responsavelId]) {
        registrosPorResponsavel[responsavelId] = [];
      }
      registrosPorResponsavel[responsavelId].push(registro);
    });

    console.log(`🔍 [CALCULAR-TEMPO-ESTIMADO] Encontrados ${Object.keys(registrosPorResponsavel).length} responsáveis únicos`);

    // Para cada responsável, calcular tempo estimado total
    Object.keys(registrosPorResponsavel).forEach(responsavelId => {
      const registrosDoResponsavel = registrosPorResponsavel[responsavelId];

      // Map de data -> maior tempo_estimado_dia (evitar duplicação)
      const tempoPorData = new Map();

      registrosDoResponsavel.forEach(registro => {
        // Extrair data do registro
        const dataStr = registro.data ? registro.data.split('T')[0] : null;
        if (!dataStr) return;

        // Verificar se a data está no período (já deve estar, mas garantir)
        if (periodoInicio && periodoFim) {
          if (dataStr < periodoInicio || dataStr > periodoFim) return;
        }

        // Obter tempo estimado do registro
        let tempoEstimadoDia = Number(registro.tempo_estimado_dia) || 0;

        // Converter se necessário (horas decimais para milissegundos)
        if (tempoEstimadoDia > 0 && tempoEstimadoDia < 1000) {
          tempoEstimadoDia = Math.round(tempoEstimadoDia * 3600000);
        }

        // Somar os tempos para a mesma data (acumular carga de trabalho)
        const tempoAtual = tempoPorData.get(dataStr) || 0;
        tempoPorData.set(dataStr, tempoAtual + tempoEstimadoDia);
      });

      // Somar todos os tempos do Map
      let tempoTotal = 0;
      tempoPorData.forEach((tempoDia) => {
        tempoTotal += tempoDia;
      });

      temposPorResponsavel[responsavelId] = tempoTotal;

      // DEBUG: Log por responsável
      console.log(`🔍 [CALCULAR-TEMPO-ESTIMADO] Responsável ${responsavelId}: ${registrosDoResponsavel.length} registro(s), ${tempoPorData.size} data(s) única(s), total=${tempoTotal}ms (${(tempoTotal / 3600000).toFixed(2)}h)`);
    });

    return temposPorResponsavel;
  };

  // Carregar registros de tempo estimado
  const loadRegistrosTempoEstimado = useCallback(async (filtrosParaAplicar = null, periodoParaAplicar = null, valoresSelecionados = null, filtrosAdicionaisParaAplicar = null) => {
    console.log('🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Função chamada');
    setLoading(true);
    // Marcar dados auxiliares como não carregados ANTES de iniciar carregamento
    // Isso garante que os dashboards não sejam exibidos com dados parciais
    setDadosAuxiliaresCarregados(false);

    // Resetar grupos expandidos quando recarregar os dados
    setGruposExpandidos(new Set());
    setTarefasExpandidas(new Set());
    setAgrupamentosTarefasExpandidas(new Set());
    try {
      const filtrosAUsar = filtrosParaAplicar !== null ? filtrosParaAplicar : filtros;
      const periodoAUsar = periodoParaAplicar !== null ? periodoParaAplicar : {
        inicio: periodoInicio,
        fim: periodoFim
      };

      // Usar valores selecionados passados como parâmetro, ou os estados atuais
      const valoresAUsar = valoresSelecionados || {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        responsavel: filtroResponsavelSelecionado
      };

      // DEBUG: Log dos parâmetros
      console.log('🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Parâmetros:', {
        filtro_responsavel: filtrosAUsar.responsavel,
        responsavel_selecionado: valoresAUsar.responsavel,
        periodo: `${periodoAUsar.inicio} a ${periodoAUsar.fim}`
      });

      // Usar filtros adicionais passados como parâmetro, ou os estados atuais
      const filtrosAdicionaisAUsar = filtrosAdicionaisParaAplicar !== null ? filtrosAdicionaisParaAplicar : {
        cliente: filtroAdicionalCliente,
        tarefa: filtroAdicionalTarefa,
        produto: filtroAdicionalProduto
      };

      // IMPORTANTE: Quando há filtro de período, usar limit alto para garantir todas as regras
      // Isso é necessário para calcular tempo estimado corretamente
      // A paginação será aplicada apenas na listagem de registros, não nas regras retornadas
      const temPeriodo = periodoAUsar.inicio && periodoAUsar.fim;
      const limitParaBusca = temPeriodo ? '10000' : itemsPerPage.toString();
      const pageParaBusca = temPeriodo ? '1' : currentPage.toString();

      const params = new URLSearchParams({
        page: pageParaBusca,
        limit: limitParaBusca
      });

      console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Busca com limit=${limitParaBusca}, page=${pageParaBusca} (temPeriodo=${temPeriodo})`);

      // Adicionar filtros
      if (filtrosAUsar.produto) {
        params.append('filtro_produto', 'true');
        // Adicionar IDs de produtos selecionados se houver
        if (valoresAUsar.produto) {
          const produtoIds = Array.isArray(valoresAUsar.produto)
            ? valoresAUsar.produto
            : [valoresAUsar.produto];
          produtoIds.forEach(id => {
            if (id) params.append('produto_id', String(id).trim());
          });
        }
      }
      if (filtrosAUsar.atividade) {
        params.append('filtro_atividade', 'true');
        // Adicionar IDs de tarefas selecionadas se houver
        if (valoresAUsar.tarefa) {
          const tarefaIds = Array.isArray(valoresAUsar.tarefa)
            ? valoresAUsar.tarefa
            : [valoresAUsar.tarefa];
          tarefaIds.forEach(id => {
            if (id) params.append('tarefa_id', String(id).trim());
          });
        }
      }

      if (filtrosAUsar.cliente) {
        params.append('filtro_cliente', 'true');
        // Adicionar IDs de clientes selecionados se houver
        if (valoresAUsar.cliente) {
          const clienteIds = Array.isArray(valoresAUsar.cliente)
            ? valoresAUsar.cliente
            : [valoresAUsar.cliente];
          clienteIds.forEach(id => {
            if (id) params.append('cliente_id', String(id).trim());
          });
        }
      }
      if (filtrosAUsar.responsavel) {
        params.append('filtro_responsavel', 'true');
      }
      // IMPORTANTE: Sempre enviar responsavel_id quando houver colaborador selecionado,
      // mesmo que o filtro de responsável não esteja ativo
      // Isso garante que o tempo estimado seja calculado corretamente para o colaborador selecionado
      if (valoresAUsar.responsavel) {
        const responsavelIds = Array.isArray(valoresAUsar.responsavel)
          ? valoresAUsar.responsavel
          : [valoresAUsar.responsavel];
        responsavelIds.forEach(id => {
          if (id) {
            const idStr = String(id).trim();
            params.append('responsavel_id', idStr);
          }
        });
      }

      // Adicionar filtros adicionais (que não são o filtro pai)
      // Cliente adicional
      if (filtrosAdicionaisAUsar.cliente) {
        const clienteIds = Array.isArray(filtrosAdicionaisAUsar.cliente)
          ? filtrosAdicionaisAUsar.cliente
          : [filtrosAdicionaisAUsar.cliente];
        clienteIds.forEach(id => {
          if (id) params.append('cliente_id', String(id).trim());
        });
      }

      // Tarefa adicional
      if (filtrosAdicionaisAUsar.tarefa) {
        const tarefaIds = Array.isArray(filtrosAdicionaisAUsar.tarefa)
          ? filtrosAdicionaisAUsar.tarefa
          : [filtrosAdicionaisAUsar.tarefa];
        tarefaIds.forEach(id => {
          if (id) params.append('tarefa_id', String(id).trim());
        });
      }

      // Produto adicional
      if (filtrosAdicionaisAUsar.produto) {
        const produtoIds = Array.isArray(filtrosAdicionaisAUsar.produto)
          ? filtrosAdicionaisAUsar.produto
          : [filtrosAdicionaisAUsar.produto];
        produtoIds.forEach(id => {
          if (id) params.append('produto_id', String(id).trim());
        });
      }

      // Adicionar filtro de status de cliente (apenas quando filtro_cliente está ativo E é o filtro pai)
      // Verificar se o filtro pai atual é realmente "cliente"
      const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
      const isFiltroPaiCliente = filtroPaiAtual === 'cliente' || (ordemFiltros.length === 0 && filtrosAUsar.cliente);

      if (filtrosAUsar.cliente && isFiltroPaiCliente && filtroStatusCliente && filtroStatusCliente !== 'todos') {
        // Validar que o valor é válido antes de enviar
        if (filtroStatusCliente === 'ativo' || filtroStatusCliente === 'inativo') {
          params.append('cliente_status', filtroStatusCliente);
        }
      }

      // Adicionar filtro de período
      if (periodoAUsar.inicio) {
        params.append('data_inicio', periodoAUsar.inicio);
      }
      if (periodoAUsar.fim) {
        params.append('data_fim', periodoAUsar.fim);
      }

      const url = `${API_BASE_URL}/tempo-estimado?${params}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // NOVA LÓGICA: Backend retorna REGRAS, não registros calculados
          const regras = result.data || [];

          // DEBUG: Log das regras recebidas
          console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Total de regras recebidas do backend: ${regras.length}`);
          if (regras.length > 0) {
            const responsaveisNasRegras = new Set(regras.map(r => String(r.responsavel_id)).filter(Boolean));
            console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Responsáveis presentes nas regras:`, Array.from(responsaveisNasRegras));
            const regrasLuizMarcelo = regras.filter(r => String(r.responsavel_id) === '75397340197');
            console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Regras do Luiz Marcelo (75397340197): ${regrasLuizMarcelo.length}`);
          }

          // Gerar registros apenas para a listagem (não para cards)
          const registrosCalculados = [];
          if (periodoAUsar.inicio && periodoAUsar.fim) {
            regras.forEach(regra => {
              const regraInicio = regra.data_inicio ? (regra.data_inicio.includes('T') ? regra.data_inicio.split('T')[0] : regra.data_inicio) : periodoAUsar.inicio;
              const regraFim = regra.data_fim ? (regra.data_fim.includes('T') ? regra.data_fim.split('T')[0] : regra.data_fim) : periodoAUsar.fim;

              const periodoInicio = regraInicio > periodoAUsar.inicio ? regraInicio : periodoAUsar.inicio;
              const periodoFim = regraFim < periodoAUsar.fim ? regraFim : periodoAUsar.fim;

              if (periodoInicio <= periodoFim) {
                const datasValidasSet = obterDatasValidasNoPeriodo(
                  periodoInicio,
                  periodoFim,
                  regra.incluir_finais_semana !== false,
                  regra.incluir_feriados !== false
                );

                const datasValidas = Array.from(datasValidasSet);

                datasValidas.forEach(dataStr => {
                  const idVirtual = `${regra.id}_${dataStr}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 36);

                  registrosCalculados.push({
                    id: idVirtual,
                    tempo_estimado_id: idVirtual,
                    agrupador_id: regra.agrupador_id,
                    cliente_id: regra.cliente_id,
                    produto_id: regra.produto_id,
                    tarefa_id: regra.tarefa_id,
                    responsavel_id: regra.responsavel_id,

                    data: dataStr.includes('T') ? dataStr : `${dataStr}T00:00:00`,
                    tempo_estimado_dia: regra.tempo_estimado_dia,
                    incluir_finais_semana: regra.incluir_finais_semana !== false,
                    incluir_feriados: regra.incluir_feriados !== false,
                    regra_id: regra.id,
                    responsavel_foto_perfil: regra.responsavel_foto_perfil,
                    created_at: regra.created_at,
                    updated_at: regra.updated_at
                  });
                });
              }
            });
          }

          // Agrupar registros por agrupador_id
          console.log(`📦 [LOAD-REGISTROS-TEMPO-ESTIMADO] Agrupando ${registrosCalculados.length} registros calculados`);
          agruparRegistros(registrosCalculados);
          console.log(`📦 [LOAD-REGISTROS-TEMPO-ESTIMADO] Registros agrupados. Total de agrupamentos será atualizado em setRegistrosAgrupados`);

          // Quando há período, usamos limit alto e geramos todos os registros
          // Nesse caso, usar o total de registros calculados para paginação
          // Caso contrário, usar o total retornado pelo backend
          const totalParaPaginar = temPeriodo
            ? registrosCalculados.length
            : (result.total || 0);

          setTotalRegistros(totalParaPaginar);
          setTotalPages(Math.ceil(totalParaPaginar / itemsPerPage));

          // NOVA LÓGICA: Buscar tempo estimado total do backend
          // O cálculo agora é feito no servidor, garantindo consistência e melhor performance
          if (periodoAUsar.inicio && periodoAUsar.fim) {
            // Construir parâmetros para o endpoint de tempo estimado total
            const paramsTotal = new URLSearchParams();

            // Adicionar período (obrigatório)
            paramsTotal.append('data_inicio', periodoAUsar.inicio);
            paramsTotal.append('data_fim', periodoAUsar.fim);

            // Adicionar flags de finais de semana e feriados (filtros do dashboard)
            paramsTotal.append('considerarFinaisDeSemana', habilitarFinaisSemana ? 'true' : 'false');
            paramsTotal.append('considerarFeriados', habilitarFeriados ? 'true' : 'false');

            // Adicionar filtros de valores selecionados
            if (valoresAUsar.produto) {
              const produtoIds = Array.isArray(valoresAUsar.produto)
                ? valoresAUsar.produto
                : [valoresAUsar.produto];
              produtoIds.forEach(id => {
                if (id) paramsTotal.append('produto_id', String(id).trim());
              });
            }

            if (valoresAUsar.tarefa) {
              const tarefaIds = Array.isArray(valoresAUsar.tarefa)
                ? valoresAUsar.tarefa
                : [valoresAUsar.tarefa];
              tarefaIds.forEach(id => {
                if (id) paramsTotal.append('tarefa_id', String(id).trim());
              });
            }

            if (valoresAUsar.tipo_tarefa) {
              const tipoTarefaIds = Array.isArray(valoresAUsar.tipo_tarefa)
                ? valoresAUsar.tipo_tarefa
                : [valoresAUsar.tipo_tarefa];
              tipoTarefaIds.forEach(id => {
                if (id) paramsTotal.append('tipo_tarefa_id', String(id).trim());
              });
            }

            if (valoresAUsar.cliente) {
              const clienteIds = Array.isArray(valoresAUsar.cliente)
                ? valoresAUsar.cliente
                : [valoresAUsar.cliente];
              clienteIds.forEach(id => {
                if (id) paramsTotal.append('cliente_id', String(id).trim());
              });
            }

            if (valoresAUsar.responsavel) {
              const responsavelIds = Array.isArray(valoresAUsar.responsavel)
                ? valoresAUsar.responsavel
                : [valoresAUsar.responsavel];
              responsavelIds.forEach(id => {
                if (id) paramsTotal.append('responsavel_id', String(id).trim());
              });
            }

            // Adicionar filtros adicionais
            if (filtrosAdicionaisAUsar.cliente) {
              const clienteIds = Array.isArray(filtrosAdicionaisAUsar.cliente)
                ? filtrosAdicionaisAUsar.cliente
                : [filtrosAdicionaisAUsar.cliente];
              clienteIds.forEach(id => {
                if (id) paramsTotal.append('cliente_id', String(id).trim());
              });
            }
            if (filtrosAdicionaisAUsar.tarefa) {
              const tarefaIds = Array.isArray(filtrosAdicionaisAUsar.tarefa)
                ? filtrosAdicionaisAUsar.tarefa
                : [filtrosAdicionaisAUsar.tarefa];
              tarefaIds.forEach(id => {
                if (id) paramsTotal.append('tarefa_id', String(id).trim());
              });
            }
            if (filtrosAdicionaisAUsar.produto) {
              const produtoIds = Array.isArray(filtrosAdicionaisAUsar.produto)
                ? filtrosAdicionaisAUsar.produto
                : [filtrosAdicionaisAUsar.produto];
              produtoIds.forEach(id => {
                if (id) paramsTotal.append('produto_id', String(id).trim());
              });
            }

            // Adicionar filtro de status de cliente se aplicável
            const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
            const isFiltroPaiCliente = filtroPaiAtual === 'cliente' || (ordemFiltros.length === 0 && filtrosAUsar.cliente);
            if (filtrosAUsar.cliente && isFiltroPaiCliente && filtroStatusCliente && filtroStatusCliente !== 'todos') {
              if (filtroStatusCliente === 'ativo' || filtroStatusCliente === 'inativo') {
                paramsTotal.append('cliente_status', filtroStatusCliente);
              }
            }

            const urlTotal = `${API_BASE_URL}/tempo-estimado/total?${paramsTotal}`;

            try {
              console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Buscando tempo estimado total do backend: ${urlTotal}`);

              const responseTotal = await fetch(urlTotal, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });

              if (responseTotal.status === 401) {
                window.location.href = '/login';
                return;
              }

              if (responseTotal.ok) {
                const resultTotal = await responseTotal.json();
                if (resultTotal.success && resultTotal.data) {
                  const temposEstimadosPorResponsavel = resultTotal.data || {};

                  console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Tempo estimado total recebido do backend:`, Object.keys(temposEstimadosPorResponsavel).map(id => ({
                    id,
                    tempo: `${(temposEstimadosPorResponsavel[id] / 3600000).toFixed(2)}h`
                  })));

                  // Atualizar cache de tempo estimado total
                  setTempoEstimadoTotalPorResponsavel(temposEstimadosPorResponsavel);
                } else {
                  console.warn('⚠️ [LOAD-REGISTROS-TEMPO-ESTIMADO] Resposta do backend sem dados válidos');
                  setTempoEstimadoTotalPorResponsavel({});
                }
              } else {
                console.error('❌ [LOAD-REGISTROS-TEMPO-ESTIMADO] Erro ao buscar tempo estimado total:', responseTotal.status);
                setTempoEstimadoTotalPorResponsavel({});
              }
            } catch (error) {
              console.error('❌ [LOAD-REGISTROS-TEMPO-ESTIMADO] Erro ao buscar tempo estimado total do backend:', error);
              setTempoEstimadoTotalPorResponsavel({});
            }
          } else {
            // Se não há período, limpar cache de tempo estimado
            setTempoEstimadoTotalPorResponsavel({});
          }

          // OTIMIZAÇÃO: Preparar agrupamentos ANTES de marcar como carregado para iniciar carregamento de horas contratadas mais cedo
          let agrupamentosArray = [];
          if (periodoAUsar.inicio && periodoAUsar.fim && registrosCalculados.length > 0) {
            const agrupadosTemp = {};
            registrosCalculados.forEach(registro => {
              const agrupadorId = registro.agrupador_id || 'sem-grupo';
              if (!agrupadosTemp[agrupadorId]) {
                agrupadosTemp[agrupadorId] = {
                  primeiroRegistro: registro,
                  quantidade: 0
                };
              }
              agrupadosTemp[agrupadorId].quantidade++;
            });

            agrupamentosArray = Object.values(agrupadosTemp);
          }

          // OTIMIZAÇÃO: Marcar como carregado para exibir cards (com tempo estimado já calculado)
          setDadosAuxiliaresCarregados(true);

          // Carregar TODOS os dados auxiliares em paralelo desde o início (não sequencial)

          const promisesAuxiliares = [
            carregarNomesRelacionados(registrosCalculados)
          ];

          // Adicionar carregamento de custos e horas contratadas em paralelo (AGORA EM LOTE ÚNICO)
          if (agrupamentosArray.length > 0) {
            promisesAuxiliares.push(
              carregarDadosVigenciaEmLote(agrupamentosArray, periodoAUsar.inicio, periodoAUsar.fim)
                .catch(err => console.error('Erro ao carregar dados vigência em lote:', err))
            );
          }

          Promise.all(promisesAuxiliares).catch(err => console.error('Erro ao carregar dados auxiliares:', err));
        } else {
          // Se não há dados, marca como carregado mesmo assim
          setDadosAuxiliaresCarregados(true);
        }
      } else {
        // Se não há resposta ok, marca como carregado para não travar a interface
        setDadosAuxiliaresCarregados(true);
      }
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      showToast('error', 'Erro ao carregar registros de tempo estimado');
      // Em caso de erro, marca como carregado para não travar a interface
      setDadosAuxiliaresCarregados(true);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtros, periodoInicio, periodoFim]);

  // Carregar nomes de produtos, tarefas, clientes e colaboradores
  const carregarNomesRelacionados = async (registros) => {
    const produtosIds = new Set();
    const tarefasIds = new Set();
    const clientesIds = new Set();
    const colaboradoresIds = new Set();

    registros.forEach(reg => {
      if (reg.produto_id) produtosIds.add(String(reg.produto_id));
      if (reg.tarefa_id) tarefasIds.add(String(reg.tarefa_id));
      if (reg.cliente_id) clientesIds.add(String(reg.cliente_id));
      if (reg.responsavel_id) colaboradoresIds.add(String(reg.responsavel_id));
    });

    // Clone atual do cache não é confiável pois pode estar desatualizado no closure
    // Vamos coletar apenas o que VIER DE NOVO e atualizar com setNomesCache(prev => ...)
    const novosNomes = {
      produtos: {},
      tarefas: {},
      clientes: {},
      colaboradores: {}
    };
    let houveMudancas = false;

    // --- PRODUTOS ---
    if (produtosIds.size > 0) {
      // Filtrar o que precisa buscar: não está no cache E não está buscando E não falhou
      const produtosParaBuscar = Array.from(produtosIds).filter(id =>
        !nomesCache.produtos[id] &&
        !fetchingProductsRef.current.has(id) &&
        !failedProductsRef.current.has(id)
      );

      if (produtosParaBuscar.length > 0) {
        // Marcar como fetching
        produtosParaBuscar.forEach(id => fetchingProductsRef.current.add(id));

        try {
          const idsParam = produtosParaBuscar.join(',');
          const response = await fetch(`${API_BASE_URL}/produtos-por-ids-numericos?ids=${idsParam}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.status === 401 || response.status === 503) {
            produtosParaBuscar.forEach(id => failedProductsRef.current.add(id));
          } else if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              Object.entries(result.data).forEach(([id, nome]) => {
                novosNomes.produtos[String(id)] = nome;
                houveMudancas = true;
              });
            }
            // Para as que não vieram (ids pedidos mas não retornados), marcar como falha para não buscar de novo
            // ou definir um nome padrão. Vamos definir padrão para evitar loop ses a API retornar sucesso mas sem o dado.
            produtosParaBuscar.forEach(id => {
              if (!result.data || !result.data[id]) {
                novosNomes.produtos[id] = `Produto #${id}`;
                houveMudancas = true;
              }
            });
          } else {
            produtosParaBuscar.forEach(id => failedProductsRef.current.add(id));
          }
        } catch (error) {
          console.error('Erro ao buscar produtos em lote:', error);
          produtosParaBuscar.forEach(id => failedProductsRef.current.add(id));
        } finally {
          produtosParaBuscar.forEach(id => fetchingProductsRef.current.delete(id));
        }
      }
    }

    // --- TAREFAS ---
    if (tarefasIds.size > 0) {
      const tarefasParaBuscar = Array.from(tarefasIds).filter(id =>
        !nomesCache.tarefas[id] &&
        !fetchingTasksRef.current.has(id) &&
        !failedTasksRef.current.has(id)
      );

      if (tarefasParaBuscar.length > 0) {
        // Marcar como fetching
        tarefasParaBuscar.forEach(id => fetchingTasksRef.current.add(id));

        try {
          const idsParam = tarefasParaBuscar.join(',');
          const response = await fetch(`${API_BASE_URL}/tarefas-por-ids?ids=${idsParam}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.status === 401 || response.status === 503) {
            tarefasParaBuscar.forEach(id => failedTasksRef.current.add(id));
          } else if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              Object.entries(result.data).forEach(([id, nome]) => {
                novosNomes.tarefas[String(id)] = nome;
                houveMudancas = true;
              });
            }
            // Fallback
            tarefasParaBuscar.forEach(id => {
              if (!result.data || !result.data[id]) {
                novosNomes.tarefas[id] = `Tarefa #${id}`;
                houveMudancas = true;
              }
            });
          } else {
            tarefasParaBuscar.forEach(id => failedTasksRef.current.add(id));
          }
        } catch (error) {
          console.error('Erro ao buscar tarefas em lote:', error);
          tarefasParaBuscar.forEach(id => failedTasksRef.current.add(id));
        } finally {
          tarefasParaBuscar.forEach(id => fetchingTasksRef.current.delete(id));
        }
      }
    }

    // --- CLIENTES e COLABORADORES (Local) ---
    if (clientesIds.size > 0) {
      clientesIds.forEach(clienteId => {
        if (!nomesCache.clientes[clienteId]) {
          const cliente = clientes.find(c => String(c.id) === String(clienteId));
          if (cliente) {
            novosNomes.clientes[clienteId] = cliente.nome;
            houveMudancas = true;
          }
        }
      });
    }

    if (colaboradoresIds.size > 0) {
      colaboradoresIds.forEach(colabId => {
        if (!nomesCache.colaboradores[colabId]) {
          const colab = colaboradores.find(c => String(c.id) === String(colabId));
          if (colab) {
            novosNomes.colaboradores[colabId] = colab.cpf ? `${colab.nome} (${colab.cpf})` : colab.nome;
            houveMudancas = true;
          } else {
            // Tentar encontrar em 'membros' se disponível
            const membro = membros.find(m => String(m.id) === String(colabId));
            if (membro) {
              novosNomes.colaboradores[colabId] = membro.nome;
              houveMudancas = true;
            }
          }
        }
      });
    }

    if (houveMudancas) {
      setNomesCache(prev => ({
        ...prev,
        produtos: { ...prev.produtos, ...novosNomes.produtos },
        tarefas: { ...prev.tarefas, ...novosNomes.tarefas },
        clientes: { ...prev.clientes, ...novosNomes.clientes },
        colaboradores: { ...prev.colaboradores, ...novosNomes.colaboradores }
      }));
    }
  };

  // Funções auxiliares para obter nomes
  const getNomeProduto = (produtoId) => {
    return nomesCache.produtos[String(produtoId)] || 'Produto';
  };

  const getNomeTarefa = (tarefaId) => {
    return nomesCache.tarefas[String(tarefaId)] || 'Tarefa';
  };

  const getClienteLabel = (clienteId) => {
    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    return cliente ? cliente.nome : 'Cliente';
  };

  const getColaboradorLabel = (colaboradorId) => {
    const colaborador = colaboradores.find(c => String(c.id) === String(colaboradorId));
    if (colaborador) {
      return colaborador.cpf ? `${colaborador.nome} (${colaborador.cpf})` : colaborador.nome;
    }
    return 'Colaborador';
  };

  const getNomeCliente = (clienteId) => {
    return nomesCache.clientes[String(clienteId)] || getClienteLabel(clienteId) || 'Cliente';
  };

  const getNomeColaborador = (colabId) => {
    return nomesCache.colaboradores[String(colabId)] || getColaboradorLabel(colabId) || 'Colaborador';
  };

  // Formatar data
  const formatarData = (dataInput) => {
    if (!dataInput) return '—';
    try {
      let date;

      // Se for um objeto Date, usar diretamente
      if (dataInput instanceof Date) {
        date = dataInput;
      } else if (typeof dataInput === 'string') {
        // Se for string ISO, extrair apenas a parte da data
        const dataStr = dataInput.split('T')[0];
        const [ano, mes, dia] = dataStr.split('-');
        date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      } else {
        date = new Date(dataInput);
      }

      if (isNaN(date.getTime())) return '—';

      // Usar métodos locais para garantir a data correta
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();

      return `${dia}/${mes}/${ano}`;
    } catch (e) {
      return '—';
    }
  };

  // Formatar período
  const formatarPeriodo = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) return '—';
    return `${formatarData(dataInicio)} até ${formatarData(dataFim)}`;
  };

  // Verificar se uma data está dentro do período filtrado
  const dataEstaNoPeriodo = (dataRegistro) => {
    if (!periodoInicio || !periodoFim || !dataRegistro) return true; // Se não há filtro de período, mostrar tudo

    try {
      // Converter data do registro para Date
      let dataReg;
      if (dataRegistro instanceof Date) {
        dataReg = new Date(dataRegistro);
      } else if (typeof dataRegistro === 'string') {
        const dataStr = dataRegistro.split('T')[0];
        const [ano, mes, dia] = dataStr.split('-');
        dataReg = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      } else {
        dataReg = new Date(dataRegistro);
      }

      // Converter período filtrado para Date
      let inicio, fim;

      // Se periodoInicio/periodoFim são strings no formato "YYYY-MM-DD", parsear manualmente
      if (typeof periodoInicio === 'string' && periodoInicio.includes('-')) {
        const [anoInicio, mesInicio, diaInicio] = periodoInicio.split('-');
        inicio = new Date(parseInt(anoInicio), parseInt(mesInicio) - 1, parseInt(diaInicio));
      } else {
        inicio = new Date(periodoInicio);
      }

      if (typeof periodoFim === 'string' && periodoFim.includes('-')) {
        const [anoFim, mesFim, diaFim] = periodoFim.split('-');
        fim = new Date(parseInt(anoFim), parseInt(mesFim) - 1, parseInt(diaFim));
      } else {
        fim = new Date(periodoFim);
      }

      // Normalizar para comparar apenas datas (sem hora)
      dataReg.setHours(0, 0, 0, 0);
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999); // Colocar no final do dia para incluir a data final

      return dataReg >= inicio && dataReg <= fim;
    } catch (e) {
      console.error('Erro ao verificar data no período:', e);
      return true; // Em caso de erro, mostrar o registro
    }
  };


  // Formatar tempo estimado (de milissegundos para horas, minutos e segundos)
  const formatarTempoEstimado = (milissegundos, incluirSegundos = false) => {
    if (!milissegundos || milissegundos === 0) {
      // Se incluirSegundos for true, retornar "0s" em vez de "—"
      return incluirSegundos ? '0s' : '—';
    }
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    if (incluirSegundos) {
      if (horas > 0 && minutos > 0 && segundos > 0) {
        return `${horas}h ${minutos}min ${segundos}s`;
      } else if (horas > 0 && minutos > 0) {
        return `${horas}h ${minutos}min`;
      } else if (horas > 0) {
        return `${horas}h`;
      } else if (minutos > 0 && segundos > 0) {
        return `${minutos}min ${segundos}s`;
      } else if (minutos > 0) {
        return `${minutos}min`;
      } else if (segundos > 0) {
        return `${segundos}s`;
      }
    } else {
      if (horas > 0 && minutos > 0) {
        return `${horas}h ${minutos}min`;
      } else if (horas > 0) {
        return `${horas}h`;
      } else if (minutos > 0) {
        return `${minutos}min`;
      }
    }
    // Se chegou aqui e incluirSegundos é true, retornar "0s" em vez de "—"
    return incluirSegundos ? '0s' : '—';
  };

  // Carregar custos e horas contratadas EM LOTE (Solução Definitiva)
  const carregarDadosVigenciaEmLote = async (agrupamentos, dataInicio, dataFim) => {
    const responsaveisIds = new Set();
    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      if (primeiroRegistro.responsavel_id) {
        responsaveisIds.add(String(primeiroRegistro.responsavel_id));
      }
    });

    // Filtrar apenas responsáveis que ainda não têm dados no cache (se quiser otimizar)
    // Mas para garantir atualização correta com o período, melhor buscar de todos os visíveis
    // ou filtrar inteligentemente. Vamos buscar de todos os envolvidos neste lote de agrupamentos.
    const responsaveisParaBuscar = Array.from(responsaveisIds);

    if (responsaveisParaBuscar.length === 0) return;

    try {
      console.log(`📦 [VIGENCIA-LOTE] Buscando dados para ${responsaveisParaBuscar.length} responsáveis`);

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          membros_ids: responsaveisParaBuscar,
          data_inicio: dataInicio,
          data_fim: dataFim
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const dados = result.data;

          const novosCustos = { ...custosPorResponsavel };
          const novasHoras = { ...horasContratadasPorResponsavel };
          let mudou = false;

          Object.entries(dados).forEach(([membroId, vigencia]) => {
            if (vigencia) {
              // Atualizar Custo
              if (vigencia.custo_hora) {
                novosCustos[membroId] = vigencia.custo_hora;
                mudou = true;
              }
              // Atualizar Horas Contratadas
              const horas = vigencia.horascontratadasdia;
              // Formata para salvar no estado (número ou null)
              const horasFormatadas = (horas !== null && horas !== undefined) ?
                (typeof horas === 'number' ? horas : parseFloat(horas)) : null;

              // Armazenar objeto completo como o componente espera ou apenas o valor?
              // O componente espera: { horas: number, tipoContrato: number }
              novasHoras[membroId] = {
                horas: horasFormatadas,
                tipoContrato: vigencia.tipo_contrato
              };
              mudou = true;
            } else {
              // Responsável sem vigência
              // Marcar como nulo para não ficar "loading" eternamente se tiver lógica de loading
              novasHoras[membroId] = { horas: 0, tipoContrato: null };
              mudou = true;
            }
          });

          // Preencher também os que não retornaram (sem vigência nenhuma)
          responsaveisParaBuscar.forEach(id => {
            if (!dados[id]) {
              novasHoras[id] = { horas: 0, tipoContrato: null };
              mudou = true;
            }
          });

          if (mudou) {
            setCustosPorResponsavel(prev => ({ ...prev, ...novosCustos }));
            setHorasContratadasPorResponsavel(prev => ({ ...prev, ...novasHoras }));
          }
        }
      } else {
        console.error("Erro ao buscar dados de vigência em lote:", response.status);
      }
    } catch (error) {
      console.error("Erro de rede ao buscar dados em lote:", error);
    }
  };

  // Calcular custo estimado total para um grupo (funciona para qualquer filtro principal)
  const calcularCustoEstimadoTotal = (agrupamentos) => {
    // Coletar todos os responsáveis únicos e seus tempos
    const temposPorResponsavel = {};

    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      const responsavelId = primeiroRegistro.responsavel_id;

      if (!responsavelId) return;

      const custoHoraStr = custosPorResponsavel[String(responsavelId)];
      if (!custoHoraStr) return;

      // Converter custo_hora de string (formato "21,22") para número
      const custoHora = parseFloat(custoHoraStr.replace(',', '.'));
      if (isNaN(custoHora) || custoHora <= 0) return;

      // Calcular tempo total deste agrupamento em horas
      const tempoEstimadoDia = primeiroRegistro.tempo_estimado_dia || 0;
      const tempoHorasPorDia = tempoEstimadoDia / 3600000;
      const quantidadeDias = agrupamento.quantidade || 0;
      const tempoTotalHoras = tempoHorasPorDia * quantidadeDias;

      // Acumular tempo por responsável
      if (!temposPorResponsavel[String(responsavelId)]) {
        temposPorResponsavel[String(responsavelId)] = {
          custoHora,
          tempoTotalHoras: 0
        };
      }
      temposPorResponsavel[String(responsavelId)].tempoTotalHoras += tempoTotalHoras;
    });

    // Somar todos os custos
    let custoTotal = 0;
    Object.values(temposPorResponsavel).forEach(({ custoHora, tempoTotalHoras }) => {
      custoTotal += custoHora * tempoTotalHoras;
    });

    return custoTotal > 0 ? custoTotal : null;
  };

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Calcular custo para um tempo específico e responsável
  const calcularCustoPorTempo = (tempoMilissegundos, responsavelId) => {
    if (!tempoMilissegundos || !responsavelId) return null;

    const custoHoraStr = custosPorResponsavel[String(responsavelId)];
    if (!custoHoraStr) return null;

    // Converter custo_hora de string (formato "21,22") para número
    const custoHora = parseFloat(custoHoraStr.replace(',', '.'));
    if (isNaN(custoHora) || custoHora <= 0) return null;

    // Converter tempo de milissegundos para horas
    const tempoHoras = tempoMilissegundos / 3600000;

    // Custo = custo por hora * tempo em horas
    const custo = custoHora * tempoHoras;
    return custo;
  };

  // Formatar tempo com custo (se disponível)
  const formatarTempoComCusto = (tempoMilissegundos, responsavelId, incluirSegundos = false) => {
    const tempoFormatado = formatarTempoEstimado(tempoMilissegundos, incluirSegundos);
    const custo = calcularCustoPorTempo(tempoMilissegundos, responsavelId);

    if (custo !== null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>{tempoFormatado}</span>
          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
            {formatarValorMonetario(custo)}
          </span>
        </div>
      );
    }

    return tempoFormatado;
  };

  // Formatar tempo estimado e realizado juntos
  const formatarTempoEstimadoERealizado = (registro, incluirSegundos = false) => {
    const tempoEstimado = registro.tempo_estimado_dia || 0;
    // Tempo realizado sempre 0 (lógica removida)
    const tempoRealizadoValor = 0;
    const tempoEstimadoFormatado = formatarTempoEstimado(tempoEstimado, incluirSegundos);
    const tempoRealizadoFormatado = '0s';
    const custoEstimado = calcularCustoPorTempo(tempoEstimado, registro.responsavel_id);
    const custoRealizado = null;

    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        {/* Quadrado Estimado */}
        <div style={{
          background: '#fef3c7',
          borderRadius: '6px',
          padding: '6px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          width: 'fit-content'
        }}>
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Estimado: <span style={{ fontWeight: 600, color: '#f59e0b' }}>{tempoEstimadoFormatado}</span>
          </div>
          {custoEstimado !== null && (
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 500, whiteSpace: 'nowrap' }}>
              Custo: <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatarValorMonetario(custoEstimado)}</span>
            </div>
          )}
        </div>

        {/* Quadrado Realizado */}
        <div style={{
          background: '#f3f4f6',
          borderRadius: '6px',
          padding: '6px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          width: 'fit-content'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Realizado: <span style={{ fontWeight: 600, color: '#9ca3af' }}>0s</span>
          </div>
        </div>
      </div>
    );
  };

  // Calcular tempo disponível, estimado, realizado e sobrando para um responsável (usando os agrupamentos já filtrados)
  const calcularTempoDisponivelRealizadoSobrando = (responsavelId, agrupamentos) => {
    // Usar valores aplicados do período (ou null se não foram aplicados)
    const periodoAplicadoInicio = filtrosUltimosAplicados?.periodoInicio;
    const periodoAplicadoFim = filtrosUltimosAplicados?.periodoFim;
    if (!periodoAplicadoInicio || !periodoAplicadoFim) return null;

    // Usar valores aplicados dos toggles (ou false como padrão se não foram aplicados)
    const habilitarFinaisSemanaAplicado = filtrosUltimosAplicados?.habilitarFinaisSemana ?? false;
    const habilitarFeriadosAplicado = filtrosUltimosAplicados?.habilitarFeriados ?? false;
    const datasIndividuaisAplicado = filtrosUltimosAplicados?.datasIndividuais ?? [];

    // Obter conjunto de datas válidas (considerando opções e datas individuais)
    const datasValidas = obterDatasValidasNoPeriodo(
      periodoAplicadoInicio,
      periodoAplicadoFim,
      habilitarFinaisSemanaAplicado,
      habilitarFeriadosAplicado,
      datasIndividuaisAplicado
    );

    // Calcular dias considerando as opções de incluir finais de semana, feriados e datas individuais
    const diasNoPeriodo = calcularDiasComOpcoesEDatasIndividuais(periodoAplicadoInicio, periodoAplicadoFim, habilitarFinaisSemanaAplicado, habilitarFeriadosAplicado, datasIndividuaisAplicado);

    // Função auxiliar para verificar se uma data está nas datas válidas
    const dataEstaNoPeriodoAplicado = (dataRegistro) => {
      if (!periodoAplicadoInicio || !periodoAplicadoFim || !dataRegistro) return true;
      if (datasValidas.size === 0) return false; // Se não há datas válidas, não incluir nada

      try {
        let dataStr;
        if (typeof dataRegistro === 'string') {
          // Extrair apenas a parte da data (YYYY-MM-DD) ignorando timezone
          dataStr = dataRegistro.split('T')[0];
        } else if (dataRegistro instanceof Date) {
          // Para Date, usar métodos do timezone local para garantir consistência
          const year = dataRegistro.getFullYear();
          const month = String(dataRegistro.getMonth() + 1).padStart(2, '0');
          const day = String(dataRegistro.getDate()).padStart(2, '0');
          dataStr = `${year}-${month}-${day}`;
        } else {
          // Para outros tipos, criar Date e depois normalizar
          const dataReg = new Date(dataRegistro);
          const year = dataReg.getFullYear();
          const month = String(dataReg.getMonth() + 1).padStart(2, '0');
          const day = String(dataReg.getDate()).padStart(2, '0');
          dataStr = `${year}-${month}-${day}`;
        }

        // Garantir formato correto (YYYY-MM-DD)
        if (!dataStr || !dataStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          console.warn('Formato de data inválido:', dataRegistro, '->', dataStr);
          return false;
        }

        return datasValidas.has(dataStr);
      } catch (error) {
        console.error('Erro ao verificar se data está no período aplicado:', error, 'dataRegistro:', dataRegistro);
        return false;
      }
    };

    // Tempo estimado: usar o valor já calculado corretamente em loadRegistrosTempoEstimado
    // Este valor já considera:
    // - Período filtrado corretamente
    // - Interseção entre período da regra e período filtrado
    // - Configurações de cada regra (incluir_finais_semana, incluir_feriados)
    // - Evita duplicação de datas usando Map de datas únicas
    const tempoEstimado = tempoEstimadoTotalPorResponsavel[String(responsavelId)] || 0;

    // Verificar se é PJ (tipo_contrato === 2)
    const tipoContrato = tipoContratoPorResponsavel[String(responsavelId)];
    // Verificar se tipo_contrato é 2 (PJ) - pode vir como número ou string
    const isPJ = tipoContrato !== null && tipoContrato !== undefined && (
      tipoContrato === 2 ||
      tipoContrato === '2' ||
      Number(tipoContrato) === 2 ||
      String(tipoContrato).trim() === '2'
    );

    // Se for PJ, usar estimado como disponível; caso contrário, calcular normalmente
    const horasContratadasDia = horasContratadasPorResponsavel[String(responsavelId)];
    const horasContratadasDiaValor = horasContratadasDia || 0;

    // Buscar tempo estimado total já existente no período do cache (calculado no useEffect)
    const tempoEstimadoTotalNoPeriodo = tempoEstimadoTotalPorResponsavel[String(responsavelId)] || 0;

    // Calcular tempo contratado total (horas contratadas por dia × dias no período)
    // Para PJ, usar estimado como contratado; caso contrário, calcular normalmente
    const tempoContratadoTotal = isPJ
      ? tempoEstimado
      : horasContratadasDiaValor * diasNoPeriodo * 3600000; // converter horas para milissegundos

    // Calcular tempo disponível: contratadas - estimado
    const tempoDisponivelTotal = isPJ
      ? tempoEstimado
      : Math.max(0, tempoContratadoTotal - tempoEstimado);

    const tempoSobrando = Math.max(0, tempoDisponivelTotal - tempoEstimado);

    // Buscar tempo realizado do cache
    // Garantir que responsavelId seja string para consistência com a chave criada no useEffect
    const chaveTempoRealizado = `responsavel_${String(responsavelId)}`;
    const tempoRealizadoData = temposRealizadosPorEntidade[chaveTempoRealizado] || { realizado: 0, pendente: 0 };
    const tempoRealizado = typeof tempoRealizadoData === 'number' ? tempoRealizadoData : (tempoRealizadoData.realizado || 0);
    const tempoPendente = typeof tempoRealizadoData === 'number' ? 0 : (tempoRealizadoData.pendente || 0);

    return {
      disponivel: tempoDisponivelTotal,
      estimado: tempoEstimado,
      realizado: tempoRealizado,
      pendente: tempoPendente,
      sobrando: tempoSobrando,
      contratado: tempoContratadoTotal
    };
  };

  // Função para buscar tempo realizado total de uma entidade (responsável, produto, tarefa, cliente)
  const buscarTempoRealizadoPorEntidade = useCallback(async (entidadeId, filtroPrincipal, periodoInicio, periodoFim, filtrosAdicionais = {}) => {
    try {
      if (!periodoInicio || !periodoFim) {
        return { realizado: 0, pendente: 0 };
      }

      // Se o filtro principal é responsavel, usar novo endpoint simplificado
      if (filtroPrincipal === 'responsavel') {
        try {
          const response = await fetch('/api/registro-tempo/realizado-total', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              responsavel_id: entidadeId,
              data_inicio: periodoInicio,
              data_fim: periodoFim,
              tarefa_id: filtrosAdicionais.tarefa_id || null,
              cliente_id: filtrosAdicionais.cliente_id || null,
              produto_id: filtrosAdicionais.produto_id || null
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              return {
                realizado: result.data.tempo_realizado_ms || 0,
                pendente: result.data.tempo_pendente_ms || 0
              };
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro ao buscar tempo realizado total:', response.status, errorData);
          }
          return { realizado: 0, pendente: 0 };
        } catch (error) {
          console.error('Erro ao buscar tempo realizado total:', error);
          return { realizado: 0, pendente: 0 };
        }
      }

      // Para outros filtros principais, usar lógica existente
      // O endpoint requer responsavel_id e período obrigatórios
      // Precisamos buscar todos os responsáveis relacionados aos registros agrupados
      let responsavelIds = [];

      // Para outros filtros, buscar responsáveis relacionados aos registros agrupados
      const agrupamentosFiltrados = registrosAgrupados.filter(agr => {
        const primeiroRegistro = agr.primeiroRegistro;
        if (filtroPrincipal === 'cliente') {
          const clienteIds = String(primeiroRegistro.cliente_id || '').split(',').map(id => id.trim());
          return clienteIds.includes(String(entidadeId));
        } else if (filtroPrincipal === 'produto') {
          return String(primeiroRegistro.produto_id) === String(entidadeId);
        } else if (filtroPrincipal === 'atividade') {
          return String(primeiroRegistro.tarefa_id) === String(entidadeId);
        }
        return false;
      });

      // Extrair responsáveis únicos
      responsavelIds = [...new Set(agrupamentosFiltrados.map(agr => agr.primeiroRegistro.responsavel_id).filter(Boolean))];

      if (responsavelIds.length === 0) {
        return { realizado: 0, pendente: 0 };
      }

      // Buscar tempo realizado para todos os responsáveis DE UMA SÓ VEZ
      try {
        const response = await fetch('/api/registro-tempo/realizado-total', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            responsavel_id: responsavelIds, // Array de IDs
            data_inicio: periodoInicio,
            data_fim: periodoFim,
            tarefa_id: filtrosAdicionais.tarefa_id || (filtroPrincipal === 'atividade' ? entidadeId : null),
            cliente_id: filtrosAdicionais.cliente_id || (filtroPrincipal === 'cliente' ? entidadeId : null),
            produto_id: filtrosAdicionais.produto_id || (filtroPrincipal === 'produto' ? entidadeId : null)
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            return {
              realizado: result.data.tempo_realizado_ms || 0,
              pendente: result.data.tempo_pendente_ms || 0
            };
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Erro ao buscar tempo realizado total (batch):', response.status, errorData);
        }
        return { realizado: 0, pendente: 0 };
      } catch (error) {
        console.error('Erro ao buscar tempo realizado total (batch):', error);
        return { realizado: 0, pendente: 0 };
      }

    } catch (error) {
      console.error('Erro ao buscar tempo realizado:', error);
      return { realizado: 0, pendente: 0 };
    }
  }, [registrosAgrupados]);

  // Componente de barra de progresso de tempo
  const BarraProgressoTempo = ({ disponivel, estimado, realizado, pendente = 0, sobrando, responsavelId, mostrarContratadasDisponivel = true, contratado = 0 }) => {
    // Verificar se Contratadas ainda está carregando (null ou undefined = ainda não carregado)
    const aindaCarregandoContratado = mostrarContratadasDisponivel && (contratado === null || contratado === undefined);

    // Permitir exibir mesmo quando disponivel for 0 (sem vigência)
    const disponivelValor = disponivel || 0;
    const contratadoValor = contratado !== null && contratado !== undefined ? contratado : 0;

    // Calcular tempo excedido (quando estimado > contratado)
    const tempoExcedido = mostrarContratadasDisponivel && !aindaCarregandoContratado && estimado > contratadoValor ? estimado - contratadoValor : 0;

    // Se não deve mostrar contratadas/disponível, usar o estimado como 100%
    const totalParaBarra = mostrarContratadasDisponivel ? contratadoValor : (estimado || 1);
    const percentualEstimado = totalParaBarra > 0 ? (estimado / totalParaBarra) * 100 : 0;
    const custoEstimado = calcularCustoPorTempo(estimado, responsavelId);

    // Usar tempo realizado passado como prop
    const tempoRealizadoValor = realizado || 0;
    const tempoPendenteValor = pendente || 0;

    // Custos
    const custoRealizado = responsavelId ? calcularCustoPorTempo(tempoRealizadoValor, responsavelId) : null;
    const custoPendente = responsavelId ? calcularCustoPorTempo(tempoPendenteValor, responsavelId) : null;

    // Se Contratadas ainda está carregando, não renderizar Estimado ainda (aguardar ambos estarem prontos)
    if (aindaCarregandoContratado) {
      return (
        <div className="barra-progresso-tempo">
          <div className="barra-progresso-tempo-range"></div>
          <div className="barra-progresso-tempo-legenda">
            <div className="barra-progresso-tempo-item">
              <div className="barra-progresso-tempo-item-content">
                <span className="barra-progresso-tempo-label">Carregando...</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="barra-progresso-tempo">
        <div className="barra-progresso-tempo-range">
          <div
            className="barra-progresso-tempo-fill estimado"
            style={{ width: `${Math.min(100, percentualEstimado)}%` }}
          ></div>
        </div>
        <div className="barra-progresso-tempo-legenda">
          <div className="barra-progresso-tempo-item">
            <div className="barra-progresso-tempo-item-content">
              <div className="barra-progresso-tempo-item-header">
                <i className="fas fa-clock painel-colaborador-estimado-icon-inline"></i>
                <span className="barra-progresso-tempo-label">Estimado</span>
              </div>
              <div className="barra-progresso-tempo-badge-wrapper">
                <span className={`barra-progresso-tempo-badge estimado ${tempoExcedido > 0 ? 'excedido' : ''}`}>
                  <span className="barra-progresso-tempo-badge-tempo">{formatarTempoEstimado(estimado, true)}</span>
                  {tempoExcedido > 0 && (
                    <span className="barra-progresso-tempo-excedido" title={`Excedeu ${formatarTempoEstimado(tempoExcedido, true)} do tempo contratado`}>
                      (+{formatarTempoEstimado(tempoExcedido, true)})
                    </span>
                  )}
                </span>
                <span className={`barra-progresso-tempo-custo estimado ${custoEstimado === null ? 'barra-progresso-tempo-custo-placeholder' : ''}`}>
                  {custoEstimado !== null ? formatarValorMonetario(custoEstimado) : '\u00A0'}
                </span>
              </div>
            </div>
          </div>

          <div className="barra-progresso-tempo-item">
            <div className="barra-progresso-tempo-item-content">
              <div className="barra-progresso-tempo-item-header">
                <i className="fas fa-play-circle painel-colaborador-realizado-icon-inline"></i>
                <span className="barra-progresso-tempo-label">Realizado</span>
              </div>
              <div className="barra-progresso-tempo-badge-wrapper">
                <span className="barra-progresso-tempo-badge realizado">
                  <span className="barra-progresso-tempo-badge-tempo">{formatarTempoEstimado(tempoRealizadoValor, true)}</span>
                </span>
                <span className={`barra-progresso-tempo-custo realizado ${custoRealizado === null ? 'barra-progresso-tempo-custo-placeholder' : ''}`}>
                  {custoRealizado !== null ? formatarValorMonetario(custoRealizado) : '\u00A0'}
                </span>
              </div>
            </div>
          </div>

          {tempoPendenteValor > 0 && (
            <div className="barra-progresso-tempo-item">
              <div className="barra-progresso-tempo-item-content">
                <div className="barra-progresso-tempo-item-header">
                  <i className="fas fa-stopwatch painel-colaborador-pendente-icon-inline" style={{ color: '#ef4444' }}></i>
                  <span className="barra-progresso-tempo-label">Pendente</span>
                </div>
                <div className="barra-progresso-tempo-badge-wrapper">
                  <span className="barra-progresso-tempo-badge pendente" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                    <span className="barra-progresso-tempo-badge-tempo">{formatarTempoEstimado(tempoPendenteValor, true)}</span>
                  </span>
                  <span className={`barra-progresso-tempo-custo pendente ${custoPendente === null ? 'barra-progresso-tempo-custo-placeholder' : ''}`}>
                    {custoPendente !== null ? formatarValorMonetario(custoPendente) : '\u00A0'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {mostrarContratadasDisponivel && (
            <>
              <div className="barra-progresso-tempo-item">
                <div className="barra-progresso-tempo-item-content">
                  <span className="barra-progresso-tempo-label">Contratadas</span>
                  <span className="barra-progresso-tempo-badge contratadas">{formatarTempoEstimado(contratadoValor, true)}</span>
                </div>
              </div>
              <div className="barra-progresso-tempo-item">
                <div className="barra-progresso-tempo-item-content">
                  <div className="barra-progresso-tempo-item-header">
                    <span className="barra-progresso-tempo-indicador sobrando"></span>
                    <span className="barra-progresso-tempo-label">Disponível</span>
                  </div>
                  <span className="barra-progresso-tempo-badge disponivel">{formatarTempoEstimado(disponivelValor, true)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Soma o tempo estimado real de um agrupamento (usando todos os registros)
  const calcularTempoEstimadoTotalAgrupamento = (agrupamento) => {
    if (!agrupamento || !agrupamento.registros) return 0;
    const registrosFiltrados =
      periodoInicio && periodoFim
        ? agrupamento.registros.filter((registro) => dataEstaNoPeriodo(registro.data))
        : agrupamento.registros;
    return registrosFiltrados.reduce(
      (acc, reg) => acc + (reg.tempo_estimado_dia || agrupamento.primeiroRegistro?.tempo_estimado_dia || 0),
      0
    );
  };


  // Calcular tempo total estimado de um grupo (para cabeçalho/legenda)
  const calcularTempoTotalGrupo = (agrupamentos) => {
    return agrupamentos.reduce(
      (acc, agrupamento) => acc + calcularTempoEstimadoTotalAgrupamento(agrupamento),
      0
    );
  };

  // Calcular tempo total filtrado de um grupo (apenas registros dentro do período)
  const calcularTempoTotalGrupoFiltrado = (agrupamentos) => {
    if (!periodoInicio || !periodoFim) {
      return calcularTempoTotalGrupo(agrupamentos);
    }
    return agrupamentos.reduce(
      (acc, agrupamento) => acc + calcularTempoEstimadoTotalAgrupamento(agrupamento),
      0
    );
  };


  // Toggle grupo expandido
  const toggleGrupo = (grupoKey) => {
    setGruposExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(grupoKey)) {
        novo.delete(grupoKey);
      } else {
        novo.add(grupoKey);
      }
      return novo;
    });
  };

  // Toggle tarefa expandida
  const toggleTarefa = (agrupadorId, tarefaId) => {
    const tarefaKey = `${agrupadorId}_${tarefaId}`;
    setTarefasExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(tarefaKey)) {
        novo.delete(tarefaKey);
      } else {
        novo.add(tarefaKey);
      }
      return novo;
    });
  };

  // Toggle para expandir tarefas quando filtro pai é "atividade"
  const toggleAgrupamentoTarefas = (agrupadorId) => {
    setAgrupamentosTarefasExpandidas(prev => {
      const novo = new Set(prev);
      if (novo.has(agrupadorId)) {
        novo.delete(agrupadorId);
      } else {
        novo.add(agrupadorId);
      }
      return novo;
    });
  };

  // Deletar agrupamento
  const handleDelete = async () => {
    if (!agrupamentoParaDeletar) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tempo-estimado/agrupador/${agrupamentoParaDeletar.agrupador_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || result.message || `Erro HTTP ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        const count = result.count || agrupamentoParaDeletar.quantidade || 0;
        showToast('success', `Atribuição removida com sucesso! ${count} dia(s) removido(s).`);
        setShowDeleteConfirmModal(false);
        setAgrupamentoParaDeletar(null);
        // Recarregar lista
        if (filtrosAplicados) {
          loadRegistrosTempoEstimado(filtros);
        }
      }
    } catch (error) {
      console.error('Erro ao deletar agrupamento:', error);
      showToast('error', 'Erro ao deletar agrupamento');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Limpar filtros
  const limparFiltros = () => {
    const filtrosLimpos = {
      produto: false,
      atividade: false,
      cliente: false,
      responsavel: false
    };
    setFiltros(filtrosLimpos);
    setFiltroPrincipal(null);
    setOrdemFiltros([]);
    setFiltrosAplicados(false);
    setFiltrosUltimosAplicados(null);
    setPeriodoInicio(null);
    setPeriodoFim(null);
    setFiltroClienteSelecionado(null);
    setFiltroProdutoSelecionado(null);
    setFiltroTarefaSelecionado(null);
    setFiltroResponsavelSelecionado(null);

    setFiltroStatusCliente('ativo'); // Resetar para valor padrão
    // Limpar filtros adicionais
    setMostrarFiltrosAdicionais(false);
    setFiltrosAdicionaisAtivos({
      cliente: false,
      tarefa: false,
      produto: false
    });
    setFiltroAdicionalCliente(null);
    setFiltroAdicionalTarefa(null);
    setFiltroAdicionalProduto(null);

    // Limpar opções filtradas
    setOpcoesFiltradasTarefas([]);
    setOpcoesFiltradasProdutos([]);
    setOpcoesFiltradasClientes([]);
    setOpcoesFiltradasResponsaveis([]);

    setRegistrosAgrupados([]);
    setTotalRegistros(0);
    setTotalPages(1);
    setCurrentPage(1);
  };

  // Verificar se há mudanças pendentes nos filtros
  const hasPendingChanges = () => {
    if (!filtrosAplicados || !filtrosUltimosAplicados) {
      // Se não há filtros aplicados, verificar se há algum filtro selecionado
      // Período não conta como mudança pendente se não estiver completo
      // Valores selecionados (filtros "Definir") não contam como mudança pendente
      // pois eles só fazem sentido quando há filtros aplicados
      const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.cliente || filtros.responsavel;
      const temPeriodoCompleto = periodoInicio && periodoFim;
      return temFiltroAtivo || temPeriodoCompleto;
    }

    const filtrosMudaram = (
      filtros.produto !== filtrosUltimosAplicados.produto ||
      filtros.atividade !== filtrosUltimosAplicados.atividade ||
      filtros.cliente !== filtrosUltimosAplicados.cliente ||
      filtros.responsavel !== filtrosUltimosAplicados.responsavel
    );

    const periodoMudou = (
      periodoInicio !== filtrosUltimosAplicados.periodoInicio ||
      periodoFim !== filtrosUltimosAplicados.periodoFim
    );

    // Verificar se o filtro de status de cliente mudou (apenas quando filtro cliente está ativo)
    const statusClienteMudou = filtros.cliente && (
      filtroStatusCliente !== filtrosUltimosAplicados.filtroStatusCliente
    );

    // Valores selecionados (filtros "Definir") não contam como mudança pendente
    // pois eles já atualizam automaticamente os resultados
    // const valoresMudaram = (
    //   JSON.stringify(filtroClienteSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroClienteSelecionado) ||
    //   JSON.stringify(filtroProdutoSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroProdutoSelecionado) ||
    //   JSON.stringify(filtroTarefaSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroTarefaSelecionado) ||
    //   JSON.stringify(filtroResponsavelSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroResponsavelSelecionado)
    // );

    // Apenas filtros principais, período ou status de cliente mudando ativam o botão "Aplicar Filtros"
    return filtrosMudaram || periodoMudou || statusClienteMudou;
  };

  // Handler para mudança de filtro (apenas um filtro por vez nesta página)
  const handleFilterChange = (filtroKey, checked) => {
    if (checked) {
      // Se está marcando um filtro, desmarcar todos os outros
      const novoFiltros = {
        produto: false,
        atividade: false,
        cliente: false,
        responsavel: false,
        [filtroKey]: true
      };
      setFiltros(novoFiltros);
      setOrdemFiltros([filtroKey]);
    } else {
      // Se está desmarcando, apenas desmarcar esse filtro
      const novoFiltros = { ...filtros, [filtroKey]: false };
      setFiltros(novoFiltros);
      setOrdemFiltros(prev => prev.filter(f => f !== filtroKey));
    }
  };

  // Aplicar filtros
  const handleApplyFilters = () => {
    // Validar período (obrigatório) - seguindo a lógica do timetrack
    if (!periodoInicio || !periodoFim) {
      showToast('warning', 'Selecione o período TimeTrack');
      return;
    }

    // Validar se a data de início é anterior ou igual à data de fim
    if (new Date(periodoInicio) > new Date(periodoFim)) {
      showToast('warning', 'A data de início deve ser anterior ou igual à data de fim');
      return;
    }

    const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.cliente || filtros.responsavel;

    if (!temFiltroAtivo) {
      showToast('warning', 'Selecione pelo menos um filtro para aplicar.');
      return;
    }

    // Limpar caches para garantir dados consistentes com os novos filtros
    console.log('🔄 [APLICAR-FILTROS] Limpando caches de horas contratadas e tempo estimado');
    console.log('🔴 [CACHE-LIMPO] setTempoEstimadoTotalPorResponsavel({}) - APLICAR-FILTROS');
    setHorasContratadasPorResponsavel({});
    setTipoContratoPorResponsavel({});
    setTempoEstimadoTotalPorResponsavel({});
    // Marcar dados auxiliares como não carregados para prevenir exibição de dados parciais
    setDadosAuxiliaresCarregados(false);

    // Os filtros detalhados (valores selecionados) não são obrigatórios
    // Se um filtro pai está selecionado mas não há valores selecionados, 
    // o sistema vai trazer todos os registros daquele tipo

    const novoFiltroPrincipal = ordemFiltros.length > 0 ? ordemFiltros[0] : null;
    setFiltroPrincipal(novoFiltroPrincipal);
    setFiltrosAplicados(true);
    setFiltrosUltimosAplicados({
      ...filtros,
      periodoInicio,
      periodoFim,
      habilitarFinaisSemana,
      habilitarFeriados,
      datasIndividuais,
      filtroClienteSelecionado,
      filtroProdutoSelecionado,
      filtroTarefaSelecionado,
      filtroResponsavelSelecionado,
      filtroStatusCliente,
      filtrosAdicionais: {
        cliente: filtroAdicionalCliente,
        tarefa: filtroAdicionalTarefa,
        produto: filtroAdicionalProduto
      }
    });

    setCurrentPage(1);

    // Resetar grupos expandidos quando aplicar novos filtros
    setGruposExpandidos(new Set());
    setTarefasExpandidas(new Set());
    setAgrupamentosTarefasExpandidas(new Set());

    // Passar os valores selecionados diretamente para garantir que sejam usados
    const valoresSelecionados = {
      cliente: filtroClienteSelecionado,
      produto: filtroProdutoSelecionado,
      tarefa: filtroTarefaSelecionado,
      responsavel: filtroResponsavelSelecionado
    };

    // Passar os filtros adicionais
    const filtrosAdicionais = {
      cliente: filtroAdicionalCliente,
      tarefa: filtroAdicionalTarefa,
      produto: filtroAdicionalProduto
    };

    // Passar configuração de período
    const configuracaoPeriodo = {
      inicio: periodoInicio,
      fim: periodoFim
    };

    loadRegistrosTempoEstimado(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);
  };

  // Obter nome do filtro para o tooltip
  const getFiltroNome = (filtroKey) => {
    switch (filtroKey) {
      case 'produto':
        return 'PRODUTO';
      case 'atividade':
        return 'TAREFA';
      case 'cliente':
        return 'CLIENTE';
      case 'responsavel':
        return 'RESPONSÁVEL';
      default:
        return '';
    }
  };

  // Obter o filtro pai atual
  const getFiltroPaiAtual = () => {
    if (filtrosAplicados && filtroPrincipal) {
      return filtroPrincipal;
    }
    if (ordemFiltros.length > 0) {
      return ordemFiltros[0];
    }
    return null;
  };

  // Verificar se um filtro deve ter o contorno laranja
  const isFiltroPai = (filtroKey) => {
    const filtroPaiAtual = getFiltroPaiAtual();
    if (filtroPaiAtual) {
      return filtroPaiAtual === filtroKey;
    }
    if (filtroHover === filtroKey) {
      return true;
    }
    return false;
  };

  // Recarregar dados quando página ou itens por página mudarem (apenas se filtros já foram aplicados)
  useEffect(() => {
    if (filtrosAplicados && periodoInicio && periodoFim && filtrosUltimosAplicados) {
      // Preparar valores selecionados para passar para a função
      const valoresSelecionados = {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        responsavel: filtroResponsavelSelecionado
      };

      // Preparar filtros adicionais
      const filtrosAdicionais = {
        cliente: filtroAdicionalCliente,
        tarefa: filtroAdicionalTarefa,
        produto: filtroAdicionalProduto
      };

      // Preparar configuração de período
      const configuracaoPeriodo = {
        inicio: periodoInicio,
        fim: periodoFim
      };

      // Recarregar com todos os parâmetros corretos
      console.log('🔄 [PAGINAÇÃO] Recarregando dados com filtros aplicados (página:', currentPage, ', itens:', itemsPerPage, ')');
      loadRegistrosTempoEstimado(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  // Resetar estado quando filtros forem desaplicados
  useEffect(() => {
    if (!filtrosAplicados) {
      setRegistrosAgrupados([]);
      setTotalRegistros(0);
      setTotalPages(1);
      setGruposExpandidos(new Set());
    }
  }, [filtrosAplicados]);

  // Atualizar automaticamente a listagem quando os filtros "Definir" mudarem
  useEffect(() => {
    // Só atualizar se houver filtros aplicados e período definido
    if (filtrosAplicados && periodoInicio && periodoFim && filtrosUltimosAplicados) {
      // Preparar valores selecionados para passar para a função
      const valoresSelecionados = {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        responsavel: filtroResponsavelSelecionado
      };

      // Preparar filtros adicionais
      const filtrosAdicionais = {
        cliente: filtroAdicionalCliente,
        tarefa: filtroAdicionalTarefa,
        produto: filtroAdicionalProduto
      };

      // Preparar configuração de período
      const configuracaoPeriodo = {
        inicio: periodoInicio,
        fim: periodoFim
      };

      // Limpar caches quando filtros detalhados mudarem para garantir consistência
      console.log('🔄 [FILTROS-DETALHADOS] Filtros detalhados mudaram, limpando caches e recarregando dados');
      console.log('🔴 [CACHE-LIMPO] setTempoEstimadoTotalPorResponsavel({}) - FILTROS-DETALHADOS');
      setHorasContratadasPorResponsavel({});
      setTipoContratoPorResponsavel({});
      setTempoEstimadoTotalPorResponsavel({});
      // Marcar dados auxiliares como não carregados para prevenir exibição de dados parciais
      setDadosAuxiliaresCarregados(false);

      // Recarregar registros com os novos valores selecionados e filtros adicionais
      loadRegistrosTempoEstimado(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);

      // Atualizar filtrosUltimosAplicados para refletir os novos valores selecionados
      // (sem ativar o botão "Aplicar Filtros")
      setFiltrosUltimosAplicados({
        ...filtrosUltimosAplicados,
        filtroClienteSelecionado,
        filtroProdutoSelecionado,
        filtroTarefaSelecionado,
        filtroResponsavelSelecionado,
        filtroStatusCliente,
        filtrosAdicionais
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroClienteSelecionado, filtroProdutoSelecionado, filtroTarefaSelecionado, filtroResponsavelSelecionado, filtroAdicionalCliente, filtroAdicionalTarefa, filtroAdicionalProduto]);

  // Buscar tempos realizados quando os dados são carregados
  useEffect(() => {
    if (!filtrosAplicados || !filtrosUltimosAplicados || !periodoInicio || !periodoFim || !filtroPrincipal) {
      setTemposRealizadosPorEntidade({});
      return;
    }

    // Para filtro responsavel, precisamos de membros carregados
    if (filtroPrincipal === 'responsavel' && (!membros || membros.length === 0)) {
      setTemposRealizadosPorEntidade({});
      return;
    }

    // Para outros filtros, precisamos de registros agrupados
    if (filtroPrincipal !== 'responsavel' && registrosAgrupados.length === 0) {
      setTemposRealizadosPorEntidade({});
      return;
    }

    const buscarTemposRealizados = async () => {
      const novosTempos = {};
      const periodoAplicadoInicio = filtrosUltimosAplicados.periodoInicio;
      const periodoAplicadoFim = filtrosUltimosAplicados.periodoFim;

      // Função auxiliar para verificar se um ID está nos filtros selecionados
      const estaNosFiltrosSelecionados = (id, filtroSelecionado) => {
        if (!filtroSelecionado) return true; // Se não há filtro, incluir todos
        const idStr = String(id);
        if (Array.isArray(filtroSelecionado)) {
          return filtroSelecionado.some(f => String(f) === idStr);
        }
        return String(filtroSelecionado) === idStr;
      };

      // Coletar todas as entidades únicas baseadas no filtro principal
      const entidadesUnicas = new Map();

      // Se filtro principal é responsavel, incluir TODOS os membros que aparecem nos cards
      if (filtroPrincipal === 'responsavel') {
        membros.forEach(membro => {
          // Aplicar mesmos filtros usados na renderização dos cards
          if (!estaNosFiltrosSelecionados(membro.id, filtroResponsavelSelecionado)) {
            return; // Pular este membro se não estiver nos filtros
          }

          const membroId = String(membro.id);
          entidadesUnicas.set(`responsavel_${membroId}`, { tipo: 'responsavel', id: membroId });
        });
      } else {
        // Para outros filtros, usar lógica existente baseada em registrosAgrupados
        registrosAgrupados.forEach(agr => {
          const primeiroRegistro = agr.primeiroRegistro;

          let entidadeId = null;
          if (filtroPrincipal === 'cliente' && primeiroRegistro.cliente_id) {
            const clienteIds = String(primeiroRegistro.cliente_id || '').split(',').map(id => id.trim());
            clienteIds.forEach(id => {
              if (id) entidadesUnicas.set(`cliente_${id}`, { tipo: 'cliente', id: id });
            });
            return;
          } else if (filtroPrincipal === 'produto' && primeiroRegistro.produto_id) {
            entidadeId = primeiroRegistro.produto_id;
          } else if (filtroPrincipal === 'atividade' && primeiroRegistro.tarefa_id) {
            entidadeId = primeiroRegistro.tarefa_id;
          }

          if (entidadeId) {
            entidadesUnicas.set(`${filtroPrincipal}_${entidadeId}`, { tipo: filtroPrincipal, id: entidadeId });
          }
        });
      }

      // Preparar filtros adicionais
      const filtrosAdicionais = {
        tarefa_id: filtroAdicionalTarefa || null,
        cliente_id: filtroAdicionalCliente || null,
        produto_id: filtroAdicionalProduto || null
      };

      // Buscar tempo realizado para cada entidade
      const promises = Array.from(entidadesUnicas.values()).map(async ({ tipo, id }) => {
        const chave = `${tipo}_${id}`;
        const tempoRealizado = await buscarTempoRealizadoPorEntidade(
          id,
          tipo,
          periodoAplicadoInicio,
          periodoAplicadoFim,
          filtrosAdicionais
        );
        return { chave, tempoRealizado };
      });

      const resultados = await Promise.all(promises);
      resultados.forEach(({ chave, tempoRealizado }) => {
        novosTempos[chave] = tempoRealizado;
      });

      setTemposRealizadosPorEntidade(novosTempos);
    };

    buscarTemposRealizados();
  }, [filtrosAplicados, filtrosUltimosAplicados, periodoInicio, periodoFim, registrosAgrupados, filtroPrincipal, filtroAdicionalTarefa, filtroAdicionalCliente, filtroAdicionalProduto, buscarTempoRealizadoPorEntidade, membros, filtroResponsavelSelecionado]);

  // Recarregar opções filtradas quando filtros principais, adicionais ou período mudarem (mesmo sem aplicar)
  useEffect(() => {
    if (periodoInicio && periodoFim) {
      // Recarregar opções filtradas para TODOS os filtros ativos (pai e adicionais)
      const recarregarOpcoes = async () => {
        // Recarregar filtros adicionais
        if (filtrosAdicionaisAtivos.tarefa) {
          const opcoes = await buscarOpcoesFiltroContextual('tarefa');
          setOpcoesFiltradasTarefas(opcoes);
        }
        if (filtrosAdicionaisAtivos.produto) {
          const opcoes = await buscarOpcoesFiltroContextual('produto');
          setOpcoesFiltradasProdutos(opcoes);
        }
        if (filtrosAdicionaisAtivos.cliente) {
          const opcoes = await buscarOpcoesFiltroContextual('cliente');
          setOpcoesFiltradasClientes(opcoes);
        }

        // Recarregar filtros pai se houver filtros adicionais ativos
        const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
        const temFiltrosAdicionais = filtrosAdicionaisAtivos.cliente || filtrosAdicionaisAtivos.tarefa || filtrosAdicionaisAtivos.produto;

        if (temFiltrosAdicionais && filtroPaiAtual) {
          if (filtroPaiAtual === 'responsavel' || filtros.responsavel) {
            const opcoes = await buscarOpcoesFiltroContextual('responsavel');
            setOpcoesFiltradasResponsaveis(opcoes);
          }
          if (filtroPaiAtual === 'cliente' || filtros.cliente) {
            const opcoes = await buscarOpcoesFiltroContextual('cliente');
            setOpcoesFiltradasClientes(opcoes);
          }
          if (filtroPaiAtual === 'produto' || filtros.produto) {
            const opcoes = await buscarOpcoesFiltroContextual('produto');
            setOpcoesFiltradasProdutos(opcoes);
          }
          if (filtroPaiAtual === 'atividade' || filtros.atividade) {
            const opcoes = await buscarOpcoesFiltroContextual('tarefa');
            setOpcoesFiltradasTarefas(opcoes);
          }
        } else if (!temFiltrosAdicionais) {
          // Se não há filtros adicionais, limpar opções filtradas dos filtros pai
          setOpcoesFiltradasResponsaveis([]);
          setOpcoesFiltradasClientes([]);
          setOpcoesFiltradasProdutos([]);
          setOpcoesFiltradasTarefas([]);
        }
      };
      recarregarOpcoes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    periodoInicio,
    periodoFim,
    filtroPrincipal,
    ordemFiltros,
    filtroClienteSelecionado,
    filtroProdutoSelecionado,
    filtroTarefaSelecionado,
    filtroResponsavelSelecionado,
    filtrosAdicionaisAtivos,
    filtroAdicionalCliente,
    filtroAdicionalTarefa,
    filtroAdicionalProduto
  ]);

  // Resetar grupos expandidos quando os registros são recarregados
  // Isso é feito diretamente na função loadRegistrosTempoEstimado e handleApplyFilters

  // Calcular range de itens exibidos
  const startItem = totalRegistros === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, registrosAgrupados.length) - 1, totalRegistros);

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
                  onClick={() => navigate('/atribuir-responsaveis/historico')}
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

            {/* Filtros usando FiltersCard */}
            <FiltersCard
              onApply={handleApplyFilters}
              onClear={limparFiltros}
              showActions={true}
              loading={loading}
              hasPendingChanges={hasPendingChanges()}
              showInfoMessage={true}
            >
              {/* Primeira linha: Apenas os filtros FilterVinculacao */}
              <div className="filtros-vinculacao-row">
                <FilterVinculacao
                  filtroKey="produto"
                  checked={filtros.produto}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('produto')}
                  title="Produto"
                  subtitle="Filtrar por"
                  icon="fas fa-box"
                  filtroNome={getFiltroNome('produto')}
                  onMouseEnter={() => setFiltroHover('produto')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                <FilterVinculacao
                  filtroKey="atividade"
                  checked={filtros.atividade}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('atividade')}
                  title="Tarefa"
                  subtitle="Filtrar por"
                  icon="fas fa-list"
                  filtroNome={getFiltroNome('atividade')}
                  onMouseEnter={() => setFiltroHover('atividade')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                <FilterVinculacao
                  filtroKey="cliente"
                  checked={filtros.cliente}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('cliente')}
                  title="Cliente"
                  subtitle="Filtrar por"
                  icon="fas fa-briefcase"
                  filtroNome={getFiltroNome('cliente')}
                  onMouseEnter={() => setFiltroHover('cliente')}
                  onMouseLeave={() => setFiltroHover(null)}
                />
                <FilterVinculacao
                  filtroKey="responsavel"
                  checked={filtros.responsavel}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('responsavel')}
                  title="Responsável"
                  subtitle="Filtrar por"
                  icon="fas fa-user-tie"
                  filtroNome={getFiltroNome('responsavel')}
                  onMouseEnter={() => setFiltroHover('responsavel')}
                  onMouseLeave={() => setFiltroHover(null)}
                />

              </div>

              {/* Segunda linha: FilterPeriodo e campos "Definir X" */}
              <div className="filtros-detalhados-row">
                <div className="filtro-periodo-wrapper">
                  <label className="filtro-pai-label">Definir Período:</label>
                  <FilterPeriodo
                    dataInicio={periodoInicio}
                    dataFim={periodoFim}
                    onInicioChange={(e) => setPeriodoInicio(e.target.value || null)}
                    onFimChange={(e) => setPeriodoFim(e.target.value || null)}
                    disabled={loading}
                    showWeekendToggle={true}
                    onWeekendToggleChange={setHabilitarFinaisSemana}
                    showHolidayToggle={true}
                    onHolidayToggleChange={setHabilitarFeriados}
                    datasIndividuais={datasIndividuais}
                    onDatasIndividuaisChange={setDatasIndividuais}
                  />
                </div>

                {/* Componentes de seleção para filtros pai */}
                {filtros.cliente && (
                  <>
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Definir Clientes:</label>
                      <FilterClientes
                        value={filtroClienteSelecionado}
                        onChange={(e) => setFiltroClienteSelecionado(e.target.value || null)}
                        options={opcoesFiltradasClientes.length > 0 ? opcoesFiltradasClientes : clientes}
                        disabled={loading || carregandoOpcoesFiltradas.cliente}
                      />
                    </div>
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Status:</label>
                      <select
                        value={filtroStatusCliente}
                        onChange={(e) => setFiltroStatusCliente(e.target.value)}
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
                        disabled={loading}
                      >
                        <option value="todos">Todos</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                  </>
                )}

                {filtros.produto && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Produtos:</label>
                    <FilterGeneric
                      value={filtroProdutoSelecionado}
                      onChange={(e) => setFiltroProdutoSelecionado(e.target.value || null)}
                      options={opcoesFiltradasProdutos.length > 0 ? opcoesFiltradasProdutos : produtos.map(p => ({ id: p.id, nome: p.nome }))}
                      disabled={loading || carregandoOpcoesFiltradas.produto || (opcoesFiltradasProdutos.length === 0 && produtos.length === 0)}
                      placeholder={carregandoOpcoesFiltradas.produto ? "Carregando..." : "Selecionar produtos"}
                    />
                  </div>
                )}

                {filtros.atividade && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Tarefas:</label>
                    <FilterGeneric
                      value={filtroTarefaSelecionado}
                      onChange={(e) => setFiltroTarefaSelecionado(e.target.value || null)}
                      options={opcoesFiltradasTarefas.length > 0 ? opcoesFiltradasTarefas : tarefas.map(t => ({ id: t.id, nome: t.nome }))}
                      disabled={loading || carregandoOpcoesFiltradas.tarefa || (opcoesFiltradasTarefas.length === 0 && tarefas.length === 0)}
                      placeholder={carregandoOpcoesFiltradas.tarefa ? "Carregando..." : "Selecionar tarefas"}
                    />
                  </div>
                )}

                {filtros.responsavel && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Responsáveis:</label>
                    <FilterMembro
                      value={filtroResponsavelSelecionado}
                      onChange={(e) => {
                        const newValue = e.target.value || null;
                        setFiltroResponsavelSelecionado(newValue);
                      }}
                      options={opcoesFiltradasResponsaveis.length > 0 ? opcoesFiltradasResponsaveis : membros}
                      disabled={loading || carregandoOpcoesFiltradas.responsavel || (opcoesFiltradasResponsaveis.length === 0 && membros.length === 0)}
                    />
                  </div>
                )}

              </div>

              {/* Terceira linha: Botão "Adicionar filtros" e componentes de seleção para filtros adicionais */}
              {(filtroPrincipal || ordemFiltros.length > 0) && (
                <div className="filtros-adicionais-row">
                  <div className="filtro-adicionar-wrapper">
                    <label className="filtro-pai-label">Adicionar filtros:</label>
                    <button
                      type="button"
                      className="btn-adicionar-filtros"
                      onClick={() => setMostrarFiltrosAdicionais(!mostrarFiltrosAdicionais)}
                      disabled={loading}
                    >
                      <i className="fas fa-plus"></i>
                      Adicionar filtros
                      <i className={`fas fa-chevron-${mostrarFiltrosAdicionais ? 'up' : 'down'}`} style={{ marginLeft: '8px' }}></i>
                    </button>

                    <FiltrosAdicionaisDropdown
                      isOpen={mostrarFiltrosAdicionais}
                      onClose={() => setMostrarFiltrosAdicionais(false)}
                      filtroPrincipal={filtroPrincipal}
                      ordemFiltros={ordemFiltros}
                      filtrosAdicionaisAtivos={filtrosAdicionaisAtivos}
                      onToggleFiltro={async (tipoFiltro, checked) => {
                        if (tipoFiltro === 'cliente') {
                          setFiltrosAdicionaisAtivos(prev => ({
                            ...prev,
                            cliente: checked
                          }));
                          if (!checked) {
                            setFiltroAdicionalCliente(null);
                            setOpcoesFiltradasClientes([]);
                          }
                        } else if (tipoFiltro === 'tarefa') {
                          setFiltrosAdicionaisAtivos(prev => ({
                            ...prev,
                            tarefa: checked
                          }));
                          if (!checked) {
                            setFiltroAdicionalTarefa(null);
                            setOpcoesFiltradasTarefas([]);
                          }
                        } else if (tipoFiltro === 'produto') {
                          setFiltrosAdicionaisAtivos(prev => ({
                            ...prev,
                            produto: checked
                          }));
                          if (!checked) {
                            setFiltroAdicionalProduto(null);
                            setOpcoesFiltradasProdutos([]);
                          }
                        }
                      }}
                      periodoInicio={periodoInicio}
                      periodoFim={periodoFim}
                      onBuscarOpcoes={async (tipoFiltro) => {
                        const opcoes = await buscarOpcoesFiltroContextual(tipoFiltro);
                        if (tipoFiltro === 'cliente') {
                          setOpcoesFiltradasClientes(opcoes);
                        } else if (tipoFiltro === 'tarefa') {
                          setOpcoesFiltradasTarefas(opcoes);
                        } else if (tipoFiltro === 'produto') {
                          setOpcoesFiltradasProdutos(opcoes);
                        }
                        return opcoes;
                      }}
                      loading={loading}
                    />
                  </div>

                  {/* Componentes de seleção para filtros adicionais (ao lado do botão) */}
                  {filtrosAdicionaisAtivos.cliente && (
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Definir Clientes:</label>
                      <FilterClientes
                        value={filtroAdicionalCliente}
                        onChange={(e) => setFiltroAdicionalCliente(e.target.value || null)}
                        options={opcoesFiltradasClientes.length > 0 ? opcoesFiltradasClientes : clientes}
                        disabled={loading || carregandoOpcoesFiltradas.cliente}
                      />
                    </div>
                  )}

                  {filtrosAdicionaisAtivos.tarefa && (
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Definir Tarefas:</label>
                      <FilterGeneric
                        value={filtroAdicionalTarefa}
                        onChange={(e) => setFiltroAdicionalTarefa(e.target.value || null)}
                        options={opcoesFiltradasTarefas.length > 0 ? opcoesFiltradasTarefas : tarefas.map(t => ({ id: t.id, nome: t.nome }))}
                        disabled={loading || carregandoOpcoesFiltradas.tarefa || (opcoesFiltradasTarefas.length === 0 && tarefas.length === 0)}
                        placeholder={carregandoOpcoesFiltradas.tarefa ? "Carregando..." : "Selecionar tarefas"}
                      />
                    </div>
                  )}

                  {filtrosAdicionaisAtivos.produto && (
                    <div className="filtro-pai-select-wrapper">
                      <label className="filtro-pai-label">Definir Produtos:</label>
                      <FilterGeneric
                        value={filtroAdicionalProduto}
                        onChange={(e) => setFiltroAdicionalProduto(e.target.value || null)}
                        options={opcoesFiltradasProdutos.length > 0 ? opcoesFiltradasProdutos : produtos.map(p => ({ id: p.id, nome: p.nome }))}
                        disabled={loading || carregandoOpcoesFiltradas.produto || (opcoesFiltradasProdutos.length === 0 && produtos.length === 0)}
                        placeholder={carregandoOpcoesFiltradas.produto ? "Carregando..." : "Selecionar produtos"}
                      />
                    </div>
                  )}

                </div>
              )}
            </FiltersCard>

            {/* Lista de atribuições */}
            {!filtrosAplicados ? (
              <SemResultadosFiltros
                filtrosAplicados={false}
              />
            ) : loading ? (
              <div className="loading-container">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Carregando atribuições...</span>
              </div>
            ) : registrosAgrupados.length === 0 ? (
              <SemResultadosFiltros
                mensagem="Nenhuma atribuição encontrada com os filtros selecionados."
                filtrosAplicados={true}
              />
            ) : (
              <div className="atribuicoes-list-container">
                {/* Seção de tempo disponível vs estimado - dinâmica baseada no filtro pai */}
                {/* IMPORTANTE: Só exibir dashboards quando dados auxiliares (horas contratadas, tempo estimado total) estiverem 100% carregados */}
                {/* Isso previne exibição de valores parciais (ex: 40h em vez de 100h) */}
                {filtrosAplicados && filtrosUltimosAplicados && filtrosUltimosAplicados.periodoInicio && filtrosUltimosAplicados.periodoFim && registrosAgrupados.length > 0 && filtroPrincipal && dadosAuxiliaresCarregados && (
                  <div className="tempo-disponivel-section">
                    <h3 className="tempo-disponivel-title">
                      <i className="fas fa-chart-line" style={{ marginRight: '8px' }}></i>
                      {filtroPrincipal === 'responsavel'
                        ? `Tempo Disponível vs Estimado por Responsável`
                        : `Tempo Estimado vs Realizado por ${filtroPrincipal === 'cliente' ? 'Cliente' : filtroPrincipal === 'produto' ? 'Produto' : 'Atividade'}`
                      }
                    </h3>
                    <div className="tempo-disponivel-grid">
                      {(() => {
                        // Usar os valores aplicados do período, não os valores atuais do estado
                        const periodoAplicadoInicio = filtrosUltimosAplicados.periodoInicio;
                        const periodoAplicadoFim = filtrosUltimosAplicados.periodoFim;

                        // Obter filtros adicionais aplicados
                        const filtrosAdicionaisAplicados = filtrosUltimosAplicados.filtrosAdicionais || {};
                        const filtroAdicionalClienteAplicado = filtrosAdicionaisAplicados.cliente || filtroAdicionalCliente;
                        const filtroAdicionalTarefaAplicado = filtrosAdicionaisAplicados.tarefa || filtroAdicionalTarefa;
                        const filtroAdicionalProdutoAplicado = filtrosAdicionaisAplicados.produto || filtroAdicionalProduto;

                        // Usar valores aplicados dos toggles (ou false como padrão se não foram aplicados)
                        const habilitarFinaisSemanaAplicadoJSX = filtrosUltimosAplicados?.habilitarFinaisSemana ?? false;
                        const habilitarFeriadosAplicadoJSX = filtrosUltimosAplicados?.habilitarFeriados ?? false;
                        const datasIndividuaisAplicadoJSX = filtrosUltimosAplicados?.datasIndividuais ?? [];

                        // Obter conjunto de datas válidas (considerando opções e datas individuais)
                        const datasValidasJSX = obterDatasValidasNoPeriodo(
                          periodoAplicadoInicio,
                          periodoAplicadoFim,
                          habilitarFinaisSemanaAplicadoJSX,
                          habilitarFeriadosAplicadoJSX,
                          datasIndividuaisAplicadoJSX
                        );

                        // Função auxiliar para verificar se uma data está nas datas válidas
                        const dataEstaNoPeriodoAplicado = (dataRegistro) => {
                          if (!periodoAplicadoInicio || !periodoAplicadoFim || !dataRegistro) return true;
                          if (datasValidasJSX.size === 0) return false; // Se não há datas válidas, não incluir nada

                          try {
                            let dataStr;
                            if (dataRegistro instanceof Date) {
                              const year = dataRegistro.getFullYear();
                              const month = String(dataRegistro.getMonth() + 1).padStart(2, '0');
                              const day = String(dataRegistro.getDate()).padStart(2, '0');
                              dataStr = `${year}-${month}-${day}`;
                            } else if (typeof dataRegistro === 'string') {
                              dataStr = dataRegistro.split('T')[0];
                            } else {
                              const dataReg = new Date(dataRegistro);
                              const year = dataReg.getFullYear();
                              const month = String(dataReg.getMonth() + 1).padStart(2, '0');
                              const day = String(dataReg.getDate()).padStart(2, '0');
                              dataStr = `${year}-${month}-${day}`;
                            }

                            return datasValidasJSX.has(dataStr);
                          } catch (error) {
                            console.error('Erro ao verificar se data está no período aplicado:', error);
                            return false;
                          }
                        };

                        // Função para calcular estatísticas (tarefas, produtos, clientes, responsáveis) por entidade
                        const calcularEstatisticasPorEntidade = (entidadeId, tipoEntidade, agrupamentos) => {
                          // Filtrar agrupamentos pela entidade
                          const agrupamentosFiltrados = agrupamentos.filter(agr => {
                            const primeiroRegistro = agr.primeiroRegistro;
                            if (tipoEntidade === 'responsavel') {
                              return String(primeiroRegistro.responsavel_id) === String(entidadeId);
                            } else if (tipoEntidade === 'cliente') {
                              // cliente_id pode ser uma string com múltiplos IDs separados por vírgula
                              const clienteIds = String(primeiroRegistro.cliente_id || '')
                                .split(',')
                                .map(id => id.trim())
                                .filter(id => id.length > 0);
                              return clienteIds.includes(String(entidadeId));
                            } else if (tipoEntidade === 'produto') {
                              return String(primeiroRegistro.produto_id) === String(entidadeId);
                            } else if (tipoEntidade === 'atividade') {
                              return String(primeiroRegistro.tarefa_id) === String(entidadeId);
                            }
                            return false;
                          });

                          // Coletar IDs únicos de cada tipo, considerando:
                          // 1. Período filtrado (se houver)
                          // 2. Filtros adicionais (se houver)
                          const tarefasUnicas = new Set();
                          const produtosUnicos = new Set();
                          const clientesUnicos = new Set();
                          const responsaveisUnicos = new Set();

                          agrupamentosFiltrados.forEach(agr => {
                            // Filtrar registros pelo período aplicado (se houver)
                            const registrosFiltrados = periodoAplicadoInicio && periodoAplicadoFim
                              ? agr.registros.filter(reg => dataEstaNoPeriodoAplicado(reg.data))
                              : agr.registros;

                            registrosFiltrados.forEach(reg => {
                              // Aplicar filtros adicionais se existirem
                              let deveIncluir = true;

                              // Filtro adicional de cliente
                              if (filtroAdicionalClienteAplicado && reg.cliente_id) {
                                const clienteIds = String(reg.cliente_id || '')
                                  .split(',')
                                  .map(id => id.trim())
                                  .filter(id => id.length > 0);
                                const filtroClienteIds = Array.isArray(filtroAdicionalClienteAplicado)
                                  ? filtroAdicionalClienteAplicado.map(id => String(id).trim())
                                  : [String(filtroAdicionalClienteAplicado).trim()];
                                deveIncluir = deveIncluir && clienteIds.some(id => filtroClienteIds.includes(id));
                              }

                              // Filtro adicional de tarefa
                              if (filtroAdicionalTarefaAplicado && reg.tarefa_id) {
                                const filtroTarefaIds = Array.isArray(filtroAdicionalTarefaAplicado)
                                  ? filtroAdicionalTarefaAplicado.map(id => String(id).trim())
                                  : [String(filtroAdicionalTarefaAplicado).trim()];
                                deveIncluir = deveIncluir && filtroTarefaIds.includes(String(reg.tarefa_id).trim());
                              }

                              // Filtro adicional de produto
                              if (filtroAdicionalProdutoAplicado && reg.produto_id) {
                                const filtroProdutoIds = Array.isArray(filtroAdicionalProdutoAplicado)
                                  ? filtroAdicionalProdutoAplicado.map(id => String(id).trim())
                                  : [String(filtroAdicionalProdutoAplicado).trim()];
                                deveIncluir = deveIncluir && filtroProdutoIds.includes(String(reg.produto_id).trim());
                              }

                              // Se passou em todos os filtros, adicionar aos contadores
                              if (deveIncluir) {
                                // Verificar se o registro realmente pertence à entidade
                                let pertenceAEntidade = true;

                                if (tipoEntidade === 'cliente') {
                                  const clienteIds = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  pertenceAEntidade = clienteIds.includes(String(entidadeId));
                                } else if (tipoEntidade === 'responsavel') {
                                  pertenceAEntidade = String(reg.responsavel_id) === String(entidadeId);
                                } else if (tipoEntidade === 'produto') {
                                  pertenceAEntidade = String(reg.produto_id) === String(entidadeId);
                                } else if (tipoEntidade === 'atividade') {
                                  pertenceAEntidade = String(reg.tarefa_id) === String(entidadeId);
                                }

                                if (pertenceAEntidade) {
                                  if (reg.tarefa_id) {
                                    // Contar tarefas únicas considerando o contexto (cliente e produto)
                                    // Isso garante que a mesma tarefa para clientes/produtos diferentes conte separatadamente
                                    const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                    const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                    tarefasUnicas.add(`${reg.tarefa_id}_${clienteIdKey}_${produtoIdKey}`);
                                  }
                                  if (reg.produto_id) produtosUnicos.add(String(reg.produto_id));
                                  if (reg.cliente_id) {
                                    // cliente_id pode ser múltiplo, adicionar cada um
                                    const clienteIds = String(reg.cliente_id || '')
                                      .split(',')
                                      .map(id => id.trim())
                                      .filter(id => id.length > 0);
                                    clienteIds.forEach(id => clientesUnicos.add(id));
                                  }
                                  if (reg.responsavel_id) responsaveisUnicos.add(String(reg.responsavel_id));
                                }
                              }
                            });
                          });

                          return {
                            totalTarefas: tarefasUnicas.size,
                            totalProdutos: produtosUnicos.size,
                            totalClientes: clientesUnicos.size,
                            totalResponsaveis: responsaveisUnicos.size
                          };
                        };

                        // Função auxiliar para normalizar tempo realizado (converter horas decimais para milissegundos e garantir mínimo de 1 segundo)
                        const normalizarTempoRealizado = (tempo) => {
                          if (tempo === null || tempo === undefined) return 0;
                          let tempoNormalizado = Number(tempo) || 0;
                          // Converter horas decimais para milissegundos se necessário
                          if (tempoNormalizado > 0 && tempoNormalizado < 1) {
                            tempoNormalizado = Math.round(tempoNormalizado * 3600000);
                          }
                          // Se resultado < 1 segundo, arredondar para 1 segundo
                          if (tempoNormalizado > 0 && tempoNormalizado < 1000) {
                            tempoNormalizado = 1000;
                          }
                          return tempoNormalizado;
                        };

                        // Função para buscar detalhes (tarefas, clientes, produtos, responsáveis) relacionados a uma entidade
                        const buscarDetalhesPorTipo = (entidadeId, tipoEntidade, tipoDetalhe, agrupamentos) => {
                          // Filtrar agrupamentos pela entidade
                          const agrupamentosFiltrados = agrupamentos.filter(agr => {
                            const primeiroRegistro = agr.primeiroRegistro;
                            if (tipoEntidade === 'responsavel') {
                              return String(primeiroRegistro.responsavel_id) === String(entidadeId);
                            } else if (tipoEntidade === 'cliente') {
                              // cliente_id pode ser uma string com múltiplos IDs separados por vírgula
                              const clienteIds = String(primeiroRegistro.cliente_id || '')
                                .split(',')
                                .map(id => id.trim())
                                .filter(id => id.length > 0);
                              return clienteIds.includes(String(entidadeId));
                            } else if (tipoEntidade === 'produto') {
                              return String(primeiroRegistro.produto_id) === String(entidadeId);
                            } else if (tipoEntidade === 'atividade') {
                              return String(primeiroRegistro.tarefa_id) === String(entidadeId);
                            }
                            return false;
                          });

                          // Se for tarefas, agrupar por tarefa e calcular tempo realizado total
                          if (tipoDetalhe === 'tarefas') {
                            const tarefasMap = new Map();

                            agrupamentosFiltrados.forEach(agr => {
                              // Filtrar registros pelo período aplicado
                              const registrosFiltrados = periodoAplicadoInicio && periodoAplicadoFim
                                ? agr.registros.filter(reg => dataEstaNoPeriodoAplicado(reg.data))
                                : agr.registros;

                              registrosFiltrados.forEach(reg => {
                                if (!reg.tarefa_id) return;

                                // Se o filtro pai é cliente, garantir que este registro pertence ao cliente
                                if (tipoEntidade === 'cliente') {
                                  const clienteIds = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  if (!clienteIds.includes(String(entidadeId))) return;
                                }

                                const tarefaId = String(reg.tarefa_id);
                                const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                // Usar chave composta para diferenciar tarefas com mesmo ID mas contextos diferentes (cliente/produto)
                                const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                if (!tarefasMap.has(compositeKey)) {
                                  tarefasMap.set(compositeKey, {
                                    id: compositeKey, // Usar chave composta como ID
                                    originalId: tarefaId,
                                    nome: nomeTarefa,
                                    tipo: 'tarefa',
                                    tempoRealizado: 0,
                                    tempoEstimado: 0,
                                    responsavelId: reg.responsavel_id || null,
                                    clienteId: reg.cliente_id || null,
                                    registros: []
                                  });
                                }

                                const tarefa = tarefasMap.get(compositeKey);

                                // Tempo realizado será buscado depois
                                // tarefa.tempoRealizado será atualizado após buscar

                                // Calcular tempo estimado deste registro (usar mesma lógica da tabela)
                                const tempoEstimadoReg = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
                                tarefa.tempoEstimado += tempoEstimadoReg;

                                // Adicionar registro para poder buscar detalhes individuais depois
                                tarefa.registros.push({
                                  ...reg,
                                  tempoRealizado: 0
                                });
                              });
                            });

                            return Array.from(tarefasMap.values());
                          }

                          // Se for clientes, agrupar por cliente e calcular tempo realizado total, tempo estimado e tarefas
                          if (tipoDetalhe === 'clientes') {
                            const clientesMap = new Map();

                            agrupamentosFiltrados.forEach(agr => {
                              // Filtrar registros pelo período aplicado
                              const registrosFiltrados = periodoAplicadoInicio && periodoAplicadoFim
                                ? agr.registros.filter(reg => dataEstaNoPeriodoAplicado(reg.data))
                                : agr.registros;

                              registrosFiltrados.forEach(reg => {
                                if (!reg.cliente_id) return;

                                // Se o filtro pai é cliente, garantir que este registro pertence ao cliente
                                if (tipoEntidade === 'cliente') {
                                  const clienteIdsTemp = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  if (!clienteIdsTemp.includes(String(entidadeId))) return;
                                }

                                // cliente_id pode conter múltiplos IDs separados por ", "
                                const clienteIds = String(reg.cliente_id)
                                  .split(',')
                                  .map(id => id.trim())
                                  .filter(id => id.length > 0);

                                clienteIds.forEach(clienteId => {
                                  const clienteIdStr = String(clienteId).trim();

                                  if (!clientesMap.has(clienteIdStr)) {
                                    const nomeCliente = getNomeCliente(clienteId);
                                    clientesMap.set(clienteIdStr, {
                                      id: clienteIdStr,
                                      nome: nomeCliente,
                                      tipo: 'cliente',
                                      tempoRealizado: 0,
                                      tempoEstimado: 0,
                                      responsavelId: reg.responsavel_id || entidadeId, // Usar entidadeId se for responsável
                                      tarefas: new Map(), // Map de tarefas por cliente
                                      registros: [] // Registros de tempo estimado relacionados
                                    });
                                  }

                                  const cliente = clientesMap.get(clienteIdStr);

                                  // Tempo realizado sempre 0 (lógica removida)
                                  cliente.tempoRealizado += 0;

                                  // Calcular tempo estimado deste registro (usar mesma lógica da tabela)
                                  const tempoEstimadoReg = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
                                  cliente.tempoEstimado += tempoEstimadoReg;

                                  // Agrupar tarefas por cliente
                                  if (reg.tarefa_id) {
                                    const tarefaId = String(reg.tarefa_id);
                                    const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                    // Usar chave composta para diferenciar tarefas
                                    const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                    const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                    const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                    if (!cliente.tarefas.has(compositeKey)) {
                                      cliente.tarefas.set(compositeKey, {
                                        id: compositeKey, // Usar chave composta como ID
                                        originalId: tarefaId,
                                        nome: nomeTarefa,
                                        tempoRealizado: 0,
                                        tempoEstimado: 0,
                                        responsavelId: reg.responsavel_id || entidadeId,
                                        registros: []
                                      });
                                    }

                                    const tarefa = cliente.tarefas.get(compositeKey);
                                    tarefa.tempoRealizado += 0;
                                    tarefa.tempoEstimado += tempoEstimadoReg;
                                    tarefa.registros.push({
                                      ...reg,
                                      tempoRealizado: 0
                                    });
                                  }

                                  // Adicionar registro para poder buscar detalhes individuais depois
                                  cliente.registros.push({
                                    ...reg,
                                    tempoRealizado: 0
                                  });
                                });
                              });
                            });

                            // Converter Map de tarefas para array em cada cliente
                            const clientesArray = Array.from(clientesMap.values()).map(cliente => ({
                              ...cliente,
                              tarefas: Array.from(cliente.tarefas.values())
                            }));

                            return clientesArray;
                          }

                          // Se for produtos, agrupar por produto -> cliente -> tarefa (ou produto -> tarefa se filtro pai é cliente)
                          if (tipoDetalhe === 'produtos') {
                            const produtosMap = new Map();
                            const isFiltroPaiCliente = tipoEntidade === 'cliente';

                            // Cache de tarefa_id -> produto_id para otimizar buscas
                            const tarefaProdutoCache = new Map();

                            // Preencher cache com produto_id dos registros que já têm
                            agrupamentosFiltrados.forEach(agr => {
                              agr.registros.forEach(reg => {
                                if (reg.produto_id && reg.tarefa_id) {
                                  tarefaProdutoCache.set(String(reg.tarefa_id).trim(), parseInt(reg.produto_id, 10));
                                }
                              });
                            });

                            agrupamentosFiltrados.forEach(agr => {
                              // Filtrar registros pelo período aplicado
                              const registrosFiltrados = periodoAplicadoInicio && periodoAplicadoFim
                                ? agr.registros.filter(reg => dataEstaNoPeriodoAplicado(reg.data))
                                : agr.registros;

                              registrosFiltrados.forEach(reg => {
                                // Buscar produto_id: primeiro do registro, depois da tarefa (usando cache)
                                let produtoIdRegistro = reg.produto_id;

                                // Se registro não tem produto_id, buscar da tarefa usando cache
                                if (!produtoIdRegistro && reg.tarefa_id) {
                                  const tarefaIdStr = String(reg.tarefa_id).trim();
                                  produtoIdRegistro = tarefaProdutoCache.get(tarefaIdStr);

                                  // Se não está no cache, tentar buscar dos outros registros do mesmo agrupamento
                                  if (!produtoIdRegistro) {
                                    const outroRegistro = agr.registros.find(r =>
                                      String(r.tarefa_id).trim() === tarefaIdStr && r.produto_id
                                    );
                                    if (outroRegistro) {
                                      produtoIdRegistro = outroRegistro.produto_id;
                                      tarefaProdutoCache.set(tarefaIdStr, parseInt(produtoIdRegistro, 10));
                                    }
                                  }
                                }

                                // Só ignorar se realmente não tem produto_id em nenhum lugar
                                if (!produtoIdRegistro) return;

                                // Se o filtro pai é cliente, garantir que este registro pertence ao cliente
                                if (isFiltroPaiCliente) {
                                  const clienteIds = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  if (!clienteIds.includes(String(entidadeId))) return;
                                }

                                // Usar produtoIdRegistro (que pode vir do registro ou da tarefa)
                                const produtoId = String(produtoIdRegistro).trim();

                                if (!produtosMap.has(produtoId)) {
                                  const nomeProduto = getNomeProduto(reg.produto_id);
                                  produtosMap.set(produtoId, {
                                    id: produtoId,
                                    nome: nomeProduto,
                                    tipo: 'produto',
                                    tempoRealizado: 0,
                                    tempoEstimado: 0,
                                    responsavelId: reg.responsavel_id || entidadeId,
                                    clientes: isFiltroPaiCliente ? null : new Map(), // Não criar hierarquia de clientes se filtro pai é cliente
                                    tarefas: isFiltroPaiCliente ? new Map() : null, // Criar hierarquia de tarefas diretamente se filtro pai é cliente
                                    registros: []
                                  });
                                }

                                const produto = produtosMap.get(produtoId);

                                // Tempo realizado sempre 0 (lógica removida)
                                produto.tempoRealizado += 0;

                                // Calcular tempo estimado deste registro
                                const tempoEstimadoReg = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
                                produto.tempoEstimado += tempoEstimadoReg;

                                if (isFiltroPaiCliente) {
                                  // Se filtro pai é cliente, agrupar tarefas diretamente no produto (sem hierarquia de clientes)
                                  if (reg.tarefa_id) {
                                    const tarefaId = String(reg.tarefa_id);
                                    const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                    // Usar chave composta para diferenciar tarefas
                                    const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                    const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                    const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                    if (!produto.tarefas.has(compositeKey)) {
                                      produto.tarefas.set(compositeKey, {
                                        id: compositeKey, // Usar chave composta como ID
                                        originalId: tarefaId,
                                        nome: nomeTarefa,
                                        tempoRealizado: 0,
                                        tempoEstimado: 0,
                                        responsavelId: reg.responsavel_id || entidadeId,
                                        registros: []
                                      });
                                    }

                                    const tarefa = produto.tarefas.get(compositeKey);
                                    tarefa.tempoRealizado += 0;
                                    tarefa.tempoEstimado += tempoEstimadoReg;
                                    tarefa.registros.push({
                                      ...reg,
                                      tempoRealizado: 0
                                    });
                                  }
                                } else {
                                  // Se filtro pai não é cliente, manter hierarquia produto -> cliente -> tarefa
                                  if (reg.cliente_id) {
                                    const clienteIds = String(reg.cliente_id)
                                      .split(',')
                                      .map(id => id.trim())
                                      .filter(id => id.length > 0);

                                    clienteIds.forEach(clienteId => {
                                      const clienteIdStr = String(clienteId).trim();

                                      if (!produto.clientes.has(clienteIdStr)) {
                                        const nomeCliente = getNomeCliente(clienteId);
                                        produto.clientes.set(clienteIdStr, {
                                          id: clienteIdStr,
                                          nome: nomeCliente,
                                          tempoRealizado: 0,
                                          tempoEstimado: 0,
                                          tarefas: new Map(),
                                          registros: []
                                        });
                                      }

                                      const cliente = produto.clientes.get(clienteIdStr);
                                      cliente.tempoRealizado += 0;
                                      cliente.tempoEstimado += tempoEstimadoReg;

                                      if (reg.tarefa_id) {
                                        const tarefaId = String(reg.tarefa_id);
                                        const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                        // Usar chave composta para diferenciar tarefas
                                        const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                        const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                        const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                        if (!cliente.tarefas.has(compositeKey)) {
                                          cliente.tarefas.set(compositeKey, {
                                            id: compositeKey, // Usar chave composta como ID
                                            originalId: tarefaId,
                                            nome: nomeTarefa,
                                            tempoRealizado: 0,
                                            tempoEstimado: 0,
                                            responsavelId: reg.responsavel_id || entidadeId,
                                            registros: []
                                          });
                                        }

                                        const tarefa = cliente.tarefas.get(compositeKey);
                                        tarefa.tempoRealizado += 0;
                                        tarefa.tempoEstimado += tempoEstimadoReg;
                                        tarefa.registros.push({
                                          ...reg,
                                          tempoRealizado: 0
                                        });
                                      }

                                      cliente.registros.push({
                                        ...reg,
                                        tempoRealizado: 0
                                      });
                                    });
                                  }
                                }

                                // Adicionar registro para poder buscar detalhes individuais depois
                                produto.registros.push({
                                  ...reg,
                                  tempoRealizado: 0
                                });
                              });
                            });

                            // Converter Maps para arrays
                            if (isFiltroPaiCliente) {
                              // Se filtro pai é cliente, retornar produtos com tarefas diretamente
                              return Array.from(produtosMap.values()).map(produto => ({
                                ...produto,
                                tarefas: Array.from(produto.tarefas.values())
                              }));
                            } else {
                              // Se filtro pai não é cliente, retornar produtos com hierarquia de clientes
                              return Array.from(produtosMap.values()).map(produto => ({
                                ...produto,
                                clientes: Array.from(produto.clientes.values()).map(cliente => ({
                                  ...cliente,
                                  tarefas: Array.from(cliente.tarefas.values())
                                }))
                              }));
                            }
                          }

                          // Se for responsáveis, agrupar por responsável -> produto -> cliente -> tarefa (ou responsável -> produto -> tarefa se filtro pai é cliente)
                          if (tipoDetalhe === 'responsaveis') {
                            const responsaveisMap = new Map();
                            const isFiltroPaiCliente = tipoEntidade === 'cliente';

                            agrupamentosFiltrados.forEach(agr => {
                              // Filtrar registros pelo período aplicado
                              const registrosFiltrados = periodoAplicadoInicio && periodoAplicadoFim
                                ? agr.registros.filter(reg => dataEstaNoPeriodoAplicado(reg.data))
                                : agr.registros;

                              registrosFiltrados.forEach(reg => {
                                if (!reg.responsavel_id) return;

                                // Se o filtro pai é cliente, garantir que este registro pertence ao cliente
                                if (isFiltroPaiCliente) {
                                  const clienteIds = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  if (!clienteIds.includes(String(entidadeId))) return;
                                }

                                const responsavelId = String(reg.responsavel_id).trim();

                                if (!responsaveisMap.has(responsavelId)) {
                                  const nomeResponsavel = getNomeColaborador(reg.responsavel_id);
                                  responsaveisMap.set(responsavelId, {
                                    id: responsavelId,
                                    nome: nomeResponsavel,
                                    tipo: 'responsavel',
                                    tempoRealizado: 0,
                                    tempoEstimado: 0,
                                    responsavelId: responsavelId,
                                    produtos: new Map(),
                                    registros: []
                                  });
                                }

                                const responsavel = responsaveisMap.get(responsavelId);

                                // Tempo realizado sempre 0 (lógica removida)
                                responsavel.tempoRealizado += 0;

                                // Calcular tempo estimado deste registro
                                const tempoEstimadoReg = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
                                responsavel.tempoEstimado += tempoEstimadoReg;

                                // Agrupar por produto dentro do responsável
                                if (reg.produto_id) {
                                  const produtoId = String(reg.produto_id).trim();

                                  if (!responsavel.produtos.has(produtoId)) {
                                    const nomeProduto = getNomeProduto(reg.produto_id);
                                    responsavel.produtos.set(produtoId, {
                                      id: produtoId,
                                      nome: nomeProduto,
                                      tempoRealizado: 0,
                                      tempoEstimado: 0,
                                      clientes: isFiltroPaiCliente ? null : new Map(), // Não criar hierarquia de clientes se filtro pai é cliente
                                      tarefas: isFiltroPaiCliente ? new Map() : null, // Criar hierarquia de tarefas diretamente se filtro pai é cliente
                                      registros: []
                                    });
                                  }

                                  const produto = responsavel.produtos.get(produtoId);
                                  produto.tempoRealizado += 0;
                                  produto.tempoEstimado += tempoEstimadoReg;

                                  if (isFiltroPaiCliente) {
                                    // Se filtro pai é cliente, agrupar tarefas diretamente no produto (sem hierarquia de clientes)
                                    if (reg.tarefa_id) {
                                      const tarefaId = String(reg.tarefa_id);
                                      const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                      // Usar chave composta para diferenciar tarefas
                                      const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                      const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                      const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                      if (!produto.tarefas.has(compositeKey)) {
                                        produto.tarefas.set(compositeKey, {
                                          id: compositeKey, // Usar chave composta como ID
                                          originalId: tarefaId,
                                          nome: nomeTarefa,
                                          tempoRealizado: 0,
                                          tempoEstimado: 0,
                                          responsavelId: responsavelId,
                                          registros: []
                                        });
                                      }

                                      const tarefa = produto.tarefas.get(compositeKey);
                                      tarefa.tempoRealizado += 0;
                                      tarefa.tempoEstimado += tempoEstimadoReg;
                                      tarefa.registros.push({
                                        ...reg,
                                        tempoRealizado: 0
                                      });
                                    }
                                  } else {
                                    // Se filtro pai não é cliente, manter hierarquia responsável -> produto -> cliente -> tarefa
                                    if (reg.cliente_id) {
                                      const clienteIds = String(reg.cliente_id)
                                        .split(',')
                                        .map(id => id.trim())
                                        .filter(id => id.length > 0);

                                      clienteIds.forEach(clienteId => {
                                        const clienteIdStr = String(clienteId).trim();

                                        if (!produto.clientes.has(clienteIdStr)) {
                                          const nomeCliente = getNomeCliente(clienteId);
                                          produto.clientes.set(clienteIdStr, {
                                            id: clienteIdStr,
                                            nome: nomeCliente,
                                            tempoRealizado: 0,
                                            tempoEstimado: 0,
                                            tarefas: new Map(),
                                            registros: []
                                          });
                                        }

                                        const cliente = produto.clientes.get(clienteIdStr);
                                        cliente.tempoRealizado += 0;
                                        cliente.tempoEstimado += tempoEstimadoReg;

                                        if (reg.tarefa_id) {
                                          const tarefaId = String(reg.tarefa_id);
                                          const nomeTarefa = getNomeTarefa(reg.tarefa_id);

                                          // Usar chave composta para diferenciar tarefas
                                          const clienteIdKey = String(reg.cliente_id || 'sem_cliente');
                                          const produtoIdKey = String(reg.produto_id || 'sem_produto');
                                          const compositeKey = `${tarefaId}_${clienteIdKey}_${produtoIdKey}`;

                                          if (!cliente.tarefas.has(compositeKey)) {
                                            cliente.tarefas.set(compositeKey, {
                                              id: compositeKey, // Usar chave composta como ID
                                              originalId: tarefaId,
                                              nome: nomeTarefa,
                                              tempoRealizado: 0,
                                              tempoEstimado: 0,
                                              responsavelId: responsavelId,
                                              registros: []
                                            });
                                          }

                                          const tarefa = cliente.tarefas.get(compositeKey);
                                          tarefa.tempoRealizado += 0;
                                          tarefa.tempoEstimado += tempoEstimadoReg;
                                          tarefa.registros.push({
                                            ...reg,
                                            tempoRealizado: 0
                                          });
                                        }

                                        cliente.registros.push({
                                          ...reg,
                                          tempoRealizado: 0
                                        });
                                      });
                                    }
                                  }

                                  produto.registros.push({
                                    ...reg,
                                    tempoRealizado: 0
                                  });
                                }

                                // Adicionar registro para poder buscar detalhes individuais depois
                                responsavel.registros.push({
                                  ...reg,
                                  tempoRealizado: 0
                                });
                              });
                            });

                            // Converter Maps para arrays
                            if (isFiltroPaiCliente) {
                              // Se filtro pai é cliente, retornar responsáveis com produtos e tarefas diretamente
                              return Array.from(responsaveisMap.values()).map(responsavel => ({
                                ...responsavel,
                                produtos: Array.from(responsavel.produtos.values()).map(produto => ({
                                  ...produto,
                                  tarefas: Array.from(produto.tarefas.values())
                                }))
                              }));
                            } else {
                              // Se filtro pai não é cliente, retornar responsáveis com hierarquia completa
                              return Array.from(responsaveisMap.values()).map(responsavel => ({
                                ...responsavel,
                                produtos: Array.from(responsavel.produtos.values()).map(produto => ({
                                  ...produto,
                                  clientes: Array.from(produto.clientes.values()).map(cliente => ({
                                    ...cliente,
                                    tarefas: Array.from(cliente.tarefas.values())
                                  }))
                                }))
                              }));
                            }
                          }

                          // Para outros tipos, retornar vazio
                          return [];
                        };

                        // Função genérica para calcular tempo por qualquer entidade
                        const calcularTempoPorEntidade = (entidadeId, tipoEntidade, agrupamentos) => {
                          if (!periodoAplicadoInicio || !periodoAplicadoFim) return null;

                          // Usar valores aplicados dos toggles (ou false como padrão se não foram aplicados)
                          const habilitarFinaisSemanaAplicado = filtrosUltimosAplicados?.habilitarFinaisSemana ?? false;
                          const habilitarFeriadosAplicado = filtrosUltimosAplicados?.habilitarFeriados ?? false;
                          const datasIndividuaisAplicado = filtrosUltimosAplicados?.datasIndividuais ?? [];

                          // Obter conjunto de datas válidas (considerando opções e datas individuais)
                          const datasValidas = obterDatasValidasNoPeriodo(
                            periodoAplicadoInicio,
                            periodoAplicadoFim,
                            habilitarFinaisSemanaAplicado,
                            habilitarFeriadosAplicado,
                            datasIndividuaisAplicado
                          );

                          // Função auxiliar para verificar se uma data está nas datas válidas
                          const dataEstaNoPeriodoAplicado = (dataRegistro) => {
                            if (!periodoAplicadoInicio || !periodoAplicadoFim || !dataRegistro) return true;
                            if (datasValidas.size === 0) return false; // Se não há datas válidas, não incluir nada

                            try {
                              let dataStr;
                              if (typeof dataRegistro === 'string') {
                                // Extrair apenas a parte da data (YYYY-MM-DD) ignorando timezone
                                dataStr = dataRegistro.split('T')[0];
                              } else if (dataRegistro instanceof Date) {
                                // Para Date, usar métodos do timezone local para garantir consistência
                                const year = dataRegistro.getFullYear();
                                const month = String(dataRegistro.getMonth() + 1).padStart(2, '0');
                                const day = String(dataRegistro.getDate()).padStart(2, '0');
                                dataStr = `${year}-${month}-${day}`;
                              } else {
                                // Para outros tipos, criar Date e depois normalizar
                                // Se vier como timestamp ou outro formato, converter para string ISO primeiro
                                const dataReg = new Date(dataRegistro);
                                const year = dataReg.getFullYear();
                                const month = String(dataReg.getMonth() + 1).padStart(2, '0');
                                const day = String(dataReg.getDate()).padStart(2, '0');
                                dataStr = `${year}-${month}-${day}`;
                              }

                              // Garantir formato correto (YYYY-MM-DD)
                              if (!dataStr || !dataStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                                console.warn('Formato de data inválido:', dataRegistro, '->', dataStr);
                                return false;
                              }

                              return datasValidas.has(dataStr);
                            } catch (error) {
                              console.error('Erro ao verificar se data está no período aplicado:', error, 'dataRegistro:', dataRegistro);
                              return false;
                            }
                          };

                          // Filtrar agrupamentos pela entidade
                          const agrupamentosFiltrados = agrupamentos.filter(agr => {
                            const primeiroRegistro = agr.primeiroRegistro;
                            if (tipoEntidade === 'responsavel') {
                              return String(primeiroRegistro.responsavel_id) === String(entidadeId);
                            } else if (tipoEntidade === 'cliente') {
                              // cliente_id pode ser uma string com múltiplos IDs separados por vírgula
                              const clienteIds = String(primeiroRegistro.cliente_id || '')
                                .split(',')
                                .map(id => id.trim())
                                .filter(id => id.length > 0);
                              return clienteIds.includes(String(entidadeId));
                            } else if (tipoEntidade === 'produto') {
                              return String(primeiroRegistro.produto_id) === String(entidadeId);
                            } else if (tipoEntidade === 'atividade') {
                              return String(primeiroRegistro.tarefa_id) === String(entidadeId);
                            }
                            return false;
                          });

                          // Calcular tempo estimado
                          // Para responsável, usar o valor já calculado corretamente em loadRegistrosTempoEstimado
                          // Para outras entidades, calcular somando registros (já que não temos cache para elas)
                          let tempoEstimado;
                          if (tipoEntidade === 'responsavel') {
                            // Usar o valor já calculado corretamente que considera:
                            // - Período filtrado corretamente
                            // - Interseção entre período da regra e período filtrado
                            // - Configurações de cada regra (incluir_finais_semana, incluir_feriados)
                            // - Evita duplicação de datas usando Map de datas únicas
                            tempoEstimado = tempoEstimadoTotalPorResponsavel[String(entidadeId)] || 0;
                          } else {
                            // Para outras entidades (cliente, produto, tarefa), calcular somando registros
                            tempoEstimado = agrupamentosFiltrados.reduce((acc, agr) => {
                              if (!agr.registros) return acc;
                              // Filtrar registros pelo período
                              let registrosNoPeriodo = periodoAplicadoInicio && periodoAplicadoFim
                                ? agr.registros.filter((reg) => dataEstaNoPeriodoAplicado(reg.data))
                                : agr.registros;

                              // Para cliente, filtrar também pelo cliente_id do registro individual
                              if (tipoEntidade === 'cliente') {
                                registrosNoPeriodo = registrosNoPeriodo.filter(reg => {
                                  const clienteIds = String(reg.cliente_id || '')
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length > 0);
                                  return clienteIds.includes(String(entidadeId));
                                });
                              }

                              return acc + registrosNoPeriodo.reduce(
                                (sum, reg) => sum + (reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0),
                                0
                              );
                            }, 0);
                          }

                          // Buscar tempo realizado do cache (será preenchido pelo useEffect)
                          // Garantir que entidadeId seja string para consistência com a chave criada no useEffect
                          const chaveTempoRealizado = `${tipoEntidade}_${String(entidadeId)}`;
                          const tempoRealizadoData = temposRealizadosPorEntidade[chaveTempoRealizado] || { realizado: 0, pendente: 0 };
                          // Compatibilidade com backward se era apenas número
                          const tempoRealizado = typeof tempoRealizadoData === 'number' ? tempoRealizadoData : (tempoRealizadoData.realizado || 0);
                          const tempoPendente = typeof tempoRealizadoData === 'number' ? 0 : (tempoRealizadoData.pendente || 0);

                          // Para responsável, calcular disponível e sobrando
                          if (tipoEntidade === 'responsavel') {
                            // Calcular dias considerando as opções de incluir finais de semana, feriados e datas individuais
                            const diasNoPeriodo = calcularDiasComOpcoesEDatasIndividuais(periodoAplicadoInicio, periodoAplicadoFim, habilitarFinaisSemanaAplicado, habilitarFeriadosAplicado, datasIndividuaisAplicado);

                            // Verificar se é PJ (tipo_contrato === 2)
                            const tipoContrato = tipoContratoPorResponsavel[String(entidadeId)];
                            // Verificar se tipo_contrato é 2 (PJ) - pode vir como número ou string
                            const isPJ = tipoContrato !== null && tipoContrato !== undefined && (
                              tipoContrato === 2 ||
                              tipoContrato === '2' ||
                              Number(tipoContrato) === 2 ||
                              String(tipoContrato).trim() === '2'
                            );

                            // Se for PJ, usar estimado como disponível; caso contrário, calcular normalmente
                            const horasContratadasDia = horasContratadasPorResponsavel[String(entidadeId)];

                            // Verificar se horas contratadas ainda está carregando (undefined = ainda não carregado)
                            const aindaCarregandoHoras = horasContratadasDia === undefined;

                            // Buscar tempo estimado total já existente no período do cache (calculado no useEffect)
                            const tempoEstimadoTotalNoPeriodo = tempoEstimadoTotalPorResponsavel[String(entidadeId)] || 0;

                            // Calcular tempo contratado total (horas contratadas por dia × dias no período)
                            // Para PJ, usar estimado como contratado; caso contrário, calcular normalmente
                            // Retornar null se ainda está carregando para distinguir de "já carregado mas sem valor" (0)
                            const tempoContratadoTotal = aindaCarregandoHoras
                              ? null  // Ainda carregando - permite distinguir de 0 (já carregado mas sem valor)
                              : (isPJ
                                ? tempoEstimado
                                : (horasContratadasDia || 0) * diasNoPeriodo * 3600000); // converter horas para milissegundos

                            // Calcular tempo disponível: contratadas - estimado
                            const tempoDisponivelTotal = aindaCarregandoHoras
                              ? null  // Ainda carregando
                              : (isPJ
                                ? tempoEstimado
                                : Math.max(0, tempoContratadoTotal - tempoEstimado));
                            const tempoSobrando = aindaCarregandoHoras
                              ? null  // Ainda carregando
                              : Math.max(0, tempoDisponivelTotal - tempoEstimado);

                            return {
                              disponivel: tempoDisponivelTotal,
                              estimado: tempoEstimado,
                              realizado: tempoRealizado,
                              pendente: tempoPendente,
                              sobrando: tempoSobrando,
                              contratado: tempoContratadoTotal
                            };
                          }

                          // Para outras entidades, não há conceito de disponível/sobrando
                          // Mas precisamos extrair pendente também se houver
                          const tempoRealizadoData2 = temposRealizadosPorEntidade[chaveTempoRealizado] || { realizado: 0, pendente: 0 };
                          const tempoRealizado2 = typeof tempoRealizadoData2 === 'number' ? tempoRealizadoData2 : (tempoRealizadoData2.realizado || 0);
                          const tempoPendente2 = typeof tempoRealizadoData2 === 'number' ? 0 : (tempoRealizadoData2.pendente || 0);

                          return {
                            disponivel: 0,
                            estimado: tempoEstimado,
                            realizado: tempoRealizado2,
                            pendente: tempoPendente2,
                            sobrando: 0,
                            contratado: 0
                          };
                        };

                        // Coletar entidades únicas baseado no filtro principal
                        const entidadesDosRegistros = new Map();
                        registrosAgrupados.forEach(agrupamento => {
                          const primeiroRegistro = agrupamento.primeiroRegistro;
                          let entidadeId = null;
                          let nomeEntidade = null;
                          let fotoPerfil = null;
                          let fotoPerfilPath = null;

                          if (filtroPrincipal === 'responsavel' && primeiroRegistro.responsavel_id) {
                            entidadeId = primeiroRegistro.responsavel_id;
                            nomeEntidade = getNomeColaborador(entidadeId);
                            fotoPerfil = primeiroRegistro.responsavel_foto_perfil;
                            // foto_perfil_path removido - Avatar resolve via Supabase Storage automaticamente
                          } else if (filtroPrincipal === 'cliente' && primeiroRegistro.cliente_id) {
                            // cliente_id pode conter múltiplos IDs separados por vírgula
                            // Processar cada ID separadamente
                            const clienteIds = String(primeiroRegistro.cliente_id)
                              .split(',')
                              .map(id => id.trim())
                              .filter(id => id.length > 0);

                            // Processar cada cliente ID separadamente
                            clienteIds.forEach(clienteId => {
                              const entidadeKey = String(clienteId);
                              if (!entidadesDosRegistros.has(entidadeKey)) {
                                entidadesDosRegistros.set(entidadeKey, {
                                  id: clienteId,
                                  nome: getNomeCliente(clienteId),
                                  fotoPerfil: null,
                                  fotoPerfilPath: null,
                                  registros: []
                                });
                              }

                              // Adicionar todos os registros deste agrupamento que pertencem a este cliente
                              agrupamento.registros.forEach(registro => {
                                // Verificar se o registro pertence a este cliente
                                const registroClienteIds = String(registro.cliente_id || '')
                                  .split(',')
                                  .map(id => id.trim())
                                  .filter(id => id.length > 0);

                                if (registroClienteIds.includes(String(clienteId))) {
                                  entidadesDosRegistros.get(entidadeKey).registros.push({
                                    ...registro,
                                    quantidade: agrupamento.quantidade
                                  });
                                }
                              });
                            });

                            // Pular o processamento padrão abaixo para clientes
                            return;
                          } else if (filtroPrincipal === 'produto' && primeiroRegistro.produto_id) {
                            entidadeId = primeiroRegistro.produto_id;
                            nomeEntidade = getNomeProduto(entidadeId);
                          } else if (filtroPrincipal === 'atividade' && primeiroRegistro.tarefa_id) {
                            entidadeId = primeiroRegistro.tarefa_id;
                            nomeEntidade = getNomeTarefa(entidadeId);
                          }

                          if (entidadeId) {
                            const entidadeKey = String(entidadeId);
                            if (!entidadesDosRegistros.has(entidadeKey)) {
                              entidadesDosRegistros.set(entidadeKey, {
                                id: entidadeId,
                                nome: nomeEntidade,
                                fotoPerfil: fotoPerfil,
                                fotoPerfilPath: fotoPerfilPath,
                                registros: []
                              });
                            }
                            // Adicionar todos os registros deste agrupamento
                            agrupamento.registros.forEach(registro => {
                              let registroPertence = false;
                              if (filtroPrincipal === 'responsavel') {
                                registroPertence = String(registro.responsavel_id) === String(entidadeId);
                              } else if (filtroPrincipal === 'cliente') {
                                registroPertence = String(registro.cliente_id) === String(entidadeId);
                              } else if (filtroPrincipal === 'produto') {
                                registroPertence = String(registro.produto_id) === String(entidadeId);
                              } else if (filtroPrincipal === 'atividade') {
                                registroPertence = String(registro.tarefa_id) === String(entidadeId);
                              }

                              if (registroPertence) {
                                entidadesDosRegistros.get(entidadeKey).registros.push({
                                  ...registro,
                                  quantidade: agrupamento.quantidade
                                });
                              }
                            });
                          }
                        });

                        // Criar um mapa com entidades do sistema (filtradas pelos valores selecionados quando aplicável)
                        const todasEntidades = new Map();

                        // Função auxiliar para verificar se um ID está nos filtros selecionados
                        const estaNosFiltrosSelecionados = (id, filtroSelecionado) => {
                          if (!filtroSelecionado) return true; // Se não há filtro, incluir todos
                          const idStr = String(id);
                          if (Array.isArray(filtroSelecionado)) {
                            return filtroSelecionado.some(f => String(f) === idStr);
                          }
                          return String(filtroSelecionado) === idStr;
                        };

                        if (filtroPrincipal === 'responsavel') {
                          // Para responsáveis, adicionar membros do sistema (filtrados se houver seleção)
                          membros.forEach(membro => {
                            const membroId = String(membro.id);
                            // Se há filtro selecionado, verificar se o membro está incluído
                            if (!estaNosFiltrosSelecionados(membro.id, filtroResponsavelSelecionado)) {
                              return; // Pular este membro se não estiver nos filtros
                            }

                            if (entidadesDosRegistros.has(membroId)) {
                              todasEntidades.set(membroId, entidadesDosRegistros.get(membroId));
                            } else {
                              todasEntidades.set(membroId, {
                                id: membro.id,
                                nome: membro.nome || getNomeColaborador(membro.id),
                                fotoPerfil: null,
                                fotoPerfilPath: null,
                                registros: []
                              });
                            }
                          });
                        } else if (filtroPrincipal === 'cliente') {
                          // Primeiro, adicionar todos os clientes que aparecem nos registros (mesmo sem registros de tempo realizado)
                          entidadesDosRegistros.forEach((entidade, clienteId) => {
                            // Se há filtro selecionado, verificar se o cliente está incluído
                            if (!estaNosFiltrosSelecionados(clienteId, filtroClienteSelecionado)) {
                              return; // Pular este cliente se não estiver nos filtros
                            }
                            todasEntidades.set(clienteId, entidade);
                          });

                          // Depois, adicionar clientes do sistema que não aparecem nos registros (filtrados se houver seleção)
                          clientes.forEach(cliente => {
                            const clienteId = String(cliente.id);
                            // Se há filtro selecionado, verificar se o cliente está incluído
                            if (!estaNosFiltrosSelecionados(cliente.id, filtroClienteSelecionado)) {
                              return; // Pular este cliente se não estiver nos filtros
                            }

                            // Só adicionar se ainda não foi adicionado pelos registros
                            if (!todasEntidades.has(clienteId)) {
                              todasEntidades.set(clienteId, {
                                id: cliente.id,
                                nome: cliente.nome,
                                fotoPerfil: null,
                                fotoPerfilPath: null,
                                registros: []
                              });
                            }
                          });
                        } else if (filtroPrincipal === 'produto') {
                          // Para produtos, adicionar produtos do sistema (filtrados se houver seleção)
                          produtos.forEach(produto => {
                            const produtoId = String(produto.id);
                            // Se há filtro selecionado, verificar se o produto está incluído
                            if (!estaNosFiltrosSelecionados(produto.id, filtroProdutoSelecionado)) {
                              return; // Pular este produto se não estiver nos filtros
                            }

                            if (entidadesDosRegistros.has(produtoId)) {
                              todasEntidades.set(produtoId, entidadesDosRegistros.get(produtoId));
                            } else {
                              todasEntidades.set(produtoId, {
                                id: produto.id,
                                nome: produto.nome,
                                fotoPerfil: null,
                                fotoPerfilPath: null,
                                registros: []
                              });
                            }
                          });
                        } else {
                          // Para atividades, usar apenas as que estão nos registros (filtradas se houver seleção)
                          entidadesDosRegistros.forEach((entidade, key) => {
                            // Se há filtro selecionado, verificar se a tarefa está incluída
                            if (!estaNosFiltrosSelecionados(entidade.id, filtroTarefaSelecionado)) {
                              return; // Pular esta tarefa se não estiver nos filtros
                            }
                            todasEntidades.set(key, entidade);
                          });
                        }

                        // Separar entidades com e sem tempo estimado, e ordenar alfabeticamente
                        const entidadesComTempo = [];
                        const entidadesSemTempo = [];

                        Array.from(todasEntidades.values()).forEach(entidade => {
                          const tempoInfo = calcularTempoPorEntidade(
                            entidade.id,
                            filtroPrincipal,
                            registrosAgrupados
                          );


                          // Obter responsavelId para calcular custo quando filtro principal não é responsavel
                          let responsavelIdParaCusto = null;
                          if (filtroPrincipal !== 'responsavel') {
                            // Buscar o responsavelId mais comum nos registros desta entidade
                            const responsaveisCount = new Map();
                            registrosAgrupados.forEach(agr => {
                              const primeiroRegistro = agr.primeiroRegistro;
                              let pertence = false;
                              if (filtroPrincipal === 'cliente') {
                                const clienteIds = String(primeiroRegistro.cliente_id || '')
                                  .split(',')
                                  .map(id => id.trim())
                                  .filter(id => id.length > 0);
                                pertence = clienteIds.includes(String(entidade.id));
                              } else if (filtroPrincipal === 'produto') {
                                pertence = String(primeiroRegistro.produto_id) === String(entidade.id);
                              } else if (filtroPrincipal === 'atividade') {
                                pertence = String(primeiroRegistro.tarefa_id) === String(entidade.id);
                              }

                              if (pertence && primeiroRegistro.responsavel_id) {
                                const respId = String(primeiroRegistro.responsavel_id);
                                responsaveisCount.set(respId, (responsaveisCount.get(respId) || 0) + 1);
                              }
                            });

                            // Pegar o responsavelId mais frequente
                            if (responsaveisCount.size > 0) {
                              let maxCount = 0;
                              let responsavelMaisFrequente = null;
                              responsaveisCount.forEach((count, respId) => {
                                if (count > maxCount) {
                                  maxCount = count;
                                  responsavelMaisFrequente = respId;
                                }
                              });
                              responsavelIdParaCusto = responsavelMaisFrequente;
                            }
                          } else {
                            responsavelIdParaCusto = entidade.id;
                          }

                          if (tempoInfo && tempoInfo.estimado > 0) {
                            entidadesComTempo.push({ entidade, tempoInfo, responsavelIdParaCusto });
                          } else {
                            entidadesSemTempo.push({ entidade, tempoInfo: null, responsavelIdParaCusto });
                          }
                        });

                        // Ordenar alfabeticamente cada grupo
                        entidadesComTempo.sort((a, b) =>
                          a.entidade.nome.localeCompare(b.entidade.nome, 'pt-BR')
                        );
                        entidadesSemTempo.sort((a, b) =>
                          a.entidade.nome.localeCompare(b.entidade.nome, 'pt-BR')
                        );

                        // Combinar: primeiro os com tempo estimado, depois os sem
                        const todosOrdenados = [...entidadesComTempo, ...entidadesSemTempo];

                        // Limitar a 4 inicialmente se não estiver expandido
                        const dashboardsParaExibir = dashboardsExpandidos
                          ? todosOrdenados
                          : todosOrdenados.slice(0, 4);
                        const temMaisDashboards = todosOrdenados.length > 4;

                        return (
                          <>
                            {dashboardsParaExibir.map(({ entidade, tempoInfo, responsavelIdParaCusto }) => {
                              // Sempre exibir o card, mesmo se não houver tempo estimado (para identificar quem falta estimar)
                              if (!tempoInfo) {
                                // Se não há tempoInfo, criar um objeto vazio para exibir valores zerados
                                // Calcular estatísticas mesmo sem tempo
                                const estatisticas = calcularEstatisticasPorEntidade(
                                  entidade.id,
                                  filtroPrincipal,
                                  registrosAgrupados
                                );

                                return (
                                  <div key={entidade.id} className="tempo-disponivel-card">
                                    <div className={`tempo-disponivel-card-header ${filtroPrincipal !== 'responsavel' ? 'sem-avatar' : ''}`}>
                                      <div className={`tempo-disponivel-card-nome-wrapper ${filtroPrincipal !== 'responsavel' ? 'sem-avatar' : ''}`}>
                                        {filtroPrincipal === 'responsavel' && (
                                          <Avatar
                                            key={`avatar-card-${entidade.id}-${entidade.fotoPerfil || 'no-photo'}`}
                                            avatarId={entidade.fotoPerfil || null}
                                            nomeUsuario={entidade.nome}
                                            size="tiny"
                                            customImagePath={entidade.fotoPerfilPath || null}
                                          />
                                        )}
                                        <span className="tempo-disponivel-card-nome">{entidade.nome}</span>
                                        {filtroPrincipal === 'responsavel' && (() => {
                                          const tipoContratoId = tipoContratoPorResponsavel[String(entidade.id)];
                                          const nomeTipoContrato = tipoContratoId ? tiposContratoMap[String(tipoContratoId)] : null;
                                          return nomeTipoContrato ? (
                                            <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px' }}>
                                              {nomeTipoContrato}
                                            </span>
                                          ) : null;
                                        })()}
                                      </div>
                                    </div>
                                    <div className="tempo-disponivel-card-content">

                                      {/* Cards informativos */}
                                      <div className="tempo-disponivel-card-stats">
                                        {filtroPrincipal === 'responsavel' && (
                                          <>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-list"></i>
                                              <span>Tarefas: {estatisticas.totalTarefas}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-briefcase"></i>
                                              <span>Clientes: {estatisticas.totalClientes}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'clientes',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-box"></i>
                                              <span>Produtos: {estatisticas.totalProdutos}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'produtos',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                        {filtroPrincipal === 'cliente' && (
                                          <>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-list"></i>
                                              <span>Tarefas: {estatisticas.totalTarefas}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-box"></i>
                                              <span>Produtos: {estatisticas.totalProdutos}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'produtos',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-user-tie"></i>
                                              <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'responsaveis',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                        {filtroPrincipal === 'produto' && (
                                          <>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-list"></i>
                                              <span>Tarefas: {estatisticas.totalTarefas}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-briefcase"></i>
                                              <span>Clientes: {estatisticas.totalClientes}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'clientes',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-user-tie"></i>
                                              <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'responsaveis',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                        {filtroPrincipal === 'atividade' && (
                                          <>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-box"></i>
                                              <span>Produtos: {estatisticas.totalProdutos}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'produtos',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-briefcase"></i>
                                              <span>Clientes: {estatisticas.totalClientes}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'clientes',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-user-tie"></i>
                                              <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                                                    // Posição no documento (considerando scroll)
                                                    const documentLeft = rect.left + scrollLeft;
                                                    const documentTop = rect.top + scrollTop;

                                                    const position = {
                                                      left: documentLeft + rect.width + 20,
                                                      top: documentTop
                                                    };
                                                    setDetailCardPosition(position);
                                                    const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                    if (detalhes && detalhes.length > 0) {
                                                      setDetailCard({
                                                        entidadeId: entidade.id,
                                                        tipo: 'responsaveis',
                                                        dados: { registros: detalhes }
                                                      });
                                                    }
                                                  } : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <BarraProgressoTempo
                                        disponivel={0}
                                        estimado={0}
                                        realizado={0}
                                        pendente={0}
                                        sobrando={0}
                                        contratado={0}
                                        responsavelId={responsavelIdParaCusto}
                                        mostrarContratadasDisponivel={filtroPrincipal === 'responsavel'}
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              // Calcular estatísticas para esta entidade
                              const estatisticas = calcularEstatisticasPorEntidade(
                                entidade.id,
                                filtroPrincipal,
                                registrosAgrupados
                              );

                              return (
                                <div key={entidade.id} className="tempo-disponivel-card">
                                  <div className={`tempo-disponivel-card-header ${filtroPrincipal !== 'responsavel' ? 'sem-avatar' : ''}`}>
                                    <div className={`tempo-disponivel-card-nome-wrapper ${filtroPrincipal !== 'responsavel' ? 'sem-avatar' : ''}`}>
                                      {filtroPrincipal === 'responsavel' && (
                                        <Avatar
                                          key={`avatar-card-${entidade.id}-${entidade.fotoPerfil || 'no-photo'}`}
                                          avatarId={entidade.fotoPerfil || null}
                                          nomeUsuario={entidade.nome}
                                          size="tiny"
                                          customImagePath={entidade.fotoPerfilPath || null}
                                        />
                                      )}
                                      <span className="tempo-disponivel-card-nome">{entidade.nome}</span>
                                      {filtroPrincipal === 'responsavel' && (() => {
                                        const tipoContratoId = tipoContratoPorResponsavel[String(entidade.id)];
                                        const nomeTipoContrato = tipoContratoId ? tiposContratoMap[String(tipoContratoId)] : null;
                                        return nomeTipoContrato ? (
                                          <span className="painel-usuario-estimado-pill" style={{ marginLeft: '8px' }}>
                                            {nomeTipoContrato}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                  </div>
                                  <div className="tempo-disponivel-card-content">

                                    {/* Cards informativos */}
                                    <div className="tempo-disponivel-card-stats">
                                      {filtroPrincipal === 'responsavel' && (
                                        <>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-list"></i>
                                            <span>Tarefas: {estatisticas.totalTarefas}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                              title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-briefcase"></i>
                                            <span>Clientes: {estatisticas.totalClientes}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'clientes',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-box"></i>
                                            <span>Produtos: {estatisticas.totalProdutos}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'produtos',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                        </>
                                      )}
                                      {filtroPrincipal === 'cliente' && (
                                        <>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-list"></i>
                                            <span>Tarefas: {estatisticas.totalTarefas}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                              title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-box"></i>
                                            <span>Produtos: {estatisticas.totalProdutos}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'produtos',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-user-tie"></i>
                                            <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'responsaveis',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                        </>
                                      )}
                                      {filtroPrincipal === 'produto' && (
                                        <>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-list"></i>
                                            <span>Tarefas: {estatisticas.totalTarefas}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                              title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-briefcase"></i>
                                            <span>Clientes: {estatisticas.totalClientes}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'clientes',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-user-tie"></i>
                                            <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'responsaveis',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                        </>
                                      )}
                                      {filtroPrincipal === 'atividade' && (
                                        <>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-box"></i>
                                            <span>Produtos: {estatisticas.totalProdutos}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'produtos', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'produtos',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-briefcase"></i>
                                            <span>Clientes: {estatisticas.totalClientes}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalClientes === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalClientes > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'clientes', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'clientes',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalClientes > 0 ? "Ver detalhes de clientes" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-user-tie"></i>
                                            <span>Responsáveis: {estatisticas.totalResponsaveis}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalResponsaveis === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => {
                                                e.stopPropagation();
                                                const elemento = e.currentTarget.closest('.tempo-disponivel-stat-item');
                                                const rect = elemento.getBoundingClientRect();
                                                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                                const documentLeft = rect.left + scrollLeft;
                                                const documentTop = rect.top + scrollTop;
                                                setDetailCardPosition({
                                                  left: documentLeft + rect.width + 20,
                                                  top: documentTop
                                                });
                                                const detalhes = buscarDetalhesPorTipo(entidade.id, filtroPrincipal, 'responsaveis', registrosAgrupados);
                                                if (detalhes && detalhes.length > 0) {
                                                  setDetailCard({
                                                    entidadeId: entidade.id,
                                                    tipo: 'responsaveis',
                                                    dados: { registros: detalhes }
                                                  });
                                                }
                                              } : undefined}
                                              title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <BarraProgressoTempo
                                      disponivel={tempoInfo.disponivel}
                                      estimado={tempoInfo.estimado}
                                      realizado={tempoInfo.realizado}
                                      pendente={tempoInfo.pendente}
                                      sobrando={tempoInfo.sobrando}
                                      contratado={tempoInfo.contratado !== undefined ? tempoInfo.contratado : null}
                                      responsavelId={responsavelIdParaCusto}
                                      mostrarContratadasDisponivel={filtroPrincipal === 'responsavel'}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            {temMaisDashboards && (
                              <div
                                className="tempo-disponivel-expand-bar"
                                onClick={() => setDashboardsExpandidos(!dashboardsExpandidos)}
                                style={{
                                  gridColumn: '1 / -1',
                                  cursor: 'pointer',
                                  marginTop: '8px'
                                }}
                              >
                                <span className="tempo-disponivel-expand-text">
                                  {dashboardsExpandidos ? 'Ver menos' : `Ver mais (${todosOrdenados.length - 4} restantes)`}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* LISTA DE ATRIBUIÇÕES - DESATIVADA TEMPORARIAMENTE */}
                {false && (() => {
                  // Se há filtro principal, agrupar por ele
                  if (filtroPrincipal) {
                    const agrupados = {};

                    registrosAgrupados.forEach(agrupamento => {
                      const primeiroRegistro = agrupamento.primeiroRegistro;
                      let chaveAgrupamento = null;
                      let nomeAgrupamento = null;

                      if (filtroPrincipal === 'produto' && primeiroRegistro.produto_id) {
                        chaveAgrupamento = `produto_${primeiroRegistro.produto_id}`;
                        nomeAgrupamento = getNomeProduto(primeiroRegistro.produto_id);
                      } else if (filtroPrincipal === 'atividade' && primeiroRegistro.tarefa_id) {
                        chaveAgrupamento = `atividade_${primeiroRegistro.tarefa_id}`;
                        nomeAgrupamento = getNomeTarefa(primeiroRegistro.tarefa_id);
                      } else if (filtroPrincipal === 'cliente' && primeiroRegistro.cliente_id) {
                        chaveAgrupamento = `cliente_${primeiroRegistro.cliente_id}`;
                        nomeAgrupamento = getNomeCliente(primeiroRegistro.cliente_id);
                      } else if (filtroPrincipal === 'responsavel' && primeiroRegistro.responsavel_id) {
                        chaveAgrupamento = `responsavel_${primeiroRegistro.responsavel_id}`;
                        nomeAgrupamento = getNomeColaborador(primeiroRegistro.responsavel_id);
                      }

                      if (chaveAgrupamento) {
                        if (!agrupados[chaveAgrupamento]) {
                          agrupados[chaveAgrupamento] = {
                            nome: nomeAgrupamento,
                            tipo: filtroPrincipal,
                            agrupamentos: [],
                            fotoPerfil: filtroPrincipal === 'responsavel' ? primeiroRegistro.responsavel_foto_perfil : null
                            // foto_perfil_path removido - Avatar resolve via Supabase Storage automaticamente
                          };
                        }
                        agrupados[chaveAgrupamento].agrupamentos.push(agrupamento);
                      }
                    });

                    // Renderizar grupos expansíveis
                    return Object.entries(agrupados).map(([chaveAgrupamento, grupo], index) => {
                      const grupoKey = chaveAgrupamento;
                      const isExpanded = gruposExpandidos.has(grupoKey);
                      const totalItens = grupo.agrupamentos.length;
                      const tempoEstimadoTotal = calcularTempoTotalGrupoFiltrado(grupo.agrupamentos);
                      // Tempo realizado sempre 0 (lógica removida)
                      const tempoRealizadoTotal = 0;
                      const tempoEstimadoFormatado = formatarTempoEstimado(tempoEstimadoTotal, true);
                      const tempoRealizadoFormatado = '0s';

                      return (
                        <div key={chaveAgrupamento} className="atribuicoes-group">
                          <div
                            className={`atribuicoes-group-header ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleGrupo(grupoKey)}
                          >
                            <div className="atribuicoes-group-header-left">
                              <i
                                className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGrupo(grupoKey);
                                }}
                                style={{ cursor: 'pointer' }}
                              ></i>
                              <span className={`atribuicoes-group-badge ${['produto', 'atividade', 'cliente', 'responsavel'].includes(grupo.tipo) ? 'atribuicoes-group-badge-orange' : ''}`}>
                                {grupo.tipo === 'atividade' ? 'TAREFAS AGRUPADAS' : grupo.tipo.toUpperCase()}
                              </span>
                              <h3 className="atribuicoes-group-title">
                                {grupo.tipo === 'responsavel' && grupo.fotoPerfil ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar
                                      key={`avatar-group-${chaveAgrupamento}-${grupo.fotoPerfil}`}
                                      avatarId={grupo.fotoPerfil}
                                      nomeUsuario={grupo.nome}
                                      size="tiny"
                                      customImagePath={grupo.fotoPerfilPath || null}
                                    />
                                    <span>{grupo.nome}</span>
                                  </div>
                                ) : (
                                  grupo.nome
                                )}
                              </h3>
                              <div className="atribuicoes-group-header-info">
                                {tempoEstimadoTotal > 0 && (
                                  <span className="atribuicoes-group-tempo-badge atribuicoes-group-tempo-total" title={`Estimado: ${(tempoEstimadoTotal / 3600000).toFixed(2)}h`}>
                                    <i className="fas fa-clock"></i>
                                    <span>Estimado: {tempoEstimadoFormatado}</span>
                                  </span>
                                )}
                                <span className="atribuicoes-group-tempo-badge atribuicoes-group-tempo-realizado" title="Realizado: 0h">
                                  <i className="fas fa-stopwatch"></i>
                                  <span>Realizado: 0s</span>
                                </span>
                                <span className="atribuicoes-group-count">
                                  <i className="fas fa-tasks"></i>
                                  <span>{totalItens} {totalItens === 1 ? 'tarefa' : 'tarefas'}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="atribuicoes-group-content">
                              <table className="atribuicoes-table">
                                <thead>
                                  <tr>
                                    {filtroPrincipal === 'atividade' && <th></th>}
                                    {filtroPrincipal !== 'atividade' && <th>Tarefas Agrupadas</th>}
                                    {filtroPrincipal !== 'produto' && <th className="atribuicoes-col-produto">Produto</th>}
                                    {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                    {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                    <th>Tempo Estimado / Realizado</th>
                                    <th>Período</th>
                                    <th className="atribuicoes-table-actions">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grupo.agrupamentos.map((agrupamento) => {
                                    const primeiroRegistro = agrupamento.primeiroRegistro;
                                    const produtosUnicos = [...new Set(agrupamento.registros.map(r => r.produto_id))];
                                    const tarefasUnicas = [...new Set(agrupamento.registros.map(r => r.tarefa_id))];
                                    const tempoEstimadoTotal = calcularTempoEstimadoTotalAgrupamento(agrupamento);
                                    // Tempo realizado sempre 0 (lógica removida)
                                    const tempoRealizadoTotal = 0;
                                    const isAgrupamentoTarefasExpanded = agrupamentosTarefasExpandidas.has(agrupamento.agrupador_id);

                                    // Tempo realizado sempre 0 (lógica removida)
                                    const tempoRealizadoPorTarefa = {};
                                    tarefasUnicas.forEach(tarefaId => {
                                      tempoRealizadoPorTarefa[tarefaId] = 0;
                                    });

                                    return (
                                      <React.Fragment key={agrupamento.agrupador_id}>
                                        <tr>
                                          {filtroPrincipal === 'atividade' && (
                                            <td>
                                              <button
                                                type="button"
                                                className="atribuicoes-expand-tarefas-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleAgrupamentoTarefas(agrupamento.agrupador_id);
                                                }}
                                                title={isAgrupamentoTarefasExpanded ? "Ocultar tarefas" : "Ver tarefas"}
                                              >
                                                <i className={`fas fa-chevron-${isAgrupamentoTarefasExpanded ? 'down' : 'right'}`}></i>
                                              </button>
                                            </td>
                                          )}
                                          {filtroPrincipal !== 'atividade' && (
                                            <td style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                              {tarefasUnicas.map((tarefaId, idx) => {
                                                const tarefaKey = `${agrupamento.agrupador_id}_${tarefaId}`;
                                                const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                                                const tempoRealizadoTarefa = tempoRealizadoPorTarefa[tarefaId] || 0;
                                                return (
                                                  <button
                                                    key={tarefaId}
                                                    type="button"
                                                    className={`atribuicoes-tag atribuicoes-tag-clickable ${isTarefaExpanded ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleTarefa(agrupamento.agrupador_id, tarefaId);
                                                    }}
                                                    title={isTarefaExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                                                    style={{
                                                      margin: '2px 4px 2px 0',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                  >
                                                    {getNomeTarefa(tarefaId)}
                                                    <i className={`fas fa-chevron-${isTarefaExpanded ? 'down' : 'right'}`} style={{ marginLeft: '6px', fontSize: '10px', flexShrink: 0 }}></i>
                                                  </button>
                                                );
                                              })}
                                            </td>
                                          )}
                                          {filtroPrincipal !== 'produto' && (
                                            <td className="atribuicoes-col-produto">
                                              {produtosUnicos.map((produtoId, idx) => (
                                                <span key={produtoId} className="atribuicoes-tag atribuicoes-tag-produto">
                                                  {getNomeProduto(produtoId)}
                                                </span>
                                              ))}
                                            </td>
                                          )}
                                          {filtroPrincipal !== 'cliente' && (
                                            <td>
                                              <span className="atribuicoes-tag atribuicoes-tag-cliente">
                                                {getNomeCliente(primeiroRegistro.cliente_id)}
                                              </span>
                                            </td>
                                          )}
                                          {filtroPrincipal !== 'responsavel' && (
                                            <td className="atribuicoes-col-responsavel">
                                              <div className="responsavel-avatar-wrapper has-tooltip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Avatar
                                                  key={`avatar-${primeiroRegistro.responsavel_id}-${primeiroRegistro.responsavel_foto_perfil}`}
                                                  avatarId={primeiroRegistro.responsavel_foto_perfil}
                                                  nomeUsuario={getNomeColaborador(primeiroRegistro.responsavel_id)}
                                                  size="tiny"
                                                />
                                                <div className="responsavel-tooltip">
                                                  {getNomeColaborador(primeiroRegistro.responsavel_id)}
                                                </div>
                                              </div>
                                            </td>
                                          )}
                                          <td>
                                            <div className="atribuicoes-tempo">
                                              {(() => {
                                                const tempoEstimadoFormatado = formatarTempoEstimado(tempoEstimadoTotal, true);
                                                // Tempo realizado sempre 0 (lógica removida)
                                                const tempoRealizadoFormatado = '0s';
                                                const custoEstimado = calcularCustoPorTempo(tempoEstimadoTotal, primeiroRegistro.responsavel_id);
                                                const custoRealizado = null;

                                                return (
                                                  <>
                                                    {/* Card Estimado */}
                                                    <div className="atribuicoes-tempo-card atribuicoes-tempo-card-estimado">
                                                      <div className="atribuicoes-tempo-label atribuicoes-tempo-label-estimado">
                                                        <i className="fas fa-clock"></i>
                                                        <span>Estimado</span>
                                                      </div>
                                                      <div className="atribuicoes-tempo-valor atribuicoes-tempo-valor-estimado">
                                                        {tempoEstimadoFormatado}
                                                      </div>
                                                      {custoEstimado !== null && (
                                                        <div className="atribuicoes-tempo-custo atribuicoes-tempo-custo-estimado">
                                                          {formatarValorMonetario(custoEstimado)}
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Card Realizado */}
                                                    <div className="atribuicoes-tempo-card atribuicoes-tempo-card-realizado-empty">
                                                      <div className="atribuicoes-tempo-label atribuicoes-tempo-label-realizado-empty">
                                                        <i className="fas fa-stopwatch"></i>
                                                        <span>Realizado</span>
                                                      </div>
                                                      <div className="atribuicoes-tempo-valor atribuicoes-tempo-valor-realizado-empty">
                                                        0s
                                                      </div>
                                                    </div>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          </td>
                                          <td>
                                            <span className="atribuicoes-periodo">
                                              <i className="fas fa-calendar-alt"></i>
                                              <span>{formatarPeriodo(agrupamento.dataInicio, agrupamento.dataFim)}</span>
                                            </span>
                                          </td>
                                          <td className="atribuicoes-table-actions">
                                            <div className="atribuicoes-row-actions">
                                              <EditButton
                                                onClick={() => handleEditAtribuicao(agrupamento)}
                                                title="Editar atribuição"
                                              />
                                              <DeleteButton
                                                onClick={() => {
                                                  setAgrupamentoParaDeletar(agrupamento);
                                                  setShowDeleteConfirmModal(true);
                                                }}
                                                title="Excluir atribuição"
                                              />
                                            </div>
                                          </td>
                                        </tr>
                                        {/* Tarefas expandidas quando filtro pai é "atividade" */}
                                        {filtroPrincipal === 'atividade' && isAgrupamentoTarefasExpanded && (
                                          <tr className="atribuicoes-tarefa-detalhes">
                                            <td colSpan={7} className="atribuicoes-tarefa-detalhes-cell">
                                              <div className="atribuicoes-tarefa-detalhes-content">
                                                <div className="atribuicoes-tarefa-detalhes-header">
                                                  <h4>Tarefas</h4>
                                                  <span className="atribuicoes-tarefa-detalhes-count">
                                                    {tarefasUnicas.length} tarefa(s)
                                                  </span>
                                                </div>
                                                <div className="atribuicoes-tarefas-list">
                                                  {tarefasUnicas.map((tarefaId) => {
                                                    const registrosTarefa = agrupamento.registros.filter(r => String(r.tarefa_id) === String(tarefaId));
                                                    const tempoRealizadoTarefa = tempoRealizadoPorTarefa[tarefaId] || 0;

                                                    return (
                                                      <div key={tarefaId} className="atribuicoes-tarefa-item">
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                          <div className="atribuicoes-tarefa-nome" style={{ fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>
                                                            {getNomeTarefa(tarefaId)}
                                                          </div>
                                                          <span style={{
                                                            fontSize: '11px',
                                                            color: '#9ca3af',
                                                            fontWeight: 600,
                                                            padding: '4px 8px',
                                                            background: '#f3f4f6',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                          }}>
                                                            <i className="fas fa-stopwatch" style={{ fontSize: '10px' }}></i>
                                                            Realizado: 0s
                                                          </span>
                                                        </div>
                                                        <table className="atribuicoes-detalhes-table">
                                                          <thead>
                                                            <tr>
                                                              <th>Data</th>
                                                              {filtroPrincipal !== 'produto' && <th className="atribuicoes-col-produto">Produto</th>}
                                                              {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                                              {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                                              <th>Tempo Estimado / Realizado</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            {registrosTarefa
                                                              .sort((a, b) => {
                                                                const aNoPeriodo = dataEstaNoPeriodo(a.data);
                                                                const bNoPeriodo = dataEstaNoPeriodo(b.data);
                                                                // Ordenar: primeiro os que estão no período (true vem antes de false)
                                                                if (aNoPeriodo && !bNoPeriodo) return -1;
                                                                if (!aNoPeriodo && bNoPeriodo) return 1;
                                                                return 0;
                                                              })
                                                              .map((registro, regIdx) => {
                                                                const estaNoPeriodo = dataEstaNoPeriodo(registro.data);
                                                                return (
                                                                  <tr
                                                                    key={`reg_${registro.id || regIdx}`}
                                                                    style={!estaNoPeriodo ? { opacity: 0.3, color: '#9ca3af' } : {}}
                                                                  >
                                                                    <td>{formatarData(registro.data)}</td>
                                                                    {filtroPrincipal !== 'produto' && (
                                                                      <td>
                                                                        <span className="atribuicoes-tag atribuicoes-tag-produto">
                                                                          {getNomeProduto(registro.produto_id)}
                                                                        </span>
                                                                      </td>
                                                                    )}
                                                                    {filtroPrincipal !== 'cliente' && (
                                                                      <td>
                                                                        <span className="atribuicoes-tag atribuicoes-tag-cliente">
                                                                          {getNomeCliente(registro.cliente_id)}
                                                                        </span>
                                                                      </td>
                                                                    )}
                                                                    {filtroPrincipal !== 'responsavel' && (
                                                                      <td className="atribuicoes-col-responsavel">
                                                                        <div className="responsavel-avatar-wrapper has-tooltip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                          <Avatar
                                                                            key={`avatar-${registro.responsavel_id}-${registro.id}-${registro.responsavel_foto_perfil}`}
                                                                            avatarId={registro.responsavel_foto_perfil}
                                                                            nomeUsuario={getNomeColaborador(registro.responsavel_id)}
                                                                            size="tiny"
                                                                          />
                                                                          <div className="responsavel-tooltip">
                                                                            {getNomeColaborador(registro.responsavel_id)}
                                                                          </div>
                                                                        </div>
                                                                      </td>
                                                                    )}
                                                                    <td>
                                                                      <span className="atribuicoes-tempo">
                                                                        {formatarTempoEstimadoERealizado(registro, true)}
                                                                      </span>
                                                                    </td>
                                                                  </tr>
                                                                );
                                                              })}
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                        {/* Detalhes das tarefas expandidas (quando filtro pai não é "atividade") */}
                                        {filtroPrincipal !== 'atividade' && tarefasUnicas.map((tarefaId) => {
                                          const tarefaKey = `${agrupamento.agrupador_id}_${tarefaId}`;
                                          if (!tarefasExpandidas.has(tarefaKey)) return null;

                                          // Filtrar registros dessa tarefa específica
                                          const registrosTarefa = agrupamento.registros.filter(r => String(r.tarefa_id) === String(tarefaId));

                                          // Tempo realizado sempre 0 (lógica removida)
                                          const tempoRealizadoTarefaDetalhes = 0;

                                          return (
                                            <tr key={`detalhes_${tarefaKey}`} className="atribuicoes-tarefa-detalhes">
                                              <td colSpan={7 - (filtroPrincipal === 'atividade' ? 1 : 0) - (filtroPrincipal === 'produto' ? 1 : 0) - (filtroPrincipal === 'cliente' ? 1 : 0) - (filtroPrincipal === 'responsavel' ? 1 : 0)} className="atribuicoes-tarefa-detalhes-cell">
                                                <div className="atribuicoes-tarefa-detalhes-content">
                                                  <div className="atribuicoes-tarefa-detalhes-header">
                                                    <h4>{getNomeTarefa(tarefaId)} - Detalhes</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                      <span style={{
                                                        fontSize: '11px',
                                                        color: '#9ca3af',
                                                        fontWeight: 600,
                                                        padding: '4px 8px',
                                                        background: '#f3f4f6',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                      }}>
                                                        <i className="fas fa-stopwatch" style={{ fontSize: '10px' }}></i>
                                                        Realizado: 0s
                                                      </span>
                                                      <span className="atribuicoes-tarefa-detalhes-count">
                                                        {registrosTarefa.length} registro(s)
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <table className="atribuicoes-detalhes-table">
                                                    <thead>
                                                      <tr>
                                                        <th>Data</th>
                                                        {filtroPrincipal !== 'produto' && <th className="atribuicoes-col-produto">Produto</th>}
                                                        {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                                        {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                                        <th>Tempo Estimado / Realizado</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {registrosTarefa
                                                        .sort((a, b) => {
                                                          const aNoPeriodo = dataEstaNoPeriodo(a.data);
                                                          const bNoPeriodo = dataEstaNoPeriodo(b.data);
                                                          // Ordenar: primeiro os que estão no período (true vem antes de false)
                                                          if (aNoPeriodo && !bNoPeriodo) return -1;
                                                          if (!aNoPeriodo && bNoPeriodo) return 1;
                                                          return 0;
                                                        })
                                                        .map((registro, regIdx) => {
                                                          const estaNoPeriodo = dataEstaNoPeriodo(registro.data);
                                                          return (
                                                            <tr
                                                              key={`reg_${registro.id || regIdx}`}
                                                              style={!estaNoPeriodo ? { opacity: 0.3, color: '#9ca3af' } : {}}
                                                            >
                                                              <td>{formatarData(registro.data)}</td>
                                                              {filtroPrincipal !== 'produto' && (
                                                                <td>
                                                                  <span className="atribuicoes-tag atribuicoes-tag-produto">
                                                                    {getNomeProduto(registro.produto_id)}
                                                                  </span>
                                                                </td>
                                                              )}
                                                              {filtroPrincipal !== 'cliente' && (
                                                                <td>
                                                                  <span className="atribuicoes-tag atribuicoes-tag-cliente">
                                                                    {getNomeCliente(registro.cliente_id)}
                                                                  </span>
                                                                </td>
                                                              )}
                                                              {filtroPrincipal !== 'responsavel' && (
                                                                <td className="atribuicoes-col-responsavel">
                                                                  <div className="responsavel-avatar-wrapper has-tooltip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                    <Avatar
                                                                      key={`avatar-${registro.responsavel_id}-${registro.id}-${registro.responsavel_foto_perfil}`}
                                                                      avatarId={registro.responsavel_foto_perfil}
                                                                      nomeUsuario={getNomeColaborador(registro.responsavel_id)}
                                                                      size="tiny"
                                                                    />
                                                                    <div className="responsavel-tooltip">
                                                                      {getNomeColaborador(registro.responsavel_id)}
                                                                    </div>
                                                                  </div>
                                                                </td>
                                                              )}
                                                              <td>
                                                                <span className="atribuicoes-tempo">
                                                                  {formatarTempoEstimadoERealizado(registro, true)}
                                                                </span>
                                                              </td>
                                                            </tr>
                                                          );
                                                        })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    });
                  } else {
                    // Sem filtro principal, exibir lista simples
                    return (
                      <div className="atribuicoes-group">
                        <AtribuicoesTabela
                          registrosAgrupados={registrosAgrupados}
                          periodoInicio={periodoInicio}
                          periodoFim={periodoFim}
                          tarefasExpandidas={tarefasExpandidas}
                          toggleTarefa={toggleTarefa}
                          getNomeTarefa={getNomeTarefa}
                          getNomeProduto={getNomeProduto}
                          getNomeCliente={getNomeCliente}
                          getNomeColaborador={getNomeColaborador}
                          formatarTempoComCusto={formatarTempoComCusto}
                          formatarPeriodo={formatarPeriodo}
                          handleEditAtribuicao={handleEditAtribuicao}
                          setAgrupamentoParaDeletar={setAgrupamentoParaDeletar}
                          setShowDeleteConfirmModal={setShowDeleteConfirmModal}
                        />
                      </div>
                    );
                  }
                })()}
                {/* FIM DA LISTA DE ATRIBUIÇÕES - DESATIVADA TEMPORARIAMENTE */}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal de confirmação para exclusão */}
      <ConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setAgrupamentoParaDeletar(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          agrupamentoParaDeletar ? (
            <>
              <p>Tem certeza que deseja excluir esta atribuição?</p>
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
                <strong>Cliente:</strong> {getNomeCliente(agrupamentoParaDeletar.primeiroRegistro.cliente_id)}<br />
                <strong>Colaborador:</strong> {getNomeColaborador(agrupamentoParaDeletar.primeiroRegistro.responsavel_id)}<br />
                <strong>Período:</strong> {formatarPeriodo(agrupamentoParaDeletar.dataInicio, agrupamentoParaDeletar.dataFim)}<br />
                <strong>Quantidade de dias:</strong> {agrupamentoParaDeletar.quantidade} dia(s)
              </p>
              <p className="warning-text" style={{ marginTop: '12px', color: '#dc2626', fontWeight: 500 }}>
                Todos os {agrupamentoParaDeletar.quantidade} dia(s) desta atribuição serão removidos. Esta ação não pode ser desfeita.
              </p>
            </>
          ) : null
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleteLoading}
      />

      {/* DetailSideCard */}
      {detailCard && (
        <DetailSideCard
          entidadeId={detailCard.entidadeId}
          tipo={detailCard.tipo}
          dados={detailCard.dados}
          onClose={handleCloseDetail}
          position={detailCardPosition}
          formatarTempoEstimado={formatarTempoEstimado}
          formatarData={formatarData}
          calcularCustoPorTempo={calcularCustoPorTempo}
          formatarValorMonetario={formatarValorMonetario}
          getNomeCliente={getNomeCliente}
          periodoInicio={filtrosUltimosAplicados?.periodoInicio || periodoInicio}
          periodoFim={filtrosUltimosAplicados?.periodoFim || periodoFim}
          filtrosAdicionais={{
            cliente_id: filtroAdicionalCliente || null,
            tarefa_id: filtroAdicionalTarefa || null,
            produto_id: filtroAdicionalProduto || null,
            responsavel_id: (filtroPrincipal !== 'responsavel' && filtroResponsavelSelecionado) ? filtroResponsavelSelecionado : (filtroPrincipal === 'responsavel' && detailCard?.entidadeId) ? detailCard.entidadeId : null
          }}
        />
      )}
    </Layout>
  );
};

export default DelegarTarefas;
