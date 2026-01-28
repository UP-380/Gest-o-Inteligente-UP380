import React from 'react';

/**
 * Componente de formulário de tipo de contrato
 */
const TipoContratoForm = ({
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
    <div className="tipo-contrato-form">
      <div className="form-row">
        <div className="form-group" style={{ flex: '1' }}>
          <label className="form-label-small">
            Nome do Tipo de Contrato <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: CLT, PJ, Estágio..."
            disabled={submitting}
            required
            maxLength={200}
          />
          {formErrors.nome && (
            <span className="error-message">{formErrors.nome}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TipoContratoForm;






