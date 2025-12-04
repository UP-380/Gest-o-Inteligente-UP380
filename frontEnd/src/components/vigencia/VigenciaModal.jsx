import React from 'react';
import VigenciaFormFields from './VigenciaFormFields';

/**
 * Modal reutilizável para criar ou editar vigências
 * 
 * @param {Boolean} isOpen - Se o modal está aberto
 * @param {Function} onClose - Função para fechar o modal
 * @param {Object} formData - Dados do formulário
 * @param {Function} setFormData - Função para atualizar dados do formulário
 * @param {Object} formErrors - Erros do formulário
 * @param {Function} setFormErrors - Função para atualizar erros
 * @param {Function} onSubmit - Função chamada ao submeter o formulário
 * @param {Boolean} submitting - Estado de submissão
 * @param {Array} tiposContrato - Lista de tipos de contrato
 * @param {Boolean} loadingTiposContrato - Estado de carregamento dos tipos de contrato
 * @param {Function} formatarValorParaInput - Função para formatar valores para input
 * @param {Function} removerFormatacaoMoeda - Função para remover formatação de moeda
 * @param {String} title - Título do modal (padrão: "Nova Vigência" ou "Editar Vigência")
 * @param {Boolean} isEdit - Se está em modo de edição (padrão: false)
 * @param {Number} membroId - ID do colaborador (opcional, para criar nova vigência)
 * @param {Function} setMembroId - Função para atualizar membroId (opcional)
 * @param {Array} colaboradores - Lista de colaboradores para seleção (opcional)
 */
const VigenciaModal = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  onSubmit,
  submitting = false,
  tiposContrato = [],
  loadingTiposContrato = false,
  formatarValorParaInput,
  removerFormatacaoMoeda,
  title = null,
  isEdit = false,
  membroId = null,
  setMembroId = null,
  colaboradores = []
}) => {
  if (!isOpen) return null;

  const modalTitle = title || (isEdit ? 'Editar Vigência' : 'Nova Vigência');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content vigencia-modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, #0e3b6f 0%, #1e5aa0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px'
            }}>
              <i className="fas fa-calendar-check"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '24px' }}>
            {/* Campo de seleção de colaborador (apenas para criar nova vigência) */}
            {!isEdit && setMembroId && colaboradores.length > 0 && (
              <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
                <div className="form-row-vigencia">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label-small">
                      Colaborador <span className="required">*</span>
                    </label>
                    <select
                      className={`form-input-small ${formErrors.membro_id ? 'error' : ''}`}
                      value={membroId || ''}
                      onChange={(e) => {
                        const colaboradorId = e.target.value ? parseInt(e.target.value) : null;
                        if (setMembroId) {
                          setMembroId(colaboradorId);
                        }
                        if (formErrors.membro_id) {
                          setFormErrors({ ...formErrors, membro_id: '' });
                        }
                      }}
                      disabled={submitting}
                      required
                    >
                      <option value="">Selecione um colaborador</option>
                      {colaboradores.map((colaborador) => (
                        <option key={colaborador.id} value={colaborador.id}>
                          {colaborador.nome || `Colaborador #${colaborador.id}`}
                          {colaborador.cpf ? ` (${colaborador.cpf})` : ''}
                        </option>
                      ))}
                    </select>
                    {formErrors.membro_id && (
                      <span className="error-message">{formErrors.membro_id}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

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

          <div className="modal-footer" style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500' }}
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i>
                  {isEdit ? 'Salvar Alterações' : 'Salvar Vigência'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VigenciaModal;

