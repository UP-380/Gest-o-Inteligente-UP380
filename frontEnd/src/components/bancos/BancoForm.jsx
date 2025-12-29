import React from 'react';

/**
 * Componente de formulário de banco
 */
const BancoForm = ({
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

  const handleCodigoChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Apenas números
    setFormData({ ...formData, codigo: value });
    if (formErrors.codigo) {
      setFormErrors({ ...formErrors, codigo: '' });
    }
  };

  return (
    <div className="colaborador-form">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Nome do Banco <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: Banco do Brasil, Bradesco, Itaú..."
            disabled={submitting}
            required
            maxLength={100}
          />
          {formErrors.nome && (
            <span className="error-message">{formErrors.nome}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">
            Código do Banco
            <span style={{ 
              fontSize: '11px', 
              color: '#64748b', 
              marginLeft: '6px',
              fontWeight: 'normal'
            }}>
              (Opcional - Ex: 001, 237, 341)
            </span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.codigo ? 'error' : ''}`}
            value={formData.codigo || ''}
            onChange={handleCodigoChange}
            placeholder="Ex: 001, 237, 341..."
            disabled={submitting}
            maxLength={10}
          />
          {formErrors.codigo && (
            <span className="error-message">{formErrors.codigo}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BancoForm;

