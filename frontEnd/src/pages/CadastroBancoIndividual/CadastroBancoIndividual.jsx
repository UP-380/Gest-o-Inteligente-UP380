import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import BancoForm from '../../components/bancos/BancoForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import BankLogo from '../../components/bancos/BankLogo';
import { useToast } from '../../hooks/useToast';
import './CadastroBancoIndividual.css';

const API_BASE_URL = '/api';

const CadastroBancoIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter bancoId da query string
  const bancoId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [banco, setBanco] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    codigo: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar banco para edição
  const loadBanco = useCallback(async () => {
    if (!bancoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bancos/${bancoId}`, {
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
        const bancoData = result.data;
        setBanco(bancoData);
        setFormData({
          id: bancoData.id || null,
          nome: bancoData.nome || '',
          codigo: bancoData.codigo || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar banco');
      }
    } catch (error) {
      console.error('Erro ao carregar banco:', error);
      showToast('error', 'Erro ao carregar banco. Tente novamente.');
      navigate('/cadastro/bancos');
    } finally {
      setLoading(false);
    }
  }, [bancoId, showToast, navigate]);

  // Salvar banco
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
        nome: nomeValue,
        codigo: formData.codigo ? String(formData.codigo).trim() : null
      };

      const url = bancoId 
        ? `${API_BASE_URL}/bancos/${bancoId}`
        : `${API_BASE_URL}/bancos`;
      
      const method = bancoId ? 'PUT' : 'POST';
      
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
          setBanco(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome,
            codigo: result.data.codigo || prev.codigo
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!bancoId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/banco?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          bancoId 
            ? 'Banco atualizado com sucesso!'
            : 'Banco criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar banco';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
      const errorMsg = error.message || 'Erro ao salvar banco. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar banco quando houver ID
  useEffect(() => {
    loadBanco();
  }, [loadBanco]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando banco..." />
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
          <div className="cadastro-banco-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-banco-page-header">
                <div className="cadastro-banco-header-content">
                  <div className="cadastro-banco-header-left">
                    <div className="cadastro-banco-header-icon">
                      {bancoId && formData.nome ? (
                        <BankLogo 
                          codigo={formData.codigo} 
                          nome={formData.nome} 
                          size={64}
                        />
                      ) : (
                        <i className="fas fa-university" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                      )}
                    </div>
                    <div>
                      <h1 className="cadastro-banco-page-title">
                        {bancoId ? (formData.nome || banco?.nome || 'Editar Banco') : 'Novo Banco'}
                      </h1>
                      <p className="cadastro-banco-page-subtitle">
                        {bancoId 
                          ? 'Edite as informações do banco'
                          : 'Preencha os dados para cadastrar um novo banco'
                        }
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-banco-back-btn"
                      onClick={() => navigate(-1)}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="banco-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <div className="editar-cliente-form-section">
                <form id="banco-form" onSubmit={handleSubmit}>
                  <BancoForm
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

export default CadastroBancoIndividual;

