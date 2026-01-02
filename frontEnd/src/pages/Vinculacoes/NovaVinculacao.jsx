import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import PrimarySelectsSection from '../../components/vinculacoes/PrimarySelectsSection';
import SecondarySelectsSection from '../../components/vinculacoes/SecondarySelectsSection';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import '../../components/vinculacoes/VinculacaoModal.css';
import './Vinculacoes.css';

const API_BASE_URL = '/api';

const NovaVinculacao = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const [primarySelects, setPrimarySelects] = useState([
    { id: 1, value: '' },
    { id: 2, value: '' }
  ]);
  
  const [primaryConfirmed, setPrimaryConfirmed] = useState(false);
  const [secondarySelects, setSecondarySelects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSelects, setExpandedSelects] = useState({});
  
  // Dados carregados das APIs
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [tiposTarefa, setTiposTarefa] = useState([]);
  const [tarefasVinculadas, setTarefasVinculadas] = useState({});

  const opcoesPrimarias = [
    { value: 'produto', label: 'Produto' },
    { value: 'cliente', label: 'Cliente' },
    { value: 'atividade', label: 'Tarefa' },
    { value: 'tipo-tarefa', label: 'Tipo Tarefa' }
  ];

  // Carregar dados das APIs
  useEffect(() => {
    if (!primaryConfirmed) {
      loadAllData();
    }
  }, [primaryConfirmed]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carregar produtos
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

      // Carregar clientes
      const clientesResult = await clientesAPI.getAll(null, false);
      if (clientesResult.success && clientesResult.data && Array.isArray(clientesResult.data)) {
        const clientesComDados = clientesResult.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`
        }));
        setClientes(clientesComDados);
      }

      // Carregar tarefas
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

      // Carregar tipos de tarefa
      const tiposTarefaRes = await fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (tiposTarefaRes.ok) {
        const tiposTarefaData = await tiposTarefaRes.json();
        if (tiposTarefaData.success) {
          setTiposTarefa(tiposTarefaData.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Adicionar novo select primário
  const addPrimarySelect = () => {
    const newId = Math.max(...primarySelects.map(s => s.id), 0) + 1;
    setPrimarySelects([...primarySelects, { id: newId, value: '' }]);
  };

  // Remover select primário
  const removePrimarySelect = (id) => {
    if (primarySelects.length > 2) {
      setPrimarySelects(primarySelects.filter(s => s.id !== id));
    }
  };

  // Atualizar valor do select primário
  const updatePrimarySelect = (id, value) => {
    setPrimarySelects(primarySelects.map(s => {
      if (s.id === id) {
        return { ...s, value };
      } else {
        // Remover regras restritivas - permitir qualquer combinação
        // Apenas evitar duplicatas do mesmo tipo
        if (s.value === value && value !== '') {
          return { ...s, value: '' };
        }
        return s;
      }
    }));
  };

  // Confirmar selects primários
  const confirmPrimarySelects = () => {
    const selectedTypes = primarySelects
      .map(s => s.value)
      .filter(v => v !== '');
    
    if (selectedTypes.length === 0) {
      showToast('warning', 'Selecione pelo menos uma opção nos tipos de elementos');
      return;
    }

    // Criar selects secundários baseados nas escolhas
    const newSecondarySelects = primarySelects
      .filter(s => s.value !== '')
      .map((s) => ({
        id: `secondary-${s.id}`,
        primaryType: s.value,
        value: '',
        selectedItems: []
      }));

    setSecondarySelects(newSecondarySelects);
    setPrimaryConfirmed(true);
  };

  // Atualizar valor do select secundário
  const updateSecondarySelect = (id, value) => {
    if (!value) return;
    
    setSecondarySelects(secondarySelects.map(s => {
      if (s.id === id) {
        const selectedItems = s.selectedItems || [];
        // Adicionar novo item se ainda não foi selecionado
        if (!selectedItems.includes(value)) {
          return { ...s, value: '', selectedItems: [...selectedItems, value] };
        }
      }
      return s;
    }));
  };

  // Remover item selecionado
  const removeSelectedItem = (selectId, itemValue) => {
    setSecondarySelects(secondarySelects.map(s => {
      if (s.id === selectId) {
        return {
          ...s,
          selectedItems: (s.selectedItems || []).filter(item => item !== itemValue)
        };
      }
      return s;
    }));
  };

  // Buscar tarefas vinculadas aos produtos selecionados
  useEffect(() => {
    const buscarTarefasVinculadas = async () => {
      const produtoSelect = secondarySelects.find(s => s.primaryType === 'produto');
      if (!produtoSelect || !produtoSelect.selectedItems || produtoSelect.selectedItems.length === 0) {
        setTarefasVinculadas({});
        return;
      }

      const produtoIds = produtoSelect.selectedItems.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (produtoIds.length === 0) {
        setTarefasVinculadas({});
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoIds.join(',')}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const tarefasMap = {};
            result.data.forEach(item => {
              tarefasMap[item.produtoId] = item.tarefas || [];
            });
            setTarefasVinculadas(tarefasMap);
          } else {
            setTarefasVinculadas({});
          }
        } else {
          setTarefasVinculadas({});
        }
      } catch (error) {
        console.error('Erro ao buscar tarefas vinculadas:', error);
        setTarefasVinculadas({});
      }
    };

    if (primaryConfirmed && secondarySelects.length > 0) {
      buscarTarefasVinculadas();
    } else {
      setTarefasVinculadas({});
    }
  }, [secondarySelects, primaryConfirmed]);

  // Selecionar todos os itens de um select secundário
  const handleSelectAll = (selectId) => {
    setSecondarySelects(secondarySelects.map(s => {
      if (s.id === selectId) {
        const allOptions = getAllSecondaryOptions(s.primaryType);
        const allValues = allOptions.map(opt => String(opt.value));
        const currentSelected = (s.selectedItems || []).map(item => String(item));
        const allSelected = allValues.every(val => currentSelected.includes(val));
        
        return {
          ...s,
          selectedItems: allSelected ? [] : allValues
        };
      }
      return s;
    }));
  };

  // Obter todas as opções do select secundário baseado no tipo primário (sem filtro)
  const getAllSecondaryOptions = (primaryType) => {
    switch (primaryType) {
      case 'produto':
        return produtos.map(p => ({ value: p.id, label: p.nome }));
      case 'cliente':
        return clientes.map(c => ({ value: c.id, label: c.nome }));
      case 'atividade':
        return tarefas.map(t => ({ value: t.id, label: t.nome }));
      case 'tipo-tarefa':
        return tiposTarefa.map(tt => ({ value: tt.id, label: tt.nome }));
      default:
        return [];
    }
  };

  // Obter opções do select secundário baseado no tipo primário (com filtro)
  const getSecondaryOptions = (primaryType, excludeValues = []) => {
    const options = getAllSecondaryOptions(primaryType);
    return options.filter(opt => !excludeValues.includes(opt.value));
  };

  // Obter label de um item pelo ID
  const getItemLabel = (primaryType, itemId) => {
    const options = getAllSecondaryOptions(primaryType);
    const option = options.find(opt => String(opt.value) === String(itemId));
    return option ? option.label : itemId;
  };


  // Criar dados para tabela vinculados (todas as combinações)
  // IMPORTANTE: Usar cp_tarefa (nome correto da coluna no banco)
  const criarDadosVinculados = () => {
    const toNumber = (id) => {
      if (id === null || id === undefined || id === '') return null;
      const num = parseInt(String(id).trim(), 10);
      return isNaN(num) ? null : num;
    };

    const toString = (id) => {
      if (id === null || id === undefined || id === '') return null;
      return String(id).trim();
    };

    // Agrupar itens selecionados por tipo
    const produtosIds = [];
    const clientesIds = [];
    const tarefasIds = [];
    const tiposTarefaIds = [];

    secondarySelects.forEach(select => {
      const selectedItems = select.selectedItems || [];
      if (selectedItems.length > 0) {
        switch (select.primaryType) {
          case 'produto':
            produtosIds.push(...selectedItems.map(toNumber).filter(id => id !== null));
            break;
          case 'cliente':
            clientesIds.push(...selectedItems.map(toString).filter(id => id !== null));
            break;
          case 'atividade':
            tarefasIds.push(...selectedItems.map(toNumber).filter(id => id !== null));
            break;
          case 'tipo-tarefa':
            tiposTarefaIds.push(...selectedItems.map(toNumber).filter(id => id !== null));
            break;
        }
      }
    });

    // Criar todas as combinações possíveis
    const combinacoes = [];

    // Função auxiliar para criar combinações recursivamente
    // IMPORTANTE: Usar cp_tarefa (nome correto da coluna no banco)
    const criarCombinacoes = (tipos, valores, combinacaoAtual = {}) => {
      if (tipos.length === 0) {
        combinacoes.push({ ...combinacaoAtual });
        return;
      }

      const [tipoAtual, ...restoTipos] = tipos;
      const valoresAtuais = valores[tipoAtual] || [];

      if (valoresAtuais.length === 0) {
        // Se não há valores para este tipo, continuar com null
        // Usar nomes de colunas do backend
        const campoNome = tipoAtual === 'atividade' ? 'cp_tarefa' : 
                         tipoAtual === 'tipo-tarefa' ? 'cp_tarefa_tipo' :
                         tipoAtual === 'cliente' ? 'cp_cliente' : `cp_${tipoAtual}`;
        criarCombinacoes(restoTipos, valores, { ...combinacaoAtual, [campoNome]: null });
      } else {
        // Para cada valor, criar uma combinação
        valoresAtuais.forEach(valor => {
          // Usar cp_tarefa (nome correto da coluna no banco)
          const campoNome = tipoAtual === 'atividade' ? 'cp_tarefa' : 
                           tipoAtual === 'tipo-tarefa' ? 'cp_tarefa_tipo' :
                           tipoAtual === 'cliente' ? 'cp_cliente' : `cp_${tipoAtual}`;
          const valorFormatado = tipoAtual === 'cliente' ? toString(valor) : toNumber(valor);
          criarCombinacoes(restoTipos, valores, { ...combinacaoAtual, [campoNome]: valorFormatado });
        });
      }
    };

    const tiposSelecionados = [];
    const valoresPorTipo = {};

    if (produtosIds.length > 0) {
      tiposSelecionados.push('produto');
      valoresPorTipo['produto'] = produtosIds;
    }
    if (clientesIds.length > 0) {
      tiposSelecionados.push('cliente');
      valoresPorTipo['cliente'] = clientesIds;
    }
    if (tarefasIds.length > 0) {
      tiposSelecionados.push('atividade');
      valoresPorTipo['atividade'] = tarefasIds;
    }
    if (tiposTarefaIds.length > 0) {
      tiposSelecionados.push('tipo-tarefa');
      valoresPorTipo['tipo-tarefa'] = tiposTarefaIds;
    }

    if (tiposSelecionados.length > 0) {
      criarCombinacoes(tiposSelecionados, valoresPorTipo);
    }

    return combinacoes;
  };

  // Salvar vinculação
  const handleSave = async () => {
    const selectsSemSelecao = secondarySelects.filter(select => {
      const selectedItems = select.selectedItems || [];
      return selectedItems.length === 0;
    });

    if (selectsSemSelecao.length > 0) {
      showToast('warning', 'Por favor, selecione pelo menos um item em cada elemento específico antes de salvar.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);

    try {
      // Salvar na tabela vinculados (IDs selecionados - múltiplas combinações)
      // Esta é a tabela principal que armazena os relacionamentos reais
      const combinacoesVinculados = criarDadosVinculados();
      
      if (combinacoesVinculados.length > 0) {
        const responseVinculados = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            vinculados: combinacoesVinculados
          }),
        });

        if (responseVinculados.status === 401) {
          window.location.href = '/login';
          return;
        }

        const contentTypeVinculados = responseVinculados.headers.get('content-type') || '';
        if (!contentTypeVinculados.includes('application/json')) {
          const text = await responseVinculados.text();
          console.error('Erro ao salvar vinculados:', text);
        } else {
          const resultVinculados = await responseVinculados.json();
          if (!responseVinculados.ok) {
            console.error('Erro ao salvar vinculados:', resultVinculados);
          }
        }
      }

      // 3. Aplicar herança para combinações produto-cliente criadas
      // IMPORTANTE: Identificar combinações onde produto e cliente estão vinculados mas não há tarefa
      // Usar cp_tarefa (nome correto da coluna no banco)
      const combinacoesProdutoCliente = combinacoesVinculados.filter(c => 
        c.cp_produto && c.cp_cliente && !c.cp_tarefa && !c.cp_tarefa_tipo
      );

      // Agrupar por combinação única produto-cliente para evitar chamadas duplicadas
      const combinacoesUnicas = new Map();
      combinacoesProdutoCliente.forEach(combo => {
        const chave = `${combo.cp_produto}_${combo.cp_cliente}`;
        if (!combinacoesUnicas.has(chave)) {
          combinacoesUnicas.set(chave, {
            produtoId: combo.cp_produto,
            clienteId: combo.cp_cliente
          });
        }
      });

      if (combinacoesUnicas.size > 0) {
        console.log(`🔄 Aplicando herança para ${combinacoesUnicas.size} combinação(ões) produto-cliente única(s)`);
        
        // Aplicar herança para cada combinação produto-cliente única
        const promessasHeranca = Array.from(combinacoesUnicas.values()).map(async (combo) => {
          try {
            const responseHeranca = await fetch(`${API_BASE_URL}/vinculados/aplicar-heranca`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                produtoId: combo.produtoId,
                clienteId: combo.clienteId
              }),
            });

            if (responseHeranca.ok) {
              const resultHeranca = await responseHeranca.json();
              if (resultHeranca.success) {
                console.log(`✅ Herança aplicada: Produto ${combo.produtoId} → Cliente ${combo.clienteId} (${resultHeranca.count || 0} tarefa(s))`);
                return { success: true, count: resultHeranca.count || 0 };
              }
            } else {
              const errorData = await responseHeranca.json().catch(() => ({}));
              console.warn(`⚠️ Erro ao aplicar herança para Produto ${combo.produtoId} → Cliente ${combo.clienteId}:`, errorData.error || 'Erro desconhecido');
              return { success: false };
            }
          } catch (error) {
            console.error(`❌ Erro ao aplicar herança para Produto ${combo.produtoId} → Cliente ${combo.clienteId}:`, error);
            return { success: false };
          }
        });

        // Aguardar todas as heranças serem aplicadas
        const resultados = await Promise.all(promessasHeranca);
        const sucessos = resultados.filter(r => r.success).length;
        const totalTarefas = resultados.reduce((sum, r) => sum + (r.count || 0), 0);
        
        if (sucessos > 0) {
          console.log(`✅ Herança concluída: ${sucessos} de ${combinacoesUnicas.size} combinação(ões) processada(s), ${totalTarefas} tarefa(s) vinculada(s)`);
        }
      }

      // Verificar sucesso baseado na criação dos vinculados
      if (combinacoesVinculados.length > 0) {
        showToast('success', 'Vinculação criada com sucesso!');
        navigate('/cadastro/vinculacoes');
      } else {
        showToast('error', 'Nenhuma vinculação foi criada. Verifique os dados selecionados.');
      }
    } catch (error) {
      console.error('Erro ao salvar vinculação:', error);
      showToast('error', error.message || 'Erro ao salvar vinculação. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler para toggle de expansão
  const handleToggleExpand = (selectId) => {
    setExpandedSelects(prev => ({
      ...prev,
      [selectId]: !prev[selectId]
    }));
  };

  return (
    <Layout>
      <div className="vinculacao-page">
        <div className="vinculacao-page-header">
          <button
            className="btn-voltar"
            onClick={() => navigate('/cadastro/vinculacoes')}
            disabled={submitting}
          >
            <i className="fas fa-arrow-left"></i> Voltar
          </button>
          <h1 className="vinculacao-page-title">Nova Vinculação</h1>
        </div>

        <div className="vinculacao-page-content">
          {!primaryConfirmed ? (
            <>
              <PrimarySelectsSection
                primarySelects={primarySelects}
                opcoesPrimarias={opcoesPrimarias}
                onUpdateSelect={updatePrimarySelect}
                onAddSelect={addPrimarySelect}
                onRemoveSelect={removePrimarySelect}
                loading={loading}
              />

              <div className="vinculacao-page-footer">
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/cadastro/vinculacoes')}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={confirmPrimarySelects}
                  disabled={loading}
                >
                  Confirmar Seleções
                </button>
              </div>
            </>
          ) : (
            <>
              <SecondarySelectsSection
                secondarySelects={secondarySelects}
                opcoesPrimarias={opcoesPrimarias}
                getAllSecondaryOptions={getAllSecondaryOptions}
                getSecondaryOptions={getSecondaryOptions}
                getItemLabel={getItemLabel}
                isEditing={false}
                onUpdateSelect={updateSecondarySelect}
                onRemoveItem={removeSelectedItem}
                onSelectAll={handleSelectAll}
                expandedSelects={expandedSelects}
                onToggleExpand={handleToggleExpand}
                loading={loading}
                tarefasVinculadas={tarefasVinculadas}
                produtos={produtos}
              />

              {/* Preview de combinações - Visualização Hierárquica */}
              {(() => {
                const combinacoes = criarDadosVinculados();
                if (combinacoes.length === 0) return null;

                // Organizar combinações hierarquicamente quando há cliente e produto
                const temClienteEProduto = combinacoes.some(c => c.cp_cliente && c.cp_produto);
                
                if (temClienteEProduto && combinacoes.length <= 20) {
                  // Agrupar por cliente > produto > tarefa
                  const hierarquia = {};
                  combinacoes.forEach(combinacao => {
                    const clienteId = combinacao.cp_cliente;
                    const produtoId = combinacao.cp_produto;
                    // Usar cp_tarefa (nome correto da coluna no banco)
                    const tarefaId = combinacao.cp_tarefa;
                    // Usar cp_tarefa_tipo (nome correto da coluna no banco)
                    const tipoTarefaId = combinacao.cp_tarefa_tipo;
                    
                    if (clienteId && produtoId) {
                      const clienteKey = String(clienteId).trim();
                      const produtoKey = String(produtoId);
                      
                      if (!hierarquia[clienteKey]) {
                        hierarquia[clienteKey] = {
                          nome: getItemLabel('cliente', clienteId),
                          produtos: {}
                        };
                      }
                      
                      if (!hierarquia[clienteKey].produtos[produtoKey]) {
                        hierarquia[clienteKey].produtos[produtoKey] = {
                          nome: getItemLabel('produto', produtoId),
                          tarefas: [],
                          tiposTarefa: []
                        };
                      }
                      
                      if (tarefaId) {
                        const tarefaNome = getItemLabel('atividade', tarefaId);
                        if (!hierarquia[clienteKey].produtos[produtoKey].tarefas.find(t => t.id === tarefaId)) {
                          hierarquia[clienteKey].produtos[produtoKey].tarefas.push({
                            id: tarefaId,
                            nome: tarefaNome
                          });
                        }
                      }
                      
                      if (tipoTarefaId) {
                        const tipoNome = getItemLabel('tipo-tarefa', tipoTarefaId);
                        if (!hierarquia[clienteKey].produtos[produtoKey].tiposTarefa.find(t => t.id === tipoTarefaId)) {
                          hierarquia[clienteKey].produtos[produtoKey].tiposTarefa.push({
                            id: tipoTarefaId,
                            nome: tipoNome
                          });
                        }
                      }
                    }
                  });

                  return (
                    <div className="vinculacao-preview vinculacao-preview-hierarchical">
                      <div className="vinculacao-preview-header">
                        <i className="fas fa-sitemap"></i>
                        <strong>Preview Hierárquico:</strong> Serão criadas <strong>{combinacoes.length}</strong> combinação(ões)
                      </div>
                      <div className="vinculacao-preview-hierarchical-list">
                        {Object.values(hierarquia).map((cliente, clienteIdx) => (
                          <div key={clienteIdx} className="vinculacao-preview-hierarchical-cliente">
                            <div className="vinculacao-preview-hierarchical-cliente-header">
                              <i className="fas fa-user"></i>
                              <strong>{cliente.nome}</strong>
                            </div>
                            <div className="vinculacao-preview-hierarchical-produtos">
                              {Object.values(cliente.produtos).map((produto, produtoIdx) => (
                                <div key={produtoIdx} className="vinculacao-preview-hierarchical-produto">
                                  <div className="vinculacao-preview-hierarchical-produto-header">
                                    <i className="fas fa-box"></i>
                                    <span>{produto.nome}</span>
                                  </div>
                                  {(produto.tarefas.length > 0 || produto.tiposTarefa.length > 0) && (
                                    <div className="vinculacao-preview-hierarchical-items">
                                      {produto.tarefas.map((tarefa, tarefaIdx) => (
                                        <div key={tarefaIdx} className="vinculacao-preview-hierarchical-item">
                                          <i className="fas fa-list"></i>
                                          <span>{tarefa.nome}</span>
                                        </div>
                                      ))}
                                      {produto.tiposTarefa.map((tipo, tipoIdx) => (
                                        <div key={tipoIdx} className="vinculacao-preview-hierarchical-item">
                                          <i className="fas fa-tags"></i>
                                          <span>{tipo.nome}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Preview simples para outras combinações
                return (
                  <div className="vinculacao-preview">
                    <div className="vinculacao-preview-header">
                      <i className="fas fa-info-circle"></i>
                      <strong>Preview:</strong> Serão criadas <strong>{combinacoes.length}</strong> combinação(ões)
                    </div>
                    {combinacoes.length <= 10 && (
                      <div className="vinculacao-preview-list">
                        {combinacoes.slice(0, 10).map((combinacao, idx) => (
                          <div key={idx} className="vinculacao-preview-item">
                            {Object.entries(combinacao)
                              .filter(([_, value]) => value !== null)
                              .map(([key, value]) => {
                                // Usar cp_tarefa (nome correto da coluna no banco)
                                const tipo = key === 'cp_tarefa' ? 'atividade' :
                                           key === 'cp_tarefa_tipo' ? 'tipo-tarefa' :
                                           key === 'cp_produto' ? 'produto' :
                                           key === 'cp_cliente' ? 'cliente' : null;
                                if (!tipo) return null;
                                const label = getItemLabel(tipo, value);
                                return (
                                  <span key={key} className="vinculacao-preview-tag">
                                    {tipo === 'atividade' ? 'Tarefa' :
                                     tipo === 'tipo-tarefa' ? 'Tipo Tarefa' :
                                     tipo === 'produto' ? 'Produto' : 'Cliente'}: {label}
                                  </span>
                                );
                              })
                              .filter(Boolean)
                              .reduce((acc, el, idx) => idx === 0 ? [el] : [...acc, <span key={`sep-${idx}`}> + </span>, el], [])}
                          </div>
                        ))}
                        {combinacoes.length > 10 && (
                          <div className="vinculacao-preview-more">
                            ... e mais {combinacoes.length - 10} combinação(ões)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="vinculacao-page-footer">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setPrimaryConfirmed(false);
                    setSecondarySelects([]);
                  }}
                  disabled={submitting}
                >
                  Voltar
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/cadastro/vinculacoes')}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={loading || submitting}
                >
                  {submitting ? (
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
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default NovaVinculacao;

