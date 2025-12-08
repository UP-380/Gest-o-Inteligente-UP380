import React from 'react';
import './LoadingState.css';

/**
 * Componente de estado de carregamento reutilizável
 * 
 * @param {string} message - Mensagem de carregamento
 */
const LoadingState = ({ message = 'Carregando...' }) => {
  return (
    <div className="loading-container">
      <i className="fas fa-spinner fa-spin"></i>
      <span>{message}</span>
    </div>
  );
};

export default LoadingState;

