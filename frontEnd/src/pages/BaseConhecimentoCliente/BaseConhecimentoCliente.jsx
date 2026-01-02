import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ContasBancariasContent from '../../components/clients/DetailContent/ContasBancariasContent';
import SistemasContent from '../../components/clients/DetailContent/SistemasContent';
import AdquirentesContent from '../../components/clients/DetailContent/AdquirentesContent';
import VinculacoesContent from '../../components/clients/DetailContent/VinculacoesContent';
import ClienteContasBancariasList from '../../components/clientes-conta-bancaria/ClienteContasBancariasList';
import ClienteSistemasList from '../../components/clientes-sistema/ClienteSistemasList';
import ClienteAdquirentesList from '../../components/clientes-adquirente/ClienteAdquirentesList';
import EditButton from '../../components/common/EditButton';
import Avatar from '../../components/user/Avatar';
import { DEFAULT_AVATAR } from '../../utils/avatars';
import { useToast } from '../../hooks/useToast';
import './BaseConhecimentoCliente.css';

const API_BASE_URL = '/api';

const BaseConhecimentoCliente = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [loading, setLoading] = useState(false);
  const [dadosCliente, setDadosCliente] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  
  // Estados dos modais
  const [showModalContas, setShowModalContas] = useState(false);
  const [showModalSistemas, setShowModalSistemas] = useState(false);
  const [showModalAdquirentes, setShowModalAdquirentes] = useState(false);

  // Função para copiar para a área de transferência
  const copyToClipboard = async (text, fieldId, e) => {
    if (e) e.stopPropagation();
    if (!text || text === '-') return;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
      showToast('error', 'Erro ao copiar para a área de transferência');
    }
  };

  // Componente para valores com botão de copiar (apenas para Dados Básicos)
  const ValueWithCopy = ({ value, fieldId, isPassword = false, isHidden = false }) => {
    const fieldKey = fieldId;
    const isCopied = copiedField === fieldKey;

    if (!value || value === '-') {
      return <span>-</span>;
    }

    if (isPassword) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ flex: 1 }}>
            {isHidden ? '••••••••' : value}
          </span>
          <button
            onClick={(e) => copyToClipboard(value, fieldKey, e)}
            className="copy-button"
            title={isCopied ? 'Copiado!' : 'Copiar senha'}
          >
            <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{value}</span>
        <button
          onClick={(e) => copyToClipboard(value, fieldKey, e)}
          className="copy-button"
          title={isCopied ? 'Copiado!' : 'Copiar'}
        >
          <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
        </button>
      </div>
    );
  };

  // Carregar dados do cliente
  const loadDadosCliente = useCallback(async () => {
    if (!clienteId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${clienteId}`, {
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

      if (result.success) {
        setDadosCliente(result.data);
      } else {
        throw new Error(result.error || 'Erro ao carregar dados do cliente');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados do cliente:', error);
      showToast('error', 'Erro ao carregar dados do cliente. Tente novamente.');
      setDadosCliente(null);
    } finally {
      setLoading(false);
    }
  }, [clienteId, showToast]);

  useEffect(() => {
    loadDadosCliente();
  }, [loadDadosCliente]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  if (!dadosCliente || !dadosCliente.cliente) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <i className="fas fa-exclamation-circle" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}></i>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Cliente não encontrado</h3>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>Não foi possível carregar os dados do cliente.</p>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  Voltar
                </button>
              </div>
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  const { cliente, sistemas = [], contasBancarias = [], adquirentes = [], vinculacoes = [] } = dadosCliente;

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="base-conhecimento-cliente-container">
              {/* Header */}
              <div className="knowledge-page-header">
                <div className="knowledge-header-content">
                  <div className="knowledge-header-left">
                    <div className="knowledge-header-icon">
                      <Avatar
                        avatarId={cliente.foto_perfil || DEFAULT_AVATAR}
                        nomeUsuario={cliente.fantasia || cliente.razao || cliente.nome_amigavel || cliente.nome || 'Cliente'}
                        size="large"
                      />
                    </div>
                    <div>
                      <h2 className="knowledge-page-title">
                        {cliente.fantasia || cliente.razao || cliente.nome_amigavel || 'Cliente'}
                      </h2>
                      <p className="knowledge-page-subtitle">
                        Base de Conhecimento - Informações Consolidadas
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary knowledge-back-btn"
                    onClick={() => navigate(-1)}
                  >
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                  </button>
                </div>
              </div>

              {/* Dados Básicos do Cliente */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                    <i className="fas fa-briefcase"></i>
                  </div>
                  <h2 className="section-title">Dados Básicos</h2>
                  <div style={{ marginLeft: 'auto' }}>
                    <EditButton
                      onClick={() => navigate(`/cadastro/cliente?id=${clienteId}`)}
                      title="Editar dados do cliente"
                    />
                  </div>
                </div>
                <div className="section-content">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Razão Social</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.razao} fieldId="cliente-razao" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Nome Fantasia</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.fantasia} fieldId="cliente-fantasia" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Nome Amigável</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.amigavel || cliente.nome_amigavel} fieldId="cliente-amigavel" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>CNPJ</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.cnpj || cliente.cpf_cnpj} fieldId="cliente-cnpj" />
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Status</label>
                      <div className="info-value">
                        <span className={`status-badge ${cliente.status === 'ativo' ? 'active' : 'inactive'}`}>
                          {cliente.status === 'ativo' ? 'Ativo' : cliente.status === 'inativo' ? 'Inativo' : cliente.status || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Cliente Kamino</label>
                      <div className="info-value">
                        <ValueWithCopy value={cliente.kaminoNome || cliente.nome_cli_kamino} fieldId="cliente-kamino" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sistemas */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                    <i className="fas fa-server"></i>
                  </div>
                  <h2 className="section-title">Acessos de Sistema</h2>
                  <span className="section-badge">{sistemas.length}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <EditButton
                      onClick={() => setShowModalSistemas(true)}
                      title="Gerenciar sistemas"
                    />
                  </div>
                </div>
                <div className="section-content">
                  <SistemasContent sistemas={sistemas} />
                </div>
              </div>

              {/* Contas Bancárias */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                    <i className="fas fa-university"></i>
                  </div>
                  <h2 className="section-title">Contas Bancárias</h2>
                  <span className="section-badge">{contasBancarias.length}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <EditButton
                      onClick={() => setShowModalContas(true)}
                      title="Gerenciar contas bancárias"
                    />
                  </div>
                </div>
                <div className="section-content">
                  <ContasBancariasContent contasBancarias={contasBancarias} />
                </div>
              </div>

              {/* Adquirentes */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
                    <i className="fas fa-credit-card"></i>
                  </div>
                  <h2 className="section-title">Adquirentes</h2>
                  <span className="section-badge">{adquirentes.length}</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <EditButton
                      onClick={() => setShowModalAdquirentes(true)}
                      title="Gerenciar adquirentes"
                    />
                  </div>
                </div>
                <div className="section-content">
                  <AdquirentesContent adquirentes={adquirentes} />
                </div>
              </div>

              {/* Fluxo da Operação */}
              <div className="knowledge-section">
                <div className="section-header">
                  <div className="section-icon" style={{ backgroundColor: '#6366f115', color: '#6366f1' }}>
                    <i className="fas fa-project-diagram"></i>
                  </div>
                  <h2 className="section-title">Fluxo da Operação</h2>
                  <span className="section-badge">{vinculacoes.length}</span>
                </div>
                <div className="section-content">
                  <VinculacoesContent vinculacoes={vinculacoes} />
                </div>
              </div>
            </div>
          </CardContainer>
        </main>
      </div>


      {/* Modal de Sistemas */}
      {showModalSistemas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalSistemas(false);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-server" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Sistemas - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalSistemas(false);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteSistemasList 
                clienteId={cliente?.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contas Bancárias */}
      {showModalContas && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalContas(false);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-university" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Contas Bancárias - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalContas(false);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteContasBancariasList 
                clienteId={cliente?.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adquirentes */}
      {showModalAdquirentes && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalAdquirentes(false);
          loadDadosCliente();
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-credit-card" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Adquirentes - {cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || 'Cliente'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowModalAdquirentes(false);
                  loadDadosCliente();
                }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ClienteAdquirentesList 
                clienteId={cliente?.id || clienteId} 
                clienteNome={cliente?.fantasia || cliente?.razao || cliente?.nome_amigavel || ''}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BaseConhecimentoCliente;

