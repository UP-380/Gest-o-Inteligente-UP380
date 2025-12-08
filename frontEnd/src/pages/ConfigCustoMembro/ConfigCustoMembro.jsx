import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import CardContainer from '../../components/common/CardContainer';
import { useToast } from '../../hooks/useToast';
import './ConfigCustoMembro.css';

const API_BASE_URL = '/api';

const ConfigCustoMembro = () => {
  const showToast = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Carregar configurações
  const carregarConfigs = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/config-custo-colaborador`;

      const response = await fetch(url, {
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
        throw new Error(`Erro ao carregar configurações: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setConfigs(result.data || []);
      } else {
        throw new Error(result.error || 'Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      showToast('error', 'Erro ao carregar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarConfigs();
  }, []);

  // Abrir formulário para criar novo
  const abrirFormNovo = () => {
    setEditingId(null);
    // Inicializar com valores vazios para todos os campos
    const initialData = {};
    campos.forEach(campo => {
      initialData[campo.key] = campo.type === 'number' ? '' : '';
    });
    setFormData(initialData);
    setFormErrors({});
    setShowForm(true);
  };

  // Abrir formulário para editar
  const abrirFormEditar = (item) => {
    setEditingId(item.id);
    // Criar objeto com todos os campos do item, exceto id, created_at, updated_at
    const { id, created_at, updated_at, ...rest } = item;
    // Formatar data de vigência para o input
    const formData = { ...rest };
    if (formData.vigencia) {
      // Converter data ISO para formato YYYY-MM-DD (formato do input type="date")
      let dateOnly = formData.vigencia;
      if (dateOnly.includes('T')) {
        dateOnly = dateOnly.split('T')[0];
      }
      formData.vigencia = dateOnly;
    }
    // Formatar valores numéricos para exibição
    campos.forEach(campo => {
      if (campo.key !== 'vigencia') {
        if (formData[campo.key] !== null && formData[campo.key] !== undefined && formData[campo.key] !== '') {
          const valor = parseFloat(formData[campo.key]);
          if (!isNaN(valor)) {
            // Para números inteiros (dias_uteis), não adicionar casas decimais
            if (campo.type === 'number') {
              formData[campo.key] = Math.round(valor).toString();
            } else {
              // Exibir com 2 casas decimais (porcentagem ou valor monetário)
              formData[campo.key] = valor.toFixed(2).replace('.', ',');
            }
          } else {
            formData[campo.key] = '';
          }
        } else {
          // Se for null, undefined ou vazio, inicializar como string vazia
          formData[campo.key] = '';
        }
      }
    });
    setFormData(formData);
    setFormErrors({});
    setShowForm(true);
  };

  // Fechar formulário
  const fecharForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({});
    setFormErrors({});
  };

  // Salvar (criar ou atualizar)
  const handleSalvar = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    // Validações
    const errors = {};
    if (!formData.vigencia) {
      errors.vigencia = 'Vigência é obrigatória';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const url = editingId
        ? `${API_BASE_URL}/config-custo-colaborador/${editingId}`
        : `${API_BASE_URL}/config-custo-colaborador`;

      const method = editingId ? 'PUT' : 'POST';

      // Preparar dados para envio (converter porcentagens para números)
      const dadosParaEnvio = { ...formData };
      const novosErros = {};
      
      campos.forEach(campo => {
        if (campo.key !== 'vigencia') {
          // Converter vírgula para ponto e validar
          let valorLimpo = '';
          const valorOriginal = dadosParaEnvio[campo.key];
          
          // Verificar se o valor existe e não é vazio
          if (valorOriginal !== null && valorOriginal !== undefined && valorOriginal !== '') {
            valorLimpo = String(valorOriginal).replace(',', '.');
          }
          
          // Se o valor estiver vazio, definir como null
          if (valorLimpo === '' || valorLimpo === null || valorLimpo === undefined) {
            dadosParaEnvio[campo.key] = null;
          } else {
            const valorNumerico = parseFloat(valorLimpo);
            if (isNaN(valorNumerico) || valorNumerico < 0) {
              // Validação diferente para porcentagem vs valor monetário vs número
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
              // Validação específica para porcentagens
              if (campo.type === 'percent' && valorNumerico > 100) {
                novosErros[campo.key] = 'Porcentagem deve estar entre 0 e 100';
              } else if (campo.type === 'number') {
                // Para números inteiros, arredondar e garantir que seja inteiro
                const valorInteiro = Math.round(valorNumerico);
                if (valorInteiro < 0) {
                  novosErros[campo.key] = 'Valor deve ser maior ou igual a zero';
                } else {
                  // Garantir que o valor seja enviado como número, mesmo se for 0
                  dadosParaEnvio[campo.key] = valorInteiro;
                }
              } else {
                dadosParaEnvio[campo.key] = valorNumerico;
              }
            }
          }
        }
      });
      
      // Se houver erros de validação, não enviar
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
        showToast('success', editingId ? 'Configuração atualizada com sucesso!' : 'Configuração criada com sucesso!');
        fecharForm();
        carregarConfigs();
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showToast('error', 'Erro ao salvar configuração. Tente novamente.');
      setFormErrors({ geral: 'Erro ao salvar configuração. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de confirmação de exclusão
  const abrirModalExcluir = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  // Fechar modal de exclusão
  const fecharModalExcluir = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  // Confirmar exclusão
  const confirmarExclusao = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/config-custo-colaborador/${itemToDelete.id}`, {
        method: 'DELETE',
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

      const result = await response.json();

      if (!response.ok) {
        showToast('error', result.error || 'Erro ao excluir configuração');
        return;
      }

      if (result.success) {
        showToast('success', 'Configuração excluída com sucesso!');
        fecharModalExcluir();
        carregarConfigs();
      }
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      showToast('error', 'Erro ao excluir configuração. Tente novamente.');
    }
  };

  // Campos da tabela config_custo_membro (exceto id, created_at, updated_at que são automáticos)
  // IMPORTANTE: Estes são PARÂMETROS DE CÁLCULO (porcentagens), não valores absolutos
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
    }
  ];

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="form-header">
            <h2 className="form-title">Configuração de Custo Colaborador</h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280', 
              marginTop: '8px',
              maxWidth: '800px',
              lineHeight: '1.6'
            }}>
            </p>
          </div>

          {/* Botão novo */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
            <ButtonPrimary onClick={abrirFormNovo}>
              <i className="fas fa-plus"></i> Nova Configuração
            </ButtonPrimary>
          </div>

          {/* Tabela de configurações */}
          <CardContainer>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#0e3b6f' }}></i>
                <p style={{ marginTop: '1rem' }}>Carregando configurações...</p>
              </div>
            ) : configs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <i className="fas fa-inbox" style={{ fontSize: '2rem', color: '#9ca3af' }}></i>
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                  Nenhuma configuração cadastrada.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      {campos.map((campo) => (
                        <th
                          key={campo.key}
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#374151',
                            fontSize: '0.875rem'
                          }}
                        >
                          {campo.label}
                        </th>
                      ))}
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((item) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {campos.map((campo) => (
                          <td
                            key={campo.key}
                            style={{
                              padding: '0.75rem',
                              color: '#6b7280',
                              fontSize: '0.875rem'
                            }}
                          >
                            {campo.type === 'date' && item[campo.key]
                              ? (() => {
                                  // Formatar data usando a mesma lógica do input
                                  const dateStr = item[campo.key];
                                  if (!dateStr) return '-';
                                  // Extrair apenas a parte YYYY-MM-DD da string ISO (mesma lógica do input)
                                  let dateOnly = dateStr;
                                  if (typeof dateStr === 'string' && dateStr.includes('T')) {
                                    dateOnly = dateStr.split('T')[0];
                                  }
                                  // Se está no formato YYYY-MM-DD, formatar diretamente para DD/MM/YYYY
                                  if (dateOnly.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const [ano, mes, dia] = dateOnly.split('-');
                                    return `${dia}/${mes}/${ano}`;
                                  }
                                  // Fallback: tentar parsear como Date
                                  const date = new Date(dateStr);
                                  if (isNaN(date.getTime())) return '-';
                                  return date.toISOString().split('T')[0].split('-').reverse().join('/');
                                })()
                              : campo.type === 'number' && (item[campo.key] !== null && item[campo.key] !== undefined)
                              ? Math.round(parseFloat(item[campo.key])).toString()
                              : campo.type === 'percent' && (item[campo.key] !== null && item[campo.key] !== undefined)
                              ? `${parseFloat(item[campo.key]).toFixed(2).replace('.', ',')}%`
                              : campo.type === 'currency' && (item[campo.key] !== null && item[campo.key] !== undefined)
                              ? `R$ ${parseFloat(item[campo.key]).toFixed(2).replace('.', ',')}`
                              : item[campo.key] !== null && item[campo.key] !== undefined
                              ? String(item[campo.key])
                              : '-'}
                          </td>
                        ))}
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              className="btn-icon btn-edit edit-anim"
                              onClick={() => abrirFormEditar(item)}
                              title="Editar"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 512 512"
                                className="edit-anim-icon"
                              >
                                <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                              </svg>
                            </button>
                            <button
                              className="btn-icon btn-delete bin-button"
                              onClick={() => abrirModalExcluir(item)}
                              title="Deletar"
                            >
                              <svg
                                className="bin-top"
                                viewBox="0 0 39 7"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <line y1="5" x2="39" y2="5" stroke="currentColor" strokeWidth="7"></line>
                                <line
                                  x1="12"
                                  y1="1.5"
                                  x2="26.0357"
                                  y2="1.5"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></line>
                              </svg>
                              <svg
                                className="bin-bottom"
                                viewBox="0 0 33 39"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <mask id="path-1-inside-1_8_19_custo" fill="white">
                                  <path
                                    d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z"
                                  ></path>
                                </mask>
                                <path
                                  d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z"
                                  fill="currentColor"
                                  mask="url(#path-1-inside-1_8_19_custo)"
                                ></path>
                                <path d="M12 6L12 29" stroke="currentColor" strokeWidth="4"></path>
                                <path d="M21 6V29" stroke="currentColor" strokeWidth="4"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContainer>

          {/* Modal de Formulário */}
          {showForm && (
            <div className="modal-overlay" onClick={fecharForm}>
              <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '16px' }}>
                    {editingId ? 'Editar Configuração de Custo Colaborador' : 'Nova Configuração de Custo Colaborador'}
                  </h3>
                  <button className="btn-icon" onClick={fecharForm}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleSalvar}>
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
                          <input
                            type="date"
                            lang="pt-BR"
                            className={`form-input-small ${formErrors.vigencia ? 'error' : ''}`}
                            value={formData.vigencia || ''}
                            onChange={(e) => {
                              setFormData({ ...formData, vigencia: e.target.value });
                              if (formErrors.vigencia) {
                                setFormErrors({ ...formErrors, vigencia: '' });
                              }
                            }}
                            disabled={submitting}
                            required
                            style={{
                              colorScheme: 'light'
                            }}
                          />
                          {formErrors.vigencia && (
                            <span className="error-message">{formErrors.vigencia}</span>
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
                        <br />• Vale Transporte e Vale Refeição: valores em R$ por dia (ex: 10,50 para R$ 10,50 por dia)
                      </p>
                      
                      <div className="form-row-vigencia">
                        {campos.filter(c => c.key !== 'vigencia').map((campo) => (
                          <div key={campo.key} className="form-group">
                            <label className="form-label-small" title={campo.description}>
                              {campo.label}
                              {campo.required && <span className="required">*</span>}
                            </label>
                            <input
                              type={campo.type === 'number' ? 'number' : 'text'}
                              className={`form-input-small ${formErrors[campo.key] ? 'error' : ''}`}
                              value={formData[campo.key] || ''}
                              min={campo.type === 'number' ? '0' : undefined}
                              step={campo.type === 'number' ? '1' : undefined}
                              onChange={(e) => {
                                if (campo.type === 'number') {
                                  // Para números inteiros, permitir apenas números
                                  let valor = e.target.value.replace(/\D/g, '');
                                  // Se estiver vazio, permitir campo vazio
                                  if (valor === '') {
                                    setFormData({ ...formData, [campo.key]: '' });
                                  } else {
                                    // Garantir que seja um número inteiro positivo
                                    const num = parseInt(valor, 10);
                                    if (!isNaN(num) && num >= 0) {
                                      setFormData({ ...formData, [campo.key]: num.toString() });
                                    } else {
                                      setFormData({ ...formData, [campo.key]: '' });
                                    }
                                  }
                                } else {
                                  // Permitir apenas números e vírgula/ponto para decimais
                                  let valor = e.target.value.replace(/[^\d,.]/g, '').replace(',', '.');
                                  
                                  // Limitar a 2 casas decimais
                                  const partes = valor.split('.');
                                  if (partes.length > 1) {
                                    valor = partes[0] + '.' + partes[1].substring(0, 2);
                                  }
                                  
                                  // Permitir valores vazios ou números válidos
                                  if (valor === '' || valor === '.') {
                                    setFormData({ ...formData, [campo.key]: '' });
                                  } else {
                                    const num = parseFloat(valor);
                                    // Permitir digitação livre, validar apenas no submit
                                    if (!isNaN(num)) {
                                      // Converter ponto para vírgula para exibição
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
                              placeholder={campo.type === 'number' ? 'Ex: 22' : campo.type === 'currency' ? '0,00' : '0,00'}
                              disabled={submitting}
                              required={campo.required}
                              title={campo.description}
                            />
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

                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={fecharForm}
                        disabled={submitting}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Salvando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            {editingId ? 'Salvar Alterações' : 'Salvar Configuração'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Confirmação de Exclusão */}
          {showDeleteModal && itemToDelete && (
            <div className="modal-overlay" onClick={fecharModalExcluir}>
              <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Confirmar Exclusão</h3>
                  <button className="btn-icon" onClick={fecharModalExcluir}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <p>Tem certeza que deseja excluir esta configuração?</p>
                  <p style={{ marginTop: '0.5rem', fontWeight: '600', color: '#374151' }}>
                    ID: {itemToDelete.id}
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={fecharModalExcluir}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={confirmarExclusao}
                  >
                    <i className="fas fa-trash"></i> Excluir
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
};

export default ConfigCustoMembro;
