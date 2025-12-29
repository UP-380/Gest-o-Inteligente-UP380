import React from 'react';

/**
 * Componente de rodapé do modal de vinculação
 */
const ModalFooter = ({ 
  buttons = [],
  disabled = false 
}) => {
  return (
    <div className="modal-footer">
      {buttons.map((button, index) => (
        <button
          key={index}
          type={button.type || 'button'}
          className={button.className || 'btn-secondary'}
          onClick={button.onClick}
          disabled={disabled || button.disabled}
        >
          {button.loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              {button.loadingText || 'Carregando...'}
            </>
          ) : (
            <>
              {button.icon && <i className={button.icon}></i>}
              {button.text}
            </>
          )}
        </button>
      ))}
    </div>
  );
};

export default ModalFooter;







