import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import AtribuicaoModal from '../../components/atribuicoes/AtribuicaoModal';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterVinculacao from '../../components/filters/FilterVinculacao';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import FilterClientes from '../../components/filters/FilterClientes';
import FilterMembro from '../../components/filters/FilterMembro';
import FilterGeneric from '../../components/filters/FilterGeneric';
import SemResultadosFiltros from '../../components/common/SemResultadosFiltros';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import Avatar from '../../components/user/Avatar';
import Tooltip from '../../components/common/Tooltip';
import AtribuicoesTabela from '../../components/atribuicoes/AtribuicoesTabela';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI, produtosAPI, tarefasAPI } from '../../services/api';
import '../../pages/CadastroVinculacoes/CadastroVinculacoes.css';
import './DelegarTarefas.css';

const API_BASE_URL = '/api';

const DelegarTarefas = () => {
  const showToast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingAgrupamento, setEditingAgrupamento] = useState(null);
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
  
  // Valores selecionados para filtros pai
  const [filtroClienteSelecionado, setFiltroClienteSelecionado] = useState(null);
  const [filtroProdutoSelecionado, setFiltroProdutoSelecionado] = useState(null);
  const [filtroTarefaSelecionado, setFiltroTarefaSelecionado] = useState(null);
  const [filtroResponsavelSelecionado, setFiltroResponsavelSelecionado] = useState(null);
  
  // Estados para carregar dados de produtos e tarefas
  const [produtos, setProdutos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  
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
  
  // Estados para carregar dados
  const [clientes, setClientes] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [membros, setMembros] = useState([]);

  // Carregar clientes, colaboradores e membros ao montar
  useEffect(() => {
    loadClientes();
    loadColaboradores();
    loadMembros();
  }, []);

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

  const loadClientes = async () => {
    setLoading(true);
    try {
      const clientesResult = await clientesAPI.getAll(null, false);
      if (clientesResult.success && clientesResult.data && Array.isArray(clientesResult.data)) {
        const clientesComDados = clientesResult.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`
        }));
        setClientes(clientesComDados);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      showToast('error', 'Erro ao carregar clientes');
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

  // Atualizar cache de nomes quando clientes ou colaboradores forem carregados
  useEffect(() => {
    if (clientes.length > 0 || colaboradores.length > 0) {
      const novosNomes = { ...nomesCache };
      
      // Atualizar cache de clientes
      clientes.forEach(cliente => {
        novosNomes.clientes[String(cliente.id)] = cliente.nome;
      });
      
      // Atualizar cache de colaboradores
      colaboradores.forEach(colab => {
        novosNomes.colaboradores[String(colab.id)] = colab.cpf ? `${colab.nome} (${colab.cpf})` : colab.nome;
      });
      
      setNomesCache(novosNomes);
    }
  }, [clientes, colaboradores]);

  // Handlers do modal
  const handleNewAtribuicao = () => {
    setEditingAgrupamento(null);
    setShowModal(true);
  };

  const handleCloseModal = (saved = false) => {
    setShowModal(false);
    setEditingAgrupamento(null);
    if (saved && filtrosAplicados) {
      loadRegistrosTempoEstimado(filtros);
    }
  };

  const handleEditAtribuicao = (agrupamento) => {
    setEditingAgrupamento(agrupamento);
    setShowModal(true);
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
      const params = new URLSearchParams({
        membro_id: responsavelId
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
          return result.data.horascontratadasdia || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar horas contratadas por responsável:', error);
      return null;
    }
  };

  // Carregar horas contratadas para todos os responsáveis
  const carregarHorasContratadasPorResponsaveis = async (agrupamentos, dataInicio, dataFim) => {
    const responsaveisIds = new Set();
    agrupamentos.forEach(agrupamento => {
      const primeiroRegistro = agrupamento.primeiroRegistro;
      if (primeiroRegistro.responsavel_id) {
        responsaveisIds.add(String(primeiroRegistro.responsavel_id));
      }
    });

    const novasHoras = { ...horasContratadasPorResponsavel };
    
    for (const responsavelId of responsaveisIds) {
      if (!novasHoras[responsavelId]) {
        const horasContratadas = await buscarHorasContratadasPorResponsavel(responsavelId, dataInicio, dataFim);
        novasHoras[responsavelId] = horasContratadas;
      }
    }
    
    setHorasContratadasPorResponsavel(novasHoras);
  };

  // Carregar registros de tempo estimado
  const loadRegistrosTempoEstimado = useCallback(async (filtrosParaAplicar = null, periodoParaAplicar = null, valoresSelecionados = null) => {
    setLoading(true);
    try {
      const filtrosAUsar = filtrosParaAplicar !== null ? filtrosParaAplicar : filtros;
      const periodoAUsar = periodoParaAplicar !== null ? periodoParaAplicar : { inicio: periodoInicio, fim: periodoFim };
      
      // Usar valores selecionados passados como parâmetro, ou os estados atuais
      const valoresAUsar = valoresSelecionados || {
        cliente: filtroClienteSelecionado,
        produto: filtroProdutoSelecionado,
        tarefa: filtroTarefaSelecionado,
        responsavel: filtroResponsavelSelecionado
      };
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

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
        // Adicionar IDs de responsáveis selecionados se houver
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
        } else {
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
          // Agrupar registros por agrupador_id
          agruparRegistros(result.data || []);
          setTotalRegistros(result.total || 0);
          setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
          // Carregar nomes dos itens relacionados
          await carregarNomesRelacionados(result.data || []);
          
          // Carregar custos e horas contratadas para todos os responsáveis encontrados nos registros
          if (periodoAUsar.inicio && periodoAUsar.fim) {
            const agrupadosTemp = {};
            (result.data || []).forEach(registro => {
              const agrupadorId = registro.agrupador_id || 'sem-grupo';
              if (!agrupadosTemp[agrupadorId]) {
                agrupadosTemp[agrupadorId] = {
                  primeiroRegistro: registro,
                  quantidade: 0
                };
              }
              agrupadosTemp[agrupadorId].quantidade++;
            });
            
            const agrupamentosArray = Object.values(agrupadosTemp);
            await carregarCustosPorResponsaveis(agrupamentosArray, periodoAUsar.inicio, periodoAUsar.fim);
            await carregarHorasContratadasPorResponsaveis(agrupamentosArray, periodoAUsar.inicio, periodoAUsar.fim);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      showToast('error', 'Erro ao carregar registros de tempo estimado');
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

    const novosNomes = { ...nomesCache };

    // Carregar nomes de produtos
    if (produtosIds.size > 0) {
      try {
        const produtosArray = Array.from(produtosIds);
        for (const produtoId of produtosArray) {
          if (!novosNomes.produtos[produtoId]) {
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
    return nomesCache.produtos[String(produtoId)] || `Produto #${produtoId}`;
  };

  const getNomeTarefa = (tarefaId) => {
    return nomesCache.tarefas[String(tarefaId)] || `Tarefa #${tarefaId}`;
  };

  const getClienteLabel = (clienteId) => {
    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    return cliente ? cliente.nome : clienteId;
  };

  const getColaboradorLabel = (colaboradorId) => {
    const colaborador = colaboradores.find(c => String(c.id) === String(colaboradorId));
    if (colaborador) {
      return colaborador.cpf ? `${colaborador.nome} (${colaborador.cpf})` : colaborador.nome;
    }
    return colaboradorId;
  };

  const getNomeCliente = (clienteId) => {
    return nomesCache.clientes[String(clienteId)] || getClienteLabel(clienteId) || `Cliente #${clienteId}`;
  };

  const getNomeColaborador = (colabId) => {
    return nomesCache.colaboradores[String(colabId)] || getColaboradorLabel(colabId) || `Colaborador #${colabId}`;
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
    if (!milissegundos || milissegundos === 0) return '—';
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
    return '—';
  };

  // Buscar custo mais recente por responsável
  const buscarCustoPorResponsavel = async (responsavelId, dataInicio, dataFim) => {
    try {
      const params = new URLSearchParams({
        membro_id: responsavelId
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
    
    for (const responsavelId of responsaveisIds) {
      if (!novosCustos[responsavelId]) {
        const custoHora = await buscarCustoPorResponsavel(responsavelId, dataInicio, dataFim);
        novosCustos[responsavelId] = custoHora;
      }
    }
    
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

  // Calcular tempo disponível, realizado e sobrando para um responsável (usando os agrupamentos já filtrados)
  const calcularTempoDisponivelRealizadoSobrando = (responsavelId, agrupamentos) => {
    if (!periodoInicio || !periodoFim) return null;
    
    const inicio = new Date(periodoInicio);
    const fim = new Date(periodoFim);
    const diasNoPeriodo = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
    
    const horasContratadasDia = horasContratadasPorResponsavel[String(responsavelId)];
    if (!horasContratadasDia || horasContratadasDia <= 0) return null;
    
    const tempoDisponivelTotal = horasContratadasDia * diasNoPeriodo * 3600000; // converter horas para milissegundos
    
    // Tempo realizado baseado no total do agrupamento dentro do período (mesma lógica da tabela)
    const tempoRealizado = agrupamentos
      .filter((agr) => String(agr.primeiroRegistro.responsavel_id) === String(responsavelId))
      .reduce((acc, agr) => {
        const tempoEstimadoDia = agr.primeiroRegistro.tempo_estimado_dia || 0;
        const registrosNoPeriodo = agr.registros
          ? agr.registros.filter((reg) => dataEstaNoPeriodo(reg.data)).length
          : 0;
        const quantidade = registrosNoPeriodo > 0 ? registrosNoPeriodo : (agr.quantidade || 0);
        return acc + tempoEstimadoDia * quantidade;
      }, 0);
    
    const tempoSobrando = Math.max(0, tempoDisponivelTotal - tempoRealizado);
    
    return {
      disponivel: tempoDisponivelTotal,
      realizado: tempoRealizado,
      sobrando: tempoSobrando
    };
  };

  // Componente de barra de progresso de tempo
  const BarraProgressoTempo = ({ disponivel, realizado, sobrando, responsavelId }) => {
    if (!disponivel || disponivel === 0) return null;
    
    const percentualRealizado = (realizado / disponivel) * 100;
    const custoEstimado = calcularCustoPorTempo(realizado, responsavelId);
    
    return (
      <div className="barra-progresso-tempo">
        <div className="barra-progresso-tempo-header">
          <div className="barra-progresso-tempo-principal">
            <div className="barra-progresso-tempo-valor">{formatarTempoEstimado(realizado, true)}</div>
            {custoEstimado !== null && (
              <div className="barra-progresso-tempo-custo">
                {formatarValorMonetario(custoEstimado)}
              </div>
            )}
          </div>
        </div>
        <div className="barra-progresso-tempo-range">
          <div 
            className="barra-progresso-tempo-fill"
            style={{ width: `${Math.min(100, percentualRealizado)}%` }}
          ></div>
        </div>
        <div className="barra-progresso-tempo-legenda">
          <div className="barra-progresso-tempo-item">
            <div className="barra-progresso-tempo-item-content">
              <span className="barra-progresso-tempo-label">Contratadas</span>
              <span className="barra-progresso-tempo-badge contratadas">{formatarTempoEstimado(disponivel, true)}</span>
            </div>
          </div>
          <div className="barra-progresso-tempo-item">
            <div className="barra-progresso-tempo-item-content">
              <div className="barra-progresso-tempo-item-header">
                <span className="barra-progresso-tempo-indicador realizado"></span>
                <span className="barra-progresso-tempo-label">Estimado</span>
              </div>
              <span className="barra-progresso-tempo-badge estimado">{formatarTempoEstimado(realizado, true)}</span>
            </div>
          </div>
          <div className="barra-progresso-tempo-item">
            <div className="barra-progresso-tempo-item-content">
              <div className="barra-progresso-tempo-item-header">
                <span className="barra-progresso-tempo-indicador sobrando"></span>
                <span className="barra-progresso-tempo-label">Disponível</span>
              </div>
              <span className="barra-progresso-tempo-badge disponivel">{formatarTempoEstimado(sobrando, true)}</span>
            </div>
          </div>
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
      const temFiltroAtivo = filtros.produto || filtros.atividade || filtros.cliente || filtros.responsavel;
      const temPeriodoCompleto = periodoInicio && periodoFim;
      const temValoresSelecionados = filtroClienteSelecionado || filtroProdutoSelecionado || filtroTarefaSelecionado || filtroResponsavelSelecionado;
      return temFiltroAtivo || temPeriodoCompleto || temValoresSelecionados;
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
    
    const valoresMudaram = (
      JSON.stringify(filtroClienteSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroClienteSelecionado) ||
      JSON.stringify(filtroProdutoSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroProdutoSelecionado) ||
      JSON.stringify(filtroTarefaSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroTarefaSelecionado) ||
      JSON.stringify(filtroResponsavelSelecionado) !== JSON.stringify(filtrosUltimosAplicados.filtroResponsavelSelecionado)
    );
    
    return filtrosMudaram || periodoMudou || valoresMudaram;
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
      filtroClienteSelecionado,
      filtroProdutoSelecionado,
      filtroTarefaSelecionado,
      filtroResponsavelSelecionado
    });
    
    setCurrentPage(1);
    
    // Passar os valores selecionados diretamente para garantir que sejam usados
    const valoresSelecionados = {
      cliente: filtroClienteSelecionado,
      produto: filtroProdutoSelecionado,
      tarefa: filtroTarefaSelecionado,
      responsavel: filtroResponsavelSelecionado
    };
    
    
    loadRegistrosTempoEstimado(filtros, { inicio: periodoInicio, fim: periodoFim }, valoresSelecionados);
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

  // Não carregar automaticamente - apenas quando filtros forem aplicados
  useEffect(() => {
    if (filtrosAplicados) {
      loadRegistrosTempoEstimado(filtros);
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

  // Expandir todos os grupos quando há filtro principal e registros são carregados
  useEffect(() => {
    if (filtroPrincipal && registrosAgrupados.length > 0) {
      const novosGruposExpandidos = new Set();
      
      // Agrupar registros para determinar as chaves dos grupos
      const agrupados = {};
      registrosAgrupados.forEach(agrupamento => {
        const primeiroRegistro = agrupamento.primeiroRegistro;
        let chaveAgrupamento = null;
        
        if (filtroPrincipal === 'produto' && primeiroRegistro.produto_id) {
          chaveAgrupamento = `produto_${primeiroRegistro.produto_id}`;
        } else if (filtroPrincipal === 'atividade' && primeiroRegistro.tarefa_id) {
          chaveAgrupamento = `atividade_${primeiroRegistro.tarefa_id}`;
        } else if (filtroPrincipal === 'cliente' && primeiroRegistro.cliente_id) {
          chaveAgrupamento = `cliente_${primeiroRegistro.cliente_id}`;
        } else if (filtroPrincipal === 'responsavel' && primeiroRegistro.responsavel_id) {
          chaveAgrupamento = `responsavel_${primeiroRegistro.responsavel_id}`;
        }
        
        if (chaveAgrupamento && !agrupados[chaveAgrupamento]) {
          agrupados[chaveAgrupamento] = true;
        }
      });
      
      // Criar chaves para cada grupo único (usar a chave diretamente)
      Object.keys(agrupados).forEach((chave) => {
        novosGruposExpandidos.add(chave);
      });
      
      // Só atualizar se houver grupos e se ainda não estiverem expandidos
      if (novosGruposExpandidos.size > 0 && gruposExpandidos.size === 0) {
        setGruposExpandidos(novosGruposExpandidos);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPrincipal, registrosAgrupados.length]);

  // Calcular range de itens exibidos
  const startItem = totalRegistros === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + Math.min(itemsPerPage, registrosAgrupados.length) - 1, totalRegistros);

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="vinculacoes-listing-section">
            <div className="form-header">
              <h2 className="form-title">Atribuir Responsáveis</h2>
              <p className="form-subtitle">
                Defina quais colaboradores serão responsáveis por quais tarefas, em quais períodos e com qual tempo estimado diário.
              </p>
            </div>

            <div className="listing-controls">
              <div className="listing-controls-right">
                <ButtonPrimary
                  onClick={handleNewAtribuicao}
                  icon="fas fa-plus"
                  disabled={showModal}
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
                  subtitle="Filtrar por produtos"
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
                  subtitle="Filtrar por tarefas"
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
                  subtitle="Filtrar por clientes"
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
                  subtitle="Filtrar por responsáveis"
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
                  />
                </div>
                
                {/* Componentes de seleção para filtros pai */}
                {filtros.cliente && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Clientes:</label>
                    <FilterClientes
                      value={filtroClienteSelecionado}
                      onChange={(e) => setFiltroClienteSelecionado(e.target.value || null)}
                      options={clientes}
                      disabled={loading}
                    />
                  </div>
                )}
                
                {filtros.produto && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Produtos:</label>
                    <FilterGeneric
                      value={filtroProdutoSelecionado}
                      onChange={(e) => setFiltroProdutoSelecionado(e.target.value || null)}
                      options={produtos.map(p => ({ id: p.id, nome: p.nome }))}
                      disabled={loading || produtos.length === 0}
                      placeholder="Selecionar produtos"
                    />
                  </div>
                )}
                
                {filtros.atividade && (
                  <div className="filtro-pai-select-wrapper">
                    <label className="filtro-pai-label">Definir Tarefas:</label>
                    <FilterGeneric
                      value={filtroTarefaSelecionado}
                      onChange={(e) => setFiltroTarefaSelecionado(e.target.value || null)}
                      options={tarefas.map(t => ({ id: t.id, nome: t.nome }))}
                      disabled={loading || tarefas.length === 0}
                      placeholder="Selecionar tarefas"
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
                      options={membros}
                      disabled={loading || membros.length === 0}
                    />
                  </div>
                )}
              </div>
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
                {/* Seção de tempo disponível vs estimado por responsável */}
                {filtrosAplicados && periodoInicio && periodoFim && registrosAgrupados.length > 0 && (
                  <div className="tempo-disponivel-section">
                    <h3 className="tempo-disponivel-title">
                      <i className="fas fa-chart-line" style={{ marginRight: '8px' }}></i>
                      Tempo Disponível vs Estimado por Responsável
                    </h3>
                    <div className="tempo-disponivel-grid">
                      {(() => {
                        // Coletar todos os responsáveis únicos dos registros
                        const responsaveisUnicos = new Map();
                        registrosAgrupados.forEach(agrupamento => {
                          const primeiroRegistro = agrupamento.primeiroRegistro;
                          const responsavelId = primeiroRegistro.responsavel_id;
                          if (responsavelId) {
                            if (!responsaveisUnicos.has(String(responsavelId))) {
                              responsaveisUnicos.set(String(responsavelId), {
                                id: responsavelId,
                                nome: getNomeColaborador(responsavelId),
                                fotoPerfil: primeiroRegistro.responsavel_foto_perfil,
                                registros: []
                              });
                            }
                            // Adicionar todos os registros deste agrupamento
                            agrupamento.registros.forEach(registro => {
                              if (String(registro.responsavel_id) === String(responsavelId)) {
                                responsaveisUnicos.get(String(responsavelId)).registros.push({
                                  ...registro,
                                  quantidade: agrupamento.quantidade
                                });
                              }
                            });
                          }
                        });
                        
                        return Array.from(responsaveisUnicos.values()).map(responsavel => {
                          const tempoInfo = calcularTempoDisponivelRealizadoSobrando(
                            responsavel.id,
                            registrosAgrupados
                          );
                          
                          if (!tempoInfo) return null;
                          
                          return (
                            <div key={responsavel.id} className="tempo-disponivel-card">
                              <div className="tempo-disponivel-card-header">
                                <div className="tempo-disponivel-card-nome-wrapper">
                                  {responsavel.fotoPerfil ? (
                                    <Avatar
                                      avatarId={responsavel.fotoPerfil}
                                      nomeUsuario={responsavel.nome}
                                      size="tiny"
                                    />
                                  ) : (
                                    <div className="tempo-disponivel-card-avatar-placeholder"></div>
                                  )}
                                  <span className="tempo-disponivel-card-nome">{responsavel.nome}</span>
                                </div>
                              </div>
                              <div className="tempo-disponivel-card-content">
                                <BarraProgressoTempo
                                  disponivel={tempoInfo.disponivel}
                                  realizado={tempoInfo.realizado}
                                  sobrando={tempoInfo.sobrando}
                                  responsavelId={responsavel.id}
                                />
                              </div>
                            </div>
                          );
                        }).filter(Boolean);
                      })()}
                    </div>
                  </div>
                )}
                
                {(() => {
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
                      const tempoTotal = calcularTempoTotalGrupoFiltrado(grupo.agrupamentos);
                      const tempoTotalFormatado = formatarTempoEstimado(tempoTotal, true);
                      
                      // Calcular custo estimado total para qualquer filtro principal
                      const custoEstimadoTotal = calcularCustoEstimadoTotal(grupo.agrupamentos);
                      
                      return (
                        <div key={chaveAgrupamento} className="atribuicoes-group">
                          <div 
                            className="atribuicoes-group-header"
                            onClick={() => toggleGrupo(grupoKey)}
                          >
                            <div className="atribuicoes-group-header-left">
                              <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                              <span className={`atribuicoes-group-badge ${['produto', 'atividade', 'cliente', 'responsavel'].includes(grupo.tipo) ? 'atribuicoes-group-badge-orange' : ''}`}>
                                {grupo.tipo === 'atividade' ? 'TAREFAS AGRUPADAS' : grupo.tipo.toUpperCase()}
                              </span>
                              <h3 className="atribuicoes-group-title">
                                {grupo.tipo === 'responsavel' && grupo.fotoPerfil ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar
                                      avatarId={grupo.fotoPerfil}
                                      nomeUsuario={grupo.nome}
                                      size="tiny"
                                    />
                                    <span>{grupo.nome}</span>
                                  </div>
                                ) : (
                                  grupo.nome
                                )}
                              </h3>
                              {tempoTotal > 0 && (
                                <span className="atribuicoes-group-tempo-total" title={`${(tempoTotal / 3600000).toFixed(2)}h`}>
                                  {tempoTotalFormatado}
                                </span>
                              )}
                              {custoEstimadoTotal !== null && (
                                <span className="atribuicoes-group-custo-total" title="Custo estimado total">
                                  {formatarValorMonetario(custoEstimadoTotal)}
                                </span>
                              )}
                              <span className="atribuicoes-group-count">{totalItens}</span>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="atribuicoes-group-content">
                              <table className="atribuicoes-table">
                                <thead>
                                  <tr>
                                    {filtroPrincipal === 'atividade' && <th></th>}
                                    {filtroPrincipal !== 'atividade' && <th>Tarefas Agrupadas</th>}
                                    {filtroPrincipal !== 'produto' && <th>Produto</th>}
                                    {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                    {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                    <th>Tempo Estimado Total</th>
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
                                    const isAgrupamentoTarefasExpanded = agrupamentosTarefasExpandidas.has(agrupamento.agrupador_id);
                                    
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
                                            <td>
                                              {tarefasUnicas.map((tarefaId, idx) => {
                                                const tarefaKey = `${agrupamento.agrupador_id}_${tarefaId}`;
                                                const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
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
                                              >
                                                {getNomeTarefa(tarefaId)}
                                                <i className={`fas fa-chevron-${isTarefaExpanded ? 'down' : 'right'}`} style={{ marginLeft: '6px', fontSize: '10px' }}></i>
                                              </button>
                                                );
                                              })}
                                            </td>
                                          )}
                                          {filtroPrincipal !== 'produto' && (
                                            <td>
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
                                            <span className="atribuicoes-tempo">
                                              {formatarTempoComCusto(tempoEstimadoTotal, primeiroRegistro.responsavel_id, true)}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="atribuicoes-periodo">
                                              {formatarPeriodo(agrupamento.dataInicio, agrupamento.dataFim)}
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
                                                    
                                                    return (
                                                      <div key={tarefaId} className="atribuicoes-tarefa-item">
                                                        <div className="atribuicoes-tarefa-nome" style={{ marginBottom: '8px', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>
                                                          {getNomeTarefa(tarefaId)}
                                                        </div>
                                                        <table className="atribuicoes-detalhes-table">
                                                          <thead>
                                                            <tr>
                                                              <th>Data</th>
                                                              {filtroPrincipal !== 'produto' && <th>Produto</th>}
                                                              {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                                              {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                                              <th>Tempo Estimado (dia)</th>
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
                                                                    {formatarTempoComCusto(registro.tempo_estimado_dia || 0, registro.responsavel_id)}
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
                                          
                                          return (
                                            <tr key={`detalhes_${tarefaKey}`} className="atribuicoes-tarefa-detalhes">
                                              <td colSpan={7 - (filtroPrincipal === 'atividade' ? 1 : 0) - (filtroPrincipal === 'produto' ? 1 : 0) - (filtroPrincipal === 'cliente' ? 1 : 0) - (filtroPrincipal === 'responsavel' ? 1 : 0)} className="atribuicoes-tarefa-detalhes-cell">
                                                <div className="atribuicoes-tarefa-detalhes-content">
                                                  <div className="atribuicoes-tarefa-detalhes-header">
                                                    <h4>{getNomeTarefa(tarefaId)} - Detalhes</h4>
                                                    <span className="atribuicoes-tarefa-detalhes-count">
                                                      {registrosTarefa.length} registro(s)
                                                    </span>
                                                  </div>
                                                  <table className="atribuicoes-detalhes-table">
                                                    <thead>
                                                      <tr>
                                                        <th>Data</th>
                                                        {filtroPrincipal !== 'produto' && <th>Produto</th>}
                                                        {filtroPrincipal !== 'cliente' && <th>Cliente</th>}
                                                        {filtroPrincipal !== 'responsavel' && <th className="atribuicoes-col-responsavel">Responsável</th>}
                                                        <th>Tempo Estimado (dia)</th>
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
                                                              {formatarTempoComCusto(registro.tempo_estimado_dia || 0, registro.responsavel_id)}
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
              </div>
            )}

            {/* Controles de Paginação */}
            {totalRegistros > 0 && (
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
                    <option value="50">50 itens</option>
                  </select>
                </div>
                
                <div className="pagination-info">
                  <span>
                    Mostrando {startItem} a {endItem} de {totalRegistros} atribuições
                  </span>
                </div>
                
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn" 
                    title="Primeira página"
                    disabled={currentPage === 1 || loading}
                    onClick={() => setCurrentPage(1)}
                  >
                    <i className="fas fa-angle-double-left"></i>
                  </button>
                  <button 
                    className="pagination-btn" 
                    title="Página anterior"
                    disabled={currentPage === 1 || loading}
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
                    disabled={currentPage === totalPages || totalPages === 0 || loading}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <i className="fas fa-angle-right"></i>
                  </button>
                  <button 
                    className="pagination-btn" 
                    title="Última página"
                    disabled={currentPage === totalPages || totalPages === 0 || loading}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <i className="fas fa-angle-double-right"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <AtribuicaoModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editingAgrupamento={editingAgrupamento}
      />

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
    </Layout>
  );
};

export default DelegarTarefas;
