import React from 'react';

/**
 * Componente de formulário de colaborador (usado no modal de criar/editar)
 */
const ColaboradorForm = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  aplicarMascaraCpf
}) => {
  return (
    <div className="colaborador-form">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Nome <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome}
            onChange={(e) => {
              setFormData({ ...formData, nome: e.target.value });
              if (formErrors.nome) {
                setFormErrors({ ...formErrors, nome: '' });
              }
            }}
            placeholder="Digite o nome do colaborador"
            disabled={submitting}
            required
          />
          {formErrors.nome && (
            <span className="error-message">{formErrors.nome}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">CPF</label>
          <input
            type="text"
            className={`form-input-small ${formErrors.cpf ? 'error' : ''}`}
            value={formData.cpf}
            onChange={(e) => {
              const masked = aplicarMascaraCpf(e.target.value);
              setFormData({ ...formData, cpf: masked });
              if (formErrors.cpf) {
                setFormErrors({ ...formErrors, cpf: '' });
              }
            }}
            placeholder="000.000.000-00"
            maxLength={14}
            disabled={submitting}
          />
          {formErrors.cpf && (
            <span className="error-message">{formErrors.cpf}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ColaboradorForm;

