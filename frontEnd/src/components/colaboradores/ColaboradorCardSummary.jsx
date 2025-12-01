import React from 'react';
import './ColaboradorCardSummary.css';

// Formatar tempo em decimal
const formatarTempoDecimal = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0.00';
  const horas = milissegundos / (1000 * 60 * 60);
  return horas.toFixed(2);
};

const ColaboradorCardSummary = ({ resumo, colaboradorId, registros, onOpenDetail }) => {
  const {
    totalTarefasUnicas,
    totalProdutosUnicos,
    totalClientesUnicos,
    tempoTotalRealizado
  } = resumo;

  const handleDetailClick = (tipo, e) => {
    e.stopPropagation();
    if (onOpenDetail) {
      onOpenDetail(colaboradorId, tipo, e);
    }
  };

  return (
    <div className="colaborador-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Tarefas - sempre mostra, mesmo se for 0 */}
      <div
        className="colaborador-info-item resumo-item resumo-item-tarefas"
        data-colaborador-id={colaboradorId}
        data-tipo="tarefas"
      >
        <i className="fas fa-list"></i>
        <span className="value tarefas-timetrack-value">Tarefas: {totalTarefasUnicas || 0}</span>
        {totalTarefasUnicas > 0 && (
          <span
            className="resumo-arrow produtos-arrow"
            onClick={(e) => handleDetailClick('tarefas', e)}
            title="Ver detalhes de tarefas"
          >
            &gt;
          </span>
        )}
      </div>

      {/* Produtos - sempre mostra, mesmo se for 0 */}
      <div
        className="colaborador-info-item resumo-item resumo-item-produtos"
        data-colaborador-id={colaboradorId}
        data-tipo="produtos"
      >
        <i className="fas fa-box"></i>
        <span className="value produtos-value">Produtos: {totalProdutosUnicos || 0}</span>
        {totalProdutosUnicos > 0 && (
          <span
            className="resumo-arrow produtos-arrow"
            onClick={(e) => handleDetailClick('produtos', e)}
            title="Ver detalhes de produtos"
          >
            &gt;
          </span>
        )}
      </div>

      {/* Clientes - sempre mostra, mesmo se for 0 */}
      <div
        className="colaborador-info-item resumo-item resumo-item-clientes"
        data-colaborador-id={colaboradorId}
        data-tipo="clientes"
      >
        <i className="fas fa-users"></i>
        <span className="value clientes-value">Clientes: {totalClientesUnicos || 0}</span>
        {totalClientesUnicos > 0 && (
          <span
            className="resumo-arrow produtos-arrow"
            onClick={(e) => handleDetailClick('clientes', e)}
            title="Ver detalhes de clientes"
          >
            &gt;
          </span>
        )}
      </div>

      {/* Tempo total realizado - sempre mostra, mesmo se for 0 */}
      <div className="colaborador-info-item">
        <i className="fas fa-stopwatch"></i>
        <span className="value horas-realizadas-value">
          {(() => {
            if (!tempoTotalRealizado || tempoTotalRealizado === 0) {
              return 'H.R: 0h 0min 0s';
            }
            const horas = Math.floor(tempoTotalRealizado / (1000 * 60 * 60));
            const minutos = Math.floor((tempoTotalRealizado % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((tempoTotalRealizado % (1000 * 60)) / 1000);
            let tempoFormatado = '';
            if (horas > 0) tempoFormatado += `${horas}h `;
            if (minutos > 0 || horas > 0) tempoFormatado += `${minutos}min `;
            if (segundos > 0 || (horas === 0 && minutos === 0)) tempoFormatado += `${segundos}s`;
            return `H.R: ${tempoFormatado.trim()}`;
          })()}
        </span>
        {tempoTotalRealizado > 0 && (
          <i
            className="fas fa-info-circle"
            style={{ marginLeft: '4px', fontSize: '0.75rem', color: 'var(--gray-400)', cursor: 'help' }}
            title={`${formatarTempoDecimal(tempoTotalRealizado)} horas`}
          ></i>
        )}
      </div>
    </div>
  );
};

export default ColaboradorCardSummary;

