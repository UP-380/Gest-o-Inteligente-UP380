import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import { useToast } from '../../hooks/useToast';
import './GestaoDepartamentos.css';

// Dados mockados para exemplo
const MOCK_DEPARTAMENTOS = [
    { id: 1, nome: 'Marketing', descricao: 'Comunicação & Branding', colaboradores: 12, status: 'Ativo', icon: 'fa-bullhorn', color: '#eff6ff', iconColor: '#3b82f6' },
    { id: 2, nome: 'Vendas', descricao: 'Comercial & Growth', colaboradores: 25, status: 'Ativo', icon: 'fa-wallet', color: '#fff7ed', iconColor: '#f97316' },
    { id: 3, nome: 'Recursos Humanos', descricao: 'Gente & Gestão', colaboradores: 5, status: 'Ativo', icon: 'fa-id-card', color: '#fdf4ff', iconColor: '#d946ef' },
    { id: 4, nome: 'Tecnologia', descricao: 'Engenharia & Produto', colaboradores: 18, status: 'Ativo', icon: 'fa-laptop-code', color: '#f0fdf4', iconColor: '#22c55e' },
    { id: 5, nome: 'Financeiro', descricao: 'Contabilidade & Fiscal', colaboradores: 8, status: 'Ativo', icon: 'fa-chart-line', color: '#f8fafc', iconColor: '#64748b' },
];

const GestaoDepartamentos = () => {
    const navigate = useNavigate();
    const showToast = useToast();

    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ nome: '', descricao: '' });

    // Simular carregamento
    useEffect(() => {
        setTimeout(() => {
            setDepartamentos(MOCK_DEPARTAMENTOS);
            setLoading(false);
        }, 800);
    }, []);

    const handleSave = () => {
        if (!formData.nome) {
            showToast('error', 'Nome do departamento é obrigatório');
            return;
        }

        const novoDepartamento = {
            id: departamentos.length + 1,
            nome: formData.nome,
            descricao: formData.descricao || 'Nova divisão corporativa',
            colaboradores: 0,
            status: 'Ativo',
            icon: 'fa-building',
            color: '#f1f5f9',
            iconColor: '#475569'
        };

        setDepartamentos([...departamentos, novoDepartamento]);
        setShowModal(false);
        setFormData({ nome: '', descricao: '' });
        showToast('success', 'Departamento criado com sucesso!');
    };

    const totalColaboradores = departamentos.reduce((acc, curr) => acc + curr.colaboradores, 0);
    const mediaEquipe = departamentos.length ? (totalColaboradores / departamentos.length).toFixed(1) : 0;

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <CardContainer>
                        <div className="gestao-departamentos-section">
                            {/* Header */}
                            <div className="form-header">
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                        <button
                                            className="back-btn"
                                            onClick={() => navigate('/gestao/usuarios')}
                                            title="Voltar para Gestão de Usuários"
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                        </button>
                                        <h2 className="form-title" style={{ margin: 0 }}>Departamentos</h2>
                                    </div>
                                    <p className="form-subtitle" style={{ marginLeft: '60px' }}>
                                        Gerencie os departamentos da sua empresa
                                    </p>
                                </div>
                                <button
                                    className="add-dept-btn"
                                    onClick={() => setShowModal(true)}
                                >
                                    <i className="fas fa-plus"></i>
                                    Adicionar Departamento
                                </button>
                            </div>

                            {/* Stats Cards */}
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <span className="stat-title">Total de Unidades</span>
                                    <span className="stat-value">{departamentos.length}</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-title">Média por Equipe</span>
                                    <span className="stat-value">{mediaEquipe}</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-title">Vagas Abertas</span>
                                    <span className="stat-value highlight">6</span>
                                </div>
                            </div>

                            {/* Lista */}
                            <div className="departments-list">
                                <div className="list-header">
                                    <span>Departamento</span>
                                    <span style={{ textAlign: 'center' }}>Colaboradores</span>
                                    <span>Status</span>
                                    <span style={{ textAlign: 'right' }}>Ações</span>
                                </div>

                                {loading ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                        Carregando departamentos...
                                    </div>
                                ) : (
                                    <>
                                        {departamentos.map(dept => (
                                            <div key={dept.id} className="department-item">
                                                <div className="dept-info">
                                                    <div className="dept-icon" style={{ background: dept.color, color: dept.iconColor }}>
                                                        <i className={`fas ${dept.icon}`}></i>
                                                    </div>
                                                    <div className="dept-name">
                                                        <h4>{dept.nome}</h4>
                                                        <p>{dept.descricao}</p>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <span className="badge-count">{dept.colaboradores}</span>
                                                </div>
                                                <div>
                                                    <span className="status-badge active">
                                                        <span className="status-dot"></span>
                                                        {dept.status}
                                                    </span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <button className="btn-icon" title="Editar">
                                                        <i className="fas fa-ellipsis-v"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                <div className="pagination-container">
                                    <span className="pagination-info">Mostrando {departamentos.length} de {departamentos.length} departamentos</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="page-btn" disabled>Anterior</button>
                                        <button className="page-btn" disabled>Próximo</button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </CardContainer>
                </main>
            </div>

            {/* Modal Criar Departamento */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Novo Departamento</h3>
                                <button className="btn-icon" onClick={() => setShowModal(false)}><i className="fas fa-times"></i></button>
                            </div>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                                Preencha as informações para criar uma nova divisão corporativa.
                            </p>

                            <div className="form-group">
                                <label>Nome do Departamento</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ex: Financeiro"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label>Descrição curta (Opcional)</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Descreva brevemente a função deste departamento..."
                                    value={formData.descricao}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowModal(false)}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="add-dept-btn"
                                style={{ margin: 0 }}
                                onClick={handleSave}
                            >
                                Salvar Departamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default GestaoDepartamentos;
