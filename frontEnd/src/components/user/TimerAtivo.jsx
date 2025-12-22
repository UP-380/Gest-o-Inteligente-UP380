import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import '../../components/common/ActionButtons.css';
import './TimerAtivo.css';

const TimerAtivo = () => {
  const { usuario } = useAuth();
  const [registroAtivo, setRegistroAtivo] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tarefaNome, setTarefaNome] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [tempoEstimado, setTempoEstimado] = useState(null);
  const [historicoRegistros, setHistoricoRegistros] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [formData, setFormData] = useState({
    data_inicio: '',
    hora_inicio: '',
    data_fim: '',
    hora_fim: '',
    tempo_realizado_ms: ''
  });
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Buscar registro ativo
  const buscarRegistroAtivo = async () => {
    if (!usuario || !usuario.id) {
      return;
    }

    try {
      // Buscar todos os registros ativos do usuário
      const response = await fetch(
        `/api/registro-tempo/ativos?usuario_id=${usuario.id}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
          // Pegar o primeiro registro ativo (ou o mais recente)
          const registro = result.data[0];
          setRegistroAtivo(registro);
          
          // Buscar informações completas da tarefa e cliente
          if (registro.tarefa_id) {
            buscarInformacoesTarefa(registro);
          }
          
          // Buscar tempo estimado se disponível
          if (registro.tempo_estimado_id) {
            buscarTempoEstimado(registro.tempo_estimado_id);
          }
        } else {
          setRegistroAtivo(null);
          setTarefaNome('');
          setClienteNome('');
          setTempoEstimado(null);
        }
      } else {
        const errorText = await response.text();
        console.error('[TimerAtivo] Erro na resposta:', response.status, errorText);
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao buscar registro ativo:', error);
    }
  };

  // Buscar informações da tarefa (nome e cliente)
  const buscarInformacoesTarefa = async (registro) => {
    try {
      // Buscar nome da tarefa
      if (registro.tarefa_id) {
        try {
          const tarefaResponse = await fetch(`/api/tarefas-por-ids?ids=${registro.tarefa_id}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (tarefaResponse.ok) {
            const tarefaResult = await tarefaResponse.json();
            if (tarefaResult.success && tarefaResult.data) {
              const tarefaData = tarefaResult.data[registro.tarefa_id];
              if (tarefaData) {
                setTarefaNome(tarefaData || 'Tarefa');
              }
            }
          }
        } catch (error) {
          console.warn('[TimerAtivo] Erro ao buscar nome da tarefa:', error);
        }
      }

      // Buscar nome do cliente
      if (registro.cliente_id) {
        try {
          const clienteResponse = await fetch(`/api/clientes/${registro.cliente_id}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          if (clienteResponse.ok) {
            const clienteResult = await clienteResponse.json();
            if (clienteResult.success && clienteResult.data) {
              setClienteNome(clienteResult.data.nome || 'Cliente');
            }
          }
        } catch (error) {
          console.warn('[TimerAtivo] Erro ao buscar nome do cliente:', error);
        }
      }
    } catch (error) {
      console.warn('[TimerAtivo] Erro ao buscar informações da tarefa:', error);
    }
  };

  // Buscar tempo estimado
  const buscarTempoEstimado = async (tempoEstimadoId) => {
    try {
      const response = await fetch(`/api/tempo-estimado/${tempoEstimadoId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          let tempo = result.data.tempo_estimado_dia || result.data.tempo_estimado_total || 0;
          // Se o tempo for menor que 1000, provavelmente está em horas decimais
          // Se for maior ou igual a 1000, provavelmente já está em milissegundos
          if (tempo > 0 && tempo < 1000) {
            // Converter horas decimais para milissegundos
            tempo = tempo * 3600000;
          }
          setTempoEstimado(tempo);
        }
      }
    } catch (error) {
      console.warn('[TimerAtivo] Erro ao buscar tempo estimado:', error);
    }
  };

  // Buscar histórico de registros
  const buscarHistorico = async () => {
    if (!usuario || !usuario.id) return;

    try {
      const response = await fetch(
        `/api/registro-tempo/historico?usuario_id=${usuario.id}&limite=20`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHistoricoRegistros(result.data || []);
        }
      }
    } catch (error) {
      console.warn('[TimerAtivo] Erro ao buscar histórico:', error);
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      buscarHistorico(); // Buscar histórico quando abrir o dropdown
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, usuario]);

  useEffect(() => {
    if (!usuario || !usuario.id) {
      return;
    }

    buscarRegistroAtivo();
    
    // Buscar novamente a cada 3 segundos (mais frequente para detectar mudanças)
    const interval = setInterval(() => {
      buscarRegistroAtivo();
    }, 3000);
    
    // Escutar eventos de início/fim de registro
    const handleRegistroIniciado = () => {
      buscarRegistroAtivo();
    };
    
    const handleRegistroFinalizado = () => {
      buscarRegistroAtivo();
    };
    
    window.addEventListener('registro-tempo-iniciado', handleRegistroIniciado);
    window.addEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('registro-tempo-iniciado', handleRegistroIniciado);
      window.removeEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    };
  }, [usuario]);

  // Atualizar tempo decorrido em tempo real
  useEffect(() => {
    if (!registroAtivo || !registroAtivo.data_inicio) {
      setTempoDecorrido(0);
      return;
    }

    const atualizarTempo = () => {
      const agora = new Date();
      const inicio = new Date(registroAtivo.data_inicio);
      const diferenca = agora.getTime() - inicio.getTime();
      setTempoDecorrido(diferenca);
    };

    atualizarTempo();
    const interval = setInterval(atualizarTempo, 1000);
    return () => clearInterval(interval);
  }, [registroAtivo]);

  // Formatar tempo em formato HH:MM:SS (ex: "2:32:56")
  const formatarTempo = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0:00:00';
    
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    
    const horasStr = String(horas).padStart(1, '0');
    const minutosStr = String(minutos).padStart(2, '0');
    const segundosStr = String(segundos).padStart(2, '0');
    
    return `${horasStr}:${minutosStr}:${segundosStr}`;
  };

  // Formatar tempo em horas/minutos/segundos
  const formatarTempoHMS = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0s';
    
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    
    if (horas > 0) {
      return `${horas}h ${minutos}min ${segundos}s`;
    } else if (minutos > 0) {
      return `${minutos}min ${segundos}s`;
    } else {
      return `${segundos}s`;
    }
  };

  // Formatar data/hora
  const formatarDataHora = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatar período (data início - data fim) sem repetir data se for o mesmo dia
  const formatarPeriodo = (dataInicio, dataFim) => {
    if (!dataInicio) return '';
    
    const inicio = new Date(dataInicio);
    const fim = dataFim ? new Date(dataFim) : null;
    
    // Formatar data de início
    const dataInicioFormatada = inicio.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const horaInicioFormatada = inicio.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (!fim) {
      return `${dataInicioFormatada}, ${horaInicioFormatada} - Agora`;
    }
    
    // Verificar se é o mesmo dia
    const mesmoDia = inicio.toDateString() === fim.toDateString();
    
    if (mesmoDia) {
      // Mesmo dia: mostrar data uma vez e depois só as horas
      const horaFimFormatada = fim.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dataInicioFormatada}, ${horaInicioFormatada} - ${horaFimFormatada}`;
    } else {
      // Dias diferentes: mostrar data completa para ambos
      const dataFimFormatada = fim.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaFimFormatada = fim.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dataInicioFormatada}, ${horaInicioFormatada} - ${dataFimFormatada}, ${horaFimFormatada}`;
    }
  };

  // Formatar data para agrupamento
  const formatarDataGrupo = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    
    if (data.toDateString() === hoje.toDateString()) {
      return 'Hoje';
    } else if (data.toDateString() === ontem.toDateString()) {
      return 'Ontem';
    } else {
      return data.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
      });
    }
  };

  // Agrupar histórico por data
  const agruparHistoricoPorData = () => {
    const grupos = {};
    historicoRegistros.forEach((registro) => {
      const dataKey = registro.data_inicio ? new Date(registro.data_inicio).toDateString() : 'Sem data';
      if (!grupos[dataKey]) {
        grupos[dataKey] = [];
      }
      grupos[dataKey].push(registro);
    });
    return grupos;
  };

  // Calcular total do dia
  const calcularTotalDia = (registros) => {
    return registros.reduce((total, reg) => {
      return total + (reg.tempo_realizado || 0);
    }, 0);
  };

  // Handler para abrir/fechar dropdown
  const handleContainerClick = (e) => {
    // Não abrir se clicar no botão de parar
    if (e.target.closest('.timer-ativo-stop-btn')) {
      return;
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Converter data/hora para formato datetime-local
  const formatarParaInputDateTime = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
  };

  // Abrir modal de edição
  const handleEditar = (e, registro) => {
    e.stopPropagation();
    const dataInicio = new Date(registro.data_inicio);
    const dataFim = registro.data_fim ? new Date(registro.data_fim) : new Date();
    
    setRegistroEditando(registro);
    setFormData({
      data_inicio: formatarParaInputDateTime(registro.data_inicio),
      hora_inicio: formatarParaInputDateTime(registro.data_inicio),
      data_fim: registro.data_fim ? formatarParaInputDateTime(registro.data_fim) : formatarParaInputDateTime(new Date()),
      hora_fim: registro.data_fim ? formatarParaInputDateTime(registro.data_fim) : formatarParaInputDateTime(new Date()),
      tempo_realizado_ms: registro.tempo_realizado || 0
    });
  };

  // Fechar modal de edição
  const handleFecharEdicao = () => {
    setRegistroEditando(null);
    setFormData({
      data_inicio: '',
      hora_inicio: '',
      data_fim: '',
      hora_fim: '',
      tempo_realizado_ms: ''
    });
  };

  // Salvar edição
  const handleSalvarEdicao = async () => {
    if (!registroEditando) return;

    try {
      // Combinar data e hora
      const dataInicioCompleta = new Date(formData.data_inicio);
      const dataFimCompleta = new Date(formData.data_fim);

      const response = await fetch(`/api/registro-tempo/${registroEditando.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          data_inicio: dataInicioCompleta.toISOString(),
          data_fim: dataFimCompleta.toISOString()
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Atualizar histórico
        await buscarHistorico();
        handleFecharEdicao();
        
        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('registro-tempo-atualizado'));
      } else {
        alert(result.error || 'Erro ao atualizar registro');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao salvar edição:', error);
      alert('Erro ao salvar edição');
    }
  };

  // Deletar registro
  const handleDeletar = async (e, registro) => {
    e.stopPropagation();
    
    if (!window.confirm('Tem certeza que deseja deletar este registro de tempo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/registro-tempo/${registro.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Atualizar histórico
        await buscarHistorico();
        
        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('registro-tempo-deletado'));
      } else {
        alert(result.error || 'Erro ao deletar registro');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao deletar registro:', error);
      alert('Erro ao deletar registro');
    }
  };

  // Parar o timer
  const handleParar = async (e) => {
    e.stopPropagation(); // Prevenir que abra o dropdown
    if (!registroAtivo || !usuario) return;

    try {
      const response = await fetch(`/api/registro-tempo/finalizar/${registroAtivo.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tarefa_id: registroAtivo.tarefa_id,
          usuario_id: usuario.id
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setRegistroAtivo(null);
        setTarefaNome('');
        setTempoDecorrido(0);
        
        // Disparar evento customizado para atualizar o painel
        window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));
        
        // Buscar novamente para garantir que está atualizado
        setTimeout(() => {
          buscarRegistroAtivo();
        }, 500);
      } else {
        console.error('[TimerAtivo] Erro ao finalizar registro:', result);
        alert(result.error || 'Erro ao parar o timer');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao parar timer:', error);
      alert('Erro ao parar o timer');
    }
  };

  // Não mostrar se não houver registro ativo
  if (!registroAtivo) {
    return null;
  }

  const historicoAgrupado = agruparHistoricoPorData();

  return (
    <div className="timer-ativo-wrapper">
      <div 
        ref={containerRef}
        className="timer-ativo-container"
        onClick={handleContainerClick}
        style={{ cursor: 'pointer' }}
      >
        <div className="timer-ativo-tempo">
          {formatarTempo(tempoDecorrido)}
        </div>
        <button
          className="timer-ativo-stop-btn"
          onClick={handleParar}
          title="Parar registro de tempo"
          aria-label="Parar registro de tempo"
        >
          <i className="fas fa-stop"></i>
        </button>
      </div>

      {isDropdownOpen && (
        <div ref={dropdownRef} className="timer-ativo-dropdown">
          {/* Tarefa Atual Ativa */}
          <div className="timer-dropdown-section">
            <div className="timer-dropdown-header">
              <span className="timer-dropdown-title">Tempo Estimado</span>
            </div>
            <div className="timer-dropdown-tarefa-ativa">
              <div className="timer-dropdown-tarefa-nome">{tarefaNome || 'Tarefa'}</div>
              {clienteNome && (
                <div className="timer-dropdown-cliente">{clienteNome}</div>
              )}
              <div className="timer-dropdown-tempo-info">
                <span className="timer-dropdown-tempo-atual">
                  {formatarTempo(tempoDecorrido)}
                </span>
                {tempoEstimado && tempoEstimado > 0 && (
                  <span className="timer-dropdown-tempo-estimado">
                    / {formatarTempoHMS(Math.round(tempoEstimado))}
                  </span>
                )}
              </div>
              <div className="timer-dropdown-data">
                {formatarPeriodo(registroAtivo.data_inicio, null)}
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div className="timer-dropdown-section">
            <div className="timer-dropdown-header">
              <span className="timer-dropdown-title">Histórico</span>
            </div>
            <div className="timer-dropdown-historico">
              {Object.entries(historicoAgrupado).length === 0 ? (
                <div className="timer-dropdown-empty">Nenhum registro encontrado</div>
              ) : (
                Object.entries(historicoAgrupado).map(([dataKey, registros]) => {
                  const totalDia = calcularTotalDia(registros);
                  return (
                    <div key={dataKey} className="timer-dropdown-dia">
                      <div className="timer-dropdown-dia-header">
                        <span className="timer-dropdown-dia-data">
                          {formatarDataGrupo(registros[0].data_inicio)}
                        </span>
                        <span className="timer-dropdown-dia-total">
                          {formatarTempoHMS(totalDia)}
                        </span>
                      </div>
                      <div className="timer-dropdown-registros">
                        {registros.map((reg) => (
                          <div key={reg.id} className="timer-dropdown-registro">
                            <div className="timer-dropdown-registro-info">
                              <div className="timer-dropdown-registro-tempo">
                                {formatarTempoHMS(reg.tempo_realizado || 0)}
                              </div>
                              <div className="timer-dropdown-registro-periodo">
                                {formatarPeriodo(reg.data_inicio, reg.data_fim)}
                              </div>
                            </div>
                            <div className="timer-dropdown-registro-actions">
                              <EditButton
                                onClick={(e) => handleEditar(e, reg)}
                                title="Editar registro"
                              />
                              <DeleteButton
                                onClick={(e) => handleDeletar(e, reg)}
                                title="Deletar registro"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {registroEditando && (
        <div className="timer-edit-modal-overlay" onClick={handleFecharEdicao}>
          <div className="timer-edit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="timer-edit-modal-header">
              <h3>Editar Registro de Tempo</h3>
              <button className="timer-edit-modal-close" onClick={handleFecharEdicao}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="timer-edit-modal-body">
              <div className="timer-edit-form-group">
                <label>Data e Hora de Início</label>
                <input
                  type="datetime-local"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="timer-edit-input"
                />
              </div>
              <div className="timer-edit-form-group">
                <label>Data e Hora de Fim</label>
                <input
                  type="datetime-local"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  className="timer-edit-input"
                />
              </div>
              <div className="timer-edit-form-group">
                <label>Tempo Realizado</label>
                <div className="timer-edit-tempo-display">
                  {(() => {
                    const inicio = new Date(formData.data_inicio);
                    const fim = new Date(formData.data_fim);
                    const tempo = fim.getTime() - inicio.getTime();
                    return formatarTempoHMS(tempo > 0 ? tempo : 0);
                  })()}
                </div>
              </div>
            </div>
            <div className="timer-edit-modal-footer">
              <button className="btn-secondary" onClick={handleFecharEdicao}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSalvarEdicao}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimerAtivo;


