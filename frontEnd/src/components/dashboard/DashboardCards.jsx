import React, { useMemo, useState, useEffect } from 'react';
import './DashboardCards.css';

const API_BASE_URL = '/api';

/**
 * DashboardCards - Componente para exibir totais gerais dos resultados
 * 
 * Este componente calcula e exibe os totais de:
 * - Tarefas únicas
 * - Horas realizadas (soma de todos os tempo_realizado)
 * - Colaboradores únicos
 * - Clientes únicos
 * 
 * IMPORTANTE: 
 * - Os arrays registrosTempo e contratos devem conter TODOS os dados que atendem aos filtros aplicados
 * - O array clientesExibidos deve conter os clientes que estão sendo exibidos na lista de resultados
 * - A contagem de clientes é baseada nos clientesExibidos, não nos registros/contratos
 * 
 * @param {Array} contratos - Array de contratos que atendem aos filtros
 * @param {Array} registrosTempo - Array de registros de tempo que atendem aos filtros
 * @param {Array} clientesExibidos - Array de clientes que estão sendo exibidos na lista (formato: [{cliente: {id, nome}, ...}])
 * @param {Function} onShowTarefas - Callback para exibir lista de tarefas
 * @param {Function} onShowColaboradores - Callback para exibir lista de colaboradores
 * @param {Function} onShowClientes - Callback para exibir lista de clientes
 * @param {boolean} showColaboradores - Se deve exibir o card de colaboradores
 * @param {string|Array|null} filtroCliente - IDs de clientes filtrados (apenas para contexto, não filtra novamente)
 */
