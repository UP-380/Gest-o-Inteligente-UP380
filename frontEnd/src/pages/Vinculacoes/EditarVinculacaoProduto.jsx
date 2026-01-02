import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import './Vinculacoes.css';
import './VinculacoesGrupo.css';
import '../CadastroProdutos/CadastroProdutos.css';

const API_BASE_URL = '/api';

const EditarVinculacaoProduto = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  
  // Dados do grupo recebidos via location.state
  const grupoData = location.state;
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tarefas, setTarefas] = useState([]);
  const [tarefasVinculadasProduto, setTarefasVinculadasProduto] = useState([]); // [{ id, nome, vinculadoId }]
  
  // Estado local para edição (produto) - lista simples de tarefas
  const [tarefasEditadas, setTarefasEditadas] = useState([]); // [{ id, nome, vinculadoId }]
  const [adicionandoTarefa, setAdicionandoTarefa] = useState(false);
  const [mostrarTodasTarefas, setMostrarTodasTarefas] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  
  // Estado inicial para comparação no salvamento
  const [initialState, setInitialState] = useState(null);

  // Inicializar estado com dados do grupo
  useEffect(() => {
    if (grupoData && grupoData.tiposTarefa && Array.isArray(grupoData.tiposTarefa)) {
      console.log('📋 Dados recebidos do grupo:', grupoData);
      // Extrair todas as tarefas dos tipos de tarefa e criar uma lista simples
      const todasTarefas = [];
      grupoData.tiposTarefa.forEach(tipoTarefa => {
        if (Array.isArray(tipoTarefa.tarefas)) {
          tipoTarefa.tarefas.forEach(tarefa => {
            todasTarefas.push({
              id: tarefa.id,
              nome: tarefa.nome,
              vinculadoId: tarefa.vinculadoId || null
            });
          });
        }
      });
      setTarefasEditadas(todasTarefas);
      setInitialState(JSON.parse(JSON.stringify(todasTarefas)));
    } else {
      console.warn('⚠️ Dados do grupo não correspondem ao esperado:', grupoData);
    }
  }, [grupoData]);

  // Carregar dados das APIs
  useEffect(() => {
    loadAllData();
  }, []);

  // Carregar tarefas vinculadas ao produto
  useEffect(() => {
    if (grupoData?.itemPrincipal?.id) {
      loadTarefasVinculadas();
    }
  }, [grupoData]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Carregar todas as tarefas
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
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showToast('error', 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const loadTarefasVinculadas = async () => {
    if (!grupoData) return;

    try {
      // Carregar tarefas vinculadas ao produto (cp_cliente = null)
      const produtoId = grupoData.itemPrincipal.id;
      const response = await fetch(`${API_BASE_URL}/tarefas-por-produtos?produtoIds=${produtoId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const produtoData = result.data.find(item => item.produtoId === produtoId);
          setTarefasVinculadasProduto(produtoData?.tarefas || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas vinculadas:', error);
    }
  };

  // Funções para gerenciar tarefas (produto)
  const iniciarAdicionarTarefa = () => {
    setAdicionandoTarefa(true);
    setMostrarTodasTarefas(false);
    setTarefaSelecionada(null);
  };

  const cancelarAdicionarTarefa = () => {
    setAdicionandoTarefa(false);
    setMostrarTodasTarefas(false);
    setTarefaSelecionada(null);
  };

  const toggleMostrarTodasTarefas = () => {
    setMostrarTodasTarefas(prev => !prev);
  };

  const selecionarTarefa = (tarefaId) => {
    setTarefaSelecionada(tarefaId);
  };

  const confirmarAdicionarTarefa = () => {
    if (!tarefaSelecionada) {
      showToast('warning', 'Selecione uma tarefa para adicionar.');
      return;
    }

    // Verificar se tarefa já está vinculada
    if (tarefasEditadas.find(t => t.id === tarefaSelecionada)) {
      showToast('warning', 'Esta tarefa já está vinculada ao produto.');
      cancelarAdicionarTarefa();
      return;
    }

    // Encontrar nome da tarefa
    const tarefa = tarefas.find(t => t.id === tarefaSelecionada);
    if (!tarefa) {
      showToast('error', 'Tarefa não encontrada.');
      return;
    }

    // Adicionar tarefa ao estado local
    setTarefasEditadas(prev => [...prev, {
      id: tarefaSelecionada,
      nome: tarefa.nome || tarefa.tarefa_nome,
      vinculadoId: null // Será criado ao salvar
    }]);

    cancelarAdicionarTarefa();
    showToast('success', 'Tarefa adicionada. Clique em "Salvar" para confirmar.');
  };

  const removerTarefa = (tarefaId) => {
    setTarefasEditadas(prev => prev.filter(t => t.id !== tarefaId));
  };

  const getTarefasDisponiveis = () => {
    if (mostrarTodasTarefas) {
      return tarefas;
    } else {
      return tarefasVinculadasProduto;
    }
  };

  const handleSave = async () => {
    if (!grupoData) {
      showToast('error', 'Dados do grupo inválidos.');
      return;
    }

    setSubmitting(true);
    
    try {
      // Editar tarefas padrão do produto (cp_cliente = null) - lista simples
      const produtoId = grupoData.itemPrincipal.id;
      const estadoInicial = initialState || [];
      const estadoFinal = tarefasEditadas;

      // Comparar tarefas
      const tarefasIniciais = new Set(estadoInicial.filter(t => t.vinculadoId).map(t => t.id));
      const tarefasFinais = new Set(estadoFinal.map(t => t.id));

      const tarefasAdicionadas = [];
      const tarefasRemovidas = [];

      // Tarefas adicionadas
      tarefasFinais.forEach(tarefaId => {
        if (!tarefasIniciais.has(tarefaId)) {
          tarefasAdicionadas.push(tarefaId);
        }
      });

      // Tarefas removidas
      tarefasIniciais.forEach(tarefaId => {
        if (!tarefasFinais.has(tarefaId)) {
          const tarefa = estadoInicial.find(t => t.id === tarefaId);
          if (tarefa?.vinculadoId) {
            tarefasRemovidas.push({ vinculadoId: tarefa.vinculadoId });
          }
        }
      });

      // Remover tarefas
      for (const { vinculadoId } of tarefasRemovidas) {
        try {
          await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        } catch (error) {
          console.error(`Erro ao remover tarefa vinculadoId ${vinculadoId}:`, error);
        }
      }

      // Adicionar tarefas diretamente ao produto (sem tipo de tarefa)
      if (tarefasAdicionadas.length > 0) {
        const novosVinculados = tarefasAdicionadas.map(tarefaId => ({
          cp_produto: produtoId,
          cp_tarefa: tarefaId,
          cp_tarefa_tipo: null,
          cp_cliente: null
        }));

        try {
          const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ vinculados: novosVinculados })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao adicionar tarefas');
          }
        } catch (error) {
          console.error('Erro ao adicionar tarefas:', error);
          showToast('error', 'Erro ao adicionar algumas tarefas.');
        }
      }

      showToast('success', 'Vinculações atualizadas com sucesso!');
      // Atualizar estado inicial para refletir as mudanças salvas
      setInitialState(JSON.parse(JSON.stringify(tarefasEditadas)));
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast('error', 'Erro ao salvar vinculações.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!grupoData) {
    return (
      <Layout>
        <div className="vinculacao-page">
          <div className="vinculacao-page-content">
            <p>Dados do grupo não encontrados.</p>
            <button onClick={() => navigate('/cadastro/vinculacoes')} className="btn-secondary">
              Voltar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const produtoNome = grupoData.itemPrincipal?.nome || 'Produto';

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          {/* Header padrão com ícone e título */}
          <div className="cadastro-listing-page-header">
            <div className="cadastro-listing-header-content">
              <div className="cadastro-listing-header-left">
                <div className="cadastro-listing-header-icon">
                  <i className="fas fa-box" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                </div>
                <div>
                  <h1 className="cadastro-listing-page-title">Editar Produto: {produtoNome}</h1>
                  <p className="cadastro-listing-page-subtitle">
                    Gerencie as tarefas padrão vinculadas a este produto
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/cadastro/vinculacoes')}
                  disabled={submitting}
                >
                  <i className="fas fa-arrow-left"></i>
                  Voltar
                </button>
                <ButtonPrimary
                  onClick={handleSave}
                  disabled={submitting || loading}
                  icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </ButtonPrimary>
              </div>
            </div>
          </div>

          <div className="vinculacao-page-content">
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <>
                <div className="grupo-edit-produtos">
                  {/* Lista simples de Tarefas Padrão (sem cliente e sem tipo de tarefa) */}
                  <div className="grupo-edit-produto-card">
                    <div className="grupo-edit-produto-header">
                      <div className="grupo-edit-produto-title">
                        <i className="fas fa-list"></i>
                        <span>Tarefas Vinculadas</span>
                      </div>
                    </div>

                    <div className="grupo-edit-produto-body">
                      <div className="grupo-edit-tarefas-list">
                        {tarefasEditadas && tarefasEditadas.length > 0 ? (
                          tarefasEditadas.map(tarefa => (
                            <div key={tarefa.id} className="grupo-edit-tarefa-item">
                              <span>{tarefa.nome}</span>
                              <button
                                onClick={() => removerTarefa(tarefa.id)}
                                className="btn-remove-tarefa"
                                title="Remover tarefa"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="grupo-edit-tarefas-empty">
                            <span>Nenhuma tarefa vinculada a este produto.</span>
                          </div>
                        )}
                      </div>

                      {adicionandoTarefa ? (
                        <div className="grupo-edit-adicionar-tarefa">
                          <div className="grupo-edit-tarefa-options">
                            <button
                              onClick={toggleMostrarTodasTarefas}
                              className="btn-toggle-todas-tarefas"
                            >
                              {mostrarTodasTarefas
                                ? 'Mostrar apenas tarefas vinculadas'
                                : 'Mostrar todas as tarefas'}
                            </button>
                          </div>

                          <div className="grupo-edit-tarefas-select">
                            {getTarefasDisponiveis().map(tarefa => {
                              const jaAdicionada = tarefasEditadas.find(t => t.id === tarefa.id);
                              return (
                                <div
                                  key={tarefa.id}
                                  className={`grupo-edit-tarefa-option ${tarefaSelecionada === tarefa.id ? 'selected' : ''} ${jaAdicionada ? 'disabled' : ''}`}
                                  onClick={() => !jaAdicionada && selecionarTarefa(tarefa.id)}
                                >
                                  <span>{tarefa.nome || tarefa.tarefa_nome}</span>
                                  {jaAdicionada && <span className="badge-added">Já adicionada</span>}
                                </div>
                              );
                            })}
                          </div>

                          <div className="grupo-edit-tarefa-actions">
                            <button
                              onClick={cancelarAdicionarTarefa}
                              className="btn-secondary"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={confirmarAdicionarTarefa}
                              className="btn-primary"
                              disabled={!tarefaSelecionada}
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={iniciarAdicionarTarefa}
                          className="btn-add-tarefa"
                        >
                          <i className="fas fa-plus"></i>
                          Adicionar Tarefa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default EditarVinculacaoProduto;

