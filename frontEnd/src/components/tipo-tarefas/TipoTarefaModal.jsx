import React from 'react';

/**
 * Modal reutilizável para criar/editar tipo de tarefa
 */
const TipoTarefaModal = ({
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
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>{editingId ? 'Editar Tipo de Tarefa' : 'Novo Tipo de Tarefa'}</h3>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar"
            disabled={submitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="tipo-tarefa-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Nome <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.nome ? 'error' : ''}`}
                  value={formData.nome}
                  onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    if (formErrors.nome) {
                      setFormErrors({ ...formErrors, nome: '' });
                    }
                  }}
                  placeholder="Digite o nome do tipo de tarefa"
                  disabled={submitting}
                />
                {formErrors.nome && (
                  <span className="error-message">{formErrors.nome}</span>
                )}
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Salvando...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                {editingId ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TipoTarefaModal;







