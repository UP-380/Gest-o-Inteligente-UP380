import React, { useMemo, useState } from 'react';
import { useToast } from '../../../hooks/useToast';
import RichTextEditor from '../../common/RichTextEditor';

const API_BASE_URL = '/api';

const VinculacoesContent = ({ vinculacoes, clienteId, onObservacaoUpdated, expandAll }) => {
  const showToast = useToast();
  const [expandedObservacao, setExpandedObservacao] = useState(null); // { subtarefaId: X }
  const [observacoesEditando, setObservacoesEditando] = useState({}); // { subtarefaId: { observacao: '', saving: false } }

  // Estado para controlar quais produtos estão expandidos
  const [expandedProducts, setExpandedProducts] = useState(new Set());

  // Agrupar vinculações por produto (ou sem produto)
  const vinculacoesAgrupadas = useMemo(() => {
    if (!vinculacoes || vinculacoes.length === 0) return [];

    const grupos = new Map();

    vinculacoes.forEach(vinculo => {
      const produtoId = vinculo.produto?.id || 'sem-produto';
      const produtoNome = vinculo.produto?.nome || 'Sem Produto';

      if (!grupos.has(produtoId)) {
        grupos.set(produtoId, {
          produto: vinculo.produto ? { id: vinculo.produto.id, nome: vinculo.produto.nome } : null,
          tiposTarefa: new Map()
        });
      }

      const grupo = grupos.get(produtoId);

      // Agrupar por tipo de tarefa
      const tipoTarefaId = vinculo.tipoTarefa?.id || 'sem-tipo';
      const tipoTarefaNome = vinculo.tipoTarefa?.nome || 'Sem Tipo de Tarefa';

      if (!grupo.tiposTarefa.has(tipoTarefaId)) {
        grupo.tiposTarefa.set(tipoTarefaId, {
          tipoTarefa: vinculo.tipoTarefa ? { id: vinculo.tipoTarefa.id, nome: vinculo.tipoTarefa.nome } : null,
          tarefas: new Map()
        });
      }

      const tipoTarefaGrupo = grupo.tiposTarefa.get(tipoTarefaId);

      // Agrupar por tarefa
      if (vinculo.tarefa) {
        const tarefaId = vinculo.tarefa.id;
        if (!tipoTarefaGrupo.tarefas.has(tarefaId)) {
          tipoTarefaGrupo.tarefas.set(tarefaId, {
            tarefa: {
              id: vinculo.tarefa.id,
              nome: vinculo.tarefa.nome,
              descricao: vinculo.tarefa.descricao
            },
            subtarefas: []
          });
        }

        // Adicionar subtarefa se houver
        if (vinculo.subtarefa) {
          tipoTarefaGrupo.tarefas.get(tarefaId).subtarefas.push({
            id: vinculo.subtarefa.id,
            nome: vinculo.subtarefa.nome,
            descricao: vinculo.subtarefa.descricao,
            observacaoParticular: vinculo.subtarefa.observacaoParticular || null
          });
        }
      }
    });

    // Converter Maps para arrays
    return Array.from(grupos.values()).map(grupo => ({
      ...grupo,
      tiposTarefa: Array.from(grupo.tiposTarefa.values()).map(tipo => ({
        ...tipo,
        tarefas: Array.from(tipo.tarefas.values())
      }))
    }));
  }, [vinculacoes]);

  // Efeito para sincronizar com o expandAll do pai
  React.useEffect(() => {
    if (expandAll === true) {
      const allIds = vinculacoesAgrupadas.map((g, i) => g.produto?.id || `sem-produto-${i}`);
      setExpandedProducts(new Set(allIds));
    } else if (expandAll === false) {
      setExpandedProducts(new Set());
    }
  }, [expandAll, vinculacoesAgrupadas]);

  const toggleProduct = (productId) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Função para salvar observação
  const handleSalvarObservacao = async (e, subtarefaId, subtarefaNome) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!clienteId || !subtarefaId) {
      showToast('error', 'ID do cliente e subtarefa são obrigatórios');
      return;
    }

    const observacao = observacoesEditando[subtarefaId]?.observacao || '';

    setObservacoesEditando(prev => ({
      ...prev,
      [subtarefaId]: { ...prev[subtarefaId], saving: true }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/cliente-subtarefa-observacao`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          cliente_id: clienteId,
          subtarefa_id: subtarefaId,
          observacao: observacao.trim() || null
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('success', observacao.trim() ? 'Observação salva com sucesso!' : 'Observação removida com sucesso!');
        setExpandedObservacao(null);
        setObservacoesEditando(prev => {
          const newState = { ...prev };
          delete newState[subtarefaId];
          return newState;
        });
        if (onObservacaoUpdated) {
          onObservacaoUpdated();
        }
      } else {
        throw new Error(result.error || 'Erro ao salvar observação');
      }
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      showToast('error', error.message || 'Erro ao salvar observação. Tente novamente.');
    } finally {
      setObservacoesEditando(prev => ({
        ...prev,
        [subtarefaId]: { ...prev[subtarefaId], saving: false }
      }));
    }
  };

  // Função para deletar observação
  const handleDeletarObservacao = async (e, subtarefaId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!clienteId || !subtarefaId) {
      return;
    }

    if (!window.confirm('Deseja realmente remover esta observação particular?')) {
      return;
    }

    setObservacoesEditando(prev => ({
      ...prev,
      [subtarefaId]: { ...prev[subtarefaId], saving: true }
    }));

    try {
      const params = new URLSearchParams({
        cliente_id: clienteId,
        subtarefa_id: subtarefaId
      });

      const response = await fetch(`${API_BASE_URL}/cliente-subtarefa-observacao?${params}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('success', 'Observação removida com sucesso!');
        setExpandedObservacao(null);
        setObservacoesEditando(prev => {
          const newState = { ...prev };
          delete newState[subtarefaId];
          return newState;
        });
        if (onObservacaoUpdated) {
          onObservacaoUpdated();
        }
      } else {
        throw new Error(result.error || 'Erro ao remover observação');
      }
    } catch (error) {
      console.error('Erro ao remover observação:', error);
      showToast('error', error.message || 'Erro ao remover observação. Tente novamente.');
    } finally {
      setObservacoesEditando(prev => ({
        ...prev,
        [subtarefaId]: { ...prev[subtarefaId], saving: false }
      }));
    }
  };

  // Função para expandir/colapsar formulário de observação
  const toggleExpandedObservacao = (e, subtarefaId, observacaoAtual) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (expandedObservacao === subtarefaId) {
      setExpandedObservacao(null);
      setObservacoesEditando(prev => {
        const newState = { ...prev };
        delete newState[subtarefaId];
        return newState;
      });
    } else {
      setExpandedObservacao(subtarefaId);
      setObservacoesEditando(prev => ({
        ...prev,
        [subtarefaId]: { observacao: observacaoAtual || '', saving: false }
      }));
    }
  };

  if (!vinculacoes || vinculacoes.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhuma vinculação encontrada</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      width: '100%'
    }}>
      <style>{`
        .subtarefa-descricao-exibicao ul,
        .subtarefa-descricao-exibicao ol {
          padding-left: 24px !important;
          margin-top: 8px !important;
          margin-bottom: 8px !important;
        }
        .subtarefa-descricao-exibicao li {
          margin-bottom: 6px !important;
          list-style-type: square !important; /* Transforma bolinhas em quadradinhos */
        }
        .subtarefa-descricao-exibicao p {
          margin-bottom: 8px !important;
        }
      `}</style>
      {
        vinculacoesAgrupadas.map((grupo, grupoIndex) => {
          const grupoId = grupo.produto?.id || `sem-produto-${grupoIndex}`;
          const isExpanded = expandedProducts.has(grupoId);

          return (
            <article
              key={grupoId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isExpanded ? '24px' : '0',
                padding: isExpanded ? '24px' : '16px 24px',
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                width: '100%',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Título: Produtos contratos pelo cliente */}
              <header
                onClick={() => toggleProduct(grupoId)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: 0,
                  paddingBottom: isExpanded ? '12px' : '0',
                  borderBottom: isExpanded ? '2px solid #3b82f6' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flex: 1
                }}>
                  <i className="fas fa-box" style={{ color: '#3b82f6', fontSize: '20px' }}></i>
                  {grupo.produto?.nome || 'Sem Produto'}
                </h2>
                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ color: '#9ca3af', fontSize: '14px' }}></i>
              </header>

              {/* Conteúdo: Tipos de Tarefas, Tarefas e Subtarefas */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {grupo.tiposTarefa.map((tipoTarefaGrupo, tipoIndex) => {
                    const tipoTarefaId = tipoTarefaGrupo.tipoTarefa?.id || `sem-tipo-${tipoIndex}`;

                    return (
                      <section key={tipoTarefaId} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Tipo de Tarefas */}
                        <h3 style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          color: '#374151',
                          margin: 0,
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <i className="fas fa-tags" style={{ color: '#10b981', fontSize: '16px' }}></i>
                          {tipoTarefaGrupo.tipoTarefa?.nome || 'Sem Tipo de Tarefa'}
                        </h3>

                        {/* Lista de Tarefas */}
                        {tipoTarefaGrupo.tarefas.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '16px' }}>
                            {tipoTarefaGrupo.tarefas.map((tarefaGrupo) => {
                              const tarefaId = tarefaGrupo.tarefa.id;

                              return (
                                <div key={tarefaId} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {/* Tarefas */}
                                  <h4 style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: '#4b5563',
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    <i className="fas fa-list" style={{ color: '#8b5cf6', fontSize: '14px' }}></i>
                                    {tarefaGrupo.tarefa.nome}
                                  </h4>

                                  {/* Descrição das Tarefas */}
                                  {tarefaGrupo.tarefa.descricao && (
                                    <div style={{
                                      padding: '12px',
                                      background: '#f9fafb',
                                      borderRadius: '8px',
                                      border: '1px solid #e5e7eb',
                                      marginLeft: '24px'
                                    }}>
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        fontWeight: 600,
                                        marginBottom: '8px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        Descrição das Tarefas
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '14px',
                                          color: '#374151',
                                          lineHeight: '1.6',
                                          wordBreak: 'break-word'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: tarefaGrupo.tarefa.descricao }}
                                      />
                                    </div>
                                  )}

                                  {/* Subtarefas */}
                                  {tarefaGrupo.subtarefas.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: '24px' }}>
                                      <div style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#4b5563',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        <i className="fas fa-tasks" style={{ color: '#f59e0b', fontSize: '14px' }}></i>
                                        Subtarefas Checklist
                                      </div>
                                      <ul style={{
                                        listStyle: 'none',
                                        padding: 0,
                                        margin: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                      }}>
                                        {tarefaGrupo.subtarefas.map((subtarefa) => (
                                          <li key={subtarefa.id} style={{
                                            padding: '12px',
                                            background: '#fff',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                          }}>
                                            <div style={{
                                              fontWeight: 600,
                                              color: '#4b5563',
                                              fontSize: '14px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px'
                                            }}>
                                              <i className="fas fa-check-square" style={{
                                                fontSize: '12px',
                                                color: '#f59e0b'
                                              }}></i>
                                              {subtarefa.nome}
                                            </div>
                                            {/* Descrição Subtarefas */}
                                            {subtarefa.descricao && (
                                              <div
                                                className="subtarefa-descricao-exibicao"
                                                style={{
                                                  padding: '12px 12px 12px 14px',
                                                  background: '#fafafa',
                                                  borderRadius: '6px',
                                                  marginLeft: '14px',
                                                  fontSize: '13px',
                                                  color: '#6b7280',
                                                  lineHeight: '1.6',
                                                  wordBreak: 'break-word'
                                                }}
                                                dangerouslySetInnerHTML={{ __html: subtarefa.descricao }}
                                              />
                                            )}
                                            {/* Observação Particular do Cliente */}
                                            {clienteId && (
                                              <div style={{ marginLeft: '14px', marginTop: '12px' }}>
                                                {subtarefa.observacaoParticular && !expandedObservacao && (
                                                  <div
                                                    style={{
                                                      padding: '10px',
                                                      background: '#fff7ed',
                                                      borderRadius: '6px',
                                                      border: '1px solid #fed7aa',
                                                      position: 'relative'
                                                    }}
                                                  >
                                                    <div style={{
                                                      fontSize: '11px',
                                                      color: '#f59e0b',
                                                      fontWeight: 600,
                                                      marginBottom: '6px',
                                                      textTransform: 'uppercase',
                                                      letterSpacing: '0.5px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'space-between'
                                                    }}>
                                                      <span>
                                                        <i className="fas fa-star" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                                                        Observação Particular do Cliente
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => toggleExpandedObservacao(e, subtarefa.id, subtarefa.observacaoParticular)}
                                                        style={{
                                                          background: 'transparent',
                                                          border: 'none',
                                                          color: '#f59e0b',
                                                          cursor: 'pointer',
                                                          padding: '2px 6px',
                                                          fontSize: '11px',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '4px'
                                                        }}
                                                        title="Editar observação particular"
                                                      >
                                                        <i className="fas fa-edit" style={{ fontSize: '10px' }}></i>
                                                        Editar
                                                      </button>
                                                    </div>
                                                    <div
                                                      style={{
                                                        fontSize: '13px',
                                                        color: '#4b5563',
                                                        lineHeight: '1.6',
                                                        wordBreak: 'break-word'
                                                      }}
                                                      dangerouslySetInnerHTML={{ __html: subtarefa.observacaoParticular }}
                                                    />
                                                  </div>
                                                )}

                                                {/* Formulário inline expandido */}
                                                {expandedObservacao === subtarefa.id && (
                                                  <div style={{
                                                    padding: '12px',
                                                    background: '#f9fafb',
                                                    borderRadius: '8px',
                                                    border: '1px solid #d1d5db',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '12px'
                                                  }}>
                                                    <div style={{
                                                      fontSize: '12px',
                                                      color: '#f59e0b',
                                                      fontWeight: 600,
                                                      textTransform: 'uppercase',
                                                      letterSpacing: '0.5px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '6px'
                                                    }}>
                                                      <i className="fas fa-star" style={{ fontSize: '10px' }}></i>
                                                      Observação Particular do Cliente
                                                    </div>
                                                    <RichTextEditor
                                                      value={observacoesEditando[subtarefa.id]?.observacao || ''}
                                                      onChange={(value) => setObservacoesEditando(prev => ({
                                                        ...prev,
                                                        [subtarefa.id]: { ...prev[subtarefa.id], observacao: value }
                                                      }))}
                                                      placeholder="Digite a observação particular desta subtarefa para este cliente..."
                                                      disabled={observacoesEditando[subtarefa.id]?.saving}
                                                      minHeight={200}
                                                      showFloatingToolbar={true}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                      {subtarefa.observacaoParticular && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => handleDeletarObservacao(e, subtarefa.id)}
                                                          disabled={observacoesEditando[subtarefa.id]?.saving}
                                                          style={{
                                                            background: 'transparent',
                                                            border: '1px solid #ef4444',
                                                            color: '#ef4444',
                                                            cursor: observacoesEditando[subtarefa.id]?.saving ? 'not-allowed' : 'pointer',
                                                            padding: '8px 16px',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            opacity: observacoesEditando[subtarefa.id]?.saving ? 0.5 : 1
                                                          }}
                                                        >
                                                          <i className="fas fa-trash" style={{ fontSize: '11px' }}></i>
                                                          Remover
                                                        </button>
                                                      )}
                                                      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => toggleExpandedObservacao(e, subtarefa.id, subtarefa.observacaoParticular)}
                                                          disabled={observacoesEditando[subtarefa.id]?.saving}
                                                          style={{
                                                            background: '#fff',
                                                            border: '1px solid #d1d5db',
                                                            color: '#374151',
                                                            cursor: observacoesEditando[subtarefa.id]?.saving ? 'not-allowed' : 'pointer',
                                                            padding: '8px 16px',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            opacity: observacoesEditando[subtarefa.id]?.saving ? 0.5 : 1
                                                          }}
                                                        >
                                                          Cancelar
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => handleSalvarObservacao(e, subtarefa.id, subtarefa.nome)}
                                                          disabled={observacoesEditando[subtarefa.id]?.saving}
                                                          style={{
                                                            background: '#f59e0b',
                                                            border: 'none',
                                                            color: '#fff',
                                                            cursor: observacoesEditando[subtarefa.id]?.saving ? 'not-allowed' : 'pointer',
                                                            padding: '8px 16px',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            opacity: observacoesEditando[subtarefa.id]?.saving ? 0.5 : 1
                                                          }}
                                                        >
                                                          {observacoesEditando[subtarefa.id]?.saving ? (
                                                            <>
                                                              <i className="fas fa-spinner fa-spin" style={{ fontSize: '11px' }}></i>
                                                              Salvando...
                                                            </>
                                                          ) : (
                                                            <>
                                                              <i className="fas fa-save" style={{ fontSize: '11px' }}></i>
                                                              Salvar
                                                            </>
                                                          )}
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Botão para adicionar observação particular (quando não está expandido e não tem observação) */}
                                                {!subtarefa.observacaoParticular && expandedObservacao !== subtarefa.id && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => toggleExpandedObservacao(e, subtarefa.id, null)}
                                                    style={{
                                                      background: 'transparent',
                                                      border: '1px dashed #fed7aa',
                                                      color: '#f59e0b',
                                                      cursor: 'pointer',
                                                      padding: '8px 12px',
                                                      borderRadius: '6px',
                                                      fontSize: '12px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      width: '100%',
                                                      justifyContent: 'center',
                                                      transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.target.style.background = '#fff7ed';
                                                      e.target.style.borderColor = '#f59e0b';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.target.style.background = 'transparent';
                                                      e.target.style.borderColor = '#fed7aa';
                                                    }}
                                                    title="Adicionar observação particular"
                                                  >
                                                    <i className="fas fa-plus-circle" style={{ fontSize: '11px' }}></i>
                                                    Adicionar Observação Particular
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{
                            fontSize: '14px',
                            color: '#9ca3af',
                            fontStyle: 'italic',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            Nenhuma tarefa vinculada
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })
      }
    </div >
  );
};

export default VinculacoesContent;

