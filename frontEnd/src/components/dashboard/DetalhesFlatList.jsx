import React from 'react';
import './TarefasDetalhadasList.css';

/**
 * Lista plana de detalhes - exibe apenas primeiro nível.
 * Cada item: id, nome, total_estimado_ms, total_realizado_ms
 * Mesmo design das listas originais (cards com ESTIMADO/REALIZADO).
 * Sem árvore, sem expand/collapse, sem drill-down.
 */
const DetalhesFlatList = ({ items, formatarTempoHMS }) => {
  if (!items || items.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhum item encontrado</p>
      </div>
    );
  }

  return (
    <div className="tarefas-detalhadas-list">
      {items.map((item, index) => {
        const estimadoMs = item.total_estimado_ms ?? item.tempoEstimado ?? 0;
        const realizadoMs = item.total_realizado_ms ?? item.tempoRealizado ?? 0;
        const key = item.id ?? item.originalId ?? item.original_id ?? index;
        const tempoEstimadoFormatado = formatarTempoHMS ? formatarTempoHMS(estimadoMs) : '0s';
        const tempoRealizadoFormatado = formatarTempoHMS ? formatarTempoHMS(realizadoMs) : '0s';

        return (
          <div key={key} className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1">
            <div className="tarefa-detalhada-header">
              <div className="tarefa-detalhada-info">
                <div className="tarefa-detalhada-nome">
                  <i className="fas fa-list" style={{ marginRight: '8px' }}></i>
                  {item.nome ?? '—'}
                </div>
                <div className="tarefa-detalhada-metrics">
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-estimado">
                      <i className="fas fa-clock"></i>
                      <span>ESTIMADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-card-content">
                      <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                        {tempoEstimadoFormatado}
                      </div>
                    </div>
                  </div>
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-realizado">
                      <i className="fas fa-stopwatch"></i>
                      <span>REALIZADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-card-content">
                      <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                        {tempoRealizadoFormatado}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DetalhesFlatList;
