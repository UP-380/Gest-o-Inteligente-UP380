import React from 'react';

/**
 * Componente de cabeçalho do modal de vinculação
 */
const ModalHeader = ({ title, onClose, disabled = false }) => {
  return (
    <div className="modal-header">
      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0e3b6f', margin: 0 }}>
        <i className="fas fa-link" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
        {title}
      </h3>
      <button
        className="btn-icon"
        onClick={onClose}
        title="Fechar"
        disabled={disabled}
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default ModalHeader;







