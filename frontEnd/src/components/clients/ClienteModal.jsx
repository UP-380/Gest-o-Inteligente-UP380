import React, { useState } from 'react';
import ClienteForm from './ClienteForm';
import ClienteContasBancariasList from '../clientes-conta-bancaria/ClienteContasBancariasList';
import ClienteSistemasList from '../clientes-sistema/ClienteSistemasList';
import ClienteAdquirentesList from '../clientes-adquirente/ClienteAdquirentesList';

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
  clienteEditando,
  onLoadKamino
}) => {
  const [showContasModal, setShowContasModal] = useState(false);
  const [showSistemasModal, setShowSistemasModal] = useState(false);
  const [showAdquirentesModal, setShowAdquirentesModal] = useState(false);

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
              onLoadKamino={onLoadKamino}
            />
          </div>
          <div className="modal-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              {/* Botões de relacionamento */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowContasModal(true)}
                  disabled={submitting || !formData.id}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Gerenciar Contas Bancárias"
                >
                  <i className="fas fa-university"></i>
                  Conta Bancária
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSistemasModal(true)}
                  disabled={submitting || !formData.id}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Gerenciar Sistemas"
                >
                  <i className="fas fa-server"></i>
                  Sistema
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAdquirentesModal(true)}
                  disabled={submitting || !formData.id}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Gerenciar Adquirentes"
                >
                  <i className="fas fa-credit-card"></i>
                  Adquirente
                </button>
              </div>
              {/* Botões de ação */}
              <div style={{ display: 'flex', gap: '8px' }}>
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
            </div>
          </div>
        </form>
      </div>

      {/* Modal de Contas Bancárias */}
      {showContasModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setShowContasModal(false)}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-university" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Contas Bancárias - {clienteEditando?.nome || formData.fantasia || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowContasModal(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteContasBancariasList 
                clienteId={formData.id} 
                clienteNome={clienteEditando?.nome || formData.fantasia || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sistemas */}
      {showSistemasModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setShowSistemasModal(false)}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-server" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Sistemas - {clienteEditando?.nome || formData.fantasia || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowSistemasModal(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteSistemasList 
                clienteId={formData.id} 
                clienteNome={clienteEditando?.nome || formData.fantasia || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adquirentes */}
      {showAdquirentesModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setShowAdquirentesModal(false)}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-credit-card" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Adquirentes - {clienteEditando?.nome || formData.fantasia || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowAdquirentesModal(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteAdquirentesList 
                clienteId={formData.id} 
                clienteNome={clienteEditando?.nome || formData.fantasia || ''}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClienteModal;

