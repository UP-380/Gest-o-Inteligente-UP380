import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import './CadastroStatusTarefaIndividual.css';

const COMMON_ICONS = [
    'fa-circle', 'fa-check-circle', 'fa-spinner', 'fa-pause-circle', 'fa-hourglass-half',
    'fa-play-circle', 'fa-stop-circle', 'fa-exclamation-triangle', 'fa-clock', 'fa-calendar-check',
    'fa-tasks', 'fa-clipboard-check', 'fa-check', 'fa-times-circle', 'fa-sync',
    'fa-history', 'fa-flag', 'fa-star', 'fa-bullseye', 'fa-rocket'
];

const SYSTEM_COLORS = [
    '#0e3b6f', // Navy Blue (System Primary)
    '#2563eb', // Royal Blue
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#e11d48', // Red
    '#ea580c', // Orange
    '#d97706', // Amber/Yellow
    '#059669', // Emerald Green
    '#0891b2', // Cyan
    '#475569'  // Slate/Grey
];

const CadastroStatusTarefaIndividual = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const statusId = searchParams.get('id');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showColorPalette, setShowColorPalette] = useState(false);
    const colorPickerRef = useRef(null);
    const [formData, setFormData] = useState({
        nome: '',
        cor_texto: '#0e3b6f',
        cor_fundo: '#0e3b6f1a',
        cor_borda: '#0e3b6f66',
        icone: 'fa-circle'
    });

    const fetchStatus = useCallback(async () => {
        if (!statusId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/tempo-estimado-config-status/${statusId}`, {
                credentials: 'include'
            });
            const result = await response.json();
            if (result.success) {
                setFormData({
                    nome: result.data.nome || '',
                    cor_texto: result.data.cor_texto || '#3b82f6',
                    cor_fundo: result.data.cor_fundo || '#eff6ff',
                    cor_borda: result.data.cor_borda || '#93c5fd',
                    icone: result.data.icone || 'fa-circle'
                });
            } else {
                Swal.fire('Erro', 'Erro ao carregar status: ' + result.error, 'error');
                navigate('/cadastro/status-tarefas');
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro de conexão ao carregar status', 'error');
        } finally {
            setLoading(false);
        }
    }, [statusId, navigate]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPalette(false);
            }
        };

        if (showColorPalette) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorPalette]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.nome.trim()) {
            Swal.fire('Aviso', 'O nome do status é obrigatório', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const method = statusId ? 'PUT' : 'POST';
            const url = statusId
                ? `/api/tempo-estimado-config-status/${statusId}`
                : '/api/tempo-estimado-config-status';

            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: statusId ? 'Status atualizado!' : 'Status criado!',
                    timer: 1500,
                    showConfirmButton: false
                });

                if (!statusId && result.data?.id) {
                    navigate(`/cadastro/status-tarefa?id=${result.data.id}`, { replace: true });
                } else {
                    navigate('/cadastro/status-tarefas');
                }
            } else {
                Swal.fire('Erro', 'Erro ao salvar: ' + result.error, 'error');
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro de conexão ao salvar status', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content">
                        <CardContainer>
                            <LoadingState message="Carregando dados do status..." />
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
                    <div className="cadastro-status-individual-container">
                        <CardContainer>
                            {/* Header da Página */}
                            <div className="cadastro-status-page-header">
                                <div className="cadastro-status-header-content">
                                    <div className="cadastro-status-header-left">
                                        <div className="cadastro-status-header-icon">
                                            <i className={`fas ${formData.icone || 'fa-tasks'}`} style={{ fontSize: '32px' }}></i>
                                        </div>
                                        <div>
                                            <h1 className="cadastro-status-page-title">
                                                {statusId ? `Editar: ${formData.nome}` : 'Novo Status de Tarefa'}
                                            </h1>
                                            <p className="cadastro-status-page-subtitle">
                                                {statusId
                                                    ? 'Atualize as configurações visuais deste status'
                                                    : 'Configure um novo status para as tarefas do sistema'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            className="btn-secondary cadastro-status-back-btn"
                                            onClick={() => navigate('/cadastro/status-tarefas')}
                                            disabled={submitting}
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            Voltar
                                        </button>
                                        <ButtonPrimary
                                            type="submit"
                                            form="status-form"
                                            disabled={submitting}
                                            icon={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}
                                        >
                                            {submitting ? 'Salvando...' : 'Salvar Alterações'}
                                        </ButtonPrimary>
                                    </div>
                                </div>
                            </div>

                            {/* Formulário Principal */}
                            <div className="form-section">
                                <form id="status-form" onSubmit={handleSubmit} className="status-form">
                                    <div className="form-row-single">
                                        <div className="form-group">
                                            <label className="form-label">Nome de Exibição <span className="required">*</span></label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.nome}
                                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                                placeholder="Ex: Em Análise, Aguardando Cliente..."
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group icon-selector-section">
                                        <label className="form-label">Selecione o Ícone Representativo</label>

                                        <div className="icon-selector-grid-page" ref={colorPickerRef}>
                                            {/* Color Picker Inside the Grid */}
                                            <div
                                                className={`discrete-color-picker-inside ${showColorPalette ? 'active' : ''}`}
                                                onClick={() => setShowColorPalette(!showColorPalette)}
                                                title="Alterar cor do status"
                                            >
                                                <span className="discrete-label">cor:</span>
                                                <div className="color-swatch-discrete" style={{ backgroundColor: formData.cor_texto }}></div>
                                                <i className={`fas fa-chevron-${showColorPalette ? 'up' : 'down'}`}></i>
                                            </div>

                                            {showColorPalette && (
                                                <div className="color-palette-popover-inside animate-fade-in">
                                                    <div className="color-palette-grid-compact">
                                                        {SYSTEM_COLORS.map(color => (
                                                            <div
                                                                key={color}
                                                                className={`color-option-small ${formData.cor_texto === color ? 'selected' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFormData({
                                                                        ...formData,
                                                                        cor_texto: color,
                                                                        cor_fundo: color + '1a',
                                                                        cor_borda: color + '66'
                                                                    });
                                                                    setShowColorPalette(false);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {COMMON_ICONS.map(icon => (
                                                <div
                                                    key={icon}
                                                    className={`icon-option-page ${formData.icone === icon ? 'selected' : ''}`}
                                                    onClick={() => setFormData({ ...formData, icone: icon })}
                                                    title={icon}
                                                    style={{
                                                        backgroundColor: formData.cor_fundo,
                                                        color: formData.cor_texto,
                                                        border: `1px solid ${formData.icone === icon ? formData.cor_texto : formData.cor_borda}`,
                                                        opacity: formData.icone === icon ? 1 : 0.8,
                                                        transform: formData.icone === icon ? 'scale(1.15)' : 'scale(1)',
                                                        boxShadow: formData.icone === icon ? `0 0 0 3px ${formData.cor_texto}44` : 'none'
                                                    }}
                                                >
                                                    <i className={`fas ${icon}`}></i>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    <div className="status-preview-card">
                                        <span className="preview-label">Visualização Prévia na Tabela</span>
                                        <div className="status-preview-example">
                                            <div
                                                className="status-preview-icon"
                                                style={{
                                                    backgroundColor: formData.cor_fundo,
                                                    color: formData.cor_texto,
                                                    border: `1px solid ${formData.cor_borda}`,
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                <i className={`fas ${formData.icone}`}></i>
                                            </div>
                                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{formData.nome || 'Nome do Status'}</span>
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

export default CadastroStatusTarefaIndividual;
