import React from 'react';
import './DashboardCards.css';

const DashboardCards = ({ contratos = [], registrosTempo = [], onShowTarefas, onShowColaboradores, onShowClientes }) => {
  // Calcular totais gerais
  let totalTarefas = 0;
  let totalHrs = 0;
  let totalColaboradores = 0;
  let totalClientes = 0;

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
    
    // Debug log
    console.log('📊 DashboardCards - Cálculo de horas:', {
      totalRegistros: registrosTempo.length,
      registrosUnicos: registrosUnicos.size,
      totalHrsMs: totalHrs,
      totalHrsDecimal: (totalHrs / (1000 * 60 * 60)).toFixed(2)
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
    const clientesUnicos = new Set();
    registrosTempo.forEach(registro => {
      if (registro.cliente_id) {
        clientesUnicos.add(String(registro.cliente_id).trim());
      }
    });
    totalClientes = clientesUnicos.size;
  } else if (contratos && contratos.length > 0) {
    // Se não há registros de tempo, usar contratos para contar clientes
    const clientesUnicos = new Set();
    contratos.forEach(contrato => {
      if (contrato.id_cliente) {
        clientesUnicos.add(String(contrato.id_cliente).trim());
      }
    });
    totalClientes = clientesUnicos.size;
  }

  // Formatar horas em h min (sem segundos para dashboard)
  const formatarHrsHM = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0min';
    const horas = Math.floor(milissegundos / (1000 * 60 * 60));
    const minutos = Math.floor((milissegundos % (1000 * 60 * 60)) / (1000 * 60));

    let resultado = '';
    if (horas > 0) resultado += `${horas}h `;
    if (minutos > 0 || horas === 0) resultado += `${minutos}min`;
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
  if (totalTarefas === 0 && totalHrs === 0 && totalColaboradores === 0 && totalClientes === 0) {
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
            {tempoHM} <i className="fas fa-info-circle" style={{ marginLeft: '4px', fontSize: '0.75rem', color: '#ff9800', cursor: 'help' }} title={`${tempoDecimal} horas`}></i>
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
            <span>{totalClientes}</span>
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

