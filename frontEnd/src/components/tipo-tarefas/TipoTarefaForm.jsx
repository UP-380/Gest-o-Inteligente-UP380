import React from 'react';

/**
 * Componente de formulário de tipo de tarefa
 */
const TipoTarefaForm = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting
}) => {
  const handleNomeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, nome: value });
    if (formErrors.nome) {
      setFormErrors({ ...formErrors, nome: '' });
    }
  };

  const handleClickupIdChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, clickup_id: value });
    if (formErrors.clickup_id) {
      setFormErrors({ ...formErrors, clickup_id: '' });
    }
  };

  return (
    <div className="tipo-tarefa-form">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Nome do Tipo de Tarefa <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: Bug, Feature, Melhoria..."
            disabled={submitting}
            required
            maxLength={200}
          />
          {formErrors.nome && (
            <span className="error-message">{formErrors.nome}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">
            ClickUp ID
            <span style={{ 
              fontSize: '11px', 
              color: '#64748b', 
              marginLeft: '6px',
              fontWeight: 'normal'
            }}>
              (Opcional)
            </span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.clickup_id ? 'error' : ''}`}
            value={formData.clickup_id || ''}
            onChange={handleClickupIdChange}
            placeholder="ID do ClickUp"
            disabled={submitting}
            maxLength={100}
          />
          {formErrors.clickup_id && (
            <span className="error-message">{formErrors.clickup_id}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TipoTarefaForm;

