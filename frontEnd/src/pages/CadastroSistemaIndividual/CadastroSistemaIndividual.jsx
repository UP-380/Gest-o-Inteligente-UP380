import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import SistemaForm from '../../components/sistemas/SistemaForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import './CadastroSistemaIndividual.css';

const API_BASE_URL = '/api';

const CadastroSistemaIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter sistemaId da query string
  const sistemaId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [sistema, setSistema] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar sistema para edição
  const loadSistema = useCallback(async () => {
    if (!sistemaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sistemas/${sistemaId}`, {
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
        const sistemaData = result.data;
        setSistema(sistemaData);
        setFormData({
          id: sistemaData.id || null,
          nome: sistemaData.nome || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar sistema');
      }
    } catch (error) {
      console.error('Erro ao carregar sistema:', error);
      showToast('error', 'Erro ao carregar sistema. Tente novamente.');
      navigate('/cadastro/sistemas');
    } finally {
      setLoading(false);
    }
  }, [sistemaId, showToast, navigate]);

  // Salvar sistema
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

      const url = sistemaId 
        ? `${API_BASE_URL}/sistemas/${sistemaId}`
        : `${API_BASE_URL}/sistemas`;
      
      const method = sistemaId ? 'PUT' : 'POST';
      
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
          setSistema(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!sistemaId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/sistema?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          sistemaId 
            ? 'Sistema atualizado com sucesso!'
            : 'Sistema criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar sistema';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar sistema:', error);
      const errorMsg = error.message || 'Erro ao salvar sistema. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar sistema quando houver ID
  useEffect(() => {
    loadSistema();
  }, [loadSistema]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando sistema..." />
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
          <div className="cadastro-sistema-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-sistema-page-header">
                <div className="cadastro-sistema-header-content">
                  <div className="cadastro-sistema-header-left">
                    <div className="cadastro-sistema-header-icon">
                      <i className="fas fa-server" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-sistema-page-title">
                        {sistemaId ? (formData.nome || sistema?.nome || 'Editar Sistema') : 'Novo Sistema'}
                      </h1>
                      <p className="cadastro-sistema-page-subtitle">
                        {sistemaId 
                          ? 'Edite as informações do sistema'
                          : 'Preencha os dados para cadastrar um novo sistema'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary cadastro-sistema-back-btn"
                    onClick={() => navigate(-1)}
                    disabled={submitting}
                  >
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                  </button>
                </div>
              </div>

              {/* Formulário */}
              <div className="cadastro-sistema-form-section">
                <form onSubmit={handleSubmit}>
                  <SistemaForm
                    formData={formData}
                    setFormData={setFormData}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    submitting={submitting}
                  />

                  {/* Botões de ação */}
                  <div className="cadastro-sistema-actions">
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <ButtonPrimary
                        type="submit"
                        disabled={submitting}
                        icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                      >
                        {submitting ? 'Salvando...' : 'Salvar'}
                      </ButtonPrimary>
                    </div>
                  </div>
                </form>
              </div>
            </CardContainer>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default CadastroSistemaIndividual;

