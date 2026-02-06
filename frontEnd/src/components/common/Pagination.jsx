import React from 'react';
import './Pagination.css';

/**
 * Componente de paginação reutilizável
 * 
 * @param {number} currentPage - Página atual
 * @param {number} totalPages - Total de páginas
 * @param {number} totalItems - Total de itens
 * @param {number} itemsPerPage - Itens por página
 * @param {Function} onPageChange - Função chamada ao mudar de página
 * @param {Function} onItemsPerPageChange - Função chamada ao mudar itens por página
 * @param {boolean} loading - Se está carregando
 * @param {string} itemName - Nome do item (ex: "atividades", "produtos")
 */
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  loading = false,
  itemName = 'itens'
}) => {
  if (totalItems === 0) return null;

  const startItem = totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(startItem + itemsPerPage - 1, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-limit-selector">
        <label htmlFor="paginationLimit">Exibir:</label>
        <select 
          id="paginationLimit" 
          className="pagination-limit-select"
          value={itemsPerPage}
          onChange={(e) => {
            const newItemsPerPage = parseInt(e.target.value);
            onItemsPerPageChange(newItemsPerPage);
            onPageChange(1);
          }}
        >
          <option value="10">10 itens</option>
          <option value="20">20 itens</option>
          <option value="30">30 itens</option>
          <option value="50">50 itens</option>
        </select>
      </div>
      
      <div className="pagination-info">
        <span>
          Mostrando {startItem} a {endItem} de {totalItems} {itemName}
        </span>
      </div>
      
      <div className="pagination-controls">
        <button 
          className="pagination-btn" 
          title="Primeira página"
          disabled={currentPage === 1 || loading}
          onClick={() => onPageChange(1)}
        >
          <i className="fas fa-angle-double-left"></i>
        </button>
        <button 
          className="pagination-btn" 
          title="Página anterior"
          disabled={currentPage === 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <i className="fas fa-angle-left"></i>
        </button>
        
        <span className="pagination-current">
          Página <span>{currentPage}</span> de <span>{totalPages}</span>
        </span>
        
        <button 
          className="pagination-btn" 
          title="Próxima página"
          disabled={currentPage === totalPages || totalPages === 0 || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <i className="fas fa-angle-right"></i>
        </button>
        <button 
          className="pagination-btn" 
          title="Última página"
          disabled={currentPage === totalPages || totalPages === 0 || loading}
          onClick={() => onPageChange(totalPages)}
        >
          <i className="fas fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  );
};

export default Pagination;

