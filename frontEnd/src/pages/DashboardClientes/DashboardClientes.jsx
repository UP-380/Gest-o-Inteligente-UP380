import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterColaborador from '../../components/filters/FilterColaborador';
import FiltersCard from '../../components/filters/FiltersCard';
import DashboardCards from '../../components/dashboard/DashboardCards';
import { ClientCard } from '../../components/clients';
import DetailSideCard from '../../components/clients/DetailSideCard';
import MiniCardLista from '../../components/dashboard/MiniCardLista';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import { clientesAPI, colaboradoresAPI, tarefasAPI, cacheAPI, registroTempoAPI } from '../../services/api';
import './DashboardClientes.css';

const RelatoriosClientes = () => {
  // Estado dos filtros
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState(null);
  const [filtroDataFim, setFiltroDataFim] = useState(null);
  const [filtroColaborador, setFiltroColaborador] = useState(null);
  const [mostrarClientesInativos, setMostrarClientesInativos] = useState(false);
  const [mostrarColaboradoresInativos, setMostrarColaboradoresInativos] = useState(false);
  const [enabledWeekends, setEnabledWeekends] = useState(false);
  const [enabledHolidays, setEnabledHolidays] = useState(false);

  // Estado dos dados
  const [todosClientes, setTodosClientes] = useState([]);
  const [todosColaboradores, setTodosColaboradores] = useState([]);


  // Limpar seleção de cliente se ele não estiver mais na lista de clientes disponíveis
  useEffect(() => {
    // Se filtroCliente for null, undefined, array vazio ou string vazia, não fazer nada
    if (!filtroCliente || (Array.isArray(filtroCliente) && filtroCliente.length === 0)) {
      return;
    }

    if (todosClientes.length > 0) {
      const clienteIds = Array.isArray(filtroCliente)
        ? filtroCliente.map(id => String(id).trim()).filter(Boolean)
        : [String(filtroCliente).trim()].filter(Boolean);

      // Se após filtrar não há IDs válidos, limpar o filtro
      if (clienteIds.length === 0) {
        setFiltroCliente(null);
        return;
      }

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

  // Estado dos resultados
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCompletos, setDadosCompletos] = useState(false);
  const [allContratos, setAllContratos] = useState([]);
  const [allRegistrosTempo, setAllRegistrosTempo] = useState([]);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  // Estado para rastrear se os filtros foram aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);
  // Estado para armazenar os valores dos filtros que foram aplicados por último (para comparação)
  const [filtrosUltimosAplicados, setFiltrosUltimosAplicados] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);

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
  const requestIdRef = useRef(0);
  const isRequestInProgressRef = useRef(false);

  // Carregar clientes - sempre carrega todas as opções
  const carregarClientes = useCallback(async () => {
    try {
      // Buscar todos os clientes usando getPaginated com limit alto para garantir que todos sejam retornados
      // Usar limit de 10000 para cobrir todos os casos possíveis
      const result = await clientesAPI.getPaginated({
        page: 1,
        limit: 10000,
        status: null,
        search: null,
        incompletos: false
      });

      if (result.success && result.data && Array.isArray(result.data)) {
        // Garantir que todos os clientes tenham status
        const clientesComStatus = result.data.map(cliente => ({
          ...cliente,
          status: cliente.status || 'ativo'
        }));
        setTodosClientes(clientesComStatus);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
    }
  }, []);

  // Carregar colaboradores
  const carregarColaboradores = useCallback(async () => {
    try {
      // Nas telas de relatórios, buscar TODOS os membros (incluindo os sem usuário vinculado)
      const result = await colaboradoresAPI.getAllIncludingWithoutUser();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosColaboradores(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  }, []);

  // Funções removidas: carregarColaboradoresPorCliente e carregarClientesPorColaborador
  // Agora cada filtro sempre mostra todas as opções disponíveis, sem relações entre eles

  // Função helper para verificar se um colaborador está inativo
  const isColaboradorInativo = useCallback((colaboradorId, registro = null) => {
    if (mostrarColaboradoresInativos) return false; // Se inativos estão habilitados, não filtrar

    // 1. Tentar buscar status do registro.membro (vem do backend)
    if (registro && registro.membro && registro.membro.status) {
      return registro.membro.status === 'inativo';
    }

    // 2. Buscar na lista de todosColaboradores
    if (colaboradorId && todosColaboradores && todosColaboradores.length > 0) {
      const colaborador = todosColaboradores.find(c => {
        const cIdStr = String(c.id).trim();
        const cIdNum = parseInt(cIdStr, 10);
        const colaboradorIdStr = String(colaboradorId).trim();
        const colaboradorIdNum = parseInt(colaboradorIdStr, 10);
        return cIdStr === colaboradorIdStr ||
          cIdNum === colaboradorIdNum ||
          cIdStr === colaboradorIdStr ||
          cIdNum === colaboradorIdNum;
      });

      if (colaborador) {
        const status = colaborador.status || 'ativo';
        return status === 'inativo';
      }
    }

    // 3. Se não encontrou, assumir ativo (compatibilidade)
    return false;
  }, [mostrarColaboradoresInativos, todosColaboradores]);

  // Função helper para verificar se um cliente está inativo
  const isClienteInativo = useCallback((clienteId, registro = null) => {
    if (mostrarClientesInativos) return false; // Se inativos estão habilitados, não filtrar

    // 1. Tentar buscar status do registro.cliente (vem do backend)
    if (registro && registro.cliente && registro.cliente.status) {
      return registro.cliente.status === 'inativo';
    }

    // 2. Buscar na lista de todosClientes
    if (clienteId && todosClientes && todosClientes.length > 0) {
      const clienteIdStr = String(clienteId).trim();
      const clienteIdNum = parseInt(clienteIdStr, 10);

      const cliente = todosClientes.find(c => {
        const cIdStr = String(c.id).trim();
        const cIdNum = parseInt(cIdStr, 10);
        return cIdStr === clienteIdStr ||
          cIdNum === clienteIdNum ||
          cIdStr === clienteIdStr ||
          cIdNum === clienteIdNum;
      });

      if (cliente) {
        const status = cliente.status || 'ativo';
        return status === 'inativo';
      }
    }

    // 3. Se não encontrou, assumir ativo (compatibilidade)
    return false;
  }, [mostrarClientesInativos, todosClientes]);

  // Estado para armazenar os filtros que foram aplicados (para usar na paginação)
  const [filtrosAplicadosAtuais, setFiltrosAplicadosAtuais] = useState({});

  // Carregar clientes paginados - recebe os filtros como parâmetros
  const carregarClientesPaginados = useCallback(async (filtrosAplicados = {}) => {
    // Gerar ID único para esta requisição
    const currentRequestId = ++requestIdRef.current;
    isRequestInProgressRef.current = true;

    setLoading(true);
    setDadosCompletos(false);
    try {
      // Só envia filtros que foram preenchidos
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };

      // Adicionar filtros apenas se estiverem preenchidos
      if (filtrosAplicados.clienteId) {
        params.clienteId = filtrosAplicados.clienteId;
      }

      // IMPORTANTE: Só envia colaboradorId se estiver explicitamente preenchido
      // Se não estiver preenchido, não envia o parâmetro para trazer TODOS os colaboradores
      if (filtrosAplicados.colaboradorId) {
        params.colaboradorId = filtrosAplicados.colaboradorId;
      }

      if (filtrosAplicados.dataInicio) {
        params.dataInicio = filtrosAplicados.dataInicio;
      }

      if (filtrosAplicados.dataFim) {
        params.dataFim = filtrosAplicados.dataFim;
      }

      // Adicionar flags de inativos
      params.incluirClientesInativos = mostrarClientesInativos;
      params.incluirColaboradoresInativos = mostrarColaboradoresInativos;

      // Adicionar flags de tempo estimado
      params.considerarFinaisDeSemana = enabledWeekends;
      params.considerarFeriados = enabledHolidays;

      const result = await clientesAPI.getRelatorios(params);

      // Verificar se esta ainda é a requisição mais recente
      if (currentRequestId !== requestIdRef.current) {
        // Uma requisição mais nova foi iniciada, ignorar este resultado
        return;
      }

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar clientes');
      }

      const clientesComResumos = result.data || [];

      // Armazenar mensagem se houver (para casos sem registros)
      // Não usar a mensagem específica do backend, usar mensagem padrão
      if (result.message) {
        setClientes([]);
        setAllRegistrosTempo([]);
        setAllContratos([]);
        setTotalClients(0);
        setEmptyMessage(null); // Usar mensagem padrão do componente
        setDadosCompletos(true);
        setLoading(false);
        return;
      }

      // Se não há clientes retornados, usar mensagem padrão
      if (clientesComResumos.length === 0) {
        setClientes([]);
        setAllRegistrosTempo([]);
        setAllContratos([]);
        setTotalClients(0);
        setEmptyMessage(null); // Usar mensagem padrão do componente
        setDadosCompletos(true);
        setLoading(false);
        return;
      }

      // Se chegou aqui, há clientes, então limpar mensagem
      setEmptyMessage(null);

      // Usar os totais gerais retornados pelo backend (de TODAS as páginas)
      // O backend já aplica todos os filtros corretamente, então não precisamos filtrar novamente aqui
      if (result.totaisGerais) {
        const { todosRegistros, todosContratos } = result.totaisGerais;

        // Apenas filtrar colaboradores e clientes inativos no frontend (se necessário)
        // O backend não filtra inativos porque isso é uma opção do frontend
        let registrosFiltrados = todosRegistros || [];

        if (!mostrarColaboradoresInativos || !mostrarClientesInativos) {
          registrosFiltrados = registrosFiltrados.filter(reg => {
            // Filtrar registros de colaboradores inativos
            if (!mostrarColaboradoresInativos && reg.usuario_id && isColaboradorInativo(reg.usuario_id, reg)) {
              return false;
            }

            // Filtrar registros relacionados a clientes inativos
            if (!mostrarClientesInativos && reg.cliente_id) {
              const clienteIds = String(reg.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
              const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, reg));
              if (temClienteInativo) {
                return false;
              }
            }

            return true;
          });
        }

        // Sempre atualizar, mesmo que vazio (para limpar dados antigos)
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
              // Filtrar registros de colaboradores inativos se mostrarColaboradoresInativos estiver desativado
              if (!mostrarColaboradoresInativos && registro.usuario_id && isColaboradorInativo(registro.usuario_id, registro)) {
                return; // Pular colaboradores inativos
              }

              // Filtrar registros relacionados a clientes inativos se mostrarClientesInativos estiver desativado
              if (!mostrarClientesInativos && registro.cliente_id) {
                const clienteIds = String(registro.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
                const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, registro));
                if (temClienteInativo) {
                  return; // Pular registros de clientes inativos
                }
              }

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

        let registrosArray = Array.from(registrosMap.values());

        // Filtrar registros de colaboradores e clientes inativos se os toggles estiverem desativados
        if (!mostrarColaboradoresInativos || !mostrarClientesInativos) {
          registrosArray = registrosArray.filter(reg => {
            // Filtrar registros de colaboradores inativos
            if (!mostrarColaboradoresInativos && reg.usuario_id && isColaboradorInativo(reg.usuario_id, reg)) {
              return false;
            }

            // Filtrar registros relacionados a clientes inativos
            if (!mostrarClientesInativos && reg.cliente_id) {
              const clienteIds = String(reg.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
              const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, reg));
              if (temClienteInativo) {
                return false;
              }
            }

            return true;
          });
        }

        // Só atualizar se houver dados, senão limpar
        const contratosArray = Array.from(contratosMap.values());

        if (registrosArray.length > 0 || contratosArray.length > 0) {
          setAllRegistrosTempo(registrosArray);
          setAllContratos(contratosArray);
        } else {
          // Se não há registros nem contratos, limpar tudo
          setAllRegistrosTempo([]);
          setAllContratos([]);
        }
      }

      // Armazenar dados no cache para os cards laterais
      clientesComResumos.forEach(item => {
        // Filtrar registros de colaboradores e clientes inativos se os toggles estiverem desativados
        let registrosFiltrados = item.registros || [];
        if ((!mostrarColaboradoresInativos || !mostrarClientesInativos) && registrosFiltrados.length > 0) {
          registrosFiltrados = registrosFiltrados.filter(reg => {
            // Filtrar registros de colaboradores inativos
            if (!mostrarColaboradoresInativos && reg.usuario_id && isColaboradorInativo(reg.usuario_id, reg)) {
              return false;
            }

            // Filtrar registros relacionados a clientes inativos
            if (!mostrarClientesInativos && reg.cliente_id) {
              const clienteIds = String(reg.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
              const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, reg));
              if (temClienteInativo) {
                return false;
              }
            }

            return true;
          });
        }

        // Filtrar tempoPorColaborador para remover colaboradores inativos
        let tempoPorColaborador = item.resumo.tempoPorColaborador || {};
        if (!mostrarColaboradoresInativos && tempoPorColaborador) {
          const tempoPorColaboradorFiltrado = {};
          Object.keys(tempoPorColaborador).forEach(colabId => {
            if (!isColaboradorInativo(colabId)) {
              // Preservar todos os campos do colaborador, incluindo status
              tempoPorColaboradorFiltrado[colabId] = {
                ...tempoPorColaborador[colabId],
                status: tempoPorColaborador[colabId].status || 'ativo'
              };
            }
          });
          tempoPorColaborador = tempoPorColaboradorFiltrado;
        } else {
          // Garantir que todos os colaboradores tenham status mesmo quando mostrarInativos está ativado
          const tempoPorColaboradorComStatus = {};
          Object.keys(tempoPorColaborador).forEach(colabId => {
            tempoPorColaboradorComStatus[colabId] = {
              ...tempoPorColaborador[colabId],
              status: tempoPorColaborador[colabId].status || 'ativo'
            };
          });
          tempoPorColaborador = tempoPorColaboradorComStatus;
        }

        clienteDataCacheRef.current[item.cliente.id] = {
          contratos: item.contratos || [],
          registros: registrosFiltrados,
          tempoPorColaborador: tempoPorColaborador,
          tarefasUnicas: item.resumo.totalTarefasUnicas,
          produtosUnicos: item.resumo.totalProdutosUnicos
        };
      });

      // Filtrar registros de colaboradores e clientes inativos nos dados de cada cliente antes de setar
      // E também remover clientes inativos da lista quando mostrarClientesInativos estiver desativado
      const clientesComResumosFiltrados = clientesComResumos
        .map(item => {
          // Se mostrarClientesInativos estiver desativado, verificar se o próprio cliente está inativo
          if (!mostrarClientesInativos) {
            const clienteStatus = item.cliente?.status || 'ativo';
            if (clienteStatus === 'inativo') {
              return null; // Marcar para remover clientes inativos
            }
          }

          if ((!mostrarColaboradoresInativos || !mostrarClientesInativos) && item.registros && Array.isArray(item.registros)) {
            const registrosFiltrados = item.registros.filter(reg => {
              // Filtrar registros de colaboradores inativos
              if (!mostrarColaboradoresInativos && reg.usuario_id && isColaboradorInativo(reg.usuario_id, reg)) {
                return false;
              }

              // Filtrar registros relacionados a clientes inativos
              if (!mostrarClientesInativos && reg.cliente_id) {
                const clienteIds = String(reg.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
                const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, reg));
                if (temClienteInativo) {
                  return false;
                }
              }

              return true;
            });
            return {
              ...item,
              registros: registrosFiltrados
            };
          }
          return item;
        })
        .filter(item => item !== null); // Remover clientes inativos marcados

      setClientes(clientesComResumosFiltrados);
      setTotalClients(result.total || 0);
      setTotalPages(result.totalPages || 1);

      // Marcar dados como completos apenas quando tudo estiver carregado
      setDadosCompletos(true);
    } catch (error) {
      // Verificar se esta ainda é a requisição mais recente antes de processar erro
      if (currentRequestId !== requestIdRef.current) {
        // Uma requisição mais nova foi iniciada, ignorar este erro
        return;
      }

      console.error('Erro ao carregar clientes paginados:', error);
      setClientes([]);
      setAllRegistrosTempo([]);
      setAllContratos([]);
      setEmptyMessage(null);
      setDadosCompletos(false);
    } finally {
      // Limpar flag apenas se esta ainda for a requisição mais recente
      if (currentRequestId === requestIdRef.current) {
        isRequestInProgressRef.current = false;
      }
      // Só desativar loading se esta for a requisição mais recente
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [currentPage, itemsPerPage, mostrarColaboradoresInativos, mostrarClientesInativos, isColaboradorInativo, isClienteInativo]);

  // Aplicar filtros - só executa quando o botão for clicado
  const aplicarFiltros = useCallback(() => {
    // Limpar dados anteriores antes de aplicar novos filtros
    setClientes([]);
    setAllRegistrosTempo([]);
    setAllContratos([]);
    setEmptyMessage(null);
    setDadosCompletos(false);

    // Validar período (obrigatório)
    if (!filtroDataInicio || !filtroDataFim) {
      alert('Selecione o período TimeTrack');
      return;
    }

    if (new Date(filtroDataInicio) > new Date(filtroDataFim)) {
      alert('A data de início deve ser anterior ou igual à data de fim');
      return;
    }

    // Validar se há colaboradores selecionados e se requer período
    const temColaboradores = Array.isArray(filtroColaborador)
      ? filtroColaborador.length > 0
      : (filtroColaborador && filtroColaborador.toString().trim() !== '');

    // Preparar filtros para enviar (apenas os preenchidos)
    const filtrosParaEnviar = {};

    // Período é obrigatório
    filtrosParaEnviar.dataInicio = filtroDataInicio.trim();
    filtrosParaEnviar.dataFim = filtroDataFim.trim();

    // Cliente (opcional - só envia se preenchido)
    if (filtroCliente) {
      const clienteValido = Array.isArray(filtroCliente)
        ? filtroCliente.filter(c => c && c.toString().trim() !== '').length > 0
        : filtroCliente.toString().trim() !== '';

      if (clienteValido) {
        filtrosParaEnviar.clienteId = filtroCliente;
      }
    }

    // IMPORTANTE: Colaborador (opcional - só envia se EXPLICITAMENTE preenchido)
    // Se não estiver preenchido, NÃO envia o parâmetro para trazer TODOS os colaboradores
    // Quando não há colaborador selecionado, o backend deve retornar TODOS os colaboradores
    // que trabalharam no cliente/período, como se todos estivessem selecionados
    if (temColaboradores) {
      filtrosParaEnviar.colaboradorId = filtroColaborador;
    }
    // Se não tem colaboradores selecionados, NÃO adiciona colaboradorId ao objeto
    // Isso garante que o backend retorne TODOS os colaboradores do cliente/período
    // O backend já trata isso corretamente: quando colaboradorId não é enviado,
    // ele não aplica filtro de colaborador e retorna todos os registros de todos os colaboradores

    setCurrentPage(1);
    setFiltrosAplicados(true);
    setFiltrosAplicadosAtuais(filtrosParaEnviar);
    // Salvar os valores dos filtros aplicados para comparação
    setFiltrosUltimosAplicados({
      cliente: filtroCliente,
      dataInicio: filtroDataInicio,
      dataFim: filtroDataFim,
      colaborador: filtroColaborador,
      mostrarClientesInativos: mostrarClientesInativos,
      mostrarColaboradoresInativos: mostrarColaboradoresInativos,
      enabledWeekends: enabledWeekends,
      enabledHolidays: enabledHolidays
    });
    carregarClientesPaginados(filtrosParaEnviar);
  }, [filtroCliente, filtroDataInicio, filtroDataFim, filtroColaborador, mostrarClientesInativos, mostrarColaboradoresInativos, carregarClientesPaginados]);

  // Limpar filtros
  const limparFiltros = useCallback(async () => {
    setEmptyMessage(null);
    // Limpar todos os filtros
    setFiltroCliente(null);
    setFiltroColaborador(null);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setMostrarClientesInativos(false);
    setMostrarColaboradoresInativos(false);
    setEnabledWeekends(false);
    setEnabledHolidays(false);
    setFiltrosAplicadosAtuais({});

    // Limpar cache para garantir dados atualizados
    cacheAPI.remove('api_cache_clientes_all');
    cacheAPI.remove('api_cache_colaboradores_all');

    // Recarregar todos os dados sem filtros
    await carregarClientes();
    await carregarColaboradores();

    // Limpar resultados
    setClientes([]);
    setAllContratos([]);
    setAllRegistrosTempo([]);
    setCurrentPage(1);
    setFiltrosAplicados(false);
    setFiltrosUltimosAplicados(null);
  }, [carregarClientes, carregarColaboradores]);

  // Função para comparar arrays (considerando ordem)
  const arraysEqual = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    const aSorted = [...a].sort().map(String);
    const bSorted = [...b].sort().map(String);
    return JSON.stringify(aSorted) === JSON.stringify(bSorted);
  };

  // Verificar se há mudanças pendentes nos filtros
  const hasPendingChanges = () => {
    // Se não há filtros aplicados, não há mudanças pendentes
    if (!filtrosAplicados || !filtrosUltimosAplicados) {
      return false;
    }

    // Comparar cada filtro
    const clienteChanged = !arraysEqual(
      Array.isArray(filtroCliente) ? filtroCliente : (filtroCliente ? [filtroCliente] : []),
      Array.isArray(filtrosUltimosAplicados.cliente) ? filtrosUltimosAplicados.cliente : (filtrosUltimosAplicados.cliente ? [filtrosUltimosAplicados.cliente] : [])
    );

    const dataInicioChanged = (filtroDataInicio || '') !== (filtrosUltimosAplicados.dataInicio || '');
    const dataFimChanged = (filtroDataFim || '') !== (filtrosUltimosAplicados.dataFim || '');

    const colaboradorChanged = !arraysEqual(
      Array.isArray(filtroColaborador) ? filtroColaborador : (filtroColaborador ? [filtroColaborador] : []),
      Array.isArray(filtrosUltimosAplicados.colaborador) ? filtrosUltimosAplicados.colaborador : (filtrosUltimosAplicados.colaborador ? [filtrosUltimosAplicados.colaborador] : [])
    );

    const mostrarClientesInativosChanged = mostrarClientesInativos !== (filtrosUltimosAplicados.mostrarClientesInativos || false);
    const mostrarColaboradoresInativosChanged = mostrarColaboradoresInativos !== (filtrosUltimosAplicados.mostrarColaboradoresInativos || false);

    return clienteChanged || dataInicioChanged || dataFimChanged || colaboradorChanged || mostrarClientesInativosChanged || mostrarColaboradoresInativosChanged;
  };

  // Handlers dos filtros - apenas atualiza o estado, sem filtrar opções
  const handleClienteChange = useCallback((e) => {
    // Tratar arrays vazios e null como limpeza do filtro
    let value = e.target.value;
    if (value === null || value === undefined || value === '') {
      value = null;
    } else if (Array.isArray(value)) {
      // Se for array vazio, tratar como null
      if (value.length === 0) {
        value = null;
      }
    }

    setFiltroCliente(value);
  }, []);


  const handleColaboradorChange = useCallback((e) => {
    // value pode ser null, um array, ou um único valor (para compatibilidade)
    let value = e.target.value;

    // Tratar arrays vazios e null como limpeza do filtro
    if (value === null || value === undefined || value === '') {
      value = null;
    } else if (Array.isArray(value)) {
      // Se for array vazio, tratar como null
      if (value.length === 0) {
        value = null;
      }
    }

    // Normalizar IDs para garantir consistência
    const normalizeId = (id) => String(id).trim();
    const colaboradorIds = value && Array.isArray(value)
      ? value.map(normalizeId).filter(Boolean)
      : (value ? [normalizeId(value)] : null);

    // Se após normalização o array estiver vazio, tratar como null
    const finalValue = colaboradorIds && colaboradorIds.length > 0 ? colaboradorIds : null;
    setFiltroColaborador(finalValue);
  }, []);

  // Removido: useEffect que atualizava listas baseado em relações entre filtros
  // Agora cada filtro mostra todas as opções disponíveis

  // Abrir card lateral
  const handleOpenDetail = useCallback((clienteId, tipo, event) => {
    const dados = clienteDataCacheRef.current[clienteId];
    if (!dados) return;

    // Se há filtro de cliente, filtrar os registros e tempoPorColaborador
    let dadosFiltrados = { ...dados };
    if (filtroCliente) {
      const clienteIds = Array.isArray(filtroCliente)
        ? filtroCliente.map(id => String(id).trim().toLowerCase())
        : [String(filtroCliente).trim().toLowerCase()];

      // Filtrar registros por cliente
      if (dadosFiltrados.registros && Array.isArray(dadosFiltrados.registros)) {
        dadosFiltrados.registros = dadosFiltrados.registros.filter(registro => {
          if (!registro.cliente_id) return false;
          const idsExtraidos = String(registro.cliente_id)
            .split(',')
            .map(id => id.trim().toLowerCase())
            .filter(id => id.length > 0);
          return idsExtraidos.some(id => clienteIds.includes(id));
        });
      }

      // Filtrar tempoPorColaborador - recalcular apenas com registros filtrados
      if (dadosFiltrados.registros && Array.isArray(dadosFiltrados.registros)) {
        const tempoPorColaboradorFiltrado = {};
        dadosFiltrados.registros.forEach(registro => {
          if (registro.usuario_id && registro.membro) {
            const colaboradorId = String(registro.usuario_id).trim();
            if (!tempoPorColaboradorFiltrado[colaboradorId]) {
              tempoPorColaboradorFiltrado[colaboradorId] = {
                nome: registro.membro.nome || `Colaborador ${colaboradorId}`,
                status: registro.membro.status || 'ativo',
                total: 0
              };
            }
            tempoPorColaboradorFiltrado[colaboradorId].total += Number(registro.tempo_realizado) || 0;
          }
        });
        dadosFiltrados.tempoPorColaborador = tempoPorColaboradorFiltrado;
      }
    }

    // Calcular posição ao lado do botão clicado (igual ao servidor original)
    let left = '50%';
    let top = '50%';

    // Garantir que todos os registros tenham responsavel_id preenchido
    // O DetailSideCard depende disso para buscar o tempo realizado
    if (dadosFiltrados.registros && Array.isArray(dadosFiltrados.registros)) {
      dadosFiltrados.registros.forEach(reg => {
        if (!reg.responsavel_id) {
          if (reg.membro && reg.membro.id) {
            reg.responsavel_id = reg.membro.id;
          } else if (reg.usuario_id) {
            // Tentar encontrar o membro correspondente ao usuario_id
            const colaborador = todosColaboradores.find(c =>
              String(c.usuario_id) === String(reg.usuario_id) ||
              String(c.id) === String(reg.usuario_id)
            );
            if (colaborador) {
              reg.responsavel_id = colaborador.id;
            } else {
              reg.responsavel_id = reg.usuario_id;
            }
          }
        }
      });
    }

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

    setDetailCardPosition({ top, left });
    setDetailCard({
      clienteId: clienteId,
      tipo: tipo, // Usar o tipo passado (contratos, tarefas, produtos, etc.)
      dados: dadosFiltrados // Passar os dados filtrados diretamente
    });
  }, [filtroCliente, todosColaboradores]);

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
    // Agrupar registros por tarefa_id para verificar se a tarefa só tem colaboradores inativos
    const tarefasPorId = new Map();

    allRegistrosTempo.forEach(registro => {
      if (registro.tarefa_id) {
        const tarefaId = String(registro.tarefa_id).trim();

        if (!tarefasPorId.has(tarefaId)) {
          tarefasPorId.set(tarefaId, []);
        }
        tarefasPorId.get(tarefaId).push(registro);
      }
    });

    // Filtrar tarefas: remover tarefas que só têm colaboradores inativos (se mostrarColaboradoresInativos estiver desativado)
    tarefasPorId.forEach((registros, tarefaId) => {
      if (!mostrarColaboradoresInativos) {
        // Verificar se todos os registros são de colaboradores inativos
        const todosInativos = registros.every(reg => {
          if (!reg.usuario_id) return false;
          return isColaboradorInativo(reg.usuario_id, reg);
        });

        // Se todos são inativos, não incluir a tarefa
        if (todosInativos) {
          return;
        }
      }

      // Se chegou aqui, a tarefa tem pelo menos um colaborador ativo (ou inativos estão habilitados)
      const primeiroRegistro = registros[0];
      const nomeTarefa = primeiroRegistro.tarefa?.tarefa_nome ||
        primeiroRegistro.tarefa?.nome ||
        primeiroRegistro.tarefa?.titulo ||
        primeiroRegistro.tarefa?.descricao;

      if (nomeTarefa) {
        tarefasMap.set(tarefaId, nomeTarefa);
      } else {
        tarefasIdsParaBuscar.push(tarefaId);
      }
    });

    // Se houver tarefas sem nome, buscar na API
    if (tarefasIdsParaBuscar.length > 0) {
      try {
        const result = await tarefasAPI.getByIds(tarefasIdsParaBuscar);
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
  }, [allRegistrosTempo, mostrarColaboradoresInativos, isColaboradorInativo, isClienteInativo]);

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
        // Filtrar colaboradores inativos se mostrarColaboradoresInativos estiver desativado
        if (!mostrarColaboradoresInativos && isColaboradorInativo(registro.usuario_id, registro)) {
          return; // Pular colaboradores inativos
        }

        const colaboradorId = String(registro.usuario_id).trim();
        const colaboradorIdNum = parseInt(colaboradorId, 10);

        if (!colaboradoresMap.has(colaboradorId)) {
          let nomeColaborador = null;
          let statusColaborador = 'ativo';

          // 1. Tentar buscar nome e status do colaborador do objeto membro (vem do backend)
          if (registro.membro && registro.membro.nome) {
            nomeColaborador = registro.membro.nome;
            statusColaborador = registro.membro.status || 'ativo';
          }

          // 2. Se não encontrou, buscar na lista de todosColaboradores
          if (!nomeColaborador && colaboradoresMapById.size > 0) {
            const colaboradorEncontrado = colaboradoresMapById.get(colaboradorId) ||
              colaboradoresMapById.get(colaboradorIdNum) ||
              colaboradoresMapById.get(registro.usuario_id);
            nomeColaborador = colaboradorEncontrado?.nome;
            statusColaborador = colaboradorEncontrado?.status || 'ativo';
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
            statusColaborador = colaboradorEncontrado?.status || 'ativo';
          }

          // Se não encontrou nome, adicionar à lista para buscar no backend
          if (!nomeColaborador) {
            idsSemNome.push(colaboradorId);
            colaboradoresMap.set(colaboradorId, null); // Placeholder
          } else {
            colaboradoresMap.set(colaboradorId, { nome: nomeColaborador, status: statusColaborador });
          }
        }
      }
    });

    // Se houver IDs sem nome, buscar no backend
    if (idsSemNome.length > 0) {
      try {
        // Buscar membros faltantes do backend
        const result = await colaboradoresAPI.getAll();
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
              colaboradoresMap.set(idStr, {
                nome: membro.nome,
                status: membro.status || 'ativo'
              });
            } else {
              colaboradoresMap.set(idStr, {
                nome: `Colaborador #${idStr}`,
                status: 'ativo'
              });
            }
          });
        }
      } catch (error) {
        console.error('Erro ao buscar membros faltantes:', error);
        // Se der erro, usar fallback
        idsSemNome.forEach(id => {
          colaboradoresMap.set(String(id).trim(), { nome: `Colaborador #${id}`, status: 'ativo' });
        });
      }
    }

    // Aplicar fallback para qualquer colaborador que ainda não tenha nome
    colaboradoresMap.forEach((dados, id) => {
      if (!dados || (typeof dados === 'string' && !dados)) {
        colaboradoresMap.set(id, {
          nome: `Colaborador #${id}`,
          status: 'ativo'
        });
      } else if (typeof dados === 'string') {
        // Converter string antiga para objeto
        colaboradoresMap.set(id, {
          nome: dados,
          status: 'ativo'
        });
      }
    });

    // Converter para array e ordenar por nome
    const itens = Array.from(colaboradoresMap.values())
      .map(item => typeof item === 'string' ? { nome: item, status: 'ativo' } : item)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (itens.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }

    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Colaboradores', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosColaboradores, mostrarColaboradoresInativos, isColaboradorInativo]);

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
      // Filtrar registros relacionados a clientes inativos se mostrarClientesInativos estiver desativado
      if (!mostrarClientesInativos && registro.cliente_id) {
        const clienteIds = String(registro.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
        const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, registro));
        if (temClienteInativo) {
          return; // Pular registros de clientes inativos
        }
      }

      if (registro.cliente_id) {
        // IMPORTANTE: cliente_id pode conter múltiplos IDs separados por ", "
        // Fazer split para tratar cada ID como um cliente separado
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

    // Filtrar clientes inativos se mostrarClientesInativos estiver desativado
    let itens = Array.from(clientesMap.values());
    if (!mostrarClientesInativos) {
      itens = itens.filter(clienteNome => {
        // Buscar o cliente na lista de todosClientes para verificar status
        const cliente = todosClientes.find(c => c.nome === clienteNome);
        if (cliente) {
          const status = cliente.status || 'ativo';
          return status !== 'inativo';
        }
        return true; // Se não encontrou, assumir ativo (compatibilidade)
      });
    }

    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Clientes', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosClientes, filtroCliente, mostrarClientesInativos, isClienteInativo]);

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

  // Carregar registros de tempo sem tarefa_id (tarefas desajustadas)
  const carregarTarefasIncompletas = useCallback(async () => {
    setLoadingIncompletas(true);
    try {
      const result = await registroTempoAPI.getSemTarefa();

      // Aceitar tanto result.data quanto result.items (compatibilidade)
      const registros = result.data || result.items || [];

      setTarefasIncompletas(registros);
    } catch (error) {
      console.error('❌ Erro ao carregar registros sem tarefa:', error);
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

  // Formatar data com horário (dia/mes/ano horário)
  const formatarDataComHorario = useCallback((data) => {
    if (!data) return '-';
    try {
      const d = new Date(data);
      if (isNaN(d.getTime())) return '-';
      const dia = d.getDate().toString().padStart(2, '0');
      const mes = (d.getMonth() + 1).toString().padStart(2, '0');
      const ano = d.getFullYear();
      const horas = d.getHours().toString().padStart(2, '0');
      const minutos = d.getMinutes().toString().padStart(2, '0');
      const segundos = d.getSeconds().toString().padStart(2, '0');
      return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
    } catch {
      return '-';
    }
  }, []);

  // Formatar tempo realizado no formato "H.R: Xh Ymin Zs"
  const formatarTempoRealizado = useCallback((tempoRealizado) => {
    if (!tempoRealizado || tempoRealizado === 0) {
      return 'H.R: 0h 0min 0s';
    }

    // Converter para milissegundos se necessário
    // Se valor < 1 (decimal), está em horas -> converter para ms
    // Se valor >= 1, já está em ms
    let tempoMs = Number(tempoRealizado);
    if (tempoMs < 1) {
      tempoMs = Math.round(tempoMs * 3600000);
    }
    // Se resultado < 1 segundo, arredondar para 1 segundo
    if (tempoMs > 0 && tempoMs < 1000) {
      tempoMs = 1000;
    }

    const horas = Math.floor(tempoMs / (1000 * 60 * 60));
    const minutos = Math.floor((tempoMs % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((tempoMs % (1000 * 60)) / 1000);
    let tempoFormatado = '';
    if (horas > 0) tempoFormatado += `${horas}h `;
    if (minutos > 0 || horas > 0) tempoFormatado += `${minutos}min `;
    if (segundos > 0 || (horas === 0 && minutos === 0)) tempoFormatado += `${segundos}s`;
    return `H.R: ${tempoFormatado.trim()}`;
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    // Limpar cache de clientes e colaboradores para garantir dados atualizados
    cacheAPI.remove('api_cache_clientes_all');
    cacheAPI.remove('api_cache_colaboradores_all');
    carregarClientes();
    carregarColaboradores();
    // Carregar tarefas incompletas no início para exibir o badge
    carregarTarefasIncompletas();
  }, [carregarClientes, carregarColaboradores, carregarTarefasIncompletas]);

  // Recarregar dados quando a página, itens por página ou mostrarInativos mudarem (apenas se filtros já foram aplicados)
  // IMPORTANTE: Usar um único useEffect com todas as dependências para evitar múltiplos carregamentos
  useEffect(() => {
    // Só carregar se filtros foram aplicados e há filtros atuais
    if (filtrosAplicados && Object.keys(filtrosAplicadosAtuais).length > 0) {
      // Usar setTimeout para garantir que todas as mudanças de estado sejam processadas antes
      const timeoutId = setTimeout(() => {
        carregarClientesPaginados(filtrosAplicadosAtuais);
      }, 0);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, filtrosAplicados, JSON.stringify(filtrosAplicadosAtuais)]);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="form-header">
            <h2 className="form-title">{mostrarIncompletas ? 'Tarefas Desajustadas' : 'Relatórios de Clientes'}</h2>
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
                    window.location.href = '/cadastro/clientes';
                  }
                }}
              >
                <i className="fas fa-briefcase"></i>
                Cadastro Clientes
              </button>
            </div>
          </div>

          {/* Seção de Filtros Expostos - Oculto quando mostrarIncompletas */}
          {!mostrarIncompletas && (
            <>
              <FiltersCard
                onApply={aplicarFiltros}
                onClear={limparFiltros}
                loading={loading}
                hasPendingChanges={hasPendingChanges()}
              >
                {/* Período TimeTrack - PRIMEIRO e sempre habilitado */}
                <div className="filter-group">
                  <label className="filter-label">Período</label>
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
                    showWeekendToggle={true}
                    onWeekendToggleChange={setEnabledWeekends}
                    showHolidayToggle={true}
                    onHolidayToggleChange={setEnabledHolidays}
                  />
                </div>

                {/* Verificar se período está preenchido */}
                {(() => {
                  const periodoPreenchido = filtroDataInicio && filtroDataFim;

                  return (
                    <>
                      <div className={`filter-group filter-group-disabled-wrapper ${!periodoPreenchido ? 'has-tooltip' : ''}`} style={{ position: 'relative' }}>
                        <FilterClientes
                          value={filtroCliente}
                          onChange={handleClienteChange}
                          options={todosClientes}
                          disabled={!periodoPreenchido}
                          showInactiveToggle={true}
                          onInactiveToggleChange={(value) => setMostrarClientesInativos(value)}
                        />
                        {!periodoPreenchido && (
                          <div className="filter-tooltip">
                            Selecione período TimeTrack
                          </div>
                        )}
                      </div>

                      <div className={`filter-group filter-group-disabled-wrapper ${!periodoPreenchido ? 'has-tooltip' : ''}`} style={{ position: 'relative' }}>
                        <FilterColaborador
                          value={filtroColaborador}
                          onChange={handleColaboradorChange}
                          options={todosColaboradores}
                          disabled={!periodoPreenchido}
                          showInactiveToggle={true}
                          onInactiveToggleChange={(value) => setMostrarColaboradoresInativos(value)}
                        />
                        {!periodoPreenchido && (
                          <div className="filter-tooltip">
                            Selecione período TimeTrack
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </FiltersCard>

              {/* Cards de Dashboard - Só exibir quando dados estiverem completamente carregados */}
              {filtrosAplicados && dadosCompletos && !loading && (allContratos.length > 0 || allRegistrosTempo.length > 0) && (
                <DashboardCards
                  filtroCliente={filtroCliente}
                  contratos={allContratos}
                  registrosTempo={allRegistrosTempo}
                  clientesExibidos={null}
                  onShowTarefas={handleShowTarefas}
                  onShowColaboradores={handleShowColaboradores}
                  onShowClientes={handleShowClientes}
                />
              )}
            </>
          )}

          {/* Tabela de Registros de Tempo sem Tarefa */}
          {mostrarIncompletas && (
            <div className="incomplete-tasks-container" style={{ marginTop: '30px' }}>
              <div className="incomplete-tasks-card">
                <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px', fontWeight: 400 }}>
                  Listando registros de tempo sem tarefa.
                </p>
                {loadingIncompletas ? (
                  <div className="loading">
                    <i className="fas fa-spinner"></i>
                    <p>Carregando registros sem tarefa...</p>
                  </div>
                ) : tarefasIncompletas.length > 0 ? (
                  <table className="incomplete-tasks-table">
                    <thead>
                      <tr>
                        <th>Data Fim</th>
                        <th>Data Início</th>
                        <th>Usuário</th>
                        <th>Tempo Realizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarefasIncompletas.map((registro) => (
                        <tr key={registro.id}>
                          <td>{formatarDataComHorario(registro.data_fim)}</td>
                          <td>{formatarDataComHorario(registro.data_inicio)}</td>
                          <td>{registro.membro_nome || (registro.usuario_id ? `ID: ${registro.usuario_id}` : '-')}</td>
                          <td>{formatarTempoRealizado(registro.tempo_realizado)}</td>
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
                    Nenhum registro sem tarefa encontrado
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resultados */}
          {!mostrarIncompletas && (
            <div className="results-container" style={{ marginTop: '30px' }}>
              <div id="resultsContent">
                {!filtrosAplicados ? (
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
                    Selecione os filtros e clique em "Aplicar Filtros" para ver os resultados
                  </div>
                ) : loading || !dadosCompletos ? (
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
                        registros={(() => {
                          // Filtrar registros de colaboradores inativos se mostrarColaboradoresInativos estiver desativado
                          let registros = item.registros || [];
                          if (!mostrarColaboradoresInativos && registros.length > 0) {
                            registros = registros.filter(reg => {
                              if (!reg.usuario_id) return false;
                              return !isColaboradorInativo(reg.usuario_id, reg);
                            });
                          }
                          return registros;
                        })()}
                        onOpenDetail={handleOpenDetail}
                      />
                    ))}
                  </div>
                ) : (
                  <SemResultadosFiltros
                    mensagem={emptyMessage}
                    filtrosAplicados={filtrosAplicados}
                  />
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

export default RelatoriosClientes;

