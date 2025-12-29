import React from 'react';
import './IconButton.css';

/**
 * Componente de botão com ícone
 * 
 * @param {string} icon - Classe do ícone FontAwesome (ex: 'fa-eye', 'fa-book')
 * @param {function} onClick - Função chamada ao clicar
 * @param {string} title - Texto do tooltip
 * @param {string} color - Cor do ícone (padrão: '#64748b')
 * @param {string} hoverColor - Cor ao passar o mouse (padrão: '#3b82f6')
 * @param {boolean} disabled - Se o botão está desabilitado
 */
const IconButton = ({ 
  icon, 
  onClick, 
  title, 
  color = '#64748b',
  hoverColor = '#3b82f6',
  disabled = false 
}) => {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        '--icon-color': color,
        '--icon-hover-color': hoverColor
      }}
    >
      <i className={`fas ${icon}`}></i>
    </button>
  );
};

export default IconButton;

