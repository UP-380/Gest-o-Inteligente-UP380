import React from 'react';

/**
 * Componente para tag de item selecionado
 */
const SelectedItemTag = ({ 
  label, 
  onRemove, 
  canRemove = true 
}) => {
  return (
    <div className="selected-item-tag">
      <span>{label}</span>
      {canRemove && onRemove && (
        <button
          type="button"
          className="btn-remove-tag"
          onClick={onRemove}
          title="Remover item"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
    </div>
  );
};

export default SelectedItemTag;







