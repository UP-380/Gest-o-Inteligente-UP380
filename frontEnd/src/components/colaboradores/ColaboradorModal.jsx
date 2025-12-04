import React from 'react';
import ColaboradorForm from './ColaboradorForm';

/**
 * Modal reutilizável para criar/editar colaborador
 */
const ColaboradorModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  editingId,
  tiposContrato,
  loadingTiposContrato,
  formatarValorParaInput,
  removerFormatacaoMoeda,
  aplicarMascaraCpf,
  vigenciaAberta,
  setVigenciaAberta
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content colaborador-modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
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
              <i className="fas fa-user-plus"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar"
            disabled={submitting}
            style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>
          <ColaboradorForm
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            submitting={submitting}
            tiposContrato={tiposContrato}
            loadingTiposContrato={loadingTiposContrato}
            formatarValorParaInput={formatarValorParaInput}
            removerFormatacaoMoeda={removerFormatacaoMoeda}
            aplicarMascaraCpf={aplicarMascaraCpf}
            editingId={editingId}
            vigenciaAberta={vigenciaAberta}
            setVigenciaAberta={setVigenciaAberta}
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
            onClick={handleSubmit}
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
                {editingId ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColaboradorModal;

