import React, { useEffect, useRef } from 'react';

/**
 * Modal reutilizável para criar/editar banco
 */
const BancoModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  editingId
}) => {
  const nomeInputRef = useRef(null);

  // Focar no campo nome quando o modal abrir
  useEffect(() => {
    if (isOpen && nomeInputRef.current) {
      setTimeout(() => {
        nomeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const handleNomeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, nome: value });
    if (formErrors.nome) {
      setFormErrors({ ...formErrors, nome: '' });
    }
  };

  const handleCodigoChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Apenas números
    setFormData({ ...formData, codigo: value });
    if (formErrors.codigo) {
      setFormErrors({ ...formErrors, codigo: '' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-university'}`} style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {editingId ? 'Editar Banco' : 'Novo Banco'}
            </h3>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar (ESC)"
            disabled={submitting}
            style={{ fontSize: '18px' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} className="banco-form">
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                Nome do Banco <span className="required" style={{ color: '#e74c3c' }}>*</span>
              </label>
              <input
                ref={nomeInputRef}
                type="text"
                className={`form-input ${formErrors.nome ? 'error' : ''}`}
                value={formData.nome}
                onChange={handleNomeChange}
                placeholder="Ex: Banco do Brasil, Bradesco, Itaú..."
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: formErrors.nome ? '2px solid #e74c3c' : '1px solid #ddd',
                  borderRadius: '6px',
                  transition: 'border-color 0.2s'
                }}
                maxLength={100}
              />
              {formErrors.nome && (
                <span className="error-message" style={{ 
                  color: '#e74c3c', 
                  fontSize: '12px', 
                  marginTop: '4px', 
                  display: 'block' 
                }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                  {formErrors.nome}
                </span>
              )}
              {!formErrors.nome && formData.nome && (
                <span style={{ 
                  color: '#27ae60', 
                  fontSize: '12px', 
                  marginTop: '4px', 
                  display: 'block' 
                }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>
                  Nome válido
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                Código do Banco
                <span style={{ 
                  fontSize: '11px', 
                  color: '#666', 
                  marginLeft: '6px',
                  fontWeight: 'normal'
                }}>
                  (Opcional - Ex: 001, 237, 341)
                </span>
              </label>
              <input
                type="text"
                className={`form-input ${formErrors.codigo ? 'error' : ''}`}
                value={formData.codigo || ''}
                onChange={handleCodigoChange}
                placeholder="Ex: 001, 237, 341..."
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: formErrors.codigo ? '2px solid #e74c3c' : '1px solid #ddd',
                  borderRadius: '6px',
                  transition: 'border-color 0.2s'
                }}
                maxLength={10}
              />
              {formErrors.codigo && (
                <span className="error-message" style={{ 
                  color: '#e74c3c', 
                  fontSize: '12px', 
                  marginTop: '4px', 
                  display: 'block' 
                }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                  {formErrors.codigo}
                </span>
              )}
            </div>
          </form>
        </div>
        <div className="modal-footer" style={{ 
          padding: '16px 24px', 
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              fontSize: '14px'
            }}
          >
            <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !formData.nome?.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              opacity: (!formData.nome?.trim() || submitting) ? 0.6 : 1,
              cursor: (!formData.nome?.trim() || submitting) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                Salvando...
              </>
            ) : (
              <>
                <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`} style={{ marginRight: '6px' }}></i>
                {editingId ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BancoModal;

