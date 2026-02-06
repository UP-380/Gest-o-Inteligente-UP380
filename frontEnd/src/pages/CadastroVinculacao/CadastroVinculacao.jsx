import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import VinculacaoForm from '../../components/vinculacoes/VinculacaoForm';
import { useToast } from '../../hooks/useToast';
import './CadastroVinculacao.css';

const API_BASE_URL = '/api';

const CadastroVinculacao = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter vinculadoId da query string
  const vinculadoId = searchParams.get('id');
  const isEditing = !!vinculadoId;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vinculadoData, setVinculadoData] = useState(null);

  // Carregar dados do vinculado para edição
  useEffect(() => {
    if (isEditing && vinculadoId) {
      loadVinculadoData();
    }
  }, [isEditing, vinculadoId]);

  const loadVinculadoData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
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
        setVinculadoData(result.data);
      } else {
        throw new Error(result.error || 'Erro ao carregar vinculação');
      }
    } catch (error) {
      console.error('Erro ao carregar vinculação:', error);
      showToast('error', 'Erro ao carregar vinculação. Tente novamente.');
      navigate('/cadastro/vinculacoes');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/cadastro/vinculacoes');
  };

  if (loading) {
    return (
      <Layout>
        <div className="cadastro-vinculacao-page">
          <CardContainer>
            <LoadingState message="Carregando vinculação..." />
          </CardContainer>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="cadastro-vinculacao-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-vinculacao-page-header">
                <div className="cadastro-vinculacao-header-content">
                  <div className="cadastro-vinculacao-header-left">
                    <div className="cadastro-vinculacao-header-icon">
                      <i className="fas fa-link" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-vinculacao-page-title">
                        {isEditing ? 'Editar Vinculação' : 'Nova Vinculação'}
                      </h1>
                      <p className="cadastro-vinculacao-page-subtitle">
                        {isEditing 
                          ? 'Edite os relacionamentos entre Tipo de Tarefa, Tarefas, Subtarefas, Produtos e Clientes'
                          : 'Crie relacionamentos entre Tipo de Tarefa, Tarefas, Subtarefas, Produtos e Clientes'
                        }
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-vinculacao-back-btn"
                      onClick={handleCancel}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                  </div>
                </div>
              </div>

              <VinculacaoForm
                vinculadoData={vinculadoData}
                isEditing={isEditing}
                onSubmit={async (data) => {
                  setSubmitting(true);
                  try {
                    if (isEditing) {
                      // Atualizar vinculado existente
                      const response = await fetch(`${API_BASE_URL}/vinculados/${vinculadoId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify(data),
                      });

                      if (response.status === 401) {
                        window.location.href = '/login';
                        return;
                      }

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Erro ao atualizar vinculação');
                      }

                      const resultUpdate = await response.json();
                      const messageUpdate = resultUpdate.message || 'Vinculação atualizada com sucesso!';
                      showToast('success', messageUpdate);
                    } else {
                      // Criar novos vinculados (ou atualizar se já existirem)
                      const response = await fetch(`${API_BASE_URL}/vinculados/multiplos`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({ vinculados: data }),
                      });

                      if (response.status === 401) {
                        window.location.href = '/login';
                        return;
                      }

                      const result = await response.json();
                      
                      // Tratar resposta: sucesso (200 ou 201) ou erro (409, 500, etc)
                      if (response.ok) {
                        // Sucesso: pode ser criação nova ou atualização (duplicatas mantidas)
                        const message = result.message || 'Vinculação salva com sucesso!';
                        const toastType = result.count > 0 ? 'success' : 'info';
                        showToast(toastType, message);
                      } else {
                        // Erro real (não duplicata)
                        throw new Error(result.error || 'Erro ao salvar vinculação');
                      }
                    }

                    // Não navegar - permanecer na página para continuar editando
                  } catch (error) {
                    console.error('Erro ao salvar vinculação:', error);
                    showToast('error', error.message || 'Erro ao salvar vinculação. Tente novamente.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                submitting={submitting}
                loading={loading}
              />
            </CardContainer>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default CadastroVinculacao;

