import React from 'react';
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
  getNomeCliente
}) => {
  if (!tarefas || tarefas.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhuma tarefa encontrada</p>
      </div>
    );
  }

  // Agrupar tarefas por cliente
  const tarefasPorCliente = new Map();
  tarefas.forEach(tarefa => {
    const clienteId = tarefa.clienteId || 'sem-cliente';
    const clienteNome = tarefa.clienteId && getNomeCliente 
      ? getNomeCliente(tarefa.clienteId) 
      : 'Sem Cliente';
    
    if (!tarefasPorCliente.has(clienteId)) {
      tarefasPorCliente.set(clienteId, {
        clienteId: clienteId === 'sem-cliente' ? null : clienteId,
        clienteNome,
        tarefas: []
      });
    }
    
    tarefasPorCliente.get(clienteId).tarefas.push(tarefa);
  });

  return (
    <div className="tarefas-detalhadas-list">
      {Array.from(tarefasPorCliente.values()).map((grupoCliente, grupoIndex) => (
        <div key={`cliente_${grupoCliente.clienteId || 'sem-cliente'}_${grupoIndex}`} className="tarefa-detalhada-cliente-group">
          <div className="tarefa-detalhada-cliente-header">
            {grupoCliente.clienteNome}
          </div>
          <div className="tarefa-detalhada-cliente-tarefas">
            {grupoCliente.tarefas.map((tarefa, index) => {
        const isExpanded = tarefasExpandidas.has(tarefa.id);
        const tempoRealizadoFormatado = formatarTempoEstimado 
          ? formatarTempoEstimado(tarefa.tempoRealizado || 0, true) 
          : '0s';
        
        const tempoEstimadoFormatado = formatarTempoEstimado 
          ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true) 
          : '0s';
        
        // Calcular custo realizado
        const custoRealizado = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
          ? calcularCustoPorTempo(tarefa.tempoRealizado || 0, tarefa.responsavelId)
          : null;
        
        // Calcular custo estimado
        const custoEstimado = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
          ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, tarefa.responsavelId)
          : null;
        
        return (
          <div
            key={`tarefa_${tarefa.id}_${index}`}
            className="tarefa-detalhada-card"
          >
            <div className="tarefa-detalhada-header">
              <div className="tarefa-detalhada-info">
                <div className="tarefa-detalhada-nome">
                  {tarefa.nome}
                </div>
                <div className="tarefa-detalhada-metrics">
                  {/* Card Estimado */}
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-estimado">
                      <i className="fas fa-clock"></i>
                      <span>ESTIMADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                      {tempoEstimadoFormatado}
                    </div>
                    {custoEstimado !== null && formatarValorMonetario && (
                      <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                        {formatarValorMonetario(custoEstimado)}
                      </div>
                    )}
                  </div>
                  
                  {/* Card Realizado */}
                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado">
                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-realizado">
                      <i className="fas fa-stopwatch"></i>
                      <span>REALIZADO</span>
                    </div>
                    <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                      {tempoRealizadoFormatado}
                    </div>
                    {custoRealizado !== null && formatarValorMonetario && (
                      <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-realizado">
                        {formatarValorMonetario(custoRealizado)}
                      </div>
                    )}
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
                    const tempoRealizadoReg = registro.tempo_realizado || 0;
                    grupoData.registros.push(registro);
                    grupoData.tempoRealizadoTotal += tempoRealizadoReg;
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
                        const tempoRealizadoDia = grupoData.tempoRealizadoTotal;
                        
                        const tempoEstimadoFormatado = formatarTempoEstimado 
                          ? formatarTempoEstimado(tempoEstimadoDia, true) 
                          : '0s';
                        
                        const tempoRealizadoFormatado = formatarTempoEstimado 
                          ? formatarTempoEstimado(tempoRealizadoDia, true) 
                          : '0s';

                        // Calcular custos
                        const custoEstimadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                          ? calcularCustoPorTempo(tempoEstimadoDia, tarefa.responsavelId)
                          : null;
                        
                        const custoRealizadoDia = tarefa.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                          ? calcularCustoPorTempo(tempoRealizadoDia, tarefa.responsavelId)
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
                                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-estimado">
                                      <i className="fas fa-clock"></i>
                                      <span>ESTIMADO</span>
                                    </div>
                                    <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                      {tempoEstimadoFormatado}
                                    </div>
                                    {custoEstimadoDia !== null && formatarValorMonetario && (
                                      <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                        {formatarValorMonetario(custoEstimadoDia)}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Card Realizado do Dia */}
                                {tempoRealizadoDia > 0 && (
                                  <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-realizado tarefa-detalhada-tempo-card-dia">
                                    <div className="tarefa-detalhada-tempo-label tarefa-detalhada-tempo-label-realizado">
                                      <i className="fas fa-stopwatch"></i>
                                      <span>REALIZADO</span>
                                    </div>
                                    <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-realizado">
                                      {tempoRealizadoFormatado}
                                    </div>
                                    {custoRealizadoDia !== null && formatarValorMonetario && (
                                      <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-realizado">
                                        {formatarValorMonetario(custoRealizadoDia)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Lista de registros individuais da data */}
                            {grupoData.registros.length > 0 && (
                              <div className="tarefa-detalhada-registros-individuais">
                                {grupoData.registros.map((registro, regIdx) => {
                                  const tempoRealizadoReg = registro.tempo_realizado || 0;
                                  const tempoRealizadoFormatado = formatarTempoEstimado 
                                    ? formatarTempoEstimado(tempoRealizadoReg, true) 
                                    : formatarTempoHMS(tempoRealizadoReg);
                                  
                                  // Buscar tempo estimado do registro de tempo estimado correspondente
                                  // O registro individual tem tempo_estimado_id, então buscamos o registro original
                                  let tempoEstimadoReg = 0;
                                  if (registro.tempo_estimado_id && tarefa.registros) {
                                    const registroEstimado = tarefa.registros.find(
                                      reg => String(reg.id || reg.tempo_estimado_id) === String(registro.tempo_estimado_id)
                                    );
                                    if (registroEstimado) {
                                      // Verificar se a data do registro estimado corresponde à data do registro realizado
                                      const dataRegEstimado = normalizarData(registroEstimado.data || registroEstimado.data_inicio);
                                      if (dataRegEstimado === dataNormalizada) {
                                        tempoEstimadoReg = registroEstimado.tempo_estimado_dia || 0;
                                      }
                                    }
                                  }
                                  
                                  // Se não encontrou pelo tempo_estimado_id, tentar buscar pela data
                                  if (tempoEstimadoReg === 0 && tarefa.registros) {
                                    const registroEstimadoPorData = tarefa.registros.find(reg => {
                                      const dataReg = normalizarData(reg.data || reg.data_inicio);
                                      return dataReg === dataNormalizada;
                                    });
                                    if (registroEstimadoPorData) {
                                      tempoEstimadoReg = registroEstimadoPorData.tempo_estimado_dia || 0;
                                    }
                                  }
                                  
                                  const tempoEstimadoFormatado = formatarTempoEstimado 
                                    ? formatarTempoEstimado(tempoEstimadoReg, true) 
                                    : '0s';
                                  
                                  // Formatar data e hora completa
                                  const dataFormatada = formatarDataHora(registro.data_inicio || registro.created_at || registro.data);
                                  
                                  return (
                                    <div
                                      key={`reg_${tarefa.id}_${dataNormalizada}_${regIdx}_${registro.id || regIdx}`}
                                      className="tarefa-detalhada-registro-item"
                                    >
                                      <div className="tarefa-detalhada-registro-content">
                                        {/* Tempo Estimado */}
                                        {tempoEstimadoReg > 0 && (
                                          <div className="tarefa-detalhada-registro-tempo tarefa-detalhada-registro-tempo-estimado">
                                            <i className="fas fa-clock"></i>
                                            <span>{tempoEstimadoFormatado}</span>
                                          </div>
                                        )}
                                        
                                        {/* Tempo Realizado */}
                                        {tempoRealizadoReg > 0 && (
                                          <div className="tarefa-detalhada-registro-tempo tarefa-detalhada-registro-tempo-realizado">
                                            <i className="fas fa-stopwatch"></i>
                                            <span>{tempoRealizadoFormatado}</span>
                                          </div>
                                        )}
                                      </div>
                                      {dataFormatada !== '—' && (
                                        <span className="tarefa-detalhada-registro-data">{dataFormatada}</span>
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

