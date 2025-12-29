import React from 'react';

/**
 * Componente de Tempo Estimado do Cliente
 * 
 * @param {Object} props
 * @param {number} props.tempoEstimadoTotal - Tempo estimado total em horas (formato decimal, ex: 9.0)
 * @param {boolean} props.modoQuadro - Se true, usa estilos do modo quadro (fonte menor)
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em formato HMS (ex: "1h 30min")
 */
const ClienteTempoEstimado = ({
  tempoEstimadoTotal = 0,
  modoQuadro = false,
  formatarTempoHMS
}) => {
  if (tempoEstimadoTotal <= 0) return null;

  // Converter horas decimais para milissegundos e formatar
  let tempoEstimadoFormatado;
  if (formatarTempoHMS) {
    const tempoMs = tempoEstimadoTotal * 3600000; // Converter horas para milissegundos
    tempoEstimadoFormatado = formatarTempoHMS(tempoMs);
  } else {
    // Fallback para formato decimal se não tiver função de formatação
    tempoEstimadoFormatado = `${tempoEstimadoTotal.toFixed(1)}h`;
  }
  
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




