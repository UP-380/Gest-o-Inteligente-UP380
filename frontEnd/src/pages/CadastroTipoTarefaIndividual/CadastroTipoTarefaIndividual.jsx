import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import TipoTarefaForm from '../../components/tipo-tarefas/TipoTarefaForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import './CadastroTipoTarefaIndividual.css';

const API_BASE_URL = '/api';

const CadastroTipoTarefaIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter tipoTarefaId da query string
  const tipoTarefaId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [tipoTarefa, setTipoTarefa] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    clickup_id: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar tipo de tarefa para edição
  const loadTipoTarefa = useCallback(async () => {
    if (!tipoTarefaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-tarefa/${tipoTarefaId}`, {
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
        const tipoTarefaData = result.data;
        setTipoTarefa(tipoTarefaData);
        setFormData({
          id: tipoTarefaData.id || null,
          nome: tipoTarefaData.nome || tipoTarefaData.name || '',
          clickup_id: tipoTarefaData.clickup_id || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar tipo de tarefa');
      }
    } catch (error) {
      console.error('Erro ao carregar tipo de tarefa:', error);
      showToast('error', 'Erro ao carregar tipo de tarefa. Tente novamente.');
      navigate('/cadastro/tipo-tarefas');
    } finally {
      setLoading(false);
    }
  }, [tipoTarefaId, showToast, navigate]);

  // Salvar tipo de tarefa
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
        clickup_id: formData.clickup_id ? String(formData.clickup_id).trim() : null
      };

      const url = tipoTarefaId 
        ? `${API_BASE_URL}/tipo-tarefa/${tipoTarefaId}`
        : `${API_BASE_URL}/tipo-tarefa`;
      
      const method = tipoTarefaId ? 'PUT' : 'POST';
      
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
          setTipoTarefa(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || result.data.name || prev.nome,
            clickup_id: result.data.clickup_id || prev.clickup_id || ''
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!tipoTarefaId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/tipo-tarefa?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          tipoTarefaId 
            ? 'Tipo de tarefa atualizado com sucesso!'
            : 'Tipo de tarefa criado com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tipo de tarefa';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar tipo de tarefa:', error);
      const errorMsg = error.message || 'Erro ao salvar tipo de tarefa. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar tipo de tarefa quando houver ID
  useEffect(() => {
    loadTipoTarefa();
  }, [loadTipoTarefa]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando tipo de tarefa..." />
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
          <div className="cadastro-tipo-tarefa-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-tipo-tarefa-page-header">
                <div className="cadastro-tipo-tarefa-header-content">
                  <div className="cadastro-tipo-tarefa-header-left">
                    <div className="cadastro-tipo-tarefa-header-icon">
                      <i className="fas fa-list-alt" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-tipo-tarefa-page-title">
                        {tipoTarefaId ? (formData.nome || tipoTarefa?.name || tipoTarefa?.nome || 'Editar Tipo de Tarefa') : 'Novo Tipo de Tarefa'}
                      </h1>
                      <p className="cadastro-tipo-tarefa-page-subtitle">
                        {tipoTarefaId 
                          ? 'Edite as informações do tipo de tarefa'
                          : 'Preencha os dados para cadastrar um novo tipo de tarefa'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-secondary cadastro-tipo-tarefa-back-btn"
                    onClick={() => {
                      const fromPath = location.state?.from || '/cadastro/tipo-tarefas';
                      navigate(fromPath);
                    }}
                    disabled={submitting}
                  >
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                  </button>
                </div>
              </div>

              {/* Formulário */}
              <div className="cadastro-tipo-tarefa-form-section">
                <form onSubmit={handleSubmit}>
                  <TipoTarefaForm
                    formData={formData}
                    setFormData={setFormData}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    submitting={submitting}
                  />

                  {/* Botões de ação */}
                  <div className="cadastro-tipo-tarefa-actions">
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

export default CadastroTipoTarefaIndividual;

