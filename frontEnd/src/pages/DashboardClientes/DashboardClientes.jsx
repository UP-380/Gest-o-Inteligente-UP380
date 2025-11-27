import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import FilterStatus from '../../components/filters/FilterStatus';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterColaborador from '../../components/filters/FilterColaborador';
import DashboardCards from '../../components/dashboard/DashboardCards';
import { ClientCard } from '../../components/clients';
import DetailSideCard from '../../components/clients/DetailSideCard';
import MiniCardLista from '../../components/dashboard/MiniCardLista';
import './DashboardClientes.css';

// API Base URL - usa proxy do Vite em desenvolvimento
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.ApiConfig) {
    return window.ApiConfig.baseURL;
  }
  // Em desenvolvimento, usa o proxy do Vite que redireciona /api para localhost:4000
  // Em produção, usa /api diretamente
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

const DashboardClientes = () => {
  // Estado dos filtros
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState(null);
  const [filtroDataFim, setFiltroDataFim] = useState(null);
  const [filtroColaborador, setFiltroColaborador] = useState(null);

  // Estado dos dados
  const [todosStatus, setTodosStatus] = useState([]);
  const [todosClientes, setTodosClientes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);
  
  // Estado para mensagem quando não há clientes após filtros combinados
  const [mensagemFiltroCliente, setMensagemFiltroCliente] = useState(null);
  
  // Estado para indicar se está carregando clientes
  const [loadingClientes, setLoadingClientes] = useState(false);


  // Limpar seleção de cliente se ele não estiver mais na lista de clientes disponíveis
  useEffect(() => {
    if (filtroCliente && todosClientes.length > 0) {
      const clienteIds = Array.isArray(filtroCliente) 
        ? filtroCliente.map(id => String(id).trim())
        : [String(filtroCliente).trim()];
      
      // Verificar se todos os clientes selecionados ainda existem
      const clientesValidos = clienteIds.filter(clienteId => 
        todosClientes.some(c => String(c.id).trim() === clienteId)
      );
      
      // Se algum cliente foi removido, atualizar o filtro
      if (clientesValidos.length !== clienteIds.length) {
        if (clientesValidos.length === 0) {
          setFiltroCliente(null);
        } else if (Array.isArray(filtroCliente)) {
          setFiltroCliente(clientesValidos.length === 1 ? clientesValidos[0] : clientesValidos);
        } else {
          setFiltroCliente(clientesValidos.length === 1 ? clientesValidos[0] : clientesValidos);
        }
      }
    }
  }, [todosClientes, filtroCliente]);

  // Preservar seleção de colaborador mesmo quando a lista de colaboradores mudar
  // Não limpar automaticamente - apenas validar se o colaborador ainda existe
  useEffect(() => {
    if (filtroColaborador && todosColaboradores.length > 0) {
      const colaboradorIds = Array.isArray(filtroColaborador) 
        ? filtroColaborador.map(id => String(id).trim())
        : [String(filtroColaborador).trim()];
      
      // Verificar se todos os colaboradores selecionados ainda existem na lista
      const colaboradoresValidos = colaboradorIds.filter(colaboradorId => 
        todosColaboradores.some(c => String(c.id).trim() === colaboradorId)
      );
      
      // Se algum colaborador foi removido da lista, manter a seleção mesmo assim
      // (não limpar automaticamente, pois pode ser uma lista filtrada temporariamente)
      // Só limpar se realmente não houver nenhum colaborador válido E a lista não estiver vazia
      if (colaboradoresValidos.length === 0 && todosColaboradores.length > 0) {
        // Não limpar - pode ser que o colaborador esteja em uma lista filtrada
        // A seleção será preservada mesmo que não apareça na lista atual
        console.log('⚠️ [FILTRO] Colaborador selecionado não está na lista atual, mas mantendo seleção');
      }
    }
  }, [todosColaboradores, filtroColaborador]);

  // Estado dos resultados
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allContratos, setAllContratos] = useState([]);
  const [allRegistrosTempo, setAllRegistrosTempo] = useState([]);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  
  // Estado para rastrear se os filtros foram aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);

  // Estado do card lateral
  const [detailCard, setDetailCard] = useState(null);
  const [detailCardPosition, setDetailCardPosition] = useState(null);

  // Estado do mini card de lista (tarefas, colaboradores, clientes)
  const [miniCardLista, setMiniCardLista] = useState(null);
  const [miniCardPosition, setMiniCardPosition] = useState(null);

  // Estado de tarefas incompletas
  const [tarefasIncompletas, setTarefasIncompletas] = useState([]);
  const [mostrarIncompletas, setMostrarIncompletas] = useState(false);
  const [loadingIncompletas, setLoadingIncompletas] = useState(false);

  // Cache de dados dos clientes para os cards laterais
  const clienteDataCacheRef = useRef({});
  
  // Ref para controlar requisições em andamento e evitar race conditions
  const requestControllerRef = useRef(null);

  // Carregar status
  const carregarStatus = useCallback(async (clienteId = null) => {
    try {
      const cacheKey = `status_${clienteId || 'all'}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        setTodosStatus(cached);
        return;
      }

      let url = `${API_BASE_URL}/status`;
      if (clienteId) {
        url += `?clienteId=${clienteId}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosStatus(result.data);
        cache.set(cacheKey, result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  }, []);

  // Carregar clientes
  const carregarClientes = useCallback(async (status = null) => {
    try {
      const cacheKey = `clientes_${status || 'all'}`;
      const cached = cache.get(cacheKey);
      
      if (cached) {
        setTodosClientes(cached);
        setMensagemFiltroCliente(null); // Limpar mensagem ao carregar do cache
        setLoadingClientes(false); // Não está carregando se veio do cache
        return;
      }

      // Iniciar loading apenas se não veio do cache
      setLoadingClientes(true);
      
      let url = `${API_BASE_URL}/clientes`;
      if (status) {
        url += `?status=${encodeURIComponent(status)}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // Verificar se a resposta é HTML (erro)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Content-Type:', contentType);
        console.error('❌ Status:', response.status);
        console.error('❌ URL:', url);
        console.error('❌ Primeiros 500 caracteres da resposta:', text.substring(0, 500));
        throw new Error(`Resposta não é JSON. Status: ${response.status}. Content-Type: ${contentType}. Verifique se o servidor backend está rodando na porta 4000 e se o proxy do Vite está configurado.`);
      }
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosClientes(result.data);
        cache.set(cacheKey, result.data);
        setMensagemFiltroCliente(null); // Limpar mensagem ao carregar com sucesso
        setLoadingClientes(false); // Finalizar loading
      } else {
        setLoadingClientes(false); // Finalizar loading mesmo se não houver dados
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      setMensagemFiltroCliente(null);
      setLoadingClientes(false); // Finalizar loading em caso de erro
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
      
      // Verificar se a resposta é HTML (erro)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Resposta não é JSON! Content-Type:', contentType);
        console.error('❌ Status:', response.status);
        console.error('❌ URL:', `${API_BASE_URL}/membros-id-nome`);
        console.error('❌ Primeiros 500 caracteres da resposta:', text.substring(0, 500));
        throw new Error(`Resposta não é JSON. Status: ${response.status}. Content-Type: ${contentType}. Verifique se o servidor backend está rodando na porta 4000 e se o proxy do Vite está configurado.`);
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
  // REPLICANDO A LÓGICA DE carregarClientesPorColaborador, mas invertida
  const carregarColaboradoresPorCliente = useCallback(async (clienteId, periodoInicio = null, periodoFim = null) => {
    try {
      if (!clienteId) {
        await carregarColaboradores();
        return;
      }

      // Normalizar para array (suporta tanto array quanto valor único) - MESMA LÓGICA DE carregarClientesPorColaborador
      const clienteIds = Array.isArray(clienteId) 
        ? clienteId 
        : [clienteId];

      // Obter período se estiver selecionado - MESMA LÓGICA DE carregarClientesPorColaborador
      const params = [];
      
      // Enviar múltiplos clientes como parâmetros repetidos - MESMA LÓGICA DE carregarClientesPorColaborador
      clienteIds.forEach(id => {
        params.push(`clienteId=${encodeURIComponent(id)}`);
      });
      
      if (periodoInicio && periodoFim) {
        params.push(`periodoInicio=${encodeURIComponent(periodoInicio)}`);
        params.push(`periodoFim=${encodeURIComponent(periodoFim)}`);
      }
      
      const url = `${API_BASE_URL}/membros-por-cliente?${params.join('&')}`;

      console.log('🔍 [FRONTEND] Buscando colaboradores por cliente:', {
        clienteIds,
        periodoInicio,
        periodoFim,
        url
      });

      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      
      console.log('📊 [FRONTEND] Resultado da busca:', {
        success: result.success,
        count: result.data?.length || 0,
        data: result.data
      });
      
      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os colaboradores sejam incluídos, mesmo sem nome
        // Remover duplicatas baseado no ID
        const colaboradoresUnicos = new Map();
        result.data.forEach(m => {
          const idStr = String(m.id).trim();
          if (!colaboradoresUnicos.has(idStr)) {
            colaboradoresUnicos.set(idStr, { 
              id: m.id, 
              nome: m.nome || `Colaborador #${m.id}` // Fallback para nome se não tiver
            });
          }
        });
        const colaboradoresArray = Array.from(colaboradoresUnicos.values());
        console.log(`✅ [FRONTEND] Colaboradores únicos encontrados: ${colaboradoresArray.length}`);
        setTodosColaboradores(colaboradoresArray);
      } else {
        console.warn('⚠️ [FRONTEND] Nenhum colaborador retornado ou formato inválido');
        setTodosColaboradores([]);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Erro ao carregar colaboradores por cliente:', error);
      setTodosColaboradores([]);
    }
  }, [carregarColaboradores]);

  // Carregar clientes por colaborador(es) - aceita array ou valor único
  const carregarClientesPorColaborador = useCallback(async (colaboradorId, statusAtual = null) => {
    try {
      // Usar status passado ou o estado atual
      const statusParaUsar = statusAtual !== null ? statusAtual : filtroStatus;

      if (!colaboradorId) {
        // Se não há colaborador, carregar apenas por status (se houver)
        await carregarClientes(statusParaUsar);
        setMensagemFiltroCliente(null);
        return;
      }

      // Limpar lista imediatamente para evitar mostrar dados antigos
      setTodosClientes([]);
      setMensagemFiltroCliente(null);
      setLoadingClientes(true); // Iniciar loading

      // Normalizar para array (suporta tanto array quanto valor único)
      const colaboradorIds = Array.isArray(colaboradorId) 
        ? colaboradorId 
        : [colaboradorId];

      console.log(`🔍 [FILTRO] Buscando clientes para ${colaboradorIds.length} colaborador(es):`, colaboradorIds);
      console.log(`🔍 [FILTRO] Status a aplicar: ${statusParaUsar || 'nenhum'}`);

      // Obter período se estiver selecionado
      const params = [];
      
      // Enviar múltiplos colaboradores como parâmetros repetidos
      // Isso retorna clientes de QUALQUER UM dos colaboradores (OR lógico)
      colaboradorIds.forEach(id => {
        params.push(`colaboradorId=${encodeURIComponent(id)}`);
      });
      
      if (filtroDataInicio && filtroDataFim) {
        params.push(`periodoInicio=${encodeURIComponent(filtroDataInicio)}`);
        params.push(`periodoFim=${encodeURIComponent(filtroDataFim)}`);
      }
      
      const url = `${API_BASE_URL}/clientes-por-colaborador?${params.join('&')}`;
      
      console.log(`🔍 [FILTRO] URL da requisição:`, url);
      console.log(`🔍 [FILTRO] Parâmetros enviados:`, params);

      // Usar o controller atual se existir (para cancelamento)
      const controller = requestControllerRef.current;
      const signal = controller ? controller.signal : null;

      // OTIMIZAÇÃO: Se houver status, fazer ambas as requisições em paralelo
      if (statusParaUsar) {
        // Verificar cache primeiro para status
        const cacheKeyStatus = `clientes_${statusParaUsar}`;
        const cachedStatus = cache.get(cacheKeyStatus);
        
        try {
          // Fazer requisições em paralelo para melhor performance
          const [responseColaborador, responseStatus] = await Promise.all([
            fetch(url, {
              credentials: 'include',
              signal: signal,
            }),
            cachedStatus 
              ? Promise.resolve({ cached: true, data: cachedStatus }) 
              : fetch(`${API_BASE_URL}/clientes?status=${encodeURIComponent(statusParaUsar)}`, {
                  credentials: 'include',
                  signal: signal,
                })
          ]);

          // Processar resposta dos colaboradores
          if (!responseColaborador.ok) throw new Error(`HTTP error! status: ${responseColaborador.status}`);
          const result = await responseColaborador.json();
          
          // Processar resposta do status (do cache ou da requisição)
          let resultStatus = null;
          if (responseStatus.cached) {
            resultStatus = { success: true, data: responseStatus.data };
          } else {
            if (!responseStatus.ok) throw new Error(`HTTP error! status: ${responseStatus.status}`);
            resultStatus = await responseStatus.json();
            // Salvar no cache se não estava em cache
            if (resultStatus.success && resultStatus.data) {
              cache.set(cacheKeyStatus, resultStatus.data);
            }
          }
          
          console.log(`🔍 [FILTRO] Clientes encontrados dos colaboradores: ${result.data?.length || 0} clientes`);
          
          if (result.success && result.data) {
          // Remover duplicatas de clientes (caso algum cliente apareça para múltiplos colaboradores)
          const clientesUnicos = new Map();
          result.data.forEach(c => {
            if (c && c.id !== null && c.id !== undefined) {
              const cId = String(c.id).trim().toLowerCase();
              if (!clientesUnicos.has(cId)) {
                clientesUnicos.set(cId, c);
              }
            }
          });
          let clientesFiltrados = Array.from(clientesUnicos.values());
          
          console.log(`🔍 [FILTRO] Após remover duplicatas: ${clientesFiltrados.length} clientes únicos`);
          
          // Aplicar filtro de status usando interseção otimizada
          if (resultStatus.success && resultStatus.data) {
            // Normalizar IDs para comparação consistente (string, trim, lowercase)
            // OTIMIZAÇÃO: Usar Set para busca O(1) ao invés de O(n)
            const clienteIdsComStatus = new Set(
              resultStatus.data.map(c => {
                const id = c.id !== null && c.id !== undefined ? String(c.id).trim() : '';
                return id.toLowerCase();
              })
            );
            
            // OTIMIZAÇÃO: Filtrar usando Set.has() que é O(1) ao invés de array.includes() que é O(n)
            const clientesAntes = clientesFiltrados.length;
            const clientesComStatus = clientesFiltrados.filter(c => {
              if (!c || (c.id === null || c.id === undefined)) return false;
              const cId = String(c.id).trim().toLowerCase();
              return clienteIdsComStatus.has(cId);
            });
            
            console.log(`🔍 [FILTRO] ${colaboradorIds.length} colaborador(es) têm ${clientesAntes} clientes únicos no total`);
            console.log(`🔍 [FILTRO] Clientes com status "${statusParaUsar}": ${clienteIdsComStatus.size} clientes`);
            console.log(`🔍 [FILTRO] Após filtrar por status "${statusParaUsar}": ${clientesComStatus.length} clientes`);
            console.log(`✅ [FILTRO] Lógica: Clientes com status "${statusParaUsar}" E que pertencem a QUALQUER UM dos ${colaboradorIds.length} colaborador(es)`);
            
            if (clientesComStatus.length > 0) {
            }
            
            clientesFiltrados = clientesComStatus;
          } else {
            console.log(`⚠️ [FILTRO] Nenhum cliente encontrado com status "${statusParaUsar}"`);
            clientesFiltrados = [];
          }
          
          const novosClientes = clientesFiltrados.map(c => ({ id: c.id, nome: c.nome }));
          console.log(`✅ [FILTRO] Resultado final: ${novosClientes.length} clientes após aplicar ambos os filtros`);
          if (novosClientes.length > 0) {
          }
          setTodosClientes(novosClientes);
          setLoadingClientes(false); // Finalizar loading
          
          // Verificar se não há clientes após aplicar os filtros combinados
          if (statusParaUsar && novosClientes.length === 0 && colaboradorId) {
            const textoColaboradores = colaboradorIds.length === 1 
              ? 'Colaborador sem clientes do status aplicado'
              : `${colaboradorIds.length} colaboradores sem clientes do status aplicado`;
            console.log(`⚠️ [FILTRO] ${textoColaboradores}`);
            setMensagemFiltroCliente(textoColaboradores);
          } else {
            setMensagemFiltroCliente(null);
          }
        } else {
          setTodosClientes([]);
          setLoadingClientes(false); // Finalizar loading
          if (statusParaUsar && colaboradorId) {
            const textoColaboradores = colaboradorIds.length === 1 
              ? 'Colaborador sem clientes do status aplicado'
              : `${colaboradorIds.length} colaboradores sem clientes do status aplicado`;
            setMensagemFiltroCliente(textoColaboradores);
          } else {
            setMensagemFiltroCliente(null);
          }
          }
        } catch (err) {
          // Ignorar erros de cancelamento
          if (err.name === 'AbortError') {
            console.log('⚠️ [FILTRO] Requisição cancelada');
            setLoadingClientes(false); // Finalizar loading mesmo em caso de cancelamento
            return;
          }
          console.error('❌ Erro ao aplicar filtro de status:', err);
          // Em caso de erro, limpar a lista
          setTodosClientes([]);
          setMensagemFiltroCliente(null);
          setLoadingClientes(false); // Finalizar loading
        }
      } else {
        // Sem status, apenas buscar por colaborador (código original otimizado)
        const response = await fetch(url, {
          credentials: 'include',
          signal: signal,
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        
        console.log(`🔍 [FILTRO] Clientes encontrados dos colaboradores: ${result.data?.length || 0} clientes`);
        
        if (result.success && result.data) {
          // Remover duplicatas de clientes (caso algum cliente apareça para múltiplos colaboradores)
          const clientesUnicos = new Map();
          result.data.forEach(c => {
            if (c && c.id !== null && c.id !== undefined) {
              const cId = String(c.id).trim().toLowerCase();
              if (!clientesUnicos.has(cId)) {
                clientesUnicos.set(cId, c);
              }
            }
          });
          const clientesFiltrados = Array.from(clientesUnicos.values());
          
          const novosClientes = clientesFiltrados.map(c => ({ id: c.id, nome: c.nome }));
          setTodosClientes(novosClientes);
          setMensagemFiltroCliente(null);
          setLoadingClientes(false); // Finalizar loading
        } else {
          setTodosClientes([]);
          setMensagemFiltroCliente(null);
          setLoadingClientes(false); // Finalizar loading
        }
      }
    } catch (error) {
      // Ignorar erros de cancelamento (AbortError)
      if (error.name === 'AbortError') {
        console.log('⚠️ [FILTRO] Requisição cancelada');
        setLoadingClientes(false); // Finalizar loading mesmo em caso de cancelamento
        return;
      }
      console.error('❌ Erro ao carregar clientes por colaborador:', error);
      // Em caso de erro, recarregar todos os clientes (respeitando status)
      await carregarClientes(statusParaUsar);
      setMensagemFiltroCliente(null);
      setLoadingClientes(false); // Finalizar loading
    }
  }, [filtroStatus, filtroDataInicio, filtroDataFim, carregarClientes]);

  // Função central para carregar clientes considerando TODOS os filtros ativos (incremental)
  const carregarClientesComFiltros = useCallback(async (statusAtual = null, colaboradorAtual = null) => {
    // Cancelar requisição anterior se existir (evitar race conditions)
    if (requestControllerRef.current) {
      requestControllerRef.current.abort();
    }
    
    // Criar novo controller para esta requisição
    const controller = new AbortController();
    requestControllerRef.current = controller;

    // Usar valores passados ou os estados atuais
    const status = statusAtual !== null ? statusAtual : filtroStatus;
    const colaborador = colaboradorAtual !== null ? colaboradorAtual : filtroColaborador;

    // Limpar lista imediatamente para evitar mostrar dados antigos
    setTodosClientes([]);
    setMensagemFiltroCliente(null);
    // O loading será iniciado dentro de carregarClientes ou carregarClientesPorColaborador

    try {
      // Se não há colaborador selecionado, usar a função simples
      if (!colaborador) {
        await carregarClientes(status);
        return;
      }

      // Se há colaborador, buscar clientes do colaborador e aplicar filtro de status se houver
      // IMPORTANTE: sempre passar o status para garantir que ambos os filtros sejam aplicados
      await carregarClientesPorColaborador(colaborador, status);
    } catch (error) {
      // Ignorar erros de cancelamento (AbortError)
      if (error.name !== 'AbortError') {
        console.error('❌ Erro ao carregar clientes com filtros:', error);
        setLoadingClientes(false); // Garantir que o loading seja finalizado em caso de erro
      }
    } finally {
      // Limpar controller se esta ainda for a requisição atual
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }, [filtroStatus, filtroColaborador, carregarClientes, carregarClientesPorColaborador]);

  // Carregar clientes paginados
  const carregarClientesPaginados = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/dashboard-clientes?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (filtroStatus && (typeof filtroStatus === 'string' ? filtroStatus.trim() !== '' : true)) {
        url += `&status=${encodeURIComponent(filtroStatus)}`;
      }
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
          // Enviar múltiplos colaboradores como parâmetros repetidos ou como array JSON
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
        credentials: 'include', // Importante para enviar cookies de sessão
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
        throw new Error(result.error || 'Erro ao buscar clientes');
      }
      
      const clientesComResumos = result.data || [];
      
      // Usar os totais gerais retornados pelo backend (de TODAS as páginas)
      if (result.totaisGerais) {
        const { todosRegistros, todosContratos } = result.totaisGerais;
        
        // Aplicar filtros adicionais nos registros para garantir que estamos contando apenas os corretos
        let registrosFiltrados = todosRegistros || [];
        
        // Se há filtro de colaborador(es), garantir que apenas registros desses colaboradores sejam contados
        if (filtroColaborador) {
          const colaboradorIds = Array.isArray(filtroColaborador) 
            ? filtroColaborador.map(id => String(id).trim())
            : (typeof filtroColaborador === 'string' && filtroColaborador.trim() !== '' ? [String(filtroColaborador).trim()] : []);
          
          if (colaboradorIds.length > 0) {
            registrosFiltrados = registrosFiltrados.filter(reg => {
              const regUsuarioId = reg.usuario_id ? String(reg.usuario_id).trim() : '';
              return colaboradorIds.includes(regUsuarioId);
            });
          }
        }
        
        // Se há filtro de cliente(s), garantir que apenas registros desses clientes sejam contados (dupla verificação)
        if (filtroCliente) {
          const clienteIds = Array.isArray(filtroCliente) 
            ? filtroCliente.map(id => String(id).trim())
            : (typeof filtroCliente === 'string' && filtroCliente.trim() !== '' ? [String(filtroCliente).trim()] : []);
          
          if (clienteIds.length > 0) {
            registrosFiltrados = registrosFiltrados.filter(reg => {
              if (!reg.cliente_id) return false;
              // IMPORTANTE: cliente_id pode conter múltiplos IDs separados por ", "
              // Verificar se algum dos clienteIds está entre os IDs do registro
              const regClienteIds = String(reg.cliente_id)
                .split(',')
                .map(id => id.trim())
                .filter(id => id.length > 0);
              // Verificar se algum dos IDs do filtro está presente nos IDs do registro
              return clienteIds.some(clienteId => regClienteIds.includes(clienteId));
            });
          }
        }
        
        // Se há filtro de período, garantir que apenas registros nesse período sejam contados
        if (filtroDataInicio && filtroDataFim) {
          const inicio = new Date(filtroDataInicio);
          const fim = new Date(filtroDataFim);
          fim.setUTCHours(23, 59, 59, 999);
          
          registrosFiltrados = registrosFiltrados.filter(reg => {
            if (!reg.data_inicio) return false;
            const regData = new Date(reg.data_inicio);
            return regData >= inicio && regData <= fim;
          });
        }
        
        setAllRegistrosTempo(registrosFiltrados);
        setAllContratos(todosContratos || []);
      } else {
        // Fallback: se o backend não retornar totais gerais, usar os dados da página atual
        // Coletar todos os registros e contratos para cálculos gerais
        const registrosMap = new Map();
        const contratosMap = new Map();
        
        clientesComResumos.forEach(item => {
          if (item.registros && Array.isArray(item.registros)) {
            item.registros.forEach(registro => {
              const registroId = registro.id || `${registro.tarefa_id}_${registro.usuario_id}_${registro.data_inicio}_${registro.data_fim || ''}`;
              if (!registrosMap.has(registroId)) {
                registrosMap.set(registroId, registro);
              }
            });
          }
          
          if (item.contratos && Array.isArray(item.contratos)) {
            item.contratos.forEach(contrato => {
              const contratoId = contrato.id || `${contrato.id_cliente}_${contrato.status}`;
              if (!contratosMap.has(contratoId)) {
                contratosMap.set(contratoId, contrato);
              }
            });
          }
        });
        
        setAllRegistrosTempo(Array.from(registrosMap.values()));
        setAllContratos(Array.from(contratosMap.values()));
      }
      
      // Armazenar dados no cache para os cards laterais
      clientesComResumos.forEach(item => {
        clienteDataCacheRef.current[item.cliente.id] = {
          contratos: item.contratos || [],
          registros: item.registros || [],
          tempoPorColaborador: item.resumo.tempoPorColaborador,
          tarefasUnicas: item.resumo.totalTarefasUnicas,
          produtosUnicos: item.resumo.totalProdutosUnicos
        };
      });
      
      setClientes(clientesComResumos);
      setTotalClients(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error('Erro ao carregar clientes paginados:', error);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filtroStatus, filtroCliente, filtroColaborador, filtroDataInicio, filtroDataFim]);

  // Aplicar filtros
  const aplicarFiltros = useCallback(() => {
    // Validar dependências
    const valores = {
      status: filtroStatus,
      cliente: filtroCliente,
      periodo: { inicio: filtroDataInicio, fim: filtroDataFim },
      colaborador: filtroColaborador
    };

    // Validar período
    if (filtroDataInicio && filtroDataFim) {
      if (new Date(filtroDataInicio) > new Date(filtroDataFim)) {
        alert('A data de início deve ser anterior ou igual à data de fim');
        return;
      }
    }

    // Validar dependências - NOTA: Removendo validação obrigatória de período para Cliente e Colaborador
    // pois os handlers já permitem seleção sem período, e o backend pode processar sem período
    // A validação será feita apenas se o usuário tentar aplicar filtros sem dados suficientes
    
    // Verificar se tem pelo menos um filtro
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
    carregarClientesPaginados();
  }, [filtroStatus, filtroCliente, filtroDataInicio, filtroDataFim, filtroColaborador, carregarClientesPaginados]);

  // Limpar filtros
  const limparFiltros = useCallback(async () => {
    // Limpar todos os filtros
    setFiltroStatus(null);
    setFiltroCliente(null);
    setFiltroColaborador(null);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setMensagemFiltroCliente(null);
    
    // Limpar cache para garantir dados atualizados
    try {
      sessionStorage.removeItem('clientes_all');
      sessionStorage.removeItem('status_all');
      sessionStorage.removeItem('colaboradores_all');
    } catch (e) {
      // Ignore cache errors
    }
    
    // Recarregar todos os dados sem filtros
    await carregarStatus();
    await carregarClientes();
    await carregarColaboradores();
    
    // Limpar resultados
    setClientes([]);
    setAllContratos([]);
    setAllRegistrosTempo([]);
    setCurrentPage(1);
    setFiltrosAplicados(false);
  }, [carregarStatus, carregarClientes, carregarColaboradores]);

  // Handlers dos filtros
  const handleStatusChange = useCallback(async (e) => {
    const value = e.target.value || null;
    
    // Atualizar estado primeiro
    setFiltroStatus(value);
    
    // Sempre usar a função central que considera TODOS os filtros ativos
    // Passar o novo valor diretamente para evitar problemas de timing
    // Usar o valor atual de filtroColaborador do estado (será atualizado no próximo render)
    await carregarClientesComFiltros(value, filtroColaborador);
  }, [filtroColaborador, carregarClientesComFiltros]);

  const handleClienteChange = useCallback(async (e) => {
    const value = e.target.value || null;
    setFiltroCliente(value);
    if (value) {
      // Se for array, usar o primeiro cliente para carregar status
      // Mas passar todos os clientes para carregar colaboradores
      const clienteId = Array.isArray(value) ? value[0] : value;
      await carregarStatus(clienteId);
      // Só recarregar colaboradores se NÃO houver colaborador selecionado
      // Isso evita que a seleção do colaborador seja perdida quando um cliente é selecionado
      if (!filtroColaborador) {
        // Passar todos os clientes selecionados e o período (se houver) para buscar colaboradores
        await carregarColaboradoresPorCliente(value, filtroDataInicio, filtroDataFim);
      }
    } else {
      await carregarStatus();
      // Só recarregar colaboradores se NÃO houver colaborador selecionado
      if (!filtroColaborador) {
        await carregarColaboradores();
      }
    }
  }, [filtroColaborador, carregarStatus, carregarColaboradoresPorCliente, carregarColaboradores, filtroDataInicio, filtroDataFim]);

  // Recarregar colaboradores quando o período mudar e houver cliente selecionado
  // IMPORTANTE: Só recarregar se NÃO houver colaborador selecionado (para preservar a seleção)
  useEffect(() => {
    // Não recarregar colaboradores se já houver um colaborador selecionado
    if (filtroColaborador) {
      return; // Preservar a seleção do colaborador
    }

    if (filtroCliente && (filtroDataInicio || filtroDataFim)) {
      // Se ambos os períodos estiverem preenchidos, recarregar colaboradores
      if (filtroDataInicio && filtroDataFim) {
        carregarColaboradoresPorCliente(filtroCliente, filtroDataInicio, filtroDataFim);
      }
    } else if (filtroCliente && !filtroDataInicio && !filtroDataFim) {
      // Se cliente está selecionado mas período foi removido, recarregar sem período
      carregarColaboradoresPorCliente(filtroCliente);
    }
  }, [filtroDataInicio, filtroDataFim, filtroCliente, filtroColaborador, carregarColaboradoresPorCliente]);

  const handleColaboradorChange = useCallback(async (e) => {
    // value pode ser null, um array, ou um único valor (para compatibilidade)
    const value = e.target.value || null;
    
    // Normalizar IDs para garantir consistência
    const normalizeId = (id) => String(id).trim();
    const colaboradorIds = Array.isArray(value) 
      ? value.map(normalizeId).filter(Boolean)
      : (value ? [normalizeId(value)] : null);
    
    const novosColaboradorIds = colaboradorIds && colaboradorIds.length > 0 ? colaboradorIds : null;
    
    // Atualizar estado primeiro
    setFiltroColaborador(novosColaboradorIds);
    
    // Sempre usar a função central que considera TODOS os filtros ativos
    // Passar o novo valor diretamente para evitar problemas de timing
    // Usar o valor atual de filtroStatus do estado (será atualizado no próximo render)
    await carregarClientesComFiltros(filtroStatus, novosColaboradorIds);
  }, [filtroStatus, carregarClientesComFiltros]);

  // Abrir card lateral
  const handleOpenDetail = useCallback((clienteId, tipo, event) => {
    const dados = clienteDataCacheRef.current[clienteId];
    if (!dados) return;

    // Calcular posição ao lado do botão clicado (igual ao servidor original)
    let left = '50%';
    let top = '50%';
    
    if (event && event.target) {
      const triggerElement = event.target;
      const arrowRect = triggerElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Posição no documento (considerando scroll)
      const documentLeft = arrowRect.left + scrollLeft;
      const documentTop = arrowRect.top + scrollTop;
      
      // Tamanho estimado do card (será ajustado depois)
      const cardWidth = 500;
      const cardHeight = 400;
      
      // Tentar posicionar à direita do botão
      let calculatedLeft = documentLeft + arrowRect.width + 10;
      let calculatedTop = documentTop;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Se não cabe à direita, posicionar à esquerda
      if ((calculatedLeft - scrollLeft) + cardWidth > vw) {
        calculatedLeft = documentLeft - cardWidth - 10;
      }
      
      // Garantir que não saia da tela à esquerda
      if ((calculatedLeft - scrollLeft) < 10) {
        calculatedLeft = scrollLeft + 10;
      }
      
      // Ajustar verticalmente se necessário
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
    setDetailCard({ clienteId, tipo, dados });
  }, []);

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

    // Primeiro, coletar todas as tarefas e identificar quais precisam buscar o nome
    allRegistrosTempo.forEach(registro => {
      if (registro.tarefa_id) {
        const tarefaId = String(registro.tarefa_id).trim();
        if (!tarefasMap.has(tarefaId)) {
          // Tentar buscar nome da tarefa do objeto tarefa, se existir
          const nomeTarefa = registro.tarefa?.tarefa_nome || 
                            registro.tarefa?.nome ||
                            registro.tarefa?.titulo || 
                            registro.tarefa?.descricao;
          
          if (nomeTarefa) {
            // Nome encontrado, usar diretamente
            tarefasMap.set(tarefaId, nomeTarefa);
          } else {
            // Nome não encontrado, marcar para buscar na API
            tarefasIdsParaBuscar.push(tarefaId);
          }
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
            // Atualizar o mapa com os nomes encontrados
            Object.entries(result.data).forEach(([id, nome]) => {
              if (nome) {
                tarefasMap.set(id, nome);
              } else {
                // Se não encontrou o nome, usar o ID como fallback
                tarefasMap.set(id, `Tarefa #${id}`);
              }
            });
          }
        } else {
          // Se a resposta não foi OK, tentar ler o erro
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          console.error(`Erro ao buscar tarefas: ${response.status} - ${errorText}`);
        }
        
        // Para IDs que não foram retornados pela API ou não tiveram nome, usar fallback
        tarefasIdsParaBuscar.forEach(id => {
          if (!tarefasMap.has(id)) {
            tarefasMap.set(id, `Tarefa #${id}`);
          }
        });
      } catch (error) {
        console.error('Erro ao buscar nomes das tarefas:', error);
        // Em caso de erro, usar fallback com ID
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

  const handleShowColaboradores = useCallback(async (e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }

    const colaboradoresMap = new Map();
    
    // Criar um mapa de colaboradores para busca mais eficiente
    const colaboradoresMapById = new Map();
    if (todosColaboradores && todosColaboradores.length > 0) {
      todosColaboradores.forEach(colab => {
        const idStr = String(colab.id).trim();
        const idNum = parseInt(idStr, 10);
        // Armazenar por string e número para garantir que encontre
        if (!colaboradoresMapById.has(idStr)) {
          colaboradoresMapById.set(idStr, colab);
        }
        if (!isNaN(idNum) && !colaboradoresMapById.has(idNum)) {
          colaboradoresMapById.set(idNum, colab);
        }
      });
    }
    
    // Coletar IDs de colaboradores que precisam de nome
    const idsSemNome = [];
    
    allRegistrosTempo.forEach(registro => {
      if (registro.usuario_id) {
        const colaboradorId = String(registro.usuario_id).trim();
        const colaboradorIdNum = parseInt(colaboradorId, 10);
        
        if (!colaboradoresMap.has(colaboradorId)) {
          let nomeColaborador = null;
          
          // 1. Tentar buscar nome do colaborador do objeto membro (vem do backend)
          if (registro.membro && registro.membro.nome) {
            nomeColaborador = registro.membro.nome;
          }
          
          // 2. Se não encontrou, buscar na lista de todosColaboradores
          if (!nomeColaborador && colaboradoresMapById.size > 0) {
            const colaboradorEncontrado = colaboradoresMapById.get(colaboradorId) || 
                                         colaboradoresMapById.get(colaboradorIdNum) ||
                                         colaboradoresMapById.get(registro.usuario_id);
            nomeColaborador = colaboradorEncontrado?.nome;
          }
          
          // 3. Se ainda não encontrou, tentar busca mais flexível na lista
          if (!nomeColaborador && todosColaboradores && todosColaboradores.length > 0) {
            const colaboradorEncontrado = todosColaboradores.find(c => {
              const cIdStr = String(c.id).trim();
              const cIdNum = parseInt(cIdStr, 10);
              return cIdStr === colaboradorId || 
                     cIdNum === colaboradorIdNum ||
                     cIdStr === String(registro.usuario_id).trim() ||
                     cIdNum === registro.usuario_id;
            });
            nomeColaborador = colaboradorEncontrado?.nome;
          }
          
          // Se não encontrou nome, adicionar à lista para buscar no backend
          if (!nomeColaborador) {
            idsSemNome.push(colaboradorId);
            colaboradoresMap.set(colaboradorId, null); // Placeholder
          } else {
            colaboradoresMap.set(colaboradorId, nomeColaborador);
          }
        }
      }
    });

    // Se houver IDs sem nome, buscar no backend
    if (idsSemNome.length > 0) {
      try {
        // Buscar membros faltantes do backend
        const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && Array.isArray(result.data)) {
            // Criar mapa dos membros retornados
            const membrosBackendMap = new Map();
            result.data.forEach(m => {
              const idStr = String(m.id).trim();
              const idNum = parseInt(idStr, 10);
              membrosBackendMap.set(idStr, m);
              if (!isNaN(idNum)) {
                membrosBackendMap.set(idNum, m);
              }
            });
            
            // Atualizar nomes dos colaboradores que não foram encontrados
            idsSemNome.forEach(id => {
              const idStr = String(id).trim();
              const idNum = parseInt(idStr, 10);
              const membro = membrosBackendMap.get(idStr) || membrosBackendMap.get(idNum);
              if (membro && membro.nome) {
                colaboradoresMap.set(idStr, membro.nome);
              } else {
                colaboradoresMap.set(idStr, `Colaborador #${idStr}`);
              }
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar membros faltantes:', error);
        // Se der erro, usar fallback
        idsSemNome.forEach(id => {
          colaboradoresMap.set(String(id).trim(), `Colaborador #${id}`);
        });
      }
    }

    // Aplicar fallback para qualquer colaborador que ainda não tenha nome
    colaboradoresMap.forEach((nome, id) => {
      if (!nome) {
        colaboradoresMap.set(id, `Colaborador #${id}`);
      }
    });

    const itens = Array.from(colaboradoresMap.values()).sort();
    
    if (itens.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }
    
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Colaboradores', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosColaboradores]);

  const handleShowClientes = useCallback((e) => {
    // Usar os clientes que estão sendo exibidos nos cards (já filtrados)
    // Isso garante que a listagem corresponda à contagem no dashboard
    if (!clientes || clientes.length === 0) {
      alert('Nenhum cliente encontrado');
      return;
    }

    // Extrair nomes dos clientes dos cards exibidos
    const itens = clientes.map(item => item.cliente.nome || `Cliente #${item.cliente.id}`);

    if (itens.length === 0) {
      alert('Nenhum cliente encontrado');
      return;
    }

    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Clientes', itens });
    setMiniCardPosition(position);
  }, [clientes]);

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

    // Tamanho estimado do card
    const cardWidth = 400;
    const cardHeight = 300;

    let left = documentLeft + arrowRect.width + 10;
    let top = documentTop;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Se não cabe à direita, posicionar à esquerda
    if ((left - scrollLeft) + cardWidth > vw) {
      left = documentLeft - cardWidth - 10;
    }

    // Garantir que não saia da tela à esquerda
    if ((left - scrollLeft) < 10) {
      left = scrollLeft + 10;
    }

    // Ajustar verticalmente se necessário
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

  // Carregar tarefas incompletas
  const carregarTarefasIncompletas = useCallback(async () => {
    setLoadingIncompletas(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tarefas-incompletas`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Aceitar tanto result.data quanto result.items (compatibilidade)
      const tarefas = result.data || result.items || [];
      
      setTarefasIncompletas(tarefas);
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas incompletas:', error);
      setTarefasIncompletas([]);
    } finally {
      setLoadingIncompletas(false);
    }
  }, []);

  // Toggle mostrar tarefas incompletas
  const handleToggleIncompletas = useCallback(async () => {
    if (!mostrarIncompletas) {
      await carregarTarefasIncompletas();
    }
    setMostrarIncompletas(!mostrarIncompletas);
  }, [mostrarIncompletas, carregarTarefasIncompletas]);

  // Formatar data para exibição
  const formatarData = useCallback((data, isMissing = false) => {
    if (!data || isMissing) {
      return <span className="missing-date">X</span>;
    }
    try {
      const d = new Date(data);
      if (isNaN(d.getTime())) {
        return <span className="missing-date">X</span>;
      }
      const dia = d.getDate().toString().padStart(2, '0');
      const mes = (d.getMonth() + 1).toString().padStart(2, '0');
      const ano = d.getFullYear();
      return <span className="present-date">{`${dia}/${mes}/${ano}`}</span>;
    } catch {
      return <span className="missing-date">X</span>;
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    // Limpar cache de clientes para garantir dados atualizados
    try {
      sessionStorage.removeItem('clientes_all');
    } catch (e) {
      // Ignore cache errors
    }
    carregarStatus();
    carregarClientes();
    carregarColaboradores();
  }, [carregarStatus, carregarClientes, carregarColaboradores]);

  // Recarregar dados quando a página ou itens por página mudarem (apenas se filtros já foram aplicados)
  useEffect(() => {
    if (filtrosAplicados) {
      carregarClientesPaginados();
    }
  }, [currentPage, itemsPerPage, filtrosAplicados, carregarClientesPaginados]);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
        <div className="form-header">
          <h2 className="form-title">{mostrarIncompletas ? 'Tarefas Desajustadas' : 'Clientes'}</h2>
          <div className="form-header-actions">
            <button 
              className={`incomplete-clients-btn ${mostrarIncompletas ? 'active' : ''}`}
              onClick={handleToggleIncompletas}
            >
              <i className="fas fa-exclamation-triangle"></i>
              Tarefas Desajustadas
              {tarefasIncompletas.length > 0 && (
                <span className="incomplete-badge">{tarefasIncompletas.length}</span>
              )}
            </button>
            <button 
              className={`add-client-btn ${!mostrarIncompletas ? 'active' : ''}`}
              onClick={() => {
                if (mostrarIncompletas) {
                  setMostrarIncompletas(false);
                } else {
                  window.location.href = '/carteira-clientes';
                }
              }}
            >
              <i className="fas fa-gear"></i>
              Clientes
            </button>
          </div>
        </div>

        {/* Seção de Filtros Expostos - Oculto quando mostrarIncompletas */}
        {!mostrarIncompletas && (
          <>
            <div className="exposed-filters-section">
              <div className="filters-row">
                <div className="filter-group">
                  <FilterStatus
                    value={filtroStatus}
                    onChange={handleStatusChange}
                    options={todosStatus}
                    disabled={false}
                  />
                </div>
                
                <div className="filter-group">
                  <FilterClientes
                    value={filtroCliente}
                    onChange={handleClienteChange}
                    options={todosClientes}
                    disabled={false}
                    emptyMessage={mensagemFiltroCliente}
                    loading={loadingClientes}
                  />
                </div>

                <div className="filter-group">
                  <FilterColaborador
                    value={filtroColaborador}
                    onChange={handleColaboradorChange}
                    options={todosColaboradores}
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
              </div>
              
              {/* Botões de Ação dos Filtros */}
              <div className="filter-actions">
                <button 
                  id="btnAplicarFiltros" 
                  className="apply-filters-btn" 
                  onClick={aplicarFiltros}
                  disabled={loading}
                >
                  Aplicar Filtros
                </button>
                <button 
                  id="btnLimparFiltros" 
                  className="clear-filters-btn" 
                  onClick={limparFiltros}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>

            {/* Cards de Dashboard */}
            {(allContratos.length > 0 || allRegistrosTempo.length > 0) && (
              <DashboardCards
                contratos={allContratos}
                registrosTempo={allRegistrosTempo}
                onShowTarefas={handleShowTarefas}
                onShowColaboradores={handleShowColaboradores}
                onShowClientes={handleShowClientes}
                clientesFiltrados={clientes.map(item => item.cliente)}
                totalClientes={totalClients}
              />
            )}
          </>
        )}

        {/* Tabela de Tarefas Incompletas */}
        {mostrarIncompletas && (
          <div className="incomplete-tasks-container" style={{ marginTop: '30px' }}>
            <div className="incomplete-tasks-card">
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px', fontWeight: 400 }}>
                Listando tarefas com campos faltando.
              </p>
              {loadingIncompletas ? (
                <div className="loading">
                  <i className="fas fa-spinner"></i>
                  <p>Carregando tarefas incompletas...</p>
                </div>
              ) : tarefasIncompletas.length > 0 ? (
                <table className="incomplete-tasks-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Data Início</th>
                      <th>Data Vencimento</th>
                      <th>Cliente</th>
                      <th>Abrir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarefasIncompletas.map((tarefa) => (
                      <tr key={tarefa.id}>
                        <td className="task-id-cell">{tarefa.id}</td>
                        <td>{formatarData(tarefa.dt_inicio, !tarefa.dt_inicio)}</td>
                        <td>{formatarData(tarefa.dt_vencimento, !tarefa.dt_vencimento)}</td>
                        <td>
                          {tarefa.clientes && tarefa.clientes.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {tarefa.clientes.map((cliente, idx) => (
                                <span
                                  key={idx}
                                  className="client-badge"
                                >
                                  {cliente.nome}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>Sem cliente</span>
                          )}
                        </td>
                        <td>
                          {tarefa.url ? (
                            <a
                              href={tarefa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="open-task-btn"
                              title="Abrir em nova aba"
                            >
                              <i className="fas fa-external-link-alt"></i>
                            </a>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  minHeight: '240px', 
                  color: '#555', 
                  fontSize: '16px', 
                  fontWeight: 500, 
                  textAlign: 'center' 
                }}>
                  Nenhuma tarefa incompleta encontrada
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resultados */}
        {!mostrarIncompletas && (
          <div className="results-container" style={{ marginTop: '30px' }}>
            <div id="resultsContent">
              {loading ? (
                <div className="loading">
                  <i className="fas fa-spinner"></i>
                  <p>Carregando resultados...</p>
                </div>
              ) : clientes.length > 0 ? (
                <div className="clientes-grid">
                  {clientes.map((item) => (
                    <ClientCard
                      key={item.cliente.id}
                      cliente={item.cliente}
                      resumo={item.resumo}
                      contratos={item.contratos || []}
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
          {!mostrarIncompletas && totalClients > 0 && (
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
                  Mostrando {totalClients === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} a{' '}
                  {Math.min(currentPage * itemsPerPage, totalClients)} de {totalClients} clientes
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
        )}

      </main>
      
      {/* Card Lateral de Detalhes - Renderizado usando portal para posicionamento correto */}
      {detailCard && (
        <DetailSideCard
          clienteId={detailCard.clienteId}
          tipo={detailCard.tipo}
          dados={detailCard.dados}
          onClose={handleCloseDetail}
          position={detailCardPosition}
        />
      )}

      {/* Mini Card de Lista (Tarefas, Colaboradores, Clientes) */}
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

export default DashboardClientes;

