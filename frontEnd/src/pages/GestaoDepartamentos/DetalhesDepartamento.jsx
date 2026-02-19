import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import './DetalhesDepartamento.css';

// Mock Data
const MOCK_DEPT_INFO = {
    1: { name: 'Marketing', description: 'Comunicação & Branding', head: 'Sarah Jenkins', headRole: 'Director', icon: 'fa-bullhorn', color: '#eff6ff', iconColor: '#3b82f6' },
    2: { name: 'Vendas', description: 'Comercial & Growth', head: 'Michael Scott', headRole: 'Manager', icon: 'fa-wallet', color: '#fff7ed', iconColor: '#f97316' },
    3: { name: 'Recursos Humanos', description: 'Gente & Gestão', head: 'Pam Beesly', headRole: 'Coordinator', icon: 'fa-id-card', color: '#fdf4ff', iconColor: '#d946ef' },
    4: { name: 'Tecnologia', description: 'Engenharia & Produto', head: 'Gilfoyle', headRole: 'CTO', icon: 'fa-laptop-code', color: '#f0fdf4', iconColor: '#22c55e' },
    5: { name: 'Financeiro', description: 'Contabilidade & Fiscal', head: 'Oscar Martinez', headRole: 'Accountant', icon: 'fa-chart-line', color: '#f8fafc', iconColor: '#64748b' },
};

const INITIAL_MEMBERS = [
    { id: 101, name: 'John Doe', email: 'john.doe@upmap.com', role: 'Senior Marketer', status: 'Ativo', joined: 'Out 12, 2021' },
    { id: 102, name: 'Jane Smith', email: 'jane.smith@upmap.com', role: 'Content Writer', status: 'Férias', joined: 'Jan 05, 2022' },
    { id: 103, name: 'Robert Chen', email: 'r.chen@upmap.com', role: 'SEO Specialist', status: 'Ativo', joined: 'Mar 22, 2022' },
    { id: 104, name: 'Emily Watson', email: 'e.watson@upmap.com', role: 'Social Media Manager', status: 'Ativo', joined: 'Jun 14, 2022' },
    { id: 105, name: 'Michael Brown', email: 'm.brown@upmap.com', role: 'Designer', status: 'Ativo', joined: 'Jul 20, 2022' },
    { id: 106, name: 'Sarah Connor', email: 's.connor@upmap.com', role: 'Security', status: 'Ativo', joined: 'Aug 15, 2022' },
    { id: 107, name: 'Rick Deckard', email: 'r.deckard@upmap.com', role: 'Investigator', status: 'Inativo', joined: 'Sep 01, 2019' },
];

const DetalhesDepartamento = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const showToast = useToast();

    const deptInfo = MOCK_DEPT_INFO[id] || MOCK_DEPT_INFO[1];
    const [members, setMembers] = useState(INITIAL_MEMBERS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
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

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMembers = members.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(members.length / itemsPerPage);

    const handleRemoveMember = (memberId) => {
        if (window.confirm('Tem certeza que deseja remover este colaborador do departamento?')) {
            setMembers(members.filter(m => m.id !== memberId));
            showToast('success', 'Colaborador removido com sucesso!');
        }
    };

    const handleAddMember = (e) => {
        e.preventDefault();
        const newMember = {
            id: Date.now(),
            name: 'Novo Colaborador',
            email: 'novo.colaborador@upmap.com',
            role: 'Junior Analyst',
            status: 'Ativo',
            joined: new Date().toLocaleDateString('pt-BR', { month: 'short', day: '2-digit', year: 'numeric' })
        };
        setMembers([...members, newMember]);
        setShowAddModal(false);
        showToast('success', 'Colaborador adicionado ao departamento!');
    };

    const toggleMenu = (id, e) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === id ? null : id);
    };

    const handleEditClick = (member) => {
        setEditingMember({ ...member });
        setShowEditModal(true);
        setOpenMenuId(null);
    };

    const handleSaveEdit = (e) => {
        e.preventDefault();
        setMembers(members.map(m => m.id === editingMember.id ? editingMember : m));
        setShowEditModal(false);
        showToast('success', 'Dados do colaborador atualizados!');
    };

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="detalhes-departamento-section">

                        {/* Header */}
                        <div className="detalhes-header">
                            <div className="breadcrumbs">
                                <Link to="/gestao/departamentos">Departamentos</Link>
                                <i className="fas fa-chevron-right" style={{ fontSize: '10px' }}></i>
                                <span>{deptInfo.name}</span>
                            </div>
                            <div className="dept-title-row">
                                <div>
                                    <h1>{deptInfo.name}</h1>
                                    <p className="dept-subtitle">{deptInfo.description}</p>
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
                                            <h3>{deptInfo.head}</h3>
                                            <span className="role-badge">{deptInfo.headRole}</span>
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
                                                        {member.name.charAt(0)}
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
                                                        style={{ background: member.status === 'Ativo' ? '#22c55e' : '#f59e0b' }}
                                                    ></span>
                                                    <span
                                                        className="status-text"
                                                        style={{ color: member.status === 'Ativo' ? '#166534' : '#b45309' }}
                                                    >
                                                        {member.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{member.joined}</td>
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
                                                        <div className="member-action-menu" ref={menuRef}>
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
                    <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Adicionar Membro</h3>
                        </div>
                        <div className="modal-body">
                            <p>Selecione um colaborador para adicionar ao departamento de <strong>{deptInfo.name}</strong>.</p>
                            <form onSubmit={handleAddMember}>
                                <div className="form-group">
                                    <label>Colaborador</label>
                                    <select className="form-control" autoFocus>
                                        <option>Selecione...</option>
                                        <option>Carlos Oliveira</option>
                                        <option>Ana Souza</option>
                                        <option>Pedro Santos</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Cargo no Departamento</label>
                                    <input type="text" className="form-control" placeholder="Ex: Analista Junior" />
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
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={editingMember.email}
                                            onChange={e => setEditingMember({ ...editingMember, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
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

                                <div className="form-group" style={{ marginTop: '12px' }}>
                                    <label>Data de Entrada</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={editingMember.joined}
                                        onChange={e => setEditingMember({ ...editingMember, joined: e.target.value })}
                                        placeholder="Ex: Jan 01, 2023"
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
        </Layout>
    );
};

export default DetalhesDepartamento;
