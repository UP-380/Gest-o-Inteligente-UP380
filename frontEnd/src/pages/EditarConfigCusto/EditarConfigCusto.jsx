import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import DatePicker from '../../components/vigencia/DatePicker';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import './EditarConfigCusto.css';

const API_BASE_URL = '/api';

// Campos da tabela config_custo_membro
const campos = [
  { 
    key: 'vigencia', 
    label: 'Vigência', 
    type: 'date', 
    required: true,
    description: 'Data a partir da qual esta configuração é válida'
  },
  { 
    key: 'dias_uteis', 
    label: 'Dias Úteis', 
    type: 'number', 
    required: false,
    description: 'Número de dias úteis no mês (ex: 22)'
  },
  { 
    key: 'fgts', 
    label: 'FGTS (%)', 
    type: 'percent', 
    required: false,
    description: 'Porcentagem do FGTS sobre o salário base (ex: 8 para 8%)'
  },
  { 
    key: 'ferias', 
    label: 'Férias (%)', 
    type: 'percent', 
    required: false,
    description: 'Porcentagem das férias (valor cheio) sobre o salário base (ex: 100 para 100%)'
  },
  { 
    key: 'terco_ferias', 
    label: '1/3 Férias (%)', 
    type: 'percent', 
    required: false,
    description: 'Porcentagem do 1/3 de férias sobre o salário base (ex: 33.33 para 33.33%)'
  },
  { 
    key: 'decimo_terceiro', 
    label: '13º Salário (%)', 
    type: 'percent', 
    required: false,
    description: 'Porcentagem do 13º salário sobre o salário base (ex: 100 para 100%)'
  },
  { 
    key: 'inss_patronal', 
    label: 'INSS Patronal (%)', 
    type: 'percent', 
    required: false,
    description: 'Porcentagem do INSS Patronal sobre o salário base (ex: 20 para 20%)'
  },
  { 
    key: 'vale_transporte', 
    label: 'Vale Transporte (R$/dia)', 
    type: 'currency', 
    required: false,
    description: 'Valor do vale transporte por dia (em reais)'
  },
  { 
    key: 'vale_alimentacao', 
    label: 'Vale Refeição (R$/dia)', 
    type: 'currency', 
    required: false,
    description: 'Valor do vale refeição por dia (em reais)'
  },
  { 
    key: 'ajuda_custo', 
    label: 'Ajuda de Custo (R$/dia)', 
    type: 'currency', 
    required: false,
    description: 'Valor da ajuda de custo por dia (em reais)'
  },
  { 
    key: 'horas_variaveis', 
    label: 'Horas Variáveis', 
    type: 'boolean', 
    required: false,
    description: 'Indica se as horas são variáveis (sim/não)'
  }
];

