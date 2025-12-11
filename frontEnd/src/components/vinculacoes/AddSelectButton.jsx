import React from 'react';

/**
 * Botão para adicionar novo select
 */
const AddSelectButton = ({ onClick, title = 'Adicionar outro select' }) => {
  return (
    <button
      type="button"
      className="btn-add-select"
      onClick={onClick}
      title={title}
    >
      <i className="fas fa-plus"></i>
    </button>
  );
};

export default AddSelectButton;

