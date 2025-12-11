import React from 'react';
import ClienteForm from './ClienteForm';

/**
 * Modal reutilizável para editar cliente
 */
const ClienteModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  allClientesKamino = [],
  clientesKaminoMap,
  cnpjOptions = [],
  loadCnpjOptions,
  clienteEditando,
  onVinculacaoSaveReady
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
          <h3 style={{ fontSize: '16px' }}>
            {clienteEditando ? `Editar Cliente - ${clienteEditando.nome || 'Cliente'}` : 'Editar Cliente'}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <ClienteForm
              formData={formData}
              setFormData={setFormData}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              submitting={submitting}
              allClientesKamino={allClientesKamino}
              clientesKaminoMap={clientesKaminoMap}
              cnpjOptions={cnpjOptions}
              loadCnpjOptions={loadCnpjOptions}
              onVinculacaoSaveReady={onVinculacaoSaveReady}
            />
          </div>
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
              className="btn-primary"
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
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClienteModal;

