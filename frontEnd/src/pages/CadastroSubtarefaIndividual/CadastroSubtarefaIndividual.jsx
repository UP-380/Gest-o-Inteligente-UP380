import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import SubtarefaForm from '../../components/subtarefas/SubtarefaForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import { subtarefaAPI } from '../../services/api';
import './CadastroSubtarefaIndividual.css';

const CadastroSubtarefaIndividual = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter subtarefaId da query string
  const subtarefaId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [subtarefa, setSubtarefa] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    id: null,
    nome: '',
    descricao: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Carregar subtarefa para edição
  const loadSubtarefa = useCallback(async () => {
    if (!subtarefaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await subtarefaAPI.getById(subtarefaId);

      if (result.success && result.data) {
        const subtarefaData = result.data;
        setSubtarefa(subtarefaData);
        setFormData({
          id: subtarefaData.id || null,
          nome: subtarefaData.nome || '',
          descricao: subtarefaData.descricao || ''
        });
      } else {
        throw new Error(result.error || 'Erro ao carregar subtarefa');
      }
    } catch (error) {
      console.error('Erro ao carregar subtarefa:', error);
      showToast('error', 'Erro ao carregar subtarefa. Tente novamente.');
      navigate('/cadastro/subtarefas');
    } finally {
      setLoading(false);
    }
  }, [subtarefaId, showToast, navigate]);

  // Salvar subtarefa
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
        descricao: descricaoValue
      };

      let result;
      if (subtarefaId) {
        result = await subtarefaAPI.update(subtarefaId, payload);
      } else {
        result = await subtarefaAPI.create(payload);
      }

      if (result.success) {
        // Atualizar estado local sem recarregar a página
        if (result.data) {
          setSubtarefa(result.data);
          setFormData(prev => ({
            ...prev,
            id: result.data.id || prev.id,
            nome: result.data.nome || prev.nome,
            descricao: result.data.descricao || prev.descricao || ''
          }));
          
          // Se foi criação, atualizar URL sem recarregar
          if (!subtarefaId && result.data.id) {
            window.history.replaceState({}, '', `/cadastro/subtarefa?id=${result.data.id}`);
          }
        }
        
        showToast(
          'success',
          subtarefaId 
            ? 'Subtarefa atualizada com sucesso!'
            : 'Subtarefa criada com sucesso!'
        );
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar subtarefa';
        setFormErrors({ nome: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar subtarefa:', error);
      const errorMsg = error.message || 'Erro ao salvar subtarefa. Verifique sua conexão e tente novamente.';
      setFormErrors({ nome: errorMsg });
      showToast('error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Efeito para carregar subtarefa quando houver ID
  useEffect(() => {
    loadSubtarefa();
  }, [loadSubtarefa]);

  if (loading) {
    return (
      <Layout>
        <div className="container">
          <main className="main-content">
            <CardContainer>
              <LoadingState message="Carregando subtarefa..." />
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
                      <i className="fas fa-list-ul" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-tarefa-page-title">
                        {subtarefaId ? (formData.nome || subtarefa?.nome || 'Editar Subtarefa') : 'Nova Subtarefa'}
                      </h1>
                      <p className="cadastro-tarefa-page-subtitle">
                        {subtarefaId 
                          ? 'Edite as informações da subtarefa'
                          : 'Preencha os dados para cadastrar uma nova subtarefa'
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
                      form="subtarefa-form"
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
                <form id="subtarefa-form" onSubmit={handleSubmit}>
                  <SubtarefaForm
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

export default CadastroSubtarefaIndividual;

