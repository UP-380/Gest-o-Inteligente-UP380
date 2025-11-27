import React from 'react';
import './DashboardCards.css';

const DashboardCards = ({ contratos = [], registrosTempo = [], onShowTarefas, onShowColaboradores, onShowClientes, clientesFiltrados = null, totalClientes = null }) => {
  // Calcular totais gerais
  let totalTarefas = 0;
  let totalHrs = 0;
  let totalColaboradores = 0;
  let totalClientesCalculado = 0;

  if (registrosTempo && registrosTempo.length > 0) {
    // Tarefas únicas (geral)
    const tarefasUnicas = new Set();
    registrosTempo.forEach(registro => {
      if (registro.tarefa_id) {
        tarefasUnicas.add(String(registro.tarefa_id).trim());
      }
    });
    totalTarefas = tarefasUnicas.size;

    // Horas realizadas (geral)
    // Usar Map para evitar duplicação por ID
    const registrosUnicos = new Map();
    registrosTempo.forEach(registro => {
      // Criar chave única baseada em ID ou combinação de campos
      const registroId = registro.id || `${registro.tarefa_id}_${registro.usuario_id}_${registro.data_inicio}_${registro.data_fim || ''}`;
      if (!registrosUnicos.has(registroId)) {
        registrosUnicos.set(registroId, registro);
      }
    });
    
    // Somar apenas registros únicos
    registrosUnicos.forEach(registro => {
      const tempo = Number(registro.tempo_realizado) || 0;
      totalHrs += tempo;
    });
    
    

    // Colaboradores únicos (geral)
    const colaboradoresUnicos = new Set();
    registrosTempo.forEach(registro => {
      if (registro.usuario_id) {
        colaboradoresUnicos.add(String(registro.usuario_id).trim());
      }
    });
    totalColaboradores = colaboradoresUnicos.size;

    // Clientes únicos (geral)
    // IMPORTANTE: Se totalClientes foi passado explicitamente (do backend), usar esse valor
    // Isso garante que contamos todos os clientes de todas as páginas, não apenas da página atual
    if (totalClientes !== null && totalClientes !== undefined) {
      // Usar o total passado pelo backend (já considera todas as páginas)
      totalClientesCalculado = totalClientes;
    } else {
      // Se não foi passado totalClientes, calcular dos registros (fallback)
      // IMPORTANTE: cliente_id pode conter múltiplos IDs separados por ", "
      const clientesUnicos = new Set();
      registrosTempo.forEach(registro => {
        if (registro.cliente_id) {
          // Fazer split por ", " para extrair todos os IDs
          const ids = String(registro.cliente_id)
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
          ids.forEach(id => clientesUnicos.add(id));
        }
      });
      
      // Se há lista de clientes filtrados, contar apenas os clientes que estão nessa lista
      if (clientesFiltrados && Array.isArray(clientesFiltrados) && clientesFiltrados.length > 0) {
        const clientesFiltradosIds = new Set(
          clientesFiltrados.map(c => String(c.id || c).trim().toLowerCase())
        );
        // Filtrar apenas os clientes únicos que estão na lista filtrada
        const clientesFiltradosUnicos = Array.from(clientesUnicos).filter(clienteId => 
          clientesFiltradosIds.has(String(clienteId).trim().toLowerCase())
        );
        totalClientesCalculado = clientesFiltradosUnicos.length;
      } else {
        totalClientesCalculado = clientesUnicos.size;
      }
    }
  } else if (contratos && contratos.length > 0) {
    // Se não há registros de tempo, usar contratos para contar clientes
    // Mas se totalClientes foi passado, usar esse valor (prioridade)
    if (totalClientes === null || totalClientes === undefined) {
      const clientesUnicos = new Set();
      contratos.forEach(contrato => {
        if (contrato.id_cliente) {
          clientesUnicos.add(String(contrato.id_cliente).trim());
        }
      });
      
      // Se há lista de clientes filtrados, contar apenas os clientes que estão nessa lista
      if (clientesFiltrados && Array.isArray(clientesFiltrados) && clientesFiltrados.length > 0) {
        const clientesFiltradosIds = new Set(
          clientesFiltrados.map(c => String(c.id || c).trim().toLowerCase())
        );
        // Filtrar apenas os clientes únicos que estão na lista filtrada
        const clientesFiltradosUnicos = Array.from(clientesUnicos).filter(clienteId => 
          clientesFiltradosIds.has(String(clienteId).trim().toLowerCase())
        );
        totalClientesCalculado = clientesFiltradosUnicos.length;
      } else {
        totalClientesCalculado = clientesUnicos.size;
      }
    } else {
      totalClientesCalculado = totalClientes;
    }
  }
  
  // Garantir que totalClientesCalculado seja um número válido
  if (totalClientes !== null && totalClientes !== undefined) {
    totalClientesCalculado = totalClientes;
  }
  if (totalClientesCalculado === null || totalClientesCalculado === undefined || isNaN(totalClientesCalculado)) {
    totalClientesCalculado = 0;
  }

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

  const tempoHM = formatarHrsHM(totalHrs);
  const tempoDecimal = formatarHrsDecimal(totalHrs);

  // Mostrar cards se houver dados
  if (totalTarefas === 0 && totalHrs === 0 && totalColaboradores === 0 && totalClientesCalculado === 0) {
    return null;
  }

  return (
    <div className="dashboard-cards-container" style={{ marginTop: '30px' }}>
      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-list"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Tarefas</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totalTarefas}</span>
            {totalTarefas > 0 && (
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

      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-check"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Hrs Realizadas</div>
          <div className="dashboard-card-value">
            {tempoHM}
          </div>
          <div className="dashboard-card-decimal">
            {tempoDecimal} horas
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-users"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Colaboradores</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totalColaboradores}</span>
            {totalColaboradores > 0 && (
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

      <div className="dashboard-card">
        <div className="dashboard-card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
          <i className="fas fa-user-friends"></i>
        </div>
        <div className="dashboard-card-content">
          <div className="dashboard-card-label">Clientes</div>
          <div className="dashboard-card-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{totalClientesCalculado}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCards;

