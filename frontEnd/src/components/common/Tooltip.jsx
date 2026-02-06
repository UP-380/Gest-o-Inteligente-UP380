import React from 'react';
import './Tooltip.css';

/**
 * Componente Tooltip reutilizável
 * @param {string} text - Texto a ser exibido no tooltip
 * @param {React.ReactNode} children - Elemento que terá o tooltip
 * @param {string} position - Posição do tooltip: 'top' (padrão) ou 'bottom'
 * @param {string} className - Classes CSS adicionais
 */
const Tooltip = ({ text, children, position = 'top', className = '' }) => {
  if (!text) return children;

  return (
    <div className={`tooltip-wrapper has-tooltip ${className}`}>
      {children}
      <div className={`filter-tooltip tooltip-${position}`}>
        {text}
      </div>
    </div>
  );
};

export default Tooltip;

