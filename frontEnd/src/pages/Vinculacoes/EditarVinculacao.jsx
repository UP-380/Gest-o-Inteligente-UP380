import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import { clientesAPI } from '../../services/api';
import PrimarySelectsSection from '../../components/vinculacoes/PrimarySelectsSection';
import SecondarySelectsSection from '../../components/vinculacoes/SecondarySelectsSection';
import '../../components/vinculacoes/VinculacaoModal.css';
import './Vinculacoes.css';

const API_BASE_URL = '/api';

const EditarVinculacao = () => {
  const navigate = useNavigate();
  const { id } = useParams();
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

  // Carregar dados das APIs e do vinculado
  useEffect(() => {
    if (!primaryConfirmed) {
      loadAllData();
      if (id) {
        loadVinculadoData();
      }
    }
  }, [id, primaryConfirmed]);

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

  // Carregar dados do vinculado para edição
  const loadVinculadoData = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/vinculados/${id}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const vinculado = result.data;
          
          // Backend retorna cp_tarefa diretamente (nome correto da coluna no banco)
          const vinculadoMapeado = {
            ...vinculado,
            cp_tarefa: vinculado.cp_tarefa,
            cp_tarefa_tipo: vinculado.cp_tarefa_tipo
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
            } else if (tipo === 'atividade') {
              campoNome = 'cp_tarefa';
            } else if (tipo === 'tipo-tarefa') {
              campoNome = 'cp_tarefa_tipo';
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
        // Remover regras restritivas - permitir qualquer combinação
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
        // Na edição, apenas trocar o item (manter apenas um item selecionado)
        return { ...s, value: '', selectedItems: [value] };
      }
      return s;
    }));
  };

  // Remover item selecionado
  const removeSelectedItem = (selectId, itemValue) => {
    // Na edição, não permitir remover se houver apenas um item
    const select = secondarySelects.find(s => s.id === selectId);
    if (select && (select.selectedItems || []).length <= 1) {
      return; // Não permitir remover o último item na edição
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
    // Na edição, não permitir selecionar todos
    return;
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


  // Criar dados para tabela vinculados
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

    // Na edição, criar apenas uma combinação com os valores selecionados
    const dados = {};

    secondarySelects.forEach(select => {
      const selectedItems = select.selectedItems || [];
      if (selectedItems.length > 0) {
        const valor = selectedItems[0]; // Na edição, apenas um valor
        switch (select.primaryType) {
          case 'produto':
            dados.cp_produto = toNumber(valor);
            break;
          case 'cliente':
            dados.cp_cliente = toString(valor);
            break;
          case 'atividade':
            dados.cp_tarefa = toNumber(valor);
            break;
          case 'tipo-tarefa':
            dados.cp_tarefa_tipo = toNumber(valor);
            break;
        }
      }
    });

    return dados;
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
      // Atualizar na tabela vinculados
      const dadosUpdate = criarDadosVinculados();
      const responseVinculados = await fetch(`${API_BASE_URL}/vinculados/${id}`, {
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
      }

      showToast('success', 'Vinculação atualizada com sucesso!');
      navigate('/cadastro/vinculacoes');
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
          <h1 className="vinculacao-page-title">Editar Vinculação</h1>
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
                isEditing={true}
                onUpdateSelect={updateSecondarySelect}
                onRemoveItem={removeSelectedItem}
                onSelectAll={handleSelectAll}
                expandedSelects={expandedSelects}
                onToggleExpand={handleToggleExpand}
                loading={loading}
                tarefasVinculadas={tarefasVinculadas}
                produtos={produtos}
              />

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

export default EditarVinculacao;

