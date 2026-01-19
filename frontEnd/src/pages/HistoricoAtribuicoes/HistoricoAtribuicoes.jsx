import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { clientesAPI, colaboradoresAPI, produtosAPI, tarefasAPI } from '../../services/api';
import '../AtribuicaoCliente/AtribuicaoCliente.css';
import './HistoricoAtribuicoes.css';

const API_BASE_URL = '/api';

const HistoricoAtribuicoes = () => {
  const navigate = useNavigate();
  const showToast = useToast();
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

  // Dados para os filtros
  const [todosClientes, setTodosClientes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);
  const [nomesProdutos, setNomesProdutos] = useState({});
  const [nomesTarefas, setNomesTarefas] = useState({});

  // Estado para modal de confirmação de exclusão
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Refs para sincronizar scroll horizontal
  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const scrollHandlersRef = useRef({ tableScroll: null, topScroll: null });



  // Estado para clientes no formato CustomSelect
  const [clientes, setClientes] = useState([]);

  // Estado para controlar linhas expandidas e seus detalhes
  const [linhasExpandidas, setLinhasExpandidas] = useState(new Set());
  const [detalhesDiarios, setDetalhesDiarios] = useState({});
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(new Set());

  // Estado para edição/exclusão de tarefa diária
  const [modalEdicaoTarefaDiaria, setModalEdicaoTarefaDiaria] = useState(false);
  const [tarefaDiariaEditando, setTarefaDiariaEditando] = useState(null);
  const [tempoEditando, setTempoEditando] = useState({ horas: 0, minutos: 0 });
  const [salvandoTarefaDiaria, setSalvandoTarefaDiaria] = useState(false);
  const [showDeleteTarefaDiariaModal, setShowDeleteTarefaDiariaModal] = useState(false);
  const [tarefaDiariaParaDeletar, setTarefaDiariaParaDeletar] = useState(null);
  const [deletandoTarefaDiaria, setDeletandoTarefaDiaria] = useState(false);

  // Estado para regras órfãs (sem histórico)
  const [regrasOrfas, setRegrasOrfas] = useState([]);
  const [carregandoRegrasOrfas, setCarregandoRegrasOrfas] = useState(false);
  const [sincronizandoOrfas, setSincronizandoOrfas] = useState(false);
  const [showDeleteRegraOrfaModal, setShowDeleteRegraOrfaModal] = useState(false);
  const [regraOrfaParaDeletar, setRegraOrfaParaDeletar] = useState(null);
  const [deletandoRegraOrfa, setDeletandoRegraOrfa] = useState(false);

  // Carregar dados para filtros
  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Carregar clientes - usando o mesmo método da página de atribuição
        const clientesResponse = await clientesAPI.getPaginated({
          page: 1,
          limit: 10000,
          search: null,
          status: null,
          incompletos: false
        });
        if (clientesResponse.success && clientesResponse.data) {
          // Verificar se é array ou objeto com data
          const clientesArray = Array.isArray(clientesResponse.data)
            ? clientesResponse.data
            : (clientesResponse.data.data || []);

          if (Array.isArray(clientesArray) && clientesArray.length > 0) {
            const clientesComDados = clientesArray.map(cliente => ({
              id: cliente.id,
              nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`
            }));
            console.log('📦 Clientes carregados:', clientesComDados.length, clientesComDados.slice(0, 3));
            setClientes(clientesComDados);
            setTodosClientes(clientesArray);
          } else {
            console.warn('⚠️ Array de clientes vazio ou inválido');
            setClientes([]);
            setTodosClientes([]);
          }
        } else {
          console.warn('⚠️ Resposta de clientes inválida:', clientesResponse);
          setClientes([]);
          setTodosClientes([]);
        }

        // Carregar colaboradores
        const colaboradoresResponse = await colaboradoresAPI.getAll({ page: 1, limit: 10000 });
        if (colaboradoresResponse.success) {
          setTodosColaboradores(colaboradoresResponse.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar dados para filtros:', error);
      }
    };

    carregarDados();
  }, []);





  // Carregar nomes de produtos e tarefas
  useEffect(() => {
    const carregarNomes = async () => {
      const produtoIds = new Set();
      const tarefaIds = new Set();

      historico.forEach(item => {
        if (item.produto_ids && Array.isArray(item.produto_ids)) {
          item.produto_ids.forEach(id => {
            // Garantir que o ID seja tratado como número ou string consistentemente
            const idStr = String(id).trim();
            if (idStr) produtoIds.add(idStr);
          });
        }
        if (item.tarefas && Array.isArray(item.tarefas)) {
          item.tarefas.forEach(t => {
            if (t.tarefa_id) {
              const idStr = String(t.tarefa_id).trim();
              if (idStr) tarefaIds.add(idStr);
            }
          });
        }
      });

      if (produtoIds.size > 0) {
        try {
          const idsArray = Array.from(produtoIds);
          console.log('🔍 Buscando nomes de produtos para IDs:', idsArray);
          const response = await fetch(`${API_BASE_URL}/produtos-por-ids-numericos?ids=${idsArray.join(',')}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (response.ok) {
            const result = await response.json();
            console.log('📦 Produtos recebidos:', result);
            if (result.success && result.data) {
              // O endpoint retorna um objeto com id (string) -> nome
              // Garantir que as chaves sejam strings para corresponder aos IDs usados
              const produtosMap = {};
              Object.keys(result.data).forEach(key => {
                produtosMap[String(key)] = result.data[key];
              });
              console.log('✅ Mapa de produtos criado:', produtosMap);
              setNomesProdutos(produtosMap);
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Erro ao buscar produtos:', response.status, response.statusText, errorText);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar nomes de produtos:', error);
        }
      }

      if (tarefaIds.size > 0) {
        try {
          const idsArray = Array.from(tarefaIds);
          console.log('🔍 Buscando nomes de tarefas para IDs:', idsArray);
          const response = await fetch(`${API_BASE_URL}/tarefas-por-ids?ids=${idsArray.join(',')}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (response.ok) {
            const result = await response.json();
            console.log('📦 Tarefas recebidas:', result);
            if (result.success && result.data) {
              // O endpoint retorna um objeto com id -> nome
              // Garantir que as chaves sejam strings para corresponder aos IDs usados
              const tarefasMap = {};
              Object.keys(result.data).forEach(key => {
                tarefasMap[String(key)] = result.data[key];
              });
              console.log('✅ Mapa de tarefas criado:', tarefasMap);
              setNomesTarefas(tarefasMap);
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Erro ao buscar tarefas:', response.status, response.statusText, errorText);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar nomes de tarefas:', error);
        }
      }
    };

    if (historico.length > 0) {
      carregarNomes();
    }
  }, [historico]);

  // Carregar histórico
  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage
      });

      if (filtroResponsavel) {
        params.append('responsavel_id', filtroResponsavel);
      }
      if (filtroUsuarioCriador) {
        params.append('usuario_criador_id', filtroUsuarioCriador);
      }
      if (filtroDataInicio) {
        params.append('data_inicio', filtroDataInicio);
      }
      if (filtroDataFim) {
        params.append('data_fim', filtroDataFim);
      }

      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        setHistorico(result.data || []);
        setTotalRegistros(result.total || 0);
        setTotalPages(result.totalPages || 1);
      } else {
        showToast('error', result.error || 'Erro ao carregar histórico');
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      showToast('error', 'Erro ao carregar histórico. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroResponsavel, filtroUsuarioCriador, filtroDataInicio, filtroDataFim, showToast]);

  // Carregar regras órfãs (sem histórico)
  const carregarRegrasOrfas = useCallback(async () => {
    try {
      setCarregandoRegrasOrfas(true);
      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/orfas`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        // Se o endpoint não existir ou der erro, apenas logar e continuar
        console.warn('Endpoint de regras órfãs não disponível ou erro:', response.status);
        setRegrasOrfas([]);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setRegrasOrfas(result.data || []);
      } else {
        console.error('Erro ao carregar regras órfãs:', result.error);
        setRegrasOrfas([]);
      }
    } catch (error) {
      // Erro não deve quebrar a página - apenas logar e continuar
      console.warn('Erro ao carregar regras órfãs (não crítico):', error);
      setRegrasOrfas([]);
    } finally {
      setCarregandoRegrasOrfas(false);
    }
  }, []);

  // Sincronizar regras órfãs (criar históricos)
  const sincronizarRegrasOrfas = useCallback(async () => {
    setSincronizandoOrfas(true);
    try {
      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/sincronizar-orfaos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', `Sincronização concluída: ${result.historicosCriados} histórico(s) criado(s)`);
        // Recarregar histórico e regras órfãs
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

  // Deletar regra órfã
  const deletarRegraOrfa = useCallback(async () => {
    if (!regraOrfaParaDeletar) return;

    setDeletandoRegraOrfa(true);
    try {
      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/orfas/${regraOrfaParaDeletar.agrupador_id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Regras deletadas com sucesso');
        setShowDeleteRegraOrfaModal(false);
        setRegraOrfaParaDeletar(null);
        // Recarregar lista de regras órfãs
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

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    carregarRegrasOrfas();
  }, [carregarRegrasOrfas]);

  // Handlers de filtros
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

  // Formatar tempo
  const formatarTempo = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0h';
    const horas = Math.floor(milissegundos / (1000 * 60 * 60));
    const minutos = Math.floor((milissegundos % (1000 * 60 * 60)) / (1000 * 60));
    if (horas > 0 && minutos > 0) {
      return `${horas}h ${minutos}min`;
    } else if (horas > 0) {
      return `${horas}h`;
    } else {
      return `${minutos}min`;
    }
  };

  // Formatar data
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Abrir modal de edição de tarefa diária
  const abrirModalEdicaoTarefaDiaria = (tarefa, diaData, historicoId) => {
    const horas = Math.floor((tarefa.tempo_estimado_dia || 0) / (1000 * 60 * 60));
    const minutos = Math.floor(((tarefa.tempo_estimado_dia || 0) % (1000 * 60 * 60)) / (1000 * 60));
    setTarefaDiariaEditando({ ...tarefa, diaData, historicoId });
    setTempoEditando({ horas, minutos });
    setModalEdicaoTarefaDiaria(true);
  };

  // Fechar modal de edição de tarefa diária
  const fecharModalEdicaoTarefaDiaria = () => {
    setModalEdicaoTarefaDiaria(false);
    setTarefaDiariaEditando(null);
    setTempoEditando({ horas: 0, minutos: 0 });
  };

  // Salvar edição de tarefa diária
  const salvarEdicaoTarefaDiaria = async () => {
    if (!tarefaDiariaEditando || !tarefaDiariaEditando.id) return;

    setSalvandoTarefaDiaria(true);
    try {
      const novoTempo = (tempoEditando.horas * 60 * 60 + tempoEditando.minutos * 60) * 1000;

      const response = await fetch(`${API_BASE_URL}/tempo-estimado/${tarefaDiariaEditando.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tempo_estimado_dia: novoTempo
        })
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        showToast('error', errorMessage);
        return;
      }

      const result = await response.json();
      if (result.success) {
        showToast('success', 'Tarefa diária atualizada com sucesso!');
        fecharModalEdicaoTarefaDiaria();

        // Recarregar histórico principal para atualizar período
        await carregarHistorico();

        // Recarregar detalhes diários
        if (tarefaDiariaEditando.historicoId) {
          const responseDetalhes = await fetch(`${API_BASE_URL}/historico-atribuicoes/${tarefaDiariaEditando.historicoId}/detalhes-diarios`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (responseDetalhes.ok) {
            const resultDetalhes = await responseDetalhes.json();
            if (resultDetalhes.success) {
              setDetalhesDiarios(prev => ({
                ...prev,
                [tarefaDiariaEditando.historicoId]: resultDetalhes.data || []
              }));
            }
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

  // Abrir modal de confirmação de exclusão de tarefa diária
  const abrirModalDeletarTarefaDiaria = (tarefa, diaData, historicoId) => {
    setTarefaDiariaParaDeletar({ ...tarefa, diaData, historicoId });
    setShowDeleteTarefaDiariaModal(true);
  };

  // Deletar tarefa diária
  const deletarTarefaDiaria = async () => {
    if (!tarefaDiariaParaDeletar || !tarefaDiariaParaDeletar.id) return;

    setDeletandoTarefaDiaria(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tempo-estimado/${tarefaDiariaParaDeletar.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        showToast('error', errorMessage);
        return;
      }

      const result = await response.json();
      if (result.success) {
        showToast('success', 'Tarefa diária deletada com sucesso!');
        const historicoIdParaRecarregar = tarefaDiariaParaDeletar.historicoId;
        setShowDeleteTarefaDiariaModal(false);
        setTarefaDiariaParaDeletar(null);

        // Recarregar histórico principal para atualizar período
        await carregarHistorico();

        // Recarregar detalhes diários
        if (historicoIdParaRecarregar) {
          const responseDetalhes = await fetch(`${API_BASE_URL}/historico-atribuicoes/${historicoIdParaRecarregar}/detalhes-diarios`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (responseDetalhes.ok) {
            const resultDetalhes = await responseDetalhes.json();
            if (resultDetalhes.success) {
              setDetalhesDiarios(prev => ({
                ...prev,
                [historicoIdParaRecarregar]: resultDetalhes.data || []
              }));
            }
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

  // Toggle de expansão de linha
  const toggleExpandirLinha = async (itemId) => {
    const novoSet = new Set(linhasExpandidas);

    if (novoSet.has(itemId)) {
      // Colapsar
      novoSet.delete(itemId);
      setLinhasExpandidas(novoSet);
    } else {
      // Expandir - buscar detalhes se ainda não foram carregados
      novoSet.add(itemId);
      setLinhasExpandidas(novoSet);

      if (!detalhesDiarios[itemId] && !carregandoDetalhes.has(itemId)) {
        setCarregandoDetalhes(prev => new Set(prev).add(itemId));

        try {
          const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/${itemId}/detalhes-diarios`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setDetalhesDiarios(prev => ({
                ...prev,
                [itemId]: result.data || []
              }));
            }
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

  // Opções de clientes para CustomSelect (memoizado)
  const clienteOptions = useMemo(() => {
    if (!clientes || clientes.length === 0) {
      console.warn('⚠️ Nenhum cliente disponível para o CustomSelect. Total:', clientes?.length || 0);
      return [];
    }
    const options = clientes.map(c => {
      const id = String(c.id || c.value || '');
      const nome = c.nome || c.label || `Cliente #${id}`;
      return { value: id, label: nome };
    }).filter(opt => opt.value && opt.value !== '');
    console.log('🔍 Opções de clientes geradas:', options.length, options.slice(0, 5));
    return options;
  }, [clientes]);

  const getClienteLabel = (clienteId) => {
    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    return cliente ? cliente.nome : clienteId;
  };

  // Função para editar atribuição (navegar para a página principal de edição)
  const handleEditarAtribuicao = (item) => {
    // Usar agrupador_id se disponível, senão o id do historico
    // Garantir que pegamos o valor correto mesmo se agrupador_id for um objeto
    let id = item.agrupador_id;
    if (id && typeof id === 'object') {
      id = id.agrupador_id;
    }
    if (!id) {
      id = item.id;
    }
    navigate(`/atribuicao/nova?agrupador_id=${id}`);
  };

  // Abrir modal de confirmação de exclusão
  const handleAbrirModalDeletar = (item) => {
    if (!item || !item.id) return;
    setItemParaDeletar(item);
    setShowDeleteConfirmModal(true);
  };

  // Deletar histórico (chamado após confirmação)
  const handleDeletarHistorico = async () => {
    if (!itemParaDeletar || !itemParaDeletar.id) return;

    setDeleteLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/${itemParaDeletar.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }

        showToast('error', errorMessage);
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Atribuição deletada com sucesso!');
        setShowDeleteConfirmModal(false);
        setItemParaDeletar(null);
        carregarHistorico(); // Recarregar lista
      } else {
        showToast('error', result.error || 'Erro ao deletar atribuição');
      }
    } catch (error) {
      console.error('❌ Erro ao deletar histórico:', error);
      showToast('error', `Erro ao deletar atribuição: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // useEffect para configurar scroll horizontal sincronizado
  useEffect(() => {
    if (loading || historico.length === 0) return;

    const timeoutId = setTimeout(() => {
      const tableContainer = tableScrollRef.current;
      const topScroll = topScrollRef.current;

      if (!tableContainer || !topScroll) return;

      let resizeObserver = null;

      // Função para sincronizar largura
      const syncWidth = () => {
        const table = tableContainer.querySelector('table');
        if (table && topScroll) {
          const scrollContent = topScroll.querySelector('div');
          if (scrollContent) {
            scrollContent.style.minWidth = `${table.scrollWidth}px`;
          }
          // Forçar scrollbar a aparecer
          topScroll.style.overflowX = 'scroll';
        }
      };

      // Sincronizar scroll - criar funções e armazenar no ref
      scrollHandlersRef.current.tableScroll = () => {
        if (topScroll && tableContainer) {
          topScroll.scrollLeft = tableContainer.scrollLeft;
        }
      };

      scrollHandlersRef.current.topScroll = () => {
        if (tableContainer && topScroll) {
          tableContainer.scrollLeft = topScroll.scrollLeft;
        }
      };

      // Sincronizar largura inicial
      syncWidth();

      // Observar mudanças de tamanho
      resizeObserver = new ResizeObserver(() => {
        syncWidth();
      });

      if (tableContainer) {
        resizeObserver.observe(tableContainer);
        const table = tableContainer.querySelector('table');
        if (table) {
          resizeObserver.observe(table);
        }
      }

      // Adicionar event listeners
      tableContainer.addEventListener('scroll', scrollHandlersRef.current.tableScroll);
      topScroll.addEventListener('scroll', scrollHandlersRef.current.topScroll);
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      const tableContainer = tableScrollRef.current;
      const topScroll = topScrollRef.current;
      if (tableContainer && scrollHandlersRef.current.tableScroll) {
        tableContainer.removeEventListener('scroll', scrollHandlersRef.current.tableScroll);
      }
      if (topScroll && scrollHandlersRef.current.topScroll) {
        topScroll.removeEventListener('scroll', scrollHandlersRef.current.topScroll);
      }
      // Limpar handlers
      scrollHandlersRef.current.tableScroll = null;
      scrollHandlersRef.current.topScroll = null;
    };
  }, [loading, historico.length]);

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

              {/* Seção de Regras Órfãs (sem histórico) */}
              {regrasOrfas && Array.isArray(regrasOrfas) && regrasOrfas.length > 0 && (
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#92400e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <i className="fas fa-exclamation-triangle"></i>
                        Atribuições sem Histórico ({regrasOrfas.length})
                      </h3>
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: '13px',
                        color: '#78350f'
                      }}>
                        Estas atribuições têm regras de tempo estimado mas não possuem histórico associado.
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={sincronizarRegrasOrfas}
                      disabled={sincronizandoOrfas}
                      style={{
                        minWidth: '180px'
                      }}
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

                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    backgroundColor: '#fffbeb'
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px'
                    }}>
                      <thead>
                        <tr style={{
                          backgroundColor: '#fef3c7',
                          borderBottom: '2px solid #fbbf24'
                        }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Cliente</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Responsável</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Período</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Produtos</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Tarefas</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: '#92400e', width: '100px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regrasOrfas.map((regra, index) => (
                          <tr key={regra.agrupador_id || index} style={{
                            borderBottom: '1px solid #fde68a',
                            backgroundColor: index % 2 === 0 ? '#fffbeb' : '#fef3c7'
                          }}>
                            <td style={{ padding: '10px' }}>
                              {regra.cliente?.nome || `Cliente #${regra.cliente_id}`}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {regra.responsavel?.nome || `Responsável #${regra.responsavel_id}`}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {regra.data_inicio && regra.data_fim ? (
                                `${formatarData(regra.data_inicio)} até ${formatarData(regra.data_fim)}`
                              ) : (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {regra.produtos && Array.isArray(regra.produtos) && regra.produtos.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {regra.produtos.map((produto, idx) => (
                                    <span key={idx} style={{
                                      padding: '2px 6px',
                                      backgroundColor: '#fbbf24',
                                      color: '#78350f',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 500
                                    }}>
                                      {produto?.nome || `Produto #${produto?.id || idx}`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {regra.tarefas && Array.isArray(regra.tarefas) && regra.tarefas.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {regra.tarefas.slice(0, 3).map((tarefa, idx) => (
                                    <span key={idx} style={{
                                      fontSize: '12px',
                                      color: '#78350f'
                                    }}>
                                      {tarefa?.tarefa_nome || `Tarefa #${tarefa?.tarefa_id || idx}`} ({formatarTempo(tarefa?.tempo_estimado_dia || 0)})
                                    </span>
                                  ))}
                                  {regra.tarefas.length > 3 && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: '#9ca3af',
                                      fontStyle: 'italic'
                                    }}>
                                      +{regra.tarefas.length - 3} mais
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setRegraOrfaParaDeletar(regra);
                                  setShowDeleteRegraOrfaModal(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#dc2626',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                                onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                                title="Deletar regras"
                              >
                                <i className="fas fa-trash"></i>
                                Deletar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela */}
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
                    {/* Barra de scroll no topo */}
                    <div
                      ref={topScrollRef}
                      className="table-scroll-top"
                      style={{
                        width: '100%',
                        overflowX: 'scroll',
                        overflowY: 'hidden',
                        marginBottom: '0',
                        borderBottom: '2px solid #e2e8f0',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}
                    >
                      <div style={{ height: '1px', minWidth: '100%' }}></div>
                    </div>
                    <div
                      ref={tableScrollRef}
                      className="table-scroll-container"
                      style={{
                        width: '100%',
                        overflowX: 'auto',
                        overflowY: 'visible'
                      }}
                    >
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
                                  <td style={{ width: '40px', textAlign: 'center', padding: '8px' }}>
                                    <button
                                      onClick={() => toggleExpandirLinha(item.id)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0e3b6f',
                                        fontSize: '14px',
                                        transition: 'transform 0.2s'
                                      }}
                                      title={estaExpandida ? 'Colapsar detalhes' : 'Expandir detalhes'}
                                    >
                                      <i
                                        className={`fas fa-chevron-${estaExpandida ? 'down' : 'right'}`}
                                        style={{
                                          transform: estaExpandida ? 'rotate(0deg)' : 'rotate(0deg)',
                                          transition: 'transform 0.2s'
                                        }}
                                      ></i>
                                    </button>
                                  </td>
                                  <td>
                                    <div className="historico-date-time">
                                      <div className="historico-date">{formatarData(item.created_at?.split('T')[0])}</div>
                                      <div className="historico-time">
                                        {item.created_at?.split('T')[1]?.substring(0, 5)}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-cliente">
                                      {item.cliente?.nome || `Cliente #${item.cliente_id}`}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-responsavel">
                                      {item.responsavel?.nome || `Colaborador #${item.responsavel_id}`}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-produtos">
                                      {item.produto_ids && Array.isArray(item.produto_ids) && item.produto_ids.length > 0 ? (
                                        item.produto_ids.map((produtoId, idx) => (
                                          <div key={produtoId} className="historico-badge">
                                            <div className="historico-badge-label">
                                              <i className="fas fa-box"></i>
                                              <span>PRODUTO</span>
                                            </div>
                                            <div className="historico-badge-valor">
                                              {nomesProdutos[String(produtoId)] || `Produto #${produtoId}`}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <span className="historico-empty">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-periodo">
                                      {formatarData(item.data_inicio)} - {formatarData(item.data_fim)}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-tarefas">
                                      {item.tarefas && Array.isArray(item.tarefas) && item.tarefas.length > 0 ? (
                                        <div className="tarefas-list">
                                          {item.tarefas.map((tarefa, idx) => (
                                            <div key={idx} className="tarefa-item">
                                              <span className="tarefa-nome">
                                                {nomesTarefas[String(tarefa.tarefa_id)] || `Tarefa #${tarefa.tarefa_id}`}
                                              </span>
                                              <div className="tarefa-tempo-card">
                                                <div className="tarefa-tempo-label">
                                                  <i className="fas fa-clock"></i>
                                                  <span>ESTIMADO</span>
                                                </div>
                                                <div className="tarefa-tempo-valor">
                                                  {formatarTempo(tarefa.tempo_estimado_dia)}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="historico-empty">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <div className="historico-usuario-criador">
                                      {item.usuario_criador?.nome || `Usuário #${item.usuario_criador_id}`}
                                    </div>
                                  </td>
                                  <td className="actions-column">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                      <EditButton
                                        onClick={() => handleEditarAtribuicao(item)}
                                        title="Editar atribuição"
                                      />
                                      <DeleteButton
                                        onClick={() => handleAbrirModalDeletar(item)}
                                        title="Deletar atribuição"
                                      />
                                    </div>
                                  </td>
                                </tr>
                                {/* Linha expandida com detalhes diários */}
                                {estaExpandida && (
                                  <tr>
                                    <td colSpan="9" style={{ padding: 0, backgroundColor: '#f9fafb' }}>
                                      <div style={{ padding: '20px', borderTop: '2px solid #e5e7eb' }}>
                                        {carregando ? (
                                          <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                            <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                            Carregando detalhes...
                                          </div>
                                        ) : detalhes.length === 0 ? (
                                          <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                            <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                                            Nenhum detalhe diário encontrado
                                          </div>
                                        ) : (
                                          <div>
                                            <h4 style={{
                                              fontSize: '14px',
                                              fontWeight: '600',
                                              color: '#111827',
                                              marginBottom: '16px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px'
                                            }}>
                                              <i className="fas fa-calendar-day" style={{ color: '#0e3b6f' }}></i>
                                              Detalhes Diários
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                              {detalhes.map((dia, idx) => (
                                                <div
                                                  key={idx}
                                                  style={{
                                                    background: 'white',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    padding: '12px 16px'
                                                  }}
                                                >
                                                  <div style={{
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    color: '#111827',
                                                    marginBottom: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                  }}>
                                                    <i className="fas fa-calendar" style={{ color: '#0e3b6f', fontSize: '12px' }}></i>
                                                    {formatarData(dia.data)}
                                                  </div>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }}>
                                                    {dia.tarefas && dia.tarefas.length > 0 ? (
                                                      dia.tarefas.map((tarefa, tarefaIdx) => (
                                                        <div
                                                          key={tarefaIdx}
                                                          style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '6px 10px',
                                                            background: '#f9fafb',
                                                            borderRadius: '4px',
                                                            border: '1px solid #e5e7eb',
                                                            gap: '8px'
                                                          }}
                                                        >
                                                          <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>
                                                            {tarefa.tarefa_nome}
                                                          </span>
                                                          <div className="tarefa-tempo-card" style={{ marginLeft: '12px', flexShrink: 0 }}>
                                                            <div className="tarefa-tempo-label">
                                                              <i className="fas fa-clock"></i>
                                                              <span>ESTIMADO</span>
                                                            </div>
                                                            <div className="tarefa-tempo-valor">
                                                              {formatarTempo(tarefa.tempo_estimado_dia)}
                                                            </div>
                                                          </div>
                                                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                            <EditButton
                                                              onClick={() => abrirModalEdicaoTarefaDiaria(tarefa, dia.data, item.id)}
                                                              title="Editar tarefa diária"
                                                            />
                                                            <DeleteButton
                                                              onClick={() => abrirModalDeletarTarefaDiaria(tarefa, dia.data, item.id)}
                                                              title="Deletar tarefa diária"
                                                            />
                                                          </div>
                                                        </div>
                                                      ))
                                                    ) : (
                                                      <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                        Nenhuma tarefa atribuída neste dia
                                                      </span>
                                                    )}
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

                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="pagination">
                        <button
                          className="pagination-btn"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1 || loading}
                        >
                          <i className="fas fa-chevron-left"></i>
                          Anterior
                        </button>
                        <span className="pagination-info">
                          Página {currentPage} de {totalPages} ({totalRegistros} registro{totalRegistros !== 1 ? 's' : ''})
                        </span>
                        <button
                          className="pagination-btn"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages || loading}
                        >
                          Próxima
                          <i className="fas fa-chevron-right"></i>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContainer>



          {/* Modal de confirmação para exclusão */}
          <ConfirmModal
            isOpen={showDeleteConfirmModal}
            onClose={() => {
              setShowDeleteConfirmModal(false);
              setItemParaDeletar(null);
            }}
            onConfirm={handleDeletarHistorico}
            title="Confirmar Exclusão"
            message={
              itemParaDeletar ? (
                <>
                  <p>Tem certeza que deseja excluir esta atribuição?</p>
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                    <strong>Cliente:</strong> {itemParaDeletar.cliente?.nome || `Cliente #${itemParaDeletar.cliente_id}`}<br />
                    <strong>Responsável:</strong> {itemParaDeletar.responsavel?.nome || `Colaborador #${itemParaDeletar.responsavel_id}`}<br />
                    <strong>Período:</strong> {formatarData(itemParaDeletar.data_inicio)} - {formatarData(itemParaDeletar.data_fim)}<br />
                    {itemParaDeletar.usuario_criador && (
                      <>
                        <strong>Usuário que criou:</strong> {itemParaDeletar.usuario_criador?.nome || `Usuário #${itemParaDeletar.usuario_criador_id}`}<br />
                      </>
                    )}
                  </p>
                  <p style={{ marginTop: '16px', color: '#dc2626', fontWeight: 500, fontSize: '13px' }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                    Esta ação não pode ser desfeita. Todos os registros de tempo estimado associados a esta atribuição serão removidos.
                  </p>
                </>
              ) : null
            }
            confirmText="Excluir"
            cancelText="Cancelar"
            confirmButtonClass="btn-danger"
            loading={deleteLoading}
          />

          {/* Modal de edição de tarefa diária */}
          {modalEdicaoTarefaDiaria && tarefaDiariaEditando && (
            <div className="modal-overlay" onClick={fecharModalEdicaoTarefaDiaria}>
              <div className="modal-content" style={{
                maxWidth: '500px',
                width: '95%'
              }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 24px',
                  borderBottom: '1px solid #eee',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <i className="fas fa-edit" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                      Editar Tarefa Diária
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={fecharModalEdicaoTarefaDiaria}
                    disabled={salvandoTarefaDiaria}
                    title="Fechar (ESC)"
                    style={{ fontSize: '18px' }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="modal-body" style={{
                  padding: '20px 24px'
                }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      Tarefa
                    </label>
                    <div style={{
                      padding: '10px 12px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#111827'
                    }}>
                      {tarefaDiariaEditando.tarefa_nome}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      Data
                    </label>
                    <div style={{
                      padding: '10px 12px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#111827'
                    }}>
                      {formatarData(tarefaDiariaEditando.diaData)}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                      Tempo Estimado
                    </label>
                    <div
                      className="tempo-input-wrapper"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '8px 14px',
                        background: '#ffffff',
                        border: '2px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '13px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="number"
                        value={tempoEditando.horas || ''}
                        onChange={(e) => {
                          const horas = parseInt(e.target.value, 10) || 0;
                          setTempoEditando(prev => ({ ...prev, horas }));
                        }}
                        disabled={salvandoTarefaDiaria}
                        placeholder="0"
                        min="0"
                        style={{
                          width: '50px',
                          padding: '0',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '13px',
                          textAlign: 'center',
                          color: '#334155',
                          fontWeight: '500'
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>h</span>
                      <input
                        type="number"
                        value={tempoEditando.minutos || ''}
                        onChange={(e) => {
                          const minutos = parseInt(e.target.value, 10) || 0;
                          setTempoEditando(prev => ({ ...prev, minutos: Math.min(59, Math.max(0, minutos)) }));
                        }}
                        disabled={salvandoTarefaDiaria}
                        placeholder="0"
                        min="0"
                        max="59"
                        style={{
                          width: '50px',
                          padding: '0',
                          border: 'none',
                          background: 'transparent',
                          fontSize: '13px',
                          textAlign: 'center',
                          color: '#334155',
                          fontWeight: '500'
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>min</span>
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{
                  padding: '14px 24px',
                  borderTop: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  flexShrink: 0
                }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalEdicaoTarefaDiaria}
                    disabled={salvandoTarefaDiaria}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px'
                    }}
                  >
                    <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={salvarEdicaoTarefaDiaria}
                    disabled={salvandoTarefaDiaria}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      opacity: salvandoTarefaDiaria ? 0.6 : 1,
                      cursor: salvandoTarefaDiaria ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {salvandoTarefaDiaria ? (
                      <>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de confirmação para exclusão de tarefa diária */}
          <ConfirmModal
            isOpen={showDeleteTarefaDiariaModal}
            onClose={() => {
              setShowDeleteTarefaDiariaModal(false);
              setTarefaDiariaParaDeletar(null);
            }}
            onConfirm={deletarTarefaDiaria}
            title="Confirmar Exclusão"
            message={
              tarefaDiariaParaDeletar ? (
                <>
                  <p>Tem certeza que deseja excluir esta tarefa diária?</p>
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                    <strong>Tarefa:</strong> {tarefaDiariaParaDeletar.tarefa_nome}<br />
                    <strong>Data:</strong> {formatarData(tarefaDiariaParaDeletar.diaData)}<br />
                    <strong>Tempo Estimado:</strong> {formatarTempo(tarefaDiariaParaDeletar.tempo_estimado_dia)}
                  </p>
                  <p style={{ marginTop: '16px', color: '#dc2626', fontWeight: 500, fontSize: '13px' }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                    Esta ação não pode ser desfeita.
                  </p>
                </>
              ) : null
            }
            confirmText="Excluir"
            cancelText="Cancelar"
            confirmButtonClass="btn-danger"
            loading={deletandoTarefaDiaria}
          />

          {/* Modal de confirmação para exclusão de regra órfã */}
          <ConfirmModal
            isOpen={showDeleteRegraOrfaModal}
            onClose={() => {
              setShowDeleteRegraOrfaModal(false);
              setRegraOrfaParaDeletar(null);
            }}
            onConfirm={deletarRegraOrfa}
            title="Confirmar Exclusão de Regras"
            message={
              regraOrfaParaDeletar ? (
                <>
                  <p>Tem certeza que deseja excluir estas regras de tempo estimado?</p>
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                    <strong>Cliente:</strong> {regraOrfaParaDeletar.cliente?.nome || `Cliente #${regraOrfaParaDeletar.cliente_id}`}<br />
                    <strong>Responsável:</strong> {regraOrfaParaDeletar.responsavel?.nome || `Responsável #${regraOrfaParaDeletar.responsavel_id}`}<br />
                    <strong>Período:</strong> {regraOrfaParaDeletar.data_inicio && regraOrfaParaDeletar.data_fim ? `${formatarData(regraOrfaParaDeletar.data_inicio)} até ${formatarData(regraOrfaParaDeletar.data_fim)}` : '—'}<br />
                    <strong>Quantidade de regras:</strong> {regraOrfaParaDeletar.quantidade_regras || 0}
                  </p>
                  <p style={{ marginTop: '16px', color: '#dc2626', fontWeight: 500, fontSize: '13px' }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                    Esta ação não pode ser desfeita. Todas as regras de tempo estimado relacionadas serão permanentemente removidas.
                  </p>
                </>
              ) : null
            }
            confirmText="Deletar"
            cancelText="Cancelar"
            confirmButtonClass="btn-danger"
            loading={deletandoRegraOrfa}
          />
        </main>
      </div>
    </Layout>
  );
};

export default HistoricoAtribuicoes;

