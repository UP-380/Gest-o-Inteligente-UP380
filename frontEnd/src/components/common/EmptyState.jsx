import React from 'react';
import './EmptyState.css';

/**
 * Componente de estado vazio reutilizável
 * 
 * @param {string} icon - Classe do ícone FontAwesome
 * @param {string} message - Mensagem a ser exibida
 */
const EmptyState = ({ icon = 'fa-inbox', message = 'Nenhum item encontrado' }) => {
  return (
    <div className="empty-state">
      <i className={`fas ${icon}`}></i>
      <p>{message}</p>
    </div>
  );
};

export default EmptyState;

