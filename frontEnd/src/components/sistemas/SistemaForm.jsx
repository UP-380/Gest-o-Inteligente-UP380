import React from 'react';

/**
 * Componente de formulário de sistema
 */
const SistemaForm = ({
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

  return (
    <div className="sistema-form">
      <div className="sistema-form-row">
        <div className="sistema-form-group">
          <label className="sistema-form-label">
            Nome do Sistema <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`sistema-form-input ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: ST, Sistema de Gestão, ERP..."
            disabled={submitting}
            required
            maxLength={100}
          />
          {formErrors.nome && (
            <span className="sistema-error-message">{formErrors.nome}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SistemaForm;

