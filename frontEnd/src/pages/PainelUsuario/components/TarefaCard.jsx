import React from 'react';
import TimerButton from '../../../components/common/TimerButton';
import './TarefaCard.css';

/**
 * Componente de Card de Tarefa
 * 
 * @param {Object} props
 * @param {Object} props.registro - Registro da tarefa com dados completos
 * @param {Function} props.onIniciarTempo - Callback quando inicia registro de tempo
 * @param {Function} props.onPararTempo - Callback quando para registro de tempo
 * @param {boolean} props.isAtivo - Se a tarefa está com registro de tempo ativo
 * @param {Function} props.getNomeTarefa - Função para obter nome da tarefa
 * @param {Function} props.formatarTempoComCusto - Função para formatar tempo estimado
 * @param {Function} props.obterTempoRealizadoFormatado - Função para obter tempo realizado formatado
 */
const TarefaCard = ({
  registro,
  onIniciarTempo,
  onPararTempo,
  isAtivo = false,
  getNomeTarefa,
  formatarTempoComCusto,
  obterTempoRealizadoFormatado
}) => {
  const handleButtonClick = (e) => {
    if (isAtivo) {
      onPararTempo?.(registro);
    } else {
      onIniciarTempo?.(registro);
    }
  };

  return (
    <div className="painel-usuario-tarefa-card">
      <div className="painel-usuario-tarefa-top">
        <div className="painel-usuario-tarefa-nome">
          {getNomeTarefa?.(registro.tarefa_id) || 'Tarefa'}
        </div>
        <TimerButton
          isActive={isAtivo}
          onClick={handleButtonClick}
          className="timer-button-painel"
          dataAttributes={{
            'data-tarefa-id': registro.tarefa_id || '',
            'data-cliente-id': registro.cliente_id || '',
            'data-action': isAtivo ? 'parar' : 'iniciar'
          }}
        />
      </div>
      <div className="painel-usuario-tarefa-tags">
        <span className="painel-usuario-badge-estimado">
          <i className="fas fa-clock painel-usuario-estimado-icon-inline"></i>
          <span className="painel-usuario-estimado-label">Estimado:</span>
          <span className="painel-usuario-estimado-pill">
            {formatarTempoComCusto?.(registro.tempo_estimado_dia || registro.tempo_estimado_total || 0) || '0h'}
          </span>
        </span>
        <span className="painel-usuario-badge-realizado">
          <i className="fas fa-play-circle painel-usuario-realizado-icon-inline"></i>
          <span className="painel-usuario-realizado-label">Realizado:</span>
          <span
            className="painel-usuario-realizado-pill"
            data-tarefa-id={registro.tarefa_id}
            data-cliente-id={registro.cliente_id}
          >
            {obterTempoRealizadoFormatado?.(registro) || '0s'}
          </span>
        </span>
      </div>
    </div>
  );
};

export default TarefaCard;




