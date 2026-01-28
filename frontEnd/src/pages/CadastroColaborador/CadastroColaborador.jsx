import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ColaboradorForm from '../../components/colaboradores/ColaboradorForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import Avatar from '../../components/user/Avatar';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { aplicarMascaraCpf } from '../../utils/vigenciaUtils';
import './CadastroColaborador.css';
import '../CadastroCliente/CadastroCliente.css';

const API_BASE_URL = '/api';

const CadastroColaborador = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  // Obter colaboradorId da query string
  const colaboradorId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [colaborador, setColaborador] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    foto_perfil: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estado para foto de perfil
  const [fotoPerfil, setFotoPerfil] = useState(null);

  // Estado para controlar se acabou de criar um colaborador (para mostrar opção de criar vigência)
  const [justCreated, setJustCreated] = useState(false);

  // Estado inicial do formulário para detectar mudanças
  const [initialFormData, setInitialFormData] = useState(null);
  
  // Detectar se há mudanças não salvas
  const hasUnsavedChanges = initialFormData && (
    formData.nome !== initialFormData.nome ||
    formData.cpf !== initialFormData.cpf ||
    formData.foto_perfil !== initialFormData.foto_perfil
  );

  // Aviso ao sair com dados não salvos
  useUnsavedChanges(hasUnsavedChanges && !submitting);


  // Carregar dados do colaborador
  const loadColaborador = useCallback(async () => {
    if (!colaboradorId) {
      // Se não tem colaboradorId, é um novo cadastro
      setLoading(false);
      setColaborador(null);
      setInitialFormData({ nome: '', cpf: '', foto_perfil: null });
      setJustCreated(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/colaboradores/${colaboradorId}`, {
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

      if (result.success && result.data) {
        const colaboradorData = result.data;
        setColaborador(colaboradorData);
        const formDataInicial = {
          nome: colaboradorData.nome || '',
          cpf: colaboradorData.cpf ? aplicarMascaraCpf(colaboradorData.cpf) : '',
          foto_perfil: colaboradorData.foto_perfil || null
        };
        setFormData(formDataInicial);
        setInitialFormData(formDataInicial);
        setFotoPerfil(colaboradorData.foto_perfil || null);
      } else {
        throw new Error(result.error || 'Colaborador não encontrado');
      }
    } catch (error) {
      console.error('Erro ao carregar colaborador:', error);
      showToast('error', error.message || 'Erro ao carregar colaborador. Tente novamente.');
      navigate('/cadastro/colaboradores');
    } finally {
      setLoading(false);
    }
  }, [colaboradorId, navigate, showToast]);

  // Salvar colaborador
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    const errors = {};
    if (!formData.nome || !formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        nome: formData.nome.trim(),
        cpf: formData.cpf ? formData.cpf.replace(/\D/g, '') : null
      };

      const url = colaboradorId 
        ? `${API_BASE_URL}/colaboradores/${colaboradorId}`
        : `${API_BASE_URL}/colaboradores`;
      
      const method = colaboradorId ? 'PUT' : 'POST';
      
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

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || result.details || `Erro HTTP ${response.status}`;
        setFormErrors({ submit: errorMsg });
        showToast('error', errorMsg);
        return;
      }

      if (result.success) {
        const wasNewColaborador = !colaboradorId;
        
        showToast(
          'success',
          colaboradorId 
            ? 'Colaborador atualizado com sucesso!'
            : 'Colaborador criado com sucesso!'
        );
        
        // Atualizar estado inicial para remover aviso de mudanças não salvas
        setInitialFormData({
          nome: formData.nome,
          cpf: formData.cpf,
          foto_perfil: formData.foto_perfil
        });
        
        // Se for criação, navegar para a página de edição e marcar como recém-criado
        if (wasNewColaborador && result.data && result.data.id) {
          setJustCreated(true);
          navigate(`/cadastro/colaborador?id=${result.data.id}`);
        } else {
          // Recarregar dados
          await loadColaborador();
          setJustCreated(false);
        }
      } else {
        const errorMsg = result.error || result.details || 'Erro ao salvar colaborador';
        setFormErrors({ submit: errorMsg });
        showToast('error', errorMsg);
      }
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      showToast('error', error.message || 'Erro ao salvar colaborador. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Efeitos
  useEffect(() => {
    loadColaborador();
  }, [loadColaborador]);

  // Resetar justCreated quando mudar de colaborador (não quando recarregar o mesmo)
  useEffect(() => {
    if (colaboradorId && !justCreated) {
      // Se mudou o colaboradorId e não acabou de criar, resetar
      setJustCreated(false);
    }
  }, [colaboradorId]);

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

  const isEdit = !!colaboradorId;

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
                        <Avatar
                          avatarId={fotoPerfil || formData.foto_perfil || colaborador?.foto_perfil}
                          nomeUsuario={formData.nome || colaborador?.nome || 'Colaborador'}
                          size="large"
                        />
                      </div>
                    </div>
                    <div>
                      <h2 className="cadastro-cliente-title">
                        {isEdit ? (formData.nome || colaborador?.nome || 'Editar Colaborador') : 'Novo Colaborador'}
                      </h2>
                      <p className="cadastro-cliente-subtitle">
                        {isEdit ? 'Edite as informações do colaborador' : 'Preencha os dados para criar um novo colaborador'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      className="btn-secondary cadastro-cliente-back-btn"
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          if (window.confirm('Você tem alterações não salvas. Tem certeza que deseja sair?')) {
                            navigate('/cadastro/colaboradores');
                          }
                        } else {
                          navigate('/cadastro/colaboradores');
                        }
                      }}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Voltar
                    </button>
                    <ButtonPrimary
                      type="submit"
                      form="colaborador-form"
                      disabled={submitting}
                      icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                    >
                      {submitting ? 'Salvando...' : (isEdit ? 'Salvar' : 'Salvar Colaborador')}
                    </ButtonPrimary>
                  </div>
                </div>
              </div>

              {/* Formulário */}
              <form id="colaborador-form" onSubmit={handleSubmit}>
                {/* Seção de Dados Básicos */}
                <div className="editar-cliente-form-section">
                  <div className="section-header">
                    <div className="section-icon" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                      <i className="fas fa-user"></i>
                    </div>
                    <h2 className="section-title">Dados Básicos</h2>
                  </div>
                  <div className="section-content">
                    <ColaboradorForm
                      formData={formData}
                      setFormData={setFormData}
                      formErrors={formErrors}
                      setFormErrors={setFormErrors}
                      submitting={submitting}
                      aplicarMascaraCpf={aplicarMascaraCpf}
                    />
                  </div>
                </div>

                {/* Card de sucesso após criar colaborador */}
                {justCreated && isEdit && (
                  <div style={{
                    marginTop: '24px',
                    padding: '20px',
                    backgroundColor: '#f0f9ff',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1e40af' }}>
                        <i className="fas fa-check-circle" style={{ marginRight: '8px', color: '#10b981' }}></i>
                        Colaborador criado com sucesso!
                      </h3>
                      <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                        Agora você pode criar a primeira vigência para este colaborador.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setJustCreated(false);
                          navigate(`/cadastro/colaborador/vigencias?colaboradorId=${colaboradorId}`);
                        }}
                        style={{
                          padding: '10px 20px',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <i className="fas fa-list"></i>
                        Ver Vigências
                      </button>
                      <ButtonPrimary
                        onClick={() => {
                          setJustCreated(false);
                          navigate(`/cadastro/vigencia?membroId=${colaboradorId}`);
                        }}
                        icon="fas fa-plus"
                      >
                        Criar Vigência
                      </ButtonPrimary>
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                {isEdit && !justCreated && (
                  <div className="editar-cliente-actions">
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate(`/cadastro/colaborador/vigencias?colaboradorId=${colaboradorId}`)}
                        disabled={submitting || !colaboradorId}
                        style={{
                          padding: '10px 20px',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        title="Gerenciar Vigências"
                      >
                        <i className="fas fa-calendar-alt"></i>
                        Vigências
                      </button>
                      <ButtonPrimary
                        onClick={() => navigate(`/cadastro/vigencia?membroId=${colaboradorId}`)}
                        disabled={submitting || !colaboradorId}
                        icon="fas fa-plus"
                      >
                        Nova Vigência
                      </ButtonPrimary>
                    </div>
                  </div>
                )}

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

export default CadastroColaborador;

