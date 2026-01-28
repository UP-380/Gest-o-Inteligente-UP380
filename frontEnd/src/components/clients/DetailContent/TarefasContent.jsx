import React, { useState, useEffect, useMemo } from 'react';

const API_BASE_URL = '/api';

const TarefasContent = ({ registros }) => {
  const [expandedTarefas, setExpandedTarefas] = useState(new Set());
  const [expandedColaboradores, setExpandedColaboradores] = useState(new Set());
  const [tiposTarefaMap, setTiposTarefaMap] = useState(new Map());
  const [custosPorColaborador, setCustosPorColaborador] = useState({});

  // Buscar tipos de tarefa para criar mapa de clickup_id -> nome
  useEffect(() => {
    const loadTiposTarefa = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/tipo-tarefa?limit=1000`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const map = new Map();
            result.data.forEach(tipo => {
              if (tipo.clickup_id) {
                map.set(String(tipo.clickup_id).trim(), tipo.nome);
              }
            });
            setTiposTarefaMap(map);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar tipos de tarefa:', error);
      }
    };

    loadTiposTarefa();
  }, []);

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

  // Carregar custos para todos os colaboradores únicos dos registros
  useEffect(() => {
    const carregarCustos = async () => {
      // Regra 1: Bloqueio imediato se solicitado globalmente
      if (window.blockDetailedFetches) {
        return;
      }

      if (!registros || registros.length === 0) return;

      const colaboradoresIds = new Set();
      registros.forEach(registro => {
        const colaboradorId = registro.usuario_id || registro.membro?.id;
        if (colaboradorId) {
          colaboradoresIds.add(String(colaboradorId));
        }
      });

      const idsParaBuscar = Array.from(colaboradoresIds).filter(id => !custosPorColaborador[id]);
      if (idsParaBuscar.length === 0) return;

      // Regra 2: Batching de busca de custos (lotes de 3)
      const batchSize = 3;
      const novosCustosMap = {};
      let abortadoPorErro = false;

      for (let i = 0; i < idsParaBuscar.length; i += batchSize) {
        if (abortadoPorErro) break;

        const batch = idsParaBuscar.slice(i, i + batchSize);

        try {
          const resultados = await Promise.all(
            batch.map(async (colaboradorId) => {
              try {
                const params = new URLSearchParams({ membro_id: colaboradorId });
                const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/mais-recente?${params}`, {
                  credentials: 'include',
                  headers: { 'Accept': 'application/json' }
                });

                // Regra 5: Tratar 503 como fallback silencioso e abortar
                if (response.status === 503) {
                  console.warn(`[TarefasContent] Servidor sobrecarregado (503) para colaborador ${colaboradorId}. Abortando.`);
                  if (typeof window.setBackendOverloaded === 'function') {
                    window.setBackendOverloaded(true);
                  }
                  abortadoPorErro = true;
                  return null;
                }

                if (response.ok) {
                  const result = await response.json();
                  return { colaboradorId, custoHora: result.success && result.data ? result.data.custo_hora : null };
                }
                return { colaboradorId, custoHora: null };
              } catch (err) {
                console.error(`[TarefasContent] Erro ao buscar custo do colaborador ${colaboradorId}:`, err);
                return { colaboradorId, custoHora: null };
              }
            })
          );

          resultados.forEach(res => {
            if (res) {
              novosCustosMap[res.colaboradorId] = res.custoHora;
            }
          });
        } catch (e) {
          console.error('[TarefasContent] Erro no lote de busca de custos:', e);
        }
      }

      // Atualizar estado com todos os novos custos
      if (Object.keys(novosCustosMap).length > 0) {
        setCustosPorColaborador(prev => ({ ...prev, ...novosCustosMap }));
      }
    };

    carregarCustos();
  }, [registros]);

  // Calcular custo realizado por tempo
  const calcularCustoRealizado = (tempoMilissegundos, colaboradorId) => {
    if (!tempoMilissegundos || !colaboradorId) return null;

    const custoHoraStr = custosPorColaborador[String(colaboradorId)];
    if (!custoHoraStr) return null;

    // Converter custo_hora de string (formato "21,22") para número
    const custoHora = parseFloat(custoHoraStr.replace(',', '.'));
    if (isNaN(custoHora) || custoHora <= 0) return null;

    // Converter tempo de milissegundos para horas
    const tempoHoras = tempoMilissegundos / 3600000;

    // Custo = custo por hora * tempo em horas
    const custo = custoHora * tempoHoras;
    return custo;
  };

  // Calcular custo total realizado de uma tarefa (soma de todos os colaboradores)
  const calcularCustoRealizadoTarefa = (tarefa) => {
    let custoTotal = 0;
    let temCusto = false;

    tarefa.colaboradores.forEach((colaborador, colaboradorId) => {
      const custoColaborador = calcularCustoRealizado(colaborador.tempoTotal, colaboradorId);
      if (custoColaborador !== null) {
        custoTotal += custoColaborador;
        temCusto = true;
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

  if (!registros || registros.length === 0) {
    return <div className="empty-state"><p>Nenhuma tarefa encontrada</p></div>;
  }

  const fmtMs = (ms) => {
    const val = typeof ms === 'number' ? ms : 0;
    if (val <= 0) return '0s';
    const h = Math.floor(val / 3600000);
    const m = Math.floor((val % 3600000) / 60000);
    const s = Math.floor((val % 60000) / 1000);
    if (h > 0 && m > 0) return `${h}h ${String(m).padStart(2, '0')}min${s > 0 ? ` ${s}s` : ''}`;
    if (h > 0 && m === 0) return `${h}h${s > 0 ? ` ${s}s` : ''}`;
    if (h === 0 && m > 0) return s > 0 ? `${m}min ${s}s` : `${m}min`;
    return `${s}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('pt-BR');
    } catch (e) {
      return '—';
    }
  };

  // Agrupar registros por tarefa_id
  const tarefasMap = new Map();
  registros.forEach(registro => {
    if (!registro.tarefa_id) return;

    const tarefaId = String(registro.tarefa_id).trim();
    const nomeTarefa = registro.tarefa?.nome ||
      registro.tarefa?.tarefa_nome ||
      registro.tarefa?.titulo ||
      registro.tarefa?.descricao ||
      `Tarefa #${tarefaId}`;
    const urlTarefa = registro.tarefa?.url || null;
    const dtInicio = registro.tarefa?.dt_inicio || registro.tarefa?.data_inicio || null;
    const dtVencimento = registro.tarefa?.dt_vencimento || registro.tarefa?.data_vencimento || null;
    const tempoEstimado = registro.tarefa?.tempo_estimado || 0;
    const tipoTarefaId = registro.tarefa?.tipoatividade_id || null;
    const tipoTarefaNome = tipoTarefaId ? tiposTarefaMap.get(String(tipoTarefaId).trim()) : null;

    if (!tarefasMap.has(tarefaId)) {
      tarefasMap.set(tarefaId, {
        nome: nomeTarefa,
        url: urlTarefa,
        dtInicio,
        dtVencimento,
        tempoEstimado,
        tipoTarefaId,
        tipoTarefaNome,
        registros: [],
        tempoTotal: 0,
        colaboradores: new Map()
      });
    }

    const tarefa = tarefasMap.get(tarefaId);
    tarefa.registros.push(registro);

    const tempoRealizado = Number(registro.tempo_realizado) || 0;
    // Se valor < 1 (decimal), está em horas -> converter para ms
    // Se valor >= 1, já está em ms
    // Se resultado < 1 segundo, arredondar para 1 segundo
    let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
    if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
    tarefa.tempoTotal += tempoMs;

    const colaboradorId = registro.usuario_id || registro.membro?.id || 'desconhecido';
    const colaboradorNome = registro.membro?.nome || `Colaborador ${colaboradorId}`;
    const colaboradorStatus = registro.membro?.status || 'ativo';

    if (!tarefa.colaboradores.has(colaboradorId)) {
      tarefa.colaboradores.set(colaboradorId, {
        nome: colaboradorNome,
        status: colaboradorStatus,
        registros: [],
        tempoTotal: 0
      });
    }

    const colaborador = tarefa.colaboradores.get(colaboradorId);
    colaborador.registros.push(registro);
    colaborador.tempoTotal += tempoMs;
  });

  if (tarefasMap.size === 0) {
    return <div className="empty-state"><p>Nenhuma tarefa encontrada</p></div>;
  }

  const toggleTarefa = (tarefaId) => {
    const newExpanded = new Set(expandedTarefas);
    if (newExpanded.has(tarefaId)) {
      newExpanded.delete(tarefaId);
    } else {
      newExpanded.add(tarefaId);
    }
    setExpandedTarefas(newExpanded);
  };

  const toggleColaborador = (tarefaId, colaboradorId) => {
    const key = `${tarefaId}-${colaboradorId}`;
    const newExpanded = new Set(expandedColaboradores);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedColaboradores(newExpanded);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {Array.from(tarefasMap.entries()).map(([tarefaId, tarefa]) => {
        // Formatar datas: se não tiver, mostrar "Sem Inicio" ou "Sem vencimento"
        const ini = tarefa.dtInicio ? formatDate(tarefa.dtInicio) : 'Sem Início';
        const ven = tarefa.dtVencimento ? formatDate(tarefa.dtVencimento) : 'Sem vencimento';
        const range = `${ini} - ${ven}`;

        const estVal = parseFloat(tarefa.tempoEstimado) || 0;
        const estMs = estVal > 1000 ? estVal : Math.round(estVal * 3600000);
        const estText = fmtMs(estMs);

        const rastText = fmtMs(tarefa.tempoTotal);
        const rastDecimal = (tarefa.tempoTotal / 3600000).toFixed(2);
        const isExpanded = expandedTarefas.has(tarefaId);

        return (
          <div
            key={tarefaId}
            className="tt-tarefa-item"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid #eef2f7',
              borderRadius: '12px',
              padding: '12px',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px', letterSpacing: '.2px' }}>
                  {tarefa.nome}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {tarefa.url && (
                  <button
                    onClick={() => window.open(tarefa.url, '_blank')}
                    title="Redirecionar"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <i className="fas fa-external-link-alt" style={{ color: '#f59e0b', fontSize: '14px' }}></i>
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '12px' }}>
              <span>{range}</span>
              {tarefa.tipoTarefaNome && (
                <span style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500
                }}>
                  {tarefa.tipoTarefaNome}
                </span>
              )}
              <i className="fas fa-info-circle" style={{ color: '#9ca3af', fontSize: '12px' }} title="Data inicio - Data Vencimento da tarefa"></i>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '12px' }}>
              <i className="fas fa-clock" style={{ color: '#2563eb' }}></i>
              <span>
                Estimado:{' '}
                <span
                  style={{
                    background: '#eef2ff',
                    color: '#1e3a8a',
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}
                  title={`${(estMs / 3600000).toFixed(2)}h`}
                >
                  {estText}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#374151', fontSize: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-stopwatch" style={{ color: '#f59e0b' }}></i>
                <span>
                  Realizado:{' '}
                  <span
                    style={{
                      background: '#eef2ff',
                      color: '#1e3a8a',
                      padding: '2px 8px',
                      borderRadius: '999px'
                    }}
                    title={`${rastDecimal}h`}
                  >
                    {rastText}
                  </span>
                  {(() => {
                    const custoRealizadoTarefa = calcularCustoRealizadoTarefa(tarefa);
                    if (custoRealizadoTarefa !== null) {
                      return (
                        <span
                          style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            marginLeft: '8px'
                          }}
                        >
                          {formatarValorMonetario(custoRealizadoTarefa)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </span>
              </span>
              <button
                className="tt-rastreado-arrow"
                title="Expandir colaboradores"
                onClick={() => toggleTarefa(tarefaId)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <i
                  className="fas fa-chevron-down"
                  style={{
                    color: '#1e3a8a',
                    fontSize: '12px',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                ></i>
              </button>
            </div>
            {isExpanded && (
              <div
                className="tt-rastreio-users"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingLeft: '8px',
                  borderLeft: '2px solid #e5e7eb',
                  marginTop: '8px'
                }}
              >
                {Array.from(tarefa.colaboradores.entries()).map(([colaboradorId, colaborador]) => {
                  const tempoText = fmtMs(colaborador.tempoTotal);
                  const tempoDecimal = (colaborador.tempoTotal / 3600000).toFixed(2);
                  const colKey = `${tarefaId}-${colaboradorId}`;
                  const isColExpanded = expandedColaboradores.has(colKey);
                  const isInativo = colaborador.status === 'inativo';
                  const iconColor = isInativo ? '#ef4444' : '#ff9800';

                  return (
                    <div
                      key={colaboradorId}
                      className="tt-colaborador-item"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <i className="fas fa-user" style={{ color: iconColor, fontSize: '14px' }}></i>
                          <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{colaborador.nome}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              background: '#eef2ff',
                              color: '#1e3a8a',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 500
                            }}
                            title={`${tempoDecimal}h`}
                          >
                            {tempoText}
                          </span>
                          {(() => {
                            const custoRealizadoColaborador = calcularCustoRealizado(colaborador.tempoTotal, colaboradorId);
                            if (custoRealizadoColaborador !== null) {
                              return (
                                <span
                                  style={{
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontSize: '12px',
                                    fontWeight: 600
                                  }}
                                >
                                  {formatarValorMonetario(custoRealizadoColaborador)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <button
                            className="tt-colaborador-expand-arrow"
                            title="Expandir registros"
                            onClick={() => toggleColaborador(tarefaId, colaboradorId)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            <i
                              className="fas fa-chevron-down"
                              style={{
                                color: '#1e3a8a',
                                fontSize: '12px',
                                transform: isColExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                              }}
                            ></i>
                          </button>
                        </div>
                      </div>
                      {isColExpanded && (
                        <div
                          className="tt-colaborador-registros"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            paddingLeft: '24px',
                            marginTop: '4px'
                          }}
                        >
                          {colaborador.registros.map((registro, idx) => {
                            const tempoRealizado = Number(registro.tempo_realizado) || 0;
                            // Se valor < 1 (decimal), está em horas -> converter para ms
                            // Se valor >= 1, já está em ms
                            // Se resultado < 1 segundo, arredondar para 1 segundo
                            let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
                            if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
                            const tempoText = fmtMs(tempoMs);
                            const tempoDecimal = (tempoMs / 3600000).toFixed(2);

                            let dataRegistro = null;
                            if (registro.data_inicio) {
                              dataRegistro = new Date(registro.data_inicio);
                            } else if (registro.created_at) {
                              dataRegistro = new Date(registro.created_at);
                            } else if (registro.data) {
                              dataRegistro = new Date(registro.data);
                            }

                            const dataFormatada = dataRegistro
                              ? dataRegistro.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                              : '';

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  fontSize: '12px',
                                  background: '#f9fafb',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '10px',
                                  padding: '8px',
                                  color: '#374151'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <i className="fas fa-stopwatch" style={{ color: '#94a3b8' }}></i>
                                  <span
                                    style={{
                                      background: '#eef2ff',
                                      color: '#1e3a8a',
                                      padding: '2px 8px',
                                      borderRadius: '999px'
                                    }}
                                    title={`${tempoDecimal}h`}
                                  >
                                    {tempoText}
                                  </span>
                                </div>
                                {dataFormatada && <div style={{ color: '#6b7280' }}>{dataFormatada}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TarefasContent;

