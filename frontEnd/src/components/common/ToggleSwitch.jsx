import React from 'react';
import './ToggleSwitch.css';

/**
 * Componente de toggle switch com labels
 * 
 * @param {Object} props
 * @param {boolean} props.checked - Estado do toggle (checked/unchecked)
 * @param {Function} props.onChange - Função chamada ao mudar o estado
 * @param {string} props.leftLabel - Label do lado esquerdo (quando não está checked)
 * @param {string} props.rightLabel - Label do lado direito (quando está checked)
 * @param {string} props.id - ID único para o input (opcional, será gerado se não fornecido)
 * @param {string} props.className - Classes CSS adicionais
 * @param {Object} props.style - Estilos inline adicionais
 */
const ToggleSwitch = ({
  checked,
  onChange,
  leftLabel = 'Lista',
  rightLabel = 'Detalhes',
  id,
  className = '',
  style = {},
  disabled = false
}) => {
  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`status-toggle-minimal ${className} ${disabled ? 'disabled' : ''}`} style={style}>
      <span className={`toggle-option-minimal ${!checked ? 'active' : ''}`}>
        {leftLabel}
      </span>
      <div className="toggle-switch-minimal">
        <input
          type="checkbox"
          id={toggleId}
          className="toggle-input-minimal"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <label htmlFor={toggleId} className="toggle-slider-minimal"></label>
      </div>
      <span className={`toggle-option-minimal ${checked ? 'active' : ''}`}>
        {rightLabel}
      </span>
    </div>
  );
};

export default ToggleSwitch;

