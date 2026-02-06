import React, { useState, useEffect } from 'react';
import { formatTimeDuration } from '../../utils/dateUtils';
import './ClientCardSummary.css';

const API_BASE_URL = '/api';

// Formatar tempo em decimal
const formatarTempoDecimal = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0.00';
  const horas = milissegundos / (1000 * 60 * 60);
  return horas.toFixed(2);
};

const ClientCardSummary = ({ resumo, clienteId, contratos, registros, onOpenDetail }) => {
  const [custosPorColaborador, setCustosPorColaborador] = useState({});
  const {
    tempoPorColaborador,
    totalTarefasUnicas,
    totalProdutosUnicos,
    totalContratos,
    totalColaboradoresUnicos,
    tempoTotalGeral,
    tempoEstimadoGeral
  } = resumo;

  const handleDetailClick = (tipo, e) => {
    e.stopPropagation();
    if (onOpenDetail) {
      onOpenDetail(clienteId, tipo, e);
    }
  };

  // Buscar custo/hora de um colaborador
  const buscarCustoPorColaborador = async (colaboradorId) => {
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
          return result.data.custo_hora || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar custo por colaborador:', error);
      return null;
    }
  };

  // Carregar custos para todos os colaboradores
  useEffect(() => {
    const carregarCustos = async () => {
      if (!tempoPorColaborador || Object.keys(tempoPorColaborador).length === 0) return;

      setCustosPorColaborador(prevCustos => {
        const novosCustos = { ...prevCustos };
        const colaboradoresIds = Object.keys(tempoPorColaborador);
        const idsParaBuscar = colaboradoresIds.filter(id => !novosCustos[id]);

        if (idsParaBuscar.length === 0) return prevCustos;

        // Buscar custos em paralelo
        Promise.all(
          idsParaBuscar.map(async (colaboradorId) => {
            const custoHora = await buscarCustoPorColaborador(colaboradorId);
            return { colaboradorId, custoHora };
          })
        ).then(resultados => {
          const custosAtualizados = { ...novosCustos };
          resultados.forEach(({ colaboradorId, custoHora }) => {
            custosAtualizados[colaboradorId] = custoHora;
          });
          setCustosPorColaborador(custosAtualizados);
        });

        return prevCustos;
      });
    };

    carregarCustos();
  }, [tempoPorColaborador]);

  // Calcular custo realizado total
  const calcularCustoRealizadoTotal = () => {
    if (!tempoPorColaborador || Object.keys(tempoPorColaborador).length === 0) return null;

    let custoTotal = 0;
    let temCusto = false;

    Object.entries(tempoPorColaborador).forEach(([colaboradorId, colaborador]) => {
      const tempoRealizado = Number(colaborador.total) || 0;
      // Se valor < 1 (decimal), está em horas -> converter para ms
      // Se valor >= 1, já está em ms
      let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;

      const custoHoraStr = custosPorColaborador[String(colaboradorId)];
      if (custoHoraStr) {
        // Converter custo_hora de string (formato "21,22") para número
        const custoHora = parseFloat(custoHoraStr.replace(',', '.'));
        if (!isNaN(custoHora) && custoHora > 0) {
          // Converter tempo de milissegundos para horas
          const tempoHoras = tempoMs / 3600000;
          // Custo = custo por hora * tempo em horas
          custoTotal += custoHora * tempoHoras;
          temCusto = true;
        }
      }
    });

    return temCusto ? custoTotal : null;
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

      {/* Tempo total geral (Estimado e Realizado) */}
      <div className="client-info-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
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
                {formatTimeDuration(tempoTotalGeral)}
              </span>
              {tempoTotalGeral > tempoEstimadoGeral && tempoEstimadoGeral > 0 && (
                <span
                  style={{ fontWeight: 700, marginLeft: '5px' }}
                  title={`Excedeu ${formatTimeDuration(tempoTotalGeral - tempoEstimadoGeral)} do tempo estimado`}
                >
                  (+{formatTimeDuration(tempoTotalGeral - tempoEstimadoGeral)})
                </span>
              )}
            </div>
            {(() => {
              const custoRealizadoTotal = calcularCustoRealizadoTotal();
              if (custoRealizadoTotal !== null) {
                return (
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                    Custo: <span style={{ fontWeight: 600 }}>{formatarValorMonetario(custoRealizadoTotal)}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {tempoTotalGeral > 0 && (
          <i
            className="fas fa-info-circle"
            style={{ fontSize: '0.75rem', color: 'var(--gray-400)', cursor: 'help', marginTop: '5px' }}
            title={`${formatarTempoDecimal(tempoTotalGeral)} horas`}
          ></i>
        )}
      </div>
    </div>
  );
};

export default ClientCardSummary;