const EditarConfigCusto = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const formRef = useRef(null);

  // Obter configId da query string
  const configId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para tipos de contrato
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loadingTiposContrato, setLoadingTiposContrato] = useState(false);

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Estado inicial do formulário para detectar mudanças
  const [initialFormData, setInitialFormData] = useState(null);
  
  // Detectar se há mudanças não salvas
  const hasUnsavedChanges = initialFormData && JSON.stringify(formData) !== JSON.stringify(initialFormData);

  // Aviso ao sair com dados não salvos
  useUnsavedChanges(hasUnsavedChanges && !submitting);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    setLoadingTiposContrato(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar tipos de contrato: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data)) {
        setTiposContrato(result.data);
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de contrato');
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
      setTiposContrato([]);
      showToast('error', 'Erro ao carregar tipos de contrato. Tente recarregar a página.');
    } finally {
      setLoadingTiposContrato(false);
    }
  }, [showToast]);

  // Carregar configuração
  const loadConfig = useCallback(async () => {
    if (!configId) {
      // Se não tem configId, é uma nova configuração
      setLoading(false);
      setConfig(null);
      // Inicializar com valores vazios
      const initialData = {};
      campos.forEach(campo => {
        if (campo.type === 'boolean') {
          initialData[campo.key] = false;
        } else {
          initialData[campo.key] = '';
        }
      });
      initialData.tipo_contrato = ''; // Inicializar tipo_contrato
      setFormData(initialData);
      setInitialFormData(JSON.parse(JSON.stringify(initialData)));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/config-custo-colaborador/${configId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const configData = result.data;
        setConfig(configData);
        
        // Criar objeto com todos os campos do item, exceto id, created_at, updated_at
        const { id, created_at, updated_at, ...rest } = configData;
        const formData = { ...rest };
        
        // Compatibilidade: se inss_patronal não existir mas insspatronal existir, usar insspatronal
        if (formData.inss_patronal === null || formData.inss_patronal === undefined) {
          if (configData.insspatronal !== null && configData.insspatronal !== undefined) {
            formData.inss_patronal = configData.insspatronal;
          }
        }
        
        if (formData.vigencia) {
          // Converter data ISO para formato YYYY-MM-DD
          let dateOnly = formData.vigencia;
          if (dateOnly.includes('T')) {
            dateOnly = dateOnly.split('T')[0];
          }
          formData.vigencia = dateOnly;
        }
        
        // Tratar tipo_contrato (deve ser número inteiro ou string vazia)
        if (formData.tipo_contrato !== null && formData.tipo_contrato !== undefined) {
          formData.tipo_contrato = String(formData.tipo_contrato);
        } else {
          formData.tipo_contrato = '';
        }
        
        // Formatar valores numéricos para exibição
        campos.forEach(campo => {
          if (campo.key !== 'vigencia') {
            if (campo.type === 'boolean') {
              // Tratar campo boolean
              if (formData[campo.key] === null || formData[campo.key] === undefined) {
                formData[campo.key] = false;
              } else {
                // Garantir que seja boolean
                formData[campo.key] = formData[campo.key] === true || formData[campo.key] === 'true' || formData[campo.key] === 1;
              }
            } else if (formData[campo.key] !== null && formData[campo.key] !== undefined && formData[campo.key] !== '') {
              const valor = parseFloat(formData[campo.key]);
              if (!isNaN(valor)) {
                if (campo.type === 'number') {
                  formData[campo.key] = Math.round(valor).toString();
                } else if (campo.type === 'percent') {
                  formData[campo.key] = valor.toFixed(2).replace('.', ',') + '%';
                } else {
                  formData[campo.key] = valor.toFixed(2).replace('.', ',');
                }
              } else {
                formData[campo.key] = '';
              }
            } else {
              formData[campo.key] = '';
            }
          }
        });
        
        setFormData(formData);
        setInitialFormData(JSON.parse(JSON.stringify(formData)));
      } else {
        throw new Error(result.error || 'Configuração não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      showToast('error', error.message || 'Erro ao carregar configuração. Tente novamente.');
      navigate('/cadastro/custo-colaborador');
    } finally {
      setLoading(false);
    }
  }, [configId, navigate, showToast]);

  // Salvar configuração
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    // Validações
    const errors = {};
    if (!formData.vigencia) {
      errors.vigencia = 'Vigência é obrigatória';
    }
    if (!formData.tipo_contrato) {
      errors.tipo_contrato = 'Tipo de contrato é obrigatório';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const url = configId
        ? `${API_BASE_URL}/config-custo-colaborador/${configId}`
        : `${API_BASE_URL}/config-custo-colaborador`;

      const method = configId ? 'PUT' : 'POST';

      // Preparar dados para envio
      const dadosParaEnvio = { ...formData };
      const novosErros = {};
      
      // Processar tipo_contrato (deve ser número inteiro ou null)
      if (dadosParaEnvio.tipo_contrato !== null && dadosParaEnvio.tipo_contrato !== undefined && dadosParaEnvio.tipo_contrato !== '') {
        const tipoContratoNum = parseInt(dadosParaEnvio.tipo_contrato, 10);
        if (isNaN(tipoContratoNum)) {
          novosErros.tipo_contrato = 'Tipo de contrato inválido';
        } else {
          dadosParaEnvio.tipo_contrato = tipoContratoNum;
        }
      } else {
        dadosParaEnvio.tipo_contrato = null;
      }
      
      campos.forEach(campo => {
        if (campo.key !== 'vigencia') {
          // Tratar campos booleanos
          if (campo.type === 'boolean') {
            // Garantir que seja boolean (true/false)
            dadosParaEnvio[campo.key] = dadosParaEnvio[campo.key] === true || 
                                        dadosParaEnvio[campo.key] === 'true' || 
                                        dadosParaEnvio[campo.key] === 1;
            return; // Pular processamento para campos booleanos
          }
          
          let valorLimpo = '';
          const valorOriginal = dadosParaEnvio[campo.key];
          
          if (valorOriginal !== null && valorOriginal !== undefined && valorOriginal !== '') {
            if (campo.type === 'percent') {
              valorLimpo = String(valorOriginal).replace(/%/g, '').trim().replace(',', '.');
            } else {
              valorLimpo = String(valorOriginal).replace(',', '.');
            }
          }
          
          if (valorLimpo === '' || valorLimpo === null || valorLimpo === undefined) {
            dadosParaEnvio[campo.key] = null;
          } else {
            const valorNumerico = parseFloat(valorLimpo);
            if (isNaN(valorNumerico) || valorNumerico < 0) {
              if (campo.type === 'percent') {
                if (valorNumerico > 100) {
                  novosErros[campo.key] = 'Porcentagem deve estar entre 0 e 100';
                } else {
                  novosErros[campo.key] = 'Valor inválido';
                }
              } else {
                novosErros[campo.key] = 'Valor deve ser maior ou igual a zero';
              }
            } else {
              if (campo.type === 'percent' && valorNumerico > 100) {
                novosErros[campo.key] = 'Porcentagem deve estar entre 0 e 100';
              } else if (campo.type === 'number') {
                const valorInteiro = Math.round(valorNumerico);
                if (valorInteiro < 0) {
                  novosErros[campo.key] = 'Valor deve ser maior ou igual a zero';
                } else {
                  dadosParaEnvio[campo.key] = valorInteiro;
                }
              } else {
                dadosParaEnvio[campo.key] = valorNumerico;
              }
            }
          }
        }
      });
      
      if (Object.keys(novosErros).length > 0) {
        setFormErrors(novosErros);
        setSubmitting(false);
        return;
      }

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dadosParaEnvio)
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        if (result.error) {
          setFormErrors({ geral: result.error });
        } else {
          setFormErrors({ geral: 'Erro ao salvar configuração' });
        }
        return;
      }

      if (result.success) {
        showToast('success', configId ? 'Configuração atualizada com sucesso!' : 'Configuração criada com sucesso!');
        // Atualizar estado inicial para remover aviso de mudanças não salvas
        setInitialFormData(JSON.parse(JSON.stringify(formData)));
        navigate('/cadastro/custo-colaborador');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showToast('error', 'Erro ao salvar configuração. Tente novamente.');
      setFormErrors({ geral: 'Erro ao salvar configuração. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadTiposContrato();
  }, [loadTiposContrato]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return (
      <Layout>
        <LoadingState message="Carregando configuração..." />
      </Layout>
    );
  }

  const isEdit = !!configId;

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="editar-config-custo-container">
              {/* Header */}
              <div className="knowledge-page-header">
                <div className="knowledge-header-content">
                  <div className="knowledge-header-left">
                    <div className="knowledge-header-icon">
                      <div style={{ 
                        width: '64px', 
                        height: '64px', 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, #0e3b6f, #144577)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '28px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                      }}>
                        <i className="fas fa-calculator"></i>
                      </div>
                    </div>
                    <div>
                      <h2 className="knowledge-page-title">
                        {isEdit ? 'Editar Configuração de Custo Colaborador' : 'Nova Configuração de Custo Colaborador'}
                      </h2>
                      <p className="knowledge-page-subtitle">
                        {isEdit ? 'Edite os parâmetros de cálculo' : 'Configure os parâmetros que serão usados para calcular automaticamente os benefícios e encargos'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary knowledge-back-btn"
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          setShowConfirmModal(true);
                        } else {
                          navigate('/cadastro/custo-colaborador');
                        }
                      }}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (formRef.current) {
                          formRef.current.requestSubmit();
                        }
                      }}
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>
              {/* Formulário */}
              <form ref={formRef} onSubmit={handleSubmit}>
              {formErrors.geral && (
                <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', marginBottom: '1rem' }}>
                  {formErrors.geral}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <div className="form-row-vigencia">
                  <div className="form-group">
                    <label className="form-label-small">
                      Vigência <span className="required">*</span>
                    </label>
                    <DatePicker
                      value={formData.vigencia || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, vigencia: e.target.value });
                        if (formErrors.vigencia) {
                          setFormErrors({ ...formErrors, vigencia: '' });
                        }
                      }}
                      disabled={submitting}
                      error={!!formErrors.vigencia}
                    />
                    {formErrors.vigencia && (
                      <span className="error-message">{formErrors.vigencia}</span>
                    )}
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
                    {formErrors.tipo_contrato && (
                      <span className="error-message">{formErrors.tipo_contrato}</span>
                    )}
                    {!loadingTiposContrato && tiposContrato.length === 0 && (
                      <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                        Nenhum tipo de contrato encontrado. Verifique sua conexão.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção de Parâmetros de Cálculo */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <h4 className="form-section-title" style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Parâmetros de Cálculo
                </h4>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px', fontStyle: 'italic' }}>
                  Configure os parâmetros que serão usados para calcular automaticamente os benefícios e encargos nas vigências de colaboradores.
                  <br />• Porcentagens (FGTS, Férias, etc.): valores em % sobre o salário base (ex: 8 para 8%)
                  <br />• Vale Transporte, Vale Refeição e Ajuda de Custo: valores em R$ por dia (ex: 10,50 para R$ 10,50 por dia)
                </p>
                
                <div className="form-row-vigencia">
                  {campos.filter(c => c.key !== 'vigencia').map((campo) => (
                    <div key={campo.key} className="form-group">
                      <label className="form-label-small" title={campo.description}>
                        {campo.label}
                        {campo.required && <span className="required">*</span>}
                      </label>
                      {campo.type === 'boolean' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                            <input
                              type="checkbox"
                              checked={formData[campo.key] === true || formData[campo.key] === 'true' || formData[campo.key] === 1}
                              onChange={(e) => {
                                setFormData({ ...formData, [campo.key]: e.target.checked });
                                if (formErrors[campo.key]) {
                                  setFormErrors({ ...formErrors, [campo.key]: '' });
                                }
                              }}
                              disabled={submitting}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                accentColor: '#0e3b6f'
                              }}
                            />
                            <span>{formData[campo.key] === true || formData[campo.key] === 'true' || formData[campo.key] === 1 ? 'Sim' : 'Não'}</span>
                          </label>
                        </div>
                      ) : (
                        <input
                          type={campo.type === 'number' ? 'number' : 'text'}
                          className={`form-input-small ${formErrors[campo.key] ? 'error' : ''}`}
                          value={formData[campo.key] || ''}
                          min={campo.type === 'number' ? '0' : undefined}
                          step={campo.type === 'number' ? '1' : undefined}
                          onChange={(e) => {
                          if (campo.type === 'number') {
                            let valor = e.target.value.replace(/\D/g, '');
                            if (valor === '') {
                              setFormData({ ...formData, [campo.key]: '' });
                            } else {
                              const num = parseInt(valor, 10);
                              if (!isNaN(num) && num >= 0) {
                                setFormData({ ...formData, [campo.key]: num.toString() });
                              } else {
                                setFormData({ ...formData, [campo.key]: '' });
                              }
                            }
                          } else if (campo.type === 'percent') {
                            let valor = e.target.value.replace(/%/g, '').trim().replace(',', '.');
                            const partes = valor.split('.');
                            if (partes.length > 1) {
                              valor = partes[0] + '.' + partes[1].substring(0, 2);
                            }
                            if (valor === '' || valor === '.') {
                              setFormData({ ...formData, [campo.key]: '' });
                            } else {
                              const num = parseFloat(valor);
                              if (!isNaN(num)) {
                                const valorFormatado = valor.replace('.', ',') + '%';
                                setFormData({ ...formData, [campo.key]: valorFormatado });
                              } else if (valor === '') {
                                setFormData({ ...formData, [campo.key]: '' });
                              }
                            }
                          } else {
                            let valor = e.target.value.replace(/[^\d,.]/g, '').replace(',', '.');
                            const partes = valor.split('.');
                            if (partes.length > 1) {
                              valor = partes[0] + '.' + partes[1].substring(0, 2);
                            }
                            if (valor === '' || valor === '.') {
                              setFormData({ ...formData, [campo.key]: '' });
                            } else {
                              const num = parseFloat(valor);
                              if (!isNaN(num)) {
                                setFormData({ ...formData, [campo.key]: valor.replace('.', ',') });
                              } else if (valor === '') {
                                setFormData({ ...formData, [campo.key]: '' });
                              }
                            }
                          }
                          
                          if (formErrors[campo.key]) {
                            setFormErrors({ ...formErrors, [campo.key]: '' });
                          }
                        }}
                          placeholder={campo.type === 'number' ? 'Ex: 22' : campo.type === 'currency' ? '0,00' : campo.type === 'percent' ? '0,00%' : '0,00'}
                          disabled={submitting}
                          required={campo.required}
                          title={campo.description}
                        />
                      )}
                      {campo.description && (
                        <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                          {campo.description}
                        </span>
                      )}
                      {formErrors[campo.key] && (
                        <span className="error-message">{formErrors[campo.key]}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </form>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de confirmação para alterações não salvas */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          navigate('/cadastro/custo-colaborador');
        }}
        title="Alterações não salvas"
        message={
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '16px' }}></i>
            <p style={{ fontSize: '16px', color: '#374151', margin: '0 0 8px 0', fontWeight: '500' }}>
              Você tem alterações não salvas
            </p>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Tem certeza que deseja sair? Todas as alterações serão perdidas.
            </p>
          </div>
        }
        confirmText="Sair sem salvar"
        cancelText="Cancelar"
        confirmButtonClass="btn-primary"
      />
    </Layout>
  );
};

export default EditarConfigCusto;

