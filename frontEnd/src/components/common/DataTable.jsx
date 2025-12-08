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
        {data.map((item, index) => (
          <tr key={item.id || index}>
            {columns.map((column) => (
              <td key={column.key}>
                {column.render ? column.render(item) : item[column.key] || '-'}
              </td>
            ))}
            {renderActions && (
              <td className="actions-column">
                <div className="action-buttons">
                  {renderActions(item)}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;

