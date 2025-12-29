import React from 'react';

/**
 * Componente de formulário de produto
 */
const ProdutoForm = ({
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
    <div className="produto-form">
      <div className="produto-form-row">
        <div className="produto-form-group">
          <label className="produto-form-label">
            Nome do Produto <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`produto-form-input ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Digite o nome do produto"
            disabled={submitting}
            required
            maxLength={255}
          />
          {formErrors.nome && (
            <span className="produto-error-message">{formErrors.nome}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProdutoForm;

