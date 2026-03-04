import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import { useToast } from '../../hooks/useToast';
import { departamentosAPI } from '../../services/api';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import './GestaoDepartamentos.css';

// Ícones disponíveis para seleção
const AVAILABLE_ICONS = [
    'fa-bullhorn', 'fa-wallet', 'fa-id-card', 'fa-laptop-code', 'fa-chart-line',
    'fa-users', 'fa-building', 'fa-handshake', 'fa-briefcase', 'fa-headset',
    'fa-cog', 'fa-shield-alt', 'fa-brain', 'fa-database', 'fa-globe'
];

const GestaoDepartamentos = () => {
    const navigate = useNavigate();
    const showToast = useToast();

    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showIconModal, setShowIconModal] = useState(false);
    const [deptEditando, setDeptEditando] = useState(null);

    // Estados para modal de confirmação de exclusão
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deptParaExcluir, setDeptParaExcluir] = useState(null);
    const [deletando, setDeletando] = useState(false);

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



    const handleDeleteClick = (dept) => {
        setDeptParaExcluir(dept);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deptParaExcluir) return;

        setDeletando(true);
        try {
            const result = await departamentosAPI.delete(deptParaExcluir.id);
            if (result.success) {
                showToast('success', 'Departamento excluído com sucesso!');
                loadDepartamentos();
            } else {
                showToast('error', 'Erro ao excluir departamento');
            }
        } catch (error) {
            console.error('Erro ao excluir departamento:', error);
            showToast('error', 'Erro ao excluir departamento');
        } finally {
            setDeletando(false);
            setShowDeleteModal(false);
            setDeptParaExcluir(null);
        }
    };

    const handleOpenIconModal = (dept) => {
        setDeptEditando(dept);
        setShowIconModal(true);
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

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <CardContainer>
                        <div className="gestao-departamentos-section">
                            {/* Header */}
                            <div className="form-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '24px',
                                        color: '#0e3b6f',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}>
                                        <i className="fas fa-building"></i>
                                    </div>
                                    <div>
                                        <h2 className="form-title" style={{ margin: 0 }}>Departamentos</h2>
                                        <p className="form-subtitle" style={{ margin: 0 }}>
                                            Gerencie os departamentos da sua empresa
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => navigate('/gestao/usuarios')}
                                        title="Voltar para Gestão de Usuários"
                                    >
                                        <i className="fas fa-arrow-left"></i> Voltar
                                    </button>
                                    <button
                                        className="add-dept-btn"
                                        onClick={() => navigate('/gestao/departamentos/novo')}
                                    >
                                        <i className="fas fa-plus"></i>
                                        Adicionar Departamento
                                    </button>
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
                                                <div style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    <EditButton
                                                        onClick={() => navigate(`/gestao/departamentos/${dept.id}`)}
                                                        title="Editar Departamento"
                                                    />
                                                    <DeleteButton
                                                        onClick={() => handleDeleteClick(dept)}
                                                        title="Excluir Departamento"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {departamentos.length === 0 && !loading && (
                                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                                Nenhum departamento encontrado.
                                            </div>
                                        )}
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



            {/* Modal Seleção de Ícones */}
            {showIconModal && (
                <div className="modal-overlay" onClick={() => setShowIconModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ position: 'relative' }}>
                            <div style={{ padding: '20px 24px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Selecionar Ícone</h3>
                            </div>
                            <button
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
                                    borderRadius: '50%'
                                }}
                                onClick={() => setShowIconModal(false)}
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

            {/* Modal de confirmação de exclusão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeptParaExcluir(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Deletar Departamento"
                message={
                    deptParaExcluir ? (
                        <>
                            <p>
                                Tem certeza que deseja deletar o departamento <strong>{deptParaExcluir.nome}</strong>?
                            </p>
                            <p style={{ color: '#b45309', marginTop: '8px' }}>Esta ação não pode ser desfeita e pode afetar colaboradores vinculados.</p>
                        </>
                    ) : (
                        ''
                    )
                }
                confirmText="Deletar"
                loading={deletando}
            />
        </Layout>
    );
};

export default GestaoDepartamentos;
