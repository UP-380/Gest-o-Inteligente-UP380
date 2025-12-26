import React from 'react';

/**
 * Botão para expandir/recolher itens selecionados
 */
const ExpandItemsButton = ({ 
  isExpanded, 
  onClick, 
  hiddenCount 
}) => {
  return (
    <button
      type="button"
      className="btn-expand-items"
      onClick={onClick}
      title={isExpanded ? "Mostrar menos" : `Mostrar mais (${hiddenCount} itens)`}
    >
      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
      <span>
        {isExpanded 
          ? 'Mostrar menos' 
          : `+${hiddenCount} mais`
        }
      </span>
    </button>
  );
};

export default ExpandItemsButton;







