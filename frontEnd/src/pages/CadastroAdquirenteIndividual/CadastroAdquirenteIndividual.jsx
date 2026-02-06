import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import AdquirenteForm from '../../components/adquirentes/AdquirenteForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import './CadastroAdquirenteIndividual.css';

const API_BASE_URL = '/api';

const CadastroAdquirenteIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter adquirenteId da query string
  const adquirenteId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [adquirente, setAdquirente] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar adquirente para edição
  const loadAdquirente = useCallback(async () => {
    if (!adquirenteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/adquirentes/${adquirenteId}`, {
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
        const adquirenteData = result.data;
        setAdquirente(adquirenteData);
        setFormData({
          id: adquirenteData.id || null,
          nome: adquirenteData.nome || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar adquirente');
      }
    } catch (error) {
      console.error('Erro ao carregar adquirente:', error);
      showToast('error', 'Erro ao carregar adquirente. Tente novamente.');
      navigate('/cadastro/adquirentes');
    } finally {
      setLoading(false);
    }
  }, [adquirenteId, showToast, navigate]);

  // Salvar adquirente
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

      const url = adquirenteId 
        ? `${API_BASE_URL}/adquirentes/${adquirenteId}`
        : `${API_BASE_URL}/adquirentes`;
      
      const method = adquirenteId ? 'PUT' : 'POST';
      
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
        // Atualizar estado local sem recarregar a página
        if (result.data) {
          setAdquirente(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!adquirenteId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/adquirente?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          adquirenteId 
            ? 'Adquirente atualizado com sucesso!'
            : 'Adquirente criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar adquirente';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar adquirente:', error);
      const errorMsg = error.message || 'Erro ao salvar adquirente. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar adquirente quando houver ID
  useEffect(() => {
    loadAdquirente();
  }, [loadAdquirente]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando adquirente..." />
            </CardContainer>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="cadastro-adquirente-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-adquirente-page-header">
                <div className="cadastro-adquirente-header-content">
                  <div className="cadastro-adquirente-header-left">
                    <div className="cadastro-adquirente-header-icon">
                      <i className="fas fa-credit-card" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-adquirente-page-title">
                        {adquirenteId ? (formData.nome || adquirente?.nome || 'Editar Adquirente') : 'Novo Adquirente'}
                      </h1>
                      <p className="cadastro-adquirente-page-subtitle">
                        {adquirenteId 
                          ? 'Edite as informações do adquirente'
                          : 'Preencha os dados para cadastrar um novo adquirente'
                        }
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-adquirente-back-btn"
                      onClick={() => navigate(-1)}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="adquirente-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <div className="cadastro-adquirente-form-section">
                <form id="adquirente-form" onSubmit={handleSubmit}>
                  <AdquirenteForm
                    formData={formData}
                    setFormData={setFormData}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    submitting={submitting}
                  />
                </form>
              </div>
            </CardContainer>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default CadastroAdquirenteIndividual;

