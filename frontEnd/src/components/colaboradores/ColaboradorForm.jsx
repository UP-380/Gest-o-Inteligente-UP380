import React from 'react';
import VigenciaFormFields from '../vigencia/VigenciaFormFields';

/**
 * Componente de formulário de colaborador (usado no modal de criar/editar)
 */
const ColaboradorForm = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  tiposContrato,
  loadingTiposContrato,
  formatarValorParaInput,
  removerFormatacaoMoeda,
  aplicarMascaraCpf,
  editingId = false,
  vigenciaAberta = false,
  setVigenciaAberta
}) => {
  return (
    <form className="colaborador-form">
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

      {/* Campos de Vigência - apenas para criação de novo colaborador */}
      {!editingId && (
        <>
          <div className="form-section" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                marginBottom: vigenciaAberta ? '12px' : '0'
              }}
              onClick={() => setVigenciaAberta(!vigenciaAberta)}
            >
              <h4 className="form-section-title" style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Dados de Vigência</h4>
              <i 
                className={`fas fa-chevron-${vigenciaAberta ? 'down' : 'right'}`}
                style={{ 
                  fontSize: '12px', 
                  color: '#64748b',
                  transition: 'transform 0.2s',
                  marginLeft: '8px'
                }}
              ></i>
            </div>
            
            {vigenciaAberta && (
              <div style={{ marginTop: '12px' }}>
                <VigenciaFormFields
                  formData={formData}
                  setFormData={setFormData}
                  formErrors={formErrors}
                  setFormErrors={setFormErrors}
                  tiposContrato={tiposContrato}
                  loadingTiposContrato={loadingTiposContrato}
                  submitting={submitting}
                  formatarValorParaInput={formatarValorParaInput}
                  removerFormatacaoMoeda={removerFormatacaoMoeda}
                />
              </div>
            )}
          </div>
        </>
      )}
    </form>
  );
};

export default ColaboradorForm;

