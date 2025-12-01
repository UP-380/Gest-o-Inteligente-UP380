import React from 'react';
import './FiltersCard.css';

/**
 * Componente genérico de card de filtros
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componentes de filtros a serem renderizados
 * @param {Function} props.onApply - Função chamada ao clicar em "Aplicar Filtros" (opcional)
 * @param {Function} props.onClear - Função chamada ao clicar em "Limpar Filtros" (opcional)
 * @param {boolean} props.showActions - Se deve mostrar os botões de ação (padrão: true)
 * @param {boolean} props.loading - Se está carregando (desabilita botão Aplicar)
 * @param {string} props.applyLabel - Label do botão Aplicar (padrão: "Aplicar Filtros")
 * @param {string} props.clearLabel - Label do botão Limpar (padrão: "Limpar Filtros")
 * @param {string} props.className - Classes CSS adicionais
 */
const FiltersCard = ({
  children,
  onApply,
  onClear,
  showActions = true,
  loading = false,
  applyLabel = 'Aplicar Filtros',
  clearLabel = 'Limpar Filtros',
  className = ''
}) => {
  return (
    <div className={`exposed-filters-section ${className}`}>
      <div className="filters-row">
        {children}
      </div>
      
      {showActions && (onApply || onClear) && (
        <div className="filter-actions">
          {onApply && (
            <button 
              className="apply-filters-btn" 
              onClick={onApply}
              disabled={loading}
            >
              {applyLabel}
            </button>
          )}
          {onClear && (
            <button 
              className="clear-filters-btn" 
              onClick={onClear}
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FiltersCard;

