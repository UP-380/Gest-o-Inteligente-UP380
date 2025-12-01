import React from 'react';
import './CardContainer.css';

/**
 * Componente genérico de card container
 * Apenas o card de fundo, tamanho e posição - pode ser usado para qualquer conteúdo
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Conteúdo a ser renderizado dentro do card
 * @param {string} props.className - Classes CSS adicionais
 * @param {Object} props.style - Estilos inline adicionais
 */
const CardContainer = ({
  children,
  className = '',
  style = {}
}) => {
  return (
    <div 
      className={`card-container ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

export default CardContainer;

