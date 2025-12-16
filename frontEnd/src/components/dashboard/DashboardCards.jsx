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
  filtroCliente = null 
}) => {
  const [custosPorColaborador, setCustosPorColaborador] = useState({});

  // Normalizar arrays para garantir que são arrays válidos
  const registros = Array.isArray(registrosTempo) ? registrosTempo : [];
  const contratosArray = Array.isArray(contratos) ? contratos : [];

  // Calcular totais usando useMemo para otimização
  const totais = useMemo(() => {
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
      totalHrs,
      totalColaboradores,
      totalClientes
    };
  }, [registros, contratosArray, clientesExibidos]);

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
      if (!registros || registros.length === 0) return;

      const colaboradoresIds = new Set();
      registros.forEach(registro => {
        const colaboradorId = registro.usuario_id || registro.membro?.id;
        if (colaboradorId) {
          colaboradoresIds.add(String(colaboradorId));
        }
      });

      setCustosPorColaborador(prevCustos => {
        const novosCustos = { ...prevCustos };
        const idsParaBuscar = Array.from(colaboradoresIds).filter(id => !novosCustos[id]);

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
  }, [registros]);

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
          <div className="dashboard-card-value dashboard-card-value-full">
            {tempoHM}
          </div>
          <div className="dashboard-card-decimal">
            {tempoDecimal} hrs decimais
          </div>
          {calcularCustoRealizadoTotal !== null && (
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
                  fontWeight: 600
                }}
              >
                {formatarValorMonetario(calcularCustoRealizadoTotal)}
              </span>
            </div>
          )}
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
    </div>
  );
};

export default DashboardCards;
