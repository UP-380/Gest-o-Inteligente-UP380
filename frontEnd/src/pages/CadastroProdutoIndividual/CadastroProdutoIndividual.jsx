import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ProdutoForm from '../../components/produtos/ProdutoForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import './CadastroProdutoIndividual.css';

const API_BASE_URL = '/api';

const CadastroProdutoIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter produtoId da query string
  const produtoId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [produto, setProduto] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar produto para edição
  const loadProduto = useCallback(async () => {
    if (!produtoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/produtos/${produtoId}`, {
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
        const produtoData = result.data;
        setProduto(produtoData);
        setFormData({
          id: produtoData.id || null,
          nome: produtoData.nome || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar produto');
      }
    } catch (error) {
      console.error('Erro ao carregar produto:', error);
      showToast('error', 'Erro ao carregar produto. Tente novamente.');
      navigate('/cadastro/produtos');
    } finally {
      setLoading(false);
    }
  }, [produtoId, showToast, navigate]);

  // Salvar produto
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
      // Preparar payload - nome e clickup_id (obrigatório no banco)
      const payload = {
        nome: nomeValue,
        clickup_id: produto?.clickup_id || '' // Manter clickup_id existente ou vazio
      };

      const url = produtoId 
        ? `${API_BASE_URL}/produtos/${produtoId}`
        : `${API_BASE_URL}/produtos`;
      
      const method = produtoId ? 'PUT' : 'POST';
      
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
          setProduto(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!produtoId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/produto?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          produtoId 
            ? 'Produto atualizado com sucesso!'
            : 'Produto criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar produto';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      const errorMsg = error.message || 'Erro ao salvar produto. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar produto quando houver ID
  useEffect(() => {
    loadProduto();
  }, [loadProduto]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando produto..." />
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
          <div className="cadastro-produto-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-produto-page-header">
                <div className="cadastro-produto-header-content">
                  <div className="cadastro-produto-header-left">
                    <div className="cadastro-produto-header-icon">
                      <i className="fas fa-box" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-produto-page-title">
                        {produtoId ? (formData.nome || produto?.nome || 'Editar Produto') : 'Novo Produto'}
                      </h1>
                      <p className="cadastro-produto-page-subtitle">
                        {produtoId 
                          ? 'Edite as informações do produto'
                          : 'Preencha os dados para cadastrar um novo produto'
                        }
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-produto-back-btn"
                      onClick={() => navigate(-1)}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="produto-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <div className="cadastro-produto-form-section">
                <form id="produto-form" onSubmit={handleSubmit}>
                  <ProdutoForm
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

export default CadastroProdutoIndividual;

