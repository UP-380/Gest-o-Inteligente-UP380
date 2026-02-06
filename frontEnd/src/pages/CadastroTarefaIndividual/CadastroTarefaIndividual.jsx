import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import TarefaForm from '../../components/tarefas/TarefaForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import './CadastroTarefaIndividual.css';

const API_BASE_URL = '/api';

const CadastroTarefaIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();

  // Obter tarefaId da query string
  const tarefaId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    clickup_id: '',
    descricao: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar tarefa para edição
  const loadTarefa = useCallback(async () => {
    if (!tarefaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tarefa/${tarefaId}`, {
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
        const tarefaData = result.data;
        setTarefa(tarefaData);
        setFormData({
          id: tarefaData.id || null,
          nome: tarefaData.nome || '',
          clickup_id: tarefaData.clickup_id || '',
          descricao: tarefaData.descricao || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar tarefa');
      }
    } catch (error) {
      console.error('Erro ao carregar tarefa:', error);
      showToast('error', 'Erro ao carregar tarefa. Tente novamente.');
      navigate('/cadastro/tarefas');
    } finally {
      setLoading(false);
    }
  }, [tarefaId, showToast, navigate]);

  // Salvar tarefa
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
      // Limpar descricao HTML vazia do Quill (<p><br></p> ou <p></p>)
      let descricaoValue = formData.descricao;
      if (descricaoValue) {
        const cleaned = descricaoValue.trim();
        if (cleaned === '' || cleaned === '<p><br></p>' || cleaned === '<p></p>') {
          descricaoValue = null;
        }
      }

      const payload = {
        nome: nomeValue,
        clickup_id: formData.clickup_id ? String(formData.clickup_id).trim() : null,
        descricao: descricaoValue
      };

      const url = tarefaId 
        ? `${API_BASE_URL}/tarefa/${tarefaId}`
        : `${API_BASE_URL}/tarefa`;
      
      const method = tarefaId ? 'PUT' : 'POST';
      
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
          setTarefa(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome,
            clickup_id: result.data.clickup_id || prev.clickup_id || '',
            descricao: result.data.descricao || prev.descricao || ''
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!tarefaId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/tarefa?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          tarefaId 
            ? 'Tarefa atualizada com sucesso!'
            : 'Tarefa criada com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar tarefa';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      const errorMsg = error.message || 'Erro ao salvar tarefa. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar tarefa quando houver ID
  useEffect(() => {
    loadTarefa();
  }, [loadTarefa]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando tarefa..." />
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
          <div className="cadastro-tarefa-individual-container">
            <CardContainer>
              {/* Header da Página */}
              <div className="cadastro-tarefa-page-header">
                <div className="cadastro-tarefa-header-content">
                  <div className="cadastro-tarefa-header-left">
                    <div className="cadastro-tarefa-header-icon">
                      <i className="fas fa-tasks" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-tarefa-page-title">
                        {tarefaId ? (formData.nome || tarefa?.nome || 'Editar Tarefa') : 'Nova Tarefa'}
                      </h1>
                      <p className="cadastro-tarefa-page-subtitle">
                        {tarefaId 
                          ? 'Edite as informações da tarefa'
                          : 'Preencha os dados para cadastrar uma nova tarefa'
                        }
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-tarefa-back-btn"
                      onClick={() => navigate(-1)}
                      disabled={submitting}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="tarefa-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <div className="cadastro-tarefa-form-section">
                <form id="tarefa-form" onSubmit={handleSubmit}>
                  <TarefaForm
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

export default CadastroTarefaIndividual;

