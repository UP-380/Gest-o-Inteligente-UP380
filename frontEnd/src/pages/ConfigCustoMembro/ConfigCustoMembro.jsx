import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import CardContainer from '../../components/common/CardContainer';
import { useToast } from '../../hooks/useToast';
import './ConfigCustoMembro.css';

const API_BASE_URL = '/api';

const ConfigCustoMembro = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [tiposContrato, setTiposContrato] = useState([]);

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

  // Carregar tipos de contrato
  const carregarTiposContrato = async () => {
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

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && Array.isArray(result.data)) {
          setTiposContrato(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
    }
  };

  useEffect(() => {
    carregarConfigs();
    carregarTiposContrato();
  }, []);

  // Navegar para criar nova configuração
  const abrirFormNovo = () => {
    navigate('/cadastro/config-custo');
  };

  // Navegar para editar configuração
  const abrirFormEditar = (item) => {
    navigate(`/cadastro/config-custo?id=${item.id}`);
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

  // Função para obter nome do tipo de contrato
  const getTipoContratoNome = (tipoContratoId) => {
    if (!tipoContratoId) return '-';
    const tipo = tiposContrato.find(t => t.id === tipoContratoId || String(t.id) === String(tipoContratoId));
    return tipo ? tipo.nome : '-';
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
      key: 'tipo_contrato', 
      label: 'Tipo de Contrato', 
      type: 'tipo_contrato', 
      required: true,
      description: 'Tipo de contrato da configuração'
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
      key: 'horas_variaveis', 
      label: 'Horas Variáveis', 
      type: 'boolean', 
      required: false,
      description: 'Indica se as horas são variáveis (sim/não)'
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
                            {(() => {
                                // Buscar valor do campo (suporta múltiplos nomes para compatibilidade)
                                let valor = item[campo.key];
                                // Para inss_patronal, verificar também insspatronal (sem underscore)
                                if (campo.key === 'inss_patronal' && (valor === null || valor === undefined)) {
                                  valor = item.insspatronal;
                                }
                                
                                // Tratar tipo_contrato (exibir nome ao invés de ID)
                                if (campo.type === 'tipo_contrato') {
                                  return getTipoContratoNome(valor);
                                }
                                
                                // Tratar campos booleanos (exibir Sim/Não)
                                if (campo.type === 'boolean') {
                                  if (valor === null || valor === undefined) return '-';
                                  const isTrue = valor === true || valor === 'true' || valor === 1 || valor === '1';
                                  return isTrue ? 'Sim' : 'Não';
                                }
                                
                                if (campo.type === 'date' && valor) {
                                  // Formatar data usando a mesma lógica do input
                                  const dateStr = valor;
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
                                } else if (campo.type === 'number' && (valor !== null && valor !== undefined)) {
                                  return Math.round(parseFloat(valor)).toString();
                                } else if (campo.type === 'percent' && (valor !== null && valor !== undefined)) {
                                  return `${parseFloat(valor).toFixed(2).replace('.', ',')}%`;
                                } else if (campo.type === 'currency' && (valor !== null && valor !== undefined)) {
                                  return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
                                } else if (valor !== null && valor !== undefined) {
                                  return String(valor);
                                } else {
                                  return '-';
                                }
                              })()}
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
