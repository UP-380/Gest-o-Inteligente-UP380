import React, { useState, useEffect } from 'react';

const API_BASE_URL = '/api';

const ColaboradoresContent = ({ clienteId, tempoPorColaborador, registros }) => {
  const [expandedColaboradores, setExpandedColaboradores] = useState(new Set());
  const [expandedTarefas, setExpandedTarefas] = useState(new Set());
  const [custosPorColaborador, setCustosPorColaborador] = useState({});

  if (!tempoPorColaborador || Object.keys(tempoPorColaborador).length === 0) {
    return <div className="empty-state"><p>Nenhum colaborador encontrado</p></div>;
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

  const toggleColaborador = (colaboradorId) => {
    const newExpanded = new Set(expandedColaboradores);
    if (newExpanded.has(colaboradorId)) {
      newExpanded.delete(colaboradorId);
    } else {
      newExpanded.add(colaboradorId);
    }
    setExpandedColaboradores(newExpanded);
  };

  const toggleTarefa = (colaboradorId, tarefaId) => {
    const key = `${colaboradorId}-${tarefaId}`;
    const newExpanded = new Set(expandedTarefas);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTarefas(newExpanded);
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

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {Object.entries(tempoPorColaborador).map(([colaboradorId, colaborador]) => {
        const tempoRealizado = Number(colaborador.total) || 0;
        // Se valor < 1 (decimal), está em horas -> converter para ms
        // Se valor >= 1, já está em ms
        // Se resultado < 1 segundo, arredondar para 1 segundo
        let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
        if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
        const tempoText = fmtMs(tempoMs);
        const tempoDecimal = (tempoMs / 3600000).toFixed(2);

        const registrosColaborador = registros.filter(r => {
          const rId = r.usuario_id || r.membro?.id;
          return String(rId) === String(colaboradorId);
        });

        // Verificar se o colaborador está inativo
        // Primeiro tentar pegar do tempoPorColaborador, depois dos registros
        const colaboradorStatus = colaborador.status || 
                                  registrosColaborador[0]?.membro?.status || 
                                  'ativo';
        const isInativo = colaboradorStatus === 'inativo';
        const iconColor = isInativo ? '#ef4444' : '#2563eb';

        const isExpanded = expandedColaboradores.has(colaboradorId);

        // Agrupar registros por tarefa
        const tarefasMap = new Map();
        registrosColaborador.forEach(registro => {
          const tarefaId = registro.tarefa_id ? String(registro.tarefa_id).trim() : 'sem-tarefa';
          const nomeTarefa = registro.tarefa?.nome || 
                            registro.tarefa?.tarefa_nome ||
                            registro.tarefa?.titulo || 
                            registro.tarefa?.descricao || 
                            (tarefaId !== 'sem-tarefa' ? `Tarefa #${tarefaId}` : 'Tarefa sem nome');
          const urlTarefa = registro.tarefa?.url || null;
          const tempoEstimado = registro.tarefa?.tempo_estimado || 0;

          if (!tarefasMap.has(tarefaId)) {
            tarefasMap.set(tarefaId, {
              nome: nomeTarefa,
              url: urlTarefa,
              tempoEstimado,
              registros: [],
              tempoTotal: 0
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
        });

        const custoRealizado = calcularCustoRealizado(tempoMs, colaboradorId);

        return (
          <div key={colaboradorId} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {/* Nome do colaborador com ícone e seta */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 0'
              }}
              onClick={() => toggleColaborador(colaboradorId)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-user" style={{ color: iconColor, fontSize: '14px' }}></i>
                <span style={{ fontWeight: 500, fontSize: '12px', color: '#4b5563' }}>
                  {colaborador.nome}
                </span>
              </div>
              <i 
                className="fas fa-chevron-right" 
                style={{ 
                  color: '#2563eb', 
                  fontSize: '12px',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              ></i>
            </div>

            {/* Quadrado minimalista vermelho com tempo e custo */}
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
                Realizadas: <span style={{ fontWeight: 600 }}>{tempoDecimal}h</span>
              </div>
              {custoRealizado !== null && (
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500 }}>
                  Custo: <span style={{ fontWeight: 600 }}>{formatarValorMonetario(custoRealizado)}</span>
                </div>
              )}
            </div>
            {isExpanded && (
              <div
                className="tt-user-records"
                style={{
                  display: 'flex',
                  marginLeft: '8px',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {Array.from(tarefasMap.entries()).map(([tarefaId, tarefa]) => {
                  const estVal = parseFloat(tarefa.tempoEstimado) || 0;
                  const estMs = estVal > 1000 ? estVal : Math.round(estVal * 3600000);
                  const estText = fmtMs(estMs);
                  const rastText = fmtMs(tarefa.tempoTotal);
                  const rastDecimal = (tarefa.tempoTotal / 3600000).toFixed(2);
                  const tarefaKey = `${colaboradorId}-${tarefaId}`;
                  const isTarefaExpanded = expandedTarefas.has(tarefaKey);

                  return (
                    <div
                      key={tarefaId}
                      className="tt-colaborador-tarefa"
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
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px', letterSpacing: '.2px' }}>
                          {tarefa.nome}
                        </span>
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
                              const custoRealizadoTarefa = calcularCustoRealizado(tarefa.tempoTotal, colaboradorId);
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
                          className="tt-colaborador-tarefa-arrow"
                          title="Expandir registros"
                          onClick={() => toggleTarefa(colaboradorId, tarefaId)}
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
                              transform: isTarefaExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s'
                            }}
                          ></i>
                        </button>
                      </div>
                      {isTarefaExpanded && (
                        <div
                          className="tt-colaborador-registros-tarefa"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            paddingLeft: '8px',
                            borderLeft: '2px solid #e5e7eb',
                            marginTop: '8px'
                          }}
                        >
                          {tarefa.registros.map((registro, idx) => {
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

export default ColaboradoresContent;

