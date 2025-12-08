import React, { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';
import { useToast } from '../../hooks/useToast';
import './VinculacaoModal.css';

const API_BASE_URL = '/api';

const VinculacaoModal = ({ isOpen, onClose, editingVinculado = null }) => {
  const showToast = useToast();
  const [primarySelects, setPrimarySelects] = useState([
    { id: 1, value: '' },
    { id: 2, value: '' }
  ]);
  
  const [primaryConfirmed, setPrimaryConfirmed] = useState(false);
  const [secondarySelects, setSecondarySelects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSelects, setExpandedSelects] = useState({}); // Controla quais selects estão expandidos
  
  // Dados carregados das APIs
  const [atividades, setAtividades] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [tipoAtividades, setTipoAtividades] = useState([]);

  const opcoesPrimarias = [
    { value: 'produto', label: 'Produto' },
    { value: 'atividade', label: 'Atividade' },
    { value: 'tipo-atividade', label: 'Tipo de Atividade' }
  ];

  // Carregar dados das APIs e do vinculado se estiver editando
  useEffect(() => {
    if (isOpen && !primaryConfirmed) {
      loadAllData();
      if (editingVinculado) {
        loadVinculadoData();
      }
    }
  }, [isOpen, primaryConfirmed, editingVinculado]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carregar atividades
      const atividadesRes = await fetch(`${API_BASE_URL}/atividades?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (atividadesRes.ok) {
        const atividadesData = await atividadesRes.json();
        if (atividadesData.success) {
          setAtividades(atividadesData.data || []);
        }
      }

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

      // Carregar tipo de atividades
      const tipoAtividadesRes = await fetch(`${API_BASE_URL}/tipo-atividade?limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (tipoAtividadesRes.ok) {
        const tipoAtividadesData = await tipoAtividadesRes.json();
        if (tipoAtividadesData.success) {
          setTipoAtividades(tipoAtividadesData.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados do vinculado para edição
  const loadVinculadoData = async () => {
    if (!editingVinculado) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/vinculados/${editingVinculado}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const vinculado = result.data;
          
          // Determinar tipos primários baseados nos campos preenchidos
          const tiposSelecionados = [];
          if (vinculado.cp_atividade) tiposSelecionados.push('atividade');
          if (vinculado.cp_produto) tiposSelecionados.push('produto');
          if (vinculado.cp_atividade_tipo) tiposSelecionados.push('tipo-atividade');

          // Configurar selects primários
          const newPrimarySelects = tiposSelecionados.map((tipo, idx) => ({
            id: idx + 1,
            value: tipo
          }));
          // Garantir pelo menos 2 selects
          while (newPrimarySelects.length < 2) {
            newPrimarySelects.push({ id: newPrimarySelects.length + 1, value: '' });
          }
          setPrimarySelects(newPrimarySelects);

          // Confirmar e criar selects secundários
          const newSecondarySelects = tiposSelecionados.map((tipo) => ({
            id: Math.random(),
            primaryType: tipo,
            selectedItems: vinculado[`cp_${tipo === 'tipo-atividade' ? 'atividade_tipo' : tipo}`] 
              ? [vinculado[`cp_${tipo === 'tipo-atividade' ? 'atividade_tipo' : tipo}`].toString()]
              : []
          }));
          setSecondarySelects(newSecondarySelects);
          setPrimaryConfirmed(true);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do vinculado:', error);
      showToast('error', 'Erro ao carregar dados para edição.');
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
    // Se o valor selecionado já está sendo usado em outro select, limpar o outro select
    setPrimarySelects(primarySelects.map(s => {
      if (s.id === id) {
        return { ...s, value };
      } else if (s.value === value && value !== '') {
        // Limpar o outro select que tinha o mesmo valor
        return { ...s, value: '' };
      }
      return s;
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

  // Adicionar novo select secundário do mesmo tipo
  const addSecondarySelect = (primaryType) => {
    const newId = `secondary-${Date.now()}`;
    setSecondarySelects([
      ...secondarySelects,
      {
        id: newId,
        primaryType,
        value: '',
        selectedItems: []
      }
    ]);
  };

  // Remover select secundário
  const removeSecondarySelect = (id) => {
    setSecondarySelects(secondarySelects.filter(s => s.id !== id));
  };

  // Atualizar valor do select secundário
  const updateSecondarySelect = (id, value) => {
    if (!value) return;
    
    setSecondarySelects(secondarySelects.map(s => {
      if (s.id === id) {
        const selectedItems = s.selectedItems || [];
        
        // Se estiver editando, substituir o item existente ao invés de adicionar
        if (editingVinculado) {
          // Na edição, apenas trocar o item (manter apenas um item selecionado)
          return { ...s, value: '', selectedItems: [value] };
        } else {
          // Na criação, adicionar novo item se ainda não foi selecionado
          if (!selectedItems.includes(value)) {
            return { ...s, value: '', selectedItems: [...selectedItems, value] };
          }
        }
      }
      return s;
    }));
  };

  // Remover item selecionado
  const removeSelectedItem = (selectId, itemValue) => {
    // Na edição, não permitir remover se houver apenas um item
    if (editingVinculado) {
      const select = secondarySelects.find(s => s.id === selectId);
      if (select && (select.selectedItems || []).length <= 1) {
        return; // Não permitir remover o último item na edição
      }
    }
    
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

  // Selecionar todos os itens de um select secundário
  const handleSelectAll = (selectId) => {
    // Na edição, não permitir selecionar todos
    if (editingVinculado) {
      return;
    }
    
    setSecondarySelects(secondarySelects.map(s => {
      if (s.id === selectId) {
        const allOptions = getAllSecondaryOptions(s.primaryType);
        const allValues = allOptions.map(opt => String(opt.value));
        // Se já estão todos selecionados, desmarca todos
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
      case 'atividade':
        return atividades.map(a => ({ value: a.id, label: a.nome }));
      case 'produto':
        return produtos.map(p => ({ value: p.id, label: p.nome }));
      case 'tipo-atividade':
        return tipoAtividades.map(t => ({ value: t.id, label: t.nome }));
      default:
        return [];
    }
  };

  // Obter opções do select secundário baseado no tipo primário (com filtro)
  const getSecondaryOptions = (primaryType, excludeValues = []) => {
    const options = getAllSecondaryOptions(primaryType);
    // Filtrar itens já selecionados
    return options.filter(opt => !excludeValues.includes(opt.value));
  };

  // Obter label de um item pelo ID
  const getItemLabel = (primaryType, itemId) => {
    const options = getAllSecondaryOptions(primaryType);
    const option = options.find(opt => String(opt.value) === String(itemId));
    return option ? option.label : itemId;
  };

  // Criar objeto com valores booleanos para cada coluna
  const criarDadosVinculacao = () => {
    // Pegar os tipos únicos dos selects primários confirmados
    const tiposSelecionados = primarySelects
      .filter(s => s.value !== '')
      .map(s => s.value);

    // Retornar objeto com valores booleanos
    return {
      cp_atividade: tiposSelecionados.includes('atividade'),
      cp_produto: tiposSelecionados.includes('produto'),
      cp_atividade_tipo: tiposSelecionados.includes('tipo-atividade')
    };
  };


  // Criar dados para tabela vinculados (todas as combinações)
  const criarDadosVinculados = () => {
    // Agrupar itens selecionados por tipo
    const atividadesIds = [];
    const produtosIds = [];
    const tipoAtividadesIds = [];

    secondarySelects.forEach(select => {
      const selectedItems = select.selectedItems || [];
      if (selectedItems.length > 0) {
        switch (select.primaryType) {
          case 'atividade':
            atividadesIds.push(...selectedItems);
            break;
          case 'produto':
            produtosIds.push(...selectedItems);
            break;
          case 'tipo-atividade':
            tipoAtividadesIds.push(...selectedItems);
            break;
        }
      }
    });

    // Criar todas as combinações possíveis
    const combinacoes = [];

    // Se houver atividades e produtos, criar combinações
    if (atividadesIds.length > 0 && produtosIds.length > 0) {
      atividadesIds.forEach(atividadeId => {
        produtosIds.forEach(produtoId => {
          combinacoes.push({
            cp_atividade: atividadeId,
            cp_produto: produtoId,
            cp_atividade_tipo: null
          });
        });
      });
    }

    // Se houver atividades e tipo de atividades, criar combinações
    if (atividadesIds.length > 0 && tipoAtividadesIds.length > 0) {
      atividadesIds.forEach(atividadeId => {
        tipoAtividadesIds.forEach(tipoAtividadeId => {
          combinacoes.push({
            cp_atividade: atividadeId,
            cp_atividade_tipo: tipoAtividadeId,
            cp_produto: null
          });
        });
      });
    }

    // Se houver produtos e tipo de atividades, criar combinações
    if (produtosIds.length > 0 && tipoAtividadesIds.length > 0) {
      produtosIds.forEach(produtoId => {
        tipoAtividadesIds.forEach(tipoAtividadeId => {
          combinacoes.push({
            cp_produto: produtoId,
            cp_atividade_tipo: tipoAtividadeId,
            cp_atividade: null
          });
        });
      });
    }

    // Se houver apenas um tipo selecionado, criar registros individuais
    if (atividadesIds.length > 0 && produtosIds.length === 0 && tipoAtividadesIds.length === 0) {
      atividadesIds.forEach(atividadeId => {
        combinacoes.push({
          cp_atividade: atividadeId,
          cp_produto: null,
          cp_atividade_tipo: null
        });
      });
    }

    if (produtosIds.length > 0 && atividadesIds.length === 0 && tipoAtividadesIds.length === 0) {
      produtosIds.forEach(produtoId => {
        combinacoes.push({
          cp_produto: produtoId,
          cp_atividade: null,
          cp_atividade_tipo: null
        });
      });
    }

    if (tipoAtividadesIds.length > 0 && atividadesIds.length === 0 && produtosIds.length === 0) {
      tipoAtividadesIds.forEach(tipoAtividadeId => {
        combinacoes.push({
          cp_atividade_tipo: tipoAtividadeId,
          cp_atividade: null,
          cp_produto: null
        });
      });
    }

    // Se houver todos os três tipos, criar todas as combinações triplas
    if (atividadesIds.length > 0 && produtosIds.length > 0 && tipoAtividadesIds.length > 0) {
      atividadesIds.forEach(atividadeId => {
        produtosIds.forEach(produtoId => {
          tipoAtividadesIds.forEach(tipoAtividadeId => {
            combinacoes.push({
              cp_atividade: atividadeId,
              cp_produto: produtoId,
              cp_atividade_tipo: tipoAtividadeId
            });
          });
        });
      });
    }

    return combinacoes;
  };

  // Salvar vinculação (com selects secundários)
  const handleSave = async () => {
    // Validar se todos os selects secundários têm pelo menos um item selecionado
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
      // 1. Salvar na tabela cp_vinculacao (valores booleanos)
      const dadosVinculacao = criarDadosVinculacao();

      const responseVinculacao = await fetch(`${API_BASE_URL}/vinculacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(dadosVinculacao),
      });

      if (responseVinculacao.status === 401) {
        window.location.href = '/login';
        return;
      }

      const contentTypeVinculacao = responseVinculacao.headers.get('content-type') || '';
      if (!contentTypeVinculacao.includes('application/json')) {
        const text = await responseVinculacao.text();
        showToast('error', text || `Erro no servidor. Status: ${responseVinculacao.status}`);
        return;
      }

      const resultVinculacao = await responseVinculacao.json();

      if (!responseVinculacao.ok) {
        const errorMsg = resultVinculacao.error || resultVinculacao.details || resultVinculacao.message || `Erro HTTP ${responseVinculacao.status}`;
        showToast('error', errorMsg);
        return;
      }

      // 2. Salvar na tabela vinculados (IDs selecionados - múltiplas combinações)
      const combinacoesVinculados = criarDadosVinculados();
      
      // Verificar se há combinações para salvar
      if (combinacoesVinculados.length > 0) {
        if (editingVinculado) {
          // Modo edição: atualizar o vinculado (usar apenas a primeira combinação)
          const dadosUpdate = combinacoesVinculados[0];
          const responseVinculados = await fetch(`${API_BASE_URL}/vinculados/${editingVinculado}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(dadosUpdate),
          });

          if (responseVinculados.status === 401) {
            window.location.href = '/login';
            return;
          }

          const contentTypeVinculados = responseVinculados.headers.get('content-type') || '';
          if (!contentTypeVinculados.includes('application/json')) {
            const text = await responseVinculados.text();
            console.error('Erro ao atualizar vinculado:', text);
            showToast('error', text || 'Erro ao atualizar vinculado');
            return;
          }

          const resultVinculados = await responseVinculados.json();
          
          if (!responseVinculados.ok) {
            console.error('Erro ao atualizar vinculado:', resultVinculados);
            showToast('error', resultVinculados.error || 'Erro ao atualizar vinculado');
            return;
          } else {
            console.log('✅ Vinculado atualizado com sucesso');
          }
        } else {
          // Modo criação: criar múltiplos vinculados
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
            // Não bloquear se falhar, apenas logar
          } else {
            const resultVinculados = await responseVinculados.json();
            
            if (!responseVinculados.ok) {
              console.error('Erro ao salvar vinculados:', resultVinculados);
              // Não bloquear se falhar, apenas logar
            } else {
              console.log(`✅ ${resultVinculados.count || combinacoesVinculados.length} vinculado(s) salvo(s) com sucesso`);
            }
          }
        }
      }

      if (resultVinculacao.success || editingVinculado) {
        showToast('success', editingVinculado ? 'Vinculação atualizada com sucesso!' : 'Vinculação criada com sucesso!');
        handleClose(true); // Passar true indica que foi salvo com sucesso
      } else {
        const errorMsg = resultVinculacao.error || resultVinculacao.details || 'Erro ao salvar vinculação';
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar vinculação:', error);
      showToast('error', error.message || 'Erro ao salvar vinculação. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resetar modal
  const handleClose = (saved = false) => {
    setPrimarySelects([
      { id: 1, value: '' },
      { id: 2, value: '' }
    ]);
    setPrimaryConfirmed(false);
    setSecondarySelects([]);
    setSubmitting(false);
    setExpandedSelects({}); // Resetar estados expandidos
    onClose(saved);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content vinculacao-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0e3b6f', margin: 0 }}>
            <i className="fas fa-link" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
            {editingVinculado ? 'Editar Vinculação' : 'Nova Vinculação'}
          </h3>
          <button
            className="btn-icon"
            onClick={handleClose}
            title="Fechar"
            disabled={submitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body custom-scrollbar">
          {!primaryConfirmed ? (
            <>
              <div className="vinculacao-section">
                <h4 className="section-title">Tipos de Elementos</h4>
                <p className="section-description">
                  Selecione os tipos de elementos que deseja vincular
                </p>
                
                <div className="vinculacao-section-primary-selects custom-scrollbar">
                  {primarySelects.map((select, index) => {
                    // Filtrar opções para não permitir selecionar o mesmo tipo já selecionado em outro select
                    const otherSelectedValues = primarySelects
                      .filter(s => s.id !== select.id && s.value !== '')
                      .map(s => s.value);
                    
                    const availableOptions = opcoesPrimarias.filter(
                      opt => !otherSelectedValues.includes(opt.value)
                    );
                    
                    return (
                      <div key={select.id} className="select-group">
                        <div className="select-wrapper">
                          <CustomSelect
                            value={select.value}
                            options={availableOptions}
                            onChange={(e) => updatePrimarySelect(select.id, e.target.value)}
                            placeholder="Selecione uma opção"
                            disabled={loading}
                          />
                      {index === primarySelects.length - 1 && (
                        <button
                          type="button"
                          className="btn-add-select"
                          onClick={addPrimarySelect}
                          title="Adicionar outro select"
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      )}
                      {primarySelects.length > 2 && (
                        <button
                          type="button"
                          className="btn-remove-select"
                          onClick={() => removePrimarySelect(select.id)}
                          title="Remover select"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>
                  </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleClose(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
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
              <div className="vinculacao-section">
                <h4 className="section-title">Elementos Específicos</h4>
                <p className="section-description">
                  {editingVinculado 
                    ? 'Troque o item selecionado para cada tipo escolhido'
                    : 'Selecione os itens específicos para cada tipo escolhido'
                  }
                </p>

                {secondarySelects.map((select) => {
                  const selectedItems = select.selectedItems || [];
                  // Na edição, mostrar todas as opções (incluindo a selecionada) para o select simples
                  // Na criação, filtrar opções já selecionadas
                  const options = editingVinculado 
                    ? getAllSecondaryOptions(select.primaryType)
                    : getSecondaryOptions(select.primaryType, selectedItems);
                  const primaryLabel = opcoesPrimarias.find(
                    op => op.value === select.primaryType
                  )?.label || select.primaryType;
                  const sameTypeSelects = secondarySelects.filter(s => s.primaryType === select.primaryType);

                  return (
                    <div key={select.id} className="select-group-secondary">
                      <label className="select-label">
                        {primaryLabel}
                      </label>
                      
                      {/* Itens já selecionados */}
                      {selectedItems.length > 0 && (() => {
                        const MAX_VISIBLE_ITEMS = 5;
                        const isExpanded = expandedSelects[select.id] || false;
                        const visibleItems = isExpanded 
                          ? selectedItems 
                          : selectedItems.slice(0, MAX_VISIBLE_ITEMS);
                        const hasMore = selectedItems.length > MAX_VISIBLE_ITEMS;

                        return (
                          <div className="selected-items-container">
                            {visibleItems.map((itemId) => {
                              // Na edição, não mostrar botão de remover se houver apenas um item
                              const canRemove = !editingVinculado || selectedItems.length > 1;
                              
                              return (
                                <div key={itemId} className="selected-item-tag">
                                  <span>{getItemLabel(select.primaryType, itemId)}</span>
                                  {canRemove && (
                                    <button
                                      type="button"
                                      className="btn-remove-tag"
                                      onClick={() => removeSelectedItem(select.id, itemId)}
                                      title="Remover item"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {hasMore && (
                              <button
                                type="button"
                                className="btn-expand-items"
                                onClick={() => setExpandedSelects(prev => ({
                                  ...prev,
                                  [select.id]: !isExpanded
                                }))}
                                title={isExpanded ? "Mostrar menos" : `Mostrar mais (${selectedItems.length - MAX_VISIBLE_ITEMS} itens)`}
                              >
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                <span>
                                  {isExpanded 
                                    ? 'Mostrar menos' 
                                    : `+${selectedItems.length - MAX_VISIBLE_ITEMS} mais`
                                  }
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <div className="select-wrapper">
                        <CustomSelect
                          value={editingVinculado && selectedItems.length > 0 ? selectedItems[0] : select.value}
                          options={options}
                          onChange={(e) => updateSecondarySelect(select.id, e.target.value)}
                          placeholder={editingVinculado ? "Trocar item selecionado" : "Selecione um item"}
                          disabled={loading || options.length === 0}
                          keepOpen={!editingVinculado}
                          selectedItems={(select.selectedItems || []).map(item => String(item))}
                          onSelectAll={editingVinculado ? undefined : () => handleSelectAll(select.id)}
                          hideCheckboxes={editingVinculado}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setPrimaryConfirmed(false);
                    setSecondarySelects([]);
                  }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleClose(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={loading || submitting}
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      Salvar Vinculação
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VinculacaoModal;

