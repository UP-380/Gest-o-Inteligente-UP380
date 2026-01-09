import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import CustomSelect from './CustomSelect';
import SelecaoTarefasPorProduto from '../clients/SelecaoTarefasPorProduto';
import './VinculacaoForm.css';

const API_BASE_URL = '/api';

const VinculacaoForm = ({ vinculadoData, isEditing, onSubmit, submitting, loading: externalLoading }) => {
  const showToast = useToast();

  // Estados das 4 seções
  // Seção 1: Tipo de Tarefa → Tarefas
  const [tipoTarefaSelecionado, setTipoTarefaSelecionado] = useState(null);
  const [tarefasDoTipoSelecionadas, setTarefasDoTipoSelecionadas] = useState([]);
  const [tarefasDoTipoDisponiveis, setTarefasDoTipoDisponiveis] = useState([]);
  const [tarefasVinculadasOriginalmente, setTarefasVinculadasOriginalmente] = useState([]); // Para rastrear o estado original

  // Seção 2: Tarefa → Subtarefas
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  const [tipoTarefaDaTarefaSelecionada, setTipoTarefaDaTarefaSelecionada] = useState(null); // Tipo de tarefa da tarefa selecionada
  const [subtarefasDaTarefaSelecionadas, setSubtarefasDaTarefaSelecionadas] = useState([]);
  const [subtarefasDaTarefaDisponiveis, setSubtarefasDaTarefaDisponiveis] = useState([]);
  const [subtarefasVinculadasOriginalmente, setSubtarefasVinculadasOriginalmente] = useState([]); // Para rastrear o estado original
  const [tarefasComTipos, setTarefasComTipos] = useState([]); // Tarefas agrupadas por tipo

  // Seção 3: Produto → Tarefas
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [tarefasDoProdutoSelecionadas, setTarefasDoProdutoSelecionadas] = useState([]); // Array de chaves compostas: "tarefaId-tipoTarefaId"
  const [tarefasDoProdutoComTipos, setTarefasDoProdutoComTipos] = useState([]); // Tarefas do produto agrupadas por tipo
  const [tarefasDoProdutoVinculadasOriginalmente, setTarefasDoProdutoVinculadasOriginalmente] = useState([]); // Para rastrear o estado original (chaves compostas)

  // Seção 4: Cliente → Produtos
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [produtosDoClienteSelecionados, setProdutosDoClienteSelecionados] = useState([]);
  const [produtosDoClienteDisponiveis, setProdutosDoClienteDisponiveis] = useState([]);
  const [produtosDoClienteVinculadosOriginalmente, setProdutosDoClienteVinculadosOriginalmente] = useState([]); // Para rastrear o estado original
  const [tarefasSelecionadasPorProdutoSecao4, setTarefasSelecionadasPorProdutoSecao4] = useState({}); // { produtoId: { tarefaId: { selecionada: boolean, subtarefas: [subtarefaId] } } }
  const [refreshTarefasSecao4, setRefreshTarefasSecao4] = useState(0); // Contador para forçar recarregamento

  // Dados carregados
  const [tiposTarefa, setTiposTarefa] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [subtarefas, setSubtarefas] = useState([]); // Todas as subtarefas para buscar nomes
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados de loading individuais para cada seção
  const [savingSecao1, setSavingSecao1] = useState(false);
  const [savingSecao2, setSavingSecao2] = useState(false);
  const [savingSecao3, setSavingSecao3] = useState(false);
  const [savingSecao4, setSavingSecao4] = useState(false);

  // Estados para controlar se os dados já foram carregados
  const [tiposTarefaCarregados, setTiposTarefaCarregados] = useState(false);
  const [tarefasCarregadas, setTarefasCarregadas] = useState(false);
  const [produtosCarregados, setProdutosCarregados] = useState(false);
  const [clientesCarregados, setClientesCarregados] = useState(false);
  const [subtarefasCarregadas, setSubtarefasCarregadas] = useState(false);

  // Carregar dados iniciais apenas uma vez quando o componente monta
  // Não recarregar ao clicar nos componentes
  useEffect(() => {
    // Carregar dados básicos apenas uma vez quando o componente monta
    // Não fazer refresh ao clicar
    if (!tiposTarefaCarregados && !tarefasCarregadas && !produtosCarregados && !clientesCarregados) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez quando o componente monta

  // Carregar dados do vinculado para edição
  useEffect(() => {
    if (isEditing && vinculadoData) {
      loadVinculadoData();
    }
  }, [isEditing, vinculadoData]);

  // Carregar tarefas quando tipo de tarefa é selecionado
  useEffect(() => {
    if (tipoTarefaSelecionado) {
      loadTarefasPorTipo(tipoTarefaSelecionado);
    } else {
      setTarefasDoTipoDisponiveis([]);
      setTarefasDoTipoSelecionadas([]);
    }
  }, [tipoTarefaSelecionado]);

  // Carregar tarefas com tipos (para Seção 2) - apenas quando tipos e tarefas estiverem carregados
  useEffect(() => {
    if (tiposTarefa.length > 0 && tarefas.length > 0) {
      recarregarTarefasComTipos();
    } else {
      // Se não há dados, limpar opções
      setTarefasComTipos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposTarefa.length, tarefas.length]); // Usar .length para evitar loops infinitos

  // Carregar subtarefas quando tarefa é selecionada (com tipo)
  useEffect(() => {
    if (tarefaSelecionada && tipoTarefaDaTarefaSelecionada) {
      loadSubtarefasPorTarefa(tarefaSelecionada, tipoTarefaDaTarefaSelecionada);
    } else {
      setSubtarefasDaTarefaDisponiveis([]);
      setSubtarefasDaTarefaSelecionadas([]);
      setSubtarefasVinculadasOriginalmente([]);
    }
  }, [tarefaSelecionada, tipoTarefaDaTarefaSelecionada]);

  // Carregar tarefas quando produto é selecionado (garantir que tarefas e tipos estejam carregados)
  useEffect(() => {
    if (produtoSelecionado) {
      // Garantir que tarefas e tipos de tarefa estejam carregados antes de buscar tarefas do produto
      if (!tarefasCarregadas) {
        loadTarefas();
      }
      if (!tiposTarefaCarregados) {
        loadTiposTarefa();
      }
      
      // Se já estão carregados, buscar tarefas do produto
      if (tarefasCarregadas && tiposTarefaCarregados) {
        loadTarefasPorProduto(produtoSelecionado);
      }
    } else {
      setTarefasDoProdutoComTipos([]);
      setTarefasDoProdutoSelecionadas([]);
      setTarefasDoProdutoVinculadasOriginalmente([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoSelecionado, tarefasCarregadas, tiposTarefaCarregados]);

  // Recarregar tarefas do produto quando tarefas ou tipos forem carregados (se produto já está selecionado)
  useEffect(() => {
    if (produtoSelecionado && tarefasCarregadas && tiposTarefaCarregados) {
      loadTarefasPorProduto(produtoSelecionado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasCarregadas, tiposTarefaCarregados]);

  // Carregar produtos quando cliente é selecionado
  useEffect(() => {
    if (clienteSelecionado) {
      loadProdutosPorCliente(clienteSelecionado);
    } else {
      setProdutosDoClienteDisponiveis([]);
      setProdutosDoClienteSelecionados([]);
      setProdutosDoClienteVinculadosOriginalmente([]);
    }
  }, [clienteSelecionado]);

  // Recarregar tarefas da seção 4 quando refreshTarefasSecao4 mudar (após salvar)
  useEffect(() => {
    if (refreshTarefasSecao4 > 0 && clienteSelecionado && produtosDoClienteSelecionados.length > 0) {
      // Recarregar tarefas dos produtos para atualizar a exibição
      loadTarefasSecao4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTarefasSecao4]);

  // Carregar tipos de tarefa sob demanda (com cache)
  const loadTiposTarefa = async (forceRefresh = false) => {
    if (!forceRefresh && (tiposTarefaCarregados || tiposTarefa.length > 0)) return;
    
    setLoading(true);
    try {
      const tiposRes = await fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (tiposRes.ok) {
        const tiposData = await tiposRes.json();
        if (tiposData.success) {
          setTiposTarefa(tiposData.data || []);
          setTiposTarefaCarregados(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de tarefa:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar tarefas sob demanda (com cache)
  const loadTarefas = async (forceRefresh = false) => {
    if (!forceRefresh && (tarefasCarregadas || tarefas.length > 0)) return;
    
    setLoading(true);
    try {
      const tarefasRes = await fetch(`${API_BASE_URL}/tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (tarefasRes.ok) {
        const tarefasData = await tarefasRes.json();
        if (tarefasData.success) {
          setTarefas(tarefasData.data || []);
          setTarefasCarregadas(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar subtarefas sob demanda
  const loadSubtarefas = async () => {
    if (subtarefasCarregadas || subtarefas.length > 0) return;
    
    setLoading(true);
    try {
      const subtarefasRes = await fetch(`${API_BASE_URL}/subtarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (subtarefasRes.ok) {
        const subtarefasData = await subtarefasRes.json();
        if (subtarefasData.success) {
          setSubtarefas(subtarefasData.data || []);
          setSubtarefasCarregadas(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar subtarefas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar produtos sob demanda
  const loadProdutos = async (forceRefresh = false) => {
    if (!forceRefresh && (produtosCarregados || produtos.length > 0)) return;
    
    setLoading(true);
    try {
      const produtosRes = await fetch(`${API_BASE_URL}/produtos?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (produtosRes.ok) {
        const produtosData = await produtosRes.json();
        if (produtosData.success) {
          setProdutos(produtosData.data || []);
          setProdutosCarregados(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar clientes sob demanda
  const loadClientes = async (forceRefresh = false) => {
    if (!forceRefresh && (clientesCarregados || clientes.length > 0)) return;
    
    setLoading(true);
    try {
      const clientesRes = await fetch(`${API_BASE_URL}/clientes?limit=10000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (clientesRes.ok) {
        const clientesData = await clientesRes.json();
        if (clientesData.success && clientesData.data && Array.isArray(clientesData.data)) {
          const clientesComDados = clientesData.data.map(cliente => ({
            id: cliente.id,
            nome: cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || `Cliente #${cliente.id}`
          }));
          setClientes(clientesComDados);
          setClientesCarregados(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais (apenas para edição)
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Carregar todos os dados necessários para edição
      await Promise.all([
        loadTiposTarefa(),
        loadTarefas(),
        loadSubtarefas(),
        loadProdutos(),
        loadClientes()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      showToast('error', 'Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadTarefasPorTipo = async (tipoTarefaId) => {
    try {
      // 1. Buscar tarefas NÃO vinculadas (para poder vincular novas)
      const response = await fetch(`${API_BASE_URL}/tarefas-por-tipo?tipoTarefaId=${tipoTarefaId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let tarefasNaoVinculadas = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          tarefasNaoVinculadas = result.data || [];
        }
      }

      // 2. Buscar tarefas JÁ vinculadas a este tipo (para mostrar e permitir editar)
      const responseVinculadas = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let tarefasVinculadasIds = [];
      let tarefasVinculadasComNomes = [];
      
      if (responseVinculadas.ok) {
        const resultVinculadas = await responseVinculadas.json();
        if (resultVinculadas.success && resultVinculadas.data) {
          // Filtrar apenas vinculados deste tipo de tarefa
          const vinculadosDoTipo = resultVinculadas.data.filter(v => {
            const vTipoId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
            return vTipoId === tipoTarefaId && v.cp_tarefa;
          });
          
          // Extrair IDs únicos das tarefas já vinculadas
          tarefasVinculadasIds = [...new Set(
            vinculadosDoTipo
              .map(v => parseInt(v.cp_tarefa, 10))
              .filter(id => !isNaN(id))
          )];
          
          // Buscar nomes das tarefas vinculadas
          if (tarefasVinculadasIds.length > 0) {
            // Buscar na lista de todas as tarefas carregadas
            tarefasVinculadasComNomes = tarefasVinculadasIds.map(tarefaId => {
              const tarefa = tarefas.find(t => t.id === tarefaId);
              if (tarefa) {
                return { id: tarefaId, nome: tarefa.nome };
              }
              // Se não encontrou na lista, buscar pelo nome do vinculado
              const vinculado = vinculadosDoTipo.find(v => parseInt(v.cp_tarefa, 10) === tarefaId);
              if (vinculado && vinculado.tarefa_nome) {
                return { id: tarefaId, nome: vinculado.tarefa_nome };
              }
              return null;
            }).filter(Boolean);
          }
        }
      }

      // 3. Combinar tarefas não vinculadas + tarefas vinculadas (com nomes)
      const todasTarefas = [...tarefasNaoVinculadas];
      tarefasVinculadasComNomes.forEach(tarefaVinculada => {
        // Adicionar apenas se não estiver na lista de não vinculadas
        if (!todasTarefas.find(t => t.id === tarefaVinculada.id)) {
          todasTarefas.push(tarefaVinculada);
        }
      });
      
      setTarefasDoTipoDisponiveis(todasTarefas);
      
      // 4. Pré-selecionar tarefas já vinculadas (para permitir edição/remoção)
      // Isso funciona tanto para criação quanto edição
      if (tarefasVinculadasIds.length > 0) {
        setTarefasDoTipoSelecionadas(tarefasVinculadasIds);
        // Guardar o estado original para comparar depois (para detectar mudanças)
        setTarefasVinculadasOriginalmente(tarefasVinculadasIds);
      } else {
        // Se não há vinculações existentes, limpar estado original
        setTarefasVinculadasOriginalmente([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas do tipo:', error);
    }
  };

  const loadSubtarefasPorTarefa = async (tarefaId, tipoTarefaId = null) => {
    try {
      // 1. Buscar TODAS as subtarefas (independente de vínculos) usando o parâmetro todos=true
      let url = `${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}&todos=true`;
      if (tipoTarefaId !== null) {
        url += `&tarefaTipoId=${tipoTarefaId}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let todasSubtarefas = [];
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          todasSubtarefas = result.data || [];
        }
      }

      // 2. Buscar subtarefas JÁ vinculadas a esta tarefa (para pré-selecionar)
      const responseVinculadas = await fetch(`${API_BASE_URL}/vinculados?filtro_atividade=true&filtro_subtarefa=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let subtarefasVinculadasIds = [];
      
      if (responseVinculadas.ok) {
        const resultVinculadas = await responseVinculadas.json();
        if (resultVinculadas.success && resultVinculadas.data) {
          // Filtrar apenas vinculados desta tarefa (considerando tipo de tarefa se disponível)
          const vinculadosDaTarefa = resultVinculadas.data.filter(v => {
            const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
            const vTipoTarefaId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
            const matchTarefa = vTarefaId === tarefaId && v.cp_subtarefa;
            // Se tipoTarefaId foi fornecido, filtrar também por tipo
            if (tipoTarefaId !== null && tipoTarefaId !== undefined) {
              return matchTarefa && vTipoTarefaId === tipoTarefaId;
            }
            return matchTarefa;
          });
          
          // Extrair IDs únicos das subtarefas já vinculadas
          subtarefasVinculadasIds = [...new Set(
            vinculadosDaTarefa
              .map(v => parseInt(v.cp_subtarefa, 10))
              .filter(id => !isNaN(id))
          )];
        }
      }
      
      setSubtarefasDaTarefaDisponiveis(todasSubtarefas);
      
      // 3. Pré-selecionar subtarefas já vinculadas (para permitir edição/remoção)
      // Isso funciona tanto para criação quanto edição
      if (subtarefasVinculadasIds.length > 0) {
        setSubtarefasDaTarefaSelecionadas(subtarefasVinculadasIds);
        // Guardar o estado original para comparar depois (para detectar mudanças)
        setSubtarefasVinculadasOriginalmente(subtarefasVinculadasIds);
      } else {
        // Se não há vinculações existentes, limpar estado original
        setSubtarefasDaTarefaSelecionadas([]);
        setSubtarefasVinculadasOriginalmente([]);
      }
    } catch (error) {
      console.error('Erro ao carregar subtarefas da tarefa:', error);
    }
  };

  const loadTarefasPorProduto = async (produtoId) => {
    try {
      // 1. Buscar todas as tarefas que têm vínculos tipo-tarefa (tarefas disponíveis para vincular)
      // Isso busca na tabela vinculados apenas tarefas que têm vinculações tipo-tarefa
      const responseTarefasDisponiveis = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&filtro_atividade=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let tarefasComTiposDisponiveis = [];
      const tarefasComTiposMap = new Map();
      
      if (responseTarefasDisponiveis.ok) {
        const resultTarefasDisponiveis = await responseTarefasDisponiveis.json();
        if (resultTarefasDisponiveis.success && resultTarefasDisponiveis.data) {
          // Filtrar apenas vinculados que têm tarefa e tipo de tarefa, mas não têm produto nem cliente
          const vinculadosTarefaTipo = resultTarefasDisponiveis.data.filter(v => {
            return v.cp_tarefa && v.cp_tarefa_tipo && !v.cp_produto && !v.cp_cliente && !v.cp_subtarefa;
          });
          
          // Extrair tarefas únicas com seus tipos
          vinculadosTarefaTipo.forEach(v => {
            const tarefaId = parseInt(v.cp_tarefa, 10);
            const tipoTarefaId = parseInt(v.cp_tarefa_tipo, 10);
            const key = `${tarefaId}-${tipoTarefaId}`;
            
            if (!tarefasComTiposMap.has(key) && !isNaN(tarefaId) && !isNaN(tipoTarefaId)) {
              const tarefaNome = v.tarefa_nome || tarefas.find(t => t.id === tarefaId)?.nome || `Tarefa ${tarefaId}`;
              const tipoTarefaNome = v.tipo_tarefa_nome || tiposTarefa.find(t => t.id === tipoTarefaId)?.nome || `Tipo ${tipoTarefaId}`;
              
              tarefasComTiposMap.set(key, {
                tarefaId,
                tarefaNome,
                tipoTarefaId,
                tipoTarefaNome
              });
            }
          });
          
          tarefasComTiposDisponiveis = Array.from(tarefasComTiposMap.values());
        }
      }
      
      // 2. Buscar tarefas JÁ vinculadas a este produto (para mostrar e permitir editar)
      // IMPORTANTE: Buscar TODAS as vinculações (com ou sem subtarefa), pois na seção 3 salvamos com subtarefas
      const responseVinculadas = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let tarefasVinculadasChaves = [];
      const tarefasVinculadasMap = new Map(); // Map para agrupar por tarefa+tipo
      
      if (responseVinculadas.ok) {
        const resultVinculadas = await responseVinculadas.json();
        if (resultVinculadas.success && resultVinculadas.data) {
          // Filtrar apenas vinculados deste produto (sem cliente)
          // REMOVIDO filtro !v.cp_subtarefa para incluir tarefas vinculadas com subtarefas
          const vinculadosDoProduto = resultVinculadas.data.filter(v => {
            const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
            return vProdutoId === produtoId && v.cp_tarefa && !v.cp_cliente;
          });
          
          // Agrupar vinculações por tarefa+tipo (uma tarefa pode ter múltiplas vinculações com subtarefas diferentes)
          vinculadosDoProduto.forEach(v => {
            const tarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
            const tipoTarefaId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
            
            if (tarefaId) {
              let tipoIdFinal = tipoTarefaId;
              
              // Se não tem tipo, tentar buscar na lista de tarefas disponíveis
              if (!tipoIdFinal) {
                const tarefaComTipo = tarefasComTiposDisponiveis.find(tt => tt.tarefaId === tarefaId);
                if (tarefaComTipo) {
                  tipoIdFinal = tarefaComTipo.tipoTarefaId;
                }
              }
              
              // Criar chave composta
              const key = tipoIdFinal ? `${tarefaId}-${tipoIdFinal}` : `${tarefaId}-null`;
              
              // Adicionar ao map (se já existe, não precisa adicionar novamente)
              if (!tarefasVinculadasMap.has(key)) {
                tarefasVinculadasMap.set(key, {
                  tarefaId,
                  tipoTarefaId: tipoIdFinal,
                  tarefaNome: v.tarefa_nome || tarefas.find(t => t.id === tarefaId)?.nome || `Tarefa ${tarefaId}`,
                  tipoTarefaNome: v.tipo_tarefa_nome || (tipoIdFinal ? tiposTarefa.find(t => t.id === tipoIdFinal)?.nome : null) || null
                });
              }
            }
          });
          
          // Converter map em array de chaves
          tarefasVinculadasChaves = Array.from(tarefasVinculadasMap.keys());
          
          console.log(`📋 [Seção 3] Tarefas vinculadas ao produto ${produtoId}:`, {
            totalVinculados: vinculadosDoProduto.length,
            tarefasUnicas: tarefasVinculadasChaves.length,
            chaves: tarefasVinculadasChaves
          });
          
          // Adicionar tarefas vinculadas à lista de disponíveis se não estiverem lá
          tarefasVinculadasMap.forEach((info, key) => {
            const keyExiste = tarefasComTiposDisponiveis.find(tt => {
              const ttKey = tt.tipoTarefaId ? `${tt.tarefaId}-${tt.tipoTarefaId}` : `${tt.tarefaId}-null`;
              return ttKey === key;
            });
            
            if (!keyExiste && info.tipoTarefaId) {
              tarefasComTiposDisponiveis.push({
                tarefaId: info.tarefaId,
                tarefaNome: info.tarefaNome,
                tipoTarefaId: info.tipoTarefaId,
                tipoTarefaNome: info.tipoTarefaNome || `Tipo ${info.tipoTarefaId}`
              });
            }
          });
        }
      }

      // 3. Mostrar todas as tarefas disponíveis (tarefas que têm vínculos tipo-tarefa)
      setTarefasDoProdutoComTipos(tarefasComTiposDisponiveis);
      
      // 4. Pré-selecionar tarefas já vinculadas ao produto (para permitir edição/remoção)
      if (tarefasVinculadasChaves.length > 0) {
        console.log(`✅ [Seção 3] Marcando ${tarefasVinculadasChaves.length} tarefa(s) como selecionada(s) para o produto ${produtoId}`);
        setTarefasDoProdutoSelecionadas(tarefasVinculadasChaves);
        // Guardar o estado original para comparar depois (para detectar mudanças)
        setTarefasDoProdutoVinculadasOriginalmente(tarefasVinculadasChaves);
      } else {
        console.log(`ℹ️ [Seção 3] Nenhuma tarefa vinculada ao produto ${produtoId}`);
        // Se não há vinculações existentes, limpar estado original
        setTarefasDoProdutoSelecionadas([]);
        setTarefasDoProdutoVinculadasOriginalmente([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas do produto:', error);
    }
  };

  // Função auxiliar para recarregar tarefas com tipos
  const recarregarTarefasComTipos = async () => {
    if (tiposTarefa.length === 0 || tarefas.length === 0) return;
    
    try {
      const vinculadosTipoTarefaRes = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&filtro_atividade=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      if (vinculadosTipoTarefaRes.ok) {
        const vinculadosData = await vinculadosTipoTarefaRes.json();
        if (vinculadosData.success && vinculadosData.data) {
          const tarefasComTiposMap = new Map();
          vinculadosData.data.forEach(v => {
            if (v.cp_tarefa && v.cp_tarefa_tipo && !v.cp_produto && !v.cp_cliente && !v.cp_subtarefa) {
              const tarefaId = parseInt(v.cp_tarefa, 10);
              const tipoTarefaId = parseInt(v.cp_tarefa_tipo, 10);
              const tarefaNome = v.tarefa_nome || tarefas.find(t => t.id === tarefaId)?.nome || `Tarefa ${tarefaId}`;
              const tipoTarefaNome = v.tipo_tarefa_nome || tiposTarefa.find(t => t.id === tipoTarefaId)?.nome || `Tipo ${tipoTarefaId}`;
              const key = `${tarefaId}-${tipoTarefaId}`;
              if (!tarefasComTiposMap.has(key)) {
                tarefasComTiposMap.set(key, {
                  tarefaId,
                  tarefaNome,
                  tipoTarefaId,
                  tipoTarefaNome
                });
              }
            }
          });
          setTarefasComTipos(Array.from(tarefasComTiposMap.values()));
        }
      }
    } catch (error) {
      console.error('Erro ao recarregar tarefas com tipos:', error);
    }
  };

  // Função para carregar tarefas da seção 4 (após salvar)
  const loadTarefasSecao4 = async () => {
    if (!clienteSelecionado || produtosDoClienteSelecionados.length === 0) return;
    
    try {
      // Buscar tarefas dos produtos para este cliente específico
      const response = await fetch(`${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteSelecionado}&produtoIds=${produtosDoClienteSelecionados.join(',')}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Atualizar tarefas selecionadas por produto
          const novasTarefasSelecionadas = {};
          
          result.data.forEach(item => {
            const produtoId = item.produtoId;
            novasTarefasSelecionadas[produtoId] = {};
            
            (item.tarefas || []).forEach(tarefa => {
              const estaVinculadaAoCliente = tarefa.estaVinculadaAoCliente === true;
              const subtarefasVinculadas = tarefa.subtarefasVinculadasCliente || [];
              const temSubtarefasVinculadas = subtarefasVinculadas.length > 0;
              
              // Marcar tarefa como selecionada se está vinculada ao cliente OU tem subtarefas vinculadas
              // Uma tarefa vinculada ao cliente deve aparecer marcada independentemente de ser exceção
              if (estaVinculadaAoCliente || temSubtarefasVinculadas) {
                novasTarefasSelecionadas[produtoId][tarefa.id] = {
                  selecionada: true,
                  subtarefas: subtarefasVinculadas
                };
              }
            });
          });
          
          setTarefasSelecionadasPorProdutoSecao4(novasTarefasSelecionadas);
          console.log('✅ Tarefas da seção 4 recarregadas após salvar:', novasTarefasSelecionadas);
        }
      }
    } catch (error) {
      console.error('Erro ao recarregar tarefas da seção 4:', error);
    }
  };

  // Função centralizada para atualizar todos os componentes relacionados
  // Esta função é chamada após salvar qualquer seção para manter todos os dados sincronizados
  const atualizarTodosComponentesRelacionados = async () => {
    console.log('🔄 Atualizando todos os componentes relacionados...');
    
    try {
      // 1. Sempre recarregar tarefas com tipos (afeta Seção 2 e outras seções)
      await recarregarTarefasComTipos();
      
      // 2. Se há tipo de tarefa selecionado na Seção 1, recarregar tarefas do tipo
      if (tipoTarefaSelecionado) {
        await loadTarefasPorTipo(tipoTarefaSelecionado);
      }
      
      // 3. Se há tarefa selecionada na Seção 2, recarregar subtarefas
      if (tarefaSelecionada && tipoTarefaDaTarefaSelecionada) {
        await loadSubtarefasPorTarefa(tarefaSelecionada, tipoTarefaDaTarefaSelecionada);
      }
      
      // 4. Se há produto selecionado na Seção 3, recarregar tarefas do produto
      if (produtoSelecionado) {
        await loadTarefasPorProduto(produtoSelecionado);
      }
      
      // 5. Se há cliente selecionado na Seção 4, recarregar produtos do cliente
      if (clienteSelecionado) {
        await loadProdutosPorCliente(clienteSelecionado);
      }
      
      // 6. Se há cliente e produtos selecionados na Seção 4, recarregar tarefas
      if (clienteSelecionado && produtosDoClienteSelecionados.length > 0) {
        await loadTarefasSecao4();
        // Incrementar contador para forçar recarregamento do componente SelecaoTarefasPorProduto
        setRefreshTarefasSecao4(prev => prev + 1);
      }
      
      console.log('✅ Todos os componentes relacionados foram atualizados');
    } catch (error) {
      console.error('❌ Erro ao atualizar componentes relacionados:', error);
    }
  };

  const loadProdutosPorCliente = async (clienteId) => {
    try {
      // Buscar produtos que têm vínculos (produtos vinculados a tarefas, similar às outras seções)
      // Isso busca na tabela vinculados apenas produtos que têm vinculações
      const responseVinculadas = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let produtosComVinculosIds = [];
      let produtosComVinculosComNomes = [];
      
      if (responseVinculadas.ok) {
        const resultVinculadas = await responseVinculadas.json();
        if (resultVinculadas.success && resultVinculadas.data) {
          // Filtrar apenas vinculados que têm produto e não têm cliente (produtos com vínculos de tarefas)
          const vinculadosComProduto = resultVinculadas.data.filter(v => {
            return v.cp_produto && !v.cp_cliente; // Produtos com vínculos (sem cliente ainda)
          });
          
          // Extrair IDs únicos dos produtos que têm vínculos
          produtosComVinculosIds = [...new Set(
            vinculadosComProduto
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];
          
          // Buscar nomes dos produtos com vínculos
          if (produtosComVinculosIds.length > 0) {
            // Buscar na lista de todos os produtos carregados
            produtosComVinculosComNomes = produtosComVinculosIds.map(produtoId => {
              const produto = produtos.find(p => p.id === produtoId);
              if (produto) {
                return { id: produtoId, nome: produto.nome };
              }
              // Se não encontrou na lista, buscar pelo nome do vinculado
              const vinculado = vinculadosComProduto.find(v => parseInt(v.cp_produto, 10) === produtoId);
              if (vinculado && vinculado.produto_nome) {
                return { id: produtoId, nome: vinculado.produto_nome };
              }
              return null;
            }).filter(Boolean);
          }
        }
      }

      // Buscar produtos JÁ vinculados a este cliente (para mostrar e permitir editar)
      const responseCliente = await fetch(`${API_BASE_URL}/vinculados?filtro_cliente=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let produtosVinculadosAoClienteIds = [];
      
      if (responseCliente.ok) {
        const resultCliente = await responseCliente.json();
        if (resultCliente.success && resultCliente.data) {
          // Filtrar apenas vinculados deste cliente
          const vinculadosDoCliente = resultCliente.data.filter(v => {
            const vClienteId = v.cp_cliente || '';
            return vClienteId === clienteId && v.cp_produto;
          });
          
          // Extrair IDs únicos dos produtos já vinculados ao cliente
          produtosVinculadosAoClienteIds = [...new Set(
            vinculadosDoCliente
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];
        }
      }

      // Mostrar apenas produtos que têm vínculos (produtosComVinculosComNomes)
      // Mas garantir que produtos já vinculados ao cliente também apareçam
      const produtosDisponiveis = [...produtosComVinculosComNomes];
      
      // Adicionar produtos já vinculados ao cliente que não estão na lista de produtos com vínculos
      if (produtosVinculadosAoClienteIds.length > 0) {
        produtosVinculadosAoClienteIds.forEach(produtoId => {
          if (!produtosDisponiveis.find(p => p.id === produtoId)) {
            const produto = produtos.find(p => p.id === produtoId);
            if (produto) {
              produtosDisponiveis.push({ id: produtoId, nome: produto.nome });
            }
          }
        });
      }
      
      setProdutosDoClienteDisponiveis(produtosDisponiveis);
      
      // Pré-selecionar produtos já vinculados ao cliente (para permitir edição/remoção)
      if (produtosVinculadosAoClienteIds.length > 0) {
        setProdutosDoClienteSelecionados(produtosVinculadosAoClienteIds);
        // Guardar o estado original para comparar depois (para detectar mudanças)
        setProdutosDoClienteVinculadosOriginalmente(produtosVinculadosAoClienteIds);
      } else {
        // Se não há vinculações existentes, limpar estado original
        setProdutosDoClienteSelecionados([]);
        setProdutosDoClienteVinculadosOriginalmente([]);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos do cliente:', error);
    }
  };

  const loadVinculadoData = () => {
    if (!vinculadoData) return;

    // Preencher seção 1: Tipo de Tarefa → Tarefas
    if (vinculadoData.cp_tarefa_tipo) {
      setTipoTarefaSelecionado(vinculadoData.cp_tarefa_tipo);
      if (vinculadoData.cp_tarefa) {
        setTarefasDoTipoSelecionadas([vinculadoData.cp_tarefa]);
      }
    }

    // Preencher seção 2: Tarefa → Subtarefas
    if (vinculadoData.cp_tarefa) {
      setTarefaSelecionada(vinculadoData.cp_tarefa);
      if (vinculadoData.cp_subtarefa) {
        setSubtarefasDaTarefaSelecionadas([vinculadoData.cp_subtarefa]);
      }
    }

    // Preencher seção 3: Produto → Tarefas
    if (vinculadoData.cp_produto) {
      setProdutoSelecionado(vinculadoData.cp_produto);
      if (vinculadoData.cp_tarefa) {
        setTarefasDoProdutoSelecionadas([vinculadoData.cp_tarefa]);
      }
    }

    // Preencher seção 4: Cliente → Produtos
    if (vinculadoData.cp_cliente) {
      setClienteSelecionado(vinculadoData.cp_cliente);
      if (vinculadoData.cp_produto) {
        setProdutosDoClienteSelecionados([vinculadoData.cp_produto]);
      }
    }
  };

  const criarDadosVinculados = async () => {
    const combinacoes = [];

    // Seção 1: Tipo de Tarefa → Tarefas
    const tipoTarefaId = tipoTarefaSelecionado;
    const tarefasDoTipo = tarefasDoTipoSelecionadas;

    // Seção 2: Tarefa → Subtarefas
    const tarefaId = tarefaSelecionada;
    const subtarefasIds = subtarefasDaTarefaSelecionadas;

    // Seção 3: Produto → Tarefas
    const produtoId = produtoSelecionado;
    const tarefasDoProduto = tarefasDoProdutoSelecionadas;

    // Seção 4: Cliente → Produtos
    const clienteId = clienteSelecionado;
    const produtosIds = produtosDoClienteSelecionados;

    // SEÇÃO 1: Tipo de Tarefa → Tarefas
    // Criar vinculação para cada tarefa selecionada com o tipo de tarefa
    if (tipoTarefaId && tarefasDoTipo.length > 0) {
      tarefasDoTipo.forEach(tarefaDoTipoId => {
        // Se há outras seções preenchidas, criar combinações complexas
        if (clienteId && produtosIds.length > 0) {
          // Cliente + Produtos + Tipo + Tarefa
          produtosIds.forEach(produtoDoClienteId => {
            combinacoes.push({
              cp_tarefa_tipo: tipoTarefaId,
              cp_tarefa: tarefaDoTipoId,
              cp_subtarefa: null,
              cp_produto: produtoDoClienteId,
              cp_cliente: clienteId
            });
          });
        } else if (produtoId && tarefasDoProduto.length > 0) {
          // Produto + Tarefas + Tipo + Tarefa
          tarefasDoProduto.forEach(tarefaDoProdutoId => {
            combinacoes.push({
              cp_tarefa_tipo: tipoTarefaId,
              cp_tarefa: tarefaDoTipoId,
              cp_subtarefa: null,
              cp_produto: produtoId,
              cp_cliente: null
            });
          });
        } else if (tarefaId && subtarefasIds.length > 0 && tarefaId === tarefaDoTipoId) {
          // Tarefa + Subtarefas + Tipo + Tarefa (mesma tarefa)
          subtarefasIds.forEach(subtarefaId => {
            combinacoes.push({
              cp_tarefa_tipo: tipoTarefaId,
              cp_tarefa: tarefaDoTipoId,
              cp_subtarefa: subtarefaId,
              cp_produto: null,
              cp_cliente: null
            });
          });
        } else {
          // Apenas Tipo de Tarefa → Tarefa (vinculação simples)
          combinacoes.push({
            cp_tarefa_tipo: tipoTarefaId,
            cp_tarefa: tarefaDoTipoId,
            cp_subtarefa: null,
            cp_produto: null,
            cp_cliente: null
          });
        }
      });
    }

    // SEÇÃO 2: Tarefa → Subtarefas (sem tipo de tarefa)
    if (!tipoTarefaId && tarefaId && subtarefasIds.length > 0) {
      subtarefasIds.forEach(subtarefaId => {
        if (clienteId && produtosIds.length > 0) {
          produtosIds.forEach(produtoDoClienteId => {
            combinacoes.push({
              cp_tarefa_tipo: null,
              cp_tarefa: tarefaId,
              cp_subtarefa: subtarefaId,
              cp_produto: produtoDoClienteId,
              cp_cliente: clienteId
            });
          });
        } else {
          combinacoes.push({
            cp_tarefa_tipo: null,
            cp_tarefa: tarefaId,
            cp_subtarefa: subtarefaId,
            cp_produto: null,
            cp_cliente: null
          });
        }
      });
    }

    // SEÇÃO 3: Produto → Tarefas (sem tipo e sem tarefa da seção 2)
    if (!tipoTarefaId && !tarefaId && produtoId && tarefasDoProduto.length > 0) {
      // Buscar subtarefas de cada tarefa selecionada
      for (const chaveComposta of tarefasDoProduto) {
        // Extrair tarefaId e tipoTarefaId da chave composta
        const [tarefaIdStr, tipoTarefaIdStr] = chaveComposta.split('-');
        const tarefaDoProdutoId = parseInt(tarefaIdStr, 10);
        const tipoTarefaDoProdutoId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
        
        // Buscar subtarefas desta tarefa (combinando tarefa_id + tarefa_tipo_id)
        let subtarefasDaTarefa = [];
        try {
          // Passar tarefaId e tipoTarefaId para buscar subtarefas da combinação específica
          let url = `${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaDoProdutoId}`;
          if (tipoTarefaDoProdutoId !== null) {
            url += `&tarefaTipoId=${tipoTarefaDoProdutoId}`;
          }
          
          const responseSubtarefas = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          
          if (responseSubtarefas.ok) {
            const resultSubtarefas = await responseSubtarefas.json();
            if (resultSubtarefas.success && resultSubtarefas.data) {
              subtarefasDaTarefa = resultSubtarefas.data.map(st => st.id);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar subtarefas da tarefa:', error);
        }
        
        if (subtarefasDaTarefa.length > 0) {
          // Se há subtarefas, criar uma vinculação para cada subtarefa
          subtarefasDaTarefa.forEach(subtarefaId => {
            if (clienteId && produtosIds.length > 0) {
              produtosIds.forEach(produtoDoClienteId => {
                combinacoes.push({
                  cp_tarefa_tipo: tipoTarefaDoProdutoId,
                  cp_tarefa: tarefaDoProdutoId,
                  cp_subtarefa: subtarefaId,
                  cp_produto: produtoDoClienteId,
                  cp_cliente: clienteId
                });
              });
            } else {
              combinacoes.push({
                cp_tarefa_tipo: tipoTarefaDoProdutoId,
                cp_tarefa: tarefaDoProdutoId,
                cp_subtarefa: subtarefaId,
                cp_produto: produtoId,
                cp_cliente: null
              });
            }
          });
        } else {
          // Se não há subtarefas, criar vinculação apenas com tarefa
          if (clienteId && produtosIds.length > 0) {
            produtosIds.forEach(produtoDoClienteId => {
              combinacoes.push({
                cp_tarefa_tipo: tipoTarefaDoProdutoId,
                cp_tarefa: tarefaDoProdutoId,
                cp_subtarefa: null,
                cp_produto: produtoDoClienteId,
                cp_cliente: clienteId
              });
            });
          } else {
            combinacoes.push({
              cp_tarefa_tipo: tipoTarefaDoProdutoId,
              cp_tarefa: tarefaDoProdutoId,
              cp_subtarefa: null,
              cp_produto: produtoId,
              cp_cliente: null
            });
          }
        }
      }
    }

    // SEÇÃO 4: Cliente → Produtos (sem tipo, sem tarefa, sem produto da seção 3)
    // Aplicar herança: buscar TODAS as vinculações de cada produto e criar as mesmas para o cliente
    if (!tipoTarefaId && !tarefaId && !produtoId && clienteId && produtosIds.length > 0) {
      try {
        // Buscar todas as vinculações existentes dos produtos selecionados
        const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (responseBuscar.ok) {
          const resultBuscar = await responseBuscar.json();
          if (resultBuscar.success && resultBuscar.data) {
            // Para cada produto selecionado
      produtosIds.forEach(produtoDoClienteId => {
              // Buscar todas as vinculações deste produto (sem cliente)
              const vinculadosDoProduto = resultBuscar.data.filter(v => {
                const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
                return vProdutoId === produtoDoClienteId && 
                       !v.cp_cliente; // Apenas vinculações produto (sem cliente)
              });
              
              // Para cada vinculação do produto, criar uma nova vinculação com cliente
              vinculadosDoProduto.forEach(vinculado => {
                combinacoes.push({
                  cp_tarefa_tipo: vinculado.cp_tarefa_tipo ? parseInt(vinculado.cp_tarefa_tipo, 10) : null,
                  cp_tarefa: vinculado.cp_tarefa ? parseInt(vinculado.cp_tarefa, 10) : null,
                  cp_subtarefa: vinculado.cp_subtarefa ? parseInt(vinculado.cp_subtarefa, 10) : null,
                  cp_produto: produtoDoClienteId,
                  cp_cliente: clienteId
                });
              });
              
              // Se não há vinculações do produto (apenas produto sem tarefas), criar vinculação simples
              if (vinculadosDoProduto.length === 0) {
        combinacoes.push({
          cp_tarefa_tipo: null,
          cp_tarefa: null,
          cp_subtarefa: null,
          cp_produto: produtoDoClienteId,
          cp_cliente: clienteId
        });
              }
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar vinculações dos produtos para aplicar herança na Seção 4:', error);
        // Em caso de erro, criar apenas vinculações simples (sem herança)
        produtosIds.forEach(produtoDoClienteId => {
          combinacoes.push({
            cp_tarefa_tipo: null,
            cp_tarefa: null,
            cp_subtarefa: null,
            cp_produto: produtoDoClienteId,
            cp_cliente: clienteId
          });
      });
      }
    }

    // Filtrar combinações vazias (onde todos os campos são null)
    return combinacoes.filter(combinacao => {
      return combinacao.cp_tarefa_tipo !== null ||
             combinacao.cp_tarefa !== null ||
             combinacao.cp_subtarefa !== null ||
             combinacao.cp_produto !== null ||
             combinacao.cp_cliente !== null;
    });
  };

  // Função individual para salvar Seção 1: Tipo de Tarefa → Tarefas
  // ABORDAGEM SIMPLIFICADA: Remover tudo e recriar conforme seleção atual
  const handleSaveSecao1 = async () => {
    if (!tipoTarefaSelecionado || tarefasDoTipoSelecionadas.length === 0) {
      showToast('warning', 'Selecione um tipo de tarefa e pelo menos uma tarefa.');
      return;
    }

    setSavingSecao1(true);
    try {
      console.log('📊 Seção 1 - Iniciando salvamento:', {
        tipoTarefaId: tipoTarefaSelecionado,
        tarefasSelecionadas: tarefasDoTipoSelecionadas
      });

      // 1. BUSCAR todas as vinculações existentes deste tipo de tarefa (sem produto, sem cliente, sem subtarefa)
      let vinculadosExistentes = [];
      try {
        const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (responseBuscar.ok) {
          const resultBuscar = await responseBuscar.json();
          if (resultBuscar.success && resultBuscar.data) {
            vinculadosExistentes = resultBuscar.data.filter(v => {
              const vTipoId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
              return vTipoId === tipoTarefaSelecionado && 
                     !v.cp_produto && 
                     !v.cp_cliente && 
                     !v.cp_subtarefa;
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar vinculações existentes:', error);
        showToast('error', 'Erro ao buscar vinculações existentes. Tente novamente.');
        setSavingSecao1(false);
        return;
      }

      // 2. REMOVER todas as vinculações existentes
      if (vinculadosExistentes.length > 0) {
        console.log(`🗑️ Removendo ${vinculadosExistentes.length} vinculação(ões) existente(s)`);
        for (const vinculado of vinculadosExistentes) {
          try {
            const responseDelete = await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (!responseDelete.ok) {
              console.warn(`⚠️ Erro ao deletar vinculado ${vinculado.id}:`, responseDelete.status);
            }
          } catch (error) {
            console.error(`❌ Erro ao deletar vinculado ${vinculado.id}:`, error);
          }
        }
        console.log(`✅ ${vinculadosExistentes.length} vinculação(ões) removida(s)`);
      }

      // 3. CRIAR novas vinculações baseadas na seleção atual
      const novasCombinacoes = tarefasDoTipoSelecionadas.map(tarefaId => ({
        cp_tarefa_tipo: tipoTarefaSelecionado,
        cp_tarefa: tarefaId,
        cp_subtarefa: null,
        cp_produto: null,
        cp_cliente: null
      }));

      // 4. SALVAR novas vinculações
      if (novasCombinacoes.length > 0) {
        console.log(`💾 Salvando ${novasCombinacoes.length} nova(s) vinculação(ões)`);
        
        if (onSubmit) {
          await onSubmit(novasCombinacoes);
        } else {
          const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              vinculados: novasCombinacoes
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro na resposta da API:', response.status, errorData);
            showToast('error', errorData.error || `Erro ${response.status}: ${response.statusText}`);
            setSavingSecao1(false);
            return;
          }
          
          const result = await response.json().catch(() => ({}));
          console.log('✅ Vinculações criadas com sucesso:', result);
        }
        
        showToast('success', `Seção 1 salva com sucesso! ${novasCombinacoes.length} vinculação(ões) criada(s).`);
      } else {
        console.log('ℹ️ Nenhuma vinculação para criar');
        showToast('info', 'Nenhuma vinculação para criar.');
      }

      // 5. Atualizar estado original
      setTarefasVinculadasOriginalmente(tarefasDoTipoSelecionadas);
      
      // 6. Atualizar todos os componentes relacionados
      await atualizarTodosComponentesRelacionados();
      
    } catch (error) {
      console.error('❌ Erro inesperado ao salvar Seção 1:', error);
      showToast('error', `Erro ao salvar Seção 1: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSavingSecao1(false);
    }
  };

  // Função individual para salvar Seção 2: Tarefa → Subtarefas
  // ABORDAGEM SIMPLIFICADA: Remover tudo e recriar conforme seleção atual
  const handleSaveSecao2 = async () => {
    if (!tarefaSelecionada || subtarefasDaTarefaSelecionadas.length === 0) {
      showToast('warning', 'Selecione uma tarefa e pelo menos uma subtarefa.');
      return;
    }

    setSavingSecao2(true);
    try {
      console.log('📊 Seção 2 - Iniciando salvamento:', {
        tarefaId: tarefaSelecionada,
        tipoTarefaId: tipoTarefaDaTarefaSelecionada,
        subtarefasSelecionadas: subtarefasDaTarefaSelecionadas
      });

      // 1. BUSCAR todas as vinculações existentes desta tarefa (sem produto, sem cliente, com subtarefa)
      let vinculadosExistentes = [];
      try {
        const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_atividade=true&filtro_subtarefa=true&limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (responseBuscar.ok) {
          const resultBuscar = await responseBuscar.json();
          if (resultBuscar.success && resultBuscar.data) {
            vinculadosExistentes = resultBuscar.data.filter(v => {
              const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
              const vTipoTarefaId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
              return vTarefaId === tarefaSelecionada && 
                     vTipoTarefaId === tipoTarefaDaTarefaSelecionada &&
                     v.cp_subtarefa &&
                     !v.cp_produto && 
                     !v.cp_cliente;
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar vinculações existentes:', error);
        showToast('error', 'Erro ao buscar vinculações existentes. Tente novamente.');
        setSavingSecao2(false);
        return;
      }

      // 2. REMOVER todas as vinculações existentes
      if (vinculadosExistentes.length > 0) {
        console.log(`🗑️ Removendo ${vinculadosExistentes.length} vinculação(ões) existente(s)`);
        for (const vinculado of vinculadosExistentes) {
          try {
            const responseDelete = await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (!responseDelete.ok) {
              console.warn(`⚠️ Erro ao deletar vinculado ${vinculado.id}:`, responseDelete.status);
            }
          } catch (error) {
            console.error(`❌ Erro ao deletar vinculado ${vinculado.id}:`, error);
          }
        }
        console.log(`✅ ${vinculadosExistentes.length} vinculação(ões) removida(s)`);
      }

      // 3. CRIAR novas vinculações baseadas na seleção atual
      const novasCombinacoes = subtarefasDaTarefaSelecionadas.map(subtarefaId => ({
        cp_tarefa_tipo: tipoTarefaDaTarefaSelecionada,
        cp_tarefa: tarefaSelecionada,
        cp_subtarefa: subtarefaId,
        cp_produto: null,
        cp_cliente: null
      }));

      // 4. SALVAR novas vinculações
      if (novasCombinacoes.length > 0) {
        console.log(`💾 Salvando ${novasCombinacoes.length} nova(s) vinculação(ões)`);
        
        if (onSubmit) {
          await onSubmit(novasCombinacoes);
        } else {
          const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              vinculados: novasCombinacoes
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro na resposta da API:', response.status, errorData);
            showToast('error', errorData.error || `Erro ${response.status}: ${response.statusText}`);
            setSavingSecao2(false);
            return;
          }
          
          const result = await response.json().catch(() => ({}));
          console.log('✅ Vinculações criadas com sucesso:', result);
        }
        
        showToast('success', `Seção 2 salva com sucesso! ${novasCombinacoes.length} vinculação(ões) criada(s).`);
      } else {
        console.log('ℹ️ Nenhuma vinculação para criar');
        showToast('info', 'Nenhuma vinculação para criar.');
      }

      // 5. Atualizar estado original
      setSubtarefasVinculadasOriginalmente(subtarefasDaTarefaSelecionadas);
      
      // 6. Atualizar todos os componentes relacionados
      await atualizarTodosComponentesRelacionados();
      
    } catch (error) {
      console.error('❌ Erro inesperado ao salvar Seção 2:', error);
      showToast('error', `Erro ao salvar Seção 2: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSavingSecao2(false);
    }
  };

  // Função individual para salvar Seção 3: Produto → Tarefas
  // ABORDAGEM SIMPLIFICADA: Remover tudo e recriar conforme seleção atual
  const handleSaveSecao3 = async () => {
    if (!produtoSelecionado || tarefasDoProdutoSelecionadas.length === 0) {
      showToast('warning', 'Selecione um produto e pelo menos uma tarefa.');
      return;
    }

    setSavingSecao3(true);
    try {
      console.log('📊 Seção 3 - Iniciando salvamento:', {
        produtoId: produtoSelecionado,
        tarefasSelecionadas: tarefasDoProdutoSelecionadas
      });

      // 1. BUSCAR todas as vinculações existentes deste produto (sem cliente)
      let vinculadosExistentes = [];
      try {
        const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (responseBuscar.ok) {
          const resultBuscar = await responseBuscar.json();
          if (resultBuscar.success && resultBuscar.data) {
            vinculadosExistentes = resultBuscar.data.filter(v => {
              const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
              return vProdutoId === produtoSelecionado && !v.cp_cliente;
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar vinculações existentes:', error);
        showToast('error', 'Erro ao buscar vinculações existentes. Tente novamente.');
        setSavingSecao3(false);
        return;
      }

      // 2. REMOVER todas as vinculações existentes
      if (vinculadosExistentes.length > 0) {
        console.log(`🗑️ Removendo ${vinculadosExistentes.length} vinculação(ões) existente(s)`);
        for (const vinculado of vinculadosExistentes) {
          try {
            const responseDelete = await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (!responseDelete.ok) {
              console.warn(`⚠️ Erro ao deletar vinculado ${vinculado.id}:`, responseDelete.status);
            }
          } catch (error) {
            console.error(`❌ Erro ao deletar vinculado ${vinculado.id}:`, error);
          }
        }
        console.log(`✅ ${vinculadosExistentes.length} vinculação(ões) removida(s)`);
      }

      // 3. CRIAR novas vinculações baseadas na seleção atual
      const novasCombinacoes = [];
      
      for (const chaveComposta of tarefasDoProdutoSelecionadas) {
        const [tarefaIdStr, tipoTarefaIdStr] = chaveComposta.split('-');
        const tarefaId = parseInt(tarefaIdStr, 10);
        const tipoTarefaId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
        
        // Buscar subtarefas desta tarefa
        let subtarefasDaTarefa = [];
        try {
          let url = `${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}`;
          if (tipoTarefaId !== null) {
            url += `&tarefaTipoId=${tipoTarefaId}`;
          }
          if (produtoSelecionado) {
            url += `&produtoId=${produtoSelecionado}`;
          }
          
          const responseSubtarefas = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          
          if (responseSubtarefas.ok) {
            const resultSubtarefas = await responseSubtarefas.json();
            if (resultSubtarefas.success && resultSubtarefas.data) {
              subtarefasDaTarefa = resultSubtarefas.data.map(st => st.id);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar subtarefas da tarefa:', error);
        }
        
        // Se a tarefa tem subtarefas, criar vinculação para cada subtarefa
        if (subtarefasDaTarefa.length > 0) {
          subtarefasDaTarefa.forEach(subtarefaId => {
            novasCombinacoes.push({
              cp_tarefa_tipo: tipoTarefaId,
              cp_tarefa: tarefaId,
              cp_subtarefa: subtarefaId,
              cp_produto: produtoSelecionado,
              cp_cliente: null
            });
          });
        } else {
          // Tarefa sem subtarefas, criar apenas com tarefa
          novasCombinacoes.push({
            cp_tarefa_tipo: tipoTarefaId,
            cp_tarefa: tarefaId,
            cp_subtarefa: null,
            cp_produto: produtoSelecionado,
            cp_cliente: null
          });
        }
      }

      // 4. SALVAR novas vinculações
      if (novasCombinacoes.length > 0) {
        console.log(`💾 Salvando ${novasCombinacoes.length} nova(s) vinculação(ões)`);
        
        if (onSubmit) {
          await onSubmit(novasCombinacoes);
        } else {
          const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              vinculados: novasCombinacoes
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro na resposta da API:', response.status, errorData);
            showToast('error', errorData.error || `Erro ${response.status}: ${response.statusText}`);
            setSavingSecao3(false);
            return;
          }
          
          const result = await response.json().catch(() => ({}));
          console.log('✅ Vinculações criadas com sucesso:', result);
        }
        
        showToast('success', `Seção 3 salva com sucesso! ${novasCombinacoes.length} vinculação(ões) criada(s).`);
      } else {
        console.log('ℹ️ Nenhuma vinculação para criar');
        showToast('info', 'Nenhuma vinculação para criar.');
      }

      // 5. Atualizar estado original
      setTarefasDoProdutoVinculadasOriginalmente(tarefasDoProdutoSelecionadas);
      
      // 6. Atualizar todos os componentes relacionados
      await atualizarTodosComponentesRelacionados();
      
    } catch (error) {
      console.error('Erro ao salvar Seção 3:', error);
      showToast('error', 'Erro ao salvar Seção 3. Tente novamente.');
    } finally {
      setSavingSecao3(false);
    }
  };

  // Função individual para salvar Seção 4: Cliente → Produtos
  // ABORDAGEM SIMPLIFICADA: Remover tudo e recriar conforme seleção atual
  const handleSaveSecao4 = async () => {
    if (!clienteSelecionado || produtosDoClienteSelecionados.length === 0) {
      showToast('warning', 'Selecione um cliente e pelo menos um produto.');
      return;
    }

    setSavingSecao4(true);
    try {
      const clienteIdStr = String(clienteSelecionado).trim();
      
      console.log('📊 Seção 4 - Iniciando salvamento:', {
        clienteId: clienteIdStr,
        produtosSelecionados: produtosDoClienteSelecionados,
        tarefasSelecionadas: Object.keys(tarefasSelecionadasPorProdutoSecao4).length
      });

      // 1. BUSCAR todas as vinculações existentes do cliente (para os produtos selecionados)
      // IMPORTANTE: Remover TODAS as vinculações, independente de serem exceções ou padrão
      // Depois recriaremos apenas as que estão selecionadas
      let vinculadosExistentes = [];
      try {
        const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_cliente=true&limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (responseBuscar.ok) {
          const resultBuscar = await responseBuscar.json();
          if (resultBuscar.success && resultBuscar.data) {
            // Filtrar apenas vinculações deste cliente e dos produtos selecionados
            // IMPORTANTE: Incluir TODAS as vinculações (exceções e padrão) para remoção
            vinculadosExistentes = resultBuscar.data.filter(v => {
              const vClienteId = String(v.cp_cliente || '').trim();
              const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
              const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
              // Incluir vinculações que têm cliente, produto e tarefa (exceções e padrão)
              return vClienteId === clienteIdStr && 
                     vProdutoId && 
                     produtosDoClienteSelecionados.includes(vProdutoId) &&
                     vTarefaId; // Apenas vinculações com tarefa (não produto-cliente direto)
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar vinculações existentes:', error);
        showToast('error', 'Erro ao buscar vinculações existentes. Tente novamente.');
        setSavingSecao4(false);
        return;
      }

      // 2. REMOVER todas as vinculações existentes (exceções e padrão)
      // IMPORTANTE: Remover TODAS, independente de serem exceções ou padrão
      // Depois recriaremos apenas as que estão selecionadas no estado atual
      if (vinculadosExistentes.length > 0) {
        console.log(`🗑️ Removendo ${vinculadosExistentes.length} vinculação(ões) existente(s) (exceções e padrão)`);
        for (const vinculado of vinculadosExistentes) {
          try {
            const responseDelete = await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (!responseDelete.ok) {
              console.warn(`⚠️ Erro ao deletar vinculado ${vinculado.id}:`, responseDelete.status);
            }
          } catch (error) {
            console.error(`❌ Erro ao deletar vinculado ${vinculado.id}:`, error);
          }
        }
        console.log(`✅ ${vinculadosExistentes.length} vinculação(ões) removida(s)`);
      }

      // 3. CRIAR novas vinculações baseadas na seleção atual (apenas relacionamentos marcados)
      // IMPORTANTE: Apenas salvar relacionamentos Cliente → Produto → Tarefa → Subtarefa que foram marcados
      const novasCombinacoes = [];
      
      // Buscar tarefas dos produtos para obter tipos de tarefa
      const responseTarefas = await fetch(`${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteIdStr}&produtoIds=${produtosDoClienteSelecionados.join(',')}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      
      let tarefasPorProdutoData = {};
      if (responseTarefas.ok) {
        const resultTarefas = await responseTarefas.json().catch(() => ({ success: false, data: [] }));
        if (resultTarefas.success && resultTarefas.data) {
          resultTarefas.data.forEach(item => {
            tarefasPorProdutoData[item.produtoId] = item.tarefas || [];
          });
        }
      }
      
      // Processar cada produto selecionado
      for (const produtoId of produtosDoClienteSelecionados) {
        const tarefasDoProduto = tarefasPorProdutoData[produtoId] || [];
        
        // Verificar se há tarefas selecionadas para este produto
        const tarefasSelecionadasMap = tarefasSelecionadasPorProdutoSecao4[produtoId] || {};
        
        console.log(`📊 Processando produto ${produtoId}:`, {
          tarefasNaAPI: tarefasDoProduto.length,
          tarefasNoEstado: Object.keys(tarefasSelecionadasMap).length,
          tarefasSelecionadasMap: tarefasSelecionadasMap
        });
        
        // Criar um mapa de tarefas da API para acesso rápido
        const tarefasDoProdutoMap = new Map();
        tarefasDoProduto.forEach(tarefa => {
          tarefasDoProdutoMap.set(tarefa.id, tarefa);
        });
        
        // Obter tarefas selecionadas (incluindo tarefas que podem não estar na API ainda, como exceções recém-adicionadas)
        const tarefasSelecionadas = [];
        
        // 1. Processar tarefas que estão na API
        tarefasDoProduto.forEach(tarefa => {
          const dados = tarefasSelecionadasMap[tarefa.id];
          if (typeof dados === 'object' && dados !== null) {
            if (dados.selecionada === true) {
              tarefasSelecionadas.push({
                tarefaId: tarefa.id,
                tipoTarefa: tarefa.tipoTarefa,
                subtarefas: dados.subtarefas || []
              });
            }
          } else if (dados === true) {
            tarefasSelecionadas.push({
              tarefaId: tarefa.id,
              tipoTarefa: tarefa.tipoTarefa,
              subtarefas: []
            });
          }
        });
        
        // 2. Processar tarefas que estão no estado mas não estão na API (exceções recém-adicionadas)
        // IMPORTANTE: Tarefas adicionadas como exceção podem não estar na API ainda, mas devem ser salvas
        Object.entries(tarefasSelecionadasMap).forEach(([tarefaIdStr, dados]) => {
          const tarefaId = parseInt(tarefaIdStr, 10);
          // Se a tarefa não está na API mas está marcada como selecionada, incluir
          if (!tarefasDoProdutoMap.has(tarefaId)) {
            const estaSelecionada = typeof dados === 'object' && dados !== null 
              ? dados.selecionada === true 
              : dados === true;
            
            if (estaSelecionada) {
              console.log(`📌 Incluindo tarefa ${tarefaId} que está no estado mas não está na API (exceção recém-adicionada)`, dados);
              
              // Priorizar tipo de tarefa do estado (preservado quando a tarefa foi adicionada como exceção)
              let tipoTarefaEncontrado = null;
              if (typeof dados === 'object' && dados !== null && dados.tipoTarefa) {
                // Tipo de tarefa já está no estado (preservado quando adicionada como exceção)
                tipoTarefaEncontrado = dados.tipoTarefa;
                console.log(`  ✅ Tipo de tarefa encontrado no estado:`, tipoTarefaEncontrado);
              } else {
                // Fallback: Buscar tipo de tarefa da tarefa nas tarefas carregadas
                const tarefaEncontrada = tarefas.find(t => t.id === tarefaId);
                if (tarefaEncontrada) {
                  const tipoTarefaId = tarefaEncontrada.tipoatividade_id || tarefaEncontrada.tipo_tarefa_id || null;
                  if (tipoTarefaId) {
                    const tipoTarefaObj = tiposTarefa.find(tt => tt.id === tipoTarefaId);
                    if (tipoTarefaObj) {
                      tipoTarefaEncontrado = { id: tipoTarefaId, nome: tipoTarefaObj.nome };
                      console.log(`  ✅ Tipo de tarefa encontrado nas tarefas carregadas:`, tipoTarefaEncontrado);
                    }
                  }
                }
              }
              
              if (!tipoTarefaEncontrado) {
                console.warn(`  ⚠️ Tipo de tarefa não encontrado para tarefa ${tarefaId}`);
              }
              
              tarefasSelecionadas.push({
                tarefaId: tarefaId,
                tipoTarefa: tipoTarefaEncontrado,
                subtarefas: typeof dados === 'object' && dados !== null ? (dados.subtarefas || []) : []
              });
            }
          }
        });
        
        console.log(`✅ Produto ${produtoId}: ${tarefasSelecionadas.length} tarefa(s) selecionada(s) para salvar`, tarefasSelecionadas.map(t => ({ 
          tarefaId: t.tarefaId, 
          tipoTarefa: t.tipoTarefa?.id || t.tipoTarefa, 
          subtarefas: t.subtarefas?.length || 0,
          subtarefasIds: t.subtarefas || []
        })));
        
        // Criar vinculações para tarefas selecionadas
        if (tarefasSelecionadas.length > 0) {
          tarefasSelecionadas.forEach(({ tarefaId, tipoTarefa, subtarefas }) => {
            // Determinar tipo de tarefa
            let tipoTarefaId = null;
            if (tipoTarefa) {
              // tipoTarefa pode ser um objeto {id, nome} ou um número/string
              if (typeof tipoTarefa === 'object' && tipoTarefa !== null) {
                tipoTarefaId = tipoTarefa.id || null;
              } else {
                tipoTarefaId = tipoTarefa;
              }
            }
            
            console.log(`  📝 Criando vinculação para tarefa ${tarefaId} (tipo: ${tipoTarefaId}, subtarefas: ${subtarefas?.length || 0})`, {
              subtarefasIds: subtarefas || [],
              detalhes: subtarefas && subtarefas.length > 0 ? `Criando ${subtarefas.length} vínculo(s) de subtarefa(s)` : 'Criando vínculo apenas da tarefa (sem subtarefas)'
            });
            
            if (subtarefas && subtarefas.length > 0) {
              // Criar vínculo para cada subtarefa selecionada
              subtarefas.forEach(subtarefaId => {
                novasCombinacoes.push({
                  cp_tarefa_tipo: tipoTarefaId,
                  cp_tarefa: tarefaId,
                  cp_subtarefa: subtarefaId,
                  cp_produto: produtoId,
                  cp_cliente: clienteIdStr
                });
              });
            } else {
              // Tarefa sem subtarefas selecionadas, criar apenas com tarefa
              novasCombinacoes.push({
                cp_tarefa_tipo: tipoTarefaId,
                cp_tarefa: tarefaId,
                cp_subtarefa: null,
                cp_produto: produtoId,
                cp_cliente: clienteIdStr
              });
            }
          });
        } else {
          console.log(`  ⚠️ Nenhuma tarefa selecionada para o produto ${produtoId}`);
        }
        // IMPORTANTE: Não criar vínculo produto-cliente direto (sem tarefa)
        // Produto não é vinculado diretamente ao cliente como padrão
        // Apenas relacionamentos Cliente → Produto → Tarefa → Subtarefa são permitidos
      }

      // 5. SALVAR novas vinculações
      console.log(`📊 Total de novas combinações a salvar: ${novasCombinacoes.length}`, novasCombinacoes.map(c => ({ tarefa: c.cp_tarefa, tipo: c.cp_tarefa_tipo, subtarefa: c.cp_subtarefa, produto: c.cp_produto, cliente: c.cp_cliente })));
      if (novasCombinacoes.length > 0) {
        console.log(`💾 Salvando ${novasCombinacoes.length} nova(s) vinculação(ões)`);
        
        if (onSubmit) {
          await onSubmit(novasCombinacoes);
        } else {
          const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              vinculados: novasCombinacoes
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Erro na resposta da API:', response.status, errorData);
            showToast('error', errorData.error || `Erro ${response.status}: ${response.statusText}`);
            setSavingSecao4(false);
            return;
          }
          
          const result = await response.json().catch(() => ({}));
          console.log('✅ Vinculações criadas com sucesso:', result);
        }
        
        showToast('success', `Seção 4 salva com sucesso! ${novasCombinacoes.length} vinculação(ões) criada(s).`);
      } else {
        console.log('ℹ️ Nenhuma vinculação para criar');
        showToast('info', 'Nenhuma vinculação para criar.');
      }

      // 6. Atualizar estado original
      setProdutosDoClienteVinculadosOriginalmente(produtosDoClienteSelecionados);
      
      // 7. Atualizar todos os componentes relacionados
      await atualizarTodosComponentesRelacionados();
      
    } catch (error) {
      console.error('❌ Erro inesperado ao salvar Seção 4:', error);
      showToast('error', `Erro ao salvar Seção 4: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSavingSecao4(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que pelo menos uma seção tem seleções
    const temSelecoes = 
      (tipoTarefaSelecionado && tarefasDoTipoSelecionadas.length > 0) ||
      (tarefaSelecionada && subtarefasDaTarefaSelecionadas.length > 0) ||
      (produtoSelecionado && tarefasDoProdutoSelecionadas.length > 0) ||
      (clienteSelecionado && produtosDoClienteSelecionados.length > 0);

    if (!temSelecoes) {
      showToast('warning', 'Selecione pelo menos um item em uma das seções.');
      return;
    }

    // SEÇÃO 1: Tipo de Tarefa → Tarefas
    // Detectar automaticamente se está criando, editando ou removendo
    if (tipoTarefaSelecionado && tarefasDoTipoSelecionadas.length > 0) {
      // Comparar estado atual com estado original para detectar mudanças
      const tarefasAtuais = new Set(tarefasDoTipoSelecionadas);
      const tarefasOriginais = new Set(tarefasVinculadasOriginalmente);
      
      // Tarefas novas (para criar) - apenas as que NÃO estavam na lista original
      const tarefasNovas = tarefasDoTipoSelecionadas.filter(id => !tarefasOriginais.has(id));
      
      // Tarefas removidas (para deletar) - as que estavam na original mas não estão mais
      const tarefasRemovidas = tarefasVinculadasOriginalmente.filter(id => !tarefasAtuais.has(id));
      
      console.log('📊 Seção 1 - Tipo de Tarefa → Tarefas:', {
        tipoTarefaId: tipoTarefaSelecionado,
        modo: tarefasVinculadasOriginalmente.length > 0 ? 'EDITAR' : 'CRIAR',
        originais: tarefasVinculadasOriginalmente,
        atuais: tarefasDoTipoSelecionadas,
        novas: tarefasNovas,
        removidas: tarefasRemovidas
      });

      // Se não há mudanças, não fazer nada
      if (tarefasNovas.length === 0 && tarefasRemovidas.length === 0) {
        console.log('ℹ️ Nenhuma alteração na Seção 1, continuando...');
        // Não retornar, deixar continuar para outras seções
      } else {
        // Há mudanças para processar
        
        // 1. REMOVER vinculações desmarcadas (se houver)
        if (tarefasRemovidas.length > 0) {
          try {
            // Buscar IDs dos vinculados para deletar
            const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&limit=1000`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (responseBuscar.ok) {
              const resultBuscar = await responseBuscar.json();
              if (resultBuscar.success && resultBuscar.data) {
                const vinculadosParaDeletar = resultBuscar.data.filter(v => {
                  const vTipoId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
                  const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
                  return vTipoId === tipoTarefaSelecionado && 
                         vTarefaId && 
                         tarefasRemovidas.includes(vTarefaId) &&
                         !v.cp_produto && 
                         !v.cp_cliente && 
                         !v.cp_subtarefa; // Apenas vinculações simples tipo-tarefa
                });

                // Deletar cada vinculado
                for (const vinculado of vinculadosParaDeletar) {
                  await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                }
                
                console.log(`✅ ${vinculadosParaDeletar.length} vinculação(ões) removida(s)`);
              }
            }
          } catch (error) {
            console.error('Erro ao remover vinculações:', error);
            showToast('error', 'Erro ao remover vinculações. Tente novamente.');
            return;
          }
        }

        // 2. CRIAR novas vinculações (se houver)
        if (tarefasNovas.length > 0) {
          const novasCombinacoes = tarefasNovas.map(tarefaId => ({
            cp_tarefa_tipo: tipoTarefaSelecionado,
            cp_tarefa: tarefaId,
            cp_subtarefa: null,
            cp_produto: null,
            cp_cliente: null
          }));
          
          console.log('📋 Criando novas vinculações:', novasCombinacoes);
          
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setTarefasVinculadasOriginalmente(tarefasDoTipoSelecionadas);
          
          // Chamar onSubmit (os dados serão recarregados quando o usuário interagir com o componente)
          await onSubmit(novasCombinacoes);
          
          return;
        } else {
          // Apenas removemos, sem criar novas
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setTarefasVinculadasOriginalmente(tarefasDoTipoSelecionadas);
          
          showToast('success', 'Vinculação atualizada com sucesso!');
          return;
        }
      }
    }

    // SEÇÃO 2: Tarefa → Subtarefas
    // Detectar automaticamente se está criando, editando ou removendo
    if (tarefaSelecionada && subtarefasDaTarefaSelecionadas.length > 0) {
      // Comparar estado atual com estado original para detectar mudanças
      const subtarefasAtuais = new Set(subtarefasDaTarefaSelecionadas);
      const subtarefasOriginais = new Set(subtarefasVinculadasOriginalmente);
      
      // Subtarefas novas (para criar) - apenas as que NÃO estavam na lista original
      const subtarefasNovas = subtarefasDaTarefaSelecionadas.filter(id => !subtarefasOriginais.has(id));
      
      // Subtarefas removidas (para deletar) - as que estavam na original mas não estão mais
      const subtarefasRemovidas = subtarefasVinculadasOriginalmente.filter(id => !subtarefasAtuais.has(id));
      
      console.log('📊 Seção 2 - Tarefa → Subtarefas:', {
        tarefaId: tarefaSelecionada,
        modo: subtarefasVinculadasOriginalmente.length > 0 ? 'EDITAR' : 'CRIAR',
        originais: subtarefasVinculadasOriginalmente,
        atuais: subtarefasDaTarefaSelecionadas,
        novas: subtarefasNovas,
        removidas: subtarefasRemovidas
      });

      // Se não há mudanças, não fazer nada
      if (subtarefasNovas.length === 0 && subtarefasRemovidas.length === 0) {
        console.log('ℹ️ Nenhuma alteração na Seção 2, continuando...');
        // Não retornar, deixar continuar para outras seções
      } else {
        // Há mudanças para processar
        
        // 1. REMOVER vinculações desmarcadas (se houver)
        if (subtarefasRemovidas.length > 0) {
          try {
            // Buscar IDs dos vinculados para deletar
            const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_atividade=true&filtro_subtarefa=true&limit=1000`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (responseBuscar.ok) {
              const resultBuscar = await responseBuscar.json();
              if (resultBuscar.success && resultBuscar.data) {
                const vinculadosParaDeletar = resultBuscar.data.filter(v => {
                  const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
                  const vTipoTarefaId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
                  const vSubtarefaId = v.cp_subtarefa ? parseInt(v.cp_subtarefa, 10) : null;
                  return vTarefaId === tarefaSelecionada && 
                         vTipoTarefaId === tipoTarefaDaTarefaSelecionada &&
                         vSubtarefaId && 
                         subtarefasRemovidas.includes(vSubtarefaId) &&
                         !v.cp_produto && 
                         !v.cp_cliente; // Deve ter tipo_tarefa_id correspondente, mas não deve ter produto nem cliente
                });

                // Deletar cada vinculado
                for (const vinculado of vinculadosParaDeletar) {
                  await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                }
                
                console.log(`✅ ${vinculadosParaDeletar.length} vinculação(ões) removida(s) da Seção 2`);
              }
            }
          } catch (error) {
            console.error('Erro ao remover vinculações da Seção 2:', error);
            showToast('error', 'Erro ao remover vinculações. Tente novamente.');
            return;
          }
        }

        // 2. CRIAR novas vinculações (se houver)
        if (subtarefasNovas.length > 0) {
          // Usar o tipo de tarefa já capturado na seleção
          const novasCombinacoes = subtarefasNovas.map(subtarefaId => ({
            cp_tarefa_tipo: tipoTarefaDaTarefaSelecionada,
            cp_tarefa: tarefaSelecionada,
            cp_subtarefa: subtarefaId,
            cp_produto: null,
            cp_cliente: null
          }));
          
          console.log('📋 Criando novas vinculações Seção 2:', novasCombinacoes);
          
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setSubtarefasVinculadasOriginalmente(subtarefasDaTarefaSelecionadas);
          
          // Chamar onSubmit (os dados serão recarregados quando o usuário interagir com o componente)
          await onSubmit(novasCombinacoes);
          
          return;
        } else {
          // Apenas removemos, sem criar novas
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setSubtarefasVinculadasOriginalmente(subtarefasDaTarefaSelecionadas);
          
          showToast('success', 'Vinculação atualizada com sucesso!');
          return;
        }
      }
    }

    // SEÇÃO 3: Produto → Tarefas
    // Detectar automaticamente se está criando, editando ou removendo
    if (produtoSelecionado && tarefasDoProdutoSelecionadas.length > 0) {
      // Comparar estado atual com estado original para detectar mudanças
      const tarefasAtuais = new Set(tarefasDoProdutoSelecionadas);
      const tarefasOriginais = new Set(tarefasDoProdutoVinculadasOriginalmente);
      
      // Tarefas novas (para criar) - apenas as que NÃO estavam na lista original
      const tarefasNovas = tarefasDoProdutoSelecionadas.filter(chave => !tarefasOriginais.has(chave));
      
      // Tarefas existentes (para atualizar) - as que estão tanto na lista atual quanto na original
      const tarefasExistentes = tarefasDoProdutoSelecionadas.filter(chave => tarefasOriginais.has(chave));
      
      // Tarefas removidas (para deletar) - as que estavam na original mas não estão mais
      const tarefasRemovidas = tarefasDoProdutoVinculadasOriginalmente.filter(chave => !tarefasAtuais.has(chave));
      
      console.log('📊 Seção 3 - Produto → Tarefas:', {
        produtoId: produtoSelecionado,
        modo: tarefasDoProdutoVinculadasOriginalmente.length > 0 ? 'EDITAR' : 'CRIAR',
        originais: tarefasDoProdutoVinculadasOriginalmente,
        atuais: tarefasDoProdutoSelecionadas,
        novas: tarefasNovas,
        existentes: tarefasExistentes,
        removidas: tarefasRemovidas
      });

      // Se não há mudanças, não fazer nada
      if (tarefasNovas.length === 0 && tarefasRemovidas.length === 0 && tarefasExistentes.length === 0) {
        console.log('ℹ️ Nenhuma alteração na Seção 3, continuando...');
        // Não retornar, deixar continuar para outras seções
      } else {
        // Há mudanças para processar
        
        // 1. REMOVER vinculações desmarcadas (se houver)
        // IMPORTANTE: Remover TODAS as vinculações relacionadas (tarefa + todas suas subtarefas)
        if (tarefasRemovidas.length > 0) {
          try {
            // Buscar IDs dos vinculados para deletar
            const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (responseBuscar.ok) {
              const resultBuscar = await responseBuscar.json();
              if (resultBuscar.success && resultBuscar.data) {
                // Para cada tarefa removida, extrair o ID da tarefa
                const tarefasIdsRemovidas = tarefasRemovidas.map(chave => {
                  const [tarefaIdStr] = chave.split('-');
                  return parseInt(tarefaIdStr, 10);
                });
                
                // Filtrar vinculados que devem ser deletados:
                // - Do produto selecionado
                // - Da tarefa removida (incluindo todas suas subtarefas)
                // - Sem cliente
                const vinculadosParaDeletar = resultBuscar.data.filter(v => {
                  const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
                  const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
                  
                  return vProdutoId === produtoSelecionado && 
                         vTarefaId && 
                         tarefasIdsRemovidas.includes(vTarefaId) &&
                         !v.cp_cliente;
                });

                // Deletar cada vinculado (incluindo tarefa e subtarefas)
                for (const vinculado of vinculadosParaDeletar) {
                  await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                }
                
                console.log(`✅ ${vinculadosParaDeletar.length} vinculação(ões) removida(s) da Seção 3 (incluindo subtarefas)`);
              }
            }
          } catch (error) {
            console.error('Erro ao remover vinculações da Seção 3:', error);
            showToast('error', 'Erro ao remover vinculações. Tente novamente.');
            return;
          }
        }

        // 2. ATUALIZAR vinculações existentes (se houver)
        // IMPORTANTE: Garantir que TODAS as subtarefas sejam vinculadas corretamente
        if (tarefasExistentes.length > 0) {
          try {
            // Buscar vinculados existentes para atualizar
            const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_produto=true&limit=1000`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (responseBuscar.ok) {
              const resultBuscar = await responseBuscar.json();
              if (resultBuscar.success && resultBuscar.data) {
                // Para cada tarefa existente, atualizar suas vinculações
                for (const chaveComposta of tarefasExistentes) {
                  // Extrair tarefaId e tipoTarefaId da chave composta
                  const [tarefaIdStr, tipoTarefaIdStr] = chaveComposta.split('-');
                  const tarefaId = parseInt(tarefaIdStr, 10);
                  const tipoTarefaId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
                  
                  // Buscar subtarefas desta tarefa (combinando tarefa_id + tarefa_tipo_id)
                  let subtarefasDaTarefa = [];
                  try {
                    // Passar tarefaId, tipoTarefaId e produtoId para buscar subtarefas da combinação específica
                    let url = `${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}`;
                    if (tipoTarefaId !== null) {
                      url += `&tarefaTipoId=${tipoTarefaId}`;
                    }
                    if (produtoSelecionado) {
                      url += `&produtoId=${produtoSelecionado}`;
                    }
                    
                    const responseSubtarefas = await fetch(url, {
                      credentials: 'include',
                      headers: { 'Accept': 'application/json' }
                    });
                    
                    if (responseSubtarefas.ok) {
                      const resultSubtarefas = await responseSubtarefas.json();
                      if (resultSubtarefas.success && resultSubtarefas.data) {
                        subtarefasDaTarefa = resultSubtarefas.data.map(st => st.id);
                      }
                    }
                  } catch (error) {
                    console.error('Erro ao buscar subtarefas da tarefa:', error);
                  }
                  
                  // Buscar TODOS os vinculados existentes desta tarefa e produto (incluindo subtarefas)
                  const vinculadosExistentes = resultBuscar.data.filter(v => {
                    const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
                    const vTarefaId = v.cp_tarefa ? parseInt(v.cp_tarefa, 10) : null;
                    const vTipoTarefaId = v.cp_tarefa_tipo ? parseInt(v.cp_tarefa_tipo, 10) : null;
                    
                    // Criar chave composta do vinculado
                    const chaveVinculado = vTipoTarefaId ? `${vTarefaId}-${vTipoTarefaId}` : `${vTarefaId}-null`;
                    
                    return vProdutoId === produtoSelecionado && 
                           vTarefaId === tarefaId &&
                           chaveVinculado === chaveComposta &&
                           !v.cp_cliente;
                  });
                  
                  // Coletar IDs de subtarefas já vinculadas
                  const subtarefasJaVinculadas = new Set(
                    vinculadosExistentes
                      .filter(v => v.cp_subtarefa)
                      .map(v => parseInt(v.cp_subtarefa, 10))
                  );
                  
                  // Identificar subtarefas que precisam ser vinculadas
                  const subtarefasParaVincular = subtarefasDaTarefa.filter(
                    stId => !subtarefasJaVinculadas.has(stId)
                  );
                  
                  // Separar vinculados com subtarefa e sem subtarefa
                  const vinculadosComSubtarefa = vinculadosExistentes.filter(v => v.cp_subtarefa);
                  const vinculadosSemSubtarefa = vinculadosExistentes.filter(v => !v.cp_subtarefa);
                  
                  // Atualizar vinculados que JÁ TÊM subtarefa - apenas atualizar tipo e produto
                  for (const vinculado of vinculadosComSubtarefa) {
                    const dadosUpdate = {
                      cp_tarefa_tipo: tipoTarefaId,
                      cp_tarefa: tarefaId,
                      cp_produto: produtoSelecionado,
                      cp_subtarefa: parseInt(vinculado.cp_subtarefa, 10) // Manter a subtarefa existente
                    };
                    
                    await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                      method: 'PUT',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify(dadosUpdate)
                    });
                  }
                  
                  // Para vinculados SEM subtarefa: se há subtarefas, atualizar para incluir uma subtarefa
                  // IMPORTANTE: Mesmo que todas as subtarefas já estejam vinculadas em outros registros,
                  // devemos atualizar o vinculado sem subtarefa para incluir uma delas
                  if (vinculadosSemSubtarefa.length > 0 && subtarefasDaTarefa.length > 0) {
                    // Pegar subtarefas que ainda não estão vinculadas
                    const subtarefasDisponiveis = subtarefasDaTarefa.filter(
                      stId => !subtarefasJaVinculadas.has(stId)
                    );
                    
                    // Se não há subtarefas disponíveis (todas já estão vinculadas), usar a primeira subtarefa da tarefa
                    const subtarefasParaUsar = subtarefasDisponiveis.length > 0 
                      ? subtarefasDisponiveis 
                      : subtarefasDaTarefa; // Usar todas as subtarefas se todas já estão vinculadas
                    
                    // Atualizar cada vinculado sem subtarefa para incluir uma subtarefa
                    for (let i = 0; i < vinculadosSemSubtarefa.length; i++) {
                      // Usar a subtarefa correspondente (ou a primeira se não houver mais)
                      const subtarefaIndex = i < subtarefasParaUsar.length ? i : 0;
                      const subtarefa = subtarefasParaUsar[subtarefaIndex];
                      
                      const dadosUpdate = {
                        cp_tarefa_tipo: tipoTarefaId,
                        cp_tarefa: tarefaId,
                        cp_produto: produtoSelecionado,
                        cp_subtarefa: subtarefa // SEMPRE incluir uma subtarefa se a tarefa tem subtarefas
                      };
                      
                      await fetch(`${API_BASE_URL}/vinculados/${vinculadosSemSubtarefa[i].id}`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json'
                        },
                        body: JSON.stringify(dadosUpdate)
                      });
                      
                      // Marcar como vinculada (para evitar criar duplicatas)
                      if (!subtarefasJaVinculadas.has(subtarefa)) {
                        subtarefasJaVinculadas.add(subtarefa);
                      }
                    }
                  } else if (vinculadosSemSubtarefa.length > 0) {
                    // Se não há subtarefas na tarefa, apenas atualizar tipo e produto
                    for (const vinculado of vinculadosSemSubtarefa) {
                      const dadosUpdate = {
                        cp_tarefa_tipo: tipoTarefaId,
                        cp_tarefa: tarefaId,
                        cp_produto: produtoSelecionado,
                        cp_subtarefa: null
                      };
                      
                      await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json'
                        },
                        body: JSON.stringify(dadosUpdate)
                      });
                    }
                  }
                  
                  // Criar novas vinculações para subtarefas que ainda não estão vinculadas
                  const subtarefasParaCriar = subtarefasDaTarefa.filter(
                    stId => !subtarefasJaVinculadas.has(stId)
                  );
                  
                  if (subtarefasParaCriar.length > 0) {
                    const novasVinculacoes = subtarefasParaCriar.map(subtarefaId => ({
                      cp_tarefa_tipo: tipoTarefaId,
                      cp_tarefa: tarefaId,
                      cp_subtarefa: subtarefaId,
                      cp_produto: produtoSelecionado,
                      cp_cliente: null
                    }));
                    
                    await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({
                        vinculados: novasVinculacoes
                      })
                    });
                  }
                  
                  // Se não há vinculados existentes mas há subtarefas, criar vinculação para a tarefa sem subtarefa também
                  if (vinculadosExistentes.length === 0 && subtarefasDaTarefa.length > 0) {
                    // Criar vinculação para a tarefa sem subtarefa (além das subtarefas)
                    await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({
                        vinculados: [{
                          cp_tarefa_tipo: tipoTarefaId,
                          cp_tarefa: tarefaId,
                          cp_subtarefa: null,
                          cp_produto: produtoSelecionado,
                          cp_cliente: null
                        }]
                      })
                    });
                  }
                  
                  // Se não há vinculados existentes mas a tarefa está na lista de existentes,
                  // criar novas vinculações (pode ter sido removida e adicionada novamente)
                  if (vinculadosExistentes.length === 0) {
                    if (subtarefasDaTarefa.length > 0) {
                      // Criar vinculações para todas as subtarefas
                      const novasVinculacoes = subtarefasDaTarefa.map(subtarefaId => ({
                        cp_tarefa_tipo: tipoTarefaId,
                        cp_tarefa: tarefaId,
                        cp_subtarefa: subtarefaId,
                        cp_produto: produtoSelecionado,
                        cp_cliente: null
                      }));
                      
                      await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                          vinculados: novasVinculacoes
                        })
                      });
                    } else {
                      // Criar vinculação apenas com tarefa
                      await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                          vinculados: [{
                            cp_tarefa_tipo: tipoTarefaId,
                            cp_tarefa: tarefaId,
                            cp_subtarefa: null,
                            cp_produto: produtoSelecionado,
                            cp_cliente: null
                          }]
                        })
                      });
                    }
                  }
                }
                
                console.log(`✅ ${tarefasExistentes.length} tarefa(s) existente(s) atualizada(s) na Seção 3 com todas as subtarefas`);
              }
            }
          } catch (error) {
            console.error('Erro ao atualizar vinculações existentes da Seção 3:', error);
            showToast('error', 'Erro ao atualizar vinculações. Tente novamente.');
            return;
          }
        }

        // 3. CRIAR novas vinculações (se houver)
        if (tarefasNovas.length > 0) {
          const novasCombinacoes = [];
          
          // Buscar subtarefas de cada tarefa selecionada
          for (const chaveComposta of tarefasNovas) {
            // Extrair tarefaId e tipoTarefaId da chave composta
            const [tarefaIdStr, tipoTarefaIdStr] = chaveComposta.split('-');
            const tarefaId = parseInt(tarefaIdStr, 10);
            const tipoTarefaId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
            
            // Buscar subtarefas desta tarefa (combinando tarefa_id + tarefa_tipo_id)
            let subtarefasDaTarefa = [];
            try {
              // Passar tarefaId, tipoTarefaId e produtoId para buscar subtarefas da combinação específica
              let url = `${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}`;
              if (tipoTarefaId !== null) {
                url += `&tarefaTipoId=${tipoTarefaId}`;
              }
              if (produtoSelecionado) {
                url += `&produtoId=${produtoSelecionado}`;
              }
              
              const responseSubtarefas = await fetch(url, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              
              if (responseSubtarefas.ok) {
                const resultSubtarefas = await responseSubtarefas.json();
                if (resultSubtarefas.success && resultSubtarefas.data) {
                  subtarefasDaTarefa = resultSubtarefas.data.map(st => st.id);
                }
              }
            } catch (error) {
              console.error('Erro ao buscar subtarefas da tarefa:', error);
            }
            
            if (subtarefasDaTarefa.length > 0) {
              // Se há subtarefas, criar uma vinculação para cada subtarefa
              subtarefasDaTarefa.forEach(subtarefaId => {
                novasCombinacoes.push({
                  cp_tarefa_tipo: tipoTarefaId,
                  cp_tarefa: tarefaId,
                  cp_subtarefa: subtarefaId,
                  cp_produto: produtoSelecionado,
                  cp_cliente: null
                });
              });
            } else {
              // Se não há subtarefas, criar vinculação apenas com tarefa
              novasCombinacoes.push({
                cp_tarefa_tipo: tipoTarefaId,
                cp_tarefa: tarefaId,
                cp_subtarefa: null,
                cp_produto: produtoSelecionado,
                cp_cliente: null
              });
            }
          }
          
          console.log('📋 Criando novas vinculações Seção 3:', novasCombinacoes);
          
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setTarefasDoProdutoVinculadasOriginalmente(tarefasDoProdutoSelecionadas);
          
          // Chamar onSubmit (os dados serão recarregados quando o usuário interagir com o componente)
          await onSubmit(novasCombinacoes);
          
          return;
        } else if (tarefasExistentes.length > 0) {
          // Apenas atualizamos existentes, sem criar novas
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setTarefasDoProdutoVinculadasOriginalmente(tarefasDoProdutoSelecionadas);
          
          showToast('success', 'Vinculação atualizada com sucesso!');
          return;
        } else {
          // Apenas removemos, sem criar novas
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setTarefasDoProdutoVinculadasOriginalmente(tarefasDoProdutoSelecionadas);
          
          showToast('success', 'Vinculação atualizada com sucesso!');
          return;
        }
      }
    }

    // SEÇÃO 4: Cliente → Produtos
    // Detectar automaticamente se está criando, editando ou removendo
    if (clienteSelecionado && produtosDoClienteSelecionados.length > 0) {
      // Comparar estado atual com estado original para detectar mudanças
      const produtosAtuais = new Set(produtosDoClienteSelecionados);
      const produtosOriginais = new Set(produtosDoClienteVinculadosOriginalmente);
      
      // Produtos novos (para criar) - apenas os que NÃO estavam na lista original
      const produtosNovos = produtosDoClienteSelecionados.filter(id => !produtosOriginais.has(id));
      
      // Produtos removidos (para deletar) - os que estavam na original mas não estão mais
      const produtosRemovidos = produtosDoClienteVinculadosOriginalmente.filter(id => !produtosAtuais.has(id));
      
      console.log('📊 Seção 4 - Cliente → Produtos:', {
        clienteId: clienteSelecionado,
        modo: produtosDoClienteVinculadosOriginalmente.length > 0 ? 'EDITAR' : 'CRIAR',
        originais: produtosDoClienteVinculadosOriginalmente,
        atuais: produtosDoClienteSelecionados,
        novos: produtosNovos,
        removidos: produtosRemovidos
      });

      // Se não há mudanças, não fazer nada
      if (produtosNovos.length === 0 && produtosRemovidos.length === 0) {
        console.log('ℹ️ Nenhuma alteração na Seção 4, continuando...');
        // Não retornar, deixar continuar para outras seções
      } else {
        // Há mudanças para processar
        
        // 1. REMOVER vinculações desmarcadas (se houver)
        if (produtosRemovidos.length > 0) {
          try {
            // Buscar IDs dos vinculados para deletar
            const responseBuscar = await fetch(`${API_BASE_URL}/vinculados?filtro_cliente=true&limit=1000`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            
            if (responseBuscar.ok) {
              const resultBuscar = await responseBuscar.json();
              if (resultBuscar.success && resultBuscar.data) {
                const vinculadosParaDeletar = resultBuscar.data.filter(v => {
                  const vClienteId = v.cp_cliente || '';
                  const vProdutoId = v.cp_produto ? parseInt(v.cp_produto, 10) : null;
                  return vClienteId === clienteSelecionado && 
                         vProdutoId && 
                         produtosRemovidos.includes(vProdutoId) &&
                         !v.cp_tarefa_tipo &&
                         !v.cp_tarefa &&
                         !v.cp_subtarefa; // Apenas vinculações simples cliente-produto
                });

                // Deletar cada vinculado
                for (const vinculado of vinculadosParaDeletar) {
                  await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  });
                }
                
                console.log(`✅ ${vinculadosParaDeletar.length} vinculação(ões) removida(s) da Seção 4`);
              }
            }
          } catch (error) {
            console.error('Erro ao remover vinculações da Seção 4:', error);
            showToast('error', 'Erro ao remover vinculações. Tente novamente.');
            return;
          }
        }

        // 2. CRIAR novas vinculações (se houver)
        if (produtosNovos.length > 0) {
          const novasCombinacoes = produtosNovos.map(produtoId => ({
            cp_tarefa_tipo: null,
            cp_tarefa: null,
            cp_subtarefa: null,
            cp_produto: produtoId,
            cp_cliente: clienteSelecionado
          }));
          
          console.log('📋 Criando novas vinculações Seção 4:', novasCombinacoes);
          
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setProdutosDoClienteVinculadosOriginalmente(produtosDoClienteSelecionados);
          
          // Chamar onSubmit (os dados serão recarregados quando o usuário interagir com o componente)
          await onSubmit(novasCombinacoes);
          
          return;
        } else {
          // Apenas removemos, sem criar novas
          // Atualizar estado local: sincronizar com o que está selecionado agora
          setProdutosDoClienteVinculadosOriginalmente(produtosDoClienteSelecionados);
          
          showToast('success', 'Vinculação atualizada com sucesso!');
          return;
        }
      }
    }

    // Modo normal: criar todas as combinações
    const combinacoes = await criarDadosVinculados();

    console.log('📋 Combinações criadas:', combinacoes);
    console.log('📊 Total de combinações:', combinacoes.length);

    if (combinacoes.length === 0) {
      console.error('❌ Nenhuma combinação foi criada. Estado atual:', {
        tipoTarefaSelecionado,
        tarefasDoTipoSelecionadas,
        tarefaSelecionada,
        subtarefasDaTarefaSelecionadas,
        produtoSelecionado,
        tarefasDoProdutoSelecionadas,
        clienteSelecionado,
        produtosDoClienteSelecionados
      });
      showToast('warning', 'Nenhuma combinação válida foi criada. Verifique as seleções.');
      return;
    }

    if (isEditing) {
      // Na edição, enviar apenas a primeira combinação
      await onSubmit(combinacoes[0]);
    } else {
      // Na criação, enviar todas as combinações
      await onSubmit(combinacoes);
    }
  };

  const handleSelectChange = (value, setValue, clearDependent = null) => {
    setValue(value);
    if (clearDependent) {
      clearDependent([]);
    }
  };

  const handleMultipleSelectChange = (selectedItems, setSelectedItems) => {
    setSelectedItems(selectedItems || []);
  };

  if (loading || externalLoading) {
    return <div className="vinculacao-form-loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>;
  }

  // Preparar opções para CustomSelect
  const tiposTarefaOptions = tiposTarefa.map(tipo => ({ value: tipo.id, label: tipo.nome }));
  const tarefasOptions = tarefas.map(tarefa => ({ value: tarefa.id, label: tarefa.nome }));
  const produtosOptions = produtos.map(produto => ({ value: produto.id, label: produto.nome }));
  const clientesOptions = clientes.map(cliente => ({ value: cliente.id, label: cliente.nome }));
  
  const tarefasDoTipoOptions = tarefasDoTipoDisponiveis.map(tarefa => ({ value: tarefa.id, label: tarefa.nome }));
  const subtarefasOptions = subtarefasDaTarefaDisponiveis.map(subtarefa => ({ value: subtarefa.id, label: subtarefa.nome }));
  const tarefasDoProdutoOptions = tarefasDoProdutoComTipos.map(tt => ({
    value: `${tt.tarefaId}-${tt.tipoTarefaId || 'null'}`, // Chave composta: tarefaId-tipoTarefaId (ou null se não tiver tipo)
    label: `${tt.tarefaNome}${tt.tipoTarefaNome && tt.tipoTarefaNome !== 'Sem Tipo' ? ` (${tt.tipoTarefaNome})` : ''}`, // Mostrar tarefa e tipo
    tarefaId: tt.tarefaId,
    tipoTarefaId: tt.tipoTarefaId,
    grupo: tt.tipoTarefaNome || 'Sem Tipo' // Para agrupamento visual
  }));
  const produtosDoClienteOptions = produtosDoClienteDisponiveis.map(produto => ({ value: produto.id, label: produto.nome }));
  
  // Preparar opções de tarefas com tipos (para Seção 2) - agrupadas por tipo
  const tarefasComTiposOptions = tarefasComTipos.map(tt => ({
    value: `${tt.tarefaId}-${tt.tipoTarefaId}`, // Chave composta: tarefaId-tipoTarefaId
    label: `${tt.tarefaNome} (${tt.tipoTarefaNome})`, // Mostrar tarefa e tipo
    tarefaId: tt.tarefaId,
    tipoTarefaId: tt.tipoTarefaId,
    grupo: tt.tipoTarefaNome // Para agrupamento visual
  }));
  
  // Valor atual do select de tarefa (chave composta)
  const tarefaSelecionadaValue = tarefaSelecionada && tipoTarefaDaTarefaSelecionada 
    ? `${tarefaSelecionada}-${tipoTarefaDaTarefaSelecionada}` 
    : '';

  return (
    <form id="vinculacao-form" onSubmit={handleSubmit} className="vinculacao-form">
      {/* Seção 1: Tipo de Tarefa → Tarefas */}
      <div className="vinculacao-form-section">
        <div className="vinculacao-section-header">
          <div className="vinculacao-section-header-left">
            <div className="vinculacao-section-icon">
              <i className="fas fa-tags"></i>
            </div>
            <div>
              <h3 className="vinculacao-section-title">Seção 1: Tipo de Tarefa → Tarefas</h3>
              <p className="vinculacao-section-description">Selecione um tipo de tarefa e depois selecione as tarefas desse tipo</p>
            </div>
          </div>
          <div className="vinculacao-section-header-right">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSaveSecao1}
              disabled={savingSecao1 || loading || !tipoTarefaSelecionado || tarefasDoTipoSelecionadas.length === 0}
              title="Salvar"
            >
              {savingSecao1 ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Salvar
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="vinculacao-form-row">
          <div className="vinculacao-form-group">
            <label className="vinculacao-form-label">
              Tipo de Tarefa
            </label>
            <div className="vinculacao-select-with-refresh">
              <CustomSelect
                value={tipoTarefaSelecionado || ''}
                options={tiposTarefaOptions}
                onChange={(e) => {
                  const value = e?.target?.value || e;
                  const tipoId = value ? parseInt(value, 10) : null;
                  handleSelectChange(
                    tipoId,
                    setTipoTarefaSelecionado,
                    setTarefasDoTipoSelecionadas
                  );
                }}
                placeholder="Selecione um tipo de tarefa"
                disabled={submitting || loading}
                enableSearch={true}
              />
              <button
                type="button"
                className="vinculacao-refresh-btn"
                onClick={async () => {
                  await loadTiposTarefa(true); // Force refresh
                }}
                disabled={submitting || loading}
                title="Atualizar tipos de tarefa"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>

          {tipoTarefaSelecionado && (
            <div className="vinculacao-form-group">
              <label className="vinculacao-form-label">
                Tarefas do Tipo Selecionado
                {tarefasDoTipoSelecionadas.length > 0 && (
                  <span className="vinculacao-selected-count">
                    ({tarefasDoTipoSelecionadas.length} selecionada{tarefasDoTipoSelecionadas.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <div className="vinculacao-select-with-refresh">
                <CustomSelect
                  value=""
                  options={tarefasDoTipoOptions}
                  placeholder="Selecione as tarefas para vincular"
                  disabled={submitting || loading || tarefasDoTipoOptions.length === 0}
                  selectedItems={tarefasDoTipoSelecionadas.map(String)}
                  enableSearch={true}
                  keepOpen={true}
                  onToggleItem={(itemValue, isSelected) => {
                  const itemId = parseInt(itemValue, 10);
                  if (isSelected) {
                    // Adicionar se não estiver na lista
                    if (!tarefasDoTipoSelecionadas.includes(itemId)) {
                      setTarefasDoTipoSelecionadas([...tarefasDoTipoSelecionadas, itemId]);
                    }
                  } else {
                    // Remover da lista
                    setTarefasDoTipoSelecionadas(tarefasDoTipoSelecionadas.filter(id => id !== itemId));
                  }
                }}
                onSelectAll={() => {
                  const allIds = tarefasDoTipoOptions.map(opt => parseInt(opt.value, 10));
                  const allSelected = allIds.every(id => tarefasDoTipoSelecionadas.includes(id));
                  if (allSelected) {
                    // Desmarcar todos
                    setTarefasDoTipoSelecionadas([]);
                  } else {
                    // Selecionar todos
                    setTarefasDoTipoSelecionadas(allIds);
                  }
                }}
                />
                <button
                  type="button"
                  className="vinculacao-refresh-btn"
                  onClick={async () => {
                    if (tipoTarefaSelecionado) {
                      await loadTarefasPorTipo(tipoTarefaSelecionado);
                    }
                  }}
                  disabled={submitting || loading || !tipoTarefaSelecionado}
                  title="Atualizar tarefas do tipo"
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
              {tarefasDoTipoSelecionadas.length > 0 && (
                <div className="vinculacao-selected-items">
                  {tarefasDoTipoSelecionadas.map(tarefaId => {
                    const tarefa = tarefasDoTipoDisponiveis.find(t => t.id === tarefaId);
                    return tarefa ? (
                      <span key={tarefaId} className="vinculacao-selected-item">
                        {tarefa.nome}
                        <button
                          type="button"
                          className="vinculacao-remove-item"
                          onClick={() => {
                            setTarefasDoTipoSelecionadas(tarefasDoTipoSelecionadas.filter(id => id !== tarefaId));
                          }}
                          disabled={submitting}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seção 2: Tarefa → Subtarefas */}
      <div className="vinculacao-form-section">
        <div className="vinculacao-section-header">
          <div className="vinculacao-section-header-left">
            <div className="vinculacao-section-icon">
              <i className="fas fa-list"></i>
            </div>
            <div>
              <h3 className="vinculacao-section-title">Seção 2: Tarefa → Subtarefas</h3>
              <p className="vinculacao-section-description">Selecione uma tarefa e depois selecione as subtarefas dessa tarefa</p>
            </div>
          </div>
          <div className="vinculacao-section-header-right">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSaveSecao2}
              disabled={savingSecao2 || loading || !tarefaSelecionada || subtarefasDaTarefaSelecionadas.length === 0}
              title="Salvar"
            >
              {savingSecao2 ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Salvar
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="vinculacao-form-row">
          <div className="vinculacao-form-group">
            <label className="vinculacao-form-label">
              Tarefa
            </label>
            <div className="vinculacao-select-with-refresh">
              <CustomSelect
                value={tarefaSelecionadaValue}
                options={tarefasComTiposOptions}
                onChange={(e) => {
                  const value = e?.target?.value || e;
                  if (value) {
                    // Extrair tarefaId e tipoTarefaId da chave composta
                    const [tarefaId, tipoTarefaId] = value.split('-').map(id => parseInt(id, 10));
                    setTarefaSelecionada(tarefaId);
                    setTipoTarefaDaTarefaSelecionada(tipoTarefaId);
                    setSubtarefasDaTarefaSelecionadas([]);
                  } else {
                    setTarefaSelecionada(null);
                    setTipoTarefaDaTarefaSelecionada(null);
                    setSubtarefasDaTarefaSelecionadas([]);
                  }
                }}
                placeholder="Selecione uma tarefa (agrupadas por tipo)"
                disabled={submitting || loading}
                enableSearch={true}
              />
              <button
                type="button"
                className="vinculacao-refresh-btn"
                onClick={async () => {
                  await loadTarefas(true); // Force refresh
                  await loadTiposTarefa(true); // Force refresh
                  await recarregarTarefasComTipos();
                }}
                disabled={submitting || loading}
                title="Atualizar tarefas"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>

          {tarefaSelecionada && (
            <div className="vinculacao-form-group">
              <label className="vinculacao-form-label">
                Subtarefas da Tarefa Selecionada
                {subtarefasDaTarefaSelecionadas.length > 0 && (
                  <span className="vinculacao-selected-count">
                    ({subtarefasDaTarefaSelecionadas.length} selecionada{subtarefasDaTarefaSelecionadas.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <div className="vinculacao-select-with-refresh">
                <CustomSelect
                  value=""
                  options={subtarefasOptions}
                  placeholder="Selecione as subtarefas para vincular"
                  disabled={submitting || loading || subtarefasOptions.length === 0}
                  selectedItems={subtarefasDaTarefaSelecionadas.map(String)}
                  enableSearch={true}
                  keepOpen={true}
                  onToggleItem={(itemValue, isSelected) => {
                  const itemId = parseInt(itemValue, 10);
                  if (isSelected) {
                    // Adicionar se não estiver na lista
                    if (!subtarefasDaTarefaSelecionadas.includes(itemId)) {
                      setSubtarefasDaTarefaSelecionadas([...subtarefasDaTarefaSelecionadas, itemId]);
                    }
                  } else {
                    // Remover da lista
                    setSubtarefasDaTarefaSelecionadas(subtarefasDaTarefaSelecionadas.filter(id => id !== itemId));
                  }
                }}
                onSelectAll={() => {
                  const allIds = subtarefasOptions.map(opt => parseInt(opt.value, 10));
                  const allSelected = allIds.every(id => subtarefasDaTarefaSelecionadas.includes(id));
                  if (allSelected) {
                    // Desmarcar todos
                    setSubtarefasDaTarefaSelecionadas([]);
                  } else {
                    // Selecionar todos
                    setSubtarefasDaTarefaSelecionadas(allIds);
                  }
                }}
                />
                <button
                  type="button"
                  className="vinculacao-refresh-btn"
                  onClick={async () => {
                    if (tarefaSelecionada && tipoTarefaDaTarefaSelecionada) {
                      await loadSubtarefasPorTarefa(tarefaSelecionada, tipoTarefaDaTarefaSelecionada);
                    }
                  }}
                  disabled={submitting || loading || !tarefaSelecionada || !tipoTarefaDaTarefaSelecionada}
                  title="Atualizar subtarefas"
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
              {subtarefasDaTarefaSelecionadas.length > 0 && (
                <div className="vinculacao-selected-items">
                  {subtarefasDaTarefaSelecionadas.map(subtarefaId => {
                    const subtarefa = subtarefasDaTarefaDisponiveis.find(s => s.id === subtarefaId);
                    return subtarefa ? (
                      <span key={subtarefaId} className="vinculacao-selected-item">
                        {subtarefa.nome}
                        <button
                          type="button"
                          className="vinculacao-remove-item"
                          onClick={() => {
                            setSubtarefasDaTarefaSelecionadas(subtarefasDaTarefaSelecionadas.filter(id => id !== subtarefaId));
                          }}
                          disabled={submitting}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seção 3: Produto → Tarefas */}
      <div className="vinculacao-form-section">
        <div className="vinculacao-section-header">
          <div className="vinculacao-section-header-left">
            <div className="vinculacao-section-icon">
              <i className="fas fa-box"></i>
            </div>
            <div>
              <h3 className="vinculacao-section-title">Seção 3: Produto → Tarefas</h3>
              <p className="vinculacao-section-description">Selecione um produto e depois selecione as tarefas desse produto</p>
            </div>
          </div>
          <div className="vinculacao-section-header-right">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSaveSecao3}
              disabled={savingSecao3 || loading || !produtoSelecionado || tarefasDoProdutoSelecionadas.length === 0}
              title="Salvar"
            >
              {savingSecao3 ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Salvar
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="vinculacao-form-row">
          <div className="vinculacao-form-group">
            <label className="vinculacao-form-label">
              Produto
            </label>
            <div className="vinculacao-select-with-refresh">
              <CustomSelect
                value={produtoSelecionado || ''}
                options={produtosOptions}
                onChange={(e) => {
                  const value = e?.target?.value || e;
                  const produtoId = value ? parseInt(value, 10) : null;
                  handleSelectChange(
                    produtoId,
                    setProdutoSelecionado,
                    setTarefasDoProdutoSelecionadas
                  );
                }}
                placeholder="Selecione um produto"
                disabled={submitting || loading}
                enableSearch={true}
              />
              <button
                type="button"
                className="vinculacao-refresh-btn"
                onClick={async () => {
                  await loadProdutos(true); // Force refresh
                }}
                disabled={submitting || loading}
                title="Atualizar produtos"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>

          {produtoSelecionado && (
            <div className="vinculacao-form-group">
              <label className="vinculacao-form-label">
                Tarefas do Produto Selecionado
                {tarefasDoProdutoSelecionadas.length > 0 && (
                  <span className="vinculacao-selected-count">
                    ({tarefasDoProdutoSelecionadas.length} selecionada{tarefasDoProdutoSelecionadas.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <div className="vinculacao-select-with-refresh">
                <CustomSelect
                  value=""
                  options={tarefasDoProdutoOptions}
                  placeholder={tarefasDoProdutoOptions.length === 0 ? "Clique para carregar tarefas" : "Selecione as tarefas para vincular (agrupadas por tipo)"}
                  disabled={submitting || loading}
                  selectedItems={tarefasDoProdutoSelecionadas}
                  enableSearch={true}
                  keepOpen={true}
                  onToggleItem={(itemValue, isSelected) => {
                    const chaveComposta = String(itemValue);
                    if (isSelected) {
                      // Adicionar se não estiver na lista
                      if (!tarefasDoProdutoSelecionadas.includes(chaveComposta)) {
                        setTarefasDoProdutoSelecionadas([...tarefasDoProdutoSelecionadas, chaveComposta]);
                      }
                    } else {
                      // Remover da lista
                      setTarefasDoProdutoSelecionadas(tarefasDoProdutoSelecionadas.filter(chave => chave !== chaveComposta));
                    }
                  }}
                  onSelectAll={() => {
                    const allChaves = tarefasDoProdutoOptions.map(opt => String(opt.value));
                    const allSelected = allChaves.every(chave => tarefasDoProdutoSelecionadas.includes(chave));
                    if (allSelected) {
                      // Desmarcar todos
                      setTarefasDoProdutoSelecionadas([]);
                    } else {
                      // Selecionar todos
                      setTarefasDoProdutoSelecionadas(allChaves);
                    }
                  }}
                />
                <button
                  type="button"
                  className="vinculacao-refresh-btn"
                  onClick={async () => {
                    if (produtoSelecionado) {
                      await loadTarefasPorProduto(produtoSelecionado);
                    }
                  }}
                  disabled={submitting || loading || !produtoSelecionado}
                  title="Atualizar tarefas do produto"
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
              {tarefasDoProdutoSelecionadas.length > 0 && (
                <div className="vinculacao-selected-items">
                  {tarefasDoProdutoSelecionadas.map(chaveComposta => {
                    const [tarefaIdStr, tipoTarefaIdStr] = chaveComposta.split('-');
                    const tarefaId = parseInt(tarefaIdStr, 10);
                    const tipoTarefaId = tipoTarefaIdStr === 'null' || tipoTarefaIdStr === '' ? null : parseInt(tipoTarefaIdStr, 10);
                    const tarefaComTipo = tarefasDoProdutoComTipos.find(tt => 
                      tt.tarefaId === tarefaId && (tt.tipoTarefaId === tipoTarefaId || (tt.tipoTarefaId === null && tipoTarefaId === null))
                    );
                    return tarefaComTipo ? (
                      <span key={chaveComposta} className="vinculacao-selected-item">
                        {tarefaComTipo.tarefaNome}{tarefaComTipo.tipoTarefaNome && tarefaComTipo.tipoTarefaNome !== 'Sem Tipo' ? ` (${tarefaComTipo.tipoTarefaNome})` : ''}
                        <button
                          type="button"
                          className="vinculacao-remove-item"
                          onClick={() => {
                            setTarefasDoProdutoSelecionadas(tarefasDoProdutoSelecionadas.filter(chave => chave !== chaveComposta));
                          }}
                          disabled={submitting}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seção 4: Cliente → Produtos */}
      <div className="vinculacao-form-section" style={{ 
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div className="vinculacao-section-header" style={{ 
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e2e8f0'
        }}>
          <div className="vinculacao-section-header-left">
            <div className="vinculacao-section-icon" style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f3f4f6',
              borderRadius: '8px',
              color: '#0e3b6f'
            }}>
              <i className="fas fa-users" style={{ fontSize: '24px' }}></i>
            </div>
            <div>
              <h3 className="vinculacao-section-title" style={{ 
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 4px 0'
              }}>
                Seção 4: Cliente → Produtos
              </h3>
              <p className="vinculacao-section-description" style={{ 
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Selecione um cliente e depois selecione os produtos desse cliente
              </p>
            </div>
          </div>
          <div className="vinculacao-section-header-right">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={handleSaveSecao4}
              disabled={savingSecao4 || loading || !clienteSelecionado || produtosDoClienteSelecionados.length === 0}
              title="Salvar"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '8px',
                border: 'none',
                background: savingSecao4 || loading || !clienteSelecionado || produtosDoClienteSelecionados.length === 0 
                  ? '#cbd5e1' 
                  : '#0e3b6f',
                color: 'white',
                cursor: savingSecao4 || loading || !clienteSelecionado || produtosDoClienteSelecionados.length === 0 
                  ? 'not-allowed' 
                  : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = '#144577';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(14, 59, 111, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = '#0e3b6f';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {savingSecao4 ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Salvar
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="vinculacao-form-row" style={{ marginBottom: '24px' }}>
          <div className="vinculacao-form-group">
            <label className="vinculacao-form-label">
              Cliente
            </label>
            <div className="vinculacao-select-with-refresh">
              <CustomSelect
                value={clienteSelecionado || ''}
                options={clientesOptions}
                onChange={(e) => {
                  const value = e?.target?.value || e;
                  const clienteId = value || null;
                  handleSelectChange(
                    clienteId,
                    setClienteSelecionado,
                    setProdutosDoClienteSelecionados
                  );
                }}
                placeholder="Selecione um cliente"
                disabled={submitting || loading}
                enableSearch={true}
              />
              <button
                type="button"
                className="vinculacao-refresh-btn"
                onClick={async () => {
                  await loadClientes(true); // Force refresh
                }}
                disabled={submitting || loading}
                title="Atualizar clientes"
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>

          {clienteSelecionado && (
            <div className="vinculacao-form-group">
              <label className="vinculacao-form-label">
                Produtos do Cliente Selecionado
                {produtosDoClienteSelecionados.length > 0 && (
                  <span className="vinculacao-selected-count">
                    ({produtosDoClienteSelecionados.length} selecionado{produtosDoClienteSelecionados.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <div className="vinculacao-select-with-refresh">
                <CustomSelect
                  value=""
                  options={produtosDoClienteOptions}
                  placeholder="Selecione os produtos para vincular"
                  disabled={submitting || loading || produtosDoClienteOptions.length === 0}
                  selectedItems={produtosDoClienteSelecionados.map(String)}
                  enableSearch={true}
                  keepOpen={true}
                  onToggleItem={(itemValue, isSelected) => {
                  const itemId = parseInt(itemValue, 10);
                  if (isSelected) {
                    // Adicionar se não estiver na lista
                    if (!produtosDoClienteSelecionados.includes(itemId)) {
                      setProdutosDoClienteSelecionados([...produtosDoClienteSelecionados, itemId]);
                    }
                  } else {
                    // Remover da lista
                    setProdutosDoClienteSelecionados(produtosDoClienteSelecionados.filter(id => id !== itemId));
                  }
                }}
                onSelectAll={() => {
                  const allIds = produtosDoClienteOptions.map(opt => parseInt(opt.value, 10));
                  const allSelected = allIds.every(id => produtosDoClienteSelecionados.includes(id));
                  if (allSelected) {
                    // Desmarcar todos
                    setProdutosDoClienteSelecionados([]);
                  } else {
                    // Selecionar todos
                    setProdutosDoClienteSelecionados(allIds);
                  }
                }}
                />
                <button
                  type="button"
                  className="vinculacao-refresh-btn"
                  onClick={async () => {
                    if (clienteSelecionado) {
                      await loadProdutosPorCliente(clienteSelecionado);
                    }
                  }}
                  disabled={submitting || loading || !clienteSelecionado}
                  title="Atualizar produtos do cliente"
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
              {produtosDoClienteSelecionados.length > 0 && (
                <div className="vinculacao-selected-items">
                  {produtosDoClienteSelecionados.map(produtoId => {
                    const produto = produtosDoClienteDisponiveis.find(p => p.id === produtoId);
                    return produto ? (
                      <span key={produtoId} className="vinculacao-selected-item">
                        {produto.nome}
                        <button
                          type="button"
                          className="vinculacao-remove-item"
                          onClick={() => {
                            setProdutosDoClienteSelecionados(produtosDoClienteSelecionados.filter(id => id !== produtoId));
                          }}
                          disabled={submitting}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Exibir componente de seleção de tarefas e subtarefas para cada produto selecionado */}
          {clienteSelecionado && produtosDoClienteSelecionados.length > 0 && (
            <div className="vinculacao-form-group" style={{ 
              marginTop: '24px', 
              paddingTop: '24px', 
              borderTop: '2px solid #e2e8f0',
              width: '100%',
              gridColumn: '1 / -1' // Ocupar toda a largura da grid
            }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div>
                  <label className="vinculacao-form-label" style={{ 
                    marginBottom: '6px', 
                    fontSize: '16px', 
                    fontWeight: '600',
                    color: '#1e293b',
                    display: 'block'
                  }}>
                    Tarefas e Subtarefas dos Produtos Selecionados
                  </label>
                  <p className="vinculacao-section-description" style={{ 
                    marginBottom: 0, 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    color: '#64748b'
                  }}>
                    Marque as tarefas e subtarefas que deseja vincular ao cliente. Use "Adicionar Nova Tarefa" para criar vínculos específicos apenas para este cliente.
                  </p>
                </div>
              </div>
              <div style={{ 
                marginTop: '16px', 
                width: '100%',
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e2e8f0'
              }}>
                <SelecaoTarefasPorProduto
                  key={`selecao-tarefas-secao4-${clienteSelecionado}-${produtosDoClienteSelecionados.join('-')}-${refreshTarefasSecao4}`}
                  clienteId={clienteSelecionado}
                  produtos={produtosDoClienteSelecionados.map(produtoId => {
                    const produto = produtosDoClienteDisponiveis.find(p => p.id === produtoId);
                    return produto || { id: produtoId, nome: `Produto #${produtoId}` };
                  })}
                  refreshKey={refreshTarefasSecao4}
                  onTarefasChange={(tarefasPorProduto) => {
                    // Converter formato: { produtoId: [{ id, nome, selecionada, subtarefasSelecionadas, ehExcecao, tipoTarefa }] }
                    // Para: { produtoId: { tarefaId: { selecionada: boolean, subtarefas: [subtarefaId], tipoTarefa: {id, nome} } } }
                    // IMPORTANTE: Fazer merge com estado existente para preservar tarefas não editadas
                    setTarefasSelecionadasPorProdutoSecao4(prevEstado => {
                      const novoFormato = { ...prevEstado }; // Preservar estado existente
                      
                      console.log('🔄 onTarefasChange: Recebendo atualização de tarefas', {
                        produtosRecebidos: Object.keys(tarefasPorProduto).length,
                        produtosNoEstadoAnterior: Object.keys(prevEstado).length
                      });
                      
                      Object.entries(tarefasPorProduto).forEach(([produtoId, tarefas]) => {
                        const produtoIdNum = parseInt(produtoId, 10);
                        
                        // Inicializar objeto do produto se não existir
                        if (!novoFormato[produtoIdNum]) {
                          novoFormato[produtoIdNum] = {};
                        }
                        
                        // Processar cada tarefa recebida
                        tarefas.forEach(tarefa => {
                          if (tarefa.selecionada === true) {
                            // Tarefa está selecionada: atualizar ou criar entrada
                            novoFormato[produtoIdNum][tarefa.id] = {
                              selecionada: true,
                              subtarefas: tarefa.subtarefasSelecionadas || [],
                              tipoTarefa: tarefa.tipoTarefa || null // Preservar tipo de tarefa
                            };
                            console.log(`  ✅ Tarefa ${tarefa.id} do produto ${produtoIdNum}: ${tarefa.subtarefasSelecionadas?.length || 0} subtarefa(s) selecionada(s)`, tarefa.subtarefasSelecionadas);
                          } else {
                            // Tarefa foi desmarcada: remover do estado
                            if (novoFormato[produtoIdNum][tarefa.id]) {
                              delete novoFormato[produtoIdNum][tarefa.id];
                              console.log(`  ❌ Tarefa ${tarefa.id} do produto ${produtoIdNum}: removida (desmarcada)`);
                            }
                          }
                        });
                      });
                      
                      // Log detalhado do estado final
                      const totalTarefas = Object.values(novoFormato).reduce((acc, produto) => {
                        return acc + Object.keys(produto).length;
                      }, 0);
                      
                      console.log('📋 Tarefas selecionadas atualizadas (merge completo):', {
                        totalProdutos: Object.keys(novoFormato).length,
                        totalTarefas: totalTarefas,
                        detalhes: Object.entries(novoFormato).map(([prodId, tarefas]) => ({
                          produtoId: prodId,
                          tarefas: Object.keys(tarefas).length,
                          subtarefasPorTarefa: Object.entries(tarefas).map(([tId, dados]) => ({
                            tarefaId: tId,
                            subtarefas: dados.subtarefas?.length || 0
                          }))
                        }))
                      });
                      
                      return novoFormato;
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default VinculacaoForm;