const DashboardCards = ({
  contratos = [],
  registrosTempo = [],
  clientesExibidos = [],
  onShowTarefas,
  onShowColaboradores,
  onShowClientes,
  showColaboradores = true,
  filtroCliente = null,
  totaisDiretos = null, // Novos totais vindos diretamente do backend (resumoOnly)
  onFetchRealized, // Função para carregar realizado sob demanda
  skipRealized = false // Se true, não exibe o realizado automaticamente
}) => {
  const [custosPorColaborador, setCustosPorColaborador] = useState({});
  const [carregarCustosSolicitado, setCarregarCustosSolicitado] = useState(false);

  // Normalizar arrays para garantir que são arrays válidos
  const registros = Array.isArray(registrosTempo) ? registrosTempo : [];
  const contratosArray = Array.isArray(contratos) ? contratos : [];

  // Calcular totais usando useMemo para otimização
  const totais = useMemo(() => {
    // Se temos totais diretos do backend, USAR ELES (mais rápido e econômico)
    if (totaisDiretos) {
      return {
        totalTarefas: totaisDiretos.totalTarefas || 0,
        totalHrs: totaisDiretos.totalTempo, // Pode ser null/undefined se skipRealized=true
        totalColaboradores: totaisDiretos.totalColaboradores || 0,
        totalClientes: totaisDiretos.totalClientes || 0,
        totalProdutos: totaisDiretos.totalProdutos || 0,
        totalEstimado: totaisDiretos.totalEstimado || 0,
        totalContratado: totaisDiretos.totalContratado || 0
      };
    }

    let totalTarefas = 0;
    let totalHrs = 0;
    let totalColaboradores = 0;
    let totalClientes = 0;

    // ============================================
    // 1. TAREFAS ÚNICAS
    // ============================================
    // Contar tarefas únicas apenas dos registros de tempo
    // (tarefas estão vinculadas a registros, não a contratos)
    if (registros.length > 0) {
      const tarefasUnicas = new Set();
      registros.forEach(registro => {
        if (registro.tarefa_id) {
          const tarefaId = String(registro.tarefa_id).trim();
          if (tarefaId) {
            tarefasUnicas.add(tarefaId);
          }
        }
      });
      totalTarefas = tarefasUnicas.size;
    }

    // ============================================
    // 2. HORAS REALIZADAS
    // ============================================
    // Somar todos os tempo_realizado dos registros
    // IMPORTANTE: tempo_realizado pode vir em milissegundos (>= 1) ou horas decimais (< 1)
    if (registros.length > 0) {
      registros.forEach(registro => {
        let tempo = Number(registro.tempo_realizado) || 0;

        // Converter horas decimais para milissegundos se necessário
        if (tempo > 0 && tempo < 1) {
          tempo = Math.round(tempo * 3600000); // Converter horas decimais para milissegundos
        }

        // Se resultado < 1 segundo, arredondar para 1 segundo (mínimo)
        if (tempo > 0 && tempo < 1000) {
          tempo = 1000;
        }

        totalHrs += tempo;
      });
    }

    // ============================================
    // 3. COLABORADORES ÚNICOS
    // ============================================
    // Contar colaboradores únicos apenas dos registros de tempo
    // (colaboradores estão vinculados a registros, não a contratos)
    if (registros.length > 0) {
      const colaboradoresUnicos = new Set();
      registros.forEach(registro => {
        if (registro.usuario_id) {
          const colaboradorId = String(registro.usuario_id).trim();
          if (colaboradorId) {
            colaboradoresUnicos.add(colaboradorId);
          }
        }
      });
      totalColaboradores = colaboradoresUnicos.size;
    }

    // ============================================
    // 4. CLIENTES ÚNICOS
    // ============================================
    // IMPORTANTE: 
    // - Se clientesExibidos estiver preenchido (tela de clientes), usar essa lista
    // - Se clientesExibidos estiver vazio (tela de colaboradores), contar dos registros e contratos
    const clientesUnicos = new Set();

    // Contar clientes da lista de clientes exibidos (prioridade para tela de clientes)
    if (Array.isArray(clientesExibidos) && clientesExibidos.length > 0) {
      clientesExibidos.forEach(item => {
        // item pode ter formato {cliente: {id, nome}, ...} ou {id, nome}
        const cliente = item.cliente || item;
        if (cliente && cliente.id) {
          const clienteId = String(cliente.id).trim();
          if (clienteId) {
            clientesUnicos.add(clienteId);
          }
        }
      });
    } else {
      // Fallback: contar clientes dos registros e contratos (para tela de colaboradores)
      // Contar clientes dos registros de tempo
      // IMPORTANTE: cliente_id pode conter múltiplos IDs separados por vírgula
      if (registros.length > 0) {
        registros.forEach(registro => {
          if (registro.cliente_id) {
            // Fazer split por vírgula para extrair todos os IDs
            const ids = String(registro.cliente_id)
              .split(',')
              .map(id => id.trim())
              .filter(id => id.length > 0);

            ids.forEach(id => {
              if (id) {
                clientesUnicos.add(id);
              }
            });
          }
        });
      }

      // Contar clientes dos contratos
      if (contratosArray.length > 0) {
        contratosArray.forEach(contrato => {
          if (contrato.id_cliente) {
            const clienteId = String(contrato.id_cliente).trim();
            if (clienteId) {
              clientesUnicos.add(clienteId);
            }
          }
        });
      }
    }

    totalClientes = clientesUnicos.size;

    return {
      totalTarefas,
      totalHrs: skipRealized ? null : totalHrs, // Se skipRealized, força null no calculo local
      totalColaboradores,
      totalClientes,
      totalProdutos: 0, // Fallback local
      totalEstimado: 0, // Fallback local (não calculado aqui)
      totalContratado: 0 // Fallback local (não calculado aqui)
    };
  }, [registros, contratosArray, clientesExibidos, totaisDiretos, skipRealized]);

  // Calcular Disponível (Frontend Rule)
  const totalDisponivel = useMemo(() => {
    const contratado = Number(totais.totalContratado) || 0;
    const estimado = Number(totais.totalEstimado) || 0;
    return contratado - estimado;
  }, [totais.totalContratado, totais.totalEstimado]);

  // Formatar horas em h min s (com segundos para dashboard)
  const formatarHrsHM = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0min';
    const horas = Math.floor(milissegundos / (1000 * 60 * 60));
    const minutos = Math.floor((milissegundos % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((milissegundos % (1000 * 60)) / 1000);

    let resultado = '';
    if (horas > 0) resultado += `${horas}h `;
    if (minutos > 0 || horas === 0) resultado += `${minutos}min `;
    if (segundos > 0 || (horas === 0 && minutos === 0)) resultado += `${segundos}s`;
    return resultado.trim();
  };

  // Formatar horas em decimal
  const formatarHrsDecimal = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0.00';
    const horas = milissegundos / (1000 * 60 * 60);
    return horas.toFixed(2);
  };

  const tempoHM = formatarHrsHM(totais.totalHrs);
  const tempoDecimal = formatarHrsDecimal(totais.totalHrs);

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
      // Agora só carrega se EXPLICITAMENTE solicitado
      if (window.blockDetailedFetches || window.backendOverloaded === true) {
        return;
      }

      // Se não foi solicitado, NÃO faz nada (evita carga automática)
      if (!carregarCustosSolicitado) {
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

      // Regra 2: Controle de concorrência usando batching (3 por vez)
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

                // Regra 5: Tratar 503 como fallback silencioso e abortar ciclo
                if (response.status === 503) {
                  console.warn(`[DashboardCards] Servidor sobrecarregado (503) ao buscar custo do colaborador ${colaboradorId}. Abortando ciclo.`);
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
                console.error(`[DashboardCards] Erro ao buscar custo do colaborador ${colaboradorId}:`, err);
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
          console.error('[DashboardCards] Erro no lote de busca de custos:', e);
        }
      }

      // Atualizar estado com todos os novos custos encontrados
      if (Object.keys(novosCustosMap).length > 0) {
        setCustosPorColaborador(prev => ({ ...prev, ...novosCustosMap }));
      }
    };

    carregarCustos();
  }, [registros, carregarCustosSolicitado]);

  // Calcular custo realizado total
  const calcularCustoRealizadoTotal = useMemo(() => {
    if (!registros || registros.length === 0) return null;

    let custoTotal = 0;
    let temCusto = false;

    registros.forEach(registro => {
      const colaboradorId = registro.usuario_id || registro.membro?.id;
      if (!colaboradorId) return;

      let tempo = Number(registro.tempo_realizado) || 0;

      // Converter horas decimais para milissegundos se necessário
      if (tempo > 0 && tempo < 1) {
        tempo = Math.round(tempo * 3600000);
      }

      // Se resultado < 1 segundo, arredondar para 1 segundo
      if (tempo > 0 && tempo < 1000) {
        tempo = 1000;
      }

      const custoHoraStr = custosPorColaborador[String(colaboradorId)];
      if (custoHoraStr) {
        // Converter custo_hora de string (formato "21,22") para número
        const custoHora = parseFloat(custoHoraStr.replace(',', '.'));
        if (!isNaN(custoHora) && custoHora > 0) {
          // Converter tempo de milissegundos para horas
          const tempoHoras = tempo / 3600000;
          // Custo = custo por hora * tempo em horas
          custoTotal += custoHora * tempoHoras;
          temCusto = true;
        }
      }
    });

    return temCusto ? custoTotal : null;
  }, [registros, custosPorColaborador]);

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor || isNaN(valor)) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Mostrar cards se houver pelo menos um dado
  if (totais.totalTarefas === 0 && totais.totalHrs === 0 && totais.totalColaboradores === 0 && totais.totalClientes === 0) {
    return null;
  }

  return (
    <div className="dashboard-cards-container" style={{ marginTop: '30px' }}>
      {/* Card de Tarefas */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-list"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Tarefas</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totais.totalTarefas}</span>
            {totais.totalTarefas > 0 && onShowTarefas && (
              <span
                className="dashboard-card-arrow-small"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowTarefas(e);
                }}
                title="Ver lista de tarefas"
                style={{
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '12px',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.color = '#ff9800'}
                onMouseOut={(e) => e.target.style.color = '#6b7280'}
              >
                &gt;
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card de Horas Realizadas */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-check"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Hrs Realizadas</div>

          {(skipRealized && (totais.totalHrs === null || totais.totalHrs === undefined)) ? (
            <div style={{ marginTop: '5px' }}>
              <button
                className="btn-carregar-realizado"
                onClick={onFetchRealized}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  background: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <i className="fas fa-sync-alt" style={{ marginRight: '5px' }}></i>
                Carregar Realizado
              </button>
            </div>
          ) : (
            <>
              <div className="dashboard-card-value dashboard-card-value-full">
                {formatarHrsHM(totais.totalHrs || 0)}
              </div>
              <div className="dashboard-card-decimal">
                {formatarHrsDecimal(totais.totalHrs || 0)} hrs decimais
              </div>
            </>
          )}

          {(!skipRealized && calcularCustoRealizadoTotal !== null) && (
            <div style={{
              marginTop: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span
                style={{
                  background: '#fee2e2',
                  color: '#ef4444',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: carregarCustosSolicitado ? 'default' : 'pointer'
                }}
                onClick={() => !carregarCustosSolicitado && setCarregarCustosSolicitado(true)}
              >
                {carregarCustosSolicitado ? formatarValorMonetario(calcularCustoRealizadoTotal) : 'Clique para ver custo'}
              </span>
            </div>
          )}
          {(!skipRealized && !carregarCustosSolicitado && registros.length > 0 && calcularCustoRealizadoTotal === null) && (
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn-ver-custo-dashboard"
                onClick={() => setCarregarCustosSolicitado(true)}
                style={{
                  background: '#fff',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <i className="fas fa-coins" style={{ marginRight: '6px' }}></i>
                Ver Custo Realizado
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card de Horas Estimadas */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#e0f2fe', color: '#0ea5e9' }}>
          <i className="fas fa-clock"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Hrs Estimadas</div>
          <div className="dashboard-card-value dashboard-card-value-full">
            {formatarHrsHM(totais.totalEstimado || 0)}
          </div>
          <div className="dashboard-card-decimal">
            {formatarHrsDecimal(totais.totalEstimado || 0)} hrs decimais
          </div>
        </div>
      </div>

      {/* Card de Horas Contratadas */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#dcfce7', color: '#22c55e' }}>
          <i className="fas fa-file-contract"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Hrs Contratadas</div>
          <div className="dashboard-card-value dashboard-card-value-full">
            {/* Contratadas geralmente vem em horas decimais? Assumindo que sim ou convertendo se necessario.
                Se vier do backend como horas, usar direto. Se vier ms, formatar.
                Para evitar confusao, vamos assumir que o backend manda em horas e exibir como tal, ou implementar formatacao se for ms.
                Por padrao o sistema usa MS internamente. Vamos assumir MS. */}
            {formatarHrsHM(totais.totalContratado ? totais.totalContratado * 3600000 : 0)}
            {/* OBS: Se totalContratado vier em HORAS (ex: 100), multiplicar por 3600000. Se vier em MS, usar direto. 
                Vou assumir que o backend vai mandar em HORAS (numero simples) pois eh contrato. */}
          </div>
          <div className="dashboard-card-decimal">
            {Number(totais.totalContratado || 0).toFixed(2)} hrs totais
          </div>
        </div>
      </div>

      {/* Card de Horas Disponíveis */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: totalDisponivel >= 0 ? '#dcfce7' : '#fee2e2', color: totalDisponivel >= 0 ? '#22c55e' : '#ef4444' }}>
          <i className="fas fa-balance-scale"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Disponível</div>
          <div className="dashboard-card-value dashboard-card-value-full" style={{ color: totalDisponivel >= 0 ? 'inherit' : '#ef4444' }}>
            {/* Disponivel = Contratado (horas) - Estimado (ms -> horas) */}
            {/* Espera: contratado em horas. estimado em ms. */}
            {/* Vamos converter tudo para horas para exibir */}
            {(Number(totais.totalContratado || 0) - (Number(totais.totalEstimado || 0) / 3600000)).toFixed(2)} hrs
          </div>
          <div className="dashboard-card-decimal" style={{ fontSize: '11px', color: '#6b7280' }}>
            (Contratado - Estimado)
          </div>
        </div>
      </div>

      {/* Card de Colaboradores */}
      {showColaboradores && (
        <div className="dashboard-card">
          <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
            <i className="fas fa-users"></i>
          </div>
          <div className="dashboard-card-content">
            <div className="dashboard-card-label">Colaboradores</div>
            <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{totais.totalColaboradores}</span>
              {totais.totalColaboradores > 0 && onShowColaboradores && (
                <span
                  className="dashboard-card-arrow-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowColaboradores(e);
                  }}
                  title="Ver lista de colaboradores"
                  style={{
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '12px',
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.color = '#ff9800'}
                  onMouseOut={(e) => e.target.style.color = '#6b7280'}
                >
                  &gt;
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card de Clientes */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-user-friends"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Clientes</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totais.totalClientes}</span>
            {totais.totalClientes > 0 && onShowClientes && (
              <span
                className="dashboard-card-arrow-small"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowClientes(e);
                }}
                title="Ver lista de clientes"
                style={{
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '12px',
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.color = '#ff9800'}
                onMouseOut={(e) => e.target.style.color = '#6b7280'}
              >
                &gt;
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card de Produtos */}
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
          <i className="fas fa-box-open"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Produtos</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totais.totalProdutos}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCards;
