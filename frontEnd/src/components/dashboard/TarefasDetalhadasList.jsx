import React, { useState } from 'react';
import './TarefasDetalhadasList.css';

/**
 * Componente para listar tarefas detalhadas com registros individuais
 * 
 * @param {Object} props
 * @param {Array} props.tarefas - Array de tarefas com tempo realizado e custo
 * @param {Set} props.tarefasExpandidas - Set com IDs das tarefas expandidas
 * @param {Object} props.registrosIndividuais - Objeto com registros individuais por tarefa ID
 * @param {Object} props.carregandoRegistros - Objeto com estado de carregamento por tarefa ID
 * @param {Function} props.formatarTempoEstimado - Função para formatar tempo estimado
 * @param {Function} props.calcularCustoPorTempo - Função para calcular custo por tempo
 * @param {Function} props.formatarValorMonetario - Função para formatar valor monetário
 * @param {Function} props.formatarDataHora - Função para formatar data e hora
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em HMS
 * @param {Function} props.onToggleTarefa - Função chamada ao clicar no botão de expandir/colapsar
 * @param {Function} props.getNomeCliente - Função para obter o nome do cliente pelo ID
 */
const TarefasDetalhadasList = ({
  tarefas,
  tarefasExpandidas,
  registrosIndividuais,
  carregandoRegistros,
  formatarTempoEstimado,
  calcularCustoPorTempo,
  formatarValorMonetario,
  formatarDataHora,
  formatarTempoHMS,
  onToggleTarefa,
  getNomeCliente,
  getNomeColaboradorPorUsuarioId = null
}) => {
  const [responsaveisExpandidos, setResponsaveisExpandidos] = useState(new Set());

  const toggleResponsavel = (tarefaId, dataNormalizada, responsavelKey) => {
    const key = `${tarefaId}_${dataNormalizada}_${responsavelKey}`;
    setResponsaveisExpandidos(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      return newExpanded;
    });
  };
  if (!tarefas || tarefas.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhuma tarefa encontrada</p>
      </div>
    );
  }

  // Função para verificar se uma string é um UUID (ID)
  const isUUID = (str) => {
    if (!str || typeof str !== 'string') return false;
    // Padrão UUID: 8-4-4-4-12 caracteres hexadecimais
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(str);
  };

  // Agrupar tarefas por cliente
  const tarefasPorCliente = new Map();
  tarefas.forEach(tarefa => {
    const clienteId = tarefa.clienteId || 'sem-cliente';
    let clienteNome = tarefa.clienteId && getNomeCliente
      ? getNomeCliente(tarefa.clienteId)
      : 'Sem Cliente';

    // Se o clienteNome for um UUID (ID), usar o nome da tarefa ao invés
    if (isUUID(clienteNome)) {
      clienteNome = tarefa.nome || 'Sem Cliente';
    }

    if (!tarefasPorCliente.has(clienteId)) {
      tarefasPorCliente.set(clienteId, {
        clienteId: clienteId === 'sem-cliente' ? null : clienteId,
        clienteNome,
        tarefas: []
      });
    }

    tarefasPorCliente.get(clienteId).tarefas.push(tarefa);
  });

  // Ajustar clienteNome para usar nome da tarefa se ainda for ID ou "Sem Cliente"
  tarefasPorCliente.forEach((grupo) => {
    if (grupo.clienteNome === 'Sem Cliente' || isUUID(grupo.clienteNome)) {
      // Usar o nome da primeira tarefa do grupo
      if (grupo.tarefas.length > 0 && grupo.tarefas[0].nome) {
        grupo.clienteNome = grupo.tarefas[0].nome;
      }
    }
  });

  return (
    <div className="tarefas-detalhadas-list">
      {Array.from(tarefasPorCliente.values()).map((grupoCliente, grupoIndex) => (
        <div key={`cliente_${grupoCliente.clienteId || 'sem-cliente'}_${grupoIndex}`} className="tarefa-detalhada-cliente-group">
          <div className="tarefa-detalhada-cliente-header">
            <i className="fas fa-building" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
            {grupoCliente.clienteNome}
          </div>
          <div className="tarefa-detalhada-cliente-tarefas">
            {grupoCliente.tarefas.map((tarefa, index) => {
              const isExpanded = tarefasExpandidas.has(tarefa.id);

              // Tempo realizado sempre 0 (lógica removida)
              const tempoRealizadoFormatado = '0s';

              const tempoEstimadoFormatado = formatarTempoEstimado
                ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                : '0s';

              // Calcular custo estimado
              const custoEstimado = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, tarefa.responsavelId)
                : null;

              return (
                <div
                  key={`tarefa_${tarefa.id}_${index}`}
                  className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1"
                >
                  <div className="tarefa-detalhada-header">
                    <div className="tarefa-detalhada-info">
                      <div className="tarefa-detalhada-nome">
                        <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                        {tarefa.nome}
                      </div>
                      <div className="tarefa-detalhada-metrics">
                        {/* Card Estimado */}
                        <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado">
                          <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-estimado">
                            <i className="fas fa-clock"></i>
                            <span>ESTIMADO</span>
                          </div>
                          <div className="tarefa-detalhada-tempo-card-content">
                            <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                              {tempoEstimadoFormatado}
                            </div>
                            {custoEstimado !== null && formatarValorMonetario && (
                              <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                {formatarValorMonetario(custoEstimado)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Realizado */}
                        <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado">
                          <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-realizado">
                            <i className="fas fa-stopwatch"></i>
                            <span>REALIZADO</span>
                          </div>
                          <div className="tarefa-detalhada-tempo-card-content">
                            <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                              0s
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {tarefa.registros && tarefa.registros.length > 0 && (
                      <button
                        className="tarefa-detalhada-toggle"
                        onClick={() => onToggleTarefa(tarefa.id)}
                        title={isExpanded ? "Ocultar registros" : "Ver registros"}
                      >
                        <i
                          className={`fas fa-chevron-down ${isExpanded ? 'expanded' : ''}`}
                        ></i>
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="tarefa-detalhada-registros">
                      <div className="tarefa-detalhada-registros-title">
                        Registros de Tempo Realizado:
                      </div>
                      {carregandoRegistros[tarefa.id] ? (
                        <div className="tarefa-detalhada-loading">
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>Carregando...</span>
                        </div>
                      ) : (() => {
                        const registros = registrosIndividuais[tarefa.id] || [];
                        if (registros.length === 0) {
                          return (
                            <div className="tarefa-detalhada-empty-registros">
                              Nenhum registro individual encontrado
                            </div>
                          );
                        }

                        // Função para normalizar data (apenas data, sem hora)
                        const normalizarData = (dataInput) => {
                          if (!dataInput) return null;
                          try {
                            const date = new Date(dataInput);
                            if (isNaN(date.getTime())) return null;
                            // Retornar apenas a data no formato YYYY-MM-DD
                            const ano = date.getFullYear();
                            const mes = String(date.getMonth() + 1).padStart(2, '0');
                            const dia = String(date.getDate()).padStart(2, '0');
                            return `${ano}-${mes}-${dia}`;
                          } catch (e) {
                            return null;
                          }
                        };

                        // Função para formatar data para exibição (DD/MM/YYYY)
                        const formatarDataExibicao = (dataStr) => {
                          if (!dataStr) return '—';
                          try {
                            const [ano, mes, dia] = dataStr.split('-');
                            return `${dia}/${mes}/${ano}`;
                          } catch (e) {
                            return dataStr;
                          }
                        };

                        // Agrupar registros por data
                        const registrosPorData = new Map();

                        registros.forEach(registro => {
                          const dataInicio = registro.data_inicio || registro.created_at || registro.data;
                          const dataNormalizada = normalizarData(dataInicio);

                          if (!dataNormalizada) return;

                          if (!registrosPorData.has(dataNormalizada)) {
                            registrosPorData.set(dataNormalizada, {
                              data: dataNormalizada,
                              registros: [],
                              tempoRealizadoTotal: 0
                            });
                          }

                          const grupoData = registrosPorData.get(dataNormalizada);
                          // Tempo realizado sempre 0 (lógica removida)
                          grupoData.registros.push(registro);
                        });

                        // Buscar tempo estimado por data nos registros da tarefa
                        const tempoEstimadoPorData = new Map();
                        if (tarefa.registros && Array.isArray(tarefa.registros)) {
                          tarefa.registros.forEach(reg => {
                            const dataReg = reg.data || reg.data_inicio || reg.created_at;
                            const dataNormalizada = normalizarData(dataReg);

                            if (dataNormalizada) {
                              const tempoEstimadoDia = reg.tempo_estimado_dia || 0;
                              if (!tempoEstimadoPorData.has(dataNormalizada)) {
                                tempoEstimadoPorData.set(dataNormalizada, 0);
                              }
                              tempoEstimadoPorData.set(
                                dataNormalizada,
                                tempoEstimadoPorData.get(dataNormalizada) + tempoEstimadoDia
                              );
                            }
                          });
                        }

                        // Ordenar datas (mais recente primeiro)
                        const datasOrdenadas = Array.from(registrosPorData.keys()).sort((a, b) => {
                          return new Date(b).getTime() - new Date(a).getTime();
                        });

                        return (
                          <div className="tarefa-detalhada-registros-list">
                            {datasOrdenadas.map((dataNormalizada) => {
                              const grupoData = registrosPorData.get(dataNormalizada);
                              const tempoEstimadoDia = tempoEstimadoPorData.get(dataNormalizada) || 0;

                              const tempoEstimadoFormatado = formatarTempoEstimado
                                ? formatarTempoEstimado(tempoEstimadoDia, true)
                                : '0s';

                              // Tempo realizado sempre 0 (lógica removida)
                              const tempoRealizadoFormatado = '0s';

                              // Calcular custos
                              const custoEstimadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                ? calcularCustoPorTempo(tempoEstimadoDia, tarefa.responsavelId)
                                : null;

                              return (
                                <div
                                  key={`data_${tarefa.id}_${dataNormalizada}`}
                                  className="tarefa-detalhada-data-group"
                                >
                                  <div className="tarefa-detalhada-data-header">
                                    <div className="tarefa-detalhada-data-label">
                                      {formatarDataExibicao(dataNormalizada)}
                                    </div>
                                    <div className="tarefa-detalhada-data-metrics">
                                      {/* Card Estimado do Dia */}
                                      {tempoEstimadoDia > 0 && (
                                        <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                          <div className="tarefa-detalhada-tempo-card-content">
                                            <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                            <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                              {tempoEstimadoFormatado}
                                            </div>
                                            {custoEstimadoDia !== null && formatarValorMonetario && (
                                              <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                                {formatarValorMonetario(custoEstimadoDia)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Card Realizado do Dia */}
                                      <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                        <div className="tarefa-detalhada-tempo-card-content">
                                          <i className="fas fa-stopwatch" style={{ color: '#fd7e14', fontSize: '10px' }}></i>
                                          <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                            0s
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Lista de registros individuais da data - Agrupados por responsável */}
                                  {grupoData.registros.length > 0 && (() => {
                                    // Agrupar registros por responsável
                                    const registrosPorResponsavel = new Map();

                                    grupoData.registros.forEach((registro) => {
                                      const responsavelId = registro.usuario_id || registro.membro?.id || 'desconhecido';
                                      let nomeResponsavel = registro.membro?.nome;

                                      // Se não encontrou no registro.membro, buscar usando a função
                                      if (!nomeResponsavel && getNomeColaboradorPorUsuarioId && responsavelId !== 'desconhecido') {
                                        nomeResponsavel = getNomeColaboradorPorUsuarioId(responsavelId);
                                      }

                                      // Fallback para caso não encontre
                                      if (!nomeResponsavel) {
                                        nomeResponsavel = `Colaborador #${responsavelId}`;
                                      }

                                      const responsavelKey = String(responsavelId);

                                      if (!registrosPorResponsavel.has(responsavelKey)) {
                                        registrosPorResponsavel.set(responsavelKey, {
                                          nome: nomeResponsavel,
                                          registros: []
                                        });
                                      }

                                      registrosPorResponsavel.get(responsavelKey).registros.push(registro);
                                    });

                                    return (
                                      <div className="tarefa-detalhada-registros-individuais">
                                        {Array.from(registrosPorResponsavel.entries()).map(([responsavelKey, grupoResponsavel]) => {
                                          // Calcular tempo total do responsável
                                          let tempoTotalResponsavel = 0;
                                          grupoResponsavel.registros.forEach(reg => {
                                            let tempoReg = Number(reg.tempo_realizado) || 0;
                                            // Converter horas decimais para milissegundos se necessário
                                            if (tempoReg > 0 && tempoReg < 1) {
                                              tempoReg = Math.round(tempoReg * 3600000);
                                            }
                                            // Se resultado < 1 segundo, arredondar para 1 segundo
                                            if (tempoReg > 0 && tempoReg < 1000) {
                                              tempoReg = 1000;
                                            }
                                            tempoTotalResponsavel += tempoReg;
                                          });

                                          const tempoTotalFormatado = formatarTempoEstimado
                                            ? formatarTempoEstimado(tempoTotalResponsavel, true)
                                            : formatarTempoHMS(tempoTotalResponsavel);

                                          // Calcular custo total do responsável
                                          const custoTotalResponsavel = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                            ? calcularCustoPorTempo(tempoTotalResponsavel, responsavelKey)
                                            : null;

                                          const responsavelKeyFull = `${tarefa.id}_${dataNormalizada}_${responsavelKey}`;
                                          const isResponsavelExpanded = responsaveisExpandidos.has(responsavelKeyFull);

                                          return (
                                            <div key={`responsavel_${tarefa.id}_${dataNormalizada}_${responsavelKey}`} className="tarefa-detalhada-responsavel-group">
                                              <div className="tarefa-detalhada-responsavel-header">
                                                <div className="tarefa-detalhada-responsavel-nome-wrapper">
                                                  <i className="fas fa-user" style={{ color: '#6b7280', fontSize: '13px' }}></i>
                                                  <span className="tarefa-detalhada-responsavel-nome">{grupoResponsavel.nome}</span>
                                                </div>
                                                <button
                                                  className="tarefa-detalhada-responsavel-toggle"
                                                  onClick={() => toggleResponsavel(tarefa.id, dataNormalizada, responsavelKey)}
                                                  title={isResponsavelExpanded ? "Ocultar registros" : "Ver registros"}
                                                >
                                                  <i
                                                    className={`fas fa-chevron-down ${isResponsavelExpanded ? 'expanded' : ''}`}
                                                    style={{
                                                      color: '#1e3a8a',
                                                      fontSize: '12px',
                                                      transform: isResponsavelExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                      transition: 'transform 0.2s'
                                                    }}
                                                  ></i>
                                                </button>
                                              </div>
                                              {isResponsavelExpanded && (
                                                <div className="tarefa-detalhada-responsavel-registros">
                                                  {grupoResponsavel.registros.map((registro, regIdx) => {
                                                    const tempoRealizadoReg = registro.tempo_realizado || 0;
                                                    // Converter horas decimais para milissegundos se necessário
                                                    let tempoMs = tempoRealizadoReg;
                                                    if (tempoRealizadoReg > 0 && tempoRealizadoReg < 1) {
                                                      tempoMs = Math.round(tempoRealizadoReg * 3600000);
                                                    }
                                                    // Se resultado < 1 segundo, arredondar para 1 segundo
                                                    if (tempoMs > 0 && tempoMs < 1000) {
                                                      tempoMs = 1000;
                                                    }

                                                    const tempoRealizadoFormatado = formatarTempoEstimado
                                                      ? formatarTempoEstimado(tempoMs, true)
                                                      : formatarTempoHMS(tempoMs);

                                                    const tempoDecimal = (tempoMs / 3600000).toFixed(2);

                                                    // Formatar data e hora completa
                                                    const dataFormatada = formatarDataHora(registro.data_inicio || registro.created_at || registro.data);

                                                    return (
                                                      <div
                                                        key={`reg_${tarefa.id}_${dataNormalizada}_${responsavelKey}_${regIdx}_${registro.id || regIdx}`}
                                                        className="tarefa-detalhada-registro-item-simples"
                                                      >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                          <i className="fas fa-stopwatch" style={{ color: '#94a3b8' }}></i>
                                                          <span
                                                            className="tarefa-detalhada-registro-tempo-badge"
                                                            title={`${tempoDecimal}h`}
                                                          >
                                                            {tempoRealizadoFormatado}
                                                          </span>
                                                        </div>
                                                        {dataFormatada !== '—' && (
                                                          <div style={{ color: '#6b7280' }}>{dataFormatada}</div>
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
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TarefasDetalhadasList;

