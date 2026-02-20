import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import { useToast } from '../../hooks/useToast';
import { departamentosAPI } from '../../services/api';
import './GestaoDepartamentos.css';

// Ícones disponíveis para seleção
const AVAILABLE_ICONS = [
    'fa-bullhorn', 'fa-wallet', 'fa-id-card', 'fa-laptop-code', 'fa-chart-line',
    'fa-users', 'fa-building', 'fa-handshake', 'fa-briefcase', 'fa-headset',
    'fa-cog', 'fa-shield-alt', 'fa-brain', 'fa-database', 'fa-globe'
];

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
    const menuRef = useRef(null);

    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showIconModal, setShowIconModal] = useState(false);
    const [deptEditando, setDeptEditando] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [formData, setFormData] = useState({ nome: '', descricao: '' });

    // Carregar departamentos
    const loadDepartamentos = async () => {
        setLoading(true);
        try {
            const result = await departamentosAPI.getAll(1, 100);
            if (result.success) {
                setDepartamentos(result.data);
            }
        } catch (error) {
            console.error('Erro ao carregar departamentos:', error);
            showToast('error', 'Erro ao carregar departamentos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartamentos();
    }, []);

    // Fechar menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = async () => {
        if (!formData.nome) {
            showToast('error', 'Nome do departamento é obrigatório');
            return;
        }

        try {
            if (deptEditando) {
                // Edição
                const result = await departamentosAPI.update(deptEditando.id, formData);
                if (result.success) {
                    showToast('success', 'Departamento atualizado com sucesso!');
                    loadDepartamentos();
                } else {
                    showToast('error', 'Erro ao atualizar departamento');
                }
            } else {
                // Criação
                const novoDepartamento = {
                    nome: formData.nome,
                    descricao: formData.descricao || 'Nova divisão corporativa',
                    status: 'Ativo',
                    icon: 'fa-building',
                    color: '#f1f5f9',
                    iconColor: '#475569'
                };
                const result = await departamentosAPI.create(novoDepartamento);
                if (result.success) {
                    showToast('success', 'Departamento criado com sucesso!');
                    loadDepartamentos();
                } else {
                    showToast('error', 'Erro ao criar departamento');
                }
            }

            setShowModal(false);
            setDeptEditando(null);
            setFormData({ nome: '', descricao: '' });
        } catch (error) {
            console.error('Erro ao salvar departamento:', error);
            showToast('error', 'Erro ao salvar departamento');
        }
    };

    const handleEdit = (dept) => {
        setDeptEditando(dept);
        setFormData({ nome: dept.nome, descricao: dept.descricao });
        setShowModal(true);
        setActiveMenuId(null);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este departamento?')) {
            try {
                const result = await departamentosAPI.delete(id);
                if (result.success) {
                    showToast('success', 'Departamento excluído com sucesso!');
                    loadDepartamentos();
                } else {
                    showToast('error', 'Erro ao excluir departamento');
                }
            } catch (error) {
                console.error('Erro ao excluir departamento:', error);
                showToast('error', 'Erro ao excluir departamento');
            }
        }
        setActiveMenuId(null);
    };

    const handleOpenIconModal = (dept) => {
        setDeptEditando(dept);
        setShowIconModal(true);
        setActiveMenuId(null);
    };

    const handleSelectIcon = async (icon) => {
        try {
            const result = await departamentosAPI.update(deptEditando.id, { icon });
            if (result.success) {
                showToast('success', 'Ícone atualizado!');
                loadDepartamentos();
            } else {
                showToast('error', 'Erro ao atualizar ícone');
            }
        } catch (error) {
            console.error('Erro ao atualizar ícone:', error);
            showToast('error', 'Erro ao atualizar ícone');
        }
        setShowIconModal(false);
        setDeptEditando(null);
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
                                    onClick={() => {
                                        setDeptEditando(null);
                                        setFormData({ nome: '', descricao: '' });
                                        setShowModal(true);
                                    }}
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
                                    <span className="stat-value highlight">---</span>
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
                                                    <div
                                                        className="dept-icon clickable"
                                                        style={{ background: dept.color, color: dept.iconColor }}
                                                        onClick={() => handleOpenIconModal(dept)}
                                                        title="Clique para mudar o ícone"
                                                    >
                                                        <i className={`fas ${dept.icon}`}></i>
                                                        <div className="icon-overlay">
                                                            <i className="fas fa-sync-alt"></i>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="dept-name clickable"
                                                        onClick={() => navigate(`/gestao/departamentos/${dept.id}`)}
                                                        title="Ver detalhes do departamento"
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <h4 style={{ color: '#3b82f6' }}>{dept.nome}</h4>
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
                                                <div style={{ textAlign: 'right', position: 'relative' }}>
                                                    <button
                                                        className={`btn-icon ${activeMenuId === dept.id ? 'active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuId(activeMenuId === dept.id ? null : dept.id);
                                                        }}
                                                    >
                                                        <i className="fas fa-ellipsis-v"></i>
                                                    </button>

                                                    {activeMenuId === dept.id && (
                                                        <div className="dept-action-menu" ref={menuRef}>
                                                            <button onClick={() => handleEdit(dept)}>
                                                                <i className="fas fa-edit"></i> Editar
                                                            </button>
                                                            <button
                                                                className="delete"
                                                                onClick={() => handleDelete(dept.id)}
                                                            >
                                                                <i className="fas fa-trash"></i> Excluir
                                                            </button>
                                                        </div>
                                                    )}
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

            {/* Modal Editar/Criar Departamento */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '800px',
                            width: '90%',
                            minHeight: '400px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="modal-header" style={{ position: 'relative' }}>
                            <div style={{ padding: '20px 24px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>
                                    {deptEditando ? 'Editar Departamento' : 'Novo Departamento'}
                                </h3>
                            </div>
                            <button
                                className="btn-icon"
                                onClick={() => setShowModal(false)}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: '24px',
                                    transform: 'translateY(-50%)',
                                    fontSize: '20px',
                                    color: '#94a3b8',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body" style={{ flex: 1 }}>
                            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                                {deptEditando
                                    ? 'Atualize as informações do departamento selecionado.'
                                    : 'Preencha as informações para criar uma nova divisão corporativa.'}
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
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    background: 'white',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="add-dept-btn"
                                style={{ margin: 0 }}
                                onClick={handleSave}
                            >
                                {deptEditando ? 'Salvar Alterações' : 'Salvar Departamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Seleção de Ícones */}
            {showIconModal && (
                <div className="modal-overlay" onClick={() => setShowIconModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ position: 'relative' }}>
                            <div style={{ padding: '20px 24px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Selecionar Ícone</h3>
                            </div>
                            <button
                                className="btn-icon"
                                onClick={() => setShowIconModal(false)}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: '24px',
                                    transform: 'translateY(-50%)',
                                    fontSize: '20px',
                                    color: '#94a3b8',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="icon-selector-grid">
                                {AVAILABLE_ICONS.map(icon => (
                                    <div
                                        key={icon}
                                        className={`icon-option ${deptEditando?.icon === icon ? 'selected' : ''}`}
                                        onClick={() => handleSelectIcon(icon)}
                                    >
                                        <i className={`fas ${icon}`}></i>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default GestaoDepartamentos;
