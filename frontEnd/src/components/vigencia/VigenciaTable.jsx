import React from 'react';
import { formatarDataBR, formatarMoeda, aplicarMascaraCpf } from '../../utils/vigenciaUtils';

/**
 * Componente de tabela de vigências com drag and drop de colunas
 */
const VigenciaTable = ({
  vigencias,
  colunasVigencias,
  membros,
  loading,
  draggedColumn,
  dragOverIndex,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onEdit,
  onDelete,
  renderCellValue
}) => {
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin"></i>
        <span>Carregando vigências...</span>
      </div>
    );
  }

  if (vigencias.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-calendar-alt"></i>
        <p>Nenhuma vigência encontrada</p>
      </div>
    );
  }

  return (
    <table className="listing-table listing-table-draggable">
      <thead>
        <tr>
          {colunasVigencias.map((coluna, index) => (
            <th
              key={coluna.key}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragEnter={(e) => onDragEnter(e, index)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, index)}
              className={
                draggedColumn === index ? 'dragging' :
                dragOverIndex === index ? 'drag-over' : ''
              }
              style={{
                cursor: 'grab',
                userSelect: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {coluna.label}
            </th>
          ))}
          <th className="actions-column" style={{ whiteSpace: 'nowrap' }}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {vigencias.map((vigencia) => (
          <tr key={vigencia.id}>
            {colunasVigencias.map((coluna) => (
              <td key={coluna.key}>
                {renderCellValue(vigencia, coluna.key)}
              </td>
            ))}
            <td className="actions-column">
              <div className="action-buttons">
                <button
                  className="btn-icon btn-edit edit-anim"
                  onClick={() => onEdit(vigencia)}
                  title="Editar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    className="edit-anim-icon"
                  >
                    <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                  </svg>
                </button>
                <button
                  className="btn-icon btn-delete bin-button"
                  onClick={() => onDelete(vigencia)}
                  title="Deletar"
                >
                  <svg
                    className="bin-top"
                    viewBox="0 0 39 7"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line y1="5" x2="39" y2="5" stroke="currentColor" strokeWidth="7"></line>
                    <line
                      x1="12"
                      y1="1.5"
                      x2="26.0357"
                      y2="1.5"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></line>
                  </svg>
                  <svg
                    className="bin-bottom"
                    viewBox="0 0 33 39"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <mask id="path-1-inside-1_8_19_vigencia" fill="white">
                      <path
                        d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z"
                      ></path>
                    </mask>
                    <path
                      d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z"
                      fill="currentColor"
                      mask="url(#path-1-inside-1_8_19_vigencia)"
                    ></path>
                    <path d="M12 6L12 29" stroke="currentColor" strokeWidth="4"></path>
                    <path d="M21 6V29" stroke="currentColor" strokeWidth="4"></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default VigenciaTable;

