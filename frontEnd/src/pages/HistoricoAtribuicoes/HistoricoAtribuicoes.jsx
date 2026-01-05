import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import FiltersCard from '../../components/filters/FiltersCard';
import FilterMembro from '../../components/filters/FilterMembro';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import SelectedItemsList from '../../components/vinculacoes/SelectedItemsList';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import ToggleSwitch from '../../components/common/ToggleSwitch';
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

  // Estado do modal de edição
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState({
    cliente_id: null,
    responsavel_id: null,
    data_inicio: '',
    data_fim: '',
    produto_ids: [],
    tarefas: []
  });
  const [salvando, setSalvando] = useState(false);
  const [todosProdutos, setTodosProdutos] = useState([]);
  const [todasTarefas, setTodasTarefas] = useState([]);

  // Estados para modo "Selecionar vários"
  const [modoSelecionarVarios, setModoSelecionarVarios] = useState(false);
  const [tempoGlobalParaAplicar, setTempoGlobalParaAplicar] = useState(0);
  const [tarefasSelecionadasParaTempo, setTarefasSelecionadasParaTempo] = useState(new Set());
  const [horasContratadasDia, setHorasContratadasDia] = useState(null);

  // Refs para sincronizar scroll horizontal
  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const scrollHandlersRef = useRef({ tableScroll: null, topScroll: null });

  // Estado para modal de confirmação de exclusão
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemParaDeletar, setItemParaDeletar] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Estado para clientes no formato CustomSelect
  const [clientes, setClientes] = useState([]);

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

  // Carregar produtos e tarefas quando abrir modal de edição
  useEffect(() => {
    const carregarProdutosETarefas = async () => {
      if (!modalEdicaoAberto || !dadosEdicao.cliente_id || !itemEditando) return;

      try {
        // Carregar produtos do cliente
        const produtosResponse = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${dadosEdicao.cliente_id}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (produtosResponse.ok) {
          const result = await produtosResponse.json();
          if (result.success) {
            setTodosProdutos(result.data || []);
          }
        }

        // Carregar tarefas do cliente
        if (dadosEdicao.produto_ids && dadosEdicao.produto_ids.length > 0) {
          const produtoIdsNum = dadosEdicao.produto_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
          if (produtoIdsNum.length > 0) {
            const tarefasResponse = await fetch(
              `${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${dadosEdicao.cliente_id}&produtoIds=${produtoIdsNum.join(',')}`,
              {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              }
            );
            if (tarefasResponse.ok) {
              const result = await tarefasResponse.json();
              if (result.success && result.data) {
                const todasTarefas = [];
                const tarefasIds = new Set();
                
                result.data.forEach(item => {
                  (item.tarefas || []).forEach(tarefa => {
                    if (!tarefasIds.has(tarefa.id)) {
                      tarefasIds.add(tarefa.id);
                      todasTarefas.push(tarefa);
                    }
                  });
                });
                
                setTodasTarefas(todasTarefas);
                
                // Garantir que todas as tarefas disponíveis tenham objetos de tarefa
                // Priorizar tempos originais do itemEditando, depois tempos atuais, depois 0
                setDadosEdicao(prev => {
                  // Mapa com tempos originais do itemEditando (fonte de verdade)
                  const temposOriginaisMap = new Map();
                  if (itemEditando && itemEditando.tarefas) {
                    itemEditando.tarefas.forEach(t => {
                      temposOriginaisMap.set(String(t.tarefa_id), t.tempo_estimado_dia);
                    });
                  }
                  
                  // Mapa com tempos atuais (caso o usuário já tenha editado)
                  const temposAtuaisMap = new Map();
                  (prev.tarefas || []).forEach(t => {
                    temposAtuaisMap.set(String(t.tarefa_id), t.tempo_estimado_dia);
                  });
                  
                  // Criar array de tarefas com todos os IDs disponíveis
                  // Prioridade: tempos originais > tempos atuais > 0
                  const novasTarefas = todasTarefas.map(tarefa => {
                    const tarefaIdStr = String(tarefa.id);
                    // Se tem tempo original, usar ele
                    if (temposOriginaisMap.has(tarefaIdStr)) {
                      return {
                        tarefa_id: tarefaIdStr,
                        tempo_estimado_dia: temposOriginaisMap.get(tarefaIdStr)
                      };
                    }
                    // Se tem tempo atual, usar ele
                    if (temposAtuaisMap.has(tarefaIdStr)) {
                      return {
                        tarefa_id: tarefaIdStr,
                        tempo_estimado_dia: temposAtuaisMap.get(tarefaIdStr)
                      };
                    }
                    // Senão, tempo 0
                    return {
                      tarefa_id: tarefaIdStr,
                      tempo_estimado_dia: 0
                    };
                  });
                  
                  return { ...prev, tarefas: novasTarefas };
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar produtos e tarefas:', error);
      }
    };

    carregarProdutosETarefas();
  }, [modalEdicaoAberto, dadosEdicao.cliente_id, dadosEdicao.produto_ids, itemEditando]);

  // Buscar horas contratadas quando o responsável mudar
  useEffect(() => {
    const buscarHorasContratadas = async () => {
      if (!dadosEdicao.responsavel_id || !dadosEdicao.data_inicio || !dadosEdicao.data_fim) {
        setHorasContratadasDia(null);
        return;
      }

      try {
        const hoje = new Date().toISOString().split('T')[0];
        const params = new URLSearchParams({
          membro_id: String(dadosEdicao.responsavel_id),
          data_inicio: hoje,
          data_fim: hoje
        });

        const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/horas-contratadas?${params}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data !== null && result.data !== undefined) {
            const horas = result.data.horascontratadasdia || result.data;
            setHorasContratadasDia(horas);
          } else {
            setHorasContratadasDia(null);
          }
        } else {
          setHorasContratadasDia(null);
        }
      } catch (error) {
        console.error('Erro ao buscar horas contratadas:', error);
        setHorasContratadasDia(null);
      }
    };

    if (modalEdicaoAberto) {
      buscarHorasContratadas();
    }
  }, [modalEdicaoAberto, dadosEdicao.responsavel_id, dadosEdicao.data_inicio, dadosEdicao.data_fim]);

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

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

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

  // Funções auxiliares para produtos
  const getProdutoOptions = useMemo(() => {
    if (!todosProdutos || todosProdutos.length === 0) {
      return [];
    }
    return todosProdutos.map(p => ({ 
      value: String(p.id), 
      label: p.nome || `Produto #${p.id}` 
    }));
  }, [todosProdutos]);

  const getProdutoLabel = (produtoId) => {
    const produto = todosProdutos.find(p => String(p.id) === String(produtoId));
    return produto ? produto.nome : produtoId;
  };

  // Handler para toggle de produto (múltipla seleção)
  const handleProdutoToggle = useCallback((produtoId, isSelected) => {
    const produtoIdNum = parseInt(produtoId, 10);
    if (isNaN(produtoIdNum)) return;
    
    setDadosEdicao(prev => {
      const produtosAtuais = prev.produto_ids || [];
      let novosProdutos;
      
      if (isSelected) {
        // Adicionar produto
        if (!produtosAtuais.includes(produtoIdNum)) {
          novosProdutos = [...produtosAtuais, produtoIdNum];
        } else {
          return prev; // Já está selecionado
        }
      } else {
        // Remover produto
        novosProdutos = produtosAtuais.filter(id => id !== produtoIdNum);
      }
      
      // Disparar carregamento de tarefas de forma assíncrona
      setTimeout(() => {
        handleProdutoChange(novosProdutos);
      }, 0);
      
      return { ...prev, produto_ids: novosProdutos };
    });
  }, []);

  // Função centralizada para mudança de produtos
  const handleProdutoChange = async (novosProdutos) => {
    const produtosAnteriores = dadosEdicao.produto_ids || [];
    
    // Verificar se os produtos selecionados são os mesmos (apenas ordem diferente)
    const produtosAnterioresSet = new Set(produtosAnteriores.map(String));
    const selecionadosSet = new Set(novosProdutos.map(String));
    const saoIguais = produtosAnterioresSet.size === selecionadosSet.size && 
                     [...selecionadosSet].every(id => produtosAnterioresSet.has(String(id)));
    
    // Se os produtos são os mesmos, apenas atualizar a ordem, sem recarregar tarefas
    if (saoIguais) {
      setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos }));
      return;
    }
    
    // Carregar tarefas quando produtos mudarem
    if (dadosEdicao.cliente_id && novosProdutos.length > 0) {
      try {
        const produtoIdsNum = novosProdutos.filter(id => !isNaN(id) && id > 0);
        if (produtoIdsNum.length > 0) {
          const response = await fetch(
            `${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${dadosEdicao.cliente_id}&produtoIds=${produtoIdsNum.join(',')}`,
            {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            }
          );
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const todasTarefas = [];
              const tarefasIds = new Set();
              
              result.data.forEach(item => {
                (item.tarefas || []).forEach(tarefa => {
                  if (!tarefasIds.has(tarefa.id)) {
                    tarefasIds.add(tarefa.id);
                    todasTarefas.push(tarefa);
                  }
                });
              });
              
              setTodasTarefas(todasTarefas);
              
              // Criar objetos de tarefa para todas as tarefas disponíveis
              // Priorizar tempos originais do itemEditando, depois tempos atuais, depois 0
              setDadosEdicao(prev => {
                // Mapa com tempos originais do itemEditando (fonte de verdade)
                const temposOriginaisMap = new Map();
                if (itemEditando && itemEditando.tarefas) {
                  itemEditando.tarefas.forEach(t => {
                    temposOriginaisMap.set(String(t.tarefa_id), t.tempo_estimado_dia);
                  });
                }
                
                // Mapa com tempos atuais (caso o usuário já tenha editado)
                const temposAtuaisMap = new Map();
                (prev.tarefas || []).forEach(t => {
                  temposAtuaisMap.set(String(t.tarefa_id), t.tempo_estimado_dia);
                });
                
                // Criar array de tarefas com todos os IDs disponíveis
                // Prioridade: tempos originais > tempos atuais > 0
                const novasTarefas = todasTarefas.map(tarefa => {
                  const tarefaIdStr = String(tarefa.id);
                  // Se tem tempo original, usar ele
                  if (temposOriginaisMap.has(tarefaIdStr)) {
                    return {
                      tarefa_id: tarefaIdStr,
                      tempo_estimado_dia: temposOriginaisMap.get(tarefaIdStr)
                    };
                  }
                  // Se tem tempo atual, usar ele
                  if (temposAtuaisMap.has(tarefaIdStr)) {
                    return {
                      tarefa_id: tarefaIdStr,
                      tempo_estimado_dia: temposAtuaisMap.get(tarefaIdStr)
                    };
                  }
                  // Senão, tempo 0
                  return {
                    tarefa_id: tarefaIdStr,
                    tempo_estimado_dia: 0
                  };
                });
                
                return { ...prev, produto_ids: novosProdutos, tarefas: novasTarefas };
              });
            } else {
              // Se não houver tarefas, limpar
              setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos, tarefas: [] }));
              setTodasTarefas([]);
            }
          } else {
            setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos }));
            setTodasTarefas([]);
          }
        } else {
          setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos, tarefas: [] }));
          setTodasTarefas([]);
        }
      } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos }));
        setTodasTarefas([]);
      }
    } else {
      // Se não houver cliente ou produtos selecionados, limpar tarefas
      setDadosEdicao(prev => ({ ...prev, produto_ids: novosProdutos, tarefas: [] }));
      setTodasTarefas([]);
    }
  };

  const handleProdutoRemove = (produtoId) => {
    const produtoIdNum = parseInt(produtoId, 10);
    if (isNaN(produtoIdNum)) return;
    handleProdutoChange((dadosEdicao.produto_ids || []).filter(id => id !== produtoIdNum));
  };

  const handleSelectAllProdutos = () => {
    const allProdutoIds = todosProdutos.map(p => parseInt(p.id, 10)).filter(id => !isNaN(id));
    const allSelected = allProdutoIds.every(id => (dadosEdicao.produto_ids || []).includes(id));
    
    if (allSelected) {
      handleProdutoChange([]);
    } else {
      handleProdutoChange(allProdutoIds);
    }
  };

  // Abrir modal de edição
  const abrirModalEdicao = (item) => {
    setItemEditando(item);
    setDadosEdicao({
      cliente_id: item.cliente_id,
      responsavel_id: item.responsavel_id,
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
      produto_ids: item.produto_ids || [],
      tarefas: item.tarefas || []
    });
    // Resetar estados do modo "Selecionar vários"
    setModoSelecionarVarios(false);
    setTempoGlobalParaAplicar(0);
    setTarefasSelecionadasParaTempo(new Set());
    setModalEdicaoAberto(true);
  };

  // Fechar modal de edição
  const fecharModalEdicao = () => {
    setModalEdicaoAberto(false);
    setItemEditando(null);
    setDadosEdicao({
      cliente_id: null,
      responsavel_id: null,
      data_inicio: '',
      data_fim: '',
      produto_ids: [],
      tarefas: []
    });
  };

  // Atualizar histórico
  const handleAtualizarHistorico = async () => {
    if (!itemEditando) return;

    setSalvando(true);
    try {
      // Preparar tarefas com tempos (considerando modo "Selecionar vários")
      const tarefasComTempo = dadosEdicao.tarefas.map(tarefa => {
        let tempo = tarefa.tempo_estimado_dia || 0;
        
        // Se está no modo "Selecionar vários" e a tarefa está selecionada, usar tempo global
        if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(String(tarefa.tarefa_id)) && tempoGlobalParaAplicar > 0) {
          tempo = tempoGlobalParaAplicar;
        }
        
        return {
          tarefa_id: String(tarefa.tarefa_id).trim(),
          tempo_estimado_dia: Math.round(Number(tempo))
        };
      });

      const dadosParaSalvar = {
        ...dadosEdicao,
        tarefas: tarefasComTempo
      };

      console.log('📤 Atualizando histórico:', itemEditando.id, dadosParaSalvar);
      
      const response = await fetch(`${API_BASE_URL}/historico-atribuicoes/${itemEditando.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(dadosParaSalvar)
      });

      console.log('📥 Resposta recebida:', response.status, response.statusText);

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          // Se não for JSON, usar o texto
          if (errorText && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        showToast('error', errorMessage);
        return;
      }

      const result = await response.json();
      console.log('✅ Resultado:', result);

      if (result.success) {
        showToast('success', 'Atribuição atualizada com sucesso!');
        fecharModalEdicao();
        carregarHistorico(); // Recarregar lista
      } else {
        showToast('error', result.error || 'Erro ao atualizar atribuição');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar histórico:', error);
      showToast('error', `Erro ao atualizar atribuição: ${error.message}`);
    } finally {
      setSalvando(false);
    }
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
                        {historico.map((item) => (
                          <tr key={item.id}>
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
                                  onClick={() => abrirModalEdicao(item)}
                                  title="Editar atribuição"
                                />
                                <DeleteButton
                                  onClick={() => handleAbrirModalDeletar(item)}
                                  title="Deletar atribuição"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
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

          {/* Modal de Edição */}
          {modalEdicaoAberto && (
            <div className="modal-overlay" onClick={fecharModalEdicao}>
              <div className="modal-content" style={{ 
                maxWidth: '1000px', 
                width: '95%', 
                maxHeight: '95vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
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
                      Editar Atribuição
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={fecharModalEdicao}
                    disabled={salvando}
                    title="Fechar (ESC)"
                    style={{ fontSize: '18px' }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="modal-body" style={{ 
                  padding: '20px 24px', 
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  minHeight: 0
                }}>
                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                      Cliente
                    </label>
                    <div className="select-wrapper">
                      <CustomSelect
                        value={dadosEdicao.cliente_id ? String(dadosEdicao.cliente_id) : ''}
                        options={clienteOptions}
                        onChange={async (e) => {
                          console.log('🔄 Cliente selecionado:', e.target.value);
                          const novoClienteId = e.target.value || null;
                          setDadosEdicao(prev => ({ ...prev, cliente_id: novoClienteId, produto_ids: [], tarefas: [] }));
                          setTodasTarefas([]);
                          if (novoClienteId) {
                            // Carregar produtos do novo cliente
                            try {
                              const response = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${novoClienteId}`, {
                                credentials: 'include',
                                headers: { 'Accept': 'application/json' }
                              });
                              if (response.ok) {
                                const result = await response.json();
                                if (result.success) {
                                  setTodosProdutos(result.data || []);
                                }
                              }
                            } catch (error) {
                              console.error('Erro ao carregar produtos:', error);
                            }
                          } else {
                            setTodosProdutos([]);
                          }
                        }}
                        placeholder="Selecione um cliente"
                        disabled={salvando}
                        keepOpen={false}
                        selectedItems={dadosEdicao.cliente_id ? [String(dadosEdicao.cliente_id)] : []}
                        hideCheckboxes={true}
                        maxVisibleOptions={5}
                        enableSearch={true}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                      Responsável
                    </label>
                    <FilterMembro
                      value={dadosEdicao.responsavel_id}
                      onChange={(e) => setDadosEdicao(prev => ({ ...prev, responsavel_id: e.target.value || null }))}
                      options={todosColaboradores}
                      disabled={salvando}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <FilterPeriodo
                      dataInicio={dadosEdicao.data_inicio}
                      dataFim={dadosEdicao.data_fim}
                      onInicioChange={(e) => setDadosEdicao(prev => ({ ...prev, data_inicio: e.target.value }))}
                      onFimChange={(e) => setDadosEdicao(prev => ({ ...prev, data_fim: e.target.value }))}
                      disabled={salvando}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                      Produtos
                    </label>
                    <div className="select-wrapper">
                      <CustomSelect
                        value=""
                        options={getProdutoOptions}
                        placeholder="Selecione produtos"
                        disabled={salvando || !dadosEdicao.cliente_id || todosProdutos.length === 0}
                        keepOpen={true}
                        selectedItems={dadosEdicao.produto_ids.map(id => String(id))}
                        onToggleItem={handleProdutoToggle}
                        onSelectAll={handleSelectAllProdutos}
                        hideCheckboxes={false}
                        maxVisibleOptions={5}
                        enableSearch={true}
                      />
                    </div>
                    {dadosEdicao.produto_ids && dadosEdicao.produto_ids.length > 0 && (
                      <SelectedItemsList
                        items={dadosEdicao.produto_ids.map(String)}
                        getItemLabel={getProdutoLabel}
                        onRemoveItem={handleProdutoRemove}
                        canRemove={true}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                      />
                    )}
                    {todosProdutos.length === 0 && dadosEdicao.cliente_id && !salvando && (
                      <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                        <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                        Este cliente não possui produtos vinculados
                      </p>
                    )}
                  </div>

                  {/* Seção: Tarefas */}
                  {dadosEdicao.cliente_id && dadosEdicao.produto_ids && dadosEdicao.produto_ids.length > 0 && (
                    <div className="atribuicao-form-section atribuicao-tarefas-section" style={{ marginTop: '18px', marginBottom: '18px' }}>
                      <h3 className="atribuicao-form-section-title" style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                        <i className="fas fa-tasks"></i>
                        Tarefas e Tempo Estimado
                        {horasContratadasDia && (
                          <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>
                            (Total disponível: {horasContratadasDia}h/dia)
                          </span>
                        )}
                      </h3>
                      
                      <div>
                        {/* Toggle e campo de tempo para selecionar vários */}
                        <div style={{ 
                          marginBottom: '16px', 
                          padding: '12px', 
                          background: '#f8f9fa', 
                          borderRadius: '6px', 
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          flexWrap: 'nowrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>Selecionar vários</span>
                            <ToggleSwitch
                              checked={modoSelecionarVarios}
                              onChange={setModoSelecionarVarios}
                              leftLabel=""
                              rightLabel=""
                              disabled={salvando || !dadosEdicao.responsavel_id || !dadosEdicao.data_inicio || !dadosEdicao.data_fim}
                            />
                          </div>
                          {modoSelecionarVarios && (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              flex: '0 0 auto'
                            }}>
                              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Tempo:</span>
                              <div 
                                className="tempo-input-wrapper"
                                style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '6px 12px',
                                  background: '#ffffff',
                                  border: '2px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <input
                                  type="number"
                                  value={Math.floor(tempoGlobalParaAplicar / (1000 * 60 * 60)) || ''}
                                  onChange={(e) => {
                                    const horas = parseFloat(e.target.value) || 0;
                                    const minutos = Math.floor((tempoGlobalParaAplicar % (1000 * 60 * 60)) / (1000 * 60)) || 0;
                                    setTempoGlobalParaAplicar(Math.round((horas * 60 * 60 + minutos * 60) * 1000));
                                  }}
                                  disabled={salvando || !dadosEdicao.responsavel_id || !dadosEdicao.data_inicio || !dadosEdicao.data_fim}
                                  placeholder="0"
                                  min="0"
                                  style={{
                                    width: '32px',
                                    padding: '0',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '11px',
                                    textAlign: 'center',
                                    color: '#334155',
                                    fontWeight: '500'
                                  }}
                                />
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '500' }}>h</span>
                                <input
                                  type="number"
                                  value={Math.floor((tempoGlobalParaAplicar % (1000 * 60 * 60)) / (1000 * 60)) || ''}
                                  onChange={(e) => {
                                    const minutos = parseFloat(e.target.value) || 0;
                                    const horas = Math.floor(tempoGlobalParaAplicar / (1000 * 60 * 60)) || 0;
                                    setTempoGlobalParaAplicar(Math.round((horas * 60 * 60 + minutos * 60) * 1000));
                                  }}
                                  disabled={salvando || !dadosEdicao.responsavel_id || !dadosEdicao.data_inicio || !dadosEdicao.data_fim}
                                  placeholder="0"
                                  min="0"
                                  max="59"
                                  style={{
                                    width: '32px',
                                    padding: '0',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '11px',
                                    textAlign: 'center',
                                    color: '#334155',
                                    fontWeight: '500'
                                  }}
                                />
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '500' }}>min</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lista de tarefas */}
                        <div className="selected-items-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                        {todasTarefas.length > 0 ? (
                          todasTarefas.map(tarefa => {
                            const tarefaId = String(tarefa.id);
                            const tarefaComTempo = dadosEdicao.tarefas.find(t => String(t.tarefa_id) === tarefaId);
                            const isSelecionadaParaTempo = tarefasSelecionadasParaTempo.has(tarefaId);
                            const tempoTarefa = (modoSelecionarVarios && isSelecionadaParaTempo) 
                              ? tempoGlobalParaAplicar 
                              : (tarefaComTempo?.tempo_estimado_dia || 0);
                            
                            return (
                              <div 
                                key={tarefaId}
                                className="selected-item-tag"
                                style={{
                                  opacity: 1,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  flexWrap: 'nowrap',
                                  whiteSpace: 'nowrap',
                                  width: '100%',
                                  justifyContent: 'space-between'
                                }}
                                onClick={(e) => {
                                  if (e.target.tagName === 'INPUT' || 
                                      e.target.tagName === 'BUTTON' || 
                                      e.target.closest('.tempo-input-wrapper') ||
                                      e.target.closest('.btn-remove-tag')) {
                                    return;
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: 0 }}>
                                  {modoSelecionarVarios && (
                                    <input
                                      type="checkbox"
                                      checked={isSelecionadaParaTempo}
                                      onChange={(e) => {
                                        const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
                                        if (e.target.checked) {
                                          novasSelecionadas.add(tarefaId);
                                        } else {
                                          novasSelecionadas.delete(tarefaId);
                                        }
                                        setTarefasSelecionadasParaTempo(novasSelecionadas);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        width: '14px',
                                        height: '14px',
                                        accentColor: '#ffffff'
                                      }}
                                      disabled={salvando || !dadosEdicao.responsavel_id || !dadosEdicao.data_inicio || !dadosEdicao.data_fim}
                                    />
                                  )}
                                  <span style={{ flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {tarefa.nome || nomesTarefas[tarefaId] || `Tarefa #${tarefaId}`}
                                  </span>
                                </div>
                                {(!modoSelecionarVarios || !isSelecionadaParaTempo) && (
                                  <div 
                                    className="tempo-input-wrapper"
                                    style={{ 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '4px 10px',
                                      background: 'rgba(255, 255, 255, 0.2)',
                                      border: '2px solid rgba(255, 255, 255, 0.3)',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      margin: 0,
                                      transition: 'all 0.2s ease',
                                      flexShrink: 0
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                  <input
                                    type="number"
                                    value={Math.floor(tempoTarefa / (1000 * 60 * 60)) || ''}
                                    onChange={(e) => {
                                      const horas = parseInt(e.target.value, 10) || 0;
                                      const minutos = Math.floor((tempoTarefa % (1000 * 60 * 60)) / (1000 * 60));
                                      const novoTempo = horas * 60 * 60 * 1000 + minutos * 60 * 1000;
                                      
                                      setDadosEdicao(prev => {
                                        const novasTarefas = [...prev.tarefas];
                                        const idx = novasTarefas.findIndex(t => String(t.tarefa_id) === tarefaId);
                                        
                                        if (idx >= 0) {
                                          novasTarefas[idx] = { ...novasTarefas[idx], tempo_estimado_dia: novoTempo };
                                        } else {
                                          novasTarefas.push({ tarefa_id: tarefaId, tempo_estimado_dia: novoTempo });
                                        }
                                        
                                        return { ...prev, tarefas: novasTarefas };
                                      });
                                    }}
                                    disabled={salvando}
                                    placeholder="0"
                                    min="0"
                                    style={{
                                      width: '28px',
                                      padding: '0',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: '11px',
                                      textAlign: 'center',
                                      color: '#ffffff',
                                      fontWeight: '500'
                                    }}
                                  />
                                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>h</span>
                                  <input
                                    type="number"
                                    value={Math.floor((tempoTarefa % (1000 * 60 * 60)) / (1000 * 60)) || ''}
                                    onChange={(e) => {
                                      const minutos = parseInt(e.target.value, 10) || 0;
                                      const horas = Math.floor(tempoTarefa / (1000 * 60 * 60));
                                      const novoTempo = horas * 60 * 60 * 1000 + minutos * 60 * 1000;
                                      
                                      setDadosEdicao(prev => {
                                        const novasTarefas = [...prev.tarefas];
                                        const idx = novasTarefas.findIndex(t => String(t.tarefa_id) === tarefaId);
                                        
                                        if (idx >= 0) {
                                          novasTarefas[idx] = { ...novasTarefas[idx], tempo_estimado_dia: novoTempo };
                                        } else {
                                          novasTarefas.push({ tarefa_id: tarefaId, tempo_estimado_dia: novoTempo });
                                        }
                                        
                                        return { ...prev, tarefas: novasTarefas };
                                      });
                                    }}
                                    disabled={salvando}
                                    placeholder="0"
                                    min="0"
                                    max="59"
                                    style={{
                                      width: '28px',
                                      padding: '0',
                                      border: 'none',
                                      background: 'transparent',
                                      fontSize: '11px',
                                      textAlign: 'center',
                                      color: '#ffffff',
                                      fontWeight: '500'
                                    }}
                                  />
                                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>min</span>
                                </div>
                                )}
                                {isSelecionadaParaTempo && modoSelecionarVarios && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <span style={{
                                      fontSize: '10px',
                                      color: '#ffffff',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      background: 'rgba(255, 255, 255, 0.3)',
                                      flexShrink: 0
                                    }} title="Selecionada para aplicar tempo global">
                                      ✓
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '12px', fontStyle: 'italic', padding: '12px', textAlign: 'center' }}>
                            {dadosEdicao.cliente_id && dadosEdicao.produto_ids && dadosEdicao.produto_ids.length > 0 
                              ? 'Nenhuma tarefa encontrada para os produtos selecionados'
                              : 'Selecione produtos para ver as tarefas disponíveis'}
                          </span>
                        )}
                      </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ 
                  padding: '14px 24px', 
                  borderTop: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  flexShrink: 0,
                  marginTop: 'auto'
                }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalEdicao}
                    disabled={salvando}
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
                    onClick={handleAtualizarHistorico}
                    disabled={salvando}
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      opacity: salvando ? 0.6 : 1,
                      cursor: salvando ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {salvando ? (
                      <>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

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
        </main>
      </div>
    </Layout>
  );
};

export default HistoricoAtribuicoes;

