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

  // Debug: log quando todosClientes mudar
  useEffect(() => {
    console.log('📊 Estado todosClientes atualizado:', todosClientes.length, 'clientes');
    if (todosClientes.length > 0) {
      console.log('📋 Primeiros 5 clientes:', todosClientes.slice(0, 5));
    }
  }, [todosClientes]);

  // Limpar seleção de cliente se ele não estiver mais na lista de clientes disponíveis
  useEffect(() => {
    if (filtroCliente && todosClientes.length > 0) {
      const clienteIdStr = String(filtroCliente).trim();
      const clienteExiste = todosClientes.some(c => String(c.id).trim() === clienteIdStr);
      if (!clienteExiste) {
        console.log('⚠️ Cliente selecionado não está mais na lista. Limpando seleção de cliente.');
        setFiltroCliente(null);
      }
    }
  }, [todosClientes, filtroCliente]);

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
        console.log('📦 Clientes do cache:', cached.length);
        setTodosClientes(cached);
        return;
      }

      let url = `${API_BASE_URL}/clientes`;
      if (status) {
        url += `?status=${encodeURIComponent(status)}`;
      }

      console.log('📡 Buscando clientes:', url);
      console.log('🌐 URL completa:', window.location.origin + url);
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
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
      console.log('📥 Resultado da API clientes:', result);
      if (result.success && result.data && Array.isArray(result.data)) {
        console.log('✅ Clientes carregados:', result.data.length);
        setTodosClientes(result.data);
        cache.set(cacheKey, result.data);
      } else {
        console.warn('⚠️ Formato de resposta inesperado:', result);
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

      console.log('📡 Buscando colaboradores:', `${API_BASE_URL}/membros-id-nome`);
      console.log('🌐 URL completa:', window.location.origin + `${API_BASE_URL}/membros-id-nome`);
      
      const response = await fetch(`${API_BASE_URL}/membros-id-nome`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
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

  // Carregar colaboradores por cliente
  const carregarColaboradoresPorCliente = useCallback(async (clienteId) => {
    try {
      if (!clienteId) {
        await carregarColaboradores();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/membros-por-cliente?clienteId=${clienteId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosColaboradores(result.data.map(m => ({ id: m.id, nome: m.nome })));
      } else {
        setTodosColaboradores([]);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores por cliente:', error);
      setTodosColaboradores([]);
    }
  }, [carregarColaboradores]);

  // Carregar clientes por colaborador(es) - aceita array ou valor único
  const carregarClientesPorColaborador = useCallback(async (colaboradorId) => {
    try {
      if (!colaboradorId) {
        await carregarClientes(filtroStatus);
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
      
      console.log('📡 [CARREGAR-CLIENTES-POR-COLABORADOR] URL:', url);

      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ [CARREGAR-CLIENTES-POR-COLABORADOR] Clientes encontrados: ${result.data.length}`);
        console.log(`📋 [CARREGAR-CLIENTES-POR-COLABORADOR] Primeiros clientes:`, result.data.slice(0, 5).map(c => ({ id: c.id, nome: c.nome })));
        
        // Se houver filtro de status, aplicar aqui também
        let clientesFiltrados = result.data;
        if (filtroStatus) {
          // Buscar clientes que têm contratos com esse status
          try {
            const responseStatus = await fetch(`${API_BASE_URL}/clientes?status=${encodeURIComponent(filtroStatus)}`, {
              credentials: 'include',
            });
            if (responseStatus.ok) {
              const resultStatus = await responseStatus.json();
              if (resultStatus.success && resultStatus.data) {
                const clienteIdsComStatus = new Set(resultStatus.data.map(c => String(c.id).trim().toLowerCase()));
                clientesFiltrados = clientesFiltrados.filter(c => {
                  const cId = String(c.id).trim().toLowerCase();
                  return clienteIdsComStatus.has(cId);
                });
              }
            }
          } catch (err) {
            console.error('❌ Erro ao aplicar filtro de status:', err);
          }
        }
        
        const novosClientes = clientesFiltrados.map(c => ({ id: c.id, nome: c.nome }));
        console.log(`📊 [CARREGAR-CLIENTES-POR-COLABORADOR] Atualizando todosClientes com ${novosClientes.length} clientes`);
        setTodosClientes(novosClientes);
      } else {
        setTodosClientes([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes por colaborador:', error);
      // Em caso de erro, recarregar todos os clientes (respeitando status)
      await carregarClientes(filtroStatus);
    }
  }, [filtroStatus, filtroDataInicio, filtroDataFim, carregarClientes]);

  // Carregar clientes paginados
  const carregarClientesPaginados = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/dashboard-clientes?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (filtroStatus && (typeof filtroStatus === 'string' ? filtroStatus.trim() !== '' : true)) {
        url += `&status=${encodeURIComponent(filtroStatus)}`;
      }
      if (filtroCliente && (typeof filtroCliente === 'string' ? filtroCliente.trim() !== '' : true)) {
        url += `&clienteId=${encodeURIComponent(filtroCliente)}`;
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
      
      console.log('📡 Buscando clientes paginados:', url);
      console.log('🔍 URL completa:', window.location.origin + url);
      
      const response = await fetch(url, {
        credentials: 'include', // Importante para enviar cookies de sessão
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📥 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
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
      console.log('✅ Resultado recebido:', result);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar clientes');
      }
      
      const clientesComResumos = result.data || [];
      
      // Coletar todos os registros e contratos para cálculos gerais
      // Usar Map para evitar duplicação por ID de registro
      const registrosMap = new Map();
      const contratosMap = new Map();
      
      clientesComResumos.forEach(item => {
        // Se há filtro de cliente, coletar apenas registros desse cliente
        if (filtroCliente && (typeof filtroCliente === 'string' ? filtroCliente.trim() !== '' : true)) {
          const clienteIdFiltro = String(filtroCliente).trim();
          const clienteIdItem = item.cliente?.id ? String(item.cliente.id).trim() : '';
          
          // Pular se não for o cliente filtrado
          if (clienteIdItem !== clienteIdFiltro) {
            return;
          }
        }
        
        // Coletar registros únicos por ID
        if (item.registros && Array.isArray(item.registros)) {
          item.registros.forEach(registro => {
            // Usar ID do registro como chave para evitar duplicação
            const registroId = registro.id || `${registro.tarefa_id}_${registro.usuario_id}_${registro.data_inicio}_${registro.data_fim || ''}`;
            if (!registrosMap.has(registroId)) {
              registrosMap.set(registroId, registro);
            }
          });
        }
        
        // Coletar contratos únicos por ID
        if (item.contratos && Array.isArray(item.contratos)) {
          item.contratos.forEach(contrato => {
            const contratoId = contrato.id || `${contrato.id_cliente}_${contrato.status}`;
            if (!contratosMap.has(contratoId)) {
              contratosMap.set(contratoId, contrato);
            }
          });
        }
      });
      
      // Converter Map para Array
      let registros = Array.from(registrosMap.values());
      const contratos = Array.from(contratosMap.values());
      
      // Aplicar filtros adicionais nos registros para garantir que estamos contando apenas os corretos
      let registrosFiltrados = registros;
      
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
      
      // Se há filtro de cliente, garantir que apenas registros desse cliente sejam contados (dupla verificação)
      if (filtroCliente && (typeof filtroCliente === 'string' ? filtroCliente.trim() !== '' : true)) {
        const clienteId = String(filtroCliente).trim();
        registrosFiltrados = registrosFiltrados.filter(reg => {
          const regClienteId = reg.cliente_id ? String(reg.cliente_id).trim() : '';
          return regClienteId === clienteId;
        });
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
      
      // Debug: log dos registros filtrados
      console.log('📊 Registros filtrados para dashboard:', {
        total: registrosFiltrados.length,
        filtroCliente: filtroCliente || 'nenhum',
        filtroColaborador: filtroColaborador || 'nenhum',
        filtroPeriodo: filtroDataInicio && filtroDataFim ? `${filtroDataInicio} - ${filtroDataFim}` : 'nenhum',
        totalTempo: registrosFiltrados.reduce((sum, r) => sum + (Number(r.tempo_realizado) || 0), 0)
      });
      
      setAllRegistrosTempo(registrosFiltrados);
      setAllContratos(contratos);
      
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
    // Debug: mostrar valores dos filtros
    console.log('🔍 Aplicando filtros:', {
      status: filtroStatus,
      cliente: filtroCliente,
      colaborador: filtroColaborador,
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim
    });

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

    // Validar dependências
    if (filtroCliente && !filtroDataInicio && !filtroDataFim) {
      alert('O filtro "Cliente" requer que o filtro "Período" esteja selecionado');
      return;
    }

    // Validar se há colaboradores selecionados e se requer período
    const temColaboradores = Array.isArray(filtroColaborador) 
      ? filtroColaborador.length > 0 
      : (filtroColaborador && filtroColaborador.toString().trim() !== '');
    
    if (temColaboradores && !filtroDataInicio && !filtroDataFim) {
      alert('O filtro "Colaborador" requer que o filtro "Período" esteja selecionado');
      return;
    }

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
    
    // Limpar cache para garantir dados atualizados
    try {
      sessionStorage.removeItem('clientes_all');
      sessionStorage.removeItem('status_all');
      sessionStorage.removeItem('colaboradores_all');
    } catch (e) {
      console.warn('⚠️ Erro ao limpar cache:', e);
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
  }, [carregarStatus, carregarClientes, carregarColaboradores]);

  // Handlers dos filtros
  const handleStatusChange = useCallback(async (e) => {
    const value = e.target.value || null;
    setFiltroStatus(value);
    if (value) {
      await carregarClientes(value);
    } else {
      await carregarClientes();
    }
  }, [carregarClientes]);

  const handleClienteChange = useCallback(async (e) => {
    const value = e.target.value || null;
    setFiltroCliente(value);
    if (value) {
      await carregarStatus(value);
      await carregarColaboradoresPorCliente(value);
    } else {
      await carregarStatus();
      await carregarColaboradores();
    }
  }, [carregarStatus, carregarColaboradoresPorCliente, carregarColaboradores]);

  const handleColaboradorChange = useCallback(async (e) => {
    // value pode ser null, um array, ou um único valor (para compatibilidade)
    const value = e.target.value || null;
    
    // Normalizar IDs para garantir consistência
    const normalizeId = (id) => String(id).trim();
    const colaboradorIds = Array.isArray(value) 
      ? value.map(normalizeId).filter(Boolean)
      : (value ? [normalizeId(value)] : null);
    
    console.log('🔍 handleColaboradorChange:', {
      valueRecebido: value,
      colaboradorIdsNormalizados: colaboradorIds,
      tipo: typeof value,
      isArray: Array.isArray(value)
    });
    
    setFiltroColaborador(colaboradorIds && colaboradorIds.length > 0 ? colaboradorIds : null);
    
    if (colaboradorIds && colaboradorIds.length > 0) {
      // Se houver colaboradores selecionados, carregar clientes de todos eles
      await carregarClientesPorColaborador(colaboradorIds);
    } else {
      await carregarClientes(filtroStatus);
    }
  }, [filtroStatus, carregarClientes, carregarClientesPorColaborador]);

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
  const handleShowTarefas = useCallback((e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhuma tarefa encontrada');
      return;
    }

    const tarefasMap = new Map();
    allRegistrosTempo.forEach(registro => {
      if (registro.tarefa_id && registro.tarefa) {
        const tarefaId = String(registro.tarefa_id).trim();
        if (!tarefasMap.has(tarefaId)) {
          const nomeTarefa = registro.tarefa.nome || 
                            registro.tarefa.tarefa_nome ||
                            registro.tarefa.titulo || 
                            registro.tarefa.descricao || 
                            `Tarefa #${tarefaId}`;
          tarefasMap.set(tarefaId, nomeTarefa);
        }
      }
    });

    const itens = Array.from(tarefasMap.values());
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Tarefas', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo]);

  const handleShowColaboradores = useCallback((e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }

    const colaboradoresMap = new Map();
    allRegistrosTempo.forEach(registro => {
      if (registro.usuario_id && registro.membro) {
        const colaboradorId = String(registro.usuario_id).trim();
        if (!colaboradoresMap.has(colaboradorId)) {
          colaboradoresMap.set(colaboradorId, registro.membro.nome || `Colaborador #${colaboradorId}`);
        }
      }
    });

    const itens = Array.from(colaboradoresMap.values());
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Colaboradores', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo]);

  const handleShowClientes = useCallback((e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhum cliente encontrado');
      return;
    }

    const clientesMap = new Map();
    allRegistrosTempo.forEach(registro => {
      if (registro.cliente_id) {
        const clienteId = String(registro.cliente_id).trim();
        if (!clientesMap.has(clienteId)) {
          const nomeCliente = registro.cliente?.nome || 
                             (todosClientes && todosClientes.find(c => String(c.id) === clienteId)?.nome) ||
                             `Cliente #${clienteId}`;
          clientesMap.set(clienteId, nomeCliente);
        }
      }
    });

    const itens = Array.from(clientesMap.values());
    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Clientes', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosClientes]);

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
      console.log('📡 Buscando tarefas incompletas:', `${API_BASE_URL}/tarefas-incompletas`);
      const response = await fetch(`${API_BASE_URL}/tarefas-incompletas`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Resultado recebido:', result);
      console.log('📥 result.success:', result.success);
      console.log('📥 result.data:', result.data);
      console.log('📥 result.count:', result.count);
      
      // Aceitar tanto result.data quanto result.items (compatibilidade)
      const tarefas = result.data || result.items || [];
      console.log('📋 Tarefas processadas:', tarefas.length);
      
      if (tarefas.length > 0) {
        console.log('✅ Primeiras 3 tarefas:', tarefas.slice(0, 3));
      }
      
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
    console.log('🚀 Carregando dados iniciais...');
    // Limpar cache de clientes para garantir dados atualizados
    try {
      sessionStorage.removeItem('clientes_all');
      console.log('🗑️ Cache de clientes limpo');
    } catch (e) {
      console.warn('⚠️ Erro ao limpar cache:', e);
    }
    carregarStatus();
    carregarClientes();
    carregarColaboradores();
  }, [carregarStatus, carregarClientes, carregarColaboradores]);

  // Calcular número de colunas do grid
  const numCols = Math.min(4, clientes.length);

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
                <div className="clientes-grid" style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}>
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

