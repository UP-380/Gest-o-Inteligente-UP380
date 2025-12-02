import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import FilterStatus from '../../components/filters/FilterStatus';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterColaborador from '../../components/filters/FilterColaborador';
import FiltersCard from '../../components/filters/FiltersCard';
import DashboardCards from '../../components/dashboard/DashboardCards';
import { ClientCard } from '../../components/clients';
import DetailSideCard from '../../components/clients/DetailSideCard';
import MiniCardLista from '../../components/dashboard/MiniCardLista';
import { statusAPI, clientesAPI, colaboradoresAPI, tarefasAPI, cacheAPI } from '../../services/api';
import './DashboardClientes.css';

const RelatoriosClientes = () => {
  // Estado dos filtros
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState(null);
  const [filtroDataFim, setFiltroDataFim] = useState(null);
  const [filtroColaborador, setFiltroColaborador] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  // Estado dos dados
  const [todosStatus, setTodosStatus] = useState([]);
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
  const [allContratos, setAllContratos] = useState([]);
  const [allRegistrosTempo, setAllRegistrosTempo] = useState([]);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  
  // Estado para rastrear se os filtros foram aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);
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

  // Carregar status - sempre carrega todas as opções
  const carregarStatus = useCallback(async () => {
    try {
      const result = await statusAPI.getAll(null);
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosStatus(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  }, []);

  // Carregar clientes - sempre carrega todas as opções
  const carregarClientes = useCallback(async () => {
    try {
      const result = await clientesAPI.getAll(null);
      if (result.success && result.data && Array.isArray(result.data)) {
        setTodosClientes(result.data);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
    }
  }, []);

  // Carregar colaboradores
  const carregarColaboradores = useCallback(async () => {
    try {
      const result = await colaboradoresAPI.getAll();
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
    if (mostrarInativos) return false; // Se inativos estão habilitados, não filtrar
    
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
  }, [mostrarInativos, todosColaboradores]);

  // Estado para armazenar os filtros que foram aplicados (para usar na paginação)
  const [filtrosAplicadosAtuais, setFiltrosAplicadosAtuais] = useState({});

  // Carregar clientes paginados - recebe os filtros como parâmetros
  const carregarClientesPaginados = useCallback(async (filtrosAplicados = {}) => {
    setLoading(true);
    try {
      // Só envia filtros que foram preenchidos
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };
      
      // Adicionar filtros apenas se estiverem preenchidos
      if (filtrosAplicados.status) {
        params.status = filtrosAplicados.status;
      }
      
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
      
      const result = await clientesAPI.getRelatorios(params);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar clientes');
      }
      
      const clientesComResumos = result.data || [];
      
      // Armazenar mensagem se houver (para casos sem registros)
      if (result.message) {
        setClientes([]);
        setAllRegistrosTempo([]);
        setAllContratos([]);
        setTotalClients(0);
        setEmptyMessage(result.message);
        setLoading(false);
        return;
      } else {
        setEmptyMessage(null);
      }
      
      // Se não há clientes retornados, limpar tudo
      if (clientesComResumos.length === 0) {
        setClientes([]);
        setAllRegistrosTempo([]);
        setAllContratos([]);
        setTotalClients(0);
        setEmptyMessage(null);
        setLoading(false);
        return;
      }
      
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
        
        // Filtrar registros de colaboradores inativos se mostrarInativos estiver desativado
        if (!mostrarInativos) {
          registrosFiltrados = registrosFiltrados.filter(reg => {
            if (!reg.usuario_id) return false;
            return !isColaboradorInativo(reg.usuario_id, reg);
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
              // Filtrar registros de colaboradores inativos se mostrarInativos estiver desativado
              if (!mostrarInativos && registro.usuario_id && isColaboradorInativo(registro.usuario_id, registro)) {
                return; // Pular colaboradores inativos
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
        
        // Filtrar registros de colaboradores inativos se mostrarInativos estiver desativado
        if (!mostrarInativos) {
          registrosArray = registrosArray.filter(reg => {
            if (!reg.usuario_id) return false;
            return !isColaboradorInativo(reg.usuario_id, reg);
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
        // Filtrar registros de colaboradores inativos se mostrarInativos estiver desativado
        let registrosFiltrados = item.registros || [];
        if (!mostrarInativos && registrosFiltrados.length > 0) {
          registrosFiltrados = registrosFiltrados.filter(reg => {
            if (!reg.usuario_id) return false;
            return !isColaboradorInativo(reg.usuario_id, reg);
          });
        }
        
        // Filtrar tempoPorColaborador para remover colaboradores inativos
        let tempoPorColaborador = item.resumo.tempoPorColaborador || {};
        if (!mostrarInativos && tempoPorColaborador) {
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
      
      // Filtrar registros de colaboradores inativos nos dados de cada cliente antes de setar
      const clientesComResumosFiltrados = clientesComResumos.map(item => {
        if (!mostrarInativos && item.registros && Array.isArray(item.registros)) {
          const registrosFiltrados = item.registros.filter(reg => {
            if (!reg.usuario_id) return false;
            return !isColaboradorInativo(reg.usuario_id, reg);
          });
          return {
            ...item,
            registros: registrosFiltrados
          };
        }
        return item;
      });
      
      setClientes(clientesComResumosFiltrados);
      setTotalClients(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error('Erro ao carregar clientes paginados:', error);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, mostrarInativos, isColaboradorInativo]);

  // Aplicar filtros - só executa quando o botão for clicado
  const aplicarFiltros = useCallback(() => {
    // Limpar dados anteriores antes de aplicar novos filtros
    setClientes([]);
    setAllRegistrosTempo([]);
    setAllContratos([]);
    setEmptyMessage(null);
    
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
    
    // Status (opcional - só envia se preenchido)
    if (filtroStatus && filtroStatus.toString().trim() !== '') {
      filtrosParaEnviar.status = filtroStatus;
    }
    
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
    carregarClientesPaginados(filtrosParaEnviar);
  }, [filtroStatus, filtroCliente, filtroDataInicio, filtroDataFim, filtroColaborador, carregarClientesPaginados]);

  // Limpar filtros
  const limparFiltros = useCallback(async () => {
    setEmptyMessage(null);
    // Limpar todos os filtros
    setFiltroStatus(null);
    setFiltroCliente(null);
    setFiltroColaborador(null);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setMostrarInativos(false);
    setFiltrosAplicadosAtuais({});
    
    // Limpar cache para garantir dados atualizados
    cacheAPI.remove('api_cache_clientes_all');
    cacheAPI.remove('api_cache_status_all');
    cacheAPI.remove('api_cache_colaboradores_all');
    
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

  // Handlers dos filtros - apenas atualiza o estado, sem filtrar opções
  const handleStatusChange = useCallback((e) => {
    // Tratar string vazia como null para limpar o filtro
    const value = e.target.value && e.target.value.trim() !== '' ? e.target.value : null;
    setFiltroStatus(value);
  }, []);

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
    setDetailCard({ clienteId, tipo, dados: dadosFiltrados });
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
    
    // Filtrar tarefas: remover tarefas que só têm colaboradores inativos (se mostrarInativos estiver desativado)
    tarefasPorId.forEach((registros, tarefaId) => {
      if (!mostrarInativos) {
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
  }, [allRegistrosTempo, mostrarInativos, isColaboradorInativo]);

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
        // Filtrar colaboradores inativos se mostrarInativos estiver desativado
        if (!mostrarInativos && isColaboradorInativo(registro.usuario_id, registro)) {
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
  }, [allRegistrosTempo, todosColaboradores, mostrarInativos, isColaboradorInativo]);

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
      const result = await tarefasAPI.getIncompletas();
      
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
    // Limpar cache de clientes e colaboradores para garantir dados atualizados
    cacheAPI.remove('api_cache_clientes_all');
    cacheAPI.remove('api_cache_colaboradores_all');
    carregarStatus();
    carregarClientes();
    carregarColaboradores();
  }, [carregarStatus, carregarClientes, carregarColaboradores]);

  // Recarregar dados quando a página, itens por página ou mostrarInativos mudarem (apenas se filtros já foram aplicados)
  // IMPORTANTE: Não incluir carregarClientesPaginados nas dependências para evitar recarregamento automático quando filtros mudam
  useEffect(() => {
    if (filtrosAplicados && Object.keys(filtrosAplicadosAtuais).length > 0) {
      carregarClientesPaginados(filtrosAplicadosAtuais);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, mostrarInativos, filtrosAplicados, filtrosAplicadosAtuais]);

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
                  window.location.href = '/gestao-clientes';
                }
              }}
            >
              <i className="fas fa-briefcase"></i>
              Clientes
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
            >
              {/* Período TimeTrack - PRIMEIRO e sempre habilitado */}
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

              {/* Verificar se período está preenchido */}
              {(() => {
                const periodoPreenchido = filtroDataInicio && filtroDataFim;
                
                return (
                  <>
                    <div className={`filter-group filter-group-disabled-wrapper ${!periodoPreenchido ? 'has-tooltip' : ''}`} style={{ position: 'relative' }}>
                      <FilterStatus
                        value={filtroStatus}
                        onChange={handleStatusChange}
                        options={todosStatus}
                        disabled={!periodoPreenchido}
                      />
                      {!periodoPreenchido && (
                        <div className="filter-tooltip">
                          Selecione período TimeTrack
                        </div>
                      )}
                    </div>
                    
                    <div className={`filter-group filter-group-disabled-wrapper ${!periodoPreenchido ? 'has-tooltip' : ''}`} style={{ position: 'relative' }}>
                      <FilterClientes
                        value={filtroCliente}
                        onChange={handleClienteChange}
                        options={todosClientes}
                        disabled={!periodoPreenchido}
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
                        options={todosColaboradores.filter(colab => {
                          // Se mostrarInativos estiver desativado, filtrar colaboradores inativos
                          if (!mostrarInativos) {
                            // Se status não estiver definido, assumir 'ativo' (compatibilidade com cache antigo)
                            const status = colab.status || 'ativo';
                            return status !== 'inativo';
                          }
                          // Se mostrarInativos estiver ativado, mostrar todos os colaboradores
                          return true;
                        })}
                        disabled={!periodoPreenchido}
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

              {(() => {
                const periodoPreenchido = filtroDataInicio && filtroDataFim;
                
                return (
                  <div className={`filter-group filter-group-disabled-wrapper ${!periodoPreenchido ? 'has-tooltip' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', minWidth: 'auto', position: 'relative' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: periodoPreenchido ? '#374151' : '#9ca3af', whiteSpace: 'nowrap', opacity: periodoPreenchido ? 1 : 0.5 }}>
                      Inativos:
                    </label>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="checkbox"
                        id="toggleInativos"
                        checked={mostrarInativos}
                        onChange={(e) => {
                          if (periodoPreenchido) {
                            setMostrarInativos(e.target.checked);
                          }
                        }}
                        disabled={!periodoPreenchido}
                        style={{
                          width: '44px',
                          height: '24px',
                          appearance: 'none',
                          backgroundColor: periodoPreenchido 
                            ? (mostrarInativos ? 'var(--primary-blue, #0e3b6f)' : '#cbd5e1')
                            : '#f3f4f6',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: periodoPreenchido ? 'pointer' : 'not-allowed',
                          transition: 'background-color 0.2s',
                          outline: 'none',
                          opacity: periodoPreenchido ? 1 : 0.5,
                          border: periodoPreenchido ? 'none' : '1px solid #d1d5db'
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: mostrarInativos ? '22px' : '2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {!periodoPreenchido && (
                      <div className="filter-tooltip">
                        Selecione período TimeTrack
                      </div>
                    )}
                  </div>
                );
              })()}
            </FiltersCard>

            {/* Cards de Dashboard */}
            {(allContratos.length > 0 || allRegistrosTempo.length > 0) && (
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
                      registros={(() => {
                        // Filtrar registros de colaboradores inativos se mostrarInativos estiver desativado
                        let registros = item.registros || [];
                        if (!mostrarInativos && registros.length > 0) {
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
                <div className="empty-state" style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  minHeight: '240px', 
                  color: '#555', 
                  fontSize: emptyMessage ? '16px' : '20px', 
                  fontWeight: emptyMessage ? 400 : 600, 
                  letterSpacing: '0.5px', 
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  {emptyMessage ? (
                    <div style={{ 
                      backgroundColor: '#fef3c7', 
                      border: '1px solid #fbbf24', 
                      borderRadius: '8px', 
                      padding: '16px 20px',
                      maxWidth: '600px',
                      color: '#92400e'
                    }}>
                      <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
                      {emptyMessage}
                    </div>
                  ) : (
                    'POR FAVOR APLIQUE OS FILTROS'
                  )}
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

export default RelatoriosClientes;

