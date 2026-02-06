import React from 'react';
import './InactiveButton.css';

/**
 * Componente de botão para filtrar itens inativos
 * 
 * @param {Object} props
 * @param {boolean} props.active - Se o botão está ativo (filtro de inativos ativado)
 * @param {Function} props.onClick - Função chamada ao clicar no botão
 * @param {string} props.label - Texto do botão (padrão: "Inativos")
 * @param {boolean} props.disabled - Se o botão está desabilitado
 * @param {string} props.className - Classes CSS adicionais
 */
const InactiveButton = ({
  active,
  onClick,
  label = 'Inativos',
  disabled = false,
  className = ''
}) => {
  return (
    <button
      className={`inactive-colaboradores-btn ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <svg viewBox="0 0 512 512" className="icon-ban" width="16" height="16">
        <circle cx="256" cy="256" r="200" fill="currentColor" opacity="0.1"/>
        <circle cx="256" cy="256" r="200" fill="none" stroke="currentColor" strokeWidth="32"/>
        <line x1="150" y1="150" x2="362" y2="362" stroke="currentColor" strokeWidth="32" strokeLinecap="round"/>
      </svg>
      {label}
    </button>
  );
};

export default InactiveButton;


