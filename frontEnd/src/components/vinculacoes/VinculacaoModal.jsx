import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import ModalHeader from './ModalHeader';
import ModalFooter from './ModalFooter';
import PrimarySelectsSection from './PrimarySelectsSection';
import SecondarySelectsSection from './SecondarySelectsSection';
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
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tarefasVinculadas, setTarefasVinculadas] = useState({}); // { produtoId: [{ id, nome }] }

  const opcoesPrimarias = [
    { value: 'produto', label: 'Produto' },
    { value: 'cliente', label: 'Cliente' }
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
        // Garantir que todos os clientes tenham nome e id
        const clientesComDados = clientesResult.data.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome || cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || `Cliente #${cliente.id}`
        }));
        setClientes(clientesComDados);
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
          
          // Mapear nomes antigos das colunas para os novos (backend retorna cp_atividade, frontend espera cp_tarefa)
          const vinculadoMapeado = {
            ...vinculado,
            cp_tarefa: vinculado.cp_atividade || vinculado.cp_tarefa,
            cp_tarefa_tipo: vinculado.cp_atividade_tipo || vinculado.cp_tarefa_tipo
          };
          
          // Determinar tipos primários baseados nos campos preenchidos
          const tiposSelecionados = [];
          if (vinculadoMapeado.cp_tarefa) tiposSelecionados.push('atividade');
          if (vinculadoMapeado.cp_produto) tiposSelecionados.push('produto');
          if (vinculadoMapeado.cp_tarefa_tipo) tiposSelecionados.push('tipo-tarefa');
          if (vinculadoMapeado.cp_cliente) tiposSelecionados.push('cliente');

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
          const newSecondarySelects = tiposSelecionados.map((tipo) => {
            let campoNome;
            if (tipo === 'cliente') {
              campoNome = 'cp_cliente';
            } else {
              campoNome = `cp_${tipo}`;
            }
            
            return {
              id: Math.random(),
              primaryType: tipo,
              selectedItems: vinculadoMapeado[campoNome] 
                ? [vinculadoMapeado[campoNome].toString()]
                : []
            };
          });
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
    setPrimarySelects(primarySelects.map(s => {
      if (s.id === id) {
        return { ...s, value };
      } else {
        // Aplicar regra: Cliente <-> Produto (apenas quando Cliente está selecionado)
        // Produto pode ser vinculado com Cliente OU Atividade
        if (value === 'cliente') {
          // Se selecionou "Cliente", o outro select só pode ter "Produto"
          // Se o outro select não está vazio e não é "Produto", limpar
          if (s.value !== '' && s.value !== 'produto') {
            return { ...s, value: '' };
          }
        } else if (value === 'produto') {
          // Se selecionou "Produto", o outro select pode ter "Cliente" ou "Atividade"
          // Se o outro select não está vazio e não é "Cliente" nem "Atividade", limpar
          if (s.value !== '' && s.value !== 'cliente' && s.value !== 'atividade') {
            return { ...s, value: '' };
          }
        } else {
          // Se selecionou outro tipo (atividade, tipo-tarefa)
          // Se o outro select tem "Cliente" ou "Produto", não precisa limpar (eles podem coexistir com outros tipos)
          // Mas se o valor selecionado já está em outro select, limpar
          if (s.value === value && value !== '') {
            return { ...s, value: '' };
          }
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

  // Buscar tarefas vinculadas aos produtos selecionados
  useEffect(() => {
    const buscarTarefasVinculadas = async () => {
      // Encontrar o select de produtos
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
            // Converter array em objeto { produtoId: tarefas }
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
      cp_tarefa: tiposSelecionados.includes('atividade'),
      cp_produto: tiposSelecionados.includes('produto'),
      cp_tarefa_tipo: tiposSelecionados.includes('tipo-tarefa'),
      cp_cliente: tiposSelecionados.includes('cliente')
    };
  };


  // Criar dados para tabela vinculados (todas as combinações)
  const criarDadosVinculados = () => {
    // Função auxiliar para converter ID para número
    const toNumber = (id) => {
      if (id === null || id === undefined || id === '') return null;
      const num = parseInt(String(id).trim(), 10);
      return isNaN(num) ? null : num;
    };

    // Função auxiliar para converter ID para string (para cp_cliente que é TEXT)
    const toString = (id) => {
      if (id === null || id === undefined || id === '') return null;
      return String(id).trim();
    };

    // Agrupar itens selecionados por tipo
    const produtosIds = [];
    const clientesIds = [];

    secondarySelects.forEach(select => {
      const selectedItems = select.selectedItems || [];
      if (selectedItems.length > 0) {
        switch (select.primaryType) {
          case 'produto':
            produtosIds.push(...selectedItems.map(toNumber).filter(id => id !== null));
            break;
          case 'cliente':
            // cp_cliente é TEXT, então manter como string
            clientesIds.push(...selectedItems.map(toString).filter(id => id !== null));
            break;
        }
      }
    });

    // Criar todas as combinações possíveis
    const combinacoes = [];

    // Função auxiliar para criar combinações base com clientes
    const criarCombinacaoComClientes = (baseCombinacao) => {
      if (clientesIds.length > 0) {
        // Se houver clientes, criar uma combinação para cada cliente
        clientesIds.forEach(clienteId => {
          combinacoes.push({
            ...baseCombinacao,
            cp_cliente: clienteId
          });
        });
      } else {
        // Se não houver clientes, adicionar apenas a combinação base
        combinacoes.push({
          ...baseCombinacao,
          cp_cliente: null
        });
      }
    };

    // Se houver produtos e clientes, criar combinações
    if (produtosIds.length > 0 && clientesIds.length > 0) {
      produtosIds.forEach(produtoId => {
        criarCombinacaoComClientes({
          cp_produto: produtoId
        });
      });
    }

    // Se houver apenas produtos (sem clientes), criar registros individuais
    if (produtosIds.length > 0 && clientesIds.length === 0) {
      produtosIds.forEach(produtoId => {
        combinacoes.push({
          cp_produto: produtoId,
          cp_cliente: null
        });
      });
    }

    // Se houver apenas clientes (sem produtos)
    if (clientesIds.length > 0 && produtosIds.length === 0) {
      clientesIds.forEach(clienteId => {
        combinacoes.push({
          cp_cliente: clienteId,
          cp_produto: null
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
            } else {
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

  // Handler para toggle de expansão
  const handleToggleExpand = (selectId) => {
    setExpandedSelects(prev => ({
      ...prev,
      [selectId]: !prev[selectId]
    }));
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content vinculacao-modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          title={editingVinculado ? 'Editar Vinculação' : 'Nova Vinculação'}
          onClose={handleClose}
          disabled={submitting}
        />

        <div className="modal-body custom-scrollbar">
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

              <ModalFooter
                buttons={[
                  {
                    text: 'Cancelar',
                    className: 'btn-secondary',
                    onClick: () => handleClose(false)
                  },
                  {
                    text: 'Confirmar Seleções',
                    className: 'btn-primary',
                    onClick: confirmPrimarySelects,
                    disabled: loading
                  }
                ]}
                disabled={loading}
              />
            </>
          ) : (
            <>
              <SecondarySelectsSection
                secondarySelects={secondarySelects}
                opcoesPrimarias={opcoesPrimarias}
                getAllSecondaryOptions={getAllSecondaryOptions}
                getSecondaryOptions={getSecondaryOptions}
                getItemLabel={getItemLabel}
                isEditing={!!editingVinculado}
                onUpdateSelect={updateSecondarySelect}
                onRemoveItem={removeSelectedItem}
                onSelectAll={handleSelectAll}
                expandedSelects={expandedSelects}
                onToggleExpand={handleToggleExpand}
                loading={loading}
                tarefasVinculadas={tarefasVinculadas}
                produtos={produtos}
              />

              <ModalFooter
                buttons={[
                  {
                    text: 'Voltar',
                    className: 'btn-secondary',
                    onClick: () => {
                      setPrimaryConfirmed(false);
                      setSecondarySelects([]);
                    }
                  },
                  {
                    text: 'Cancelar',
                    className: 'btn-secondary',
                    onClick: () => handleClose(false),
                    disabled: submitting
                  },
                  {
                    text: 'Salvar',
                    className: 'btn-primary',
                    icon: 'fas fa-save',
                    onClick: handleSave,
                    loading: submitting,
                    loadingText: 'Salvando...',
                    disabled: loading || submitting
                  }
                ]}
                disabled={submitting}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VinculacaoModal;

