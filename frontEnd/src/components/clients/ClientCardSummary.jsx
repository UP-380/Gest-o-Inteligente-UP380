import React from 'react';
import './ClientCardSummary.css';

// Formatar tempo em decimal
const formatarTempoDecimal = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0.00';
  const horas = milissegundos / (1000 * 60 * 60);
  return horas.toFixed(2);
};

const ClientCardSummary = ({ resumo, clienteId, contratos, registros, onOpenDetail }) => {
  const {
    tempoPorColaborador,
    totalTarefasUnicas,
    totalProdutosUnicos,
    totalContratos,
    totalColaboradoresUnicos,
    tempoTotalGeral
  } = resumo;

  const handleDetailClick = (tipo, e) => {
    e.stopPropagation();
    if (onOpenDetail) {
      onOpenDetail(clienteId, tipo, e);
    }
  };

  return (
    <div className="client-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Contratos - sempre mostra, mesmo se for 0 */}
      <div
        className="client-info-item resumo-item resumo-item-contratos"
        data-cliente-id={clienteId}
        data-tipo="contratos"
      >
        <i className="fas fa-file-contract"></i>
        <span className="value contratos-value">
          Contratos: <span style={{ color: '#28a745' }}>{totalContratos || 0}</span>
        </span>
        {totalContratos > 0 && (
          <span
            className="resumo-arrow produtos-arrow"
            onClick={(e) => handleDetailClick('contratos', e)}
            title="Ver detalhes de contratos"
          >
            &gt;
          </span>
        )}
      </div>

      {/* Tarefas - sempre mostra, mesmo se for 0 */}
      <div
        className="client-info-item resumo-item resumo-item-tarefas"
        data-cliente-id={clienteId}
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
        className="client-info-item resumo-item resumo-item-produtos"
        data-cliente-id={clienteId}
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

      {/* Colaboradores - sempre mostra, mesmo se for 0 */}
      <div
        className="client-info-item resumo-item resumo-item-colaboradores"
        data-cliente-id={clienteId}
        data-tipo="colaboradores"
      >
        <i className="fas fa-users"></i>
        <span className="value colaboradores-value">Colaboradores: {totalColaboradoresUnicos || 0}</span>
        {totalColaboradoresUnicos > 0 && (
          <span
            className="resumo-arrow produtos-arrow"
            onClick={(e) => handleDetailClick('colaboradores', e)}
            title="Ver detalhes de colaboradores"
          >
            &gt;
          </span>
        )}
      </div>

      {/* Tempo total geral - sempre mostra, mesmo se for 0 */}
      <div className="client-info-item">
        <i className="fas fa-stopwatch"></i>
        <span className="value horas-realizadas-value">
          {(() => {
            if (!tempoTotalGeral || tempoTotalGeral === 0) {
              return 'H.R: 0h 0min 0s';
            }
            const horas = Math.floor(tempoTotalGeral / (1000 * 60 * 60));
            const minutos = Math.floor((tempoTotalGeral % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((tempoTotalGeral % (1000 * 60)) / 1000);
            let tempoFormatado = '';
            if (horas > 0) tempoFormatado += `${horas}h `;
            if (minutos > 0 || horas > 0) tempoFormatado += `${minutos}min `;
            if (segundos > 0 || (horas === 0 && minutos === 0)) tempoFormatado += `${segundos}s`;
            return `H.R: ${tempoFormatado.trim()}`;
          })()}
        </span>
        {tempoTotalGeral > 0 && (
          <i
            className="fas fa-info-circle"
            style={{ marginLeft: '4px', fontSize: '0.75rem', color: 'var(--gray-400)', cursor: 'help' }}
            title={`${formatarTempoDecimal(tempoTotalGeral)} horas`}
          ></i>
        )}
      </div>
    </div>
  );
};

export default ClientCardSummary;

