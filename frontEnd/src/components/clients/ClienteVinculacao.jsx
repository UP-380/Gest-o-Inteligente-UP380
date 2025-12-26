import React, { useState, useEffect } from 'react';
import CustomSelect from '../vinculacoes/CustomSelect';
import SelectedItemsList from '../vinculacoes/SelectedItemsList';
import ModalFooter from '../vinculacoes/ModalFooter';
import TarefasVinculadasCliente from '../vinculacoes/TarefasVinculadasCliente';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import '../vinculacoes/VinculacaoModal.css';

const API_BASE_URL = '/api';

/**
 * Componente de vinculação para cliente
 * Já vem com "Cliente" pré-selecionado, permite escolher mais um tipo
 */
const ClienteVinculacao = ({ clienteId, onSaveVinculacao }) => {
  const showToast = useToast();
  const [secondarySelects, setSecondarySelects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedSelects, setExpandedSelects] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [tempProdutoItems, setTempProdutoItems] = useState([]);

  // Dados carregados das APIs
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Opções primárias (sem Cliente, pois já está selecionado)
  const opcoesPrimarias = [
    { value: 'produto', label: 'Produto' }
  ];

  // Carregar dados das APIs e inicializar vinculação
  useEffect(() => {
    if (clienteId && !initialized) {
      loadAllData();
    }
  }, [clienteId, initialized]);

  // Inicializar com cliente após carregar dados
  useEffect(() => {
    if (clienteId && clientes.length > 0 && !initialized && secondarySelects.length === 0) {
      initializeWithCliente();
      setInitialized(true);
    }
  }, [clienteId, clientes.length, initialized]);

  // Inicializar vinculação com cliente pré-selecionado
  const initializeWithCliente = () => {
    if (clienteId) {
      // Criar select secundário para cliente já pré-selecionado
      setSecondarySelects([{
        id: 'secondary-cliente',
        primaryType: 'cliente',
        value: '',
        selectedItems: [String(clienteId)]
      }]);
    }
  };

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
        
        // Garantir que o cliente atual está na lista
        const clienteAtual = clientesComDados.find(c => String(c.id) === String(clienteId));
        if (!clienteAtual && clienteId) {
          // Se o cliente atual não estiver na lista, adicionar
          clientesComDados.push({
            id: clienteId,
            nome: `Cliente #${String(clienteId).substring(0, 8)}...`
          });
        }
        
        setClientes(clientesComDados);
      } else if (clienteId) {
        // Se não conseguiu carregar, pelo menos adicionar o cliente atual
        setClientes([{
          id: clienteId,
          nome: `Cliente #${String(clienteId).substring(0, 8)}...`
        }]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obter todas as opções do select secundário baseado no tipo primário (sem filtro)
  const getAllSecondaryOptions = (primaryType) => {
    switch (primaryType) {
      case 'produto':
        return produtos.map(p => ({ value: p.id, label: p.nome }));
      case 'cliente':
        return clientes.map(c => ({ value: c.id, label: c.nome }));
      default:
        return [];
    }
  };

  // Obter opções do select secundário baseado no tipo primário (com filtro)
  const getSecondaryOptions = (primaryType, excludeValues = []) => {
    const options = getAllSecondaryOptions(primaryType);
    // Filtrar itens já selecionados
    return options.filter(opt => !excludeValues.includes(String(opt.value)));
  };

  // Obter label de um item pelo ID
  const getItemLabel = (primaryType, itemId) => {
    if (primaryType === 'cliente' && String(itemId) === String(clienteId)) {
      // Se for o cliente atual e ainda não carregou a lista, retornar um placeholder
      const options = getAllSecondaryOptions(primaryType);
      const option = options.find(opt => String(opt.value) === String(itemId));
      return option ? option.label : `Cliente #${itemId.substring(0, 8)}...`;
    }
    const options = getAllSecondaryOptions(primaryType);
    const option = options.find(opt => String(opt.value) === String(itemId));
    return option ? option.label : itemId;
  };

  // Confirmar select primário (para adicionar outro tipo além do cliente) - DEPRECADO
  // Agora o produto é adicionado diretamente via onChange do select
  const handleConfirmPrimary = (selectedType) => {
    // Esta função não é mais usada, mas mantida para compatibilidade
    if (!selectedType) {
      return;
    }

    // Verificar se já existe um select secundário deste tipo
    const alreadyExists = secondarySelects.some(s => s.primaryType === selectedType);
    if (alreadyExists) {
      showToast('warning', 'Este tipo já foi adicionado');
      return;
    }

    // Adicionar novo select secundário para o tipo escolhido
    const newSecondarySelect = {
      id: `secondary-${Date.now()}`,
      primaryType: selectedType,
      value: '',
      selectedItems: []
    };

    setSecondarySelects([...secondarySelects, newSecondarySelect]);
  };

  // Atualizar valor do select secundário
  const handleUpdateSecondary = (selectId, value) => {
    if (!value) return;
    
    setSecondarySelects(prev => prev.map(s => {
      if (s.id === selectId) {
        const selectedItems = s.selectedItems || [];
        if (!selectedItems.includes(value)) {
          return { ...s, value: '', selectedItems: [...selectedItems, value] };
        }
      }
      return s;
    }));
  };

  // Remover item selecionado
  const handleRemoveItem = (selectId, itemValue) => {
    setSecondarySelects(prev => prev.map(s => {
      if (s.id === selectId) {
        const newSelectedItems = (s.selectedItems || []).filter(item => item !== itemValue);
        // Se for produto e não houver mais itens, remover o select
        if (s.primaryType === 'produto' && newSelectedItems.length === 0) {
          return null; // Marcar para remover
        }
        return {
          ...s,
          selectedItems: newSelectedItems
        };
      }
      return s;
    }).filter(s => s !== null)); // Remover selects marcados como null
  };

  // Selecionar todos os itens
  const handleSelectAll = (selectId) => {
    setSecondarySelects(prev => prev.map(s => {
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


  // Remover select secundário
  const handleRemoveSecondarySelect = (selectId) => {
    // Não permitir remover o select do cliente
    if (selectId === 'secondary-cliente') {
      showToast('warning', 'Não é possível remover o cliente da vinculação');
      return;
    }
    setSecondarySelects(prev => prev.filter(s => s.id !== selectId));
  };

  // Salvar vinculação (pode ser chamada externamente)
  const handleSave = React.useCallback(async () => {
    // Verificar se há pelo menos um select secundário com itens selecionados (além do cliente)
    const hasOtherSelections = secondarySelects.some(s => 
      s.primaryType !== 'cliente' && s.selectedItems && s.selectedItems.length > 0
    );

    if (!hasOtherSelections) {
      // Se não há seleções, retornar sucesso (não há nada para salvar)
      return { success: true, skipped: true };
    }

    if (!clienteId) {
      return { success: false, error: 'ID do cliente não encontrado.' };
    }

    setSubmitting(true);

    try {
      // 1. Salvar na tabela cp_vinculacao (valores booleanos)
      const tiposSelecionados = secondarySelects.map(s => s.primaryType);
      const dadosVinculacao = {
        cp_produto: tiposSelecionados.includes('produto'),
        cp_cliente: tiposSelecionados.includes('cliente')
      };

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
        return { success: false, error: 'Não autorizado' };
      }

      const contentTypeVinculacao = responseVinculacao.headers.get('content-type') || '';
      if (!contentTypeVinculacao.includes('application/json')) {
        const text = await responseVinculacao.text();
        return { success: false, error: text || `Erro no servidor. Status: ${responseVinculacao.status}` };
      }

      const resultVinculacao = await responseVinculacao.json();

      if (!responseVinculacao.ok) {
        const errorMsg = resultVinculacao.error || resultVinculacao.details || resultVinculacao.message || `Erro HTTP ${responseVinculacao.status}`;
        return { success: false, error: errorMsg };
      }

      // 2. Criar combinações com o cliente
      const toNumber = (id) => {
        if (id === null || id === undefined || id === '') return null;
        const num = parseInt(String(id).trim(), 10);
        return isNaN(num) ? null : num;
      };

      const toString = (id) => {
        if (id === null || id === undefined || id === '') return null;
        return String(id).trim();
      };

      // Separar os selects por tipo
      const clienteSelect = secondarySelects.find(s => s.primaryType === 'cliente');
      const outrosSelects = secondarySelects.filter(s => s.primaryType !== 'cliente');

      // Obter IDs do cliente
      const clienteIds = (clienteSelect?.selectedItems || []).map(toString).filter(id => id !== null);
      if (clienteIds.length === 0) {
        clienteIds.push(String(clienteId).trim());
      }

      // 2.5. Deletar vinculações antigas do cliente antes de salvar as novas
      // Buscar todas as vinculações existentes deste cliente
      const responseVinculadosExistentes = await fetch(`${API_BASE_URL}/vinculados?filtro_cliente=true&limit=1000`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (responseVinculadosExistentes.ok) {
        const resultExistentes = await responseVinculadosExistentes.json();
        if (resultExistentes.success && resultExistentes.data) {
          // Filtrar apenas vinculações deste cliente específico
          const clienteIdStr = String(clienteId).trim();
          const vinculadosDoCliente = resultExistentes.data.filter(v => 
            v.cp_cliente && String(v.cp_cliente).trim() === clienteIdStr
          );

          // Deletar cada vinculação antiga
          if (vinculadosDoCliente.length > 0) {
            console.log(`🗑️ Removendo ${vinculadosDoCliente.length} vinculação(ões) antiga(s) do cliente ${clienteIdStr}`);
            for (const vinculado of vinculadosDoCliente) {
              try {
                await fetch(`${API_BASE_URL}/vinculados/${vinculado.id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                  headers: { 'Accept': 'application/json' }
                });
              } catch (error) {
                console.error(`Erro ao deletar vinculado ${vinculado.id}:`, error);
              }
            }
          }
        }
      }

      // 3. Criar todas as combinações
      const combinacoes = [];
      
      console.log('📋 Criando combinações:', {
        clienteIds,
        outrosSelects: outrosSelects.map(s => ({
          tipo: s.primaryType,
          selectedItems: s.selectedItems,
          selectedItemsLength: (s.selectedItems || []).length
        }))
      });
      
      // Para cada cliente
      clienteIds.forEach(clienteIdStr => {
        // Para cada outro tipo de select
        outrosSelects.forEach(select => {
          const selectedItems = (select.selectedItems || []).map(item => {
            if (select.primaryType === 'cliente') {
              return toString(item);
            }
            return toNumber(item);
          }).filter(id => id !== null);

          console.log(`📦 Select ${select.primaryType}: ${selectedItems.length} item(s) selecionado(s)`, selectedItems);

          // Para cada item selecionado neste tipo
          selectedItems.forEach(itemId => {
            const combinacao = {
              cp_cliente: clienteIdStr,
              cp_produto: null
            };

            if (select.primaryType === 'produto') {
              combinacao.cp_produto = itemId;
            }

            combinacoes.push(combinacao);
          });
        });
      });

      console.log(`💾 Salvando ${combinacoes.length} nova(s) vinculação(ões) para o cliente ${clienteId}:`, combinacoes);

      // 4. Salvar na tabela vinculados
      if (combinacoes.length > 0) {
        const responseVinculados = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            vinculados: combinacoes
          }),
        });

        if (responseVinculados.status === 401) {
          window.location.href = '/login';
          return { success: false, error: 'Não autorizado' };
        }

        const contentTypeVinculados = responseVinculados.headers.get('content-type') || '';
        if (!contentTypeVinculados.includes('application/json')) {
          const text = await responseVinculados.text();
        } else {
          const resultVinculados = await responseVinculados.json();
          
          if (!responseVinculados.ok) {
          } else {
          }
        }
      }

      if (resultVinculacao.success) {
        // Não resetar os selects após salvar - permite adicionar mais vinculações
        // Apenas limpar o estado de expansão
        setExpandedSelects({});
        return { success: true };
      } else {
        const errorMsg = resultVinculacao.error || resultVinculacao.details || 'Erro ao salvar vinculação';
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Erro ao salvar vinculação:', error);
      return { success: false, error: error.message || 'Erro ao salvar vinculação. Verifique sua conexão e tente novamente.' };
    } finally {
      setSubmitting(false);
    }
  }, [clienteId, secondarySelects, showToast]);

  // Expor função de salvar para o componente pai
  React.useEffect(() => {
    if (onSaveVinculacao) {
      onSaveVinculacao(handleSave);
    }
  }, [onSaveVinculacao, handleSave]);

  if (!clienteId) return null;

  return (
    <div className="cliente-vinculacao-section" style={{ marginTop: '32px' }}>
      <h4 className="section-title" style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginTop: '0', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>Vincular Cliente</h4>
      <p className="section-description" style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
        Vincule este cliente a produtos, tarefas ou tipos de tarefa
      </p>

      {/* Mostrar selects secundários */}
      {secondarySelects.map((select) => (
        <div key={select.id} className="select-group-secondary" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="select-label">
              {select.primaryType === 'cliente' ? 'Cliente' : 
               opcoesPrimarias.find(op => op.value === select.primaryType)?.label || select.primaryType}
            </label>
            {select.primaryType !== 'cliente' && (
              <button
                type="button"
                onClick={() => handleRemoveSecondarySelect(select.id)}
                className="btn-icon"
                style={{ fontSize: '12px', padding: '4px 8px' }}
                title="Remover este tipo"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
          
          {select.primaryType === 'cliente' && (
            <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '4px', fontSize: '12px', color: '#0369a1' }}>
              <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
              Cliente pré-selecionado: {getItemLabel('cliente', String(clienteId))}
            </div>
          )}

          {select.primaryType !== 'cliente' && (
            <>
              <SelectedItemsList
                items={select.selectedItems || []}
                getItemLabel={(itemId) => getItemLabel(select.primaryType, itemId)}
                onRemoveItem={(itemId) => handleRemoveItem(select.id, itemId)}
                canRemove={true}
                isExpanded={expandedSelects[select.id] || false}
                onToggleExpand={() => setExpandedSelects(prev => ({
                  ...prev,
                  [select.id]: !prev[select.id]
                }))}
              />

              <div className="select-wrapper">
                <CustomSelect
                  value={select.value}
                  options={getSecondaryOptions(select.primaryType, select.selectedItems || [])}
                  onChange={(e) => handleUpdateSecondary(select.id, e.target.value)}
                  placeholder="Selecione um item"
                  disabled={loading || submitting}
                  keepOpen={false}
                  selectedItems={(select.selectedItems || []).map(item => String(item))}
                  onSelectAll={() => handleSelectAll(select.id)}
                  hideCheckboxes={false}
                  maxVisibleOptions={5}
                  enableSearch={true}
                />
              </div>
              
              {/* Exibir tarefas vinculadas se for select de produto */}
              {select.primaryType === 'produto' && (select.selectedItems || []).length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#0e3b6f', 
                    marginBottom: '12px',
                    fontSize: '14px',
                    borderBottom: '1px solid #dee2e6',
                    paddingBottom: '8px'
                  }}>
                    <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                    Tarefas Vinculadas aos Produtos
                  </div>
                  <TarefasVinculadasCliente 
                    clienteId={clienteId}
                    produtos={(select.selectedItems || []).map(produtoIdStr => {
                      const produtoId = parseInt(produtoIdStr, 10);
                      const produto = produtos.find(p => p.id === produtoId);
                      return produto || { id: produtoId, nome: `Produto #${produtoId}` };
                    })}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Adicionar select de produto automaticamente se ainda não existe */}
      {!secondarySelects.some(s => s.primaryType === 'produto') && (
        <div className="select-group-secondary" style={{ marginBottom: '20px' }}>
          <label className="select-label">Produto</label>
          <div className="select-wrapper">
            <CustomSelect
              value=""
              options={getSecondaryOptions('produto', tempProdutoItems)}
              onChange={(e) => {
                if (e.target.value) {
                  const valueStr = String(e.target.value);
                  const newItems = tempProdutoItems.includes(valueStr)
                    ? tempProdutoItems.filter(item => item !== valueStr)
                    : [...tempProdutoItems, valueStr];
                  
                  setTempProdutoItems(newItems);
                  
                  // Se ainda não existe select de produto, criar quando selecionar primeiro item
                  if (newItems.length > 0 && !secondarySelects.some(s => s.primaryType === 'produto')) {
                    const newSecondarySelect = {
                      id: 'secondary-produto',
                      primaryType: 'produto',
                      value: '',
                      selectedItems: newItems
                    };
                    setSecondarySelects(prev => [...prev, newSecondarySelect]);
                    setTempProdutoItems([]);
                  }
                }
              }}
              placeholder="Selecione um item"
              disabled={loading || submitting}
              keepOpen={false}
              selectedItems={tempProdutoItems.map(item => String(item))}
              onSelectAll={() => {
                const allOptions = getAllSecondaryOptions('produto');
                const allValues = allOptions.map(opt => String(opt.value));
                const allSelected = allValues.every(val => tempProdutoItems.includes(val));
                
                const newItems = allSelected ? [] : allValues;
                setTempProdutoItems(newItems);
                
                // Se ainda não existe select de produto, criar quando selecionar todos
                if (newItems.length > 0 && !secondarySelects.some(s => s.primaryType === 'produto')) {
                  const newSecondarySelect = {
                    id: 'secondary-produto',
                    primaryType: 'produto',
                    value: '',
                    selectedItems: newItems
                  };
                  setSecondarySelects(prev => [...prev, newSecondarySelect]);
                  setTempProdutoItems([]);
                }
              }}
              hideCheckboxes={false}
              maxVisibleOptions={5}
              enableSearch={true}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default ClienteVinculacao;

