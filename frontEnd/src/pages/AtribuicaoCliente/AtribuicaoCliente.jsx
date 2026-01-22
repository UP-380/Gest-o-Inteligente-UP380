import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import CustomSelect from '../../components/vinculacoes/CustomSelect';
import FilterPeriodo from '../../components/filters/FilterPeriodo';
import TempoEstimadoInput from '../../components/common/TempoEstimadoInput';
import ToggleSwitch from '../../components/common/ToggleSwitch';
import SelecaoTarefasPorProduto from '../../components/clients/SelecaoTarefasPorProduto';
import ResponsavelCard from '../../components/atribuicoes/ResponsavelCard';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI, cacheAPI } from '../../services/api';
import { calcularDiasComOpcoesEDatasIndividuais, obterDatasValidasNoPeriodo, calcularDiasApenasComDatasIndividuais } from '../../utils/dateUtils';
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
  const editingAgrupamento = useMemo(() => agrupadorId ? { agrupador_id: agrupadorId } : null, [agrupadorId]);

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
  const [initialTarefas, setInitialTarefas] = useState(null); // Tarefas iniciais para edição (evita fetch automático)

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

  // Cache de tempo estimado total por responsável no período (independente dos filtros aplicados)
  const [tempoEstimadoTotalPorResponsavel, setTempoEstimadoTotalPorResponsavel] = useState({}); // { responsavelId: tempoEmMs }

  // Buscar tempo estimado total do responsável no período (independente dos filtros aplicados)
  const buscarTempoEstimadoTotalPorResponsavel = useCallback(async (
    responsavelId,
    periodoInicio,
    periodoFim,
    habilitarFinaisSemana,
    habilitarFeriados,
    datasIndividuais
  ) => {
    if (!responsavelId) {
      return 0;
    }

    // Aceitar se tiver período completo ou apenas datas individuais
    const temPeriodoCompleto = periodoInicio && periodoFim;
    const temDatasIndividuais = Array.isArray(datasIndividuais) && datasIndividuais.length > 0;

    if (!temPeriodoCompleto && !temDatasIndividuais) {
      return 0;
    }

    // Se há apenas datas individuais, usar min/max das datas para buscar na API
    let dataInicio = periodoInicio;
    let dataFim = periodoFim;

    if (!temPeriodoCompleto && temDatasIndividuais) {
      const datasOrdenadas = [...datasIndividuais].sort();
      dataInicio = datasOrdenadas[0];
      dataFim = datasOrdenadas[datasOrdenadas.length - 1];
    }

    try {
      // Construir query para buscar todos os registros de tempo estimado do responsável no período
      const params = new URLSearchParams({
        responsavel_id: String(responsavelId),
        data_inicio: dataInicio,
        data_fim: dataFim
      });

      const response = await fetch(`${API_BASE_URL}/tempo-estimado?${params}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.error('Erro ao buscar tempo estimado:', response.status);
        return 0;
      }

      const result = await response.json();
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        return 0;
      }

      // Obter datas válidas no período (considerando opções de finais de semana, feriados e datas individuais)
      // Se há apenas datas individuais, usar apenas essas datas; caso contrário, usar o período completo
      const datasValidas = temDatasIndividuais && !temPeriodoCompleto
        ? new Set(datasIndividuais)
        : obterDatasValidasNoPeriodo(
          dataInicio,
          dataFim,
          habilitarFinaisSemana,
          habilitarFeriados,
          datasIndividuais || []
        );

      // Somar todos os tempo_estimado_dia dos registros cujas datas estão nas datas válidas
      let tempoTotal = 0;
      result.data.forEach(registro => {
        if (!registro.tempo_estimado_dia) return;

        // Verificar se a data do registro está nas datas válidas
        let dataStr;
        if (typeof registro.data === 'string') {
          dataStr = registro.data.split('T')[0];
        } else if (registro.data instanceof Date) {
          const year = registro.data.getFullYear();
          const month = String(registro.data.getMonth() + 1).padStart(2, '0');
          const day = String(registro.data.getDate()).padStart(2, '0');
          dataStr = `${year}-${month}-${day}`;
        } else {
          return; // Data inválida, pular
        }

        // Se não há datas válidas definidas (datasValidas vazio), considerar todas as datas
        // Caso contrário, verificar se a data está no conjunto de datas válidas
        if (datasValidas.size === 0 || datasValidas.has(dataStr)) {
          // tempo_estimado_dia pode vir em milissegundos ou como número
          const tempo = Number(registro.tempo_estimado_dia) || 0;
          tempoTotal += tempo;
        }
      });

      return tempoTotal;
    } catch (error) {
      console.error('Erro ao buscar tempo estimado total por responsável:', error);
      return 0;
    }
  }, []);

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
  const [responsavelGlobal, setResponsavelGlobal] = useState(null); // Responsável global para aplicar em lote
  const [tempoGlobal, setTempoGlobal] = useState(0); // Tempo global para aplicar em lote (em milissegundos)
  const [periodoGlobal, setPeriodoGlobal] = useState({
    inicio: null,
    fim: null,
    datasIndividuais: [],
    habilitarFinaisSemana: false,
    habilitarFeriados: false
  });

  // Valores aplicados pela última vez (para comparar e desabilitar botão após aplicar)
  const [valoresAplicados, setValoresAplicados] = useState({
    periodo: { inicio: null, fim: null, datasIndividuais: [], habilitarFinaisSemana: false, habilitarFeriados: false },
    responsavel: null,
    tempo: 0
  });

  // Estados para tempo disponível
  const [horasContratadasPorResponsavel, setHorasContratadasPorResponsavel] = useState({}); // { responsavelId: horas }
  const [tempoDisponivelGlobal, setTempoDisponivelGlobal] = useState(0); // em milissegundos

  const getPeriodoKey = (produtoId, tarefaId) => `${String(produtoId).trim()}_${String(tarefaId).trim()}`;

  // Função auxiliar para obter a chave de responsável (mesma estrutura que período)
  const getResponsavelKey = (produtoId, tarefaId) => `${String(produtoId).trim()}_${String(tarefaId).trim()}`;

  // Função para formatar tempo estimado (similar à usada em DelegarTarefas)
  const formatarTempoEstimado = (milissegundos, incluirSegundos = false) => {
    if (!milissegundos || milissegundos === 0) {
      return incluirSegundos ? '0s' : '—';
    }
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
    return incluirSegundos ? '0s' : '—';
  };

  // Funções para ordem obrigatória de preenchimento
  const podePreencherResponsavel = () => {
    // Permitir se há período completo OU se há datas individuais selecionadas
    const temPeriodoCompleto = !!(periodoGlobal.inicio && periodoGlobal.fim);
    const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;
    return temPeriodoCompleto || temDatasIndividuais;
  };

  const podePreencherTempo = () => {
    // Permitir se há período completo OU datas individuais, E há responsável selecionado
    const temPeriodoCompleto = !!(periodoGlobal.inicio && periodoGlobal.fim);
    const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;
    return (temPeriodoCompleto || temDatasIndividuais) && !!responsavelGlobal;
  };

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

  // Função para limpar campos globais
  const handleLimparGlobal = () => {
    setPeriodoGlobal({
      inicio: null,
      fim: null,
      habilitarFinaisSemana: false,
      habilitarFeriados: false,
      datasIndividuais: []
    });
    setResponsavelGlobal(null);
    setTempoGlobal(0);
    setTempoGlobalParaAplicar(0);
    showToast('info', 'Campos globais limpos');
  };

  // Função para aplicar período, responsável e tempo global às tarefas selecionadas
  const handleAplicarGlobal = () => {
    if (!tarefasSelecionadasPorProduto || Object.keys(tarefasSelecionadasPorProduto).length === 0) {
      showToast('warning', 'Nenhuma tarefa selecionada para aplicar');
      return;
    }

    const globalDatas = Array.isArray(periodoGlobal.datasIndividuais) ? periodoGlobal.datasIndividuais : [];
    const temPeriodoCompleto = periodoGlobal.inicio && periodoGlobal.fim;
    const temDatasIndividuais = globalDatas.length > 0;
    let periodoAplicado = false;
    let responsavelAplicado = false;
    let tempoAplicado = false;

    // Aplicar período global se preenchido (período completo OU datas individuais)
    if (temPeriodoCompleto || temDatasIndividuais) {
      setPeriodosPorTarefa(prev => {
        const next = { ...prev };
        let changed = false;

        Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
          Object.entries(tarefasDoProduto || {}).forEach(([tarefaId, dadosTarefa]) => {
            if (dadosTarefa?.selecionada !== true) return;
            const key = getPeriodoKey(produtoId, tarefaId);

            next[key] = {
              inicio: periodoGlobal.inicio || null,
              fim: periodoGlobal.fim || null,
              datasIndividuais: [...globalDatas],
              habilitarFinaisSemana: !!periodoGlobal.habilitarFinaisSemana,
              habilitarFeriados: !!periodoGlobal.habilitarFeriados,
              source: 'global'
            };
            changed = true;
          });
        });

        periodoAplicado = changed;
        return changed ? next : prev;
      });
    }

    // Aplicar responsável global se preenchido
    if (responsavelGlobal) {
      setResponsaveisPorTarefa(prev => {
        const next = { ...prev };
        let changed = false;

        Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
          Object.entries(tarefasDoProduto || {}).forEach(([tarefaId, dadosTarefa]) => {
            if (dadosTarefa?.selecionada !== true) return;
            const key = getResponsavelKey(produtoId, tarefaId);

            next[key] = String(responsavelGlobal).trim();
            changed = true;
          });
        });

        responsavelAplicado = changed;
        return changed ? next : prev;
      });
    }

    // Aplicar tempo global (pode ser 0 - zerado)
    // Tempo zerado também é um valor válido e deve ser aplicado
    if (tempoGlobal !== undefined && tempoGlobal !== null) {
      setTempoEstimadoDia(prev => {
        const next = { ...prev };
        let changed = false;

        Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
          Object.entries(tarefasDoProduto || {}).forEach(([tarefaId, dadosTarefa]) => {
            if (dadosTarefa?.selecionada !== true) return;
            const key = getTempoKey(produtoId, tarefaId);

            // Aplicar tempo mesmo se for 0
            next[key] = tempoGlobal;
            changed = true;
          });
        });

        tempoAplicado = changed;
        return changed ? next : prev;
      });
    }

    // Feedback ao usuário
    const itensAplicados = [];
    if (periodoAplicado) {
      if (temPeriodoCompleto && temDatasIndividuais) {
        itensAplicados.push('período e dias específicos');
      } else if (temPeriodoCompleto) {
        itensAplicados.push('período');
      } else if (temDatasIndividuais) {
        itensAplicados.push('dias específicos');
      }
    }
    if (responsavelAplicado) itensAplicados.push('responsável');
    // Tempo zerado também é considerado aplicado
    if (tempoAplicado || (tempoGlobal !== undefined && tempoGlobal !== null && tempoGlobal === 0)) itensAplicados.push('tempo');

    if (itensAplicados.length > 0) {
      const mensagem = `${itensAplicados.join(', ')} aplicado(s) a ${tarefasSelecionadas.length} tarefa(s)`;
      showToast('success', mensagem);

      // Salvar os valores aplicados para comparação futura
      setValoresAplicados({
        periodo: {
          inicio: periodoGlobal.inicio,
          fim: periodoGlobal.fim,
          datasIndividuais: Array.isArray(periodoGlobal.datasIndividuais) ? [...periodoGlobal.datasIndividuais] : [],
          habilitarFinaisSemana: !!periodoGlobal.habilitarFinaisSemana,
          habilitarFeriados: !!periodoGlobal.habilitarFeriados
        },
        responsavel: responsavelGlobal ? String(responsavelGlobal).trim() : null,
        tempo: tempoGlobal !== undefined && tempoGlobal !== null ? tempoGlobal : null
      });
    } else {
      showToast('warning', 'Preencha pelo menos o período, responsável ou tempo');
    }
  };

  // Carregar dados iniciais (apenas na montagem)
  useEffect(() => {
    cacheAPI.remove('api_cache_colaboradores_all');
    loadClientes();
    loadColaboradores();

    // Limpar formulário se não houver parâmetros de URL
    if (!agrupadorId && !clienteId) {
      resetForm();
    }
  }, []);

  // Lidar com mudanças de parâmetros de URL (edição ou cliente pré-selecionado)
  useEffect(() => {
    if (editingAgrupamento) {
      loadDadosEdicao(editingAgrupamento);
    } else if (clienteId) {
      // Se veio com clienteId na URL, selecionar o cliente
      setClienteSelecionado(clienteId);
      loadProdutosPorCliente(clienteId);
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
            cpf: colab.cpf || null,
            foto_perfil: colab.foto_perfil || null
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
    setInitialTarefas(null);
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

          // 1. Carregar nomes dos produtos
          let produtosMap = {};
          if (produtosUnicos.length > 0) {
            try {
              const prodResp = await fetch(`${API_BASE_URL}/produtos-por-ids-numericos?ids=${produtosUnicos.join(',')}`);
              if (prodResp.ok) {
                const prodResult = await prodResp.json();
                if (prodResult.success && prodResult.data) {
                  produtosMap = prodResult.data;
                }
              }
            } catch (e) {
              console.error('Erro ao buscar nomes dos produtos:', e);
            }
          }

          // Montar lista de produtos
          const produtosParaState = produtosUnicos.map(pId => ({
            id: pId,
            nome: produtosMap[pId] || `Produto #${pId}`
          }));
          setProdutos(produtosParaState);
          setProdutosSelecionados(produtosUnicos);

          // 2. Carregar nomes das tarefas
          let tarefasMap = {};
          if (tarefasUnicas.length > 0) {
            try {
              const tarResp = await fetch(`${API_BASE_URL}/tarefas-por-ids?ids=${tarefasUnicas.join(',')}`);
              if (tarResp.ok) {
                const tarResult = await tarResp.json();
                if (tarResult.success && tarResult.data) {
                  tarefasMap = tarResult.data;
                }
              }
            } catch (e) {
              console.error('Erro ao buscar nomes das tarefas:', e);
            }
          }

          setTarefasSelecionadas(tarefasUnicas);

          // Construir initialTarefas para o componente SelecaoTarefasPorProduto
          // Formato: { produtoId: [ { id, nome, selecionada: true, ... } ] }
          const initialObj = {};

          produtosUnicos.forEach(prodId => {
            const prodIdNum = parseInt(prodId, 10);
            // Filtrar registros deste produto
            const regsDoProduto = registros.filter(r => String(r.produto_id) === String(prodId));
            // Extrair tarefas únicas deste produto
            const tarIdsDoProduto = [...new Set(regsDoProduto.map(r => String(r.tarefa_id)))];

            initialObj[prodIdNum] = tarIdsDoProduto.map(tId => ({
              id: parseInt(tId, 10),
              nome: tarefasMap[tId] || `Tarefa #${tId}`,
              selecionada: true,
              subtarefas: [], // Não temos info de subtarefas aqui facilmente, mas ok
              subtarefasSelecionadas: [],
              tipoTarefa: null // Não temos info de tipo aqui facilmente, mas ok
            }));
          });

          setInitialTarefas(initialObj);

          // 3. Processar datas e períodos
          const datasGerais = [...new Set(registros.map(r => r.data ? r.data.split('T')[0] : null).filter(Boolean))].sort();
          const dataInicioGeral = datasGerais[0];
          const dataFimGeral = datasGerais[datasGerais.length - 1];

          // Função auxiliar para detectar se deve ativar modo dias específicos
          const deveAtivarDiasEspecificos = (datas, incluirFinaisSemana) => {
            if (!datas || datas.length === 0) return false;
            const start = new Date(datas[0]);
            const end = new Date(datas[datas.length - 1]);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            // Se todas as datas do período estão presentes
            if (datas.length === diffDays) return false;

            // Se faltam datas, verificar se são apenas finais de semana (e se isso é esperado)
            const setDatas = new Set(datas);
            let apenasFdsAusentes = true;
            const current = new Date(start);

            // Iterar dia a dia para verificar buracos
            for (let i = 0; i < diffDays; i++) {
              const dStr = current.toISOString().split('T')[0];
              if (!setDatas.has(dStr)) {
                const day = current.getUTCDay();
                const isWeekend = day === 0 || day === 6; // 0=Dom, 6=Sab

                if (!isWeekend) {
                  apenasFdsAusentes = false;
                  break;
                }
              }
              current.setDate(current.getDate() + 1);
            }

            // Se faltam dias que não são FDS -> Modo dias específicos
            if (!apenasFdsAusentes) return true;

            // Se faltam apenas FDS, mas FDS deveriam estar inclusos -> Modo dias específicos
            if (apenasFdsAusentes && incluirFinaisSemana) return true;

            // Se faltam apenas FDS e FDS não devem estar inclusos -> Modo período (Range)
            return false;
          };

          let datasIndividuaisGerais = [];
          if (deveAtivarDiasEspecificos(datasGerais, primeiroRegistro.incluir_finais_semana)) {
            datasIndividuaisGerais = datasGerais;
          }

          // Atualizar estado global
          if (typeof setPeriodoGlobal === 'function') {
            setPeriodoGlobal(prev => ({
              ...prev,
              inicio: dataInicioGeral,
              fim: dataFimGeral,
              datasIndividuais: datasIndividuaisGerais,
              habilitarFinaisSemana: primeiroRegistro.incluir_finais_semana,
              habilitarFeriados: primeiroRegistro.incluir_feriados
            }));
          }
          if (typeof setDataInicio === 'function') setDataInicio(dataInicioGeral);
          if (typeof setDataFim === 'function') setDataFim(dataFimGeral);

          // Carregar tempos e responsáveis por tarefa (Agrupando dados primeiro)
          const dadosPorTarefa = {}; // key -> { tempo, responsavel, datas: Set }

          registros.forEach(reg => {
            const produtoId = String(reg.produto_id);
            const tarefaId = String(reg.tarefa_id);
            const key = `${produtoId}_${tarefaId}`;

            if (!dadosPorTarefa[key]) {
              dadosPorTarefa[key] = {
                tempo: reg.tempo_estimado_dia,
                responsavel: reg.responsavel_id,
                datas: new Set()
              };
            }
            if (reg.data) dadosPorTarefa[key].datas.add(reg.data.split('T')[0]);
          });

          const temposPorTarefa = {};
          const responsaveisPorTarefaCarregado = {};
          const periodosPorTarefaCarregado = {};

          Object.entries(dadosPorTarefa).forEach(([key, dados]) => {
            const [prodId, tarId] = key.split('_');
            temposPorTarefa[key] = dados.tempo || 0;
            temposPorTarefa[tarId] = dados.tempo || 0; // fallback compatibilidade

            if (dados.responsavel) responsaveisPorTarefaCarregado[key] = String(dados.responsavel).trim();

            const datasTarefa = [...dados.datas].sort();
            if (datasTarefa.length > 0) {
              const inicio = datasTarefa[0];
              const fim = datasTarefa[datasTarefa.length - 1];
              let individuais = [];

              if (deveAtivarDiasEspecificos(datasTarefa, primeiroRegistro.incluir_finais_semana)) {
                individuais = datasTarefa;
              }

              periodosPorTarefaCarregado[key] = {
                inicio,
                fim,
                habilitarFinaisSemana: primeiroRegistro.incluir_finais_semana,
                habilitarFeriados: primeiroRegistro.incluir_feriados,
                datasIndividuais: individuais
              };
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
    setResponsavelGlobal(null);
    setTempoGlobal(0);
    setProdutos([]);
    setTarefas([]);
    setInitialTarefas(null); // Resetar
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setErroDuplicata(null);
    setModoPeriodoParaMuitos(false);
    setPeriodoGlobal({
      inicio: null,
      fim: null,
      datasIndividuais: [],
      habilitarFinaisSemana: false,
      habilitarFeriados: false
    });
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

          // Verificar se tem período definido (período completo OU apenas datas individuais)
          const periodoKey = getPeriodoKey(produtoId, tarefaId);
          const periodo = periodosPorTarefa[periodoKey];
          if (!periodo) {
            temTarefasSemPeriodo = true;
            return;
          }
          const temPeriodoCompleto = periodo.inicio && periodo.fim;
          const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
          if (!temPeriodoCompleto && !temDatasIndividuais) {
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
          if (!periodo) continue;

          const temPeriodoCompleto = periodo.inicio && periodo.fim;
          const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;

          if (!temPeriodoCompleto && !temDatasIndividuais) continue;

          // Determinar inicio e fim (usar min/max se apenas datas individuais)
          let dataInicio = periodo.inicio;
          let dataFim = periodo.fim;

          if (!temPeriodoCompleto && temDatasIndividuais) {
            const datasOrdenadas = [...periodo.datasIndividuais].sort();
            dataInicio = datasOrdenadas[0];
            dataFim = datasOrdenadas[datasOrdenadas.length - 1];
          }

          const params = new URLSearchParams({
            cliente_id: String(clienteSelecionado),
            responsavel_id: String(responsavelId),
            produto_id: String(produtoId),
            tarefa_id: String(tarefaId),
            data_inicio: dataInicio,
            data_fim: dataFim
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
    const timer = setTimeout(async () => {
      // Verificar se há dados suficientes e se NÃO estamos editando (na edição, permite manter o que já existe ou o usuário decide)
      // Nota: o debounce evita chamadas excessivas durante a seleção rápida de itens
      if (clienteSelecionado && produtosSelecionados.length > 0 && tarefasSelecionadas.length > 0 && !editingAgrupamento) {
        await verificarDuplicatas();
      } else {
        setErroDuplicata(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tarefasSelecionadas, produtosSelecionados, clienteSelecionado, tarefasSelecionadasPorProduto, periodosPorTarefa, responsaveisPorTarefa, editingAgrupamento, verificarDuplicatas]);

  const buscarHorasContratadasPorResponsavel = async (responsavelId, dataInicio = null) => {
    if (!responsavelId) {
      setHorasContratadasPorResponsavel(prev => {
        const novo = { ...prev };
        delete novo[String(responsavelId)];
        return novo;
      });
      return;
    }

    try {
      // Usar data de início do período se fornecida, senão usar hoje
      const dataParaBuscar = dataInicio || new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        membro_id: String(responsavelId),
        data_inicio: dataParaBuscar,
        data_fim: dataParaBuscar
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
          const horasValidas = Number.isFinite(num) ? num : null;

          // Armazenar no estado por responsável
          setHorasContratadasPorResponsavel(prev => ({
            ...prev,
            [String(responsavelId)]: horasValidas
          }));

          // Manter compatibilidade com estado antigo (para não quebrar código existente)
          if (responsavelId === responsavelSelecionado || responsavelId === responsavelGlobal) {
            setHorasContratadasDia(horasValidas);
          }
        } else {
          setHorasContratadasPorResponsavel(prev => {
            const novo = { ...prev };
            novo[String(responsavelId)] = null;
            return novo;
          });
        }
      } else {
        setHorasContratadasPorResponsavel(prev => {
          const novo = { ...prev };
          novo[String(responsavelId)] = null;
          return novo;
        });
      }
    } catch (error) {
      console.error('Erro ao buscar horas contratadas:', error);
      setHorasContratadasPorResponsavel(prev => {
        const novo = { ...prev };
        novo[String(responsavelId)] = null;
        return novo;
      });
    }
  };

  // Função para calcular tempo já atribuído para um responsável em um período
  // Considera TODAS as tarefas que já têm período, responsável e tempo definidos
  // Funciona tanto no modo "Preencher vários" quanto sem ele
  // excluirTarefa: { produtoId, tarefaId } - opcional, tarefa a ser excluída do cálculo
  const calcularTempoJaAtribuido = useCallback((responsavelId, periodo, tempoEstimadoDiaObj, tarefasSelecionadasObj, responsaveisPorTarefaObj, periodosPorTarefaObj, responsavelGlobalRef, periodoGlobalRef, excluirTarefa = null) => {
    if (!responsavelId || !periodo) {
      return 0;
    }

    const datasIndividuaisPeriodo = Array.isArray(periodo.datasIndividuais) ? periodo.datasIndividuais : [];
    const temPeriodoCompleto = periodo.inicio && periodo.fim;
    const temApenasDatasIndividuais = !temPeriodoCompleto && datasIndividuaisPeriodo.length > 0;

    // Se não há período completo nem datas individuais, não há como calcular
    if (!temPeriodoCompleto && !temApenasDatasIndividuais) {
      return 0;
    }

    let tempoTotal = 0;

    // Criar um mapa de todas as tarefas únicas (produtoId_tarefaId)
    // Usar um Map para evitar duplicatas e facilitar a busca
    const tarefasUnicas = new Map();

    // 1. Adicionar tarefas selecionadas
    Object.entries(tarefasSelecionadasObj || {}).forEach(([produtoId, tarefasDoProduto]) => {
      Object.entries(tarefasDoProduto || {}).forEach(([tarefaId, dadosTarefa]) => {
        if (dadosTarefa?.selecionada === true) {
          const key = `${String(produtoId).trim()}_${String(tarefaId).trim()}`;
          tarefasUnicas.set(key, { produtoId: String(produtoId).trim(), tarefaId: String(tarefaId).trim() });
        }
      });
    });

    // 2. Adicionar tarefas que já têm período definido
    Object.keys(periodosPorTarefaObj || {}).forEach(key => {
      const periodoTarefa = periodosPorTarefaObj[key];
      if (periodoTarefa && periodoTarefa.inicio && periodoTarefa.fim) {
        // A chave já está no formato produtoId_tarefaId
        if (key.includes('_')) {
          const partes = key.split('_');
          if (partes.length >= 2) {
            const produtoId = partes[0];
            const tarefaId = partes.slice(1).join('_');
            tarefasUnicas.set(key, { produtoId, tarefaId });
          }
        }
      }
    });

    // 3. Adicionar tarefas que já têm responsável definido
    Object.keys(responsaveisPorTarefaObj || {}).forEach(key => {
      const responsavel = responsaveisPorTarefaObj[key];
      if (responsavel) {
        // A chave já está no formato produtoId_tarefaId
        if (key.includes('_')) {
          const partes = key.split('_');
          if (partes.length >= 2) {
            const produtoId = partes[0];
            const tarefaId = partes.slice(1).join('_');
            tarefasUnicas.set(key, { produtoId, tarefaId });
          }
        }
      }
    });

    // 4. Adicionar tarefas que já têm tempo definido
    Object.keys(tempoEstimadoDiaObj || {}).forEach(key => {
      const tempo = tempoEstimadoDiaObj[key];
      if (tempo && tempo > 0) {
        if (key.includes('_')) {
          // Chave composta: produtoId_tarefaId
          const partes = key.split('_');
          if (partes.length >= 2) {
            const produtoId = partes[0];
            const tarefaId = partes.slice(1).join('_');
            tarefasUnicas.set(key, { produtoId, tarefaId });
          }
        } else {
          // Chave simples: apenas tarefaId - precisamos encontrar o produtoId
          // Buscar em tarefasSelecionadasObj
          Object.entries(tarefasSelecionadasObj || {}).forEach(([produtoId, tarefasDoProduto]) => {
            if (tarefasDoProduto && tarefasDoProduto[key]) {
              const chaveComposta = `${String(produtoId).trim()}_${String(key).trim()}`;
              tarefasUnicas.set(chaveComposta, { produtoId: String(produtoId).trim(), tarefaId: String(key).trim() });
            }
          });
        }
      }
    });

    // Iterar sobre todas as tarefas únicas encontradas
    tarefasUnicas.forEach(({ produtoId, tarefaId }, key) => {
      if (!produtoId || !tarefaId) return;

      // Excluir a tarefa especificada do cálculo (se fornecida)
      if (excluirTarefa &&
        String(excluirTarefa.produtoId).trim() === String(produtoId).trim() &&
        String(excluirTarefa.tarefaId).trim() === String(tarefaId).trim()) {
        return; // Esta é a tarefa que estamos calculando, não contar
      }

      // Verificar se a tarefa tem o mesmo responsável
      const keyResponsavel = getResponsavelKey(produtoId, tarefaId);
      const responsavelTarefa = responsaveisPorTarefaObj[keyResponsavel] || responsavelGlobalRef || null;

      if (!responsavelTarefa || String(responsavelTarefa).trim() !== String(responsavelId).trim()) {
        return; // Responsável diferente, não contar
      }

      // Verificar se o período da tarefa se sobrepõe ou é igual ao período fornecido
      const keyPeriodo = getPeriodoKey(produtoId, tarefaId);
      const periodoTarefa = periodosPorTarefaObj[keyPeriodo] || periodoGlobalRef;

      if (!periodoTarefa) {
        return; // Tarefa sem período definido
      }

      const datasIndividuaisTarefa = Array.isArray(periodoTarefa.datasIndividuais) ? periodoTarefa.datasIndividuais : [];
      const temPeriodoCompletoTarefa = periodoTarefa.inicio && periodoTarefa.fim;
      const temApenasDatasIndividuaisTarefa = !temPeriodoCompletoTarefa && datasIndividuaisTarefa.length > 0;

      // Se a tarefa não tem período completo nem datas individuais, não contar
      if (!temPeriodoCompletoTarefa && !temApenasDatasIndividuaisTarefa) {
        return;
      }

      // Verificar sobreposição
      let temSobreposicao = false;
      let datasNaInterseccao = [];

      if (temPeriodoCompleto && temPeriodoCompletoTarefa) {
        // Caso 1: Ambos têm período completo - verificar sobreposição normal
        const inicioTarefa = new Date(periodoTarefa.inicio);
        inicioTarefa.setHours(0, 0, 0, 0);
        const fimTarefa = new Date(periodoTarefa.fim);
        fimTarefa.setHours(23, 59, 59, 999);
        const inicioPeriodo = new Date(periodo.inicio);
        inicioPeriodo.setHours(0, 0, 0, 0);
        const fimPeriodo = new Date(periodo.fim);
        fimPeriodo.setHours(23, 59, 59, 999);

        temSobreposicao = inicioTarefa <= fimPeriodo && fimTarefa >= inicioPeriodo;

        if (temSobreposicao) {
          const inicioInterseccao = inicioTarefa > inicioPeriodo ? inicioTarefa : inicioPeriodo;
          const fimInterseccao = fimTarefa < fimPeriodo ? fimTarefa : fimPeriodo;

          // Calcular dias na interseção considerando datas individuais de ambos
          const datasIndividuaisInterseccao = [
            ...(Array.isArray(periodoTarefa.datasIndividuais) ? periodoTarefa.datasIndividuais : []),
            ...datasIndividuaisPeriodo
          ].filter(data => {
            const dataObj = new Date(data);
            dataObj.setHours(0, 0, 0, 0);
            return dataObj >= inicioInterseccao && dataObj <= fimInterseccao;
          });

          const diasNaInterseccao = calcularDiasComOpcoesEDatasIndividuais(
            inicioInterseccao.toISOString().split('T')[0],
            fimInterseccao.toISOString().split('T')[0],
            periodoTarefa.habilitarFinaisSemana || false,
            periodoTarefa.habilitarFeriados || false,
            datasIndividuaisInterseccao
          );

          datasNaInterseccao = Array(diasNaInterseccao).fill(null); // Placeholder para compatibilidade
        }
      } else if (temApenasDatasIndividuais && temApenasDatasIndividuaisTarefa) {
        // Caso 2: Ambos têm apenas datas individuais - verificar datas em comum
        const datasPeriodoSet = new Set(datasIndividuaisPeriodo);
        datasNaInterseccao = datasIndividuaisTarefa.filter(data => datasPeriodoSet.has(data));
        temSobreposicao = datasNaInterseccao.length > 0;
      } else if (temApenasDatasIndividuais && temPeriodoCompletoTarefa) {
        // Caso 3: Período global tem apenas datas individuais, tarefa tem período completo
        // Verificar se alguma data individual está dentro do período da tarefa
        const inicioTarefa = new Date(periodoTarefa.inicio);
        inicioTarefa.setHours(0, 0, 0, 0);
        const fimTarefa = new Date(periodoTarefa.fim);
        fimTarefa.setHours(23, 59, 59, 999);

        datasNaInterseccao = datasIndividuaisPeriodo.filter(data => {
          const dataObj = new Date(data);
          dataObj.setHours(0, 0, 0, 0);
          return dataObj >= inicioTarefa && dataObj <= fimTarefa;
        });
        temSobreposicao = datasNaInterseccao.length > 0;
      } else if (temPeriodoCompleto && temApenasDatasIndividuaisTarefa) {
        // Caso 4: Período global tem período completo, tarefa tem apenas datas individuais
        // Verificar se alguma data individual da tarefa está dentro do período global
        const inicioPeriodo = new Date(periodo.inicio);
        inicioPeriodo.setHours(0, 0, 0, 0);
        const fimPeriodo = new Date(periodo.fim);
        fimPeriodo.setHours(23, 59, 59, 999);

        datasNaInterseccao = datasIndividuaisTarefa.filter(data => {
          const dataObj = new Date(data);
          dataObj.setHours(0, 0, 0, 0);
          return dataObj >= inicioPeriodo && dataObj <= fimPeriodo;
        });
        temSobreposicao = datasNaInterseccao.length > 0;
      }

      if (!temSobreposicao) {
        return; // Não há sobreposição
      }

      // Obter tempo estimado da tarefa (em milissegundos, é o tempo DIÁRIO)
      const keyTempo = getTempoKey(produtoId, tarefaId);
      const tempoTarefaDiario = tempoEstimadoDiaObj[keyTempo] || tempoEstimadoDiaObj[tarefaId] || 0;

      // Só contar se a tarefa tem tempo definido (> 0)
      if (tempoTarefaDiario > 0) {
        let diasNaInterseccao = 0;

        if (temPeriodoCompleto && temPeriodoCompletoTarefa) {
          // Já calculado acima
          const inicioTarefa = new Date(periodoTarefa.inicio);
          inicioTarefa.setHours(0, 0, 0, 0);
          const fimTarefa = new Date(periodoTarefa.fim);
          fimTarefa.setHours(23, 59, 59, 999);
          const inicioPeriodo = new Date(periodo.inicio);
          inicioPeriodo.setHours(0, 0, 0, 0);
          const fimPeriodo = new Date(periodo.fim);
          fimPeriodo.setHours(23, 59, 59, 999);

          const inicioInterseccao = inicioTarefa > inicioPeriodo ? inicioTarefa : inicioPeriodo;
          const fimInterseccao = fimTarefa < fimPeriodo ? fimTarefa : fimPeriodo;

          const datasIndividuaisInterseccao = [
            ...(Array.isArray(periodoTarefa.datasIndividuais) ? periodoTarefa.datasIndividuais : []),
            ...datasIndividuaisPeriodo
          ].filter(data => {
            const dataObj = new Date(data);
            dataObj.setHours(0, 0, 0, 0);
            return dataObj >= inicioInterseccao && dataObj <= fimInterseccao;
          });

          diasNaInterseccao = calcularDiasComOpcoesEDatasIndividuais(
            inicioInterseccao.toISOString().split('T')[0],
            fimInterseccao.toISOString().split('T')[0],
            periodoTarefa.habilitarFinaisSemana || false,
            periodoTarefa.habilitarFeriados || false,
            datasIndividuaisInterseccao
          );
        } else {
          // Quando há apenas datas individuais, contar quantas datas estão na interseção
          diasNaInterseccao = calcularDiasApenasComDatasIndividuais(
            datasNaInterseccao,
            periodoTarefa.habilitarFinaisSemana || false,
            periodoTarefa.habilitarFeriados || false
          );
        }

        // Calcular o tempo total da tarefa na interseção: tempo diário × número de dias da interseção
        const tempoTotalTarefa = tempoTarefaDiario * diasNaInterseccao;

        tempoTotal += tempoTotalTarefa;
      }
    });

    return tempoTotal;
  }, []);

  // Função para calcular tempo disponível global
  // Funciona tanto no modo "Preencher vários" quanto sem ele
  // Considera todas as tarefas que já têm período, responsável e tempo definidos
  // excluirTarefa: { produtoId, tarefaId } - opcional, tarefa a ser excluída do cálculo
  const calcularTempoDisponivelGlobal = useCallback((responsavelId, periodo, horasContratadasObj, tempoEstimadoDiaObj, tarefasSelecionadasObj, excluirTarefa = null) => {
    if (!responsavelId || !periodo) {
      return 0;
    }

    const datasIndividuais = Array.isArray(periodo.datasIndividuais) ? periodo.datasIndividuais : [];
    const temPeriodoCompleto = periodo.inicio && periodo.fim;
    const temApenasDatasIndividuais = !temPeriodoCompleto && datasIndividuais.length > 0;

    // Se não há período completo nem datas individuais, não há como calcular
    if (!temPeriodoCompleto && !temApenasDatasIndividuais) {
      return 0;
    }

    // Obter horas contratadas do responsável
    const horasContratadas = horasContratadasObj[String(responsavelId)] || null;

    if (!horasContratadas || horasContratadas <= 0) {
      return 0; // Sem horas contratadas, não há disponível
    }

    let diasNoPeriodo = 0;
    let periodoMin = null;
    let periodoMax = null;

    // Calcular dias no período
    if (temPeriodoCompleto) {
      // Caso normal: período completo
      diasNoPeriodo = calcularDiasComOpcoesEDatasIndividuais(
        periodo.inicio,
        periodo.fim,
        periodo.habilitarFinaisSemana || false,
        periodo.habilitarFeriados || false,
        datasIndividuais
      );
      periodoMin = periodo.inicio;
      periodoMax = periodo.fim;
    } else if (temApenasDatasIndividuais) {
      // Caso especial: apenas datas individuais (sem período completo)
      diasNoPeriodo = calcularDiasApenasComDatasIndividuais(
        datasIndividuais,
        periodo.habilitarFinaisSemana || false,
        periodo.habilitarFeriados || false
      );

      // Para buscar tempo estimado na API, usar min/max das datas individuais
      const datasOrdenadas = [...datasIndividuais].sort();
      periodoMin = datasOrdenadas[0];
      periodoMax = datasOrdenadas[datasOrdenadas.length - 1];
    }

    if (diasNoPeriodo <= 0) {
      return 0; // Sem dias válidos no período
    }

    // Calcular tempo disponível total (horas contratadas × dias × 3600000 ms)
    const tempoDisponivelTotal = horasContratadas * diasNoPeriodo * 3600000;

    // Buscar tempo estimado total já existente no período do cache (calculado no useEffect)
    // Se não estiver no cache, retornar 0 (será calculado em background)
    // A chave do cache usa o responsavelId, então funciona tanto para período completo quanto para datas individuais
    const tempoEstimadoTotalNoPeriodo = tempoEstimadoTotalPorResponsavel[String(responsavelId)] || 0;

    // Calcular tempo já atribuído na interface atual (para exibir tempo disponível em tempo real)
    // A função calcularTempoJaAtribuido agora considera TODAS as tarefas preenchidas,
    // não apenas as selecionadas
    // Se excluirTarefa for fornecido, essa tarefa será excluída do cálculo
    const tempoJaAtribuidoNaInterface = calcularTempoJaAtribuido(
      responsavelId,
      periodo,
      tempoEstimadoDiaObj,
      tarefasSelecionadasObj,
      responsaveisPorTarefa,
      periodosPorTarefa,
      responsavelGlobal,
      periodoGlobal,
      excluirTarefa // Excluir a tarefa especificada se fornecida
    );

    // Calcular tempo disponível restante:
    // Tempo contratado no período - Tempo já estimado no período (via API) - Tempo sendo atribuído agora (na interface)
    // Pode ser negativo se excedido
    const tempoDisponivel = tempoDisponivelTotal - tempoEstimadoTotalNoPeriodo - tempoJaAtribuidoNaInterface;

    return tempoDisponivel;
  }, [responsaveisPorTarefa, periodosPorTarefa, responsavelGlobal, periodoGlobal, calcularTempoJaAtribuido, tempoEstimadoTotalPorResponsavel]);

  // Calcular tempo estimado total por responsável quando os períodos e responsáveis mudarem
  useEffect(() => {
    const calcularTemposEstimadosTotais = async () => {
      // Coletar todos os responsáveis únicos e seus períodos
      const responsaveisComPeriodos = new Map();

      // Adicionar responsáveis das tarefas individuais
      Object.entries(responsaveisPorTarefa).forEach(([key, responsavelId]) => {
        if (!responsavelId) return;
        const [produtoId, tarefaId] = key.split('_');
        const periodoKey = `${produtoId}_${tarefaId}`;
        const periodo = periodosPorTarefa[periodoKey];
        if (periodo) {
          const temPeriodoCompleto = periodo.inicio && periodo.fim;
          const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;

          // Aceitar se tiver período completo ou apenas datas individuais
          if (temPeriodoCompleto || temDatasIndividuais) {
            const responsavelIdStr = String(responsavelId);
            if (!responsaveisComPeriodos.has(responsavelIdStr)) {
              responsaveisComPeriodos.set(responsavelIdStr, {
                responsavelId: responsavelIdStr,
                periodos: []
              });
            }
            responsaveisComPeriodos.get(responsavelIdStr).periodos.push(periodo);
          }
        }
      });

      // Adicionar responsável global (se houver)
      if (responsavelGlobal && periodoGlobal) {
        const temPeriodoCompleto = periodoGlobal.inicio && periodoGlobal.fim;
        const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;

        // Aceitar se tiver período completo ou apenas datas individuais
        if (temPeriodoCompleto || temDatasIndividuais) {
          const responsavelIdStr = String(responsavelGlobal);
          if (!responsaveisComPeriodos.has(responsavelIdStr)) {
            responsaveisComPeriodos.set(responsavelIdStr, {
              responsavelId: responsavelIdStr,
              periodos: []
            });
          }
          responsaveisComPeriodos.get(responsavelIdStr).periodos.push(periodoGlobal);
        }
      }

      if (responsaveisComPeriodos.size === 0) {
        setTempoEstimadoTotalPorResponsavel({});
        return;
      }

      // Calcular tempo estimado total para cada responsável (considerando todos os períodos)
      const temposCache = {};
      const promises = Array.from(responsaveisComPeriodos.entries()).map(async ([responsavelId, { periodos }]) => {
        let tempoTotal = 0;
        // Para cada período do responsável, buscar o tempo estimado total
        for (const periodo of periodos) {
          const temPeriodoCompleto = periodo.inicio && periodo.fim;
          const datasIndividuais = Array.isArray(periodo.datasIndividuais) ? periodo.datasIndividuais : [];
          const temApenasDatasIndividuais = !temPeriodoCompleto && datasIndividuais.length > 0;

          let dataInicio = periodo.inicio;
          let dataFim = periodo.fim;

          // Se há apenas datas individuais, usar min/max das datas
          if (temApenasDatasIndividuais) {
            const datasOrdenadas = [...datasIndividuais].sort();
            dataInicio = datasOrdenadas[0];
            dataFim = datasOrdenadas[datasOrdenadas.length - 1];
          }

          const tempo = await buscarTempoEstimadoTotalPorResponsavel(
            responsavelId,
            dataInicio,
            dataFim,
            periodo.habilitarFinaisSemana || false,
            periodo.habilitarFeriados || false,
            datasIndividuais
          );
          tempoTotal += tempo;
        }
        temposCache[responsavelId] = tempoTotal;
      });

      await Promise.all(promises);
      setTempoEstimadoTotalPorResponsavel(temposCache);
    };

    calcularTemposEstimadosTotais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsaveisPorTarefa, periodosPorTarefa, responsavelGlobal, periodoGlobal, buscarTempoEstimadoTotalPorResponsavel]);

  // Removido: useEffect que buscava horas contratadas quando responsavelSelecionado mudava
  // Agora cada tarefa tem seu próprio responsável, então não há mais um responsável global

  // Removido: validação de horas contratadas global
  // Como cada tarefa pode ter um responsável diferente, a validação deveria ser feita por responsável
  // Isso pode ser implementado no futuro se necessário

  // Carregar produtos vinculados ao cliente selecionado (usando tabela de vinculados)
  useEffect(() => {
    // Se estiver editando, NÃO carregar dados automaticamente aqui
    // O loadDadosEdicao já cuidará disso
    if (editingAgrupamento) {
      return;
    }

    if (clienteSelecionado) {
      loadProdutosPorCliente(clienteSelecionado);
    } else {
      setProdutos([]);
      setProdutosSelecionados([]);
      setTarefas([]);
      setTarefasSelecionadas([]);
    }
  }, [clienteSelecionado, editingAgrupamento]);

  const loadProdutosPorCliente = async (clienteId) => {
    console.log('🔄 [AtribuicaoCliente] Carregando produtos vinculados ao cliente:', clienteId);
    setLoading(true);
    try {
      // Buscar apenas produtos vinculados a este cliente
      const responseCliente = await fetch(`${API_BASE_URL}/vinculados?filtro_cliente=${clienteId}&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      let produtosVinculadosAoCliente = [];

      if (responseCliente.ok) {
        const resultCliente = await responseCliente.json();
        if (resultCliente.success && resultCliente.data) {
          // Filtrar apenas vinculados deste cliente
          const vinculadosDoCliente = resultCliente.data.filter(v => {
            const vClienteId = v.cp_cliente || '';
            return String(vClienteId) === String(clienteId) && v.cp_produto;
          });

          console.log('🔗 [AtribuicaoCliente] Vinculados do cliente:', vinculadosDoCliente.length);

          // Extrair IDs únicos dos produtos vinculados ao cliente
          const produtosVinculadosAoClienteIds = [...new Set(
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
                  // Criar array de produtos com id e nome
                  produtosVinculadosAoCliente = produtosVinculadosAoClienteIds.map(produtoId => {
                    const nome = produtosClienteResult.data[String(produtoId)] || `Produto #${produtoId}`;
                    return { id: produtoId, nome };
                  });
                }
              }
            } catch (error) {
              console.error('❌ [AtribuicaoCliente] Erro ao buscar nomes dos produtos vinculados ao cliente:', error);
            }
          }
        }
      }

      console.log('📋 [AtribuicaoCliente] Produtos vinculados ao cliente:', produtosVinculadosAoCliente.length);
      console.log('📋 [AtribuicaoCliente] Produtos:', produtosVinculadosAoCliente);

      // Definir produtos e selecionar automaticamente todos (já que são todos vinculados ao cliente)
      setProdutos(produtosVinculadosAoCliente);

      if (produtosVinculadosAoCliente.length > 0) {
        const produtosIdsStr = produtosVinculadosAoCliente.map(p => String(p.id));
        console.log('✅ [AtribuicaoCliente] Produtos vinculados ao cliente:', produtosIdsStr);
        setProdutosSelecionados(produtosIdsStr);
        // Carregar tarefas automaticamente para os produtos vinculados
        await loadTarefasPorClienteEProdutos(clienteId, produtosIdsStr);
      } else {
        console.log('ℹ️ [AtribuicaoCliente] Nenhum produto vinculado ao cliente');
        setProdutosSelecionados([]);
        setTarefas([]);
        setTarefasSelecionadas([]);
      }
    } catch (error) {
      console.error('❌ [AtribuicaoCliente] Erro ao carregar produtos:', error);
      showToast('error', 'Erro ao carregar produtos vinculados ao cliente');
      setProdutos([]);
      setProdutosSelecionados([]);
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

    // Resetar valores aplicados quando as tarefas selecionadas mudarem
    // para permitir aplicar novamente nas novas tarefas
    setValoresAplicados({
      periodo: { inicio: null, fim: null, datasIndividuais: [], habilitarFinaisSemana: false, habilitarFeriados: false },
      responsavel: null,
      tempo: 0
    });
  }, [tarefasSelecionadasPorProduto]);

  // Removido: useEffect que limpava tempos baseado apenas em tarefasSelecionadas
  // Agora o tempo é gerenciado por produto x tarefa, então não precisamos limpar dessa forma

  const loadTarefasPorClienteEProdutos = async (clienteId, produtoIds, shouldSelectAll = true) => {
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

          if (shouldSelectAll) {
            setTarefasSelecionadas(tarefasVinculadas);
          }

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

  // Limpar estado global quando o modo "Preencher vários" for desativado
  useEffect(() => {
    if (!modoPeriodoParaMuitos) {
      setResponsavelGlobal(null);
      setTempoGlobal(0);
      setPeriodoGlobal({
        inicio: null,
        fim: null,
        datasIndividuais: [],
        habilitarFinaisSemana: false,
        habilitarFeriados: false
      });
      // Resetar valores aplicados quando o modo for desativado
      setValoresAplicados({
        periodo: { inicio: null, fim: null, datasIndividuais: [], habilitarFinaisSemana: false, habilitarFeriados: false },
        responsavel: null,
        tempo: 0
      });
      // Limpar tempo disponível
      setTempoDisponivelGlobal(0);
    }
  }, [modoPeriodoParaMuitos]);

  // Buscar horas contratadas quando responsável global mudar e período estiver preenchido
  useEffect(() => {
    if (responsavelGlobal) {
      const temPeriodoCompleto = periodoGlobal.inicio && periodoGlobal.fim;
      const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;

      if (temPeriodoCompleto || temDatasIndividuais) {
        // Determinar data para buscar horas contratadas (usar primeira data se apenas datas individuais)
        let dataParaBuscar = periodoGlobal.inicio;

        if (!temPeriodoCompleto && temDatasIndividuais) {
          const datasOrdenadas = [...periodoGlobal.datasIndividuais].sort();
          dataParaBuscar = datasOrdenadas[0];
        }

        buscarHorasContratadasPorResponsavel(responsavelGlobal, dataParaBuscar);
      }
    } else {
      // Limpar horas contratadas quando responsável for removido
      setHorasContratadasPorResponsavel(prev => {
        const novo = { ...prev };
        delete novo[String(responsavelGlobal)];
        return novo;
      });
    }
  }, [responsavelGlobal, periodoGlobal.inicio, periodoGlobal.fim, periodoGlobal.datasIndividuais]);

  // Buscar horas contratadas para tarefas individuais quando responsável e período forem definidos
  useEffect(() => {
    // Coletar todos os pares únicos de (responsavelId, dataInicio) das tarefas individuais
    const responsaveisEPeriodos = new Set();

    Object.entries(responsaveisPorTarefa || {}).forEach(([key, responsavelId]) => {
      if (!responsavelId) return;

      // Extrair produtoId e tarefaId da chave
      const partes = key.split('_');
      if (partes.length < 2) return;

      const produtoId = partes[0];
      const tarefaId = partes.slice(1).join('_');

      // Obter período da tarefa
      const keyPeriodo = getPeriodoKey(produtoId, tarefaId);
      const periodo = periodosPorTarefa[keyPeriodo];

      if (periodo) {
        const temPeriodoCompleto = periodo.inicio && periodo.fim;
        const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;

        if (temPeriodoCompleto || temDatasIndividuais) {
          // Determinar dataInicio para criar chave única (usar min se apenas datas individuais)
          let dataInicio = periodo.inicio;

          if (!temPeriodoCompleto && temDatasIndividuais) {
            const datasOrdenadas = [...periodo.datasIndividuais].sort();
            dataInicio = datasOrdenadas[0];
          }

          // Criar chave única para (responsavelId, dataInicio)
          const chaveUnica = `${String(responsavelId).trim()}_${dataInicio}`;
          responsaveisEPeriodos.add(chaveUnica);
        }
      }
    });

    // Buscar horas contratadas para cada par único
    responsaveisEPeriodos.forEach(chave => {
      const [responsavelId, dataInicio] = chave.split('_');

      // Verificar se já temos as horas contratadas para este responsável
      // Se não tivermos ou se a data for diferente, buscar novamente
      const horasAtuais = horasContratadasPorResponsavel[String(responsavelId)];

      // Buscar horas contratadas se não tivermos ou se precisarmos atualizar
      if (!horasAtuais || horasAtuais === null) {
        buscarHorasContratadasPorResponsavel(responsavelId, dataInicio);
      }
    });
  }, [responsaveisPorTarefa, periodosPorTarefa]);

  // Calcular tempo disponível global usando useMemo
  // Inclui dependências de tarefas individuais para que o cálculo seja atualizado
  // quando tarefas são preenchidas individualmente (modo "Preencher vários" desativado)
  const tempoDisponivelCalculado = useMemo(() => {
    if (!responsavelGlobal) {
      return 0;
    }

    // Verificar se há período completo ou apenas datas individuais
    const temPeriodoCompleto = periodoGlobal.inicio && periodoGlobal.fim;
    const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;

    // Se não há período completo nem datas individuais, não calcular
    if (!temPeriodoCompleto && !temDatasIndividuais) {
      return 0;
    }

    return calcularTempoDisponivelGlobal(
      responsavelGlobal,
      periodoGlobal,
      horasContratadasPorResponsavel,
      tempoEstimadoDia,
      tarefasSelecionadasPorProduto
    );
  }, [
    responsavelGlobal,
    periodoGlobal,
    horasContratadasPorResponsavel,
    tempoEstimadoDia,
    tarefasSelecionadasPorProduto,
    responsaveisPorTarefa,  // Incluir para atualizar quando tarefas individuais são preenchidas
    periodosPorTarefa,      // Incluir para atualizar quando tarefas individuais são preenchidas
    calcularTempoDisponivelGlobal
  ]);

  // Atualizar estado do tempo disponível quando o cálculo mudar
  useEffect(() => {
    setTempoDisponivelGlobal(tempoDisponivelCalculado);
  }, [tempoDisponivelCalculado]);

  // Função para verificar se há alterações nos campos globais comparando com valores aplicados
  const temAlteracoes = () => {
    // Se não há valores preenchidos, não há alterações
    // Tempo pode ser 0 (zerado), mas ainda é considerado um valor válido
    // Datas individuais também são consideradas valores válidos
    const temDatasIndividuais = Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0;
    const temValoresPreenchidos =
      (periodoGlobal.inicio && periodoGlobal.fim) ||
      temDatasIndividuais ||
      responsavelGlobal ||
      (tempoGlobal !== undefined && tempoGlobal !== null);

    if (!temValoresPreenchidos) {
      return false;
    }

    // Verificar se há valores aplicados (se não há, significa que é a primeira vez e deve habilitar)
    // Tempo pode ser 0 (zerado), mas ainda é considerado um valor aplicado
    // Datas individuais também são consideradas valores aplicados
    const temDatasIndividuaisAplicadas = Array.isArray(valoresAplicados.periodo.datasIndividuais) && valoresAplicados.periodo.datasIndividuais.length > 0;
    const temValoresAplicados =
      (valoresAplicados.periodo.inicio && valoresAplicados.periodo.fim) ||
      temDatasIndividuaisAplicadas ||
      valoresAplicados.responsavel ||
      (valoresAplicados.tempo !== undefined && valoresAplicados.tempo !== null);

    // Se não há valores aplicados, qualquer valor preenchido habilita o botão
    if (!temValoresAplicados) {
      return true;
    }

    // Verificar período
    const periodoAtual = {
      inicio: periodoGlobal.inicio,
      fim: periodoGlobal.fim,
      datasIndividuais: Array.isArray(periodoGlobal.datasIndividuais) ? periodoGlobal.datasIndividuais.sort().join(',') : '',
      habilitarFinaisSemana: !!periodoGlobal.habilitarFinaisSemana,
      habilitarFeriados: !!periodoGlobal.habilitarFeriados
    };
    const periodoAplicado = {
      inicio: valoresAplicados.periodo.inicio,
      fim: valoresAplicados.periodo.fim,
      datasIndividuais: Array.isArray(valoresAplicados.periodo.datasIndividuais) ? valoresAplicados.periodo.datasIndividuais.sort().join(',') : '',
      habilitarFinaisSemana: !!valoresAplicados.periodo.habilitarFinaisSemana,
      habilitarFeriados: !!valoresAplicados.periodo.habilitarFeriados
    };

    const periodoMudou =
      periodoAtual.inicio !== periodoAplicado.inicio ||
      periodoAtual.fim !== periodoAplicado.fim ||
      periodoAtual.datasIndividuais !== periodoAplicado.datasIndividuais ||
      periodoAtual.habilitarFinaisSemana !== periodoAplicado.habilitarFinaisSemana ||
      periodoAtual.habilitarFeriados !== periodoAplicado.habilitarFeriados;

    // Verificar responsável
    const responsavelAtual = responsavelGlobal ? String(responsavelGlobal).trim() : null;
    const responsavelAplicado = valoresAplicados.responsavel;
    const responsavelMudou = responsavelAtual !== responsavelAplicado;

    // Verificar tempo (considera 0 como valor válido)
    const tempoAtual = tempoGlobal !== undefined && tempoGlobal !== null ? tempoGlobal : null;
    const tempoAplicado = valoresAplicados.tempo !== undefined && valoresAplicados.tempo !== null ? valoresAplicados.tempo : null;
    const tempoMudou = tempoAtual !== tempoAplicado;

    return periodoMudou || responsavelMudou || tempoMudou;
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
      showToast('warning', 'Este cliente não possui produtos vinculados. É necessário vincular produtos ao cliente antes de criar atribuições.');
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

        if (p) {
          const temPeriodoCompleto = p.inicio && p.fim;
          const temDatasIndividuais = Array.isArray(p.datasIndividuais) && p.datasIndividuais.length > 0;

          if (temPeriodoCompleto || temDatasIndividuais) {
            let inicio = p.inicio;
            let fim = p.fim;

            // Se há apenas datas individuais, usar min/max das datas para inicio e fim
            if (!temPeriodoCompleto && temDatasIndividuais) {
              const datasOrdenadas = [...p.datasIndividuais].sort();
              inicio = datasOrdenadas[0];
              fim = datasOrdenadas[datasOrdenadas.length - 1];
            }

            return {
              inicio,
              fim,
              incluir_finais_semana: !!p.habilitarFinaisSemana,
              incluir_feriados: !!p.habilitarFeriados,
              datas_individuais: Array.isArray(p.datasIndividuais) ? p.datasIndividuais : []
            };
          }
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

      if (editingAgrupamento) {
        // MODO EDIÇÃO (PUT): Enviar todos os grupos em uma única requisição para atualização atômica
        // Isso evita que chamadas sequenciais apaguem dados uns dos outros no backend
        const gruposPayload = grupos.map(grupo => ({
          produtos_com_tarefas: grupo.produtos_com_tarefas,
          data_inicio: grupo.periodo.inicio,
          data_fim: grupo.periodo.fim,
          responsavel_id: grupo.responsavel_id, // Responsável padrão do grupo
          incluir_finais_semana: grupo.periodo.incluir_finais_semana,
          incluir_feriados: grupo.periodo.incluir_feriados,
          datas_individuais: grupo.periodo.datas_individuais
        }));

        const payload = {
          cliente_id: clienteSelecionado,
          grupos: gruposPayload
        };

        console.log('💾 [ATRIBUICAO] Salvando atualização em lote (PUT):', JSON.stringify(payload, null, 2));

        const response = await fetch(urlBase, {
          method: 'PUT', // Já definido, mas reforçando
          headers: { 'Content-Type': 'application/json' },
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

        totalLinhas = result.count || 0;

      } else {
        // MODO CRIAÇÃO (POST): Manter comportamento de criar múltiplos agrupamentos se houver múltiplos grupos
        // (Ou futuramente migrar para POST em lote se desejado criar um único agrupador)
        for (const grupo of grupos) {
          const responsavelComum = grupo.responsavel_id;

          const payload = {
            cliente_id: clienteSelecionado,
            produtos_com_tarefas: grupo.produtos_com_tarefas,
            data_inicio: grupo.periodo.inicio,
            data_fim: grupo.periodo.fim,
            responsavel_id: responsavelComum,
            incluir_finais_semana: grupo.periodo.incluir_finais_semana,
            incluir_feriados: grupo.periodo.incluir_feriados,
            datas_individuais: grupo.periodo.datas_individuais
          };

          console.log('💾 [ATRIBUICAO] Salvando novo grupo (POST):', JSON.stringify(payload, null, 2));

          const response = await fetch(urlBase, {
            method: 'POST', // method variable handled logic, but hardcoding here since we split branches
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
      }

      showToast('success', `Atribuição salva com sucesso! ${totalLinhas} dia(s) atribuídos/atualizados em ${grupos.length} grupo(s) de período.`);
      navigate(editingAgrupamento ? '/atribuir-responsaveis/historico' : '/atribuir-responsaveis');
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
                    onClick={() => navigate(editingAgrupamento ? '/atribuir-responsaveis/historico' : '/atribuir-responsaveis')}
                  >
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                  </button>
                </div>
              </div>

              {/* Formulário */}
              <div className="atribuicao-form-content">
                {/* Seção: Seleção Inicial */}
                <div className="atribuicao-form-section informacoes-basicas-section">
                  <h3 className="atribuicao-form-section-title">
                    <i className="fas fa-list-ol"></i>
                    Informações Básicas
                  </h3>
                  <div className="form-row-vigencia informacoes-basicas-row">
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
                    </div>

                    {/* 2. Produtos */}
                    <div className="form-group">
                      <label className="form-label-small">
                        <i className="fas fa-box" style={{ marginRight: '6px' }}></i>
                        2. Produtos
                      </label>
                      <div
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          minHeight: '40px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          alignItems: 'center'
                        }}
                      >
                        {loading && !clienteSelecionado ? (
                          <span style={{ fontSize: '13px', color: '#64748b' }}>
                            <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                            Carregando...
                          </span>
                        ) : produtos.length > 0 ? (
                          produtos.map(produto => (
                            <span
                              key={produto.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px 12px',
                                backgroundColor: '#0e3b6f',
                                color: '#ffffff',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '500'
                              }}
                            >
                              {produto.nome}
                            </span>
                          ))
                        ) : clienteSelecionado ? (
                          <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                            <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                            Este cliente não possui produtos vinculados
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                            Selecione um cliente para visualizar os produtos
                          </span>
                        )}
                      </div>
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
                    {/* Modo: Preencher vários */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label
                          htmlFor="toggle-preencher-varios"
                          style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          Preencher vários
                        </label>
                        <div className="toggle-switch-minimal">
                          <input
                            type="checkbox"
                            id="toggle-preencher-varios"
                            className="toggle-input-minimal"
                            checked={modoPeriodoParaMuitos}
                            onChange={(e) => setModoPeriodoParaMuitos(e.target.checked)}
                            disabled={loading || submitting}
                          />
                          <label htmlFor="toggle-preencher-varios" className="toggle-slider-minimal"></label>
                        </div>
                      </div>
                      {modoPeriodoParaMuitos && (
                        <>
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
                          <div style={{ minWidth: '182px', position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }} className="responsavel-card-global-wrapper">
                            <div style={{ width: '100%', flex: '1 1 auto', minWidth: 0 }}>
                              <ResponsavelCard
                                value={responsavelGlobal || ''}
                                onChange={(e) => setResponsavelGlobal(e.target.value || null)}
                                placeholder="Selecione responsável"
                                disabled={loading || submitting || !clienteSelecionado || produtosSelecionados.length === 0 || !podePreencherResponsavel()}
                                options={colaboradores.map(c => ({
                                  value: c.id,
                                  label: c.cpf ? `${c.nome} (${c.cpf})` : c.nome
                                }))}
                                colaboradores={colaboradores}
                              />
                            </div>
                            {!podePreencherResponsavel() && (
                              <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000 }}>
                                Preencha o período ou selecione dias específicos primeiro
                              </div>
                            )}
                            {podePreencherResponsavel() && responsavelGlobal && tempoDisponivelGlobal !== undefined && tempoDisponivelGlobal !== null && (
                              (() => {
                                const isExcedido = tempoDisponivelGlobal < 0;
                                return (
                                  <div
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: isExcedido ? '#fef2f2' : '#f0f9ff',
                                      border: `1px solid ${isExcedido ? '#ef4444' : '#0ea5e9'}`,
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      color: isExcedido ? '#991b1b' : '#0c4a6e',
                                      fontWeight: '500',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxSizing: 'border-box',
                                      cursor: 'help',
                                      flexShrink: 0,
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={isExcedido ? "Tempo excedido" : "Disponível"}
                                  >
                                    <i className="fas fa-clock" style={{ fontSize: '11px', flexShrink: 0 }}></i>
                                    <span>{isExcedido ? `-${formatarTempoEstimado(Math.abs(tempoDisponivelGlobal), false)}` : formatarTempoEstimado(tempoDisponivelGlobal, false)}</span>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                          <div style={{ minWidth: '140px', width: '140px', position: 'relative', display: 'flex', flexDirection: 'column' }} className="tempo-global-wrapper">
                            <div style={{ width: '100%' }}>
                              <TempoEstimadoInput
                                value={tempoGlobal}
                                onChange={(tempoEmMs) => setTempoGlobal(tempoEmMs || 0)}
                                disabled={loading || submitting || !clienteSelecionado || produtosSelecionados.length === 0 || !podePreencherTempo()}
                                placeholder="0h 0min"
                              />
                            </div>
                            {!podePreencherTempo() && podePreencherResponsavel() && (
                              <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000 }}>
                                Preencha o responsável primeiro
                              </div>
                            )}
                            {!podePreencherTempo() && !podePreencherResponsavel() && (
                              <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000 }}>
                                Preencha o período ou selecione dias específicos primeiro
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleAplicarGlobal}
                            disabled={
                              loading ||
                              submitting ||
                              tarefasSelecionadas.length === 0 ||
                              (!periodoGlobal.inicio && !periodoGlobal.fim && !(Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0) && !responsavelGlobal && (!tempoGlobal || tempoGlobal <= 0)) ||
                              !temAlteracoes()
                            }
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: '500',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              whiteSpace: 'nowrap',
                              height: '40px',
                              opacity: (
                                loading ||
                                submitting ||
                                tarefasSelecionadas.length === 0 ||
                                (!periodoGlobal.inicio && !periodoGlobal.fim && !(Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0) && !responsavelGlobal && (!tempoGlobal || tempoGlobal <= 0)) ||
                                !temAlteracoes()
                              ) ? 0.5 : 1,
                              cursor: (
                                loading ||
                                submitting ||
                                tarefasSelecionadas.length === 0 ||
                                (!periodoGlobal.inicio && !periodoGlobal.fim && !(Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0) && !responsavelGlobal && (!tempoGlobal || tempoGlobal <= 0)) ||
                                !temAlteracoes()
                              ) ? 'not-allowed' : 'pointer'
                            }}
                            title={
                              tarefasSelecionadas.length === 0
                                ? "Selecione pelo menos uma tarefa para aplicar"
                                : (!periodoGlobal.inicio && !periodoGlobal.fim && !(Array.isArray(periodoGlobal.datasIndividuais) && periodoGlobal.datasIndividuais.length > 0) && !responsavelGlobal && (!tempoGlobal || tempoGlobal <= 0))
                                  ? "Preencha pelo menos um campo (período, dias específicos, responsável ou tempo) para aplicar"
                                  : !temAlteracoes()
                                    ? "Não há alterações para aplicar. Modifique algum campo para habilitar o botão."
                                    : "Aplicar período, responsável e/ou tempo a todas as tarefas selecionadas"
                            }
                          >
                            <i className="fas fa-check" style={{ fontSize: '12px' }}></i>
                            Aplicar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleLimparGlobal}
                            disabled={loading || submitting}
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: '500',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              whiteSpace: 'nowrap',
                              height: '40px',
                              opacity: (loading || submitting) ? 0.5 : 1,
                              cursor: (loading || submitting) ? 'not-allowed' : 'pointer'
                            }}
                            title="Limpar todos os campos globais"
                          >
                            <i className="fas fa-times" style={{ fontSize: '12px' }}></i>
                            Limpar
                          </button>
                        </>
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
                          initialTarefas={initialTarefas} // Passar tarefas iniciais
                          // Período por tarefa e modo em lote
                          periodosPorTarefa={periodosPorTarefa}
                          onPeriodoChange={(produtoId, tarefaId, updates) => handlePeriodoTarefaChange(produtoId, tarefaId, { ...updates, source: 'manual' })}
                          modoPeriodoParaMuitos={modoPeriodoParaMuitos}
                          filterPeriodoUiVariant="atribuicao-mini"
                          // Responsáveis por tarefa
                          responsaveisPorTarefa={responsaveisPorTarefa}
                          onResponsavelChange={handleResponsavelTarefaChange}
                          colaboradores={colaboradores}
                          // Ordem de preenchimento e tempo disponível
                          ordemPreenchimento={{
                            podePreencherResponsavel: (produtoId, tarefaId) => {
                              const key = getPeriodoKey(produtoId, tarefaId);
                              const periodo = periodosPorTarefa[key];
                              if (!periodo) return false;
                              const temPeriodoCompleto = periodo.inicio && periodo.fim;
                              const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
                              return !!(temPeriodoCompleto || temDatasIndividuais);
                            },
                            podePreencherTempo: (produtoId, tarefaId) => {
                              const keyPeriodo = getPeriodoKey(produtoId, tarefaId);
                              const keyResponsavel = getResponsavelKey(produtoId, tarefaId);
                              const periodo = periodosPorTarefa[keyPeriodo];
                              const responsavel = responsaveisPorTarefa[keyResponsavel];
                              if (!periodo || !responsavel) return false;
                              const temPeriodoCompleto = periodo.inicio && periodo.fim;
                              const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
                              return !!(temPeriodoCompleto || temDatasIndividuais);
                            }
                          }}
                          horasContratadasPorResponsavel={horasContratadasPorResponsavel}
                          calcularTempoDisponivel={calcularTempoDisponivelGlobal}
                          formatarTempoEstimado={formatarTempoEstimado}
                          tarefasSelecionadasPorProduto={tarefasSelecionadasPorProduto}
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
                          // Verificar período (período completo OU apenas datas individuais)
                          const periodoKey = getPeriodoKey(produtoIdNormalizado, tarefaIdNormalizado);
                          const periodo = periodosPorTarefa[periodoKey];
                          if (!periodo) {
                            return true;
                          }
                          const temPeriodoCompleto = periodo.inicio && periodo.fim;
                          const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
                          if (!temPeriodoCompleto && !temDatasIndividuais) {
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

