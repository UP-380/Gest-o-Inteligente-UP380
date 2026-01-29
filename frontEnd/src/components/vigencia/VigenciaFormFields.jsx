import React from 'react';
import DatePicker from './DatePicker';
import Tooltip from '../common/Tooltip';

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
 * @param {Set} props.camposPreenchidosAuto - Set com nomes dos campos preenchidos automaticamente
 * @param {Function} props.onBuscarCustoColaborador - Função para buscar custo colaborador ao clicar no ícone
 * @param {Boolean} props.buscandoCustoColaborador - Estado de carregamento da busca de custo colaborador
 * @param {Number} props.diasUteis - Número de dias úteis para cálculos mensais
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
  removerFormatacaoMoeda,
  camposPreenchidosAuto = new Set(),
  onBuscarCustoColaborador = null,
  buscandoCustoColaborador = false,
  diasUteis = 22
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

  // Função auxiliar para calcular valor mensal a partir do diário
  const calcularValorMensal = (valorDiario) => {
    const diario = parseFloat(removerFormatacaoMoeda(valorDiario || '0')) || 0;
    return diario * diasUteis;
  };

  // Função auxiliar para calcular percentual anual (para Férias, 1/3 Férias, 13º)
  const calcularPercentualAnual = (valorDiario, salarioBase) => {
    const diario = parseFloat(removerFormatacaoMoeda(valorDiario || '0')) || 0;
    const salario = parseFloat(removerFormatacaoMoeda(salarioBase || '0')) || 0;
    if (salario === 0) return 0;
    
    // Para encargos anuais (Férias, 1/3 Férias, 13º), o percentual é calculado sobre o valor anual
    // valorDiario = (percentual/100 * salario) / 12 / diasUteis
    // percentual = (valorDiario * 12 * diasUteis * 100) / salario
    const valorMensal = diario * diasUteis;
    const valorAnual = valorMensal * 12;
    return (valorAnual / salario) * 100;
  };

  // Função auxiliar para calcular percentual mensal (para Férias, 1/3 Férias, 13º)
  const calcularPercentualMensal = (valorDiario, salarioBase) => {
    const diario = parseFloat(removerFormatacaoMoeda(valorDiario || '0')) || 0;
    const salario = parseFloat(removerFormatacaoMoeda(salarioBase || '0')) || 0;
    if (salario === 0) return 0;
    
    // Percentual mensal = (valorMensal / salario) * 100
    const valorMensal = diario * diasUteis;
    return (valorMensal / salario) * 100;
  };

  // Função auxiliar para calcular percentual diário (para Férias, 1/3 Férias, 13º)
  // Para provisões anuais, o percentual diário é o mesmo que o percentual mensal
  // porque ambos representam a mesma proporção do salário
  const calcularPercentualDiario = (valorDiario, salarioBase) => {
    // Para provisões anuais, o percentual diário é igual ao percentual mensal
    // pois ambos representam a mesma proporção do salário base
    return calcularPercentualMensal(valorDiario, salarioBase);
  };

  // Função auxiliar para calcular percentual do FGTS (encargo mensal direto)
  const calcularPercentualFGTS = (valorDiario, salarioBase) => {
    const diario = parseFloat(removerFormatacaoMoeda(valorDiario || '0')) || 0;
    const salario = parseFloat(removerFormatacaoMoeda(salarioBase || '0')) || 0;
    if (salario === 0) return 0;
    
    // FGTS é encargo mensal direto: valorDiario = (percentual/100 * salario) / diasUteis
    // percentual = (valorDiario * diasUteis * 100) / salario
    const valorMensal = diario * diasUteis;
    return (valorMensal / salario) * 100;
  };

  // Função auxiliar para calcular percentual diário do FGTS
  // Para FGTS (encargo mensal), o percentual diário é o mesmo que o percentual mensal
  const calcularPercentualDiarioFGTS = (valorDiario, salarioBase) => {
    // Para encargos mensais, o percentual diário é igual ao percentual mensal
    return calcularPercentualFGTS(valorDiario, salarioBase);
  };

  const salarioBase = formData.salariobase || '0';

  return (
    <>
      {/* Campos básicos de vigência */}
      {/* Primeira linha: 4 colunas */}
      <div className="form-row-vigencia" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label-small">
            Inicio Vigência <span className="required">*</span>
          </label>
          <DatePicker
            value={formData.dt_vigencia}
            onChange={(e) => {
              setFormData({ ...formData, dt_vigencia: e.target.value });
              if (formErrors.dt_vigencia) {
                setFormErrors({ ...formErrors, dt_vigencia: '' });
              }
            }}
            disabled={submitting}
            error={!!formErrors.dt_vigencia}
          />
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
            {loadingTiposContrato && (
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                <i className="fas fa-spinner fa-spin"></i> Carregando...
              </span>
            )}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                required
                style={{ flex: 1 }}
              >
                <option value="">
                  {loadingTiposContrato ? 'Carregando tipos de contrato...' : 'Selecione o tipo de contrato'}
                </option>
                {tiposContrato && tiposContrato.length > 0 ? (
                  tiposContrato.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome || `Tipo ${tipo.id}`}
                    </option>
                  ))
                ) : (
                  !loadingTiposContrato && (
                    <option value="" disabled>Nenhum tipo de contrato disponível</option>
                  )
                )}
              </select>
              {onBuscarCustoColaborador && formData.tipo_contrato && (
                <Tooltip
                  text='Clique aqui para atualizar as informações de Benefícios e Encargos conforme padrão configurado em "Custo Colaborador"'
                  position="bottom"
                >
                  {/* Botão de carregar - apenas ícone azul com tooltip */}
                  <button
                    type="button"
                    onClick={() => onBuscarCustoColaborador()}
                    disabled={submitting || loadingTiposContrato || buscandoCustoColaborador}
                    style={{
                      padding: '0',
                      backgroundColor: 'transparent',
                      color: '#3b82f6',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (submitting || loadingTiposContrato || buscandoCustoColaborador) ? 'not-allowed' : 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: (submitting || loadingTiposContrato || buscandoCustoColaborador) ? 0.6 : 1,
                      transition: 'opacity 0.2s',
                      width: '24px',
                      height: '24px',
                      minWidth: '24px'
                    }}
                    onMouseEnter={(e) => {
                      if (!submitting && !loadingTiposContrato && !buscandoCustoColaborador) {
                        e.target.style.opacity = '0.8';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!submitting && !loadingTiposContrato && !buscandoCustoColaborador) {
                        e.target.style.opacity = '1';
                      }
                    }}
                  >
                    {buscandoCustoColaborador ? (
                      <i className="fas fa-spinner fa-spin" style={{ color: '#3b82f6' }}></i>
                    ) : (
                      <i className="fas fa-redo" style={{ color: '#3b82f6' }}></i>
                    )}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          {formErrors.tipo_contrato && (
            <span className="error-message">{formErrors.tipo_contrato}</span>
          )}
          {!loadingTiposContrato && tiposContrato.length === 0 && (
            <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
              Nenhum tipo de contrato encontrado. Verifique sua conexão.
            </span>
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
      </div>

      {/* Seção de Benefícios */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
        <h4 className="form-section-title" style={{ 
          marginBottom: '16px', 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-gift" style={{ color: '#10b981' }}></i>
          Benefícios
        </h4>

        <div className="form-row-vigencia">
          {/* Ajuda de Custo */}
          <div className="form-group">
            <label className="form-label-small">
              Ajuda de Custo
              {camposPreenchidosAuto.has('ajudacusto') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
              Diário: {formatarValorParaInput(formData.ajudacusto || '0')} | 
              Mensal: {formatarValorParaInput(calcularValorMensal(formData.ajudacusto))}
            </div>
          </div>

          {/* Vale Transporte */}
          <div className="form-group">
            <label className="form-label-small">
              Vale Transporte
              {camposPreenchidosAuto.has('valetransporte') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
              Diário: {formatarValorParaInput(formData.valetransporte || '0')} | 
              Mensal: {formatarValorParaInput(calcularValorMensal(formData.valetransporte))}
            </div>
          </div>

          {/* Vale Refeição */}
          <div className="form-group">
            <label className="form-label-small">
              Vale Refeição
              {camposPreenchidosAuto.has('vale_refeicao') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
              Diário: {formatarValorParaInput(formData.vale_refeicao || '0')} | 
              Mensal: {formatarValorParaInput(calcularValorMensal(formData.vale_refeicao))}
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Encargos */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
        <h4 className="form-section-title" style={{ 
          marginBottom: '16px', 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-file-invoice-dollar" style={{ color: '#f59e0b' }}></i>
          Encargos
        </h4>

        <div className="form-row-vigencia" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {/* Férias */}
          <div className="form-group">
            <label className="form-label-small">
              Férias
              {camposPreenchidosAuto.has('ferias') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>(Diário: {calcularPercentualDiario(formData.ferias, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(formData.ferias || '0')})</span>
              <span>(Mensal: {calcularPercentualMensal(formData.ferias, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(calcularValorMensal(formData.ferias))})</span>
            </div>
          </div>

          {/* 1/3 Férias */}
          <div className="form-group">
            <label className="form-label-small">
              1/3 Férias
              {camposPreenchidosAuto.has('terco_ferias') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>(Diário: {calcularPercentualDiario(formData.terco_ferias, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(formData.terco_ferias || '0')})</span>
              <span>(Mensal: {calcularPercentualMensal(formData.terco_ferias, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(calcularValorMensal(formData.terco_ferias))})</span>
            </div>
          </div>

          {/* 13º Salário */}
          <div className="form-group">
            <label className="form-label-small">
              13º Salário
              {camposPreenchidosAuto.has('decimoterceiro') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>(Diário: {calcularPercentualDiario(formData.decimoterceiro, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(formData.decimoterceiro || '0')})</span>
              <span>(Mensal: {calcularPercentualMensal(formData.decimoterceiro, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(calcularValorMensal(formData.decimoterceiro))})</span>
            </div>
          </div>

          {/* FGTS */}
          <div className="form-group">
            <label className="form-label-small">
              FGTS
              {camposPreenchidosAuto.has('fgts') && (
                <span
                  title="Valor preenchido automaticamente - pode ser editado"
                  style={{
                    marginLeft: '6px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    cursor: 'help'
                  }}
                >
                  <i className="fas fa-magic"></i>
                </span>
              )}
            </label>
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
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>(Diário: {calcularPercentualDiarioFGTS(formData.fgts, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(formData.fgts || '0')})</span>
              <span>(Mensal: {calcularPercentualFGTS(formData.fgts, salarioBase).toFixed(2)}% | R$ {formatarValorParaInput(calcularValorMensal(formData.fgts))})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Custos */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
        <h4 className="form-section-title" style={{ 
          marginBottom: '16px', 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-calculator" style={{ color: '#8b5cf6' }}></i>
          Custos
        </h4>

        <div className="form-row-vigencia">
          <div className="form-group">
            <label className="form-label-small">Custo Total Mensal</label>
            <input
              type="text"
              className="form-input-small"
              value={formData.custo_total_mensal || '0'}
              readOnly
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
              placeholder="0,00"
              disabled={submitting}
              title="Custo total mensal calculado automaticamente"
            />
          </div>

          <div className="form-group">
            <label className="form-label-small">Custo Diário Total</label>
            <input
              type="text"
              className="form-input-small"
              value={formData.custo_diario_total || '0'}
              readOnly
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
              placeholder="0,00"
              disabled={submitting}
              title="Soma de todos os custos diários: Salário Base Diário + Férias + 1/3 Férias + 13º Salário + FGTS + Vale Transporte + Vale Refeição + Ajuda de Custo"
            />
          </div>

          <div className="form-group">
            <label className="form-label-small">Custo Hora</label>
            <input
              type="text"
              className="form-input-small"
              value={formData.custo_hora || '0'}
              readOnly
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
              placeholder="0,00"
              disabled={submitting}
              title="Custo por hora calculado automaticamente"
            />
          </div>
        </div>
      </div>

      {/* Seção de Observações */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
        <h4 className="form-section-title" style={{ 
          marginBottom: '16px', 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-sticky-note" style={{ color: '#6b7280' }}></i>
          Observações
        </h4>

        <div style={{ width: '100%' }}>
          <div className="form-group form-group-full-width" style={{ width: '100%' }}>
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
            <textarea
              value={formData.descricao || ''}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição opcional..."
              disabled={submitting}
              className={`form-input ${formErrors.descricao ? 'error' : ''}`}
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                border: formErrors.descricao ? '1px solid #ef4444' : '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '120px'
              }}
            />
            {formErrors.descricao && (
              <span className="error-message">{formErrors.descricao}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default VigenciaFormFields;
