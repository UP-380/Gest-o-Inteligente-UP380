import React from 'react';

/**
 * Componente de Tempo Realizado do Cliente
 * 
 * @param {Object} props
 * @param {number} props.tempoRealizadoTotal - Tempo realizado total em milissegundos
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em formato HMS (ex: "24min 35s")
 * @param {boolean} props.modoQuadro - Se true, usa estilos do modo quadro (fonte menor)
 */
const ClienteTempoRealizado = ({
  tempoRealizadoTotal = 0,
  formatarTempoHMS,
  modoQuadro = false
}) => {
  if (tempoRealizadoTotal <= 0 || !formatarTempoHMS) return null;

  const tempoRealizadoFormatado = formatarTempoHMS(tempoRealizadoTotal);
  const className = modoQuadro
    ? 'painel-usuario-grupo-tempo-realizado has-tooltip painel-usuario-quadro-tempo'
    : 'painel-usuario-grupo-tempo-realizado';

  return (
    <span className={className}>
      <i className="fas fa-play-circle painel-usuario-realizado-icon-inline"></i>
      {tempoRealizadoFormatado}
      {modoQuadro && <div className="filter-tooltip">Tempo realizado</div>}
    </span>
  );
};

export default ClienteTempoRealizado;




