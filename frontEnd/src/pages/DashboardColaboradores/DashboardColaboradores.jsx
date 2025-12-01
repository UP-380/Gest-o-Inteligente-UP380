import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterColaborador from '../../components/filters/FilterColaborador';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FiltersCard from '../../components/filters/FiltersCard';
import DashboardCards from '../../components/dashboard/DashboardCards';
import { ColaboradorCard } from '../../components/colaboradores';
import DetailSideCard from '../../components/colaboradores/DetailSideCard';
import MiniCardLista from '../../components/dashboard/MiniCardLista';
import './DashboardColaboradores.css';

// API Base URL - usa proxy do Vite em desenvolvimento
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.ApiConfig) {
    return window.ApiConfig.baseURL;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Cache helper
const cache = {
  get(key) {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION) {
        sessionStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  set(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore cache errors
    }
  }
};

const RelatoriosColaboradores = () => {
  // Estado dos filtros
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState(null);
  const [filtroDataFim, setFiltroDataFim] = useState(null);
  const [filtroColaborador, setFiltroColaborador] = useState(null);

  // Estado dos dados
  const [todosClientes, setTodosClientes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);

  // Estado dos resultados
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allRegistrosTempo, setAllRegistrosTempo] = useState([]);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalColaboradores, setTotalColaboradores] = useState(0);
  
  // Estado para rastrear se os filtros foram aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);

  // Estado do card lateral
  const [detailCard, setDetailCard] = useState(null);
  const [detailCardPosition, setDetailCardPosition] = useState(null);

  // Estado do mini card de lista (tarefas, produtos, clientes)
  const [miniCardLista, setMiniCardLista] = useState(null);
  const [miniCardPosition, setMiniCardPosition] = useState(null);

  // Cache de dados dos colaboradores para os cards laterais
  const colaboradorDataCacheRef = useRef({});

  // Limpar seleção de colaborador se ele não estiver mais na lista de colaboradores disponíveis
  useEffect(() => {
    if (filtroColaborador && todosColaboradores.length > 0) {
      const colaboradorIds = Array.isArray(filtroColaborador) 
        ? filtroColaborador.map(id => String(id).trim())
        : [String(filtroColaborador).trim()];
      
      // Verificar se todos os colaboradores selecionados ainda existem
      const colaboradoresValidos = colaboradorIds.filter(colaboradorId => 
        todosColaboradores.some(c => String(c.id).trim() === colaboradorId)
      );
      
      // Se algum colaborador foi removido, atualizar o filtro
      if (colaboradoresValidos.length !== colaboradorIds.length) {
        if (colaboradoresValidos.length === 0) {
          setFiltroColaborador(null);
        } else if (Array.isArray(filtroColaborador)) {
          setFiltroColaborador(colaboradoresValidos.length === 1 ? colaboradoresValidos[0] : colaboradoresValidos);
        } else {
          setFiltroColaborador(colaboradoresValidos.length === 1 ? colaboradoresValidos[0] : colaboradoresValidos);
        }
      }
    }
  }, [todosColaboradores, filtroColaborador]);

  // Carregar clientes
  const carregarClientes = useCallback(async () => {
    try {
      const cacheKey = 'clientes_all';
      const cached = cache.get(cacheKey);
      
      if (cached) {
        setTodosClientes(cached);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/clientes`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Content-Type:', contentType);
        throw new Error(`Resposta não é JSON. Status: ${response.status}`);
      }
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosClientes(result.data);
        cache.set(cacheKey, result.data);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
    }
  }, []);

  // Carregar colaboradores
  const carregarColaboradores = useCallback(async () => {
    try {
      const cacheKey = 'colaboradores_all';
      const cached = cache.get(cacheKey);
      
      if (cached) {
        setTodosColaboradores(cached);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Content-Type:', contentType);
        throw new Error(`Resposta não é JSON. Status: ${response.status}`);
      }
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosColaboradores(result.data);
        cache.set(cacheKey, result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }, []);

  // Carregar colaboradores por cliente(s) - aceita array ou valor único
  const carregarColaboradoresPorCliente = useCallback(async (clienteId, periodoInicio = null, periodoFim = null) => {
    try {
      if (!clienteId) {
        await carregarColaboradores();
        return;
      }

      // Normalizar para array (suporta tanto array quanto valor único)
      const clienteIds = Array.isArray(clienteId) 
        ? clienteId 
        : [clienteId];

      // Obter período se estiver selecionado
      const params = [];
      
      // Enviar múltiplos clientes como parâmetros repetidos
      clienteIds.forEach(id => {
        params.push(`clienteId=${encodeURIComponent(id)}`);
      });
      
      if (periodoInicio && periodoFim) {
        params.push(`periodoInicio=${encodeURIComponent(periodoInicio)}`);
        params.push(`periodoFim=${encodeURIComponent(periodoFim)}`);
      }
      
      const url = `${API_BASE_URL}/membros-por-cliente?${params.join('&')}`;

      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os colaboradores sejam incluídos, mesmo sem nome
        // Remover duplicatas baseado no ID
        const colaboradoresUnicos = new Map();
        result.data.forEach(m => {
          const idStr = String(m.id).trim();
          if (!colaboradoresUnicos.has(idStr)) {
            colaboradoresUnicos.set(idStr, { 
              id: m.id, 
              nome: m.nome || `Colaborador #${m.id}`,
              status: m.status || 'ativo'
            });
          }
        });
        const colaboradoresArray = Array.from(colaboradoresUnicos.values());
        setTodosColaboradores(colaboradoresArray);
      } else {
        setTodosColaboradores([]);
      }
    } catch (error) {
      setTodosColaboradores([]);
    }
  }, [carregarColaboradores]);

  // Carregar clientes por colaborador(es) - aceita array ou valor único
  const carregarClientesPorColaborador = useCallback(async (colaboradorId) => {
    try {
      if (!colaboradorId) {
        await carregarClientes();
        return;
      }

      // Normalizar para array (suporta tanto array quanto valor único)
      const colaboradorIds = Array.isArray(colaboradorId) 
        ? colaboradorId 
        : [colaboradorId];

      // Obter período se estiver selecionado
      const params = [];
      
      // Enviar múltiplos colaboradores como parâmetros repetidos
      colaboradorIds.forEach(id => {
        params.push(`colaboradorId=${encodeURIComponent(id)}`);
      });
      
      if (filtroDataInicio && filtroDataFim) {
        params.push(`periodoInicio=${encodeURIComponent(filtroDataInicio)}`);
        params.push(`periodoFim=${encodeURIComponent(filtroDataFim)}`);
      }
      
      const url = `${API_BASE_URL}/clientes-por-colaborador?${params.join('&')}`;

      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      
      if (result.success && result.data) {
        const novosClientes = result.data.map(c => ({ id: c.id, nome: c.nome }));
        setTodosClientes(novosClientes);
      } else {
        setTodosClientes([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes por colaborador:', error);
      await carregarClientes();
    }
  }, [filtroDataInicio, filtroDataFim, carregarClientes]);

  // Carregar colaboradores paginados
  const carregarColaboradoresPaginados = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/relatorios-colaboradores?page=${currentPage}&limit=${itemsPerPage}`;
      
      // Suportar array de clientes
      if (filtroCliente) {
        const clienteIds = Array.isArray(filtroCliente) 
          ? filtroCliente 
          : (typeof filtroCliente === 'string' && filtroCliente.trim() !== '' ? [filtroCliente] : null);
        
        if (clienteIds && clienteIds.length > 0) {
          // Enviar múltiplos clientes como parâmetros repetidos
          clienteIds.forEach(id => {
            url += `&clienteId=${encodeURIComponent(id)}`;
          });
        }
      }
      // Suportar array de colaboradores
      if (filtroColaborador) {
        const colaboradorIds = Array.isArray(filtroColaborador) 
          ? filtroColaborador 
          : (typeof filtroColaborador === 'string' && filtroColaborador.trim() !== '' ? [filtroColaborador] : null);
        
        if (colaboradorIds && colaboradorIds.length > 0) {
          // Enviar múltiplos colaboradores como parâmetros repetidos
          colaboradorIds.forEach(id => {
            url += `&colaboradorId=${encodeURIComponent(id)}`;
          });
        }
      }
      if (filtroDataInicio && (typeof filtroDataInicio === 'string' ? filtroDataInicio.trim() !== '' : true)) {
        url += `&dataInicio=${encodeURIComponent(filtroDataInicio)}`;
      }
      if (filtroDataFim && (typeof filtroDataFim === 'string' ? filtroDataFim.trim() !== '' : true)) {
        url += `&dataFim=${encodeURIComponent(filtroDataFim)}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        if (response.status === 404) {
          throw new Error('Endpoint não encontrado. Verifique se o servidor backend está rodando na porta 4000.');
        }
        throw new Error(`Erro HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar colaboradores');
      }
      
      const colaboradoresComResumos = result.data || [];
      
      // Usar os totais gerais retornados pelo backend
      if (result.totaisGerais) {
        const { todosRegistros } = result.totaisGerais;
        setAllRegistrosTempo(todosRegistros || []);
      } else {
        // Fallback: coletar todos os registros
        const registrosMap = new Map();
        
        colaboradoresComResumos.forEach(item => {
          if (item.registros && Array.isArray(item.registros)) {
            item.registros.forEach(registro => {
              const registroId = registro.id || `${registro.tarefa_id}_${registro.usuario_id}_${registro.data_inicio}_${registro.data_fim || ''}`;
              if (!registrosMap.has(registroId)) {
                registrosMap.set(registroId, registro);
              }
            });
          }
        });
        
        setAllRegistrosTempo(Array.from(registrosMap.values()));
      }
      
      // Armazenar dados no cache para os cards laterais
      colaboradoresComResumos.forEach(item => {
        colaboradorDataCacheRef.current[item.colaborador.id] = {
          registros: item.registros || [],
          tarefasUnicas: item.resumo.totalTarefasUnicas,
          produtosUnicos: item.resumo.totalProdutosUnicos,
          clientesUnicos: item.resumo.totalClientesUnicos
        };
      });
      
      setColaboradores(colaboradoresComResumos);
      setTotalColaboradores(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error('Erro ao carregar colaboradores paginados:', error);
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroCliente, filtroColaborador, filtroDataInicio, filtroDataFim]);

  // Aplicar filtros
  const aplicarFiltros = useCallback(() => {
    // Validar período
    if (filtroDataInicio && filtroDataFim) {
      if (new Date(filtroDataInicio) > new Date(filtroDataFim)) {
        alert('A data de início deve ser anterior ou igual à data de fim');
        return;
      }
    }

    // Removida validação: filtro de cliente pode ser usado sem período

    // Validar se há colaboradores selecionados e se requer período
    const temColaboradores = Array.isArray(filtroColaborador) 
      ? filtroColaborador.length > 0 
      : (filtroColaborador && filtroColaborador.toString().trim() !== '');
    
    if (temColaboradores && !filtroDataInicio && !filtroDataFim) {
      alert('O filtro "Colaborador" requer que o filtro "Período" esteja selecionado');
      return;
    }

    // Verificar se tem pelo menos um filtro
    const valores = {
      cliente: filtroCliente,
      periodo: { inicio: filtroDataInicio, fim: filtroDataFim },
      colaborador: filtroColaborador
    };

    const temAlgumFiltro = Object.values(valores).some(valor => {
      if (valor === null || valor === undefined) return false;
      if (typeof valor === 'object') {
        // Se for array, verificar se tem elementos
        if (Array.isArray(valor)) {
          return valor.length > 0;
        }
        // Se for objeto de período, verificar inicio e fim
        return valor.inicio && valor.fim;
      }
      return valor && valor.toString().trim() !== '';
    });

    if (!temAlgumFiltro) {
      alert('Selecione pelo menos um filtro');
      return;
    }

    setCurrentPage(1);
    setFiltrosAplicados(true);
    carregarColaboradoresPaginados();
  }, [filtroCliente, filtroDataInicio, filtroDataFim, filtroColaborador, carregarColaboradoresPaginados]);

  // Limpar filtros
  const limparFiltros = useCallback(async () => {
    // Limpar todos os filtros
    setFiltroCliente(null);
    setFiltroColaborador(null);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    
    // Limpar cache
    try {
      sessionStorage.removeItem('clientes_all');
      sessionStorage.removeItem('colaboradores_all');
    } catch (e) {
      // Ignore cache errors
    }
    
    // Recarregar todos os dados sem filtros
    await carregarClientes();
    await carregarColaboradores();
    
    // Limpar resultados
    setColaboradores([]);
    setAllRegistrosTempo([]);
    setCurrentPage(1);
    setFiltrosAplicados(false);
  }, [carregarClientes, carregarColaboradores]);

  // Handlers dos filtros
  const handleClienteChange = useCallback(async (e) => {
    const value = e.target.value || null;
    setFiltroCliente(value);
    if (value) {
      // Se for array, usar o primeiro cliente para carregar colaboradores
      // Mas passar todos os clientes para carregar colaboradores
      await carregarColaboradoresPorCliente(value, filtroDataInicio, filtroDataFim);
    } else {
      await carregarColaboradores();
    }
  }, [carregarColaboradoresPorCliente, carregarColaboradores, filtroDataInicio, filtroDataFim]);

  // Recarregar colaboradores quando o período mudar e houver cliente selecionado
  useEffect(() => {
    if (filtroCliente && (filtroDataInicio || filtroDataFim)) {
      // Se ambos os períodos estiverem preenchidos, recarregar colaboradores
      if (filtroDataInicio && filtroDataFim) {
        carregarColaboradoresPorCliente(filtroCliente, filtroDataInicio, filtroDataFim);
      }
    } else if (filtroCliente && !filtroDataInicio && !filtroDataFim) {
      // Se cliente está selecionado mas período foi removido, recarregar sem período
      carregarColaboradoresPorCliente(filtroCliente);
    }
  }, [filtroDataInicio, filtroDataFim, filtroCliente, carregarColaboradoresPorCliente]);

  const handleColaboradorChange = useCallback(async (e) => {
    // value pode ser null, um array, ou um único valor (para compatibilidade)
    const value = e.target.value || null;
    
    // Normalizar IDs para garantir consistência
    const normalizeId = (id) => String(id).trim();
    const colaboradorIds = Array.isArray(value) 
      ? value.map(normalizeId).filter(Boolean)
      : (value ? [normalizeId(value)] : null);
    
    setFiltroColaborador(colaboradorIds && colaboradorIds.length > 0 ? colaboradorIds : null);
    
    if (colaboradorIds && colaboradorIds.length > 0) {
      // Se houver colaboradores selecionados, carregar clientes de todos eles
      await carregarClientesPorColaborador(colaboradorIds);
    } else {
      await carregarClientes();
    }
  }, [carregarClientes, carregarClientesPorColaborador]);

  // Abrir card lateral
  const handleOpenDetail = useCallback((colaboradorId, tipo, event) => {
    const dados = colaboradorDataCacheRef.current[colaboradorId];
    if (!dados) return;

    // Calcular posição ao lado do botão clicado
    let left = '50%';
    let top = '50%';
    
    if (event && event.target) {
      const triggerElement = event.target;
      const arrowRect = triggerElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      const documentLeft = arrowRect.left + scrollLeft;
      const documentTop = arrowRect.top + scrollTop;
      
      const cardWidth = 500;
      const cardHeight = 400;
      
      let calculatedLeft = documentLeft + arrowRect.width + 10;
      let calculatedTop = documentTop;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      if ((calculatedLeft - scrollLeft) + cardWidth > vw) {
        calculatedLeft = documentLeft - cardWidth - 10;
      }
      
      if ((calculatedLeft - scrollLeft) < 10) {
        calculatedLeft = scrollLeft + 10;
      }
      
      if ((calculatedTop - scrollTop) + cardHeight > vh) {
        calculatedTop = scrollTop + vh - cardHeight - 10;
      }
      if ((calculatedTop - scrollTop) < 10) {
        calculatedTop = scrollTop + 10;
      }
      
      left = `${calculatedLeft}px`;
      top = `${calculatedTop}px`;
    }

    setDetailCardPosition({ left, top });
    setDetailCard({ colaboradorId, tipo, dados, filtroCliente });
  }, [filtroCliente]);

  // Fechar card lateral
  const handleCloseDetail = useCallback(() => {
    setDetailCard(null);
    setDetailCardPosition(null);
  }, []);

  // Handlers de dashboard cards
  const handleShowTarefas = useCallback(async (e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhuma tarefa encontrada');
      return;
    }

    const tarefasMap = new Map();
    const tarefasIdsParaBuscar = [];

    allRegistrosTempo.forEach(registro => {
      if (registro.tarefa_id) {
        const tarefaId = String(registro.tarefa_id).trim();
        
        const nomeTarefa = registro.tarefa?.tarefa_nome || 
                          registro.tarefa?.nome ||
                          registro.tarefa?.titulo || 
                          registro.tarefa?.descricao;
        
        if (nomeTarefa) {
          tarefasMap.set(tarefaId, nomeTarefa);
        } else {
          tarefasIdsParaBuscar.push(tarefaId);
        }
      }
    });

    // Se houver tarefas sem nome, buscar na API
    if (tarefasIdsParaBuscar.length > 0) {
      try {
        const idsParam = tarefasIdsParaBuscar.join(',');
        const response = await fetch(`${API_BASE_URL}/tarefas-por-ids?ids=${encodeURIComponent(idsParam)}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            Object.entries(result.data).forEach(([id, nome]) => {
              if (nome) {
                tarefasMap.set(id, nome);
              } else {
                tarefasMap.set(id, `Tarefa #${id}`);
              }
            });
          }
        }
        
        tarefasIdsParaBuscar.forEach(id => {
          if (!tarefasMap.has(id)) {
            tarefasMap.set(id, `Tarefa #${id}`);
          }
        });
      } catch (error) {
        console.error('Erro ao buscar nomes das tarefas:', error);
        tarefasIdsParaBuscar.forEach(id => {
          if (!tarefasMap.has(id)) {
            tarefasMap.set(id, `Tarefa #${id}`);
          }
        });
      }
    }

    const itens = Array.from(tarefasMap.values());
    
    if (itens.length === 0) {
      alert('Nenhuma tarefa encontrada');
      return;
    }
    
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Tarefas', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo]);

  const handleShowClientes = useCallback((e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhum cliente encontrado');
      return;
    }

    // Se há filtro de cliente, considerar apenas os clientes filtrados
    const clienteIdsFiltro = filtroCliente 
      ? (Array.isArray(filtroCliente) 
          ? filtroCliente.map(id => String(id).trim().toLowerCase())
          : [String(filtroCliente).trim().toLowerCase()])
      : null;

    const clientesMap = new Map();
    allRegistrosTempo.forEach(registro => {
      if (registro.cliente_id) {
        const clienteIds = String(registro.cliente_id)
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
        
        clienteIds.forEach(clienteId => {
          const clienteIdNormalizado = String(clienteId).trim().toLowerCase();
          
          // Se há filtro, considerar apenas os clientes que estão no filtro
          if (clienteIdsFiltro && !clienteIdsFiltro.includes(clienteIdNormalizado)) {
            return; // Pular clientes que não estão no filtro
          }
          
          if (!clientesMap.has(clienteId)) {
            const nomeCliente = registro.cliente?.nome || 
                               (todosClientes && todosClientes.find(c => String(c.id) === clienteId)?.nome) ||
                               `Cliente #${clienteId}`;
            clientesMap.set(clienteId, nomeCliente);
          }
        });
      }
    });

    const itens = Array.from(clientesMap.values());
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Clientes', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosClientes, filtroCliente]);

  // Função para calcular posição do mini card
  const calcularPosicaoMiniCard = useCallback((event) => {
    if (!event || !event.target) {
      return { left: '50%', top: '50%' };
    }

    const triggerElement = event.target;
    const arrowRect = triggerElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const documentLeft = arrowRect.left + scrollLeft;
    const documentTop = arrowRect.top + scrollTop;

    const cardWidth = 400;
    const cardHeight = 300;

    let left = documentLeft + arrowRect.width + 10;
    let top = documentTop;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if ((left - scrollLeft) + cardWidth > vw) {
      left = documentLeft - cardWidth - 10;
    }

    if ((left - scrollLeft) < 10) {
      left = scrollLeft + 10;
    }

    if ((top - scrollTop) + cardHeight > vh) {
      top = scrollTop + vh - cardHeight - 10;
    }
    if ((top - scrollTop) < 10) {
      top = scrollTop + 10;
    }

    return { left: `${left}px`, top: `${top}px` };
  }, []);

  // Fechar mini card
  const handleCloseMiniCard = useCallback(() => {
    setMiniCardLista(null);
    setMiniCardPosition(null);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    try {
      sessionStorage.removeItem('clientes_all');
    } catch (e) {
      // Ignore cache errors
    }
    carregarClientes();
    carregarColaboradores();
  }, [carregarClientes, carregarColaboradores]);

  // Recarregar dados quando a página ou itens por página mudarem (apenas se filtros já foram aplicados)
  useEffect(() => {
    if (filtrosAplicados) {
      carregarColaboradoresPaginados();
    }
  }, [currentPage, itemsPerPage, filtrosAplicados, carregarColaboradoresPaginados]);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
        <div className="form-header">
          <h2 className="form-title">Relatórios de Colaboradores</h2>
          <div className="form-header-actions">
            <button 
              className="add-client-btn active"
              onClick={() => {
                window.location.href = '/gestao-colaboradores';
              }}
            >
              <i className="fas fa-briefcase"></i>
              Colaboradores
            </button>
          </div>
        </div>

        {/* Seção de Filtros */}
        <FiltersCard
          onApply={aplicarFiltros}
          onClear={limparFiltros}
          loading={loading}
        >
          <div className="filter-group">
            <FilterClientes
              value={filtroCliente}
              onChange={handleClienteChange}
              options={todosClientes}
              disabled={false}
            />
          </div>

          <div className="filter-group">
            <FilterColaborador
              value={filtroColaborador}
              onChange={handleColaboradorChange}
              options={todosColaboradores.filter(colab => {
                // Filtrar colaboradores inativos
                const status = colab.status || 'ativo';
                return status !== 'inativo';
              })}
              disabled={false}
            />
          </div>

          <div className="filter-group">
            <FilterPeriodo
              dataInicio={filtroDataInicio}
              dataFim={filtroDataFim}
              onInicioChange={(e) => {
                const value = e.target.value;
                setFiltroDataInicio(value && value.trim() !== '' ? value : null);
              }}
              onFimChange={(e) => {
                const value = e.target.value;
                setFiltroDataFim(value && value.trim() !== '' ? value : null);
              }}
              disabled={false}
            />
          </div>
        </FiltersCard>

        {/* Cards de Dashboard */}
        {allRegistrosTempo.length > 0 && (
          <DashboardCards
            registrosTempo={allRegistrosTempo}
            clientesExibidos={[]}
            onShowTarefas={handleShowTarefas}
            onShowClientes={handleShowClientes}
            showColaboradores={false}
            filtroCliente={filtroCliente}
          />
        )}

        {/* Resultados */}
        <div className="results-container" style={{ marginTop: '30px' }}>
          <div id="resultsContent">
            {loading ? (
              <div className="loading">
                <i className="fas fa-spinner"></i>
                <p>Carregando resultados...</p>
              </div>
            ) : colaboradores.length > 0 ? (
              <div className="colaboradores-grid">
                {colaboradores.map((item) => (
                  <ColaboradorCard
                    key={item.colaborador.id}
                    colaborador={item.colaborador}
                    resumo={item.resumo}
                    registros={item.registros || []}
                    onOpenDetail={handleOpenDetail}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '240px', 
                color: '#555', 
                fontSize: '20px', 
                fontWeight: 600, 
                letterSpacing: '0.5px', 
                textAlign: 'center' 
              }}>
                POR FAVOR APLIQUE OS FILTROS
              </div>
            )}
          </div>
        
          {/* Controles de Paginação */}
          {totalColaboradores > 0 && (
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
                </select>
              </div>
              
              <div className="pagination-info">
                <span>
                  Mostrando {totalColaboradores === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} a{' '}
                  {Math.min(currentPage * itemsPerPage, totalColaboradores)} de {totalColaboradores} colaboradores
                </span>
              </div>
              
              <div className="pagination-controls">
                <button 
                  className="pagination-btn" 
                  title="Primeira página"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button 
                  className="pagination-btn" 
                  title="Página anterior"
                  disabled={currentPage === 1}
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
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button 
                  className="pagination-btn" 
                  title="Última página"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
      
      {/* Card Lateral de Detalhes */}
      {detailCard && (
        <DetailSideCard
          colaboradorId={detailCard.colaboradorId}
          tipo={detailCard.tipo}
          dados={detailCard.dados}
          onClose={handleCloseDetail}
          position={detailCardPosition}
          filtroCliente={detailCard.filtroCliente}
        />
      )}

      {/* Mini Card de Lista (Tarefas, Produtos, Clientes) */}
      {miniCardLista && (
        <MiniCardLista
          titulo={miniCardLista.titulo}
          itens={miniCardLista.itens}
          onClose={handleCloseMiniCard}
          position={miniCardPosition}
        />
      )}
    </div>
    </Layout>
  );
};

export default RelatoriosColaboradores;
