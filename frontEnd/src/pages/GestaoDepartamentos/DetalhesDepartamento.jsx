import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import { colaboradoresAPI, departamentosAPI } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import DatePicker from '../../components/vigencia/DatePicker';
import './DetalhesDepartamento.css';

// Ícones disponíveis para seleção
const AVAILABLE_ICONS = [
    'fa-bullhorn', 'fa-wallet', 'fa-id-card', 'fa-laptop-code', 'fa-chart-line',
    'fa-users', 'fa-building', 'fa-handshake', 'fa-briefcase', 'fa-headset',
    'fa-cog', 'fa-shield-alt', 'fa-brain', 'fa-database', 'fa-globe'
];

const DetalhesDepartamento = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const showToast = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deptInfo, setDeptInfo] = useState({ name: '', description: '', head: '', headRole: '', icon: 'fa-building', color: '#f1f5f9', iconColor: '#64748b' });
    const [members, setMembers] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showIconModal, setShowIconModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [newMemberData, setNewMemberData] = useState({
        name: '',
        email: '',
        role: '',
        status: 'Ativo',
        joined: '',
        colaboradorId: ''
    });
    const [openMenuId, setOpenMenuId] = useState(null);
    const [openUpwards, setOpenUpwards] = useState(false);
    const menuRef = useRef(null);

    // Fechar menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Carregar dados
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Carregar colaboradores para o select - Buscar todos (mesmo sem usuário vinculado)
            const colabsResult = await colaboradoresAPI.getAllIncludingWithoutUser();
            if (colabsResult.success && colabsResult.data) {
                setColaboradores(colabsResult.data);
            }

            // Carregar info do departamento
            const deptResult = await departamentosAPI.getById(id);
            if (deptResult.success) {
                const data = deptResult.data;
                setDeptInfo({
                    name: data.nome || 'Departamento sem nome',
                    description: data.descricao || '',
                    head: data.head || 'Não definido',
                    headRole: data.head_role || 'N/A',
                    icon: data.icon || 'fa-building',
                    color: data.color || '#f1f5f9',
                    iconColor: data.icon_color || '#64748b'
                });
            } else {
                setError('Departamento não encontrado');
            }

            // Carregar membros do departamento
            const membersResult = await departamentosAPI.getMembros(id);
            if (membersResult.success) {
                setMembers(membersResult.data || []);
            }
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Erro ao carregar dados do departamento');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleSelectIcon = async (iconName) => {
        try {
            const result = await departamentosAPI.update(id, { icon: iconName });
            if (result.success) {
                showToast('success', 'Ícone atualizado com sucesso!');
                setDeptInfo(prev => ({ ...prev, icon: iconName }));
                setShowIconModal(false);
            } else {
                showToast('error', 'Erro ao atualizar ícone');
            }
        } catch (error) {
            console.error('Erro ao atualizar ícone:', error);
            showToast('error', 'Erro de conexão ao atualizar ícone');
        }
    };

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMembers = members.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(members.length / itemsPerPage);

    const handleRemoveMember = async (memberAssocId) => {
        if (window.confirm('Tem certeza que deseja remover este colaborador do departamento?')) {
            try {
                const result = await departamentosAPI.removeMembro(id, memberAssocId);
                if (result.success) {
                    showToast('success', 'Colaborador removido com sucesso!');
                    loadData(); // Recarregar lista
                } else {
                    showToast('error', 'Erro ao remover colaborador');
                }
            } catch (error) {
                console.error('Erro ao remover colaborador:', error);
                showToast('error', 'Erro ao remover colaborador');
            }
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();

        if (!newMemberData.colaboradorId) {
            showToast('error', 'Selecione um colaborador');
            return;
        }

        let formattedDate = newMemberData.joined;
        // Assegurar formato YYYY-MM-DD para salvar
        if (!formattedDate) {
            const today = new Date();
            formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }

        const newMemberPayload = {
            membro_id: newMemberData.colaboradorId,
            cargo: newMemberData.role,
            email: newMemberData.email,
            status: newMemberData.status,
            data_entrada: formattedDate
        };

        try {
            const result = await departamentosAPI.addMembro(id, newMemberPayload);
            if (result.success) {
                showToast('success', 'Colaborador adicionado ao departamento!');
                loadData();
                setShowAddModal(false);
                setNewMemberData({ name: '', email: '', role: '', status: 'Ativo', joined: '', colaboradorId: '' });
            } else {
                showToast('error', result.error || 'Erro ao adicionar colaborador');
            }
        } catch (error) {
            console.error('Erro ao adicionar membro:', error);
            showToast('error', 'Erro ao adicionar colaborador');
        }
    };

    const toggleMenu = (id, e) => {
        e.stopPropagation();
        if (openMenuId === id) {
            setOpenMenuId(null);
        } else {
            // Verificar a posição vertical do botão de ação
            const rect = e.currentTarget.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Se o botão estiver a menos de 150px do final da tela, abre para cima
            if (viewportHeight - rect.bottom < 150) {
                setOpenUpwards(true);
            } else {
                setOpenUpwards(false);
            }

            setOpenMenuId(id);
        }
    };

    const handleEditClick = (member) => {
        let formattedJoined = member.joined;

        // Garantir formato YYYY-MM-DD para o DatePicker
        if (member.joined && member.joined.includes('T')) {
            formattedJoined = member.joined.split('T')[0];
        } else if (member.joined && member.joined.includes('/')) {
            // Se por algum motivo estiver em DD/MM/YYYY
            const parts = member.joined.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
                formattedJoined = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        setEditingMember({ ...member, joined: formattedJoined });
        setShowEditModal(true);
        setOpenMenuId(null);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();

        let formattedDate = editingMember.joined;
        let dateForApi = null;

        // Check if date is in YYYY-MM-DD format (from DatePicker)
        if (formattedDate && /^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
            dateForApi = formattedDate;
        } else if (formattedDate) {
            // Tentar converter de volta para YYYY-MM-DD se estiver em outro formato (ex: MMM DD, YYYY)
            try {
                const months = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                };
                const parts = formattedDate.replace(',', '').split(' ');
                if (parts.length === 3) {
                    const month = months[parts[0]];
                    const day = parts[1].padStart(2, '0');
                    const year = parts[2];
                    if (month) dateForApi = `${year}-${month}-${day}`;
                }
            } catch (e) {
                console.error("Erro parse data", e);
            }
        }

        const updatePayload = {
            cargo: editingMember.role,
            email: editingMember.email,
            status: editingMember.status,
            data_entrada: dateForApi
        };

        try {
            const result = await departamentosAPI.updateMembro(id, editingMember.id, updatePayload);
            if (result.success) {
                showToast('success', 'Alterações salvas com sucesso!');
                loadData();
                setShowEditModal(false);
                setEditingMember(null);
            } else {
                showToast('error', 'Erro ao atualizar membro');
            }
        } catch (error) {
            console.error('Erro ao atualizar membro:', error);
            showToast('error', 'Erro ao atualizar membro');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <i className="fas fa-spinner fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
                            <p>Carregando dados do departamento...</p>
                        </div>
                    </main>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                        <div style={{ textAlign: 'center', color: '#ef4444' }}>
                            <i className="fas fa-exclamation-triangle fa-3x" style={{ marginBottom: '1rem' }}></i>
                            <p>{error}</p>
                            <button
                                onClick={() => navigate('/gestao/departamentos')}
                                style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                            >
                                Voltar para Departamentos
                            </button>
                        </div>
                    </main>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="container detalhes-full-page">
                <main className="main-content">
                    <div className="detalhes-departamento-section">

                        {/* Header */}
                        <div className="detalhes-header">
                            <div className="breadcrumbs">
                                <button
                                    className="back-btn"
                                    onClick={() => navigate('/gestao/departamentos')}
                                    title="Voltar para Departamentos"
                                >
                                    <i className="fas fa-arrow-left"></i>
                                </button>
                                <Link to="/gestao/departamentos">Departamentos</Link>
                                <i className="fas fa-chevron-right" style={{ fontSize: '10px' }}></i>
                                <span>{deptInfo.name}</span>
                            </div>
                            <div className="dept-title-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div
                                        className="dept-icon clickable"
                                        onClick={() => setShowIconModal(true)}
                                        style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '16px',
                                            background: deptInfo.color || '#f1f5f9',
                                            color: deptInfo.iconColor || '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '28px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                            cursor: 'pointer',
                                            position: 'relative'
                                        }}
                                        title="Clique para mudar o ícone"
                                    >
                                        <i className={`fas ${deptInfo.icon || 'fa-building'}`}></i>
                                        <div className="icon-overlay">
                                            <i className="fas fa-sync-alt" style={{ fontSize: '14px' }}></i>
                                        </div>
                                    </div>
                                    <div>
                                        <h1>{deptInfo.name}</h1>
                                        <p className="dept-subtitle">{deptInfo.description}</p>
                                    </div>
                                </div>
                                <button className="add-member-btn" onClick={() => setShowAddModal(true)}>
                                    <i className="fas fa-user-plus"></i>
                                    Adicionar Membro
                                </button>
                            </div>
                        </div>

                        {/* Top Cards */}
                        <div className="top-cards-grid">
                            <div className="info-card">
                                <div className="card-icon-wrapper" style={{ background: '#fff7ed', color: '#fd7e14' }}>
                                    <i className="fas fa-users"></i>
                                </div>
                                <div className="card-content">
                                    <span className="card-label">Total de Membros</span>
                                    <span className="card-value">{members.length}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="card-icon-wrapper" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                    <i className="fas fa-user-shield"></i>
                                </div>
                                <div className="card-content">
                                    <span className="card-label">Responsável pelo Departamento</span>
                                    <div className="head-profile">
                                        <div className="head-info">
                                            <h3>{deptInfo.head || 'Não definido'}</h3>
                                            <span className="role-badge">{deptInfo.headRole || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="members-section">
                            <div className="members-header">
                                <h2>Membros do Departamento</h2>
                            </div>

                            <table className="members-table">
                                <thead>
                                    <tr>
                                        <th>Membro</th>
                                        <th>Cargo</th>
                                        <th>Status</th>
                                        <th>Data de Entrada</th>
                                        <th style={{ textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentMembers.map(member => (
                                        <tr key={member.id}>
                                            <td>
                                                <div className="member-profile">
                                                    <div className="member-avatar-placeholder">
                                                        {(member.name || '?').charAt(0)}
                                                    </div>
                                                    <div className="member-info">
                                                        <div>{member.name}</div>
                                                        <div>{member.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{member.role}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span
                                                        className="status-dot"
                                                        style={{
                                                            background: member.status === 'Ativo' ? '#22c55e' :
                                                                member.status === 'Inativo' ? '#ef4444' :
                                                                    member.status === 'Férias' ? '#3b82f6' : '#f59e0b'
                                                        }}
                                                    ></span>
                                                    <span
                                                        className="status-text"
                                                        style={{
                                                            color: member.status === 'Ativo' ? '#166534' :
                                                                member.status === 'Inativo' ? '#b91c1c' :
                                                                    member.status === 'Férias' ? '#1e40af' : '#b45309'
                                                        }}
                                                    >
                                                        {member.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{formatDate(member.joined)}</td>
                                            <td style={{ textAlign: 'right', position: 'relative' }}>
                                                <div className="action-menu-container">
                                                    <button
                                                        className="action-btn"
                                                        onClick={(e) => toggleMenu(member.id, e)}
                                                        title="Ações"
                                                    >
                                                        <i className="fas fa-ellipsis-v"></i>
                                                    </button>

                                                    {openMenuId === member.id && (
                                                        <div className={`member-action-menu ${openUpwards ? 'open-upwards' : ''}`} ref={menuRef}>
                                                            <button onClick={() => handleEditClick(member)}>
                                                                <i className="fas fa-edit"></i>
                                                                Editar
                                                            </button>
                                                            <button
                                                                className="delete-option"
                                                                onClick={() => {
                                                                    handleRemoveMember(member.id);
                                                                    setOpenMenuId(null);
                                                                }}
                                                            >
                                                                <i className="fas fa-trash-alt"></i>
                                                                Remover
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {currentMembers.length === 0 && (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                    Nenhum membro encontrado.
                                </div>
                            )}

                            {/* Controles de Paginação */}
                            {totalPages > 1 && (
                                <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '14px', color: '#64748b' }}>
                                        Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, members.length)} de {members.length} membros
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '6px 12px',
                                                border: '1px solid #e2e8f0',
                                                background: 'white',
                                                borderRadius: '6px',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                opacity: currentPage === 1 ? 0.5 : 1
                                            }}
                                        >
                                            <i className="fas fa-chevron-left"></i>
                                        </button>

                                        {Array.from({ length: totalPages }, (_, i) => (
                                            <button
                                                key={i + 1}
                                                onClick={() => setCurrentPage(i + 1)}
                                                style={{
                                                    padding: '6px 12px',
                                                    border: `1px solid ${currentPage === i + 1 ? '#3b82f6' : '#e2e8f0'}`,
                                                    background: currentPage === i + 1 ? '#eff6ff' : 'white',
                                                    color: currentPage === i + 1 ? '#3b82f6' : '#64748b',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: '6px 12px',
                                                border: '1px solid #e2e8f0',
                                                background: 'white',
                                                borderRadius: '6px',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                opacity: currentPage === totalPages ? 0.5 : 1
                                            }}
                                        >
                                            <i className="fas fa-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </main>
            </div>

            {/* Modal Adicionar Membro */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Adicionar Membro</h3>
                        </div>
                        <div className="modal-body">
                            <p>Selecione um colaborador para adicionar ao departamento de <strong>{deptInfo.name}</strong>.</p>
                            <form onSubmit={handleAddMember}>
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div className="form-group">
                                        <label>Nome</label>
                                        <select
                                            className="form-control"
                                            value={newMemberData.colaboradorId}
                                            onChange={e => {
                                                const selectedId = e.target.value;
                                                const selectedColab = colaboradores.find(c => String(c.id) === String(selectedId));
                                                if (selectedColab) {
                                                    setNewMemberData({
                                                        ...newMemberData,
                                                        colaboradorId: selectedId,
                                                        name: selectedColab.nome,
                                                        email: selectedColab.email || ''
                                                    });
                                                } else {
                                                    setNewMemberData({
                                                        ...newMemberData,
                                                        colaboradorId: '',
                                                        name: '',
                                                        email: ''
                                                    });
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Selecione um colaborador</option>
                                            {colaboradores.map(colab => (
                                                <option key={colab.id} value={colab.id}>{colab.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Email (Opcional)</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={newMemberData.email}
                                            onChange={e => setNewMemberData({ ...newMemberData, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px', position: 'relative', zIndex: 1 }}>
                                    <div className="form-group">
                                        <label>Cargo</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newMemberData.role}
                                            onChange={e => setNewMemberData({ ...newMemberData, role: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            className="form-control"
                                            value={newMemberData.status}
                                            onChange={e => setNewMemberData({ ...newMemberData, status: e.target.value })}
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Inativo">Inativo</option>
                                            <option value="Férias">Férias</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '12px', position: 'relative', zIndex: 100 }}>
                                    <label>Data de Entrada</label>
                                    <DatePicker
                                        value={newMemberData.joined}
                                        onChange={(e) => setNewMemberData({ ...newMemberData, joined: e.target.value })}
                                        className="date-picker-up"
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
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
                                        type="submit"
                                        className="add-member-btn"
                                        style={{ border: 'none' }}
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar Membro */}
            {showEditModal && editingMember && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Editar Membro</h3>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSaveEdit}>
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div className="form-group">
                                        <label>Nome</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editingMember.name}
                                            onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email (Opcional)</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={editingMember.email}
                                            onChange={e => setEditingMember({ ...editingMember, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px', position: 'relative', zIndex: 1 }}>
                                    <div className="form-group">
                                        <label>Cargo</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editingMember.role}
                                            onChange={e => setEditingMember({ ...editingMember, role: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            className="form-control"
                                            value={editingMember.status}
                                            onChange={e => setEditingMember({ ...editingMember, status: e.target.value })}
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Inativo">Inativo</option>
                                            <option value="Férias">Férias</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '12px', position: 'relative', zIndex: 100 }}>
                                    <label>Data de Entrada</label>
                                    <DatePicker
                                        value={editingMember.joined}
                                        onChange={(e) => setEditingMember({ ...editingMember, joined: e.target.value })}
                                        className="date-picker-up"
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
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
                                        type="submit"
                                        className="add-member-btn"
                                        style={{ border: 'none' }}
                                    >
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Seleção de Ícone */}
            {showIconModal && (
                <div className="modal-overlay" onClick={() => setShowIconModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0 }}>Selecionar Ícone</h3>
                        </div>
                        <div className="modal-body">
                            <div className="icon-selector-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '12px',
                                padding: '8px'
                            }}>
                                {AVAILABLE_ICONS.map(icon => (
                                    <div
                                        key={icon}
                                        className={`icon-option ${deptInfo.icon === icon ? 'selected' : ''}`}
                                        onClick={() => handleSelectIcon(icon)}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            fontSize: '20px',
                                            color: '#64748b',
                                            transition: 'all 0.2s'
                                        }}
                                        title={icon}
                                    >
                                        <i className={`fas ${icon}`}></i>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setShowIconModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DetalhesDepartamento;
