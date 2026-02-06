import React from 'react';

/**
 * Componente de formulário de adquirente
 */
const AdquirenteForm = ({
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
    <div className="adquirente-form">
      <div className="adquirente-form-row">
        <div className="adquirente-form-group">
          <label className="adquirente-form-label">
            Nome do Adquirente <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`adquirente-form-input ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: Cielo, Rede, Stone, PagSeguro..."
            disabled={submitting}
            required
            maxLength={100}
          />
          {formErrors.nome && (
            <span className="adquirente-error-message">{formErrors.nome}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdquirenteForm;

