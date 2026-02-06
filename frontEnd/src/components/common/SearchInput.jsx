import React from 'react';
import './SearchInput.css';

/**
 * Componente de input de busca reutilizável
 * 
 * @param {string} value - Valor do input
 * @param {Function} onChange - Função chamada ao mudar o valor
 * @param {string} placeholder - Placeholder do input
 * @param {string} className - Classes CSS adicionais
 */
const SearchInput = ({ value, onChange, placeholder = 'Buscar...', className = '' }) => {
  return (
    <div className={`search-container ${className}`}>
      <div className="search-input-wrapper">
        <i className="fas fa-search search-icon"></i>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default SearchInput;







