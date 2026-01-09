import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ColaboradorForm from '../../components/colaboradores/ColaboradorForm';
import ColaboradorVigenciasList from '../../components/colaboradores-vigencia/ColaboradorVigenciasList';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import {
  aplicarMascaraCpf,
  removerFormatacaoMoeda,
  formatarValorParaInput
} from '../../utils/vigenciaUtils';
import './CadastroColaborador.css';

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
    cpf: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para tipos de contrato
  const [tiposContrato, setTiposContrato] = useState([]);
  const [loadingTiposContrato, setLoadingTiposContrato] = useState(false);

  // Estado para seção de vigência (apenas para novo colaborador)
  const [vigenciaAberta, setVigenciaAberta] = useState(false);

  // Estado para modal de vigências
  const [showModalVigencias, setShowModalVigencias] = useState(false);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    setLoadingTiposContrato(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tipos-contrato-membro?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar tipos de contrato: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setTiposContrato(result.data || []);
      } else {
        throw new Error(result.error || 'Erro ao carregar tipos de contrato');
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
      setTiposContrato([]);
    } finally {
      setLoadingTiposContrato(false);
    }
  }, []);

  // Carregar dados do colaborador
  const loadColaborador = useCallback(async () => {
    if (!colaboradorId) {
      // Se não tem colaboradorId, é um novo cadastro
      setLoading(false);
      setColaborador(null);
      setVigenciaAberta(true); // Abrir seção de vigência por padrão para novo colaborador
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
        setFormData({
          nome: colaboradorData.nome || '',
          cpf: colaboradorData.cpf ? aplicarMascaraCpf(colaboradorData.cpf) : ''
        });
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
        showToast(
          'success',
          colaboradorId 
            ? 'Colaborador atualizado com sucesso!'
            : 'Colaborador criado com sucesso!'
        );
        
        // Se for criação, navegar para a página de edição
        if (!colaboradorId && result.data && result.data.id) {
          navigate(`/cadastro/colaborador?id=${result.data.id}`);
        } else {
          // Recarregar dados
          await loadColaborador();
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
    loadTiposContrato();
  }, [loadTiposContrato]);

  useEffect(() => {
    loadColaborador();
  }, [loadColaborador]);

  if (loading) {
    return (
      <Layout>
        <LoadingState message="Carregando colaborador..." />
      </Layout>
    );
  }

  const isEdit = !!colaboradorId;

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
              {isEdit ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              {isEdit ? 'Edite as informações do colaborador' : 'Preencha os dados para criar um novo colaborador'}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/cadastro/colaboradores')}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fas fa-arrow-left"></i>
            Voltar
          </button>
        </div>

        <CardContainer>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px' }}>
              <ColaboradorForm
                formData={formData}
                setFormData={setFormData}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
                submitting={submitting}
                tiposContrato={tiposContrato}
                loadingTiposContrato={loadingTiposContrato}
                formatarValorParaInput={formatarValorParaInput}
                removerFormatacaoMoeda={removerFormatacaoMoeda}
                aplicarMascaraCpf={aplicarMascaraCpf}
                editingId={isEdit ? colaboradorId : false}
                vigenciaAberta={vigenciaAberta}
                setVigenciaAberta={setVigenciaAberta}
              />

              {isEdit && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                      Vigências do Colaborador
                    </h3>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModalVigencias(true)}
                      disabled={submitting}
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
                      Ver Vigências
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/cadastro/colaboradores')}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <ButtonPrimary
                  type="submit"
                  disabled={submitting}
                  icon={submitting ? 'fa-spinner fa-spin' : 'fa-save'}
                >
                  {submitting ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Salvar Colaborador')}
                </ButtonPrimary>
              </div>

              {formErrors.submit && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
                  {formErrors.submit}
                </div>
              )}
            </div>
          </form>
        </CardContainer>
      </div>

      {/* Modal de Vigências */}
      {showModalVigencias && colaboradorId && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowModalVigencias(false);
        }}>
          <div className="modal-content" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
                Vigências - {colaborador?.nome || 'Colaborador'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowModalVigencias(false)}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '0', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
              <ColaboradorVigenciasList 
                colaboradorId={colaboradorId} 
                colaboradorNome={colaborador?.nome || ''}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CadastroColaborador;

