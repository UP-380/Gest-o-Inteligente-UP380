import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import AssuntoForm from '../../components/comunicacao/AssuntoForm';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { useToast } from '../../hooks/useToast';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './CadastroAssuntoIndividual.css';


const CadastroAssuntoIndividual = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const showToast = useToast();

    // Obter assuntoId da query string
    const assuntoId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [assunto, setAssunto] = useState(null);

    // Estados do formulário
    const [formData, setFormData] = useState({
        id: null,
        nome: '',
        departamento_id: '',
        sla_horas: 24,
        status: 'Ativo',
        descricao: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Carregar assunto para edição
    const loadAssunto = useCallback(async () => {
        if (!assuntoId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await comunicacaoAPI.buscarAssuntoPorId(assuntoId);

            if (response.success && response.data) {
                const data = response.data;
                setAssunto(data);
                setFormData({
                    id: data.id || null,
                    nome: data.nome || '',
                    departamento_id: data.departamento_id || '',
                    sla_horas: data.sla_horas || 24,
                    status: data.status || 'Ativo',
                    descricao: data.descricao || ''
                });
            } else {
                throw new Error(response.error || response.message || 'Erro ao carregar assunto');
            }
        } catch (error) {
            console.error('Erro ao carregar assunto:', error);
            showToast('error', 'Erro ao carregar assunto. Tente novamente.');
            navigate('/cadastro/assuntos');
        } finally {
            setLoading(false);
        }
    }, [assuntoId, showToast, navigate]);

    // Salvar assunto
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

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

            const response = assuntoId
                ? await comunicacaoAPI.atualizarAssunto(assuntoId, payload)
                : await comunicacaoAPI.criarAssunto(payload);

            if (response.success) {
                showToast(
                    'success',
                    assuntoId
                        ? 'Assunto atualizado com sucesso!'
                        : 'Assunto criado com sucesso!'
                );

                // Se foi criação, atualizar ID sem recarregar
                if (!assuntoId && response.data && response.data.id) {
                    window.history.replaceState({}, '', `/cadastro/assunto?id=${response.data.id}`);
                    setAssunto(response.data);
                    setFormData(prev => ({ ...prev, id: response.data.id }));
                }
            } else {
                const errorMsg = response.error || response.details || response.message || 'Erro ao salvar assunto';
                setFormErrors({ nome: errorMsg });
                showToast('error', errorMsg);
            }
        } catch (error) {
            console.error('Erro ao salvar assunto:', error);
            const errorMsg = 'Erro ao salvar assunto. Verifique sua conexão e tente novamente.';
            setFormErrors({ nome: errorMsg });
            showToast('error', errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Efeito para carregar assunto quando houver ID
    useEffect(() => {
        loadAssunto();
    }, [loadAssunto]);

    if (loading) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content">
                        <CardContainer>
                            <LoadingState message="Carregando assunto..." />
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
                    <div className="cadastro-assunto-individual-container">
                        <CardContainer>
                            {/* Header da Página */}
                            <div className="cadastro-assunto-page-header">
                                <div className="cadastro-assunto-header-content">
                                    <div className="cadastro-assunto-header-left">
                                        <div className="cadastro-assunto-header-icon">
                                            <i className="fas fa-tags" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                                        </div>
                                        <div>
                                            <h1 className="cadastro-assunto-page-title">
                                                {assuntoId ? (formData.nome || 'Editar Assunto') : 'Novo Assunto'}
                                            </h1>
                                            <p className="cadastro-assunto-page-subtitle">
                                                {assuntoId
                                                    ? 'Edite as informações do assunto para abertura de chamados'
                                                    : 'Preencha os dados para cadastrar um novo assunto'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <button
                                            className="btn-secondary cadastro-assunto-back-btn"
                                            onClick={() => navigate('/cadastro/assuntos')}
                                            disabled={submitting}
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            Voltar
                                        </button>
                                        <ButtonPrimary
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                                        >
                                            {submitting ? 'Salvando...' : 'Salvar'}
                                        </ButtonPrimary>
                                    </div>
                                </div>
                            </div>

                            {/* Nota Informativa */}
                            <div className="info-note" style={{
                                backgroundColor: '#f0f7ff',
                                borderLeft: '4px solid #007bff',
                                padding: '12px 16px',
                                margin: '20px 0',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <i className="fas fa-info-circle" style={{ color: '#007bff' }}></i>
                                <p style={{ margin: 0, color: '#004085', fontSize: '14px' }}>
                                    <strong>Esses assuntos serão dados como opções na hora de abrir um chamado.</strong>
                                </p>
                            </div>

                            {/* Formulário */}
                            <div className="cadastro-assunto-form-section">
                                <AssuntoForm
                                    formData={formData}
                                    setFormData={setFormData}
                                    formErrors={formErrors}
                                    setFormErrors={setFormErrors}
                                    submitting={submitting}
                                />
                            </div>
                        </CardContainer>
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default CadastroAssuntoIndividual;
