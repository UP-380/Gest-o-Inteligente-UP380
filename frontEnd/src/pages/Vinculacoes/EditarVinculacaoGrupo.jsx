import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import './Vinculacoes.css';
import './VinculacoesGrupo.css';

const API_BASE_URL = '/api';

const EditarVinculacaoGrupo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  
  // Dados do grupo recebidos via location.state
  const grupoData = location.state;
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tiposTarefa, setTiposTarefa] = useState([]);
  const [tarefasVinculadasProduto, setTarefasVinculadasProduto] = useState({}); // { produtoId: [{ id, nome }] }
  
  // Estado local para edição (cliente)
  const [produtosEditados, setProdutosEditados] = useState([]);
  const [produtosExpandidos, setProdutosExpandidos] = useState({});
  const [adicionandoTarefaCliente, setAdicionandoTarefaCliente] = useState(null); // produtoId ou null
  const [mostrarTodasTarefas, setMostrarTodasTarefas] = useState({}); // { produtoId: true/false }
  const [tarefaSelecionada, setTarefaSelecionada] = useState({}); // { produtoId: tarefaId }
  
  // Estado para agrupar por cliente (quando há múltiplos clientes)
  const [agruparPorCliente, setAgruparPorCliente] = useState(false);
  const [clientesAgrupados, setClientesAgrupados] = useState({}); // { clienteId: { produtos: [], expandido: true/false } }
  const [clientesExpandidos, setClientesExpandidos] = useState({}); // { clienteId: true/false }
  
  // Estado local para edição (produto) - hierárquico: tipos de tarefa com suas tarefas
  const [tiposTarefaEditadosProduto, setTiposTarefaEditadosProduto] = useState([]); // Tipos de tarefa com suas tarefas
  const [tiposTarefaExpandidosProduto, setTiposTarefaExpandidosProduto] = useState({}); // { tipoTarefaId: true/false }
  const [adicionandoTarefaProduto, setAdicionandoTarefaProduto] = useState(null); // tipoTarefaId ou null
  const [mostrarTodasTarefasProduto, setMostrarTodasTarefasProduto] = useState({}); // { tipoTarefaId: true/false }
  const [tarefaSelecionadaProduto, setTarefaSelecionadaProduto] = useState({}); // { tipoTarefaId: tarefaId }
  
  // Estado para clientes vinculados ao produto
  const [clientesEditadosProduto, setClientesEditadosProduto] = useState([]);
  
  // Estado local para edição (tarefa)
  const [tiposTarefaEditados, setTiposTarefaEditados] = useState([]);
  const [adicionandoTipoTarefa, setAdicionandoTipoTarefa] = useState(false);
  const [tipoTarefaSelecionado, setTipoTarefaSelecionado] = useState(null);
  
  // Estado local para edição (tipoTarefa)
  const [tarefasEditadasTipo, setTarefasEditadasTipo] = useState([]);
  const [adicionandoTarefaTipo, setAdicionandoTarefaTipo] = useState(false);
  const [tarefaSelecionadaTipo, setTarefaSelecionadaTipo] = useState(null);
  
  // Estado inicial para comparação no salvamento
  const [initialState, setInitialState] = useState(null);

  // Inicializar estado com dados do grupo
  useEffect(() => {
    if (grupoData) {
      console.log('📋 Dados recebidos do grupo:', grupoData);
      const filtroPrincipal = grupoData.filtroPrincipal;
      
      if (filtroPrincipal === 'cliente' && grupoData.produtos && Array.isArray(grupoData.produtos)) {
        // Cliente: produtos com tarefas
        const produtosComTarefas = grupoData.produtos.map(produto => ({
          ...produto,
          tarefas: Array.isArray(produto.tarefas) ? produto.tarefas : []
        }));
        
        // Verificar se há múltiplos clientes nos vinculados
        // Buscar vinculados para identificar clientes únicos diretamente
        if (grupoData.vinculadosIds && grupoData.vinculadosIds.length > 0) {
          Promise.all(
            grupoData.vinculadosIds.map(id => 
              fetch(`${API_BASE_URL}/vinculados/${id}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              }).then(r => r.json())
            )
          )
          .then(results => {
            const clientesUnicos = new Set();
            const tarefasPorCliente = {}; // { clienteId: { produtoId: [tarefas] } }
            const vinculadosPorCliente = {}; // { clienteId: { id, nome, produtos: [] } }
            
            // Identificar clientes únicos dos vinculados
            results.forEach(result => {
              if (result.success && result.data && result.data.cp_cliente) {
                const clienteId = String(result.data.cp_cliente).trim();
                clientesUnicos.add(clienteId);
                
                if (!vinculadosPorCliente[clienteId]) {
                  vinculadosPorCliente[clienteId] = {
                    id: clienteId,
                    nome: result.data.cliente_nome || `Cliente ${clienteId}`,
                    produtos: []
                  };
                }
              }
            });
            
            // Se há múltiplos clientes, agrupar produtos e tarefas por cliente
            if (clientesUnicos.size > 1) {
              // Agrupar tarefas por cliente baseado nos vinculados
              produtosComTarefas.forEach(produto => {
                produto.tarefas.forEach(tarefa => {
                  // Buscar o vinculado correspondente para obter o clienteId
                  const vinculado = results.find(r => 
                    r.success && r.data && r.data.id === tarefa.vinculadoId
                  );
                  
                  if (vinculado && vinculado.data && vinculado.data.cp_cliente) {
                    const clienteId = String(vinculado.data.cp_cliente).trim();
                    
                    if (!tarefasPorCliente[clienteId]) {
                      tarefasPorCliente[clienteId] = {};
                    }
                    if (!tarefasPorCliente[clienteId][produto.id]) {
                      tarefasPorCliente[clienteId][produto.id] = [];
                    }
                    tarefasPorCliente[clienteId][produto.id].push(tarefa);
                  }
                });
              });
              
              // Organizar produtos por cliente
              clientesUnicos.forEach(clienteId => {
                const cliente = vinculadosPorCliente[clienteId];
                if (cliente) {
                  produtosComTarefas.forEach(produto => {
                    const tarefasDoCliente = tarefasPorCliente[clienteId]?.[produto.id] || [];
                    if (tarefasDoCliente.length > 0) {
                      cliente.produtos.push({
                        ...produto,
                        tarefas: tarefasDoCliente
                      });
                    }
                  });
                }
              });
              
              setClientesAgrupados(vinculadosPorCliente);
              const expandidos = {};
              Object.keys(vinculadosPorCliente).forEach(clienteId => {
                expandidos[clienteId] = true;
              });
              setClientesExpandidos(expandidos);
            } else {
              // Modo normal: um único cliente
              setProdutosEditados(produtosComTarefas);
              setInitialState(JSON.parse(JSON.stringify(produtosComTarefas)));
              const expandidos = {};
              produtosComTarefas.forEach(produto => {
                expandidos[produto.id] = true;
              });
              setProdutosExpandidos(expandidos);
              setAgruparPorCliente(false);
            }
          })
          .catch(error => {
            console.error('Erro ao buscar vinculados:', error);
            // Fallback: modo normal
            setProdutosEditados(produtosComTarefas);
            setInitialState(JSON.parse(JSON.stringify(produtosComTarefas)));
            const expandidos = {};
            produtosComTarefas.forEach(produto => {
              expandidos[produto.id] = true;
            });
            setProdutosExpandidos(expandidos);
            setAgruparPorCliente(false);
          });
        } else {
          // Modo normal: um único cliente
          setProdutosEditados(produtosComTarefas);
          setInitialState(JSON.parse(JSON.stringify(produtosComTarefas)));
          const expandidos = {};
          produtosComTarefas.forEach(produto => {
            expandidos[produto.id] = true;
          });
          setProdutosExpandidos(expandidos);
          setAgruparPorCliente(false);
        }
      } else if (filtroPrincipal === 'produto' && grupoData.tiposTarefa && Array.isArray(grupoData.tiposTarefa)) {
        // Produto: tipos de tarefa com suas tarefas (hierarquia)
        const tiposTarefaComTarefas = grupoData.tiposTarefa.map(tipoTarefa => ({
          id: tipoTarefa.id,
          nome: tipoTarefa.nome,
          tarefas: Array.isArray(tipoTarefa.tarefas) ? tipoTarefa.tarefas.map(t => ({
            ...t,
            vinculadoId: t.vinculadoId || null
          })) : []
        }));
        setTiposTarefaEditadosProduto(tiposTarefaComTarefas);
        setInitialState(JSON.parse(JSON.stringify(tiposTarefaComTarefas)));
        const expandidos = {};
        tiposTarefaComTarefas.forEach(tipoTarefa => {
          expandidos[tipoTarefa.id] = true;
        });
        setTiposTarefaExpandidosProduto(expandidos);
        
        // Carregar clientes vinculados ao produto
        if (grupoData.clientes && Array.isArray(grupoData.clientes)) {
          console.log('📋 Clientes recebidos:', grupoData.clientes);
          setClientesEditadosProduto(grupoData.clientes);
        } else {
          console.log('⚠️ Nenhum cliente encontrado em grupoData.clientes');
        }
      } else if (filtroPrincipal === 'atividade' && grupoData.tiposTarefa && Array.isArray(grupoData.tiposTarefa)) {
        // Tarefa: tipos de tarefa
        setTiposTarefaEditados(grupoData.tiposTarefa);
        setInitialState(JSON.parse(JSON.stringify(grupoData.tiposTarefa)));
      } else if (filtroPrincipal === 'tipoTarefa' && grupoData.tarefas && Array.isArray(grupoData.tarefas)) {
        // Tipo Tarefa: tarefas
        setTarefasEditadasTipo(grupoData.tarefas);
        setInitialState(JSON.parse(JSON.stringify(grupoData.tarefas)));
      } else {
        console.warn('⚠️ Dados do grupo não correspondem ao filtro principal:', grupoData);
      }
    }
  }, [grupoData]);

  // Carregar dados das APIs
  useEffect(() => {
    loadAllData();
  }, []);

  // Carregar tarefas vinculadas aos produtos (cliente) ou ao produto (produto)
  useEffect(() => {
    if (grupoData?.filtroPrincipal === 'cliente' && produtosEditados.length > 0) {
      loadTarefasVinculadas();
    } else if (grupoData?.filtroPrincipal === 'produto' && grupoData.itemPrincipal?.id) {
      loadTarefasVinculadas();
    }
  }, [produtosEditados, grupoData]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carregar produtos (se necessário)
      if (grupoData?.filtroPrincipal === 'cliente') {
        const produtosRes = await fetch(`${API_BASE_URL}/produtos?limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (produtosRes.ok) {
          const produtosData = await produtosRes.json();
          if (produtosData.success) {
            setProdutos(produtosData.data || []);
          }
        }
      }

      // Carregar todas as tarefas
      const tarefasRes = await fetch(`${API_BASE_URL}/tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (tarefasRes.ok) {
        const tarefasData = await tarefasRes.json();
        if (tarefasData.success) {
          setTarefas(tarefasData.data || []);
        }
      }

      // Carregar tipos de tarefa (se necessário)
      if (grupoData?.filtroPrincipal === 'atividade' || grupoData?.filtroPrincipal === 'tipoTarefa') {
        const tiposRes = await fetch(`${API_BASE_URL}/tarefa-tipo?limit=1000`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (tiposRes.ok) {
          const tiposData = await tiposRes.json();
          if (tiposData.success) {
            setTiposTarefa(tiposData.data || []);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('error', 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const loadTarefasVinculadas = async () => {
    if (!grupoData) return;

    try {
      if (grupoData.filtroPrincipal === 'cliente') {
        const produtoIds = produtosEditados.map(p => p.id).filter(id => id);
        if (produtoIds.length === 0) {
          setTarefasVinculadasProduto({});
          return;
        }

        // Buscar tarefas vinculadas aos produtos (cp_cliente = null)
        const response = await fetch(`${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoIds.join(',')}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // O endpoint retorna um array de objetos: [{ produtoId, tarefas: [{ id, nome }] }]
            const tarefasPorProduto = {};
            produtoIds.forEach(produtoId => {
              const produtoData = result.data.find(item => item.produtoId === produtoId);
              tarefasPorProduto[produtoId] = produtoData?.tarefas || [];
            });
            setTarefasVinculadasProduto(tarefasPorProduto);
          }
        }
      } else if (grupoData.filtroPrincipal === 'produto') {
        // Carregar tarefas vinculadas ao produto (cp_cliente = null)
        const produtoId = grupoData.itemPrincipal.id;
        const response = await fetch(`${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoId}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && result.data.length > 0) {
            const produtoData = result.data.find(item => item.produtoId === produtoId);
            setTarefasVinculadasProduto({ [produtoId]: produtoData?.tarefas || [] });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas vinculadas:', error);
    }
  };

  const toggleProdutoExpandido = (produtoId) => {
    setProdutosExpandidos(prev => ({
      ...prev,
      [produtoId]: !prev[produtoId]
    }));
  };

  const iniciarAdicionarTarefa = (produtoId) => {
    setAdicionandoTarefaCliente(produtoId);
    setMostrarTodasTarefas(prev => ({ ...prev, [produtoId]: false }));
    setTarefaSelecionada(prev => ({ ...prev, [produtoId]: null }));
  };

  const cancelarAdicionarTarefa = (produtoId) => {
    setAdicionandoTarefaCliente(null);
    setMostrarTodasTarefas(prev => ({ ...prev, [produtoId]: false }));
    setTarefaSelecionada(prev => ({ ...prev, [produtoId]: null }));
  };

  const toggleMostrarTodasTarefas = (produtoId) => {
    setMostrarTodasTarefas(prev => ({
      ...prev,
      [produtoId]: !prev[produtoId]
    }));
  };

  const selecionarTarefa = (produtoId, tarefaId) => {
    setTarefaSelecionada(prev => ({
      ...prev,
      [produtoId]: tarefaId
    }));
  };

  const confirmarAdicionarTarefa = async (produtoId) => {
    const tarefaId = tarefaSelecionada[produtoId];
    if (!tarefaId) {
      showToast('warning', 'Selecione uma tarefa para adicionar.');
      return;
    }

    // Verificar se tarefa já está no produto
    const produto = produtosEditados.find(p => p.id === produtoId);
    if (produto && produto.tarefas.find(t => t.id === tarefaId)) {
      showToast('warning', 'Esta tarefa já está vinculada ao produto.');
      cancelarAdicionarTarefa(produtoId);
      return;
    }

    // Encontrar nome da tarefa
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) {
      showToast('error', 'Tarefa não encontrada.');
      return;
    }

    // Adicionar tarefa ao estado local
    setProdutosEditados(prev => prev.map(produto => {
      if (produto.id === produtoId) {
        return {
          ...produto,
          tarefas: [...produto.tarefas, {
            id: tarefaId,
            nome: tarefa.nome || tarefa.tarefa_nome,
            vinculadoId: null // Será criado ao salvar
          }]
        };
      }
      return produto;
    }));

    cancelarAdicionarTarefa(produtoId);
    showToast('success', 'Tarefa adicionada. Clique em "Salvar" para confirmar.');
  };

  const removerTarefa = (produtoId, tarefaId) => {
    setProdutosEditados(prev => prev.map(produto => {
      if (produto.id === produtoId) {
        return {
          ...produto,
          tarefas: produto.tarefas.filter(t => t.id !== tarefaId)
        };
      }
      return produto;
    }));
  };

  const adicionarProduto = () => {
    // Mostrar lista de produtos disponíveis
    // Por enquanto, vamos usar um prompt simples (pode ser melhorado com um select)
    const produtosDisponiveis = produtos.filter(p => 
      !produtosEditados.find(pe => pe.id === p.id)
    );
    
    if (produtosDisponiveis.length === 0) {
      showToast('info', 'Todos os produtos já estão adicionados.');
      return;
    }

    // Por enquanto, adicionar o primeiro produto disponível
    // TODO: Implementar interface para selecionar produto
    const novoProduto = produtosDisponiveis[0];
    setProdutosEditados(prev => [...prev, {
      id: novoProduto.id,
      nome: novoProduto.nome || novoProduto.produto_nome,
      tarefas: []
    }]);
    setProdutosExpandidos(prev => ({ ...prev, [novoProduto.id]: true }));
  };

  const removerProduto = (produtoId) => {
    setProdutosEditados(prev => prev.filter(p => p.id !== produtoId));
    setProdutosExpandidos(prev => {
      const novo = { ...prev };
      delete novo[produtoId];
      return novo;
    });
  };

  const getTarefasDisponiveis = (produtoId) => {
    if (mostrarTodasTarefas[produtoId]) {
      // Mostrar todas as tarefas
      return tarefas;
    } else {
      // Mostrar apenas tarefas vinculadas ao produto
      return tarefasVinculadasProduto[produtoId] || [];
    }
  };

  // Funções para gerenciar tipos de tarefa e tarefas (produto)
  const toggleTipoTarefaExpandidoProduto = (tipoTarefaId) => {
    setTiposTarefaExpandidosProduto(prev => ({
      ...prev,
      [tipoTarefaId]: !prev[tipoTarefaId]
    }));
  };

  const iniciarAdicionarTarefaProduto = (tipoTarefaId) => {
    setAdicionandoTarefaProduto(tipoTarefaId);
    setMostrarTodasTarefasProduto(prev => ({ ...prev, [tipoTarefaId]: false }));
    setTarefaSelecionadaProduto(prev => ({ ...prev, [tipoTarefaId]: null }));
  };

  const cancelarAdicionarTarefaProduto = (tipoTarefaId) => {
    setAdicionandoTarefaProduto(null);
    setMostrarTodasTarefasProduto(prev => ({ ...prev, [tipoTarefaId]: false }));
    setTarefaSelecionadaProduto(prev => ({ ...prev, [tipoTarefaId]: null }));
  };

  const toggleMostrarTodasTarefasProduto = (tipoTarefaId) => {
    setMostrarTodasTarefasProduto(prev => ({
      ...prev,
      [tipoTarefaId]: !prev[tipoTarefaId]
    }));
  };

  const selecionarTarefaProduto = (tipoTarefaId, tarefaId) => {
    setTarefaSelecionadaProduto(prev => ({
      ...prev,
      [tipoTarefaId]: tarefaId
    }));
  };

  const confirmarAdicionarTarefaProduto = (tipoTarefaId) => {
    const tarefaId = tarefaSelecionadaProduto[tipoTarefaId];
    if (!tarefaId) {
      showToast('warning', 'Selecione uma tarefa para adicionar.');
      return;
    }

    // Verificar se tarefa já está no tipo de tarefa
    const tipoTarefa = tiposTarefaEditadosProduto.find(t => t.id === tipoTarefaId);
    if (tipoTarefa && tipoTarefa.tarefas.find(t => t.id === tarefaId)) {
      showToast('warning', 'Esta tarefa já está vinculada a este tipo.');
      cancelarAdicionarTarefaProduto(tipoTarefaId);
      return;
    }

    // Encontrar nome da tarefa
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) {
      showToast('error', 'Tarefa não encontrada.');
      return;
    }

    // Adicionar tarefa ao estado local
    setTiposTarefaEditadosProduto(prev => prev.map(tipoTarefa => {
      if (tipoTarefa.id === tipoTarefaId) {
        return {
          ...tipoTarefa,
          tarefas: [...tipoTarefa.tarefas, {
            id: tarefaId,
            nome: tarefa.nome || tarefa.tarefa_nome,
            vinculadoId: null // Será criado ao salvar
          }]
        };
      }
      return tipoTarefa;
    }));

    cancelarAdicionarTarefaProduto(tipoTarefaId);
    showToast('success', 'Tarefa adicionada. Clique em "Salvar" para confirmar.');
  };

  const removerTarefaProduto = (tipoTarefaId, tarefaId) => {
    setTiposTarefaEditadosProduto(prev => prev.map(tipoTarefa => {
      if (tipoTarefa.id === tipoTarefaId) {
        return {
          ...tipoTarefa,
          tarefas: tipoTarefa.tarefas.filter(t => t.id !== tarefaId)
        };
      }
      return tipoTarefa;
    }));
  };

  const getTarefasDisponiveisProduto = (tipoTarefaId) => {
    const produtoId = grupoData?.itemPrincipal?.id;
    if (mostrarTodasTarefasProduto[tipoTarefaId]) {
      return tarefas;
    } else {
      return tarefasVinculadasProduto[produtoId] || [];
    }
  };

  const handleSave = async () => {
    if (!grupoData) {
      showToast('error', 'Dados do grupo inválidos.');
      return;
    }

    setSubmitting(true);
    const filtroPrincipal = grupoData.filtroPrincipal;
    
    try {
      if (filtroPrincipal === 'cliente') {
        const clienteId = grupoData.itemPrincipal.id;
        const estadoInicial = initialState || [];
        const estadoFinal = produtosEditados;

        // Identificar mudanças
        const tarefasAdicionadas = [];
        const tarefasRemovidas = [];
        const produtosAdicionados = [];
        const produtosRemovidos = [];

        // Comparar produtos
        const produtosIniciaisMap = new Map(estadoInicial.map(p => [p.id, p]));
        const produtosFinaisMap = new Map(estadoFinal.map(p => [p.id, p]));

        // Produtos removidos
        produtosIniciaisMap.forEach((produto, produtoId) => {
          if (!produtosFinaisMap.has(produtoId)) {
            produtosRemovidos.push(produtoId);
          }
        });

        // Produtos adicionados
        produtosFinaisMap.forEach((produto, produtoId) => {
          if (!produtosIniciaisMap.has(produtoId)) {
            produtosAdicionados.push(produtoId);
          }
        });

        // Comparar tarefas por produto
        produtosFinaisMap.forEach((produtoFinal, produtoId) => {
          const produtoInicial = produtosIniciaisMap.get(produtoId);
          // Tarefas iniciais: apenas as que já estão vinculadas ao cliente (têm vinculadoId)
          const tarefasIniciaisVinculadas = produtoInicial 
            ? new Set(produtoInicial.tarefas.filter(t => t.vinculadoId).map(t => t.id))
            : new Set();
          const tarefasFinais = new Set(produtoFinal.tarefas.map(t => t.id));

          // Tarefas adicionadas: todas as que estão no final mas não estavam vinculadas inicialmente
          tarefasFinais.forEach(tarefaId => {
            if (!tarefasIniciaisVinculadas.has(tarefaId)) {
              tarefasAdicionadas.push({ produtoId, tarefaId });
            }
          });

          // Tarefas removidas: apenas as que estavam vinculadas inicialmente mas não estão mais no final
          tarefasIniciaisVinculadas.forEach(tarefaId => {
            if (!tarefasFinais.has(tarefaId)) {
              tarefasRemovidas.push({ produtoId, tarefaId });
            }
          });
        });

        // Aplicar herança para produtos adicionados
        for (const produtoId of produtosAdicionados) {
          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/aplicar-heranca`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ produtoId, clienteId })
            });

            if (!response.ok) {
              console.error(`Erro ao aplicar herança para produto ${produtoId}`);
            }
          } catch (error) {
            console.error(`Erro ao aplicar herança para produto ${produtoId}:`, error);
          }
        }

        // Remover tarefas
        for (const { produtoId, tarefaId } of tarefasRemovidas) {
          // Buscar vinculadoId
          const produtoInicial = produtosIniciaisMap.get(produtoId);
          const tarefa = produtoInicial?.tarefas.find(t => t.id === tarefaId);
          const vinculadoId = tarefa?.vinculadoId;

          if (vinculadoId) {
            try {
              const response = await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
                method: 'DELETE',
                credentials: 'include'
              });

              if (!response.ok) {
                console.error(`Erro ao remover tarefa ${tarefaId} do produto ${produtoId}`);
              }
            } catch (error) {
              console.error(`Erro ao remover tarefa ${tarefaId} do produto ${produtoId}:`, error);
            }
          }
        }

        // Adicionar tarefas
        if (tarefasAdicionadas.length > 0) {
          const novosVinculados = tarefasAdicionadas.map(({ produtoId, tarefaId }) => ({
            cp_produto: produtoId,
            cp_tarefa: tarefaId,
            cp_cliente: clienteId,
            cp_tarefa_tipo: null
          }));

          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ vinculados: novosVinculados })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erro ao adicionar tarefas');
            }
          } catch (error) {
            console.error('Erro ao adicionar tarefas:', error);
            showToast('error', 'Erro ao adicionar algumas tarefas.');
          }
        }

        showToast('success', 'Vinculações atualizadas com sucesso!');
        navigate('/cadastro/vinculacoes');
      } else if (filtroPrincipal === 'produto') {
        // Editar tipos de tarefa e tarefas padrão do produto (cp_cliente = null) - hierarquia
        const produtoId = grupoData.itemPrincipal.id;
        const estadoInicial = initialState || [];
        const estadoFinal = tiposTarefaEditadosProduto;

        // Criar mapas para comparação
        const tiposIniciaisMap = new Map(estadoInicial.map(t => [t.id, t]));
        const tiposFinaisMap = new Map(estadoFinal.map(t => [t.id, t]));

        const tarefasAdicionadas = [];
        const tarefasRemovidas = [];
        const tiposTarefaAdicionados = [];
        const tiposTarefaRemovidos = [];

        // Comparar tipos de tarefa
        tiposIniciaisMap.forEach((tipo, tipoId) => {
          if (!tiposFinaisMap.has(tipoId)) {
            tiposTarefaRemovidos.push(tipoId);
          }
        });

        tiposFinaisMap.forEach((tipo, tipoId) => {
          if (!tiposIniciaisMap.has(tipoId)) {
            tiposTarefaAdicionados.push(tipoId);
          }
        });

        // Comparar tarefas por tipo de tarefa
        tiposFinaisMap.forEach((tipoFinal, tipoTarefaId) => {
          const tipoInicial = tiposIniciaisMap.get(tipoTarefaId);
          const tarefasIniciais = tipoInicial 
            ? new Set(tipoInicial.tarefas.filter(t => t.vinculadoId).map(t => t.id))
            : new Set();
          const tarefasFinais = new Set(tipoFinal.tarefas.map(t => t.id));

          // Tarefas adicionadas
          tarefasFinais.forEach(tarefaId => {
            if (!tarefasIniciais.has(tarefaId)) {
              tarefasAdicionadas.push({ tipoTarefaId, tarefaId });
            }
          });

          // Tarefas removidas
          tarefasIniciais.forEach(tarefaId => {
            if (!tarefasFinais.has(tarefaId)) {
              const tarefa = tipoInicial.tarefas.find(t => t.id === tarefaId);
              if (tarefa?.vinculadoId) {
                tarefasRemovidas.push({ vinculadoId: tarefa.vinculadoId });
              }
            }
          });
        });

        // Remover tarefas
        for (const { vinculadoId } of tarefasRemovidas) {
          try {
            await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
              method: 'DELETE',
              credentials: 'include'
            });
          } catch (error) {
            console.error(`Erro ao remover tarefa vinculadoId ${vinculadoId}:`, error);
          }
        }

        // Adicionar tipos de tarefa ao produto (sem tarefa específica)
        for (const tipoTarefaId of tiposTarefaAdicionados) {
          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                vinculados: [{
                  cp_produto: produtoId,
                  cp_tarefa_tipo: tipoTarefaId,
                  cp_tarefa: null,
                  cp_cliente: null
                }]
              })
            });
            if (!response.ok) {
              console.error(`Erro ao adicionar tipo de tarefa ${tipoTarefaId} ao produto`);
            }
          } catch (error) {
            console.error(`Erro ao adicionar tipo de tarefa ${tipoTarefaId}:`, error);
          }
        }

        // Adicionar tarefas
        if (tarefasAdicionadas.length > 0) {
          const novosVinculados = tarefasAdicionadas.map(({ tipoTarefaId, tarefaId }) => ({
            cp_produto: produtoId,
            cp_tarefa: tarefaId,
            cp_tarefa_tipo: tipoTarefaId,
            cp_cliente: null
          }));

          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ vinculados: novosVinculados })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erro ao adicionar tarefas');
            }
          } catch (error) {
            console.error('Erro ao adicionar tarefas:', error);
            showToast('error', 'Erro ao adicionar algumas tarefas.');
          }
        }

        // Remover tipos de tarefa (se não houver mais tarefas vinculadas)
        for (const tipoTarefaId of tiposTarefaRemovidos) {
          // Buscar vinculados do tipo de tarefa com o produto (sem tarefa específica)
          try {
            const response = await fetch(`${API_BASE_URL}/vinculados?cp_produto=${produtoId}&cp_tarefa_tipo=${tipoTarefaId}&cp_tarefa=null&cp_cliente=null`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data && result.data.length > 0) {
                for (const vinculado of result.data) {
                  await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                  });
                }
              }
            }
          } catch (error) {
            console.error(`Erro ao remover tipo de tarefa ${tipoTarefaId}:`, error);
          }
        }

        showToast('success', 'Vinculações atualizadas com sucesso!');
        navigate('/cadastro/vinculacoes');
      } else if (filtroPrincipal === 'atividade') {
        // Editar tipos de tarefa vinculados à tarefa
        const tarefaId = grupoData.itemPrincipal.id;
        const estadoInicial = initialState || [];
        const estadoFinal = tiposTarefaEditados;

        const tiposIniciais = new Set(estadoInicial.map(t => t.id));
        const tiposFinais = new Set(estadoFinal.map(t => t.id));

        const tiposAdicionados = estadoFinal.filter(t => !tiposIniciais.has(t.id));
        const tiposRemovidos = estadoInicial.filter(t => !tiposFinais.has(t.id));

        // Remover tipos
        for (const tipo of tiposRemovidos) {
          if (tipo.vinculadoId) {
            try {
              await fetch(`${API_BASE_URL}/vinculados/${tipo.vinculadoId}`, {
                method: 'DELETE',
                credentials: 'include'
              });
            } catch (error) {
              console.error(`Erro ao remover tipo ${tipo.id}:`, error);
            }
          }
        }

        // Adicionar tipos
        if (tiposAdicionados.length > 0) {
          const novosVinculados = tiposAdicionados.map(tipo => ({
            cp_produto: null,
            cp_tarefa: tarefaId,
            cp_cliente: null,
            cp_tarefa_tipo: tipo.id
          }));

          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ vinculados: novosVinculados })
            });

            if (!response.ok) {
              throw new Error('Erro ao adicionar tipos de tarefa');
            }
          } catch (error) {
            console.error('Erro ao adicionar tipos de tarefa:', error);
            showToast('error', 'Erro ao adicionar alguns tipos de tarefa.');
          }
        }

        showToast('success', 'Vinculações atualizadas com sucesso!');
        navigate('/cadastro/vinculacoes');
      } else if (filtroPrincipal === 'tipoTarefa') {
        // Editar tarefas vinculadas ao tipo de tarefa
        const tipoTarefaId = grupoData.itemPrincipal.id;
        const estadoInicial = initialState || [];
        const estadoFinal = tarefasEditadasTipo;

        const tarefasIniciais = new Set(estadoInicial.map(t => t.id));
        const tarefasFinais = new Set(estadoFinal.map(t => t.id));

        const tarefasAdicionadas = estadoFinal.filter(t => !tarefasIniciais.has(t.id));
        const tarefasRemovidas = estadoInicial.filter(t => !tarefasFinais.has(t.id));

        // Remover tarefas
        for (const tarefa of tarefasRemovidas) {
          if (tarefa.vinculadoId) {
            try {
              await fetch(`${API_BASE_URL}/vinculados/${tarefa.vinculadoId}`, {
                method: 'DELETE',
                credentials: 'include'
              });
            } catch (error) {
              console.error(`Erro ao remover tarefa ${tarefa.id}:`, error);
            }
          }
        }

        // Adicionar tarefas
        if (tarefasAdicionadas.length > 0) {
          const novosVinculados = tarefasAdicionadas.map(tarefa => ({
            cp_produto: null,
            cp_tarefa: tarefa.id,
            cp_cliente: null,
            cp_tarefa_tipo: tipoTarefaId
          }));

          try {
            const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ vinculados: novosVinculados })
            });

            if (!response.ok) {
              throw new Error('Erro ao adicionar tarefas');
            }
          } catch (error) {
            console.error('Erro ao adicionar tarefas:', error);
            showToast('error', 'Erro ao adicionar algumas tarefas.');
          }
        }

        showToast('success', 'Vinculações atualizadas com sucesso!');
        navigate('/cadastro/vinculacoes');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('error', 'Erro ao salvar vinculações.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!grupoData) {
    return (
      <Layout>
        <div className="vinculacao-page">
          <div className="vinculacao-page-content">
            <p>Dados do grupo não encontrados.</p>
            <button onClick={() => navigate('/cadastro/vinculacoes')} className="btn-secondary">
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Validar filtro principal
  const filtroPrincipal = grupoData.filtroPrincipal;
  if (!filtroPrincipal || !['cliente', 'produto', 'atividade', 'tipoTarefa'].includes(filtroPrincipal)) {
    return (
      <Layout>
        <div className="vinculacao-page">
          <div className="vinculacao-page-content">
            <p>Filtro principal inválido.</p>
            <button onClick={() => navigate('/cadastro/vinculacoes')} className="btn-secondary">
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="vinculacao-page">
        <div className="vinculacao-page-header">
          <button
            onClick={() => navigate('/cadastro/vinculacoes')}
            className="btn-voltar"
            disabled={submitting}
          >
            <i className="fas fa-arrow-left"></i>
            Voltar
          </button>
          <h1 className="vinculacao-page-title">
            Editando: {grupoData.itemPrincipal.nome}
          </h1>
        </div>

        <div className="vinculacao-page-content">
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <>
              {/* Renderização condicional baseada no filtro principal */}
              {filtroPrincipal === 'cliente' && (
                <>
                  {/* Toggle para agrupar por cliente (quando há múltiplos clientes) */}
                  {Object.keys(clientesAgrupados).length > 1 && (
                    <div className="grupo-edit-toggle-agrupar">
                      <label>
                        <input
                          type="checkbox"
                          checked={agruparPorCliente}
                          onChange={(e) => setAgruparPorCliente(e.target.checked)}
                        />
                        <span>Agrupar por Cliente</span>
                      </label>
                    </div>
                  )}
                  
                  {agruparPorCliente && Object.keys(clientesAgrupados).length > 1 ? (
                    // Modo agrupado por cliente: mostrar cada cliente separadamente
                    <div className="grupo-edit-clientes-agrupados">
                      {Object.values(clientesAgrupados).map(cliente => (
                        <div key={cliente.id} className="grupo-edit-cliente-card">
                          <div className="grupo-edit-cliente-header">
                            <div className="grupo-edit-cliente-title">
                              <i className="fas fa-briefcase"></i>
                              <span>{cliente.nome}</span>
                            </div>
                            <div className="grupo-edit-cliente-actions">
                              <button
                                onClick={() => setClientesExpandidos(prev => ({
                                  ...prev,
                                  [cliente.id]: !prev[cliente.id]
                                }))}
                                className="btn-toggle-expand"
                              >
                                <i className={`fas fa-chevron-${clientesExpandidos[cliente.id] ? 'up' : 'down'}`}></i>
                              </button>
                            </div>
                          </div>
                          
                          {clientesExpandidos[cliente.id] && (
                            <div className="grupo-edit-produtos">
                              {cliente.produtos.map(produto => (
                                <div key={produto.id} className="grupo-edit-produto-card">
                                  <div className="grupo-edit-produto-header">
                                    <div className="grupo-edit-produto-title">
                                      <i className="fas fa-box"></i>
                                      <span>{produto.nome}</span>
                                    </div>
                                    <div className="grupo-edit-produto-actions">
                                      <button
                                        onClick={() => {
                                          const key = `${cliente.id}_${produto.id}`;
                                          setProdutosExpandidos(prev => ({
                                            ...prev,
                                            [key]: !prev[key]
                                          }));
                                        }}
                                        className="btn-toggle-expand"
                                      >
                                        <i className={`fas fa-chevron-${produtosExpandidos[`${cliente.id}_${produto.id}`] ? 'up' : 'down'}`}></i>
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {produtosExpandidos[`${cliente.id}_${produto.id}`] && (
                                    <div className="grupo-edit-produto-body">
                                      <div className="grupo-edit-tarefas-list">
                                        {produto.tarefas && produto.tarefas.length > 0 ? (
                                          produto.tarefas.map(tarefa => (
                                            <div key={`${cliente.id}_${produto.id}_${tarefa.id}`} className="grupo-edit-tarefa-item">
                                              <span>{tarefa.nome}</span>
                                              <button
                                                onClick={() => {
                                                  setClientesAgrupados(prev => {
                                                    const novo = { ...prev };
                                                    novo[cliente.id].produtos = novo[cliente.id].produtos.map(p => 
                                                      p.id === produto.id 
                                                        ? { ...p, tarefas: p.tarefas.filter(t => t.id !== tarefa.id) }
                                                        : p
                                                    );
                                                    return novo;
                                                  });
                                                }}
                                                className="btn-remove-tarefa"
                                                title="Remover tarefa"
                                              >
                                                <i className="fas fa-times"></i>
                                              </button>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="grupo-edit-tarefas-empty">
                                            <span>Nenhuma tarefa vinculada a este produto para este cliente.</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Modo normal: editar todos os produtos de uma vez
                    <div className="grupo-edit-produtos">
                      {produtosEditados.map(produto => (
                  <div key={produto.id} className="grupo-edit-produto-card">
                    <div className="grupo-edit-produto-header">
                      <div className="grupo-edit-produto-title">
                        <i className="fas fa-box"></i>
                        <span>{produto.nome}</span>
                      </div>
                      <div className="grupo-edit-produto-actions">
                        <button
                          onClick={() => toggleProdutoExpandido(produto.id)}
                          className="btn-toggle-expand"
                        >
                          <i className={`fas fa-chevron-${produtosExpandidos[produto.id] ? 'up' : 'down'}`}></i>
                        </button>
                        <button
                          onClick={() => removerProduto(produto.id)}
                          className="btn-remove-produto"
                          title="Remover produto"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>

                    {produtosExpandidos[produto.id] && (
                      <div className="grupo-edit-produto-body">
                        <div className="grupo-edit-tarefas-list">
                          {produto.tarefas && produto.tarefas.length > 0 ? (
                            produto.tarefas.map(tarefa => (
                              <div key={`${produto.id}-${tarefa.id}`} className="grupo-edit-tarefa-item">
                                <span>{tarefa.nome}</span>
                                <button
                                  onClick={() => removerTarefa(produto.id, tarefa.id)}
                                  className="btn-remove-tarefa"
                                  title="Remover tarefa"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="grupo-edit-tarefas-empty">
                              <span>Nenhuma tarefa vinculada a este produto para este cliente.</span>
                            </div>
                          )}
                        </div>

                        {adicionandoTarefaCliente === produto.id ? (
                          <div className="grupo-edit-adicionar-tarefa">
                            <div className="grupo-edit-tarefa-options">
                              <button
                                onClick={() => toggleMostrarTodasTarefas(produto.id)}
                                className="btn-toggle-todas-tarefas"
                              >
                                {mostrarTodasTarefas[produto.id] 
                                  ? 'Mostrar apenas tarefas vinculadas' 
                                  : 'Mostrar todas as tarefas'}
                              </button>
                            </div>

                            <div className="grupo-edit-tarefas-select">
                              {getTarefasDisponiveis(produto.id).map(tarefa => {
                                const jaAdicionada = produto.tarefas.find(t => t.id === tarefa.id);
                                return (
                                  <div
                                    key={tarefa.id}
                                    className={`grupo-edit-tarefa-option ${tarefaSelecionada[produto.id] === tarefa.id ? 'selected' : ''} ${jaAdicionada ? 'disabled' : ''}`}
                                    onClick={() => !jaAdicionada && selecionarTarefa(produto.id, tarefa.id)}
                                  >
                                    <span>{tarefa.nome || tarefa.tarefa_nome}</span>
                                    {jaAdicionada && <span className="badge-added">Já adicionada</span>}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="grupo-edit-tarefa-actions">
                              <button
                                onClick={() => cancelarAdicionarTarefa(produto.id)}
                                className="btn-secondary"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => confirmarAdicionarTarefa(produto.id)}
                                className="btn-primary"
                                disabled={!tarefaSelecionada[produto.id]}
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => iniciarAdicionarTarefa(produto.id)}
                            className="btn-add-tarefa"
                          >
                            <i className="fas fa-plus"></i>
                            Adicionar Tarefa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                  <button
                    onClick={adicionarProduto}
                    className="btn-add-produto"
                  >
                    <i className="fas fa-plus"></i>
                    Adicionar Produto
                  </button>
                </div>
                  )}
                </>
              )}

              {filtroPrincipal === 'produto' && (
                <div className="grupo-edit-produtos">
                  {/* Tipos de Tarefa com suas Tarefas Padrão (sem cliente) */}
                  {tiposTarefaEditadosProduto.map(tipoTarefa => (
                    <div key={tipoTarefa.id} className="grupo-edit-produto-card">
                      <div className="grupo-edit-produto-header">
                        <div className="grupo-edit-produto-title">
                          <i className="fas fa-tags"></i>
                          <span>{tipoTarefa.nome}</span>
                        </div>
                        <div className="grupo-edit-produto-actions">
                          <button
                            onClick={() => toggleTipoTarefaExpandidoProduto(tipoTarefa.id)}
                            className="btn-toggle-expand"
                          >
                            <i className={`fas fa-chevron-${tiposTarefaExpandidosProduto[tipoTarefa.id] ? 'up' : 'down'}`}></i>
                          </button>
                        </div>
                      </div>

                      {tiposTarefaExpandidosProduto[tipoTarefa.id] && (
                        <div className="grupo-edit-produto-body">
                          <div className="grupo-edit-tarefas-list">
                            {tipoTarefa.tarefas && tipoTarefa.tarefas.length > 0 ? (
                              tipoTarefa.tarefas.map(tarefa => (
                                <div key={`${tipoTarefa.id}-${tarefa.id}`} className="grupo-edit-tarefa-item">
                                  <span>{tarefa.nome}</span>
                                  <button
                                    onClick={() => removerTarefaProduto(tipoTarefa.id, tarefa.id)}
                                    className="btn-remove-tarefa"
                                    title="Remover tarefa"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="grupo-edit-tarefas-empty">
                                <span>Nenhuma tarefa vinculada a este tipo.</span>
                              </div>
                            )}
                          </div>

                          {adicionandoTarefaProduto === tipoTarefa.id ? (
                            <div className="grupo-edit-adicionar-tarefa">
                              <div className="grupo-edit-tarefa-options">
                                <button
                                  onClick={() => toggleMostrarTodasTarefasProduto(tipoTarefa.id)}
                                  className="btn-toggle-todas-tarefas"
                                >
                                  {mostrarTodasTarefasProduto[tipoTarefa.id]
                                    ? 'Mostrar apenas tarefas vinculadas'
                                    : 'Mostrar todas as tarefas'}
                                </button>
                              </div>

                              <div className="grupo-edit-tarefas-select">
                                {getTarefasDisponiveisProduto(tipoTarefa.id).map(tarefa => {
                                  const jaAdicionada = tipoTarefa.tarefas.find(t => t.id === tarefa.id);
                                  return (
                                    <div
                                      key={tarefa.id}
                                      className={`grupo-edit-tarefa-option ${tarefaSelecionadaProduto[tipoTarefa.id] === tarefa.id ? 'selected' : ''} ${jaAdicionada ? 'disabled' : ''}`}
                                      onClick={() => !jaAdicionada && selecionarTarefaProduto(tipoTarefa.id, tarefa.id)}
                                    >
                                      <span>{tarefa.nome || tarefa.tarefa_nome}</span>
                                      {jaAdicionada && <span className="badge-added">Já adicionada</span>}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="grupo-edit-tarefa-actions">
                                <button
                                  onClick={() => cancelarAdicionarTarefaProduto(tipoTarefa.id)}
                                  className="btn-secondary"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => confirmarAdicionarTarefaProduto(tipoTarefa.id)}
                                  className="btn-primary"
                                  disabled={!tarefaSelecionadaProduto[tipoTarefa.id]}
                                >
                                  Adicionar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => iniciarAdicionarTarefaProduto(tipoTarefa.id)}
                              className="btn-add-tarefa"
                            >
                              <i className="fas fa-plus"></i>
                              Adicionar Tarefa
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {filtroPrincipal === 'atividade' && (
                <div className="grupo-edit-tipos-tarefa">
                  <div className="grupo-edit-tarefas-list">
                    {tiposTarefaEditados && tiposTarefaEditados.length > 0 ? (
                      tiposTarefaEditados.map(tipo => (
                        <div key={tipo.id} className="grupo-edit-tarefa-item">
                          <span>{tipo.nome}</span>
                          <button
                            onClick={() => setTiposTarefaEditados(prev => prev.filter(t => t.id !== tipo.id))}
                            className="btn-remove-tarefa"
                            title="Remover tipo de tarefa"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="grupo-edit-tarefas-empty">
                        <span>Nenhum tipo de tarefa vinculado a esta tarefa.</span>
                      </div>
                    )}
                  </div>

                  {adicionandoTipoTarefa ? (
                    <div className="grupo-edit-adicionar-tarefa">
                      <div className="grupo-edit-tarefas-select">
                        {tiposTarefa.filter(tipo => !tiposTarefaEditados.find(t => t.id === tipo.id)).map(tipo => (
                          <div
                            key={tipo.id}
                            className={`grupo-edit-tarefa-option ${tipoTarefaSelecionado === tipo.id ? 'selected' : ''}`}
                            onClick={() => setTipoTarefaSelecionado(tipo.id)}
                          >
                            <span>{tipo.nome || tipo.tipo_nome}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grupo-edit-tarefa-actions">
                        <button
                          onClick={() => {
                            setAdicionandoTipoTarefa(false);
                            setTipoTarefaSelecionado(null);
                          }}
                          className="btn-secondary"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            if (tipoTarefaSelecionado) {
                              const tipo = tiposTarefa.find(t => t.id === tipoTarefaSelecionado);
                              if (tipo) {
                                setTiposTarefaEditados(prev => [...prev, {
                                  id: tipo.id,
                                  nome: tipo.nome || tipo.tipo_nome,
                                  vinculadoId: null
                                }]);
                                setAdicionandoTipoTarefa(false);
                                setTipoTarefaSelecionado(null);
                                showToast('success', 'Tipo de tarefa adicionado. Clique em "Salvar" para confirmar.');
                              }
                            }
                          }}
                          className="btn-primary"
                          disabled={!tipoTarefaSelecionado}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAdicionandoTipoTarefa(true);
                        setTipoTarefaSelecionado(null);
                      }}
                      className="btn-add-tarefa"
                    >
                      <i className="fas fa-plus"></i>
                      Adicionar Tipo de Tarefa
                    </button>
                  )}
                </div>
              )}

              {filtroPrincipal === 'tipoTarefa' && (
                <div className="grupo-edit-tarefas-tipo">
                  <div className="grupo-edit-tarefas-list">
                    {tarefasEditadasTipo && tarefasEditadasTipo.length > 0 ? (
                      tarefasEditadasTipo.map(tarefa => (
                        <div key={tarefa.id} className="grupo-edit-tarefa-item">
                          <span>{tarefa.nome}</span>
                          <button
                            onClick={() => setTarefasEditadasTipo(prev => prev.filter(t => t.id !== tarefa.id))}
                            className="btn-remove-tarefa"
                            title="Remover tarefa"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="grupo-edit-tarefas-empty">
                        <span>Nenhuma tarefa vinculada a este tipo de tarefa.</span>
                      </div>
                    )}
                  </div>

                  {adicionandoTarefaTipo ? (
                    <div className="grupo-edit-adicionar-tarefa">
                      <div className="grupo-edit-tarefas-select">
                        {tarefas.filter(tarefa => !tarefasEditadasTipo.find(t => t.id === tarefa.id)).map(tarefa => (
                          <div
                            key={tarefa.id}
                            className={`grupo-edit-tarefa-option ${tarefaSelecionadaTipo === tarefa.id ? 'selected' : ''}`}
                            onClick={() => setTarefaSelecionadaTipo(tarefa.id)}
                          >
                            <span>{tarefa.nome || tarefa.tarefa_nome}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grupo-edit-tarefa-actions">
                        <button
                          onClick={() => {
                            setAdicionandoTarefaTipo(false);
                            setTarefaSelecionadaTipo(null);
                          }}
                          className="btn-secondary"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            if (tarefaSelecionadaTipo) {
                              const tarefa = tarefas.find(t => t.id === tarefaSelecionadaTipo);
                              if (tarefa) {
                                setTarefasEditadasTipo(prev => [...prev, {
                                  id: tarefa.id,
                                  nome: tarefa.nome || tarefa.tarefa_nome,
                                  vinculadoId: null
                                }]);
                                setAdicionandoTarefaTipo(false);
                                setTarefaSelecionadaTipo(null);
                                showToast('success', 'Tarefa adicionada. Clique em "Salvar" para confirmar.');
                              }
                            }
                          }}
                          className="btn-primary"
                          disabled={!tarefaSelecionadaTipo}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAdicionandoTarefaTipo(true);
                        setTarefaSelecionadaTipo(null);
                      }}
                      className="btn-add-tarefa"
                    >
                      <i className="fas fa-plus"></i>
                      Adicionar Tarefa
                    </button>
                  )}
                </div>
              )}

              <div className="vinculacao-page-footer">
                <button
                  onClick={() => navigate('/cadastro/vinculacoes')}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <ButtonPrimary
                  onClick={handleSave}
                  disabled={submitting || loading}
                  icon="fas fa-save"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </ButtonPrimary>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EditarVinculacaoGrupo;

