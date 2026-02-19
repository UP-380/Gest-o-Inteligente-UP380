import React, { useState, useEffect, useRef, useMemo } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import ResponsavelCard from '../atribuicoes/ResponsavelCard';
import TempoEstimadoInput from '../common/TempoEstimadoInput';
import FilterPeriodo from '../filters/FilterPeriodo';
import './SelecaoTarefasPorProduto.css';

const API_BASE_URL = '/api';

/**
 * Componente para selecionar tarefas por produto ao vincular produto ao cliente
 * Permite adicionar/remover tarefas específicas para cada produto
 * 
 * @param {boolean} showTempoEstimado - Se true, mostra campos de tempo estimado ao lado de cada tarefa
 * @param {object} tempoEstimadoDia - Objeto { tarefaId: tempoEmMs } com os tempos estimados
 * @param {function} onTempoChange - Callback (produtoId, tarefaId, tempoEmMs) quando o tempo muda
 * @param {boolean} disabledTempo - Se true, desabilita os campos de tempo
 * @param {number} horasContratadasDia - Total de horas contratadas por dia do responsável
 * @param {array} tarefasSelecionadas - Array de IDs das tarefas selecionadas
 * @param {boolean} showSubtarefas - Se true, mostra botão e funcionalidade de subtarefas (padrão: true)
 */
