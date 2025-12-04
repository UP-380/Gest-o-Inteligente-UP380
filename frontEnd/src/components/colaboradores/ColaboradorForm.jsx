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
          <div className="form-section" style={{ 
            marginTop: '24px', 
            paddingTop: '20px', 
            borderTop: '1px solid #e2e8f0',
            background: vigenciaAberta ? '#f8fafc' : 'transparent',
            borderRadius: '8px',
            padding: vigenciaAberta ? '20px' : '20px 20px 0 20px',
            transition: 'all 0.3s ease'
          }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '12px',
                margin: '-12px',
                borderRadius: '6px',
                transition: 'background 0.2s ease',
                marginBottom: vigenciaAberta ? '16px' : '0'
              }}
              onClick={() => setVigenciaAberta(!vigenciaAberta)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: vigenciaAberta ? '#0e3b6f' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: vigenciaAberta ? 'white' : '#64748b',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}>
                  <i className="fas fa-calendar-alt"></i>
                </div>
                <h4 className="form-section-title" style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  color: vigenciaAberta ? '#0e3b6f' : '#374151', 
                  margin: 0,
                  transition: 'color 0.2s ease'
                }}>
                  Dados de Vigência
                </h4>
              </div>
              <i 
                className={`fas fa-chevron-${vigenciaAberta ? 'down' : 'right'}`}
                style={{ 
                  fontSize: '12px', 
                  color: '#64748b',
                  transition: 'transform 0.2s ease, color 0.2s ease'
                }}
              ></i>
            </div>
            
            {vigenciaAberta && (
              <div style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
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

