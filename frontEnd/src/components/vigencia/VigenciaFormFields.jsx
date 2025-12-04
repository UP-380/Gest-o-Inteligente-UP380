import React from 'react';
import DatePickerSingle from '../common/DatePickerSingle';

/**
 * Componente reutilizável para campos de formulário de vigência
 * 
 * @param {Object} props
 * @param {Object} props.formData - Dados do formulário
 * @param {Function} props.setFormData - Função para atualizar dados do formulário
 * @param {Object} props.formErrors - Erros do formulário
 * @param {Function} props.setFormErrors - Função para atualizar erros
 * @param {Array} props.tiposContrato - Lista de tipos de contrato
 * @param {Boolean} props.loadingTiposContrato - Estado de carregamento dos tipos de contrato
 * @param {Boolean} props.submitting - Estado de submissão
 * @param {Function} props.formatarValorParaInput - Função para formatar valores para input
 * @param {Function} props.removerFormatacaoMoeda - Função para remover formatação de moeda
 */
const VigenciaFormFields = ({
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  tiposContrato = [],
  loadingTiposContrato = false,
  submitting = false,
  formatarValorParaInput,
  removerFormatacaoMoeda
}) => {
  // Função para formatar valor monetário no input
  const formatarMoedaInput = (valor) => {
    const valorLimpo = valor.replace(/\D/g, '');
    if (valorLimpo) {
      return (parseFloat(valorLimpo) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return '';
  };

  // Verificar se é PJ (tipo_contrato === '2')
  const isPJ = formData.tipo_contrato === '2';

  return (
    <>
      {/* Campos básicos de vigência */}
      <div className="form-row-vigencia">
        <div className="form-group">
          <label className="form-label-small">
            Data de Vigência <span className="required">*</span>
          </label>
          <div className={formErrors.dt_vigencia ? 'datepicker-error-wrapper' : ''}>
            <DatePickerSingle
              value={formData.dt_vigencia}
              onChange={(e) => {
                setFormData({ ...formData, dt_vigencia: e.target.value });
                if (formErrors.dt_vigencia) {
                  setFormErrors({ ...formErrors, dt_vigencia: '' });
                }
              }}
              disabled={submitting}
              placeholder="Selecione a data"
            />
          </div>
          {formErrors.dt_vigencia && (
            <span className="error-message">{formErrors.dt_vigencia}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">Horas Contratadas/Dia</label>
          <input
            type="number"
            step="0.01"
            className="form-input-small"
            value={formData.horascontratadasdia}
            onChange={(e) => setFormData({ ...formData, horascontratadasdia: e.target.value })}
            placeholder="Ex: 8"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label-small">
            Tipo de Contrato <span className="required">*</span>
          </label>
          <div className="select-wrapper">
            <select
              className={`form-input-small select-with-icon ${formErrors.tipo_contrato ? 'error' : ''}`}
              value={formData.tipo_contrato || ''}
              onChange={(e) => {
                setFormData({ ...formData, tipo_contrato: e.target.value });
                if (formErrors.tipo_contrato) {
                  setFormErrors({ ...formErrors, tipo_contrato: '' });
                }
              }}
              disabled={submitting || loadingTiposContrato}
            >
              <option value="">Selecione o tipo de contrato</option>
              {tiposContrato.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </select>
            <i className="fas fa-chevron-down select-icon"></i>
          </div>
          {formErrors.tipo_contrato && (
            <span className="error-message">{formErrors.tipo_contrato}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label-small">Salário Base</label>
          <input
            type="text"
            className="form-input-small"
            value={formData.salariobase}
            onChange={(e) => {
              const valor = e.target.value.replace(/\D/g, '');
              if (valor) {
                const valorFormatado = formatarMoedaInput(e.target.value);
                setFormData({ ...formData, salariobase: valorFormatado });
              } else {
                setFormData({ ...formData, salariobase: '' });
              }
            }}
            placeholder="0,00"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label-small">Custo Hora</label>
          {isPJ ? (
            // Se for PJ, campo editável
            <input
              type="text"
              className="form-input-small"
              value={formData.custo_hora || '0'}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '');
                if (valor) {
                  const valorFormatado = formatarMoedaInput(e.target.value);
                  setFormData({ ...formData, custo_hora: valorFormatado });
                } else {
                  setFormData({ ...formData, custo_hora: '0' });
                }
              }}
              placeholder="0,00"
              disabled={submitting}
            />
          ) : (
            // Se não for PJ, campo calculado automaticamente
            <input
              type="text"
              className="form-input-small"
              value={formData.custo_hora || '0'}
              readOnly
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
              placeholder="0,00"
              disabled={submitting}
              title="Calculado automaticamente"
            />
          )}
        </div>

        <div className="form-group" style={{ gridColumn: 'span 1' }}>
          <label className="form-label-small">Descrição</label>
          <input
            type="text"
            className="form-input-small"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Descrição opcional"
            disabled={submitting}
          />
        </div>
      </div>

      {/* Seção de Benefícios e Encargos */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
        <h4 className="form-section-title" style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          Benefícios e Encargos
        </h4>

        <div className="form-row-vigencia">
          <div className="form-group">
            <label className="form-label-small">Ajuda de Custo</label>
            <input
              type="text"
              className="form-input-small"
              value={formData.ajudacusto}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '');
                if (valor) {
                  const valorFormatado = formatarMoedaInput(e.target.value);
                  setFormData({ ...formData, ajudacusto: valorFormatado });
                } else {
                  setFormData({ ...formData, ajudacusto: '0' });
                }
              }}
              placeholder="0,00"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label-small">Vale Transporte/Dia</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.valetransporte || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, valetransporte: valorFormatado });
                  } else {
                    setFormData({ ...formData, valetransporte: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.valetransporte || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label-small">Vale Refeição/Dia</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.vale_refeicao || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, vale_refeicao: valorFormatado });
                  } else {
                    setFormData({ ...formData, vale_refeicao: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.vale_refeicao || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label-small">Férias</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.ferias || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, ferias: valorFormatado });
                  } else {
                    setFormData({ ...formData, ferias: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.ferias || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label-small">1/3 Férias</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.terco_ferias || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, terco_ferias: valorFormatado });
                  } else {
                    setFormData({ ...formData, terco_ferias: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.terco_ferias || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label-small">13º Salário</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.decimoterceiro || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, decimoterceiro: valorFormatado });
                  } else {
                    setFormData({ ...formData, decimoterceiro: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.decimoterceiro || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>
        </div>

        <div className="form-row-vigencia">
          <div className="form-group">
            <label className="form-label-small">FGTS</label>
            {isPJ ? (
              // Se for PJ, campo editável
              <input
                type="text"
                className="form-input-small"
                value={formData.fgts || '0'}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '');
                  if (valor) {
                    const valorFormatado = formatarMoedaInput(e.target.value);
                    setFormData({ ...formData, fgts: valorFormatado });
                  } else {
                    setFormData({ ...formData, fgts: '0' });
                  }
                }}
                placeholder="0,00"
                disabled={submitting}
              />
            ) : (
              // Se não for PJ, campo calculado automaticamente
              <input
                type="text"
                className="form-input-small"
                value={formData.fgts || '0'}
                readOnly
                style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
                placeholder="0,00"
                disabled={submitting}
                title="Calculado automaticamente"
              />
            )}
          </div>
        </div>
    </div>
  </>
);
};

export default VigenciaFormFields;

