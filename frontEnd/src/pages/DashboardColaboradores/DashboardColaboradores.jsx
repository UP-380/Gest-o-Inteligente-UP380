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
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import { clientesAPI, colaboradoresAPI, tarefasAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import './DashboardColaboradores.css';

const RelatoriosColaboradores = () => {
  const { usuario } = useAuth();
  const { isAdmin, isGestor } = usePermissions();
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

  // Estado dos resultados
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dadosCompletos, setDadosCompletos] = useState(false);
  const [allRegistrosTempo, setAllRegistrosTempo] = useState([]);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalColaboradores, setTotalColaboradores] = useState(0);

  // Estado para rastrear se os filtros foram aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);
  // Estado para armazenar os filtros que foram aplicados (para usar na paginação)
  const [filtrosAplicadosAtuais, setFiltrosAplicadosAtuais] = useState({});
  // Estado para armazenar os valores dos filtros que foram aplicados por último (para comparação)
  const [filtrosUltimosAplicados, setFiltrosUltimosAplicados] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);

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

  // Carregar colaboradores - sempre carrega todas as opções
  // Nas telas de relatórios, buscar TODOS os membros (incluindo os sem usuário vinculado)
  const carregarColaboradores = useCallback(async () => {
    try {
      const result = await colaboradoresAPI.getAllIncludingWithoutUser();
      if (result.success && result.data && Array.isArray(result.data)) {
        let listaColaboradores = result.data;

        // Se NÃO for admin/gestor, filtrar para mostrar apenas o próprio usuário
        if (!isAdmin && !isGestor && usuario) {
          listaColaboradores = listaColaboradores.filter(c => String(c.usuario_id) === String(usuario.id));
        }

        setTodosColaboradores(listaColaboradores);
        return listaColaboradores; // Retornar para uso em encadeamento (ex: carregarClientes)
      }
      return [];
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      return [];
    }
  }, [isAdmin, isGestor, usuario]);

  // Carregar clientes
  const carregarClientes = useCallback(async (colaboradoresCarregados = []) => {
    try {
      // Se for admin ou gestor, carrega todos os clientes
      if (isAdmin || isGestor) {
        const result = await clientesAPI.getAll(null, false);
        if (result.success && result.data && Array.isArray(result.data)) {
          const clientesComStatus = result.data.map(cliente => ({
            ...cliente,
            status: cliente.status || 'ativo'
          }));
          setTodosClientes(clientesComStatus);
        }
      } else {
        // Se for usuário comum, buscar apenas clientes vinculados ao colaborador
        // Primeiro, encontrar o colaborador vinculado ao usuário logado
        // Usar a lista passada ou buscar no estado se não passada
        const listaParaBusca = colaboradoresCarregados.length > 0 ? colaboradoresCarregados : todosColaboradores;
        const meuColaborador = listaParaBusca.find(c => String(c.usuario_id) === String(usuario?.id));

        if (meuColaborador) {
          const result = await clientesAPI.getByColaborador(meuColaborador.id);
          if (result.success && result.data && Array.isArray(result.data)) {
            const clientesComStatus = result.data.map(cliente => ({
              ...cliente,
              status: cliente.status || 'ativo'
            }));
            setTodosClientes(clientesComStatus);
          } else {
            setTodosClientes([]); // Fallback seguro
          }
        } else {
          // Se não encontrar vínculo de colaborador, não mostra nenhum cliente
          setTodosClientes([]);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      if (!isAdmin && !isGestor) {
        setTodosClientes([]); // Fallback seguro em erro para não admins
      }
    }
  }, [isAdmin, isGestor, usuario, todosColaboradores]);

  // Efeito inicial para carregar dados
  useEffect(() => {
    const carregarDadosIniciais = async () => {
      const colaboradores = await carregarColaboradores();
      await carregarClientes(colaboradores);
    };

    if (usuario) {
      carregarDadosIniciais();
    }
  }, [carregarColaboradores, carregarClientes, usuario]);
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

  // Carregar colaboradores paginados - recebe os filtros como parâmetros
  const carregarColaboradoresPaginados = useCallback(async (filtrosAplicados = {}) => {
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

      const result = await colaboradoresAPI.getRelatorios(params);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar colaboradores');
      }

      const colaboradoresComResumos = result.data || [];

      // Armazenar mensagem se houver (para casos sem registros)
      // Não usar a mensagem específica do backend, usar mensagem padrão
      if (result.message) {
        setColaboradores([]);
        setAllRegistrosTempo([]);
        setTotalColaboradores(0);
        setEmptyMessage(null); // Usar mensagem padrão do componente
        setDadosCompletos(true);
        setLoading(false);
        return;
      }

      // Se não há colaboradores retornados, usar mensagem padrão
      if (colaboradoresComResumos.length === 0) {
        setColaboradores([]);
        setAllRegistrosTempo([]);
        setTotalColaboradores(0);
        setTotalPages(0);
        setEmptyMessage(null); // Usar mensagem padrão do componente
        setDadosCompletos(true);
        setLoading(false);
        return;
      }

      // Se chegou aqui, há colaboradores, então limpar mensagem
      setEmptyMessage(null);

      // Usar os totais gerais retornados pelo backend
      if (result.totaisGerais) {
        const { todosRegistros } = result.totaisGerais;

        // Filtrar registros de colaboradores e clientes inativos se os toggles estiverem desativados
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

        setAllRegistrosTempo(registrosFiltrados);
      } else {
        // Fallback: coletar todos os registros
        const registrosMap = new Map();

        colaboradoresComResumos.forEach(item => {
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

        setAllRegistrosTempo(registrosArray);
      }

      // Armazenar dados no cache para os cards laterais
      colaboradoresComResumos.forEach(item => {
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

        colaboradorDataCacheRef.current[item.colaborador.id] = {
          registros: registrosFiltrados,
          tarefasUnicas: item.resumo.totalTarefasUnicas,
          produtosUnicos: item.resumo.totalProdutosUnicos,
          clientesUnicos: item.resumo.totalClientesUnicos
        };
      });

      // Filtrar registros de colaboradores inativos nos dados de cada colaborador antes de setar
      const colaboradoresComResumosFiltrados = colaboradoresComResumos
        .map(item => {
          // Se mostrarColaboradoresInativos estiver desativado, verificar se o próprio colaborador está inativo
          if (!mostrarColaboradoresInativos) {
            const colaboradorStatus = item.colaborador?.status || 'ativo';
            if (colaboradorStatus === 'inativo') {
              return null; // Marcar para remover colaboradores inativos
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

            // Recalcular resumo sem os registros de colaboradores inativos
            const tarefasUnicas = new Set();
            const produtosUnicos = new Set();
            const clientesUnicos = new Set();
            let tempoTotalRealizado = 0;

            registrosFiltrados.forEach(reg => {
              if (reg.tarefa_id) {
                tarefasUnicas.add(String(reg.tarefa_id));
              }
              if (reg.produto_id) {
                produtosUnicos.add(String(reg.produto_id));
              }
              if (reg.cliente_id) {
                const clienteIds = String(reg.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
                clienteIds.forEach(id => clientesUnicos.add(id));
              }
              if (reg.tempo_realizado) {
                tempoTotalRealizado += Number(reg.tempo_realizado) || 0;
              }
            });

            return {
              ...item,
              registros: registrosFiltrados,
              resumo: {
                totalTarefasUnicas: tarefasUnicas.size,
                totalProdutosUnicos: produtosUnicos.size,
                totalClientesUnicos: clientesUnicos.size,
                tempoTotalRealizado: item.resumo.tempoTotalRealizado || tempoTotalRealizado
              }
            };
          }
          return item;
        })
        .filter(item => item !== null); // Remover colaboradores inativos marcados

      setColaboradores(colaboradoresComResumosFiltrados);
      setTotalColaboradores(result.total || 0);
      setTotalPages(result.totalPages || 1);

      // Marcar dados como completos apenas quando tudo estiver carregado
      setDadosCompletos(true);
    } catch (error) {
      console.error('Erro ao carregar colaboradores paginados:', error);
      setColaboradores([]);
      setDadosCompletos(false);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, mostrarColaboradoresInativos, mostrarClientesInativos, isColaboradorInativo, isClienteInativo]);

  // Aplicar filtros - só executa quando o botão for clicado
  const aplicarFiltros = useCallback(() => {
    // Validar período (se preenchido)
    if (filtroDataInicio && filtroDataFim) {
      if (new Date(filtroDataInicio) > new Date(filtroDataFim)) {
        alert('A data de início deve ser anterior ou igual à data de fim');
        return;
      }
    }

    // Validar se há colaboradores selecionados e se requer período
    const temColaboradores = Array.isArray(filtroColaborador)
      ? filtroColaborador.length > 0
      : (filtroColaborador && filtroColaborador.toString().trim() !== '');

    if (temColaboradores && (!filtroDataInicio || !filtroDataFim)) {
      alert('O filtro "Colaborador" requer que o filtro "Período" esteja selecionado');
      return;
    }

    // Verificar se tem pelo menos o período preenchido (obrigatório)
    if (!filtroDataInicio || !filtroDataFim) {
      alert('Selecione o período TimeTrack');
      return;
    }

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
    carregarColaboradoresPaginados(filtrosParaEnviar);
  }, [filtroCliente, filtroDataInicio, filtroDataFim, filtroColaborador, mostrarClientesInativos, mostrarColaboradoresInativos, carregarColaboradoresPaginados]);

  // Limpar filtros
  const limparFiltros = useCallback(async () => {
    // Limpar todos os filtros
    setFiltroCliente(null);
    setFiltroColaborador(null);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setMostrarClientesInativos(false);
    setMostrarColaboradoresInativos(false);
    setEnabledWeekends(false);
    setEnabledHolidays(false);

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
    setFiltrosAplicadosAtuais({});
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
    const enabledWeekendsChanged = enabledWeekends !== (filtrosUltimosAplicados.enabledWeekends || false);
    const enabledHolidaysChanged = enabledHolidays !== (filtrosUltimosAplicados.enabledHolidays || false);

    return clienteChanged || dataInicioChanged || dataFimChanged || colaboradorChanged || mostrarClientesInativosChanged || mostrarColaboradoresInativosChanged || enabledWeekendsChanged || enabledHolidaysChanged;
  };

  // Handlers dos filtros - apenas atualiza o estado, sem filtrar opções
  const handleClienteChange = useCallback((e) => {
    const value = e.target.value || null;
    setFiltroCliente(value);
  }, []);

  const handleColaboradorChange = useCallback((e) => {
    // value pode ser null, um array, ou um único valor (para compatibilidade)
    const value = e.target.value || null;

    // Normalizar IDs para garantir consistência
    const normalizeId = (id) => String(id).trim();
    const colaboradorIds = Array.isArray(value)
      ? value.map(normalizeId).filter(Boolean)
      : (value ? [normalizeId(value)] : null);

    setFiltroColaborador(colaboradorIds && colaboradorIds.length > 0 ? colaboradorIds : null);
  }, []);

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
        const idsParam = tarefasIdsParaBuscar.join(',');
        const result = await tarefasAPI.getByIds(tarefasIdsParaBuscar);
        if (result.success && result.data) {
          Object.entries(result.data).forEach(([id, nome]) => {
            if (nome) {
              tarefasMap.set(id, nome);
            } else {
              tarefasMap.set(id, `Tarefa #${id}`);
            }
          });
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
  }, [allRegistrosTempo, mostrarColaboradoresInativos, isColaboradorInativo]);

  const handleShowColaboradores = useCallback((e) => {
    if (!allRegistrosTempo || allRegistrosTempo.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }

    // Se há filtro de colaborador, considerar apenas os colaboradores filtrados
    const colaboradorIdsFiltro = filtroColaborador
      ? (Array.isArray(filtroColaborador)
        ? filtroColaborador.map(id => String(id).trim().toLowerCase())
        : [String(filtroColaborador).trim().toLowerCase()])
      : null;

    const colaboradoresMap = new Map();
    allRegistrosTempo.forEach(registro => {
      if (registro.usuario_id) {
        // Filtrar colaboradores inativos se mostrarColaboradoresInativos estiver desativado
        if (!mostrarColaboradoresInativos && isColaboradorInativo(registro.usuario_id, registro)) {
          return; // Pular colaboradores inativos
        }

        const colaboradorId = String(registro.usuario_id).trim().toLowerCase();

        // Se há filtro, considerar apenas os colaboradores que estão no filtro
        if (colaboradorIdsFiltro && !colaboradorIdsFiltro.includes(colaboradorId)) {
          return; // Pular colaboradores que não estão no filtro
        }

        if (!colaboradoresMap.has(colaboradorId)) {
          // Buscar nome do colaborador
          const colaborador = todosColaboradores.find(c =>
            String(c.id).trim().toLowerCase() === colaboradorId
          );
          const nomeColaborador = colaborador?.nome || `Colaborador ${registro.usuario_id}`;
          colaboradoresMap.set(colaboradorId, nomeColaborador);
        }
      }
    });

    const itens = Array.from(colaboradoresMap.values());

    if (itens.length === 0) {
      alert('Nenhum colaborador encontrado');
      return;
    }

    const position = calcularPosicaoMiniCard(e);
    setMiniCardLista({ titulo: 'Colaboradores', itens });
    setMiniCardPosition(position);
  }, [allRegistrosTempo, todosColaboradores, filtroColaborador, mostrarColaboradoresInativos, isColaboradorInativo]);

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
      // Filtrar registros de colaboradores inativos se mostrarColaboradoresInativos estiver desativado
      if (!mostrarColaboradoresInativos && registro.usuario_id && isColaboradorInativo(registro.usuario_id, registro)) {
        return; // Pular registros de colaboradores inativos
      }

      // Filtrar registros relacionados a clientes inativos se mostrarClientesInativos estiver desativado
      if (!mostrarClientesInativos && registro.cliente_id) {
        const clienteIds = String(registro.cliente_id).split(',').map(id => id.trim()).filter(Boolean);
        const temClienteInativo = clienteIds.some(clienteId => isClienteInativo(clienteId, registro));
        if (temClienteInativo) {
          return; // Pular registros de clientes inativos
        }
      }

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
  }, [allRegistrosTempo, todosClientes, filtroCliente, mostrarClientesInativos, mostrarColaboradoresInativos, isColaboradorInativo, isClienteInativo]);

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

  // Recarregar dados quando a página, itens por página ou mostrarInativos mudarem (apenas se filtros já foram aplicados)
  useEffect(() => {
    if (filtrosAplicados && Object.keys(filtrosAplicadosAtuais).length > 0) {
      carregarColaboradoresPaginados(filtrosAplicadosAtuais);
    }
  }, [currentPage, itemsPerPage, filtrosAplicados, filtrosAplicadosAtuais, carregarColaboradoresPaginados]);

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
                  window.location.href = '/cadastro/colaboradores';
                }}
              >
                <i className="fas fa-briefcase"></i>
                Cadastro Colaboradores
              </button>
            </div>
          </div>

          {/* Seção de Filtros */}
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
          {filtrosAplicados && dadosCompletos && !loading && allRegistrosTempo.length > 0 && (
            <DashboardCards
              registrosTempo={allRegistrosTempo}
              clientesExibidos={[]}
              onShowTarefas={handleShowTarefas}
              onShowColaboradores={handleShowColaboradores}
              onShowClientes={handleShowClientes}
              showColaboradores={true}
              filtroCliente={filtroCliente}
            />
          )}

          {/* Resultados */}
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
                <SemResultadosFiltros
                  mensagem={emptyMessage}
                  filtrosAplicados={filtrosAplicados}
                />
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
