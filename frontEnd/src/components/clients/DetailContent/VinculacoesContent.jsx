import React, { useMemo } from 'react';

const VinculacoesContent = ({ vinculacoes }) => {
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
            descricao: vinculo.subtarefa.descricao
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
      {vinculacoesAgrupadas.map((grupo, grupoIndex) => {
        const grupoId = grupo.produto?.id || `sem-produto-${grupoIndex}`;

        return (
          <article
            key={grupoId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '24px',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              width: '100%'
            }}
          >
            {/* Título: Produtos contratos pelo cliente */}
            <header>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#111827',
                margin: 0,
                paddingBottom: '12px',
                borderBottom: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="fas fa-box" style={{ color: '#3b82f6', fontSize: '20px' }}></i>
                {grupo.produto?.nome || 'Sem Produto'}
              </h2>
            </header>

            {/* Conteúdo: Tipos de Tarefas, Tarefas e Subtarefas */}
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
                                          <i className="fas fa-circle" style={{ 
                                            fontSize: '6px', 
                                            color: '#f59e0b'
                                          }}></i>
                                          {subtarefa.nome}
                                        </div>
                                        {/* Descrição Subtarefas */}
                                        {subtarefa.descricao && (
                                          <div 
                                            style={{
                                              padding: '10px',
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
          </article>
        );
      })}
    </div>
  );
};

export default VinculacoesContent;

