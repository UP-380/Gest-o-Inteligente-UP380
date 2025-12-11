import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import SelectedItemsList from '../../components/vinculacoes/SelectedItemsList';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import TempoEstimadoInput from '../../components/common/TempoEstimadoInput';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI } from '../../services/api';
import '../../components/vinculacoes/VinculacaoModal.css';
import './DelegarTarefas.css';

const API_BASE_URL = '/api';

const DelegarTarefas = () => {
  const showToast = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estados dos selects
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState([]);
  const [expandedSelects, setExpandedSelects] = useState({}); // Controla quais selects estão expandidos
  
  // Estados de período e responsável
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [tempoEstimadoDia, setTempoEstimadoDia] = useState(0); // em milissegundos
  const [colaboradores, setColaboradores] = useState([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(null);

  // Estados para CRUD
  const [registrosTempoEstimado, setRegistrosTempoEstimado] = useState([]);
  const [registrosAgrupados, setRegistrosAgrupados] = useState([]); // Registros agrupados por agrupador_id
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [agrupamentoEditando, setAgrupamentoEditando] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agrupamentoParaDeletar, setAgrupamentoParaDeletar] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Cache de nomes (produtos, tarefas, clientes)
  const [nomesCache, setNomesCache] = useState({
    produtos: {},
    tarefas: {},
    clientes: {},
    colaboradores: {}
  });

  // Carregar clientes, colaboradores e registros ao montar
  useEffect(() => {
    loadClientes();
    loadColaboradores();
    loadRegistrosTempoEstimado();
  }, []);

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

  // Carregar produtos vinculados ao cliente selecionado
  useEffect(() => {
    if (clienteSelecionado) {
      loadProdutosPorCliente(clienteSelecionado);
    } else {
      setProdutos([]);
      setProdutosSelecionados([]);
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  }, [clienteSelecionado]);

  const loadProdutosPorCliente = async (clienteId) => {
    setLoading(true);
    try {
      // Buscar produtos vinculados a este cliente na tabela vinculados
      const response = await fetch(`${API_BASE_URL}/produtos-por-cliente?clienteId=${clienteId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProdutos(result.data || []);
        } else {
          setProdutos([]);
        }
      } else {
        setProdutos([]);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      showToast('error', 'Erro ao carregar produtos vinculados ao cliente');
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar tarefas vinculadas ao cliente e produtos selecionados
  useEffect(() => {
    if (clienteSelecionado && produtosSelecionados.length > 0) {
      loadTarefasPorClienteEProdutos(clienteSelecionado, produtosSelecionados);
    } else {
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  }, [clienteSelecionado, produtosSelecionados]);

  const loadTarefasPorClienteEProdutos = async (clienteId, produtoIds) => {
    if (!clienteId || !produtoIds || produtoIds.length === 0) {
      setTarefas([]);
      return;
    }

    setLoading(true);
    try {
      const produtoIdsNum = produtoIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
      if (produtoIdsNum.length === 0) {
        setTarefas([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteId}&produtoIds=${produtoIdsNum.join(',')}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Coletar todas as tarefas únicas de todos os produtos
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
          
          setTarefas(todasTarefas);
          // Automaticamente selecionar todas as tarefas vinculadas aos produtos
          setTarefasSelecionadas(todasTarefas.map(t => String(t.id)));
        } else {
          setTarefas([]);
        }
      } else {
        setTarefas([]);
      }
    } catch (error) {
      console.error('Erro ao buscar tarefas vinculadas:', error);
      setTarefas([]);
    } finally {
      setLoading(false);
    }
  };

  // Handlers dos selects
  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    if (clienteId) {
      setClienteSelecionado(clienteId);
      setProdutosSelecionados([]);
      setTarefasSelecionadas([]);
    } else {
      setClienteSelecionado(null);
    }
  };

  const handleProdutoSelect = (produtoId) => {
    if (!produtoId) return;
    const produtoIdStr = String(produtoId);
    if (!produtosSelecionados.includes(produtoIdStr)) {
      setProdutosSelecionados([...produtosSelecionados, produtoIdStr]);
    }
  };

  const handleProdutoRemove = (produtoId) => {
    const novosProdutosSelecionados = produtosSelecionados.filter(id => id !== produtoId);
    setProdutosSelecionados(novosProdutosSelecionados);
    // Se não há mais produtos, limpar tarefas
    if (novosProdutosSelecionados.length === 0) {
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  };

  const handleTarefaSelect = (tarefaId) => {
    if (!tarefaId) return;
    const tarefaIdStr = String(tarefaId);
    if (!tarefasSelecionadas.includes(tarefaIdStr)) {
      setTarefasSelecionadas([...tarefasSelecionadas, tarefaIdStr]);
    }
  };

  const handleTarefaRemove = (tarefaId) => {
    setTarefasSelecionadas(tarefasSelecionadas.filter(id => id !== tarefaId));
  };

  const handleSelectAllProdutos = () => {
    const allProdutoIds = produtos.map(p => String(p.id));
    const allSelected = allProdutoIds.every(id => produtosSelecionados.includes(id));
    
    if (allSelected) {
      setProdutosSelecionados([]);
    } else {
      setProdutosSelecionados(allProdutoIds);
    }
  };

  const handleSelectAllTarefas = () => {
    const allTarefaIds = tarefas.map(t => String(t.id));
    const allSelected = allTarefaIds.every(id => tarefasSelecionadas.includes(id));
    
    if (allSelected) {
      setTarefasSelecionadas([]);
    } else {
      setTarefasSelecionadas(allTarefaIds);
    }
  };

  // Obter opções dos selects
  const getClienteOptions = () => {
    return clientes.map(c => ({ value: c.id, label: c.nome }));
  };

  const getProdutoOptions = () => {
    // Mostrar todas as opções, mesmo as já selecionadas
    // O CustomSelect vai marcar as selecionadas automaticamente
    return produtos.map(p => ({ value: p.id, label: p.nome }));
  };

  const getTarefaOptions = () => {
    // Mostrar todas as tarefas, mesmo as já selecionadas
    // O CustomSelect vai marcar as selecionadas automaticamente
    return tarefas.map(t => ({ value: t.id, label: t.nome }));
  };

  // Obter label de um item
  const getClienteLabel = (clienteId) => {
    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    return cliente ? cliente.nome : clienteId;
  };

  const getProdutoLabel = (produtoId) => {
    const produto = produtos.find(p => String(p.id) === String(produtoId));
    return produto ? produto.nome : produtoId;
  };

  const getTarefaLabel = (tarefaId) => {
    const tarefa = tarefas.find(t => String(t.id) === String(tarefaId));
    return tarefa ? tarefa.nome : tarefaId;
  };

  const getColaboradorLabel = (colaboradorId) => {
    const colaborador = colaboradores.find(c => String(c.id) === String(colaboradorId));
    if (colaborador) {
      return colaborador.cpf ? `${colaborador.nome} (${colaborador.cpf})` : colaborador.nome;
    }
    return colaboradorId;
  };

  const getColaboradorOptions = () => {
    return colaboradores.map(c => ({ 
      value: c.id, 
      label: c.cpf ? `${c.nome} (${c.cpf})` : c.nome 
    }));
  };

  // Salvar delegação
  const handleSave = async () => {
    if (!clienteSelecionado) {
      showToast('warning', 'Selecione um cliente');
      return;
    }

    if (produtosSelecionados.length === 0) {
      showToast('warning', 'Selecione pelo menos um produto');
      return;
    }

    if (tarefasSelecionadas.length === 0) {
      showToast('warning', 'Selecione pelo menos uma tarefa');
      return;
    }

    if (!dataInicio || !dataFim) {
      showToast('warning', 'Selecione o período (data início e vencimento)');
      return;
    }

    if (!tempoEstimadoDia || tempoEstimadoDia <= 0) {
      showToast('warning', 'Informe o tempo estimado por dia');
      return;
    }

    if (!responsavelSelecionado) {
      showToast('warning', 'Selecione um responsável');
      return;
    }

    setSubmitting(true);
    try {
      // Preparar dados para salvar
      const dadosParaSalvar = {
        cliente_id: clienteSelecionado,
        produto_ids: produtosSelecionados.map(id => String(id)),
        tarefa_ids: tarefasSelecionadas.map(id => String(id)),
        data_inicio: dataInicio,
        data_fim: dataFim,
        tempo_estimado_dia: tempoEstimadoDia, // em milissegundos
        responsavel_id: String(responsavelSelecionado)
      };

      console.log('📝 Salvando tempo estimado:', dadosParaSalvar);

      const response = await fetch(`${API_BASE_URL}/tempo-estimado`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(dadosParaSalvar),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        showToast('error', text || `Erro no servidor. Status: ${response.status}`);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || result.hint || result.message || `Erro HTTP ${response.status}`;
        console.error('❌ Erro ao salvar tempo estimado:', result);
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        const count = result.count || result.data?.length || 0;
        showToast('success', `${count} registro(s) de tempo estimado criado(s) com sucesso!`);
        
        // Limpar seleções após salvar
        setClienteSelecionado(null);
        setProdutosSelecionados([]);
        setTarefasSelecionadas([]);
        setDataInicio(null);
        setDataFim(null);
        setTempoEstimadoDia(0);
        setResponsavelSelecionado(null);
        
        // Recarregar lista de registros
        loadRegistrosTempoEstimado();
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tempo estimado';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao delegar tarefas:', error);
      showToast('error', error.message || 'Erro ao delegar tarefas. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
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
      const datas = grupo.registros.map(r => new Date(r.data)).sort((a, b) => a - b);
      if (datas.length > 0) {
        grupo.dataInicio = datas[0];
        grupo.dataFim = datas[datas.length - 1];
      }
    });
    
    setRegistrosAgrupados(Array.from(grupos.values()));
  };

  // Carregar registros de tempo estimado
  const loadRegistrosTempoEstimado = async () => {
    setLoadingRegistros(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tempo-estimado?limit=100`, {
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
          setRegistrosTempoEstimado(result.data || []);
          // Agrupar registros por agrupador_id
          agruparRegistros(result.data || []);
          // Carregar nomes dos itens relacionados
          await carregarNomesRelacionados(result.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      showToast('error', 'Erro ao carregar registros de tempo estimado');
    } finally {
      setLoadingRegistros(false);
    }
  };

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

  const getNomeCliente = (clienteId) => {
    return nomesCache.clientes[String(clienteId)] || getClienteLabel(clienteId) || `Cliente #${clienteId}`;
  };

  const getNomeColaborador = (colabId) => {
    return nomesCache.colaboradores[String(colabId)] || getColaboradorLabel(colabId) || `Colaborador #${colabId}`;
  };

  // Formatar data
  const formatarData = (dataStr) => {
    if (!dataStr) return '—';
    try {
      const date = new Date(dataStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return '—';
    }
  };

  // Formatar período
  const formatarPeriodo = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) return '—';
    return `${formatarData(dataInicio)} até ${formatarData(dataFim)}`;
  };

  // Editar agrupamento
  const handleEdit = async (agrupamento) => {
    setAgrupamentoEditando(agrupamento);
    
    // Buscar todos os registros do agrupamento para obter produtos e tarefas únicos
    const response = await fetch(`${API_BASE_URL}/tempo-estimado/agrupador/${agrupamento.agrupador_id}`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        const registros = result.data;
        const primeiroRegistro = registros[0];
        
        // Preencher formulário com dados do primeiro registro
        setClienteSelecionado(primeiroRegistro.cliente_id);
        
        // Coletar produtos e tarefas únicos do agrupamento
        const produtosUnicos = [...new Set(registros.map(r => String(r.produto_id)))];
        const tarefasUnicas = [...new Set(registros.map(r => String(r.tarefa_id)))];
        
        // Carregar produtos do cliente primeiro
        await loadProdutosPorCliente(primeiroRegistro.cliente_id);
        
        // Preencher produtos selecionados
        setProdutosSelecionados(produtosUnicos);
        
        // Carregar tarefas do cliente e produtos
        await loadTarefasPorClienteEProdutos(primeiroRegistro.cliente_id, produtosUnicos);
        
        // Preencher tarefas selecionadas
        setTarefasSelecionadas(tarefasUnicas);
        
        // Extrair período (primeira e última data)
        const datas = registros.map(r => r.data).sort();
        const dataInicioStr = datas[0] ? datas[0].split('T')[0] : null;
        const dataFimStr = datas[datas.length - 1] ? datas[datas.length - 1].split('T')[0] : null;
        setDataInicio(dataInicioStr);
        setDataFim(dataFimStr);
        
        // Carregar tempo estimado (pegar do primeiro registro)
        setTempoEstimadoDia(primeiroRegistro.tempo_estimado_dia || 0);
        
        setResponsavelSelecionado(primeiroRegistro.responsavel_id);
      }
    }
    
    // Scroll para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Salvar edição do agrupamento
  const handleUpdate = async () => {
    if (!agrupamentoEditando) return;

    if (!clienteSelecionado || produtosSelecionados.length === 0 || tarefasSelecionadas.length === 0 || !dataInicio || !dataFim || !responsavelSelecionado) {
      showToast('warning', 'Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    try {
      const dadosUpdate = {
        cliente_id: clienteSelecionado,
        produto_ids: produtosSelecionados.map(id => String(id)),
        tarefa_ids: tarefasSelecionadas.map(id => String(id)),
        data_inicio: dataInicio,
        data_fim: dataFim,
        tempo_estimado_dia: tempoEstimadoDia, // em milissegundos
        responsavel_id: String(responsavelSelecionado)
      };

      const response = await fetch(`${API_BASE_URL}/tempo-estimado/agrupador/${agrupamentoEditando.agrupador_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(dadosUpdate),
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
        const count = result.count || 0;
        showToast('success', `${count} registro(s) atualizado(s) com sucesso!`);
        setAgrupamentoEditando(null);
        // Limpar formulário
        setClienteSelecionado(null);
        setProdutosSelecionados([]);
        setTarefasSelecionadas([]);
        setDataInicio(null);
        setDataFim(null);
        setTempoEstimadoDia(0);
        setResponsavelSelecionado(null);
        // Recarregar lista
        loadRegistrosTempoEstimado();
      }
    } catch (error) {
      console.error('Erro ao atualizar agrupamento:', error);
      showToast('error', 'Erro ao atualizar agrupamento');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar agrupamento
  const handleDelete = async () => {
    if (!agrupamentoParaDeletar) return;

    setDeleting(true);
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
        showToast('success', `${count} registro(s) deletado(s) com sucesso!`);
        setShowDeleteModal(false);
        setAgrupamentoParaDeletar(null);
        // Recarregar lista
        loadRegistrosTempoEstimado();
      }
    } catch (error) {
      console.error('Erro ao deletar agrupamento:', error);
      showToast('error', 'Erro ao deletar agrupamento');
    } finally {
      setDeleting(false);
    }
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setAgrupamentoEditando(null);
    setClienteSelecionado(null);
    setProdutosSelecionados([]);
    setTarefasSelecionadas([]);
    setDataInicio(null);
    setDataFim(null);
    setResponsavelSelecionado(null);
  };

  return (
    <Layout>
      <div className="delegar-tarefas-container">
        <div className="page-header">
          <h1>Delegar Tarefas</h1>
          <p className="page-description">
            {agrupamentoEditando ? 'Editar delegação de tarefa' : 'Selecione um cliente, seus produtos vinculados e as tarefas que deseja delegar'}
          </p>
          {agrupamentoEditando && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="btn-secondary"
              style={{ marginTop: '12px' }}
            >
              <i className="fas fa-times" style={{ marginRight: '8px' }}></i>
              Cancelar Edição
            </button>
          )}
        </div>

        <div className="delegar-tarefas-content">
          {/* Select de Clientes */}
          <div className="select-group">
            <label className="select-label">
              <i className="fas fa-user" style={{ marginRight: '8px' }}></i>
              Cliente
            </label>
            <div className="select-wrapper">
              <CustomSelect
                value={clienteSelecionado || ''}
                options={getClienteOptions()}
                onChange={handleClienteChange}
                placeholder="Selecione um cliente"
                disabled={loading || submitting}
                keepOpen={false}
                selectedItems={clienteSelecionado ? [String(clienteSelecionado)] : []}
                hideCheckboxes={true}
                maxVisibleOptions={5}
                enableSearch={true}
              />
            </div>
            {clienteSelecionado && (
              <SelectedItemsList
                items={[String(clienteSelecionado)]}
                getItemLabel={getClienteLabel}
                onRemoveItem={() => {
                  setClienteSelecionado(null);
                  setProdutosSelecionados([]);
                  setTarefasSelecionadas([]);
                }}
                canRemove={true}
                isExpanded={false}
                onToggleExpand={() => {}}
              />
            )}
          </div>

          {/* Select de Produtos - só aparece se cliente estiver selecionado */}
          {clienteSelecionado && (
            <div className="select-group">
              <label className="select-label">
                <i className="fas fa-box" style={{ marginRight: '8px' }}></i>
                Produtos Vinculados
              </label>
              
              {/* Lista de produtos selecionados */}
              <SelectedItemsList
                items={produtosSelecionados}
                getItemLabel={getProdutoLabel}
                onRemoveItem={handleProdutoRemove}
                canRemove={true}
                isExpanded={expandedSelects['produtos'] || false}
                onToggleExpand={() => setExpandedSelects(prev => ({
                  ...prev,
                  'produtos': !prev['produtos']
                }))}
              />

              <div className="select-wrapper">
                <CustomSelect
                  value=""
                  options={getProdutoOptions()}
                  onChange={(e) => handleProdutoSelect(e.target.value)}
                  placeholder="Selecione produtos"
                  disabled={loading || submitting || produtos.length === 0}
                  keepOpen={true}
                  selectedItems={produtosSelecionados.map(id => String(id))}
                  onSelectAll={handleSelectAllProdutos}
                  hideCheckboxes={false}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {produtos.length === 0 && !loading && (
                <p className="empty-message">Nenhum produto vinculado a este cliente</p>
              )}
            </div>
          )}

          {/* Select de Tarefas - só aparece se produtos estiverem selecionados */}
          {produtosSelecionados.length > 0 && (
            <div className="select-group">
              <label className="select-label">
                <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                Tarefas Vinculadas
              </label>
              
              {/* Lista de tarefas selecionadas */}
              <SelectedItemsList
                items={tarefasSelecionadas}
                getItemLabel={getTarefaLabel}
                onRemoveItem={handleTarefaRemove}
                canRemove={true}
                isExpanded={expandedSelects['tarefas'] || false}
                onToggleExpand={() => setExpandedSelects(prev => ({
                  ...prev,
                  'tarefas': !prev['tarefas']
                }))}
              />

              <div className="select-wrapper">
                <CustomSelect
                  value=""
                  options={getTarefaOptions()}
                  onChange={(e) => handleTarefaSelect(e.target.value)}
                  placeholder="Selecione tarefas"
                  disabled={loading || submitting || tarefas.length === 0}
                  keepOpen={true}
                  selectedItems={tarefasSelecionadas.map(id => String(id))}
                  onSelectAll={handleSelectAllTarefas}
                  hideCheckboxes={false}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {tarefas.length === 0 && !loading && (
                <p className="empty-message">Nenhuma tarefa vinculada aos produtos selecionados</p>
              )}
            </div>
          )}

          {/* Campo de Período - só aparece se tarefas estiverem selecionadas */}
          {tarefasSelecionadas.length > 0 && (
            <div className="select-group">
              <div style={{ marginBottom: '12px' }}>
                <label className="select-label">
                  <i className="fas fa-calendar-alt" style={{ marginRight: '8px' }}></i>
                  Período
                </label>
              </div>
              <FilterPeriodo
                dataInicio={dataInicio}
                dataFim={dataFim}
                onInicioChange={(e) => setDataInicio(e.target.value || null)}
                onFimChange={(e) => setDataFim(e.target.value || null)}
                disabled={loading || submitting}
              />
            </div>
          )}

          {/* Campo de Tempo Estimado - só aparece se período estiver definido */}
          {dataInicio && dataFim && (
            <div className="select-group">
              <TempoEstimadoInput
                value={tempoEstimadoDia}
                onChange={setTempoEstimadoDia}
                disabled={loading || submitting}
                placeholder="Ex: 1h 30min ou 90min"
              />
            </div>
          )}

          {/* Campo de Responsável - só aparece se período estiver definido */}
          {dataInicio && dataFim && (
            <div className="select-group">
              <label className="select-label">
                <i className="fas fa-user-tie" style={{ marginRight: '8px' }}></i>
                Responsável
              </label>
              
              {responsavelSelecionado && (
                <SelectedItemsList
                  items={[String(responsavelSelecionado)]}
                  getItemLabel={getColaboradorLabel}
                  onRemoveItem={() => setResponsavelSelecionado(null)}
                  canRemove={true}
                  isExpanded={false}
                  onToggleExpand={() => {}}
                />
              )}

              <div className="select-wrapper">
                <CustomSelect
                  value={responsavelSelecionado || ''}
                  options={getColaboradorOptions()}
                  onChange={(e) => setResponsavelSelecionado(e.target.value || null)}
                  placeholder="Selecione um responsável"
                  disabled={loading || submitting || colaboradores.length === 0}
                  keepOpen={false}
                  selectedItems={responsavelSelecionado ? [String(responsavelSelecionado)] : []}
                  hideCheckboxes={true}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {colaboradores.length === 0 && !loading && (
                <p className="empty-message">Nenhum colaborador disponível</p>
              )}
            </div>
          )}

          {/* Botão de Salvar/Atualizar */}
          {clienteSelecionado && produtosSelecionados.length > 0 && tarefasSelecionadas.length > 0 && dataInicio && dataFim && tempoEstimadoDia > 0 && responsavelSelecionado && (
            <div className="action-buttons">
              {agrupamentoEditando ? (
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={loading || submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save" style={{ marginRight: '8px' }}></i>
                      Atualizar Registro
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                      Delegando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save" style={{ marginRight: '8px' }}></i>
                      Delegar Tarefas
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lista de Registros */}
        <div className="registros-list-container" style={{ marginTop: '48px' }}>
          <div className="page-header">
            <h2>Registros de Tempo Estimado</h2>
            <button
              type="button"
              onClick={loadRegistrosTempoEstimado}
              disabled={loadingRegistros}
              className="btn-secondary"
              style={{ marginTop: '12px' }}
            >
              {loadingRegistros ? (
                <>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                  Carregando...
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt" style={{ marginRight: '8px' }}></i>
                  Atualizar Lista
                </>
              )}
            </button>
          </div>

          {loadingRegistros ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: '#0e3b6f' }}></i>
              <p style={{ marginTop: '12px', color: '#64748b' }}>Carregando registros...</p>
            </div>
          ) : registrosAgrupados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
              <i className="fas fa-inbox" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '16px' }}></i>
              <p style={{ color: '#64748b' }}>Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="registros-table-container" style={{ background: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
              <table className="registros-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Cliente</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Produtos</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Tarefas</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Período</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Responsável</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#0e3b6f', fontSize: '13px' }}>Registros</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: '#0e3b6f', fontSize: '13px', width: '120px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosAgrupados.map((agrupamento) => {
                    const primeiroRegistro = agrupamento.primeiroRegistro;
                    const produtosUnicos = [...new Set(agrupamento.registros.map(r => r.produto_id))];
                    const tarefasUnicas = [...new Set(agrupamento.registros.map(r => r.tarefa_id))];
                    
                    return (
                      <tr key={agrupamento.agrupador_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>{getNomeCliente(primeiroRegistro.cliente_id)}</td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>
                          {produtosUnicos.map(id => getNomeProduto(id)).join(', ')}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>
                          {tarefasUnicas.map(id => getNomeTarefa(id)).join(', ')}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>
                          {formatarPeriodo(agrupamento.dataInicio, agrupamento.dataFim)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#334155' }}>{getNomeColaborador(primeiroRegistro.responsavel_id)}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                          {agrupamento.quantidade} dia(s)
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleEdit(agrupamento)}
                              className="btn-icon btn-edit"
                              title="Editar Agrupamento"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#0e3b6f', 
                                cursor: 'pointer',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.target.style.background = 'none'}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAgrupamentoParaDeletar(agrupamento);
                                setShowDeleteModal(true);
                              }}
                              className="btn-icon btn-delete"
                              title="Deletar Agrupamento"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#dc2626', 
                                cursor: 'pointer',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#fee2e2'}
                              onMouseLeave={(e) => e.target.style.background = 'none'}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setRegistroParaDeletar(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={
          agrupamentoParaDeletar ? (
            <>
              <p>
                Tem certeza que deseja deletar este agrupamento?
              </p>
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
                <strong>Cliente:</strong> {getNomeCliente(agrupamentoParaDeletar.primeiroRegistro.cliente_id)}<br />
                <strong>Período:</strong> {formatarPeriodo(agrupamentoParaDeletar.dataInicio, agrupamentoParaDeletar.dataFim)}<br />
                <strong>Quantidade de registros:</strong> {agrupamentoParaDeletar.quantidade} dia(s)
              </p>
              <p className="warning-text" style={{ marginTop: '12px', color: '#dc2626', fontWeight: 500 }}>
                Todos os {agrupamentoParaDeletar.quantidade} registro(s) deste agrupamento serão deletados. Esta ação não pode ser desfeita.
              </p>
            </>
          ) : null
        }
        confirmText="Deletar"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleting}
      />
    </Layout>
  );
};

export default DelegarTarefas;

