import React from 'react';
import './ButtonPrimary.css';

/**
 * Componente de botão primário reutilizável
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Conteúdo do botão (texto ou elementos)
 * @param {Function} props.onClick - Função chamada ao clicar no botão
 * @param {boolean} props.disabled - Se o botão está desabilitado
 * @param {string} props.icon - Classe do ícone FontAwesome (opcional)
 * @param {string} props.className - Classes CSS adicionais
 * @param {string} props.type - Tipo do botão (button, submit, reset)
 * @param {string} props.form - ID do form associado (para botões submit fora do form)
 * @param {Object} props.style - Estilos inline adicionais
 */
const ButtonPrimary = ({
  children,
  onClick,
  disabled = false,
  icon,
  className = '',
  type = 'button',
  form,
  style = {}
}) => {
  return (
    <button
      type={type}
      className={`btn-primary ${className}`}
      onClick={onClick}
      disabled={disabled}
      form={form}
      style={style}
    >
      {icon && <i className={icon}></i>}
      {children}
    </button>
  );
};

export default ButtonPrimary;

