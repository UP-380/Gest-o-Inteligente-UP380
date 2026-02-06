import React from 'react';
import './DataTable.css';

/**
 * Componente de tabela genérica reutilizável
 * 
 * @param {Array} columns - Array de objetos com { key, label, render? }
 * @param {Array} data - Array de dados
 * @param {Function} renderActions - Função para renderizar ações (opcional)
 * @param {string} emptyMessage - Mensagem quando não há dados
 * @param {string} emptyIcon - Ícone quando não há dados
 */
const DataTable = ({ 
  columns, 
  data, 
  renderActions,
  emptyMessage = 'Nenhum item encontrado',
  emptyIcon = 'fa-inbox'
}) => {
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <i className={`fas ${emptyIcon}`}></i>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="listing-table-wrapper">
      <table className="listing-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {renderActions && <th className="actions-column">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            // Garantir chave única: usar id se existir, senão usar index combinado com algum campo único
            const uniqueKey = item.id !== undefined && item.id !== null 
              ? `row-${item.id}` 
              : `row-${index}-${item.nome || item.name || index}`;
            
            return (
              <tr key={uniqueKey}>
                {columns.map((column) => (
                  <td key={`${uniqueKey}-${column.key}`} data-label={column.label}>
                    {column.render ? column.render(item) : item[column.key] || '-'}
                  </td>
                ))}
                {renderActions && (
                  <td className="actions-column" data-label="Ações">
                    {renderActions(item)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;

