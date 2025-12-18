import React from 'react';

/**
 * Componente de Tempo Estimado do Cliente
 * 
 * @param {Object} props
 * @param {number} props.tempoEstimadoTotal - Tempo estimado total em horas (formato decimal, ex: 9.0)
 * @param {boolean} props.modoQuadro - Se true, usa estilos do modo quadro (fonte menor)
 */
const ClienteTempoEstimado = ({
  tempoEstimadoTotal = 0,
  modoQuadro = false
}) => {
  if (tempoEstimadoTotal <= 0) return null;

  const tempoEstimadoFormatado = `${tempoEstimadoTotal.toFixed(1)}h`;
  const className = modoQuadro 
    ? 'painel-usuario-grupo-tempo-total has-tooltip painel-usuario-quadro-tempo'
    : 'painel-usuario-grupo-tempo-total has-tooltip';

  return (
    <span className={className}>
      <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '12px', marginRight: '4px' }}></i>
      {tempoEstimadoFormatado}
      <div className="filter-tooltip">Tempo estimado</div>
    </span>
  );
};

export default ClienteTempoEstimado;