const SelecaoTarefasPorProduto = ({
  clienteId,
  produtos,
  onTarefasChange,
  refreshKey = 0, // Key para forçar recarregamento
  showTempoEstimado = false, // Nova prop: mostrar campos de tempo estimado
  tempoEstimadoDia = {}, // Nova prop: tempos estimados por tarefa
  onTempoChange = null, // Nova prop: callback quando tempo muda
  disabledTempo = false, // Nova prop: desabilitar campos de tempo
  horasContratadasDia = null, // Nova prop: horas contratadas por dia
  tarefasSelecionadas = [], // Nova prop: tarefas selecionadas
  showSubtarefas = true, // Nova prop: mostrar subtarefas (padrão: true para manter compatibilidade)
  // Período por tarefa e modo em lote
  periodosPorTarefa = {},
  onPeriodoChange = null,
  modoPeriodoParaMuitos = false,
  filterPeriodoUiVariant,
  // Responsáveis por tarefa
  responsaveisPorTarefa = {},
  onResponsavelChange = null,
  colaboradores = [],
  // Ordem de preenchimento e tempo disponível
  ordemPreenchimento = null, // { podePreencherResponsavel: (produtoId, tarefaId) => boolean, podePreencherTempo: (produtoId, tarefaId) => boolean }
  horasContratadasPorResponsavel = {}, // { responsavelId: horas }
  calcularTempoDisponivel = null, // função para calcular tempo disponível
  formatarTempoEstimado = null, // função para formatar tempo
  tarefasSelecionadasPorProduto = null, // objeto com todas as tarefas selecionadas para cálculo de tempo disponível
  initialTarefas = null // Nova prop: tarefas iniciais para carregar (evita fetch automático)
}) => {
  const [tarefasPorProduto, setTarefasPorProduto] = useState({}); // { produtoId: [{ id, nome, selecionada }] }
  const tarefasPorProdutoRef = useRef({}); // Referência para acessar o estado atualizado
  const [loading, setLoading] = useState(false);
  const [expandedProdutos, setExpandedProdutos] = useState({});
  const [mostrarAdicionarTarefa, setMostrarAdicionarTarefa] = useState({}); // { produtoId: boolean }
  const [tarefasDisponiveis, setTarefasDisponiveis] = useState([]); // Todas as tarefas disponíveis
  const [tarefasComTipos, setTarefasComTipos] = useState([]); // Tarefas agrupadas por tipo para o CustomSelect
  const [tiposTarefa, setTiposTarefa] = useState([]); // Tipos de tarefa
  const [carregandoTarefas, setCarregandoTarefas] = useState(false);
  const [subtarefasPorTarefa, setSubtarefasPorTarefa] = useState({}); // { tarefaId: [{ id, nome, selecionada }] } - subtarefas de cada tarefa
  const [carregandoSubtarefas, setCarregandoSubtarefas] = useState({}); // { tarefaId: boolean } - estado de carregamento de subtarefas
  const [tarefasExpandidas, setTarefasExpandidas] = useState({}); // { tarefaId: boolean } - quais tarefas estão expandidas para mostrar subtarefas
  const [tarefaSelecionadaParaAdicionar, setTarefaSelecionadaParaAdicionar] = useState({}); // { produtoId: string } - Valor do CustomSelect para adicionar tarefa por produto
  // Função auxiliar para buscar responsáveis de uma tarefa
  const getResponsavelTarefa = (pId, tId) => {
    const key = `${String(pId).trim()}_${String(tId).trim()}`;
    const resps = responsaveisPorTarefa[key];
    return Array.isArray(resps) ? resps : [];
  };

  // Normalizar horas contratadas por dia para evitar renderizar objeto no JSX
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

  // Carregar tarefas dos produtos quando produtos mudarem ou refreshKey mudar
  useEffect(() => {
    // Se foram fornecidas tarefas iniciais, usar elas direto e não buscar na API
    // Modificado: Mesmo se houver initialTarefas (Edição), DEVEMOS buscar todas as tarefas na API
    // para mostrar o "menu completo". As initialTarefas serão usadas para determinar quais itens
    // vêm marcados (checked=true) dentro do loadTarefasPorProdutos via lógica de mesclagem.

    if (produtos && produtos.length > 0) {
      loadTarefasPorProdutos();
    } else {
      setTarefasPorProduto({});
    }


    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(produtos), refreshKey, initialTarefas]);

  // Atualizar referência sempre que o estado mudar
  useEffect(() => {
    tarefasPorProdutoRef.current = tarefasPorProduto;
  }, [tarefasPorProduto]);


  const loadTarefasPorProdutos = async () => {
    if (!produtos || produtos.length === 0) return;

    setLoading(true);
    try {
      const produtoIds = produtos.map(p => {
        const produtoId = typeof p === 'object' ? p.id : p;
        return parseInt(produtoId, 10);
      }).filter(id => !isNaN(id) && id > 0);

      if (produtoIds.length === 0) {
        setTarefasPorProduto({});
        setLoading(false);
        return;
      }

      // Buscar tarefas dos produtos para este cliente específico
      // Usar a API que considera o cliente (herança híbrida)
      const url = clienteId
        ? `${API_BASE_URL}/tarefas-por-cliente-produtos?clienteId=${clienteId}&produtoIds=${produtoIds.join(',')}`
        : `${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoIds.join(',')}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📦 Resposta da API tarefas-por-cliente-produtos:', result);

        if (result.success && result.data) {
          // Inicializar tarefas por produto
          const novasTarefasPorProduto = {};

          result.data.forEach(item => {
            const produtoId = item.produtoId;
            // A API retorna tarefas com estrutura: { id, nome, tipoTarefa, subtarefas, subtarefasVinculadasCliente, ehExcecao, estaVinculadaAoCliente }

            novasTarefasPorProduto[produtoId] = (item.tarefas || []).map(tarefa => {
              const estaVinculadaAoCliente = tarefa.estaVinculadaAoCliente === true;
              const ehExcecao = tarefa.ehExcecao === true;
              const temSubtarefasVinculadas = tarefa.subtarefasVinculadasCliente && tarefa.subtarefasVinculadasCliente.length > 0;

              let selecionada;
              let subtarefasSelecionadas = [];

              if (initialTarefas) {
                // MODO EDIÇÃO: A verdade absoluta é o que veio do initialTarefas (o que está salvo no banco)
                // Não usar lógica de "estaVinculadaAoCliente" aqui.
                const tarefasSalvasDoProduto = initialTarefas[produtoId] || initialTarefas[String(produtoId)] || [];
                const tarefaSalva = tarefasSalvasDoProduto.find(t => String(t.id) === String(tarefa.id));

                if (tarefaSalva) {
                  selecionada = true;
                  // Se a tarefa salva tiver informação de subtarefas, usar ela. 
                  // Caso contrário, assumir que todas vinculadas devem vir (ou vazio, dependendo da implementação do loadDadosEdicao)
                  // No momento AtribuicaoCliente passa arrays vazios, então talvez devêssemos manter o que vem do banco se possível
                  // Mas o prompt foca na seleção da TAREFA.
                  subtarefasSelecionadas = tarefa.subtarefasVinculadasCliente || [];
                } else {
                  selecionada = false;
                  subtarefasSelecionadas = [];
                }
              } else {
                // MODO NOVA ATRIBUIÇÃO (Manter comportamento original)
                // Marcar como selecionada se está vinculada ao cliente OU tem subtarefas vinculadas
                selecionada = estaVinculadaAoCliente || temSubtarefasVinculadas;
                subtarefasSelecionadas = tarefa.subtarefasVinculadasCliente || [];
              }

              return {
                id: tarefa.id,
                nome: tarefa.nome,
                tipoTarefa: tarefa.tipoTarefa || null,
                subtarefas: tarefa.subtarefas || [],
                subtarefasVinculadasCliente: tarefa.subtarefasVinculadasCliente || [], // IDs das subtarefas já vinculadas ao cliente
                subtarefasSelecionadas: subtarefasSelecionadas,
                selecionada: selecionada,
                ehExcecao: ehExcecao // Marcar se é exceção (já gravada para o cliente)
              };
            });
          });

          // Garantir que todos os produtos selecionados apareçam, mesmo sem tarefas
          produtoIds.forEach(produtoId => {
            if (!novasTarefasPorProduto[produtoId]) {
              novasTarefasPorProduto[produtoId] = [];
            }
          });

          console.log('✅ Tarefas processadas por produto:', novasTarefasPorProduto);
          // Log detalhado para debug
          Object.entries(novasTarefasPorProduto).forEach(([produtoId, tarefas]) => {
            tarefas.forEach(tarefa => {
              if (tarefa.subtarefasVinculadasCliente && tarefa.subtarefasVinculadasCliente.length > 0) {
                console.log(`📌 Tarefa ${tarefa.id} (${tarefa.nome}) tem ${tarefa.subtarefasVinculadasCliente.length} subtarefa(s) vinculada(s):`, tarefa.subtarefasVinculadasCliente);
              }
            });
          });
          tarefasPorProdutoRef.current = novasTarefasPorProduto; // Atualizar referência
          setTarefasPorProduto(novasTarefasPorProduto);

          // Notificar componente pai sobre as tarefas iniciais
          if (onTarefasChange) {
            onTarefasChange(novasTarefasPorProduto);
          }
        } else {
          console.warn('⚠️ Resposta sem dados ou sem sucesso:', result);
          // Se não há dados, inicializar com arrays vazios para cada produto
          const novasTarefasPorProduto = {};
          produtoIds.forEach(produtoId => {
            novasTarefasPorProduto[produtoId] = [];
          });
          setTarefasPorProduto(novasTarefasPorProduto);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro na resposta da API:', response.status, errorData);
        // Em caso de erro, inicializar com arrays vazios
        const novasTarefasPorProduto = {};
        produtoIds.forEach(produtoId => {
          novasTarefasPorProduto[produtoId] = [];
        });
        setTarefasPorProduto(novasTarefasPorProduto);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas dos produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle seleção de tarefa
  const toggleTarefa = (produtoId, tarefaId) => {
    setTarefasPorProduto(prev => {
      const novasTarefas = { ...prev };

      if (!novasTarefas[produtoId]) {
        novasTarefas[produtoId] = [];
      }

      const tarefaIndex = novasTarefas[produtoId].findIndex(t => t.id === tarefaId);

      if (tarefaIndex >= 0) {
        // Tarefa existe, toggle seleção
        novasTarefas[produtoId][tarefaIndex] = {
          ...novasTarefas[produtoId][tarefaIndex],
          selecionada: !novasTarefas[produtoId][tarefaIndex].selecionada
        };
      }

      // Notificar componente pai
      if (onTarefasChange) {
        onTarefasChange(novasTarefas);
      }

      return novasTarefas;
    });
  };

  // Selecionar todas as tarefas de um produto
  const selecionarTodasTarefas = (produtoId) => {
    setTarefasPorProduto(prev => {
      const novasTarefas = { ...prev };

      if (novasTarefas[produtoId]) {
        novasTarefas[produtoId] = novasTarefas[produtoId].map(t => ({
          ...t,
          selecionada: true
        }));
      }

      if (onTarefasChange) {
        onTarefasChange(novasTarefas);
      }

      return novasTarefas;
    });
  };

  // Desselecionar todas as tarefas de um produto
  const desselecionarTodasTarefas = (produtoId) => {
    setTarefasPorProduto(prev => {
      const novasTarefas = { ...prev };

      if (novasTarefas[produtoId]) {
        novasTarefas[produtoId] = novasTarefas[produtoId].map(t => ({
          ...t,
          selecionada: false
        }));
      }

      if (onTarefasChange) {
        onTarefasChange(novasTarefas);
      }

      return novasTarefas;
    });
  };

  // Obter nome do produto
  const getProdutoNome = (produtoId) => {
    const produto = produtos.find(p => {
      const pId = typeof p === 'object' ? p.id : p;
      return parseInt(pId, 10) === parseInt(produtoId, 10);
    });

    if (typeof produto === 'object' && produto.nome) {
      return produto.nome;
    }
    return `Produto #${produtoId}`;
  };

  // Carregar todas as tarefas disponíveis com tipos
  const loadTarefasDisponiveis = async () => {
    if (tarefasComTipos.length > 0) return;

    setCarregandoTarefas(true);
    try {
      // Carregar tipos de tarefa
      const responseTipos = await fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      let tipos = [];
      if (responseTipos.ok) {
        const resultTipos = await responseTipos.json();
        if (resultTipos.success && resultTipos.data) {
          tipos = resultTipos.data;
          setTiposTarefa(tipos);
        }
      }

      // Carregar tarefas
      const responseTarefas = await fetch(`${API_BASE_URL}/tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      let tarefas = [];
      if (responseTarefas.ok) {
        const resultTarefas = await responseTarefas.json();
        if (resultTarefas.success && resultTarefas.data) {
          tarefas = resultTarefas.data;
          setTarefasDisponiveis(tarefas);
        }
      }

      // Buscar vinculados para obter tarefas com tipos
      const responseVinculados = await fetch(`${API_BASE_URL}/vinculados?filtro_tipo_atividade=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      const tarefasComTiposMap = new Map();

      if (responseVinculados.ok) {
        const resultVinculados = await responseVinculados.json();
        if (resultVinculados.success && resultVinculados.data) {
          // Filtrar apenas vinculados que têm tarefa e tipo de tarefa, mas não têm produto nem cliente
          const vinculadosTarefaTipo = resultVinculados.data.filter(v => {
            return v.cp_tarefa && v.cp_tarefa_tipo && !v.cp_produto && !v.cp_cliente && !v.cp_subtarefa;
          });

          // Extrair tarefas únicas com seus tipos
          vinculadosTarefaTipo.forEach(v => {
            const tarefaId = parseInt(v.cp_tarefa, 10);
            const tipoTarefaId = parseInt(v.cp_tarefa_tipo, 10);
            const key = `${tarefaId}-${tipoTarefaId}`;

            if (!tarefasComTiposMap.has(key) && !isNaN(tarefaId) && !isNaN(tipoTarefaId)) {
              const tarefaNome = v.tarefa_nome || tarefas.find(t => t.id === tarefaId)?.nome || `Tarefa ${tarefaId}`;
              const tipoTarefaNome = v.tipo_tarefa_nome || tipos.find(t => t.id === tipoTarefaId)?.nome || `Tipo ${tipoTarefaId}`;

              tarefasComTiposMap.set(key, {
                tarefaId,
                tarefaNome,
                tipoTarefaId,
                tipoTarefaNome
              });
            }
          });
        }
      }

      // IMPORTANTE: Incluir APENAS tarefas que têm vínculo com tipo de tarefa (como na Seção 2)
      // Não incluir tarefas sem tipo vinculado
      if (tarefas.length > 0) {
        tarefas.forEach(tarefa => {
          const tipoTarefaId = tarefa.tipoatividade_id || tarefa.tipo_tarefa_id || null;
          if (tipoTarefaId) {
            const tipoTarefa = tipos.find(t => t.id === tipoTarefaId);
            if (tipoTarefa) {
              const key = `${tarefa.id}-${tipoTarefaId}`;
              if (!tarefasComTiposMap.has(key)) {
                tarefasComTiposMap.set(key, {
                  tarefaId: tarefa.id,
                  tarefaNome: tarefa.nome || tarefa.tarefa_nome || `Tarefa ${tarefa.id}`,
                  tipoTarefaId,
                  tipoTarefaNome: tipoTarefa.nome
                });
              }
            }
          }
          // IMPORTANTE: NÃO incluir tarefas sem tipo vinculado (removido o else que criava "Sem Tipo")
        });
      }

      const tarefasComTiposArray = Array.from(tarefasComTiposMap.values());
      console.log(`✅ [SelecaoTarefasPorProduto] Tarefas disponíveis carregadas: ${tarefasComTiposArray.length}`);
      setTarefasComTipos(tarefasComTiposArray);
    } catch (error) {
      console.error('Erro ao carregar tarefas disponíveis:', error);
    } finally {
      setCarregandoTarefas(false);
    }
  };

  // Adicionar nova tarefa como exceção (APENAS para este cliente, NÃO vincular ao produto)
  const adicionarTarefaExcecao = async (produtoId, tarefaId) => {
    if (!tarefaId || !clienteId) {
      console.warn('⚠️ Não é possível adicionar exceção sem clienteId');
      return;
    }

    // Buscar tarefa com tipo nas tarefasComTipos
    let tarefaComTipo = tarefasComTipos.find(tt => tt.tarefaId === tarefaId);

    // Se não encontrou nas tarefas com tipos, buscar nas tarefas disponíveis
    if (!tarefaComTipo) {
      const tarefa = tarefasDisponiveis.find(t => t.id === tarefaId);
      if (!tarefa) return;

      // Tentar encontrar o tipo da tarefa
      const tipoTarefaId = tarefa.tipoatividade_id || tarefa.tipo_tarefa_id || null;
      if (tipoTarefaId) {
        const tipoTarefa = tiposTarefa.find(t => t.id === tipoTarefaId);
        if (tipoTarefa) {
          tarefaComTipo = {
            tarefaId: tarefa.id,
            tarefaNome: tarefa.nome || tarefa.tarefa_nome || `Tarefa ${tarefa.id}`,
            tipoTarefaId,
            tipoTarefaNome: tipoTarefa.nome
          };
        }
      }
    }

    // Verificar se a tarefa já existe na lista
    const tarefasDoProduto = tarefasPorProduto[produtoId] || [];
    const existe = tarefasDoProduto.some(t => t.id === tarefaId);
    if (existe) {
      return;
    }

    try {
      // IMPORTANTE: NÃO criar vínculo Produto → Tarefa
      // A exceção deve ser APENAS Cliente → Produto → Tarefa
      // Isso garante que a tarefa seja vinculada ao produto SOMENTE para este cliente específico

      // Criar vínculo Cliente → Produto → Tarefa (exceção apenas para este cliente)
      const vinculadoClienteProdutoTarefa = {
        cp_cliente: String(clienteId).trim(),
        cp_produto: produtoId,
        cp_tarefa: tarefaId
      };

      // Adicionar tipo de tarefa se disponível
      if (tarefaComTipo && tarefaComTipo.tipoTarefaId) {
        vinculadoClienteProdutoTarefa.cp_tarefa_tipo = tarefaComTipo.tipoTarefaId;
      }

      console.log('🔗 Criando exceção (Cliente → Produto → Tarefa):', vinculadoClienteProdutoTarefa);

      const responseClienteProdutoTarefa = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vinculados: [vinculadoClienteProdutoTarefa]
        }),
      });

      if (!responseClienteProdutoTarefa.ok) {
        const errorText = await responseClienteProdutoTarefa.text();
        console.error('❌ Erro ao criar vínculo Cliente → Produto → Tarefa:', errorText);
        throw new Error('Erro ao criar exceção');
      }

      // 3. Adicionar na lista local
      setTarefasPorProduto(prev => {
        const novasTarefas = { ...prev };

        if (!novasTarefas[produtoId]) {
          novasTarefas[produtoId] = [];
        }

        // Adicionar como exceção (vinculada APENAS ao cliente para este produto, NÃO ao produto em geral)
        novasTarefas[produtoId].push({
          id: tarefaId,
          nome: tarefaComTipo ? tarefaComTipo.tarefaNome : (tarefasDisponiveis.find(t => t.id === tarefaId)?.nome || tarefasDisponiveis.find(t => t.id === tarefaId)?.tarefa_nome || `Tarefa #${tarefaId}`),
          tipoTarefa: tarefaComTipo ? {
            id: tarefaComTipo.tipoTarefaId,
            nome: tarefaComTipo.tipoTarefaNome
          } : null,
          subtarefas: [],
          subtarefasSelecionadas: [], // Inicializar subtarefas selecionadas
          selecionada: true,
          ehExcecao: true // É exceção: vinculada SOMENTE para este cliente+produto, não é padrão do produto
        });

        // Fechar o select
        setMostrarAdicionarTarefa(prev => ({ ...prev, [produtoId]: false }));

        // Notificar componente pai
        if (onTarefasChange) {
          onTarefasChange(novasTarefas);
        }

        return novasTarefas;
      });
    } catch (error) {
      console.error('Erro ao adicionar tarefa e criar vínculos:', error);
    }
  };

  // Obter tarefas disponíveis para adicionar (não estão no produto) formatadas para CustomSelect
  const getTarefasDisponiveisParaAdicionar = (produtoId) => {
    const tarefasDoProduto = tarefasPorProduto[produtoId] || [];
    const tarefasIdsDoProduto = new Set(tarefasDoProduto.map(t => t.id));

    // Filtrar tarefas que não estão no produto e formatar para CustomSelect
    return tarefasComTipos
      .filter(tt => !tarefasIdsDoProduto.has(tt.tarefaId))
      .map(tt => ({
        value: tt.tarefaId.toString(),
        label: `${tt.tarefaNome} (${tt.tipoTarefaNome})`,
        grupo: tt.tipoTarefaNome, // Para agrupamento visual
        tarefaId: tt.tarefaId,
        tipoTarefaId: tt.tipoTarefaId
      }))
      .sort((a, b) => {
        // Ordenar por tipo primeiro, depois por nome da tarefa
        if (a.grupo !== b.grupo) {
          return a.grupo.localeCompare(b.grupo);
        }
        return a.label.localeCompare(b.label);
      });
  };

  // Carregar subtarefas de uma tarefa específica
  const carregarSubtarefasTarefa = async (tarefaId, produtoId) => {
    // Se já está carregando, não fazer nada
    if (carregandoSubtarefas[tarefaId]) return;

    // Buscar informações da tarefa usando a referência (sempre atualizada)
    const tarefaInfo = tarefasPorProdutoRef.current[produtoId]?.find(t => t.id === tarefaId);
    const subtarefasVinculadasCliente = tarefaInfo?.subtarefasVinculadasCliente || [];

    // Verificar se já temos subtarefas carregadas
    const subtarefasJaCarregadas = subtarefasPorTarefa[tarefaId];

    // Se já temos subtarefas carregadas, verificar se estão sincronizadas
    if (subtarefasJaCarregadas) {
      const subtarefasSelecionadasAtuais = subtarefasJaCarregadas
        .filter(st => st.selecionada)
        .map(st => st.id)
        .sort((a, b) => a - b);

      // Converter subtarefasVinculadasCliente para números e ordenar para comparação
      const subtarefasVinculadasIds = subtarefasVinculadasCliente
        .map(id => {
          const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
          return isNaN(numId) ? null : numId;
        })
        .filter(id => id !== null)
        .sort((a, b) => a - b);

      // Verificar se estão sincronizadas (mesmo tamanho e mesmos IDs)
      const arraysIguais = subtarefasSelecionadasAtuais.length === subtarefasVinculadasIds.length &&
        subtarefasSelecionadasAtuais.every((id, index) => id === subtarefasVinculadasIds[index]);

      if (arraysIguais) {
        console.log(`✅ Subtarefas já carregadas e sincronizadas para tarefa ${tarefaId} (${subtarefasSelecionadasAtuais.length} subtarefa(s))`);
        return;
      }

      // Se não estão sincronizadas, forçar recarregamento
      console.log(`🔄 Subtarefas desincronizadas para tarefa ${tarefaId}:`, {
        atuais: subtarefasSelecionadasAtuais,
        vinculadas: subtarefasVinculadasIds,
        forçandoRecarregamento: true
      });
    }

    setCarregandoSubtarefas(prev => ({ ...prev, [tarefaId]: true }));

    try {
      // Garantir que estamos usando os dados mais atualizados da tarefa
      // Buscar novamente para garantir sincronização (caso tenha mudado entre a verificação e agora)
      const tarefaInfoAtualizada = tarefasPorProdutoRef.current[produtoId]?.find(t => t.id === tarefaId);
      const subtarefasVinculadasClienteAtualizadas = tarefaInfoAtualizada?.subtarefasVinculadasCliente || [];

      console.log(`📋 Carregando subtarefas para tarefa ${tarefaId} do produto ${produtoId}:`, {
        subtarefasVinculadasCliente: subtarefasVinculadasClienteAtualizadas,
        quantidadeSubtarefasVinculadas: subtarefasVinculadasClienteAtualizadas.length,
        tarefaInfo: tarefaInfoAtualizada ? {
          id: tarefaInfoAtualizada.id,
          nome: tarefaInfoAtualizada.nome,
          temSubtarefasVinculadas: !!tarefaInfoAtualizada.subtarefasVinculadasCliente,
          subtarefasVinculadasCliente: tarefaInfoAtualizada.subtarefasVinculadasCliente,
          subtarefasSelecionadas: tarefaInfoAtualizada.subtarefasSelecionadas || []
        } : null,
        debug: {
          produtoIdTipo: typeof produtoId,
          produtoIdValor: produtoId,
          tarefasNoProduto: tarefasPorProdutoRef.current[produtoId]?.length || 0
        }
      });

      const response = await fetch(`${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Usar subtarefasVinculadasClienteAtualizadas (dados mais recentes)
          // Converter subtarefasVinculadasCliente para números para comparação correta
          const subtarefasVinculadasIds = subtarefasVinculadasClienteAtualizadas.map(id => {
            const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
            return isNaN(numId) ? null : numId;
          }).filter(id => id !== null);

          console.log(`✅ Subtarefas recebidas da API (${result.data.length}):`, result.data.map(st => ({ id: st.id, nome: st.nome })));
          console.log(`✅ IDs de subtarefas vinculadas ao cliente (${subtarefasVinculadasIds.length}):`, subtarefasVinculadasIds);
          console.log(`🔍 Debug - Comparação:`, {
            subtarefasVinculadasClienteOriginal: subtarefasVinculadasCliente,
            subtarefasVinculadasClienteAtualizada: subtarefasVinculadasClienteAtualizadas,
            subtarefasVinculadasIds: subtarefasVinculadasIds,
            totalSubtarefas: result.data.length
          });

          // Inicializar subtarefas: marcar como selecionadas as que já estão vinculadas ao cliente
          const subtarefas = result.data.map(st => {
            const subtarefaId = typeof st.id === 'number' ? st.id : parseInt(String(st.id), 10);
            const estaSelecionada = subtarefasVinculadasIds.includes(subtarefaId);

            if (estaSelecionada) {
              console.log(`  ✅ Subtarefa ${subtarefaId} (${st.nome}): SELECIONADA`);
            } else {
              console.log(`  ⚪ Subtarefa ${subtarefaId} (${st.nome}): NÃO selecionada`);
            }

            return {
              id: subtarefaId,
              nome: st.nome,
              selecionada: estaSelecionada
            };
          });

          const subtarefasSelecionadasCount = subtarefas.filter(st => st.selecionada).length;
          console.log(`📝 Definindo ${subtarefasSelecionadasCount} subtarefa(s) como selecionada(s) de ${result.data.length} total`);

          if (subtarefasVinculadasIds.length > 0 && subtarefasSelecionadasCount === 0) {
            console.warn(`⚠️ ATENÇÃO: Há ${subtarefasVinculadasIds.length} subtarefa(s) vinculada(s) mas nenhuma foi marcada como selecionada!`, {
              subtarefasVinculadasIds,
              todasSubtarefas: subtarefas.map(st => st.id)
            });
          }

          setSubtarefasPorTarefa(prev => {
            const novoEstado = {
              ...prev,
              [tarefaId]: subtarefas
            };
            console.log(`💾 Estado de subtarefas atualizado para tarefa ${tarefaId}:`, {
              totalSubtarefas: subtarefas.length,
              selecionadas: subtarefas.filter(st => st.selecionada).length,
              idsSelecionadas: subtarefas.filter(st => st.selecionada).map(st => st.id)
            });
            return novoEstado;
          });

          // Notificar componente pai sobre as subtarefas já selecionadas
          if (onTarefasChange && subtarefasVinculadasIds.length > 0) {
            console.log(`📤 Notificando componente pai sobre ${subtarefasVinculadasIds.length} subtarefa(s) selecionada(s) para tarefa ${tarefaId}`);
            // Usar setTarefasPorProduto com callback para garantir sincronização com estado atualizado
            setTarefasPorProduto(prevTarefas => {
              const tarefasAtualizadas = { ...prevTarefas };
              // Normalizar produtoId para garantir consistência (pode ser string ou número)
              const produtoIdStr = String(produtoId);
              const produtoIdNum = typeof produtoId === 'number' ? produtoId : parseInt(produtoId, 10);

              // Tentar ambos os formatos (string e número) para garantir compatibilidade
              const produtoKey = tarefasAtualizadas[produtoIdStr] ? produtoIdStr :
                tarefasAtualizadas[produtoIdNum] ? produtoIdNum : null;

              if (produtoKey && tarefasAtualizadas[produtoKey]) {
                tarefasAtualizadas[produtoKey] = tarefasAtualizadas[produtoKey].map(t => {
                  if (t.id === tarefaId) {
                    return {
                      ...t,
                      subtarefasSelecionadas: subtarefasVinculadasIds
                    };
                  }
                  return t;
                });
                onTarefasChange(tarefasAtualizadas);
              }
              return tarefasAtualizadas;
            });
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar subtarefas da tarefa ${tarefaId}:`, error);
    } finally {
      setCarregandoSubtarefas(prev => ({ ...prev, [tarefaId]: false }));
    }
  };

  // Toggle subtarefa (selecionar/desselecionar)
  const toggleSubtarefa = (tarefaId, subtarefaId) => {
    setSubtarefasPorTarefa(prev => {
      const novasSubtarefas = { ...prev };
      if (!novasSubtarefas[tarefaId]) return novasSubtarefas;

      novasSubtarefas[tarefaId] = novasSubtarefas[tarefaId].map(st =>
        st.id === subtarefaId ? { ...st, selecionada: !st.selecionada } : st
      );

      // Notificar componente pai sobre mudanças
      if (onTarefasChange) {
        // Usar setTarefasPorProduto com callback para garantir estado atualizado
        // Isso preserva todas as tarefas de todos os produtos, não apenas a editada
        setTarefasPorProduto(prevTarefas => {
          const tarefasAtualizadas = { ...prevTarefas };

          // Iterar por TODOS os produtos para preservar todas as tarefas
          Object.keys(tarefasAtualizadas).forEach(produtoId => {
            if (tarefasAtualizadas[produtoId]) {
              tarefasAtualizadas[produtoId] = tarefasAtualizadas[produtoId].map(t => {
                if (t.id === tarefaId) {
                  // Atualizar apenas a tarefa editada, preservando outras propriedades
                  const subtarefasSelecionadas = novasSubtarefas[tarefaId]?.filter(st => st.selecionada).map(st => st.id) || [];
                  console.log(`🔄 toggleSubtarefa: Atualizando tarefa ${tarefaId} no produto ${produtoId}, ${subtarefasSelecionadas.length} subtarefa(s) selecionada(s)`, subtarefasSelecionadas);
                  return {
                    ...t, // Preservar todas as outras propriedades
                    subtarefasSelecionadas: subtarefasSelecionadas
                  };
                }
                // Preservar todas as outras tarefas sem modificação
                return t;
              });
            }
          });

          console.log(`📊 toggleSubtarefa: Preservando ${Object.keys(tarefasAtualizadas).length} produto(s) com todas as tarefas`);
          onTarefasChange(tarefasAtualizadas);
          return tarefasAtualizadas;
        });
      }

      return novasSubtarefas;
    });
  };

  if (!produtos || produtos.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
        <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
        Carregando tarefas dos produtos...
      </div>
    );
  }

  return (
    <div className="selecao-tarefas-produto">
      <div style={{
        fontWeight: '600',
        color: '#0e3b6f',
        marginBottom: '16px',
        fontSize: '14px',
        borderBottom: '1px solid #dee2e6',
        paddingBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
          Selecionar Tarefas por Produto
          <span style={{
            fontSize: '12px',
            fontWeight: '400',
            color: '#64748b',
            marginLeft: '8px'
          }}>
            (Marque as tarefas que este cliente deve ter para cada produto)
          </span>
          {showTempoEstimado && horasDisponiveisDia != null && (
            <span style={{
              marginLeft: '12px',
              fontSize: '11px',
              color: '#6b7280',
              fontWeight: 'normal'
            }}>
              (Total disponível: {horasDisponiveisDia}h/dia)
            </span>
          )}
        </div>
      </div>

      {produtos.map(produto => {
        const produtoId = typeof produto === 'object' ? produto.id : produto;
        const produtoIdNum = parseInt(produtoId, 10);
        const tarefas = tarefasPorProduto[produtoIdNum] || [];
        const tarefasSelecionadas = tarefas.filter(t => t.selecionada).length;
        const todasSelecionadas = tarefas.length > 0 && tarefasSelecionadas === tarefas.length;
        const isExpanded = expandedProdutos[produtoIdNum] || false;

        if (tarefas.length === 0) {
          return (
            <div key={produtoIdNum} style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>
                {getProdutoNome(produtoIdNum)}
              </div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>
                Nenhuma tarefa vinculada a este produto
              </div>
            </div>
          );
        }

        return (
          <div key={produtoIdNum} style={{
            marginBottom: '16px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {/* Header do Produto */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: isExpanded ? '1px solid #dee2e6' : 'none'
              }}
              onClick={() => setExpandedProdutos(prev => ({
                ...prev,
                [produtoIdNum]: !prev[produtoIdNum]
              }))}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '4px' }}>
                  {getProdutoNome(produtoIdNum)}
                </div>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  {tarefasSelecionadas} de {tarefas.length} tarefa(s) selecionada(s)
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await loadTarefasDisponiveis();
                    setMostrarAdicionarTarefa(prev => ({ ...prev, [produtoIdNum]: !prev[produtoIdNum] }));
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  title="Adicionar nova tarefa como exceção"
                >
                  <i className="fas fa-plus" style={{ fontSize: '12px' }}></i>
                  Adicionar Tarefa
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (todasSelecionadas) {
                      desselecionarTodasTarefas(produtoIdNum);
                    } else {
                      selecionarTodasTarefas(produtoIdNum);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  title={todasSelecionadas ? 'Desselecionar todas as tarefas' : 'Selecionar todas as tarefas'}
                >
                  <i className={`fas fa-${todasSelecionadas ? 'square' : 'check-square'}`} style={{ fontSize: '12px' }}></i>
                  {todasSelecionadas ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
                <i
                  className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}
                  style={{ color: '#6c757d', fontSize: '12px' }}
                ></i>
              </div>
            </div>

            {/* Select para adicionar tarefa */}
            {mostrarAdicionarTarefa[produtoIdNum] && (
              <div style={{
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #dee2e6'
              }}>
                <div style={{ marginBottom: '8px', fontSize: '12px', color: '#495057', fontWeight: '500' }}>
                  Adicionar nova tarefa como exceção (apenas para este cliente):
                </div>
                <div className="select-wrapper">
                  <CustomSelect
                    value={tarefaSelecionadaParaAdicionar[produtoIdNum] || ''}
                    options={getTarefasDisponiveisParaAdicionar(produtoIdNum)}
                    onChange={async (e) => {
                      const tarefaIdStr = e.target.value;
                      if (tarefaIdStr) {
                        const tarefaId = parseInt(tarefaIdStr, 10);
                        await adicionarTarefaExcecao(produtoIdNum, tarefaId);
                        // Resetar o select após adicionar
                        setTarefaSelecionadaParaAdicionar(prev => ({
                          ...prev,
                          [produtoIdNum]: ''
                        }));
                      }
                    }}
                    placeholder="Selecione uma tarefa (agrupadas por tipo)"
                    disabled={carregandoTarefas}
                    enableSearch={true}
                    onOpen={async () => {
                      if (tarefasComTipos.length === 0) {
                        await loadTarefasDisponiveis();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Lista de Tarefas */}
            {isExpanded && (
              <div style={{ padding: '12px', backgroundColor: '#fff' }}>
                {/* Separar tarefas normais e exceções, colocando exceções no final */}
                {(() => {
                  // Separar tarefas normais e exceções
                  const tarefasNormais = tarefas.filter(t => t.ehExcecao !== true);
                  const tarefasExcecao = tarefas.filter(t => t.ehExcecao === true);

                  return (
                    <>
                      {/* Subtítulo para tarefas padrão */}
                      {tarefasNormais.length > 0 && (
                        <div style={{
                          margin: '12px 0',
                          padding: '8px 0',
                          borderTop: '2px solid #e2e8f0',
                          borderBottom: '2px solid #e2e8f0'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Tarefas Padrão
                          </div>
                        </div>
                      )}

                      {/* Tarefas Normais */}
                      {tarefasNormais.map(tarefa => (
                        <div key={tarefa.id} style={{ marginBottom: '8px' }}>
                          <div
                            className="selected-item-tag"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'nowrap',
                              whiteSpace: 'nowrap',
                              padding: '8px 12px',
                              minHeight: '43px',
                              background: tarefa.selecionada
                                ? 'linear-gradient(135deg, #0e3b6f, #144577)'
                                : 'transparent',
                              color: tarefa.selecionada ? 'white' : '#212529',
                              border: tarefa.selecionada
                                ? 'none'
                                : '1px solid #dee2e6',
                              borderRadius: '4px',
                              cursor: 'default',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              width: '100%',
                              justifyContent: 'space-between',
                              boxShadow: tarefa.selecionada
                                ? '0 1px 3px rgba(14, 59, 111, 0.2)'
                                : 'none',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              if (tarefa.selecionada) {
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(14, 59, 111, 0.3)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              } else {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (tarefa.selecionada) {
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(14, 59, 111, 0.2)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              } else {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={tarefa.selecionada || false}
                                onChange={() => toggleTarefa(produtoIdNum, tarefa.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  margin: 0,
                                  marginRight: '4px',
                                  cursor: 'pointer',
                                  width: '14px',
                                  height: '14px',
                                  flexShrink: 0,
                                  pointerEvents: 'auto'
                                }}
                              />
                              {/* No modo "Período para muitos", o período global é aplicado automaticamente em todas as tarefas selecionadas.
                            Períodos específicos continuam podendo ser ajustados manualmente em cada tarefa. */}
                              <div style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{
                                  fontWeight: '500',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {tarefa.nome}
                                </div>
                                {tarefa.tipoTarefa && (
                                  <div style={{
                                    fontSize: '10px',
                                    opacity: tarefa.selecionada ? 0.8 : 0.6,
                                    marginTop: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    Tipo: {typeof tarefa.tipoTarefa === 'object' && tarefa.tipoTarefa !== null ? tarefa.tipoTarefa.nome : tarefa.tipoTarefa}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                              {/* Mini período por tarefa - mostrar apenas na versão de atribuição */}
                              {tarefa.selecionada && onPeriodoChange && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '4px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto',
                                    minWidth: '260px',
                                    flexShrink: 0
                                  }}
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                  onMouseUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                >
                                  <div style={{ width: '100%' }}>
                                    <FilterPeriodo
                                      dataInicio={(periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.inicio) || null}
                                      dataFim={(periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.fim) || null}
                                      onInicioChange={(e) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { inicio: e.target.value || null })}
                                      onFimChange={(e) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { fim: e.target.value || null })}
                                      size="small"
                                      uiVariant={filterPeriodoUiVariant}
                                      showWeekendToggle={true}
                                      onWeekendToggleChange={(v) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { habilitarFinaisSemana: !!v })}
                                      showHolidayToggle={true}
                                      onHolidayToggleChange={(v) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { habilitarFeriados: !!v })}
                                      datasIndividuais={periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.datasIndividuais || []}
                                      onDatasIndividuaisChange={(arr) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { datasIndividuais: Array.isArray(arr) ? arr : [] })}
                                    />
                                  </div>
                                </div>
                              )}
                              {/* Card de responsável - mostrar apenas quando tarefa estiver selecionada */}
                              {tarefa.selecionada && onResponsavelChange && colaboradores.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 10,
                                    flexShrink: 0
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div style={{ width: '117px', minWidth: '117px', maxWidth: '117px', flexShrink: 0 }}>
                                    <ResponsavelCard
                                      isMulti={true}
                                      selectedValues={getResponsavelTarefa(produtoIdNum, tarefa.id)}
                                      options={colaboradores.map(c => ({
                                        value: String(c.id),
                                        label: c.cpf ? `${c.nome} (${c.cpf})` : c.nome
                                      }))}
                                      onChange={(e) => {
                                        const responsaveisIds = e.target.value || [];
                                        if (onResponsavelChange) {
                                          onResponsavelChange(produtoIdNum, tarefa.id, responsaveisIds);
                                        }
                                      }}
                                      placeholder="Selecione responsáveis"
                                      disabled={disabledTempo || (ordemPreenchimento && !ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id))}
                                      colaboradores={colaboradores}
                                    />
                                  </div>
                                  {ordemPreenchimento && !ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && (
                                    <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000, whiteSpace: 'nowrap' }}>
                                      Preencha o período primeiro
                                    </div>
                                  )}
                                  {ordemPreenchimento && ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && getResponsavelTarefa(produtoIdNum, tarefa.id).length > 0 && calcularTempoDisponivel && formatarTempoEstimado && (() => {
                                    const periodo = periodosPorTarefa[`${produtoIdNum}_${tarefa.id}`] || null;
                                    const responsaveisTarefa = getResponsavelTarefa(produtoIdNum, tarefa.id);
                                    if (!periodo || responsaveisTarefa.length === 0) return null;
                                    const responsavelId = responsaveisTarefa[0];
                                    const temPeriodoCompleto = periodo.inicio && periodo.fim;
                                    const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
                                    if (!temPeriodoCompleto && !temDatasIndividuais) return null;

                                    // Usar tarefasSelecionadasPorProduto se fornecido, senão construir objeto mínimo
                                    const tarefasParaCalculo = tarefasSelecionadasPorProduto || { [produtoIdNum]: { [tarefa.id]: { selecionada: true } } };

                                    // Sempre incluir a tarefa atual no cálculo para mostrar o tempo disponível
                                    // após atribuir essa tarefa (se ela tiver tempo definido, será subtraída)
                                    // Não excluir a tarefa atual - queremos mostrar o tempo disponível real
                                    const tempoDisponivel = calcularTempoDisponivel(responsavelId, periodo, horasContratadasPorResponsavel, tempoEstimadoDia, tarefasParaCalculo, null);

                                    // Exibir sempre: positivo (azul), zero (azul com "0"), negativo (vermelho com "-")
                                    if (tempoDisponivel !== undefined && tempoDisponivel !== null) {
                                      const isExcedido = tempoDisponivel < 0;
                                      const isZero = tempoDisponivel === 0;

                                      return (
                                        <div
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: isExcedido ? '#fef2f2' : '#f0f9ff',
                                            border: `1px solid ${isExcedido ? '#ef4444' : '#0ea5e9'}`,
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: isExcedido ? '#991b1b' : '#0c4a6e',
                                            fontWeight: '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            whiteSpace: 'nowrap',
                                            boxSizing: 'border-box',
                                            cursor: 'help',
                                            position: 'relative'
                                          }}
                                          title={isExcedido ? "Tempo excedido" : "Disponível"}
                                        >
                                          <i className="fas fa-clock" style={{ fontSize: '10px', flexShrink: 0 }}></i>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {isExcedido ? `-${formatarTempoEstimado(Math.abs(tempoDisponivel), false)}` : formatarTempoEstimado(tempoDisponivel, false)}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                              {/* Campo de tempo estimado - mostrar apenas se showTempoEstimado=true e tarefa selecionada */}
                              {showTempoEstimado && tarefa.selecionada && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '4px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 10,
                                    minWidth: '140px'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div style={{ width: '100%' }}>
                                    <TempoEstimadoInput
                                      value={tempoEstimadoDia[`${String(produtoIdNum).trim()}_${String(tarefa.id).trim()}`] || tempoEstimadoDia[String(tarefa.id).trim()] || 0}
                                      onChange={(tempoEmMs) => {
                                        if (onTempoChange) {
                                          onTempoChange(produtoIdNum, tarefa.id, tempoEmMs);
                                        }
                                      }}
                                      disabled={disabledTempo || (ordemPreenchimento && !ordemPreenchimento.podePreencherTempo(produtoIdNum, tarefa.id))}
                                    />
                                  </div>
                                  {ordemPreenchimento && !ordemPreenchimento.podePreencherTempo(produtoIdNum, tarefa.id) && ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && (
                                    <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000, whiteSpace: 'nowrap' }}>
                                      Preencha o responsável primeiro
                                    </div>
                                  )}
                                  {ordemPreenchimento && !ordemPreenchimento.podePreencherTempo(produtoIdNum, tarefa.id) && !ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && (
                                    <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000, whiteSpace: 'nowrap' }}>
                                      Preencha o período primeiro
                                    </div>
                                  )}
                                </div>
                              )}
                              {tarefa.ehExcecao === true && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: tarefa.selecionada ? 'rgba(255, 255, 255, 0.2)' : '#fef3c7',
                                  color: tarefa.selecionada ? 'white' : '#92400e',
                                  borderRadius: '3px',
                                  fontWeight: '500',
                                  flexShrink: 0
                                }}>
                                  Exceção
                                </span>
                              )}
                              {/* Botão para ver subtarefas - mostrar apenas se showSubtarefas=true */}
                              {showSubtarefas && (tarefa.subtarefas?.length > 0 || subtarefasPorTarefa[tarefa.id]?.length > 0) && (
                                <button
                                  type="button"
                                  title="Ver subtarefas"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const temSubtarefas = subtarefasPorTarefa[tarefa.id]?.length > 0;
                                    if (!temSubtarefas && !carregandoSubtarefas[tarefa.id]) {
                                      carregarSubtarefasTarefa(tarefa.id, produtoIdNum);
                                    }
                                    setTarefasExpandidas(prev => ({
                                      ...prev,
                                      [tarefa.id]: !prev[tarefa.id]
                                    }));
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: '0.2s',
                                    background: tarefa.selecionada ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
                                    color: tarefa.selecionada ? 'white' : '#475569',
                                    border: tarefa.selecionada ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={(e) => {
                                    if (tarefa.selecionada) {
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                    } else {
                                      e.currentTarget.style.background = '#cbd5e1';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (tarefa.selecionada) {
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                    } else {
                                      e.currentTarget.style.background = '#e2e8f0';
                                    }
                                  }}
                                >
                                  {carregandoSubtarefas[tarefa.id] ? (
                                    <i className="fas fa-spinner fa-spin"></i>
                                  ) : (
                                    <>
                                      <i className="fas fa-list-ul"></i>
                                      Subtarefas {subtarefasPorTarefa[tarefa.id]?.length || tarefa.subtarefas?.length || 0}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Lista de subtarefas - mostrar apenas se showSubtarefas=true e tarefa expandida */}
                          {showSubtarefas && tarefasExpandidas[tarefa.id] && subtarefasPorTarefa[tarefa.id] && (
                            <div style={{
                              marginLeft: '24px',
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #dee2e6'
                            }}>
                              {subtarefasPorTarefa[tarefa.id].map(subtarefa => (
                                <div key={subtarefa.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '4px 8px',
                                  marginBottom: '4px',
                                  backgroundColor: subtarefa.selecionada ? '#e3f2fd' : 'transparent',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={subtarefa.selecionada || false}
                                    onChange={() => toggleSubtarefa(tarefa.id, subtarefa.id)}
                                    style={{
                                      margin: 0,
                                      cursor: 'pointer',
                                      width: '12px',
                                      height: '12px',
                                      flexShrink: 0
                                    }}
                                  />
                                  <span style={{
                                    flex: 1,
                                    color: subtarefa.selecionada ? '#1976d2' : '#495057',
                                    fontWeight: subtarefa.selecionada ? '500' : '400'
                                  }}>
                                    {subtarefa.nome}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Separador entre tarefas normais e exceções */}
                      {tarefasNormais.length > 0 && tarefasExcecao.length > 0 && (
                        <div style={{
                          margin: '12px 0',
                          padding: '8px 0',
                          borderTop: '2px solid #e2e8f0',
                          borderBottom: '2px solid #e2e8f0'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Tarefas Exceção
                          </div>
                        </div>
                      )}

                      {/* Tarefas Exceção */}
                      {tarefasExcecao.map(tarefa => (
                        <div key={tarefa.id} style={{ marginBottom: '8px' }}>
                          <div
                            className="selected-item-tag tarefa-excecao"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'nowrap',
                              whiteSpace: 'nowrap',
                              padding: '8px 12px',
                              minHeight: '43px',
                              background: tarefa.selecionada
                                ? 'linear-gradient(135deg, #f59e0b, #fd7e14)'
                                : '#fff4e6',
                              color: tarefa.selecionada ? 'white' : '#fd7e14',
                              border: tarefa.selecionada
                                ? 'none'
                                : '1px solid #ffd8a8',
                              borderRadius: '4px',
                              cursor: 'default',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              width: '100%',
                              justifyContent: 'space-between',
                              boxShadow: tarefa.selecionada
                                ? '0 1px 3px rgba(245, 158, 11, 0.2)'
                                : 'none',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              if (tarefa.selecionada) {
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.3)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              } else {
                                e.currentTarget.style.backgroundColor = '#ffedd5';
                                e.currentTarget.style.borderColor = '#f59e0b';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (tarefa.selecionada) {
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(245, 158, 11, 0.2)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              } else {
                                e.currentTarget.style.backgroundColor = '#fff4e6';
                                e.currentTarget.style.borderColor = '#ffd8a8';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={tarefa.selecionada || false}
                                onChange={() => toggleTarefa(produtoIdNum, tarefa.id)}
                                style={{
                                  margin: 0,
                                  marginRight: '4px',
                                  cursor: 'pointer',
                                  width: '14px',
                                  height: '14px',
                                  flexShrink: 0,
                                  accentColor: '#fd7e14'
                                }}
                              />
                              <div style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <div style={{
                                  fontWeight: '500',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {tarefa.nome}
                                </div>
                                {tarefa.tipoTarefa && (
                                  <div style={{
                                    fontSize: '10px',
                                    opacity: tarefa.selecionada ? 0.8 : 0.7,
                                    marginTop: '2px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    Tipo: {typeof tarefa.tipoTarefa === 'object' && tarefa.tipoTarefa !== null ? tarefa.tipoTarefa.nome : tarefa.tipoTarefa}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                              {/* Mini período por tarefa (exceção) - mostrar apenas na versão de atribuição */}
                              {tarefa.selecionada && onPeriodoChange && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto'
                                  }}
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                  onMouseUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                >
                                  <FilterPeriodo
                                    dataInicio={(periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.inicio) || null}
                                    dataFim={(periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.fim) || null}
                                    onInicioChange={(e) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { inicio: e.target.value || null })}
                                    onFimChange={(e) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { fim: e.target.value || null })}
                                    size="small"
                                    uiVariant={filterPeriodoUiVariant}
                                    showWeekendToggle={true}
                                    onWeekendToggleChange={(v) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { habilitarFinaisSemana: !!v })}
                                    showHolidayToggle={true}
                                    onHolidayToggleChange={(v) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { habilitarFeriados: !!v })}
                                    datasIndividuais={periodosPorTarefa?.[`${produtoIdNum}_${tarefa.id}`]?.datasIndividuais || []}
                                    onDatasIndividuaisChange={(arr) => onPeriodoChange && onPeriodoChange(produtoIdNum, tarefa.id, { datasIndividuais: Array.isArray(arr) ? arr : [] })}
                                  />
                                </div>
                              )}
                              {/* Card de responsável - mostrar apenas quando tarefa estiver selecionada (exceção) */}
                              {tarefa.selecionada && onResponsavelChange && colaboradores.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 10,
                                    flexShrink: 0
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <div style={{ width: '117px', minWidth: '117px', maxWidth: '117px', flexShrink: 0 }}>
                                    <ResponsavelCard
                                      isMulti={true}
                                      selectedValues={getResponsavelTarefa(produtoIdNum, tarefa.id)}
                                      options={colaboradores.map(c => ({
                                        value: String(c.id),
                                        label: c.cpf ? `${c.nome} (${c.cpf})` : c.nome
                                      }))}
                                      onChange={(e) => {
                                        const responsaveisIds = e.target.value || [];
                                        if (onResponsavelChange) {
                                          onResponsavelChange(produtoIdNum, tarefa.id, responsaveisIds);
                                        }
                                      }}
                                      placeholder="Selecione responsáveis"
                                      disabled={disabledTempo || (ordemPreenchimento && !ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id))}
                                      colaboradores={colaboradores}
                                    />
                                  </div>
                                  {ordemPreenchimento && !ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && (
                                    <div className="filter-tooltip" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 1000, whiteSpace: 'nowrap' }}>
                                      Preencha o período primeiro
                                    </div>
                                  )}
                                  {ordemPreenchimento && ordemPreenchimento.podePreencherResponsavel(produtoIdNum, tarefa.id) && getResponsavelTarefa(produtoIdNum, tarefa.id).length > 0 && calcularTempoDisponivel && formatarTempoEstimado && (() => {
                                    const periodo = periodosPorTarefa[`${produtoIdNum}_${tarefa.id}`] || null;
                                    const responsaveisTarefa = getResponsavelTarefa(produtoIdNum, tarefa.id);
                                    if (!periodo || responsaveisTarefa.length === 0) return null;
                                    const responsavelId = responsaveisTarefa[0];
                                    const temPeriodoCompleto = periodo.inicio && periodo.fim;
                                    const temDatasIndividuais = Array.isArray(periodo.datasIndividuais) && periodo.datasIndividuais.length > 0;
                                    if (!temPeriodoCompleto && !temDatasIndividuais) return null;

                                    // Usar tarefasSelecionadasPorProduto se fornecido, senão construir objeto mínimo
                                    const tarefasParaCalculo = tarefasSelecionadasPorProduto || { [produtoIdNum]: { [tarefa.id]: { selecionada: true } } };

                                    // Sempre incluir a tarefa atual no cálculo para mostrar o tempo disponível
                                    // após atribuir essa tarefa (se ela tiver tempo definido, será subtraída)
                                    // Não excluir a tarefa atual - queremos mostrar o tempo disponível real
                                    const tempoDisponivel = calcularTempoDisponivel(responsavelId, periodo, horasContratadasPorResponsavel, tempoEstimadoDia, tarefasParaCalculo, null);

                                    // Exibir sempre: positivo (azul), zero (azul com "0"), negativo (vermelho com "-")
                                    if (tempoDisponivel !== undefined && tempoDisponivel !== null) {
                                      const isExcedido = tempoDisponivel < 0;
                                      const isZero = tempoDisponivel === 0;

                                      return (
                                        <div
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: isExcedido ? '#fef2f2' : '#f0f9ff',
                                            border: `1px solid ${isExcedido ? '#ef4444' : '#0ea5e9'}`,
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: isExcedido ? '#991b1b' : '#0c4a6e',
                                            fontWeight: '500',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            whiteSpace: 'nowrap',
                                            boxSizing: 'border-box',
                                            cursor: 'help',
                                            position: 'relative'
                                          }}
                                          title={isExcedido ? "Tempo excedido" : "Disponível"}
                                        >
                                          <i className="fas fa-clock" style={{ fontSize: '10px', flexShrink: 0 }}></i>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {isExcedido ? `-${formatarTempoEstimado(Math.abs(tempoDisponivel), false)}` : formatarTempoEstimado(tempoDisponivel, false)}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                              {/* Campo de tempo estimado - mostrar apenas se showTempoEstimado=true e tarefa selecionada */}
                              {showTempoEstimado && tarefa.selecionada && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    marginRight: '8px',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 10
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <TempoEstimadoInput
                                    value={tempoEstimadoDia[`${String(produtoIdNum).trim()}_${String(tarefa.id).trim()}`] || tempoEstimadoDia[String(tarefa.id).trim()] || 0}
                                    onChange={(tempoEmMs) => {
                                      if (onTempoChange) {
                                        onTempoChange(produtoIdNum, tarefa.id, tempoEmMs);
                                      }
                                    }}
                                    disabled={disabledTempo}
                                  />
                                </div>
                              )}
                              {tarefa.ehExcecao === true && (
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  backgroundColor: tarefa.selecionada ? 'rgba(255, 255, 255, 0.2)' : '#ffd8a8',
                                  color: tarefa.selecionada ? 'white' : '#fd7e14',
                                  borderRadius: '3px',
                                  fontWeight: '500',
                                  flexShrink: 0
                                }}>
                                  Exceção
                                </span>
                              )}
                              {/* Botão para ver subtarefas - mostrar apenas se showSubtarefas=true */}
                              {showSubtarefas && (tarefa.subtarefas?.length > 0 || subtarefasPorTarefa[tarefa.id]?.length > 0) && (
                                <button
                                  type="button"
                                  title="Ver subtarefas"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const temSubtarefas = subtarefasPorTarefa[tarefa.id]?.length > 0;
                                    if (!temSubtarefas && !carregandoSubtarefas[tarefa.id]) {
                                      carregarSubtarefasTarefa(tarefa.id, produtoIdNum);
                                    }
                                    setTarefasExpandidas(prev => ({
                                      ...prev,
                                      [tarefa.id]: !prev[tarefa.id]
                                    }));
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: '0.2s',
                                    background: tarefa.selecionada ? 'rgba(255, 255, 255, 0.2)' : '#ffe4cc',
                                    color: tarefa.selecionada ? 'white' : '#fd7e14',
                                    border: tarefa.selecionada ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #ffd8a8',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={(e) => {
                                    if (tarefa.selecionada) {
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                    } else {
                                      e.currentTarget.style.background = '#ffd8a8';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (tarefa.selecionada) {
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                    } else {
                                      e.currentTarget.style.background = '#ffe4cc';
                                    }
                                  }}
                                >
                                  {carregandoSubtarefas[tarefa.id] ? (
                                    <i className="fas fa-spinner fa-spin"></i>
                                  ) : (
                                    <>
                                      <i className="fas fa-list-ul"></i>
                                      Subtarefas {subtarefasPorTarefa[tarefa.id]?.length || tarefa.subtarefas?.length || 0}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Lista de subtarefas - mostrar apenas se showSubtarefas=true e tarefa expandida */}
                          {showSubtarefas && tarefasExpandidas[tarefa.id] && subtarefasPorTarefa[tarefa.id] && (
                            <div style={{
                              marginLeft: '24px',
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#fff4e6',
                              borderRadius: '4px',
                              border: '1px solid #ffd8a8'
                            }}>
                              {subtarefasPorTarefa[tarefa.id].map(subtarefa => (
                                <div key={subtarefa.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '4px 8px',
                                  marginBottom: '4px',
                                  backgroundColor: subtarefa.selecionada ? '#ffedd5' : 'transparent',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={subtarefa.selecionada || false}
                                    onChange={() => toggleSubtarefa(tarefa.id, subtarefa.id)}
                                    style={{
                                      margin: 0,
                                      cursor: 'pointer',
                                      width: '12px',
                                      height: '12px',
                                      flexShrink: 0
                                    }}
                                  />
                                  <span style={{
                                    flex: 1,
                                    color: subtarefa.selecionada ? '#fd7e14' : '#92400e',
                                    fontWeight: subtarefa.selecionada ? '500' : '400'
                                  }}>
                                    {subtarefa.nome}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* Mensagem de validação de tempo total - mostrar apenas se showTempoEstimado=true */}
      {showTempoEstimado && horasDisponiveisDia != null && Object.keys(tarefasPorProduto).length > 0 && (() => {
        let totalTempoMs = 0;
        Object.entries(tarefasPorProduto).forEach(([produtoId, tarefas]) => {
          tarefas.forEach(tarefa => {
            if (tarefa.selecionada === true) {
              // Tentar primeiro com chave composta, depois fallback para chave simples
              const chaveComposta = `${produtoId}_${tarefa.id}`;
              totalTempoMs += tempoEstimadoDia[chaveComposta] || tempoEstimadoDia[tarefa.id] || 0;
            }
          });
        });
        const totalHorasPorDia = totalTempoMs / (1000 * 60 * 60);

        if (totalHorasPorDia > 0) {
          const estaExcedendo = totalHorasPorDia > horasDisponiveisDia;

          return (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: estaExcedendo ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${estaExcedendo ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '6px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: estaExcedendo ? '#dc2626' : '#16a34a',
                fontWeight: '500'
              }}>
                <i className={`fas fa-${estaExcedendo ? 'exclamation-triangle' : 'check-circle'}`}></i>
                <span>
                  Tempo total por dia: <strong>{totalHorasPorDia.toFixed(2)}h</strong> de <strong>{horasDisponiveisDia}h</strong> disponíveis
                  {estaExcedendo && (
                    <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: '600' }}>
                      (Ultrapassando em {(totalHorasPorDia - horasDisponiveisDia).toFixed(2)}h)
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default SelecaoTarefasPorProduto;

