import React from 'react';

/**
 * Botão para remover select
 */
const RemoveSelectButton = ({ onClick, title = 'Remover select' }) => {
  return (
    <button
      type="button"
      className="btn-remove-select"
      onClick={onClick}
      title={title}
    >
      <i className="fas fa-times"></i>
    </button>
  );
};

export default RemoveSelectButton;




