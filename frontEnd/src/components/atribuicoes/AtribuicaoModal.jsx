import React, { useState, useEffect, useCallback } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import SelectedItemsList from '../vinculacoes/SelectedItemsList';
import FilterPeriodo from '../filters/FilterPeriodo';
import TempoEstimadoInput from '../common/TempoEstimadoInput';
import ToggleSwitch from '../common/ToggleSwitch';
import SelecaoTarefasPorProduto from '../clients/SelecaoTarefasPorProduto';
import { useToast } from '../../hooks/useToast';
import { clientesAPI, colaboradoresAPI, cacheAPI } from '../../services/api';
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
  const [tarefasSelecionadasPorProduto, setTarefasSelecionadasPorProduto] = useState({}); // { produtoId: { tarefaId: { selecionada, subtarefas, tipoTarefa } } }
  const [refreshTarefas, setRefreshTarefas] = useState(0); // Contador para forçar recarregamento
  const [expandedSelects, setExpandedSelects] = useState({});

  // Estados de período e responsável
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [tempoEstimadoDia, setTempoEstimadoDia] = useState({}); // Objeto: { tarefaId: tempoEmMs }
  const [tempoGlobalParaAplicar, setTempoGlobalParaAplicar] = useState(0); // Tempo para aplicar em múltiplas tarefas
  const [tarefasSelecionadasParaTempo, setTarefasSelecionadasParaTempo] = useState(new Set()); // IDs das tarefas selecionadas para aplicar tempo
  const [modoSelecionarVarios, setModoSelecionarVarios] = useState(false); // Toggle para modo "selecionar vários"
  const [colaboradores, setColaboradores] = useState([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(null);
  const [horasContratadasDia, setHorasContratadasDia] = useState(null);
  const [erroTempoEstimado, setErroTempoEstimado] = useState(null);
  const [erroDuplicata, setErroDuplicata] = useState(null);
  const [verificandoDuplicata, setVerificandoDuplicata] = useState(false);

  // Estados dos filtros de datas (exceções e flags)
  const [datasIndividuais, setDatasIndividuais] = useState([]); // List of exception dates when a range is selected
  const [incluirFinaisSemana, setIncluirFinaisSemana] = useState(false);
  const [incluirFeriados, setIncluirFeriados] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      // Limpar cache de colaboradores para garantir dados atualizados (especialmente status)
      cacheAPI.remove('api_cache_colaboradores_all');
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
      // Desabilitar cache para garantir dados atualizados (especialmente status de membros)
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

          // Criar objeto de tempos por tarefa
          const temposPorTarefa = {};
          registros.forEach(reg => {
            const tarefaId = String(reg.tarefa_id);
            if (!temposPorTarefa[tarefaId]) {
              temposPorTarefa[tarefaId] = reg.tempo_estimado_dia || 0;
            }
          });
          setTempoEstimadoDia(temposPorTarefa);
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
    setTempoEstimadoDia({});
    setTempoGlobalParaAplicar(0);
    setTarefasSelecionadasParaTempo(new Set());
    setModoSelecionarVarios(false);
    setResponsavelSelecionado(null);
    setProdutos([]);
    setTarefas([]);
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setHorasContratadasDia(null);
    setErroTempoEstimado(null);
    setErroDuplicata(null);
    setDatasIndividuais([]);
    setIncluirFinaisSemana(false);
    setIncluirFeriados(false);
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
    if (horasContratadasDia && tarefasSelecionadas.length > 0) {
      // Somar todos os tempos individuais das tarefas
      const totalTempoMs = tarefasSelecionadas.reduce((acc, tarefaId) => {
        return acc + (tempoEstimadoDia[tarefaId] || 0);
      }, 0);

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
  }, [tempoEstimadoDia, horasContratadasDia, tarefasSelecionadas]);

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

  // Carregar produtos vazios quando modal abre (para mostrar campo disabled)
  useEffect(() => {
    if (isOpen && !clienteSelecionado) {
      setProdutos([]);
    }
  }, [isOpen, clienteSelecionado]);

  const loadProdutosPorCliente = async (clienteId) => {
    console.log('🔄 [AtribuicaoModal] Carregando produtos para cliente:', clienteId);
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

          console.log('📦 [AtribuicaoModal] Produtos com vínculos (sem cliente):', vinculadosComProduto.length);

          // Extrair IDs únicos dos produtos que têm vínculos
          produtosComVinculosIds = [...new Set(
            vinculadosComProduto
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];

          console.log('📦 [AtribuicaoModal] IDs únicos de produtos com vínculos:', produtosComVinculosIds);

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
                  console.log('✅ [AtribuicaoModal] Produtos com nomes carregados:', produtosComVinculosComNomes.length);
                }
              }
            } catch (error) {
              console.error('❌ [AtribuicaoModal] Erro ao buscar nomes dos produtos:', error);
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

          console.log('🔗 [AtribuicaoModal] Vinculados do cliente:', vinculadosDoCliente.length);

          // Extrair IDs únicos dos produtos já vinculados ao cliente
          produtosVinculadosAoClienteIds = [...new Set(
            vinculadosDoCliente
              .map(v => parseInt(v.cp_produto, 10))
              .filter(id => !isNaN(id))
          )];

          console.log('🔗 [AtribuicaoModal] IDs de produtos vinculados ao cliente:', produtosVinculadosAoClienteIds);

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
              console.error('❌ [AtribuicaoModal] Erro ao buscar nomes dos produtos vinculados ao cliente:', error);
            }
          }
        }
      }

      console.log('📋 [AtribuicaoModal] Total de produtos disponíveis:', produtosComVinculosComNomes.length);
      console.log('📋 [AtribuicaoModal] Produtos disponíveis:', produtosComVinculosComNomes);

      // Mostrar apenas produtos que têm vínculos (produtosComVinculosComNomes)
      // Mas garantir que produtos já vinculados ao cliente também apareçam
      setProdutos(produtosComVinculosComNomes);

      // Pré-selecionar produtos já vinculados ao cliente (para permitir edição/remoção)
      if (produtosVinculadosAoClienteIds.length > 0) {
        const produtosIdsStr = produtosVinculadosAoClienteIds.map(id => String(id));
        console.log('✅ [AtribuicaoModal] Pré-selecionando produtos:', produtosIdsStr);
        setProdutosSelecionados(produtosIdsStr);
        // Quando produtos são pré-selecionados, carregar tarefas automaticamente
        await loadTarefasPorClienteEProdutos(clienteId, produtosIdsStr);
      } else {
        console.log('ℹ️ [AtribuicaoModal] Nenhum produto vinculado ao cliente, limpando seleção');
        setProdutosSelecionados([]);
      }
    } catch (error) {
      console.error('❌ [AtribuicaoModal] Erro ao carregar produtos:', error);
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

  // Inicializar tempos quando tarefas são selecionadas (apenas para novas tarefas)
  useEffect(() => {
    if (tarefasSelecionadas.length > 0 && !editingAgrupamento) {
      const novosTempos = { ...tempoEstimadoDia };
      let mudou = false;
      tarefasSelecionadas.forEach(tarefaId => {
        if (!novosTempos[tarefaId] || novosTempos[tarefaId] <= 0) {
          // Inicializar com 0 se não tiver tempo definido
          novosTempos[tarefaId] = 0;
          mudou = true;
        }
      });
      // Remover tempos de tarefas que não estão mais selecionadas
      Object.keys(novosTempos).forEach(tarefaId => {
        if (!tarefasSelecionadas.includes(tarefaId)) {
          delete novosTempos[tarefaId];
          mudou = true;
        }
      });
      if (mudou) {
        setTempoEstimadoDia(novosTempos);
      }
    }
  }, [tarefasSelecionadas, editingAgrupamento]);

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

          // Inicializar tempos apenas para novas tarefas (não sobrescrever se já existir)
          if (!editingAgrupamento) {
            setTempoEstimadoDia(prev => {
              const novosTempos = { ...prev };
              novasTarefasSelecionadas.forEach(tarefaId => {
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
    // Remover tempo da tarefa removida
    const novosTempos = { ...tempoEstimadoDia };
    delete novosTempos[tarefaId];
    setTempoEstimadoDia(novosTempos);
    // Remover da seleção de tempo
    const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
    novasSelecionadas.delete(tarefaId);
    setTarefasSelecionadasParaTempo(novasSelecionadas);
  };

  // Atualizar tempo individual de uma tarefa
  const handleTempoTarefaChange = (tarefaId, tempo) => {
    setTempoEstimadoDia(prev => ({
      ...prev,
      [tarefaId]: tempo
    }));
  };

  // Toggle seleção de tarefa para aplicar tempo
  const handleToggleTarefaSelecionada = (tarefaId) => {
    const novasSelecionadas = new Set(tarefasSelecionadasParaTempo);
    if (novasSelecionadas.has(tarefaId)) {
      novasSelecionadas.delete(tarefaId);
    } else {
      novasSelecionadas.add(tarefaId);
    }
    setTarefasSelecionadasParaTempo(novasSelecionadas);
  };

  // Selecionar todas as tarefas para aplicar tempo
  const handleSelectAllTarefasParaTempo = () => {
    if (tarefasSelecionadasParaTempo.size === tarefas.length) {
      setTarefasSelecionadasParaTempo(new Set());
    } else {
      // Selecionar todas as tarefas que estão na lista (não apenas as selecionadas)
      setTarefasSelecionadasParaTempo(new Set(tarefas.map(t => String(t.id))));
    }
  };

  // Aplicar tempo global automaticamente quando uma tarefa é selecionada via checkbox
  useEffect(() => {
    if (modoSelecionarVarios && tempoGlobalParaAplicar > 0) {
      const novosTempos = { ...tempoEstimadoDia };
      tarefasSelecionadasParaTempo.forEach(tarefaId => {
        novosTempos[tarefaId] = tempoGlobalParaAplicar;
      });
      setTempoEstimadoDia(novosTempos);
    }
  }, [tarefasSelecionadasParaTempo, tempoGlobalParaAplicar, modoSelecionarVarios]);

  // Limpar seleções quando o modo "selecionar vários" é desativado
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

  return colaboradorId;
};

// Helper para gerar datas entre início e fim
const gerarDatasIntervalo = (inicioStr, fimStr) => {
  const datas = [];
  if (!inicioStr || !fimStr) return datas;

  // Usar datas com timezone UTC para evitar problemas de fuso horário
  // Adicionar T12:00:00 para garantir que pegamos o dia correto independente do timezone local
  const dataAtual = new Date(inicioStr + 'T12:00:00');
  const dataFim = new Date(fimStr + 'T12:00:00');

  // Garantir loop seguro
  const MAX_DAYS = 3660; // Max 10 anos
  let count = 0;

  while (dataAtual <= dataFim && count < MAX_DAYS) {
    const ano = dataAtual.getFullYear();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    datas.push(`${ano}-${mes}-${dia}`);

    dataAtual.setDate(dataAtual.getDate() + 1);
    count++;
  }
  return datas;
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

  // Verificar se todas as tarefas têm tempo estimado
  const tarefasSemTempo = tarefasSelecionadas.filter(tarefaId => {
    // Se está no modo "selecionar vários" e a tarefa está selecionada para tempo global
    if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId)) {
      // Verificar se o tempo global foi definido
      return !tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0;
    }
    // Caso contrário, verificar o tempo individual
    return !tempoEstimadoDia[tarefaId] || tempoEstimadoDia[tarefaId] <= 0;
  });

  if (tarefasSemTempo.length > 0) {
    if (modoSelecionarVarios && tarefasSelecionadasParaTempo.size > 0 && (!tempoGlobalParaAplicar || tempoGlobalParaAplicar <= 0)) {
      showToast('warning', 'Informe o tempo estimado no campo "Selecionar vários" para aplicar às tarefas selecionadas.');
    } else {
      showToast('warning', `Informe o tempo estimado para todas as tarefas. ${tarefasSemTempo.length} tarefa(s) sem tempo definido.`);
    }
    return;
  }

  // Avisar sobre duplicatas, mas permitir salvar se o usuário quiser
  if (erroDuplicata) {
    // Não bloquear, apenas avisar - o backend vai validar também
    console.warn('Aviso de duplicata:', erroDuplicata);
  }

  // Avisar se o tempo estimado ultrapassa as horas contratadas, mas permitir salvar se o usuário quiser
  if (horasContratadasDia && tarefasSelecionadas.length > 0) {
    const totalTempoMs = tarefasSelecionadas.reduce((acc, tarefaId) => {
      return acc + (tempoEstimadoDia[tarefaId] || 0);
    }, 0);
    const totalHorasPorDia = totalTempoMs / (1000 * 60 * 60);

    if (totalHorasPorDia > horasContratadasDia) {
      // Apenas avisar, não bloquear
      console.warn('Tempo estimado ultrapassa horas contratadas');
    }
  }

  setSubmitting(true);
  try {
    // Criar array de objetos com tarefa_id e tempo_estimado_dia
    // Se estiver no modo "selecionar vários" e a tarefa estiver selecionada para tempo global, usar o tempo global
    const tarefasComTempo = tarefasSelecionadas.map(tarefaId => {
      let tempo = tempoEstimadoDia[tarefaId] || 0;

      // Se está no modo "selecionar vários" e a tarefa está selecionada para tempo global, usar o tempo global
      if (modoSelecionarVarios && tarefasSelecionadasParaTempo.has(tarefaId) && tempoGlobalParaAplicar > 0) {
        tempo = tempoGlobalParaAplicar;
      }

      // Garantir que tempo seja um número inteiro
      const tempoInt = Math.round(Number(tempo));

      return {
        tarefa_id: String(tarefaId).trim(),
        tempo_estimado_dia: tempoInt
      };
    });

    // Processar datas individuais para enviar ao backend
    // Backend espera uma "Allowlist" em datas_individuais se fornecido
    // Então calculamos: [Todas as datas do range] - [Exceções marcadas com Ctrl+Click]
    let datasIndividuaisParaEnvio = undefined;
    let inicioEnvio = dataInicio;
    let fimEnvio = dataFim;

    if (dataInicio && dataFim && datasIndividuais.length > 0) {
      // Gerar todas as datas do período
      const todasDatas = gerarDatasIntervalo(dataInicio, dataFim);
      // Remover as exceções (datasIndividuais contém os dias clicados com Ctrl)
      const datasValidas = todasDatas.filter(d => !datasIndividuais.includes(d));

      if (datasValidas.length > 0) {
        datasIndividuaisParaEnvio = datasValidas;
        // IMPORTANTÍSSIMO: Anular inicio/fim para forçar o backend a usar apenas a lista de datas individuais
        inicioEnvio = undefined;
        fimEnvio = undefined;
      }
    }

    const dadosParaSalvar = {
      cliente_id: clienteSelecionado,
      produto_ids: produtosSelecionados.map(id => String(id)),
      tarefas: tarefasComTempo, // Array de objetos { tarefa_id, tempo_estimado_dia }
      data_inicio: inicioEnvio,
      data_fim: fimEnvio,
      responsavel_id: String(responsavelSelecionado),
      incluir_finais_semana: incluirFinaisSemana,
      incluir_feriados: incluirFeriados,
      datas_individuais: datasIndividuaisParaEnvio
    };

    // Debug: verificar dados antes de enviar
    console.log('📤 Dados para salvar:', JSON.stringify(dadosParaSalvar, null, 2));
    console.log('📋 Tarefas com tempo:', tarefasComTempo);

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
      console.error('❌ Erro na resposta:', result);
      console.error('❌ Status:', response.status);
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
        {/* Ordem: 1. Responsável, 2. Cliente, 3. Produtos, 4. Período, 5. Tarefas */}
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
                  setClienteSelecionado(null);
                  setProdutosSelecionados([]);
                  setTarefasSelecionadas([]);
                  setProdutos([]);
                  setTarefas([]);
                }}
                canRemove={true}
                isExpanded={false}
                onToggleExpand={() => { }}
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
                  setClienteSelecionado(null);
                  setProdutosSelecionados([]);
                  setTarefasSelecionadas([]);
                }}
                canRemove={true}
                isExpanded={false}
                onToggleExpand={() => { }}
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

              // Props para controle de exceções e flags
              datasIndividuais={datasIndividuais}
              onDatasIndividuaisChange={setDatasIndividuais}

              showWeekendToggle={true}
              habilitarFinaisSemana={incluirFinaisSemana}
              onWeekendToggleChange={setIncluirFinaisSemana}

              showHolidayToggle={true}
              habilitarFeriados={incluirFeriados}
              onHolidayToggleChange={setIncluirFeriados}
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

        {/* 5. Tarefas (usando SelecaoTarefasPorProduto - só aparece após período ser selecionado) */}
        {dataInicio && dataFim && clienteSelecionado && produtosSelecionados.length > 0 && (
          <div className="form-row-vigencia" style={{ marginTop: '20px' }}>
            <div className="form-group" style={{ width: '100%' }}>
              <label className="form-label-small" style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>
                <i className="fas fa-tasks" style={{ marginRight: '6px', flexShrink: 0 }}></i>
                <span style={{ whiteSpace: 'nowrap' }}>5. Tarefas</span>
                {horasContratadasDia && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6b7280', fontWeight: 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    (Total disponível: {horasContratadasDia}h/dia)
                  </span>
                )}
              </label>

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

              {/* Seção para definir tempo estimado por tarefa selecionada */}
              {tarefasSelecionadas.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <label className="form-label-small" style={{ marginBottom: '12px', display: 'block' }}>
                    <i className="fas fa-clock" style={{ marginRight: '6px' }}></i>
                    Tempo Estimado por Tarefa
                    {horasContratadasDia && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>
                        (Total disponível: {horasContratadasDia}h/dia)
                      </span>
                    )}
                  </label>
                  <div className="selected-items-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tarefasSelecionadas.map(tarefaId => {
                      const tarefa = tarefas.find(t => String(t.id) === tarefaId);
                      if (!tarefa) return null;

                      return (
                        <div
                          key={tarefaId}
                          className="selected-item-tag"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            justifyContent: 'space-between',
                            padding: '8px 12px'
                          }}
                        >
                          <span style={{ flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tarefa.nome}
                          </span>
                          <TempoEstimadoInput
                            value={tempoEstimadoDia[tarefaId] || 0}
                            onChange={(novoTempo) => handleTempoTarefaChange(tarefaId, novoTempo)}
                            disabled={loading || submitting || !responsavelSelecionado || !dataInicio || !dataFim}
                            style={{ flexShrink: 0 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botão de salvar */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !responsavelSelecionado || !clienteSelecionado || produtosSelecionados.length === 0 ||
              !dataInicio || !dataFim || tarefasSelecionadas.length === 0 ||
              tarefasSelecionadas.some(tarefaId => {
                return !tempoEstimadoDia[tarefaId] || tempoEstimadoDia[tarefaId] <= 0;
              })}
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
  </div>
);
};

export default AtribuicaoModal;


