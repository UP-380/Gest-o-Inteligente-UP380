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
          
          const temposPorTarefa = {};
          registros.forEach(reg => {
            const tarefaId = String(reg.tarefa_id);
            if (!temposPorTarefa[tarefaId]) {
              temposPorTarefa[tarefaId] = reg.tempo_estimado_dia || 0;
            }
          });
          setTempoEstimadoDia(temposPorTarefa);
          setResponsavelSelecionado(primeiroRegistro.responsavel_id);
          
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
    setResponsavelSelecionado(null);
    setProdutos([]);
    setTarefas([]);
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setErroDuplicata(null);
  };

  // Verificar duplicatas
  const verificarDuplicatas = useCallback(async () => {
    if (!responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0 || 
        tarefasSelecionadas.length === 0 || !dataInicio || !dataFim || editingAgrupamento) {
      setErroDuplicata(null);
      return;
    }

    setVerificandoDuplicata(true);
    try {
      const params = new URLSearchParams({
        cliente_id: String(clienteSelecionado),
        responsavel_id: String(responsavelSelecionado),
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      
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
    } finally {
      setVerificandoDuplicata(false);
    }
  }, [responsavelSelecionado, clienteSelecionado, produtosSelecionados, tarefasSelecionadas, dataInicio, dataFim, editingAgrupamento]);

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

  useEffect(() => {
    if (responsavelSelecionado) {
      buscarHorasContratadasPorResponsavel(responsavelSelecionado);
    } else {
      setHorasContratadasDia(null);
      setErroTempoEstimado(null);
    }
  }, [responsavelSelecionado]);

  useEffect(() => {
    if (horasContratadasDia && tarefasSelecionadasPorProduto && Object.keys(tarefasSelecionadasPorProduto).length > 0) {
      // Calcular total considerando produto x tarefa
      let totalTempoMs = 0;
      Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
        Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
          if (dadosTarefa.selecionada === true) {
            totalTempoMs += getTempoEstimado(produtoId, tarefaId);
          }
        });
      });
      
      const totalHorasPorDia = totalTempoMs / (1000 * 60 * 60);
      
      if (totalHorasPorDia > horasContratadasDia) {
        setErroTempoEstimado(
          `O tempo estimado total por dia (${totalHorasPorDia.toFixed(2)}h) ultrapassa as horas contratadas do responsável (${horasContratadasDia}h). ` +
          `Ajuste os tempos individuais das tarefas.`
        );
      } else {
        setErroTempoEstimado(null);
      }
    } else {
      setErroTempoEstimado(null);
    }
  }, [tempoEstimadoDia, horasContratadasDia, tarefasSelecionadasPorProduto]);

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
      return `${produtoId}_${tarefaId}`;
    }
    // Fallback para compatibilidade: se não tiver produtoId, usar apenas tarefaId
    return tarefaId;
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

    // Verificar tarefas sem tempo considerando produto x tarefa
    const tarefasSemTempo = [];
    Object.entries(tarefasSelecionadasPorProduto).forEach(([produtoId, tarefasDoProduto]) => {
      Object.entries(tarefasDoProduto).forEach(([tarefaId, dadosTarefa]) => {
        if (dadosTarefa.selecionada === true) {
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
            
            tarefasParaEsteProduto.push({
              tarefa_id: String(tarefaId).trim(),
              tempo_estimado_dia: tempoInt
            });
          }
        });
        
        if (tarefasParaEsteProduto.length > 0) {
          produtosComTarefas[produtoIdStr] = tarefasParaEsteProduto;
        }
      });

      const dadosParaSalvar = {
        cliente_id: clienteSelecionado,
        produtos_com_tarefas: produtosComTarefas, // Novo formato: { produtoId: [{ tarefa_id, tempo_estimado_dia }] }
        data_inicio: dataInicio,
        data_fim: dataFim,
        responsavel_id: String(responsavelSelecionado),
        incluir_finais_semana: habilitarFinaisSemana,
        incluir_feriados: habilitarFeriados
      };
      
      console.log('💾 [ATRIBUICAO] Salvando com habilitarFinaisSemana:', habilitarFinaisSemana, 'tipo:', typeof habilitarFinaisSemana);
      console.log('💾 [ATRIBUICAO] Salvando com habilitarFeriados:', habilitarFeriados, 'tipo:', typeof habilitarFeriados);
      console.log('💾 [ATRIBUICAO] Período:', dataInicio, 'até', dataFim);
      console.log('💾 [ATRIBUICAO] Dados completos para salvar:', JSON.stringify(dadosParaSalvar, null, 2));

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
        navigate('/atribuir-responsaveis');
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
                  {/* 1. Responsável */}
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
                          setClienteSelecionado(clienteId || null);
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

                  {/* 2. Cliente */}
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

                  {/* 3. Produtos */}
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

                  {/* 4. Período */}
                  <div className="form-group">
                    <label className="form-label-small">
                      <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                      4. Período
                    </label>
                    <FilterPeriodo
                      dataInicio={dataInicio}
                      dataFim={dataFim}
                      onInicioChange={(e) => setDataInicio(e.target.value || null)}
                      onFimChange={(e) => setDataFim(e.target.value || null)}
                      disabled={loading || submitting || !responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0}
                      showWeekendToggle={true}
                      onWeekendToggleChange={setHabilitarFinaisSemana}
                      showHolidayToggle={true}
                      onHolidayToggleChange={setHabilitarFeriados}
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
                </div>

                {/* Seção: Tarefas (usando SelecaoTarefasPorProduto) */}
                {clienteSelecionado && produtosSelecionados.length > 0 && (
                  <div className="atribuicao-form-section atribuicao-tarefas-section">
                    <h3 className="atribuicao-form-section-title">
                      <i className="fas fa-tasks"></i>
                      Tarefas e Tempo Estimado
                      {horasContratadasDia && (
                        <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>
                          (Total disponível: {horasContratadasDia}h/dia)
                        </span>
                      )}
                    </h3>
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
                          tempoEstimadoDia={tempoEstimadoDia}
                          onTempoChange={(produtoId, tarefaId, tempoEmMs) => {
                            handleTempoTarefaChange(produtoId, tarefaId, tempoEmMs);
                          }}
                          disabledTempo={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
                          horasContratadasDia={horasContratadasDia}
                          tarefasSelecionadas={tarefasSelecionadas}
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
                                    disabled={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
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
                                    disabled={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
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
                                    disabled={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
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
                      {horasContratadasDia && tarefasSelecionadasPorProduto && Object.keys(tarefasSelecionadasPorProduto).length > 0 && !erroTempoEstimado && (() => {
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
                              <i className="fas fa-check-circle" style={{ marginRight: '6px', color: totalHorasPorDia > horasContratadasDia ? '#f59e0b' : '#10b981' }}></i>
                              Tempo total por dia: {totalHorasPorDia.toFixed(2)}h de {horasContratadasDia}h disponíveis
                              {totalHorasPorDia > horasContratadasDia && (
                                <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                                  (Ultrapassando em {(totalHorasPorDia - horasContratadasDia).toFixed(2)}h)
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
                  disabled={loading || submitting || !responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0 || tarefasSelecionadas.length === 0 || !dataInicio || !dataFim || verificandoDuplicata || (() => {
                    // Verificar se há tarefas sem tempo considerando produto x tarefa
                    if (!tarefasSelecionadasPorProduto || Object.keys(tarefasSelecionadasPorProduto).length === 0) {
                      return true;
                    }
                    for (const [produtoId, tarefasDoProduto] of Object.entries(tarefasSelecionadasPorProduto)) {
                      for (const [tarefaId, dadosTarefa] of Object.entries(tarefasDoProduto)) {
                        if (dadosTarefa.selecionada === true) {
                          if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId)) {
                            if (!tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0) {
                              return true;
                            }
                          } else {
                            const tempo = getTempoEstimado(produtoId, tarefaId);
                            if (!tempo || tempo <= 0) {
                              return true;
                            }
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

