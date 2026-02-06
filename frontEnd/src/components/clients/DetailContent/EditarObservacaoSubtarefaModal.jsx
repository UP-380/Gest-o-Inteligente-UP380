import React, { useState, useEffect } from 'react';
import { useToast } from '../../../hooks/useToast';

const API_BASE_URL = '/api';

const EditarObservacaoSubtarefaModal = ({
  isOpen,
  onClose,
  clienteId,
  subtarefaId,
  subtarefaNome,
  observacaoInicial,
  onSave
}) => {
  const showToast = useToast();
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setObservacao(observacaoInicial || '');
    }
  }, [isOpen, observacaoInicial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!clienteId || !subtarefaId) {
      showToast('error', 'ID do cliente e subtarefa são obrigatórios');
      return;
    }

    setSaving(true);
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
        if (onSave) {
          onSave(result.data);
        }
        onClose();
      } else {
        throw new Error(result.error || 'Erro ao salvar observação');
      }
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      showToast('error', error.message || 'Erro ao salvar observação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!clienteId || !subtarefaId) {
      return;
    }

    if (!window.confirm('Deseja realmente remover esta observação particular?')) {
      return;
    }

    setSaving(true);
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
        if (onSave) {
          onSave(null);
        }
        onClose();
      } else {
        throw new Error(result.error || 'Erro ao remover observação');
      }
    } catch (error) {
      console.error('Erro ao remover observação:', error);
      showToast('error', error.message || 'Erro ao remover observação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '800px', width: '90%' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            <i className="fas fa-sticky-note" style={{ marginRight: '8px', color: '#6366f1' }}></i>
            Observação Particular - {subtarefaNome}
          </h3>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar"
            disabled={saving}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 600, 
                color: '#374151',
                marginBottom: '8px'
              }}>
                Observação Particular do Cliente
              </label>
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                margin: '0 0 12px 0',
                lineHeight: '1.5'
              }}>
                Adicione observações específicas desta subtarefa para este cliente. Suporta HTML.
              </p>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Digite a observação particular desta subtarefa para este cliente..."
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                disabled={saving}
              />
            </div>
          </div>
          <div className="modal-footer" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            gap: '12px'
          }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDelete}
              disabled={saving || !observacaoInicial}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-trash"></i>
              Remover Observação
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarObservacaoSubtarefaModal;

