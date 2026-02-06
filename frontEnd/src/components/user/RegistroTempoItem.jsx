import React from 'react';
import EditButton from '../common/EditButton';
import DeleteButton from '../common/DeleteButton';
import FilterDate from '../filters/FilterDate';

/**
 * Componente para exibir um registro individual de tempo rastreado
 * Inclui funcionalidades de edição e exclusão inline
 */
const RegistroTempoItem = ({
  registro,
  formatarTempoHMS,
  formatarPeriodo,
  isEditando,
  isDeletando,
  formData,
  justificativaDelecao,
  onEditar,
  onDeletar,
  onSalvarEdicao,
  onConfirmarDelecao,
  onFecharEdicao,
  onFecharDelecao,
  onAtualizarFormData,
  onAtualizarJustificativaDelecao,
  isPendente = false,
  onEditarPendente
}) => {
  return (
    <div className={`timer-dropdown-registro ${isPendente ? 'timer-dropdown-registro--pendente' : ''}`}>
      <div className="timer-dropdown-registro-header">
        <div className="timer-dropdown-registro-info">
          {isPendente && (
            <span className="timer-dropdown-registro-badge-pendente" title="Plug Rápido aguardando aprovação">
              <i className="fas fa-bolt"></i> Pendente de aprovação
            </span>
          )}
          <div className="timer-dropdown-registro-tempo">
            {formatarTempoHMS(registro.tempo_realizado || 0)}
          </div>
          <div className="timer-dropdown-registro-periodo">
            {formatarPeriodo(registro.data_inicio, registro.data_fim)}
          </div>
        </div>
        <div className="timer-dropdown-registro-actions">
          <EditButton
            onClick={(e) => {
              e.stopPropagation();
              if (isPendente && onEditarPendente) {
                onEditarPendente(registro);
              } else if (onEditar) {
                onEditar(e, registro);
              }
            }}
            title={isPendente ? "Editar pendente (Plug Rápido)" : (isEditando ? "Fechar edição" : "Editar registro")}
          />
          {!isPendente && (
            <DeleteButton
              onClick={(e) => onDeletar(e, registro)}
              title={isDeletando ? "Fechar exclusão" : "Excluir registro"}
            />
          )}
        </div>
      </div>

      {/* Campos de Edição */}
      {isEditando && (
        <div className="timer-dropdown-registro-edit-form">
          <div className="timer-edit-form-group">
            <label>Data e Hora de Início</label>
            <div className="timer-edit-datetime-row">
              <FilterDate
                label=""
                value={formData.data_inicio || ''}
                onChange={(e) => onAtualizarFormData(registro.id, { ...formData, data_inicio: e.target.value })}
                className="timer-edit-date-picker"
              />
              <div className="timer-edit-time-wrapper">
                <div className="timer-edit-time-input-wrapper">
                  <input
                    type="number"
                    value={formData.hora_inicio || 0}
                    onChange={(e) => onAtualizarFormData(registro.id, { ...formData, hora_inicio: parseInt(e.target.value) || 0 })}
                    className="timer-edit-time-input"
                    min="0"
                    max="23"
                    placeholder="0"
                  />
                  <div className="timer-edit-time-spinner">
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-up"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.min(23, (parseInt(formData.hora_inicio) || 0) + 1);
                        onAtualizarFormData(registro.id, { ...formData, hora_inicio: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-down"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.max(0, (parseInt(formData.hora_inicio) || 0) - 1);
                        onAtualizarFormData(registro.id, { ...formData, hora_inicio: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                <span className="timer-edit-time-label">h</span>
                <div className="timer-edit-time-input-wrapper">
                  <input
                    type="number"
                    value={formData.minuto_inicio || 0}
                    onChange={(e) => onAtualizarFormData(registro.id, { ...formData, minuto_inicio: parseInt(e.target.value) || 0 })}
                    className="timer-edit-time-input"
                    min="0"
                    max="59"
                    placeholder="0"
                  />
                  <div className="timer-edit-time-spinner">
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-up"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.min(59, (parseInt(formData.minuto_inicio) || 0) + 1);
                        onAtualizarFormData(registro.id, { ...formData, minuto_inicio: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-down"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.max(0, (parseInt(formData.minuto_inicio) || 0) - 1);
                        onAtualizarFormData(registro.id, { ...formData, minuto_inicio: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                <span className="timer-edit-time-label">min</span>
              </div>
            </div>
          </div>
          <div className="timer-edit-form-group">
            <label>Data e Hora de Fim</label>
            <div className="timer-edit-datetime-row">
              <FilterDate
                label=""
                value={formData.data_fim || ''}
                onChange={(e) => onAtualizarFormData(registro.id, { ...formData, data_fim: e.target.value })}
                className="timer-edit-date-picker"
              />
              <div className="timer-edit-time-wrapper">
                <div className="timer-edit-time-input-wrapper">
                  <input
                    type="number"
                    value={formData.hora_fim || 0}
                    onChange={(e) => onAtualizarFormData(registro.id, { ...formData, hora_fim: parseInt(e.target.value) || 0 })}
                    className="timer-edit-time-input"
                    min="0"
                    max="23"
                    placeholder="0"
                  />
                  <div className="timer-edit-time-spinner">
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-up"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.min(23, (parseInt(formData.hora_fim) || 0) + 1);
                        onAtualizarFormData(registro.id, { ...formData, hora_fim: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-down"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.max(0, (parseInt(formData.hora_fim) || 0) - 1);
                        onAtualizarFormData(registro.id, { ...formData, hora_fim: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                <span className="timer-edit-time-label">h</span>
                <div className="timer-edit-time-input-wrapper">
                  <input
                    type="number"
                    value={formData.minuto_fim || 0}
                    onChange={(e) => onAtualizarFormData(registro.id, { ...formData, minuto_fim: parseInt(e.target.value) || 0 })}
                    className="timer-edit-time-input"
                    min="0"
                    max="59"
                    placeholder="0"
                  />
                  <div className="timer-edit-time-spinner">
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-up"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.min(59, (parseInt(formData.minuto_fim) || 0) + 1);
                        onAtualizarFormData(registro.id, { ...formData, minuto_fim: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="timer-edit-time-spinner-btn timer-edit-time-spinner-down"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newValue = Math.max(0, (parseInt(formData.minuto_fim) || 0) - 1);
                        onAtualizarFormData(registro.id, { ...formData, minuto_fim: newValue });
                      }}
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                <span className="timer-edit-time-label">min</span>
              </div>
            </div>
          </div>
          <div className="timer-edit-form-group">
            <label>Tempo Realizado</label>
            <div className="timer-edit-tempo-display">
              {(() => {
                if (!formData.data_inicio || !formData.data_fim) return '0h 0min 0s';
                const inicio = new Date(
                  `${formData.data_inicio}T${String(formData.hora_inicio || 0).padStart(2, '0')}:${String(formData.minuto_inicio || 0).padStart(2, '0')}:00`
                );
                const fim = new Date(
                  `${formData.data_fim}T${String(formData.hora_fim || 0).padStart(2, '0')}:${String(formData.minuto_fim || 0).padStart(2, '0')}:00`
                );
                const tempo = fim.getTime() - inicio.getTime();
                return formatarTempoHMS(tempo > 0 ? tempo : 0);
              })()}
            </div>
          </div>
          <div className="timer-edit-form-group">
            <label>
              Justificativa <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={formData.justificativa || ''}
              onChange={(e) => onAtualizarFormData(registro.id, { ...formData, justificativa: e.target.value })}
              className="timer-edit-justificativa-input"
              placeholder="Descreva o motivo da edição deste registro de tempo..."
              rows="3"
              required
            />
          </div>
          <div className="timer-edit-form-actions">
            <button className="btn-secondary" onClick={() => onFecharEdicao(registro.id)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => onSalvarEdicao(registro)}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Campos de Exclusão */}
      {isDeletando && (
        <div className="timer-dropdown-registro-delete-form">
          <div className="timer-edit-form-group">
            <label style={{ color: '#dc2626', fontWeight: 500, fontSize: '11px' }}>
              Atenção: Esta ação não pode ser desfeita!
            </label>
            <div style={{
              padding: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              marginTop: '4px',
              fontSize: '12px',
              color: '#1f2937'
            }}>
              <div style={{ color: '#1f2937' }}>Tempo: {formatarTempoHMS(registro.tempo_realizado || 0)}</div>
              <div style={{ color: '#1f2937' }}>Período: {formatarPeriodo(registro.data_inicio, registro.data_fim)}</div>
            </div>
          </div>
          <div className="timer-edit-form-group">
            <label>
              Justificativa <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={justificativaDelecao}
              onChange={(e) => onAtualizarJustificativaDelecao(registro.id, e.target.value)}
              className="timer-edit-justificativa-input"
              placeholder="Descreva o motivo da exclusão deste registro de tempo..."
              rows="3"
              required
            />
          </div>
          <div className="timer-edit-form-actions">
            <button className="btn-secondary" onClick={() => onFecharDelecao(registro.id)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => onConfirmarDelecao(registro)}
              style={{ background: '#ef4444', color: '#ffffff' }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroTempoItem;

