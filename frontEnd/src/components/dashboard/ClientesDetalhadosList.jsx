import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TarefasDetalhadasList.css';

const API_BASE_URL = '/api';

/**
 * Componente para listar clientes detalhados com tempo estimado, realizado, custos e tarefas
 * 
 * @param {Object} props
 * @param {Array} props.clientes - Array de clientes com tempo realizado, estimado, custo e tarefas
 * @param {Set} props.clientesExpandidos - Set com IDs dos clientes expandidos
 * @param {Object} props.registrosIndividuais - Objeto com registros individuais por tarefa ID
 * @param {Object} props.carregandoRegistros - Objeto com estado de carregamento por tarefa ID
 * @param {Function} props.formatarTempoEstimado - Função para formatar tempo estimado
 * @param {Function} props.calcularCustoPorTempo - Função para calcular custo por tempo
 * @param {Function} props.formatarValorMonetario - Função para formatar valor monetário
 * @param {Function} props.formatarDataHora - Função para formatar data e hora
 * @param {Function} props.formatarTempoHMS - Função para formatar tempo em HMS
 * @param {Function} props.onToggleCliente - Função chamada ao clicar no botão de expandir/colapsar cliente
 * @param {Function} props.buscarRegistrosIndividuais - Função para buscar registros individuais de uma tarefa
 * @param {Function} props.getNomeCliente - Função para obter o nome do cliente pelo ID
 */
