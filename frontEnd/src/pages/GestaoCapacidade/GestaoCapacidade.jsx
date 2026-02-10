import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { processBatch, executeHighPriority, globalRequestPool } from '../../utils/requestPool';
import '../../pages/CadastroVinculacoes/CadastroVinculacoes.css';
import './GestaoCapacidade.css';
import { debounce } from '../../utils/debounce';

const API_BASE_URL = '/api';

const GestaoCapacidade = () => {
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
    tipoTarefa: false,
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
  const [filtroTipoTarefaSelecionado, setFiltroTipoTarefaSelecionado] = useState(null);
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

  // Estados para carregar dados de produtos, tarefas e tipos de tarefa (globais)
  const [produtos, setProdutos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tiposTarefa, setTiposTarefa] = useState([]);

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
  // Nível 3: Registros de tempo (realizado) carregados sob demanda por tarefa
  const [registroTempoExpandidoPorTarefa, setRegistroTempoExpandidoPorTarefa] = useState(new Set());
  const [registroTempoCache, setRegistroTempoCache] = useState({}); // { tarefaKey: { loading, data: [], error } }

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

  // Payload único do endpoint gestao-capacidade/cards (pai + detalhes por entidade)
  const [cardsPorEntidade, setCardsPorEntidade] = useState({});

  // Estados para carregar dados
  const [clientes, setClientes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [membros, setMembros] = useState([]);

  // Estados para fila de processamento (Queue)
  const [filaProcessamento, setFilaProcessamento] = useState([]);
  const [processandoFila, setProcessandoFila] = useState(false);

  // Ref para cancelar requisições anteriores
  const abortControllerRef = useRef(null);
  const loadingRef = useRef(false);


  // Estado para controlar expansão dos dashboards
  const [dashboardsExpandidos, setDashboardsExpandidos] = useState(false);

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
    console.log(`🖱️ [CLICK] Abrindo card de detalhes (${tipo}) para: ${entidade.nome} (ID: ${entidade.id}), filtroPrincipal: ${filtroPrincipal}`);

    if (e) {
      e.preventDefault();
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

    // Dados em cache (do POST inicial com incluir_detalhes=false ou de uma abertura anterior)
    const cardData = cardsPorEntidade[String(entidade.id)];
    const listaPreloaded = cardData?.detalhes?.[tipo];
    if (listaPreloaded && Array.isArray(listaPreloaded) && listaPreloaded.length > 0) {
      const registros = listaPreloaded.map(item => {
        const base = {
          id: item.id,
          originalId: item.original_id ?? item.id,
          nome: item.nome,
          total_estimado_ms: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
          total_realizado_ms: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
          tempoEstimado: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
          tempoRealizado: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
          custo_estimado: item.custo_estimado ?? 0
        };
        // Para tarefas: preservar clientes aninhados para exibir registros
        if (tipo === 'tarefas' && item.clientes && Array.isArray(item.clientes)) {
          base.clientes = item.clientes.map(c => ({
            id: c.id,
            cliente_id: c.cliente_id ?? c.id,
            nome: c.nome,
            tempoRealizado: c.total_realizado_ms ?? 0,
            total_realizado_ms: c.total_realizado_ms ?? 0,
            registros: []
          }));
        }
        return base;
      });
      setDetailCard({
        entidadeId: String(entidade.id),
        tipo,
        dados: { registros, preloaded: true }
      });
      return;
    }

    // Detalhes sob demanda: mesmo endpoint e lógica para todos os agrupadores.
    // Com agrupador Tipo de Tarefa: POST tipo-tarefa/detalhes com tipo_detalhe = tarefas | clientes | produtos | responsaveis.
    const tipoDetalheParaApi = ['tarefas', 'clientes', 'produtos', 'responsaveis'].includes(tipo) ? tipo : null;
    if (tipoDetalheParaApi && filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim && filtroPrincipal === 'tipoTarefa') {
      setDetailCard({
        entidadeId: String(entidade.id),
        tipo,
        dados: { registros: [], loading: true }
      });
      try {
        const res = await fetch(`${API_BASE_URL}/gestao-capacidade/cards/tipo-tarefa/detalhes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: entidade.id,
            data_inicio: filtrosUltimosAplicados.periodoInicio,
            data_fim: filtrosUltimosAplicados.periodoFim,
            considerar_finais_semana: !!filtrosUltimosAplicados.habilitarFinaisSemana,
            considerar_feriados: !!filtrosUltimosAplicados.habilitarFeriados,
            filtros_adicionais: (() => {
              const fa = filtrosUltimosAplicados.filtrosAdicionais || {};
              const toArr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
              return { cliente_id: toArr(fa.cliente), produto_id: toArr(fa.produto), tarefa_id: toArr(fa.tarefa) };
            })(),
            tipo_detalhe: tipoDetalheParaApi
          })
        });
        const result = await res.json();
        const arr = result?.data ?? [];
        const registros = Array.isArray(arr) ? arr.map(item => {
          const base = {
            id: item.id,
            originalId: item.original_id ?? item.id,
            nome: item.nome,
            total_estimado_ms: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
            total_realizado_ms: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
            tempoEstimado: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
            tempoRealizado: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
            custo_estimado: item.custo_estimado ?? 0
          };
          if (tipoDetalheParaApi === 'tarefas' && item.clientes && Array.isArray(item.clientes)) {
            base.clientes = item.clientes.map(c => ({
              id: c.id,
              cliente_id: c.cliente_id ?? c.id,
              nome: c.nome,
              tempoRealizado: c.total_realizado_ms ?? 0,
              total_realizado_ms: c.total_realizado_ms ?? 0,
              registros: []
            }));
          }
          return base;
        }) : [];
        setCardsPorEntidade(prev => ({
          ...prev,
          [String(entidade.id)]: {
            ...prev[String(entidade.id)],
            detalhes: { ...(prev[String(entidade.id)]?.detalhes || {}), [tipo]: arr }
          }
        }));
        setDetailCard(prev => prev && String(prev.entidadeId) === String(entidade.id) ? { ...prev, dados: { registros, preloaded: true } } : prev);
      } catch (err) {
        console.error('Erro ao buscar detalhes do card (tipo-tarefa):', err);
        setDetailCard(prev => prev && String(prev.entidadeId) === String(entidade.id) ? { ...prev, dados: { registros: [], loading: false } } : prev);
      }
      return;
    }

    if (tipoDetalheParaApi && filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim && filtroPrincipal !== 'tipoTarefa') {
      const endpointTipo = filtroPrincipal === 'atividade' ? 'tarefa' : filtroPrincipal;
      setDetailCard({
        entidadeId: String(entidade.id),
        tipo,
        dados: { registros: [], loading: true }
      });
      try {
        const res = await fetch(`${API_BASE_URL}/gestao-capacidade/cards/${endpointTipo}/detalhes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: entidade.id,
            data_inicio: filtrosUltimosAplicados.periodoInicio,
            data_fim: filtrosUltimosAplicados.periodoFim,
            considerar_finais_semana: !!filtrosUltimosAplicados.habilitarFinaisSemana,
            considerar_feriados: !!filtrosUltimosAplicados.habilitarFeriados,
            filtros_adicionais: (() => {
              const fa = filtrosUltimosAplicados.filtrosAdicionais || {};
              const toArr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
              return { cliente_id: toArr(fa.cliente), produto_id: toArr(fa.produto), tarefa_id: toArr(fa.tarefa) };
            })(),
            tipo_detalhe: tipoDetalheParaApi
          })
        });
        const result = await res.json();
        const arr = result?.data ?? (result?.detalhes?.[tipoDetalheParaApi]) ?? [];
        const registros = Array.isArray(arr) ? arr.map(item => {
          const base = {
            id: item.id,
            originalId: item.original_id ?? item.id,
            nome: item.nome,
            total_estimado_ms: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
            total_realizado_ms: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
            tempoEstimado: item.total_estimado_ms ?? item.tempoEstimado ?? 0,
            tempoRealizado: item.total_realizado_ms ?? item.tempoRealizado ?? 0,
            custo_estimado: item.custo_estimado ?? 0
          };
          // Para tarefas: preservar clientes aninhados para exibir registros
          if (tipoDetalheParaApi === 'tarefas' && item.clientes && Array.isArray(item.clientes)) {
            base.clientes = item.clientes.map(c => ({
              id: c.id,
              cliente_id: c.cliente_id ?? c.id,
              nome: c.nome,
              tempoRealizado: c.total_realizado_ms ?? 0,
              total_realizado_ms: c.total_realizado_ms ?? 0,
              registros: []
            }));
          }
          return base;
        }) : [];
        setCardsPorEntidade(prev => ({
          ...prev,
          [String(entidade.id)]: {
            ...prev[String(entidade.id)],
            detalhes: { ...(prev[String(entidade.id)]?.detalhes || {}), [tipo]: arr }
          }
        }));
        setDetailCard(prev => prev && String(prev.entidadeId) === String(entidade.id) ? { ...prev, dados: { registros, preloaded: true } } : prev);
      } catch (err) {
        console.error('Erro ao buscar detalhes do card:', err);
        setDetailCard(prev => prev && String(prev.entidadeId) === String(entidade.id) ? { ...prev, dados: { registros: [], loading: false } } : prev);
      }
      return;
    }

    // Fallback: garantir que os detalhes das regras relacionadas estejam explodidos
    // Mesma lógica dos outros detalhes: só carregar o que for necessário ao abrir. Para "Tipos de Tarefa", a lista de nomes (tiposTarefa) é carregada aqui sob demanda, não ao mudar o agrupador.
    if (tipo === 'tipos_tarefa' && tiposTarefa.length === 0) {
      loadTiposTarefa();
    }
    // Filtrar agrupamentos que pertencem a esta entidade
    const agrupamentosRelacionados = registrosAgrupados.filter(agr => {
      const p = agr.primeiroRegistro;
      if (filtroPrincipal === 'responsavel') return String(p.responsavel_id) === String(entidade.id);
      if (filtroPrincipal === 'cliente') {
        const cids = String(p.cliente_id || '').split(',').map(id => id.trim());
        return cids.includes(String(entidade.id));
      }
      if (filtroPrincipal === 'produto') return String(p.produto_id) === String(entidade.id);
      if (filtroPrincipal === 'atividade') return String(p.tarefa_id) === String(entidade.id);
      if (filtroPrincipal === 'tipoTarefa') return (agr.regras || [p]).some(r => r && String(r.tipo_tarefa_id) === String(entidade.id));
      return false;
    });

    // Se houver agrupamentos relacionados sem detalhes, explodir
    const promessasExplosao = [];
    agrupamentosRelacionados.forEach(agr => {
      if (!agr.detalhesCarregados) {
        // [BATCH-FIX] Passar false para updateState
        promessasExplosao.push(fetchDetalhesResponsavel(agr.agrupador_id, false));
      }
    });

    // [OPTIMISTIC UI]
    // 1. Abrir o card IMEDIATAMENTE com o que temos (ou estado de loading)
    // Isso resolve a sensação de "travamento" ao clicar

    // Tentar buscar detalhes iniciais (se já existirem)
    let detalhesIniciais = [];
    try {
      detalhesIniciais = buscarDetalhesFn(entidade.id, filtroPrincipal, registrosAgrupados) || [];
      // Garantir que é um array
      if (!Array.isArray(detalhesIniciais)) {
        detalhesIniciais = [];
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes iniciais:', err);
      detalhesIniciais = [];
    }

    // Abrir card já (mesmo padrão dos outros detalhes: abrir com dados iniciais e, se houver explosão, loading até concluir)
    setDetailCard({
      entidadeId: String(entidade.id),
      tipo: tipo,
      dados: {
        registros: detalhesIniciais,
        loading: promessasExplosao.length > 0 // Flag para mostrar spinner no card se necessário
      }
    });

    // Seguir o mesmo padrão dos outros detalhes: cachear no cardsPorEntidade para próxima abertura usar listaPreloaded
    if (tipo === 'tipos_tarefa' && Array.isArray(detalhesIniciais)) {
      setCardsPorEntidade(prev => ({
        ...prev,
        [String(entidade.id)]: {
          ...prev[String(entidade.id)],
          detalhes: { ...(prev[String(entidade.id)]?.detalhes || {}), [tipo]: detalhesIniciais }
        }
      }));
    }

    if (promessasExplosao.length > 0) {
      console.log(`⚡ [HANDLE-OPEN-CARD] Explodindo ${promessasExplosao.length} grupo(s) de dados em background...`);

      // NÃO usar await aqui para não bloquear a UI
      executeHighPriority(async () => {
        // [BATCH-FIX] Usar updateState=false para não atualizar o state 23 vezes
        const results = await Promise.all(promessasExplosao);

        console.log(`✅ [HANDLE-OPEN-CARD] Explosão em lote concluída. Consolidando atualizações...`);

        // Coletar resultados válidos
        const novosDadosMap = new Map();
        results.forEach(res => {
          if (res && res.sucesso && res.agrupadorId) {
            novosDadosMap.set(res.agrupadorId, res.registros);
          }
        });

        // Atualização ÚNICA do state principal
        setRegistrosAgrupados(prev => {
          const novoArray = [...prev];
          let mudou = false;

          novoArray.forEach((grupo, idx) => {
            if (novosDadosMap.has(grupo.agrupador_id)) {
              novoArray[idx] = {
                ...grupo,
                registros: novosDadosMap.get(grupo.agrupador_id),
                quantidade: novosDadosMap.get(grupo.agrupador_id).length,
                detalhesCarregados: true
              };
              mudou = true;
            }
          });

          if (mudou) {
            // Agora que atualizamos o global, atualizamos o card (dentro deste callback para garantir dados frescos)
            // Como setRegistrosAgrupados dispara re-render, o cardDetail (se estivesse lendo state) atualizaria
            // Mas como setDetailCard é local, fazemos update manual aqui

            // Recalcular detalhes COM OS DADOS FRESCOS QUE ACABAMOS DE CRIAR (novoArray)
            let detalhesFrescos = [];
            try {
              detalhesFrescos = buscarDetalhesFn(entidade.id, filtroPrincipal, novoArray) || [];
              // Garantir que é um array
              if (!Array.isArray(detalhesFrescos)) {
                detalhesFrescos = [];
              }
            } catch (err) {
              console.error('Erro ao recalcular detalhes frescos:', err);
              detalhesFrescos = [];
            }

            setDetailCard(prevCard => {
              // Só atualiza se o card ainda estiver aberto no mesmo ID (comparação normalizada)
              if (prevCard && String(prevCard.entidadeId) === String(entidade.id)) {
                return {
                  ...prevCard,
                  dados: {
                    registros: detalhesFrescos,
                    loading: false // Remove loading spinner
                  }
                };
              }
              return prevCard;
            });

            // Atualizar cache de detalhes (mesmo padrão: ao obter dados frescos, guardar para próxima abertura)
            if (tipo === 'tipos_tarefa' && Array.isArray(detalhesFrescos)) {
              setCardsPorEntidade(prev => ({
                ...prev,
                [String(entidade.id)]: {
                  ...prev[String(entidade.id)],
                  detalhes: { ...(prev[String(entidade.id)]?.detalhes || {}), [tipo]: detalhesFrescos }
                }
              }));
            }

            return novoArray;
          }
          return prev;
        });
      }); // Fim executeHighPriority
    }

    // Buscar detalhes usando a lista mais recente do state (ou recalculada se necessário)
    // Nota: Como o setRegistrosAgrupados é assíncrono, idealmente buscarDetalhesPorTipo 
    // deveria receber os dados já processados. Mas o simplificado aqui é esperar o re-render
    // ou usar os dados que acabaram de ser persistidos no closure se possível.
    // Por ora, vamos re-buscar do state atualizado.

    // Pequeno delay para garantir que o state de registrosAgrupados tenha processado
    await new Promise(resolve => setTimeout(resolve, 10));

    // Re-obter registrosAgrupados do state (via callback ou ref se necessário)
    // Mas aqui vamos usar o que vier na próxima renderização ou tentar buscar de novo
    const detalhes = buscarDetalhesFn(entidade.id, filtroPrincipal, registrosAgrupados);

    // Lógica antiga de abrir após esperar removida
    // O card já foi aberto no bloco otimista acima
  };

  // Handler para abrir card de tarefas (EXATAMENTE como handleOpenContas)
  const handleOpenTarefas = (entidade, e) => {
    handleOpenCard(entidade, 'tarefas', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tarefas', agrs));
  };

  // Fechar DetailSideCard (EXATAMENTE como na referência)
  const handleCloseDetail = () => {
    setDetailCard(null);
    setDetailCardPosition(null);
  };

  // Obter conjunto de datas válidas (considerando opções e datas individuais) para os dashboards
  const datasValidasDashboards = useMemo(() => {
    if (!filtrosUltimosAplicados?.periodoInicio || !filtrosUltimosAplicados?.periodoFim) return new Set();
    console.log('📅 [DASHBOARDS] Recalculando datas válidas para o período:', filtrosUltimosAplicados.periodoInicio, 'até', filtrosUltimosAplicados.periodoFim);
    return obterDatasValidasNoPeriodo(
      filtrosUltimosAplicados.periodoInicio,
      filtrosUltimosAplicados.periodoFim,
      filtrosUltimosAplicados.habilitarFinaisSemana ?? false,
      filtrosUltimosAplicados.habilitarFeriados ?? false,
      filtrosUltimosAplicados.datasIndividuais ?? []
    );
  }, [filtrosUltimosAplicados]);

  // Função auxiliar para verificar se uma data está no período aplicado
  const isDataNoPeriodoAplicado = useCallback((dataRegistro) => {
    if (!filtrosUltimosAplicados?.periodoInicio || !filtrosUltimosAplicados?.periodoFim || !dataRegistro) return true;
    if (datasValidasDashboards.size === 0) return false;

    try {
      let dataStr;
      if (typeof dataRegistro === 'string') {
        dataStr = dataRegistro.split('T')[0];
      } else if (dataRegistro instanceof Date) {
        const year = dataRegistro.getFullYear();
        const month = String(dataRegistro.getMonth() + 1).padStart(2, '0');
        const day = String(dataRegistro.getDate()).padStart(2, '0');
        dataStr = `${year}-${month}-${day}`;
      } else {
        const dataReg = new Date(dataRegistro);
        const year = dataReg.getFullYear();
        const month = String(dataReg.getMonth() + 1).padStart(2, '0');
        const day = String(dataReg.getDate()).padStart(2, '0');
        dataStr = `${year}-${month}-${day}`;
      }

      if (!dataStr || !dataStr.match(/^\d{4}-\d{2}-\d{2}/)) return false;
      return datasValidasDashboards.has(dataStr);
    } catch (error) {
      console.error('Erro ao verificar data:', error);
      return false;
    }
  }, [datasValidasDashboards, filtrosUltimosAplicados]);

  // Função para calcular estatísticas de uma entidade
  const calcularEstatisticasPorEntidade = useCallback((entidadeId, tipoEntidade, agrupamentos) => {
    const agrupamentosFiltrados = agrupamentos.filter(agr => {
      const primeiroRegistro = agr.primeiroRegistro;
      if (tipoEntidade === 'responsavel') return String(primeiroRegistro.responsavel_id) === String(entidadeId);
      if (tipoEntidade === 'cliente') {
        const cids = String(primeiroRegistro.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        return cids.includes(String(entidadeId));
      }
      if (tipoEntidade === 'produto') return String(primeiroRegistro.produto_id) === String(entidadeId);
      if (tipoEntidade === 'atividade') return String(primeiroRegistro.tarefa_id) === String(entidadeId);
      if (tipoEntidade === 'tipoTarefa') return (agr.regras || [primeiroRegistro]).some(r => r && String(r.tipo_tarefa_id) === String(entidadeId));
      return false;
    });

    const tarefasUnicas = new Set();
    const produtosUnicos = new Set();
    const clientesUnicos = new Set();
    const responsaveisUnicos = new Set();
    const tiposTarefaUnicos = new Set();

    const filtrosAds = filtrosUltimosAplicados?.filtrosAdicionais || {};
    const fCliente = filtrosAds.cliente || filtroAdicionalCliente;
    const fTarefa = filtrosAds.tarefa || filtroAdicionalTarefa;
    const fProduto = filtrosAds.produto || filtroAdicionalProduto;

    agrupamentosFiltrados.forEach(agr => {
      const fonteDados = (agr.registros && agr.registros.length > 0) ? agr.registros : (agr.regras || []);
      const registrosFiltrados = (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim && agr.registros && agr.registros.length > 0)
        ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data))
        : fonteDados;

      registrosFiltrados.forEach(reg => {
        let deveIncluir = true;
        if (fCliente && reg.cliente_id) {
          const cids = String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
          const fCids = Array.isArray(fCliente) ? fCliente.map(id => String(id).trim()) : [String(fCliente).trim()];
          deveIncluir = deveIncluir && cids.some(id => fCids.includes(id));
        }
        if (fTarefa && reg.tarefa_id) {
          const fTids = Array.isArray(fTarefa) ? fTarefa.map(id => String(id).trim()) : [String(fTarefa).trim()];
          deveIncluir = deveIncluir && fTids.includes(String(reg.tarefa_id).trim());
        }
        if (fProduto && reg.produto_id) {
          const fPids = Array.isArray(fProduto) ? fProduto.map(id => String(id).trim()) : [String(fProduto).trim()];
          deveIncluir = deveIncluir && fPids.includes(String(reg.produto_id).trim());
        }

        if (deveIncluir) {
          let pertence = true;
          if (tipoEntidade === 'cliente') {
            const cids = String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
            pertence = cids.includes(String(entidadeId));
          } else if (tipoEntidade === 'responsavel') pertence = String(reg.responsavel_id) === String(entidadeId);
          else if (tipoEntidade === 'produto') pertence = String(reg.produto_id) === String(entidadeId);
          else if (tipoEntidade === 'atividade') pertence = String(reg.tarefa_id) === String(entidadeId);
          else if (tipoEntidade === 'tipoTarefa') pertence = String(reg.tipo_tarefa_id) === String(entidadeId);

          if (pertence) {
            // Para tipoTarefa: contar apenas tarefa_id único (não combinação tarefa+cliente+produto)
            if (reg.tarefa_id) {
              if (tipoEntidade === 'tipoTarefa') {
                tarefasUnicas.add(String(reg.tarefa_id));
              } else {
                tarefasUnicas.add(`${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`);
              }
            }
            if (reg.produto_id) produtosUnicos.add(String(reg.produto_id));
            if (reg.cliente_id) {
              String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0).forEach(id => clientesUnicos.add(id));
            }
            if (reg.responsavel_id) responsaveisUnicos.add(String(reg.responsavel_id));
            if (reg.tipo_tarefa_id != null) tiposTarefaUnicos.add(String(reg.tipo_tarefa_id));
          }
        }
      });
    });

    return { totalTarefas: tarefasUnicas.size, totalProdutos: produtosUnicos.size, totalClientes: clientesUnicos.size, totalResponsaveis: responsaveisUnicos.size, totalTiposTarefa: tiposTarefaUnicos.size };
  }, [filtrosUltimosAplicados, filtroAdicionalCliente, filtroAdicionalTarefa, filtroAdicionalProduto, isDataNoPeriodoAplicado]);

  // Função para buscar detalhes por tipo
  const buscarDetalhesPorTipo = useCallback((entidadeId, tipoEntidade, tipoDetalhe, agrupamentos) => {
    const agrupamentosFiltrados = agrupamentos.filter(agr => {
      const p = agr.primeiroRegistro;
      if (tipoEntidade === 'responsavel') return String(p.responsavel_id) === String(entidadeId);
      if (tipoEntidade === 'cliente') {
        const cids = String(p.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        return cids.includes(String(entidadeId));
      }
      if (tipoEntidade === 'produto') return String(p.produto_id) === String(entidadeId);
      if (tipoEntidade === 'atividade') return String(p.tarefa_id) === String(entidadeId);
      if (tipoEntidade === 'tipoTarefa') return (agr.regras || [p]).some(r => r && String(r.tipo_tarefa_id) === String(entidadeId));
      return false;
    });

    if (tipoDetalhe === 'tarefas') {
      const tarefasMap = new Map();
      agrupamentosFiltrados.forEach(agr => {
        let regs = (agr.registros && agr.registros.length > 0)
          ? (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data)) : agr.registros)
          : (agr.regras || []);
        if (tipoEntidade === 'tipoTarefa') regs = regs.filter(reg => reg && String(reg.tipo_tarefa_id) === String(entidadeId));

        regs.forEach(reg => {
          if (!reg.tarefa_id) return;
          if (tipoEntidade === 'cliente') {
            const cids = String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
            if (!cids.includes(String(entidadeId))) return;
          }
          const compositeKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
          if (!tarefasMap.has(compositeKey)) {
            tarefasMap.set(compositeKey, {
              id: compositeKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id),
              tipo: 'tarefa', tempoRealizado: 0, tempoEstimado: 0,
              responsavelId: reg.responsavel_id || null, clienteId: reg.cliente_id || null, registros: []
            });
          }
          const tarefa = tarefasMap.get(compositeKey);
          const tEstimado = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
          tarefa.tempoEstimado += tEstimado;
          tarefa.registros.push({ ...reg, tempoRealizado: 0 });
        });
      });
      return Array.from(tarefasMap.values());
    }

    if (tipoDetalhe === 'clientes') {
      const clientesMap = new Map();
      agrupamentosFiltrados.forEach(agr => {
        let regs = (agr.registros && agr.registros.length > 0)
          ? (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data)) : agr.registros)
          : (agr.regras || []);
        if (tipoEntidade === 'tipoTarefa') regs = regs.filter(reg => reg && String(reg.tipo_tarefa_id) === String(entidadeId));

        regs.forEach(reg => {
          if (!reg.cliente_id) return;
          const cids = String(reg.cliente_id).split(',').map(id => id.trim()).filter(id => id.length > 0);
          cids.forEach(cid => {
            if (!clientesMap.has(cid)) {
              clientesMap.set(cid, {
                id: cid, nome: getNomeCliente(cid), tipo: 'cliente', tempoRealizado: 0, tempoEstimado: 0,
                responsavelId: reg.responsavel_id || entidadeId, tarefas: new Map(), registros: []
              });
            }
            const cliente = clientesMap.get(cid);
            const tEstimado = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
            cliente.tempoEstimado += tEstimado;
            if (reg.tarefa_id) {
              const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
              if (!cliente.tarefas.has(compKey)) {
                cliente.tarefas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id), tempoRealizado: 0, tempoEstimado: 0, responsavelId: reg.responsavel_id || entidadeId, registros: [] });
              }
              const tarefa = cliente.tarefas.get(compKey);
              tarefa.tempoEstimado += tEstimado;
              tarefa.registros.push({ ...reg, tempoRealizado: 0 });
            }
            cliente.registros.push({ ...reg, tempoRealizado: 0 });
          });
        });
      });
      return Array.from(clientesMap.values()).map(c => ({ ...c, tarefas: Array.from(c.tarefas.values()) }));
    }

    if (tipoDetalhe === 'produtos') {
      const produtosMap = new Map();
      const isFiltroPaiCliente = tipoEntidade === 'cliente';
      agrupamentosFiltrados.forEach(agr => {
        let regs = (agr.registros && agr.registros.length > 0)
          ? (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data)) : agr.registros)
          : (agr.regras || []);
        if (tipoEntidade === 'tipoTarefa') regs = regs.filter(reg => reg && String(reg.tipo_tarefa_id) === String(entidadeId));
        regs.forEach(reg => {
          if (!reg.produto_id) return;
          if (isFiltroPaiCliente) {
            const cids = String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
            if (!cids.includes(String(entidadeId))) return;
          }
          const pid = String(reg.produto_id).trim();
          if (!produtosMap.has(pid)) {
            produtosMap.set(pid, { id: pid, nome: getNomeProduto(reg.produto_id), tipo: 'produto', tempoRealizado: 0, tempoEstimado: 0, responsavelId: reg.responsavel_id || entidadeId, clientes: isFiltroPaiCliente ? null : new Map(), tarefas: isFiltroPaiCliente ? new Map() : null, registros: [] });
          }
          const produto = produtosMap.get(pid);
          const tEstimado = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
          produto.tempoEstimado += tEstimado;
          if (isFiltroPaiCliente) {
            const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
            if (!produto.tarefas.has(compKey)) {
              produto.tarefas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id), tempoRealizado: 0, tempoEstimado: 0, responsavelId: reg.responsavel_id || entidadeId, registros: [] });
            }
            const tarefa = produto.tarefas.get(compKey);
            tarefa.tempoEstimado += tEstimado;
            tarefa.registros.push({ ...reg, tempoRealizado: 0 });
          } else if (reg.cliente_id) {
            const cids = String(reg.cliente_id).split(',').map(id => id.trim()).filter(id => id.length > 0);
            cids.forEach(cid => {
              if (!produto.clientes.has(cid)) {
                produto.clientes.set(cid, { id: cid, nome: getNomeCliente(cid), tempoRealizado: 0, tempoEstimado: 0, tarefas: new Map(), registros: [] });
              }
              const cliente = produto.clientes.get(cid);
              cliente.tempoEstimado += tEstimado;
              if (reg.tarefa_id) {
                const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
                if (!cliente.tarefas.has(compKey)) {
                  cliente.tarefas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id), tempoRealizado: 0, tempoEstimado: 0, responsavelId: reg.responsavel_id || entidadeId, registros: [] });
                }
                const tarefa = cliente.tarefas.get(compKey);
                tarefa.tempoEstimado += tEstimado;
                tarefa.registros.push({ ...reg, tempoRealizado: 0 });
              }
              cliente.registros.push({ ...reg, tempoRealizado: 0 });
            });
          }
          produto.registros.push({ ...reg, tempoRealizado: 0 });
        });
      });
      return Array.from(produtosMap.values()).map(p => ({
        ...p,
        clientes: p.clientes ? Array.from(p.clientes.values()).map(c => ({ ...c, tarefas: Array.from(c.tarefas.values()) })) : null,
        tarefas: p.tarefas ? Array.from(p.tarefas.values()) : null
      }));
    }

    if (tipoDetalhe === 'responsaveis') {
      const respMap = new Map();
      const isFiltroPaiCliente = tipoEntidade === 'cliente';
      agrupamentosFiltrados.forEach(agr => {
        let regs = (agr.registros && agr.registros.length > 0)
          ? (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data)) : agr.registros)
          : (agr.regras || []);
        if (tipoEntidade === 'tipoTarefa') regs = regs.filter(reg => reg && String(reg.tipo_tarefa_id) === String(entidadeId));
        regs.forEach(reg => {
          if (!reg.responsavel_id) return;
          if (isFiltroPaiCliente) {
            const cids = String(reg.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
            if (!cids.includes(String(entidadeId))) return;
          }
          const rid = String(reg.responsavel_id).trim();
          if (!respMap.has(rid)) {
            respMap.set(rid, { id: rid, nome: getNomeColaborador(reg.responsavel_id), tipo: 'responsavel', tempoRealizado: 0, tempoEstimado: 0, responsavelId: rid, produtos: new Map(), registros: [] });
          }
          const resp = respMap.get(rid);
          const tEstimado = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
          resp.tempoEstimado += tEstimado;
          if (reg.produto_id) {
            const pid = String(reg.produto_id).trim();
            if (!resp.produtos.has(pid)) {
              resp.produtos.set(pid, { id: pid, nome: getNomeProduto(reg.produto_id), tempoRealizado: 0, tempoEstimado: 0, clientes: isFiltroPaiCliente ? null : new Map(), tarefas: isFiltroPaiCliente ? new Map() : null, registros: [] });
            }
            const prod = resp.produtos.get(pid);
            prod.tempoEstimado += tEstimado;
            if (isFiltroPaiCliente) {
              const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
              if (!prod.tarefas.has(compKey)) {
                prod.tarefas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id), tempoRealizado: 0, tempoEstimado: 0, responsavelId: rid, registros: [] });
              }
              const tarefa = prod.tarefas.get(compKey);
              tarefa.tempoEstimado += tEstimado;
              tarefa.registros.push({ ...reg, tempoRealizado: 0 });
            } else if (reg.cliente_id) {
              const cids = String(reg.cliente_id).split(',').map(id => id.trim()).filter(id => id.length > 0);
              cids.forEach(cid => {
                if (!prod.clientes.has(cid)) {
                  prod.clientes.set(cid, { id: cid, nome: getNomeCliente(cid), tempoRealizado: 0, tempoEstimado: 0, tarefas: new Map(), registros: [] });
                }
                const cliente = prod.clientes.get(cid);
                cliente.tempoEstimado += tEstimado;
                if (reg.tarefa_id) {
                  const compKey = `${reg.tarefa_id}_${reg.cliente_id || 'sem_cliente'}_${reg.produto_id || 'sem_produto'}`;
                  if (!cliente.tarefas.has(compKey)) {
                    cliente.tarefas.set(compKey, { id: compKey, originalId: String(reg.tarefa_id), nome: getNomeTarefa(reg.tarefa_id), tempoRealizado: 0, tempoEstimado: 0, responsavelId: rid, registros: [] });
                  }
                  const tarefa = cliente.tarefas.get(compKey);
                  tarefa.tempoEstimado += tEstimado;
                  tarefa.registros.push({ ...reg, tempoRealizado: 0 });
                }
                cliente.registros.push({ ...reg, tempoRealizado: 0 });
              });
            }
            prod.registros.push({ ...reg, tempoRealizado: 0 });
          }
          resp.registros.push({ ...reg, tempoRealizado: 0 });
        });
      });
      return Array.from(respMap.values()).map(r => ({
        ...r,
        produtos: Array.from(r.produtos.values()).map(p => ({
          ...p,
          clientes: p.clientes ? Array.from(p.clientes.values()).map(c => ({ ...c, tarefas: Array.from(c.tarefas.values()) })) : null,
          tarefas: p.tarefas ? Array.from(p.tarefas.values()) : null
        }))
      }));
    }

    if (tipoDetalhe === 'tiposTarefa') {
      const tiposMap = new Map();
      agrupamentosFiltrados.forEach(agr => {
        let regs = (agr.registros && agr.registros.length > 0)
          ? (filtrosUltimosAplicados?.periodoInicio && filtrosUltimosAplicados?.periodoFim ? agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data)) : agr.registros)
          : (agr.regras || []);
        regs.forEach(reg => {
          const tipoId = reg.tipo_tarefa_id != null ? String(reg.tipo_tarefa_id) : null;
          if (!tipoId) return;
          const tipoNome = (tiposTarefa || []).find(t => String(t.id) === tipoId)?.nome || `Tipo #${tipoId}`;
          if (!tiposMap.has(tipoId)) {
            tiposMap.set(tipoId, { id: tipoId, nome: tipoNome, tempoEstimado: 0, tempoRealizado: 0, registros: [] });
          }
          const tipo = tiposMap.get(tipoId);
          const tEstimado = reg.tempo_estimado_dia || agr.primeiroRegistro?.tempo_estimado_dia || 0;
          tipo.tempoEstimado += Number(tEstimado) || 0;
          tipo.registros.push({ ...reg, tempoRealizado: 0 });
        });
      });
      return Array.from(tiposMap.values());
    }
    return [];
  }, [filtrosUltimosAplicados, isDataNoPeriodoAplicado, tiposTarefa]);

  // Função para calcular tempo por entidade
  // Helper para converter HH:mm:ss para ms (Seguro para números e strings)
  const timeToMsSafe = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      if (val.includes(':')) {
        const [h, m, s] = val.split(':').map(Number);
        return ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
      }
      return Number(val) || 0;
    }
    return 0;
  };

  // Função para calcular tempo por entidade
  const calcularTempoPorEntidade = useCallback((entidadeId, tipoEntidade, agrupamentos) => {
    if (!filtrosUltimosAplicados?.periodoInicio || !filtrosUltimosAplicados?.periodoFim) return { estimado: 0, realizado: 0, pendente: 0, sobrando: 0, contratado: 0, disponivel: 0 };

    const agrupamentosFiltrados = agrupamentos.filter(agr => {
      const p = agr.primeiroRegistro;
      if (tipoEntidade === 'responsavel') return String(p.responsavel_id) === String(entidadeId);
      if (tipoEntidade === 'cliente') {
        const cids = String(p.cliente_id || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        return cids.includes(String(entidadeId));
      }
      if (tipoEntidade === 'produto') return String(p.produto_id) === String(entidadeId);
      if (tipoEntidade === 'atividade') return String(p.tarefa_id) === String(entidadeId);
      if (tipoEntidade === 'tipoTarefa') return (agr.regras || [p]).some(r => r && String(r.tipo_tarefa_id) === String(entidadeId));
      return false;
    });

    let tempoEstimado = 0;

    // 1. Calcular Tempo Estimado
    const cache = tempoEstimadoTotalPorResponsavel[String(entidadeId)];

    // Se tiver cache (seja responsável, cliente, etc), usar o cache que vem do batch loading
    if (cache !== undefined && cache !== null) {
      tempoEstimado = cache;
    } else if (tipoEntidade === 'responsavel') {
      // Fallback antigo para responsavel se não tiver cache
      // const cache = tempoEstimadoTotalPorResponsavel[String(entidadeId)]; // Removido pois já checamos acima
      // Na verdade, o cache total vindo do backend é sempre mais preciso que a soma parcial
      if (cache !== undefined && cache !== null) {
        tempoEstimado = cache;
      } else {
        // Fallback robusto evitando concatenação de string
        tempoEstimado = agrupamentosFiltrados.reduce((acc, agr) => {
          if (agr.registros) {
            // Se já tem registros (explodidos), soma eles
            return acc + agr.registros.reduce((sum, r) => sum + timeToMsSafe(r.tempo_estimado_dia), 0);
          } else {
            // [FIX-DISCREPANCY] Se não tem registros (estado inicial sem cache), calcular regra * dias
            const valDia = timeToMsSafe(agr.primeiroRegistro?.tempo_estimado_dia);

            // Calcular dias válidos usando as mesmas regras da explosão (respeitando filtros globais)
            // Nota: regra.incluir_... pode não estar disponível aqui no primeiroRegistro se vier flat, mas tentamos
            const p = agr.primeiroRegistro || {};
            // Usar filtros ultimamente aplicados para consistência
            // [FIX-DISCREPANCY] Lógica Restritiva (Global && Rule)
            const globalHabilitarFinaisSemana = filtrosUltimosAplicados?.habilitarFinaisSemana || false;
            const globalHabilitarFeriados = filtrosUltimosAplicados?.habilitarFeriados || false;

            const incluirFinaisSemana = globalHabilitarFinaisSemana && (p.incluir_finais_semana !== false);
            const incluirFeriados = globalHabilitarFeriados && (p.incluir_feriados !== false);

            const dIndividuais = filtrosUltimosAplicados?.datasIndividuais || [];
            const pInicio = filtrosUltimosAplicados?.periodoInicio;
            const pFim = filtrosUltimosAplicados?.periodoFim;

            const dias = calcularDiasComOpcoesEDatasIndividuais(pInicio, pFim, incluirFinaisSemana, incluirFeriados, dIndividuais);
            return acc + (valDia * dias);
          }
        }, 0);
      }
    } else {
      tempoEstimado = agrupamentosFiltrados.reduce((acc, agr) => {
        if (!agr.registros) return acc;
        const regs = agr.registros.filter(reg => isDataNoPeriodoAplicado(reg.data));

        let regsFiltrados = regs;
        if (tipoEntidade === 'cliente') {
          regsFiltrados = regs.filter(reg => {
            const cids = String(reg.cliente_id || '').split(',').map(id => id.trim());
            return cids.includes(String(entidadeId));
          });
        } else if (tipoEntidade === 'tipoTarefa') {
          regsFiltrados = regs.filter(reg => String(reg.tipo_tarefa_id) === String(entidadeId));
        }

        return acc + regsFiltrados.reduce((sum, reg) => {
          const val = reg.tempo_estimado_dia !== undefined ? reg.tempo_estimado_dia : (agr.primeiroRegistro?.tempo_estimado_dia || 0);
          return sum + timeToMsSafe(val);
        }, 0);
      }, 0);
    }

    const chaveRealizado = `${tipoEntidade}_${String(entidadeId)}`;
    const realData = temposRealizadosPorEntidade[chaveRealizado];

    // [FIX] Fallback para 0 se undefined, para evitar loading eterno, a menos que seja um estado inicial crítico
    // Se temos tempo estimado > 0, provavelmente deveríamos ter realizado carregado ou 0.
    // Retornar null trava a UI em "Carregando...". Assumir 0 é mais seguro para UX.
    if (realData === undefined) {
      // Se não temos dados, retornamos 0 para não travar a UI, exceto se tempoEstimado também for 0 (talvez carregando inicial)
      // Mas para evitar o flicker do "Carregando" quando clica em detalhes, retornamos o que temos.
    }

    const realizado = (realData && (typeof realData === 'number' ? realData : realData.realizado)) || 0;
    const pendente = (realData && (typeof realData === 'number' ? 0 : realData.pendente)) || 0;

    if (tipoEntidade === 'responsavel') {
      const hContratadas = horasContratadasPorResponsavel[String(entidadeId)];
      const tContrato = tipoContratoPorResponsavel[String(entidadeId)];
      const isPJ = tContrato === 2 || tContrato === '2';
      const dias = calcularDiasComOpcoesEDatasIndividuais(filtrosUltimosAplicados.periodoInicio, filtrosUltimosAplicados.periodoFim, filtrosUltimosAplicados.habilitarFinaisSemana, filtrosUltimosAplicados.habilitarFeriados, filtrosUltimosAplicados.datasIndividuais);

      let tContratado = 0;
      if (isPJ) {
        tContratado = tempoEstimado;
      } else {
        tContratado = (hContratadas || 0) * dias * 3600000;
      }

      const tDisponivel = Math.max(0, tContratado - tempoEstimado);
      const tSobrando = tDisponivel; // Simplificação: sobrando = disponível para gastar

      return { disponivel: tDisponivel, estimado: tempoEstimado, realizado, pendente, sobrando: tSobrando, contratado: tContratado };
    }
    return { disponivel: 0, estimado: tempoEstimado, realizado, pendente, sobrando: 0, contratado: 0 };
  }, [filtrosUltimosAplicados, isDataNoPeriodoAplicado, tempoEstimadoTotalPorResponsavel, temposRealizadosPorEntidade, horasContratadasPorResponsavel, tipoContratoPorResponsavel]);

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
    } catch (error) {
      console.error('Erro ao carregar tipos de tarefa:', error);
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
    // Carregar lista de tarefas quando filtro adicional atividade OU quando agrupamento principal é Por Atividade (para nomes nos cards)
    if ((filtros.atividade || filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && tarefas.length === 0) {
      loadTarefas();
    }
  }, [filtros.atividade, filtroPrincipal, tarefas.length]);

  // Lista de tipos de tarefa: carregar só quando o filtro "Definir Tipo de Tarefa" está ativo (dropdown). Detalhes de "Tipos de Tarefa" seguem a mesma lógica dos outros: carregar apenas ao abrir o painel (em handleOpenCard).
  useEffect(() => {
    if (filtros.tipoTarefa && tiposTarefa.length === 0) {
      loadTiposTarefa();
    }
  }, [filtros.tipoTarefa]);

  // Ref para debounce de busca de opções contextuais
  const debouncedBuscarOpcoesRef = useRef(null);

  // Inicializar debounce
  useEffect(() => {
    debouncedBuscarOpcoesRef.current = debounce(async (filtroPaiAtual) => {
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
    }, 300);

    return () => {
      if (debouncedBuscarOpcoesRef.current && debouncedBuscarOpcoesRef.current.cancel) {
        debouncedBuscarOpcoesRef.current.cancel();
      }
    }
  }, [filtros]);

  // Buscar opções contextuais quando um filtro pai for selecionado pela primeira vez
  useEffect(() => {
    if (periodoInicio && periodoFim) {
      const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
      const temFiltrosAdicionais = filtrosAdicionaisAtivos.cliente || filtrosAdicionaisAtivos.tarefa || filtrosAdicionaisAtivos.produto;

      // Se há filtros adicionais ativos e um filtro pai foi selecionado, buscar opções contextuais
      if (temFiltrosAdicionais && filtroPaiAtual) {
        if (debouncedBuscarOpcoesRef.current) {
          debouncedBuscarOpcoesRef.current(filtroPaiAtual);
        }
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
    try {
      if (!responsavelId) return null;

      // Validação: Backend espera Integer
      const idString = String(responsavelId).trim();
      const isInteger = /^\d+$/.test(idString);

      if (!isInteger) {
        console.warn(`⚠️ [BUSCAR-HORAS] ID inválido (não é número): ${responsavelId}`);
        return null;
      }

      const idNum = parseInt(idString, 10);

      const params = new URLSearchParams({
        membro_id: idNum,
      });
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar horas contratadas por responsável:', error);
      return null;
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

    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      if (primeiroRegistro.responsavel_id) {
        responsaveisIds.add(String(primeiroRegistro.responsavel_id));
      }
    });

    if (responsaveisIds.size === 0) return;

    console.log(`📊 [HORAS-CONTRATADAS] Buscando horas contratadas em lote para ${responsaveisIds.size} responsável(is)...`);

    // Limpar cache inicialmente para garantir consistência
    setHorasContratadasPorResponsavel({});
    setTipoContratoPorResponsavel({});

    const ids = Array.from(responsaveisIds);
    // Usar POST para evitar 414 URI Too Long quando há muitos responsáveis
    const payload = { membro_id: ids };
    if (dataFim) payload.data_fim = dataFim;

    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const novasHoras = {};
          const novosContratos = {};
          Object.keys(result.data).forEach(rid => {
            if (result.data[rid]) {
              novasHoras[rid] = result.data[rid].horascontratadasdia;
              novosContratos[rid] = result.data[rid].tipo_contrato;
            }
          });
          setHorasContratadasPorResponsavel(prev => ({ ...prev, ...novasHoras }));
          setTipoContratoPorResponsavel(prev => ({ ...prev, ...novosContratos }));
          console.log(`✅ [HORAS-CONTRATADAS] Carga em lote concluída.`);
        }
      }
    } catch (error) {
      console.error(`❌ [HORAS-CONTRATADAS] Erro ao buscar horas em lote:`, error);
    }
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

  // Função para carregar todos os dados de uma entidade (responsável, cliente, produto, tarefa) de forma sequencial
  const carregarDadosIndividuaisEntidade = async (entidadeId, tipoEntidade, periodoInicio, periodoFim, filtrosAdicionais = {}) => {
    if (!periodoInicio || !periodoFim) return;

    try {
      console.log(`⏳ [QUEUE] Carregando dados para ${tipoEntidade} ${entidadeId}...`);

      // Validação Estrita para Responsáveis: Apenas IDs numéricos permitidos (Regex estrito para não aceitar UUID iniciado com número)
      if (tipoEntidade === 'responsavel') {
        const idString = String(entidadeId).trim();
        const isInteger = /^\d+$/.test(idString);

        // Se não for um número válido, definir estados zerados e não fazer requisições
        if (!isInteger) {
          console.warn(`⚠️ [QUEUE] Ignorando responsável com ID inválido (UUID/String): ${entidadeId}`);
          // Definir estados como zerados/nulos para encerrar loading
          setTempoEstimadoTotalPorResponsavel(prev => ({ ...prev, [entidadeId]: 0 }));
          setTemposRealizadosPorEntidade(prev => ({
            ...prev,
            [`${tipoEntidade}_${entidadeId}`]: { realizado: 0, pendente: 0 }
          }));
          setHorasContratadasPorResponsavel(prev => ({ ...prev, [entidadeId]: null }));
          setTipoContratoPorResponsavel(prev => ({ ...prev, [entidadeId]: null }));
          setCustosPorResponsavel(prev => ({ ...prev, [entidadeId]: 0 }));
          return;
        }
      }

      // 1. Tempo Estimado Total – usar POST para evitar 414 URI Too Long (muitos filtros = URL longa)
      const payloadEstimado = {
        data_inicio: periodoInicio,
        data_fim: periodoFim,
        considerarFinaisDeSemana: habilitarFinaisSemana,
        considerarFeriados: habilitarFeriados
      };
      if (tipoEntidade === 'responsavel') payloadEstimado.responsavel_id = [entidadeId];
      else if (tipoEntidade === 'cliente') payloadEstimado.cliente_id = [entidadeId];
      else if (tipoEntidade === 'produto') payloadEstimado.produto_id = [entidadeId];
      else if (tipoEntidade === 'atividade') payloadEstimado.tarefa_id = [entidadeId];

      if (tipoEntidade !== 'cliente' && (filtrosAdicionais.cliente_id || filtroAdicionalCliente)) {
        const cId = filtrosAdicionais.cliente_id || filtroAdicionalCliente;
        payloadEstimado.cliente_id = Array.isArray(cId) ? cId : [cId];
      }
      if (tipoEntidade !== 'atividade' && (filtrosAdicionais.tarefa_id || filtroAdicionalTarefa)) {
        const tId = filtrosAdicionais.tarefa_id || filtroAdicionalTarefa;
        payloadEstimado.tarefa_id = Array.isArray(tId) ? tId : [tId];
      }
      if (tipoEntidade !== 'produto' && (filtrosAdicionais.produto_id || filtroAdicionalProduto)) {
        const pId = filtrosAdicionais.produto_id || filtroAdicionalProduto;
        payloadEstimado.produto_id = Array.isArray(pId) ? pId : [pId];
      }

      const responseEstimado = await fetch(`${API_BASE_URL}/tempo-estimado/total`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEstimado)
      });

      if (responseEstimado.ok) {
        const result = await responseEstimado.json();
        if (result.success && result.data) {
          setTempoEstimadoTotalPorResponsavel(prev => ({
            ...prev,
            [entidadeId]: result.data[entidadeId] || 0
          }));
        }
      }

      // 2. Tempo Realizado Total
      // [FIX] Erro 400/503: Adicionando guarda para evitar chamadas sem responsavel_id quando não necessário
      const responsavelIdCalculado = tipoEntidade === 'responsavel' ? entidadeId : (filtrosAdicionais.responsavel_id || null);

      if (responsavelIdCalculado) {
        const responseRealizado = await fetch(`${API_BASE_URL}/registro-tempo/realizado-total`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            responsavel_id: responsavelIdCalculado,
            cliente_id: tipoEntidade === 'cliente' ? entidadeId : (filtrosAdicionais.cliente_id || filtroAdicionalCliente || null),
            produto_id: tipoEntidade === 'produto' ? entidadeId : (filtrosAdicionais.produto_id || filtroAdicionalProduto || null),
            tarefa_id: tipoEntidade === 'atividade' ? entidadeId : (filtrosAdicionais.tarefa_id || filtroAdicionalTarefa || null),
            data_inicio: periodoInicio,
            data_fim: periodoFim
          })
        });

        if (responseRealizado.ok) {
          const result = await responseRealizado.json();
          if (result.success && result.data) {
            const chave = `${tipoEntidade}_${entidadeId}`;
            const newRealizado = result.data.tempo_realizado_ms || 0;
            const newPendente = result.data.tempo_pendente_ms || 0;
            setTemposRealizadosPorEntidade(prev => {
              const cur = prev[chave];
              const curRealizado = cur != null ? (typeof cur === 'number' ? cur : (cur.realizado ?? 0)) : 0;
              const curPendente = cur != null && typeof cur === 'object' ? (cur.pendente ?? 0) : 0;
              return {
                ...prev,
                [chave]: {
                  realizado: Math.max(curRealizado, newRealizado),
                  pendente: Math.max(curPendente, newPendente)
                }
              };
            });
          }
        }
      } else {
        // Se não tem responsável: não sobrescrever valor já carregado (ex.: 15s vindo do registro sob demanda)
        setTemposRealizadosPorEntidade(prev => {
          const chave = `${tipoEntidade}_${entidadeId}`;
          const cur = prev[chave];
          const curRealizado = cur != null ? (typeof cur === 'number' ? cur : (cur.realizado ?? 0)) : 0;
          return { ...prev, [chave]: { realizado: Math.max(curRealizado, 0), pendente: 0 } };
        });
      }

      // 3. Horas Contratadas e Custos (Apenas para Responsáveis)
      if (tipoEntidade === 'responsavel') {
        // Horas Contratadas e Tipo Contrato
        const resContratadas = await buscarHorasContratadasPorResponsavel(entidadeId, periodoInicio, periodoFim);
        if (resContratadas) {
          setHorasContratadasPorResponsavel(prev => ({ ...prev, [entidadeId]: resContratadas.horascontratadasdia }));
          setTipoContratoPorResponsavel(prev => ({ ...prev, [entidadeId]: resContratadas.tipo_contrato }));
        } else {
          setHorasContratadasPorResponsavel(prev => ({ ...prev, [entidadeId]: null }));
          setTipoContratoPorResponsavel(prev => ({ ...prev, [entidadeId]: null }));
        }

        // Custo Hora
        const custoHora = await buscarCustoPorResponsavel(entidadeId, periodoInicio, periodoFim);
        setCustosPorResponsavel(prev => ({ ...prev, [entidadeId]: custoHora }));
      }

      console.log(`✅ [QUEUE] Dados carregados para ${tipoEntidade} ${entidadeId}`);
    } catch (error) {
      console.error(`❌ [QUEUE] Erro ao carregar dados para ${tipoEntidade} ${entidadeId}:`, error);
    }
  };

  // [NEW] Função para carregar todos os dados de múltiplas entidades de UMA SÓ VEZ (Batch)
  // Nível 1: Tempo estimado total SEM enviar lista de IDs – backend retorna totais agregados no banco (evita 414/500)
  // Realizado: enviar IDs de ENTIDADE (responsavel_id, cliente_id, etc.), não agrupador_id (UUID)
  const carregarDadosEmLote = async (itens, tipoEntidade, periodoInicio, periodoFim, filtrosAdicionais = {}) => {
    if (!periodoInicio || !periodoFim || !itens || itens.length === 0) return;

    try {
      // IDs de entidade para realizado/custos: backend espera membro id, cliente id, etc. (não agrupador_id UUID)
      const obterIdsEntidade = () => {
        const primeiroOuRegistro = (i) => i.primeiroRegistro ?? i.registros?.[0] ?? i.regras?.[0];
        if (tipoEntidade === 'responsavel') {
          return [...new Set(itens.map(i => primeiroOuRegistro(i)?.responsavel_id).filter(Boolean))].map(String);
        }
        if (tipoEntidade === 'cliente') {
          return [...new Set(itens.flatMap(i => String(primeiroOuRegistro(i)?.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean)))];
        }
        if (tipoEntidade === 'produto') {
          return [...new Set(itens.map(i => primeiroOuRegistro(i)?.produto_id).filter(Boolean))].map(String);
        }
        if (tipoEntidade === 'atividade') {
          return [...new Set(itens.map(i => primeiroOuRegistro(i)?.tarefa_id).filter(Boolean))].map(String);
        }
        return [];
      };
      const entityIds = obterIdsEntidade();
      if (entityIds.length === 0) return;

      // Para custos/horas: membro_id é o mesmo que responsavel_id (membro.id)
      const idsParaCusto = tipoEntidade === 'responsavel' ? entityIds : itens.map(i => i.agrupador_id).filter(id => id !== 'sem-grupo');

      // [FIX] Pré-preencher chaves com 0/null para todos os cards visíveis: assim, responsáveis sem regra
      // (ou cuja API não retornou) exibem o card normalmente com valores "0" em vez de ficar em "Carregando métricas..."
      if (tipoEntidade === 'responsavel') {
        setTempoEstimadoTotalPorResponsavel(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const k = String(id); if (next[k] === undefined) next[k] = 0; });
          return next;
        });
        setTemposRealizadosPorEntidade(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const key = `responsavel_${String(id)}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
          return next;
        });
        setHorasContratadasPorResponsavel(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const k = String(id); if (next[k] === undefined) next[k] = null; });
          return next;
        });
        setTipoContratoPorResponsavel(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const k = String(id); if (next[k] === undefined) next[k] = null; });
          return next;
        });
      }

      // [FIX] Pré-preencher para filtro agrupador Produto (igual ao responsável): evita "Carregando métricas..."
      if (tipoEntidade === 'produto') {
        setTempoEstimadoTotalPorResponsavel(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const k = String(id); if (next[k] === undefined) next[k] = 0; });
          return next;
        });
        setTemposRealizadosPorEntidade(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const key = `produto_${String(id)}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
          return next;
        });
      }

      // [FIX] Pré-preencher para filtro agrupador Atividade (igual ao responsável): evita "Carregando métricas..."
      if (tipoEntidade === 'atividade') {
        setTempoEstimadoTotalPorResponsavel(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const k = String(id); if (next[k] === undefined) next[k] = 0; });
          return next;
        });
        setTemposRealizadosPorEntidade(prev => {
          const next = { ...prev };
          entityIds.forEach(id => { const key = `atividade_${String(id)}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
          return next;
        });
      }

      console.log(`🚀 [BATCH] Iniciando carga em lote de ${entityIds.length} entidades do tipo ${tipoEntidade}...`);

      // 1. Tempo Estimado Total: NÃO enviar IDs – backend agrega em SQL e retorna totais de todas as entidades
      const payloadEstimado = {
        data_inicio: periodoInicio,
        data_fim: periodoFim,
        considerarFinaisDeSemana: !!habilitarFinaisSemana,
        considerarFeriados: !!habilitarFeriados,
        agrupar_por: tipoEntidade === 'atividade' ? 'tarefa' : tipoEntidade
      };
      // Apenas filtros adicionais (não a lista de IDs dos cards)
      const cId = filtrosAdicionais.cliente_id || filtroAdicionalCliente;
      if (cId) payloadEstimado.cliente_id = Array.isArray(cId) ? cId : [cId];
      const tId = filtrosAdicionais.tarefa_id || filtroAdicionalTarefa;
      if (tId) payloadEstimado.tarefa_id = Array.isArray(tId) ? tId : [tId];
      const pId = filtrosAdicionais.produto_id || filtroAdicionalProduto;
      if (pId) payloadEstimado.produto_id = Array.isArray(pId) ? pId : [pId];
      if (filtroStatusCliente && filtroStatusCliente !== 'todos') payloadEstimado.cliente_status = filtroStatusCliente;
      globalRequestPool.add(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/tempo-estimado/total`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payloadEstimado)
          });
          const text = await res.text();
          let result;
          try {
            result = text ? JSON.parse(text) : {};
          } catch {
            if (!res.ok) console.warn('Batch estimado: servidor retornou', res.status, '(ex.: 414 URI Too Long). Use build atualizado com POST.');
            return;
          }
          if (result.success && result.data) {
            setTempoEstimadoTotalPorResponsavel(prev => {
              const next = { ...prev, ...result.data };
              if (tipoEntidade === 'responsavel') {
                entityIds.forEach(id => {
                  const k = String(id);
                  if (next[k] === undefined) next[k] = 0;
                });
              }
              return next;
            });
          }
        } catch (err) {
          console.error('Erro batch estimado:', err);
        }
      });

      // 2. Tempo Realizado Total em Lote
      // Produto: mesmo endpoint do painel de detalhes (por tarefa) e soma por produto, para bater com 4min 1s
      if (tipoEntidade === 'produto') {
        globalRequestPool.add(async () => {
          const extrairTempoRealizadoMs = (result) => {
            if (!result?.success || !result?.data) return 0;
            const d = result.data;
            if (typeof d === 'object' && !Array.isArray(d)) {
              const first = Object.values(d)[0];
              if (first && typeof first.tempo_realizado_ms !== 'undefined') return first.tempo_realizado_ms || 0;
            }
            return d?.tempo_realizado_ms || 0;
          };
          try {
            const realizadosPorProduto = {};
            entityIds.forEach(id => { realizadosPorProduto[String(id)] = 0; });

            for (const productId of entityIds) {
              const productIdStr = String(productId);
              const agrupamentosDoProduto = itens.filter(
                i => String((i.primeiroRegistro ?? i.regras?.[0])?.produto_id) === productIdStr
              );
              const paresRespTarefa = new Set();
              agrupamentosDoProduto.forEach(agr => {
                (agr.regras || []).forEach(regra => {
                  const respId = regra.responsavel_id;
                  const tId = regra.tarefa_id != null ? String(regra.tarefa_id).trim() : '';
                  if (respId && tId && /^\d+$/.test(tId)) paresRespTarefa.add(`${respId}|${tId}`);
                });
              });

              let somaProduto = 0;
              for (const par of paresRespTarefa) {
                const [responsavelId, tarefaId] = par.split('|');
                const res = await fetch(`${API_BASE_URL}/registro-tempo/realizado-total`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    responsavel_id: responsavelId,
                    data_inicio: periodoInicio,
                    data_fim: periodoFim,
                    tarefa_id: tarefaId,
                    cliente_id: null,
                    produto_id: null
                  })
                });
                const result = await res.json();
                somaProduto += extrairTempoRealizadoMs(result);
              }
              realizadosPorProduto[productIdStr] = somaProduto;
            }

            setTemposRealizadosPorEntidade(prev => {
              const next = { ...prev };
              Object.keys(realizadosPorProduto).forEach(id => {
                const key = `produto_${id}`;
                const realizado = realizadosPorProduto[id] || 0;
                const cur = next[key];
                const curPendente = cur != null && typeof cur === 'object' ? (cur.pendente ?? 0) : 0;
                next[key] = { realizado, pendente: curPendente };
              });
              return next;
            });
          } catch (err) {
            console.error('Erro batch realizado (produto):', err);
          }
        });
      } else {
        globalRequestPool.add(async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/registro-tempo/realizado-total`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                responsavel_id: tipoEntidade === 'responsavel' ? entityIds : [],
                cliente_id: tipoEntidade === 'cliente' ? entityIds : (filtrosAdicionais.cliente_id || filtroAdicionalCliente || null),
                produto_id: tipoEntidade === 'produto' ? entityIds : (filtrosAdicionais.produto_id || filtroAdicionalProduto || null),
                tarefa_id: tipoEntidade === 'atividade' ? entityIds : (filtrosAdicionais.tarefa_id || filtroAdicionalTarefa || null),
                data_inicio: periodoInicio,
                data_fim: periodoFim,
                agrupar_por: tipoEntidade === 'atividade' ? 'tarefa' : tipoEntidade
              })
            });
            const text = await res.text();
            let result;
            try {
              result = text ? JSON.parse(text) : {};
            } catch {
              if (!res.ok) console.warn('Batch realizado: servidor retornou', res.status);
              return;
            }
            if (result.success && result.data) {
              setTemposRealizadosPorEntidade(prev => {
                const next = { ...prev };
                Object.keys(result.data).forEach(respId => {
                  const key = `${tipoEntidade}_${String(respId)}`;
                  const newRealizado = result.data[respId].tempo_realizado_ms || 0;
                  const newPendente = result.data[respId].tempo_pendente_ms || 0;
                  const cur = next[key];
                  const curRealizado = cur != null ? (typeof cur === 'number' ? cur : (cur.realizado ?? 0)) : 0;
                  const curPendente = cur != null && typeof cur === 'object' ? (cur.pendente ?? 0) : 0;
                  next[key] = {
                    realizado: Math.max(curRealizado, newRealizado),
                    pendente: Math.max(curPendente, newPendente)
                  };
                });
                if (tipoEntidade === 'responsavel' || tipoEntidade === 'cliente' || tipoEntidade === 'produto' || tipoEntidade === 'atividade') {
                  entityIds.forEach(id => {
                    const key = `${tipoEntidade}_${String(id)}`;
                    if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 };
                  });
                }
                return next;
              });
            }
          } catch (err) {
            console.error('Erro batch realizado:', err);
          }
        });
      }

      // 3. Custos e Horas em Lote (Apenas para Responsáveis) – membro_id = responsavel_id (entidade)
      if (tipoEntidade === 'responsavel') {
        globalRequestPool.add(async () => {
          try {
            const payload = { membro_id: idsParaCusto, data_fim: periodoFim };
            const res = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            const text = await res.text();
            let result;
            try {
              result = text ? JSON.parse(text) : {};
            } catch {
              if (!res.ok) console.warn('Batch horas: servidor retornou', res.status, '(ex.: 414). Use build com POST.');
              return;
            }
            if (result.success && result.data) {
              const novasHoras = {};
              const novosContratos = {};
              Object.keys(result.data).forEach(rid => {
                if (result.data[rid]) {
                  novasHoras[rid] = result.data[rid].horascontratadasdia;
                  novosContratos[rid] = result.data[rid].tipo_contrato;
                }
              });
              setHorasContratadasPorResponsavel(prev => {
                const next = { ...prev, ...novasHoras };
                entityIds.forEach(id => {
                  const k = String(id);
                  if (next[k] === undefined) next[k] = null;
                });
                return next;
              });
              setTipoContratoPorResponsavel(prev => {
                const next = { ...prev, ...novosContratos };
                entityIds.forEach(id => {
                  const k = String(id);
                  if (next[k] === undefined) next[k] = null;
                });
                return next;
              });
            }
          } catch (err) {
            console.error('Erro batch horas:', err);
          }
        });

        // Custos Batch
        globalRequestPool.add(async () => {
          try {
            const payload = { membro_id: idsParaCusto, data_fim: periodoFim };
            const res = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/mais-recente`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            const text = await res.text();
            let result;
            try {
              result = text ? JSON.parse(text) : {};
            } catch {
              if (!res.ok) console.warn('Batch custos: servidor retornou', res.status, '(ex.: 414). Use build com POST.');
              return;
            }
            if (result.success && result.data) {
              const novosCustos = {};
              Object.keys(result.data).forEach(rid => {
                if (result.data[rid]) {
                  const v = result.data[rid];
                  const valorCusto = Number(v.valor) || 0;
                  const custoHora = v.tipo_custo === 'Mensal'
                    ? (valorCusto / (v.horascontratadasdia * 22))
                    : valorCusto;
                  novosCustos[rid] = isNaN(custoHora) ? 0 : custoHora;
                }
              });
              setCustosPorResponsavel(prev => ({ ...prev, ...novosCustos }));
            }
          } catch (err) {
            console.error('Erro batch custos:', err);
          }
        });
      }

      console.log(`✅ [BATCH] Carga em lote disparada com sucesso.`);
    } catch (error) {
      console.error(`❌ [BATCH] Erro ao carregar dados em lote:`, error);
    }
  };

  // Efeito para processar a fila de forma sequencial
  useEffect(() => {
    const processarFila = async () => {
      if (processandoFila || filaProcessamento.length === 0) return;

      setProcessandoFila(true);
      const item = filaProcessamento[0];

      await carregarDadosIndividuaisEntidade(
        item.id,
        item.tipo,
        periodoInicio,
        periodoFim,
        {
          cliente_id: filtroAdicionalCliente,
          tarefa_id: filtroAdicionalTarefa,
          produto_id: filtroAdicionalProduto
        }
      );

      setFilaProcessamento(prev => prev.slice(1));
      setProcessandoFila(false);
    };

    processarFila();
  }, [filaProcessamento, processandoFila, periodoInicio, periodoFim, filtroAdicionalCliente, filtroAdicionalTarefa, filtroAdicionalProduto]);

  // [FIX] Garantir chaves com 0/null para TODOS os membros que podem ter card (incluindo quem não tem regra).
  // Os cards vêm de membros.forEach, não só de agrupamentos; sem isso, responsáveis sem regra ficam em "Carregando métricas...".
  useEffect(() => {
    if (filtroPrincipal !== 'responsavel' || !membros?.length) return;
    const estaNosFiltros = (id, filtroSelecionado) => {
      if (filtroSelecionado == null || filtroSelecionado === undefined) return true;
      const idStr = String(id);
      if (Array.isArray(filtroSelecionado)) return filtroSelecionado.some(f => String(f) === idStr);
      return String(filtroSelecionado) === idStr;
    };
    const ids = membros.filter(m => estaNosFiltros(m.id, filtroResponsavelSelecionado)).map(m => String(m.id));
    if (ids.length === 0) return;

    setTempoEstimadoTotalPorResponsavel(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] === undefined) next[id] = 0; });
      return next;
    });
    setTemposRealizadosPorEntidade(prev => {
      const next = { ...prev };
      ids.forEach(id => { const key = `responsavel_${id}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
      return next;
    });
    setHorasContratadasPorResponsavel(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] === undefined) next[id] = null; });
      return next;
    });
    setTipoContratoPorResponsavel(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] === undefined) next[id] = null; });
      return next;
    });
  }, [filtroPrincipal, membros, filtroResponsavelSelecionado]);

  // [FIX] Garantir chaves com 0 para TODOS os produtos que podem ter card (igual ao responsável).
  // Os cards vêm de produtos.forEach; sem isso, produtos sem estimado/realizado ficam em "Carregando métricas...".
  useEffect(() => {
    if (filtroPrincipal !== 'produto' || !produtos?.length) return;
    const estaNosFiltros = (id, filtroSelecionado) => {
      if (filtroSelecionado == null || filtroSelecionado === undefined) return true;
      const idStr = String(id);
      if (Array.isArray(filtroSelecionado)) return filtroSelecionado.some(f => String(f) === idStr);
      return String(filtroSelecionado) === idStr;
    };
    const ids = produtos.filter(p => estaNosFiltros(p.id, filtroProdutoSelecionado)).map(p => String(p.id));
    if (ids.length === 0) return;

    setTempoEstimadoTotalPorResponsavel(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] === undefined) next[id] = 0; });
      return next;
    });
    setTemposRealizadosPorEntidade(prev => {
      const next = { ...prev };
      ids.forEach(id => { const key = `produto_${id}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
      return next;
    });
  }, [filtroPrincipal, produtos, filtroProdutoSelecionado]);

  // [FIX] Garantir chaves com 0 para TODOS os clientes que podem ter card (igual ao responsável).
  // Os cards vêm de clientes.forEach + entidadesDosRegistros; sem isso, clientes ficam em "Carregando métricas...".
  useEffect(() => {
    if (filtroPrincipal !== 'cliente' || !clientes?.length) return;
    const estaNosFiltros = (id, filtroSelecionado) => {
      if (filtroSelecionado == null || filtroSelecionado === undefined) return true;
      const idStr = String(id);
      if (Array.isArray(filtroSelecionado)) return filtroSelecionado.some(f => String(f) === idStr);
      return String(filtroSelecionado) === idStr;
    };
    const ids = clientes.filter(c => estaNosFiltros(c.id, filtroClienteSelecionado)).map(c => String(c.id));
    if (ids.length === 0) return;

    setTempoEstimadoTotalPorResponsavel(prev => {
      const next = { ...prev };
      ids.forEach(id => { if (next[id] === undefined) next[id] = 0; });
      return next;
    });
    setTemposRealizadosPorEntidade(prev => {
      const next = { ...prev };
      ids.forEach(id => { const key = `cliente_${id}`; if (next[key] === undefined) next[key] = { realizado: 0, pendente: 0 }; });
      return next;
    });
  }, [filtroPrincipal, clientes, filtroClienteSelecionado]);

  // [ON-DEMAND] Função exclusiva para carregar detalhes ao clicar
  // [BATCH-FIX] Adicionado parâmetro updateState para permitir batching e evitar re-renders múltiplos
  const fetchDetalhesResponsavel = async (agrupadorId, updateState = true) => {
    console.log(`⚡ [ON-DEMAND] Buscando detalhes para o grupo ${agrupadorId} ${updateState ? '(Update Direto)' : '(Batch Mode)'}...`);

    const grupo = registrosAgrupados.find(g => g.agrupador_id === agrupadorId);
    if (!grupo) {
      console.warn(`⚠️ [ON-DEMAND] Grupo ${agrupadorId} não encontrado.`);
      return [];
    }

    if (grupo.detalhesCarregados) {
      console.log(`⚡ [ON-DEMAND] Detalhes já carregados. Retornando cache.`);
      return grupo.registros || [];
    }

    console.log(`⚡ [ON-DEMAND] Calculando detalhes...`);
    // [UX] Não usar setLoading(true) para não travar a UI globalmente
    // O loading será local no componente AtribuicoesTabela

    try {
      // 3. Logica de Explosão (movida de loadRegistrosTempoEstimado para cá)
      const registrosCalculados = [];
      const regrasDoGrupo = grupo.regras || [];
      // Usar períodos do state
      const pInicio = periodoInicio;
      const pFim = periodoFim;

      if (pInicio && pFim) {
        regrasDoGrupo.forEach(regra => {
          const regraInicio = regra.data_inicio ? (regra.data_inicio.includes('T') ? regra.data_inicio.split('T')[0] : regra.data_inicio) : pInicio;
          const regraFim = regra.data_fim ? (regra.data_fim.includes('T') ? regra.data_fim.split('T')[0] : regra.data_fim) : pFim;

          const periodoInicioRegra = regraInicio > pInicio ? regraInicio : pInicio;
          const periodoFimRegra = regraFim < pFim ? regraFim : pFim;


          if (periodoInicioRegra <= periodoFimRegra) {
            // [FIX-DISCREPANCY] Lógica Restritiva (Global Filter Ceiling)
            // Lógica: Global && (Regra !== false)
            const incluirFinaisSemana = habilitarFinaisSemana && (regra.incluir_finais_semana !== false);
            const incluirFeriados = habilitarFeriados && (regra.incluir_feriados !== false);

            const datasValidasSet = obterDatasValidasNoPeriodo(
              periodoInicioRegra,
              periodoFimRegra,
              incluirFinaisSemana,
              incluirFeriados,
              datasIndividuais
            );

            datasValidasSet.forEach(dataStr => {

              // ID Virtual único
              const idVirtual = `${regra.id}_${dataStr}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 36);
              registrosCalculados.push({
                id: idVirtual,
                tempo_estimado_id: idVirtual,
                agrupador_id: regra.agrupador_id,
                cliente_id: regra.cliente_id,
                produto_id: regra.produto_id,
                tarefa_id: regra.tarefa_id,
                tipo_tarefa_id: regra.tipo_tarefa_id ?? grupo.primeiroRegistro?.tipo_tarefa_id,
                responsavel_id: regra.responsavel_id,
                data: dataStr.includes('T') ? dataStr : `${dataStr}T00:00:00`,
                tempo_estimado_dia: regra.tempo_estimado_dia,
                responsavel_foto_perfil: regra.responsavel_foto_perfil,
                // Copy fields
                created_at: regra.created_at,
                updated_at: regra.updated_at
              });
            });
          }
        });
      }

      // 4. Carregar metadados (nomes) APENAS para esses registros novos
      if (registrosCalculados.length > 0) {
        await carregarNomesRelacionados(registrosCalculados);
      }

      // 5. Atualizar state especificamente deste grupo (SE solicitado)
      // Se updateState for false, quem chamou é responsável por atualizar o state em lote
      if (updateState) {
        setRegistrosAgrupados(prev => {
          const novoArray = [...prev];
          // Re-encontrar index pois state pode ter mudado
          const idx = novoArray.findIndex(g => g.agrupador_id === agrupadorId);
          if (idx !== -1) {
            novoArray[idx] = {
              ...novoArray[idx],
              registros: registrosCalculados, // Populando detalhes
              quantidade: registrosCalculados.length,
              detalhesCarregados: true
            };
          }
          return novoArray;
        });
      }

      // Retornar objeto completo com ID para quem chamou poder consolidar
      return { agrupadorId, registros: registrosCalculados, sucesso: true };

    } catch (err) {
      console.error("Erro ao explodir detalhes", err);
      // Retornar erro tratado
      return { agrupadorId, registros: [], sucesso: false };
    } finally {
      // setLoading(false);
    }
  };

  // Carregar registros de tempo estimado
  const loadRegistrosTempoEstimado = useCallback(async (filtrosParaAplicar = null, periodoParaAplicar = null, valoresSelecionados = null, filtrosAdicionaisParaAplicar = null) => {
    // 1. Cancelar requisições pendentes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('🛑 [LOAD] Cancelando requisição anterior...');
    }

    // 2. Criar novo controlador
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    console.log('🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Função chamada');

    // 3. Verificar se já existe carregamento em paralelo (opcional, mas bom para evitar race conditions de state)
    // Com AbortController isso é menos crítico, mas ainda útil para evitar updates de state sobrepostos
    if (loadingRef.current) {
      // Se quisermos apenas 1 por vez, poderiamos retornar aqui, mas como cancelamos o anterior,
      // vamos prosseguir com o novo.
    }

    loadingRef.current = true;
    setLoading(true);

    // Marcar dados auxiliares como não carregados ANTES de iniciar carregamento
    // Isso garante que os dashboards não sejam exibidos com dados parciais
    setDadosAuxiliaresCarregados(false);

    // Resetar grupos expandidos quando recarregar os dados
    setGruposExpandidos(new Set());
    setTarefasExpandidas(new Set());
    setAgrupamentosTarefasExpandidas(new Set());
    try {
      if (abortController.signal.aborted) return;

      const filtrosAUsar = filtrosParaAplicar !== null ? filtrosParaAplicar : filtros;
      const periodoAUsar = periodoParaAplicar !== null ? periodoParaAplicar : {
        inicio: periodoInicio,
        fim: periodoFim
      };

      // Usar valores selecionados passados como parâmetro, ou os estados atuais
      const valoresAUsar = valoresSelecionados ? { ...valoresSelecionados } : {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        tipoTarefaId: filtroTipoTarefaSelecionado,
        responsavel: filtroResponsavelSelecionado
      };

      // Resolver "Tipo de Tarefa" em lista de tarefa_id apenas quando um tipo foi selecionado
      // Se nenhum tipo for selecionado, não filtramos por tarefa (mostra todos os dados)
      if (filtrosAUsar.tipoTarefa && valoresAUsar.tipoTarefaId) {
        try {
          const tipoId = valoresAUsar.tipoTarefaId;
          const resVinculados = await fetch(`${API_BASE_URL}/vinculados?tarefa_tipo_id=${tipoId}&limit=all`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            signal: abortController.signal
          });
          if (resVinculados.ok) {
            const jsonVinculados = await resVinculados.json();
            const lista = jsonVinculados.data || jsonVinculados.vinculados || [];
            const tarefaIdsUnicos = [...new Set(lista.map(v => v.tarefa_id ?? v.cp_tarefa).filter(Boolean))];
            valoresAUsar.tarefa = tarefaIdsUnicos;
            if (tarefaIdsUnicos.length === 0) {
              console.warn(`⚠️ [TIPO-TAREFA] Nenhuma tarefa encontrada para o tipo ${tipoId}`);
              setRegistrosAgrupados([]);
              setTotalRegistros(0);
              setTotalPages(1);
              setDadosAuxiliaresCarregados(true);
              // O finally sempre executa mesmo com return, então o loading será resetado corretamente
              return;
            }
          } else {
            valoresAUsar.tarefa = [];
          }
        } catch (err) {
          if (err.name !== 'AbortError') showToast('error', 'Erro ao buscar tarefas do tipo selecionado');
          valoresAUsar.tarefa = [];
        }
        delete valoresAUsar.tipoTarefaId;
      } else if (filtrosAUsar.tipoTarefa && !valoresAUsar.tipoTarefaId) {
        // Tipo de Tarefa ativo sem tipo selecionado: não filtrar por tarefa (mostrar todos)
        delete valoresAUsar.tipoTarefaId;
      }

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

      // Quando há período: buscar TODAS as regras por paginação (sem limit total) para não faltar estimado/realizado.
      // Cada página usa limit moderado (1000) para não sobrecarregar a VPS.
      const temPeriodo = periodoAUsar.inicio && periodoAUsar.fim;
      const LIMIT_POR_PAGINA = 1000;
      const limitParaBusca = temPeriodo ? String(LIMIT_POR_PAGINA) : itemsPerPage.toString();
      const pageParaBusca = temPeriodo ? '1' : currentPage.toString();

      const buildParams = (page, limit) => {
        const p = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (filtrosAUsar.produto) {
          p.append('filtro_produto', 'true');
          if (valoresAUsar.produto) {
            const produtoIds = Array.isArray(valoresAUsar.produto) ? valoresAUsar.produto : [valoresAUsar.produto];
            produtoIds.forEach(id => { if (id) p.append('produto_id', String(id).trim()); });
          }
        }
        if (filtrosAUsar.atividade) {
          p.append('filtro_atividade', 'true');
          if (valoresAUsar.tarefa) {
            const tarefaIds = Array.isArray(valoresAUsar.tarefa) ? valoresAUsar.tarefa : [valoresAUsar.tarefa];
            tarefaIds.forEach(id => { if (id) p.append('tarefa_id', String(id).trim()); });
          }
        }
        if (filtrosAUsar.tipoTarefa) {
          p.append('filtro_atividade', 'true');
          if (valoresAUsar.tarefa && Array.isArray(valoresAUsar.tarefa) && valoresAUsar.tarefa.length > 0) {
            valoresAUsar.tarefa.forEach(id => { if (id) p.append('tarefa_id', String(id).trim()); });
          } else if (valoresAUsar.tarefa && !Array.isArray(valoresAUsar.tarefa)) {
            p.append('tarefa_id', String(valoresAUsar.tarefa).trim());
          }
        }
        if (filtrosAUsar.cliente) {
          p.append('filtro_cliente', 'true');
          if (valoresAUsar.cliente) {
            const clienteIds = Array.isArray(valoresAUsar.cliente) ? valoresAUsar.cliente : [valoresAUsar.cliente];
            clienteIds.forEach(id => { if (id) p.append('cliente_id', String(id).trim()); });
          }
        }
        if (filtrosAUsar.responsavel) p.append('filtro_responsavel', 'true');
        if (valoresAUsar.responsavel) {
          const responsavelIds = Array.isArray(valoresAUsar.responsavel) ? valoresAUsar.responsavel : [valoresAUsar.responsavel];
          responsavelIds.forEach(id => { if (id) p.append('responsavel_id', String(id).trim()); });
        }
        if (filtrosAdicionaisAUsar.cliente) {
          const ids = Array.isArray(filtrosAdicionaisAUsar.cliente) ? filtrosAdicionaisAUsar.cliente : [filtrosAdicionaisAUsar.cliente];
          ids.forEach(id => { if (id) p.append('cliente_id', String(id).trim()); });
        }
        if (filtrosAdicionaisAUsar.tarefa) {
          const ids = Array.isArray(filtrosAdicionaisAUsar.tarefa) ? filtrosAdicionaisAUsar.tarefa : [filtrosAdicionaisAUsar.tarefa];
          ids.forEach(id => { if (id) p.append('tarefa_id', String(id).trim()); });
        }
        if (filtrosAdicionaisAUsar.produto) {
          const ids = Array.isArray(filtrosAdicionaisAUsar.produto) ? filtrosAdicionaisAUsar.produto : [filtrosAdicionaisAUsar.produto];
          ids.forEach(id => { if (id) p.append('produto_id', String(id).trim()); });
        }
        const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
        const isFiltroPaiCliente = filtroPaiAtual === 'cliente' || (ordemFiltros.length === 0 && filtrosAUsar.cliente);
        if (filtrosAUsar.cliente && isFiltroPaiCliente && filtroStatusCliente && filtroStatusCliente !== 'todos' && (filtroStatusCliente === 'ativo' || filtroStatusCliente === 'inativo')) {
          p.append('cliente_status', filtroStatusCliente);
        }
        if (periodoAUsar.inicio) p.append('data_inicio', periodoAUsar.inicio);
        if (periodoAUsar.fim) p.append('data_fim', periodoAUsar.fim);
        return p;
      };

      // Montar payload para POST (evitar 414 URI Too Long quando muitos responsavel_id/outros filtros)
      const buildPayload = (page, limit) => {
        const pl = { page: String(page), limit: String(limit) };
        const arr = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));
        const merge = (a, b) => [...arr(a).map(String).filter(Boolean), ...arr(b).map(String).filter(Boolean)];
        if (filtrosAUsar.produto && valoresAUsar.produto) pl.produto_id = merge(valoresAUsar.produto, filtrosAdicionaisAUsar.produto);
        if (filtrosAUsar.atividade && valoresAUsar.tarefa) {
          const tarefaIds = merge(valoresAUsar.tarefa, filtrosAdicionaisAUsar.tarefa);
          if (tarefaIds.length > 0) pl.tarefa_id = tarefaIds;
        }
        if (filtrosAUsar.tipoTarefa && valoresAUsar.tarefa) {
          const tarefaIds = merge(valoresAUsar.tarefa, filtrosAdicionaisAUsar.tarefa);
          if (tarefaIds.length > 0) pl.tarefa_id = tarefaIds;
        }
        if (filtrosAUsar.cliente && valoresAUsar.cliente) pl.cliente_id = merge(valoresAUsar.cliente, filtrosAdicionaisAUsar.cliente);
        if (filtrosAUsar.responsavel && valoresAUsar.responsavel) pl.responsavel_id = arr(valoresAUsar.responsavel).map(String).filter(Boolean);
        if (filtrosAdicionaisAUsar.cliente && !pl.cliente_id) pl.cliente_id = arr(filtrosAdicionaisAUsar.cliente).map(String).filter(Boolean);
        if (filtrosAdicionaisAUsar.tarefa && !pl.tarefa_id) pl.tarefa_id = arr(filtrosAdicionaisAUsar.tarefa).map(String).filter(Boolean);
        if (filtrosAdicionaisAUsar.produto && !pl.produto_id) pl.produto_id = arr(filtrosAdicionaisAUsar.produto).map(String).filter(Boolean);
        if (filtroPrincipal === 'cliente' && filtroStatusCliente && filtroStatusCliente !== 'todos') pl.cliente_status = filtroStatusCliente;
        if (periodoAUsar.inicio) pl.data_inicio = periodoAUsar.inicio;
        if (periodoAUsar.fim) pl.data_fim = periodoAUsar.fim;
        return pl;
      };

      const LIMITE_URL_SEGURA = 1800; // usar POST se URL passar disso (evitar 414)
      const usarPostListagem = () => {
        const p = buildParams(1, LIMIT_POR_PAGINA);
        return p.toString().length > LIMITE_URL_SEGURA;
      };

      let regras = [];
      let totalDoBackend = null;

      const fetchUmaPagina = async (page, limit) => {
        const usePost = usarPostListagem();
        if (usePost) {
          const payload = buildPayload(page, limit);
          const response = await fetch(`${API_BASE_URL}/tempo-estimado/listar`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortController.signal
          });
          return response;
        }
        const params = buildParams(page, limit);
        const response = await fetch(`${API_BASE_URL}/tempo-estimado?${params}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
          signal: abortController.signal
        });
        return response;
      };

      if (temPeriodo) {
        let pageAtual = 1;
        let result;
        do {
          const response = await fetchUmaPagina(pageAtual, LIMIT_POR_PAGINA);
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          if (!response.ok) break;
          result = await response.json();
          if (!result.success || !result.data) break;
          regras = regras.concat(result.data || []);
          if (result.total != null) totalDoBackend = result.total;
          pageAtual++;
        } while ((result.data?.length || 0) === LIMIT_POR_PAGINA && !abortController.signal.aborted);
        console.log(`🔵 [LOAD-REGISTROS-TEMPO-ESTIMADO] Busca completa: ${regras.length} regras (${pageAtual - 1} página(s), limit=${LIMIT_POR_PAGINA}/página)`);
      } else {
        const response = await fetchUmaPagina(pageParaBusca, limitParaBusca);
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            regras = result.data || [];
            totalDoBackend = result.total;
          }
        }
      }

      if (regras.length > 0 || !temPeriodo) {
        const totalRegistros = totalDoBackend != null ? totalDoBackend : regras.length;
        if (regras.length > 0) {

          // Helper para converter HH:mm:ss para ms
          const timeToMs = (timeStr) => {
            if (!timeStr) return 0;
            if (typeof timeStr === 'number') return timeStr; // Já está em ms
            if (typeof timeStr !== 'string') return 0; // Proteção extra (ex: undefined, object)

            const [h, m, s] = timeStr.split(':').map(Number);
            return ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
          };

          // [ON-DEMAND] Não explodir regras aqui.
          // Calcular apenas resumo.
          const agrupamentosMap = new Map();

          regras.forEach(regra => {
            const agrupadorId = regra.agrupador_id || 'sem-grupo';
            if (!agrupamentosMap.has(agrupadorId)) {
              agrupamentosMap.set(agrupadorId, {
                agrupador_id: agrupadorId,
                registros: [],
                regras: [],
                primeiroRegistro: regra,
                quantidade: 0,
                totalEstimadoCache: 0,
                detalhesCarregados: false
              });
            }
            const grupo = agrupamentosMap.get(agrupadorId);
            grupo.regras.push(regra); // Guardar regra

            // Somar total estimado (Lightweight)
            // Apenas se tivermos periodo definido (que sempre temos no state para filtro de periodo)
            const pInicio = periodoAUsar.inicio;
            const pFim = periodoAUsar.fim;

            if (pInicio && pFim && regra.tempo_estimado_dia) {
              const msPorDia = timeToMs(regra.tempo_estimado_dia);
              if (msPorDia > 0) {
                // Calcular dias válidos
                const regraInicio = regra.data_inicio ? (regra.data_inicio.includes('T') ? regra.data_inicio.split('T')[0] : regra.data_inicio) : pInicio;
                const regraFim = regra.data_fim ? (regra.data_fim.includes('T') ? regra.data_fim.split('T')[0] : regra.data_fim) : pFim;

                const rInicio = regraInicio > pInicio ? regraInicio : pInicio;
                const rFim = regraFim < pFim ? regraFim : pFim;

                if (rInicio <= rFim) {
                  // [FIX-DISCREPANCY] Lógica Restritiva (Global Filter Ceiling)
                  // Se o filtro global diz "Sem Finais de Semana" (false), o final de semana NUNCA é contado,
                  // mesmo que a regra diga "true". Se o global diz "Com", a regra decide.
                  // Lógica: Global && (Regra !== false)
                  const p = regra;
                  const incluirFinaisSemana = (filtrosAUsar.habilitarFinaisSemana || false) && (p.incluir_finais_semana !== false);
                  const incluirFeriados = (filtrosAUsar.habilitarFeriados || false) && (p.incluir_feriados !== false);
                  const dIndividuais = filtrosAUsar.datasIndividuais || [];

                  const qtdDias = obterDatasValidasNoPeriodo(
                    rInicio,
                    rFim,
                    incluirFinaisSemana,
                    incluirFeriados,
                    dIndividuais
                  ).size;
                  grupo.totalEstimadoCache += (qtdDias * msPorDia);
                }
              }
            }
          });

          const novosAgrupamentos = Array.from(agrupamentosMap.values());
          console.log(`📦 [LOAD-SUMMARY] ${novosAgrupamentos.length} agrupamentos criados (sem detalhes). Total estimado calculado.`);

          setRegistrosAgrupados(novosAgrupamentos);

          setTotalRegistros(totalRegistros);
          setTotalPages(Math.ceil(totalRegistros / itemsPerPage));

          // OTIMIZAÇÃO: Marcar como carregado

          // OTIMIZAÇÃO: Marcar como carregado
          setDadosAuxiliaresCarregados(true);

          // Um único POST por tipo: /api/gestao-capacidade/cards/{tipo} (pai + detalhes no mesmo payload)
          const carregarCardsGestaoCapacidade = async () => {
            if (!novosAgrupamentos || novosAgrupamentos.length === 0) return;

            const primeiroOuRegistro = (i) => i.primeiroRegistro ?? i.registros?.[0] ?? i.regras?.[0];
            let tipo = 'responsavel';
            if (filtrosAUsar.responsavel) tipo = 'responsavel';
            else if (filtrosAUsar.cliente) tipo = 'cliente';
            else if (filtrosAUsar.atividade || filtrosAUsar.tipoTarefa) tipo = 'atividade';
            else if (filtrosAUsar.produto) tipo = 'produto';

            const obterIds = () => {
              if (tipo === 'responsavel') return [...new Set(novosAgrupamentos.map(i => primeiroOuRegistro(i)?.responsavel_id).filter(Boolean))].map(String);
              if (tipo === 'cliente') return [...new Set(novosAgrupamentos.flatMap(i => String(primeiroOuRegistro(i)?.cliente_id || '').split(',').map(s => s.trim()).filter(Boolean)))];
              if (tipo === 'produto') return [...new Set(novosAgrupamentos.map(i => primeiroOuRegistro(i)?.produto_id).filter(Boolean))].map(String);
              if (tipo === 'atividade') return [...new Set(novosAgrupamentos.map(i => primeiroOuRegistro(i)?.tarefa_id).filter(Boolean))].map(String);
              return [];
            };

            // Quando filtro é Tipo de Tarefa: mapa tipo_tarefa_id -> Set de tarefa_ids (para agregar resposta por tipo)
            let tipoParaTarefas = null;
            if (filtrosAUsar.tipoTarefa) {
              tipoParaTarefas = new Map();
              novosAgrupamentos.forEach(agr => {
                (agr.regras || []).forEach(regra => {
                  const tipoId = regra.tipo_tarefa_id != null ? String(regra.tipo_tarefa_id) : null;
                  if (!tipoId || !regra.tarefa_id) return;
                  if (!tipoParaTarefas.has(tipoId)) tipoParaTarefas.set(tipoId, new Set());
                  tipoParaTarefas.get(tipoId).add(String(regra.tarefa_id));
                });
              });
            }

            let ids = obterIds();
            // Para tipo de tarefa: enviar à API todos os tarefa_ids (agregação por tipo é feita no front após resposta)
            if (filtrosAUsar.tipoTarefa && tipoParaTarefas && tipoParaTarefas.size > 0) {
              ids = [...new Set([].concat(...[...tipoParaTarefas.values()].map(s => [...s])))];
            } else if (filtrosAUsar.tipoTarefa && (!tipoParaTarefas || tipoParaTarefas.size === 0)) {
              ids = [];
            }
            if (ids.length === 0) {
              setDadosAuxiliaresCarregados(true);
              return;
            }

            const endpointTipo = tipo === 'atividade' ? 'tarefa' : tipo;
            // Chave para estado deve bater com filtroPrincipal no render (tipoTarefa vs atividade)
            const chaveTipoParaEstado = filtrosAUsar.tipoTarefa ? 'tipoTarefa' : tipo;
            const payload = {
              ids,
              data_inicio: periodoAUsar.inicio,
              data_fim: periodoAUsar.fim,
              considerar_finais_semana: !!filtrosAUsar.habilitarFinaisSemana,
              considerar_feriados: !!filtrosAUsar.habilitarFeriados,
              filtros_adicionais: {
                cliente_id: filtrosAdicionaisAUsar.cliente_id || null,
                produto_id: filtrosAdicionaisAUsar.produto_id || null,
                tarefa_id: filtrosAdicionaisAUsar.tarefa_id || null
              },
              incluir_detalhes: false
            };

            // Função auxiliar para preencher fallback (dados zerados) quando a API falha ou demora
            const idsParaFallback = (filtrosAUsar.tipoTarefa && tipoParaTarefas && tipoParaTarefas.size > 0)
              ? [...tipoParaTarefas.keys()]
              : ids;
            const preencherFallback = () => {
              console.warn(`⚠️ [CARDS-GESTAO-CAPACIDADE] Preenchendo fallback para ${idsParaFallback.length} entidades (chave=${chaveTipoParaEstado})`);
              const chaveRealizado = (id) => `${chaveTipoParaEstado}_${String(id)}`;
              
              // Preencher temposRealizadosPorEntidade com valores zerados
              setTemposRealizadosPorEntidade(prev => {
                const next = { ...prev };
                idsParaFallback.forEach(id => {
                  next[chaveRealizado(id)] = { realizado: 0, pendente: 0 };
                });
                return next;
              });

              // Preencher cardsPorEntidade com objetos zerados
              const cardsFallback = {};
              idsParaFallback.forEach(id => {
                cardsFallback[String(id)] = {
                  total_estimado_ms: 0,
                  total_realizado_ms: 0,
                  total_tarefas: 0,
                  total_clientes: 0,
                  total_produtos: 0,
                  total_responsaveis: 0
                };
              });
              setCardsPorEntidade(cardsFallback);

              // Para responsável, também preencher outros estados
              if (tipo === 'responsavel') {
                setTempoEstimadoTotalPorResponsavel(prev => {
                  const next = { ...prev };
                  ids.forEach(id => {
                    next[String(id)] = 0;
                  });
                  return next;
                });
              }

              setDadosAuxiliaresCarregados(true);
            };

            console.log(`🔄 [CARDS-GESTAO-CAPACIDADE] Carregando cards para tipo=${tipo}, endpoint=${endpointTipo}, ids=${ids.length}`);

            // Criar AbortController para timeout
            const abortControllerCards = new AbortController();
            const TIMEOUT_MS = 30000; // 30 segundos
            const timeoutId = setTimeout(() => {
              console.warn(`⏱️ [CARDS-GESTAO-CAPACIDADE] Timeout após ${TIMEOUT_MS}ms, abortando requisição`);
              abortControllerCards.abort();
            }, TIMEOUT_MS);

            try {
              const res = await fetch(`${API_BASE_URL}/gestao-capacidade/cards/${endpointTipo}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
                signal: abortControllerCards.signal
              });

              clearTimeout(timeoutId);

              if (!res.ok) {
                console.error(`❌ [CARDS-GESTAO-CAPACIDADE] Resposta não-ok: ${res.status} ${res.statusText}`);
                preencherFallback();
                showToast('warning', 'Erro ao carregar métricas. Exibindo valores zerados.');
                return;
              }

              const result = await res.json();
              if (!result.success || !result.data) {
                console.warn(`⚠️ [CARDS-GESTAO-CAPACIDADE] Resposta sem dados válidos: success=${result.success}`);
                preencherFallback();
                return;
              }

              let data = result.data;
              // Quando filtro é Tipo de Tarefa: agregar por tipo_tarefa_id (um card por tipo, com totais e contagens)
              if (filtrosAUsar.tipoTarefa && tipoParaTarefas && tipoParaTarefas.size > 0) {
                const aggregated = {};
                tipoParaTarefas.forEach((tarefasSet, tipoId) => {
                  aggregated[tipoId] = {
                    total_estimado_ms: 0,
                    total_realizado_ms: 0,
                    total_tarefas: tarefasSet.size, // Contar tarefas únicas por tipo (não somar card.total_tarefas)
                    total_clientes: 0,
                    total_produtos: 0,
                    total_responsaveis: 0
                  };
                  // Para clientes, produtos e responsáveis: usar máximo entre os cards (aproximação)
                  // O cálculo correto será feito por calcularEstatisticasPorEntidade quando necessário
                  let maxClientes = 0;
                  let maxProdutos = 0;
                  let maxResponsaveis = 0;
                  tarefasSet.forEach(tid => {
                    const card = data[tid];
                    if (card) {
                      aggregated[tipoId].total_estimado_ms += card.total_estimado_ms ?? 0;
                      aggregated[tipoId].total_realizado_ms += card.total_realizado_ms ?? 0;
                      // Usar máximo para aproximação (calcularEstatisticasPorEntidade fará o cálculo correto)
                      maxClientes = Math.max(maxClientes, card.total_clientes ?? 0);
                      maxProdutos = Math.max(maxProdutos, card.total_produtos ?? 0);
                      maxResponsaveis = Math.max(maxResponsaveis, card.total_responsaveis ?? 0);
                    }
                  });
                  aggregated[tipoId].total_clientes = maxClientes;
                  aggregated[tipoId].total_produtos = maxProdutos;
                  aggregated[tipoId].total_responsaveis = maxResponsaveis;
                });
                data = aggregated;
                console.log(`✅ [CARDS-GESTAO-CAPACIDADE] Cards agregados por tipo de tarefa: ${Object.keys(data).length} tipos`);
              } else {
                console.log(`✅ [CARDS-GESTAO-CAPACIDADE] Cards carregados com sucesso: ${Object.keys(data).length} entidades`);
              }

              setCardsPorEntidade(data);

              const chaveRealizado = (id) => `${chaveTipoParaEstado}_${String(id)}`;
              setTempoEstimadoTotalPorResponsavel(prev => {
                const next = { ...prev };
                Object.keys(data).forEach(id => {
                  const card = data[id];
                  if (card.total_estimado_ms !== undefined) next[String(id)] = card.total_estimado_ms;
                });
                return next;
              });
              setTemposRealizadosPorEntidade(prev => {
                const next = { ...prev };
                Object.keys(data).forEach(id => {
                  const card = data[id];
                  const realizado = card.total_realizado_ms ?? 0;
                  next[chaveRealizado(id)] = { realizado, pendente: 0 };
                });
                return next;
              });

              if (tipo === 'responsavel') {
                setHorasContratadasPorResponsavel(prev => {
                  const next = { ...prev };
                  Object.keys(data).forEach(id => {
                    const card = data[id];
                    const horasDia = card.horas_contratadas_dia ?? (card.total_contratado_ms != null ? card.total_contratado_ms / (Math.ceil((new Date(periodoAUsar.fim) - new Date(periodoAUsar.inicio)) / (24 * 60 * 60 * 1000)) + 1) / 3600000 : 0);
                    next[String(id)] = typeof horasDia === 'number' ? horasDia : (horasDia?.horascontratadasdia ?? null);
                  });
                  return next;
                });
                setTipoContratoPorResponsavel(prev => {
                  const next = { ...prev };
                  Object.keys(data).forEach(id => {
                    const card = data[id];
                    if (card.tipo_contrato != null) next[String(id)] = card.tipo_contrato;
                  });
                  return next;
                });
                setCustosPorResponsavel(prev => {
                  const next = { ...prev };
                  Object.keys(data).forEach(id => {
                    const card = data[id];
                    if (card.custo_hora != null) next[String(id)] = String(card.custo_hora).replace('.', ',');
                  });
                  return next;
                });
              }

              setDadosAuxiliaresCarregados(true);
            } catch (err) {
              clearTimeout(timeoutId);
              
              if (err.name === 'AbortError') {
                console.warn(`⏱️ [CARDS-GESTAO-CAPACIDADE] Requisição abortada (timeout ou cancelamento)`);
                preencherFallback();
                showToast('warning', 'Timeout ao carregar métricas. Exibindo valores zerados.');
              } else {
                console.error('❌ [CARDS-GESTAO-CAPACIDADE] Erro ao carregar cards gestão capacidade:', err);
                preencherFallback();
                showToast('warning', 'Erro ao carregar métricas. Exibindo valores zerados.');
              }
            }
          };

          carregarCardsGestaoCapacidade();

        } else {
          setDadosAuxiliaresCarregados(true);
        }
      } else {
        setDadosAuxiliaresCarregados(true);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🔇 [LOAD] Requisição cancelada (AbortError)');
        // Não fazer nada, apenas sair silenciosamente
        // O finally ainda será executado para resetar o loading
      } else {
        console.error('Erro ao carregar registros:', error);
        showToast('error', 'Erro ao carregar registros de tempo estimado');
        setDadosAuxiliaresCarregados(true);
      }
    } finally {
      // Sempre desligar o loading no finally, mesmo se foi abortado
      // O AbortController garante que requests velhos morrem, mas precisamos resetar o loading
      // para evitar que fique travado se a requisição foi cancelada
      if (!abortController.signal.aborted || loadingRef.current) {
        setLoading(false);
        loadingRef.current = false;
      }
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

    const novosNomes = { ...nomesCache };

    // Carregar nomes de produtos
    if (produtosIds.size > 0) {
      try {
        const produtosArray = Array.from(produtosIds);
        for (const produtoId of produtosArray) {
          if (!novosNomes.produtos[produtoId]) {
            const fetchProduto = async () => {
              const response = await fetch(`${API_BASE_URL}/produtos/${produtoId}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  novosNomes.produtos[produtoId] = result.data.nome || `Produto #${produtoId}`;
                }
              }
            };
            // Usar alta prioridade para nomes, pois geralmente são necessários para a UI imediata de detalhes
            await executeHighPriority(fetchProduto);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar nomes de produtos:', error);
      }
    }

    // Carregar nomes de tarefas
    if (tarefasIds.size > 0) {
      try {
        const tarefasArray = Array.from(tarefasIds);
        for (const tarefaId of tarefasArray) {
          if (!novosNomes.tarefas[tarefaId]) {
            const fetchTarefa = async () => {
              const response = await fetch(`${API_BASE_URL}/atividades/${tarefaId}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  novosNomes.tarefas[tarefaId] = result.data.nome || `Tarefa #${tarefaId}`;
                }
              }
            };
            // Usar alta prioridade
            await executeHighPriority(fetchTarefa);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar nomes de tarefas:', error);
      }
    }

    // Carregar nomes de clientes (já temos no estado clientes)
    if (clientesIds.size > 0) {
      clientesIds.forEach(clienteId => {
        if (!novosNomes.clientes[clienteId]) {
          const cliente = clientes.find(c => String(c.id) === String(clienteId));
          if (cliente) {
            novosNomes.clientes[clienteId] = cliente.nome;
          }
        }
      });
    }

    // Carregar nomes de colaboradores (já temos no estado colaboradores)
    if (colaboradoresIds.size > 0) {
      colaboradoresIds.forEach(colabId => {
        if (!novosNomes.colaboradores[colabId]) {
          const colab = colaboradores.find(c => String(c.id) === String(colabId));
          if (colab) {
            novosNomes.colaboradores[colabId] = colab.cpf ? `${colab.nome} (${colab.cpf})` : colab.nome;
          }
        }
      });
    }

    setNomesCache(novosNomes);
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



  // Buscar custo mais recente por responsável
  const buscarCustoPorResponsavel = async (responsavelId, dataInicio, dataFim) => {
    try {
      if (!responsavelId) return null;

      // Validação: Backend espera Integer
      const idNum = parseInt(String(responsavelId).trim(), 10);
      if (isNaN(idNum)) {
        console.warn(`⚠️ [BUSCAR-CUSTO] ID inválido (não é número): ${responsavelId}`);
        return null;
      }

      const params = new URLSearchParams({
        membro_id: idNum
      });
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/mais-recente?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data.custo_hora || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar custo por responsável:', error);
      return null;
    }
  };

  // Carregar custos para todos os responsáveis de um grupo
  const carregarCustosPorResponsaveis = async (agrupamentos, dataInicio, dataFim) => {
    const responsaveisIds = new Set();
    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      if (primeiroRegistro.responsavel_id) {
        responsaveisIds.add(String(primeiroRegistro.responsavel_id));
      }
    });

    const novosCustos = { ...custosPorResponsavel };

    // Filtrar apenas responsáveis que ainda não têm custo no cache
    const responsaveisParaBuscar = Array.from(responsaveisIds).filter(id => !novosCustos[id]);

    // Usar batches para limitar requisições simultâneas e evitar ERR_INSUFFICIENT_RESOURCES
    await processBatch(responsaveisParaBuscar, async (responsavelId) => {
      const custoHora = await buscarCustoPorResponsavel(responsavelId, dataInicio, dataFim);
      novosCustos[responsavelId] = custoHora;
    }, 4); // Limite de 4 requisições simultâneas

    setCustosPorResponsavel(novosCustos);
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
      if (!periodoInicio || !periodoFim || !entidadeId) {
        return { realizado: 0, pendente: 0 };
      }

      // Se o filtro principal é responsavel, usar novo endpoint simplificado
      if (filtroPrincipal === 'responsavel') {
        // Validação: Backend espera Integer para Responsável
        const idString = String(entidadeId).trim();
        const isInteger = /^\d+$/.test(idString);

        if (!isInteger) {
          console.warn(`⚠️ [BUSCAR-REALIZADO] ID de responsável inválido (não é número): ${entidadeId}`);
          return { realizado: 0, pendente: 0 };
        }

        const idNum = parseInt(idString, 10);

        try {
          const response = await fetch('/api/registro-tempo/realizado-total', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              responsavel_id: idNum, // Enviando ID sanitizado
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
            // Ignorar 404 (Not Found) se for ID inválido ou inexistente no contexto
            if (response.status !== 404) {
              console.error('Erro ao buscar tempo realizado total:', response.status, errorData);
            }
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
        } else if (filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') {
          return String(primeiroRegistro.tarefa_id) === String(entidadeId);
        }
        return false;
      });

      // Extrair responsáveis únicos
      responsavelIds = [...new Set(agrupamentosFiltrados.map(agr => agr.primeiroRegistro.responsavel_id).filter(Boolean))];

      if (responsavelIds.length === 0) {
        return { realizado: 0, pendente: 0 };
      }

      // Buscar tempo realizado para cada responsável usando novo endpoint e somar
      const promises = responsavelIds.map(async (responsavelId) => {
        // Validation per responsavel
        const idNum = parseInt(String(responsavelId).trim(), 10);
        if (isNaN(idNum)) return { realizado: 0, pendente: 0 };

        try {
          const response = await fetch('/api/registro-tempo/realizado-total', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              responsavel_id: idNum,
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
          }
          return { realizado: 0, pendente: 0 };
        } catch (error) {
          console.error('Erro ao buscar tempo realizado para responsável:', responsavelId, error);
          return { realizado: 0, pendente: 0 };
        }
      });

      const resultados = await Promise.all(promises);
      return resultados.reduce((sum, item) => ({
        realizado: sum.realizado + (item.realizado || 0),
        pendente: sum.pendente + (item.pendente || 0)
      }), { realizado: 0, pendente: 0 });

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

    // Usar tempo realizado e pendente passados como props (antes dos cálculos de percentual)
    const tempoRealizadoValor = realizado || 0;
    const tempoPendenteValor = pendente || 0;

    // Se não deve mostrar contratadas/disponível, usar o estimado como 100%
    const totalParaBarra = mostrarContratadasDisponivel ? contratadoValor : (estimado || 1);
    const baseBarra = Math.max(totalParaBarra, 1);
    const percentualEstimado = (estimado / baseBarra) * 100;
    const percentualRealizado = (tempoRealizadoValor / baseBarra) * 100;
    const percentualPendente = (tempoPendenteValor / baseBarra) * 100;
    const somaPercentuais = percentualEstimado + percentualRealizado + percentualPendente;
    const escala = somaPercentuais > 100 ? 100 / somaPercentuais : 1;
    const wEstimado = Math.min(100, percentualEstimado * escala);
    const wRealizado = Math.min(100, percentualRealizado * escala);
    const wPendente = Math.min(100, percentualPendente * escala);
    const custoEstimado = calcularCustoPorTempo(estimado, responsavelId);

    // Custos
    const custoRealizado = responsavelId ? calcularCustoPorTempo(tempoRealizadoValor, responsavelId) : null;
    const custoPendente = responsavelId ? calcularCustoPorTempo(tempoPendenteValor, responsavelId) : null;

    // Se o valor for null, estamos carregando
    const estaCarregando = (estimado === null) || (realizado === null) || (mostrarContratadasDisponivel && contratado === null);

    if (estaCarregando) {
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
            style={{ width: `${wEstimado}%`, left: '0%' }}
            title={`Estimado: ${formatarTempoEstimado(estimado, true)}`}
          ></div>
          <div
            className="barra-progresso-tempo-fill realizado"
            style={{ width: `${wRealizado}%`, left: `${wEstimado}%` }}
            title={`Realizado: ${formatarTempoEstimado(tempoRealizadoValor, true)}`}
          ></div>
          {tempoPendenteValor > 0 && (
            <div
              className="barra-progresso-tempo-fill pendente"
              style={{ width: `${wPendente}%`, left: `${wEstimado + wRealizado}%` }}
              title={`Pendente: ${formatarTempoEstimado(tempoPendenteValor, true)}`}
            ></div>
          )}
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
                  <span className="barra-progresso-tempo-badge-tempo">{formatarTempoEstimado(realizado, true)}</span>
                </span>
                <span className={`barra-progresso-tempo-custo realizado ${custoRealizado === null ? 'barra-progresso-tempo-custo-placeholder' : ''}`}>
                  {custoRealizado !== null ? formatarValorMonetario(custoRealizado) : '\u00A0'}
                </span>
              </div>
            </div>
          </div>

          {pendente > 0 && (
            <div className="barra-progresso-tempo-item">
              <div className="barra-progresso-tempo-item-content">
                <div className="barra-progresso-tempo-item-header">
                  <i className="fas fa-stopwatch painel-colaborador-pendente-icon-inline" style={{ color: '#ef4444' }}></i>
                  <span className="barra-progresso-tempo-label">Pendente</span>
                </div>
                <div className="barra-progresso-tempo-badge-wrapper">
                  <span className="barra-progresso-tempo-badge pendente" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                    <span className="barra-progresso-tempo-badge-tempo">{formatarTempoEstimado(pendente, true)}</span>
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
                  <span className="barra-progresso-tempo-badge contratadas">{formatarTempoEstimado(contratado, true)}</span>
                </div>
              </div>
              <div className="barra-progresso-tempo-item">
                <div className="barra-progresso-tempo-item-content">
                  <div className="barra-progresso-tempo-item-header">
                    <span className="barra-progresso-tempo-indicador sobrando"></span>
                    <span className="barra-progresso-tempo-label">Disponível</span>
                  </div>
                  <span className="barra-progresso-tempo-badge disponivel">{formatarTempoEstimado(disponivel, true)}</span>
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
        // [ON-DEMAND] Disparar carregamento de detalhes ao expandir
        fetchDetalhesResponsavel(grupoKey);
      }
      return novo;
    });
  };

  // Toggle tarefa expandida
  const toggleTarefa = async (agrupadorId, tarefaId) => {
    console.log(`🖱️ [CLICK] Expandir/Recolher tarefa ${tarefaId} do grupo ${agrupadorId}`);

    // NOVO: Garantir que os detalhes estejam carregados
    const grupo = registrosAgrupados.find(g => g.agrupador_id === agrupadorId);
    if (grupo && !grupo.detalhesCarregados) {
      console.log(`⚡ [TOGGLE-TAREFA] Detalhes não carregados para ${agrupadorId}. Disparando explosão...`);
      await fetchDetalhesResponsavel(agrupadorId);
    }

    const key = `${agrupadorId}_${tarefaId}`;
    setTarefasExpandidas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  // Nível 3: Toggle e carregar registros de tempo (realizado) sob demanda para uma tarefa
  const toggleRegistroTempoTarefa = async (agrupadorId, tarefaId, clienteId, responsavelId) => {
    const tarefaKey = `${agrupadorId}_${tarefaId}`;
    const inicio = filtrosUltimosAplicados?.periodoInicio ?? periodoInicio;
    const fim = filtrosUltimosAplicados?.periodoFim ?? periodoFim;
    if (!inicio || !fim) return;

    setRegistroTempoExpandidoPorTarefa(prev => {
      const next = new Set(prev);
      if (next.has(tarefaKey)) next.delete(tarefaKey);
      else next.add(tarefaKey);
      return next;
    });

    if (registroTempoCache[tarefaKey]?.data !== undefined) return; // já carregado
    setRegistroTempoCache(prev => ({ ...prev, [tarefaKey]: { ...prev[tarefaKey], loading: true, error: null } }));
    const usuarioId = (membros.find(m => String(m.id) === String(responsavelId)) || {}).usuario_id || responsavelId;
    try {
      const params = new URLSearchParams({
        tarefa_id: String(tarefaId),
        data_inicio: inicio,
        data_fim: fim
      });
      if (clienteId) params.append('cliente_id', String(clienteId));
      if (usuarioId) params.append('usuario_id', String(usuarioId));
      const res = await fetch(`${API_BASE_URL}/registro-tempo?${params}`, { credentials: 'include', headers: { Accept: 'application/json' } });
      const result = await res.json();
      const data = (result.success && result.data) ? result.data : [];
      setRegistroTempoCache(prev => ({ ...prev, [tarefaKey]: { loading: false, data, error: null } }));

      // Atualizar visualização rápida: somar tempo realizado desta tarefa ao cache do responsável
      const sumMs = (data || []).reduce((acc, r) => {
        let t = Number(r.tempo_realizado) || 0;
        if (t > 0 && t < 1) t = Math.round(t * 3600000);
        return acc + t;
      }, 0);
      if (sumMs > 0 && responsavelId != null) {
        const chaveResponsavel = `responsavel_${String(responsavelId)}`;
        setTemposRealizadosPorEntidade(prev => {
          const current = prev[chaveResponsavel];
          const currentRealizado = current != null ? (typeof current === 'number' ? current : (current.realizado ?? 0)) : 0;
          const newRealizado = currentRealizado > 0 ? Math.max(currentRealizado, sumMs) : sumMs;
          return { ...prev, [chaveResponsavel]: { realizado: newRealizado, pendente: current?.pendente ?? 0 } };
        });
      }
    } catch (err) {
      console.error('Erro ao carregar registros de tempo da tarefa:', err);
      setRegistroTempoCache(prev => ({ ...prev, [tarefaKey]: { loading: false, data: [], error: err.message } }));
    }
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
      tipoTarefa: false,
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
    setFiltroTipoTarefaSelecionado(null);
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
      const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.tipoTarefa || filtros.cliente || filtros.responsavel;
      const temPeriodoCompleto = periodoInicio && periodoFim;
      return temFiltroAtivo || temPeriodoCompleto;
    }

    const filtrosMudaram = (
      filtros.produto !== filtrosUltimosAplicados.produto ||
      filtros.atividade !== filtrosUltimosAplicados.atividade ||
      filtros.tipoTarefa !== filtrosUltimosAplicados.tipoTarefa ||
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
        tipoTarefa: false,
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

    const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.tipoTarefa || filtros.cliente || filtros.responsavel;

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
    setTemposRealizadosPorEntidade({});
    setCardsPorEntidade({});
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
      filtroTipoTarefaSelecionado,
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
      tipoTarefaId: filtroTipoTarefaSelecionado,
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
      case 'tipoTarefa':
        return 'TIPO DE TAREFA';
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
        tipoTarefaId: filtroTipoTarefaSelecionado,
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

  // Ref para a função debounced de carregamento
  const debouncedLoadRef = useRef(null);

  // Inicializar o debounce apenas uma vez
  useEffect(() => {
    debouncedLoadRef.current = debounce((f, c, v, a) => {
      loadRegistrosTempoEstimado(f, c, v, a);
    }, 500);

    return () => {
      if (debouncedLoadRef.current && debouncedLoadRef.current.cancel) {
        debouncedLoadRef.current.cancel();
      }
    };
  }, [loadRegistrosTempoEstimado]);

  // Atualizar automaticamente a listagem quando os filtros "Definir" mudarem
  useEffect(() => {
    // Só atualizar se houver filtros aplicados e período definido
    if (filtrosAplicados && periodoInicio && periodoFim && filtrosUltimosAplicados) {
      // Preparar valores selecionados para passar para a função
      const valoresSelecionados = {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        tipoTarefaId: filtroTipoTarefaSelecionado,
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
      console.log('🔄 [FILTROS-DETALHADOS] Filtros detalhados mudaram (DEBOUNCED), limpando caches e agendando recarga');
      console.log('🔴 [CACHE-LIMPO] setTempoEstimadoTotalPorResponsavel({}) - FILTROS-DETALHADOS');
      setHorasContratadasPorResponsavel({});
      setTipoContratoPorResponsavel({});
      setTempoEstimadoTotalPorResponsavel({});
      setTemposRealizadosPorEntidade({});
      setCardsPorEntidade({});
      // Marcar dados auxiliares como não carregados para prevenir exibição de dados parciais
      setDadosAuxiliaresCarregados(false);

      // Recarregar registros com os novos valores selecionados e filtros adicionais (USANDO DEBOUNCE)
      if (debouncedLoadRef.current) {
        debouncedLoadRef.current(filtros, configuracaoPeriodo, valoresSelecionados, filtrosAdicionais);
      }

      // Atualizar filtrosUltimosAplicados para refletir os novos valores selecionados
      // (sem ativar o botão "Aplicar Filtros")
      setFiltrosUltimosAplicados({
        ...filtrosUltimosAplicados,
        filtroClienteSelecionado,
        filtroProdutoSelecionado,
        filtroTarefaSelecionado,
        filtroTipoTarefaSelecionado,
        filtroResponsavelSelecionado,
        filtroStatusCliente,
        filtrosAdicionais
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroClienteSelecionado, filtroProdutoSelecionado, filtroTarefaSelecionado, filtroTipoTarefaSelecionado, filtroResponsavelSelecionado, filtroAdicionalCliente, filtroAdicionalTarefa, filtroAdicionalProduto]);

  // Efeito para inicializar a fila de processamento quando os registros agrupados mudam
  useEffect(() => {
    if (!dadosAuxiliaresCarregados || !filtroPrincipal || (registrosAgrupados.length === 0 && filtroPrincipal !== 'responsavel')) {
      return;
    }

    const identificarEntidades = () => {
      const entidadesUnicas = new Map();

      // Função auxiliar para verificar se um ID está nos filtros selecionados
      const estaNosFiltrosSelecionados = (id, filtroSelecionado) => {
        if (!filtroSelecionado) return true;
        const idStr = String(id);
        if (Array.isArray(filtroSelecionado)) {
          return filtroSelecionado.some(f => String(f) === idStr);
        }
        return String(filtroSelecionado) === idStr;
      };

      if (filtroPrincipal === 'responsavel') {
        // Enxugamento: só incluir responsáveis que aparecem na lista (têm grupo/card em registrosAgrupados)
        registrosAgrupados.forEach(agr => {
          const id = agr.primeiroRegistro?.responsavel_id;
          if (id && estaNosFiltrosSelecionados(id, filtroResponsavelSelecionado)) {
            entidadesUnicas.set(String(id), { id: String(id), tipo: 'responsavel' });
          }
        });
      } else if (filtroPrincipal === 'cliente') {
        // Enxugamento: só incluir clientes que aparecem na lista (têm grupo/card em registrosAgrupados)
        registrosAgrupados.forEach(agr => {
          const clienteIds = String(agr.primeiroRegistro.cliente_id || '')
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);

          clienteIds.forEach(id => {
            if (estaNosFiltrosSelecionados(id, filtroClienteSelecionado)) {
              entidadesUnicas.set(id, { id, tipo: 'cliente' });
            }
          });
        });
      } else if (filtroPrincipal === 'produto') {
        // Enxugamento: só incluir produtos que aparecem na lista (têm grupo/card em registrosAgrupados)
        registrosAgrupados.forEach(agr => {
          const id = String(agr.primeiroRegistro.produto_id);
          if (id && estaNosFiltrosSelecionados(id, filtroProdutoSelecionado)) {
            entidadesUnicas.set(id, { id, tipo: 'produto' });
          }
        });
      } else if (filtroPrincipal === 'tipoTarefa') {
        // Tipo de Tarefa: um card por tipo (entidade = tipo_tarefa_id)
        registrosAgrupados.forEach(agr => {
          (agr.regras || [agr.primeiroRegistro]).forEach(r => {
            if (!r || r.tipo_tarefa_id == null) return;
            const id = String(r.tipo_tarefa_id);
            if (id && estaNosFiltrosSelecionados(id, filtroTipoTarefaSelecionado)) {
              entidadesUnicas.set(id, { id, tipo: 'tipoTarefa' });
            }
          });
        });
      } else if (filtroPrincipal === 'atividade') {
        // Coletar tarefas dos registros agrupados
        registrosAgrupados.forEach(agr => {
          const id = String(agr.primeiroRegistro.tarefa_id);
          if (id && estaNosFiltrosSelecionados(id, filtroTarefaSelecionado)) {
            entidadesUnicas.set(id, { id, tipo: 'atividade' });
          }
        });
      }

      // Só enfileirar entidades que ainda não têm todos os dados (evita re-fetch ao abrir detalhes e sobrescrever realizado)
      const entidadesArray = Array.from(entidadesUnicas.values());
      const fila = entidadesArray.filter(ent => {
        const chave = `${ent.tipo}_${String(ent.id)}`;
        const temRealizado = temposRealizadosPorEntidade[chave] !== undefined;
        if (ent.tipo === 'responsavel') {
          const temEstimado = tempoEstimadoTotalPorResponsavel[String(ent.id)] !== undefined;
          const temContratadas = horasContratadasPorResponsavel[String(ent.id)] !== undefined;
          return !temEstimado || !temRealizado || !temContratadas;
        }
        return !temRealizado;
      });
      console.log(`🚀 [QUEUE] Inicializando fila com ${fila.length} entidades (${entidadesArray.length - fila.length} já carregadas)`);

      // [FIX-DISCREPANCY] Removido limpeza agressiva de cache que causava sumiço de dados ao abrir detalhes
      // A limpeza já é feita em aplicarFiltros e handleFilterChange.
      // Limpar aqui causava perda de dados já carregados quando registrosAgrupados era atualizado (ex: explosão de detalhes).

      // setTempoEstimadoTotalPorResponsavel({});
      // setTemposRealizadosPorEntidade({});
      // setHorasContratadasPorResponsavel({});
      // setTipoContratoPorResponsavel({});
      // setCustosPorResponsavel({});

      setFilaProcessamento(fila);
    };

    identificarEntidades();
  }, [registrosAgrupados, filtroPrincipal, dadosAuxiliaresCarregados, membros, clientes, produtos, filtroResponsavelSelecionado, filtroClienteSelecionado, filtroProdutoSelecionado, filtroTarefaSelecionado, filtroTipoTarefaSelecionado, temposRealizadosPorEntidade, tempoEstimadoTotalPorResponsavel, horasContratadasPorResponsavel]);

  // Ref para debounce de recarga geral de opções
  const debouncedReloadOptionsRef = useRef(null);

  // Inicializar debounce de recarga
  useEffect(() => {
    debouncedReloadOptionsRef.current = debounce(async (filtrosAdicionaisAtivos, filtroPaiAtual, temFiltrosAdicionais) => {
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
    }, 300);

    return () => {
      if (debouncedReloadOptionsRef.current && debouncedReloadOptionsRef.current.cancel) {
        debouncedReloadOptionsRef.current.cancel();
      }
    };
  }, [filtros]);

  // Recarregar opções filtradas quando filtros principais, adicionais ou período mudarem (mesmo sem aplicar)
  useEffect(() => {
    if (periodoInicio && periodoFim) {
      // Recarregar opções filtradas para TODOS os filtros ativos (pai e adicionais)
      const filtroPaiAtual = filtroPrincipal || ordemFiltros[0];
      const temFiltrosAdicionais = filtrosAdicionaisAtivos.cliente || filtrosAdicionaisAtivos.tarefa || filtrosAdicionaisAtivos.produto;

      if (debouncedReloadOptionsRef.current) {
        debouncedReloadOptionsRef.current(filtrosAdicionaisAtivos, filtroPaiAtual, temFiltrosAdicionais);
      }
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
                  filtroKey="tipoTarefa"
                  checked={filtros.tipoTarefa}
                  onChange={handleFilterChange}
                  isFiltroPai={isFiltroPai('tipoTarefa')}
                  title="Tipo de Tarefa"
                  subtitle="Filtrar por"
                  icon="fas fa-list-ul"
                  filtroNome={getFiltroNome('tipoTarefa')}
                  onMouseEnter={() => setFiltroHover('tipoTarefa')}
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

                {filtros.tipoTarefa && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Tipo de Tarefa:</label>
                    <select
                      value={filtroTipoTarefaSelecionado ?? ''}
                      onChange={(e) => setFiltroTipoTarefaSelecionado(e.target.value ? Number(e.target.value) : null)}
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
                      disabled={loading || tiposTarefa.length === 0}
                    >
                      <option value="">Selecionar tipo de tarefa</option>
                      {tiposTarefa.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
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
                        : `Tempo Estimado vs Realizado por ${filtroPrincipal === 'cliente' ? 'Cliente' : filtroPrincipal === 'produto' ? 'Produto' : (filtroPrincipal === 'tipoTarefa' ? 'Tipo de Tarefa' : 'Atividade')}`
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

                        // Usar as datas válidas calculadas no scope do componente
                        const datasValidas = datasValidasDashboards;

                        // Função auxiliar para verificar se uma data está nas datas válidas (usando a versão do componente)
                        const dataEstaNoPeriodoAplicado = isDataNoPeriodoAplicado;

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
                          } else if (filtroPrincipal === 'tipoTarefa') {
                            // Um card por tipo de tarefa: agrupar por tipo_tarefa_id (tratado no bloco abaixo).
                            // Quando os registros foram "explodidos" (ex.: ao abrir Ver detalhes de clientes), cada item pode não ter tipo_tarefa_id;
                            // usar fallback do grupo para não fazer o card do tipo sumir.
                            const fonte = (agrupamento.registros && agrupamento.registros.length > 0) ? agrupamento.registros : (agrupamento.regras || [agrupamento.primeiroRegistro]).filter(Boolean);
                            const tipoIdDoGrupo = agrupamento.primeiroRegistro?.tipo_tarefa_id != null ? String(agrupamento.primeiroRegistro.tipo_tarefa_id) : (agrupamento.regras?.[0]?.tipo_tarefa_id != null ? String(agrupamento.regras[0].tipo_tarefa_id) : null);
                            fonte.forEach(item => {
                              const tipoId = item.tipo_tarefa_id != null ? String(item.tipo_tarefa_id) : tipoIdDoGrupo;
                              if (!tipoId) return;
                              const tipoNome = (tiposTarefa || []).find(t => String(t.id) === tipoId)?.nome || `Tipo #${tipoId}`;
                              if (!entidadesDosRegistros.has(tipoId)) {
                                entidadesDosRegistros.set(tipoId, {
                                  id: tipoId,
                                  nome: tipoNome,
                                  fotoPerfil: null,
                                  fotoPerfilPath: null,
                                  registros: []
                                });
                              }
                              entidadesDosRegistros.get(tipoId).registros.push({
                                ...item,
                                quantidade: agrupamento.quantidade
                              });
                            });
                            return;
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
                          // Sempre usar produto.nome da lista para o card (evita "Produto" genérico antes do cache)
                          produtos.forEach(produto => {
                            const produtoId = String(produto.id);
                            // Se há filtro selecionado, verificar se o produto está incluído
                            if (!estaNosFiltrosSelecionados(produto.id, filtroProdutoSelecionado)) {
                              return; // Pular este produto se não estiver nos filtros
                            }

                            if (entidadesDosRegistros.has(produtoId)) {
                              const ent = entidadesDosRegistros.get(produtoId);
                              todasEntidades.set(produtoId, { ...ent, nome: produto.nome || ent.nome });
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
                        } else if (filtroPrincipal === 'tipoTarefa') {
                          // Para tipo de tarefa: mesma lógica dos outros agrupadores = ordem estável.
                          // Usar a ordem da lista tiposTarefa quando existir, para o card não mudar de lugar ao abrir detalhes.
                          if (tiposTarefa && tiposTarefa.length > 0) {
                            tiposTarefa.forEach(tipo => {
                              const key = String(tipo.id);
                              if (!estaNosFiltrosSelecionados(tipo.id, filtroTipoTarefaSelecionado)) return;
                              if (!entidadesDosRegistros.has(key)) return;
                              const entidade = entidadesDosRegistros.get(key);
                              todasEntidades.set(key, { ...entidade, nome: tipo.nome || entidade.nome });
                            });
                            // Incluir tipos que estão nos registros mas não na lista (ex.: tipo novo ainda não no combo)
                            entidadesDosRegistros.forEach((entidade, key) => {
                              if (todasEntidades.has(key)) return;
                              if (!estaNosFiltrosSelecionados(entidade.id, filtroTipoTarefaSelecionado)) return;
                              const tipoNome = (tiposTarefa || []).find(t => String(t.id) === key)?.nome || entidade.nome;
                              todasEntidades.set(key, { ...entidade, nome: tipoNome });
                            });
                          } else {
                            entidadesDosRegistros.forEach((entidade, key) => {
                              if (!estaNosFiltrosSelecionados(entidade.id, filtroTipoTarefaSelecionado)) return;
                              const tipoNome = (tiposTarefa || []).find(t => String(t.id) === key)?.nome || entidade.nome;
                              todasEntidades.set(key, { ...entidade, nome: tipoNome });
                            });
                          }
                        } else {
                          // Para atividades, usar apenas as que estão nos registros (filtradas se houver seleção)
                          // Mesclar nome da lista tarefas quando existir (evita "Tarefa" genérico antes do cache)
                          entidadesDosRegistros.forEach((entidade, key) => {
                            // Se há filtro selecionado, verificar se a tarefa está incluída
                            if (!estaNosFiltrosSelecionados(entidade.id, filtroTarefaSelecionado)) {
                              return; // Pular esta tarefa se não estiver nos filtros
                            }
                            const tarefa = tarefas.find(t => String(t.id) === String(entidade.id));
                            todasEntidades.set(key, { ...entidade, nome: tarefa?.nome || entidade.nome });
                          });
                        }

                        // Ordenar todas as entidades alfabeticamente para garantir estabilidade visual
                        // IMPORTANTE: NÃO separar por "com tempo" vs "sem tempo" para evitar saltos na UI
                        // quando os dados assíncronos são carregados (Order Lock)
                        const todosOrdenados = Array.from(todasEntidades.values()).map(entidade => {
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
                              } else if (filtroPrincipal === 'tipoTarefa') {
                                pertence = (agr.regras || [primeiroRegistro]).some(r => r && String(r.tipo_tarefa_id) === String(entidade.id));
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

                          return {
                            entidade,
                            tempoInfo: (tempoInfo && tempoInfo.estimado > 0) ? tempoInfo : null,
                            responsavelIdParaCusto
                          };
                        });

                        // Ordenar alfabeticamente (Stable Sort). Para tipo de tarefa, quando a ordem veio da lista tiposTarefa, não reordenar para o card não mudar de lugar.
                        const manterOrdemTipoTarefa = filtroPrincipal === 'tipoTarefa' && tiposTarefa && tiposTarefa.length > 0;
                        if (!manterOrdemTipoTarefa) {
                          todosOrdenados.sort((a, b) => {
                            const cmp = a.entidade.nome.localeCompare(b.entidade.nome, 'pt-BR');
                            return cmp !== 0 ? cmp : String(a.entidade.id).localeCompare(String(b.entidade.id), 'pt-BR');
                          });
                        }

                        // Limitar a 4 inicialmente se não estiver expandido
                        const dashboardsParaExibir = dashboardsExpandidos
                          ? todosOrdenados
                          : todosOrdenados.slice(0, 4);
                        const temMaisDashboards = todosOrdenados.length > 4;

                        return (
                          <>
                            {dashboardsParaExibir.map(({ entidade, tempoInfo, responsavelIdParaCusto }) => {
                              // [UNIFIED-LOADING] Verificar se TODOS os dados necessários estão carregados
                              let isFullyLoaded = true;
                              if (filtroPrincipal === 'responsavel') {
                                const temContratadas = horasContratadasPorResponsavel[String(entidade.id)] !== undefined;
                                const temRealizado = temposRealizadosPorEntidade[`responsavel_${entidade.id}`] !== undefined;
                                const temEstimado = tempoEstimadoTotalPorResponsavel[String(entidade.id)] !== undefined;

                                // Se faltar QUALQUER um, considera carregando
                                if (!temContratadas || !temRealizado || !temEstimado) {
                                  isFullyLoaded = false;
                                }
                              } else {
                                // Para outros filtros, checamos apenas realizado/estimado
                                const chaveRealizado = `${filtroPrincipal}_${String(entidade.id)}`;
                                const temRealizado = temposRealizadosPorEntidade[chaveRealizado] !== undefined;
                                // Estimado é calculado na hora se não tiver cache, então é menos crítico, 
                                // mas idealmente deveríamos ter cache.
                                // Simplificação: se temRealizado, assume carregado
                                if (!temRealizado) isFullyLoaded = false;
                              }

                              // Se não estiver carregado, mostrar Skeleton/Loading unificado
                              if (!isFullyLoaded) {
                                return (
                                  <div key={String(entidade.id)} className="tempo-disponivel-card" style={{ opacity: 0.7, pointerEvents: 'none' }}>
                                    <div className="tempo-disponivel-card-header">
                                      <div className="tempo-disponivel-card-nome-wrapper">
                                        <div className="skeleton-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e0e0e0', marginRight: '12px' }}></div>
                                        <div className="skeleton-text" style={{ width: '150px', height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px' }}></div>
                                      </div>
                                    </div>
                                    <div className="tempo-disponivel-card-content">
                                      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                        Carregando métricas...
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              // Sempre exibir o card, mesmo se não houver tempo estimado (para identificar quem falta estimar)
                              if (!tempoInfo) {
                                // Calcular tempo (estimado/realizado) para exibir na barra mesmo quando estimado é 0
                                const tempoInfoSemEstimado = calcularTempoPorEntidade(
                                  entidade.id,
                                  filtroPrincipal,
                                  registrosAgrupados
                                );
                                const cardPayload = cardsPorEntidade[String(entidade.id)];
                                // Para tipoTarefa, sempre usar calcularEstatisticasPorEntidade para totalTarefas (contagem correta)
                                const estatisticasCalc = calcularEstatisticasPorEntidade(entidade.id, filtroPrincipal, registrosAgrupados);
                                const estatisticas = cardPayload
                                  ? { 
                                      totalTarefas: filtroPrincipal === 'tipoTarefa' ? estatisticasCalc.totalTarefas : (cardPayload.total_tarefas ?? 0), 
                                      totalClientes: cardPayload.total_clientes ?? 0, 
                                      totalProdutos: cardPayload.total_produtos ?? 0, 
                                      totalResponsaveis: cardPayload.total_responsaveis ?? 0, 
                                      totalTiposTarefa: estatisticasCalc.totalTiposTarefa ?? 0 
                                    }
                                  : estatisticasCalc;

                                return (
                                  <div key={String(entidade.id)} className="tempo-disponivel-card">
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
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-tags"></i>
                                              <span>Tipos de Tarefa: {estatisticas.totalTiposTarefa ?? 0}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${(estatisticas.totalTiposTarefa ?? 0) === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={(estatisticas.totalTiposTarefa ?? 0) > 0 ? "Ver detalhes de tipos de tarefa" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={(estatisticas.totalTiposTarefa ?? 0) > 0 ? (e) => handleOpenCard(entidade, 'tipos_tarefa', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tiposTarefa', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-tags"></i>
                                              <span>Tipos de Tarefa: {estatisticas.totalTiposTarefa ?? 0}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${(estatisticas.totalTiposTarefa ?? 0) === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={(estatisticas.totalTiposTarefa ?? 0) > 0 ? "Ver detalhes de tipos de tarefa" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={(estatisticas.totalTiposTarefa ?? 0) > 0 ? (e) => handleOpenCard(entidade, 'tipos_tarefa', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tiposTarefa', agrs)) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                        {(filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && (
                                          <>
                                            {filtroPrincipal === 'tipoTarefa' && (
                                              <div className="tempo-disponivel-stat-item">
                                                <i className="fas fa-list"></i>
                                                <span>Tarefas: {estatisticas.totalTarefas}</span>
                                                <span
                                                  role="button"
                                                  tabIndex={0}
                                                  className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                  title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                                  onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                                  onKeyDown={estatisticas.totalTarefas > 0 ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleOpenTarefas(entidade, ev); } } : undefined}
                                                >
                                                  <span className="resumo-arrow-anchor">&gt;</span>
                                                </span>
                                              </div>
                                            )}
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-box"></i>
                                              <span>Produtos: {estatisticas.totalProdutos}</span>
                                              <span
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                              >
                                                <span
                                                  className="resumo-arrow-anchor"
                                                  onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                                  onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
                                                >
                                                  &gt;
                                                </span>
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <BarraProgressoTempo
                                        disponivel={tempoInfoSemEstimado?.disponivel ?? 0}
                                        estimado={tempoInfoSemEstimado?.estimado ?? 0}
                                        realizado={tempoInfoSemEstimado?.realizado ?? 0}
                                        pendente={tempoInfoSemEstimado?.pendente ?? 0}
                                        sobrando={tempoInfoSemEstimado?.sobrando ?? 0}
                                        contratado={tempoInfoSemEstimado?.contratado ?? 0}
                                        responsavelId={responsavelIdParaCusto}
                                        mostrarContratadasDisponivel={filtroPrincipal === 'responsavel'}
                                      />
                                    </div>
                                  </div>
                                );
                              }

                              // Usar totais do payload único (gestao-capacidade/cards) quando disponível
                              const cardPayload = cardsPorEntidade[String(entidade.id)];
                              // Para tipoTarefa, sempre usar calcularEstatisticasPorEntidade para totalTarefas (contagem correta)
                              const estatisticasCalc = calcularEstatisticasPorEntidade(entidade.id, filtroPrincipal, registrosAgrupados);
                              const estatisticas = cardPayload
                                ? { 
                                    totalTarefas: filtroPrincipal === 'tipoTarefa' ? estatisticasCalc.totalTarefas : (cardPayload.total_tarefas ?? 0), 
                                    totalClientes: cardPayload.total_clientes ?? 0, 
                                    totalProdutos: cardPayload.total_produtos ?? 0, 
                                    totalResponsaveis: cardPayload.total_responsaveis ?? 0, 
                                    totalTiposTarefa: estatisticasCalc.totalTiposTarefa ?? 0 
                                  }
                                : estatisticasCalc;

                              return (
                                <div key={String(entidade.id)} className="tempo-disponivel-card">
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
                                              onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
                                              title={estatisticas.totalProdutos > 0 ? "Ver detalhes de produtos" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-tags"></i>
                                            <span>Tipos de Tarefa: {estatisticas.totalTiposTarefa ?? 0}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${(estatisticas.totalTiposTarefa ?? 0) === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={(estatisticas.totalTiposTarefa ?? 0) > 0 ? (e) => handleOpenCard(entidade, 'tipos_tarefa', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tiposTarefa', agrs)) : undefined}
                                              title={(estatisticas.totalTiposTarefa ?? 0) > 0 ? "Ver detalhes de tipos de tarefa" : undefined}
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
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
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
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
                                              title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-tags"></i>
                                            <span>Tipos de Tarefa: {estatisticas.totalTiposTarefa ?? 0}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${(estatisticas.totalTiposTarefa ?? 0) === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={(estatisticas.totalTiposTarefa ?? 0) > 0 ? (e) => handleOpenCard(entidade, 'tipos_tarefa', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tiposTarefa', agrs)) : undefined}
                                              title={(estatisticas.totalTiposTarefa ?? 0) > 0 ? "Ver detalhes de tipos de tarefa" : undefined}
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
                                              onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
                                              title={estatisticas.totalResponsaveis > 0 ? "Ver detalhes de responsáveis" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-tags"></i>
                                            <span>Tipos de Tarefa: {estatisticas.totalTiposTarefa ?? 0}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${(estatisticas.totalTiposTarefa ?? 0) === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={(estatisticas.totalTiposTarefa ?? 0) > 0 ? (e) => handleOpenCard(entidade, 'tipos_tarefa', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'tiposTarefa', agrs)) : undefined}
                                              title={(estatisticas.totalTiposTarefa ?? 0) > 0 ? "Ver detalhes de tipos de tarefa" : undefined}
                                            >
                                              &gt;
                                            </span>
                                          </div>
                                        </>
                                      )}
                                      {(filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && (
                                        <>
                                          {filtroPrincipal === 'tipoTarefa' && (
                                            <div className="tempo-disponivel-stat-item">
                                              <i className="fas fa-list"></i>
                                              <span>Tarefas: {estatisticas.totalTarefas}</span>
                                              <span
                                                role="button"
                                                tabIndex={0}
                                                className={`resumo-arrow produtos-arrow ${estatisticas.totalTarefas === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                                title={estatisticas.totalTarefas > 0 ? "Ver detalhes de tarefas" : undefined}
                                                onClick={estatisticas.totalTarefas > 0 ? (e) => handleOpenTarefas(entidade, e) : undefined}
                                                onKeyDown={estatisticas.totalTarefas > 0 ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleOpenTarefas(entidade, ev); } } : undefined}
                                              >
                                                &gt;
                                              </span>
                                            </div>
                                          )}
                                          <div className="tempo-disponivel-stat-item">
                                            <i className="fas fa-box"></i>
                                            <span>Produtos: {estatisticas.totalProdutos}</span>
                                            <span
                                              className={`resumo-arrow produtos-arrow ${estatisticas.totalProdutos === 0 ? 'resumo-arrow-placeholder' : ''}`}
                                              onClick={estatisticas.totalProdutos > 0 ? (e) => handleOpenCard(entidade, 'produtos', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'produtos', agrs)) : undefined}
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
                                              onClick={estatisticas.totalClientes > 0 ? (e) => handleOpenCard(entidade, 'clientes', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'clientes', agrs)) : undefined}
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
                                              onClick={estatisticas.totalResponsaveis > 0 ? (e) => handleOpenCard(entidade, 'responsaveis', e, (id, fP, agrs) => buscarDetalhesPorTipo(id, fP, 'responsaveis', agrs)) : undefined}
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
                      } else if ((filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && primeiroRegistro.tarefa_id) {
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
                      const tempoRealizadoTotal = (temposRealizadosPorEntidade[grupoKey] && (typeof temposRealizadosPorEntidade[grupoKey] === 'number' ? temposRealizadosPorEntidade[grupoKey] : temposRealizadosPorEntidade[grupoKey].realizado)) || 0;
                      const tempoEstimadoFormatado = formatarTempoEstimado(tempoEstimadoTotal, true);
                      const tempoRealizadoFormatado = formatarTempoEstimado(tempoRealizadoTotal, true);

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
                                <span className="atribuicoes-group-tempo-badge atribuicoes-group-tempo-realizado" title={`Realizado: ${formatarTempoEstimado(tempoRealizadoTotal, true)}`}>
                                  <i className="fas fa-stopwatch"></i>
                                  <span>Realizado: {tempoRealizadoFormatado}</span>
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
                                    {(filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && <th></th>}
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
                                    const chaveRealizadoAgrupamento = filtroPrincipal === 'responsavel' ? `responsavel_${primeiroRegistro?.responsavel_id}` : filtroPrincipal === 'cliente' ? `cliente_${String(primeiroRegistro?.cliente_id || '').split(',')[0]?.trim()}` : filtroPrincipal === 'produto' ? `produto_${primeiroRegistro?.produto_id}` : `${filtroPrincipal}_${primeiroRegistro?.tarefa_id}`;
                                    const dadosRealizadoAgrupamento = temposRealizadosPorEntidade[chaveRealizadoAgrupamento];
                                    const tempoRealizadoTotal = dadosRealizadoAgrupamento != null ? (typeof dadosRealizadoAgrupamento === 'number' ? dadosRealizadoAgrupamento : (dadosRealizadoAgrupamento.realizado ?? 0)) : 0;
                                    const isAgrupamentoTarefasExpanded = agrupamentosTarefasExpandidas.has(agrupamento.agrupador_id);

                                    const tempoRealizadoPorTarefa = {};
                                    tarefasUnicas.forEach(tarefaId => {
                                      tempoRealizadoPorTarefa[tarefaId] = 0;
                                    });

                                    return (
                                      <React.Fragment key={agrupamento.agrupador_id}>
                                        <tr>
                                          {(filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && (
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
                                                const tempoRealizadoFormatado = formatarTempoEstimado(tempoRealizadoTotal, true);
                                                const custoEstimado = calcularCustoPorTempo(tempoEstimadoTotal, primeiroRegistro.responsavel_id);
                                                const custoRealizado = tempoRealizadoTotal > 0 ? calcularCustoPorTempo(tempoRealizadoTotal, primeiroRegistro.responsavel_id) : null;

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
                                                    <div className={`atribuicoes-tempo-card ${tempoRealizadoTotal > 0 ? 'atribuicoes-tempo-card-realizado' : 'atribuicoes-tempo-card-realizado-empty'}`}>
                                                      <div className="atribuicoes-tempo-label atribuicoes-tempo-label-realizado-empty">
                                                        <i className="fas fa-stopwatch"></i>
                                                        <span>Realizado</span>
                                                      </div>
                                                      <div className="atribuicoes-tempo-valor atribuicoes-tempo-valor-realizado-empty">
                                                        {tempoRealizadoFormatado}
                                                      </div>
                                                      {custoRealizado !== null && (
                                                        <div className="atribuicoes-tempo-custo atribuicoes-tempo-custo-realizado">
                                                          {formatarValorMonetario(custoRealizado)}
                                                        </div>
                                                      )}
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
                                        {(filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa') && isAgrupamentoTarefasExpanded && (
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
                                                            Realizado: {formatarTempoEstimado(tempoRealizadoTarefa || tempoRealizadoTotal, true)}
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

                                          // Realizado da tarefa: usar soma do cache (registros carregados sob demanda) se existir
                                          const dadosCacheTarefa = registroTempoCache[tarefaKey]?.data;
                                          const sumRealizadoCache = Array.isArray(dadosCacheTarefa) ? dadosCacheTarefa.reduce((acc, r) => {
                                            let t = Number(r.tempo_realizado) || 0;
                                            if (t > 0 && t < 1) t = Math.round(t * 3600000);
                                            return acc + t;
                                          }, 0) : 0;
                                          const tempoRealizadoTarefaDetalhes = sumRealizadoCache > 0 ? sumRealizadoCache : (tempoRealizadoPorTarefa[tarefaId] ?? tempoRealizadoTotal);

                                          return (
                                            <tr key={`detalhes_${tarefaKey}`} className="atribuicoes-tarefa-detalhes">
                                              <td colSpan={7 - (filtroPrincipal === 'atividade' || filtroPrincipal === 'tipoTarefa' ? 1 : 0) - (filtroPrincipal === 'produto' ? 1 : 0) - (filtroPrincipal === 'cliente' ? 1 : 0) - (filtroPrincipal === 'responsavel' ? 1 : 0)} className="atribuicoes-tarefa-detalhes-cell">
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
                                                        Realizado: {formatarTempoEstimado(tempoRealizadoTarefaDetalhes, true)}
                                                      </span>
                                                      <span className="atribuicoes-tarefa-detalhes-count">
                                                        {registrosTarefa.length} registro(s)
                                                      </span>
                                                    </div>
                                                  </div>
                                                  {/* Nível 3: Registros de tempo realizado – carregados sob demanda */}
                                                  <div className="atribuicoes-registro-tempo-toggle" style={{ marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                                                    <button
                                                      type="button"
                                                      className="atribuicoes-tag atribuicoes-tag-clickable"
                                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                      onClick={() => toggleRegistroTempoTarefa(agrupamento.agrupador_id, tarefaId, primeiroRegistro?.cliente_id, primeiroRegistro?.responsavel_id)}
                                                    >
                                                      <i className={`fas fa-chevron-${registroTempoExpandidoPorTarefa.has(tarefaKey) ? 'down' : 'right'}`} style={{ fontSize: '10px' }}></i>
                                                      <span>Registros de tempo realizado</span>
                                                      {registroTempoCache[tarefaKey]?.loading && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#6b7280' }}>Carregando...</span>}
                                                    </button>
                                                    {registroTempoExpandidoPorTarefa.has(tarefaKey) && registroTempoCache[tarefaKey] && !registroTempoCache[tarefaKey].loading && (
                                                      <div style={{ marginTop: '8px' }}>
                                                        {registroTempoCache[tarefaKey].error ? (
                                                          <span style={{ fontSize: '12px', color: '#dc2626' }}>Erro ao carregar.</span>
                                                        ) : (registroTempoCache[tarefaKey].data || []).length === 0 ? (
                                                          <span style={{ fontSize: '12px', color: '#6b7280' }}>Nenhum registro encontrado.</span>
                                                        ) : (
                                                          <table className="atribuicoes-detalhes-table" style={{ fontSize: '12px' }}>
                                                            <thead>
                                                              <tr>
                                                                <th>Início</th>
                                                                <th>Fim</th>
                                                                <th>Tempo</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {(registroTempoCache[tarefaKey].data || []).map((reg, idx) => (
                                                                <tr key={reg.id || idx}>
                                                                  <td>{reg.data_inicio ? new Date(reg.data_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                                                                  <td>{reg.data_fim ? new Date(reg.data_fim).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                                                                  <td>{reg.tempo_realizado != null ? `${Math.round(reg.tempo_realizado / 1000)}s` : '-'}</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        )}
                                                      </div>
                                                    )}
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
          cardTipo={filtroPrincipal}
          tipo={detailCard.tipo}
          dados={detailCard.dados}
          onClose={handleCloseDetail}
          position={detailCardPosition}
          formatarTempoEstimado={formatarTempoEstimado}
          formatarData={formatarData}
          calcularCustoPorTempo={calcularCustoPorTempo}
          formatarValorMonetario={formatarValorMonetario}
          getNomeCliente={getNomeCliente}
          getNomeTipoTarefa={(tipoId) => (tiposTarefa || []).find(t => String(t.id) === String(tipoId))?.nome || `Tipo #${tipoId}`}
          periodoInicio={filtrosUltimosAplicados?.periodoInicio || periodoInicio}
          periodoFim={filtrosUltimosAplicados?.periodoFim || periodoFim}
          filtrosAdicionais={{
            cliente_id: filtroPrincipal === 'cliente' && detailCard?.entidadeId ? detailCard.entidadeId : (filtroAdicionalCliente || null),
            tarefa_id: filtroAdicionalTarefa || null,
            produto_id: filtroAdicionalProduto || null,
            responsavel_id: (filtroPrincipal !== 'responsavel' && filtroResponsavelSelecionado) ? filtroResponsavelSelecionado : (filtroPrincipal === 'responsavel' && detailCard?.entidadeId) ? detailCard.entidadeId : null
          }}
        />
      )}
    </Layout>
  );
};

export default GestaoCapacidade;
