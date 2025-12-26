import React from 'react';
import './TimerButton.css';

/**
 * Componente de botão de timer (Play/Stop)
 * 
 * @param {Object} props
 * @param {boolean} props.isActive - Se o timer está ativo (mostra botão de parar)
 * @param {Function} props.onClick - Callback quando o botão é clicado
 * @param {string} props.title - Título do botão (tooltip)
 * @param {string} props.className - Classes CSS adicionais
 * @param {boolean} props.disabled - Se o botão está desabilitado
 * @param {Object} props.dataAttributes - Atributos data-* adicionais
 */
const TimerButton = ({ 
  isActive = false, 
  onClick, 
  title, 
  className = '', 
  disabled = false,
  dataAttributes = {}
}) => {
  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  const defaultTitle = isActive 
    ? 'Parar registro de tempo' 
    : 'Iniciar registro de tempo';

  const buttonClass = `timer-button ${isActive ? 'timer-button-stop' : 'timer-button-play'} ${className}`.trim();
  const iconClass = isActive ? 'fas fa-stop' : 'fas fa-play';

  return (
    <button
      type="button"
      className={buttonClass}
      title={title || defaultTitle}
      onClick={handleClick}
      disabled={disabled}
      aria-label={defaultTitle}
      {...dataAttributes}
    >
      <i className={iconClass}></i>
    </button>
  );
};

export default TimerButton;

