import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import TipoContratoForm from '../../components/tipo-contrato/TipoContratoForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import './CadastroTipoContrato.css';
import '../CadastroCliente/CadastroCliente.css';

const API_BASE_URL = '/api';

const CadastroTipoContrato = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter tipoContratoId da query string
  const tipoContratoId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [tipoContrato, setTipoContrato] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estado inicial do formulário para detectar mudanças
  const [initialFormData, setInitialFormData] = useState(null);
  
  // Detectar se há mudanças não salvas
  const hasUnsavedChanges = initialFormData && (
    formData.nome !== initialFormData.nome
  );

  // Aviso ao sair com dados não salvos
  useUnsavedChanges(hasUnsavedChanges && !submitting);

  // Carregar tipo de contrato para edição
  const loadTipoContrato = useCallback(async () => {
    if (!tipoContratoId) {
      setLoading(false);
      setInitialFormData({ nome: '' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro/${tipoContratoId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
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
        const tipoContratoData = result.data;
        setTipoContrato(tipoContratoData);
        const formDataInicial = {
          id: tipoContratoData.id || null,
          nome: tipoContratoData.nome || ''
        };
        setFormData(formDataInicial);
        setInitialFormData(formDataInicial);
      } else {
        throw new Error(result.error || 'Tipo de contrato não encontrado');
      }
    } catch (error) {
      console.error('Erro ao carregar tipo de contrato:', error);
      showToast('error', 'Erro ao carregar tipo de contrato. Tente novamente.');
      navigate('/cadastro/tipo-contratos');
    } finally {
      setLoading(false);
    }
  }, [tipoContratoId, navigate, showToast]);

  // Salvar tipo de contrato
  const handleSubmit = async (e) => {
    e.preventDefault();

    const nomeValue = formData.nome ? String(formData.nome).trim() : '';

    // Validar
    if (!nomeValue) {
      setFormErrors({ nome: 'Nome é obrigatório' });
      showToast('error', 'Nome é obrigatório');
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        nome: nomeValue
      };

      const url = tipoContratoId 
        ? `${API_BASE_URL}/tipo-contrato-membro/${tipoContratoId}`
        : `${API_BASE_URL}/tipo-contrato-membro`;
      
      const method = tipoContratoId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const errorMsg = text || `Erro no servidor. Status: ${response.status}`;
        showToast('error', errorMsg);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || result.message || `Erro HTTP ${response.status}`;
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        // Atualizar estado local
        if (result.data) {
          setTipoContrato(result.data);
          const formDataAtualizado = {
            id: result.data.id || formData.id,
            nome: result.data.nome || formData.nome
          };
          setFormData(formDataAtualizado);
          setInitialFormData(formDataAtualizado);
          
          // Se foi criação, atualizar URL sem recarregar
          if (!tipoContratoId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/tipo-contrato?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          tipoContratoId 
            ? 'Tipo de contrato atualizado com sucesso!'
            : 'Tipo de contrato criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tipo de contrato';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar tipo de contrato:', error);
      const errorMsg = error.message || 'Erro ao salvar tipo de contrato. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar tipo de contrato quando houver ID
  useEffect(() => {
    loadTipoContrato();
  }, [loadTipoContrato]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando tipo de contrato..." />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  const isEdit = !!tipoContratoId;

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="editar-cliente-container">
              {/* Header */}
              <div className="cadastro-cliente-header">
                <div className="cadastro-cliente-header-content">
                  <div className="cadastro-cliente-header-left">
                    <div className="cadastro-cliente-header-icon-container">
                      <div className="cadastro-cliente-header-icon">
                        <div style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '12px',
                          background: '#f0f9ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0e3b6f',
                          fontSize: '32px'
                        }}>
                          <i className="fas fa-file-contract"></i>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h2 className="cadastro-cliente-title">
                        {isEdit ? (formData.nome || tipoContrato?.nome || 'Editar Tipo de Contrato') : 'Novo Tipo de Contrato'}
                      </h2>
                      <p className="cadastro-cliente-subtitle">
                        {isEdit ? 'Edite as informações do tipo de contrato' : 'Preencha os dados para criar um novo tipo de contrato'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-cliente-back-btn"
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          if (window.confirm('Você tem alterações não salvas. Tem certeza que deseja sair?')) {
                            navigate('/cadastro/tipo-contratos');
                          }
                        } else {
                          navigate('/cadastro/tipo-contratos');
                        }
                      }}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="tipo-contrato-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <form id="tipo-contrato-form" onSubmit={handleSubmit}>
                {/* Seção de Dados Básicos */}
                <div className="editar-cliente-form-section">
                  <div className="section-header">
                    <div className="section-icon" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                      <i className="fas fa-file-contract"></i>
                    </div>
                    <h2 className="section-title">Dados Básicos</h2>
                  </div>
                  <div className="section-content">
                    <TipoContratoForm
                      formData={formData}
                      setFormData={setFormData}
                      formErrors={formErrors}
                      setFormErrors={setFormErrors}
                      submitting={submitting}
                    />
                  </div>
                </div>

                {formErrors.submit && (
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
                    {formErrors.submit}
                  </div>
                )}
              </form>
            </div>
          </CardContainer>
        </main>
      </div>
    </Layout>
  );
};

export default CadastroTipoContrato;






