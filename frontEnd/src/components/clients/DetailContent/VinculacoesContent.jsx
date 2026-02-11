import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useToast } from '../../../hooks/useToast';
import RichTextEditor from '../../common/RichTextEditor';
import ConfirmModal from '../../common/ConfirmModal';

const API_BASE_URL = '/api';

const VinculacoesContent = ({ vinculacoes, clienteId, onObservacaoUpdated }) => {
  const showToast = useToast();
  const [expandedObservacao, setExpandedObservacao] = useState(null); // { subtarefaId: X }
  const [observacoesEditando, setObservacoesEditando] = useState({}); // { subtarefaId: { observacao: '', saving: false } }

  // Estados para auto-save e controle de alterações não salvas
  const [lastSavedValues, setLastSavedValues] = useState({}); // { subtarefaId: content }
  const autoSaveTimerRef = useRef({}); // { subtarefaId: timerId }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados para o modal de confirmação do sistema
  const [showConfirmSair, setShowConfirmSair] = useState(false);
  const [pendenteFecharSubtarefaId, setPendenteFecharSubtarefaId] = useState(null);
  const [pendenteFecharObservacaoAtual, setPendenteFecharObservacaoAtual] = useState(null);

  // Estados para o modal de confirmação de exclusão
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [pendenteDeleteSubtarefaId, setPendenteDeleteSubtarefaId] = useState(null);

  // Inicializar lastSavedValues com as vinculações recebidas
  useState(() => {
    const saved = {};
    vinculacoes.forEach(v => {
      if (v.subtarefa?.id) {
        saved[v.subtarefa.id] = v.subtarefa.observacaoParticular || '';
      }
    });
    setLastSavedValues(saved);
  }, [vinculacoes]);

  // Efeito para monitorar alterações não salvas e configurar auto-save
  useEffect(() => {
    let unsaved = false;
    Object.keys(observacoesEditando).forEach(id => {
      const current = observacoesEditando[id]?.observacao || '';
      const last = lastSavedValues[id] || '';
      if (current !== last) {
        unsaved = true;

        // Configurar auto-save de 3 segundos se houver mudança e não estiver salvando
        if (!observacoesEditando[id].saving) {
          if (autoSaveTimerRef.current[id]) {
            clearTimeout(autoSaveTimerRef.current[id]);
          }
          autoSaveTimerRef.current[id] = setTimeout(() => {
            handleSalvarObservacao(null, id, 'Auto-save', true);
          }, 3000);
        }
      }
    });
    setHasUnsavedChanges(unsaved);

    return () => {
      // Limpar todos os timers ao desmontar
      Object.values(autoSaveTimerRef.current).forEach(t => clearTimeout(t));
    };
  }, [observacoesEditando, lastSavedValues]);

  // Efeito para avisar antes de sair da página se houver alterações
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmarDeleteObservacao = () => {
    if (pendenteDeleteSubtarefaId) {
      executarDeletarObservacao(pendenteDeleteSubtarefaId);
      setPendenteDeleteSubtarefaId(null);
    }
    setShowConfirmDelete(false);
  };

  const handleDeletarObservacao = (e, subtarefaId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPendenteDeleteSubtarefaId(subtarefaId);
    setShowConfirmDelete(true);
  };

  const executarDeletarObservacao = async (subtarefaId) => {
    if (!clienteId || !subtarefaId) {
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
        setLastSavedValues(prev => {
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

  // Função para salvar observação
  const handleSalvarObservacao = async (e, subtarefaId, subtarefaNome, isAutoSave = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Limpar o timer de auto-save se existir
    if (autoSaveTimerRef.current[subtarefaId]) {
      clearTimeout(autoSaveTimerRef.current[subtarefaId]);
      delete autoSaveTimerRef.current[subtarefaId];
    }

    if (!clienteId || !subtarefaId) {
      showToast('error', 'ID do cliente e subtarefa são obrigatórios');
      return;
    }

    const observacao = observacoesEditando[subtarefaId]?.observacao || '';

    // Se for auto-save e não mudou nada em relação ao último salvo, não faz nada
    if (isAutoSave && observacao === (lastSavedValues[subtarefaId] || '')) {
      return;
    }

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
        if (!isAutoSave) {
          showToast('success', observacao.trim() ? 'Observação salva com sucesso!' : 'Observação removida com sucesso!');
          setExpandedObservacao(null);
          setObservacoesEditando(prev => {
            const newState = { ...prev };
            delete newState[subtarefaId];
            return newState;
          });
        } else {
          // No auto-save, apenas marcamos como não salvando e atualizamos o lastSaved
          setObservacoesEditando(prev => ({
            ...prev,
            [subtarefaId]: {
              ...prev[subtarefaId],
              saving: false,
              lastAutoSave: true
            }
          }));

          // Limpar o indicador de "Salvo automaticamente" após 5 segundos
          setTimeout(() => {
            setObservacoesEditando(prev => {
              if (prev[subtarefaId]) {
                return {
                  ...prev,
                  [subtarefaId]: { ...prev[subtarefaId], lastAutoSave: false }
                };
              }
              return prev;
            });
          }, 5000);
        }

        // Atualizar lastSavedValues
        setLastSavedValues(prev => ({
          ...prev,
          [subtarefaId]: observacao
        }));

        if (onObservacaoUpdated) {
          onObservacaoUpdated();
        }
      } else {
        throw new Error(result.error || 'Erro ao salvar observação');
      }
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      if (!isAutoSave) {
        showToast('error', error.message || 'Erro ao salvar observação. Tente novamente.');
      }
    } finally {
      if (!isAutoSave) {
        setObservacoesEditando(prev => ({
          ...prev,
          [subtarefaId]: { ...prev[subtarefaId], saving: false }
        }));
      }
    }
  };


  // Função para expandir/colapsar formulário de observação
  const toggleExpandedObservacao = (e, subtarefaId, observacaoAtual) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (expandedObservacao === subtarefaId) {
      // Se tiver alterações não salvas antes de fechar, perguntar ao usuário
      if (observacoesEditando[subtarefaId]?.observacao !== lastSavedValues[subtarefaId]) {
        setPendenteFecharSubtarefaId(subtarefaId);
        setPendenteFecharObservacaoAtual(observacaoAtual);
        setShowConfirmSair(true);
        return;
      }

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
      // Garantir que temos o valor inicial para comparação
      setLastSavedValues(prev => ({
        ...prev,
        [subtarefaId]: observacaoAtual || ''
      }));
    }
  };

  const confirmarFecharEditor = () => {
    if (pendenteFecharSubtarefaId) {
      setExpandedObservacao(null);
      setObservacoesEditando(prev => {
        const newState = { ...prev };
        delete newState[pendenteFecharSubtarefaId];
        return newState;
      });
      setPendenteFecharSubtarefaId(null);
      setPendenteFecharObservacaoAtual(null);
    }
    setShowConfirmSair(false);
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
                                                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
                                                    {observacoesEditando[subtarefa.id]?.lastAutoSave && !observacoesEditando[subtarefa.id]?.saving && (
                                                      <span style={{
                                                        fontSize: '11px',
                                                        color: '#10b981',
                                                        marginRight: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                      }}>
                                                        <i className="fas fa-check-circle"></i>
                                                        Salvo automaticamente
                                                      </span>
                                                    )}
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
          </article>
        );
      })}

      {/* Modal de confirmação do sistema para alterações não salvas */}
      <ConfirmModal
        isOpen={showConfirmSair}
        onClose={() => {
          setShowConfirmSair(false);
          setPendenteFecharSubtarefaId(null);
          setPendenteFecharObservacaoAtual(null);
        }}
        onConfirm={confirmarFecharEditor}
        title="Alterações não salvas"
        message="Existem alterações que ainda não foram salvas nesta observação. Se você fechar agora, as alterações recentes serão perdidas. Deseja fechar mesmo assim?"
        confirmText="Sim, fechar e descartar"
        cancelText="Continuar editando"
        confirmButtonClass="btn-primary"
      />

      {/* Modal de confirmação do sistema para exclusão */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false);
          setPendenteDeleteSubtarefaId(null);
        }}
        onConfirm={confirmarDeleteObservacao}
        title="Confirmar exclusão"
        message="Deseja realmente remover esta observação particular? Esta ação não pode ser desfeita."
        confirmText="Sim, remover"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
      />
    </div>
  );
};

export default VinculacoesContent;

