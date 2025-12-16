import React, { useState, useEffect } from 'react';

const API_BASE_URL = '/api';

const ClientesContent = ({ colaboradorId, registros, filtroCliente }) => {
  const [expandedClientes, setExpandedClientes] = useState(new Set());
  const [expandedTarefas, setExpandedTarefas] = useState(new Set());
  const [custoHora, setCustoHora] = useState(null);

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

  // Calcular custo realizado
  const calcularCustoRealizado = (tempoMs) => {
    if (!tempoMs || !custoHora) return null;

    // Converter custo_hora de string (formato "21,22") para número
    const custoHoraNum = parseFloat(custoHora.replace(',', '.'));
    if (isNaN(custoHoraNum) || custoHoraNum <= 0) return null;

    // Converter tempo de milissegundos para horas
    const tempoHoras = tempoMs / 3600000;
    
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

  if (!registros || registros.length === 0) {
    return <div className="empty-state"><p>Nenhum cliente encontrado</p></div>;
  }

  // Filtrar registros por cliente se houver filtro
  let registrosFiltrados = registros;
  if (filtroCliente) {
    const clienteIds = Array.isArray(filtroCliente) 
      ? filtroCliente.map(id => String(id).trim().toLowerCase())
      : [String(filtroCliente).trim().toLowerCase()];
    
    registrosFiltrados = registros.filter(registro => {
      if (!registro.cliente_id) return false;
      const idsExtraidos = String(registro.cliente_id)
        .split(',')
        .map(id => id.trim().toLowerCase())
        .filter(id => id.length > 0);
      return idsExtraidos.some(id => clienteIds.includes(id));
    });
  }

  if (registrosFiltrados.length === 0) {
    return <div className="empty-state"><p>Nenhum cliente encontrado</p></div>;
  }

  // Agrupar registros por cliente e calcular tempo total
  // IMPORTANTE: Cada cliente deve aparecer apenas uma vez com o tempo total
  // Se há filtro de cliente, considerar apenas os clientes filtrados
  const clientesMap = new Map();
  const clienteIdsFiltro = filtroCliente 
    ? (Array.isArray(filtroCliente) 
        ? filtroCliente.map(id => String(id).trim().toLowerCase())
        : [String(filtroCliente).trim().toLowerCase()])
    : null;
  
  registrosFiltrados.forEach(registro => {
    if (registro.cliente_id) {
      // cliente_id pode conter múltiplos IDs separados por ", "
      const clienteIds = String(registro.cliente_id)
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      
      // Se há filtro, considerar apenas os clientes que estão no filtro
      const clienteIdsParaProcessar = clienteIdsFiltro
        ? clienteIds.filter(id => clienteIdsFiltro.includes(String(id).trim().toLowerCase()))
        : clienteIds;
      
      clienteIdsParaProcessar.forEach(clienteId => {
        const clienteIdNormalizado = String(clienteId).trim().toLowerCase();
        
        if (!clientesMap.has(clienteIdNormalizado)) {
          // Buscar nome do cliente do primeiro registro que tiver esse cliente
          const nomeCliente = registro.cliente?.nome || `Cliente #${clienteId}`;
          clientesMap.set(clienteIdNormalizado, {
            id: clienteId, // Manter ID original para referência
            idNormalizado: clienteIdNormalizado,
            nome: nomeCliente,
            registros: [],
            tempoTotal: 0
          });
        }
        const cliente = clientesMap.get(clienteIdNormalizado);
        
        // Adicionar registro apenas se ainda não foi adicionado (evitar duplicatas)
        // Usar ID do registro ou combinação única de campos
        const registroId = registro.id || `${registro.tarefa_id}_${registro.usuario_id}_${registro.data_inicio}_${registro.data_fim || ''}`;
        const registroJaExiste = cliente.registros.some(r => {
          const rId = r.id || `${r.tarefa_id}_${r.usuario_id}_${r.data_inicio}_${r.data_fim || ''}`;
          return rId === registroId;
        });
        
        if (!registroJaExiste) {
          cliente.registros.push(registro);
          // Calcular tempo apenas uma vez por registro
          // IMPORTANTE: Se o registro tem múltiplos cliente_id, dividir o tempo proporcionalmente
          // ou contar o tempo completo para cada cliente (dependendo da regra de negócio)
          // Por enquanto, vamos contar o tempo completo para cada cliente filtrado
          const tempoRealizado = Number(registro.tempo_realizado) || 0;
          // Se valor < 1 (decimal), está em horas -> converter para ms
          // Se valor >= 1, já está em ms
          // Se resultado < 1 segundo, arredondar para 1 segundo
          let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
          if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
          cliente.tempoTotal += tempoMs;
        }
      });
    }
  });

  if (clientesMap.size === 0) {
    return <div className="empty-state"><p>Nenhum cliente encontrado</p></div>;
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

  const toggleCliente = (clienteId) => {
    const newExpanded = new Set(expandedClientes);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClientes(newExpanded);
  };

  const toggleTarefa = (clienteId, tarefaId) => {
    const key = `${clienteId}-${tarefaId}`;
    const newExpanded = new Set(expandedTarefas);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTarefas(newExpanded);
  };

  // Converter Map para array e ordenar por tempo total (maior primeiro)
  const clientesArray = Array.from(clientesMap.values()).sort((a, b) => b.tempoTotal - a.tempoTotal);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {clientesArray.map((cliente) => {
        const tempoText = fmtMs(cliente.tempoTotal);
        const tempoDecimal = (cliente.tempoTotal / 3600000).toFixed(2);
        const isExpanded = expandedClientes.has(cliente.id);

        // Agrupar registros por tarefa
        const tarefasMap = new Map();
        cliente.registros.forEach(registro => {
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

        const custoRealizado = calcularCustoRealizado(cliente.tempoTotal);

        return (
          <div key={cliente.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-user-friends" style={{ color: '#2563eb', fontSize: '14px' }}></i>
                <span>{cliente.nome}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                {custoRealizado !== null && (
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
                    {formatarValorMonetario(custoRealizado)}
                  </span>
                )}
                <button
                  className="tt-cliente-toggle"
                  title="Expandir"
                  onClick={() => toggleCliente(cliente.id)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e5e7eb',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <i
                    className="fas fa-chevron-down"
                    style={{
                      color: '#475569',
                      fontSize: '12px',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  ></i>
                </button>
              </div>
            </div>
            {isExpanded && (
              <div
                className="tt-cliente-tarefas"
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
                  const tarefaKey = `${cliente.id}-${tarefaId}`;
                  const isTarefaExpanded = expandedTarefas.has(tarefaKey);

                  return (
                    <div
                      key={tarefaId}
                      className="tt-cliente-tarefa"
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
                              const custoRealizadoTarefa = calcularCustoRealizado(tarefa.tempoTotal);
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
                          className="tt-cliente-tarefa-arrow"
                          title="Expandir registros"
                          onClick={() => toggleTarefa(cliente.id, tarefaId)}
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
                          className="tt-cliente-registros-tarefa"
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

export default ClientesContent;

