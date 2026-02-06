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
      <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar"
            disabled={submitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
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
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="add-client-btn active"
              onClick={handleSubmit}
              disabled={submitting}
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
    </div>
  );
};

export default ColaboradorModal;

