import React from 'react';
import { formatarDataBR, formatarMoeda, aplicarMascaraCpf } from '../../utils/vigenciaUtils';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';

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
              <EditButton
                onClick={() => onEdit(vigencia)}
                title="Editar"
              />
              <DeleteButton
                onClick={() => onDelete(vigencia)}
                title="Deletar"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default VigenciaTable;

