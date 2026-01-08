import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import SelectedItemsList from '../../components/vinculacoes/SelectedItemsList';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import TempoEstimadoInput from '../../components/common/TempoEstimadoInput';
import ToggleSwitch from '../../components/common/ToggleSwitch';
import SelecaoTarefasPorProduto from '../../components/clients/SelecaoTarefasPorProduto';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI, cacheAPI } from '../../services/api';
import '../../components/vinculacoes/VinculacaoModal.css';
import '../BaseConhecimentoCliente/BaseConhecimentoCliente.css';
import './AtribuicaoCliente.css';

const API_BASE_URL = '/api';

const AtribuicaoCliente = () => {
  const { clienteId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();
  
  // Parâmetro de edição (agrupador_id)
  const agrupadorId = searchParams.get('agrupador_id');
  const editingAgrupamento = agrupadorId ? { agrupador_id: agrupadorId } : null;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estados dos selects
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(clienteId || null);
  const [produtos, setProdutos] = useState([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState([]);
  const [tarefasSelecionadasPorProduto, setTarefasSelecionadasPorProduto] = useState({}); // { produtoId: { tarefaId: { selecionada, subtarefas, tipoTarefa } } }
  const [refreshTarefas, setRefreshTarefas] = useState(0); // Contador para forçar recarregamento
  const [expandedSelects, setExpandedSelects] = useState({});
  
  // Estados de período e responsável
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [tempoEstimadoDia, setTempoEstimadoDia] = useState({});
  const [tempoGlobalParaAplicar, setTempoGlobalParaAplicar] = useState(0);
  const [tarefasSelecionadasParaTempo, setTarefasSelecionadasParaTempo] = useState(new Set());
  const [modoSelecionarVarios, setModoSelecionarVarios] = useState(false);
  const [colaboradores, setColaboradores] = useState([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(null);
  const [horasContratadasDia, setHorasContratadasDia] = useState(null);
  const [erroTempoEstimado, setErroTempoEstimado] = useState(null);
  const [erroDuplicata, setErroDuplicata] = useState(null);
  const [verificandoDuplicata, setVerificandoDuplicata] = useState(false);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(false);
  const [habilitarFeriados, setHabilitarFeriados] = useState(false);

  // Normalizar horas contratadas para número (pode vir como objeto do backend)
  const horasDisponiveisDia = (() => {
    if (horasContratadasDia == null) return null;
    if (typeof horasContratadasDia === 'object') {
      const v = horasContratadasDia.horascontratadasdia;
      const num = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(num) ? num : null;
    }
    const num = typeof horasContratadasDia === 'number' ? horasContratadasDia : Number(horasContratadasDia);
    return Number.isFinite(num) ? num : null;
  })();

  // Períodos por tarefa (por produto+tarefa) e modo de período em lote
  const [periodosPorTarefa, setPeriodosPorTarefa] = useState({}); // { "produtoId_tarefaId": { inicio, fim, datasIndividuais, habilitarFinaisSemana, habilitarFeriados } }
  const [modoPeriodoParaMuitos, setModoPeriodoParaMuitos] = useState(false);
  
  // Responsáveis por tarefa (por produto+tarefa)
  const [responsaveisPorTarefa, setResponsaveisPorTarefa] = useState({}); // { "produtoId_tarefaId": responsavelId }
  const [periodoGlobal, setPeriodoGlobal] = useState({
    inicio: null,
    fim: null,
    datasIndividuais: [],
    habilitarFinaisSemana: false,
    habilitarFeriados: false
  });

  const getPeriodoKey = (produtoId, tarefaId) => `${String(produtoId).trim()}_${String(tarefaId).trim()}`;
  
  // Função auxiliar para obter a chave de responsável (mesma estrutura que período)
  const getResponsavelKey = (produtoId, tarefaId) => `${String(produtoId).trim()}_${String(tarefaId).trim()}`;
  
  // Função para obter responsável de uma tarefa
  const getResponsavelTarefa = (produtoId, tarefaId) => {
    const key = getResponsavelKey(produtoId, tarefaId);
    const responsavelId = responsaveisPorTarefa[key];
    // Retornar null se não existir ou se for string vazia
    if (!responsavelId || (typeof responsavelId === 'string' && responsavelId.trim() === '')) {
      return null;
    }
    return String(responsavelId).trim();
  };
  
  // Função para atualizar responsável de uma tarefa
  const handleResponsavelTarefaChange = (produtoId, tarefaId, responsavelId) => {
    const key = getResponsavelKey(produtoId, tarefaId);
    // Normalizar responsavelId para string (pode vir como número ou string)
    const responsavelIdNormalizado = responsavelId ? String(responsavelId).trim() : null;
    setResponsaveisPorTarefa(prev => {
      if (responsavelIdNormalizado) {
        return { ...prev, [key]: responsavelIdNormalizado };
      } else {
        const novo = { ...prev };
        delete novo[key];
        return novo;
      }
    });
  };

  const handlePeriodoTarefaChange = (produtoId, tarefaId, updates) => {
    const key = getPeriodoKey(produtoId, tarefaId);
    setPeriodosPorTarefa(prev => ({
      ...prev,
      [key]: {
        inicio: prev[key]?.inicio || null,
        fim: prev[key]?.fim || null,
        datasIndividuais: prev[key]?.datasIndividuais || [],
        habilitarFinaisSemana: prev[key]?.habilitarFinaisSemana || false,
        habilitarFeriados: prev[key]?.habilitarFeriados || false,
        source: prev[key]?.source || 'manual',
        ...updates
      }
    }));
  };

  // Quando o modo "Período para muitos" estiver ativo, aplicar automaticamente o período global
  // em todas as tarefas selecionadas (exceto as que foram ajustadas manualmente).
  useEffect(() => {
    if (!modoPeriodoParaMuitos) return;
    if (!periodoGlobal.inicio || !periodoGlobal.fim) return;
    if (!tarefasSelecionadasPorProduto || Object.keys(tarefasSelecionadasPorProduto).length === 0) return;

    const globalDatas = Array.isArray(periodoGlobal.datasIndividuais) ? periodoGlobal.datasIndividuais : [];
    const globalKey = `${periodoGlobal.inicio}|${periodoGlobal.fim}|${periodoGlobal.habilitarFinaisSemana ? 1 : 0}|${periodoGlobal.habilitarFeriados ? 1 : 0}|${globalDatas.slice().sort().join(',')}`;

    setPeriodosPorTarefa(prev => {
      const next = { ...prev };
      let changed = false;

      Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
        Object.entries(tarefasDoProduto || {}).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa?.selecionada !== true) return;
          const key = getPeriodoKey(produtoId, tarefaId);
          const atual = next[key];

          // Se o usuário ajustou manualmente, não sobrescrever
          if (atual?.source === 'manual') return;

          const atualKey = atual
            ? `${atual.inicio || ''}|${atual.fim || ''}|${atual.habilitarFinaisSemana ? 1 : 0}|${atual.habilitarFeriados ? 1 : 0}|${(Array.isArray(atual.datasIndividuais) ? atual.datasIndividuais : []).slice().sort().join(',')}`
            : '';

          if (atualKey === globalKey && atual?.source === 'global') return;

          next[key] = {
            inicio: periodoGlobal.inicio,
            fim: periodoGlobal.fim,
            datasIndividuais: [...globalDatas],
            habilitarFinaisSemana: !!periodoGlobal.habilitarFinaisSemana,
            habilitarFeriados: !!periodoGlobal.habilitarFeriados,
            source: 'global'
          };
          changed = true;
        });
      });

      return changed ? next : prev;
    });
  }, [
    modoPeriodoParaMuitos,
    periodoGlobal.inicio,
    periodoGlobal.fim,
    periodoGlobal.habilitarFinaisSemana,
    periodoGlobal.habilitarFeriados,
    JSON.stringify(periodoGlobal.datasIndividuais || []),
    tarefasSelecionadasPorProduto
  ]);

  // Carregar dados iniciais
  useEffect(() => {
    cacheAPI.remove('api_cache_colaboradores_all');
    loadClientes();
    loadColaboradores();
    
    // Se estiver editando, carregar dados do agrupamento
    if (editingAgrupamento) {
      loadDadosEdicao(editingAgrupamento);
    } else if (clienteId) {
      // Se veio com clienteId na URL, selecionar o cliente
      setClienteSelecionado(clienteId);
      loadProdutosPorCliente(clienteId);
    } else {
      // Limpar formulário para nova atribuição
      resetForm();
    }
  }, [clienteId, editingAgrupamento]);

  const loadClientes = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes com limite alto para garantir que todos sejam retornados
      const clientesResult = await clientesAPI.getPaginated({ 
        page: 1, 
        limit: 10000, 
        search: null, 
        status: null, 
        incompletos: false 
      });
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
      const colaboradoresResult = await colaboradoresAPI.getAll(false);
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
          
          // Carregar tempos e responsáveis por tarefa (produto + tarefa)
          const temposPorTarefa = {};
          const responsaveisPorTarefaCarregado = {};
          const periodosPorTarefaCarregado = {};
          
          registros.forEach(reg => {
            const produtoId = String(reg.produto_id);
            const tarefaId = String(reg.tarefa_id);
            const key = `${produtoId}_${tarefaId}`;
            
            // Tempo estimado (usar chave composta se possível, fallback para tarefaId)
            if (!temposPorTarefa[key]) {
              temposPorTarefa[key] = reg.tempo_estimado_dia || 0;
            }
            // Fallback para compatibilidade
            if (!temposPorTarefa[tarefaId]) {
              temposPorTarefa[tarefaId] = reg.tempo_estimado_dia || 0;
            }
            
            // Responsável por tarefa
            if (reg.responsavel_id) {
              responsaveisPorTarefaCarregado[key] = String(reg.responsavel_id).trim();
            }
            
            // Período por tarefa (extrair da data do registro)
            if (reg.data) {
              const dataStr = reg.data.split('T')[0];
              if (!periodosPorTarefaCarregado[key]) {
                periodosPorTarefaCarregado[key] = {
                  inicio: dataStr,
                  fim: dataStr,
                  habilitarFinaisSemana: false,
                  habilitarFeriados: false,
                  datasIndividuais: []
                };
              } else {
                // Atualizar início e fim se necessário
                if (dataStr < periodosPorTarefaCarregado[key].inicio) {
                  periodosPorTarefaCarregado[key].inicio = dataStr;
                }
                if (dataStr > periodosPorTarefaCarregado[key].fim) {
                  periodosPorTarefaCarregado[key].fim = dataStr;
                }
              }
            }
          });
          
          setTempoEstimadoDia(temposPorTarefa);
          setResponsaveisPorTarefa(responsaveisPorTarefaCarregado);
          setPeriodosPorTarefa(periodosPorTarefaCarregado);
          
          // Buscar horas contratadas para todos os responsáveis únicos
          const responsaveisUnicos = [...new Set(Object.values(responsaveisPorTarefaCarregado))];
          if (responsaveisUnicos.length > 0) {
            // Usar o primeiro responsável para buscar horas (pode ser melhorado depois)
            await buscarHorasContratadasPorResponsavel(responsaveisUnicos[0]);
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
    if (!clienteId) {
      setClienteSelecionado(null);
    }
    setProdutosSelecionados([]);
    setTarefasSelecionadas([]);
    setDataInicio(null);
    setDataFim(null);
    setTempoEstimadoDia({});
    setTempoGlobalParaAplicar(0);
    setTarefasSelecionadasParaTempo(new Set());
    setModoSelecionarVarios(false);
    setResponsaveisPorTarefa({});
    setProdutos([]);
    setTarefas([]);
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setErroDuplicata(null);
  };

  // Verificar duplicatas - agora considerando responsável por tarefa
  const verificarDuplicatas = useCallback(async () => {
    if (!clienteSelecionado || produtosSelecionados.length === 0 || 
        tarefasSelecionadas.length === 0 || editingAgrupamento || !tarefasSelecionadasPorProduto) {
      setErroDuplicata(null);
      return;
    }

    // Verificar se todas as tarefas têm responsável e período definidos
    let temTarefasSemResponsavel = false;
    let temTarefasSemPeriodo = false;
    
    Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
      Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
        if (dadosTarefa.selecionada === true) {
          const responsavelId = getResponsavelTarefa(produtoId, tarefaId);
          if (!responsavelId) {
            temTarefasSemResponsavel = true;
            return;
          }
          
          // Verificar se tem período definido
          const periodoKey = getPeriodoKey(produtoId, tarefaId);
          const periodo = periodosPorTarefa[periodoKey];
          if (!periodo || !periodo.inicio || !periodo.fim) {
            temTarefasSemPeriodo = true;
            return;
          }
        }
      });
    });
    
    if (temTarefasSemResponsavel || temTarefasSemPeriodo) {
      setErroDuplicata(null);
      return; // Não verificar duplicatas se faltam dados
    }

    setVerificandoDuplicata(true);
    try {
      // Verificar duplicatas por tarefa individual (produto + tarefa + responsável + período)
      // Como cada tarefa pode ter responsável e período diferente, verificamos individualmente
      let temDuplicata = false;
      let mensagemDuplicata = '';
      
      for (const [produtoId, tarefasDoProduto] of Object.entries(tarefasSelecionadasPorProduto)) {
        if (!produtosSelecionados.includes(String(produtoId))) continue;
        
        for (const [tarefaId, dadosTarefa] of Object.entries(tarefasDoProduto)) {
          if (!dadosTarefa.selecionada) continue;
          
          const responsavelId = getResponsavelTarefa(produtoId, tarefaId);
          if (!responsavelId) continue;
          
          const periodoKey = getPeriodoKey(produtoId, tarefaId);
          const periodo = periodosPorTarefa[periodoKey];
          if (!periodo || !periodo.inicio || !periodo.fim) continue;
          
          const params = new URLSearchParams({
            cliente_id: String(clienteSelecionado),
            responsavel_id: String(responsavelId),
            produto_id: String(produtoId),
            tarefa_id: String(tarefaId),
            data_inicio: periodo.inicio,
            data_fim: periodo.fim
          });

          const response = await fetch(`${API_BASE_URL}/tempo-estimado?${params}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              // Verificar se há registros no mesmo período
              const datasExistentes = result.data.map(r => r.data).sort();
              if (datasExistentes.length > 0) {
              const inicioExistente = datasExistentes[0].split('T')[0];
              const fimExistente = datasExistentes[datasExistentes.length - 1].split('T')[0];
              const tarefaEncontrada = tarefas.find(t => String(t.id) === String(tarefaId));
              const tarefaNome = tarefaEncontrada ? (tarefaEncontrada.nome || `Tarefa #${tarefaId}`) : `Tarefa #${tarefaId}`;
              temDuplicata = true;
              mensagemDuplicata = `Já existe uma atribuição para a tarefa "${tarefaNome}" com o mesmo responsável, produto, cliente e período (${inicioExistente} até ${fimExistente}). Não é possível criar duplicatas.`;
                break;
              }
            }
          }
        }
        if (temDuplicata) break;
      }
      
      if (temDuplicata) {
        setErroDuplicata(mensagemDuplicata);
      } else {
        setErroDuplicata(null);
      }
    } catch (error) {
      console.error('Erro ao verificar duplicatas:', error);
      setErroDuplicata(null);
    } finally {
      setVerificandoDuplicata(false);
    }
  }, [clienteSelecionado, produtosSelecionados, tarefasSelecionadas, tarefasSelecionadasPorProduto, periodosPorTarefa, responsaveisPorTarefa, editingAgrupamento, tarefas]);

  useEffect(() => {
    const verificar = async () => {
      if (clienteSelecionado && produtosSelecionados.length > 0 && tarefasSelecionadas.length > 0 && !editingAgrupamento) {
        await verificarDuplicatas();
      } else {
        setErroDuplicata(null);
      }
    };
    verificar();
  }, [tarefasSelecionadas, produtosSelecionados, clienteSelecionado, tarefasSelecionadasPorProduto, periodosPorTarefa, responsaveisPorTarefa, editingAgrupamento, verificarDuplicatas]);

  const buscarHorasContratadasPorResponsavel = async (responsavelId) => {
    if (!responsavelId) {
      setHorasContratadasDia(null);
      return;
    }

    try {
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
          const data = result.data;
          let horas = null;
          if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'horascontratadasdia')) {
            horas = data.horascontratadasdia;
          } else {
            horas = data; // pode ser número direto
          }
          const num = typeof horas === 'number' ? horas : Number(horas);
          setHorasContratadasDia(Number.isFinite(num) ? num : null);
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

  // Removido: useEffect que buscava horas contratadas quando responsavelSelecionado mudava
  // Agora cada tarefa tem seu próprio responsável, então não há mais um responsável global

  // Removido: validação de horas contratadas global
  // Como cada tarefa pode ter um responsável diferente, a validação deveria ser feita por responsável
  // Isso pode ser implementado no futuro se necessário

  // Carregar produtos vinculados ao cliente selecionado (usando tabela de vinculados)
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
    console.log('🔄 [AtribuicaoCliente] Carregando produtos para cliente:', clienteId);
    setLoading(true);
    try {
      // Buscar produtos que têm vínculos na tabela vinculados (mesma lógica do VinculacaoForm)
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
          
          console.log('📦 [AtribuicaoCliente] Produtos com vínculos (sem cliente):', vinculadosComProduto.length);
          
          // Extrair IDs únicos dos produtos que têm vínculos
          produtosComVinculosIds = [...new Set(
            vinculadosComProduto
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];
          
          console.log('📦 [AtribuicaoCliente] IDs únicos de produtos com vínculos:', produtosComVinculosIds);
          
          // Buscar nomes dos produtos usando o endpoint de produtos
          if (produtosComVinculosIds.length > 0) {
            try {
              const produtosResponse = await fetch(`${API_BASE_URL}/produtos-por-ids-numericos?ids=${produtosComVinculosIds.join(',')}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              
              if (produtosResponse.ok) {
                const produtosResult = await produtosResponse.json();
                if (produtosResult.success && produtosResult.data) {
                  // produtosResult.data é um mapa { "id": nome } onde id é string
                  produtosComVinculosComNomes = produtosComVinculosIds.map(produtoId => {
                    const nome = produtosResult.data[String(produtoId)] || `Produto #${produtoId}`;
                    return { id: produtoId, nome };
                  });
                  console.log('✅ [AtribuicaoCliente] Produtos com nomes carregados:', produtosComVinculosComNomes.length);
                }
              }
            } catch (error) {
              console.error('❌ [AtribuicaoCliente] Erro ao buscar nomes dos produtos:', error);
            }
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
            return String(vClienteId) === String(clienteId) && v.cp_produto;
          });
          
          console.log('🔗 [AtribuicaoCliente] Vinculados do cliente:', vinculadosDoCliente.length);
          
          // Extrair IDs únicos dos produtos já vinculados ao cliente
          produtosVinculadosAoClienteIds = [...new Set(
            vinculadosDoCliente
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];
          
          console.log('🔗 [AtribuicaoCliente] IDs de produtos vinculados ao cliente:', produtosVinculadosAoClienteIds);
          
          // Buscar nomes dos produtos vinculados ao cliente
          if (produtosVinculadosAoClienteIds.length > 0) {
            try {
              const produtosClienteResponse = await fetch(`${API_BASE_URL}/produtos-por-ids-numericos?ids=${produtosVinculadosAoClienteIds.join(',')}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              
              if (produtosClienteResponse.ok) {
                const produtosClienteResult = await produtosClienteResponse.json();
                if (produtosClienteResult.success && produtosClienteResult.data) {
                  // Adicionar produtos vinculados ao cliente que não estão na lista de produtos com vínculos
                  produtosVinculadosAoClienteIds.forEach(produtoId => {
                    if (!produtosComVinculosComNomes.find(p => p.id === produtoId)) {
                      const nome = produtosClienteResult.data[String(produtoId)] || `Produto #${produtoId}`;
                      produtosComVinculosComNomes.push({ id: produtoId, nome });
                    }
                  });
                }
              }
            } catch (error) {
              console.error('❌ [AtribuicaoCliente] Erro ao buscar nomes dos produtos vinculados ao cliente:', error);
            }
          }
        }
      }
      
      console.log('📋 [AtribuicaoCliente] Total de produtos disponíveis:', produtosComVinculosComNomes.length);
      console.log('📋 [AtribuicaoCliente] Produtos disponíveis:', produtosComVinculosComNomes);
      
      // Mostrar apenas produtos que têm vínculos (produtosComVinculosComNomes)
      // Mas garantir que produtos já vinculados ao cliente também apareçam
      setProdutos(produtosComVinculosComNomes);
      
      // Pré-selecionar produtos já vinculados ao cliente (para permitir edição/remoção)
      if (produtosVinculadosAoClienteIds.length > 0) {
        const produtosIdsStr = produtosVinculadosAoClienteIds.map(id => String(id));
        console.log('✅ [AtribuicaoCliente] Pré-selecionando produtos:', produtosIdsStr);
        setProdutosSelecionados(produtosIdsStr);
        // Quando produtos são pré-selecionados, carregar tarefas automaticamente
        await loadTarefasPorClienteEProdutos(clienteId, produtosIdsStr);
      } else {
        console.log('ℹ️ [AtribuicaoCliente] Nenhum produto vinculado ao cliente, limpando seleção');
        setProdutosSelecionados([]);
      }
    } catch (error) {
      console.error('❌ [AtribuicaoCliente] Erro ao carregar produtos:', error);
      showToast('error', 'Erro ao carregar produtos vinculados ao cliente');
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  // Quando tarefas são selecionadas via SelecaoTarefasPorProduto, atualizar lista de tarefas selecionadas
  useEffect(() => {
    // Extrair todas as tarefas selecionadas de todos os produtos
    const todasTarefasSelecionadas = [];
    Object.values(tarefasSelecionadasPorProduto).forEach(produtoTarefas => {
      Object.keys(produtoTarefas).forEach(tarefaId => {
        if (produtoTarefas[tarefaId].selecionada && !todasTarefasSelecionadas.includes(tarefaId)) {
          todasTarefasSelecionadas.push(tarefaId);
        }
      });
    });
    setTarefasSelecionadas(todasTarefasSelecionadas);
  }, [tarefasSelecionadasPorProduto]);

  // Removido: useEffect que limpava tempos baseado apenas em tarefasSelecionadas
  // Agora o tempo é gerenciado por produto x tarefa, então não precisamos limpar dessa forma

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
          // Selecionar apenas tarefas que estão vinculadas ao cliente (estaVinculadaAoCliente === true)
          // ou que têm subtarefas vinculadas ao cliente
          const tarefasVinculadas = [];
          result.data.forEach(item => {
            (item.tarefas || []).forEach(tarefa => {
              const estaVinculadaAoCliente = tarefa.estaVinculadaAoCliente === true;
              const subtarefasVinculadas = tarefa.subtarefasVinculadasCliente || [];
              const temSubtarefasVinculadas = subtarefasVinculadas.length > 0;
              
              // Selecionar tarefa se está vinculada ao cliente OU tem subtarefas vinculadas
              if (estaVinculadaAoCliente || temSubtarefasVinculadas) {
                if (!tarefasVinculadas.includes(String(tarefa.id))) {
                  tarefasVinculadas.push(String(tarefa.id));
                }
              }
            });
          });
          
          setTarefasSelecionadas(tarefasVinculadas);
          
          if (!editingAgrupamento) {
            setTempoEstimadoDia(prev => {
              const novosTempos = { ...prev };
              tarefasVinculadas.forEach(tarefaId => {
                if (!novosTempos[tarefaId] || novosTempos[tarefaId] <= 0) {
                  novosTempos[tarefaId] = 0;
                }
              });
              return novosTempos;
            });
          }
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

  const handleClienteChange = (e) => {
    const novoClienteId = e.target.value;
    if (novoClienteId) {
      setClienteSelecionado(novoClienteId);
      setProdutosSelecionados([]);
      setTarefasSelecionadas([]);
      // Atualizar URL se necessário
      if (novoClienteId !== clienteId) {
        navigate(`/atribuicao/cliente/${novoClienteId}`);
      }
    } else {
      setClienteSelecionado(null);
      navigate('/atribuicao/nova');
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
    const novosTempos = { ...tempoEstimadoDia };
    delete novosTempos[tarefaId];
    setTempoEstimadoDia(novosTempos);
    const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
    novasSelecionadas.delete(tarefaId);
    setTarefasSelecionadasParaTempo(novasSelecionadas);
  };

  // Função auxiliar para obter a chave composta de tempo (produtoId_tarefaId)
  const getTempoKey = (produtoId, tarefaId) => {
    if (produtoId && tarefaId) {
      return `${String(produtoId).trim()}_${String(tarefaId).trim()}`;
    }
    // Fallback para compatibilidade: se não tiver produtoId, usar apenas tarefaId
    return String(tarefaId).trim();
  };

  // Função auxiliar para obter o tempo de uma tarefa, tentando primeiro com chave composta
  const getTempoEstimado = (produtoId, tarefaId) => {
    if (produtoId && tarefaId) {
      const chave = getTempoKey(produtoId, tarefaId);
      return tempoEstimadoDia[chave] || tempoEstimadoDia[tarefaId] || 0;
    }
    return tempoEstimadoDia[tarefaId] || 0;
  };

  const handleTempoTarefaChange = (produtoId, tarefaId, tempo) => {
    // Usar chave composta produtoId_tarefaId para diferenciar tarefas com mesmo ID em produtos diferentes
    const chave = getTempoKey(produtoId, tarefaId);
    setTempoEstimadoDia(prev => ({
      ...prev,
      [chave]: tempo
    }));
  };

  const handleToggleTarefaSelecionada = (tarefaId) => {
    const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
    if (novasSelecionadas.has(tarefaId)) {
      novasSelecionadas.delete(tarefaId);
    } else {
      novasSelecionadas.add(tarefaId);
    }
    setTarefasSelecionadasParaTempo(novasSelecionadas);
  };

  const handleSelectAllTarefasParaTempo = () => {
    if (tarefasSelecionadasParaTempo.size === tarefas.length) {
      setTarefasSelecionadasParaTempo(new Set());
    } else {
      setTarefasSelecionadasParaTempo(new Set(tarefas.map(t => String(t.id))));
    }
  };

  useEffect(() => {
    if (modoSelecionarVarios && tempoGlobalParaAplicar > 0) {
      const novosTempos = { ...tempoEstimadoDia };
      tarefasSelecionadasParaTempo.forEach(tarefaId => {
        novosTempos[tarefaId] = tempoGlobalParaAplicar;
      });
      setTempoEstimadoDia(novosTempos);
    }
  }, [tarefasSelecionadasParaTempo, tempoGlobalParaAplicar, modoSelecionarVarios]);

  useEffect(() => {
    if (!modoSelecionarVarios) {
      setTarefasSelecionadasParaTempo(new Set());
      setTempoGlobalParaAplicar(0);
    }
  }, [modoSelecionarVarios]);

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

  const handleSave = async () => {
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

    // Validação de período removida - cada tarefa tem seu próprio período agora

    // Verificar tarefas sem tempo ou sem responsável considerando produto x tarefa
    const tarefasSemTempo = [];
    const tarefasSemResponsavel = [];
    Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
      Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
        if (dadosTarefa.selecionada === true) {
          // Verificar tempo
          if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId)) {
            if (!tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0) {
              tarefasSemTempo.push({ produtoId, tarefaId });
            }
          } else {
            const tempo = getTempoEstimado(produtoId, tarefaId);
            if (!tempo || tempo <= 0) {
              tarefasSemTempo.push({ produtoId, tarefaId });
            }
          }
          // Verificar responsável
          const responsavelId = getResponsavelTarefa(produtoId, tarefaId);
          if (!responsavelId) {
            tarefasSemResponsavel.push({ produtoId, tarefaId });
          }
        }
      });
    });
    
    if (tarefasSemTempo.length > 0) {
      if (modoSelecionarVarios && tarefasSelecionadasParaTempo.size > 0 && (!tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0)) {
        showToast('warning', 'Informe o tempo estimado no campo "Selecionar vários" para aplicar às tarefas selecionadas.');
      } else {
        showToast('warning', `Informe o tempo estimado para todas as tarefas. ${tarefasSemTempo.length} tarefa(s) sem tempo definido.`);
      }
      return;
    }
    
    if (tarefasSemResponsavel.length > 0) {
      showToast('warning', `Selecione um responsável para todas as tarefas. ${tarefasSemResponsavel.length} tarefa(s) sem responsável definido.`);
      return;
    }

    if (erroDuplicata) {
      console.warn('Aviso de duplicata:', erroDuplicata);
    }

    if (horasContratadasDia && tarefasSelecionadasPorProduto && Object.keys(tarefasSelecionadasPorProduto).length > 0) {
      let totalTempoMs = 0;
      Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
        Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa.selecionada === true) {
            let tempo = getTempoEstimado(produtoId, tarefaId);
            if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId) && tempoGlobalParaAplicar > 0) {
              tempo = tempoGlobalParaAplicar;
            }
            totalTempoMs += tempo;
          }
        });
      });
      const totalHorasPorDia = totalTempoMs / (1000 * 60 * 60);
      
      if (totalHorasPorDia > horasContratadasDia) {
        console.warn('Tempo estimado ultrapassa horas contratadas');
      }
    }

    setSubmitting(true);
    try {
      // Construir array de tarefas com tempo, mas agrupadas por produto
      // Usar tarefasSelecionadasPorProduto para garantir que só enviamos tarefas selecionadas para cada produto específico
      const tarefasComTempo = [];
      
      // Iterar sobre cada produto e suas tarefas selecionadas
      Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
        // Verificar se o produto está na lista de produtos selecionados
        const produtoIdStr = String(produtoId).trim();
        if (!produtosSelecionados.includes(produtoIdStr)) {
          return; // Pular produtos não selecionados
        }
        
        // Para cada tarefa selecionada neste produto
        Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa.selecionada === true) {
            let tempo = getTempoEstimado(produtoIdStr, tarefaId);
            
            if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId) && tempoGlobalParaAplicar > 0) {
              tempo = tempoGlobalParaAplicar;
            }
            
            const tempoInt = Math.round(Number(tempo));
            
            // Adicionar tarefa com informação do produto
            tarefasComTempo.push({
              tarefa_id: String(tarefaId).trim(),
              tempo_estimado_dia: tempoInt,
              produto_id: produtoIdStr // Incluir produto_id para identificar a qual produto esta tarefa pertence
            });
          }
        });
      });

      // Agrupar tarefas por produto para enviar ao backend
      // O backend precisa receber: produto_ids e tarefas (mas as tarefas devem ser filtradas por produto)
      // Vamos enviar um formato que permita ao backend criar apenas as combinações corretas
      const produtosComTarefas = {};
      
      produtosSelecionados.forEach(produtoId => {
        const produtoIdStr = String(produtoId).trim();
        const tarefasDoProduto = tarefasSelecionadasPorProduto[parseInt(produtoIdStr, 10)] || {};
        
        const tarefasParaEsteProduto = [];
        Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa.selecionada === true) {
            let tempo = getTempoEstimado(produtoIdStr, tarefaId);
            
            if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId) && tempoGlobalParaAplicar > 0) {
              tempo = tempoGlobalParaAplicar;
            }
            
            const tempoInt = Math.round(Number(tempo));
            
            // Obter responsável da tarefa
            const responsavelId = getResponsavelTarefa(produtoIdStr, tarefaId);
            
            tarefasParaEsteProduto.push({
              tarefa_id: String(tarefaId).trim(),
              tempo_estimado_dia: tempoInt,
              responsavel_id: responsavelId ? String(responsavelId).trim() : null
            });
          }
        });
        
        if (tarefasParaEsteProduto.length > 0) {
          produtosComTarefas[produtoIdStr] = tarefasParaEsteProduto;
        }
      });

      // Agrupamento por período (por tarefa) ou período global
      const obterPeriodoPara = (produtoId, tarefaId) => {
        const key = getPeriodoKey(produtoId, tarefaId);
        const p = periodosPorTarefa[key];
        if (p && p.inicio && p.fim) {
          return {
            inicio: p.inicio,
            fim: p.fim,
            incluir_finais_semana: !!p.habilitarFinaisSemana,
            incluir_feriados: !!p.habilitarFeriados,
            datas_individuais: Array.isArray(p.datasIndividuais) ? p.datasIndividuais : []
          };
        }
        // Fallback para período global da tela
        return {
          inicio: dataInicio,
          fim: dataFim,
          incluir_finais_semana: !!habilitarFinaisSemana,
          incluir_feriados: !!habilitarFeriados,
          datas_individuais: []
        };
      };

      const stringifyPeriodo = (per) => {
        const di = (per.datas_individuais || []).slice().sort().join(',');
        return `${per.inicio}|${per.fim}|${per.incluir_finais_semana ? 1 : 0}|${per.incluir_feriados ? 1 : 0}|${di}`;
        };

      // Agrupar por período E responsável (tarefas com responsáveis diferentes ou períodos diferentes vão em grupos separados)
      const gruposPorPeriodoEResponsavel = {}; // keyPeriodo_Responsavel -> { periodo, responsavel_id, produtos_com_tarefas }
      produtosSelecionados.forEach(produtoId => {
        const produtoIdStr = String(produtoId).trim();
        const tarefasDoProduto = tarefasSelecionadasPorProduto[parseInt(produtoIdStr, 10)] || {};
        Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa.selecionada === true) {
            let tempo = getTempoEstimado(produtoIdStr, tarefaId);
            if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId) && tempoGlobalParaAplicar > 0) {
              tempo = tempoGlobalParaAplicar;
            }
            const tempoInt = Math.round(Number(tempo));
            const periodo = obterPeriodoPara(produtoIdStr, tarefaId);
            const responsavelId = getResponsavelTarefa(produtoIdStr, tarefaId);
            const keyPeriodo = stringifyPeriodo(periodo);
            const keyGrupo = `${keyPeriodo}_${responsavelId || 'sem-responsavel'}`;
            
            if (!gruposPorPeriodoEResponsavel[keyGrupo]) {
              gruposPorPeriodoEResponsavel[keyGrupo] = {
                periodo,
                responsavel_id: responsavelId ? String(responsavelId).trim() : null,
                produtos_com_tarefas: {}
              };
            }
            if (!gruposPorPeriodoEResponsavel[keyGrupo].produtos_com_tarefas[produtoIdStr]) {
              gruposPorPeriodoEResponsavel[keyGrupo].produtos_com_tarefas[produtoIdStr] = [];
            }
            gruposPorPeriodoEResponsavel[keyGrupo].produtos_com_tarefas[produtoIdStr].push({
              tarefa_id: String(tarefaId).trim(),
              tempo_estimado_dia: tempoInt,
              responsavel_id: responsavelId ? String(responsavelId).trim() : null
            });
          }
        });
      });
      
      const grupos = Object.values(gruposPorPeriodoEResponsavel);

      console.log('💾 [ATRIBUICAO] Total de grupos de período e responsável:', grupos.length);

      const urlBase = editingAgrupamento 
        ? `${API_BASE_URL}/tempo-estimado/agrupador/${editingAgrupamento.agrupador_id}`
        : `${API_BASE_URL}/tempo-estimado`;
      const method = editingAgrupamento ? 'PUT' : 'POST';

      let totalLinhas = 0;
      for (const grupo of grupos) {
        // Se todas as tarefas do grupo têm o mesmo responsavel_id, podemos usar o campo global
        // Caso contrário, o responsavel_id já está em cada tarefa
        const responsavelComum = grupo.responsavel_id;
        
        const payload = {
          cliente_id: clienteSelecionado,
          produtos_com_tarefas: grupo.produtos_com_tarefas,
          data_inicio: grupo.periodo.inicio,
          data_fim: grupo.periodo.fim,
          responsavel_id: responsavelComum, // Pode ser usado como fallback se tarefa não tiver responsavel_id
          incluir_finais_semana: grupo.periodo.incluir_finais_semana,
          incluir_feriados: grupo.periodo.incluir_feriados,
          datas_individuais: grupo.periodo.datas_individuais
        };

        console.log('💾 [ATRIBUICAO] Salvando grupo:', JSON.stringify(payload, null, 2));

        const response = await fetch(urlBase, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
          const errorMsg = result.error || result.details || result.hint || result.message || `Erro HTTP ${response.status}`;
          showToast('error', errorMsg);
          return;
        }
        totalLinhas += (result.count || result.data?.length || 0);
      }

      showToast('success', `Atribuição salva com sucesso! ${totalLinhas} dia(s) atribuídos/atualizados em ${grupos.length} grupo(s) de período.`);
      navigate('/atribuir-responsaveis');
    } catch (error) {
      console.error('Erro ao salvar atribuição:', error);
      showToast('error', error.message || 'Erro ao salvar atribuição. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !clienteSelecionado && !editingAgrupamento) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  const clienteNome = clienteSelecionado ? getClienteLabel(clienteSelecionado) : 'Nova Atribuição';

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="base-conhecimento-cliente-container atribuicao-cliente-container">
              {/* Header */}
              <div className="knowledge-page-header">
                <div className="knowledge-header-content">
                  <div className="knowledge-header-left">
                    <div className="knowledge-header-icon">
                      <i className="fas fa-user-check" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h2 className="knowledge-page-title">
                        {editingAgrupamento ? 'Editar Atribuição' : 'Nova Atribuição'}
                      </h2>
                      <p className="knowledge-page-subtitle">
                        {clienteSelecionado ? `Cliente: ${clienteNome}` : 'Selecione um cliente para continuar'}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary knowledge-back-btn"
                    onClick={() => navigate('/atribuir-responsaveis')}
                  >
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                  </button>
                </div>
              </div>

              {/* Formulário */}
              <div className="atribuicao-form-content">
                {/* Seção: Seleção Inicial */}
                <div className="atribuicao-form-section">
                  <h3 className="atribuicao-form-section-title">
                    <i className="fas fa-list-ol"></i>
                    Informações Básicas
                  </h3>
                  <div className="form-row-vigencia">
                  {/* 1. Cliente */}
                  <div className="form-group">
                    <label className="form-label-small">
                      <i className="fas fa-building" style={{ marginRight: '6px' }}></i>
                      1. Cliente
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
                          setClienteSelecionado(clienteId || null);
                          setProdutosSelecionados([]);
                          setTarefasSelecionadas([]);
                          if (!clienteId) {
                            navigate('/atribuicao/nova');
                          }
                        }}
                        canRemove={!clienteId}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                      />
                    )}
                  </div>

                  {/* 2. Produtos */}
                  <div className="form-group">
                    <label className="form-label-small">
                      <i className="fas fa-box" style={{ marginRight: '6px' }}></i>
                      2. Produtos
                    </label>
                    <div className="select-wrapper">
                      <CustomSelect
                        value=""
                        options={getProdutoOptions()}
                        onChange={(e) => handleProdutoSelect(e.target.value)}
                        placeholder="Selecione produtos"
                        disabled={loading || submitting || !clienteSelecionado || produtos.length === 0}
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

                  </div>
                </div>

                {/* Seção: Tarefas (usando SelecaoTarefasPorProduto) */}
                {clienteSelecionado && produtosSelecionados.length > 0 && (
                  <div className="atribuicao-form-section atribuicao-tarefas-section">
                    <h3 className="atribuicao-form-section-title">
                      <i className="fas fa-tasks"></i>
                      Tarefas e Tempo Estimado
                      {horasDisponiveisDia != null && (
                        <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>
                          (Total disponível: {horasDisponiveisDia}h/dia)
                        </span>
                      )}
                    </h3>
                    {/* Modo: Selecionar período para muitos */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <ToggleSwitch
                        checked={modoPeriodoParaMuitos}
                        onChange={(checked) => setModoPeriodoParaMuitos(checked)}
                        leftLabel="Período individual"
                        rightLabel="Período para muitos"
                      />
                      {modoPeriodoParaMuitos && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: '260px' }}>
                            <FilterPeriodo
                              dataInicio={periodoGlobal.inicio}
                              dataFim={periodoGlobal.fim}
                              onInicioChange={(e) => setPeriodoGlobal(prev => ({ ...prev, inicio: e.target.value || null }))}
                              onFimChange={(e) => setPeriodoGlobal(prev => ({ ...prev, fim: e.target.value || null }))}
                              size="small"
                              uiVariant="atribuicao-mini"
                              showWeekendToggle={true}
                              onWeekendToggleChange={(v) => setPeriodoGlobal(prev => ({ ...prev, habilitarFinaisSemana: !!v }))}
                              showHolidayToggle={true}
                              onHolidayToggleChange={(v) => setPeriodoGlobal(prev => ({ ...prev, habilitarFeriados: !!v }))}
                              datasIndividuais={periodoGlobal.datasIndividuais || []}
                              onDatasIndividuaisChange={(arr) => setPeriodoGlobal(prev => ({ ...prev, datasIndividuais: Array.isArray(arr) ? arr : [] }))}
                              disabled={loading || submitting || !clienteSelecionado || produtosSelecionados.length === 0}
                            />
                          </div>
                          {periodoGlobal.inicio && periodoGlobal.fim && tarefasSelecionadas.length > 0 && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                // Aplicar período global a todas as tarefas selecionadas
                                setPeriodosPorTarefa(prev => {
                                  const novo = { ...prev };
                                  Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
                                    Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
                                      if (dadosTarefa.selecionada === true) {
                                        const key = `${produtoId}_${tarefaId}`;
                                        novo[key] = {
                                          inicio: periodoGlobal.inicio,
                                          fim: periodoGlobal.fim,
                                          datasIndividuais: periodoGlobal.datasIndividuais || [],
                                          habilitarFinaisSemana: periodoGlobal.habilitarFinaisSemana || false,
                                          habilitarFeriados: periodoGlobal.habilitarFeriados || false,
                                          source: 'global'
                                        };
                                      }
                                    });
                                  });
                                  return novo;
                                });
                                showToast('success', `Período aplicado a ${tarefasSelecionadas.length} tarefa(s)`);
                              }}
                              disabled={loading || submitting}
                              style={{
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: '500',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                whiteSpace: 'nowrap'
                              }}
                              title="Aplicar o período selecionado a todas as tarefas marcadas"
                            >
                              <i className="fas fa-calendar-check" style={{ fontSize: '12px' }}></i>
                              Aplicar a {tarefasSelecionadas.length} tarefa(s)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      {/* Usar o componente SelecaoTarefasPorProduto */}
                      <div style={{ 
                        marginTop: '16px',
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <SelecaoTarefasPorProduto
                          key={`selecao-tarefas-${clienteSelecionado}-${produtosSelecionados.join('-')}-${refreshTarefas}`}
                          clienteId={clienteSelecionado}
                          produtos={produtosSelecionados.map(produtoId => {
                            const produto = produtos.find(p => String(p.id) === String(produtoId));
                            return produto || { id: parseInt(produtoId, 10), nome: `Produto #${produtoId}` };
                          })}
                          refreshKey={refreshTarefas}
                          showTempoEstimado={true}
                          showSubtarefas={false}
                          tempoEstimadoDia={tempoEstimadoDia}
                          onTempoChange={(produtoId, tarefaId, tempoEmMs) => {
                            handleTempoTarefaChange(produtoId, tarefaId, tempoEmMs);
                          }}
                          disabledTempo={loading || submitting}
                          horasContratadasDia={horasDisponiveisDia}
                          tarefasSelecionadas={tarefasSelecionadas}
                          // Período por tarefa e modo em lote
                          periodosPorTarefa={periodosPorTarefa}
                          onPeriodoChange={(produtoId, tarefaId, updates) => handlePeriodoTarefaChange(produtoId, tarefaId, { ...updates, source: 'manual' })}
                          modoPeriodoParaMuitos={modoPeriodoParaMuitos}
                          filterPeriodoUiVariant="atribuicao-mini"
                          // Responsáveis por tarefa
                          responsaveisPorTarefa={responsaveisPorTarefa}
                          onResponsavelChange={handleResponsavelTarefaChange}
                          colaboradores={colaboradores}
                          onTarefasChange={(tarefasPorProduto) => {
                            // Converter formato: { produtoId: [{ id, nome, selecionada, subtarefasSelecionadas, tipoTarefa }] }
                            // Para: { produtoId: { tarefaId: { selecionada: boolean, subtarefas: [subtarefaId], tipoTarefa: {id, nome} } } }
                            const novoFormato = {};
                            const tarefasComNomes = [];
                            
                            Object.entries(tarefasPorProduto).forEach(([produtoId, tarefas]) => {
                              const produtoIdNum = parseInt(produtoId, 10);
                              novoFormato[produtoIdNum] = {};
                              tarefas.forEach(tarefa => {
                                // Adicionar tarefa à lista de tarefas com nome
                                if (!tarefasComNomes.find(t => String(t.id) === String(tarefa.id))) {
                                  tarefasComNomes.push({ id: tarefa.id, nome: tarefa.nome || `Tarefa #${tarefa.id}` });
                                }
                                
                                if (tarefa.selecionada === true) {
                                  novoFormato[produtoIdNum][tarefa.id] = {
                                    selecionada: true,
                                    subtarefas: tarefa.subtarefasSelecionadas || [],
                                    tipoTarefa: tarefa.tipoTarefa || null
                                  };
                                }
                              });
                            });
                            
                            // Atualizar lista de tarefas com nomes
                            setTarefas(prev => {
                              const novasTarefas = [...prev];
                              tarefasComNomes.forEach(tarefa => {
                                if (!novasTarefas.find(t => String(t.id) === String(tarefa.id))) {
                                  novasTarefas.push(tarefa);
                                } else {
                                  // Atualizar nome se já existe
                                  const index = novasTarefas.findIndex(t => String(t.id) === String(tarefa.id));
                                  if (index >= 0) {
                                    novasTarefas[index] = tarefa;
                                  }
                                }
                              });
                              return novasTarefas;
                            });
                            
                            setTarefasSelecionadasPorProduto(novoFormato);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Código antigo removido - substituído pelo SelecaoTarefasPorProduto acima */}
                {false && dataInicio && dataFim && tarefas.length > 0 && (
                  <div className="atribuicao-form-section atribuicao-tarefas-section">
                    <h3 className="atribuicao-form-section-title">
                      <i className="fas fa-tasks"></i>
                      Tarefas e Tempo Estimado
                    </h3>
                    <div>
                      {/* Lista de tarefas antiga - desabilitada */}
                      <div className="selected-items-container" style={{ display: 'none' }}>
                        {tarefas.map(tarefa => {
                          const tarefaId = String(tarefa.id);
                          const isSelecionada = tarefasSelecionadas.includes(tarefaId);
                          const isSelecionadaParaTempo = tarefasSelecionadasParaTempo.has(tarefaId);
                          const tempoTarefa = (modoSelecionarVarios && isSelecionadaParaTempo) 
                            ? tempoGlobalParaAplicar 
                            : (tempoEstimadoDia[tarefaId] || 0);
                          
                          return (
                            <div 
                              key={tarefaId}
                              className="selected-item-tag"
                              style={{
                                opacity: isSelecionada ? 1 : 0.5,
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
                                if (!isSelecionada) {
                                  setTarefasSelecionadas([...tarefasSelecionadas, tarefaId]);
                                }
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: 0 }}>
                                {modoSelecionarVarios && (
                                  <input
                                    type="checkbox"
                                    checked={tarefasSelecionadasParaTempo.has(tarefaId)}
                                    onChange={(e) => {
                                      const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
                                      if (e.target.checked) {
                                        novasSelecionadas.add(tarefaId);
                                        if (!tarefasSelecionadas.includes(tarefaId)) {
                                          setTarefasSelecionadas([...tarefasSelecionadas, tarefaId]);
                                        }
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
                                    disabled={loading || submitting}
                                  />
                                )}
                                <span style={{ flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tarefa.nome}</span>
                              </div>
                              {isSelecionada && (!modoSelecionarVarios || !isSelecionadaParaTempo) && (
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
                                      const horas = parseFloat(e.target.value) || 0;
                                      const minutos = Math.floor((tempoTarefa % (1000 * 60 * 60)) / (1000 * 60)) || 0;
                                      handleTempoTarefaChange(tarefaId, Math.round((horas * 60 * 60 + minutos * 60) * 1000));
                                    }}
                                    disabled={loading || submitting}
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
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>h</span>
                                  <input
                                    type="number"
                                    value={Math.floor((tempoTarefa % (1000 * 60 * 60)) / (1000 * 60)) || ''}
                                    onChange={(e) => {
                                      const minutos = parseFloat(e.target.value) || 0;
                                      const horas = Math.floor(tempoTarefa / (1000 * 60 * 60)) || 0;
                                      handleTempoTarefaChange(tarefaId, Math.round((horas * 60 * 60 + minutos * 60) * 1000));
                                    }}
                                    disabled={loading || submitting}
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
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>min</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {isSelecionadaParaTempo && (
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
                                )}
                                {isSelecionada && (
                                  <button
                                    className="btn-remove-tag"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTarefaRemove(tarefaId);
                                    }}
                                    title="Remover tarefa"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {erroTempoEstimado && (
                        <p className="empty-message" style={{ marginTop: '12px', fontSize: '11px', color: '#dc2626' }}>
                          <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                          {erroTempoEstimado}
                        </p>
                      )}
                      {horasDisponiveisDia != null && tarefasSelecionadasPorProduto && Object.keys(tarefasSelecionadasPorProduto).length > 0 && !erroTempoEstimado && (() => {
                        let totalTempoMs = 0;
                        Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
                          Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
                            if (dadosTarefa.selecionada === true) {
                              totalTempoMs += getTempoEstimado(produtoId, tarefaId);
                            }
                          });
                        });
                        const totalHorasPorDia = totalTempoMs / (1000 * 60 * 60);
                        if (totalHorasPorDia > 0) {
                          return (
                            <p className="help-message" style={{ marginTop: '12px', fontSize: '11px' }}>
                              <i className="fas fa-check-circle" style={{ marginRight: '6px', color: totalHorasPorDia > horasDisponiveisDia ? '#f59e0b' : '#10b981' }}></i>
                              Tempo total por dia: {totalHorasPorDia.toFixed(2)}h de {horasDisponiveisDia}h disponíveis
                              {totalHorasPorDia > horasDisponiveisDia && (
                                <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                                  (Ultrapassando em {(totalHorasPorDia - horasDisponiveisDia).toFixed(2)}h)
                                </span>
                              )}
                            </p>
                          );
                        }
                        return null;
                      })()}
                      {dataInicio && dataFim && tarefas.length === 0 && produtosSelecionados.length > 0 && !loading && (
                        <p className="empty-message" style={{ marginTop: '8px', fontSize: '11px' }}>
                          <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                          Os produtos selecionados não possuem tarefas vinculadas
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer com botões */}
              <div className="atribuicao-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/atribuir-responsaveis')}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={loading || submitting || !clienteSelecionado || produtosSelecionados.length === 0 || tarefasSelecionadas.length === 0 || verificandoDuplicata || (() => {
                    // Verificar se há tarefas sem tempo, sem responsável ou sem período considerando produto x tarefa
                    if (!tarefasSelecionadasPorProduto || Object.keys(tarefasSelecionadasPorProduto).length === 0) {
                      return true;
                    }
                    for (const [produtoId, tarefasDoProduto] of Object.entries(tarefasSelecionadasPorProduto)) {
                      const produtoIdNormalizado = String(produtoId).trim();
                      for (const [tarefaId, dadosTarefa] of Object.entries(tarefasDoProduto)) {
                        if (dadosTarefa.selecionada === true) {
                          const tarefaIdNormalizado = String(tarefaId).trim();
                          // Verificar tempo
                          if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaIdNormalizado)) {
                            if (!tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0) {
                              return true;
                            }
                          } else {
                            const tempo = getTempoEstimado(produtoIdNormalizado, tarefaIdNormalizado);
                            if (!tempo || tempo <= 0) {
                              return true;
                            }
                          }
                          // Verificar responsável
                          const responsavelId = getResponsavelTarefa(produtoIdNormalizado, tarefaIdNormalizado);
                          if (!responsavelId) {
                            return true;
                          }
                          // Verificar período
                          const periodoKey = getPeriodoKey(produtoIdNormalizado, tarefaIdNormalizado);
                          const periodo = periodosPorTarefa[periodoKey];
                          if (!periodo || !periodo.inicio || !periodo.fim) {
                            return true;
                          }
                        }
                      }
                    }
                    return false;
                  })()}
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
          </CardContainer>
        </main>
      </div>
    </Layout>
  );
};

export default AtribuicaoCliente;

