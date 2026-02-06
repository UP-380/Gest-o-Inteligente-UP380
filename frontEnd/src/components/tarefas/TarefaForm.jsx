import React from 'react';
import RichTextEditor from '../common/RichTextEditor';

/**
 * Componente de formulário de tarefa
 */
const TarefaForm = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting
}) => {
  const handleNomeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, nome: value });
    if (formErrors.nome) {
      setFormErrors({ ...formErrors, nome: '' });
    }
  };

  const handleClickupIdChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, clickup_id: value });
    if (formErrors.clickup_id) {
      setFormErrors({ ...formErrors, clickup_id: '' });
    }
  };

  const handleDescricaoChange = (value) => {
    setFormData({ ...formData, descricao: value });
    if (formErrors.descricao) {
      setFormErrors({ ...formErrors, descricao: '' });
    }
  };

  return (
    <div className="tarefa-form">
      {/* Seção: Dados Básicos */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label-small">
            Nome da Tarefa <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.nome ? 'error' : ''}`}
            value={formData.nome || ''}
            onChange={handleNomeChange}
            placeholder="Ex: Desenvolvimento, Testes, Reunião..."
            disabled={submitting}
            required
            maxLength={200}
          />
          {formErrors.nome && (
            <span className="error-message">{formErrors.nome}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">
            ClickUp ID
            <span style={{ 
              fontSize: '11px', 
              color: '#64748b', 
              marginLeft: '6px',
              fontWeight: 'normal'
            }}>
              (Opcional)
            </span>
          </label>
          <input
            type="text"
            className={`form-input-small ${formErrors.clickup_id ? 'error' : ''}`}
            value={formData.clickup_id || ''}
            onChange={handleClickupIdChange}
            placeholder="ID do ClickUp"
            disabled={submitting}
            maxLength={100}
          />
          {formErrors.clickup_id && (
            <span className="error-message">{formErrors.clickup_id}</span>
          )}
        </div>
      </div>

      {/* Separador */}
      <div className="tarefa-form-separator"></div>

      {/* Seção: Descrição - Editor de texto rico em seção separada */}
      <div className="tarefa-form-section-descricao">
        <div className="form-group form-group-full-width">
          <label className="form-label-small">
            Descrição
            <span style={{ 
              fontSize: '11px', 
              color: '#64748b', 
              marginLeft: '6px',
              fontWeight: 'normal'
            }}>
              (Opcional)
            </span>
          </label>
          <RichTextEditor
            value={formData.descricao || ''}
            onChange={handleDescricaoChange}
            placeholder="Descreva a tarefa em detalhes..."
            disabled={submitting}
            error={!!formErrors.descricao}
          />
          {formErrors.descricao && (
            <span className="error-message">{formErrors.descricao}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TarefaForm;