const ClientesDetalhadosList = ({
  clientes,
  clientesExpandidos,
  registrosIndividuais,
  carregandoRegistros,
  formatarTempoEstimado,
  calcularCustoPorTempo,
  formatarValorMonetario,
  formatarDataHora,
  formatarTempoHMS,
  onToggleCliente,
  buscarRegistrosIndividuais,
  getNomeColaboradorPorUsuarioId = null,
  getNomeCliente = null
}) => {
  const [nomesClientesCache, setNomesClientesCache] = useState({});
  const nomesClientesCacheRef = useRef({});
  
  // Sincronizar ref com estado do cache
  useEffect(() => {
    nomesClientesCacheRef.current = nomesClientesCache;
  }, [nomesClientesCache]);

  // Buscar nome do cliente usando o mesmo endpoint do HistoTempoRastreado
  const buscarNomeCliente = useCallback(async (clienteId) => {
    if (!clienteId) return null;
    
    const idStr = String(clienteId).trim();
    
    // Verificar se já está no cache
    const cacheAtual = nomesClientesCacheRef.current;
    if (cacheAtual[idStr]) {
      return cacheAtual[idStr];
    }
    
    // Se getNomeCliente estiver disponível, tentar usar primeiro
    if (getNomeCliente) {
      const nome = getNomeCliente(idStr);
      if (nome && nome !== `Cliente #${idStr}` && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nome)) {
        return nome;
      }
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${idStr}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.data && result.data.cliente) {
        const cliente = result.data.cliente;
        // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social (mesma lógica do HistoTempoRastreado)
        const nome = cliente.nome || 
                     cliente.nome_amigavel || 
                     cliente.amigavel ||
                     cliente.nome_fantasia || 
                     cliente.fantasia ||
                     cliente.razao_social || 
                     cliente.razao ||
                     null;
        
        if (nome) {
          // Atualizar cache
          const novos = { ...nomesClientesCacheRef.current };
          novos[idStr] = nome;
          nomesClientesCacheRef.current = novos;
          setNomesClientesCache(novos);
          
          return nome;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar nome do cliente:', error);
      return null;
    }
  }, [getNomeCliente]);

  // Função síncrona para obter nome do cliente (retorna do cache ou busca assincronamente)
  const obterNomeCliente = useCallback((cliente) => {
    // Determinar o ID do cliente (pode estar em cliente.id ou cliente.nome se for UUID)
    let clienteId = cliente.id;
    if (!clienteId && cliente.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cliente.nome))) {
      clienteId = cliente.nome;
    }
    
    if (!clienteId) {
      // Se não tiver ID e nome não for UUID, usar nome diretamente
      if (cliente.nome && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(cliente.nome))) {
        return cliente.nome;
      }
      return '';
    }
    
    const idStr = String(clienteId).trim();
    
    // Verificar cache primeiro
    const nomeCache = nomesClientesCache[idStr];
    if (nomeCache) {
      return nomeCache;
    }
    
    // Se getNomeCliente estiver disponível, tentar usar
    if (getNomeCliente) {
      const nome = getNomeCliente(idStr);
      if (nome && nome !== `Cliente #${idStr}` && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nome)) {
        return nome;
      }
    }
    
    // Se não estiver no cache, disparar busca assíncrona
    buscarNomeCliente(idStr).catch(() => {});
    
    // Retornar string vazia enquanto carrega
    return '';
  }, [nomesClientesCache, getNomeCliente, buscarNomeCliente]);

  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
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

  if (!clientes || clientes.length === 0) {
    return (
      <div className="tarefas-detalhadas-empty">
        <p>Nenhum cliente encontrado</p>
      </div>
    );
  }

  const toggleTarefa = (clienteId, tarefaId, tarefa) => {
    const key = `${clienteId}-${tarefaId}`;
    setTarefasExpandidas(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
        // Buscar registros individuais quando expandir
        if (buscarRegistrosIndividuais && tarefa) {
          buscarRegistrosIndividuais(tarefa);
        }
      }
      return newExpanded;
    });
  };

  return (
    <div className="tarefas-detalhadas-list">
      {clientes.map((cliente, clienteIndex) => {
        // Garantir que temos o ID do cliente (pode estar em cliente.id ou cliente.nome se for UUID)
        const clienteId = cliente.id || (cliente.nome && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cliente.nome) ? cliente.nome : null);
        const isClienteExpanded = clientesExpandidos.has(clienteId || cliente.id);
        // Tempo realizado sempre 0 (lógica removida)
        const tempoRealizadoFormatado = '0s';

        const tempoEstimadoFormatado = formatarTempoEstimado
          ? formatarTempoEstimado(cliente.tempoEstimado || 0, true)
          : '0s';
        
        // Calcular custo estimado
        const custoEstimado = cliente.responsavelId && calcularCustoPorTempo && formatarValorMonetario
          ? calcularCustoPorTempo(cliente.tempoEstimado || 0, cliente.responsavelId)
          : null;

        return (
          <div
            key={`cliente_${cliente.id}_${clienteIndex}`}
            className="tarefa-detalhada-card tarefa-detalhada-card-nivel-1"
          >
            <div className="tarefa-detalhada-header">
              <div className="tarefa-detalhada-info">
                <div className="tarefa-detalhada-nome">
                  <i className="fas fa-building" style={{ marginRight: '8px' }}></i>
                  {(() => {
                    const nome = obterNomeCliente(cliente);
                    return nome || <span style={{ opacity: 0.5 }}>Carregando...</span>;
                  })()}
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
              {cliente.tarefas && cliente.tarefas.length > 0 && (
                <button
                  className="tarefa-detalhada-toggle"
                  onClick={() => onToggleCliente(cliente.id)}
                  title={isClienteExpanded ? "Ocultar tarefas" : "Ver tarefas"}
                >
                  <i
                    className={`fas fa-chevron-down ${isClienteExpanded ? 'expanded' : ''}`}
                  ></i>
                </button>
              )}
            </div>
            {isClienteExpanded && cliente.tarefas && cliente.tarefas.length > 0 && (
              <div className="tarefa-detalhada-registros">
                <div className="tarefa-detalhada-registros-title">
                  Tarefas ({cliente.tarefas.length}):
                </div>
                <div className="tarefa-detalhada-cliente-tarefas">
                  {cliente.tarefas.map((tarefa, tarefaIndex) => {
                    const tarefaKey = `${cliente.id}-${tarefa.id}`;
                    const isTarefaExpanded = tarefasExpandidas.has(tarefaKey);
                    // Tempo realizado sempre 0 (lógica removida)
                    const tempoRealizadoTarefaFormatado = '0s';

                    const tempoEstimadoTarefaFormatado = formatarTempoEstimado
                      ? formatarTempoEstimado(tarefa.tempoEstimado || 0, true)
                      : '0s';
                    
                    // Calcular custo estimado da tarefa
                    const custoEstimadoTarefa = cliente.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                      ? calcularCustoPorTempo(tarefa.tempoEstimado || 0, cliente.responsavelId)
                      : null;

                    return (
                      <div
                        key={`tarefa_${tarefa.id}_${tarefaIndex}`}
                        className="tarefa-detalhada-card tarefa-detalhada-card-nivel-2"
                        style={{ marginTop: '8px' }}
                      >
                        <div className="tarefa-detalhada-header">
                          <div className="tarefa-detalhada-info">
                            <div className="tarefa-detalhada-nome">
                              <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                              {tarefa.nome}
                            </div>
                            <div className="tarefa-detalhada-metrics">
                              {/* Card Estimado da Tarefa */}
                              <div className="tarefa-detalhada-tempo-card tarefa-detalhada-tempo-card-estimado tarefa-detalhada-tempo-card-dia">
                                <div className="tarefa-detalhada-tempo-card-content">
                                  <i className="fas fa-clock" style={{ color: '#0e3b6f', fontSize: '10px' }}></i>
                                  <div className="tarefa-detalhada-tempo-valor tarefa-detalhada-tempo-valor-estimado">
                                    {tempoEstimadoTarefaFormatado}
                                  </div>
                                  {custoEstimadoTarefa !== null && formatarValorMonetario && (
                                    <div className="tarefa-detalhada-tempo-custo tarefa-detalhada-tempo-custo-estimado">
                                      {formatarValorMonetario(custoEstimadoTarefa)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Card Realizado da Tarefa */}
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
                          {tarefa.registros && tarefa.registros.length > 0 && (
                            <button
                              className="tarefa-detalhada-toggle"
                              onClick={() => toggleTarefa(cliente.id, tarefa.id, tarefa)}
                              title={isTarefaExpanded ? "Ocultar registros" : "Ver registros"}
                            >
                              <i
                                className={`fas fa-chevron-down ${isTarefaExpanded ? 'expanded' : ''}`}
                              ></i>
                            </button>
                          )}
                        </div>
                        {isTarefaExpanded && (
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
                                    // Tempo realizado sempre 0 (lógica removida)
                                    const tempoRealizadoDia = 0;

                                    const tempoEstimadoFormatado = formatarTempoEstimado
                                      ? formatarTempoEstimado(tempoEstimadoDia, true)
                                      : '0s';

                                    const tempoRealizadoFormatado = '0s';

                                    // Calcular custos
                                    const custoEstimadoDia = cliente.responsavelId && calcularCustoPorTempo && formatarValorMonetario
                                      ? calcularCustoPorTempo(tempoEstimadoDia, cliente.responsavelId)
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
                                                const custoTotalResponsavel = cliente.responsavelId && calcularCustoPorTempo && formatarValorMonetario
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
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClientesDetalhadosList;

