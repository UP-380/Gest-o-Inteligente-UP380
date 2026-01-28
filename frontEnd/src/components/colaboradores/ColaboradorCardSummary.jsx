import React, { useState, useEffect } from 'react';
import { formatTimeDuration } from '../../utils/dateUtils';
import './ColaboradorCardSummary.css';

const API_BASE_URL = '/api';

// Formatar tempo em decimal
const formatarTempoDecimal = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0.00';
  const horas = milissegundos / (1000 * 60 * 60);
  return horas.toFixed(2);
};

const ColaboradorCardSummary = ({ resumo, colaboradorId, registros, onOpenDetail }) => {
  const [custoHora, setCustoHora] = useState(null);
  const {
    totalTarefasUnicas,
    totalProdutosUnicos,
    totalClientesUnicos,
    tempoTotalRealizado,
    tempoEstimadoGeral
  } = resumo;

  const handleDetailClick = (tipo, e) => {
    e.stopPropagation();
    if (onOpenDetail) {
      onOpenDetail(colaboradorId, tipo, e);
    }
  };

  // Buscar custo/hora do colaborador
  useEffect(() => {
    const buscarCusto = async () => {
      if (!colaboradorId) return;

      // Regra 1: Bloqueio imediato se solicitado globalmente (ex: filtro sem responsável ou backend sobrecarregado)
      if (window.blockDetailedFetches || window.backendOverloaded === true) {
        return;
      }

      try {
        const params = new URLSearchParams({
          membro_id: colaboradorId
        });

        const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/mais-recente?${params}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (response.status === 503) {
          console.warn(`[ColaboradorCardSummary] Servidor sobrecarregado (503) ao buscar custo do colaborador ${colaboradorId}.`);
          if (typeof window.setBackendOverloaded === 'function') {
            window.setBackendOverloaded(true);
          }
          return;
        }

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setCustoHora(result.data.custo_hora || null);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar custo por colaborador:', error);
      }
    };

    buscarCusto();
  }, [colaboradorId]);

  // Calcular custo realizado total
  const calcularCustoRealizado = () => {
    if (!tempoTotalRealizado || !custoHora) return null;

    // Converter custo_hora de string (formato "21,22") para número
    const custoHoraNum = parseFloat(custoHora.replace(',', '.'));
    if (isNaN(custoHoraNum) || custoHoraNum <= 0) return null;

    // Converter tempo de milissegundos para horas
    const tempoHoras = tempoTotalRealizado / 3600000;

    // Custo = custo por hora * tempo em horas
    const custo = custoHoraNum * tempoHoras;
    return custo;
  };

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
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

      {/* Tempo total realizado (Estimado e Realizado) */}
      <div className="colaborador-info-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <i className="fas fa-stopwatch" style={{ marginTop: '5px' }}></i>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Tempo Estimado - ACIMA */}
          {tempoEstimadoGeral > 0 && (
            <div
              style={{
                background: '#eef2ff',
                borderRadius: '6px',
                padding: '6px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                width: 'fit-content',
                border: '1px solid #c7d2fe'
              }}
            >
              <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 500 }}>
                Estimado: <span style={{ fontWeight: 600 }}>
                  {formatTimeDuration(tempoEstimadoGeral)}
                </span>
              </div>
            </div>
          )}

          {/* Tempo Realizado */}
          <div
            style={{
              background: '#fee2e2',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              width: 'fit-content'
            }}
          >
            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
              Realizadas: <span style={{ fontWeight: 600 }}>
                {formatTimeDuration(tempoTotalRealizado)}
              </span>
              {tempoTotalRealizado > tempoEstimadoGeral && tempoEstimadoGeral > 0 && (
                <span
                  style={{ fontWeight: 700, marginLeft: '5px' }}
                  title={`Excedeu ${formatTimeDuration(tempoTotalRealizado - tempoEstimadoGeral)} do tempo estimado`}
                >
                  (+{formatTimeDuration(tempoTotalRealizado - tempoEstimadoGeral)})
                </span>
              )}
            </div>
            {(() => {
              const custoRealizado = calcularCustoRealizado();
              if (custoRealizado !== null) {
                return (
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                    Custo: <span style={{ fontWeight: 600 }}>{formatarValorMonetario(custoRealizado)}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {tempoTotalRealizado > 0 && (
          <i
            className="fas fa-info-circle"
            style={{ fontSize: '0.75rem', color: 'var(--gray-400)', cursor: 'help', marginTop: '5px' }}
            title={`${formatarTempoDecimal(tempoTotalRealizado)} horas`}
          ></i>
        )}
      </div>
    </div>
  );
};

export default ColaboradorCardSummary;

