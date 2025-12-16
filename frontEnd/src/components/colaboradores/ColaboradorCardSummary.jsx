import React, { useState, useEffect } from 'react';
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
    tempoTotalRealizado
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

      try {
        const params = new URLSearchParams({
          membro_id: colaboradorId
        });

        const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/mais-recente?${params}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

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

      {/* Tempo total realizado - sempre mostra, mesmo se for 0 */}
      <div className="colaborador-info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="fas fa-stopwatch"></i>
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
            Realizadas: <span style={{ fontWeight: 600, color: '#ef4444' }}>
              {(() => {
                if (!tempoTotalRealizado || tempoTotalRealizado === 0) {
                  return '0h 0min 0s';
                }
                const horas = Math.floor(tempoTotalRealizado / (1000 * 60 * 60));
                const minutos = Math.floor((tempoTotalRealizado % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((tempoTotalRealizado % (1000 * 60)) / 1000);
                let tempoFormatado = '';
                if (horas > 0) tempoFormatado += `${horas}h `;
                if (minutos > 0 || horas > 0) tempoFormatado += `${minutos}min `;
                if (segundos > 0 || (horas === 0 && minutos === 0)) tempoFormatado += `${segundos}s`;
                return tempoFormatado.trim();
              })()}
            </span>
          </div>
          {(() => {
            const custoRealizado = calcularCustoRealizado();
            if (custoRealizado !== null) {
              return (
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                  Custo: <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatarValorMonetario(custoRealizado)}</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
        {tempoTotalRealizado > 0 && (
          <i
            className="fas fa-info-circle"
            style={{ fontSize: '0.75rem', color: 'var(--gray-400)', cursor: 'help' }}
            title={`${formatarTempoDecimal(tempoTotalRealizado)} horas`}
          ></i>
        )}
      </div>
    </div>
  );
};

export default ColaboradorCardSummary;

