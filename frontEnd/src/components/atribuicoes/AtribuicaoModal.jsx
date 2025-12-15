import React, { useState, useEffect, useCallback } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import SelectedItemsList from '../vinculacoes/SelectedItemsList';
import FilterPeriodo from '../filters/FilterPeriodo';
import TempoEstimadoInput from '../common/TempoEstimadoInput';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI } from '../../services/api';
import '../vinculacoes/VinculacaoModal.css';
import './AtribuicaoModal.css';

const API_BASE_URL = '/api';

const AtribuicaoModal = ({ isOpen, onClose, editingAgrupamento = null }) => {
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
  const [expandedSelects, setExpandedSelects] = useState({});
  
  // Estados de período e responsável
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [tempoEstimadoDia, setTempoEstimadoDia] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(null);
  const [horasContratadasDia, setHorasContratadasDia] = useState(null);
  const [erroTempoEstimado, setErroTempoEstimado] = useState(null);
  const [erroDuplicata, setErroDuplicata] = useState(null);
  const [verificandoDuplicata, setVerificandoDuplicata] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadClientes();
      loadColaboradores();
      
      // Se estiver editando, carregar dados do agrupamento
      if (editingAgrupamento) {
        loadDadosEdicao(editingAgrupamento);
      } else {
        // Limpar formulário ao abrir para nova atribuição
        resetForm();
      }
    }
  }, [isOpen, editingAgrupamento]);

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

  const loadDadosEdicao = async (agrupamento) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tempo-estimado/agrupador/${agrupamento.agrupador_id}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const registros = result.data;
          const primeiroRegistro = registros[0];
          
          setClienteSelecionado(primeiroRegistro.cliente_id);
          
          const produtosUnicos = [...new Set(registros.map(r => String(r.produto_id)))];
          const tarefasUnicas = [...new Set(registros.map(r => String(r.tarefa_id)))];
          
          await loadProdutosPorCliente(primeiroRegistro.cliente_id);
          setProdutosSelecionados(produtosUnicos);
          
          await loadTarefasPorClienteEProdutos(primeiroRegistro.cliente_id, produtosUnicos);
          setTarefasSelecionadas(tarefasUnicas);
          
          const datas = registros.map(r => r.data).sort();
          const dataInicioStr = datas[0] ? datas[0].split('T')[0] : null;
          const dataFimStr = datas[datas.length - 1] ? datas[datas.length - 1].split('T')[0] : null;
          setDataInicio(dataInicioStr);
          setDataFim(dataFimStr);
          
          setTempoEstimadoDia(primeiroRegistro.tempo_estimado_dia || 0);
          setResponsavelSelecionado(primeiroRegistro.responsavel_id);
          
          // Buscar horas contratadas do responsável
          if (primeiroRegistro.responsavel_id) {
            await buscarHorasContratadasPorResponsavel(primeiroRegistro.responsavel_id);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados para edição:', error);
      showToast('error', 'Erro ao carregar dados para edição');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setClienteSelecionado(null);
    setProdutosSelecionados([]);
    setTarefasSelecionadas([]);
    setDataInicio(null);
    setDataFim(null);
    setTempoEstimadoDia(0);
    setResponsavelSelecionado(null);
    setProdutos([]);
    setTarefas([]);
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setErroDuplicata(null);
  };

  // Verificar duplicatas quando período, tarefas, cliente, produto ou responsável mudarem
  const verificarDuplicatas = useCallback(async () => {
    if (!responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0 || 
        tarefasSelecionadas.length === 0 || !dataInicio || !dataFim || editingAgrupamento) {
      setErroDuplicata(null);
      return;
    }

    setVerificandoDuplicata(true);
    try {
      // Buscar registros existentes para verificar duplicatas
      const params = new URLSearchParams({
        cliente_id: String(clienteSelecionado),
        responsavel_id: String(responsavelSelecionado),
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      
      // Adicionar produtos e tarefas como arrays
      produtosSelecionados.forEach(produtoId => {
        params.append('produto_id', produtoId);
      });
      tarefasSelecionadas.forEach(tarefaId => {
        params.append('tarefa_id', tarefaId);
      });

      const response = await fetch(`${API_BASE_URL}/tempo-estimado?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          // Agrupar por agrupador_id e verificar se há duplicatas
          const gruposExistentes = new Map();
          result.data.forEach(reg => {
            const agrupadorId = reg.agrupador_id || 'sem-grupo';
            if (!gruposExistentes.has(agrupadorId)) {
              gruposExistentes.set(agrupadorId, {
                tarefas: new Set(),
                produtos: new Set(),
                datas: []
              });
            }
            gruposExistentes.get(agrupadorId).tarefas.add(String(reg.tarefa_id).trim());
            gruposExistentes.get(agrupadorId).produtos.add(String(reg.produto_id).trim());
            gruposExistentes.get(agrupadorId).datas.push(reg.data);
          });

          // Verificar se algum grupo tem exatamente as mesmas tarefas e produtos
          const tarefasSolicitadas = new Set(tarefasSelecionadas.map(id => String(id).trim()));
          const produtosSolicitados = new Set(produtosSelecionados.map(id => String(id).trim()));

          for (const [agrupadorId, grupo] of gruposExistentes) {
            const temMesmasTarefas = 
              tarefasSolicitadas.size === grupo.tarefas.size &&
              [...tarefasSolicitadas].every(t => grupo.tarefas.has(t));
            
            const temMesmosProdutos = 
              produtosSolicitados.size === grupo.produtos.size &&
              [...produtosSolicitados].every(p => grupo.produtos.has(p));

            if (temMesmasTarefas && temMesmosProdutos) {
              const datasGrupo = grupo.datas.sort();
              if (datasGrupo.length > 0) {
                const grupoInicio = datasGrupo[0].split('T')[0];
                const grupoFim = datasGrupo[datasGrupo.length - 1].split('T')[0];
                setErroDuplicata(
                  `Já existe uma atribuição com as mesmas tarefas, produtos, cliente e responsável no período ${grupoInicio} até ${grupoFim}. Não é possível criar duplicatas.`
                );
                setVerificandoDuplicata(false);
                return;
              }
            }
          }
        }
        setErroDuplicata(null);
      }
    } catch (error) {
      console.error('Erro ao verificar duplicatas:', error);
      // Não mostrar erro ao usuário se houver problema na verificação
    } finally {
      setVerificandoDuplicata(false);
    }
  }, [responsavelSelecionado, clienteSelecionado, produtosSelecionados, tarefasSelecionadas, dataInicio, dataFim, editingAgrupamento]);

  // Verificar duplicatas quando dados relevantes mudarem
  useEffect(() => {
    const verificar = async () => {
      if (dataInicio && dataFim && responsavelSelecionado && clienteSelecionado && 
          produtosSelecionados.length > 0 && tarefasSelecionadas.length > 0 && !editingAgrupamento) {
        await verificarDuplicatas();
      } else {
        setErroDuplicata(null);
      }
    };
    verificar();
  }, [dataInicio, dataFim, tarefasSelecionadas, produtosSelecionados, clienteSelecionado, responsavelSelecionado, editingAgrupamento, verificarDuplicatas]);

  // Buscar horas contratadas por dia do responsável
  const buscarHorasContratadasPorResponsavel = async (responsavelId) => {
    if (!responsavelId) {
      setHorasContratadasDia(null);
      return;
    }

    try {
      // Usar a data atual para buscar a vigência mais recente
      const hoje = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        membro_id: String(responsavelId),
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
          // A API retorna um objeto com horascontratadasdia
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

  // Carregar horas contratadas quando responsável for selecionado
  useEffect(() => {
    if (responsavelSelecionado) {
      buscarHorasContratadasPorResponsavel(responsavelSelecionado);
    } else {
      setHorasContratadasDia(null);
      setErroTempoEstimado(null);
    }
  }, [responsavelSelecionado]);

  // Validar tempo estimado quando mudar
  useEffect(() => {
    if (tempoEstimadoDia > 0 && horasContratadasDia && tarefasSelecionadas.length > 0) {
      // Converter tempo estimado de milissegundos para horas
      const tempoEstimadoHoras = tempoEstimadoDia / (1000 * 60 * 60);
      const totalHorasPorDia = tempoEstimadoHoras * tarefasSelecionadas.length;
      
      if (totalHorasPorDia > horasContratadasDia) {
        const tempoMaximoPorTarefa = horasContratadasDia / tarefasSelecionadas.length;
        const tempoMaximoMs = tempoMaximoPorTarefa * 1000 * 60 * 60;
        setErroTempoEstimado(
          `O tempo estimado total por dia (${totalHorasPorDia.toFixed(2)}h) ultrapassa as horas contratadas do responsável (${horasContratadasDia}h). ` +
          `Máximo permitido por tarefa: ${tempoMaximoPorTarefa.toFixed(2)}h (${Math.floor(tempoMaximoPorTarefa)}h ${Math.round((tempoMaximoPorTarefa % 1) * 60)}min)`
        );
      } else {
        setErroTempoEstimado(null);
      }
    } else {
      setErroTempoEstimado(null);
    }
  }, [tempoEstimadoDia, horasContratadasDia, tarefasSelecionadas.length]);

  // Carregar produtos vinculados ao cliente selecionado
  useEffect(() => {
    if (responsavelSelecionado && clienteSelecionado) {
      loadProdutosPorCliente(clienteSelecionado);
    } else {
      setProdutos([]);
      setProdutosSelecionados([]);
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  }, [responsavelSelecionado, clienteSelecionado]);
  
  // Carregar produtos vazios quando modal abre (para mostrar campo disabled)
  useEffect(() => {
    if (isOpen && !clienteSelecionado) {
      setProdutos([]);
    }
  }, [isOpen, clienteSelecionado]);

  const loadProdutosPorCliente = async (clienteId) => {
    setLoading(true);
    try {
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
    if (responsavelSelecionado && clienteSelecionado && produtosSelecionados.length > 0) {
      loadTarefasPorClienteEProdutos(clienteSelecionado, produtosSelecionados);
    } else {
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  }, [responsavelSelecionado, clienteSelecionado, produtosSelecionados]);

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
    return produtos.map(p => ({ value: p.id, label: p.nome }));
  };

  const getTarefaOptions = () => {
    return tarefas.map(t => ({ value: t.id, label: t.nome }));
  };

  const getColaboradorOptions = () => {
    return colaboradores.map(c => ({ 
      value: c.id, 
      label: c.cpf ? `${c.nome} (${c.cpf})` : c.nome 
    }));
  };

  // Obter labels
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

  // Salvar/Atualizar
  const handleSave = async () => {
    if (!responsavelSelecionado) {
      showToast('warning', 'Selecione um colaborador responsável');
      return;
    }

    if (!clienteSelecionado) {
      showToast('warning', 'Selecione um cliente');
      return;
    }

    if (produtosSelecionados.length === 0) {
      showToast('warning', 'Selecione pelo menos um produto do cliente');
      return;
    }

    if (tarefasSelecionadas.length === 0) {
      showToast('warning', 'Selecione pelo menos uma tarefa dos produtos');
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

    // Avisar sobre duplicatas, mas permitir salvar se o usuário quiser
    if (erroDuplicata) {
      // Não bloquear, apenas avisar - o backend vai validar também
      console.warn('Aviso de duplicata:', erroDuplicata);
    }

    // Avisar se o tempo estimado ultrapassa as horas contratadas, mas permitir salvar se o usuário quiser
    if (horasContratadasDia && tarefasSelecionadas.length > 0) {
      const tempoEstimadoHoras = tempoEstimadoDia / (1000 * 60 * 60);
      const totalHorasPorDia = tempoEstimadoHoras * tarefasSelecionadas.length;
      
      if (totalHorasPorDia > horasContratadasDia) {
        // Apenas avisar, não bloquear
        console.warn('Tempo estimado ultrapassa horas contratadas');
      }
    }

    setSubmitting(true);
    try {
      const dadosParaSalvar = {
        cliente_id: clienteSelecionado,
        produto_ids: produtosSelecionados.map(id => String(id)),
        tarefa_ids: tarefasSelecionadas.map(id => String(id)),
        data_inicio: dataInicio,
        data_fim: dataFim,
        tempo_estimado_dia: tempoEstimadoDia,
        responsavel_id: String(responsavelSelecionado)
      };

      const url = editingAgrupamento 
        ? `${API_BASE_URL}/tempo-estimado/agrupador/${editingAgrupamento.agrupador_id}`
        : `${API_BASE_URL}/tempo-estimado`;
      
      const method = editingAgrupamento ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
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

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || result.hint || result.message || `Erro HTTP ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        const count = result.count || result.data?.length || 0;
        const mensagem = editingAgrupamento 
          ? `Atribuição atualizada com sucesso! ${count} dia(s) atualizado(s).`
          : `Responsável definido com sucesso! ${count} dia(s) atribuído(s).`;
        showToast('success', mensagem);
        onClose(true);
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tempo estimado';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar atribuição:', error);
      showToast('error', error.message || 'Erro ao salvar atribuição. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) {
        onClose(false);
      }
    }}>
      <div className="modal-content vinculacao-modal-content" style={{ maxWidth: '1200px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingAgrupamento ? 'Editar Atribuição' : 'Nova Atribuição'}</h2>
          <button 
            className="btn-icon" 
            onClick={() => onClose(false)}
            type="button"
            title="Fechar"
            disabled={submitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Campos lado a lado usando form-row-vigencia */}
          <div className="form-row-vigencia">
            {/* Campo 1: Responsável */}
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-user-tie" style={{ marginRight: '6px' }}></i>
                1. Responsável
              </label>
              <div className="select-wrapper">
                <CustomSelect
                  value={responsavelSelecionado || ''}
                  options={getColaboradorOptions()}
                  onChange={(e) => setResponsavelSelecionado(e.target.value || null)}
                  placeholder="Selecione o colaborador responsável"
                  disabled={loading || submitting || colaboradores.length === 0}
                  keepOpen={false}
                  selectedItems={responsavelSelecionado ? [String(responsavelSelecionado)] : []}
                  hideCheckboxes={true}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {responsavelSelecionado && (
                <SelectedItemsList
                  items={[String(responsavelSelecionado)]}
                  getItemLabel={getColaboradorLabel}
                  onRemoveItem={() => {
                    setResponsavelSelecionado(null);
                    setClienteSelecionado(null);
                    setProdutosSelecionados([]);
                    setTarefasSelecionadas([]);
                    setProdutos([]);
                    setTarefas([]);
                  }}
                  canRemove={true}
                  isExpanded={false}
                  onToggleExpand={() => {}}
                />
              )}
              {colaboradores.length === 0 && !loading && (
                <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                  Nenhum colaborador disponível para atribuição
                </p>
              )}
            </div>

            {/* Campo 2: Cliente */}
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-building" style={{ marginRight: '6px' }}></i>
                2. Cliente
              </label>
              <div className="select-wrapper">
                <CustomSelect
                  value={clienteSelecionado || ''}
                  options={getClienteOptions()}
                  onChange={handleClienteChange}
                  placeholder="Selecione um cliente"
                  disabled={loading || submitting || !responsavelSelecionado}
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

            {/* Campo 3: Produtos */}
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-box" style={{ marginRight: '6px' }}></i>
                3. Produtos
              </label>
              <div className="select-wrapper">
                <CustomSelect
                  value=""
                  options={getProdutoOptions()}
                  onChange={(e) => handleProdutoSelect(e.target.value)}
                  placeholder="Selecione produtos"
                  disabled={loading || submitting || !responsavelSelecionado || !clienteSelecionado || produtos.length === 0}
                  keepOpen={true}
                  selectedItems={produtosSelecionados.map(id => String(id))}
                  onSelectAll={handleSelectAllProdutos}
                  hideCheckboxes={false}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {produtosSelecionados.length > 0 && (
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
              )}
              {produtos.length === 0 && clienteSelecionado && !loading && (
                <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                  Este cliente não possui produtos vinculados
                </p>
              )}
            </div>

            {/* Campo 4: Tarefas */}
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-tasks" style={{ marginRight: '6px' }}></i>
                4. Tarefas
              </label>
              <div className="select-wrapper">
                <CustomSelect
                  value=""
                  options={getTarefaOptions()}
                  onChange={(e) => handleTarefaSelect(e.target.value)}
                  placeholder="Selecione tarefas"
                  disabled={loading || submitting || produtosSelecionados.length === 0 || tarefas.length === 0}
                  keepOpen={true}
                  selectedItems={tarefasSelecionadas.map(id => String(id))}
                  onSelectAll={handleSelectAllTarefas}
                  hideCheckboxes={false}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              {tarefasSelecionadas.length > 0 && (
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
              )}
              {tarefas.length === 0 && produtosSelecionados.length > 0 && !loading && (
                <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                  Os produtos selecionados não possuem tarefas vinculadas
                </p>
              )}
            </div>

            {/* Campo 5: Período */}
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                5. Período
              </label>
              <FilterPeriodo
                dataInicio={dataInicio}
                dataFim={dataFim}
                onInicioChange={(e) => setDataInicio(e.target.value || null)}
                onFimChange={(e) => setDataFim(e.target.value || null)}
                disabled={loading || submitting || !responsavelSelecionado || tarefasSelecionadas.length === 0}
              />
              {verificandoDuplicata && (
                <p className="help-message" style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                  Verificando duplicatas...
                </p>
              )}
              {erroDuplicata && (
                <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px', color: '#dc2626', backgroundColor: '#fef2f2', padding: '8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                  {erroDuplicata}
                </p>
              )}
              {dataInicio && dataFim && !erroDuplicata && !verificandoDuplicata && (
                <p className="help-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                  Será criado um registro para cada dia entre {dataInicio} e {dataFim}
                </p>
              )}
            </div>
          </div>

          {/* Segunda linha: Tempo */}
          <div className="form-row-vigencia" style={{ marginTop: '20px' }}>
            <div className="form-group">
              <label className="form-label-small">
                <i className="fas fa-clock" style={{ marginRight: '6px' }}></i>
                6. Tempo Estimado (por dia)
                {horasContratadasDia && tarefasSelecionadas.length > 0 && (() => {
                  const maxHorasPorTarefa = horasContratadasDia / tarefasSelecionadas.length;
                  const horas = Math.floor(maxHorasPorTarefa);
                  const minutos = Math.round((maxHorasPorTarefa % 1) * 60);
                  const tempoFormatado = minutos > 0 ? `${horas}h ${minutos}min` : `${horas}h`;
                  return (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>
                      (Máx: {tempoFormatado} por tarefa = {horasContratadasDia}h total/dia)
                    </span>
                  );
                })()}
              </label>
              <TempoEstimadoInput
                value={tempoEstimadoDia}
                onChange={setTempoEstimadoDia}
                disabled={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
                placeholder="Ex: 1h 30min ou 90min"
              />
              {erroTempoEstimado && (
                <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px', color: '#dc2626' }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                  {erroTempoEstimado}
                </p>
              )}
              {horasContratadasDia && tarefasSelecionadas.length > 0 && !erroTempoEstimado && tempoEstimadoDia > 0 && (
                <p className="help-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '6px', color: '#10b981' }}></i>
                  Tempo total por dia: {((tempoEstimadoDia / (1000 * 60 * 60)) * tarefasSelecionadas.length).toFixed(2)}h de {horasContratadasDia}h disponíveis
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onClose(false)}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={loading || submitting || !responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0 || tarefasSelecionadas.length === 0 || !dataInicio || !dataFim || tempoEstimadoDia <= 0 || verificandoDuplicata}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                {editingAgrupamento ? 'Atualizando...' : 'Salvando...'}
              </>
            ) : (
              <>
                <i className="fas fa-save" style={{ marginRight: '8px' }}></i>
                {editingAgrupamento ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtribuicaoModal;

